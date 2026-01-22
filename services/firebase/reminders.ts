import { doc, setDoc, query, where, getDocs, serverTimestamp, writeBatch, collection } from "firebase/firestore";
import {
    db,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError
} from "./config";
import { ReminderRule } from "../../types";

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
