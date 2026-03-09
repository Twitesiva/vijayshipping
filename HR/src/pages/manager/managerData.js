// src/pages/manager/managerData.js
export const MANAGER_SESSION_KEY = "HRMSS_MANAGER_DATA";

export const managerAccounts = [];
export const teamMembers = [];
export const leaveRequests = [];
export const payrollRecords = [];
export const payslipRecords = [];

export const buildDefaultSession = () => ({
    id: "",
    name: "",
    email: "",
    role: "manager",
    access: "viewer",
    team: "Team",
    route: "/manager-dashboard"
});

export const getManagerSession = () => {
    try {
        const session = localStorage.getItem(MANAGER_SESSION_KEY);
        return session ? JSON.parse(session) : null;
    } catch {
        return null;
    }
};
