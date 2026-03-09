import { useEffect, useState } from "react";
import {
  MapPin,
  IdCard,
  Briefcase,
  Phone,
  Pencil,
  X,
  Camera,
  Mail,
  GraduationCap,
  Building2,
  HeartPulse,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient.js";
import EditProfileModal from "./HrEditModal.jsx";
import { formatDDMMYYYY } from "../../lib/dateUtils.js";

/* ========================================================= */
/* ======================= HELPERS ========================= */
/* ========================================================= */

const AUTH_KEY = "HRMSS_AUTH_SESSION";
const HR_CACHE_KEY = (userId) => `hrmss.profile.cache.hr.${userId || "unknown"}`;

function safeJsonParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readAuth() {
  const s = safeJsonParse(localStorage.getItem(AUTH_KEY)) || {};
  const userId = String(s.user_id || s.id || s.userId || s.employee_id || s.identifier || "").trim();
  const email = String(s.email || s.identifier || "").trim();
  const fullName = String(s.full_name || s.fullName || s.name || "").trim();
  return { userId, email, fullName };
}

const isDmy = (value) => /^\d{2}\/\d{2}\/\d{4}$/.test(value);

const formatDateValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  if (isDmy(raw)) return raw;
  const formatted = formatDDMMYYYY(raw);
  return formatted === "-" ? raw : formatted;
};

function mapDbToProfile(data, fallback = {}) {
  if (!data) return null;

  return {
    name: data.full_name || fallback.fullName || "",
    id: data.employee_id || fallback.userId || "",
    avatar: data.avatar_url || "",

    personal: {
      dob: data.dob || "",
      gender: data.gender || "",
      maritalStatus: data.marital_status || "",
      bloodGroup: data.blood_group || "",
      personalEmail: data.personal_email || data.email || fallback.email || "",
      officialEmail: data.official_email || "",
      mobileNumber: data.mobile_number || data.phone || "",
      alternateContactNumber: data.alternate_contact_number || "",
      currentAddress: data.current_address || "",
      permanentAddress: data.permanent_address || "",
      panId: data.pan_id || "",
      authorId: data.author_id || "",
    },

    job: {
      employeeId: data.employee_id || fallback.userId || "",
      title: data.designation || "Manager",
      department: data.department || "Management",
      location: data.location || "",
      workMode: data.work_mode || "Office",
    },

    education: Array.isArray(data.education) ? data.education : [],
    experience: Array.isArray(data.experience) ? data.experience : [],

    skills: {
      primarySkills: data.primary_skills || "",
      secondarySkills: data.secondary_skills || "",
      toolsTechnologies: data.tools_technologies || "",
    },

    bank: {
      accountHolderName: data.account_holder_name || "",
      bankName: data.bank_name || "",
      accountNumber: data.account_number || "",
      ifscCode: data.ifsc_code || "",
      branch: data.branch || "",
    },

    emergencyContacts: data.emergency_name
      ? [
        {
          name: data.emergency_name || "",
          relation: data.emergency_relationship || "",
          phone: data.emergency_contact_number || "",
        },
      ]
      : [],

    idProofs: [],

    // keep uid for save
    __userId: String(data.employee_id || fallback.userId || "").trim(),
  };
}

function profileToDbPayload(profile, userId, fallback = {}) {
  const p = profile || {};
  const personal = p.personal || {};
  const job = p.job || {};
  const skills = p.skills || {};
  const bank = p.bank || {};
  const e0 =
    Array.isArray(p.emergencyContacts) && p.emergencyContacts.length
      ? p.emergencyContacts[0]
      : null;

  return {
    role: "hr",

    full_name: p.name || fallback.fullName || null,
    email: personal.personalEmail || fallback.email || null,
    phone: personal.mobileNumber || null,

    employee_id: p.id || job.employeeId || userId || null,
    avatar_url: p.avatar || null,

    dob: personal.dob || null,
    gender: personal.gender || null,
    marital_status: personal.maritalStatus || null,
    blood_group: personal.bloodGroup || null,

    personal_email: personal.personalEmail || null,
    official_email: personal.officialEmail || null,
    mobile_number: personal.mobileNumber || null,
    alternate_contact_number: personal.alternateContactNumber || null,

    current_address: personal.currentAddress || null,
    permanent_address: personal.permanentAddress || null,
    pan_id: personal.panId || null,
    author_id: personal.authorId || null,

    location: job.location || null,
    department: job.department || null,
    designation: job.title || null,
    work_mode: job.workMode || null,

    education: Array.isArray(p.education) ? p.education : [],
    experience: Array.isArray(p.experience) ? p.experience : [],

    primary_skills: skills.primarySkills || null,
    secondary_skills: skills.secondarySkills || null,
    tools_technologies: skills.toolsTechnologies || null,

    account_holder_name: bank.accountHolderName || null,
    bank_name: bank.bankName || null,
    account_number: bank.accountNumber || null,
    ifsc_code: bank.ifscCode || null,
    branch: bank.branch || null,

    emergency_name: e0?.name || null,
    emergency_relationship: e0?.relation || null,
    emergency_contact_number: e0?.phone || null,

    profile_completed: true,
    updated_at: new Date().toISOString(),
  };
}

// ? upload helper shared with other areas (keeping bucket names in sync)
async function uploadAvatar({ folderKey, file }) {
  if (!file) return "";
  const cleanName = (file.name || "avatar").replace(/\s+/g, "-");
  const path = `profiles/${folderKey}/${Date.now()}-${cleanName}`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });

  if (upErr) throw upErr;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data?.publicUrl || "";
}

/* ========================================================= */
/* ======================= MAIN ============================ */
/* ========================================================= */

export default function HrProfile() {
  const auth = readAuth();
  const cacheKey = HR_CACHE_KEY(auth.userId);

  const [profile, setProfile] = useState(() => {
    // Immediate fallback to auth session data
    // Only use "User" if literally nothing else (name or email) is found.
    const sessionName = (auth.fullName || "").trim();
    const displayName = (sessionName && sessionName.toLowerCase() !== "user") ? sessionName : "";

    return {
      name: displayName || "User",
      id: auth.userId || "ID",
      job: { title: "Management", department: "Operations" }
    };
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [editProfile, setEditProfile] = useState(false);

  /* ================= FETCH HR PROFILE ================= */
  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        setErr("");
        setLoading(true);

        const { userId } = auth;
        if (!userId) {
          setErr("HR session not found. Please login again.");
          setProfile(null);
          return;
        }

        // ✅ 1) cache first (Sign-In page save pannina details)
        const cached = safeJsonParse(localStorage.getItem(cacheKey));
        if (cached && mounted) {
          setProfile(cached);
        }

        // ✅ 2) DB load
        if (!isSupabaseConfigured) {
          if (!cached) setErr("Supabase env missing. Showing cached/local data only.");
          if (!cached && mounted) setProfile(null);
          return;
        }

        // Query 'employees' table for the latest full_name and designation
        let { data, error } = await supabase
          .from("employees")
          .select("employee_id, full_name, designation, email, phone, location, gender, department, join_date")
          .eq("employee_id", userId)
          .maybeSingle();

        // If not found in employees by ID, try email
        if (!data && email) {
          const { data: emailData } = await supabase
            .from("employees")
            .select("employee_id, full_name, designation, email, phone, location, gender, department, join_date")
            .eq("email", email)
            .maybeSingle();
          if (emailData) data = emailData;
        }

        // If still not found, try 'hrms_employee_profile'
        if (!data) {
          const { data: pByEid } = await supabase
            .from("hrms_employee_profile")
            .select("employee_id, full_name, designation, official_email, personal_email, phone, location, gender, department")
            .eq("employee_id", userId)
            .maybeSingle();
          if (pByEid) data = pByEid;
        }

        // Final fallback for name mapping
        if (data) {
          data.full_name = data.full_name || data.name || auth.fullName;
          data.name = data.full_name;
        }

        if (error) throw error;

        // ✅ row exists
        if (data) {
          const mapped = mapDbToProfile(data, auth);
          localStorage.setItem(cacheKey, JSON.stringify(mapped));
          if (mounted) setProfile(mapped);
          return;
        }

        // ✅ 3) row NOT exists -> auto create (so "HR Profile not found" never shows)
        const minimal = {
          name: auth.fullName || "HR",
          id: userId,
          avatar: "",
          personal: {
            dob: "",
            gender: "",
            maritalStatus: "",
            bloodGroup: "",
            personalEmail: auth.email || "",
            officialEmail: "",
            mobileNumber: "",
            alternateContactNumber: "",
            currentAddress: "",
            permanentAddress: "",
          },
          job: {
            employeeId: userId,
            title: "Manager",
            department: "Management",
            location: "",
            workMode: "Office",
          },
          education: [],
          experience: [],
          skills: { primarySkills: "", secondarySkills: "", toolsTechnologies: "" },
          bank: { accountHolderName: "", bankName: "", accountNumber: "", ifscCode: "", branch: "" },
          emergencyContacts: [],
          idProofs: [],
          __userId: userId,
        };

        const payload = profileToDbPayload(minimal, userId, auth);

        // ⚠️ if your table doesn't have role column, remove role from payload above
        const { error: upErr } = await supabase
          .from("hrms_employee_profile")
          .upsert(payload, { onConflict: "employee_id" });

        if (upErr) throw upErr;

        localStorage.setItem(cacheKey, JSON.stringify(minimal));
        if (mounted) setProfile(minimal);
      } catch (e) {
        console.error("HR profile load error:", e);
        if (mounted) setErr(e?.message || "Failed to load HR profile");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ================= SAVE (cache + DB) ================= */
  const persistProfile = async (next) => {
    setProfile(next);
    localStorage.setItem(cacheKey, JSON.stringify(next));

    if (!isSupabaseConfigured) return;

    try {
      const userId = auth.userId;
      if (!userId) return;

      const payload = profileToDbPayload(next, userId, auth);

      const { error } = await supabase
        .from("hrms_employee_profile")
        .upsert(payload, { onConflict: "employee_id" });

      if (error) throw error;
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Failed to save profile");
    }
  };

  /* ================= UI STATES ================= */

  if (loading) {
    return (
      <div className="p-10 text-center text-slate-500 font-semibold">
        Loading HR Profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-10 text-center text-rose-600 font-semibold">
        HR Profile not found
      </div>
    );
  }

  const {
    name,
    id,
    personal,
    job,
    education,
    experience,
    skills,
    bank,
    emergencyContacts,
    avatar,
  } = profile;

  const changeAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!profile) return;

    const previewUrl = URL.createObjectURL(file);
    setProfile((prev) => ({ ...prev, avatar: previewUrl }));

    setAvatarUploading(true);
    try {
      const userId = auth.userId || profile?.__userId || id || "hr";
      const avatarUrl = isSupabaseConfigured
        ? await uploadAvatar({ folderKey: userId, file })
        : previewUrl;

      const nextProfile = { ...profile, avatar: avatarUrl };
      await persistProfile(nextProfile);
    } catch (uploadErr) {
      console.error("Avatar upload failed:", uploadErr);
      setErr(uploadErr?.message || "Failed to upload avatar");
    } finally {
      setAvatarUploading(false);
      if (isSupabaseConfigured) {
        URL.revokeObjectURL(previewUrl);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white rounded-[32px] border border-slate-100 p-12 shadow-sm flex flex-col items-center text-center gap-6">
        <div className="h-24 w-24 rounded-full bg-gradient-to-br from-[#598791] to-[#2d2430] flex items-center justify-center text-white text-3xl font-black shadow-lg">
          {name ? name.charAt(0).toUpperCase() : "U"}
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Hi, <span className="text-[#598791]">{name || auth.fullName || "User"}</span>
          </h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">
            Welcome to your profile
          </p>
        </div>

        <div className="h-1 w-24 bg-slate-100 rounded-full" />

        <img src="/VijayShipping_Logo.png" alt="Vijay Shipping" className="h-8 w-auto" />
      </div>
    </div>
  );
}

/* ========================================================= */
/* ===================== UI HELPERS ======================== */
/* ========================================================= */

function Badge({ children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold bg-slate-100">
      {children}
    </span>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      {children}
    </div>
  );
}

function Detail({ label, value, full }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="font-semibold text-slate-900">{value || "-"}</p>
    </div>
  );
}

function CardBlock({ title, icon: Icon, children }) {
  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <div className="flex items-center gap-2 font-semibold">
        <Icon size={16} /> {title}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function EmptyHint({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-2 text-slate-500 text-sm">
      <Icon size={16} /> {text}
    </div>
  );
}


