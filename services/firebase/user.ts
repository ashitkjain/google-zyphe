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

        // --- VALIDATION: Check for Duplicates ---
        const usersCol = collection(db, "users");

        // 1. Check Phone Number Uniqueness
        if (profile.phoneNumber) {
            // Check both strict match and potential format variations could be added here,
            // but for now we enforce exactly what is submitted.
            // Ideally also check stripped version (no country code), but that requires 'in' query or multiple queries.
            // Let's stick to exact match for the one they are trying to save.

            const phoneQuery = query(usersCol, where("phoneNumber", "==", profile.phoneNumber), limit(1));
            const phoneSnap = await getDocs(phoneQuery);

            if (!phoneSnap.empty) {
                const existingDoc = phoneSnap.docs[0];
                if (existingDoc.id !== uid) {
                    const msg = `Phone number ${profile.phoneNumber} is already in use by another account.`;
                    console.error("[Firestore] Duplicate Phone Prevention:", msg);
                    throw new Error(msg);
                }
            }
        }

        // 2. Check Email Uniqueness (only if email is being updated/saved in Firestore)
        if (profile.email) {
            const emailQuery = query(usersCol, where("email", "==", profile.email), limit(1));
            const emailSnap = await getDocs(emailQuery);

            if (!emailSnap.empty) {
                const existingDoc = emailSnap.docs[0];
                if (existingDoc.id !== uid) {
                    const msg = `Email ${profile.email} is already in use by another account.`;
                    console.error("[Firestore] Duplicate Email Prevention:", msg);
                    throw new Error(msg);
                }
            }
        }
        // --- END VALIDATION ---

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
        // If it was our custom error, rethrow it so UI can catch it
        if (error instanceof Error && (error.message.includes("already in use"))) {
            throw error;
        }
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
        // Fetch a few extra to account for deprecated items we'll filter out
        const q = query(historyCol, orderBy("timestamp", "desc"), limit(maxItems + 10));
        logFirestoreQuery('getDocs', 'users/viewHistory', { uid, limit: maxItems });
        const snap = await getDocs(q);
        const items = snap.docs.map(d => d.data());

        // Batch-check properties for deprecated status
        const checks = await Promise.all(
            items.map(async (item) => {
                if (!item.zpid) return false;
                try {
                    const propSnap = await getDoc(doc(db!, 'properties', String(item.zpid)));
                    return propSnap.exists() && propSnap.data()?.deprecated === true;
                } catch { return false; }
            })
        );
        return items.filter((_, i) => !checks[i]).slice(0, maxItems);
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

export const getUserFavorites = async (uid: string, maxItems = 100) => {
    if (!db) return [];
    try {
        const favCol = collection(db, "users", uid, "favorites");
        const q = query(favCol, orderBy("timestamp", "desc"), limit(maxItems));
        logFirestoreQuery('getDocs', 'users/favorites', { uid, limit: maxItems });
        const snap = await getDocs(q);
        const items = snap.docs.map(d => d.data());

        // Batch-check properties for deprecated status
        const checks = await Promise.all(
            items.map(async (item) => {
                if (!item.zpid) return false;
                try {
                    const propSnap = await getDoc(doc(db!, 'properties', String(item.zpid)));
                    return propSnap.exists() && propSnap.data()?.deprecated === true;
                } catch { return false; }
            })
        );
        return items.filter((_, i) => !checks[i]);
    } catch (error) {
        handleFirestoreError(error, "getUserFavorites");
        return [];
    }
};

export const getRealtorClients = async (realtorId: string, maxItems = 200) => {
    if (!db) return [];
    try {
        // Read from the realtor's clients subcollection
        const clientsCol = collection(db, "realtors", realtorId, "clients");
        const q = query(clientsCol, limit(maxItems));
        logFirestoreQuery('getDocs', `realtors/${realtorId}/clients`, { limit: maxItems });
        const snap = await getDocs(q);
        return snap.docs.map(doc => doc.data() as UserProfile);
    } catch (error) {
        console.error("Error fetching realtor clients:", error);
        return [];
    }
};
export const getAllAuditors = async () => {
    if (!db) return [];
    try {
        const usersCol = collection(db, "users");
        // Include both auditor and admin roles — admins often self-assign
        const [auditorSnap, adminSnap] = await Promise.all([
            getDocs(query(usersCol, where("role", "==", "auditor"))),
            getDocs(query(usersCol, where("role", "==", "admin"))),
        ]);
        const seen = new Set<string>();
        const results: UserProfile[] = [];
        [...auditorSnap.docs, ...adminSnap.docs].forEach(d => {
            if (!seen.has(d.id)) {
                seen.add(d.id);
                results.push(d.data() as UserProfile);
            }
        });
        logFirestoreQuery('getDocs', 'users', { role: 'auditor|admin' });
        return results;
    } catch (error) {
        console.error("Error fetching auditors:", error);
        return [];
    }
};

export const removeClient = async (clientId: string) => {
    if (!db) return false;
    try {
        logFirestoreQuery('deleteDoc', 'users', { uid: clientId });
        await deleteDoc(doc(db, "users", clientId));
        return true;
    } catch (error) {
        console.error("Error removing client:", error);
        handleFirestoreError(error, "removeClient");
        return false;
    }
};

export const getAllUsers = async (maxItems = 500) => {
    if (!db) return [];
    try {
        const usersCol = collection(db, "users");
        // Simple query for all users, limited by maxItems
        const q = query(usersCol, limit(maxItems));
        logFirestoreQuery('getDocs', 'users', { limit: maxItems });
        const snap = await getDocs(q);
        return snap.docs.map(doc => doc.data() as UserProfile);
    } catch (error) {
        console.error("Error fetching all users:", error);
        return [];
    }
};
