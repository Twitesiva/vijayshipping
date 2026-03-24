// src/pages/hr/Employees.jsx
import React, { useState, useMemo, useEffect } from "react";
import { Eye, EyeOff, Trash2, KeyRound, X, User, UserMinus, Upload, FileText, Pencil } from "lucide-react";

import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient.js";
import EditProfileModal from "./HrEditModal.jsx";
import { formatDDMMYYYY } from "../../lib/dateUtils.js";
import { API_BASE } from "../../config.js";

/* ---------------------- SAMPLE DATA ---------------------- */
// Removed hardcoded employee details


/* ---------------------- DROPDOWN OPTIONS ---------------------- */
const DEPARTMENTS = [
  "Founder",
  "Manager",
  "Employee",
];


const EMPLOYEE_STATUSES = ["Probation", "Permanent"];
const EXIT_REASON_OPTIONS = ["Resigned", "Terminated", "Absconded", "Other"];

/* ---------------------- TAG HELPERS ---------------------- */
const departmentColors = {
  Founder: "bg-amber-50 text-amber-700",
  "Finance & Manager": "bg-emerald-50 text-emerald-700",
  "Business Development Executive": "bg-pink-50 text-pink-700",
  "AI Engineer": "bg-sky-50 text-sky-700",
  "AI Intern": "bg-indigo-50 text-indigo-700",
  "UI/UX Intern": "bg-fuchsia-50 text-fuchsia-700",
  "Software Developer Intern": "bg-violet-50 text-violet-700",
  "Talent Acquisition Manager": "bg-teal-50 text-teal-700",
  "Talent Acquisition Executive": "bg-cyan-50 text-cyan-700",
};

const deptPill = (dept) =>
  departmentColors[dept] || "bg-slate-100 text-slate-700";

const normalizeEmail = (v) => {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  return s.includes("@") ? s : s || "";
};

const formatJoinDate = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return formatDDMMYYYY(raw);
};

const generateEmployeeId = (list, prefix = "VS") => {
  const numbers = (list || [])
    .filter((emp) => {
      const id = String(emp?.id || "");
      if (!id.startsWith(prefix)) return false;
      const rest = id.slice(prefix.length);
      return /^\d+$/.test(rest);
    })
    .map((emp) => {
      const rest = String(emp.id).slice(prefix.length);
      return parseInt(rest, 10);
    })
    .filter((n) => Number.isFinite(n));

  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  const width = 4;
  let candidate = `${prefix}${String(next).padStart(width, "0")}`;

  const idSet = new Set((list || []).map((emp) => String(emp?.id || "")));
  while (idSet.has(candidate)) {
    const rest = String(candidate).slice(prefix.length);
    const bump = parseInt(rest || "0", 10) + 1;
    candidate = `${prefix}${String(bump).padStart(width, "0")}`;
  }
  return candidate;
};

/* ---------------------- SMALL UI HELPERS ---------------------- */
function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "E";
  const parts = s.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "E";
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div className="text-sm text-slate-900 text-right break-words max-w-[65%]">
        {value}
      </div>
    </div>
  );
}

/* ---------------------- MAIN COMPONENT ---------------------- */
export default function Employees() {
  const [viewTab, setViewTab] = useState("active"); // 'active' | 'inactive'
  const [employees, setEmployees] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addStep, setAddStep] = useState("CHOICE"); // CHOICE, ACTIVE, INACTIVE

  // ✅ View employee modal
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // ✅ Show/Hide password (Add modal only)
  const [showPw, setShowPw] = useState(false);

  // 🔑 Reset Password state
  const [resetPw, setResetPw] = useState(false);
  const [resetPwValue, setResetPwValue] = useState("");
  const [showResetPw, setShowResetPw] = useState(false);
  const [resetPwSaving, setResetPwSaving] = useState(false);

  // 🗑️ DELETED OPTIONS TRACKING
  const [deletedDesignations, setDeletedDesignations] = useState([]);
  const [showDesignationManager, setShowDesignationManager] = useState(false);

  // 🔍 FILTER STATES
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState("All");

  const [newEmployee, setNewEmployee] = useState({
    username: "",
    email: "",
    password: "",
    fullName: "",
    idSeries: "VS",
    employeeId: "",
    department: "",
    joinDate: "",
  });

  const [resignedEmployee, setResignedEmployee] = useState({
    username: "",
    fullName: "",
    idSeries: "VS",
    employeeId: "",
    email: "",
    joinDate: "",
    designation: "",
    documents: [],
    reason: "",
    otherReason: "",
    exitDate: "",
    workStatus: "Inactive",
  });

  // 📄 PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    if (isAddModalOpen && addStep === "ACTIVE" && !newEmployee.employeeId) {
      const nextId = generateEmployeeId(employees, newEmployee.idSeries);
      setNewEmployee(prev => ({ ...prev, employeeId: nextId }));
    }
    if (isAddModalOpen && addStep === "INACTIVE" && !resignedEmployee.employeeId) {
      const nextId = generateEmployeeId(employees, resignedEmployee.idSeries);
      setResignedEmployee(prev => ({ ...prev, employeeId: nextId }));
    }
  }, [newEmployee.idSeries, resignedEmployee.idSeries, employees, isAddModalOpen, addStep]);

  // Handle series change to reset ID
  const handleSeriesChange = (e) => {
    const series = e.target.value;
    const nextId = generateEmployeeId(employees, series);
    setNewEmployee(prev => ({ ...prev, idSeries: series, employeeId: nextId }));
  };

  const handleResignedSeriesChange = (e) => {
    const series = e.target.value;
    const nextId = generateEmployeeId(employees, series);
    setResignedEmployee(prev => ({ ...prev, idSeries: series, employeeId: nextId }));
  };

  // 📥 PERSISTENCE HELPERS
  const fetchMetadata = async () => {
    if (!isSupabaseConfigured) return;

    // 💡 Try localStorage first for immediate UI response
    try {
      const local = localStorage.getItem("hrmss_deleted_metadata");
      if (local) {
        const meta = JSON.parse(local);
        if (meta.deletedDesignations) setDeletedDesignations(meta.deletedDesignations);
      }
    } catch (e) {
      console.warn("Failed to load local metadata fallback:", e);
    }
  };

  const saveMetadata = async (newDesignations) => {
    if (!isSupabaseConfigured) return;

    // 💾 Save to localStorage immediately
    const metaObj = {
      deletedDesignations: newDesignations,
      updated_at: new Date().toISOString()
    };
    try {
      localStorage.setItem("hrmss_deleted_metadata", JSON.stringify(metaObj));
    } catch (e) {
      console.warn("Failed to save to localStorage:", e);
    }
  };

  // ✅ PAGE LOAD: DB fetch
  useEffect(() => {
    fetchMetadata();
    const fetchEmployees = async () => {
      if (!isSupabaseConfigured) {
        console.warn("[Employees] Supabase not configured");
        return;
      }

      try {
        console.log("[Employees] Fetching employees from database...");
        
        const { data, error } = await supabase
          .from("employees")
          .select("employee_id, username, full_name, email, phone, designation, department, join_date, location, gender, status, avatar, work_status, exit_date, reason_for_leave")
.order("employee_id", { ascending: true });

        if (error) {
          console.error("[Employees] Fetch error:", error);
          throw error;
        }

        console.log("[Employees] Raw data received:", data?.length || 0, "records");

        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((r) => ({
            id: r.employee_id || "",
            username: r.username || "",
            name: r.full_name || "",
            designation: r.designation || "",
            department: r.department || "",
            email: r.email || "",
            phone: r.phone || "",
            location: r.location || "",
            joinDate: r.join_date || "",
            employeeType: r.employee_type || "",
            status: r.status || "",
            avatar: r.avatar || "",
            gender: r.gender || "",
            dob: r.dob || "",
            reportingManager: r.reporting_manager || "",
            // Offboarding fields
            workStatus: r.work_status || (String(r.status || "").toLowerCase() === "inactive" ? "Inactive" : "Active"),
            exitDate: r.exit_date || "",
            reasonForLeave: r.reason_for_leave || "",
            documentUrl: r.document_url || "",
          }));
          
          // Filter out founders in JavaScript instead of SQL
          const filtered = mapped.filter(emp => {
            const desig = (emp.designation || "").toLowerCase();
            return !desig.includes("founder") && !desig.includes("boss");
          });
          
          console.log("[Employees] Mapped and filtered:", filtered.length, "employees");
          setEmployees(filtered);
        } else {
          console.log("[Employees] No employees found in database");
          setEmployees([]);
        }
      } catch (err) {
        console.error("Fetch employees failed:", err);
        setEmployees([]);
      }
    };

    fetchEmployees();
  }, []);

  /* 📈 DYNAMIC DROPDOWN OPTIONS */
  const allDesignations = useMemo(() => {
    const fromEmployees = employees.map((e) => e.designation).filter(Boolean);
    
    // Combine hardcoded departments with employee designations
    const all = [...DEPARTMENTS, ...fromEmployees];
    
    // Normalize and remove duplicates case-insensitively
    // Keep the first occurrence (prioritizes hardcoded DEPARTMENTS which have proper casing)
    const normalizedMap = new Map();
    for (const d of all) {
      const normalized = d.trim();
      if (normalized) {
        const lower = normalized.toLowerCase();
        if (!normalizedMap.has(lower)) {
          normalizedMap.set(lower, normalized);
        }
      }
    }
    
    return Array.from(normalizedMap.values())
      .filter((d) => !deletedDesignations.includes(d))
      .sort((a, b) => a.localeCompare(b));
  }, [employees, deletedDesignations]);


  // 🗑️ DELETE HANDLERS
  const handleDeleteDesignation = (designation) => {
    if (!window.confirm(`Delete designation "${designation}"? It will be removed from the dropdown.`)) return;
    const next = [...deletedDesignations, designation];
    setDeletedDesignations(next);
    saveMetadata(next);
    if (newEmployee.department === designation) {
      setNewEmployee((p) => ({ ...p, department: "" }));
    }
    if (departmentFilter === designation) setDepartmentFilter("All");
  };


  // ✅ ESC close view modal
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") closeEmployeeModal();
    };
    if (isViewModalOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isViewModalOpen]);

  const openEmployeeModal = (emp) => {
    setSelectedEmployee(emp);
    setIsViewModalOpen(true);
  };

  const closeEmployeeModal = () => {
    setIsViewModalOpen(false);
    setSelectedEmployee(null);
    setResetPw(false);
    setResetPwValue("");
    setShowResetPw(false);
  };

  // 🔑 Reset Password handler
  const handleResetPassword = async () => {
    const empId = selectedEmployee?.id;
    const pw = resetPwValue.trim();
    if (!empId || !pw) {
      alert("Please enter a new password");
      return;
    }
    if (pw.length < 4) {
      alert("Password must be at least 4 characters");
      return;
    }
    setResetPwSaving(true);
    try {
      const { error } = await supabase.rpc("upsert_employee_account", {
        p_employee_id: empId,
        p_password: pw,
        p_username: selectedEmployee.username || null,
        p_email: selectedEmployee.email || null,
      });
      if (error) throw error;
      alert(`Password reset successfully for ${selectedEmployee.name || empId}`);
      setResetPw(false);
      setResetPwValue("");
      setShowResetPw(false);
    } catch (err) {
      console.error("[HrProfile] Caught error in handleSaveEdit:", err);
      alert("Error updating profile.");
    } finally {
      setResetPwSaving(false);
    }
  };

  const handleDeleteEmployee = async (profileToDelete) => {
    const eid = profileToDelete.employee_id;
    if (!eid) {
      alert("Cannot delete: Employee ID missing.");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete employee ${profileToDelete.full_name} (${eid})? This action cannot be undone.`)) {
      return;
    }

    try {
      // Assuming setSaving is a state setter for a loading indicator
      // If not defined, you might need to add it or remove this line.
      // setSaving(true);
      const response = await fetch(`${API_BASE}/admin/delete-employee/${eid}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to delete employee: ${errorData.detail || errorData.message || response.statusText}`);
      }

      setEmployees((prev) => prev.filter((emp) => emp.employee_id !== eid && emp.id !== eid));
      setIsEditModalOpen(false);
      setSelectedEmployee(null);
      alert(`Employee ${profileToDelete.full_name} deleted successfully.`);
    } catch (err) {
      console.error("[Employees] Error deleting employee:", err);
      alert("Error deleting employee: " + err.message);
    } finally {
      // setSaving(false);
    }
  };

  const mapEmployeeToProfile = (emp) => {
    if (!emp) return null;
    return {
      ...emp,
      full_name: emp.name || "",
      employee_id: emp.id || "",
      id: emp.id || "",
      official_email: emp.email || "",
      personal_email: emp.email || "",
      mobile_number: emp.phone || "",
      dob: emp.dob || "",
      gender: emp.gender || "",
      designation: emp.designation || "",
      join_date: emp.joinDate || "",
    };
  };

  const handleSaveEdit = async (updatedProfile) => {
    try {
      const up = updatedProfile;
      const nextWorkStatus = up.work_status || "Active";
      const isMarkingInactive = nextWorkStatus === "Inactive";

      if (isMarkingInactive) {
        if (!up.exit_date || !up.reason_for_leave) {
          alert("Date of Exit and Reason for Exit are required for Inactive employees.");
          return;
        }
      }

      if (!up.dob || String(up.dob).trim() === "") {
        alert("Date of Birth is required.");
        return;
      }

      const payload = {
        full_name: up.full_name || up.name || null,
        username: up.username || null,
        designation: up.designation || null,
        department: up.department || null,
        location: up.location || null,
        join_date: up.join_date || up.joinDate || null,
        employee_type: up.employee_type || up.employeeType || null,
        reporting_manager: up.reporting_manager || up.reportingManager || up.manager || null,
        gender: up.gender || null,
        dob: up.dob || null,
        phone: up.mobile_number || up.phone || null,
        email: up.official_email || up.personal_email || up.email || null,
        status: isMarkingInactive ? "Inactive" : (up.status || selectedEmployee?.status || null),
        work_status: nextWorkStatus,
        exit_date: isMarkingInactive ? (up.exit_date || null) : null,
        reason_for_leave: isMarkingInactive ? (up.reason_for_leave || null) : null,
      };

      console.log("[handleSaveEdit] Final payload for backend:", payload);

      const response = await fetch(`${API_BASE}/admin/employees/${up.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log("[handleSaveEdit] Backend response:", result);

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update employee");
      }

      // Update local state
      setEmployees(prev => prev.map(emp => {
        if (emp.id === up.id) {
          return {
            ...emp,
            name: payload.full_name || emp.name,
            username: payload.username || emp.username,
            designation: payload.designation || emp.designation,
            department: payload.department || emp.department,
            location: payload.location || emp.location,
            joinDate: payload.join_date || emp.joinDate,
            employeeType: payload.employee_type || emp.employeeType,
            status: payload.status || emp.status,
            reportingManager: payload.reporting_manager || emp.reportingManager,
            gender: payload.gender || emp.gender,
            dob: payload.dob || emp.dob,
            phone: payload.phone || emp.phone,
            email: payload.email || emp.email,
            workStatus: nextWorkStatus,
            exitDate: payload.exit_date,
            reasonForLeave: payload.reason_for_leave,
          };
        }
        return emp;
      }));

      // Update selected employee for the View modal
      setSelectedEmployee(prev => ({
        ...prev,
        name: payload.full_name || prev.name,
        username: payload.username || prev.username,
        designation: payload.designation || prev.designation,
        department: payload.department || prev.department,
        location: payload.location || prev.location,
        joinDate: payload.join_date || prev.joinDate,
        employeeType: payload.employee_type || prev.employeeType,
        status: payload.status || prev.status,
        reportingManager: payload.reporting_manager || prev.reportingManager,
        gender: payload.gender || prev.gender,
        dob: payload.dob || prev.dob,
        phone: payload.phone || prev.phone,
        email: payload.email || prev.email,
        workStatus: nextWorkStatus,
        exitDate: payload.exit_date,
        reasonForLeave: payload.reason_for_leave,
      }));

      setIsEditModalOpen(false);
      alert("Employee profile updated successfully");
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to update employee");
    }
  };

  const handleInlineSave = () => { };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "phone") {
      const numericValue = value.replace(/\D/g, "");
      if (numericValue.length > 10) return;
      setNewEmployee((p) => ({ ...p, phone: numericValue }));
      return;
    }

    setNewEmployee((p) => ({
      ...p,
      [name]: value,
      ...(name === "employeeType" && value !== "Intern" ? { internDuration: "" } : {}),
      ...(name === "department" && value !== "CREATE_NEW" ? { customDepartment: "" } : {}),
      ...(name === "role" && value !== "CREATE_NEW" ? { customRole: "" } : {}),
    }));
  };


  const handleAddEmployee = async (e) => {
    e.preventDefault();

    const email = String(newEmployee.email || "")
      .trim()
      .toLowerCase();

    const fullName = String(newEmployee.fullName || "").trim();

    // Auto-generate employee ID if not set
    let employeeId = String(newEmployee.employeeId || "").trim();
    if (!employeeId) {
      employeeId = generateEmployeeId(employees, newEmployee.idSeries);
    }

    if (!email || !newEmployee.password || !fullName || !newEmployee.department || !newEmployee.joinDate) {
      alert("All fields are required.");
      return;
    }

    // duplicate email check
    const emailExists = employees.some(
      (x) => String(x.email || "").toLowerCase() === email
    );
    if (emailExists) {
      alert("This Email already exists");
      return;
    }

    // duplicate employee ID check
    const idExists = employees.some(
      (x) => String(x.id || "").trim() === employeeId
    );
    if (idExists) {
      alert("This Employee ID already exists");
      return;
    }

    if (isSupabaseConfigured) {
      try {
        const payload = {
          employee_id: employeeId,
          username: newEmployee.username || null,
          full_name: fullName,
          designation: newEmployee.department || null, // Designation (Job Title)
          department: null, // Department (Team) - could be added if needed
          employee_type: null,
          status: "Probation",
          gender: null,
          reporting_manager: null,
          join_date: newEmployee.joinDate || null,
          location: null,
          email: email || null,
          mobile_number: null,
          work_status: "Active",
          dob: null,
          avatar: null,
        };

        const { data: inserted, error: insErr } = await supabase
          .from("employees")
          .upsert([payload], { onConflict: "employee_id" })
          .select("*")
          .single();

        if (insErr) throw insErr;

        // Save login credentials via RPC
        const { error: credErr } = await supabase.rpc(
          "upsert_employee_account",
          {
            p_employee_id: employeeId,
            p_password: String(newEmployee.password || ""),
            p_username: newEmployee.username || null,
            p_email: email || null,
          }
        );
        if (credErr) throw credErr;

        setEmployees((prev) => [
          ...prev,
          {
            ...inserted,
            id: inserted.employee_id, // Map employee_id to id for consistency
            name: inserted.full_name, // Map full_name to name
            joinDate: inserted.join_date,
            employeeType: inserted.employee_type,
            reportingManager: inserted.reporting_manager,
            workStatus: inserted.work_status || "Active",
          },
        ]);
      } catch (err) {
        console.error(err);
        alert(err?.message || "Failed to save employee");
        return;
      }
    } else {
      // local fallback
      setEmployees((prev) => [
        ...prev,
        {
          id: employeeId,
          name: fullName,
          department: newEmployee.department,
          role: "",
          employeeType: "",
          status: "Probation",
          gender: "",
          reportingManager: "",
          joinDate: newEmployee.joinDate,
          location: "",
          email: email,
          phone: "",
          dob: "",
          avatar: "",
          workStatus: "Active",
        },
      ]);
    }

    setIsAddModalOpen(false);
    setAddStep("CHOICE");
    setShowPw(false);
    setNewEmployee({
      username: "",
      email: "",
      password: "",
      fullName: "",
      idSeries: "VS",
      employeeId: "",
      department: "",
      joinDate: "",
    });
  };

  const handleResignedChange = (e) => {
    const { name, value } = e.target;
    setResignedEmployee((p) => ({ ...p, [name]: value }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setResignedEmployee((p) => {
      const currentCount = p.documents.length;
      if (currentCount + files.length > 5) {
        alert("Maximum 5 documents allowed per employee.");
        return p;
      }
      return { ...p, documents: [...p.documents, ...files] };
    });
    // Clear input so same file can be selected again if removed
    e.target.value = "";
  };

  const removeDocument = (index) => {
    setResignedEmployee(p => ({
      ...p,
      documents: p.documents.filter((_, i) => i !== index)
    }));
  };

  const handleAddResignedEmployee = async (e) => {
    e.preventDefault();
    if (!resignedEmployee.fullName || !resignedEmployee.employeeId || !resignedEmployee.email || !resignedEmployee.designation || !resignedEmployee.reason || !resignedEmployee.exitDate) {
      alert("Please fill in all mandatory fields.");
      return;
    }

    if (isSupabaseConfigured) {
      // 🕵️ Check for duplicate ID or Email
      const idExists = employees.some(x => String(x.id || "").trim() === resignedEmployee.employeeId);
      const emailExists = employees.some(x => String(x.email || "").trim().toLowerCase() === resignedEmployee.email.toLowerCase());

      if (idExists) {
        alert("This Employee ID already exists");
        return;
      }
      if (emailExists) {
        alert("This Email ID is already associated with an employee");
        return;
      }

      try {
        // Upload documents if exist
        let documentPaths = [];
        if (resignedEmployee.documents && resignedEmployee.documents.length > 0) {
          for (const file of resignedEmployee.documents) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${resignedEmployee.employeeId}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('employee-documents')
              .upload(`resigned/${fileName}`, file);

            if (uploadError) throw uploadError;
            documentPaths.push(uploadData.path);
          }
        }
        const documentUrlString = documentPaths.length > 0 ? documentPaths.join(',') : null;

        const finalReason = resignedEmployee.reason === "Other" ? resignedEmployee.otherReason : resignedEmployee.reason;

        const payload = {
          employee_id: resignedEmployee.employeeId,
          username: resignedEmployee.username || null,
          full_name: resignedEmployee.fullName.trim(),
          email: resignedEmployee.email || null,
          phone: null,
          join_date: resignedEmployee.joinDate || null,
          designation: resignedEmployee.designation || null,
          department: null,
          status: "Inactive",
          exit_date: resignedEmployee.exitDate || null,
          reason_for_leave: finalReason || null,
          document_url: documentUrlString,
          work_status: "Inactive",
        };

        const { error } = await supabase
          .from("employees")
          .insert([payload]);

        if (error) throw error;

        // Add to local state
        setEmployees(prev => [
          ...prev,
          {
            id: resignedEmployee.employeeId,
            name: payload.full_name,
            designation: resignedEmployee.designation,
            department: "",
            email: resignedEmployee.email,
            phone: resignedEmployee.phone,
            location: "",
            joinDate: resignedEmployee.joinDate,
            employeeType: "Former Employee",
            status: "Inactive",
            avatar: null,
            gender: "",
            dob: "",
            reportingManager: "",
            workStatus: "Inactive",
            exitDate: payload.exit_date,
            reasonForLeave: payload.reason_for_leave,
            documentUrl: payload.document_url,
          },
        ]);

        alert("Resigned employee details added successfully.");
        setIsAddModalOpen(false);
        setAddStep("CHOICE");
        setResignedEmployee({
          username: "",
          fullName: "",
          idSeries: "VS",
          employeeId: "",
          email: "",
          joinDate: "",
          designation: "",
          documents: [],
          reason: "",
          otherReason: "",
          exitDate: "",
          workStatus: "Inactive",
        });
      } catch (err) {
        console.error(err);
        alert(err?.message || "Failed to save resigned employee");
      }
    } else {
      // Local fallback
      setEmployees(prev => [
        ...prev,
        {
          id: resignedEmployee.employeeId,
          name: resignedEmployee.fullName.trim(),
          department: resignedEmployee.designation,
          role: "",
          email: resignedEmployee.email,
          phone: "",
          location: "",
          joinDate: resignedEmployee.joinDate,
          employeeType: "Former Employee",
          status: "Inactive",
          avatar: null,
          gender: "",
          dob: "",
          reportingManager: "",
          workStatus: "Inactive",
        },
      ]);
      setIsAddModalOpen(false);
      setAddStep("CHOICE");
    }
  };

  // 🔍 FILTER LOGIC
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchSearch =
        (emp.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (emp.id || "").toLowerCase().includes(search.toLowerCase()) ||
        (emp.username || "").toLowerCase().includes(search.toLowerCase()) ||
        (emp.email || "").toLowerCase().includes(search.toLowerCase());

      const matchDepartment =
        departmentFilter === "All" || emp.department === departmentFilter;

      const currentType = String(emp.employeeType || "");
      const matchEmployeeType =
        employeeTypeFilter === "All"
          ? true
          : employeeTypeFilter === "Intern"
            ? currentType.toLowerCase().startsWith("intern")
            : emp.employeeType === employeeTypeFilter;

      const isInactive = String(emp.workStatus || "").toLowerCase() === "inactive";
      const matchTab = viewTab === "active" ? !isInactive : isInactive;

      return matchSearch && matchDepartment && matchEmployeeType && matchTab;
    }).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [employees, search, departmentFilter, employeeTypeFilter, viewTab]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, departmentFilter, employeeTypeFilter, viewTab]);

  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEmployees.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredEmployees, currentPage]);

  const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);

  // ✅ Modal shows ONLY fields that are part of Add form / DB fields you set
  // ✅ DOB + Phone removed
  const modalFields = useMemo(() => {
    const e = selectedEmployee;
    if (!e) return [];

    const isInactive = String(e.workStatus || "").toLowerCase() === "inactive";

    const fields = [
      { label: "Username", value: e.username },
      { label: "Employee ID", value: e.id },
      { label: "Full Name", value: e.name },
      { label: "Email", value: e.email },
      { label: "Designation", value: e.designation },
      { label: "Date of Joining", value: formatJoinDate(e.joinDate) },
    ];

    if (isInactive) {
      fields.push({ label: "Exit Date", value: formatJoinDate(e.exitDate) });
      fields.push({ label: "Reason for Exit", value: e.reasonForLeave });
    }

    return fields
      .map((f) => ({ ...f, value: String(f.value || "").trim() }))
      .filter((f) => f.value);
  }, [selectedEmployee]);

  return (
    <div className="min-h-screen bg-slate-50 px-3 sm:px-6 py-4 sm:py-6">
      {/* HEADER */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
            Employee Details
          </h1>
        </div>

        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border shadow-sm self-start sm:self-auto">
          <button
            onClick={() => setViewTab("active")}
            className={`px-4 sm:px-6 py-2 text-sm font-bold rounded-lg transition-all ${viewTab === "active"
              ? "bg-[#598791] text-white shadow-md"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
          >
            Active
          </button>
          <button
            onClick={() => setViewTab("inactive")}
            className={`px-4 sm:px-6 py-2 text-sm font-bold rounded-lg transition-all ${viewTab === "inactive"
              ? "bg-red-600 text-white shadow-md"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
          >
            Inactive
          </button>
        </div>

        <button
          onClick={() => {
            setAddStep("ACTIVE");
            setIsAddModalOpen(true);
          }}
          className="rounded-lg bg-[#598791] px-4 py-2 text-sm font-medium text-white hover:bg-[#75b0bd] self-start sm:self-auto"
        >
          + Add Employee
        </button>
      </div>

      {/* 🔍 FILTER BAR */}
      <div className="mb-6 grid gap-4 rounded-xl bg-white p-4 shadow ring-1 ring-slate-100 md:grid-cols-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, ID, email..."
          className="rounded-lg border px-3 py-2 text-sm"
        />

        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="All">All Designation</option>
          {allDesignations.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto rounded-xl bg-white shadow ring-1 ring-slate-100">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold w-[30%]">Employee</th>
              {viewTab === "active" ? (
                <>
                  <th className="px-3 py-2 text-left text-xs font-semibold w-[25%]">Designation</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold w-[15%]">Join Date</th>
                </>
              ) : (
                <>
                  <th className="px-3 py-2 text-left text-xs font-semibold w-[20%]">Designation</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold w-[12%]">Join</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold w-[12%]">Exit</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold w-[18%]">Reason</th>
                </>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {paginatedEmployees.map((emp) => (
              <tr
                key={emp.id}
                className="hover:bg-slate-50 cursor-pointer"
                onClick={() => openEmployeeModal(emp)}
                title="Click to view details"
              >
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900 truncate">{emp.name}</div>
                  <div className="text-xs text-slate-500">{emp.id}</div>
                </td>

                {viewTab === "active" ? (
                  <>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${deptPill(emp.designation)}`}>
                        {emp.designation || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs">{formatJoinDate(emp.joinDate) || "-"}</td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${deptPill(emp.designation)}`}>
                        {emp.designation || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs">{formatJoinDate(emp.joinDate) || "-"}</td>
                    <td className="px-3 py-2 text-slate-600 text-xs">{formatJoinDate(emp.exitDate) || "-"}</td>
                    <td className="px-3 py-2 text-slate-600 text-xs truncate">{emp.reasonForLeave || "-"}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* 📄 PAGINATION CONTROLS */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-end">
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-l-md px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-[#598791] hover:text-white focus:z-20 focus:outline-offset-0 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-700 transition-all"
                  >
                    Previous
                  </button>
                  <div className="relative inline-flex items-center px-4 py-2 text-sm font-black text-[#598791] ring-1 ring-inset ring-slate-300 bg-[#598791]/5">
                    Page {currentPage} of {totalPages}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center rounded-r-md px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-[#598791] hover:text-white focus:z-20 focus:outline-offset-0 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-700 transition-all"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}

        {filteredEmployees.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-500">
            No employees found.
          </div>
        )}
      </div>

      {/* ================= VIEW EMPLOYEE MODAL ================= */}
      {isViewModalOpen && selectedEmployee && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeEmployeeModal();
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-4 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-[#598791]/10 text-[#598791] grid place-items-center font-bold overflow-hidden border-2 border-white shadow-sm">
                  {selectedEmployee.avatar ? (
                    <img
                      src={selectedEmployee.avatar}
                      alt={selectedEmployee.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-lg">{initials(selectedEmployee.name)}</span>
                  )}
                </div>

                <div>
                  <div className="text-lg font-bold text-slate-900 leading-tight">
                    {selectedEmployee.name}
                  </div>
                  <div className="text-xs font-semibold text-slate-500 mt-0.5">
                    {selectedEmployee.id}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="rounded-full p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Edit Employee"
                >
                  <Pencil size={18} />
                </button>
                <button
                  type="button"
                  onClick={closeEmployeeModal}
                  className="rounded-full p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  {modalFields.map((field) => (
                    <InfoRow key={field.label} label={field.label} value={field.value} />
                  ))}
                </div>
              </div>
            </div>

            {/* 📄 DOCUMENTS SECTION IN MODAL */}
            {selectedEmployee?.documentUrl && (
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 px-1">
                <p className="text-[10px] uppercase font-bold text-slate-400 ml-1">Attached Documents</p>
                <div className="grid gap-2">
                  {selectedEmployee.documentUrl.split(',').map((url, i) => (
                    <a
                      key={i}
                      href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/employee-documents/${url.trim()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 transition shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <FileText size={16} />
                        <span>Document {i + 1}</span>
                      </div>
                      <span className="text-[10px] text-red-500/60 font-medium italic">Click to view</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 🔑 RESET PASSWORD SECTION */}
            {String(selectedEmployee?.workStatus || "").toLowerCase() !== "inactive" && (
              <div className="mt-6 border-t border-slate-100 pt-5 mb-2 px-1">
                {!resetPw ? (
                  <button
                    type="button"
                    onClick={() => setResetPw(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 transition shadow-sm"
                  >
                    <KeyRound size={14} />
                    Reset Password
                  </button>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2">
                      <KeyRound size={14} className="text-slate-400" />
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Set New Password</p>
                    </div>
                    <div className="relative">
                      <input
                        type={showResetPw ? "text" : "password"}
                        value={resetPwValue}
                        onChange={(e) => setResetPwValue(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full rounded-lg border px-3 py-2 pr-10 text-sm"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPw((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-600 hover:bg-slate-100"
                      >
                        {showResetPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleResetPassword}
                        disabled={resetPwSaving}
                        className="rounded-lg bg-[#598791] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#75b0bd] disabled:opacity-50"
                      >
                        {resetPwSaving ? "Saving..." : "Save Password"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setResetPw(false); setResetPwValue(""); setShowResetPw(false); }}
                        className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= ADD EMPLOYEE MODAL ================= */}
      {
        isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
              <div className="mb-6 shrink-0 border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-slate-900 font-segoe">
                    {addStep === "ACTIVE" ? "Create New Employee" : addStep === "INACTIVE" ? "Add Inactive Employee" : "Add Employee"}
                  </h2>
                  <button
                    onClick={() => setIsAddModalOpen(false)}
                    className="rounded-full border p-1 hover:bg-slate-50 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {addStep === "CHOICE" ? (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-sm text-slate-600 mb-4 font-medium text-center italic">What kind of employee are you adding?</p>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setAddStep("ACTIVE")}
                        className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-[#598791] hover:bg-slate-50 transition-all group"
                      >
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-[#598791]/10 transition-colors">
                          <User className="text-slate-400 group-hover:text-[#598791]" size={24} />
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-slate-900 text-sm">Active</p>
                          <p className="text-[10px] text-slate-500 mt-1">Regular onboarding</p>
                        </div>
                      </button>

                      <button
                        onClick={() => setAddStep("INACTIVE")}
                        className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-red-600 hover:bg-red-50/30 transition-all group"
                      >
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-red-50 transition-colors">
                          <UserMinus className="text-slate-400 group-hover:text-red-600" size={24} />
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-slate-900 text-sm">Inactive</p>
                          <p className="text-[10px] text-slate-500 mt-1">Resigned/Terminated</p>
                        </div>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-fit cursor-pointer" onClick={() => setAddStep("CHOICE")}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setAddStep("ACTIVE"); }}
                      className={`px-6 py-2 text-xs font-bold rounded-lg transition-all ${addStep === "ACTIVE"
                        ? "bg-[#598791] text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 hover:bg-white"
                        }`}
                    >
                      Active
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setAddStep("INACTIVE"); }}
                      className={`px-6 py-2 text-xs font-bold rounded-lg transition-all ${addStep === "INACTIVE"
                        ? "bg-red-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 hover:bg-white"
                        }`}
                    >
                      Inactive
                    </button>
                  </div>
                )}
              </div>

              {addStep === "ACTIVE" && (
                <form
                  onSubmit={handleAddEmployee}
                  className="flex-1 flex flex-col min-h-0"
                >
                  <div className="grid gap-4 md:grid-cols-2 overflow-y-auto pr-2 custom-scrollbar flex-1 py-1">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500 ml-1">Username (Login) *</label>
                      <input
                        name="username"
                        value={newEmployee.username}
                        onChange={handleChange}
                        placeholder="e.g. vijay_admin"
                        className="rounded border px-3 py-2"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500 ml-1">ID Series *</label>
                      <select
                        name="idSeries"
                        value={newEmployee.idSeries}
                        onChange={handleSeriesChange}
                        className="rounded border px-3 py-2 bg-slate-50"
                        required
                      >
                        <option value="VS">VS Series (VS0001)</option>

                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500 ml-1">Employee ID *</label>
                      <input
                        name="employeeId"
                        value={newEmployee.employeeId}
                        onChange={handleChange}
                        placeholder="Auto-generated or enter ID"
                        className="rounded border px-3 py-2 font-mono"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500 ml-1">Email *</label>
                      <input
                        type="email"
                        name="email"
                        value={newEmployee.email}
                        onChange={handleChange}
                        placeholder="Enter email"
                        className="rounded border px-3 py-2"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500 ml-1">Password *</label>
                      <div className="relative">
                        <input
                          type={showPw ? "text" : "password"}
                          name="password"
                          value={newEmployee.password}
                          onChange={handleChange}
                          placeholder="Enter password"
                          className="w-full rounded border px-3 py-2 pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((s) => !s)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-600 hover:bg-slate-100"
                          aria-label={showPw ? "Hide password" : "Show password"}
                        >
                          {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500 ml-1">Full Name *</label>
                      <input
                        name="fullName"
                        value={newEmployee.fullName}
                        onChange={handleChange}
                        placeholder="Enter full name"
                        className="rounded border px-3 py-2"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500 ml-1">Designation *</label>
                      <select
                        name="department"
                        value={newEmployee.department}
                        onChange={handleChange}
                        className="rounded border px-3 py-2"
                        required
                      >
                        <option value="">Select Designation</option>
                        {allDesignations.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500 ml-1">Date of Joining *</label>
                      <input
                        type="date"
                        name="joinDate"
                        value={newEmployee.joinDate}
                        onChange={handleChange}
                        className="rounded border px-3 py-2"
                        required
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end gap-3 shrink-0 border-t pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddModalOpen(false);
                        setShowPw(false);
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="rounded-lg bg-[#598791] px-4 py-2 text-sm text-white hover:bg-[#75b0bd]"
                    >
                      Save Employee
                    </button>
                  </div>
                </form>
              )}

              {addStep === "INACTIVE" && (
                <form
                  onSubmit={handleAddResignedEmployee}
                  className="flex-1 flex flex-col min-h-0"
                >
                  <div className="grid gap-4 md:grid-cols-2 overflow-y-auto pr-2 custom-scrollbar flex-1 py-1">
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-500 ml-1">Full Name *</label>
                      <input
                        name="fullName"
                        value={resignedEmployee.fullName}
                        onChange={handleResignedChange}
                        placeholder="Enter full name *"
                        className="rounded border px-3 py-2"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-500 ml-1">Username (Login) *</label>
                      <input
                        name="username"
                        value={resignedEmployee.username}
                        onChange={handleResignedChange}
                        placeholder="Username for login"
                        className="rounded border px-3 py-2"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500 ml-1">ID Series *</label>
                      <select
                        name="idSeries"
                        value={resignedEmployee.idSeries}
                        onChange={handleResignedSeriesChange}
                        className="rounded border px-3 py-2 bg-slate-50"
                        required
                      >
                        <option value="VS">VS Series (V0001)</option>

                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500 ml-1">Employee ID *</label>
                      <input
                        name="employeeId"
                        value={resignedEmployee.employeeId}
                        onChange={handleResignedChange}
                        placeholder="Employee ID *"
                        className="rounded border px-3 py-2 font-mono"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500 ml-1">Email ID *</label>
                      <input
                        type="email"
                        name="email"
                        value={resignedEmployee.email}
                        onChange={handleResignedChange}
                        placeholder="Email ID *"
                        className="rounded border px-3 py-2"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500 ml-1">Date of Joining</label>
                      <input
                        type="date"
                        name="joinDate"
                        value={resignedEmployee.joinDate}
                        onChange={handleResignedChange}
                        className="rounded border px-3 py-2"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500 ml-1">Designation *</label>
                      <select
                        name="designation"
                        value={resignedEmployee.designation}
                        onChange={handleResignedChange}
                        className="rounded border px-3 py-2"
                        required
                      >
                        <option value="">Select Designation *</option>
                        {allDesignations.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500 ml-1">Reason for Exit *</label>
                      <select
                        name="reason"
                        value={resignedEmployee.reason}
                        onChange={handleResignedChange}
                        className="rounded border px-3 py-2"
                        required
                      >
                        <option value="">Reason for Exit *</option>
                        <option value="Resigned">Resigned</option>
                        <option value="Terminated">Terminated</option>
                        <option value="Absconded">Absconded</option>
                        <option value="Other">Other (Type custom reason)</option>
                      </select>

                      {resignedEmployee.reason === "Other" && (
                        <input
                          name="otherReason"
                          value={resignedEmployee.otherReason}
                          onChange={handleResignedChange}
                          placeholder="Type custom reason *"
                          className="rounded border px-3 py-2 mt-1 border-indigo-300 bg-indigo-50/20"
                          required
                        />
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500 ml-1">Date of Exit *</label>
                      <input
                        type="date"
                        name="exitDate"
                        value={resignedEmployee.exitDate}
                        onChange={handleResignedChange}
                        className="rounded border px-3 py-2"
                        required
                      />
                    </div>

                    <div className="md:col-span-2 space-y-3">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-8 h-8 text-slate-400 mb-2" />
                          <p className="text-sm text-slate-500">Upload Documents (Max 5)</p>
                          <p className="text-xs text-slate-400 mt-1">SDR, Experience letter, etc.</p>
                        </div>
                        <input type="file" className="hidden" multiple onChange={handleFileChange} />
                      </label>

                      {resignedEmployee.documents.length > 0 && (
                        <div className="grid gap-2">
                          {resignedEmployee.documents.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm shadow-sm ring-1 ring-slate-900/5">
                              <div className="flex items-center gap-2 text-slate-700 truncate">
                                <FileText size={16} className="text-red-500 shrink-0" />
                                <span className="truncate font-medium">{file.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">({(file.size / 1024).toFixed(0)} KB)</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeDocument(idx)}
                                className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end gap-3 shrink-0 border-t pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddModalOpen(false);
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
                    >
                      Save Resigned Employee
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )
      }

      {/* ================= EDIT EMPLOYEE MODAL ================= */}
      {
        isEditModalOpen && selectedEmployee && (
          <EditProfileModal
            profile={mapEmployeeToProfile(selectedEmployee)}
            onClose={() => setIsEditModalOpen(false)}
            onSave={handleSaveEdit}
            onDelete={handleDeleteEmployee}
            simplified={true}
          />
        )
      }
    </div>
  );
}
