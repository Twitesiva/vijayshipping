import { useEffect, useState } from "react";
import {
  Pencil,
  Camera,
  User,
  HeartPulse,
  Users,
  CalendarDays,
  Mail,
  Phone,
  MapPin,
  Hash,
  X,
  Save,
  Loader2
} from "lucide-react";
import ImageCropper from "../../components/ImageCropper.jsx";
import { GhostButton, Modal } from "../employee/shared/ui.jsx";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient.js";
import { formatDDMMYYYY } from "../../lib/dateUtils.js";

// Replaced with MyProfile logic - EditProfileModal removed
// formatDDMMYYYY not needed - inline MyProfile

/* ================= HELPERS ================= */

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

const formatDateValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  return formatDDMMYYYY(raw);
};

// Map DB row to UI profile object
function mapDbToProfile(data, fallback = {}) {
  if (!data) return null;
  console.log("[HrProfile] Mapping DB data:", data);
  return {
    full_name: data.full_name || data.name || fallback.fullName || "",
    employee_id: data.employee_id || data.userId || fallback.userId || "",
    avatar_url: data.avatar_url || "",
    dob: data.dob || "",
    gender: data.gender || "",
    blood_group: data.blood_group || "",
    marital_status: data.marital_status || "",
    personal_email: data.personal_email || "",
    official_email: data.official_email || data.email || fallback.email || "",
    current_address: data.current_address || "",
    emergency_name: data.emergency_name || "",
    emergency_contact_number: data.emergency_contact_number || "",
    __userId: data.employee_id
  };
}

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

export default function HrProfile() {
  const auth = readAuth();
  const cacheKey = HR_CACHE_KEY(auth.userId);

  const [profile, setProfile] = useState(() => {
    const sessionName = (auth.fullName || "").trim();
    const displayName = (sessionName && sessionName.toLowerCase() !== "user") ? sessionName : "";
    return {
      full_name: displayName || "User",
      employee_id: auth.userId || "ID"
    };
  });

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [tempFile, setTempFile] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        setErr("");
        setLoading(true);

        const { userId } = auth;
        if (!userId) {
          console.warn("[HrProfile] No userId in auth session");
          setErr("HR session not found.");
          setProfile(null);
          return;
        }

        const cached = safeJsonParse(localStorage.getItem(cacheKey));
        if (cached && mounted) {
          console.log("[HrProfile] Loading from cache:", cached);
          setProfile(cached);
        }

        if (!isSupabaseConfigured) return;

        console.log("[HrProfile] Fetching from DB for:", userId);
        let { data, error } = await supabase
          .from("hrms_employee_profile")
          .select("*")
          .eq("employee_id", userId)
          .maybeSingle();

        if (error) {
          console.error("[HrProfile] DB error (hrms_employee_profile):", error);
          throw error;
        }

        // Fallback to employees table if hrms_employee_profile is empty
        if (!data || Object.keys(data).length < 5) { // If very minimal, check employees table
          console.log("[HrProfile] No rich profile found, checking employees table...");
          const { data: empData, error: empErr } = await supabase
            .from("employees")
            .select("*")
            .eq("employee_id", userId)
            .maybeSingle();

          if (empErr) console.error("[HrProfile] DB error (employees):", empErr);
          if (empData) {
            console.log("[HrProfile] Found data in employees table:", empData);
            // Merge if some data already in 'data'
            data = data ? { ...empData, ...data } : empData;
          }
        }

        if (data) {
          const mapped = mapDbToProfile(data, auth);
          console.log("[HrProfile] Mapped profile:", mapped);
          localStorage.setItem(cacheKey, JSON.stringify(mapped));
          if (mounted) setProfile(mapped);
          return;
        }

        // Auto create minimal if data not found
        const minimal = {
          full_name: auth.fullName || "HR",
          employee_id: userId,
          avatar_url: "",
          dob: "",
          official_email: auth.email || "",
          personal_email: "",
          current_address: "",
          gender: "",
          blood_group: "",
          marital_status: "",
          emergency_name: "",
          emergency_contact_number: "",
        };

        const { error: upErr } = await supabase
          .from("hrms_employee_profile")
          .upsert(minimal, { onConflict: "employee_id" });

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
    return () => { mounted = false; };
  }, []);

  const persistProfile = async (next) => {
    // Map to the exact columns expected by hrms_employee_profile
    const db_payload = {
      employee_id: next.employee_id,
      full_name: next.full_name,
      avatar_url: next.avatar_url || null,
      dob: next.dob || null, // Ensure empty string is null for DB date type
      gender: next.gender || null,
      blood_group: next.blood_group || null,
      marital_status: next.marital_status || null,
      personal_email: next.personal_email || null,
      official_email: next.official_email || null,
      current_address: next.current_address || null,
      emergency_name: next.emergency_name || null,
      emergency_contact_number: next.emergency_contact_number || null
    };

    setProfile(next);
    localStorage.setItem(cacheKey, JSON.stringify(next));

    if (!isSupabaseConfigured) return;

    try {
      console.log("[HrProfile] Upserting to hrms_employee_profile:", db_payload);
      const { error } = await supabase
        .from("hrms_employee_profile")
        .upsert(db_payload, { onConflict: "employee_id" });

      if (error) {
        console.error("[HrProfile] Upsert error:", error);
        throw error;
      }
      console.log("[HrProfile] Upsert successful");
    } catch (e) {
      console.error("[HrProfile] persistProfile caught error:", e);
      setErr(e?.message || "Failed to save profile");
    }
  };

  if (loading && !profile?.full_name) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-[#598791]/20 border-t-[#598791] rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading records...</p>
        </div>
      </div>
    );
  }

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

    setAvatarUploading(true);
    try {
      const userId = profile.employee_id || auth.userId || "hr";
      console.log("[HrProfile] Uploading cropped photo for:", userId);

      const avatarUrl = await uploadAvatar({ folderKey: userId, file: croppedFile });
      console.log("[HrProfile] Upload successful, URL:", avatarUrl);

      const nextProfile = { ...profile, avatar_url: avatarUrl };
      await persistProfile(nextProfile);
      console.log("[HrProfile] Profile persisted");
    } catch (uploadErr) {
      console.error("Avatar upload failed:", uploadErr);
      setErr("Failed to upload photo");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!window.confirm("Are you sure you want to delete your profile photo?")) return;

    setAvatarUploading(true);
    try {
      const nextProfile = { ...profile, avatar_url: null };
      await persistProfile(nextProfile);
      setPhotoMenu(false); // Close menu
    } catch (err) {
      console.error("Avatar delete failed:", err);
      setErr("Failed to delete photo");
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white rounded-[40px] border border-slate-100 p-8 md:p-10 shadow-sm flex flex-col items-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50/50 rounded-full -mr-16 -mt-16 z-0" />

        <div className="relative group z-30 mb-6">
          <div className="h-40 w-40 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-gradient-to-br from-[#598791] to-[#2d2430] flex items-center justify-center text-white text-5xl font-black relative">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="h-full w-full object-cover" />
            ) : (
              profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "U"
            )}

            {avatarUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="h-8 w-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <div className="absolute bottom-2 right-2 z-20">
            <button
              onClick={() => {
                if (profile?.avatar_url) {
                  setPhotoMenu(!photoMenu);
                } else {
                  document.getElementById("hr-avatar-upload-input")?.click();
                }
              }}
              className="h-12 w-12 rounded-full bg-[#598791] text-white flex items-center justify-center shadow-lg cursor-pointer hover:bg-[#4a7079] transition-all hover:scale-110 active:scale-95 border-4 border-white"
            >
              <Camera size={20} />
            </button>
            <input
              id="hr-avatar-upload-input"
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={avatarUploading}
            />

            {photoMenu && (
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-44 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-30 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 origin-top">
                <button
                  onClick={() => {
                    document.getElementById("hr-avatar-upload-input")?.click();
                    setPhotoMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left text-xs font-black text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors uppercase tracking-widest"
                >
                  <Camera size={14} className="text-[#598791]" />
                  Update
                </button>
                <button
                  onClick={handleDeleteAvatar}
                  className="w-full px-4 py-3 text-left text-xs font-black text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors border-t border-slate-50 uppercase tracking-widest"
                >
                  <X size={14} />
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="text-center space-y-1 z-10 mb-8">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Hi, <span className="text-[#598791]">{profile?.full_name || "User"}</span>
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
            {profile?.employee_id || "ID"}
          </p>
        </div>

        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 z-10">
          <Detail label="Full Name" value={profile.full_name} icon={User} />
          <Detail label="Employee ID" value={profile.employee_id} icon={Hash} />
          <Detail label="Gender" value={profile.gender} icon={User} />
          <Detail label="Blood Group" value={profile.blood_group} icon={HeartPulse} />
          <Detail label="Marital Status" value={profile.marital_status} icon={Users} />
          <Detail label="Date of Birth" value={formatDDMMYYYY(profile.dob)} icon={CalendarDays} />
          <Detail label="Official Email" value={profile.official_email} icon={Mail} />
          <Detail label="Personal Email" value={profile.personal_email} icon={Mail} />
          <Detail label="Emergency Contact" value={profile.emergency_name} icon={User} />
          <Detail label="Emergency Phone" value={profile.emergency_contact_number} icon={Phone} />
          <div className="md:col-span-2">
            <Detail label="Current Address" value={profile.current_address} icon={MapPin} />
          </div>
        </div>

        <div className="mt-8 w-full z-10">
          <button
            onClick={() => setEditProfile(true)}
            className="w-full py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all hover:scale-[1.01] active:scale-95 shadow-sm flex items-center justify-center gap-2"
          >
            <Pencil size={14} /> Edit Profile Details
          </button>
        </div>

        <div className="mt-10 opacity-30 z-10">
          <img src="/VijayShipping_Logo.png" alt="Vijay Shipping" className="h-6 w-auto object-contain" />
        </div>
      </div>

      {editProfile && (
        <ProfileEditModal
          profile={profile}
          onClose={() => setEditProfile(false)}
          onSave={async (next) => {
            if (!next.dob || String(next.dob).trim() === "") {
              alert("Date of Birth is required.");
              return;
            }
            setAvatarUploading(true); // Re-use saving state if needed
            try {
              await persistProfile(next);
              setEditProfile(false);
            } finally {
              setAvatarUploading(false);
            }
          }}
        />
      )}
      <ImageCropper 
        isOpen={showCropper}
        imageFile={tempFile}
        onCropComplete={handleCropComplete}
        onCancel={() => {
          setShowCropper(false);
          setTempFile(null);
        }}
      />
    </div>
  );
}

/* ---------------- EDIT MODAL ---------------- */
function ProfileEditModal({ profile, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    full_name: profile.full_name || "",
    employee_id: profile.employee_id || "",
    dob: profile.dob || "",
    personal_email: profile.personal_email || "",
    official_email: profile.official_email || "",
    current_address: profile.current_address || "",
    gender: profile.gender || "",
    blood_group: profile.blood_group || "",
    marital_status: profile.marital_status || "",
    emergency_name: profile.emergency_name || "",
    emergency_contact_number: profile.emergency_contact_number || ""
  });

  const handleChange = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all fields to their original values?")) {
      setForm({
        full_name: profile.full_name || "",
        employee_id: profile.employee_id || "",
        dob: profile.dob || "",
        personal_email: profile.personal_email || "",
        official_email: profile.official_email || "",
        current_address: profile.current_address || "",
        gender: profile.gender || "",
        blood_group: profile.blood_group || "",
        marital_status: profile.marital_status || "",
        emergency_name: profile.emergency_name || "",
        emergency_contact_number: profile.emergency_contact_number || ""
      });
    }
  };

  return (
    <Modal open={true} title="Edit Profile Details" onClose={onClose}>
      <div className="space-y-6 py-2 overflow-y-auto max-h-[70vh] px-1 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={e => handleChange("full_name", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#598791] transition-all"
            />
          </div>
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee ID</label>
            <input
              type="text"
              value={form.employee_id}
              disabled
              className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none opacity-60 cursor-not-allowed"
            />
          </div>
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date of Birth</label>
            <input
              type="date"
              value={form.dob}
              onChange={e => handleChange("dob", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#598791] transition-all"
            />
          </div>
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gender</label>
            <select
              value={form.gender}
              onChange={e => handleChange("gender", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#598791] transition-all"
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Blood Group</label>
            <input
              type="text"
              value={form.blood_group}
              onChange={e => handleChange("blood_group", e.target.value)}
              placeholder="e.g. O+"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#598791] transition-all"
            />
          </div>
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Marital Status</label>
            <select
              value={form.marital_status}
              onChange={e => handleChange("marital_status", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#598791] transition-all"
            >
              <option value="">Select Status</option>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
            </select>
          </div>
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Official Email</label>
            <input
              type="email"
              value={form.official_email}
              onChange={e => handleChange("official_email", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#598791] transition-all"
            />
          </div>
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Personal Email</label>
            <input
              type="email"
              value={form.personal_email}
              onChange={e => handleChange("personal_email", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#598791] transition-all"
            />
          </div>

          <div className="space-y-1 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Emergency Contact Name</label>
            <input
              type="text"
              value={form.emergency_name}
              onChange={e => handleChange("emergency_name", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#598791] transition-all"
            />
          </div>
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Emergency Contact Number</label>
            <input
              type="text"
              value={form.emergency_contact_number}
              onChange={e => handleChange("emergency_contact_number", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#598791] transition-all"
            />
          </div>

          <div className="md:col-span-2 space-y-1 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Address</label>
            <textarea
              value={form.current_address}
              onChange={e => handleChange("current_address", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#598791] transition-all min-h-[80px] resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 sticky bottom-0 bg-white pb-2 pt-4 border-t">
          <button
            onClick={handleReset}
            disabled={saving}
            className="text-xs font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 px-4 py-2 rounded-xl transition-all"
          >
            Reset
          </button>
          <div className="flex gap-3">
            <GhostButton onClick={onClose} disabled={saving}>Cancel</GhostButton>
            <button
              onClick={() => onSave(form)}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#598791] text-xs font-black text-white uppercase tracking-widest hover:bg-[#4a7079] shadow-lg disabled:opacity-50 transition-all"
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Detail({ label, value, icon: Icon }) {
  return (
    <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all hover:border-slate-200 hover:bg-white hover:shadow-sm group">
      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
        {Icon && <Icon size={12} className="text-slate-300 group-hover:text-[#598791] transition-colors" />}
        {label}
      </div>
      <div className="text-sm font-bold text-slate-700 truncate text-left font-sans">
        {value || "-"}
      </div>
    </div>
  );
}
