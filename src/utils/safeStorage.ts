/**
 * Safe wrapper around window.localStorage that never throws:
 * "SecurityError: Access to storage is not allowed from this context."
 * Handles blocked third-party storage, iframes, incognito modes, and server-side rendering safely.
 * Includes an in-memory fallback store so session state remains operational when localStorage is disabled.
 */
let localStorageAvailable = false;
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    localStorageAvailable = true;
  }
} catch {
  localStorageAvailable = false;
}

const memStore = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    if (localStorageAvailable) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return memStore.get(key) ?? null;
      }
    }
    return memStore.get(key) ?? null;
  },

  setItem(key: string, value: string): void {
    if (localStorageAvailable) {
      try {
        window.localStorage.setItem(key, value);
        if (memStore.has(key)) memStore.delete(key);
        return;
      } catch {
        // Fallback to in-memory store if localStorage is full or disabled
      }
    }
    memStore.set(key, value);
  },

  removeItem(key: string): void {
    if (localStorageAvailable) {
      try {
        window.localStorage.removeItem(key);
      } catch {}
    }
    memStore.delete(key);
  },

  getAllKeys(): string[] {
    if (localStorageAvailable) {
      try {
        const keys: string[] = [];
        const len = window.localStorage.length;
        for (let i = 0; i < len; i++) {
          const k = window.localStorage.key(i);
          if (k) keys.push(k);
        }
        return keys;
      } catch {}
    }
    return Array.from(memStore.keys());
  },

  clearStaleTemporaryCaches(): void {
    if (!localStorageAvailable) {
      memStore.clear();
      return;
    }
    try {
      const keysToRemove: string[] = [];
      const len = window.localStorage.length;
      for (let i = 0; i < len; i++) {
        const k = window.localStorage.key(i);
        if (k && (k.startsWith('temp_') || k.startsWith('offline_results_') || k.includes('_cache_backup_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => window.localStorage.removeItem(k));
      memStore.clear();
    } catch {}
  }
};

