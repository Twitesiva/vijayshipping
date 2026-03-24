import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, UserRound, Menu, ClipboardList, FileBarChart } from "lucide-react";

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

export default function FounderLayout() {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
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

    useEffect(() => {
        const idLower = String(localStorage.getItem("HRMSS_AUTH_SESSION") || "").toLowerCase();
        const isManagementMatch =
            normalizedDesignation.includes("manager") ||
            normalizedDesignation.includes("founder") ||
            normalizedDesignation.includes("boss") ||
            normalizedDesignation.includes("hr") ||
            normalizedDesignation.includes("admin") ||
            loginRole === "founder" ||
            loginRole === "manager" ||
            loginRole === "hr" ||
            idLower.includes("founder") ||
            idLower.startsWith("fnd");

        // Only redirect if they are strictly an employee AND don't look like management/founder
        if ((normalizedDesignation === "employee" || loginRole === "employee") && !isManagementMatch) {
            navigate("/employee-dashboard");
        }
    }, [normalizedDesignation, loginRole, navigate]);

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
        try {
            sessionStorage.removeItem(DOCS_AUTH_KEY);
        } catch { }
        localStorage.removeItem(DOCS_AUTH_KEY);
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
            {/* SIDEBAR */}
            <aside
                className={`bg-white border-r min-h-[100dvh] fixed md:sticky inset-y-0 left-0 top-0 z-50 transition-all duration-300 ease-in-out
                    ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                    w-[280px] ${isSidebarOpen ? 'md:w-[280px]' : 'md:w-[72px]'}`}
            >
                <div className="h-full flex flex-col overflow-hidden">
                    {/* Brand */}
                    <div className={`p-5 border-b flex items-center gap-3 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
                        {isSidebarOpen ? (
                            <div className="flex flex-col items-start min-w-0">
                                <img src="/VijayShipping_Logo.png" alt="Vijay Shipping" className="h-16 w-auto max-w-full object-contain mb-1" />
                                <span className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase opacity-60">Founder Portal</span>
                            </div>
                        ) : (
                            <div className="w-12 h-12 rounded-lg bg-white border border-gray-100 flex items-center justify-center p-1.5 shadow-sm overflow-hidden">
                                <img src="/VijayShipping_Logo.png" alt="V" className="w-full h-auto object-contain" />
                            </div>
                        )}
                    </div>

                    {/* Nav */}
                    <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto overflow-x-hidden">
                        <SideItem
                            to="/founder-dashboard"
                            end
                            icon={LayoutDashboard}
                            label="Dashboard"
                            isCollapsed={!isSidebarOpen}
                        />

                        <SideItem
                            to="/founder-dashboard/reports"
                            icon={FileBarChart}
                            label="Reports"
                            isCollapsed={!isSidebarOpen}
                        />
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
            <main className="flex-1 min-w-0 flex flex-col">
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
                            >
                                <Menu size={18} />
                            </button>
                            <div className="text-xs md:text-sm text-gray-500 font-bold uppercase tracking-wider hidden sm:block">
                                Founder Dashboard
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <NavLink
                                to="/founder-dashboard/profile"
                                className={({ isActive }) =>
                                    `inline-flex items-center gap-2 rounded-xl px-2 md:px-3 py-2 text-xs md:text-sm font-semibold transition ${isActive
                                        ? "bg-[#598791] text-white shadow"
                                        : "text-gray-700 hover:bg-[#e6ffff] hover:text-[#009999]"
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
