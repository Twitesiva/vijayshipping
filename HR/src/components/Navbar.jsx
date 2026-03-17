
import { NavLink } from "react-router-dom";
import { Menu, UserRound } from "lucide-react";

const linkClasses = ({ isActive }) =>
  `inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition ${isActive
    ? "bg-[#598791] text-white shadow"
    : "text-gray-700 hover:bg-[#f8f1f1] hover:text-[#598791]"
  }`;

const Navbar = ({ isSidebarOpen = true, onToggleSidebar }) => {
  return (
    <header className="h-14 bg-white border-b flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-gray-700 shadow-sm hover:bg-gray-50"
          aria-label={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
          title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          <Menu size={18} />
        </button>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <NavLink to="/dashboard/profile" className={linkClasses}>
          <UserRound size={16} />
          My Profile
        </NavLink>
      </div>
    </header>
  );
};

export default Navbar;

