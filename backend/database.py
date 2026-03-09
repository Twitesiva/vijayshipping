
import os
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

# Load the shared .env from the project root (one level above backend/)
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not url or not key or "your-project-id" in (url or ""):
    # If using placeholders, the app will start but database queries will fail.
    # We warn instead of crashing immediately to allow the server to boot.
    print("[WARNING] Supabase placeholders detected in .env. Connectivity will fail.")
    supabase = None
else:
    supabase: Client = create_client(url, key)

def get_supabase() -> Client:
    return supabase
