import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

import { LayoutDashboard, ClipboardList, LogOut, UserRound, Menu, Users, ChevronDown, ChevronRight } from "lucide-react";

const DOCS_AUTH_KEY = "HRMSS_DOCS_AUTH";

const SideItem = ({ to, icon: Icon, label, end, isCollapsed }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>

      `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${isActive
        ? "bg-[#598791] text-white shadow"
        : "text-gray-700 hover:bg-[#e6ffff] hover:text-[#009999]"
      }`
    }
  >

    <Icon size={18} className="shrink-0" />
    {!isCollapsed && <span className="truncate">{label}</span>}
  </NavLink>
);

export default function HrLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [isAttendanceOpen, setIsAttendanceOpen] = useState(pathname.startsWith("/hr-dashboard/attendance") || pathname.startsWith("/founder-dashboard/attendance"));
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
  // Managers and HR always have full access in this layout
  const hasFullAccess = true;

  const isManagementMatch =
    normalizedDesignation.includes("manager") ||
    normalizedDesignation.includes("founder") ||
    normalizedDesignation.includes("boss") ||
    normalizedDesignation.includes("hr") ||
    normalizedDesignation.includes("admin") ||
    loginRole === "founder" ||
    loginRole === "manager" ||
    loginRole === "hr";

  useEffect(() => {
    // Basic guard: If it's strictly an employee in the management dashboard, send them to their own
    if ((normalizedDesignation === "employee" || loginRole === "employee") && !isManagementMatch) {
      navigate("/employee-dashboard");
    }
  }, [normalizedDesignation, loginRole, navigate, isManagementMatch]);

  // Profile completion guard disabled as per user request
  /*
  useEffect(() => {
    const isManager = pathname.startsWith("/manager-dashboard");
    const isFounder = pathname.startsWith("/founder-dashboard");
    const isHR = pathname.startsWith("/hr-dashboard");

    if (!isManager && !isFounder && !isHR) return;

    const roleKey = isManager ? "manager" : (isFounder ? "founder" : "hr");
    const completedKey = `hrmss.signin.completed.${roleKey}`;

    if (pathname === "/sign-in") return;

    if (localStorage.getItem(completedKey) !== "true") {
      console.warn(`[HrLayout] ${roleKey} profile not completed, redirecting to sign-in`);
      navigate("/sign-in", {
        replace: true,
        state: {
          role: roleKey,
          redirectTo: pathname
        }
      });
    }
  }, [navigate, pathname]);
  */

  useEffect(() => {
    setIsAttendanceOpen(pathname.startsWith("/hr-dashboard/attendance") || pathname.startsWith("/founder-dashboard/attendance"));
  }, [pathname]);


  const handleLogout = () => {
    localStorage.removeItem("HRMSS_AUTH_SESSION");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* SIDEBAR */}
      <aside

        className={`bg-white border-r sticky top-0 h-screen transition-all duration-300 ease-in-out ${isSidebarOpen ? "w-[280px]" : "w-[72px]"
          }`}
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* Brand */}
          <div className={`p-5 border-b flex items-center gap-3 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
            {isSidebarOpen ? (
              <div className="flex flex-col items-start min-w-0">
                <img src="/VijayShipping_Logo.png" alt="Vijay Shipping" className="h-8 w-auto max-w-full object-contain mb-1" />
                <span className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase opacity-60">HRMS Portal</span>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center p-1.5 shadow-sm overflow-hidden">
                <img src="/VijayShipping_Logo.png" alt="V" className="w-full h-auto object-contain" />
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto overflow-x-hidden">
            <SideItem
              to={
                pathname.startsWith("/manager-dashboard") ? "/manager-dashboard" :
                  pathname.startsWith("/founder-dashboard") ? "/founder-dashboard" :
                    "/hr-dashboard"
              }
              end
              icon={LayoutDashboard}
              label="Dashboard"
              isCollapsed={!isSidebarOpen}
            />

            {hasFullAccess && (
              <SideItem
                to={
                  pathname.startsWith("/manager-dashboard") ? "/manager-dashboard/employees" :
                    pathname.startsWith("/founder-dashboard") ? "/founder-dashboard/employees" :
                      "/hr-dashboard/employees"
                }
                icon={Users}
                label="Employees"
                isCollapsed={!isSidebarOpen}
              />
            )}

            {pathname.startsWith("/manager-dashboard") ? (
              <>
                <SideItem
                  to="/manager-dashboard/attendance/my-attendance"
                  icon={ClipboardList}
                  label="My Attendance"
                  isCollapsed={!isSidebarOpen}
                />
                <SideItem
                  to="/manager-dashboard/attendance/reports"
                  icon={ClipboardList}
                  label="Reports"
                  isCollapsed={!isSidebarOpen}
                />
              </>
            ) : (
              <div>
                <button
                  onClick={() => {
                    if (!isSidebarOpen) setIsSidebarOpen(true);
                    setIsAttendanceOpen((v) => !v);
                  }}
                  className={`w-full flex items-center ${!isSidebarOpen ? "justify-center" : "justify-between"} px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 text-gray-700 hover:bg-[#e6ffff] hover:text-[#009999]`}
                >
                  <div className={`flex items-center ${!isSidebarOpen ? "justify-center" : "gap-3"}`}>
                    <ClipboardList size={18} className="shrink-0" />
                    {isSidebarOpen && <span className="truncate">Attendance</span>}
                  </div>
                  {isSidebarOpen && (
                    isAttendanceOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                  )}
                </button>

                {isSidebarOpen && isAttendanceOpen && (
                  <div className="pl-11 pr-2 space-y-1 mt-1">
                    <NavLink
                      to={
                        pathname.startsWith("/founder-dashboard") ? "/founder-dashboard/attendance/my-attendance" :
                          "/hr-dashboard/attendance/my-attendance"
                      }
                      className={({ isActive }) =>
                        `block px-3 py-2 rounded-lg text-xs font-medium transition-all ${isActive
                          ? "bg-[#f8f1f1] text-[#598791]"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                    >
                      My Attendance
                    </NavLink>
                    {hasFullAccess && (
                      <NavLink
                        to={
                          pathname.startsWith("/founder-dashboard") ? "/founder-dashboard/attendance/reports" :
                            "/hr-dashboard/attendance/reports"
                        }
                        className={({ isActive }) =>
                          `block px-3 py-2 rounded-lg text-xs font-medium transition-all ${isActive
                            ? "bg-[#f8f1f1] text-[#598791]"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          }`}
                      >
                        Reports
                      </NavLink>
                    )}
                  </div>
                )}
              </div>
            )}

            {hasFullAccess && (
              <SideItem
                to={
                  pathname.startsWith("/manager-dashboard") ? "/manager-dashboard/face-enroll" :
                    pathname.startsWith("/founder-dashboard") ? "/founder-dashboard/face-enroll" :
                      "/hr-dashboard/face-enroll"
                }
                icon={Users}
                label="Face Enroll"
                isCollapsed={!isSidebarOpen}
              />
            )}

          </nav>

          {/* Logout */}
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

      {/* MAIN CONTENT */}
      <main className="flex-1 min-w-0">
        {/* Optional: top bar in content area */}
        <header className="bg-white border-b sticky top-0 z-40">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen((open) => !open)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-gray-700 shadow-sm hover:bg-gray-50"
                aria-label={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
                title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
              >
                <Menu size={18} />
              </button>
              <div className="text-sm text-gray-500">
                {pathname.startsWith("/manager-dashboard") ? "Manager Dashboard" :
                  pathname.startsWith("/founder-dashboard") ? "Founder Dashboard" :
                    "HR Dashboard"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NavLink
                to={
                  pathname.startsWith("/manager-dashboard") ? "/manager-dashboard/profile" :
                    pathname.startsWith("/founder-dashboard") ? "/founder-dashboard/profile" :
                      "/hr-dashboard/profile"
                }
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${isActive
                    ? "bg-[#598791] text-white shadow"
                    : "text-gray-700 hover:bg-[#f8f1f1] hover:text-[#598791]"
                  }`}
              >
                <UserRound size={16} />
                My Profile
              </NavLink>
            </div>
          </div>
        </header>

        <div className="p-6">
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

