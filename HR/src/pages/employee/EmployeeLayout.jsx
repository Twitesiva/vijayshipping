import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import {
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  UserRound,
} from "lucide-react";


const SideItem = ({ to, icon: Icon, label, end, isCollapsed, compact = false }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>

      `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} ${compact ? 'px-3 py-2 text-xs ml-4' : 'px-4 py-3 text-sm'} rounded-xl font-semibold transition-all duration-200 ${isActive
        ? "bg-[#598791] text-white shadow"
        : "text-gray-700 hover:bg-[#00cccc] hover:text-[#00cccc]"
      }`
    }
  >

    <Icon size={18} className="shrink-0" />
    {!isCollapsed && <span className="truncate">{label}</span>}
  </NavLink>
);

// Extra tabs removed to consolidate focus on Attendance and Profile.

export default function EmployeeLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [designation, setDesignation] = useState(() => {
    try {
      const authSession = localStorage.getItem("HRMSS_AUTH_SESSION");
      if (authSession) {
        const parsed = JSON.parse(authSession);
        return parsed?.designation || "";
      }
    } catch { }
    return "";
  });
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(pathname.startsWith("/employee-dashboard/attendance"));

  const normalizedDesignation = (designation || "").trim().toLowerCase();
  const hasFullAccess = ["manager", "founder", "admin", "hr"].includes(normalizedDesignation);

  /* Guard handled by RequireProfileSetup in App.jsx */

  useEffect(() => {
    setIsAttendanceOpen(pathname.startsWith("/employee-dashboard/attendance"));
  }, [pathname]);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Body scroll lock when mobile drawer open
  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileOpen]);

  useEffect(() => {
    // Fetch designation
    const fetchDesignation = async () => {
      let employeeId = null;
      try {
        const authSession = localStorage.getItem("HRMSS_AUTH_SESSION");
        if (authSession) {
          const parsed = JSON.parse(authSession);
          employeeId = parsed?.employee_id || parsed?.identifier || parsed?.empId || parsed?.user_id;
        }
      } catch { }

      if (employeeId) {
        // Try hrms_employee_profile first (for employees)
        const { data: empProfile } = await supabase
          .from("hrms_employee_profile")
          .select("designation")
          .eq("employee_id", employeeId)
          .maybeSingle();

        if (empProfile?.designation) {
          setDesignation(empProfile.designation);
          return;
        }

        // 2. Try employees table (most reliable for all roles now)
        const { data: empRow } = await supabase
          .from("employees")
          .select("designation")
          .or(`employee_id.eq.${employeeId},email.eq.${employeeId}`)
          .maybeSingle();

        if (empRow?.designation) {
          setDesignation(empRow.designation);
        }
      }
    };

    fetchDesignation();
  }, []);


  const handleLogout = () => {
    localStorage.removeItem("HRMSS_AUTH_SESSION");
    navigate("/login");
  };

  // ✅ Simple route guard removed as App.jsx 이제 handles routing
  // Role based access is simplified

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      <aside
        className={`bg-white border-r h-screen fixed md:sticky inset-y-0 left-0 top-0 z-50 transition-all duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          w-[280px] ${isSidebarOpen ? 'md:w-[280px]' : 'md:w-[72px]'}`}
      >
        <div className="h-full flex flex-col overflow-hidden">
          <div className={`p-5 border-b flex items-center gap-3 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
            {isSidebarOpen ? (
              <div className="flex flex-col items-start min-w-0">
                <img src="/VijayShipping_Logo.png" alt="VijayShipping Logo" className="h-16 w-auto object-contain" />
                <span className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase opacity-60">Attendance Portal</span>
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center p-1.5 shadow-sm">
                <img src="/VijayShipping_Logo.png" alt="V" className="w-full h-auto object-contain" />
              </div>
            )}
          </div>

          <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto overflow-x-hidden">
            {hasFullAccess ? (
              <>
                <SideItem to="dashboard" end icon={LayoutDashboard} label="Dashboard" isCollapsed={!isSidebarOpen} />

                <div>
                  <button
                    onClick={() => {
                      if (!isSidebarOpen) setIsSidebarOpen(true);
                      setIsAttendanceOpen((v) => !v);
                    }}
                    className={`w-full flex items-center ${!isSidebarOpen ? "justify-center" : "justify-between"} px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 text-gray-700 hover:bg-[#00cccc] hover:text-[#00cccc]`}
                  >
                    <div className={`flex items-center ${!isSidebarOpen ? "justify-center" : "gap-3"}`}>
                      <ClipboardCheck size={18} className="shrink-0" />
                      {isSidebarOpen && <span className="truncate">Attendance</span>}
                    </div>
                    {isSidebarOpen && (
                      isAttendanceOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                    )}
                  </button>

                  {isSidebarOpen && isAttendanceOpen && (
                    <div className="pl-11 pr-2 space-y-1 mt-1">
                      <NavLink
                        to="/employee-dashboard/attendance/dashboard"
                        className={({ isActive }) =>
                          `block px-3 py-2 rounded-lg text-xs font-medium transition-all ${isActive
                            ? "bg-[#f8f1f1] text-[#598791]"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          }`
                        }
                      >
                        Dashboard
                      </NavLink>
                      <NavLink
                        to="/employee-dashboard/attendance/my-attendance"
                        className={({ isActive }) =>
                          `block px-3 py-2 rounded-lg text-xs font-medium transition-all ${isActive
                            ? "bg-[#f8f1f1] text-[#598791]"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          }`
                        }
                      >
                        My Attendance
                      </NavLink>
                      <NavLink
                        to="/employee-dashboard/attendance/reports"
                        className={({ isActive }) =>
                          `block px-3 py-2 rounded-lg text-xs font-medium transition-all ${isActive
                            ? "bg-[#f8f1f1] text-[#598791]"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          }`
                        }
                      >
                        Reports
                      </NavLink>
                    </div>
                  )}
                </div>

                {/* Extra feature tabs removed */}
              </>
            ) : (
              <>
                <SideItem to="dashboard" end icon={LayoutDashboard} label="Dashboard" isCollapsed={!isSidebarOpen} />
                <SideItem to="attendance/my-attendance" icon={ClipboardCheck} label="My Attendance" isCollapsed={!isSidebarOpen} />
              </>
            )}
          </nav>


          <div className="p-3 border-t overflow-hidden">
            <button
              onClick={handleLogout}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#598791] text-white text-sm font-semibold hover:bg-[#75b0bd] transition-all ${isSidebarOpen ? 'px-4 py-3' : 'h-10'}`}
              title="Logout"
            >
              <LogOut size={18} />
              {isSidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="bg-white border-b sticky top-0 z-40">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileOpen(v => !v);
                  } else {
                    setIsSidebarOpen(v => !v);
                  }
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-gray-700 shadow-sm hover:bg-gray-50"
                aria-label="Toggle sidebar"
                title="Toggle sidebar"
              >
                <Menu size={18} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <NavLink
                to="profile"
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${isActive
                    ? "bg-gray-900 text-white shadow"
                    : "text-gray-700 hover:bg-gray-100"
                  }`
                }
              >
                <UserRound size={16} />
                My Profile
              </NavLink>
            </div>
          </div>
        </header>

        <div className="p-6 flex-1">
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}


