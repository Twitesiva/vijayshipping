import { useState, useMemo, useEffect } from "react";
import {
  MapPin,
  IdCard,
  Briefcase,
  Phone,
  X,
  Mail,
  GraduationCap,
  Building2,
  HeartPulse,
  User,
  CalendarDays,
  Home,
  Plus,
  Trash2,
  CreditCard,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

/* ---------------------- CONSTANTS ---------------------- */
const DEPARTMENTS = [
  "Founder",
  "Manager",
  "Employee",
];

// Helper function to get unique designations case-insensitively
// Now fetches from existing employees to populate dropdown
const getUniqueDesignations = (existingDesignation = "") => {
  // Combine default departments with any existing designation
  const all = [...DEPARTMENTS];
  if (existingDesignation && !all.some(d => d.toLowerCase() === existingDesignation.toLowerCase())) {
    all.push(existingDesignation);
  }
  
  // Remove duplicates case-insensitively, keeping first occurrence
  const normalizedMap = new Map();
  for (const d of all) {
    const lower = d.toLowerCase();
    if (!normalizedMap.has(lower)) {
      normalizedMap.set(lower, d);
    }
  }
  
  return Array.from(normalizedMap.values()).sort((a, b) => a.localeCompare(b));
};

/* ===================== HELPER COMPONENTS ===================== */

function Modal({ title, children, onClose, footer }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-3">
      <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b flex justify-between items-center gap-3 shrink-0">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg border p-1 hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar">
          {children}
        </div>

        {footer && (
          <div className="p-5 border-t bg-slate-50 flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function subModalFooter(onClose, onSave) {
  return (
    <>
      <button className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-100" onClick={onClose}>
        Cancel
      </button>
      <button
        className="rounded-xl bg-[#598791] px-4 py-2 text-sm text-white hover:bg-[#75b0bd]"
        onClick={onSave}
      >
        Save
      </button>
    </>
  );
}

function Field({ label, icon: Icon, value, onChange, placeholder, type = "text" }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-[#598791]/20">
        {Icon ? <Icon size={16} className="text-slate-400" /> : null}
        <input
          type={type}
          className="w-full outline-none text-sm text-slate-900 placeholder:text-slate-400 bg-transparent"
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
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-[#598791]/20">
        {Icon ? <Icon size={16} className="text-slate-400" /> : null}
        <select
          className="w-full bg-transparent outline-none text-sm text-slate-900"
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
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex items-start gap-2 rounded-2xl border bg-white px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-[#598791]/20">
        {Icon ? <Icon size={16} className="mt-0.5 text-slate-400" /> : null}
        <textarea
          className="w-full outline-none text-sm text-slate-900 placeholder:text-slate-400 min-h-[90px] resize-none bg-transparent"
          value={value || ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function BlockTitle({ icon: Icon, title, subtitle, right }) {
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

/* ===================== CUSTOM PHONE FIELD ===================== */

function FieldPhone({ label, icon: Icon, value, onChange, placeholder }) {
  let countryCode = "+91";
  let number = String(value || "");

  if (number.startsWith("+91")) {
    countryCode = "+91";
    number = number.slice(3);
  } else if (number.startsWith("+94")) {
    countryCode = "+94";
    number = number.slice(3);
  }

  const handleNumChange = (newNum) => {
    const numeric = newNum.replace(/\D/g, "");
    if (numeric.length > 10) return;
    onChange(`${countryCode}${numeric}`);
  };

  const handleCodeChange = (newCode) => {
    onChange(`${newCode}${number}`);
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-[#598791]/20">
        {Icon ? <Icon size={16} className="text-slate-400" /> : null}
        <select
          className="bg-transparent outline-none text-xs text-slate-600 border-r pr-2 h-full"
          value={countryCode}
          onChange={(e) => handleCodeChange(e.target.value)}
        >
          <option value="+91">+91</option>
          <option value="+94">+94</option>
        </select>
        <input
          type="text"
          className="w-full outline-none text-sm text-slate-900 placeholder:text-slate-400 bg-transparent"
          value={number}
          placeholder={placeholder || "10 digits"}
          onChange={(e) => handleNumChange(e.target.value)}
        />
      </div>
    </div>
  );
}

/* ===================== CUSTOM DATE PICKER MODAL ===================== */

const formatDateDisplay = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d)) return raw;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

function DatePickerModal({ value, onSelect, onClose }) {
  const [step, setStep] = useState("year");
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const years = useMemo(() => {
    const arr = [];
    for (let y = 2008; y >= 1950; y--) arr.push(y);
    return arr;
  }, []);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getDaysInMonth = (m, y) => new Date(y, m + 1, 0).getDate();

  const handleDaySelect = (d) => {
    const formattedDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    onSelect(formattedDate);
    onClose();
  };

  return (
    <Modal
      title={`Select Date of Birth ${selectedYear ? `- ${selectedYear}` : ""} ${selectedMonth !== null ? `- ${months[selectedMonth]}` : ""}`}
      onClose={onClose}
    >
      <div className="min-h-[300px]">
        {step === "year" && (
          <div className="grid grid-cols-4 gap-2">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => { setSelectedYear(y); setStep("month"); }}
                className="p-2.5 rounded-xl border text-sm font-semibold hover:bg-purple-50 hover:border-purple-200 transition-colors"
              >
                {y}
              </button>
            ))}
          </div>
        )}

        {step === "month" && (
          <div className="grid grid-cols-3 gap-3">
            {months.map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => { setSelectedMonth(i); setStep("day"); }}
                className="p-4 rounded-xl border text-sm font-semibold hover:bg-purple-50 hover:border-purple-200 transition-colors"
              >
                {m}
              </button>
            ))}
            <div className="col-span-3 pt-4">
              <button
                type="button"
                onClick={() => setStep("year")}
                className="text-sm font-bold text-[#598791] hover:text-[#75b0bd] underline"
              >
                ← Change Year
              </button>
            </div>
          </div>
        )}

        {step === "day" && (
          <div>
            <div className="grid grid-cols-7 gap-2">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-bold text-slate-400 uppercase">
                  {d}
                </div>
              ))}
              {Array.from({ length: getDaysInMonth(selectedMonth, selectedYear) }, (_, i) => i + 1).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDaySelect(d)}
                  className="aspect-square flex items-center justify-center rounded-xl border text-sm font-semibold hover:bg-purple-50 hover:border-purple-200 transition-colors"
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="pt-6">
              <button
                type="button"
                onClick={() => setStep("month")}
                className="text-sm font-bold text-[#598791] hover:text-[#75b0bd] underline"
              >
                ← Change Month
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ===================== MAIN EDIT MODAL ===================== */

export default function EditProfileModal({ profile, onSave, onClose }) {
  const [f, setF] = useState(profile);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Computed / Fallback objects
  const personal = f.personal || {};
  const job = f.job || {};
  const skills = f.skills || {};
  const bank = f.bank || {};

  const education = Array.isArray(f.education) ? f.education : [];
  const experience = Array.isArray(f.experience) ? f.experience : [];
  const emergencyContacts = Array.isArray(f.emergencyContacts) ? f.emergencyContacts : [];

  // Setters
  const setPersonal = (k, v) => setF((p) => ({ ...p, personal: { ...(p.personal || {}), [k]: v } }));
  const setJob = (k, v) => setF((p) => ({ ...p, job: { ...(p.job || {}), [k]: v } }));
  const setSkills = (k, v) => setF((p) => ({ ...p, skills: { ...(p.skills || {}), [k]: v } }));
  const setBank = (k, v) => setF((p) => ({ ...p, bank: { ...(p.bank || {}), [k]: v } }));

  // Array updaters
  const updateEducation = (idx, k, v) => {
    setF((p) => {
      const next = [...(Array.isArray(p.education) ? p.education : [])];
      next[idx] = { ...(next[idx] || {}), [k]: v };
      return { ...p, education: next };
    });
  };
  const addEducation = () => {
    setF((p) => ({
      ...p,
      education: [
        ...(Array.isArray(p.education) ? p.education : []),
        { qualification: "", institution: "", yearOfPassing: "", specialization: "" },
      ],
    }));
  };
  const removeEducation = (idx) => {
    setF((p) => {
      const next = (Array.isArray(p.education) ? p.education : []).filter((_, i) => i !== idx);
      return { ...p, education: next.length ? next : p.education };
    });
  };

  const updateExperience = (idx, k, v) => {
    setF((p) => {
      const next = [...(Array.isArray(p.experience) ? p.experience : [])];
      next[idx] = { ...(next[idx] || {}), [k]: v };
      return { ...p, experience: next };
    });
  };
  const addExperience = () => {
    setF((p) => ({
      ...p,
      experience: [
        ...(Array.isArray(p.experience) ? p.experience : []),
        { organization: "", designation: "", duration: "", reasonForLeaving: "" },
      ],
    }));
  };
  const removeExperience = (idx) => {
    setF((p) => {
      const next = (Array.isArray(p.experience) ? p.experience : []).filter((_, i) => i !== idx);
      return { ...p, experience: next.length ? next : p.experience };
    });
  };

  const updateEmergency = (idx, k, v) => {
    setF((p) => {
      const next = [...(Array.isArray(p.emergencyContacts) ? p.emergencyContacts : [])];
      next[idx] = { ...(next[idx] || {}), [k]: v };
      return { ...p, emergencyContacts: next };
    });
  };
  const addEmergency = () => {
    setF((p) => ({
      ...p,
      emergencyContacts: [
        ...(Array.isArray(p.emergencyContacts) ? p.emergencyContacts : []),
        { name: "", relation: "", phone: "" },
      ],
    }));
  };
  const removeEmergency = (idx) => {
    setF((p) => {
      const next = (Array.isArray(p.emergencyContacts) ? p.emergencyContacts : []).filter(
        (_, i) => i !== idx
      );
      return { ...p, emergencyContacts: next.length ? next : p.emergencyContacts };
    });
  };

  const footer = (
    <>
      <button className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-100" onClick={onClose}>
        Cancel
      </button>
      <button
        className="rounded-xl bg-[#598791] px-4 py-2 text-sm text-white hover:bg-[#75b0bd]"
        onClick={() => {
          if (f.work_status === "Inactive" && (!f.exit_date || !f.reason_for_leave)) {
            alert("Date of Exit and Reason for Exit are required for Inactive employees.");
            return;
          }

          // If "Other" is selected, custom reason is required
          if (f.work_status === "Inactive" && f.reason_for_leave === "Other" && !f.custom_exit_reason) {
            alert("Please specify the reason for exit.");
            return;
          }

          // Construct final reason_for_leave - combine "Other" with custom reason
          let finalReasonForLeave = f.reason_for_leave;
          if (f.work_status === "Inactive" && f.reason_for_leave === "Other" && f.custom_exit_reason) {
            finalReasonForLeave = f.custom_exit_reason;
          }

          // Reconstruct full object to ensure nothing is lost
          const next = {
            ...f,
            name: f.name || "",
            id: f.id || job.employeeId || "",
            exit_date: f.work_status === "Inactive" ? f.exit_date : "",
            reason_for_leave: f.work_status === "Inactive" ? finalReasonForLeave : "",
            personal: { ...(f.personal || {}) },
            job: { ...(f.job || {}) },
            skills: { ...(f.skills || {}) },
            bank: { ...(f.bank || {}) },
            education: Array.isArray(f.education) ? f.education : [],
            experience: Array.isArray(f.experience) ? f.experience : [],
            emergencyContacts: Array.isArray(f.emergencyContacts) ? f.emergencyContacts : [],
          };
          onSave(next);
        }}
      >
        Save Changes
      </button>
    </>
  );

  return (
    <Modal title="Edit Employee Profile" onClose={onClose} footer={footer}>
      <div className="space-y-6">
        <BlockTitle icon={User} title="Employee Details" subtitle="Core identification and contact info" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            icon={User}
            label="FULL NAME"
            value={f.name}
            onChange={(v) => setF((p) => ({ ...p, name: v }))}
            placeholder="Full name"
          />

          <Field
            icon={User}
            label="USERNAME (LOGIN)"
            value={f.username}
            onChange={(v) => setF((p) => ({ ...p, username: v }))}
            placeholder="Username"
          />

          <Field
            icon={IdCard}
            label="EMPLOYEE ID"
            value={f.id || job.employeeId}
            onChange={(v) => {
              setF((p) => ({ ...p, id: v, job: { ...(p.job || {}), employeeId: v } }));
            }}
            placeholder="VS-001"
          />

          <Field
            icon={Mail}
            label="EMAIL"
            value={personal.officialEmail || personal.personalEmail || f.email}
            onChange={(v) => {
              setF(p => ({ ...p, email: v }));
              setPersonal("officialEmail", v);
            }}
            placeholder="email@example.com"
          />

          <FieldSelect
            icon={Briefcase}
            label="DESIGNATION"
            value={(job && job.designation) || f.designation || ""}
            onChange={(v) => {
              setF(p => ({ ...p, designation: v }));
              setJob("designation", v);
            }}
            options={getUniqueDesignations((job && job.designation) || f.designation)}
          />

          <Field
            icon={CalendarDays}
            label="JOINING DATE"
            type="date"
            value={job.joiningDate || f.joinDate}
            onChange={(v) => {
              setF(p => ({ ...p, joinDate: v }));
              setJob("joiningDate", v);
            }}
          />

          {/* WORK STATUS DROPDOWN - Active/Inactive */}
          <div className="md:col-span-2">
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">WORK STATUS</p>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="work_status"
                    value="Active"
                    checked={f.work_status !== "Inactive"}
                    onChange={(e) => setF(p => ({ ...p, work_status: e.target.value }))}
                    className="w-4 h-4 text-[#598791] focus:ring-[#598791]"
                  />
                  <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <ToggleRight className="w-5 h-5 text-green-500" />
                    Active
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="work_status"
                    value="Inactive"
                    checked={f.work_status === "Inactive"}
                    onChange={(e) => setF(p => ({ ...p, work_status: e.target.value }))}
                    className="w-4 h-4 text-red-600 focus:ring-red-600"
                  />
                  <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <ToggleLeft className="w-5 h-5 text-red-500" />
                    Inactive
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <p className="text-[10px] text-slate-400 italic px-2">
              Note: ID Series is determined by the first letter(s) of the Employee ID.
            </p>
          </div>
        </div>

        {f.work_status === "Inactive" && (
          <div className="pt-4 border-t border-red-100">
            <BlockTitle icon={Briefcase} title="Exit Information" subtitle="Required for inactive records" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Field
                icon={CalendarDays}
                label="DATE OF EXIT *"
                type="date"
                value={f.exit_date}
                onChange={(v) => setF((p) => ({ ...p, exit_date: v }))}
              />
              <FieldSelect
                icon={Briefcase}
                label="REASON FOR EXIT *"
                value={f.reason_for_leave}
                onChange={(v) => setF((p) => ({ ...p, reason_for_leave: v }))}
                options={["Resigned", "Terminated", "Absconded", "Other"]}
              />
            </div>
            
            {/* Show custom reason field when "Other" is selected */}
            {f.reason_for_leave === "Other" && (
              <div className="mt-4">
                <Field
                  icon={Briefcase}
                  label="SPECIFY REASON *"
                  value={f.custom_exit_reason || ""}
                  onChange={(v) => setF((p) => ({ ...p, custom_exit_reason: v }))}
                  placeholder="Please specify the reason for exit"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}


