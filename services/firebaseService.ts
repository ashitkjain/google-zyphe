
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
  Firestore,
  deleteDoc,
  writeBatch,
  FirestoreError
} from "firebase/firestore";
import { 
  getAuth, 
  GoogleAuthProvider, 
  Auth,
  deleteUser
} from "firebase/auth";
import { PropertyData, CustomAIAnalysisResult, ComprehensiveAnalysisResult, UserProfile } from "../types.ts";

/**
 * FIRESTORE SECURITY RULES (REQUIRED):
 * To resolve "Missing or insufficient permissions" errors, deploy these rules in your Firebase Console:
 * 
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     // Shared property cache - allow read/write for all users to enable global intelligence caching
 *     match /properties/{zpid} {
 *       allow read, write: if true;
 *     }
 *     match /property_analyses_visual/{zpid} {
 *       allow read, write: if true;
 *     }
 *     match /property_analyses_comprehensive/{zpid} {
 *       allow read, write: if true;
 *     }
 *     match /user_activity/{docId} {
 *       allow write: if true;
 *       allow read: if false;
 *     }
 *     
 *     // User-specific data - strictly restricted to the owner
 *     match /users/{userId} {
 *       allow read, write: if request.auth != null && request.auth.uid == userId;
 *       
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

// Initialize Firebase App
let app: FirebaseApp | null = null;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (e) {
  console.error("Firebase App initialization failed:", e);
}

// Initialize Firestore with safety
let db: Firestore | null = null;
try {
  if (app) db = getFirestore(app);
} catch (e) {
  console.error("Firestore service initialization failed:", e);
}

// Initialize Auth with safety
let authInstance: Auth | null = null;
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

/**
 * Internal helper to handle Firestore errors gracefully.
 * Prevents non-critical background task failures from interrupting user experience.
 */
const handleFirestoreError = (error: any, context: string) => {
  if (error?.code === 'permission-denied') {
    console.warn(`[Firestore ${context}] Missing or insufficient permissions. This property intelligence will not be cached in the cloud, but the session remains active. Ensure your Firestore Security Rules allow writes to the appropriate collection.`);
    return false;
  }
  console.error(`[Firestore ${context}] Error:`, error);
  return false;
};

/**
 * User Profile Management
 */
export const saveUserProfile = async (uid: string, profile: Partial<UserProfile>) => {
  if (!db) return false;
  try {
    const userRef = doc(db, "users", uid);
    const sanitized = sanitizeForFirestore(profile);
    await setDoc(userRef, {
      ...sanitized,
      uid,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return true;
  } catch (error) {
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

/**
 * Delete User Account
 */
export const deleteUserAccount = async (uid: string) => {
  if (!db || !auth || !auth.currentUser) throw new Error("Authentication state missing.");
  
  try {
    const user = auth.currentUser;
    const profileRef = doc(db, "users", uid);
    const historyCol = collection(db, "users", uid, "viewHistory");
    const historySnap = await getDocs(historyCol);
    
    const batch = writeBatch(db);
    historySnap.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(profileRef);
    await batch.commit();

    await deleteUser(user);
    return true;
  } catch (error: any) {
    console.error("Error deleting account:", error);
    if (error.code === 'auth/requires-recent-login') {
      throw new Error("This sensitive operation requires a recent login. Please sign out and sign back in to delete your account.");
    }
    throw error;
  }
};

/**
 * User View History
 */
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

export const getPropertyByAddress = async (address: string): Promise<PropertyData | null> => {
  if (!db) return null;
  try {
    const q = query(
      collection(db, "properties"), 
      where("address", "==", address),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data() as PropertyData;
    }
    return null;
  } catch (error: any) {
    handleFirestoreError(error, "getPropertyByAddress");
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
    // Silently handle activity logging failures
  }
};
