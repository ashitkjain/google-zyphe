
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
import { PropertyData, CustomAIAnalysisResult, ComprehensiveAnalysisResult, UserProfile, ImageQualityAnalysisResult, InvestmentResearchResult, CommMessage, FunnelStage, LeadHealth, Lead, CRMTask, CommTemplate, PipelineNote } from "../types";

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

    // 3. ANONYMOUS LOGGING
    match /user_activity/{activityId} {
      allow create: if true;
      allow read, update, delete: if false; 
    }
    
    match /mail/{mailId} {
      allow create: if request.auth != null;
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
  const message = error?.message || String(error);
  if (error?.code === 'permission-denied') {
    const permError = `[Firestore ${context}] Permission Denied. Ensure your security rules allow write access to this collection.`;
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
    const favSnap = await getDoc(favRef);

    if (favSnap.exists()) {
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
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as UserProfile);
  } catch (error) {
    console.error("Error fetching realtor clients:", error);
    return [];
  }
};

export const getClientActivity = async (uid: string) => {
  if (!db) return { favorites: [], views: [] };
  try {
    const favs = await getUserFavorites(uid);
    const historyCol = collection(db, "users", uid, "viewHistory");
    const q = query(historyCol, orderBy("timestamp", "desc"));
    const historySnap = await getDocs(q);
    const views = historySnap.docs.map(doc => doc.data());

    return { favorites: favs, views };
  } catch (error) {
    console.error("Error fetching client activity:", error);
    return { favorites: [], views: [] };
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
  if (!db) {
    return { success: false, error: "Database not initialized" };
  }
  try {
    const user = auth?.currentUser;
    console.log(`[Firestore] Attempting save picture quality audit for ZPID: "${zpid}". Current Auth: ${user ? user.email : 'NOT_LOGGED_IN'}`);
    const docRef = doc(db, "image_quality_analysis", zpid);
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
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as InvestmentResearchResult) : null;
  } catch (error) {
    handleFirestoreError(error, "getInvestmentResearchFromCloud");
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

export const verifyFirestoreConnection = async () => {
  if (!db) return { success: false, message: "Database not initialized" };
  const user = auth?.currentUser;
  const authStatus = user ? `LOGGED_IN (${user.email})` : "NOT_LOGGED_IN";

  console.log(`[Firestore] Connection check. Auth Status: ${authStatus}`);

  try {
    const testRef = doc(db, "system_test", "connectivity");
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

export const updateSmsConsent = async (uid: string, consent: boolean, isLead = false) => {
  if (!db) return false;
  try {
    const docRef = doc(db, isLead ? "leads" : "users", uid);
    await setDoc(docRef, {
      smsConsent: consent,
      smsConsentTimestamp: serverTimestamp()
    }, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, "updateSmsConsent");
    return false;
  }
};

export const updateFunnelStage = async (id: string, stage: FunnelStage, reason?: string, isLead = false) => {
  if (!db) return false;
  try {
    const docRef = doc(db, isLead ? "leads" : "users", id);
    const snap = await getDoc(docRef);
    const oldStage = snap.exists() ? (snap.data().funnelStage as FunnelStage) : 'Inquiry';

    await setDoc(docRef, {
      funnelStage: stage,
      updatedAt: serverTimestamp()
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

export const seedMockData = async (realtorId: string, leads: Lead[], tasks: CRMTask[], templates: CommTemplate[]) => {
  if (!db) return false;
  try {
    const batch = writeBatch(db);

    // Seed Leads
    leads.forEach(lead => {
      const targetColl = lead.collectionName || "leads";
      const docRef = doc(collection(db, targetColl), lead.id);
      batch.set(docRef, { ...lead, isMock: true, realtorId }, { merge: true });
    });

    // Seed Tasks
    tasks.forEach(task => {
      const docRef = doc(collection(db, "tasks"), task.id);
      batch.set(docRef, { ...task, isMock: true, realtorId }, { merge: true });
    });

    // Seed Templates
    templates.forEach(template => {
      const docRef = doc(collection(db, "templates"), template.id);
      batch.set(docRef, { ...template, isMock: true, realtorId }, { merge: true });
    });

    await batch.commit();
    console.log("[Seeding] Mock data successfully committed to Firestore.");
    return true;
  } catch (error) {
    handleFirestoreError(error, "seedMockData");
    return false;
  }
};

export const updateLead = async (leadId: string, updates: Partial<Lead>, collectionName: string = 'leads') => {
  if (!db) return false;
  try {
    const docRef = doc(db, collectionName, leadId);
    await setDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, `updateLead (${collectionName})`);
    return false;
  }
};

export const activateLeadToCollection = async (lead: Lead) => {
  if (!db) return false;
  try {
    const { runTransaction } = await import("firebase/firestore");

    await runTransaction(db, async (transaction) => {
      const oldRef = doc(db, "leads", lead.id);
      const targetCollection = lead.leadType === 'Seller' ? 'sellers' : 'buyers';
      const newPipelineRef = doc(db, targetCollection, lead.id);
      const archivedRef = doc(db, "archived_leads", lead.id); // New archived collection

      // 1. Read existing doc to ensure consistency (optional but good for transactions)
      const leadDoc = await transaction.get(oldRef);
      if (!leadDoc.exists()) {
        throw "Lead document does not exist!";
      }

      const updatedLeadData = {
        ...lead,
        ...sanitizeForFirestore(leadDoc.data()), // Use latest data
        status: 'Active',
        funnelStage: 'Nurture',
        activatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const archivedLeadData = {
        ...updatedLeadData,
        status: 'Archived', // Mark as Archived in the archive table
        archivedAt: serverTimestamp()
      };

      // 2. Set to Pipeline Collection
      transaction.set(newPipelineRef, sanitizeForFirestore(updatedLeadData));

      // 3. Set to Archived Leads Collection
      transaction.set(archivedRef, sanitizeForFirestore(archivedLeadData));

      // 4. Delete from Main Leads Collection
      transaction.delete(oldRef);
    });

    console.log(`[activateLeadToCollection] Successfully moved lead ${lead.id} to pipeline and archive.`);
    return true;
  } catch (error) {
    handleFirestoreError(error, "activateLeadToCollection");
    return false;
  }
};

export const getLeads = async (realtorId: string, collectionNames: string[] = ['leads']) => {
  if (!db) return [];
  try {
    const allLeads: Lead[] = [];
    for (const name of collectionNames) {
      const q = query(collection(db, name), where("realtorId", "==", realtorId));
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

export const persistCommMessage = async (message: Partial<CommMessage>, clientId?: string) => {
  if (!db) return null;
  try {
    const messagesCol = collection(db, "messages");
    const docRef = await addDoc(messagesCol, {
      ...message,
      timestamp: serverTimestamp()
    });

    // Auto-log to Activity Timeline
    if (clientId) {
      const activityCol = collection(db, "users", clientId, "activity");
      await addDoc(activityCol, {
        type: 'SMS',
        content: message.content,
        timestamp: serverTimestamp(),
        authorId: message.senderId
      });
    }

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, "persistCommMessage");
    return null;
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

console.log(`[Firebase] Initialized for Project: ${firebaseConfig.projectId}`);
