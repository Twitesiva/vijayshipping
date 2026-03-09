import API_BASE_URL from "../../config";

export const API_BASE = `${API_BASE_URL}/api/v1`;

type FetchOptions = RequestInit & { includeAuth?: boolean };

export async function apiFetch(path: string, options: FetchOptions = {}) {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  return response;
}

