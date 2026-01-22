import { collection, doc, query, where, getDocs, addDoc, serverTimestamp, setDoc, writeBatch, orderBy } from "firebase/firestore";
import {
    db,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError
} from "./config";
import { Transaction, ChecklistCategory, CRMTask } from "../../types";
import { calculateChecklistSchedule, getInitialCategories } from "../transactionService";
import { seedPartiesForTransaction } from "./parties";
import { seedDocumentsForTransaction } from "./documents";
import { logAuditEvent } from "./audit";

// ===== TRANSACTIONS & TASKS =====

export const getTransactions = async (realtorId: string) => {
    if (!db || !realtorId) return [];
    try {
        logFirestoreQuery('getDocs', 'transactions', { realtorId });
        const q = query(collection(db, "transactions"), where("realtorId", "==", realtorId));
        const snap = await getDocs(q);
        // Convert timestamps back to dates if needed, or rely on client to handle
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
    } catch (error) {
        handleFirestoreError(error, "getTransactions");
        return [];
    }
};

export const getTransactionByClientId = async (clientId: string, realtorId: string) => {
    if (!db || !clientId || !realtorId) return null;
    try {
        logFirestoreQuery('getDocs', 'transactions', { clientId, realtorId });
        const q = query(
            collection(db, "transactions"),
            where("realtorId", "==", realtorId),
            where("clientId", "==", clientId)
        );
        const snap = await getDocs(q);
        if (snap.empty) return null;
        const data = snap.docs[0].data();
        return { id: snap.docs[0].id, ...data } as Transaction;
    } catch (error) {
        handleFirestoreError(error, "getTransactionByClientId");
        return null;
    }
};

export const updateTransaction = async (transactionId: string, updates: Partial<Transaction>) => {
    if (!db) return false;
    try {
        const docRef = doc(db, "transactions", transactionId);
        logFirestoreQuery('setDoc', 'transactions', { transactionId });
        await setDoc(docRef, sanitizeForFirestore({
            ...updates,
            updated_at: serverTimestamp()
        }), { merge: true });

        // Log Audit
        await logAuditEvent({
            transaction_id: transactionId,
            entity_id: transactionId,
            entity_type: 'Transaction',
            action: 'UPDATE',
            diff: { after: updates }
        });

        return true;
    } catch (error) {
        handleFirestoreError(error, "updateTransaction");
        return false;
    }
};

// Transaction Tasks Logic

export const getTransactionTasks = async (transactionId: string, realtorId: string) => {
    if (!db || !transactionId || !realtorId) return [];
    try {
        const q = query(
            collection(db, "tasks"),
            where("realtorId", "==", realtorId),
            where("transaction_id", "==", transactionId)
        );
        logFirestoreQuery('getDocs', 'tasks', { transactionId, realtorId });
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CRMTask));
    } catch (error) {
        handleFirestoreError(error, "getTransactionTasks");
        return [];
    }
};

export const seedTasksForTransaction = (batch: any, transaction: Transaction, initialCategories: ChecklistCategory[]): ChecklistCategory[] => {
    const oldIdToNewId: Record<string, string> = {};

    // First pass: Pre-generate IDs to ensure they are available for dependency mapping
    for (const cat of initialCategories) {
        for (const t of cat.tasks) {
            oldIdToNewId[t.id] = doc(collection(db, "tasks")).id;
        }
    }

    // Second pass: Use shared scheduling logic to calculate all dates and map IDs
    const baseDate = transaction.important_dates?.acceptance_date?.toDate
        ? transaction.important_dates.acceptance_date.toDate()
        : (transaction.important_dates?.acceptance_date ? new Date(transaction.important_dates.acceptance_date) : new Date());

    const finalChecklist = calculateChecklistSchedule(initialCategories, baseDate, oldIdToNewId);

    // Third pass: Add individual CRMTask documents to the batch
    finalChecklist.forEach(cat => {
        cat.tasks.forEach(t => {
            const taskDocRef = doc(db, "tasks", t.id);
            const taskData = {
                id: t.id,
                realtorId: transaction.realtorId,
                clientId: transaction.clientId || null, // Ensuring clientId from transaction is propagated to tasks
                transaction_id: transaction.id,
                name: t.name,
                comment: t.comments || '',
                status: t.status,
                priority: 'Normal',
                startDate: t.startDate,
                dueDate: t.dueDate,
                createDate: new Date(),
                dependsOn: t.dependsOn,
                durationDays: t.durationDays,
                categoryId: cat.id,
                isMock: transaction.isMock ?? false, // Inherit mock status from transaction
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            batch.set(taskDocRef, sanitizeForFirestore(taskData));
        });
    });

    // Return a lean structural checklist (only IDs for tasks) to be saved in the Transaction doc
    return finalChecklist.map(cat => ({
        ...cat,
        tasks: cat.tasks.map(t => ({ id: t.id }))
    }));
};

export const createTransaction = async (transaction: Transaction, initialCategories?: ChecklistCategory[]) => {
    if (!db) return null;
    const batch = writeBatch(db);
    try {
        const docRef = transaction.id ? doc(db, "transactions", transaction.id) : doc(collection(db, "transactions"));
        const transactionId = docRef.id;
        const finalTransactionObj = { ...transaction, id: transactionId };

        let finalChecklist: ChecklistCategory[] = [];

        if (initialCategories) {
            finalChecklist = seedTasksForTransaction(batch, finalTransactionObj, initialCategories);
        } else {
            finalChecklist = transaction.checklist as any || [];
        }

        const finalTransaction = {
            ...finalTransactionObj,
            checklist: finalChecklist
        };

        logFirestoreQuery('setDoc (batch)', 'transactions', { id: transactionId });
        batch.set(docRef, sanitizeForFirestore({
            ...finalTransaction,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
        }));

        await batch.commit();

        // Log Audit
        await logAuditEvent({
            transaction_id: transactionId,
            entity_id: transactionId,
            entity_type: 'Transaction',
            action: 'CREATE',
            diff: { after: finalTransactionObj }
        });

        // After commit, seed initial parties and documents (asynchronously)
        if (initialCategories) {
            // We start these but don't await them to block return? 
            // Actually we probably should await inside try/catch so user knows it's fully done or handle error.
            // But preserving original logic which called them.
            await seedPartiesForTransaction(transactionId);
            await seedDocumentsForTransaction(transactionId);
        }

        return finalTransaction;
    } catch (error) {
        handleFirestoreError(error, "createTransaction");
        return null;
    }
};

export const deleteTransaction = async (transactionId: string) => {
    if (!db) return false;
    const batch = writeBatch(db);
    try {
        logFirestoreQuery('deleteTransaction', 'transactions', { transactionId });

        // 1. Delete associated tasks
        const tasksQuery = query(collection(db, "tasks"), where("transaction_id", "==", transactionId));
        const tasksSnap = await getDocs(tasksQuery);
        tasksSnap.forEach((doc) => {
            batch.delete(doc.ref);
        });

        // 2. Delete the transaction document
        const transactionRef = doc(db, "transactions", transactionId);
        batch.delete(transactionRef);

        // 4. Log Audit (in batch)
        await logAuditEvent({
            transaction_id: transactionId,
            entity_id: transactionId,
            entity_type: 'Transaction',
            action: 'DELETE',
            batch: batch // Pass batch reference
        } as any);

        // 3. Commit batch
        await batch.commit();

        return true;
    } catch (error) {
        handleFirestoreError(error, "deleteTransaction");
        return false;
    }
};
