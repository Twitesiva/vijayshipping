import { useEffect, useState } from "react";
import { SectionCard, GhostButton, Modal } from "../shared/ui.jsx";
import {
  IdCard,
  Mail,
  User,
  CalendarDays,
  Hash,
  MapPin,
  Camera,
  Loader2,
  Pencil,
  X,
  Save,
  HeartPulse,
  Users,
  Phone
} from "lucide-react";
import ImageCropper from "../../../components/ImageCropper.jsx";
import { supabase } from "../../../lib/supabaseClient";
import { formatDDMMYYYY } from "../../../lib/dateUtils";

const AUTH_KEY = "HRMSS_AUTH_SESSION";

function safeJsonParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readEmployeeIdFromAuth() {
  const raw = localStorage.getItem(AUTH_KEY);
  const s = safeJsonParse(raw);
  const empId = (s?.employee_id || s?.identifier || s?.id || "").trim();
  return empId || "";
}

const Detail = ({ label, value, icon: Icon }) => (
  <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all hover:border-slate-200 hover:bg-white hover:shadow-sm group">
    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
      {Icon && <Icon size={12} className="text-slate-300 group-hover:text-[#598791] transition-colors" />}
      {label}
    </div>
    <div className="text-sm font-bold text-slate-700 truncate text-left">
      {value || "-"}
    </div>
  </div>
);

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

export default function MyProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [tempFile, setTempFile] = useState(null);
  const [profile, setProfile] = useState(() => {
    const raw = localStorage.getItem("HRMSS_AUTH_SESSION");
    const s = raw ? JSON.parse(raw) : null;
    return {
      full_name: s?.full_name || s?.fullName || s?.name || "Employee",
      employee_id: s?.employee_id || s?.id || s?.userId || ""
    };
  });

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const empId = readEmployeeIdFromAuth();
      if (!empId) {
        setLoadErr("Session expired. Please login again.");
        return;
      }

      const { data, error } = await supabase
        .from("hrms_employee_profile")
        .select("*")
        .eq("employee_id", empId)
        .maybeSingle();

      if (error) throw error;
      if (data) setProfile(data);
    } catch (e) {
      console.error(e);
      setLoadErr(e?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

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
      const empId = profile.employee_id || readEmployeeIdFromAuth();
      console.log("[MyProfile] Uploading cropped photo for:", empId);
      
      const avatarUrl = await uploadAvatar({ folderKey: empId, file: croppedFile });
      console.log("[MyProfile] Upload successful, URL:", avatarUrl);

      if (avatarUrl) {
        const { error } = await supabase
          .from("hrms_employee_profile")
          .upsert({ 
            employee_id: empId, 
            avatar_url: avatarUrl,
            // Try to keep other fields if possible
            full_name: profile.full_name,
            official_email: profile.official_email || profile.email
          }, { onConflict: "employee_id" });

        if (error) throw error;
        
        const updatedProfile = { ...profile, avatar_url: avatarUrl };
        setProfile(updatedProfile);
        
        // Update session storage if needed
        const raw = localStorage.getItem("HRMSS_AUTH_SESSION");
        if (raw) {
          const s = JSON.parse(raw);
          localStorage.setItem("HRMSS_AUTH_SESSION", JSON.stringify({ ...s, avatar_url: avatarUrl }));
        }
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
      alert("Failed to upload photo: " + (err.message || "Unknown error"));
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!window.confirm("Are you sure you want to delete your profile photo?")) return;

    setAvatarUploading(true);
    try {
      const empId = profile.employee_id || readEmployeeIdFromAuth();
      const { error } = await supabase
        .from("hrms_employee_profile")
        .update({ avatar_url: null })
        .eq("employee_id", empId);

      if (error) throw error;
      setProfile((prev) => ({ ...prev, avatar_url: null }));
      setPhotoMenu(false); // Close menu
    } catch (err) {
      console.error("Avatar delete failed:", err);
      alert("Failed to delete photo: " + (err.message || "Unknown error"));
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveProfile = async (form) => {
    if (!form.dob || String(form.dob).trim() === "") {
      alert("Date of Birth is required.");
      return;
    }
    setSaving(true);
    try {
      // First, attempt to update
      const { data, error } = await supabase
        .from("hrms_employee_profile")
        .upsert(form, { onConflict: 'employee_id' });

      if (error) throw error;
      setProfile(prev => ({ ...prev, ...form }));
      setShowEdit(false);
    } catch (err) {
      console.error("Save profile failed:", err);
      alert("Failed to save profile: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-[#598791]/20 border-t-[#598791] rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* PROFILE CARD */}
      <div className="bg-white rounded-[40px] border border-slate-100 p-8 md:p-10 shadow-sm flex flex-col items-center relative overflow-hidden">
        {/* Decorative corner */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50/50 rounded-full -mr-16 -mt-16 z-0" />

        {/* Profile Image Section */}
        <div className="relative group z-30 mb-6">
          <div className="h-40 w-40 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-gradient-to-br from-[#598791] to-[#2d2430] flex items-center justify-center text-white text-5xl font-black relative">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="h-full w-full object-cover" />
            ) : (
              profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "E"
            )}

            {avatarUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="text-white animate-spin" size={32} />
              </div>
            )}
          </div>

          <div className="absolute bottom-2 right-2 z-20">
            <button
              onClick={() => {
                if (profile?.avatar_url) {
                  setPhotoMenu(!photoMenu);
                } else {
                  document.getElementById("avatar-upload-input")?.click();
                }
              }}
              className="h-12 w-12 rounded-full bg-[#598791] text-white flex items-center justify-center shadow-lg cursor-pointer hover:bg-[#4a7079] transition-all hover:scale-110 active:scale-95 border-4 border-white"
            >
              <Camera size={20} />
            </button>
            <input
              id="avatar-upload-input"
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
                    document.getElementById("avatar-upload-input")?.click();
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
            {profile?.full_name || "Employee Name"}
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
            {profile?.employee_id || "VS0000"}
          </p>
        </div>

        {/* DETAILS LIST - Essential only */}
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
            onClick={() => setShowEdit(true)}
            className="w-full py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all hover:scale-[1.01] active:scale-95 shadow-sm flex items-center justify-center gap-2"
          >
            <Pencil size={14} /> Edit Profile Details
          </button>
        </div>

        <div className="mt-10 opacity-30 z-10">
          <img src="/VijayShipping_Logo.png" alt="Vijay Shipping" className="h-6 w-auto object-contain" />
        </div>
      </div>

      {showEdit && (
        <ProfileEditModal
          profile={profile}
          saving={saving}
          onSave={handleSaveProfile}
          onClose={() => setShowEdit(false)}
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
