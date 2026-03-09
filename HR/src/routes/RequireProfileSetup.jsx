import React from "react";
import { Navigate, useLocation } from "react-router-dom";

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
  const session = readSession();

  console.log(`[RequireProfileSetup] Path: ${location.pathname}, Session: ${session ? "Exists" : "MISSING"}`);
  if (session) {
    console.debug("[RequireProfileSetup] Session Data:", session);
  }

  // no login
  if (!session) {
    console.warn("[RequireProfileSetup] No session found, redirecting to login...");
    return <Navigate to="/login" replace />;
  }

  const role = session.role || session.loginRole || "employee";
  const idLower = String(session.employee_id || session.employeeId || session.identifier || session.id || "").toLowerCase();
  const mailLower = String(session.email || session.officialEmail || "").toLowerCase();
  const designLower = String(session.designation || "").toLowerCase();

  const isFounderMatch =
    mailLower.startsWith("founder") ||
    idLower.includes("founder") ||
    mailLower.includes("founder") ||
    designLower.includes("founder") ||
    designLower.includes("boss") ||
    idLower.startsWith("fnd") ||
    idLower.startsWith("f0") ||
    idLower === "founder";

  const isManagerMatch = !isFounderMatch && designLower.includes("manager");
  const isHRMatch = !isFounderMatch && !isManagerMatch && (designLower.includes("hr") || designLower.includes("admin") || role === "hr" || role === "admin");

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

  // Profile completion check disabled as per user request
  /*
  const done = (localStorage.getItem(COMPLETION_KEY(role)) === "true") || isFounderMatch || isManagerMatch || isHRMatch;

  if (!done) {
    const empId =
      role === "employee" || role === "admin"
        ? (session.employee_id || session.identifier || session.id || "").trim()
        : "";

    console.warn(`[RequireProfileSetup] Redirecting to /sign-in. Role: ${role}, Done: ${done}, Path: ${location.pathname}`);

    return (
      <Navigate
        to="/sign-in"
        replace
        state={{
          role,
          redirectTo: location.pathname,
          empId,
        }}
      />
    );
  }
  */

  return children;
}


