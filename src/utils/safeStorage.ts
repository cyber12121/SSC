/**
 * Safe wrapper around window.localStorage that never throws:
 * "SecurityError: Access to storage is not allowed from this context."
 * Handles blocked third-party storage, iframes, incognito modes, and server-side rendering safely.
 */
export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(key, value);
    } catch {}
  },

  removeItem(key: string): void {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(key);
    } catch {}
  }
};
