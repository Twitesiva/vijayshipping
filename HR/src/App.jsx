import { Routes, Route, Navigate } from "react-router-dom";
import RequireProfileSetup from "./routes/RequireProfileSetup";
import GlobalLoader from "./components/GlobalLoader";

// Layouts
import EmployeeLayout from "./pages/employee/EmployeeLayout";
import HrLayout from "./pages/hr/HrLayout";
// Auth
import Login from "./pages/auth/Login";
import QuickAttendance from "./pages/auth/QuickAttendance";
import EmployeeSignIn from "./pages/employee/EmployeeSignIn";
import FounderLogin from "./pages/auth/FounderLogin";

// Founder
import FounderLayout from "./pages/founder/FounderLayout";
import FounderHome from "./pages/founder/FounderHome";
import FounderAttendanceReports from "./pages/founder/FounderAttendanceReports";

// Attendance Pages
import MyProfile from "./pages/employee/profile/MyProfile";
import EmployeeAttendanceDashboard from "./pages/employee/EmployeeAttendanceDashboard";
import EmployeeAttendanceMyAttendance from "./pages/employee/EmployeeAttendanceMyAttendance";
import MarkAttendancePage from "./pages/attendance/MarkAttendancePage";

// HR/Admin Pages
import HrHome from "./pages/hr/HrHome";
import Employees from "./pages/hr/Employees";
import Attendance from "./pages/hr/Attendance";
import AttendanceEmployees from "./pages/hr/AttendanceEmployees";
import FaceEnroll from "./pages/hr/FaceEnroll";
import AttendanceReports from "./pages/hr/AttendanceReports";
import HrProfile from "./pages/hr/HrProfile";

export default function App() {
  return (
    <>
      <GlobalLoader />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/founder-login" element={<FounderLogin />} />
        <Route path="/quick-attendance" element={<QuickAttendance />} />

        {/* Employee Sign In */}
        <Route path="/sign-in" element={<EmployeeSignIn />} />
        <Route path="/employee-signin" element={<EmployeeSignIn />} />

        {/* ================= HR / ADMIN ================= */}
        <Route
          path="/hr-dashboard"
          element={
            <RequireProfileSetup>
              <HrLayout />
            </RequireProfileSetup>
          }
        >
          <Route index element={<HrHome />} />
          <Route path="employees" element={<Employees />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="attendance/employees" element={<AttendanceEmployees />} />
          <Route path="attendance/my-attendance" element={<EmployeeAttendanceMyAttendance />} />
          <Route path="attendance/reports" element={<AttendanceReports />} />
          <Route path="face-enroll" element={<FaceEnroll />} />
          <Route path="mark-attendance" element={<MarkAttendancePage />} />
          <Route path="profile" element={<HrProfile />} />
        </Route>

        {/* ================= MANAGER ================= */}
        <Route
          path="/manager-dashboard"
          element={
            <RequireProfileSetup>
              <HrLayout />
            </RequireProfileSetup>
          }
        >
          <Route index element={<Attendance />} />
          <Route path="employees" element={<Employees />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="attendance/employees" element={<AttendanceEmployees />} />
          <Route path="attendance/my-attendance" element={<EmployeeAttendanceMyAttendance />} />
          <Route path="attendance/reports" element={<AttendanceReports />} />
          <Route path="face-enroll" element={<FaceEnroll />} />
          <Route path="mark-attendance" element={<MarkAttendancePage />} />
          <Route path="profile" element={<HrProfile />} />
        </Route>

        {/* ================= FOUNDER (DEDICATED) ================= */}
        <Route
          path="/founder-dashboard"
          element={
            <RequireProfileSetup>
              <FounderLayout />
            </RequireProfileSetup>
          }
        >
          <Route index element={<FounderHome />} />
          <Route path="reports" element={<FounderAttendanceReports />} />
          <Route path="face-enroll" element={<FaceEnroll />} />
          <Route path="profile" element={<HrProfile />} />
        </Route>

        {/* ================= EMPLOYEE ================= */}
        <Route
          path="/employee-dashboard"
          element={
            <RequireProfileSetup>
              <EmployeeLayout />
            </RequireProfileSetup>
          }
        >
          <Route index element={<Navigate to="/employee-dashboard/attendance/dashboard" replace />} />
          <Route path="dashboard" element={<Navigate to="/employee-dashboard/attendance/dashboard" replace />} />
          <Route path="profile" element={<MyProfile />} />
          <Route path="attendance/dashboard" element={<EmployeeAttendanceDashboard />} />
          <Route path="attendance/my-attendance" element={<EmployeeAttendanceMyAttendance />} />
          <Route path="mark-attendance" element={<MarkAttendancePage />} />
        </Route>

        {/* fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}


