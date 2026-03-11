"""
Attendance service - coordinates the full attendance marking pipeline using Supabase

"""
from __future__ import annotations

import os
from datetime import datetime, date, timezone
from typing import Optional, Tuple
import time
import numpy as np
import torch

from database import get_supabase
from services.anti_spoof import anti_spoof_service
from services.face_recognition import face_recognition_service
from services.geofencing import is_within_geofence, calculate_distance
from geopy.distance import geodesic
from utils.image_utils import save_image

# Directory for storing attendance images
ATTENDANCE_IMAGES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "attendance_images")

class AttendanceService:
    def __init__(self):
        """Initialize attendance service"""
        os.makedirs(ATTENDANCE_IMAGES_DIR, exist_ok=True)
        self.supabase = get_supabase()
        self._enrollment_cache = []
        self._last_cache_update = None
        self._cache_ttl = 1800 # 30 minutes
        self._session_cache = {} # {employee_id: (is_logged_in, timestamp)}
        self._session_cache_ttl = 30 # 30 seconds for detection loop

    def _refresh_enrollment_cache(self, force=False):
        """Refresh the face enrollment cache from Supabase"""
        now = datetime.now()
        if not force and self._last_cache_update and (now - self._last_cache_update).total_seconds() < self._cache_ttl:
            return

        try:
            # Fetch active enrollments
            res = self.supabase.table("face_enrollments").select("employee_id, face_encoding").eq("is_active", True).execute()
            enrollments = res.data
            if not enrollments:
                self._enrollment_cache = []
                self._last_cache_update = now
                return

            # 2. Fetch all employees to map details 
            emp_res = self.supabase.table("employees").select("employee_id, full_name, department").execute()
            emp_map = {e["employee_id"]: e["full_name"] for e in emp_res.data}
            
            new_cache = []
            for enr in enrollments:
                try:
                    emp_id = enr["employee_id"]
                    encoding = face_recognition_service.json_to_encoding(enr["face_encoding"])
                    full_name = emp_map.get(emp_id, "Unknown")
                    # (employee_id, full_name, encoding, user_uuid)
                    new_cache.append((emp_id, full_name, encoding, None))
                except:
                    continue
            
            self._enrollment_cache = new_cache
            self._last_cache_update = now
            print(f"Face enrollment cache refreshed: {len(self._enrollment_cache)} users")
        except Exception as e:
            print(f"Error refreshing enrollment cache: {e}")
    
    def get_active_session(self, employee_id: str, use_cache: bool = False) -> Optional[dict]:
        """Check if user has an active session (punched in but not out)"""
        now = time.time()
        
        # Always query database for fresh session status to ensure cross-platform consistency
        # This ensures that login/logout from different methods (QuickAttendance vs MarkAttendancePage)
        # are always reflected correctly
        res = self.supabase.table("attendance").select("id, status, check_in").eq("employee_id", employee_id).is_("check_out", "null").execute()
        session = res.data[0] if res.data else None
        
        # Update cache after fresh query
        self._session_cache[employee_id] = (session is not None, now)
        return session
    
    def mark_attendance(
        self,
        db: Optional[any],
        image: np.ndarray,
        latitude: float,
        longitude: float,
        office_lat: float,
        office_lon: float,
        geofence_radius: float,
        action: str = 'entry', # 'entry' for Login, 'exit' for Logout
        employee_id: Optional[str] = None,
        location_address: Optional[str] = None,
        background_tasks: Optional[any] = None,
        is_field_work: bool = False
    ) -> Tuple[bool, str, Optional[dict]]:
        """
        Mark attendance with session handling and MiniFASNet verification.
        Optimized for speed by using provided employee_id and location_address.
        """
        try:
            start_time = time.time()
            # Step 1: Anti-spoofing check
            is_real, confidence, spoof_message = anti_spoof_service.test_liveness(image)
            if not is_real:
                return False, f"Liveness check failed: {spoof_message}", None
            
            # Step 2: Face recognition (With Multi-face guard)
            face_locations, boxes, prob = face_recognition_service.detect_faces(image)
            
            if face_locations is None or len(face_locations) == 0:
                return False, "No face detected in the image", None
            
            if len(face_locations) > 1:
                return False, "Multiple faces detected. Please Ensure only one person is in the frame.", None
            
            # Generate encoding for the single person
            torch_loc = torch.stack([face_locations[0]]).to(face_recognition_service.device)
            face_encoding = face_recognition_service.resnet(torch_loc).detach().cpu().numpy()[0]
            
            # Optimization: Use enrollment cache
            self._refresh_enrollment_cache()
            
            # If employee_id is provided, do 1:1 verification from cache
            match = None
            full_name = "Unknown"
            user_uuid = None
            
            if employee_id:
                # Find in cache
                cached_data = next((x for x in self._enrollment_cache if x[0] == employee_id), None)
                if cached_data:
                    known_enc = cached_data[2]
                    is_match, similarity = face_recognition_service.compare_faces(known_enc, face_encoding, threshold=float(os.getenv("FACE_RECOGNITION_TOLERANCE", 0.9)))
                    if is_match:
                        full_name = cached_data[1]
                        user_uuid = cached_data[3]
                        match = (employee_id, full_name, similarity, user_uuid)
                        print(f"FACE: 1:1 Match Found for {employee_id} ({full_name}). Score: {similarity:.4f}")
                    else:
                        print(f"FACE: 1:1 Match Failed for {employee_id}. Similarity: {similarity:.4f}, Threshold: {os.getenv('FACE_RECOGNITION_TOLERANCE', '0.9')}")
            
            # Fallback to scanning everything in cache
            if not match:
                if not self._enrollment_cache:
                    return False, "No registered face data found", None
                
                # find_matching_user returns (emp_id, name, sim) but we need to find uuid in cache
                best_match = face_recognition_service.find_matching_user(face_encoding, self._enrollment_cache, threshold=float(os.getenv("FACE_RECOGNITION_TOLERANCE", 0.9)))
                if best_match:
                    emp_id, full_name, similarity = best_match
                    user_uuid = next((x[3] for x in self._enrollment_cache if x[0] == emp_id), None)
                    match = (emp_id, full_name, similarity, user_uuid)
                    print(f"FACE: 1:N Match Found: {emp_id} ({full_name}). Score: {similarity:.4f}")
                else:
                    print(f"FACE: Identification failed for all {len(self._enrollment_cache)} users in cache.")

            if match is None:
                return False, "Face not recognized. Please register first.", None
            
            employee_id, full_name, similarity, user_uuid = match
            
            # Step 3: Geofencing validation
            # Optimization: If address is already provided by frontend, skip Google Maps
            if location_address:
                # Still calculate distance to be sure, but skip geocoding
                dist = calculate_distance(latitude, longitude, office_lat, office_lon)
                is_inside = dist <= geofence_radius
                address = location_address
            else:
                is_inside, dist, address = is_within_geofence(
                    latitude, longitude,
                    office_lat, office_lon,
                    geofence_radius
                )
            
            # If it's field work, we don't block if they are outside
            if not is_inside and not is_field_work:
                return False, f"You are outside the office zone ({dist:.2f}m). Please come to the office or mark as Field Work.", None
            
            # Step 4: Session Handling (Punch In / Punch Out)
            active_session = self.get_active_session(employee_id)
            now = datetime.now(timezone.utc)
            
            if not user_uuid:
                # Fallback only if cache missed it
                user_res = self.supabase.table("users").select("id").eq("employee_id", employee_id).execute()
                user_uuid = user_res.data[0]["id"] if user_res.data else None

            if action == 'exit':
                if not active_session:
                    # Update cache to reflect logged out state
                    self._session_cache[employee_id] = (False, time.time())
                    return True, "No active session found (Already logged out).", {
                        "employee_id": employee_id,
                        "full_name": full_name,
                        "status": "Already Out"
                    }
                
                # Punch Out
                session_id = active_session["id"]
                # Supabase returns ISO strings. We need to handle them carefully.
                check_in_str = active_session["check_in"]
                try:
                    if check_in_str.endswith('Z'):
                        check_in_str = check_in_str.replace('Z', '+00:00')
                    check_in_dt = datetime.fromisoformat(check_in_str)
                    
                    # Both aware at this point
                    duration_seconds = (now - check_in_dt).total_seconds()
                    duration_hours = round(max(0, duration_seconds / 3600.0), 2)
                except Exception as e:
                    print(f"Error calculating duration: {e}")
                    duration_hours = 0

                update_data = {
                    "check_out": now.isoformat(),
                    "exit_latitude": latitude,
                    "exit_longitude": longitude,
                    "exit_address": address,
                    "total_hours": duration_hours,
                    "status": "completed"
                }
                
                res = self.supabase.table("attendance").update(update_data).eq("id", session_id).execute()
                if not res.data:
                    return False, "Failed to update attendance session in database.", None
                
                # Update cache to reflect logged out state
                self._session_cache[employee_id] = (False, time.time())
                    
                msg = f"Logout Marked Successfully! Duration: {duration_hours}h"
                att_status = "Out"
            else: # action == 'entry'
                if active_session:
                    # Auto-close previous session if user didn't logout
                    try:
                        session_id = active_session["id"]
                        self.supabase.table("attendance").update({
                            "check_out": now.isoformat(),
                            "status": "completed"
                        }).eq("id", session_id).execute()
                        print(f"Auto-closed previous session {session_id} for {employee_id}")
                    except Exception as e:
                        print(f"Failed to auto-close session: {e}")
                
                # Punch In
                insert_data = {
                    "employee_id": employee_id,
                    "attendance_date": now.date().isoformat(),
                    "check_in": now.isoformat(),
                    "entry_latitude": latitude,
                    "entry_longitude": longitude,
                    "entry_address": address,
                    "status": "active",
                    "attendance_type": "Field" if is_field_work else "Office"
                }
                res = self.supabase.table("attendance").insert(insert_data).execute()
                if not res.data:
                    return False, "Failed to create attendance session in database.", None
                    
                session_id = res.data[0]["id"]
                
                # Update cache to reflect logged in state
                self._session_cache[employee_id] = (True, time.time())
                
                msg = "Login Marked Successfully!"
                att_status = "In"
            
            # Step 5: Save image for record (Potentially in background)
            image_filename = f"{employee_id}_{att_status.lower()}_{now.strftime('%Y%m%d_%H%M%S')}.jpg"
            image_path = os.path.join(ATTENDANCE_IMAGES_DIR, image_filename)
            
            def save_image_task(img, path):
                try:
                    save_image(img, path)
                except Exception as e:
                    print(f"Error saving image in background: {e}")

            if background_tasks:
                background_tasks.add_task(save_image_task, image, image_path)
            else:
                save_image_task(image, image_path)
            
            # Step 6: Log Verification (Potentially in background)
            def log_verification_task(uid, eid, t):
                try:
                    self.supabase.table("face_verifications").insert({
                        "user_id": uid,
                        "employee_id": eid,
                        "verified": True,
                        "verified_at": t.isoformat()
                    }).execute()
                except Exception as e:
                    print(f"Error logging verification in background: {e}")

            if background_tasks:
                background_tasks.add_task(log_verification_task, user_uuid, employee_id, now)
            else:
                log_verification_task(user_uuid, employee_id, now)
            
            total_time = time.time() - start_time
            print(f"Total mark_attendance time: {total_time:.4f}s")
            
            return True, msg, {
                "session_id": session_id,
                "employee_id": employee_id,
                "full_name": full_name,
                "timestamp": now.isoformat(),
                "status": att_status,
                "address": address
            }
            
        except Exception as e:
            return False, f"Error marking attendance: {str(e)}", None

    def close_stale_sessions(self):
        """Find active sessions from previous days and close them at 23:59:59 of that day"""
        try:
            today_str = date.today().isoformat()
            # Find all active sessions where attendance_date is before today
            res = self.supabase.table("attendance").select("id, employee_id, check_in, attendance_date").eq("status", "active").lt("attendance_date", today_str).execute()
            
            stale_sessions = res.data or []
            if not stale_sessions:
                return
                
            print(f"AUTO-LOGOUT: Closing {len(stale_sessions)} stale sessions...")
            
            for sess in stale_sessions:
                try:
                    sess_id = sess["id"]
                    att_date = sess["attendance_date"]
                    check_in_str = sess["check_in"]
                    
                    # Set check_out to 23:59:59 of the attendance_date
                    check_out_dt = datetime.fromisoformat(f"{att_date}T23:59:59").replace(tzinfo=timezone.utc)
                    
                    # Calculate duration
                    if check_in_str.endswith('Z'):
                        check_in_str = check_in_str.replace('Z', '+00:00')
                    check_in_dt = datetime.fromisoformat(check_in_str)
                    if check_in_dt.tzinfo is None:
                        check_in_dt = check_in_dt.replace(tzinfo=timezone.utc)
                        
                    duration_seconds = (check_out_dt - check_in_dt).total_seconds()
                    duration_hours = round(max(0, duration_seconds / 3600.0), 2)
                    
                    self.supabase.table("attendance").update({
                        "check_out": check_out_dt.isoformat(),
                        "total_hours": duration_hours,
                        "status": "completed",
                        "exit_address": "Auto-Logged Out"
                    }).eq("id", sess_id).execute()
                    
                    # Clear session cache for this employee
                    self._session_cache.pop(sess["employee_id"], None)
                    print(f"AUTO-LOGOUT: Closed session {sess_id} for {sess['employee_id']}")
                except Exception as e:
                    print(f"Error closing stale session {sess.get('id')}: {e}")
                    
        except Exception as e:
            print(f"Error in close_stale_sessions: {e}")

    def close_today_active_sessions(self):
        """
        Close all active sessions for TODAY at 23:59:59.
        This runs at midnight to auto-logout employees who forgot to logout.
        """
        try:
            today_str = date.today().isoformat()
            
            # Find all active sessions for today
            res = self.supabase.table("attendance").select(
                "id, employee_id, check_in, attendance_date"
            ).eq("status", "active").eq("attendance_date", today_str).execute()
            
            active_sessions_today = res.data or []
            if not active_sessions_today:
                print("MIDNIGHT AUTO-LOGOUT: No active sessions to close for today.")
                return {
                    "success": True,
                    "message": "No active sessions to close",
                    "closed_count": 0
                }
            
            print(f"MIDNIGHT AUTO-LOGOUT: Closing {len(active_sessions_today)} active sessions for today...")
            
            closed_count = 0
            for sess in active_sessions_today:
                try:
                    sess_id = sess["id"]
                    emp_id = sess["employee_id"]
                    check_in_str = sess["check_in"]
                    
                    # Set check_out to 23:59:59 of today
                    check_out_dt = datetime.fromisoformat(f"{today_str}T23:59:59").replace(tzinfo=timezone.utc)
                    
                    # Calculate duration
                    if check_in_str.endswith('Z'):
                        check_in_str = check_in_str.replace('Z', '+00:00')
                    check_in_dt = datetime.fromisoformat(check_in_str)
                    if check_in_dt.tzinfo is None:
                        check_in_dt = check_in_dt.replace(tzinfo=timezone.utc)
                    
                    duration_seconds = (check_out_dt - check_in_dt).total_seconds()
                    duration_hours = round(max(0, duration_seconds / 3600.0), 2)
                    
                    self.supabase.table("attendance").update({
                        "check_out": check_out_dt.isoformat(),
                        "total_hours": duration_hours,
                        "status": "completed",
                        "exit_address": "Auto-Logged Out at Midnight"
                    }).eq("id", sess_id).execute()
                    
                    # Clear session cache for this employee
                    self._session_cache.pop(emp_id, None)
                    
                    print(f"MIDNIGHT AUTO-LOGOUT: Closed session {sess_id} for employee {emp_id}. Duration: {duration_hours}h")
                    closed_count += 1
                    
                except Exception as e:
                    print(f"Error closing session {sess.get('id')}: {e}")
            
            return {
                "success": True,
                "message": f"Auto-logged out {closed_count} employees",
                "closed_count": closed_count
            }
                    
        except Exception as e:
            print(f"Error in close_today_active_sessions: {e}")
            return {
                "success": False,
                "message": str(e),
                "closed_count": 0
            }

# Global instance
attendance_service = AttendanceService()
