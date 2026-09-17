const DB_NAME = 'cgl_app_cache';
const STORE_NAME = 'datasets';
const CACHE_KEY = 'subject_data_v4';

// Singleton DB connection — opened once, reused on every call
let dbPromise: Promise<IDBDatabase | null> | null = null;

const getDB = (): Promise<IDBDatabase | null> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return resolve(null);
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        try {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        } catch {
          resolve(null);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null; // allow retry on next call
        resolve(null); // Never reject — prevents "Access to storage is not allowed from this context" uncaught error
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });
  return dbPromise;
};

export const getCachedData = async <T>(): Promise<T | null> => {
  try {
    const db = await getDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(CACHE_KEY);
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
};

export const setCachedData = async <T>(data: T): Promise<void> => {
  try {
    const db = await getDB();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(data, CACHE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // Silently ignore — cache failure is non-fatal
  }
};

export const clearCachedData = async (): Promise<void> => {
  try {
    const db = await getDB();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(CACHE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // Silently ignore
  }
};

