import { collection, doc, writeBatch, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
    db,
    storage_instance as storage,
    sanitizeForFirestore,
    handleFirestoreError
} from "./config";
import { requireTenantId } from "./tenantContext";
import { Lead, CRMTask, CommTemplate, Transaction } from "../../types";
import { getInitialCategories } from "../transactionService";
import { generateMockTransactionParties, generateMockTransactionDocuments } from "../../tests/mocks/mockData";
import { seedPartiesForTransaction } from "./parties";
import { seedDocumentsForTransaction, addTransactionDocument } from "./documents";
import { seedTasksForTransaction } from "./transactions";

export const seedMockData = async (realtorId: string, leads: Lead[], tasks: CRMTask[], templates: CommTemplate[], transactions: Transaction[], onLog?: (msg: string) => void) => {
    const log = (msg: string) => { console.log(msg); onLog?.(msg); };
    if (!db) return false;
    try {
        const rid = requireTenantId(realtorId);
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
            const docRef = doc(collection(db, "realtors", rid, targetColl), lead.id);
            const leadData = { ...lead, clientPhotoUrl: finalPhotoUrl || null, isMock: true, realtorId };
            batch.set(docRef, sanitizeForFirestore(leadData), { merge: true });
            log(`[Seed] Saved lead: ${lead.firstName} ${lead.lastName}`);
            return { ...lead, clientPhotoUrl: finalPhotoUrl };
        }));

        log(`[Seed] Processing ${tasks.length} tasks...`);
        // Seed Tasks
        tasks.forEach(task => {
            const docRef = doc(collection(db, "realtors", rid, "tasks"), task.id);
            const taskData = { ...task, isMock: true, realtorId };
            batch.set(docRef, sanitizeForFirestore(taskData), { merge: true });
            log(`[Seed] Added task: ${task.name}`);
        });

        log(`[Seed] Processing ${templates.length} templates...`);
        // Seed Templates
        templates.forEach(template => {
            const docRef = doc(collection(db, "realtors", rid, "templates"), template.id);
            const templateData = { ...template, isMock: true, realtorId };
            batch.set(docRef, sanitizeForFirestore(templateData), { merge: true });
            log(`[Seed] Added template: ${template.name}`);
        });

        log(`[Seed] Processing ${transactions.length} transactions...`);
        // Seed Transactions
        for (const transaction of transactions) {
            transaction.isMock = true;
            const initialCats = getInitialCategories(transaction.type === 'SELL' ? 'Seller' : 'Buyer');
            const finalChecklist = seedTasksForTransaction(batch, transaction, initialCats);

            const docRef = doc(collection(db, "realtors", rid, "transactions"), transaction.id);
            const transactionData = { ...transaction, isMock: true, realtorId };
            batch.set(docRef, sanitizeForFirestore(transactionData), { merge: true });
            log(`[Seed] Added transaction for: ${transaction.property?.address}`);

            // Seed Parties
            await seedPartiesForTransaction(transaction.id, rid);
            log(`[Seed] Seeded parties for transaction: ${transaction.id}`);

            // Seed Documents
            await seedDocumentsForTransaction(transaction.id, rid);
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
        const rid = requireTenantId(realtorId);
        log("[Cleanup] Starting mock data removal...");
        const batch = writeBatch(db);
        let count = 0;

        // 1. Leads
        log("[Cleanup] Searching for mock leads...");
        const leadsQ = query(collection(db, "realtors", rid, "leads"), where("isMock", "==", true));
        const leadsSnap = await getDocs(leadsQ);
        leadsSnap.forEach(doc => {
            batch.delete(doc.ref);
            log(`[Cleanup] Deleting lead: ${doc.id}`);
            count++;
        });

        // 2. Tasks
        log("[Cleanup] Searching for mock tasks...");
        const tasksQ = query(collection(db, "realtors", rid, "tasks"), where("isMock", "==", true));
        const tasksSnap = await getDocs(tasksQ);
        tasksSnap.forEach(doc => {
            batch.delete(doc.ref);
            log(`[Cleanup] Deleting task: ${doc.id}`);
            count++;
        });

        // 3. Templates
        log("[Cleanup] Searching for mock templates...");
        const templatesQ = query(collection(db, "realtors", rid, "templates"), where("isMock", "==", true));
        const templatesSnap = await getDocs(templatesQ);
        templatesSnap.forEach(doc => {
            batch.delete(doc.ref);
            log(`[Cleanup] Deleting template: ${doc.id}`);
            count++;
        });

        // 3b. Notes
        log("[Cleanup] Searching for mock notes...");
        const notesQ = query(collection(db, "realtors", rid, "notes"), where("isMock", "==", true));
        const notesSnap = await getDocs(notesQ);
        notesSnap.forEach(doc => {
            batch.delete(doc.ref);
            log(`[Cleanup] Deleting note: ${doc.id}`);
            count++;
        });

        // 4. Transactions
        log("[Cleanup] Searching for mock transactions...");
        const txQ = query(collection(db, "realtors", rid, "transactions"), where("isMock", "==", true));
        const txSnap = await getDocs(txQ);

        txSnap.forEach(d => {
            batch.delete(d.ref);
            log(`[Cleanup] Deleting transaction: ${d.id}`);
            count++;
        });

        // Delete associated Documents and Parties
        for (const txDoc of txSnap.docs) {
            const txId = txDoc.id;

            const documentsQ = query(collection(db, "realtors", rid, "transaction_documents"), where("transaction_id", "==", txId));
            const documentsSnap = await getDocs(documentsQ);
            documentsSnap.forEach(d => {
                batch.delete(d.ref);
                log(`[Cleanup] Deleting tx document: ${d.id}`);
                count++;
            });

            const partiesQ = query(collection(db, "realtors", rid, "transaction_parties"), where("transaction_id", "==", txId));
            const partiesSnap = await getDocs(partiesQ);
            partiesSnap.forEach(d => {
                batch.delete(d.ref);
                log(`[Cleanup] Deleting tx party: ${d.id}`);
                count++;
            });
        }

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
