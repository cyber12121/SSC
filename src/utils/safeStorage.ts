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
  },

  compactAndEvictStaleMockCaches(maxRecentMocks = 15): void {
    if (!localStorageAvailable) return;
    try {
      const mockQuestionKeys: string[] = [];
      const keysToRemove: string[] = [];
      const len = window.localStorage.length;

      for (let i = 0; i < len; i++) {
        const k = window.localStorage.key(i);
        if (!k) continue;

        // Strip obsolete temporary and backup keys
        if (k.startsWith('temp_') || k.startsWith('offline_results_') || k.includes('_cache_backup_') || k.startsWith('test_')) {
          keysToRemove.push(k);
          continue;
        }

        if (k.startsWith('cgl_mock_questions_')) {
          mockQuestionKeys.push(k);
        }
      }

      keysToRemove.forEach(k => window.localStorage.removeItem(k));

      // Compact all cgl_mock_questions_* to strip bloated solution texts
      for (const k of mockQuestionKeys) {
        try {
          const raw = window.localStorage.getItem(k);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            let changed = false;
            const lean = parsed.map((q: any) => {
              if (q && (q.solution || q.explanation || q.detailedSolution)) {
                changed = true;
                const { solution, explanation, detailedSolution, sol, ...rest } = q;
                return { ...rest, solution: '' };
              }
              return q;
            });
            if (changed) {
              window.localStorage.setItem(k, JSON.stringify(lean));
            }
          }
        } catch {}
      }

      // If more than maxRecentMocks in localStorage, evict the oldest ones to keep browser lightweight
      if (mockQuestionKeys.length > maxRecentMocks) {
        const excess = mockQuestionKeys.slice(maxRecentMocks);
        for (const exKey of excess) {
          window.localStorage.removeItem(exKey);
        }
      }

      // Compact cgl_rca_global_store if it contains bloated solution texts
      try {
        const rawStore = window.localStorage.getItem('cgl_rca_global_store');
        if (rawStore) {
          const store = JSON.parse(rawStore);
          let changed = false;
          for (const key of Object.keys(store)) {
            const entry = store[key];
            if (entry && (entry.solution || entry.explanation || entry.detailedSolution)) {
              delete entry.solution;
              delete entry.explanation;
              delete entry.detailedSolution;
              changed = true;
            }
          }
          if (changed) {
            window.localStorage.setItem('cgl_rca_global_store', JSON.stringify(store));
          }
        }
      } catch {}
    } catch (e) {
      console.warn('[safeStorage] Error during cache compaction:', e);
    }
  }
};

