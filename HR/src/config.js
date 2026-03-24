// ─────────────────────────────────────────────────────────────
//  API Configuration
//  • For local dev  → set VITE_API_BASE_URL in .env.development
//  • For production → set VITE_API_BASE_URL in .env.production
// ─────────────────────────────────────────────────────────────

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;

// Determine BASE_URL based on environment
// Only fallback to localhost if the variable is truly NOT defined
const BASE_URL = (rawBaseUrl !== undefined) ? rawBaseUrl : "http://localhost:8000";

// API Base with /api/v1 prefix
// - Development: http://localhost:8000/api/v1
// - Production:  /api/v1 (relative URL when nginx proxies /api)
export const API_BASE = BASE_URL 
  ? `${BASE_URL}/api/v1` 
  : "/api/v1";

// Legacy export for backward compatibility
export default BASE_URL;
