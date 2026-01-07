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
  limit,
  serverTimestamp,
  Firestore
} from "firebase/firestore";
import { 
  getAuth, 
  GoogleAuthProvider, 
  Auth
} from "firebase/auth";
import { PropertyData, CustomAIAnalysisResult, ComprehensiveAnalysisResult, UserProfile } from "../types.ts";

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
  console.error("Firestore service initialization failed (it might be blocked by an ad-blocker):", e);
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

/**
 * User Profile Management
 */
export const saveUserProfile = async (uid: string, profile: Partial<UserProfile>) => {
  if (!db) return false;
  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, {
      ...profile,
      uid,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return true;
  } catch (error) {
    console.error("Error saving user profile:", error);
    throw error;
  }
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  if (!db) return null;
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
};

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
    console.error("Firestore Save Error (properties):", error);
    return false;
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
    return false;
  }
};

export const getVisualAnalysisFromCloud = async (zpid: string): Promise<CustomAIAnalysisResult | null> => {
  if (!db) return null;
  try {
    const docRef = doc(db, "property_analyses_visual", zpid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as CustomAIAnalysisResult) : null;
  } catch (error) {
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
    return false;
  }
};

export const getComprehensiveAnalysisFromCloud = async (zpid: string): Promise<ComprehensiveAnalysisResult | null> => {
  if (!db) return null;
  try {
    const docRef = doc(db, "property_analyses_comprehensive", zpid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as ComprehensiveAnalysisResult) : null;
  } catch (error) {
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
    // Silent catch
  }
};