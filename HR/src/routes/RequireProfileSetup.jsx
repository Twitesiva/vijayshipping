import React, { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const AUTH_KEY = "HRMSS_AUTH_SESSION";
const COMPLETION_KEY = (role) => `hrmss.signin.completed.${role}`;

function readSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function RequireProfileSetup({ children }) {
  const location = useLocation();
  const session = React.useMemo(() => readSession(), []);
  const [designation, setDesignation] = useState("");

  console.log(`[RequireProfileSetup] Path: ${location.pathname}, Session: ${session ? "Exists" : "MISSING"}`);
  if (session) {
    console.debug("[RequireProfileSetup] Session Data:", session);
  }

  // no login
  if (!session) {
    console.warn("[RequireProfileSetup] No session found, redirecting to login...");
    return <Navigate to="/login" replace />;
  }

  // Fetch designation from employees table on mount
  useEffect(() => {
    async function fetchDesignation() {
      const storedDesignation = session?.designation || "";
      
      // If no designation in session, try to fetch from employees table
      if (!storedDesignation && session.employee_id) {
        console.log("[RequireProfileSetup] No designation in session, fetching from employees table...");
        try {
          const { data, error } = await supabase
            .from("employees")
            .select("designation")
            .eq("employee_id", session.employee_id)
            .maybeSingle();
          
          if (!error && data?.designation) {
            console.log("[RequireProfileSetup] Fetched designation from employees table:", data.designation);
            setDesignation(data.designation);
            
            // Update session with fetched designation
            try {
              const updatedSession = { ...session, designation: data.designation };
              localStorage.setItem(AUTH_KEY, JSON.stringify(updatedSession));
            } catch (e) {
              console.warn("[RequireProfileSetup] Failed to update session:", e.message);
            }
            return;
          }
        } catch (e) {
          console.warn("[RequireProfileSetup] Failed to fetch designation:", e.message);
        }
      }
      
      setDesignation(storedDesignation);
    }
    
    fetchDesignation();
  }, [session]);

  const role = session.role || session.loginRole || "employee";
  const idLower = String(session.employee_id || session.employeeId || session.identifier || session.id || "").toLowerCase();
  const mailLower = String(session.email || session.officialEmail || "").toLowerCase();
  
  // Use fetched designation or fallback to session designation
  const designLower = designation ? designation.toLowerCase() : String(session.designation || "").toLowerCase();

  // Fixed role detection with simpler includes() for flexibility
  // Priority: Employee -> Founder -> HR -> Manager
  
  // Check for Employee first (most common)
  const isEmployeeRole = 
    designLower === "employee" ||
    designLower.includes("employee");
  
  // Check for Founder
  const founderKeywords = ["founder", "boss", "ceo", "owner", "proprietor"];
  const isFounderMatch = !isEmployeeRole && (
    mailLower.startsWith("founder") ||
    idLower.includes("founder") ||
    mailLower.includes("founder") ||
    designLower.includes("founder") ||
    designLower.includes("boss") ||
    idLower.startsWith("fnd") ||
    idLower.startsWith("f0") ||
    idLower === "founder" ||
    founderKeywords.some(kw => designLower.includes(kw))
  );

  // Check for Manager (only if not founder and not employee)
  const isManagerMatch = !isEmployeeRole && !isFounderMatch && (
    designLower.includes("manager")
  );

  // Check for HR (hr, human resource, admin)
  const isHRMatch = !isEmployeeRole && !isFounderMatch && !isManagerMatch && (
    designLower.includes("hr") ||
    designLower.includes("human resource") ||
    designLower.includes("admin") ||
    role === "hr" ||
    role === "admin"
  );

  const isOnFounderDash = location.pathname.startsWith("/founder-dashboard");
  const isOnManagerDash = location.pathname.startsWith("/manager-dashboard");
  const isOnHrDash = location.pathname.startsWith("/hr-dashboard");
  const isOnEmployeeDash = location.pathname.startsWith("/employee-dashboard");

  // HEALING LOGIC: Redirect to correct dashboard if misdirected
  if (isFounderMatch && !isOnFounderDash) {
    console.warn("[RequireProfileSetup] Redirecting to founder-dashboard");
    return <Navigate to="/founder-dashboard" replace />;
  }
  if (isManagerMatch && !isOnManagerDash) {
    console.warn("[RequireProfileSetup] Redirecting to manager-dashboard");
    return <Navigate to="/manager-dashboard" replace />;
  }
  if (isHRMatch && !isOnHrDash) {
    console.warn("[RequireProfileSetup] Redirecting to hr-dashboard");
    return <Navigate to="/hr-dashboard" replace />;
  }
  // If no match but on management dashboard, and role is employee
  if (!isFounderMatch && !isManagerMatch && !isHRMatch && !isOnEmployeeDash && role === "employee") {
    console.warn("[RequireProfileSetup] Regular employee on management dashboard, redirecting to employee-dashboard");
    return <Navigate to="/employee-dashboard" replace />;
  }

  return children;
}

