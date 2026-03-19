import { useState } from "react";
import {
  X,
  User,
  CalendarDays,
  Mail,
  MapPin,
  Hash,
  Save,
  HeartPulse,
  Users,
  Phone,
  Trash2
} from "lucide-react";

/* ===================== HELPER COMPONENTS ===================== */

function Modal({ title, children, onClose, footer }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-3">
      <div className="bg-white rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b flex justify-between items-center gap-3 shrink-0">
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">{title}</h2>
          <button onClick={onClose} className="rounded-xl border p-2 hover:bg-slate-50 transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
          {children}
        </div>

        {footer && (
          <div className="p-4 border-t bg-slate-50/50 flex flex-wrap items-center gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, value, onChange, placeholder, type = "text", disabled = false }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left">{label}</p>
      <div className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm transition-all ${disabled ? 'opacity-60 bg-slate-50' : 'focus-within:ring-2 focus-within:ring-[#598791]/20 focus-within:border-[#598791]'}`}>
        {Icon ? <Icon size={18} className="text-slate-400" /> : null}
        <input
          type={type}
          disabled={disabled}
          className="w-full outline-none text-sm font-bold text-slate-700 placeholder:text-slate-300 bg-transparent disabled:cursor-not-allowed"
          value={value || ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function FieldSelect({ label, icon: Icon, value, onChange, options }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left">{label}</p>
      <div className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm transition-all focus-within:ring-2 focus-within:ring-[#598791]/20 focus-within:border-[#598791]">
        {Icon ? <Icon size={18} className="text-slate-400" /> : null}
        <select
          className="w-full bg-transparent outline-none text-sm font-bold text-slate-700 disabled:cursor-not-allowed"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function FieldTextarea({ label, icon: Icon, value, onChange, placeholder }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left">{label}</p>
      <div className="flex items-start gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm transition-all focus-within:ring-2 focus-within:ring-[#598791]/20 focus-within:border-[#598791]">
        {Icon ? <Icon size={18} className="mt-1 text-slate-400" /> : null}
        <textarea
          className="w-full outline-none text-sm font-bold text-slate-700 placeholder:text-slate-300 min-h-[100px] resize-none bg-transparent"
          value={value || ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

/* ===================== MAIN EDIT MODAL ===================== */

export default function EditProfileModal({ profile, onSave, onClose, onDelete, simplified = false }) {
  const [form, setForm] = useState({
    ...profile,
    id: profile.id || "",
    full_name: profile.full_name || "",
    username: profile.username || "",
    employee_id: profile.employee_id || "",
    join_date: profile.join_date || "",
    dob: profile.dob || "",
    official_email: profile.official_email || "",
    personal_email: profile.personal_email || "",
    current_address: profile.current_address || "",
    gender: profile.gender || "",
    mobile_number: profile.mobile_number || "",
    blood_group: profile.blood_group || "",
    marital_status: profile.marital_status || "",
    designation: profile.designation || "",
    emergency_name: profile.emergency_name || "",
    emergency_contact_number: profile.emergency_contact_number || ""
  });

  const [saving, setSaving] = useState(false);

  const handleChange = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all fields to their original values?")) {
      setForm({
        ...profile,
        id: profile.id || "",
        full_name: profile.full_name || "",
        username: profile.username || "",
        join_date: profile.join_date || "",
        dob: profile.dob || "",
        official_email: profile.official_email || "",
        personal_email: profile.personal_email || "",
        current_address: profile.current_address || "",
        gender: profile.gender || "",
        mobile_number: profile.mobile_number || "",
        blood_group: profile.blood_group || "",
        marital_status: profile.marital_status || "",
        designation: profile.designation || "",
        emergency_name: profile.emergency_name || "",
        emergency_contact_number: profile.emergency_contact_number || ""
      });
    }
  };

  const footer = (
    <>
      {onDelete && (
        <button
          className="w-full sm:w-auto inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black text-red-600 uppercase tracking-widest hover:bg-red-50 transition-colors border border-red-100"
          onClick={() => {
            if (window.confirm(`Are you sure you want to permanently delete ${form.full_name || 'this employee'}? This cannot be undone.`)) {
              onDelete(form);
            }
          }}
          disabled={saving}
        >
          <Trash2 size={14} />
          Delete Employee
        </button>
      )}
      {!onDelete && (
        <button 
          className="rounded-xl px-5 py-2.5 text-xs font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 transition-colors" 
          onClick={handleReset}
          disabled={saving}
        >
          Reset
        </button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <button 
          className="rounded-xl px-5 py-2.5 text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-slate-100 transition-colors" 
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#598791] text-xs font-black text-white uppercase tracking-widest hover:bg-[#4a7079] shadow-lg disabled:opacity-50 transition-all"
          onClick={handleSave}
        >
          {saving ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={14} />}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </>
  );

  return (
    <Modal title="Edit Profile Details" onClose={onClose} footer={footer}>
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            icon={User}
            label="Full Name"
            value={form.full_name}
            onChange={(v) => handleChange("full_name", v)}
            placeholder="Enter full name"
          />

          {simplified && (
            <Field
              icon={User}
              label="Username (Login)"
              value={form.username}
              onChange={(v) => handleChange("username", v)}
              placeholder="Enter username"
            />
          )}

          <Field
            icon={Hash}
            label="Employee ID"
            value={form.employee_id}
            disabled
            placeholder="VS0000"
          />

          <Field
            icon={Mail}
            label="Official Email"
            type="email"
            value={form.official_email || form.email}
            onChange={(v) => handleChange("official_email", v)}
            placeholder="official@example.com"
          />

          <Field
            icon={User}
            label="Designation"
            value={form.designation}
            onChange={(v) => handleChange("designation", v)}
            placeholder="Employee"
            disabled={!simplified}
          />

          {simplified && (
            <Field
              icon={CalendarDays}
              label="Date of Joining"
              type="date"
              value={form.join_date}
              onChange={(v) => handleChange("join_date", v)}
            />
          )}

          {!simplified && (
            <>
              <Field
                icon={CalendarDays}
                label="Date of Birth"
                type="date"
                value={form.dob}
                onChange={(v) => handleChange("dob", v)}
              />

              <FieldSelect
                icon={User}
                label="Gender"
                value={form.gender}
                options={["Male", "Female", "Other"]}
                onChange={(v) => handleChange("gender", v)}
              />

              <Field
                icon={Phone}
                label="Phone Number"
                value={form.mobile_number}
                onChange={(v) => handleChange("mobile_number", v)}
                placeholder="Enter phone number"
              />

              <Field
                icon={HeartPulse}
                label="Blood Group"
                value={form.blood_group}
                onChange={(v) => handleChange("blood_group", v)}
                placeholder="e.g. O+"
              />

              <FieldSelect
                icon={Users}
                label="Marital Status"
                value={form.marital_status}
                options={["Single", "Married"]}
                onChange={(v) => handleChange("marital_status", v)}
              />

              <Field
                icon={Mail}
                label="Personal Email"
                type="email"
                value={form.personal_email}
                onChange={(v) => handleChange("personal_email", v)}
                placeholder="personal@example.com"
              />

              <Field
                icon={User}
                label="Emergency Contact Name"
                value={form.emergency_name}
                onChange={(v) => handleChange("emergency_name", v)}
                placeholder="Contact name"
              />

              <Field
                icon={Phone}
                label="Emergency Phone"
                value={form.emergency_contact_number}
                onChange={(v) => handleChange("emergency_contact_number", v)}
                placeholder="Contact number"
              />

              <div className="md:col-span-2">
                <FieldTextarea
                  icon={MapPin}
                  label="Current Address"
                  value={form.current_address}
                  onChange={(v) => handleChange("current_address", v)}
                  placeholder="Enter your current address"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}


