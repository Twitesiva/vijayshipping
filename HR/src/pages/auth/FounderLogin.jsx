import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    Mail,
    Lock,
    Eye,
    EyeOff,
    AlertTriangle,
    ShieldCheck
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { MANAGER_SESSION_KEY } from "../manager/managerData";

export default function FounderLogin() {

    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    const emailRef = useRef(null);
    const passRef = useRef(null);

    useEffect(() => {
        emailRef.current?.focus();
    }, []);

    const rpcManagerLogin = async ({ p_email, p_password }) => {
        if (!isSupabaseConfigured) {
            throw new Error("Supabase configuration missing.");
        }
        const { data, error } = await supabase.rpc("manager_login_js", {
            p_email,
            p_password,
        });
        if (error) throw new Error(error.message || "Login failed");
        return data;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErr("");
        const email = emailRef.current?.value?.trim() || "";
        const password = passRef.current?.value?.trim() || "";

        if (!email || !password) {
            setErr("Enter email and password");
            return;
        }

        try {
            setLoading(true);
            const m = await rpcManagerLogin({ p_email: email, p_password: password });

            if (!m) throw new Error("Invalid credentials");

            const access = String(m.access || m.role || "viewer").toLowerCase();
            const managerData = {
                id: m.manager_code || m.id || "MGR",
                name: m.full_name || "Founder",
                email: m.email,
                role: "founder",
                access,
                team: m.team || "Team",
                designation: m.designation || "Founder",
                // Route to correct founder dashboard
                route: "/founder-dashboard"
            };

            localStorage.setItem(MANAGER_SESSION_KEY, JSON.stringify(managerData));

            localStorage.setItem("HRMSS_AUTH_SESSION", JSON.stringify({ ...managerData, loginRole: "founder" }));
            localStorage.setItem("hrmss.signin.completed.founder", "true");
            localStorage.setItem("hrmss.signin.completed.manager", "true");
            // Also set hr completion key so manager can access HR dashboard
            localStorage.setItem("hrmss.signin.completed.hr", "true");

            navigate(managerData.route, { replace: true });
        } catch (ex) {
            setErr(ex.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen w-screen flex items-center justify-center relative font-sans overflow-hidden bg-[#0f172a]">
            {/* Premium Background with Gradient and Blur */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1920&q=80')] bg-cover bg-center opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-br from-[#1e293b]/80 via-[#0f172a]/90 to-black/95" />

            {/* Animated Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full animate-pulse" />

            <div className="relative z-10 w-full max-w-md p-4">
                <div className="bg-white/5 backdrop-blur-2xl rounded-[40px] border border-white/10 shadow-2xl p-8 md:p-10 flex flex-col items-center">

                    <div className="mb-10 flex flex-col items-center">
                        <div className="p-4 bg-white/10 rounded-[28px] border border-white/20 shadow-2xl backdrop-blur-sm mb-4">
                            <img src="/VijayShipping_Logo.png" alt="Vijay Shipping" className="h-16 w-auto brightness-0 invert" />
                        </div>
                        <div className="h-px w-12 bg-white/20 mb-4" />
                        <h1 className="text-white text-sm font-bold tracking-[0.3em] uppercase opacity-60">
                            Founder Portal
                        </h1>
                    </div>

                    {err && (
                        <div className="w-full mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs flex gap-3 animate-in fade-in slide-in-from-top-2">
                            <AlertTriangle size={16} className="shrink-0" />
                            <span>{err}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="w-full space-y-5">
                        <div className="space-y-4">
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-white transition-colors">
                                    <Mail size={18} />
                                </span>
                                <input
                                    ref={emailRef}
                                    type="email"
                                    placeholder="Founder Email"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-sm outline-none focus:border-white/30 focus:bg-white/10 transition-all placeholder:text-gray-600"
                                />
                            </div>

                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-white transition-colors">
                                    <Lock size={18} />
                                </span>
                                <input
                                    ref={passRef}
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Secret Key"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white text-sm outline-none focus:border-white/30 focus:bg-white/10 transition-all placeholder:text-gray-600"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 active:scale-[0.98] transition-all shadow-xl shadow-white/5 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                    <span>Authenticating...</span>
                                </>
                            ) : (
                                "Enter Dashboard"
                            )}
                        </button>
                    </form>

                    <button
                        onClick={() => navigate("/login")}
                        className="mt-8 text-gray-500 text-xs font-semibold hover:text-white transition-colors uppercase tracking-widest"
                    >
                        ← Back to Portal
                    </button>
                </div>
            </div>
        </div>
    );
}


