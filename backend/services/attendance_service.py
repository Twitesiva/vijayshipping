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
        if use_cache and employee_id in self._session_cache:
            is_active, ts = self._session_cache[employee_id]
            if now - ts < self._session_cache_ttl:
                # Return a minimal placeholder if it exists, or None. 
                # Note: This is an optimization for the detection loop.
                return {"id": "cached", "status": "active"} if is_active else None

        res = self.supabase.table("attendance").select("id, status, check_in").eq("employee_id", employee_id).is_("check_out", "null").execute()
        session = res.data[0] if res.data else None
        
        # Update cache
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

# Global instance
attendance_service = AttendanceService()
