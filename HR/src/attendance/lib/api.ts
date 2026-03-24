// Use centralized API_BASE from config
// This avoids hardcoded URLs and works in both dev and production
import { API_BASE } from "../../config";

// Re-export API_BASE for convenience in other files
export { API_BASE };

type FetchOptions = RequestInit & { includeAuth?: boolean };

/**
 * Centralized API fetch function with error handling
 * @param path - API endpoint path (with or without leading slash)
 * @param options - Fetch options
 * @returns Response object
 */
export async function apiFetch(path: string, options: FetchOptions = {}) {
  // Normalize path to ensure single leading slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE}${normalizedPath}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    // Log for debugging (can be removed in production)
    if (!response.ok) {
      console.error(`[API] ${response.status} ${response.statusText}: ${url}`);
    }

    return response;
  } catch (error) {
    console.error(`[API] Network error:`, error);
    throw error;
  }
}

export default apiFetch;

