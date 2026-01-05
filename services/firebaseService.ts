import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
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
import { PropertyData, AIAnalysisResult, CustomAIAnalysisResult, ComprehensiveAnalysisResult } from "../types";

// User-provided Firebase configuration (using v12.7.0 as requested)
const firebaseConfig = {
  apiKey: "AIzaSyAx1-b_G1OtFDRhHZBu29ows4oo71RTRGo",
  authDomain: "zyphe-fe1e9.firebaseapp.com",
  projectId: "zyphe-fe1e9",
  storageBucket: "zyphe-fe1e9.firebasestorage.app",
  messagingSenderId: "1068664413700",
  appId: "1:1068664413700:web:1e6b150cb963e4bfb35f51",
  measurementId: "G-1MCE2XSXJM"
};

/**
 * Recursive utility to remove undefined values from an object/array.
 * Firestore does not allow 'undefined' fields but accepts 'null'.
 */
const sanitizeForFirestore = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(sanitizeForFirestore);
  } else if (data !== null && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => [key, sanitizeForFirestore(value)])
    );
  }
  return data;
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

isSupported().then(supported => {
  if (supported) {
    getAnalytics(app);
  }
}).catch(err => {
  console.warn("Firebase Analytics failed to initialize:", err);
});

/**
 * TABLE: properties
 * Stores core house metadata, specs, and images.
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
  } catch (error) {
    console.error("Firestore Save Error (properties):", error);
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
  } catch (error) {
    console.error("Firestore Load Error (properties):", error);
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
  } catch (error) {
    console.error("Firestore Search Error (properties):", error);
    return null;
  }
};

/**
 * TABLE: property_analyses_deep
 * Stores the Gemini-generated text analysis (Buyer/Seller/Realtor).
 */
export const saveDeepAnalysisToCloud = async (zpid: string, analysis: AIAnalysisResult) => {
  try {
    const docRef = doc(db, "property_analyses_deep", zpid);
    await setDoc(docRef, {
      ...sanitizeForFirestore(analysis),
      timestamp: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error("Firestore Save Error (deep_analysis):", error);
    return false;
  }
};

export const getDeepAnalysisFromCloud = async (zpid: string): Promise<AIAnalysisResult | null> => {
  try {
    const docRef = doc(db, "property_analyses_deep", zpid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as AIAnalysisResult) : null;
  } catch (error) {
    return null;
  }
};

/**
 * TABLE: property_analyses_visual
 * Stores the Multimodal Gemini analysis (Interior, exterior, neighborhood).
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
    console.error("Firestore Save Error (visual_analysis):", error);
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
 * Stores the massive 2500-word narrative report.
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
    console.error("Firestore Save Error (comprehensive_analysis):", error);
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
    console.warn("Activity logging failed", error);
  }
};