import { doc, setDoc, getDoc, collection, getDocs, query, orderBy, limit, writeBatch, increment, serverTimestamp, deleteDoc, where } from "firebase/firestore";
import { deleteUser, sendPasswordResetEmail } from "firebase/auth";
import {
    db,
    auth,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError
} from "./config";
import { UserProfile, PropertyData } from "../../types";

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
        handleFirestoreError(error, "saveUserProfile");
        return false;
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
    } catch (error) {
        handleFirestoreError(error, "getUserFavorites");
        return [];
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
