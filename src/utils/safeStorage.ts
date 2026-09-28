/**
 * Safe wrapper around window.localStorage that never throws:
 * "SecurityError: Access to storage is not allowed from this context."
 * Handles blocked third-party storage, iframes, incognito modes, and server-side rendering safely.
 * Includes an in-memory fallback store so session state remains operational when localStorage is disabled.
 */
const memStore = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window === 'undefined') return memStore.get(key) ?? null;
      const val = window.localStorage.getItem(key);
      return val !== null ? val : (memStore.get(key) ?? null);
    } catch {
      return memStore.get(key) ?? null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      memStore.set(key, value);
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(key, value);
    } catch {
      // Memory store already updated
    }
  },

  removeItem(key: string): void {
    try {
      memStore.delete(key);
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(key);
    } catch {
      // Memory store already updated
    }
  },

  getAllKeys(): string[] {
    try {
      const keys = new Set<string>(memStore.keys());
      if (typeof window !== 'undefined') {
        const len = window.localStorage.length;
        for (let i = 0; i < len; i++) {
          const k = window.localStorage.key(i);
          if (k) keys.add(k);
        }
      }
      return Array.from(keys);
    } catch {
      return Array.from(memStore.keys());
    }
  }
};

