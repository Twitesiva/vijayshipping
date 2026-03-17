// src/pages/auth/Login.jsx
import { useRef, useState, useEffect, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  User,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Clock,
} from "lucide-react";

import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { MANAGER_SESSION_KEY } from "../manager/managerData";

import Preloader from "../../components/Preloader";

const Field = forwardRef(
  (
    { icon: Icon, type = "text", placeholder, right, autoComplete, required },
    ref
  ) => {
    return (
      <div className="flex items-center gap-3 border-b border-gray-300 pb-2 focus-within:border-[#598791] transition">
        <span className="text-[#598791] pointer-events-none">
          <Icon size={18} />
        </span>

        <input
          ref={ref}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className="flex-1 min-w-0 w-full bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-400"
        />

        {right}
      </div>
    );
  }
);
Field.displayName = "Field";



/* ---------------- Login ---------------- */
export default function Login() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Unified refs for auto-detection login
  const emailRef = useRef(null);
  const passRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => {
      emailRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const clearInputs = () => {
    setErr("");
    if (emailRef.current) emailRef.current.value = "";
    if (passRef.current) passRef.current.value = "";
  };

  const roleRedirects = {
    hr: "/hr-dashboard",
    manager: "/manager-dashboard",
    admin: "/dashboard",
    employee: "/employee-dashboard",
    founder: "/founder-dashboard",
  };

  const MANAGER_COMPLETION_KEY = "hrmss.signin.completed.manager";

  // ✅ completion keys for all roles (used by Sign-In + Guard)
  const COMPLETION_KEY = (r) => `hrmss.signin.completed.${r}`;
  const isCompleted = (r) => localStorage.getItem(COMPLETION_KEY(r)) === "true";

  // ✅ Shared helper to prefer verify_login_json for all roles
  const tryVerifyLoginJson = async (params) => {
    try {
      const session = await rpcVerifyApp(params);
      return session || null;
    } catch (err) {
      console.warn(
        `[Login] verify_login_json failed for role ${params?.p_role}:`,
        err?.message
      );
      return null;
    }
  };



  /* ---------------- RPC HELPERS ---------------- */

  // ✅ HR/Admin login RPC (JSON)
  const rpcVerifyApp = async ({
    p_role,
    p_identifier,
    p_admin_id = null,
    p_secret,
  }) => {
    if (!isSupabaseConfigured) {
      throw new Error(
        "Supabase env missing. Check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY"
      );
    }

    const { data, error } = await supabase.rpc("verify_login_json", {
      p_role,
      p_identifier,
      p_admin_id,
      p_secret,
    });

    if (error) throw new Error(error.message || "Login failed");
    if (!data) throw new Error("Invalid credentials");


    // ✅ Don't expose internal errors like "role mismatch" - show generic message
    if (data.error) {
      console.error("Login error (internal):", data.error); // Log for debugging
      throw new Error("Invalid credentials or access denied");
    }

    return data;
  };

  const rpcManagerLogin = async ({ p_email, p_password }) => {
    if (!isSupabaseConfigured) {
      throw new Error(
        "Supabase env missing. Check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY"
      );
    }

    // 1. Try normal login
    const { data, error } = await supabase.rpc("manager_login_js", {
      p_email,
      p_password,
    });

    if (error) throw new Error(error.message || "Founder login failed");

    // 2. If valid data, return it
    if (data) return data;

    // 3. If login failed, run debug helper for console tracing only
    try {
      const { data: debugMsg, error: debugErr } = await supabase.rpc(
        "debug_login_check",
        {
          p_email,
          p_password,
          p_role: "manager",
        }
      );

      if (debugErr) {
        console.error("Debug tool error:", debugErr);
      } else if (debugMsg) {
        console.debug("Manager login debug info:", debugMsg);
      }
    } catch (e) {
      console.error("Debug execution failed:", e);
    }

    throw new Error("Invalid email or password");
  };

  // ✅ Check HR/Admin/Manager profile exists in employees table
  const appProfileExists = async (userId, email) => {
    const uid = String(userId || "").trim();
    const mail = String(email || "").trim();
    if (!uid && !mail) return false;

    // Use or() to check both id and employee_id/email to handle different table schemas
    // This avoids 400 error code if 'id' is a UUID and we pass a string code.
    let query = supabase.from("employees").select("id");

    if (uid && uid.length > 20) {
      // Looks like a UUID
      query = query.eq("id", uid);
    } else if (uid) {
      // Check both employee_id and username
      query = query.or(`employee_id.eq.${uid},username.eq.${uid}`);
    } else {
      query = query.eq("email", mail);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.warn("Profile check failed (non-critical):", error.message);
      return false;
    }
    return !!data;
  };

  // ✅ Check Employee profile completion in hrms_employee_profile
  // Removed hrms_employee_profile check - using RPC profile_completed
  const employeeProfileCompleted = async (employeeId, email) => {
    // Check employees table for profile_status or similar
    if (!employeeId && !email) return false;
    
    try {
      const id = String(employeeId || "").trim();
      const mail = String(email || "").trim();
      
      let query = supabase.from("employees").select("profile_completed,status");
      
      if (id) {
        query = query.eq("employee_id", id);
      } else if (mail) {
        query = query.eq("email", mail);
      }
      
      const { data, error } = await query.maybeSingle();
      
      if (error) {
        console.warn("Profile check failed:", error.message);
        return false;
      }
      
      return data?.profile_completed === true || data?.status === 'active';
    } catch {
      return false;
    }
  };

  // ✅ Fetch designation from the 'employees' table (robust lookup)
  const fetchUserDesignation = async (idOrCode) => {
    if (!idOrCode) return "";
    try {
      const code = String(idOrCode).trim();

      // 1. Try employees table by employee_id or username
      const { data: empData } = await supabase
        .from("employees")
        .select("designation")
        .or(`employee_id.eq.${code},username.eq.${code}`)
        .maybeSingle();

      if (empData?.designation) return empData.designation;

      // 2. If length > 20, it's likely a UUID, try employees table by id
      if (code.length > 20) {
        const { data: empDataUuid } = await supabase
          .from("employees")
          .select("designation")
          .eq("id", code)
          .maybeSingle();
        if (empDataUuid?.designation) return empDataUuid.designation;
      }

      return "";
    } catch (e) {
      console.warn("[Login] fetchUserDesignation non-critical error:", e.message);
      return "";
    }
  };

  /* ---------------- SUBMIT (LOGIN) ---------------- */
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

      // ---- Helper: Call verify_login_json / manager_login_js via RPC ----
      const tryRpcLogin = async () => {
        const { data, error } = await supabase.rpc("verify_login_json", {
          p_role: null,
          p_identifier: email,
          p_admin_id: null,
          p_secret: password,
        });
        if (error) throw new Error(error.message || "Login failed");
        if (!data || data.error) throw new Error(data?.error || "Invalid credentials");
        return data;
      };

      // Call login once and route based on designation
      const session = await tryRpcLogin();

      const empId = session.employee_id;
      const fullName = session.full_name || "";
      
      // Fetch designation from employees table
      let designation = "";
      try {
        const { data: empData, error: empError } = await supabase
          .from("employees")
          .select("designation")
          .eq("employee_id", empId)
          .maybeSingle();
        
        if (empError) {
          console.warn("[Login] Error fetching designation:", empError.message);
        }
        
        if (empData?.designation) {
          designation = empData.designation;
          console.log("[Login] Got designation from employees table:", designation);
        }
      } catch (e) {
        console.warn("[Login] Failed to fetch designation from employees table:", e.message);
      }
      
      // Fallback to session designation if not found in employees table
      if (!designation && session.designation) {
        designation = session.designation;
      }
      
      // Ensure it's a string and handle null/undefined
      if (designation === null || designation === undefined) {
        designation = "";
      }
      designation = String(designation).toLowerCase().trim();

      console.log("[Login] Employee ID:", empId, "Designation:", designation);

      // ---- Determine Role from Designation ----
      // Priority order: Employee -> Founder -> HR -> Manager -> Default Employee
      // Use simple includes() for flexibility
      
      let targetRole = "employee";
      let targetPath = "/employee-dashboard";
      
      // Check for Employee first (most common - exclude this from other roles)
      const isEmployeeRole = 
        designation === "employee" || 
        designation.includes("employee");
      
      // Check for Founder
      const isFounder = 
        designation.includes("founder") || 
        designation.includes("boss") ||
        designation.includes("ceo") ||
        designation.includes("owner");
      
      // Check for HR
      const isHR = 
        designation.includes("hr") ||
        designation.includes("human resource") ||
        designation.includes("admin");
      
      // Check for Manager — also use session.role from RPC as fallback
      // This handles cases where designation is empty but RPC returns role="manager"
      const sessionRoleLower = String(session.role || session.loginRole || "").toLowerCase();
      const isManager =
        designation.includes("manager") ||
        sessionRoleLower === "manager" ||
        sessionRoleLower.includes("manager");

      // Assign target role based on detected role
      if (isEmployeeRole && !isFounder) {
        // Employee but NOT founder - make sure "employee manager" goes to employee
        targetRole = "employee";
        targetPath = "/employee-dashboard";
      } else if (isFounder) {
        targetRole = "founder";
        targetPath = "/founder-dashboard";
      } else if (isHR && !isEmployeeRole) {
        targetRole = "hr";
        targetPath = "/hr-dashboard";
      } else if (isManager && !isEmployeeRole) {
        targetRole = "manager";
        targetPath = "/manager-dashboard";
      } else {
        // Default to employee if no match found
        targetRole = "employee";
        targetPath = "/employee-dashboard";
      }

      console.log("[Login] Target Role:", targetRole, "Target Path:", targetPath);

      // ---- Build Session Payload ----
      const sessionPayload = {
        employee_id: empId,
        id: empId,
        full_name: fullName,
        name: fullName,
        email: email,
        designation: designation,
        role: targetRole,
        loginRole: targetRole,
        access: targetRole,
      };

      localStorage.setItem("HRMSS_AUTH_SESSION", JSON.stringify(sessionPayload));

      // For manager/founder: also set MANAGER_SESSION_KEY
      if (isFounder || isManager) {
        localStorage.setItem(MANAGER_SESSION_KEY, JSON.stringify(sessionPayload));
        localStorage.setItem("hrmss.signin.completed.manager", "true");
      }
      if (isFounder) {
        localStorage.setItem("hrmss.signin.completed.founder", "true");
      }
      localStorage.setItem("hrmss.signin.completed." + targetRole, "true");

      // Supabase Auth Bridge removed - login works via employees table RPC
      // Document storage features will use sessionStorage/localStorage directly

      navigate(targetPath, { replace: true });
      return;

    } catch (ex) {
      const msg = typeof ex?.message === "string" && ex.message.toLowerCase().includes("invalid")
        ? "Invalid email or password"
        : ex?.message || "Login failed";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  const rightImageUrl =
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1400&q=60";

  return (
    <div className="h-screen w-screen flex items-center justify-center relative font-sans overflow-hidden">
      {/* Dynamic Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000"
        style={{ backgroundImage: `url(background.png)` }}
      />
      {/* Dark Overlay for Depth and Contrast */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Main Glass Container */}
      <div className="relative z-10 w-full max-w-6xl h-full max-h-[min(750px,95vh)] bg-white/10 rounded-[30px] md:rounded-[40px] border border-white/20 shadow-2xl flex flex-col md:flex-row items-center overflow-hidden p-4 md:p-8 gap-6 md:gap-10">

        {/* LEFT AREA: Title and Cards Section */}
        <div className="w-full flex flex-col gap-8 items-center justify-center">

          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-black text-white leading-tight tracking-tight uppercase drop-shadow-xl">
              ATTENDANCE MANAGEMENT SYSTEM
            </h2>
          </div>

          <div className="w-full flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-stretch justify-center">
            {/* 1. Login Card */}
            <div className="w-full max-w-[380px] flex flex-col gap-4 items-center">
              <div className="w-full bg-white rounded-[24px] md:rounded-[32px] shadow-2xl p-6 md:p-8 flex flex-col items-center overflow-y-auto max-h-full">
                <div className="w-full">
                  <div className="flex justify-center mb-1">
                    <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
                      <img src="/VijayShipping_Logo.png" alt="Vijay Shipping" className="h-12 w-auto" />
                    </div>
                  </div>

                  {err && (
                    <div className="mt-3 rounded-xl border border-red-100 bg-red-50 text-red-700 px-3 py-2 text-[11px] md:text-xs flex gap-2">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <div className="min-w-0">{err}</div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="mt-6 space-y-6 w-full">
                    <div className="space-y-4">
                      <Field
                        ref={emailRef}
                        icon={User}
                        type="text"
                        placeholder="Username"
                        autoComplete="username"
                        required
                      />
                      <Field
                        ref={passRef}
                        icon={Lock}
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        autoComplete="current-password"
                        required
                        right={
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setShowPassword(s => !s);
                              setTimeout(() => passRef.current?.focus(), 0);
                            }}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        }
                      />
                    </div>

                    <div className="flex justify-end">
                      {/* <button type="button" className="text-[10px] md:text-xs text-[#598791] font-semibold hover:underline">Forgot Password?</button> */}
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className={`w-full py-4 rounded-xl text-white font-bold transition-all shadow-lg active:scale-95 ${loading ? "bg-[#8e7091] cursor-not-allowed" : "bg-[#598791] hover:bg-[#75b0bd] hover:shadow-[#598791]/30"}`}
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Signing in...</span>
                        </div>
                      ) : "Sign In"}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* 2. Attendance Quick Access Card */}
            <div className="w-full max-w-[380px] md:max-w-[280px] flex flex-col gap-4 items-center">
              <div className="w-full h-full bg-white/10 backdrop-blur-md rounded-[24px] md:rounded-[32px] border border-white/20 shadow-2xl p-6 md:p-8 flex flex-col items-center justify-center text-center">
                <div className="mb-6 p-4 bg-white/20 rounded-full floating-animation">
                  <Clock className="text-white" size={32} />
                </div>
                <h3 className="text-white text-xl font-bold mb-2">Quick Attendance</h3>
                <p className="text-white/80 text-sm mb-8">Mark your daily attendance instantly</p>

                <button
                  onClick={() => navigate("/quick-attendance")}
                  className="w-full py-4 rounded-xl bg-white text-[#598791] font-bold transition-all shadow-xl hover:bg-gray-100 active:scale-95 flex items-center justify-center gap-2"
                >
                  Attendance
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Illustration Content */}
        <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center p-4 relative overflow-hidden group">
          {/* Heavily Blurred Background Image */}
          <div
            className="absolute inset-x-0 inset-y-0 bg-center bg-cover bg-no-repeat blur-[60px] opacity-40 transition-transform duration-700 group-hover:scale-110"
            style={{ backgroundImage: `url(hr_login_bg.png)` }}
          />

          {/* Floating Branding Image in side panel */}
          <div className="relative z-10 w-full h-full flex items-center justify-center">
            <div className="w-4/5 h-4/5 rounded-3xl overflow-hidden shadow-2xl border border-white/20 floating-animation">
              <img
                src="hr_login_bg.png"
                alt="HR Branding"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(1deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        .floating-animation {
          animation: float 10s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

