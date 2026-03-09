// ─────────────────────────────────────────────────────────────
//  API Configuration
//  • For local dev  → set VITE_API_BASE_URL in .env
//  • For production → set VITE_API_BASE_URL in .env.production
//    (or as an environment variable in your hosting platform)
// ─────────────────────────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default API_BASE_URL;


