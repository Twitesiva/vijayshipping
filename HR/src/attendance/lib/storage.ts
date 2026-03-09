export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('token');
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('token', token);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('token');
}

export function getUser<T = unknown>(): T | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setUser(user: unknown) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('user', JSON.stringify(user));
}

export function clearUser() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('user');
}
