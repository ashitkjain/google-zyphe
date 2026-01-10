
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp,
  // Firestore, // Removed as type might cause issues with some bundlers
  deleteDoc,
  writeBatch
  // FirestoreError // Removed as type might cause issues with some bundlers
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  // Auth, // Removed as type might cause issues with some bundlers
  deleteUser
} from "firebase/auth";
import { PropertyData, CustomAIAnalysisResult, ComprehensiveAnalysisResult, UserProfile, ImageQualityAnalysisResult } from "../types";

/**
 * FIRESTORE SECURITY RULES (REQUIRED):
 * To resolve "Missing or insufficient permissions" errors, deploy these rules in your Firebase Console:
 * 
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /properties/{zpid} {
 *       allow read, write: if true;
 *     }
 *     match /property_analyses_visual/{zpid} {
 *       allow read, write: if true;
 *     }
 *     match /property_analyses_comprehensive/{zpid} {
 *       allow read, write: if true;
 *     }
 *     match /image_quality_analysis/{zpid} {
 *       allow read, write: if true;
 *     }
 *     match /user_activity/{docId} {
 *       allow write: if true;
 *       allow read: if false;
 *     }
 *     match /users/{userId} {
 *       allow read, write: if request.auth != null && request.auth.uid == userId;
 *       match /viewHistory/{zpid} {
 *         allow read, write: if request.auth != null && request.auth.uid == userId;
 *       }
 *     }
 *   }
 * }
 */

const firebaseConfig = {
  apiKey: "AIzaSyAj8uT4osd5uUrG-ZdXKZyFxtceYAbww8w",
  authDomain: "zyphe-af0bf.firebaseapp.com",
  projectId: "zyphe-af0bf",
  storageBucket: "zyphe-af0bf.firebasestorage.app",
  messagingSenderId: "365448651061",
  appId: "1:365448651061:web:8d297a7e3713606f363065"
};

let app: FirebaseApp | null = null;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (e) {
  console.error("Firebase App initialization failed:", e);
}

let db: any = null; // Used any to avoid Firestore type error
try {
  if (app) db = getFirestore(app);
} catch (e) {
  console.error("Firestore service initialization failed:", e);
}

let authInstance: any = null; // Used any to avoid Auth type error
try {
  if (app) authInstance = getAuth(app);
} catch (e) {
  console.error("Auth service initialization failed:", e);
}

export const db_instance = db;
export const auth = authInstance;
export const googleProvider = new GoogleAuthProvider();

const sanitizeForFirestore = (data: any): any => {
  if (data === undefined || data === null) return null;
  if (Array.isArray(data)) return data.map(sanitizeForFirestore);
  if (typeof data === 'object') {
    if (data instanceof Date) return data;
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, sanitizeForFirestore(value)])
    );
  }
  return data;
};

const handleFirestoreError = (error: any, context: string) => {
  if (error?.code === 'permission-denied') {
    console.warn(`[Firestore ${context}] Missing or insufficient permissions. Intelligence will not be cached in the cloud.`);
    return false;
  }
  console.error(`[Firestore ${context}] Error:`, error);
  return false;
};

export const saveUserProfile = async (uid: string, profile: Partial<UserProfile>) => {
  if (!db) {
    console.error("[Firestore] Database service not initialized.");
    return false;
  }
  try {
    console.log(`[Firestore] Attempting to save profile for UID: ${uid}`, profile);
    const userRef = doc(db, "users", uid);
    const sanitized = sanitizeForFirestore(profile);
    await setDoc(userRef, {
      ...sanitized,
      uid,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log("[Firestore] Profile saved successfully.");
    return true;
  } catch (error) {
    console.error("[Firestore] saveUserProfile error:", error);
    return handleFirestoreError(error, "saveUserProfile");
  }
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  if (!db) return null;
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch (error: any) {
    handleFirestoreError(error, "getUserProfile");
    return null;
  }
};

export const deleteUserAccount = async (uid: string) => {
  if (!auth) throw new Error("Authentication service not initialized.");
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user found.");

  // Attempt to clean up Firestore data, but don't block account deletion if permissions fail
  try {
    if (db) {
      const profileRef = doc(db, "users", uid);
      const historyCol = collection(db, "users", uid, "viewHistory");
      const historySnap = await getDocs(historyCol);
      const batch = writeBatch(db);

      historySnap.docs.forEach((doc) => batch.delete(doc.ref));
      batch.delete(profileRef);

      await batch.commit();
      console.log("[Firestore] Account data cleaned up successfully.");
    }
  } catch (error) {
    console.warn("[Firestore] Failed to clean up user data (likely permission denied), proceeding with account deletion:", error);
  }

  try {
    await deleteUser(user);
    console.log("[Auth] Account deleted successfully.");
    return true;
  } catch (error: any) {
    console.error("[Auth] Error deleting account:", error);
    if (error.code === 'auth/requires-recent-login') {
      throw new Error("This sensitive operation requires a recent login. Please sign out and sign back in before trying again.");
    }
    throw new Error(error.message || "Failed to delete account. Please try again later.");
  }
};

export const trackUserPropertyView = async (uid: string, property: PropertyData) => {
  if (!db || !property.zpid) return;
  try {
    const historyRef = doc(db, "users", uid, "viewHistory", property.zpid);
    await setDoc(historyRef, {
      zpid: property.zpid,
      address: property.address,
      homeType: property.homeType || null,
      price: property.price || property.zestimate || null,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, "trackUserPropertyView");
  }
};

export const getUserViewHistory = async (uid: string, maxItems = 6) => {
  if (!db) return [];
  try {
    const historyCol = collection(db, "users", uid, "viewHistory");
    const q = query(historyCol, orderBy("timestamp", "desc"), limit(maxItems));
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data());
  } catch (error) {
    handleFirestoreError(error, "getUserViewHistory");
    return [];
  }
};

export const savePropertyToCloud = async (zpid: string, data: Partial<PropertyData>) => {
  if (!db) return false;
  try {
    const docRef = doc(db, "properties", zpid);
    const sanitized = sanitizeForFirestore(data);
    await setDoc(docRef, {
      ...sanitized,
      lastUpdated: serverTimestamp()
    }, { merge: true });
    return true;
  } catch (error: any) {
    return handleFirestoreError(error, "savePropertyToCloud");
  }
};

export const getPropertyFromCloud = async (zpid: string): Promise<PropertyData | null> => {
  if (!db) return null;
  try {
    const docRef = doc(db, "properties", zpid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as PropertyData;
    }
    return null;
  } catch (error: any) {
    handleFirestoreError(error, "getPropertyFromCloud");
    return null;
  }
};

export const saveVisualAnalysisToCloud = async (zpid: string, analysis: CustomAIAnalysisResult) => {
  if (!db) return false;
  try {
    const docRef = doc(db, "property_analyses_visual", zpid);
    await setDoc(docRef, {
      ...sanitizeForFirestore(analysis),
      timestamp: serverTimestamp()
    });
    return true;
  } catch (error) {
    return handleFirestoreError(error, "saveVisualAnalysisToCloud");
  }
};

export const getVisualAnalysisFromCloud = async (zpid: string): Promise<CustomAIAnalysisResult | null> => {
  if (!db) return null;
  try {
    const docRef = doc(db, "property_analyses_visual", zpid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as CustomAIAnalysisResult) : null;
  } catch (error) {
    handleFirestoreError(error, "getVisualAnalysisFromCloud");
    return null;
  }
};

export const saveComprehensiveAnalysisToCloud = async (zpid: string, analysis: ComprehensiveAnalysisResult) => {
  if (!db) return false;
  try {
    const docRef = doc(db, "property_analyses_comprehensive", zpid);
    await setDoc(docRef, {
      ...sanitizeForFirestore(analysis),
      timestamp: serverTimestamp()
    });
    return true;
  } catch (error) {
    return handleFirestoreError(error, "saveComprehensiveAnalysisToCloud");
  }
};

export const getComprehensiveAnalysisFromCloud = async (zpid: string): Promise<ComprehensiveAnalysisResult | null> => {
  if (!db) return null;
  try {
    const docRef = doc(db, "property_analyses_comprehensive", zpid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as ComprehensiveAnalysisResult) : null;
  } catch (error) {
    handleFirestoreError(error, "getComprehensiveAnalysisFromCloud");
    return null;
  }
};

export const saveImageQualityAnalysisToCloud = async (zpid: string, analysis: ImageQualityAnalysisResult) => {
  if (!db) return false;
  try {
    const docRef = doc(db, "image_quality_analysis", zpid);
    await setDoc(docRef, {
      ...sanitizeForFirestore(analysis),
      timestamp: serverTimestamp()
    });
    return true;
  } catch (error) {
    return handleFirestoreError(error, "saveImageQualityAnalysisToCloud");
  }
};

export const getImageQualityAnalysisFromCloud = async (zpid: string): Promise<ImageQualityAnalysisResult | null> => {
  if (!db) return null;
  try {
    const docRef = doc(db, "image_quality_analysis", zpid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as ImageQualityAnalysisResult) : null;
  } catch (error) {
    handleFirestoreError(error, "getImageQualityAnalysisFromCloud");
    return null;
  }
};

export const logUserActivity = async (sessionId: string, address: string) => {
  if (!db) return;
  try {
    const activityRef = doc(collection(db, "user_activity"));
    await setDoc(activityRef, {
      sessionId,
      address,
      timestamp: serverTimestamp()
    });
  } catch (error) {
  }
};
