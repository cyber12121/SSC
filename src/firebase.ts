import { initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  doc
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with memory cache so IndexedDB storage restrictions
// (which cause "Access to storage is not allowed from this context" and "AbortError: signal is aborted without reason")
// do not trigger unhandled promise rejections or abort ongoing fetch streams.
let firestoreDb: ReturnType<typeof getFirestore>;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      localCache: memoryLocalCache()
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreDb;

// Initialize Firebase Auth with graceful persistence fallbacks
// In restricted browser contexts, extensions, or third-party iframes, IndexedDB/storage can throw:
// "SecurityError: Access to storage is not allowed from this context."
let firebaseAuth: ReturnType<typeof getAuth>;
try {
  // Test if storage is actually accessible before requesting persistence
  const isStorageUsable = (() => {
    try {
      if (typeof window === 'undefined') return false;
      const test = '__fb_storage_test__';
      window.localStorage.setItem(test, test);
      window.localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  })();

  if (isStorageUsable) {
    try {
      firebaseAuth = initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence]
      });
    } catch {
      firebaseAuth = getAuth(app);
    }
  } else {
    // If storage is blocked by browser policy, use inMemoryPersistence directly
    try {
      firebaseAuth = initializeAuth(app, {
        persistence: inMemoryPersistence
      });
    } catch {
      firebaseAuth = getAuth(app);
    }
  }
} catch (e) {
  console.warn('[Firebase] Fallback initializing auth with getAuth:', e);
  try {
    firebaseAuth = getAuth(app);
  } catch {
    firebaseAuth = initializeAuth(app, {
      persistence: inMemoryPersistence
    });
  }
}

export const auth = firebaseAuth;
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
