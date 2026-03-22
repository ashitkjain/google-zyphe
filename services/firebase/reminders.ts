import { doc, setDoc, query, where, getDocs, serverTimestamp, writeBatch, collection } from "firebase/firestore";
import {
    db,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError
} from "./config";
import { requireTenantId } from "./tenantContext";
import { ReminderRule } from "../../types";

export const getReminderRules = async (realtorId: string) => {
    if (!db) return [];
    try {
        const rid = requireTenantId(realtorId);
        const q = query(collection(db, "realtors", rid, "reminderRules"));
        logFirestoreQuery('getDocs', 'reminderRules', { realtorId });
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReminderRule));
    } catch (error) {
        handleFirestoreError(error, "getReminderRules");
        return [];
    }
};

export const updateReminderRule = async (ruleId: string, updates: Partial<ReminderRule>, realtorId?: string) => {
    if (!db) return false;
    try {
        const rid = requireTenantId(realtorId);
        const ruleRef = doc(db, "realtors", rid, "reminderRules", ruleId);
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
        const rid = requireTenantId(realtorId);
        const batch = writeBatch(db);

        rules.forEach(rule => {
            const docRef = doc(collection(db, "realtors", rid, "reminderRules"), rule.id);
            batch.set(docRef, {
                ...rule,
                realtorId: rid,
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
