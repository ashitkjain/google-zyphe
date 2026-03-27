import { collection, doc, query, where, getDocs, addDoc, getDoc, setDoc, serverTimestamp, writeBatch, orderBy, WriteBatch } from "firebase/firestore";
import {
    db,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError
} from "./config";
import { requireTenantId } from "./tenantContext";
import { Transaction, ChecklistCategory, CRMTask, CalendarEvent } from "../../types";
import { calculateChecklistSchedule, getInitialCategories } from "../transactionService";
import { seedPartiesForTransaction } from "./parties";
import { seedDocumentsForTransaction } from "./documents";
import { logAuditEvent } from "./audit";

// ===== TRANSACTIONS & TASKS =====

export const getTransactions = async (realtorId: string) => {
    if (!db || !realtorId) return [];
    try {
        const rid = requireTenantId(realtorId);
        logFirestoreQuery('getDocs', 'transactions', { realtorId });
        const q = query(collection(db, "realtors", rid, "transactions"));
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
    } catch (error) {
        handleFirestoreError(error, "getTransactions");
        return [];
    }
};

export const getTransactionByClientId = async (clientId: string, realtorId: string) => {
    if (!db || !clientId || !realtorId) return null;
    try {
        const rid = requireTenantId(realtorId);
        logFirestoreQuery('getDocs', 'transactions', { clientId, realtorId });
        const q = query(
            collection(db, "realtors", rid, "transactions"),
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

export const updateTransaction = async (transactionId: string, updates: Partial<Transaction>, realtorId?: string) => {
    if (!db) return false;
    try {
        const rid = requireTenantId(realtorId);
        const docRef = doc(db, "realtors", rid, "transactions", transactionId);
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
        }, rid);

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
    const rid = requireTenantId(realtorId);
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
            const eventRef = doc(db, "realtors", rid, "calendar_events", eventId);

            const startTime = m.date;

            const eventData: CalendarEvent = {
                id: eventId,
                realtorId,
                transactionId,
                clientId: transaction.clientId,
                title: `${m.type}: ${propertyAddress}`,
                start: startTime,
                end: startTime,
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
                const eventRef = doc(db, "realtors", rid, "calendar_events", eventId);
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
        const rid = requireTenantId(realtorId);

        // 1. Try new nested path
        const nestedSnap = await getDocs(query(collection(db, "realtors", rid, "transactions", transactionId, "tasks")));
        if (!nestedSnap.empty) {
            const all = nestedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CRMTask));
            return deduplicateTasks(all);
        }

        // 2. Fallback to legacy path
        const q = query(
            collection(db, "realtors", rid, "tasks"),
            where("transaction_id", "==", transactionId)
        );
        logFirestoreQuery('getDocs', 'tasks', { transactionId, realtorId });
        const snap = await getDocs(q);
        const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CRMTask));
        return deduplicateTasks(all);
    } catch (error) {
        handleFirestoreError(error, "getTransactionTasks");
        return [];
    }
};

/** Shared task deduplication logic */
const deduplicateTasks = (all: CRMTask[]): CRMTask[] => {
    const seen = new Map<string, CRMTask>();
    for (const task of all) {
        const key = `${task.categoryId}__${task.name}`;
        const existing = seen.get(key);
        if (!existing) {
            seen.set(key, task);
        } else {
            const existingTime = (existing as any).createdAt?.toDate?.()?.getTime() ?? 0;
            const thisTime = (task as any).createdAt?.toDate?.()?.getTime() ?? 0;
            if (thisTime > existingTime) seen.set(key, task);
        }
    }
    return Array.from(seen.values());
};

/**
 * Builds the deterministic checklist in memory (synchronous).
 */
export const buildTaskChecklist = (transaction: Transaction, initialCategories: ChecklistCategory[]): ChecklistCategory[] => {
    const oldIdToNewId: Record<string, string> = {};

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
 */
export const seedTaskDocuments = async (transaction: Transaction, finalChecklist: ChecklistCategory[]): Promise<void> => {
    if (!db) return;
    const rid = requireTenantId(transaction.realtorId);
    for (const cat of finalChecklist) {
        for (const t of cat.tasks) {
            const payload = sanitizeForFirestore({
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
            });

            // 1. Legacy write
            const legacyRef = doc(db, "realtors", rid, "tasks", t.id);
            const legacySnap = await getDoc(legacyRef);
            if (!legacySnap.exists()) await setDoc(legacyRef, payload);

            // 2. Nested write
            const nestedRef = doc(db, "realtors", rid, "transactions", transaction.id, "tasks", t.id);
            const nestedSnap = await getDoc(nestedRef);
            if (!nestedSnap.exists()) await setDoc(nestedRef, payload);
        }
    }
};

/** @deprecated Use buildTaskChecklist + seedTaskDocuments — kept for backward compat */
export const seedTasksForTransaction = (batch: any, transaction: Transaction, initialCategories: ChecklistCategory[]): ChecklistCategory[] => {
    return buildTaskChecklist(transaction, initialCategories);
};


export const createTransaction = async (transaction: Transaction, initialCategories?: ChecklistCategory[]) => {
    if (!db) return null;
    const rid = requireTenantId(transaction.realtorId);
    const batch = writeBatch(db);
    try {
        const docRef = transaction.id
            ? doc(db, "realtors", rid, "transactions", transaction.id)
            : doc(collection(db, "realtors", rid, "transactions"));
        const transactionId = docRef.id;
        const finalTransactionObj = { ...transaction, id: transactionId };

        let finalChecklist: ChecklistCategory[] = [];
        let fullChecklistForCalendar: ChecklistCategory[] = [];

        if (initialCategories) {
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
        }, rid);

        // Seed tasks + parties + documents (immutable create-only)
        if (initialCategories) {
            await seedTaskDocuments(finalTransaction, fullChecklistForCalendar);
            await seedPartiesForTransaction(transactionId, rid);
            await seedDocumentsForTransaction(transactionId, rid);
        }

        return finalTransaction;
    } catch (error) {
        handleFirestoreError(error, "createTransaction");
        return null;
    }
};

export const deleteTransaction = async (transactionId: string, realtorId?: string) => {
    if (!db) return false;
    const rid = requireTenantId(realtorId);
    const batch = writeBatch(db);
    try {
        logFirestoreQuery('deleteTransaction', 'transactions', { transactionId });

        // 1. Delete legacy associated tasks
        const tasksQuery = query(collection(db, "realtors", rid, "tasks"), where("transaction_id", "==", transactionId));
        const tasksSnap = await getDocs(tasksQuery);
        tasksSnap.forEach((doc) => batch.delete(doc.ref));

        // 2. Delete legacy associated parties
        const partiesQuery = query(collection(db, "realtors", rid, "transaction_parties"), where("transaction_id", "==", transactionId));
        const partiesSnap = await getDocs(partiesQuery);
        partiesSnap.forEach((doc) => batch.delete(doc.ref));

        // 3. Delete legacy associated documents
        const docsQuery = query(collection(db, "realtors", rid, "transaction_documents"), where("transaction_id", "==", transactionId));
        const docsSnap = await getDocs(docsQuery);
        docsSnap.forEach((doc) => batch.delete(doc.ref));

        // 4. Delete legacy associated audit events
        const auditsQuery = query(collection(db, "realtors", rid, "audit_events"), where("transaction_id", "==", transactionId));
        const auditsSnap = await getDocs(auditsQuery);
        auditsSnap.forEach((doc) => batch.delete(doc.ref));

        // 5. Delete associated calendar events
        const calendarQuery = query(collection(db, "realtors", rid, "calendar_events"), where("transactionId", "==", transactionId));
        const calendarSnap = await getDocs(calendarQuery);
        calendarSnap.forEach((doc) => batch.delete(doc.ref));

        // 6. Delete Nested Subcollections (Transaction DNA)
        const nestedSubs = ['tasks', 'parties', 'documents', 'audit_events'];
        for (const sub of nestedSubs) {
            const snap = await getDocs(collection(db, "realtors", rid, "transactions", transactionId, sub));
            snap.forEach(d => batch.delete(d.ref));
        }

        // 7. Delete the transaction document
        const transactionRef = doc(db, "realtors", rid, "transactions", transactionId);
        batch.delete(transactionRef);

        // 8. Log Audit (in batch)
        await logAuditEvent({
            transaction_id: transactionId,
            entity_id: transactionId,
            entity_type: 'Transaction',
            action: 'DELETE',
            batch: batch
        } as any, rid);

        await batch.commit();

        return true;
    } catch (error) {
        handleFirestoreError(error, "deleteTransaction");
        return false;
    }
};
