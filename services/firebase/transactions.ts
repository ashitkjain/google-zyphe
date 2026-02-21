import { collection, doc, query, where, getDocs, addDoc, getDoc, setDoc, serverTimestamp, writeBatch, orderBy, WriteBatch } from "firebase/firestore";
import {
    db,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError
} from "./config";
import { Transaction, ChecklistCategory, CRMTask, CalendarEvent } from "../../types";
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

/**
 * Syncs key transaction milestones and high-priority tasks to the calendar.
 */
export const syncTransactionToCalendar = (batch: WriteBatch, transaction: Transaction, checklist: ChecklistCategory[]) => {
    if (!db) return;
    const transactionId = transaction.id;
    const realtorId = transaction.realtorId;
    const propertyAddress = transaction.property?.address || 'TBD';

    // 1. Sync Milestones
    const milestones = [
        { type: 'Acceptance', date: transaction.important_dates?.acceptance_date },
        { type: 'Contingency Removal', date: transaction.important_dates?.contingency_removal_date },
        { type: 'Close of Escrow', date: transaction.close_of_escrow_date }
    ];

    milestones.forEach(m => {
        if (m.date) {
            const eventId = `milestone_${transactionId}_${m.type.replace(/\s+/g, '_')}`;
            const eventRef = doc(db, "calendar_events", eventId);

            // Convert possible JS Date/Timestamp to Firestore compatible
            const startTime = m.date;

            const eventData: CalendarEvent = {
                id: eventId,
                realtorId,
                transactionId,
                clientId: transaction.clientId,
                title: `${m.type}: ${propertyAddress}`,
                start: startTime,
                end: startTime, // Single day event
                type: 'appointment',
                description: `Transaction milestone for ${propertyAddress}`,
                isMock: transaction.isMock
            };
            batch.set(eventRef, sanitizeForFirestore(eventData), { merge: true });
        }
    });

    // 2. Sync Key Tasks
    checklist.forEach(cat => {
        cat.tasks?.forEach(t => {
            const keyKeywords = ['Appraisal', 'Inspection', 'Signing', 'Walk-through', 'Closing'];
            const isKeyTask = keyKeywords.some(k => t.name?.toLowerCase().includes(k.toLowerCase()));

            if (isKeyTask && t.dueDate) {
                const eventId = `task_${t.id}`;
                const eventRef = doc(db, "calendar_events", eventId);
                const eventData: CalendarEvent = {
                    id: eventId,
                    realtorId,
                    transactionId,
                    clientId: transaction.clientId,
                    title: `TASK: ${t.name}`,
                    start: t.dueDate,
                    end: t.dueDate,
                    type: 'task',
                    description: `Transaction task for ${propertyAddress}`,
                    isMock: transaction.isMock
                };
                batch.set(eventRef, sanitizeForFirestore(eventData), { merge: true });
            }
        });
    });
};

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
        const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CRMTask));

        // Deduplicate: if multiple tasks share the same name+categoryId (caused by
        // createTransaction being called more than once), keep only the newest one.
        const seen = new Map<string, CRMTask>();
        for (const task of all) {
            const key = `${task.categoryId}__${task.name}`;
            const existing = seen.get(key);
            if (!existing) {
                seen.set(key, task);
            } else {
                // Keep the one with the later createdAt
                const existingTime = (existing as any).createdAt?.toDate?.()?.getTime() ?? 0;
                const thisTime = (task as any).createdAt?.toDate?.()?.getTime() ?? 0;
                if (thisTime > existingTime) seen.set(key, task);
            }
        }
        return Array.from(seen.values());
    } catch (error) {
        handleFirestoreError(error, "getTransactionTasks");
        return [];
    }
};

/**
 * Builds the deterministic checklist in memory (synchronous).
 * Only computes IDs and schedules — does NOT write to Firestore.
 * Used by createTransaction to get the checklist structure for the
 * transaction document itself.
 */
export const buildTaskChecklist = (transaction: Transaction, initialCategories: ChecklistCategory[]): ChecklistCategory[] => {
    const oldIdToNewId: Record<string, string> = {};

    // Generate DETERMINISTIC IDs: task_{transactionId}_{categoryId}_{templateTaskId}
    for (const cat of initialCategories) {
        for (const t of cat.tasks) {
            const safeTemplateId = t.id.replace(/[^a-zA-Z0-9_-]/g, '_');
            oldIdToNewId[t.id] = `task_${transaction.id}_${cat.id}_${safeTemplateId}`;
        }
    }

    const baseDate = transaction.important_dates?.acceptance_date?.toDate
        ? transaction.important_dates.acceptance_date.toDate()
        : (transaction.important_dates?.acceptance_date ? new Date(transaction.important_dates.acceptance_date) : new Date());

    return calculateChecklistSchedule(initialCategories, baseDate, oldIdToNewId);
};

/**
 * Writes task documents to Firestore with immutable create-only semantics.
 * Each task gets a getDoc check — if the document already exists it is
 * NEVER overwritten, preserving any user edits (status, comments, dates).
 */
export const seedTaskDocuments = async (transaction: Transaction, finalChecklist: ChecklistCategory[]): Promise<void> => {
    if (!db) return;
    for (const cat of finalChecklist) {
        for (const t of cat.tasks) {
            const taskDocRef = doc(db, "tasks", t.id);
            const snap = await getDoc(taskDocRef);
            if (snap.exists()) continue; // Immutable: never overwrite an existing task

            await setDoc(taskDocRef, sanitizeForFirestore({
                id: t.id,
                realtorId: transaction.realtorId,
                clientId: transaction.clientId || null,
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
                isMock: transaction.isMock ?? false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }));
        }
    }
};

/** @deprecated Use buildTaskChecklist + seedTaskDocuments — kept for backward compat */
export const seedTasksForTransaction = (batch: any, transaction: Transaction, initialCategories: ChecklistCategory[]): ChecklistCategory[] => {
    return buildTaskChecklist(transaction, initialCategories);
};


export const createTransaction = async (transaction: Transaction, initialCategories?: ChecklistCategory[]) => {
    if (!db) return null;
    const batch = writeBatch(db);
    try {
        const docRef = transaction.id ? doc(db, "transactions", transaction.id) : doc(collection(db, "transactions"));
        const transactionId = docRef.id;
        const finalTransactionObj = { ...transaction, id: transactionId };

        let finalChecklist: ChecklistCategory[] = [];
        let fullChecklistForCalendar: ChecklistCategory[] = [];

        if (initialCategories) {
            // Build checklist in memory (computes deterministic IDs + schedule) — no writes yet
            fullChecklistForCalendar = buildTaskChecklist(finalTransactionObj, initialCategories);
            finalChecklist = fullChecklistForCalendar.map(cat => ({
                ...cat,
                tasks: cat.tasks.map(t => ({ id: t.id }))
            }));
        } else {
            finalChecklist = transaction.checklist as any || [];
            fullChecklistForCalendar = finalChecklist;
        }

        const finalTransaction = {
            ...finalTransactionObj,
            checklist: finalChecklist
        };

        // Sync to calendar
        syncTransactionToCalendar(batch, finalTransaction, fullChecklistForCalendar);

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

        // After the transaction doc is committed, seed tasks + parties + documents.
        // All three seed functions use immutable create-only writes (getDoc check before setDoc).
        // Re-calling createTransaction for the same client is safe — nothing gets overwritten.
        if (initialCategories) {
            await seedTaskDocuments(finalTransaction, fullChecklistForCalendar);
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

        // 2. Delete associated calendar events
        const calendarQuery = query(collection(db, "calendar_events"), where("transactionId", "==", transactionId));
        const calendarSnap = await getDocs(calendarQuery);
        calendarSnap.forEach((doc) => {
            batch.delete(doc.ref);
        });

        // 3. Delete the transaction document
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
