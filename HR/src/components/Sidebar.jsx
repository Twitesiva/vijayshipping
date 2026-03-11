import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import {
  LayoutDashboard,
  ClipboardCheck,
  CalendarDays,
  FileText,
  Compass,
  ChevronDown,
  ChevronRight,
  LogOut,
  Book,
} from "lucide-react";

const DOCS_AUTH_KEY = "HRMSS_DOCS_AUTH";
const AUTH_KEY = "HRMSS_AUTH_SESSION";
const COMPLETION_KEY = "hrmss.signin.completed.admin";

const Sidebar = ({ isOpen = true, isMobileOpen = false }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(pathname.startsWith("/dashboard/attendance"));

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch { }

    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(COMPLETION_KEY);
    try {
      sessionStorage.removeItem(DOCS_AUTH_KEY);
    } catch { }
    localStorage.removeItem(DOCS_AUTH_KEY);
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    setIsAttendanceOpen(pathname.startsWith("/dashboard/attendance"));
  }, [pathname]);

  return (
    <aside
      className={`bg-white border-r shadow-sm flex flex-col h-screen fixed md:sticky inset-y-0 left-0 top-0 z-50 transition-all duration-300
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${isOpen ? 'w-64 md:w-64' : 'w-64 md:w-20'}`}
    >
      <div
        className={`p-5 border-b flex items-center h-[70px] ${isOpen ? "justify-start" : "justify-center"
          }`}
      >
        {isOpen ? (
          <img src="/VijayShipping_Logo.png" alt="VijayShipping Logo" className="h-16 w-auto object-contain" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center p-1.5 shadow-sm">
            <img src="/VijayShipping_Logo.png" alt="V" className="w-full h-auto object-contain" />
          </div>
        )}
      </div>
      <nav className="p-4 flex-1 space-y-1 overflow-y-auto">
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) =>
            `flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"
            } py-2 rounded-md text-sm font-medium transition ${isActive
              ? "bg-[#598791] text-white"
              : "text-gray-700 hover:bg-[#00cccc] hover:text-[#00cccc]"
            }`}
        >
          <LayoutDashboard size={18} />
          {isOpen && <span>Dashboard</span>}
        </NavLink>

        <div>
          <button
            onClick={() => {
              if (isOpen) setIsAttendanceOpen((v) => !v);
            }}
            className={`w-full flex items-center ${!isOpen ? "justify-center" : "justify-between"
              } py-2 rounded-md text-sm font-medium transition text-gray-700 hover:bg-[#00cccc] hover:text-[#00cccc] ${isOpen ? "px-3" : "px-0"
              }`}
          >
            <div className={`flex items-center ${!isOpen ? "justify-center" : "gap-3"}`}>
              <ClipboardCheck size={18} />
              {isOpen && <span>Attendance</span>}
            </div>
            {isOpen && (
              isAttendanceOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
            )}
          </button>

          {isOpen && isAttendanceOpen && (
            <div className="pl-9 space-y-1 mt-1">
              <NavLink
                to="/dashboard/attendance/dashboard"
                className={({ isActive }) =>
                  `block py-2 rounded-md text-xs font-medium transition ${isActive
                    ? "text-[#598791] font-bold"
                    : "text-gray-600 hover:text-[#00cccc]"
                  }`}
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/dashboard/attendance/my-attendance"
                className={({ isActive }) =>
                  `block py-2 rounded-md text-xs font-medium transition ${isActive
                    ? "text-[#598791] font-bold"
                    : "text-gray-600 hover:text-[#00cccc]"
                  }`}
              >
                My Attendance
              </NavLink>
              <NavLink
                to="/dashboard/attendance/reports"
                className={({ isActive }) =>
                  `block py-2 rounded-md text-xs font-medium transition ${isActive
                    ? "text-[#598791] font-bold"
                    : "text-gray-600 hover:text-[#00cccc]"
                  }`}
              >
                Reports
              </NavLink>
            </div>
          )}
        </div>

        <NavLink
          to="/dashboard/leave"
          className={({ isActive }) =>
            `flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"
            } py-2 rounded-md text-sm font-medium transition ${isActive
              ? "bg-[#598791] text-white"
              : "text-gray-700 hover:bg-[#00cccc] hover:text-[#00cccc]"
            }`}
        >
          <CalendarDays size={18} />
          {isOpen && <span>Leave Management</span>}
        </NavLink>

        <NavLink
          to="/dashboard/calendar"
          className={({ isActive }) =>
            `flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"
            } py-2 rounded-md text-sm font-medium transition ${isActive
              ? "bg-[#598791] text-white"
              : "text-gray-700 hover:bg-[#00cccc] hover:text-[#00cccc]"
            }`}
        >
          <CalendarDays size={18} />
          {isOpen && <span>Holiday Calendar</span>}
        </NavLink>

        <NavLink
          to="/dashboard/payslips"
          className={({ isActive }) =>
            `flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"
            } py-2 rounded-md text-sm font-medium transition ${isActive
              ? "bg-[#598791] text-white"
              : "text-gray-700 hover:bg-[#00cccc] hover:text-[#00cccc]"
            }`}
        >
          <FileText size={18} />
          {isOpen && <span>Payslips</span>}
        </NavLink>

        <NavLink
          to="/dashboard/documents"
          className={({ isActive }) =>
            `flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"
            } py-2 rounded-md text-sm font-medium transition ${isActive
              ? "bg-[#598791] text-white"
              : "text-gray-700 hover:bg-[#00cccc] hover:text-[#00cccc]"
            }`}
        >
          <FileText size={18} />
          {isOpen && <span>Documents</span>}
        </NavLink>

        <NavLink
          to="/dashboard/career-guidance"
          className={({ isActive }) =>
            `flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"
            } py-2 rounded-md text-sm font-medium transition ${isActive
              ? "bg-[#598791] text-white"
              : "text-gray-700 hover:bg-[#00cccc] hover:text-[#00cccc]"
            }`}
        >
          <Compass size={18} />
          {isOpen && <span>Career Ladder</span>}
        </NavLink>
        <NavLink
          to="/dashboard/handbook"
          className={({ isActive }) =>
            `flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"
            } py-2 rounded-md text-sm font-medium transition ${isActive
              ? "bg-[#598791] text-white"
              : "text-gray-700 hover:bg-[#00cccc] hover:text-[#00cccc]"
            }`}
        >
          <Book size={18} />
          {isOpen && <span>VijayShipping Handbook</span>}
        </NavLink>
      </nav>

      <div className="p-3 border-t overflow-hidden">
        <button
          onClick={handleLogout}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#598791] text-white text-sm font-semibold hover:bg-[#75b0bd] transition-all ${isOpen ? 'px-4 py-3' : 'h-10'}`}
          title="Logout"
        >
          <LogOut size={18} />
          {isOpen && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

