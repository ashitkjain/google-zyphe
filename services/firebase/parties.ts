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
        logFirestoreQuery('getDocs', 'transaction_parties', { transaction_id: transactionId });
        const q = query(
            collection(db, "realtors", rid, "transaction_parties"),
            where("transaction_id", "==", transactionId),
            orderBy("created_at", "asc")
        );
        const snap = await getDocs(q);
        const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionParty));

        // Deduplicate: keep only the most recent party per role
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
    } catch (error) {
        handleFirestoreError(error, "getTransactionParties");
        return [];
    }
};

export const addTransactionParty = async (transactionId: string, party: Partial<TransactionParty>, realtorId?: string) => {
    if (!db || !transactionId) return null;
    try {
        const rid = requireTenantId(realtorId);
        logFirestoreQuery('addDoc', 'transaction_parties', party);
        const docRef = await addDoc(collection(db, "realtors", rid, "transaction_parties"), {
            ...sanitizeForFirestore(party),
            transaction_id: transactionId,
            created_at: serverTimestamp()
        });

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
        logFirestoreQuery('updateDoc', 'transaction_parties', { partyId });
        const docRef = doc(db, "realtors", rid, "transaction_parties", partyId);
        await updateDoc(docRef, sanitizeForFirestore(updates));

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
        logFirestoreQuery('deleteDoc', 'transaction_parties', { partyId });
        const docRef = doc(db, "realtors", rid, "transaction_parties", partyId);
        await deleteDoc(docRef);

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
            const docRef = doc(db, "realtors", rid, "transaction_parties", deterministicId);
            const snap = await getDoc(docRef);
            if (!snap.exists()) {
                await setDoc(docRef, sanitizeForFirestore({
                    ...party,
                    id: deterministicId,
                    transaction_id: transactionId,
                    created_at: serverTimestamp()
                }));
            }
        }
    } catch (error) {
        console.error("Error seeding parties:", error);
    }
};
