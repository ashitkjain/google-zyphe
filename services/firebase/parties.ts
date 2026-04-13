import { collection, query, where, orderBy, getDocs, addDoc, setDoc, getDoc, serverTimestamp, doc, updateDoc, deleteDoc } from "firebase/firestore";
import {
    db,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError
} from "./config";
import { requireTenantId } from "./tenantContext";
import { TransactionParty } from "../../types";
import { generateMockTransactionParties } from "../../tests/mocks/mockData";

export const getTransactionParties = async (transactionId: string, realtorId?: string) => {
    if (!db || !transactionId) return [];
    try {
        const rid = requireTenantId(realtorId);

        // Use nested path (ONLY)
        const nestedSnap = await getDocs(query(
            collection(db, "realtors", rid, "transactions", transactionId, "parties"),
            orderBy("created_at", "asc")
        ));
        
        const all = nestedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionParty));
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

        // Nested write (ONLY)
        const docRef = await addDoc(collection(db, "realtors", rid, "transactions", transactionId, "parties"), payload);


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

        // Update Nested (ONLY)
        const nestedRef = doc(db, "realtors", rid, "transactions", transactionId, "parties", partyId);
        await updateDoc(nestedRef, sanitized);


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

        // Delete Nested (ONLY)
        const nestedRef = doc(db, "realtors", rid, "transactions", transactionId, "parties", partyId);
        await deleteDoc(nestedRef);


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

            // Nested path (ONLY)
            const nestedRef = doc(db, "realtors", rid, "transactions", transactionId, "parties", deterministicId);
            const nestedSnap = await getDoc(nestedRef);
            if (!nestedSnap.empty) {
                // do nothing
            } else {
                await setDoc(nestedRef, payload);
            }
        }
    } catch (error) {
        console.error("Error seeding parties:", error);
    }
};
