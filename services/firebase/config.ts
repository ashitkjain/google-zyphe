import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { initializeFirestore, memoryLocalCache, Firestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, Auth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBiP85bXTptTAqvXUh4JwYC-6SQJqwukvI",
    authDomain: "zyphe-af0bf.firebaseapp.com",
    projectId: "zyphe-af0bf",
    storageBucket: "zyphe-af0bf.firebasestorage.app",
    messagingSenderId: "434538487700",
    appId: "1:434538487700:web:2d0880addbfdca71c13981",
    measurementId: "G-S07B3J7TJZ"
};

let app: FirebaseApp | null = null;
try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (e) {
    console.error("Firebase App initialization failed:", e);
}

let _db: Firestore | null = null;
try {
    if (app) {
        _db = initializeFirestore(app, {
            localCache: memoryLocalCache()
        });
    }
} catch (e) {
    console.error("Firestore service initialization failed:", e);
}

let authInstance: Auth | null = null;
try {
    if (app) authInstance = getAuth(app);
} catch (e) {
    console.error("Auth service initialization failed:", e);
}

let _storage: FirebaseStorage | null = null;
try {
    if (app) _storage = getStorage(app);
} catch (e) {
    console.error("Storage initialization failed:", e);
}

export const db = _db;
export const db_instance = _db;
export const auth = authInstance;
export const storage = _storage;
export const storage_instance = _storage;
export const googleProvider = new GoogleAuthProvider();

// Initialize Functions
import { getFunctions } from "firebase/functions";
let _functions: any = null;
try {
    if (app) _functions = getFunctions(app);
} catch (e) {
    console.error("Functions initialization failed:", e);
}
export const functions = _functions;

export const sanitizeForFirestore = (data: any): any => {
    if (data === undefined || data === null) return null;
    if (Array.isArray(data)) return data.map(sanitizeForFirestore);
    if (typeof data === 'object') {
        // Prevent decomposition of Date objects, Firestore Timestamps, and FieldValues (serverTimestamp)
        if (data instanceof Date ||
            typeof data.toDate === 'function' ||
            data?._methodName === 'serverTimestamp' ||
            data?.constructor?.name === 'FieldValueImpl' ||
            data?.constructor?.name === 'FieldValue') {
            return data;
        }

        return Object.fromEntries(
            Object.entries(data).map(([key, value]) => [key, sanitizeForFirestore(value)])
        );
    }
    return data;
};

export const logFirestoreQuery = (operation: string, collection: string, details: any) => {
    console.log(`%c[Firestore] ${operation}`, 'color: #6366f1; font-weight: bold;', {
        collection,
        ...details,
        timestamp: new Date().toISOString()
    });
};

export const handleFirestoreError = (error: any, context: string) => {
    const message = error?.message || String(error);
    if (error?.code === 'permission-denied') {
        const uid = auth?.currentUser?.uid || 'NOT_LOGGED_IN';
        const permError = `[Firestore ${context}] Permission Denied (UID: ${uid}). Ensure your security rules allow the current user to access this collection.`;
        console.warn(permError);
        return permError;
    }
    const genericError = `[Firestore ${context}] Error: ${message}`;
    console.error(genericError);
    return genericError;
};

/**
 * Generates a standardized, duplicate-proof key for city-state data.
 * Format: "LosAngeles-CA" (Case insensitive, spaces removed)
 */
export const generateCityStateKey = (city: string | undefined, state: string | undefined): string | null => {
    if (!city || !state) return null;

    // Standardize: Remove spaces, capitalization to TitleCase or just remove spaces and uppercase state
    const cleanCity = city.replace(/\s+/g, '').replace(/[^a-zA-Z]/g, '');
    const cleanState = state.replace(/\s+/g, '').replace(/[^a-zA-Z]/g, '').toUpperCase();

    if (!cleanCity || !cleanState) return null;

    return `${cleanCity}-${cleanState}`;
};
