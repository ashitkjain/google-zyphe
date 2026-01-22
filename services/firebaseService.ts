import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
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
  addDoc,
  // Firestore, // Removed as type might cause issues with some bundlers
  deleteDoc,
  updateDoc,
  writeBatch,
  increment
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  // Auth, // Removed as type might cause issues with some bundlers
  deleteUser,
  sendPasswordResetEmail
} from "firebase/auth";
import { PropertyData, CustomAIAnalysisResult, ComprehensiveAnalysisResult, UserProfile, ImageQualityAnalysisResult, InvestmentResearchResult, CommMessage, FunnelStage, LeadHealth, Lead, CRMTask, CommTemplate, PipelineNote, ReminderRule, CalendarEvent, ChecklistCategory, Document, DocumentVersion } from "../types";
import { getInitialCategories, calculateChecklistSchedule } from "./transactionService";
import { generateMockTransaction, generateMockTransactionParties, generateMockTransactionDocuments } from "./mockData";


/**
 * FIRESTORE SECURITY RULES (REQUIRED):
 * Paste this into: Firebase Console > Firestore Database > Rules tab.
 * 
 * service cloud.firestore {
 *   match /databases/{database}/documents {
    
    // 1. PUBLIC READ, AUTHENTICATED WRITE
    match /properties/{zpid} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    match /property_analyses_visual/{zpid} {
      allow read: if true;
      allow write: if request.auth != null;
    }
 
    match /property_analyses_comprehensive/{zpid} {
      allow read: if true;
      allow write: if request.auth != null;
    }
 
    match /image_quality_analysis/{zpid} {
      allow read: if true;
      allow write: if request.auth != null;
    }
 
    match /market_research/{zpid} {
      allow read: if true;
      allow write: if request.auth != null;
    }
 
    match /system_test/{docId} {
      allow read, write: if true; 
    }
 
    // 2. USER DATA & REALTOR-CLIENT ACCESS
    match /users/{userId} {
      // Users can manage their own profiles
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Realtors can read profiles of clients they invited
      allow read: if request.auth != null && 
                   resource.data.realtorId == request.auth.uid;
      
      match /viewHistory/{zpid} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
        // Realtors can see their client's view history
        allow read: if request.auth != null && 
                     get(/databases/$(database)/documents/users/$(userId)).data.realtorId == request.auth.uid;
      }
      
      match /favorites/{zpid} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
        // Realtors can see their client's favorites
        allow read: if request.auth != null && 
                     get(/databases/$(database)/documents/users/$(userId)).data.realtorId == request.auth.uid;
      }
    }
 
    // 4. CRM DATA - LEADS, TASKS, TEMPLATES, NOTES
    match /leads/{leadId} {
      allow read, write: if request.auth != null && (resource.data.realtorId == request.auth.uid || request.resource.data.realtorId == request.auth.uid);
    }
    match /tasks/{taskId} {
      allow read, write: if request.auth != null && (resource.data.realtorId == request.auth.uid || request.resource.data.realtorId == request.auth.uid);
    }
    match /templates/{templateId} {
      allow read, write: if request.auth != null && (resource.data.realtorId == request.auth.uid || request.resource.data.realtorId == request.auth.uid);
    }
    match /calendar_events/{eventId} {
      allow read, write: if request.auth != null && (resource.data.realtorId == request.auth.uid || request.resource.data.realtorId == request.auth.uid);
    }
 
    // 5. REMINDER RULES
    match /reminderRules/{ruleId} {
      allow read, write: if request.auth != null;
    }
  }
 *   }
 * }
 */

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

let storage: any = null;
try {
  if (app) storage = getStorage(app);
} catch (e) {
  console.error("Storage initialization failed:", e);
}

export const db_instance = db;
export const auth = authInstance;
export const storage_instance = storage;
export const googleProvider = new GoogleAuthProvider();

const sanitizeForFirestore = (data: any): any => {
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

const logFirestoreQuery = (operation: string, collection: string, details: any) => {
  console.log(`%c[Firestore] ${operation}`, 'color: #6366f1; font-weight: bold;', {
    collection,
    ...details,
    timestamp: new Date().toISOString()
  });
};

const handleFirestoreError = (error: any, context: string) => {
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

export const saveUserProfile = async (uid: string, profile: Partial<UserProfile>) => {
  if (!db) {
    console.error("[Firestore] Database service not initialized.");
    return false;
  }
  try {
    console.log(`[Firestore] Attempting to save profile for UID: ${uid}`, profile);
    const userRef = doc(db, "users", uid);
    const sanitized = sanitizeForFirestore(profile);
    logFirestoreQuery('setDoc', 'users', { uid });
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
  if (!db) {
    console.error("[Firestore] Database service not initialized.");
    return null;
  }
  try {
    const userRef = doc(db, "users", uid);
    logFirestoreQuery('getDoc', 'users', { uid });
    const snap = await getDoc(userRef);
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch (error: any) {
    console.error("[Firestore] getUserProfile error:", error);
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
      logFirestoreQuery('getDocs', 'users/viewHistory', { uid });
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

export const resetPassword = async (email: string) => {
  if (!auth) throw new Error("Authentication service not initialized.");
  try {
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (error: any) {
    console.error("[Auth] Reset password error:", error);
    throw error;
  }
};

export const trackUserPropertyView = async (uid: string, property: PropertyData) => {
  if (!db || !property.zpid) return;
  try {
    const historyRef = doc(db, "users", uid, "viewHistory", property.zpid);
    logFirestoreQuery('setDoc', 'users/viewHistory', { uid, zpid: property.zpid });
    await setDoc(historyRef, {
      zpid: property.zpid,
      address: property.address,
      homeType: property.homeType || null,
      price: property.price || property.zestimate || null,
      timestamp: serverTimestamp(),
      viewCount: increment(1)
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, "trackUserPropertyView");
  }
};

export const getUserViewHistory = async (uid: string, maxItems = 6) => {
  if (!db) return [];
  try {
    const historyCol = collection(db, "users", uid, "viewHistory");
    const q = query(historyCol, orderBy("timestamp", "desc"), limit(maxItems));
    logFirestoreQuery('getDocs', 'users/viewHistory', { uid, limit: maxItems });
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data());
  } catch (error) {
    handleFirestoreError(error, "getUserViewHistory");
    return [];
  }
};

export const toggleFavorite = async (uid: string, property: PropertyData) => {
  if (!db || !property.zpid) return { success: false, error: 'Database or ZPID missing' };

  try {
    const zpidStr = String(property.zpid);
    const favRef = doc(db, "users", uid, "favorites", zpidStr);
    logFirestoreQuery('getDoc', 'users/favorites', { uid, zpid: zpidStr });
    const favSnap = await getDoc(favRef);

    if (favSnap.exists()) {
      logFirestoreQuery('deleteDoc', 'users/favorites', { uid, zpid: zpidStr });
      await deleteDoc(favRef);
      return { success: true, favorited: false };
    } else {
      const sanitizedProperty = {
        zpid: zpidStr,
        address: property.address || 'Unknown Address',
        price: property.price || property.zestimate || null,
        images: property.images || [],
        timestamp: serverTimestamp()
      };
      logFirestoreQuery('setDoc', 'users/favorites', { uid, zpid: zpidStr });
      await setDoc(favRef, sanitizedProperty);
      return { success: true, favorited: true };
    }
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
};

export const getUserFavorites = async (uid: string) => {
  if (!db) return [];
  try {
    const favCol = collection(db, "users", uid, "favorites");
    const q = query(favCol, orderBy("timestamp", "desc"));
    logFirestoreQuery('getDocs', 'users/favorites', { uid });
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data());
  } catch (error: any) {
    return [];
  }
};

export const savePropertyToCloud = async (zpid: string, data: Partial<PropertyData>) => {
  if (!db) return { success: false, error: "Database not initialized" };
  try {
    const docRef = doc(db, "properties", zpid);
    const sanitized = sanitizeForFirestore(data);
    logFirestoreQuery('setDoc', 'properties', { zpid });
    await setDoc(docRef, {
      ...sanitized,
      lastUpdated: serverTimestamp()
    }, { merge: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: handleFirestoreError(error, "savePropertyToCloud") };
  }
};

export const getPropertyFromCloud = async (zpid: string): Promise<PropertyData | null> => {
  if (!db) return null;
  try {
    const docRef = doc(db, "properties", zpid);
    logFirestoreQuery('getDoc', 'properties', { zpid });
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
  if (!db) return { success: false, error: "Database not initialized" };
  try {
    const docRef = doc(db, "property_analyses_visual", zpid);
    logFirestoreQuery('setDoc', 'property_analyses_visual', { zpid });
    await setDoc(docRef, {
      ...sanitizeForFirestore(analysis),
      timestamp: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: handleFirestoreError(error, "saveVisualAnalysisToCloud") };
  }
};

export const getVisualAnalysisFromCloud = async (zpid: string): Promise<CustomAIAnalysisResult | null> => {
  if (!db) return null;
  try {
    const docRef = doc(db, "property_analyses_visual", zpid);
    logFirestoreQuery('getDoc', 'property_analyses_visual', { zpid });
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as CustomAIAnalysisResult) : null;
  } catch (error) {
    handleFirestoreError(error, "getVisualAnalysisFromCloud");
    return null;
  }
};

export const sendInviteEmail = async (email: string, subject: string, html: string) => {
  if (!db) return { success: false, error: "Database not initialized" };
  try {
    const mailCol = collection(db, "mail");
    logFirestoreQuery('addDoc', 'mail', { to: email });
    await addDoc(mailCol, {
      to: email,
      message: {
        subject: subject,
        html: html,
      }
    });
    return { success: true };
  } catch (error) {
    console.error("Error queueing email:", error);
    return { success: false, error: (error as Error).message };
  }
};

export const getRealtorClients = async (realtorId: string) => {
  if (!db) return [];
  try {
    const usersCol = collection(db, "users");
    const q = query(usersCol, where("realtorId", "==", realtorId));
    logFirestoreQuery('getDocs', 'users', { realtorId });
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as UserProfile);
  } catch (error) {
    console.error("Error fetching realtor clients:", error);
    return [];
  }
};




export const saveComprehensiveAnalysisToCloud = async (zpid: string, analysis: ComprehensiveAnalysisResult) => {
  if (!db) return false;
  try {
    const docRef = doc(db, "property_analyses_comprehensive", zpid);
    logFirestoreQuery('setDoc', 'property_analyses_comprehensive', { zpid });
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
    logFirestoreQuery('getDoc', 'property_analyses_comprehensive', { zpid });
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as ComprehensiveAnalysisResult) : null;
  } catch (error) {
    handleFirestoreError(error, "getComprehensiveAnalysisFromCloud");
    return null;
  }
};

export const saveImageQualityAnalysisToCloud = async (zpid: string, analysis: ImageQualityAnalysisResult) => {
  if (!db) {
    return { success: false, error: "Database not initialized" };
  }
  try {
    const user = auth?.currentUser;
    console.log(`[Firestore] Attempting save picture quality audit for ZPID: "${zpid}". Current Auth: ${user ? user.email : 'NOT_LOGGED_IN'}`);
    const docRef = doc(db, "image_quality_analysis", zpid);
    logFirestoreQuery('setDoc', 'image_quality_analysis', { zpid });
    await setDoc(docRef, {
      ...sanitizeForFirestore(analysis),
      timestamp: serverTimestamp()
    });
    console.log(`[Firestore] SUCCESS: picture quality audit saved for ZPID: "${zpid}"`);
    return { success: true };
  } catch (error) {
    console.error(`[Firestore] FAILED to save audit for ${zpid}:`, error);
    return { success: false, error: handleFirestoreError(error, "saveImageQualityAnalysisToCloud") as string };
  }
};

export const getImageQualityAnalysisFromCloud = async (zpid: string): Promise<ImageQualityAnalysisResult | null> => {
  if (!db) return null;
  try {
    const docRef = doc(db, "image_quality_analysis", zpid);
    logFirestoreQuery('getDoc', 'image_quality_analysis', { zpid });
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as ImageQualityAnalysisResult) : null;
  } catch (error) {
    handleFirestoreError(error, "getImageQualityAnalysisFromCloud");
    return null;
  }
};
export const saveInvestmentResearchToCloud = async (zpid: string, research: InvestmentResearchResult) => {
  if (!db) return { success: false, error: "Database not initialized" };
  try {
    const user = auth?.currentUser;
    console.log(`[Firestore] Saving investment research for ZPID: "${zpid}". Auth: ${user ? user.email : 'GUEST'}`);
    const docRef = doc(db, "market_research", zpid);
    logFirestoreQuery('setDoc', 'market_research', { zpid });
    await setDoc(docRef, {
      ...sanitizeForFirestore(research),
      timestamp: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: handleFirestoreError(error, "saveInvestmentResearchToCloud") as string };
  }
};

export const getInvestmentResearchFromCloud = async (zpid: string): Promise<InvestmentResearchResult | null> => {
  if (!db) return null;
  try {
    const docRef = doc(db, "market_research", zpid);
    logFirestoreQuery('getDoc', 'market_research', { zpid });
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as InvestmentResearchResult) : null;
  } catch (error) {
    handleFirestoreError(error, "getInvestmentResearchFromCloud");
    return null;
  }
};





export const verifyFirestoreConnection = async () => {
  if (!db) return { success: false, message: "Database not initialized" };
  const user = auth?.currentUser;
  const authStatus = user ? `LOGGED_IN (${user.email})` : "NOT_LOGGED_IN";

  console.log(`[Firestore] Connection check. Auth Status: ${authStatus}`);

  try {
    const testRef = doc(db, "system_test", "connectivity");
    logFirestoreQuery('setDoc', 'system_test', { id: 'connectivity' });
    await setDoc(testRef, {
      lastTest: serverTimestamp(),
      status: "online",
      authStatus
    });
    return { success: true, message: `Firestore verified. Status: ${authStatus}. Collection 'system_test' updated.` };
  } catch (error: any) {
    return { success: false, message: `${error.message}. Auth was: ${authStatus}` };
  }
};



export const updateFunnelStage = async (id: string, stage: FunnelStage, reason?: string, isLead = false) => {
  if (!db) return false;
  try {
    const docRef = doc(db, isLead ? "leads" : "users", id);
    logFirestoreQuery('getDoc', isLead ? "leads" : "users", { id });
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      console.error("Document not found for updateFunnelStage");
      return false;
    }

    const data = snap.data();
    const oldStage = (data.funnelStage as FunnelStage) || 'Inquiry';

    if (oldStage === stage) return true;

    // --- Lifecycle Logic ---
    let stageHistory = (data.stageHistory || []) as any[];
    const now = new Date();

    // 1. Stamping previous
    if (stageHistory.length > 0) {
      const lastEntry = stageHistory[stageHistory.length - 1];
      if (!lastEntry.exitedAt) {
        const enteredParams = lastEntry.enteredAt;
        let enteredDate = now;
        // Handle Firestore Timestamp or JS Date
        if (enteredParams && typeof enteredParams.toDate === 'function') {
          enteredDate = enteredParams.toDate();
        } else if (enteredParams instanceof Date) {
          enteredDate = enteredParams;
        }

        stageHistory[stageHistory.length - 1] = {
          ...lastEntry,
          exitedAt: now
        };
      }
    }

    // 2. Initiating new
    stageHistory.push({
      fromStage: oldStage,
      toStage: stage,
      enteredAt: serverTimestamp()
    });

    logFirestoreQuery('setDoc', isLead ? 'leads' : 'users', { id });
    await setDoc(docRef, {
      funnelStage: stage,
      updatedAt: serverTimestamp(),
      stageHistory: stageHistory,

    }, { merge: true });

    // Log Journey Event
    const journeyCol = collection(db, "journey_events");
    await addDoc(journeyCol, {
      clientId: id,
      fromStage: oldStage,
      toStage: stage,
      timestamp: serverTimestamp(),
      reason: reason || 'Manual Update',
      realtorId: auth?.currentUser?.uid || 'unknown'
    });

    return true;
  } catch (error) {
    handleFirestoreError(error, "updateFunnelStage");
    return false;
  }
};

export const seedMockData = async (realtorId: string, leads: Lead[], tasks: CRMTask[], templates: CommTemplate[], transactions: Transaction[], onLog?: (msg: string) => void) => {
  const log = (msg: string) => { console.log(msg); onLog?.(msg); };
  if (!db) return false;
  try {
    const batch = writeBatch(db);

    // Seed Leads
    // Seed Leads
    const seededLeads = await Promise.all(leads.map(async (lead) => {
      let finalPhotoUrl = lead.clientPhotoUrl;

      // New Logic: Cache pravatar images to Firebase Storage
      if (lead.clientPhotoUrl && lead.clientPhotoUrl.includes("pravatar.cc") && storage) {
        try {
          const response = await fetch(lead.clientPhotoUrl);
          if (response.ok) {
            const blob = await response.blob();
            const storageRef = ref(storage, `leads/mock/${lead.id}_photo.png`);
            await uploadBytes(storageRef, blob);
            finalPhotoUrl = await getDownloadURL(storageRef);
            console.log(`[Seeding] Cached photo for ${lead.firstName} to Firebase Storage.`);
          }
        } catch (err) {
          console.warn(`[Seeding] Failed to cache photo for ${lead.firstName}`, err);
        }
      }

      const targetColl = lead.collectionName || "leads";
      const docRef = doc(collection(db, targetColl), lead.id);
      const leadData = { ...lead, clientPhotoUrl: finalPhotoUrl || null, isMock: true, realtorId };
      batch.set(docRef, sanitizeForFirestore(leadData), { merge: true });
      log(`[Seed] Saved lead: ${lead.firstName} ${lead.lastName}`);
      return { ...lead, clientPhotoUrl: finalPhotoUrl };
    }));

    log(`[Seed] Processing ${tasks.length} tasks...`);
    // Seed Tasks
    tasks.forEach(task => {
      const docRef = doc(collection(db, "tasks"), task.id);
      const taskData = { ...task, isMock: true, realtorId };
      batch.set(docRef, sanitizeForFirestore(taskData), { merge: true });
      log(`[Seed] Added task: ${task.name}`);
    });

    log(`[Seed] Processing ${templates.length} templates...`);
    // Seed Templates
    templates.forEach(template => {
      const docRef = doc(collection(db, "templates"), template.id);
      const templateData = { ...template, isMock: true, realtorId };
      batch.set(docRef, sanitizeForFirestore(templateData), { merge: true });
      log(`[Seed] Added template: ${template.name}`);
    });

    log(`[Seed] Processing ${transactions.length} transactions...`);
    // Seed Transactions
    for (const transaction of transactions) {
      transaction.isMock = true; // Ensure isMock is set before seeding tasks
      const initialCats = getInitialCategories();
      const finalChecklist = seedTasksForTransaction(batch, transaction, initialCats);

      const docRef = doc(collection(db, "transactions"), transaction.id);
      const transactionData = { ...transaction, isMock: true, realtorId };
      batch.set(docRef, sanitizeForFirestore(transactionData), { merge: true });
      log(`[Seed] Added transaction for: ${transaction.property?.address}`);

      // Seed Parties for this transaction
      await seedPartiesForTransaction(transaction.id);
      log(`[Seed] Seeded parties for transaction: ${transaction.id}`);
    }

    log("[Seed] Committing all changes to Firestore...");
    await batch.commit();
    log("[Seed] Database successfully seeded! Reloading application...");
    return true;
  } catch (error) {
    handleFirestoreError(error, "seedMockData");
    return false;
  }
};

export const seedPartiesForTransaction = async (transactionId: string) => {
  if (!db) return;
  const MOCK_PARTIES_DATA = generateMockTransactionParties(transactionId);

  try {
    for (const party of MOCK_PARTIES_DATA) {
      await addTransactionParty(transactionId, party as any);
    }
  } catch (error) {
    console.error("Error seeding parties:", error);
  }
};

export const seedDocumentsForTransaction = async (transactionId: string) => {
  if (!db) return;
  const MOCK_DOCUMENTS_DATA = generateMockTransactionDocuments(transactionId);

  try {
    console.log(`[seedDocumentsForTransaction] Starting seed for tx: ${transactionId} with ${MOCK_DOCUMENTS_DATA.length} docs`);
    for (const doc of MOCK_DOCUMENTS_DATA) {
      const result = await addTransactionDocument(transactionId, doc as any);
      console.log(`[seedDocumentsForTransaction] Added doc:`, result?.id);
    }
  } catch (error) {
    console.error("Error seeding documents:", error);
  }
};

export const updateLead = async (leadId: string, updates: Partial<Lead>, collectionName: string = 'leads') => {
  if (!db) return false;
  try {
    const docRef = doc(db, collectionName, leadId);
    await setDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    }, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, `updateLead (${collectionName})`);
    return false;
  }
};



export const getLeads = async (realtorId: string, collectionNames: string[] = ['leads']) => {
  if (!db) return [];
  try {
    const allLeads: Lead[] = [];
    for (const name of collectionNames) {
      const q = query(collection(db, name), where("realtorId", "==", realtorId));
      logFirestoreQuery('getDocs', name, { realtorId });
      const snap = await getDocs(q);
      allLeads.push(...snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        collectionName: name
      } as Lead)));
    }
    return allLeads;
  } catch (error) {
    handleFirestoreError(error, "getLeads");
    return [];
  }
};

export const getTasks = async (realtorId: string) => {
  if (!db) return [];
  try {
    const q = query(collection(db, "tasks"), where("realtorId", "==", realtorId));
    logFirestoreQuery('getDocs', 'tasks', { realtorId });
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CRMTask));
  } catch (error) {
    handleFirestoreError(error, "getTasks");
    return [];
  }
};

export const getTemplates = async (realtorId: string) => {
  if (!db) return [];
  try {
    const q = query(collection(db, "templates"), where("realtorId", "==", realtorId));
    logFirestoreQuery('getDocs', 'templates', { realtorId });
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommTemplate));
  } catch (error) {
    handleFirestoreError(error, "getTemplates");
    return [];
  }
};

export const addPipelineNote = async (note: Partial<PipelineNote>) => {
  if (!db) return null;
  try {
    logFirestoreQuery('addDoc', 'notes', note);
    const docRef = await addDoc(collection(db, "notes"), sanitizeForFirestore(note));
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, "addPipelineNote");
    return null;
  }
};

export const getPipelineNotes = async (realtorId: string) => {
  if (!db) return [];
  try {
    const q = query(collection(db, "notes"), where("realtorId", "==", realtorId));
    logFirestoreQuery('getDocs', 'notes', { realtorId });
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PipelineNote));
  } catch (error) {
    handleFirestoreError(error, "getPipelineNotes");
    return [];
  }
};

export const updatePipelineNote = async (noteId: string, updates: Partial<PipelineNote>) => {
  if (!db) return false;
  try {
    const noteRef = doc(db, "notes", noteId);
    await updateDoc(noteRef, sanitizeForFirestore(updates));
    return true;
  } catch (error) {
    handleFirestoreError(error, "updatePipelineNote");
    return false;
  }
};

export const deletePipelineNote = async (noteId: string) => {
  if (!db) return false;
  try {
    const noteRef = doc(db, "notes", noteId);
    await deleteDoc(noteRef);
    return true;
  } catch (error) {
    handleFirestoreError(error, "deletePipelineNote");
    return false;
  }
};



export const saveWhiteboard = async (userId: string, items: any[]) => {
  if (!db) return { success: false, error: "Database not initialized" };
  try {
    const docRef = doc(db, "whiteboards", userId);
    await setDoc(docRef, {
      items: sanitizeForFirestore(items),
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: handleFirestoreError(error, "saveWhiteboard") as string };
  }
};

export const getWhiteboard = async (userId: string) => {
  if (!db) return null;
  try {
    const docRef = doc(db, "whiteboards", userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data().items : null;
  } catch (error) {
    handleFirestoreError(error, "getWhiteboard");
    return null;
  }
};

// ===== REMINDER RULES =====
export const getReminderRules = async (realtorId: string) => {
  if (!db) return [];
  try {
    const q = query(collection(db, "reminderRules"), where("realtorId", "==", realtorId));
    logFirestoreQuery('getDocs', 'reminderRules', { realtorId });
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReminderRule));
  } catch (error) {
    handleFirestoreError(error, "getReminderRules");
    return [];
  }
};

export const deleteAllMockData = async (realtorId: string, onLog?: (msg: string) => void) => {
  const log = (msg: string) => { console.log(msg); onLog?.(msg); };
  if (!db) return false;
  try {
    log("[Cleanup] Starting mock data removal...");
    const batch = writeBatch(db);
    let count = 0;

    // 1. Leads
    log("[Cleanup] Searching for mock leads...");
    const leadsQ = query(collection(db, "leads"), where("realtorId", "==", realtorId), where("isMock", "==", true));
    const leadsSnap = await getDocs(leadsQ);
    leadsSnap.forEach(doc => {
      batch.delete(doc.ref);
      log(`[Cleanup] Deleting lead: ${doc.id}`);
      count++;
    });

    // 2. Tasks
    log("[Cleanup] Searching for mock tasks...");
    const tasksQ = query(collection(db, "tasks"), where("realtorId", "==", realtorId), where("isMock", "==", true));
    const tasksSnap = await getDocs(tasksQ);
    tasksSnap.forEach(doc => {
      batch.delete(doc.ref);
      log(`[Cleanup] Deleting task: ${doc.id}`);
      count++;
    });

    // 3. Templates
    log("[Cleanup] Searching for mock templates...");
    const templatesQ = query(collection(db, "templates"), where("realtorId", "==", realtorId), where("isMock", "==", true));
    const templatesSnap = await getDocs(templatesQ);
    templatesSnap.forEach(doc => {
      batch.delete(doc.ref);
      log(`[Cleanup] Deleting template: ${doc.id}`);
      count++;
    });

    // 3b. Notes
    log("[Cleanup] Searching for mock notes...");
    const notesQ = query(collection(db, "notes"), where("realtorId", "==", realtorId), where("isMock", "==", true));
    const notesSnap = await getDocs(notesQ);
    notesSnap.forEach(doc => {
      batch.delete(doc.ref);
      log(`[Cleanup] Deleting note: ${doc.id}`);
      count++;
    });

    // 4. Transactions
    log("[Cleanup] Searching for mock transactions...");
    // Try new realtorId field
    const txQ1 = query(collection(db, "transactions"), where("realtorId", "==", realtorId), where("isMock", "==", true));
    // Try legacy owner_user_id field
    const txQ2 = query(collection(db, "transactions"), where("owner_user_id", "==", realtorId), where("isMock", "==", true));

    const [snap1, snap2] = await Promise.all([getDocs(txQ1), getDocs(txQ2)]);

    const processDocs = (snap: any) => {
      snap.forEach((doc: any) => {
        batch.delete(doc.ref);
        log(`[Cleanup] Deleting transaction: ${doc.id}`);
        count++;
      });
    };

    processDocs(snap1);
    processDocs(snap2);

    if (count > 0) {
      log(`[Cleanup] Committing deletion of ${count} items...`);
      await batch.commit();
      log("[Cleanup] Deletion complete.");
    } else {
      log("[Cleanup] No mock items found to delete.");
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, "deleteAllMockData");
    return false;
  }
};

export const updateReminderRule = async (ruleId: string, updates: Partial<ReminderRule>) => {
  if (!db) return false;
  try {
    const ruleRef = doc(db, "reminderRules", ruleId);
    await setDoc(ruleRef, {
      ...updates,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, "updateReminderRule");
    return false;
  }
};

export const seedReminderRules = async (realtorId: string, rules: Omit<ReminderRule, 'realtorId'>[]) => {
  if (!db) return false;
  try {
    const batch = writeBatch(db);

    rules.forEach(rule => {
      const docRef = doc(collection(db, "reminderRules"), rule.id);
      batch.set(docRef, {
        ...rule,
        realtorId,
        createdAt: serverTimestamp()
      }, { merge: true });
    });

    await batch.commit();
    console.log("[Seeding] Reminder rules successfully committed to Firestore.");
    return true;
  } catch (error) {
    handleFirestoreError(error, "seedReminderRules");
    return false;
  }
};

export const updateTask = async (taskId: string, updates: Partial<CRMTask>) => {
  if (!db) return false;
  try {
    const taskRef = doc(db, "tasks", taskId);
    await updateDoc(taskRef, sanitizeForFirestore({
      ...updates,
      updatedAt: serverTimestamp()
    }));
    return true;
  } catch (error) {
    handleFirestoreError(error, "updateTask");
    return false;
  }
};



// ===== TRANSACTIONS =====

import { Transaction } from "../types";

export const seedTasksForTransaction = (batch: any, transaction: Transaction, initialCategories: ChecklistCategory[]): ChecklistCategory[] => {
  const oldIdToNewId: Record<string, string> = {};

  // First pass: Pre-generate IDs to ensure they are available for dependency mapping
  for (const cat of initialCategories) {
    for (const t of cat.tasks) {
      oldIdToNewId[t.id] = doc(collection(db, "tasks")).id;
    }
  }

  // Second pass: Use shared scheduling logic to calculate all dates and map IDs
  const baseDate = transaction.important_dates?.acceptance_date?.toDate
    ? transaction.important_dates.acceptance_date.toDate()
    : (transaction.important_dates?.acceptance_date ? new Date(transaction.important_dates.acceptance_date) : new Date());

  const finalChecklist = calculateChecklistSchedule(initialCategories, baseDate, oldIdToNewId);

  // Third pass: Add individual CRMTask documents to the batch
  finalChecklist.forEach(cat => {
    cat.tasks.forEach(t => {
      const taskDocRef = doc(db, "tasks", t.id);
      const taskData = {
        id: t.id,
        realtorId: transaction.realtorId,
        clientId: transaction.clientId || null, // Ensuring clientId from transaction is propagated to tasks
        transaction_id: transaction.id,
        name: t.name,
        comment: t.comments || '',
        status: t.status,
        priority: 'Normal',
        startDate: t.startDate,
        dueDate: t.dueDate,
        createDate: new Date(),
        dependsOn: t.dependsOn,
        durationDays: t.durationDays,
        categoryId: cat.id,
        isMock: transaction.isMock ?? false, // Inherit mock status from transaction
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(taskDocRef, sanitizeForFirestore(taskData));
    });
  });

  // Return a lean structural checklist (only IDs for tasks) to be saved in the Transaction doc
  return finalChecklist.map(cat => ({
    ...cat,
    tasks: cat.tasks.map(t => ({ id: t.id }))
  }));
};

export const getTransactionTasks = async (transactionId: string, realtorId: string) => {
  if (!db || !transactionId || !realtorId) return [];
  try {
    const q = query(
      collection(db, "tasks"),
      where("realtorId", "==", realtorId),
      where("transaction_id", "==", transactionId)
    );
    logFirestoreQuery('getDocs', 'tasks', { transactionId, realtorId });
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CRMTask));
  } catch (error) {
    handleFirestoreError(error, "getTransactionTasks");
    return [];
  }
};

export const createTransaction = async (transaction: Transaction, initialCategories?: ChecklistCategory[]) => {
  if (!db) return null;
  const batch = writeBatch(db);
  try {
    const docRef = transaction.id ? doc(db, "transactions", transaction.id) : doc(collection(db, "transactions"));
    const transactionId = docRef.id;
    const finalTransactionObj = { ...transaction, id: transactionId };

    let finalChecklist: ChecklistCategory[] = [];

    if (initialCategories) {
      finalChecklist = seedTasksForTransaction(batch, finalTransactionObj, initialCategories);
    } else {
      finalChecklist = transaction.checklist as any || [];
    }

    const finalTransaction = {
      ...finalTransactionObj
    };

    logFirestoreQuery('setDoc (batch)', 'transactions', { id: transactionId });
    batch.set(docRef, sanitizeForFirestore({
      ...finalTransaction,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    }));

    await batch.commit();

    // After commit, seed initial parties (asynchronously)
    if (initialCategories) {
      seedPartiesForTransaction(transactionId);
      seedDocumentsForTransaction(transactionId);
    }

    return finalTransaction;
  } catch (error) {
    handleFirestoreError(error, "createTransaction");
    return null;
  }
};

export const getTransactions = async (realtorId: string) => {
  if (!db || !realtorId) return [];
  try {
    logFirestoreQuery('getDocs', 'transactions', { realtorId });
    const q = query(collection(db, "transactions"), where("realtorId", "==", realtorId));
    const snap = await getDocs(q);
    // Convert timestamps back to dates if needed, or rely on client to handle
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
  } catch (error) {
    handleFirestoreError(error, "getTransactions");
    return [];
  }
};

export const getTransactionByClientId = async (clientId: string, realtorId: string) => {
  if (!db || !clientId || !realtorId) return null;
  try {
    logFirestoreQuery('getDocs', 'transactions', { clientId, realtorId });
    const q = query(
      collection(db, "transactions"),
      where("realtorId", "==", realtorId),
      where("clientId", "==", clientId)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    return { id: snap.docs[0].id, ...data } as Transaction;
  } catch (error) {
    handleFirestoreError(error, "getTransactionByClientId");
    return null;
  }
};

export const updateTransaction = async (transactionId: string, updates: Partial<Transaction>) => {
  if (!db) return false;
  try {
    const docRef = doc(db, "transactions", transactionId);
    logFirestoreQuery('setDoc', 'transactions', { transactionId });
    await setDoc(docRef, sanitizeForFirestore({
      ...updates,
      updated_at: serverTimestamp()
    }), { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, "updateTransaction");
    return false;
  }
};

// ===== TRANSACTION PARTIES =====

import { TransactionParty } from "../types/transaction";

export const getTransactionParties = async (transactionId: string) => {
  if (!db || !transactionId) return [];
  try {
    logFirestoreQuery('getDocs', 'transaction_parties', { transaction_id: transactionId });
    const q = query(
      collection(db, "transaction_parties"),
      where("transaction_id", "==", transactionId),
      orderBy("created_at", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionParty));
  } catch (error) {
    handleFirestoreError(error, "getTransactionParties");
    return [];
  }
};

export const addTransactionParty = async (transactionId: string, party: Partial<TransactionParty>) => {
  if (!db || !transactionId) return null;
  try {
    logFirestoreQuery('addDoc', 'transaction_parties', party);
    const docRef = await addDoc(collection(db, "transaction_parties"), {
      ...sanitizeForFirestore(party),
      transaction_id: transactionId,
      created_at: serverTimestamp()
    });
    return { id: docRef.id, ...party } as TransactionParty;
  } catch (error) {
    handleFirestoreError(error, "addTransactionParty");
    return null;
  }
};

export const updateTransactionParty = async (transactionId: string, partyId: string, updates: Partial<TransactionParty>) => {
  if (!db || !transactionId || !partyId) return false;
  try {
    logFirestoreQuery('updateDoc', 'transaction_parties', { partyId });
    const docRef = doc(db, "transaction_parties", partyId);
    await updateDoc(docRef, sanitizeForFirestore(updates));
    return true;
  } catch (error) {
    handleFirestoreError(error, "updateTransactionParty");
    return false;
  }
};

export const deleteTransactionParty = async (transactionId: string, partyId: string) => {
  if (!db || !transactionId || !partyId) return false;
  try {
    logFirestoreQuery('deleteDoc', 'transaction_parties', { partyId });
    const docRef = doc(db, "transaction_parties", partyId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    handleFirestoreError(error, "deleteTransactionParty");
    return false;
  }
};

// ===== TRANSACTION DOCUMENTS =====

export type TransactionDocument = Document;

// Helper to get a secure download URL
export const getDocumentDownloadUrl = async (storagePath: string): Promise<string | null> => {
  if (!storagePath) return null;
  const storage = getStorage();
  const fileRef = ref(storage, storagePath);
  try {
    const url = await getDownloadURL(fileRef);
    return url;
  } catch (error) {
    console.error("Error getting download URL:", error);
    return null;
  }
};

// Helper to compute SHA-256 hash
const computeSHA256 = async (file: File): Promise<string> => {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.warn("Failed to compute SHA-256 hash:", error);
    return "";
  }
};

export const uploadTransactionDocumentFile = async (
  transactionId: string,
  file: File
): Promise<{ storage_path: string; file_type: string; file_name: string; file_hash: string } | null> => {
  const storage = getStorage();
  // Path: transactions/{transactionId}/documents/{timestamp}_{filename}
  // Using timestamp to avoid naming collisions
  const storagePath = `transactions/${transactionId}/documents/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, storagePath);

  try {
    const [snapshot, fileHash] = await Promise.all([
      uploadBytes(storageRef, file),
      computeSHA256(file)
    ]);

    return {
      storage_path: snapshot.ref.fullPath, // Use fullPath to store
      file_type: file.type,
      file_name: file.name,
      file_hash: fileHash
    };
  } catch (error) {
    console.error("Error uploading file:", error);
    return null;
  }
};

export const getTransactionDocuments = async (transactionId: string) => {
  if (!db || !transactionId) return [];
  try {
    logFirestoreQuery('getDocs', 'transaction_documents', { transaction_id: transactionId });
    const q = query(
      collection(db, "transaction_documents"),
      where("transaction_id", "==", transactionId)
    );
    const snap = await getDocs(q);
    console.log(`[Firestore] getTransactionDocuments result: ${snap.docs.length} docs found for tx: ${transactionId}`);

    const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionDocument));
    // Sort by created_at in memory
    return docs.sort((a, b) => {
      // created_at can be a Firestore Timestamp or a string (or null/undefined)
      // We'll normalize it to a number (milliseconds) for sorting.
      const getTime = (val: any) => {
        if (!val) return 0;
        if (val.toDate && typeof val.toDate === 'function') {
          return val.toDate().getTime(); // Firestore Timestamp
        }
        if (val instanceof Date) {
          return val.getTime(); // JS Date
        }
        if (typeof val === 'string') {
          return new Date(val).getTime(); // ISO String
        }
        return 0;
      };

      return getTime(a.created_at) - getTime(b.created_at);
    });
  } catch (error) {
    handleFirestoreError(error, "getTransactionDocuments");
    return [];
  }
};

export const addTransactionDocument = async (transactionId: string, docData: Partial<TransactionDocument>) => {
  if (!db || !transactionId) return null;
  try {
    logFirestoreQuery('addDoc', 'transaction_documents', docData);
    const now = serverTimestamp();
    const docRef = await addDoc(collection(db, "transaction_documents"), {
      ...sanitizeForFirestore(docData),
      transaction_id: transactionId,
      current_version_number: docData.storage_path ? 1 : 0,
      created_at: now,
      updated_at: now
    });

    // If initial document has a file, create Version 1 record in subcollection
    if (docData.storage_path) {
      const versionData: Omit<DocumentVersion, 'id'> = {
        document_id: docRef.id,
        version_number: 1,
        storage_path: docData.storage_path,
        file_name: docData.file_name || 'Unknown',
        file_type: docData.file_type || 'application/octet-stream',
        file_hash: docData.file_hash || '',
        size: 0, // We assume 0 or capture if we could
        created_at: now,
        created_by: 'user'
      };
      await addDoc(collection(db, "transaction_documents", docRef.id, "versions"), versionData);
    }

    return {
      id: docRef.id,
      ...docData,
      current_version_number: docData.storage_path ? 1 : 0,
      created_at: new Date(),
      updated_at: new Date()
    } as TransactionDocument;
  } catch (error) {
    handleFirestoreError(error, "addTransactionDocument");
    return null;
  }
};

export const updateTransactionDocument = async (transactionId: string, docId: string, updates: Partial<TransactionDocument>) => {
  if (!db || !transactionId || !docId) return false;
  try {
    logFirestoreQuery('updateDoc', 'transaction_documents', { docId });
    const docRef = doc(db, "transaction_documents", docId);

    // Auto-update timestamp
    const updatesWithTimestamp = {
      ...sanitizeForFirestore(updates),
      updated_at: serverTimestamp()
    };

    await updateDoc(docRef, updatesWithTimestamp);
    return true;
  } catch (error) {
    handleFirestoreError(error, "updateTransactionDocument");
    return false;
  }
};

// DocumentVersion is imported from types

export const addDocumentVersion = async (
  transactionId: string,
  documentId: string,
  file: File
): Promise<TransactionDocument | null> => {
  if (!db || !transactionId || !documentId) return null;

  try {
    // 1. Upload File
    const uploadResult = await uploadTransactionDocumentFile(transactionId, file);
    if (!uploadResult) throw new Error("File upload failed");

    // 2. Compute Metadata
    const docRef = doc(db, "transaction_documents", documentId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error("Parent document not found");

    const currentDoc = docSnap.data() as TransactionDocument;
    const nextVersion = (currentDoc.current_version_number || 0) + 1;
    const now = serverTimestamp();

    // 3. Create Version Record
    const versionData: Omit<DocumentVersion, 'id'> = {
      document_id: documentId,
      version_number: nextVersion,
      storage_path: uploadResult.storage_path,
      file_name: uploadResult.file_name,
      file_type: uploadResult.file_type,
      file_hash: uploadResult.file_hash,
      size: file.size,
      created_at: now,
      created_by: 'user' // TODO: Pass actual user ID
    };

    const versionRef = await addDoc(collection(db, "transaction_documents", documentId, "versions"), versionData);

    // 4. Update Parent Document with Latest File Info
    const parentUpdates: Partial<TransactionDocument> = {
      storage_path: uploadResult.storage_path,
      file_name: uploadResult.file_name,
      file_type: uploadResult.file_type,
      file_hash: uploadResult.file_hash,
      current_version_number: nextVersion,
      updated_at: now
    };

    await updateDoc(docRef, parentUpdates);

    // Return updated document structure for UI
    return {
      ...currentDoc,
      ...parentUpdates,
      updated_at: new Date() // Optimistic date
    };

  } catch (error) {
    console.error("Error adding document version:", error);
    return null;
  }
};

export const deleteTransactionDocument = async (transactionId: string, docId: string) => {
  if (!db || !transactionId || !docId) return false;
  try {
    // 1. Check for attached file to delete
    const docRef = doc(db, "transaction_documents", docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as TransactionDocument;
      if (data.storage_path) {
        try {
          const storage = getStorage();
          const fileRef = ref(storage, data.storage_path);
          await deleteObject(fileRef);
          console.log("[Storage] Deleted file:", data.storage_path);
        } catch (storageError) {
          console.warn("[Storage] Failed to delete file (continuing with doc deletion):", storageError);
        }
      }
    }

    logFirestoreQuery('deleteDoc', 'transaction_documents', { docId });
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    handleFirestoreError(error, "deleteTransactionDocument");
    return false;
  }
};



export const addTask = async (task: Partial<CRMTask>) => {
  if (!db) return null;
  try {
    logFirestoreQuery('addDoc', 'tasks', task);
    const docRef = await addDoc(collection(db, "tasks"), {
      ...sanitizeForFirestore(task),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, "addTask");
    return null;
  }
};

export const deleteTask = async (taskId: string) => {
  if (!db) return false;
  try {
    const docRef = doc(db, "tasks", taskId);
    logFirestoreQuery('deleteDoc', 'tasks', { taskId });
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    handleFirestoreError(error, "deleteTask");
    return false;
  }
};

// ===== CALENDAR EVENTS =====
export const getCalendarEvents = async (realtorId: string) => {
  if (!db) return [];
  try {
    const q = query(collection(db, "calendar_events"), where("realtorId", "==", realtorId));
    logFirestoreQuery('getDocs', 'calendar_events', { realtorId });
    const snap = await getDocs(q);
    return snap.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        start: data.start?.toDate() || new Date(),
        end: data.end?.toDate() || new Date()
      } as CalendarEvent;
    });
  } catch (error) {
    handleFirestoreError(error, "getCalendarEvents");
    return [];
  }
};

export const saveCalendarEvent = async (event: Partial<CalendarEvent>) => {
  if (!db) return null;
  try {
    const eventId = event.id;
    const sanitized = sanitizeForFirestore(event);

    if (eventId && !eventId.startsWith('new-')) {
      const docRef = doc(db, "calendar_events", eventId);
      logFirestoreQuery('setDoc', 'calendar_events', { eventId });
      await setDoc(docRef, {
        ...sanitized,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return eventId;
    } else {
      const { id, ...rest } = sanitized;
      logFirestoreQuery('addDoc', 'calendar_events', rest);
      const docRef = await addDoc(collection(db, "calendar_events"), {
        ...rest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    }
  } catch (error) {
    handleFirestoreError(error, "saveCalendarEvent");
    return null;
  }
};

export const deleteCalendarEvent = async (eventId: string) => {
  if (!db) return false;
  try {
    const docRef = doc(db, "calendar_events", eventId);
    logFirestoreQuery('deleteDoc', 'calendar_events', { eventId });
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    handleFirestoreError(error, "deleteCalendarEvent");
    return false;
  }
};

export const getClientTasks = async (realtorId: string, clientId: string) => {
  if (!db) return [];
  try {
    const q = query(
      collection(db, "tasks"),
      where("realtorId", "==", realtorId),
      where("clientId", "==", clientId)
    );
    logFirestoreQuery('getDocs', 'tasks', { realtorId, clientId });
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CRMTask));
  } catch (error) {
    handleFirestoreError(error, "getClientTasks");
    return [];
  }
};

export const getClientCalendarEvents = async (realtorId: string, clientId: string) => {
  if (!db) return [];
  try {
    const q = query(
      collection(db, "calendar_events"),
      where("realtorId", "==", realtorId),
      where("clientId", "==", clientId)
    );
    logFirestoreQuery('getDocs', 'calendar_events', { realtorId, clientId });
    const snap = await getDocs(q);
    return snap.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        start: data.start?.toDate() || new Date(),
        end: data.end?.toDate() || new Date()
      } as CalendarEvent;
    });
  } catch (error) {
    handleFirestoreError(error, "getClientCalendarEvents");
    return [];
  }
};

console.log(`[Firebase] Initialized for Project: ${firebaseConfig.projectId}`);
