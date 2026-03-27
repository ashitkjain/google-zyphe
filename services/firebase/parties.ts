import { collection, query, where, orderBy, getDocs, addDoc, setDoc, getDoc, serverTimestamp, doc, updateDoc, deleteDoc } from "firebase/firestore";
import {
    db,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError
} from "./config";
import { requireTenantId } from "./tenantContext";
import { TransactionParty } from "../../types";
import { generateMockTransactionParties } from "../mockData";
import { logAuditEvent } from "./audit";

export const getTransactionParties = async (transactionId: string, realtorId?: string) => {
    if (!db || !transactionId) return [];
    try {
        const rid = requireTenantId(realtorId);

        // 1. Try new nested path
        const nestedSnap = await getDocs(query(
            collection(db, "realtors", rid, "transactions", transactionId, "parties"),
            orderBy("created_at", "asc")
        ));
        
        if (!nestedSnap.empty) {
            const all = nestedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionParty));
            return deduplicateParties(all);
        }

        // 2. Fallback to legacy path
        logFirestoreQuery('getDocs', 'transaction_parties', { transaction_id: transactionId });
        const q = query(
            collection(db, "realtors", rid, "transaction_parties"),
            where("transaction_id", "==", transactionId),
            orderBy("created_at", "asc")
        );
        const snap = await getDocs(q);
        const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionParty));
        return deduplicateParties(all);
    } catch (error) {
        handleFirestoreError(error, "getTransactionParties");
        return [];
    }
};

/** Shared deduplication logic */
const deduplicateParties = (all: TransactionParty[]): TransactionParty[] => {
    const seen = new Map<string, TransactionParty>();
    for (const party of all) {
        const key = (party.role || party.name || party.id);
        const existing = seen.get(key);
        if (!existing) {
            seen.set(key, party);
        } else {
            const existingTime = (existing as any).created_at?.toDate?.()?.getTime() ?? 0;
            const thisTime = (party as any).created_at?.toDate?.()?.getTime() ?? 0;
            if (thisTime > existingTime) seen.set(key, party);
        }
    }
    return Array.from(seen.values());
};

export const addTransactionParty = async (transactionId: string, party: Partial<TransactionParty>, realtorId?: string) => {
    if (!db || !transactionId) return null;
    try {
        const rid = requireTenantId(realtorId);
        const payload = {
            ...sanitizeForFirestore(party),
            transaction_id: transactionId,
            created_at: serverTimestamp()
        };

        // 1. Legacy write
        await addDoc(collection(db, "realtors", rid, "transaction_parties"), payload);

        // 2. Nested write
        const docRef = await addDoc(collection(db, "realtors", rid, "transactions", transactionId, "parties"), payload);

        await logAuditEvent({
            transaction_id: transactionId,
            entity_id: docRef.id,
            entity_type: 'Party',
            action: 'CREATE',
            diff: { after: party }
        }, rid);

        return { id: docRef.id, ...party } as TransactionParty;
    } catch (error) {
        handleFirestoreError(error, "addTransactionParty");
        return null;
    }
};

export const updateTransactionParty = async (transactionId: string, partyId: string, updates: Partial<TransactionParty>, realtorId?: string) => {
    if (!db || !transactionId || !partyId) return false;
    try {
        const rid = requireTenantId(realtorId);
        const sanitized = sanitizeForFirestore(updates);

        // 1. Update Legacy if exists
        const legacyRef = doc(db, "realtors", rid, "transaction_parties", partyId);
        await updateDoc(legacyRef, sanitized).catch(() => {});

        // 2. Update Nested
        const nestedRef = doc(db, "realtors", rid, "transactions", transactionId, "parties", partyId);
        await updateDoc(nestedRef, sanitized);

        await logAuditEvent({
            transaction_id: transactionId,
            entity_id: partyId,
            entity_type: 'Party',
            action: 'UPDATE',
            diff: { after: updates }
        }, rid);

        return true;
    } catch (error) {
        handleFirestoreError(error, "updateTransactionParty");
        return false;
    }
};

export const deleteTransactionParty = async (transactionId: string, partyId: string, realtorId?: string) => {
    if (!db || !transactionId || !partyId) return false;
    try {
        const rid = requireTenantId(realtorId);

        // 1. Delete Legacy if exists
        const legacyRef = doc(db, "realtors", rid, "transaction_parties", partyId);
        await deleteDoc(legacyRef).catch(() => {});

        // 2. Delete Nested
        const nestedRef = doc(db, "realtors", rid, "transactions", transactionId, "parties", partyId);
        await deleteDoc(nestedRef);

        await logAuditEvent({
            transaction_id: transactionId,
            entity_id: partyId,
            entity_type: 'Party',
            action: 'DELETE'
        }, rid);

        return true;
    } catch (error) {
        handleFirestoreError(error, "deleteTransactionParty");
        return false;
    }
};

export const seedPartiesForTransaction = async (transactionId: string, realtorId?: string) => {
    if (!db) return;
    try {
        const rid = requireTenantId(realtorId);
        const existing = await getTransactionParties(transactionId, rid);
        if (existing.length > 0) {
            console.log(`[seedPartiesForTransaction] Skipping — ${existing.length} parties already exist for tx: ${transactionId}`);
            return;
        }
        const MOCK_PARTIES_DATA = generateMockTransactionParties(transactionId);
        for (const party of MOCK_PARTIES_DATA) {
            const slug = (party.role || party.name || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_');
            const deterministicId = `party_${transactionId}_${slug}`;
            const payload = sanitizeForFirestore({
                ...party,
                id: deterministicId,
                transaction_id: transactionId,
                created_at: serverTimestamp()
            });

            // Legacy path
            const legacyRef = doc(db, "realtors", rid, "transaction_parties", deterministicId);
            const legacySnap = await getDoc(legacyRef);
            if (!legacySnap.exists()) await setDoc(legacyRef, payload);

            // Nested path
            const nestedRef = doc(db, "realtors", rid, "transactions", transactionId, "parties", deterministicId);
            const nestedSnap = await getDoc(nestedRef);
            if (!nestedSnap.exists()) await setDoc(nestedRef, payload);
        }
    } catch (error) {
        console.error("Error seeding parties:", error);
    }
};
