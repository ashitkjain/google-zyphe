import { collection, query, where, orderBy, getDocs, addDoc, setDoc, serverTimestamp, doc, updateDoc, deleteDoc } from "firebase/firestore";
import {
    db,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError
} from "./config";
import { TransactionParty } from "../../types";
import { generateMockTransactionParties } from "../mockData";
import { logAuditEvent } from "./audit";

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
        const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionParty));

        // Deduplicate: keep only the most recent party per role (handles double-seeding)
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

export const addTransactionParty = async (transactionId: string, party: Partial<TransactionParty>) => {
    if (!db || !transactionId) return null;
    try {
        logFirestoreQuery('addDoc', 'transaction_parties', party);
        const docRef = await addDoc(collection(db, "transaction_parties"), {
            ...sanitizeForFirestore(party),
            transaction_id: transactionId,
            created_at: serverTimestamp()
        });

        // Log Audit
        await logAuditEvent({
            transaction_id: transactionId,
            entity_id: docRef.id,
            entity_type: 'Party',
            action: 'CREATE',
            diff: { after: party }
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

        // Log Audit
        await logAuditEvent({
            transaction_id: transactionId,
            entity_id: partyId,
            entity_type: 'Party',
            action: 'UPDATE',
            diff: { after: updates }
        });

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

        // Log Audit
        await logAuditEvent({
            transaction_id: transactionId,
            entity_id: partyId,
            entity_type: 'Party',
            action: 'DELETE'
        });

        return true;
    } catch (error) {
        handleFirestoreError(error, "deleteTransactionParty");
        return false;
    }
};

export const seedPartiesForTransaction = async (transactionId: string) => {
    if (!db) return;
    try {
        // Guard: skip seeding if parties already exist for this transaction
        const existing = await getTransactionParties(transactionId);
        if (existing.length > 0) {
            console.log(`[seedPartiesForTransaction] Skipping — ${existing.length} parties already exist for tx: ${transactionId}`);
            return;
        }
        const MOCK_PARTIES_DATA = generateMockTransactionParties(transactionId);
        for (const party of MOCK_PARTIES_DATA) {
            // Deterministic ID: party_{transactionId}_{slugifiedRole} — setDoc is idempotent
            const slug = (party.role || party.name || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_');
            const deterministicId = `party_${transactionId}_${slug}`;
            const docRef = doc(db, "transaction_parties", deterministicId);
            await setDoc(docRef, sanitizeForFirestore({
                ...party,
                id: deterministicId,
                transaction_id: transactionId,
                created_at: serverTimestamp()
            }), { merge: true });
        }
    } catch (error) {
        console.error("Error seeding parties:", error);
    }
};
