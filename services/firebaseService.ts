import { initializeApp, getApps, getApp } from "firebase/app";
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
  serverTimestamp 
} from "firebase/firestore";
import { PropertyData, CustomAIAnalysisResult, ComprehensiveAnalysisResult } from "../types";

/**
 * Zyphe Firebase Configuration
 */
const getSafeApiKey = (): string => {
  // Use the default key provided by the user
  const key = "AIzaSyDtYf5fFDgCsLK8ndaVXQmJcfv2c5ogcfQ";
  return key;
};

const firebaseConfig = {
  apiKey: getSafeApiKey(),
  authDomain: "zyphe-af0bf.firebaseapp.com",
  projectId: "zyphe-af0bf",
  storageBucket: "zyphe-af0bf.firebasestorage.app",
  messagingSenderId: "365448651061",
  appId: "1:365448651061:web:8d297a7e3713606f363065"
};

/**
 * Utility to sanitize data for Firestore.
 */
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

// Initialize Firebase App instance
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

/**
 * TABLE: properties
 */
export const savePropertyToCloud = async (zpid: string, data: Partial<PropertyData>) => {
  try {
    const docRef = doc(db, "properties", zpid);
    const sanitized = sanitizeForFirestore(data);
    await setDoc(docRef, {
      ...sanitized,
      lastUpdated: serverTimestamp()
    }, { merge: true });
    return true;
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      console.warn("Firestore Permission Denied: Please set Rules to 'allow read, write: if true;' in Firebase Console.");
    } else {
      console.error("Firestore Save Error (properties):", error);
    }
    return false;
  }
};

export const getPropertyFromCloud = async (zpid: string): Promise<PropertyData | null> => {
  try {
    const docRef = doc(db, "properties", zpid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as PropertyData;
    }
    return null;
  } catch (error: any) {
    console.debug("Cloud Cache unavailable (Permission Denied)");
    return null;
  }
};

export const getPropertyByAddress = async (address: string): Promise<PropertyData | null> => {
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
    console.debug("Cloud Search unavailable (Permission Denied)");
    return null;
  }
};

/**
 * TABLE: property_analyses_visual
 */
export const saveVisualAnalysisToCloud = async (zpid: string, analysis: CustomAIAnalysisResult) => {
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
  try {
    const docRef = doc(db, "property_analyses_visual", zpid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as CustomAIAnalysisResult) : null;
  } catch (error) {
    return null;
  }
};

/**
 * TABLE: property_analyses_comprehensive
 */
export const saveComprehensiveAnalysisToCloud = async (zpid: string, analysis: ComprehensiveAnalysisResult) => {
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
  try {
    const docRef = doc(db, "property_analyses_comprehensive", zpid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as ComprehensiveAnalysisResult) : null;
  } catch (error) {
    return null;
  }
};

/**
 * Activity Logging
 */
export const logUserActivity = async (sessionId: string, address: string) => {
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
