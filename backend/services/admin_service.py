from __future__ import annotations
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from database import get_supabase

class AdminService:
    def __init__(self):
        self.supabase = get_supabase()

    async def get_filter_options(self) -> Dict[str, List[Dict[str, Any]]]:
        """Fetch unique departments and employees from Supabase"""
        try:
            def is_founder(d):
                d_low = str(d or "").lower()
                return "founder" in d_low or "boss" in d_low

            # Get departments
            emp_res = self.supabase.table("employees").select("designation").execute()
            depts = sorted(list(set(e["designation"] for e in emp_res.data if e["designation"] and not is_founder(e["designation"]))))
            
            # Get employees
            employees_res = self.supabase.table("employees").select("employee_id, full_name, designation").execute()
            employees = [e for e in employees_res.data if not is_founder(e.get("designation"))]
            
            return {
                "departments": depts,
                "employees": [{"employee_id": e["employee_id"], "full_name": e["full_name"]} for e in employees],
                "locations": []
            }
        except Exception as e:
            print(f"Error in get_filter_options: {e}")
            return {"departments": [], "employees": [], "locations": []}

    async def get_summary_report(self, date_from: str, date_to: str) -> Dict[str, Any]:
        """Get summary stats for the dashboard"""
        # Optimization: Fetch employees once for the entire summary process
        emp_res = self.supabase.table("employees").select("employee_id, full_name, department, designation").execute()
        
        def is_founder(d):
            d_low = str(d or "").lower()
            return "founder" in d_low or "boss" in d_low

        emp_map = {e["employee_id"]: e for e in emp_res.data if not is_founder(e.get("designation"))}
        
        records = await self.get_attendance_records(date_from=date_from, date_to=date_to, limit=5000, emp_map=emp_map)
        
        # Calculate stats by department
        depts = {}
        for r in records["records"]: # Access records from the dictionary
            d = r.get("designation", "Default")
            if d not in depts:
                depts[d] = {"total_hours": 0, "total_employees": 0, "avg_hours_per_employee": 0, "emp_ids": set()}
            depts[d]["total_hours"] += r["total_hours"]
            depts[d]["emp_ids"].add(r["employee_id"])
            
        for d in depts:
            depts[d]["total_employees"] = len(depts[d]["emp_ids"])
            if depts[d]["total_employees"] > 0:
                depts[d]["avg_hours_per_employee"] = depts[d]["total_hours"] / depts[d]["total_employees"]
            del depts[d]["emp_ids"]
            
        return {
            "report": {
                "department_statistics": depts
            }
        }

    async def get_dashboard_stats(self) -> Dict[str, Any]:
        """Get summarized stats for the Founders/HR dashboard"""
        try:
            today = date.today().isoformat()
            print(f"DEBUG: dashboard-stats for {today}")
            
            # Total employees (Exclude Founder/Boss)
            emp_res = self.supabase.table("employees").select("id, employee_id, designation").execute()
            
            def is_founder(d):
                d_low = str(d or "").lower()
                return "founder" in d_low or "boss" in d_low

            all_emps = emp_res.data or []
            filtered_emps = [e for e in all_emps if not is_founder(e.get("designation"))]
            total_users = len(filtered_emps)
            
            # Active employees (punched in today)
            session_res = self.supabase.table("attendance").select("employee_id").gte("check_in", f"{today}T00:00:00").execute()
            # We need to ensure we only count non-founder attendance
            active_emp_ids = set(s["employee_id"] for s in session_res.data) if session_res.data else set()
            filtered_active_ids = [eid for eid in active_emp_ids if any(emp.get("employee_id") == eid for emp in filtered_emps)]
            today_attendance = len(filtered_active_ids)
            
            # Face enrolled
            enroll_res = self.supabase.table("face_enrollments").select("id, employee_id", count="exact").eq("is_active", True).execute()
            enrolled_emp_ids = [e["employee_id"] for e in enroll_res.data or []]
            filtered_enrolled = [eid for eid in enrolled_emp_ids if any(emp.get("employee_id") == eid for emp in filtered_emps)]
            face_enrolled = len(filtered_enrolled)
            
            return {
                "stats": {
                    "total_users": total_users,
                    "active_users": total_users, # Assumption: active means registered
                    "today_attendance": today_attendance,
                    "today_absent": max(0, total_users - today_attendance),
                    "face_enrolled": face_enrolled
                }
            }
        except Exception as e:
            print(f"Error in get_dashboard_stats: {e}")
            return {"stats": {}}

    async def get_daily_report(self, date_str: str) -> Dict[str, Any]:
        """Comprehensive daily report: identifies Present vs Absent for ALL employees"""
        try:
            # 1. Fetch Full List (Exclude Founder/Boss)
            emp_res = self.supabase.table("employees").select("employee_id, full_name, department, designation").execute()
            
            def is_founder(d):
                d_low = str(d or "").lower()
                return "founder" in d_low or "boss" in d_low

            all_employees = [e for e in (emp_res.data or []) if not is_founder(e.get("designation"))]
            emp_map = {e["employee_id"]: e for e in all_employees}
            
            # 2. Fetch Today's Activity (All sessions for the date)
            # Pass emp_map to avoid re-fetching in get_attendance_records
            records_res = await self.get_attendance_records(date_from=date_str, date_to=date_str, limit=1000, emp_map=emp_map)
            all_sessions = records_res.get("records", [])
            
            # Group sessions by employee_id for aggregation
            emp_sessions_map = {}
            for s in all_sessions:
                eid = s["employee_id"]
                if eid not in emp_sessions_map:
                    emp_sessions_map[eid] = []
                emp_sessions_map[eid].append(s)
            
            # 3. Merge and Tag
            attendance_details = []
            for emp in all_employees:
                emp_id = emp["employee_id"]
                sessions = emp_sessions_map.get(emp_id, [])
                
                if sessions:
                    # Aggregate multiple sessions
                    total_work_hours = sum(s.get("total_hours", 0) for s in sessions)
                    perm_h = sessions[0].get("permission_hours", 0)
                    
                    # Collect all unique locations
                    locations = filter(None, [s.get("location_name") for s in sessions])
                    loc_str = ", ".join(set(locations)) or "--"
                    
                    # Collect session types
                    types = []
                    for s in sessions:
                        types.append("Field" if s.get("is_field_work") else "Office")
                    type_str = ", ".join(sorted(set(types)))
                    
                    detail = {
                        "employee_id": emp_id,
                        "full_name": emp.get("full_name", "Unknown"),
                        "department": emp.get("department", "Default"),
                        "designation": emp.get("designation") or "Employee",
                        "attendance_status": "Present",
                        "status": "active" if any(s.get("status") == "active" for s in sessions) else "completed",
                        "timestamp": sessions[0].get("timestamp"),
                        "total_hours": total_work_hours,
                        "formatted_duration": f"{total_work_hours:.2f} hrs",
                        "permission_hours": perm_h,
                        "day_total_hours": total_work_hours + perm_h,
                        "location": loc_str,
                        "session_types": type_str,
                        "is_field_work": "Field" in type_str
                    }
                else:
                    detail = {
                        "employee_id": emp_id,
                        "full_name": emp.get("full_name", "Unknown"),
                        "department": emp.get("department", "Default"),
                        "designation": emp.get("designation") or "Employee",
                        "attendance_status": "Absent",
                        "status": "Absent",
                        "timestamp": None,
                        "total_hours": 0,
                        "formatted_duration": "--",
                        "permission_hours": 0,
                        "day_total_hours": 0,
                        "location": "--",
                        "session_types": "--",
                        "is_field_work": False
                    }
                attendance_details.append(detail)
            
            return {"success": True, "report": {"attendance_details": attendance_details}}
        except Exception as e:
            print(f"Error in get_daily_report: {e}")
            return {"success": False, "message": str(e), "report": {"attendance_details": []}}

    async def get_employee_stats(self, employee_id: str, date_from: str, date_to: str) -> Dict[str, Any]:
        """Get summarized stats for a specific employee (Present days, Hours, etc.)"""
        try:
            # Query all records for the range (optimized for counts)
            query = self.supabase.table("attendance").select("attendance_date, total_hours, attendance_type, check_in") \
                .eq("employee_id", employee_id) \
                .gte("attendance_date", date_from) \
                .lte("attendance_date", date_to)
            
            res = query.execute()
            records = res.data or []
            
            # 1. Present days count (Distinct dates)
            present_dates = set(r["attendance_date"] for r in records if r["attendance_date"])
            present_days = len(present_dates)
            
            # 2. Total hours by type
            office_hours = sum(float(r.get("total_hours", 0)) for r in records if r.get("attendance_type") == "Office")
            field_hours = sum(float(r.get("total_hours", 0)) for r in records if r.get("attendance_type") == "Field")
            
            # 3. Last activity
            latest_check_in = None
            if records:
                # Sort records locally to find latest (cheaper than separate query if records < 100)
                sorted_records = sorted(records, key=lambda x: x["check_in"] or "", reverse=True)
                latest_check_in = sorted_records[0]["check_in"] if sorted_records else None

            # 4. Absent days (Assuming working days = elapsed days in month)
            # This is complex to do accurately without a holiday calendar, 
            # so we'll return the present count and let FE handle the 'absent' display logic 
            # if it prefers the "Days elapsed - Present" math.
            
            return {
                "success": True,
                "stats": {
                    "present_days": present_days,
                    "office_hours": round(office_hours, 2),
                    "field_hours": round(field_hours, 2),
                    "total_hours": round(office_hours + field_hours, 2),
                    "last_activity": latest_check_in
                }
            }
        except Exception as e:
            print(f"Error in get_employee_stats: {e}")
            return {"success": False, "message": str(e), "stats": {}}

    async def get_attendance_records(
        self, 
        date_from: Optional[str] = None, 
        date_to: Optional[str] = None, 
        employee_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
        emp_map: Optional[Dict[str, Any]] = None # Optimization
    ) -> Dict[str, Any]:
        """Fetch attendance sessions with employee details """
        try:
            query = self.supabase.table("attendance").select("*")
            
            # If date_from and date_to are the same, use the attendance_date column for speed and reliability
            if date_from and date_to and date_from.split('T')[0] == date_to.split('T')[0]:
                query = query.eq("attendance_date", date_from.split('T')[0])
            else:
                if date_from:
                    query = query.gte("check_in", f"{date_from}T00:00:00" if "T" not in date_from else date_from)
                if date_to:
                    query = query.lte("check_in", f"{date_to}T23:59:59" if "T" not in date_to else date_to)
            
            if employee_id:
                query = query.eq("employee_id", employee_id)
                
            res = query.order("check_in", desc=True).range(offset, offset + limit).execute()
            sessions = res.data or []
            
            if not sessions:
                return {"success": True, "records": []}
                
            # Fetch employees only if not provided
            if emp_map is None:
                employee_ids = list(set(r["employee_id"] for r in sessions))
                if employee_ids:
                    emp_res = self.supabase.table("employees").select("employee_id, full_name, department, designation").in_("employee_id", employee_ids).execute()
                    
                    def is_founder(d):
                        d_low = str(d or "").lower()
                        return "founder" in d_low or "boss" in d_low

                    emp_map = {e["employee_id"]: e for e in emp_res.data if not is_founder(e.get("designation"))}
                else:
                    emp_map = {}
            
            # Approved permissions
            perm_map = {}
            # Check for permissions table existence or guard it
            # try:
            #     perm_query = self.supabase.table("permissions").select("employee_id, start_time, duration_minutes").eq("approval_status", "Approved")
            #     if date_from: perm_query = perm_query.gte("start_time", date_from)
            #     if date_to: perm_query = perm_query.lte("start_time", date_to)
            #     if employee_id: perm_query = perm_query.eq("employee_id", employee_id)
            #     
            #     perm_res = perm_query.execute()
            #     for p in (perm_res.data or []):
            #         p_date = p["start_time"].split("T")[0]
            #         key = (p["employee_id"], p_date)
            #         perm_map[key] = perm_map.get(key, 0) + (float(p.get("duration_minutes", 0)) / 60.0)
            # except: pass
            pass

            records = []
            for r in sessions:
                emp = emp_map.get(r["employee_id"])
                if not emp: continue # Skip if Founder/Boss (filtered out in emp_map)
                
                # Format duration
                hours = float(r.get("total_hours", 0))
                formatted_duration = f"{hours:.2f} hrs" if hours > 0 else "--"
                
                record = {
                    "id": r["id"],
                    "employee_id": r["employee_id"],
                    "full_name": emp.get("full_name", "Unknown"),
                    "designation": emp.get("designation", "Employee"),
                    "department": emp.get("department", "Default"),
                    "entry_time": r["check_in"], # FE expects entry_time
                    "exit_time": r["check_out"], # FE expects exit_time
                    "check_in": r["check_in"],   # FE expects check_in
                    "check_out": r["check_out"], # FE expects check_out
                    "timestamp": r["check_in"],
                    "status": (r.get("status") or "Completed").lower(), # FE expects lowercase for logic
                    "attendance_status": "Present",
                    "total_hours": hours,
                    "formatted_duration": formatted_duration,
                    "entry_location_display": r.get("entry_address", "Office"),
                    "exit_location_display": r.get("exit_address", "Office") if r.get("check_out") else "--",
                    "location_name": r.get("entry_address", "Office"),
                    "is_spoof": False,
                    "permission_hours": 0,
                    "is_field_work": r.get("attendance_type") == "Field"
                }
                
                # Check for permission on this day
                # check_in is ISO string, extract YYYY-MM-DD
                session_date = r["check_in"].split("T")[0]
                perm_h = perm_map.get((r["employee_id"], session_date), 0)
                record["permission_hours"] = perm_h
                record["day_total_hours"] = hours + perm_h
                
                records.append(record)
                
            return {"success": True, "records": records}
        except Exception as e:
            print(f"Error in get_attendance_records: {e}")
            return {"success": False, "message": str(e), "records": []}

    async def delete_attendance_record(self, record_id: str) -> Dict[str, Any]:
        """Delete an attendance record by ID"""
        try:
            res = self.supabase.table("attendance").delete().eq("id", record_id).execute()
            if not res.data:
                return {"success": False, "message": f"Record with ID {record_id} not found."}
            return {"success": True, "message": f"Successfully deleted record {record_id}"}
        except Exception as e:
            print(f"Error in delete_attendance_record: {e}")
            return {"success": False, "message": str(e)}

    async def get_all_employees(self) -> Dict[str, Any]:
        """Fetch all employees with enhanced status and enrollment details"""
        try:
            # 1. Fetch all employees (Exclude Founder/Boss)
            res = self.supabase.table("employees").select("*").execute()
            
            def is_founder(d):
                d_low = str(d or "").lower()
                return "founder" in d_low or "boss" in d_low

            employees = [e for e in (res.data or []) if not is_founder(e.get("designation"))]
            
            # 2. Fetch enrollment status
            enroll_res = self.supabase.table("face_enrollments").select("employee_id").eq("is_active", True).execute()
            enrolled_ids = set(e["employee_id"] for e in enroll_res.data) if enroll_res.data else set()
            
            # 3. Fetch active sessions to determine 'is_active' (online) status
            today = date.today().isoformat()
            active_res = self.supabase.table("attendance").select("employee_id").gte("check_in", f"{today}T00:00:00").execute()
            active_ids = set(a["employee_id"] for a in active_res.data) if active_res.data else set()
            
            for emp in employees:
                eid = emp.get("employee_id")
                emp["has_face_enrolled"] = eid in enrolled_ids
                emp["is_active"] = eid in active_ids
                # Ensure designation or department is safe for frontend
                if not emp.get("department"):
                    emp["department"] = emp.get("designation") or "General"
                # role mapping for frontend consistency
                if not emp.get("role"):
                    emp["role"] = (emp.get("designation") or "employee").lower()
            
            return {"success": True, "employees": employees}
        except Exception as e:
            print(f"Error in get_all_employees: {e}")
            return {"success": False, "message": str(e), "employees": []}

    async def get_departments_list(self) -> Dict[str, Any]:
        """Fetch unique designations as departments for the frontend"""
        try:
            res = self.supabase.table("employees").select("designation").execute()
            
            def is_founder(d):
                d_low = str(d or "").lower()
                return "founder" in d_low or "boss" in d_low

            depts = sorted(list(set(e["designation"] for e in res.data if e["designation"] and not is_founder(e["designation"]))))
            return {"success": True, "departments": [{"id": d, "name": d} for d in depts]}
        except Exception as e:
            return {"success": False, "message": str(e), "departments": []}

    async def update_employee(self, employee_id: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update employee record in Supabase using employee_id string"""
        try:
            # Frontend may send various fields, map them to DB columns
            db_data = {}
            field_mapping = {
                "full_name": "full_name",
                "name": "full_name",
                "designation": "designation",
                "department": "designation", # Map department to designation as per current schema
                "email": "email",
                "mobile_number": "mobile_number",
                "phone": "mobile_number",
                "join_date": "join_date",
                "joining_date": "join_date",
                "employee_type": "employee_type",
                "role": "role",
                "location": "location",
                "gender": "gender",
                "dob": "dob",
                "reporting_manager": "reporting_manager",
                "manager": "reporting_manager",
                "work_status": "work_status",
                "status": "status",
                "exit_date": "exit_date",
                "reason_for_leave": "reason_for_leave"
            }

            for key, val in update_data.items():
                if key in field_mapping:
                    db_data[field_mapping[key]] = val
            
            if not db_data:
                return {"success": False, "message": "No valid fields provided for update"}

            # Use employee_id (string like F0001) for filtering
            res = self.supabase.table("employees").update(db_data).eq("employee_id", employee_id).execute()
            
            if not res.data:
                # Try fallback to 'id' if 'employee_id' matches nothing (though unlikely in current flow)
                res = self.supabase.table("employees").update(db_data).eq("id", employee_id).execute()
                if not res.data:
                    return {"success": False, "message": f"Employee {employee_id} not found"}
            
            return {"success": True, "message": "Employee updated successfully"}
        except Exception as e:
            print(f"Error updating employee: {e}")
            return {"success": False, "message": str(e)}

    async def delete_employee(self, employee_id: str) -> Dict[str, Any]:
        """Delete an employee and their associated face enrollments"""
        try:
            # Delete face enrollments first
            self.supabase.table("face_enrollments").delete().eq("employee_id", employee_id).execute()
            # Delete the employee record
            res = self.supabase.table("employees").delete().eq("employee_id", employee_id).execute()
            
            if not res.data:
                return {"success": False, "message": "Employee not found"}
            return {"success": True, "message": "Employee deleted successfully"}
        except Exception as e:
             print(f"Error deleting employee: {e}")
             return {"success": False, "message": str(e)}

admin_service = AdminService()
