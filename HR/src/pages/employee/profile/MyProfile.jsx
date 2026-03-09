import { useEffect, useState } from "react";
import { Badge, SectionCard } from "../shared/ui.jsx";
import {
  IdCard,
  Briefcase,
  Mail,
  User,
  CalendarDays,
  Lock,
  Hash
} from "lucide-react";

import { supabase, isSupabaseConfigured } from "../../../lib/supabaseClient";

const AUTH_KEY = "HRMSS_AUTH_SESSION";
const PROFILE_CACHE_KEY = (role, key) =>
  `hrmss.profile.cache.${role}.${key || "unknown"}`;

function safeJsonParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readEmployeeIdFromAuth() {
  const raw = localStorage.getItem(AUTH_KEY);
  const s = safeJsonParse(raw);
  const empId = (s?.employee_id || s?.identifier || s?.id || "").trim();
  return empId || "";
}

const Detail = ({ label, value, icon: Icon }) => (
  <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all hover:border-slate-200 hover:bg-white hover:shadow-sm group">
    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
      {Icon && <Icon size={12} className="text-slate-300 group-hover:text-[#598791] transition-colors" />}
      {label}
    </div>
    <div className="text-sm font-bold text-slate-700 truncate">
      {value || "-"}
    </div>
  </div>
);

export default function MyProfile() {
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [profile, setProfile] = useState(() => {
    const raw = localStorage.getItem("HRMSS_AUTH_SESSION");
    const s = raw ? JSON.parse(raw) : null;
    return {
      full_name: s?.full_name || s?.fullName || s?.name || "Employee",
      employee_id: s?.employee_id || s?.id || s?.userId || ""
    };
  });

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        const empId = readEmployeeIdFromAuth();
        if (!empId) {
          if (mounted) setLoadErr("Session expired. Please login again.");
          return;
        }

        let { data, error } = await supabase
          .from("employees")
          .select("employee_id, full_name, email, designation, join_date")
          .eq("employee_id", empId)
          .maybeSingle();

        // Fallback to detailed profile if not in basic employees
        if (!data && !error) {
          const { data: pData } = await supabase
            .from("hrms_employee_profile")
            .select("employee_id, full_name, designation, official_email, personal_email")
            .eq("employee_id", empId)
            .maybeSingle();

          if (pData) {
            data = {
              ...pData,
              email: pData.official_email || pData.personal_email || ""
            };
          }
        }

        // Map internal names for UI consistency if needed
        if (data) {
          data.full_name = data.full_name || data.name || profile.full_name;
          data.official_email = data.email || data.official_email;
          data.joining_date = data.join_date;
        }

        if (error) throw error;

        if (mounted) {
          if (data) {
            setProfile(data);
          } else {
            // If data is null, we keep the session fallback but log a warning
            console.warn("Profile not found in DB for employee:", empId);
          }
        }
      } catch (e) {
        console.error(e);
        if (mounted) setLoadErr(e?.message || "Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-[#598791]/20 border-t-[#598791] rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading Records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white rounded-[32px] border border-slate-100 p-12 shadow-sm flex flex-col items-center text-center gap-6">
        <div className="h-24 w-24 rounded-full bg-gradient-to-br from-[#598791] to-[#2d2430] flex items-center justify-center text-white text-3xl font-black shadow-lg">
          {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "E"}
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight text-center">
            Hi, <span className="text-[#598791]">{profile?.full_name || "User"}</span>
          </h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] text-center">
            WELCOME TO YOUR PROFILE
          </p>
        </div>

        <div className="h-1 w-24 bg-slate-100 rounded-full" />

        <img src="/VijayShipping_Logo.png" alt="Vijay Shipping" className="h-8 w-auto object-contain" />
      </div>
    </div>
  );
}
