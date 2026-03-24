import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

import { LayoutDashboard, ClipboardList, LogOut, UserRound, Menu, Users, ChevronDown, ChevronRight, ScanFace, FileBarChart, ClipboardCheck } from "lucide-react";

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
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Body scroll lock when mobile drawer open
  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileOpen]);

  const handleLogout = () => {
    localStorage.removeItem("HRMSS_AUTH_SESSION");
    navigate("/login");
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex">
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      {/* SIDEBAR - always fixed, slides on mobile */}
      <aside
        className={`bg-white border-r shadow-sm flex flex-col fixed inset-y-0 left-0 top-0 z-50 transition-all duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          w-[280px] ${isSidebarOpen ? 'md:w-[280px]' : 'md:w-[72px]'}
          min-h-[100dvh]`}
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* Brand */}
          <div className={`p-5 border-b flex items-center gap-3 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
            {isSidebarOpen ? (
              <div className="flex flex-col items-start min-w-0">
                <img src="/VijayShipping_Logo.png" alt="Vijay Shipping" className="h-16 w-auto max-w-full object-contain mb-1" />
<span className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase opacity-60">Attendance Portal</span>
              </div>
            ) : (
              <div className="w-12 h-12 rounded-lg bg-white border border-gray-100 flex items-center justify-center p-1.5 shadow-sm overflow-hidden">
                <img src="/VijayShipping_Logo.png" alt="V" className="w-full h-auto object-contain" />
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto overflow-x-hidden">
            {/* 1. Dashboard */}
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

            {/* 2. Employees */}
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

            {/* 3. Face Enroll (for managers, moves up) */}
            {pathname.startsWith("/manager-dashboard") && (
              <SideItem
                to="/manager-dashboard/face-enroll"
                icon={ScanFace}
                label="Face Enroll"
                isCollapsed={!isSidebarOpen}
              />
            )}

            {/* 4. Reports (for managers, moves up) */}
            {pathname.startsWith("/manager-dashboard") && (
              <SideItem
                to="/manager-dashboard/attendance/reports"
                icon={FileBarChart}
                label="Reports"
                isCollapsed={!isSidebarOpen}
              />
            )}

            {/* 5. Attendance Dropdown */}
            <div>
              <button
                onClick={() => {
                  if (!isSidebarOpen) setIsSidebarOpen(true);
                  setIsAttendanceOpen((v) => !v);
                }}
                className={`w-full flex items-center ${!isSidebarOpen ? "justify-center" : "justify-between"} px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 text-gray-700 hover:bg-[#e6ffff] hover:text-[#009999] ${(pathname.includes("/attendance/")) ? 'bg-[#e6ffff] text-[#009999]' : ''}`}
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
                  {/* Common: My Attendance */}
                  <NavLink
                    to={
                      pathname.startsWith("/manager-dashboard") ? "/manager-dashboard/attendance/my-attendance" :
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
                  
                  {/* Manager/Employee: My Dashboard */}
                  {(pathname.startsWith("/manager-dashboard")) && (
                    <NavLink
                      to="/manager-dashboard/attendance/dashboard"
                      className={({ isActive }) =>
                        `block px-3 py-2 rounded-lg text-xs font-medium transition-all ${isActive
                          ? "bg-[#f8f1f1] text-[#598791]"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                    >
                      My Dashboard
                    </NavLink>
                  )}

                   {/* HR/Founder/Admin extra: Reports */}
                  {(pathname.startsWith("/hr-dashboard") || pathname.startsWith("/founder-dashboard")) && hasFullAccess && (
                    <>
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
                      <NavLink
                        to={
                          pathname.startsWith("/founder-dashboard") ? "/founder-dashboard/attendance/employees" :
                            "/hr-dashboard/attendance/employees"
                        }
                        className={({ isActive }) =>
                          `block px-3 py-2 rounded-lg text-xs font-medium transition-all ${isActive
                            ? "bg-[#f8f1f1] text-[#598791]"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          }`}
                      >
                        Attendance Employees
                      </NavLink>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Other items for HR/Founder if any (Face Enroll was here before) */}
            {!pathname.startsWith("/manager-dashboard") && hasFullAccess && (
              <SideItem
                to={
                  pathname.startsWith("/founder-dashboard") ? "/founder-dashboard/face-enroll" :
                    "/hr-dashboard/face-enroll"
                }
                icon={ScanFace}
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

      {/* MAIN CONTENT - has left margin on desktop */}
      <main className="flex-1 min-w-0 flex flex-col md:ml-[280px]">
        {/* Optional: top bar in content area */}
        <header className="bg-white border-b sticky top-0 z-40 shrink-0">
          <div className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-3">
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
              <div className="text-xs md:text-sm text-gray-500 hidden sm:block">
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
                  `inline-flex items-center gap-2 rounded-xl px-2 md:px-3 py-2 text-xs md:text-sm font-semibold transition ${isActive
                    ? "bg-[#598791] text-white shadow"
                    : "text-gray-700 hover:bg-[#f8f1f1] hover:text-[#598791]"
                  }`}
              >
                <UserRound size={16} />
                <span className="hidden sm:inline">My Profile</span>
              </NavLink>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6 flex-1 overflow-y-auto pb-safe">
          <div className="bg-white rounded-2xl shadow-sm border p-4 md:p-6">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

