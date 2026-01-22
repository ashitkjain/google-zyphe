import { collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from "firebase/firestore";
import {
    db,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError
} from "./config";
import { TransactionParty } from "../../types";
import { generateMockTransactionParties } from "../mockData";

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
