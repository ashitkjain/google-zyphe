import { doc, getDoc, setDoc, collection, addDoc, query, where, getDocs, serverTimestamp, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import {
    db,
    auth,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError
} from "./config";
import { createTransaction, getTransactionByClientId, deleteTransaction } from "./transactions";
import { getInitialCategories } from "../transactionService";
import { Lead, CRMTask, CommTemplate, PipelineNote, FunnelStage, Transaction } from "../../types";
import { logAuditEvent } from "./audit";

// ===== LEADS & FUNNEL =====

export const updateFunnelStage = async (id: string, stage: FunnelStage, reason?: string, isLead = false) => {
    if (!db) return false;
    try {
        const docRef = doc(db, isLead ? "leads" : "users", id);
        logFirestoreQuery('getDoc', isLead ? "leads" : "users", { id });
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            console.error("Document not found for updateFunnelStage");
            return false;
        }

        const data = snap.data();
        const oldStage = (data.funnelStage as FunnelStage) || 'Inquiry';

        if (oldStage === stage) return true;

        // --- Lifecycle Logic ---
        let stageHistory = (data.stageHistory || []) as any[];
        const now = new Date();

        // 1. Stamping previous
        if (stageHistory.length > 0) {
            const lastEntry = stageHistory[stageHistory.length - 1];
            if (!lastEntry.exitedAt) {
                const enteredParams = lastEntry.enteredAt;
                let enteredDate = now;
                // Handle Firestore Timestamp or JS Date
                if (enteredParams && typeof enteredParams.toDate === 'function') {
                    enteredDate = enteredParams.toDate();
                } else if (enteredParams instanceof Date) {
                    enteredDate = enteredParams;
                }

                stageHistory[stageHistory.length - 1] = {
                    ...lastEntry,
                    exitedAt: now
                };
            }
        }

        // 2. Initiating new
        stageHistory.push({
            fromStage: oldStage,
            toStage: stage,
            enteredAt: new Date()
        });

        logFirestoreQuery('setDoc', isLead ? 'leads' : 'users', { id });
        await setDoc(docRef, {
            funnelStage: stage,
            updatedAt: serverTimestamp(),
            stageHistory: stageHistory,

        }, { merge: true });

        // Log Journey Event
        const journeyCol = collection(db, "journey_events");
        await addDoc(journeyCol, {
            clientId: id,
            fromStage: oldStage,
            toStage: stage,
            timestamp: serverTimestamp(),
            reason: reason || 'Manual Update',
            realtorId: auth?.currentUser?.uid || 'unknown'
        });

        // --- AUTOMATION: Create Transaction on 'Contract' ---
        if (stage === 'Contract') {
            try {
                const realtorId = (data.realtorId as string) || auth?.currentUser?.uid;
                if (realtorId) {
                    const existingTx = await getTransactionByClientId(id, realtorId);
                    if (!existingTx) {
                        const leadData = data as Lead;
                        const txType = leadData.leadType === 'Seller' ? 'SELL' : 'BUY';

                        const newTransaction: Transaction = {
                            id: '', // Will be generated
                            realtorId: realtorId,
                            clientId: id,
                            type: txType,
                            status: 'ACTIVE',
                            property: {
                                address: leadData.leadInfo?.inquiryProperty?.address || leadData.listingStatus?.property?.address || 'TBD',
                                price: leadData.activeOffer?.price || leadData.financialVitals?.budgetMax || 0
                            },
                            apn: '',
                            state: 'CA', // Defaulting or should extract from address if possible
                            purchase_price: leadData.activeOffer?.price,
                            commission: '2.5%', // Default as requested
                            close_of_escrow_date: leadData.criticalDates?.closingDate,
                            important_dates: {
                                acceptance_date: new Date(), // Assumption: entering Contract means accepted
                                closing_date: leadData.criticalDates?.closingDate
                            },
                            checklist: [], // Will be seeded
                            created_at: new Date(),
                            updated_at: new Date()
                        };

                        const initialChecklist = getInitialCategories(txType === 'SELL' ? 'Seller' : 'Buyer');
                        await createTransaction(newTransaction, initialChecklist);
                        console.log("Auto-created transaction for client:", id);
                    }
                }
            } catch (err) {
                console.error("Failed to auto-create transaction:", err);
                // Non-blocking error
            }
        }

        // --- AUTOMATION: Delete Transaction if moving back from Closing/Contract ---
        const closingStages: FunnelStage[] = ['Contract', 'Closed'];
        const preClosingStages: FunnelStage[] = ['Leads', 'Nurture', 'Active Search', 'Offer'];

        if (closingStages.includes(oldStage as FunnelStage) && preClosingStages.includes(stage)) {
            try {
                const realtorId = (data.realtorId as string) || auth?.currentUser?.uid;
                if (realtorId) {
                    const existingTx = await getTransactionByClientId(id, realtorId);
                    if (existingTx) {
                        await deleteTransaction(existingTx.id);
                        console.log("Auto-deleted transaction for client rollback:", id);
                    }
                }
            } catch (err) {
                console.error("Failed to auto-delete transaction:", err);
            }
        }

        return true;
    } catch (error) {
        handleFirestoreError(error, "updateFunnelStage");
        return false;
    }
};

export const updateLead = async (leadId: string, updates: Partial<Lead>, collectionName: string = 'leads') => {
    if (!db) return false;
    try {
        // Intercept funnelStage changes to trigger lifecycle logic (history, automation)
        if (updates.funnelStage) {
            await updateFunnelStage(leadId, updates.funnelStage, undefined, collectionName === 'leads');
        }

        const docRef = doc(db, collectionName, leadId);
        await setDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp(),
            lastUpdated: serverTimestamp()
        }, { merge: true });
        return true;
    } catch (error) {
        handleFirestoreError(error, `updateLead (${collectionName})`);
        return false;
    }
};

export const getLeads = async (realtorId: string, collectionNames: string[] = ['leads']) => {
    if (!db) return [];
    try {
        const allLeads: Lead[] = [];
        for (const name of collectionNames) {
            const q = query(collection(db, name), where("realtorId", "==", realtorId));
            logFirestoreQuery('getDocs', name, { realtorId });
            const snap = await getDocs(q);
            allLeads.push(...snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                collectionName: name
            } as Lead)));
        }
        return allLeads;
    } catch (error) {
        handleFirestoreError(error, "getLeads");
        return [];
    }
};

// ===== TASKS =====

export const getTasks = async (realtorId: string) => {
    if (!db) return [];
    try {
        const q = query(collection(db, "tasks"), where("realtorId", "==", realtorId));
        logFirestoreQuery('getDocs', 'tasks', { realtorId });
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CRMTask));
    } catch (error) {
        handleFirestoreError(error, "getTasks");
        return [];
    }
};

export const addTask = async (task: Partial<CRMTask>) => {
    if (!db) return null;
    try {
        logFirestoreQuery('addDoc', 'tasks', task);
        const docRef = await addDoc(collection(db, "tasks"), {
            ...sanitizeForFirestore(task),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // Log Audit
        if (task.transaction_id) {
            await logAuditEvent({
                transaction_id: task.transaction_id,
                entity_id: docRef.id,
                entity_type: 'Task',
                action: 'CREATE',
                diff: { after: task }
            });
        }

        return docRef.id;
    } catch (error) {
        handleFirestoreError(error, "addTask");
        return null;
    }
};

export const updateTask = async (taskId: string, updates: Partial<CRMTask>, transactionId?: string) => {
    if (!db) return false;
    try {
        const taskRef = doc(db, "tasks", taskId);
        await updateDoc(taskRef, sanitizeForFirestore({
            ...updates,
            updatedAt: serverTimestamp()
        }));

        // Log Audit
        const finalTxId = transactionId || (updates as any).transaction_id;
        if (finalTxId) {
            await logAuditEvent({
                transaction_id: finalTxId,
                entity_id: taskId,
                entity_type: 'Task',
                action: 'UPDATE',
                diff: { after: updates }
            });
        }

        return true;
    } catch (error) {
        handleFirestoreError(error, "updateTask");
        return false;
    }
};

export const deleteTask = async (taskId: string, transactionId?: string) => {
    if (!db) return false;
    try {
        const docRef = doc(db, "tasks", taskId);
        logFirestoreQuery('deleteDoc', 'tasks', { taskId });
        await deleteDoc(docRef);

        // Log Audit
        if (transactionId) {
            await logAuditEvent({
                transaction_id: transactionId,
                entity_id: taskId,
                entity_type: 'Task',
                action: 'DELETE'
            });
        }

        return true;
    } catch (error) {
        handleFirestoreError(error, "deleteTask");
        return false;
    }
};

export const getClientTasks = async (realtorId: string, clientId: string) => {
    if (!db) return [];
    try {
        const q = query(
            collection(db, "tasks"),
            where("realtorId", "==", realtorId),
            where("clientId", "==", clientId)
        );
        logFirestoreQuery('getDocs', 'tasks', { realtorId, clientId });
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CRMTask));
    } catch (error) {
        handleFirestoreError(error, "getClientTasks");
        return [];
    }
};

// ===== TEMPLATES =====

export const getTemplates = async (realtorId: string) => {
    if (!db) return [];
    try {
        const q = query(collection(db, "templates"), where("realtorId", "==", realtorId));
        logFirestoreQuery('getDocs', 'templates', { realtorId });
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommTemplate));
    } catch (error) {
        handleFirestoreError(error, "getTemplates");
        return [];
    }
};

// ===== PIPELINE NOTES =====

export const addPipelineNote = async (note: Partial<PipelineNote>) => {
    if (!db) return null;
    try {
        logFirestoreQuery('addDoc', 'notes', note);
        const docRef = await addDoc(collection(db, "notes"), sanitizeForFirestore(note));
        return docRef.id;
    } catch (error) {
        handleFirestoreError(error, "addPipelineNote");
        return null;
    }
};

export const getPipelineNotes = async (realtorId: string) => {
    if (!db) return [];
    try {
        const q = query(collection(db, "notes"), where("realtorId", "==", realtorId));
        logFirestoreQuery('getDocs', 'notes', { realtorId });
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PipelineNote));
    } catch (error) {
        handleFirestoreError(error, "getPipelineNotes");
        return [];
    }
};

export const updatePipelineNote = async (noteId: string, updates: Partial<PipelineNote>) => {
    if (!db) return false;
    try {
        const noteRef = doc(db, "notes", noteId);
        await updateDoc(noteRef, sanitizeForFirestore(updates));
        return true;
    } catch (error) {
        handleFirestoreError(error, "updatePipelineNote");
        return false;
    }
};

export const deletePipelineNote = async (noteId: string) => {
    if (!db) return false;
    try {
        const noteRef = doc(db, "notes", noteId);
        await deleteDoc(noteRef);
        return true;
    } catch (error) {
        handleFirestoreError(error, "deletePipelineNote");
        return false;
    }
};

// ===== WHITEBOARD =====

export const saveWhiteboard = async (userId: string, items: any[]) => {
    if (!db) return { success: false, error: "Database not initialized" };
    try {
        const docRef = doc(db, "whiteboards", userId);
        await setDoc(docRef, {
            items: sanitizeForFirestore(items),
            updatedAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveWhiteboard") as string };
    }
};

export const getWhiteboard = async (userId: string) => {
    if (!db) return null;
    try {
        const docRef = doc(db, "whiteboards", userId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data().items : null;
    } catch (error) {
        handleFirestoreError(error, "getWhiteboard");
        return null;
    }
};
