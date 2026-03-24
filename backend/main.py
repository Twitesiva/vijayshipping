from fastapi import FastAPI, HTTPException, Request, Depends, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from datetime import datetime, timedelta, timezone as dt_timezone
# India Standard Time
IST = dt_timezone(timedelta(hours=5, minutes=30))
import numpy as np
import os

# APScheduler for midnight auto-logout
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from utils.image_utils import base64_to_image
from services.attendance_service import attendance_service
from services.anti_spoof import anti_spoof_service
from services.face_recognition import face_recognition_service
from services.admin_service import admin_service
from database import get_supabase

from models import User
from services.geofencing import get_address

app = FastAPI(title="HRMS Attendance API")

# Initialize scheduler
scheduler = BackgroundScheduler()

def scheduled_midnight_auto_logout():
    """Scheduled task that runs at midnight to auto-logout active sessions"""
    print("SCHEDULER: Running midnight auto-logout task...")
    try:
        result = attendance_service.close_today_active_sessions()
        print(f"SCHEDULER: {result}")
    except Exception as e:
        print(f"SCHEDULER ERROR: {e}")

@app.on_event("startup")
async def startup_event():
    print("API Starting up... Checking for stale attendance sessions.")
    try:
        attendance_service.close_stale_sessions()
    except Exception as e:
        print(f"Error in startup auto-logout: {e}")
    
    # Start the scheduler for midnight auto-logout
    try:
        # Run at midnight (00:00) every day
        scheduler.add_job(
            scheduled_midnight_auto_logout,
            CronTrigger(hour=23, minute=59, timezone=IST),
            id="midnight_auto_logout",
            name="Midnight Auto-Logout",
            replace_existing=True
        )
        scheduler.start()
        print("SCHEDULER: Midnight auto-logout job scheduled successfully")
    except Exception as e:
        print(f"SCHEDULER ERROR: Failed to start scheduler: {e}")

@app.on_event("shutdown")
def shutdown_event():
    """Shutdown the scheduler when the app stops"""
    if scheduler.running:
        scheduler.shutdown()
        print("SCHEDULER: Scheduler shutdown successfully")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Update this to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to the new HRMS Attendance API"}

@app.get("/api/v1/health")
async def health():
    return {"status": "healthy"}

@app.get("/api/v1/db-health")
async def db_health():
    """Database health check - verifies connection and table access"""
    try:
        supabase = get_supabase()
        
        # Test basic connectivity
        result = {"status": "healthy", "tables": {}, "errors": []}
        
        # Check users table
        try:
            users_res = supabase.table("users").select("id", count="exact").execute()
            result["tables"]["users"] = {"status": "ok", "count": users_res.count or 0}
        except Exception as e:
            result["tables"]["users"] = {"status": "error", "message": str(e)}
            result["errors"].append(f"users: {str(e)}")
        
        # Check employees table
        try:
            emp_res = supabase.table("employees").select("id", count="exact").execute()
            result["tables"]["employees"] = {"status": "ok", "count": emp_res.count or 0}
        except Exception as e:
            result["tables"]["employees"] = {"status": "error", "message": str(e)}
            result["errors"].append(f"employees: {str(e)}")
        
        # Check employees table
        try:
            emp_conn = supabase.table("employees").select("id", count="exact").limit(1).execute()
            result["tables"]["employees"] = {"status": "ok", "count": emp_conn.count or 0}
        except Exception as e:
            result["tables"]["employees"] = {"status": "error", "message": str(e)}
            result["errors"].append(f"employees: {str(e)}")
        
        # Check attendance table
        try:
            att_res = supabase.table("attendance").select("id", count="exact").execute()
            result["tables"]["attendance"] = {"status": "ok", "count": att_res.count or 0}
        except Exception as e:
            result["tables"]["attendance"] = {"status": "error", "message": str(e)}
            result["errors"].append(f"attendance: {str(e)}")
        
        # Check face_enrollments table
        try:
            face_res = supabase.table("face_enrollments").select("id", count="exact").execute()
            result["tables"]["face_enrollments"] = {"status": "ok", "count": face_res.count or 0}
        except Exception as e:
            result["tables"]["face_enrollments"] = {"status": "error", "message": str(e)}
            result["errors"].append(f"face_enrollments: {str(e)}")
        
        if result["errors"]:
            result["status"] = "degraded"
        
        return result
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

@app.get("/api/v1/db-check-rpc")
async def db_check_rpc():
    """Check if required RPC functions exist"""
    try:
        supabase = get_supabase()
        result = {"status": "healthy", "functions": {}, "errors": []}
        
        # Try calling each RPC function with null params to check existence
        rpc_functions = ["verify_login_json", "manager_login_js", "debug_login_check"]
        
        for fn in rpc_functions:
            try:
                # Just try to call it - if it exists but fails due to params, that's ok
                if fn == "verify_login_json":
                    supabase.rpc(fn, {"p_role": None, "p_identifier": None, "p_secret": None})
                elif fn == "manager_login_js":
                    supabase.rpc(fn, {"p_email": None, "p_password": None})
                elif fn == "debug_login_check":
                    supabase.rpc(fn, {"p_email": None, "p_role": None, "p_password": None})
                result["functions"][fn] = {"status": "exists"}
            except Exception as e:
                err_msg = str(e).lower()
                if "could not find" in err_msg or "does not exist" in err_msg:
                    result["functions"][fn] = {"status": "missing", "message": str(e)}
                    result["errors"].append(f"{fn}: not found")
                else:
                    # Function exists but call failed due to params - that's ok
                    result["functions"][fn] = {"status": "exists", "note": "call failed (expected)"}
        
        if result["errors"]:
            result["status"] = "degraded"
        
        return result
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.post("/api/v1/auth/bridge")
async def auth_bridge(request: Request):
    """Bridge authentication from the main HR app"""
    try:
        data = await request.json()
        # In a real app, you'd verify a shared secret or token here
        # For now, we trust the bridge and return a valid user session
        return {
            "access_token": "mock-bridge-token",
            "token_type": "bearer",
            "user_id": data.get("employee_id", "bridge-user"),
            "username": data.get("identifier", "bridge-user"),
            "full_name": data.get("full_name", "Bridge User"),
            "employee_id": data.get("employee_id"),
            "role": data.get("role", "admin")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/auth/me")
async def get_me(request: Request):
    """Get current user profile"""
    # For bridge/mock development, we can return the last bridged user or a default
    # If the token is 'mock-bridge-token', return a representative user
    auth_header = request.headers.get("Authorization")
    if auth_header == "Bearer mock-bridge-token":
         return {
            "user_id": "bridge-user",
            "username": "bridge-user",
            "full_name": "Bridge User",
            "employee_id": "EMP001", # Default for testing
            "role": "admin"
        }
    return {
        "user_id": "user",
        "username": "user",
        "full_name": "Standard User",
        "employee_id": "EMP002",
        "role": "employee"
    }

@app.post("/api/v1/auth/login")
async def login(request: Request):
    """Password-based login fallback"""
    try:
        data = await request.json()
        # Mock login for development
        return {
            "access_token": "mock-login-token",
            "token_type": "bearer",
            "user_id": data.get("username", "user"),
            "username": data.get("username", "user"),
            "role": "admin"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/attendance/geocode")
async def geocode(lat: float, lng: float):
    """Reverse geocode coordinates to an address"""
    try:
        address = get_address(lat, lng)
        return {"success": True, "address": address}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/api/v1/attendance/check-geofence")
async def check_geofence(lat: float, lng: float):
    """
    Check if user location is within office geofence.
    Returns is_within_geofence, distance, and office status.
    Default radius is 500 meters (can be changed via GPS_ACCURACY_THRESHOLD env var).
    """
    try:
        office_lat = float(os.getenv("OFFICE_LAT") or os.getenv("OFFICE_ZONE_LAT", 13.0798))
        office_lon = float(os.getenv("OFFICE_LON") or os.getenv("OFFICE_ZONE_LNG", 80.2263))
        radius_meters = float(os.getenv("GPS_ACCURACY_THRESHOLD", 500))
        radius_km = radius_meters / 1000.0
        
        print(f"[GEOFENCE] User location: lat={lat}, lng={lng}")
        print(f"[GEOFENCE] Office location: lat={office_lat}, lng={office_lon}")
        print(f"[GEOFENCE] Radius: {radius_meters}m ({radius_km}km)")
        
        from services.geofencing import calculate_distance
        distance_km = calculate_distance(lat, lng, office_lat, office_lon)
        distance_m = distance_km * 1000  # Convert to meters
        is_inside = distance_km <= radius_km
        
        print(f"[GEOFENCE] Distance: {distance_m}m, Is Inside: {is_inside}")
        
        return {
            "success": True,
            "is_within_geofence": is_inside,
            "distance_meters": round(distance_m, 2),
            "radius_meters": radius_meters,
            "office_lat": office_lat,
            "office_lon": office_lon
        }
    except Exception as e:
        print(f"[GEOFENCE] Error: {e}")
        return {"success": False, "message": str(e)}

@app.post("/api/v1/attendance/detect-face")
async def detect_face(request: Request):
    """Detect face and check liveness"""
    try:
        data = await request.json()
        image_data = data.get("image")
        if not image_data:
            raise HTTPException(status_code=400, detail="Image data is required")
        
        # Convert base64 to image
        image = base64_to_image(image_data)
        
        # Check liveness (MiniFASNet)
        is_real, confidence, message = anti_spoof_service.test_liveness(image)
        
        # Detect face and get bounding boxes
        print("DEBUG: Detecting faces...")
        face_locations, boxes, prob = face_recognition_service.detect_faces(image)
        print(f"DEBUG: Found {len(boxes) if boxes is not None else 0} boxes")
        
        bounding_boxes = []
        has_face = False
        
        if boxes is not None and len(boxes) > 0:
            has_face = True
            face_encoding = face_recognition_service.generate_face_encoding(image)
            
            # Use encodings from attendance_service cache
            attendance_service._refresh_enrollment_cache()
            user_encodings = attendance_service._enrollment_cache
            
            match = None
            if face_encoding is not None:
                tolerance = float(os.getenv("FACE_RECOGNITION_TOLERANCE", 0.9))
                match = face_recognition_service.find_matching_user(face_encoding, user_encodings, threshold=tolerance)
            
            for i, box in enumerate(boxes):
                is_match = False
                emp_id = "unknown"
                full_name = "Unknown"
                sim_score = 0
                is_logged_in = False
                
                if i == 0 and match:
                    emp_id, full_name, sim_score = match
                    is_match = True
                    
                    # Check session status (use cache for detection speed)
                    active_session = attendance_service.get_active_session(emp_id, use_cache=True)
                    is_logged_in = active_session is not None
                
                bounding_boxes.append({
                    "box": box.tolist(),
                    "recognized": is_match and is_real,
                    "color": "green" if is_match and is_real else "red",
                    "employee_id": emp_id,
                    "full_name": full_name,
                    "is_logged_in": is_logged_in if is_match else False,
                    "label": f"{full_name}" if is_match else "Unknown",
                    "confidence": (100-sim_score*100) if is_match else (float(prob[i]*100) if prob is not None and i < len(prob) else 0.0)
                })
        
        return {
            "success": True,
            "is_real": bool(is_real),
            "confidence": float(confidence),
            "message": message,
            "has_face": has_face,
            "bounding_boxes": bounding_boxes
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/attendance/check-enrollment/{employee_id}")
async def check_enrollment_status(employee_id: str):
    """Check if an employee is eligible for face enrollment"""
    employee_id = employee_id.strip()
    try:
        supabase = get_supabase()
        
        # 1. Check if employee exists and get user info
        emp_res = supabase.table("employees").select("employee_id, full_name").eq("employee_id", employee_id).execute()
        if not emp_res.data:
            raise HTTPException(status_code=404, detail=f"Employee with ID {employee_id} not found")
        
        full_name = emp_res.data[0]["full_name"]

        # 2. Check for existing active enrollments
        enroll_res = supabase.table("face_enrollments").select("id").eq("employee_id", employee_id).eq("is_active", True).execute()
        if enroll_res.data:
            raise HTTPException(status_code=400, detail=f"Employee {employee_id} is already enrolled.")

        return {"success": True, "message": "Employee is eligible for enrollment"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/attendance/enroll-face-enhanced")
async def enroll_face(request: Request):
    """Enroll a face for an employee"""
    try:
        data = await request.json()
        employee_id = (data.get("employee_id") or "").strip()
        image_data = data.get("image") or (data.get("face_images")[0] if data.get("face_images") else None)
        
        if not employee_id or not image_data:
            raise HTTPException(status_code=400, detail="Employee ID and Image are required")
        
        supabase = get_supabase()

        # 1. Check if employee exists and is active
        emp_res = supabase.table("employees").select("employee_id").eq("employee_id", employee_id).execute()
        
        if not emp_res.data:
            raise HTTPException(status_code=404, detail=f"Employee ID {employee_id} not found.")

        # 2. Check if already enrolled (active enrollment)
        enroll_check = supabase.table("face_enrollments").select("id").eq("employee_id", employee_id).eq("is_active", True).execute()
        if enroll_check.data:
            raise HTTPException(status_code=400, detail=f"Employee {employee_id} is already enrolled.")

        # 3. Convert base64 to image
        image = base64_to_image(image_data)
        
        # 4. Check liveness (MiniFASNet)
        is_real, confidence, message = anti_spoof_service.test_liveness(image)
        if not is_real:
            raise HTTPException(status_code=400, detail=f"Spoof attempt detected ({confidence:.2f}). Please ensure you are enrolling a live person.")

        # 5. Detect faces and ensure EXACTLY one
        face_locations, boxes, prob = face_recognition_service.detect_faces(image)
        
        if face_locations is None or len(face_locations) == 0:
            raise HTTPException(status_code=400, detail="No face detected in the image. Please ensure your face is clearly visible.")
        
        if len(face_locations) > 1:
            raise HTTPException(status_code=400, detail=f"Multiple faces ({len(face_locations)}) detected. Please ensure only one person is in the frame.")

        # 5. Generate face encoding
    
        encoding = face_recognition_service.generate_face_encoding(image)
        if encoding is None:
            raise HTTPException(status_code=400, detail="Failed to process face encoding. Please try a clearer photo.")
        
        # Convert encoding to JSON
        encoding_json = face_recognition_service.encoding_to_json(encoding)
        
        # 3. Deactivate old enrollments
        supabase.table("face_enrollments").update({"is_active": False}).eq("employee_id", employee_id).execute()
        
        # 4. Insert new enrollment
        res = supabase.table("face_enrollments").insert({
            "employee_id": employee_id,
            "face_encoding": encoding_json,
            "enrolled_at": datetime.now().isoformat(),
            "is_active": True
        }).execute()
        
        if not res.data:
            raise HTTPException(status_code=500, detail=f"Failed to save face enrollment for {employee_id}")
            
        # 5. FORCE CACHE REFRESH in attendance service
        try:
            attendance_service._refresh_enrollment_cache(force=True)
            print(f"DEBUG: Performance Cache Refreshed for {employee_id}")
        except Exception as cache_err:
            print(f"Non-critical error refreshing cache: {cache_err}")

        return {"success": True, "message": f"Face enrolled for {employee_id}"}
    except HTTPException as he:
        # Re-raise HTTP exceptions to maintain status codes
        raise he
    except Exception as e:
        print(f"Enrollment Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/v1/admin/delete-face-enrollment/{employee_id}")
async def delete_face_enrollment(employee_id: str):
    """Deactivate all face enrollments for an employee (manager action)"""
    employee_id = employee_id.strip()
    try:
        supabase = get_supabase()

        # Check if there are active enrollments
        enroll_res = supabase.table("face_enrollments").select("id").eq("employee_id", employee_id).eq("is_active", True).execute()
        if not enroll_res.data:
            raise HTTPException(status_code=404, detail=f"No active face enrollment found for employee {employee_id}")

        # Deactivate all enrollments for this employee
        supabase.table("face_enrollments").update({"is_active": False}).eq("employee_id", employee_id).execute()

        # Force refresh the recognition cache
        try:
            attendance_service._refresh_enrollment_cache(force=True)
        except Exception as cache_err:
            print(f"Non-critical cache refresh error: {cache_err}")

        return {"success": True, "message": f"Face enrollment deleted for {employee_id}"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/attendance/status")
async def get_current_user_status(employee_id: Optional[str] = None):
    """Check current attendance session status for the logged in employee"""
    # In a bridge scenario, we expect employee_id to be passed or extracted from token
    if not employee_id:
        return {"success": False, "message": "Employee ID required"}
        
    try:
        session = attendance_service.get_active_session(employee_id)
        return {
            "success": True,
            "has_active_session": session is not None,
            "session": session
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/attendance/status/{employee_id}")
async def get_attendance_status_by_id(employee_id: str):
    """Check current attendance session status for an employee"""
    try:
        session = attendance_service.get_active_session(employee_id)
        return {
            "success": True,
            "is_active": session is not None,
            "has_active_session": session is not None,
            "session": session
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/attendance/my-attendance")
async def get_my_attendance(
    employee_id: str, 
    limit: int = 100, 
    offset: int = 0,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Fetch attendance records for the logged in employee"""
    return await admin_service.get_attendance_records(
        employee_id=employee_id,
        limit=limit,
        offset=offset,
        date_from=date_from,
        date_to=date_to
    )

@app.get("/api/v1/attendance/stats")
async def get_my_attendance_stats(
    employee_id: str,
    date_from: str,
    date_to: str
):
    """Fetch summarized attendance stats for an employee (query params)"""
    return await admin_service.get_employee_stats(
        employee_id=employee_id,
        date_from=date_from,
        date_to=date_to
    )


@app.get("/api/v1/attendance/stats/{employee_id}")
async def get_attendance_stats_by_id(
    employee_id: str,
    date_from: str = Query(...),
    date_to: str = Query(...)
):
    """Fetch summarized attendance stats for an employee (path param)"""
    return await admin_service.get_employee_stats(
        employee_id=employee_id,
        date_from=date_from,
        date_to=date_to
    )

@app.post("/api/v1/attendance/mark")
async def mark_attendance(request: Request):
    """Mark attendance with face and location"""
    try:
        data = await request.json()
        image_data = data.get("image") or data.get("face_image")
        lat = data.get("latitude")
        lon = data.get("longitude")
        employee_id = data.get("employee_id")
        location_address = data.get("location_address")
        is_field_work = data.get("is_field_work", False)
        action = data.get("action", "entry")
        
        if not image_data or lat is None or lon is None:
            raise HTTPException(status_code=400, detail="Missing required data")
        
        image = base64_to_image(image_data)
        
        office_lat = float(os.getenv("OFFICE_ZONE_LAT", 13.0798))
        office_lon = float(os.getenv("OFFICE_ZONE_LNG", 80.2263))
        radius = float(os.getenv("GPS_ACCURACY_THRESHOLD", 500)) / 1000.0
        
        success, message, att_info = attendance_service.mark_attendance(
            None, image, lat, lon, office_lat, office_lon, radius, 
            action=action, employee_id=employee_id, location_address=location_address,
            is_field_work=is_field_work
        )
        
        if not success:
            return {"success": False, "message": message}
            
        return {"success": True, "message": message, "data": att_info}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/attendance/mark-quick")
async def mark_attendance_quick(request: Request, background_tasks: BackgroundTasks):
    """Mark attendance with optimized response time for Quick Attendance"""
    try:
        data = await request.json()
        image_data = data.get("image") or data.get("face_image")
        lat = data.get("latitude")
        lon = data.get("longitude")
        employee_id = data.get("employee_id")
        location_address = data.get("location_address")
        is_field_work = data.get("is_field_work", False)
        action = data.get("action", "entry")
        
        if not image_data or lat is None or lon is None:
            raise HTTPException(status_code=400, detail="Missing required data")
        
        image = base64_to_image(image_data)
        
        office_lat = float(os.getenv("OFFICE_ZONE_LAT", 13.0798))
        office_lon = float(os.getenv("OFFICE_ZONE_LNG", 80.2263))
        radius = float(os.getenv("GPS_ACCURACY_THRESHOLD", 500)) / 1000.0
        
        # Call mark_attendance with background_tasks for faster response
        success, message, att_info = attendance_service.mark_attendance(
            None, image, lat, lon, office_lat, office_lon, radius, 
            action=action, employee_id=employee_id, location_address=location_address,
            is_field_work=is_field_work,
            background_tasks=background_tasks
        )
        
        if not success:
            return {"success": False, "message": message}
            
        return {"success": True, "message": message, "data": att_info}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/admin/filter-options")
async def get_filter_options():
    return await admin_service.get_filter_options()

@app.get("/api/v1/admin/dashboard-stats")
async def get_dashboard_stats():
    return await admin_service.get_dashboard_stats()

@app.get("/api/v1/admin/attendance-records")
async def get_attendance_records(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    employee_id: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    return await admin_service.get_attendance_records(
        date_from=date_from,
        date_to=date_to,
        employee_id=employee_id,
        limit=limit,
        offset=offset
    )

@app.get("/api/v1/admin/reports/summary")
async def get_summary_report(date_from: str, date_to: str):
    return await admin_service.get_summary_report(date_from, date_to)

@app.get("/api/v1/admin/reports/daily")
async def get_daily_report(date: str):
    return await admin_service.get_daily_report(date)

@app.get("/api/v1/admin/reports/aggregated")
async def get_aggregated_report(
    date_from: str,
    date_to: str,
    employee_id: Optional[str] = None,
    attendance_type: Optional[str] = None
):
    return await admin_service.get_aggregated_report(date_from, date_to, employee_id, attendance_type)

@app.get("/api/v1/admin/reports/employee-summary")
async def get_employee_summary_report(date_from: str, date_to: str):
    return await admin_service.get_employee_summary_report(date_from, date_to)

@app.get("/api/v1/admin/employees")
async def get_all_employees():
    return await admin_service.get_all_employees()

@app.get("/api/v1/admin/departments")
async def get_departments():
    return await admin_service.get_departments_list()

@app.put("/api/v1/admin/employees/{employee_id}")
async def update_employee(employee_id: str, request: Request):
    data = await request.json()
    return await admin_service.update_employee(employee_id, data)

@app.delete("/api/v1/admin/delete-employee/{employee_id}")
async def delete_employee(employee_id: str):
    return await admin_service.delete_employee(employee_id)

@app.delete("/api/v1/admin/attendance/{record_id}")
async def delete_attendance_record(record_id: str):
    return await admin_service.delete_attendance_record(record_id)

@app.post("/api/v1/attendance/auto-logout")
async def trigger_auto_logout():
    """
    Manually trigger the midnight auto-logout process.
    This endpoint allows testing the auto-logout functionality.
    """
    try:
        result = attendance_service.close_today_active_sessions()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
