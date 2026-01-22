import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFirestore, Firestore } from "firebase/firestore";
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
    if (app) _db = getFirestore(app);
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

export const sanitizeForFirestore = (data: any): any => {
    if (data === undefined || data === null) return null;
    if (Array.isArray(data)) return data.map(sanitizeForFirestore);
    if (typeof data === 'object') {
        // Prevent decomposition of Date objects and Firestore Timestamps
        if (data instanceof Date || typeof data.toDate === 'function') return data;

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
