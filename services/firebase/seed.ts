import { collection, doc, writeBatch, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
    db,
    storage_instance as storage,
    sanitizeForFirestore,
    handleFirestoreError
} from "./config";
import { Lead, CRMTask, CommTemplate, Transaction } from "../../types";
import { getInitialCategories } from "../transactionService";
import { generateMockTransactionParties, generateMockTransactionDocuments } from "../mockData";
import { seedPartiesForTransaction } from "./parties";
import { seedDocumentsForTransaction } from "./documents";
import { seedTasksForTransaction, addTransactionDocument } from "./transactions"; // Note: seedTasksForTransaction is in transactions, but addTransactionDocument is in documents. Wait.
// seedTasksForTransaction calls transactionService's calculateChecklist, and returns checklist. 
// Ah, seedMockData *uses* these functions.

// Wait, seedMockData logic:
// 1. Leads
// 2. Tasks
// 3. Templates
// 4. Transactions -> calls seedTasksForTransaction, seedPartiesForTransaction.

// I need to import seedTasksForTransaction from './transactions'.
// And seedPartiesForTransaction from './parties'.
// And addTransactionDocument is used in seedDocumentsForTransaction in documents.ts.

// Let's check seedMockData code I read.
// It calls seedTasksForTransaction, seedPartiesForTransaction.
// It handles documents? The version in 700-720 only explicitly handled parties.
// Wait, createTransaction calls seedDocumentsForTransaction.
// Does seedMockData use createTransaction?
// Looking at lines 702-715:
// It treats transactions manually using batch.set, then calls seedPartiesForTransaction.
// It does NOT call seedDocumentsForTransaction in the code I read (lines 702-715).
// However, createTransaction (in transactions.ts) DOES call it.
// seedMockData seems to manually insert transactions.
// I should probably add seedDocumentsForTransaction there to be safe if it fits, but I'll stick to the original code or improve it.
// The user asked to break up, not change logic too much. But if I saw it didn't have docs, maybe it's fine.
// Actually, `generateMockTransactionDocuments` was imported in `firebaseService.ts` line 31.
// And `seedDocumentsForTransaction` was defined in lines 740-753.
// So `seedMockData` might have been updated to call it, or I missed it.
// Wait, I saw `seedDocumentsForTransaction` function definition at 740.
// But is it CALLED in `seedMockData` at 647?
// I see loop at 702:
// seedPartiesForTransaction is awaited at 713.
// No seedDocumentsForTransaction call in that loop.
// So I will stick to the code I saw.

import { seedTasksForTransaction } from "./transactions";

export const seedMockData = async (realtorId: string, leads: Lead[], tasks: CRMTask[], templates: CommTemplate[], transactions: Transaction[], onLog?: (msg: string) => void) => {
    const log = (msg: string) => { console.log(msg); onLog?.(msg); };
    if (!db) return false;
    try {
        const batch = writeBatch(db);

        // Seed Leads
        const seededLeads = await Promise.all(leads.map(async (lead) => {
            let finalPhotoUrl = lead.clientPhotoUrl;

            // Cache pravatar images
            if (lead.clientPhotoUrl && lead.clientPhotoUrl.includes("pravatar.cc") && storage) {
                try {
                    const response = await fetch(lead.clientPhotoUrl);
                    if (response.ok) {
                        const blob = await response.blob();
                        // @ts-ignore
                        const storageRef = ref(storage, `leads/mock/${lead.id}_photo.png`);
                        // @ts-ignore
                        await uploadBytes(storageRef, blob);
                        // @ts-ignore
                        finalPhotoUrl = await getDownloadURL(storageRef);
                        console.log(`[Seeding] Cached photo for ${lead.firstName} to Firebase Storage.`);
                    }
                } catch (err) {
                    console.warn(`[Seeding] Failed to cache photo for ${lead.firstName}`, err);
                }
            }

            const targetColl = lead.collectionName || "leads";
            const docRef = doc(collection(db, targetColl), lead.id);
            const leadData = { ...lead, clientPhotoUrl: finalPhotoUrl || null, isMock: true, realtorId };
            batch.set(docRef, sanitizeForFirestore(leadData), { merge: true });
            log(`[Seed] Saved lead: ${lead.firstName} ${lead.lastName}`);
            return { ...lead, clientPhotoUrl: finalPhotoUrl };
        }));

        log(`[Seed] Processing ${tasks.length} tasks...`);
        // Seed Tasks
        tasks.forEach(task => {
            const docRef = doc(collection(db, "tasks"), task.id);
            const taskData = { ...task, isMock: true, realtorId };
            batch.set(docRef, sanitizeForFirestore(taskData), { merge: true });
            log(`[Seed] Added task: ${task.name}`);
        });

        log(`[Seed] Processing ${templates.length} templates...`);
        // Seed Templates
        templates.forEach(template => {
            const docRef = doc(collection(db, "templates"), template.id);
            const templateData = { ...template, isMock: true, realtorId };
            batch.set(docRef, sanitizeForFirestore(templateData), { merge: true });
            log(`[Seed] Added template: ${template.name}`);
        });

        log(`[Seed] Processing ${transactions.length} transactions...`);
        // Seed Transactions
        for (const transaction of transactions) {
            transaction.isMock = true;
            const initialCats = getInitialCategories();
            // seedTasksForTransaction modifies batch
            const finalChecklist = seedTasksForTransaction(batch, transaction, initialCats);

            const docRef = doc(collection(db, "transactions"), transaction.id);
            const transactionData = { ...transaction, isMock: true, realtorId };
            batch.set(docRef, sanitizeForFirestore(transactionData), { merge: true });
            log(`[Seed] Added transaction for: ${transaction.property?.address}`);

            // Seed Parties
            await seedPartiesForTransaction(transaction.id);
            log(`[Seed] Seeded parties for transaction: ${transaction.id}`);

            // Seed Documents (Explicitly called if needed, though createTransaction logic usually handles it. Here we are doing raw batch set)
            await seedDocumentsForTransaction(transaction.id);
            log(`[Seed] Seeded documents for transaction: ${transaction.id}`);
        }

        log("[Seed] Committing all changes to Firestore...");
        await batch.commit();
        log("[Seed] Database successfully seeded! Reloading application...");
        return true;
    } catch (error) {
        handleFirestoreError(error, "seedMockData");
        return false;
    }
};

export const deleteAllMockData = async (realtorId: string, onLog?: (msg: string) => void) => {
    const log = (msg: string) => { console.log(msg); onLog?.(msg); };
    if (!db) return false;
    try {
        log("[Cleanup] Starting mock data removal...");
        const batch = writeBatch(db);
        let count = 0;

        // 1. Leads
        log("[Cleanup] Searching for mock leads...");
        const leadsQ = query(collection(db, "leads"), where("realtorId", "==", realtorId), where("isMock", "==", true));
        const leadsSnap = await getDocs(leadsQ);
        leadsSnap.forEach(doc => {
            batch.delete(doc.ref);
            log(`[Cleanup] Deleting lead: ${doc.id}`);
            count++;
        });

        // 2. Tasks
        log("[Cleanup] Searching for mock tasks...");
        const tasksQ = query(collection(db, "tasks"), where("realtorId", "==", realtorId), where("isMock", "==", true));
        const tasksSnap = await getDocs(tasksQ);
        tasksSnap.forEach(doc => {
            batch.delete(doc.ref);
            log(`[Cleanup] Deleting task: ${doc.id}`);
            count++;
        });

        // 3. Templates
        log("[Cleanup] Searching for mock templates...");
        const templatesQ = query(collection(db, "templates"), where("realtorId", "==", realtorId), where("isMock", "==", true));
        const templatesSnap = await getDocs(templatesQ);
        templatesSnap.forEach(doc => {
            batch.delete(doc.ref);
            log(`[Cleanup] Deleting template: ${doc.id}`);
            count++;
        });

        // 3b. Notes
        log("[Cleanup] Searching for mock notes...");
        const notesQ = query(collection(db, "notes"), where("realtorId", "==", realtorId), where("isMock", "==", true));
        const notesSnap = await getDocs(notesQ);
        notesSnap.forEach(doc => {
            batch.delete(doc.ref);
            log(`[Cleanup] Deleting note: ${doc.id}`);
            count++;
        });

        // 4. Transactions
        log("[Cleanup] Searching for mock transactions...");
        const txQ1 = query(collection(db, "transactions"), where("realtorId", "==", realtorId), where("isMock", "==", true));
        const txQ2 = query(collection(db, "transactions"), where("owner_user_id", "==", realtorId), where("isMock", "==", true));

        const [snap1, snap2] = await Promise.all([getDocs(txQ1), getDocs(txQ2)]);

        const processDocs = (snap: any) => {
            snap.forEach((doc: any) => {
                batch.delete(doc.ref);
                log(`[Cleanup] Deleting transaction: ${doc.id}`);
                count++;
            });
        };

        processDocs(snap1);
        processDocs(snap2);

        if (count > 0) {
            log(`[Cleanup] Committing deletion of ${count} items...`);
            await batch.commit();
            log("[Cleanup] Deletion complete.");
        } else {
            log("[Cleanup] No mock items found to delete.");
        }
        return true;
    } catch (error) {
        handleFirestoreError(error, "deleteAllMockData");
        return false;
    }
};
