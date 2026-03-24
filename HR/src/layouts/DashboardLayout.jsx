import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import Navbar from "../components/Navbar.jsx";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("hrmss.signin.completed.admin") !== "true") {
      navigate("/sign-in", { state: { role: "admin" } });
    }
  }, [navigate]);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Body scroll lock when mobile drawer open
  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileOpen]);

  const handleToggle = () => {
    if (window.innerWidth < 768) {
      setIsMobileOpen(v => !v);
    } else {
      setIsSidebarOpen(v => !v);
    }
  };

  return (
    <div className="flex min-h-[100dvh] bg-gray-100">
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      <Sidebar isOpen={isSidebarOpen} isMobileOpen={isMobileOpen} />
      <div className="flex flex-1 flex-col min-h-0 w-full">
        <Navbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={handleToggle}
        />
        <main className="p-4 md:p-6 flex-1 overflow-y-auto pb-safe">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;


