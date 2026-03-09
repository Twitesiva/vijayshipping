// ✅ File: src/pages/hr/HrHome.jsx
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Users,
  Shield,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  Building2,
  Sparkles,
  Hash,
  IdCard,
  AlertTriangle,
  Briefcase,
  CreditCard,
  GraduationCap,
  BriefcaseBusiness,
  UserRound,
  Laptop,
  HeartPulse,
  Home,
} from "lucide-react";

import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { formatDDMMYYYY } from "../../lib/dateUtils";
import EmployeeAttendanceDashboard from "../employee/EmployeeAttendanceDashboard";

/* ---------------- HELPERS ---------------- */
function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts[1]?.[0] || parts[0]?.[1] || "";
  return (a + b).toUpperCase();
}
function safeLower(x) {
  return (x || "").toString().toLowerCase();
}
function formatDate(iso) {
  return formatDDMMYYYY(iso);
}

const EMP_TABLE = "employees";
const EMP_PROFILE_TABLE = "hrms_employee_profile";
const ADMIN_PROFILE_TABLE = "hrms_employee_profile";

function deptBadge(dept = "Unknown") {
  const key = safeLower(dept);
  const options = [
    "bg-amber-50 text-amber-700 border-amber-200",
    "bg-lime-50 text-lime-700 border-lime-200",
    "bg-cyan-50 text-cyan-700 border-cyan-200",
    "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    "bg-indigo-50 text-indigo-700 border-indigo-200",
    "bg-[#fcf8f8] text-[#598791] border-[#e3d0d0]",
  ];
  let sum = 0;
  for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
  const pick = options[sum % options.length];
  return `inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${pick}`;
}

const pillBase =
  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm";

const typePill = (type) => {
  if (type === "employee")
    return `${pillBase} bg-[#fcf8f8] text-[#598791] border-[#e3d0d0]`;
  return `${pillBase} bg-violet-50 text-violet-700 border-violet-200`;
};

const TAB_VALUES = new Set(["all", "ta_team", "tech_team", "bd_team", "inactive"]);

const SortIcon = ({ active, dir }) => {
  if (!active) return <ArrowUpDown size={14} className="opacity-70" />;
  return dir === "asc" ? (
    <ArrowUp size={14} className="opacity-90" />
  ) : (
    <ArrowDown size={14} className="opacity-90" />
  );
};

const SegButton = ({ active, onClick, icon: Icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold border transition-all ${active
      ? "bg-[#598791] text-white border-[#598791] shadow"
      : "bg-white/70 text-slate-700 border-slate-200 hover:bg-white hover:shadow-sm"
      }`}
  >
    {Icon ? (
      <span
        className={`p-1.5 rounded-xl border transition ${active
          ? "bg-white/10 border-white/15"
          : "bg-slate-50 border-slate-200 group-hover:bg-white"
          }`}
      >
        <Icon size={16} />
      </span>
    ) : null}
    {label}
  </button>
);/* ---------------- HELPER COMPONENTS ---------------- */
const DetailItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-4 p-4 rounded-2xl border bg-white/50 shadow-sm transition-all hover:shadow-md hover:bg-white/80 group">
    <div className="p-2.5 rounded-xl bg-[#598791]/10 group-hover:bg-[#598791]/20 transition-colors shrink-0">
      <Icon size={18} className="text-[#598791]" />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-slate-400 gap-2 uppercase tracking-[0.1em]">{label}</p>
      <p className="text-sm text-slate-800 font-bold break-words mt-1 leading-tight">{value || "-"}</p>
    </div>
  </div>
);

const SectionTitle = ({ title }) => (
  <h4 className="text-sm font-black text-slate-900 border-l-4 border-[#598791] pl-3 mb-6 uppercase tracking-[0.1em]">
    {title}
  </h4>
);

const ModalBadge = ({ children, tone = "neutral" }) => {
  const tones = {
    neutral: "bg-slate-100 text-slate-600 border-slate-200",
    info: "bg-white/10 text-white border-white/20 backdrop-blur-md",
    success: "bg-white/10 text-white border-white/20 backdrop-blur-md",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${tones[tone]}`}>
      {children}
    </span>
  );
};


/* ---------------- SMALL MODAL (ENHANCED DESIGN) ---------------- */
function SmallModal({ open, onClose, viewing, profile, children }) {
  if (!open || !viewing) return null;

  const currentAvatar = viewing.avatar_url || profile?.avatar_url || profile?.avatar;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300 transition-all">
        {/* Header Section */}
        <div className="relative p-6 bg-gradient-to-br from-[#598791] via-[#8b6d85] to-[#b498ab] text-white shadow-xl">
          <button
            onClick={onClose}
            className="absolute top-5 right-6 p-2 rounded-2xl bg-white/10 hover:bg-white/20 transition-all active:scale-95 z-10"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left relative z-0">
            <div className="h-20 w-20 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center overflow-hidden shrink-0 shadow-lg transition-transform hover:scale-105">
              {currentAvatar ? (
                <img src={currentAvatar} alt={viewing.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-white/10 to-transparent text-white font-black text-2xl">
                  {initials(viewing.name)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 pb-0.5">
              <p className="text-white/50 text-[9px] font-black uppercase tracking-[0.2em] mb-0.5">{viewing.id}</p>
              <h3 className="text-2xl font-black tracking-tight drop-shadow-sm leading-tight">{viewing.name}</h3>
              <p className="text-white/80 text-xs font-bold mt-1 opacity-90">
                {viewing.designation || viewing.role} • {viewing.department}
              </p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                <ModalBadge tone="info"><MapPin size={10} /> {viewing.location}</ModalBadge>
                <ModalBadge tone="success"><Briefcase size={10} /> {viewing.type === "employee" ? "Full-Time" : "Manager"}</ModalBadge>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/30">
          {children}
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-50 border-t flex justify-end items-center gap-3">
          <button
            onClick={onClose}
            className="px-10 py-3.5 rounded-2xl bg-[#598791] text-white text-xs font-black shadow-xl hover:shadow-2xl hover:bg-[#75b0bd] active:scale-95 transition-all tracking-[0.15em] uppercase"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}


const parseList = (val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};


/* ---------------- PAGE ---------------- */
export default function HrHome() {
  const [searchParams] = useSearchParams();
  const tabParam = (searchParams.get("tab") || "").toLowerCase();
  const initialTab = TAB_VALUES.has(tabParam) ? tabParam : "all";
  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const [employees, setEmployees] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [designation, setDesignation] = useState("");
  const [loginRole, setLoginRole] = useState("");

  useEffect(() => {
    try {
      const authSession = localStorage.getItem("HRMSS_AUTH_SESSION");
      if (authSession) {
        const parsed = JSON.parse(authSession);
        setDesignation(parsed?.designation || "");
        setLoginRole((parsed?.loginRole || "").toLowerCase());
      }
    } catch { }
  }, []);

  const normalizedDesignation = (designation || "").trim().toLowerCase();
  // Managers and HR always have full access in this dashboard
  const hasFullAccess = true;

  const [viewing, setViewing] = useState(null);
  const [modalTab, setModalTab] = useState("personal");
  const [profileDetail, setProfileDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const combined = useMemo(
    () => [...employees, ...admins],
    [employees, admins]
  );

  const counts = useMemo(() => {
    const emp = employees.length;
    const adm = admins.length;
    const total = emp + adm;
    return { emp, adm, total };
  }, [employees, admins]);

  useEffect(() => {
    let mounted = true;

    const fetchUsers = async () => {
      if (!isSupabaseConfigured) {
        if (mounted) {
          setEmployees([]);
          setAdmins([]);
          setLoadingUsers(false);
          setLoadError("Supabase not configured.");
        }
        return;
      }

      try {
        setLoadingUsers(true);
        setLoadError("");

        const [empRes, profileRes] = await Promise.all([
          supabase
            .from(EMP_TABLE)
            .select(
              "employee_id, full_name, email, phone, designation, department, join_date, location, gender, status"
            )
            .order("employee_id", { ascending: true }),
          supabase
            .from(EMP_PROFILE_TABLE)
            .select(
              "employee_id, full_name, personal_email, official_email, phone, location, gender, avatar_url"
            )
            .eq("profile_completed", true),
        ]);

        if (empRes.error) throw empRes.error;

        const profileMap = new Map(
          (profileRes.data || [])
            .filter((p) => p?.employee_id)
            .map((p) => [String(p.employee_id), p])
        );

        const EXCLUDED_Admin_IDS = ["HR-001", "HR-PRIYA", "MGR-SUNIL", "lkjfhd", "EMP-043", "MGR-ARUN"];

        const allMapped = (empRes.data || []).map((row) => {
          const key = String(row.employee_id || "");
          const profile = profileMap.get(key);
          const desig = (row.designation || "").toLowerCase();

          const isFounder = desig.includes("founder") || desig.includes("boss");
          if (isFounder) return null;

          const isMgmt = desig.includes("manager") || desig.includes("hr");

          return {
            type: isMgmt ? "admin" : "employee",
            id: key,
            name: row.full_name || profile?.full_name || "",
            email: row.email || profile?.official_email || profile?.personal_email || "",
            phone: row.phone || profile?.phone || "",
            department: row.department || "",
            designation: row.designation || (isMgmt ? "Manager" : "Employee"),
            role: row.designation || (isMgmt ? "Manager" : "Employee"),
            joinedOn: row.join_date || "",
            location: row.location || profile?.location || "",
            gender: row.gender || profile?.gender || "",
            avatar_url: profile?.avatar_url || "",
            status: row.status || "",
          };
        }).filter(u => u !== null && u.id);

        if (!mounted) return;

        // Split them for the existing state logic (if needed, though 'combined' uses both)
        const employeesList = allMapped.filter(u => u.type === "employee");
        const adminsList = allMapped.filter(u => u.type === "admin" && !EXCLUDED_Admin_IDS.includes(u.id));

        setEmployees(employeesList);
        setAdmins(adminsList);
      } catch (fetchError) {
        if (!mounted) return;
        setEmployees([]);
        setAdmins([]);
        setLoadError(fetchError?.message || "Failed to load users.");
      } finally {
        if (mounted) setLoadingUsers(false);
      }
    };

    fetchUsers();

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    let list = [...combined];
    const isInactiveEmployee = (x) =>
      x.type === "employee" && safeLower(x.status) === "inactive";

    if (tab === "inactive") {
      list = list.filter((x) => isInactiveEmployee(x));
    } else {
      // "All Users" and team tabs should not include inactive employees.
      list = list.filter((x) => !isInactiveEmployee(x));
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((x) => {
        const roleOrDept =
          x.type === "employee"
            ? `${x.department} ${x.designation}`
            : `${x.role || ""} ${x.department || ""}`;
        return (
          safeLower(x.id).includes(q) ||
          safeLower(x.name).includes(q) ||
          safeLower(x.email).includes(q) ||
          safeLower(x.phone).includes(q) ||
          safeLower(roleOrDept).includes(q) ||
          safeLower(x.location).includes(q)
        );
      });
    }

    const get = (x) => {
      switch (sortKey) {
        case "id":
          return x.id || "";
        case "type":
          return x.type || "";
        case "joinedOn":
          return x.joinedOn || "";
        case "name":
        default:
          return x.name || "";
      }
    };

    list.sort((a, b) => {
      const A = get(a);
      const B = get(b);
      if (A === B) return 0;
      const res = A > B ? 1 : -1;
      return sortDir === "asc" ? res : -res;
    });

    return list;
  }, [combined, tab, search, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const openProfile = (u) => {
    setViewing(u);
    setModalTab("personal");
  };
  const closeProfile = () => setViewing(null);

  const searchHint = useMemo(() => {
    if (!search.trim()) return "Search by name, id, email, role/department...";
    return `Searching: "${search.trim()}"`;
  }, [search]);

  useEffect(() => {
    let mounted = true;

    const loadDetails = async () => {
      if (!viewing || !isSupabaseConfigured) {
        if (mounted) {
          setProfileDetail(null);
          setDetailError("");
          setDetailLoading(false);
        }
        return;
      }

      try {
        setDetailLoading(true);
        setDetailError("");

        const empId = viewing.id;

        // Try Profile Table first
        const { data: profileRow, error: profileErr } = await supabase
          .from(EMP_PROFILE_TABLE)
          .select("*")
          .eq("employee_id", empId)
          .maybeSingle();

        if (!mounted) return;

        if (profileRow) {
          setProfileDetail(profileRow);
        } else {
          // Fallback to Employees table basic info
          const { data: empRow } = await supabase
            .from(EMP_TABLE)
            .select("*")
            .eq("employee_id", empId)
            .maybeSingle();
          setProfileDetail(empRow || null);
        }
      } catch (fetchError) {
        if (!mounted) return;
        setProfileDetail(null);
        setDetailError(fetchError?.message || "Failed to load details.");
      } finally {
        if (mounted) setDetailLoading(false);
      }
    };

    loadDetails();

    return () => {
      mounted = false;
    };
  }, [viewing]);

  useEffect(() => {
    if (viewing) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => (document.body.style.overflow = "");
  }, [viewing]);

  /* REMOVED: Employee restricted view from this management page */

  return (
    <section className="space-y-6">
      {/* HEADER */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-lg bg-gradient-to-br from-[#009999] to-[#737373]">
        <div className="relative p-5 sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-md">
                Manager Dashboard
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-white/20 bg-white/10 text-sm font-bold text-white backdrop-blur-md shadow-inner">
                  <Hash size={16} className="opacity-80" />
                  Total: {counts.total}
                </span>
              </div>
            </div>

            {/* SEARCH + STATUS */}
            <div className="w-full md:w-[460px]">
              <div className="rounded-3xl border border-white/20 bg-white/20 backdrop-blur-md p-3 shadow-sm">
                <div className="flex items-center gap-2 rounded-2xl border border-white/30 bg-white/90 px-3 py-2.5 focus-within:ring-4 focus-within:ring-[#598791]/20 focus-within:border-[#598791] transition">
                  <Search size={18} className="text-[#598791]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search id / name / email / role / dept / location..."
                    className="w-full bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="p-1.5 rounded-xl hover:bg-slate-100 transition"
                      aria-label="Clear search"
                    >
                      <X size={16} className="text-slate-500" />
                    </button>
                  ) : null}
                </div>

                <div className="mt-2 text-[11px] text-white/80 font-medium pl-1">{searchHint}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex flex-wrap items-center gap-2">
        <SegButton active={tab === "all"} onClick={() => setTab("all")} icon={Sparkles} label="All Users" />
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-[28px] border shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b flex items-center justify-between">
          <div>
            <div className="text-sm font-extrabold text-slate-900">User Directory</div>
          </div>

          <div className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{filtered.length}</span> results
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort("name")} className="inline-flex items-center gap-2 hover:text-slate-900">
                    User <SortIcon active={sortKey === "name"} dir={sortDir} />
                  </button>
                </th>

                <th className="text-left px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort("type")} className="inline-flex items-center gap-2 hover:text-slate-900">
                    Type <SortIcon active={sortKey === "type"} dir={sortDir} />
                  </button>
                </th>

                <th className="text-left px-4 py-3 font-semibold">Contact</th>
                <th className="text-left px-4 py-3 font-semibold">Designation</th>

                <th className="text-right px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort("joinedOn")} className="inline-flex items-center gap-2 hover:text-slate-900">
                    Joined <SortIcon active={sortKey === "joinedOn"} dir={sortDir} />
                  </button>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {loadingUsers ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    Loading users...
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-rose-600">
                    {loadError}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr
                    key={`${u.type}-${u.id}`}
                    className="hover:bg-slate-50/70 cursor-pointer transition"
                    onClick={() => openProfile(u)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative w-11 h-11 rounded-2xl border bg-white overflow-hidden shadow-sm">
                          <div
                            className={`absolute inset-0 ${u.type === "employee"
                              ? "bg-gradient-to-br from-[#598791]/20 to-[#8e7091]/20"
                              : "bg-gradient-to-br from-violet-500/25 to-indigo-500/25"
                              }`}
                          />
                          <div className="relative h-full w-full flex items-center justify-center">
                            <span className="text-xs font-extrabold text-slate-800">{initials(u.name)}</span>
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{u.name}</div>
                          <div className="text-xs text-slate-500">{u.id}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className={typePill(u.type)}>
                        {u.type === "employee" ? (
                          <>
                            <Users size={14} /> Employee
                          </>
                        ) : (
                          <>
                            <Shield size={14} /> Manager
                          </>
                        )}
                      </span>
                    </td>

                    {/* ✅ IMPORTANT: clicking email/phone should NOT open modal */}
                    <td className="px-4 py-3">
                      <div
                        className="space-y-1 cursor-text select-text"
                        onClick={(e) => e.stopPropagation()}
                        role="presentation"
                      >
                        <div className="text-slate-800 font-semibold truncate">{u.email}</div>
                        <div className="text-xs text-slate-500 truncate">{u.phone}</div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {u.type === "employee" ? (
                        <div className="font-semibold text-slate-800">{u.designation}</div>
                      ) : (
                        <div className="font-semibold text-slate-800">{u.role}</div>
                      )}
                      <div className="mt-1 text-xs text-slate-500 truncate">
                        <MapPin size={12} className="inline-block mr-1 -mt-0.5" />
                        {u.location}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right text-slate-700 font-semibold">{formatDate(u.joinedOn)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>


      </div>

      {/* PROFILE MODAL */}
      <SmallModal
        open={!!viewing}
        viewing={viewing}
        profile={profileDetail}
        onClose={closeProfile}
      >
        {viewing && (
          <>
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30 custom-scrollbar">
              {detailLoading ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-4">
                  <div className="w-10 h-10 border-4 border-[#598791] border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Synchronizing Data...</p>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="md:col-span-2"><SectionTitle title="Employee Details" /></div>
                    <DetailItem icon={IdCard} label="Employee ID" value={viewing.id} />
                    <DetailItem icon={UserRound} label="Full Name" value={viewing.name} />
                    <DetailItem icon={Mail} label="Email Address" value={viewing.email} />
                    <DetailItem icon={BriefcaseBusiness} label="Designation" value={viewing.designation || viewing.role} />
                    <DetailItem icon={CalendarDays} label="Date of Joining" value={formatDate(viewing.joinedOn)} />

                    <div className="md:col-span-2 pt-4">
                      <p className="text-[10px] text-slate-400 italic bg-white/50 p-3 rounded-xl border border-dashed">
                        Note: ID Series is included in the Employee ID. For password management, please use the main Employees directory.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SmallModal>
    </section>
  );
}


