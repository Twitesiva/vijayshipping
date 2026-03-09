
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date

class User(BaseModel):
    id: str  # employee_id
    full_name: str
    email: str
    face_encoding: Optional[str] = None  # Base64 encoded or JSON string of embedding
    department: Optional[str] = None
    role: Optional[str] = None

class Attendance(BaseModel):
    id: Optional[int] = None
    employee_id: str
    attendance_date: date
    check_in: datetime
    check_out: Optional[datetime] = None
    status: str  # 'active' or 'completed'
    attendance_type: str # 'Office' or 'Field'
    entry_latitude: float
    entry_longitude: float
    entry_address: Optional[str] = None
    exit_latitude: Optional[float] = None
    exit_longitude: Optional[float] = None
    exit_address: Optional[str] = None
    total_hours: float = 0.0
