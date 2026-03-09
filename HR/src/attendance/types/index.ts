export type Employee = {
  id?: string;
  employee_id: string;
  full_name?: string;
  email?: string;
  department?: string;
  designation?: string;
  role?: string;
  join_date?: string;
  is_active?: boolean;
  has_face_enrolled?: boolean;
  username?: string;
};

export type AttendanceRecord = {
  id: string;
  employee_id: string;
  full_name?: string;
  department?: string;
  check_in?: string;
  check_out?: string;
  formatted_duration?: string;
  total_hours?: number;
  status?: string;
  entry_location_name?: string;
  exit_location_name?: string;
  location_name?: string;
  entry_location_display?: string;
  exit_location_display?: string;
  location_change?: boolean;
  confidence_score?: number;
};

export type ReportSummary = {
  total_employees: number;
  present: number;
  absent: number;
  attendance_rate: number;
};

export type DailyReport = {
  date: string;
  summary: ReportSummary;
  department_breakdown: Record<string, { present: number; absent: number; total: number }>;
  attendance_details: Array<{
    employee_id: string;
    full_name: string;
    department: string;
    check_in: string;
    check_out: string;
    formatted_duration: string;
    attendance_status: string;
  }>;
};

export type SummaryReport = {
  date_from?: string;
  date_to?: string;
  department?: string;
  summary: ReportSummary;
  details?: unknown;
};
