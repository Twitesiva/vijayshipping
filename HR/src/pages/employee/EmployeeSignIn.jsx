// ✅ src/pages/employee/EmployeeSignIn.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Save,
  IdCard,
  User,
  Mail,
  ShieldCheck,
  ArrowLeft,
  Briefcase,
  ChevronDown,
  CalendarDays,
} from "lucide-react";

import ImageCropper from "../../components/ImageCropper.jsx";
import { supabase } from "../../lib/supabaseClient";

import Preloader from "../../components/Preloader";

/* ===================== UI HELPERS ===================== */

function Input({ icon: Icon, label, type = "text", value, onChange, placeholder, disabled, required, error }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</label>
      <div className={`flex items-center gap-2 rounded-xl border ${error ? 'border-rose-300 bg-rose-50/50' : 'border-slate-200 bg-slate-50/50'} px-3 py-2.5 transition-all focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100 ${disabled ? 'opacity-60' : ''}`}>
        {Icon && <Icon size={15} className="text-slate-400 shrink-0" />}
        <input
          type={type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}

function Select({ icon: Icon, label, value, onChange, options = [], placeholder, required, error }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</label>
      <div className={`flex items-center gap-2 rounded-xl border ${error ? 'border-rose-300 bg-rose-50/50' : 'border-slate-200 bg-slate-50/50'} px-3 py-2.5 transition-all focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100`}>
        {Icon && <Icon size={15} className="text-slate-400 shrink-0" />}
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-sm text-slate-800 outline-none appearance-none cursor-pointer"
        >
          <option value="">{placeholder || "Select..."}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <ChevronDown size={14} className="text-slate-400 shrink-0 pointer-events-none" />
      </div>
    </div>
  );
}

/* ===================== CONFIG ===================== */

const ROLE_LABELS = {
  employee: "Employee",
  hr: "Manager",
  admin: "Manager",
  manager: "Manager",
  founder: "Founder",
};

const ROLE_REDIRECTS = {
  employee: "/employee-dashboard",
  hr: "/hr-dashboard",
  admin: "/dashboard",
  manager: "/manager-dashboard",
  founder: "/founder-dashboard",
};

const COMPLETION_KEY = (role) => `hrmss.signin.completed.${role}`;
const AUTH_KEY = "HRMSS_AUTH_SESSION";

/* ✅ Local profile cache key (MyProfile show aaga use aagum) */
const PROFILE_CACHE_KEY = (role, key) =>
  `hrmss.profile.cache.${role}.${key || "unknown"}`;

/* ===================== HELPERS ===================== */

const emptyForm = (empIdFromLogin = "", userEmail = "") => ({
  employeeId: empIdFromLogin,
  fullName: "",
  officialEmail: userEmail || "",
  idSeries: "T",
  designation: "",
  joiningDate: "",
  password: "",
});

function mapDbToForm(row, empIdFromLogin = "", userEmail = "") {
  return {
    employeeId: row.employee_id ?? empIdFromLogin ?? "",
    fullName: row.full_name ?? "",
    officialEmail: row.official_email ?? userEmail ?? "",
    idSeries: row.id_series ?? "T",
    designation: row.designation ?? "",
    joiningDate: row.joining_date ?? "",
    password: "", // Handled separately or not shown
  };
}

function readAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* ✅ optional: read cached profile (fallback) */
function readCachedProfile(role, key) {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY(role, key));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ✅ employee uses employeeId as "folder"


const hydrateJobInfoFromEmployees = async (empId, setForm, alreadyMergedRef, isMounted = () => true) => {
  if (!empId || alreadyMergedRef.current) return;
  const { data, error } = await supabase
    .from("employees")
    .select("full_name, email, gender, employee_type, status, designation, department, reporting_manager, join_date, location")
    .eq("employee_id", empId)
    .maybeSingle();

  if (error || !data || !isMounted()) return;

  alreadyMergedRef.current = true;
  setForm((prev) => ({
    ...prev,
    fullName: prev.fullName || data.full_name || "",
    officialEmail: prev.officialEmail || data.email || "",
    gender: prev.gender || data.gender || "",
    department: prev.department || data.department || "",
    designation: prev.designation || data.designation || "",
    joiningDate: prev.joiningDate || data.join_date || "",
    workMode: prev.workMode || prev.work_mode || "",
    manager: prev.manager || data.reporting_manager || "",
    location: prev.location || data.location || "",
  }));
};

const handleFileSelect = (e) => {
  const file = e.target.files?.[0];
  if (file) {
    setTempFile(file);
    setShowCropper(true);
    e.target.value = ''; // Clear input
  }
};

const handleCropComplete = async (croppedFile) => {
  setShowCropper(false);
  setTempFile(null);
  if (!croppedFile) return;

  setAvatarFile(croppedFile);
};

async function uploadAvatar({ folderKey, file }) {
  const cleanName = (file.name || "avatar").replace(/\s+/g, "-");
  const path = `profiles/${folderKey}/${Date.now()}-${cleanName}`;

  try {
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (upErr) throw upErr;
  } catch (err) {
    // Storage bucket has RLS; fall back to no avatar rather than blocking profile save.
    console.warn("Avatar upload skipped:", err?.message || err);
    return "";
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data?.publicUrl || "";
}

const calculateExperience = (from, to) => {
  if (!from) return "";
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  if (isNaN(start.getTime())) return "";

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  // Adjust for partial months
  if (days < 0) {
    months--;
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  const yPart = years > 0 ? `${years} Year${years > 1 ? "s" : ""}` : "0 Years";
  const mPart = `${months} Month${months !== 1 ? "s" : ""}`;

  return `${yPart} ${mPart}`;
};

/* ===================== COMPONENT ===================== */

export default function EmployeeSignIn() {
  const navigate = useNavigate();
  const location = useLocation();

  const roleFromState = location.state?.role || "";
  const roleFromStorage = localStorage.getItem("hrmss.lastRole") || "";
  const role = roleFromState || roleFromStorage || "employee";

  const roleLabel = ROLE_LABELS[role] || "User";
  const redirectTo =
    location.state?.redirectTo || ROLE_REDIRECTS[role] || "/login";
  const empIdFromLogin = location.state?.empId || "";


  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false); // ✅ Validation state

  const jobInfoMerged = useRef(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [tempFile, setTempFile] = useState(null);

  const [form, setForm] = useState(() => emptyForm(empIdFromLogin, ""));

  useEffect(() => {
    if (role) localStorage.setItem("hrmss.lastRole", role);
  }, [role]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const authCache = readAuthSession();

        // ✅ Employee role: no supabase auth needed
        if (role === "employee") {
          const empId = String(
            empIdFromLogin || authCache?.employee_id || authCache?.identifier || ""
          ).trim();

          if (!empId) {
            navigate("/login", { replace: true });
            return;
          }

          const { data: row, error: selErr } = await supabase
            .from("hrms_employee_profile")
            .select("*")
            .eq("employee_id", empId)
            .maybeSingle();

          if (selErr) throw selErr;
          if (!mounted) return;


          if (row) {
            setForm(mapDbToForm(row, empId, ""));
          } else {
            // ✅ fallback: cached -> else empty
            const cached = readCachedProfile("employee", empId);
            if (cached)
              setForm({ ...emptyForm(empId, ""), ...cached, employeeId: empId });
            else setForm(emptyForm(empId, ""));
          }


          await hydrateJobInfoFromEmployees(empId, setForm, jobInfoMerged, () => mounted);
          return;
        }

        // ✅ Special case: Approver employee (admin role but actually an employee)
        const approverEmail = authCache?.email || authCache?.identifier || "";
        const isApproverEmployee = role === "admin" &&
          String(approverEmail).trim().toLowerCase() === "haripriya@vijayshipping.com";

        if (isApproverEmployee) {
          // Fetch from hrms_employee_profile using email (like employee flow)
          const { data: empRow, error: empErr } = await supabase
            .from("hrms_employee_profile")
            .select("*")
            .or(`official_email.eq.${approverEmail},personal_email.eq.${approverEmail}`)
            .maybeSingle();

          if (empErr) throw empErr;
          if (!mounted) return;

          const empId = empRow?.employee_id || authCache?.employee_id || "";

          if (empRow) {
            setForm(mapDbToForm(empRow, empId, approverEmail));
          } else {
            // Start with empty form for fresh profile
            setForm(emptyForm(empId, approverEmail));
          }

          // Hydrate job info from employees table
          if (empId) {
            await hydrateJobInfoFromEmployees(empId, setForm, jobInfoMerged, () => mounted);
          }
          return;
        }

        // ✅ Other roles (hr/admin/manager) - existing logic (supabase auth)
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user || null;

        const userId = user?.id || authCache?.id || null;

        const userEmail =
          user?.email ||
          authCache?.email ||
          authCache?.official_email ||
          authCache?.identifier ||
          "";

        if (!userId) {
          // If no UUID/Auth session, try using the standard employee/session ID before giving up
          const fallbackId = authCache?.employee_id || authCache?.user_id || authCache?.id || "";
          if (fallbackId && role !== "employee") {
            // We have a session, just not a Supabase Auth one. Try to load profile via this ID.
            const { data: row, error: selErr } = await supabase
              .from("hrms_employee_profile")
              .select("*")
              .eq("employee_id", fallbackId)
              .maybeSingle();

            if (!selErr && row) {
              setForm(mapDbToForm(row, empIdFromLogin, userEmail));
              setLoading(false);
              return;
            }
          }

          console.warn("[EmployeeSignIn] No valid userId or session found, redirecting to login...");
          navigate("/login", { replace: true, state: { redirectTo: "/sign-in", role } });
          return;
        }

        const { data: row, error: selErr } = await supabase
          .from("hrms_employee_profile")
          .select("*")
          .or(`employee_id.eq.${userId},employee_id.eq.${empIdFromLogin}`)
          .maybeSingle();

        if (selErr) throw selErr;
        if (!mounted) return;

        if (row) setForm(mapDbToForm(row, empIdFromLogin, userEmail));
        else {
          // ✅ fallback: cached -> else empty
          const cached = readCachedProfile(role, userId);
          if (cached) setForm({ ...emptyForm(empIdFromLogin, userEmail), ...cached });
          else setForm(emptyForm(empIdFromLogin, userEmail));
        }
      } catch (e) {
        console.error(e);
        if (mounted) setError(e?.message || "Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [empIdFromLogin, navigate, role]);

  const onChange = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const completeness = useMemo(() => {
    const must = [
      form.employeeId,
      form.fullName,
      form.officialEmail,
      form.idSeries,
      form.designation,
      form.joiningDate,
    ];
    const filled = must.filter((v) => String(v || "").trim().length > 0).length;
    return Math.round((filled / must.length) * 100);
  }, [form]);


  /* ✅ Check if this is an "Edit Profile" mode (already completed once) */
  const isEditMode = useMemo(() => {
    return localStorage.getItem(COMPLETION_KEY(role)) === "true";
  }, [role]);

  const saveAndContinue = async () => {
    try {
      setSaving(true);
      setError("");
      setIsSubmitted(true); // ✅ Trigger validation visuals

      const requiredFields = [
        { key: "fullName", label: "Full Name" },
        { key: "officialEmail", label: "Email" },
        { key: "employeeId", label: "Employee ID" },
        { key: "idSeries", label: "ID Series" },
        { key: "designation", label: "Designation" },
        { key: "joiningDate", label: "Date of Joining" },
      ];

      const missing = requiredFields.filter((f) => !String(form[f.key] || "").trim());
      if (missing.length) {
        setError("Please fill the required fields to continue.");
        setSaving(false);
        return;
      }

      // ✅ EMPLOYEE save to hrms_employee_profile
      if (role === "employee") {
        const empId = String(form.employeeId || empIdFromLogin || "").trim();
        if (!empId) {
          setError("Employee ID missing");

          setSaving(false);
          return;
        }

        let avatar_url = form.avatar || "";
        if (avatarRemoved) {
          avatar_url = null;
        } else if (avatarFile) {
          avatar_url = await uploadAvatar({ folderKey: empId, file: avatarFile });
        } else {
          if (String(avatar_url).startsWith("blob:")) avatar_url = null;
        }

        const payload = {
          employee_id: empId,
          profile_key: empId,

          profile_completed: true,
          full_name: form.fullName || null,
          dob: form.dob || null,
          gender: form.gender || null,
          marital_status: form.maritalStatus || null,
          blood_group: form.bloodGroup || null,
          pan_id: form.pan_id || null,
          author_id: form.author_id || null,

          personal_email: form.personalEmail || null,
          official_email: form.officialEmail || null,
          mobile_number: form.mobileNumber || null,
          alternate_contact_number: form.alternateContactNumber || null,

          current_address: form.currentAddress || null,
          permanent_address: form.permanentAddress || null,
          education: Array.isArray(form.education) ? form.education : [],
          experience: Array.isArray(form.experience) ? form.experience : [],
          primary_skills: form.primarySkills || null,
          secondary_skills: form.secondarySkills || null,
          tools_technologies: form.toolsTechnologies || null,
          account_holder_name: form.accountHolderName || null,
          bank_name: form.bankName || null,
          account_number: form.accountNumber || null,
          ifsc_code: form.ifscCode || null,
          branch: form.branch || null,

          emergency_name: form.emergencyName || null,
          emergency_relationship: form.emergencyRelationship || null,
          emergency_contact_number: form.emergencyContactNumber || null,
          location: form.location || null,
          avatar_url: avatar_url || null,

          // ✅ Job Info
          designation: form.designation || null,
          department: form.designation || null,
          joining_date: form.joiningDate || null,
          reporting_manager: form.manager || null,

          // ✅ Job Experience columns
          total_experience: form.totalExpFrom ? `${form.totalExpFrom} - ${(!form.totalExpTo || form.totalExpPresent) ? "Present" : form.totalExpTo}` : null,
          relevant_experience: form.relevantExpFrom ? `${form.relevantExpFrom} - ${(!form.relevantExpTo || form.relevantExpPresent) ? "Present" : form.relevantExpTo}` : null,
        };

        const { error: upErr } = await supabase
          .from("hrms_employee_profile")
          .upsert(payload, { onConflict: "employee_id" });

        if (upErr) throw upErr;

        if (avatar_url && String(form.avatar).startsWith("blob:")) {
          const old = form.avatar;
          onChange("avatar", avatar_url);
          try {
            URL.revokeObjectURL(old);
          } catch { }
        }


        try {
          const cacheForm = { ...form, employeeId: empId, avatar: avatar_url || "" };
          localStorage.setItem(PROFILE_CACHE_KEY("employee", empId), JSON.stringify(cacheForm));
        } catch { }

      localStorage.setItem(COMPLETION_KEY(role), "true");

        try {
          const authSession = localStorage.getItem("HRMSS_AUTH_SESSION");
          if (authSession) {
            const parsed = JSON.parse(authSession);
            parsed.designation = form.designation;
            localStorage.setItem("HRMSS_AUTH_SESSION", JSON.stringify(parsed));
          }
        } catch { }

        if (tempFile) {
          URL.revokeObjectURL(tempFile);
        }


        // ✅ If editing from dashboard, just go back. Else go to redirect.
        if (isEditMode) navigate(-1);
        else navigate(redirectTo || ROLE_REDIRECTS.employee, { replace: true });
        return;
      }

      // ✅ Approver employee: save to hrms_employee_profile (like employee)
      const authCache = readAuthSession();
      const approverEmail = authCache?.email || authCache?.identifier || "";
      const isApproverEmployee = role === "admin" &&
        String(approverEmail).trim().toLowerCase() === "haripriya@twite.ai";

      if (isApproverEmployee) {
        const empId = String(form.employeeId || authCache?.employee_id || "").trim();

        let avatar_url = form.avatar || "";
        if (avatarRemoved) {
          avatar_url = null;
        } else if (avatarFile) {
          avatar_url = await uploadAvatar({ folderKey: empId || approverEmail, file: avatarFile });
        } else {
          if (String(avatar_url).startsWith("blob:")) avatar_url = null;
        }

        const payload = {
          employee_id: empId || null,
          profile_key: empId || approverEmail,
          profile_completed: true,
          full_name: form.fullName || null,
          dob: form.dob || null,
          gender: form.gender || null,
          marital_status: form.maritalStatus || null,
          blood_group: form.bloodGroup || null,
          pan_id: form.pan_id || null,
          author_id: form.author_id || null,
          personal_email: form.personalEmail || null,
          official_email: form.officialEmail || approverEmail || null,
          mobile_number: form.mobileNumber || null,
          alternate_contact_number: form.alternateContactNumber || null,
          current_address: form.currentAddress || null,
          permanent_address: form.permanentAddress || null,
          education: Array.isArray(form.education) ? form.education : [],
          experience: Array.isArray(form.experience) ? form.experience : [],
          primary_skills: form.primarySkills || null,
          secondary_skills: form.secondarySkills || null,
          tools_technologies: form.toolsTechnologies || null,
          account_holder_name: form.accountHolderName || null,
          bank_name: form.bankName || null,
          account_number: form.accountNumber || null,
          ifsc_code: form.ifscCode || null,
          branch: form.branch || null,
          emergency_name: form.emergencyName || null,
          emergency_relationship: form.emergencyRelationship || null,
          emergency_contact_number: form.emergencyContactNumber || null,
          location: form.location || null,
          avatar_url: avatar_url || null,

          // ✅ Job Info
          designation: form.designation || null,
          department: form.designation || null,
          joining_date: form.joiningDate || null,
          reporting_manager: form.manager || null,

          // ✅ Job Experience columns
          total_experience: form.totalExpFrom ? `${form.totalExpFrom} - ${(!form.totalExpTo || form.totalExpPresent) ? "Present" : form.totalExpTo}` : null,
          relevant_experience: form.relevantExpFrom ? `${form.relevantExpFrom} - ${(!form.relevantExpTo || form.relevantExpPresent) ? "Present" : form.relevantExpTo}` : null,
        };

        // Upsert using official_email since approver may not have employee_id yet
        const { error: upErr } = await supabase
          .from("hrms_employee_profile")
          .upsert(payload, { onConflict: empId ? "employee_id" : "official_email" });

        if (upErr) throw upErr;

        if (avatar_url && String(form.avatar).startsWith("blob:")) {
          const old = form.avatar;
          onChange("avatar", avatar_url);
          try { URL.revokeObjectURL(old); } catch { }
        }

        localStorage.setItem(COMPLETION_KEY("admin"), "true");

        if (isEditMode) navigate(-1);
        else navigate(redirectTo || ROLE_REDIRECTS.admin, { replace: true });
        return;
      }

      // ✅ Other roles (HR, Admin, etc.)
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user || null;

      const userId = user?.id || authCache?.id || null;

      const userEmail = user?.email || authCache?.email || authCache?.official_email || authCache?.identifier || "";

      if (!userId) {
        navigate("/login", { replace: true, state: { redirectTo: "/sign-in", role } });
        return;
      }

      let avatar_url = form.avatar || "";
      if (avatarRemoved) {
        avatar_url = null;
      } else if (avatarFile) {
        avatar_url = await uploadAvatar({ folderKey: userId, file: avatarFile });
      } else {
        if (String(avatar_url).startsWith("blob:")) avatar_url = null;
      }

      const payload = {
        user_id: userId,
        role,
        profile_key: userEmail || form.employeeId || null,

        employee_id: form.employeeId || null,
        full_name: form.fullName || null,
        dob: form.dob || null,
        gender: form.gender || null,
        marital_status: form.maritalStatus || null,
        blood_group: form.bloodGroup || null,
        pan_id: form.pan_id || null,
        author_id: form.author_id || null,

        personal_email: form.personalEmail || null,
        official_email: userEmail || form.officialEmail || null,
        mobile_number: form.mobileNumber || null,
        alternate_contact_number: form.alternateContactNumber || null,
        current_address: form.currentAddress || null,
        permanent_address: form.permanentAddress || null,
        education: Array.isArray(form.education) ? form.education : [],
        experience: Array.isArray(form.experience) ? form.experience : [],
        primary_skills: form.primarySkills || null,
        secondary_skills: form.secondarySkills || null,
        tools_technologies: form.toolsTechnologies || null,
        account_holder_name: form.accountHolderName || null,
        bank_name: form.bankName || null,
        account_number: form.accountNumber || null,
        ifsc_code: form.ifscCode || null,
        branch: form.branch || null,

        emergency_name: form.emergencyName || null,
        emergency_relationship: form.emergencyRelationship || null,
        emergency_contact_number: form.emergencyContactNumber || null,
        location: form.location || null,
        avatar_url: avatar_url || null,

        // ✅ Job Info columns
        department: form.department || null,
        designation: form.designation || null,
        work_mode: form.workMode || null,
        joining_date: form.joiningDate || null,
        reporting_manager: form.manager || null,

        // ✅ Job Experience columns
        total_experience: form.totalExpFrom ? `${form.totalExpFrom} - ${(!form.totalExpTo || form.totalExpPresent) ? "Present" : form.totalExpTo}` : null,
        relevant_experience: form.relevantExpFrom ? `${form.relevantExpFrom} - ${(!form.relevantExpTo || form.relevantExpPresent) ? "Present" : form.relevantExpTo}` : null,
      };

      const { error: upErr } = await supabase
        .from("hrms_employee_profile")
        .upsert(payload, { onConflict: "employee_id" });
      if (upErr) throw upErr;

      try {
        const authSession = localStorage.getItem("HRMSS_AUTH_SESSION");
        if (authSession) {
          const parsed = JSON.parse(authSession);
          parsed.designation = form.designation;
          localStorage.setItem("HRMSS_AUTH_SESSION", JSON.stringify(parsed));
        }
      } catch { }

      if (avatar_url && String(form.avatar).startsWith("blob:")) {
        const old = form.avatar;
        onChange("avatar", avatar_url);
        try {
          URL.revokeObjectURL(old);
        } catch { }
      }


      try {
        const cacheForm = { ...form, avatar: avatar_url || "" };
        localStorage.setItem(PROFILE_CACHE_KEY(role, userId), JSON.stringify(cacheForm));
      } catch { }

      localStorage.setItem(COMPLETION_KEY(role), "true");
      // For management roles, mark all variants as completed to avoid loops in shared layouts
      if (["hr", "manager", "founder"].includes(role)) {
        localStorage.setItem(COMPLETION_KEY("hr"), "true");
        localStorage.setItem(COMPLETION_KEY("manager"), "true");
        localStorage.setItem(COMPLETION_KEY("founder"), "true");
      }


      if (isEditMode) navigate(-1);
      else navigate(redirectTo, { replace: true });

    } catch (e) {
      console.error(e);
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {

    return <Preloader variant="page" message="Fetching Profile Data" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-slate-50 p-4 md:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* TOP BAR */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
              title="Go Back"
            >
              <ArrowLeft size={18} />
            </button>

            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {isEditMode ? "Manage Profile" : `${roleLabel} Setup`}
              </h1>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {isEditMode ? "Update your personal and professional records" : "Complete your profile to unlock all features"} •{" "}
                <span className="text-purple-600 font-black">{completeness}% Complete</span>
              </p>

              {error ? (
                <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50/50 px-4 py-2.5 text-xs font-bold text-rose-600 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                  {error}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">

            {!isEditMode && (
              <button
                type="button"
                onClick={() => {
                  if (form.avatar && String(form.avatar).startsWith("blob:")) {
                    try {
                      URL.revokeObjectURL(form.avatar);
                    } catch { }
                  }
                  setAvatarFile(null);
                  setAvatarRemoved(false);
                  setForm((p) => emptyForm(empIdFromLogin, p.officialEmail || ""));
                }}
                className="px-5 py-2.5 rounded-xl border border-rose-200 text-xs font-black text-rose-600 uppercase tracking-widest hover:bg-rose-50 transition-all"
              >
                Reset
              </button>
            )}

            <button
              onClick={saveAndContinue}
              disabled={saving}

              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-700 text-xs font-black text-white uppercase tracking-widest hover:bg-purple-800 shadow-lg shadow-purple-100 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95"
            >
              <Save size={16} />
              {saving ? "Processing..." : isEditMode ? "Save Changes" : "Finish Setup"}
            </button>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: FORM */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b bg-gradient-to-r from-purple-700 to-indigo-600 text-white">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/80">

                      {isEditMode ? "Profile Management" : "First Time Setup"}
                    </p>
                    <h2 className="text-lg md:text-xl font-bold leading-tight">
                      {isEditMode ? "Keep your records up to date" : "Complete your profile to continue"}
                    </h2>
                  </div>

                  <div className="hidden md:flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                    <ShieldCheck size={16} />
                    <span className="text-sm font-semibold">Secure</span>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-white/80">
                    <span>Profile Completion</span>
                    <span className="font-semibold text-white">{completeness}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/20 overflow-hidden">
                    <div className="h-full rounded-full bg-white" style={{ width: `${completeness}%` }} />
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8 space-y-8">
                <SectionHeader icon={User} title="Employee Information" subtitle="Basic onboarding details" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    icon={IdCard}
                    label="ID SERIES"
                    value={form.idSeries}
                    onChange={(v) => onChange("idSeries", v)}
                    options={["T", "S", "M"]} // Example series, can be adjusted
                    placeholder="Select Series"
                    required
                    error={isSubmitted && !form.idSeries}
                  />
                  <Input
                    icon={IdCard}
                    label="EMPLOYEE ID"
                    value={form.employeeId}
                    onChange={(v) => onChange("employeeId", v)}
                    placeholder="EMP-001"
                    disabled={!!form.employeeId && !isEditMode}
                    required
                    error={isSubmitted && !form.employeeId}
                  />
                  <Input
                    icon={Mail}
                    label="EMAIL"
                    value={form.officialEmail}
                    onChange={(v) => onChange("officialEmail", v)}
                    placeholder="name@company.com"
                    required
                    error={isSubmitted && !form.officialEmail}
                  />
                  <Input
                    icon={ShieldCheck}
                    label="PASSWORD"
                    type="password"
                    value={form.password}
                    onChange={(v) => onChange("password", v)}
                    placeholder="Enter password"
                    required={!isEditMode}
                    error={isSubmitted && !isEditMode && !form.password}
                  />
                  <Input
                    icon={User}
                    label="FULL NAME"
                    value={form.fullName}
                    onChange={(v) => onChange("fullName", v)}
                    placeholder="Enter full name"
                    required
                    error={isSubmitted && !form.fullName}
                  />
                  <Select
                    icon={Briefcase}
                    label="DESIGNATION"
                    value={form.designation}
                    onChange={(v) => onChange("designation", v)}
                    options={["Founder", "Manager", "Employee"]}
                    placeholder="Select Designation"
                    required
                    error={isSubmitted && !form.designation}
                  />
                  <Input
                    icon={CalendarDays}
                    label="DATE OF JOINING"
                    type="date"
                    value={form.joiningDate}
                    onChange={(v) => onChange("joiningDate", v)}
                    required
                    error={isSubmitted && !form.joiningDate}
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">


                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.setItem(COMPLETION_KEY(role), "true");
                        if (["hr", "manager", "founder"].includes(role)) {
                          localStorage.setItem(COMPLETION_KEY("hr"), "true");
                          localStorage.setItem(COMPLETION_KEY("manager"), "true");
                          localStorage.setItem(COMPLETION_KEY("founder"), "true");
                        }
                        navigate(redirectTo, { replace: true });
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
                    >
                      Fill Later
                    </button>

                    <button
                      type="button"
                      onClick={saveAndContinue}
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-950 shadow disabled:opacity-60 transition-all active:scale-95"
                    >
                      <Save size={16} />
                      {saving ? "Saving..." : isEditMode ? "Update Profile" : "Finish Setup"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: PREVIEW / SUMMARY */}
          <div className="space-y-6">
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b">
                <h3 className="text-sm font-bold text-slate-900">Preview</h3>
                <p className="text-xs text-slate-500 mt-1">This is how your profile will look</p>
              </div>

              <div className="p-6">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 truncate">{form.fullName || "Your Name"}</p>
                  <p className="text-xs text-slate-500 truncate">{form.employeeId || "EMP-XXX"}</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <MiniRow label="ID Series" value={form.idSeries} />
                <MiniRow label="Employee ID" value={form.employeeId} />
                <MiniRow label="Email" value={form.officialEmail} />
                <MiniRow label="Designation" value={form.designation} />
                <MiniRow label="Joining Date" value={form.joiningDate} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE FIXED SAVE */}
      <div className="lg:hidden sticky bottom-3">
        <div className="flex gap-3">
          <button
            onClick={saveAndContinue}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-700 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-800 shadow-lg disabled:opacity-60 transition-all active:scale-95"
          >
            <Save size={16} /> {saving ? "Saving..." : "Save & Continue"}
          </button>
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={saveAndContinue}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-10 py-3 text-sm font-semibold text-white hover:bg-slate-950 shadow disabled:opacity-60 transition-all active:scale-95"
        >
          <Save size={16} />
          {saving ? "Saving..." : "Finish Onboarding"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- UI Helpers ---------------- */

function SectionHeader({ icon: Icon, title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        {Icon ? (
          <div className="mt-0.5 rounded-xl border bg-white p-2 shadow-sm">
            <Icon size={16} className="text-slate-700" />
          </div>
        ) : null}
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          {subtitle ? <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p> : null}
        </div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function MiniRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900 text-right" title={value || "-"}>
        {value || "-"}
      </p>
    </div>
  );
}


