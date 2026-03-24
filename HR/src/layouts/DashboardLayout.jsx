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
      {/* Mobile backdrop overlay - appears when sidebar is open on mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      
      {/* Fixed Sidebar - always fixed, slides in/out on mobile */}
      <Sidebar isOpen={isSidebarOpen} isMobileOpen={isMobileOpen} />
      
      {/* Main content - has left margin on desktop to account for fixed sidebar */}
      <div className="flex flex-col flex-1 min-h-0 w-full md:ml-[280px]">
        <Navbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={handleToggle}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-safe">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
