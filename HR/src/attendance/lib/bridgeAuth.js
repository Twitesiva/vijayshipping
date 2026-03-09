import { API_BASE } from "./api";
import { clearToken, getToken, getUser, setToken, setUser } from "./storage";

const ATTENDANCE_AUTH_KEY = "HRMSS_ATTENDANCE_AUTH";
const AUTH_SESSION_KEY = "HRMSS_AUTH_SESSION";
const BRIDGE_RETRY_AFTER_KEY = "HRMSS_ATTENDANCE_BRIDGE_RETRY_AFTER";
let BRIDGE_INFLIGHT = null;

const parseJson = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const readAttendanceAuth = () =>
  parseJson(sessionStorage.getItem(ATTENDANCE_AUTH_KEY)) ||
  parseJson(localStorage.getItem(ATTENDANCE_AUTH_KEY));

const readAppSession = () => parseJson(localStorage.getItem(AUTH_SESSION_KEY));

const candidateUsernames = (creds, appSession) => {
  const direct = [
    creds?.username,
    creds?.employeeId,
    creds?.identifier,
    appSession?.id,
    appSession?.user_id,
    appSession?.userId,
    appSession?.username,
    appSession?.employee_id,
    appSession?.identifier,
    appSession?.email,
  ];
  const emailLocalParts = direct
    .filter((value) => typeof value === "string" && value.includes("@"))
    .map((value) => value.split("@")[0]);
  return [...new Set([...direct, ...emailLocalParts].filter(Boolean))];
};

const verifyToken = async (token) => {
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const me = await res.json();
    setUser(me);
    return me;
  } catch {
    return null;
  }
};

const isHrAttendancePath = () => {
  try {
    const path = window?.location?.pathname || "";
    return path.includes("/hr-dashboard/attendance");
  } catch {
    return false;
  }
};

const isEmployeeAttendancePath = () => {
  try {
    const path = window?.location?.pathname || "";
    return path.includes("/employee-dashboard/attendance");
  } catch {
    return false;
  }
};

const canUseAdminEndpoints = (role) => {
  const r = String(role || "").toLowerCase();
  return ["admin", "boss", "hr", "manager"].includes(r);
};

export async function ensureAttendanceSession() {
  if (BRIDGE_INFLIGHT) return BRIDGE_INFLIGHT;
  BRIDGE_INFLIGHT = (async () => {
    const existing = getToken();
    const currentUser = getUser();

    // 2. Read the main app session (Direct from Supabase login)
    const appSession = readAppSession();
    if (!appSession) {
      // If no app session, we rely on existing attendance session or return false
      return !!existing && !!currentUser;
    }

    // 3. Sync the main session to the attendance system's local storage
    const normalizedUser = {
      id: appSession.user_id || appSession.id,
      username: appSession.username || appSession.identifier || appSession.email,
      role: String(appSession.loginRole || appSession.role || "employee").toLowerCase(),
      full_name: appSession.full_name || appSession.name,
      employee_id: appSession.employee_id || appSession.username || appSession.identifier || appSession.id,
    };

    // Always update to ensure we have the latest identifiers (e.g. string ID instead of UUID)
    setToken("direct-supabase-session");
    setUser(normalizedUser);

    return true;
  })();

  try {
    return await BRIDGE_INFLIGHT;
  } finally {
    BRIDGE_INFLIGHT = null;
  }
}


