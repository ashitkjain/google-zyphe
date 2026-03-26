
import admin from 'firebase-admin';
import { getInitialMockLeads, getInitialMockTasks, getInitialMockTemplates, getInitialMockTransactions } from '../services/mockDataService.ts';

const projectId = 'zyphe-af0bf';
const existingApps = admin.apps ?? [];
if (existingApps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();
const auth = admin.auth();

export const sanitizeForFirestore = (data: any): any => {
    if (data === undefined || data === null) return null;
    if (Array.isArray(data)) return data.map(sanitizeForFirestore);
    if (typeof data === 'object') {
        if (data instanceof Date || 
            data instanceof admin.firestore.Timestamp || 
            data instanceof admin.firestore.FieldValue ||
            data?.constructor?.name === 'FieldValueImpl' ||
            data?.constructor?.name === 'FieldValue') {
            return data;
        }

        return Object.fromEntries(
            Object.entries(data).map(([key, value]) => [key, sanitizeForFirestore(value)])
        );
    }
    return data;
};

async function seedRealtorData() {
    const email = 'agent@fc.com';
    console.log(`\x1b[34m[Seed]\x1b[0m Searching for realtor user: ${email}...`);
    
    let userRecord;
    try {
        userRecord = await auth.getUserByEmail(email);
    } catch (e: any) {
        console.error(`\x1b[31m[Error]\x1b[0m User ${email} not found. Please run scripts/seed_vcs_users.ts first.`);
        return;
    }

    const realtorId = userRecord.uid;
    console.log(`\x1b[34m[Seed]\x1b[0m Found realtor UID: ${realtorId}`);

    // Generate Mock Data
    const leads = getInitialMockLeads(realtorId);
    const tasks = getInitialMockTasks(realtorId);
    const templates = getInitialMockTemplates(realtorId);
    const transactions = getInitialMockTransactions(realtorId);

    console.log(`\x1b[34m[Seed]\x1b[0m Generated ${leads.length} leads, ${tasks.length} tasks, ${templates.length} templates, ${transactions.length} transactions.`);

    const realtorRef = db.collection('realtors').doc(realtorId);
    
    // Ensure the realtor document exists
    await realtorRef.set({
        email,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const batchSize = 100;
    let batch = db.batch();
    let count = 0;

    const commitBatch = async () => {
        if (count > 0) {
            console.log(`\x1b[34m[Seed]\x1b[0m Committing batch of ${count} operations...`);
            await batch.commit();
            batch = db.batch();
            count = 0;
        }
    };

    // 1. Seed Leads
    console.log('\x1b[34m[Seed]\x1b[0m Seeding leads...');
    for (const lead of leads) {
        const targetColl = lead.collectionName || 'leads';
        const docRef = realtorRef.collection(targetColl).doc(lead.id);
        batch.set(docRef, sanitizeForFirestore({
            ...lead,
            realtorId,
            isMock: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }), { merge: true });
        count++;
        if (count >= batchSize) await commitBatch();
    }

    // 2. Seed Tasks
    console.log('\x1b[34m[Seed]\x1b[0m Seeding tasks...');
    for (const task of tasks) {
        const docRef = realtorRef.collection('tasks').doc(task.id);
        batch.set(docRef, sanitizeForFirestore({
            ...task,
            realtorId,
            isMock: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }), { merge: true });
        count++;
        if (count >= batchSize) await commitBatch();
    }

    // 3. Seed Templates
    console.log('\x1b[34m[Seed]\x1b[0m Seeding templates...');
    for (const template of templates) {
        const docRef = realtorRef.collection('templates').doc(template.id);
        batch.set(docRef, sanitizeForFirestore({
            ...template,
            realtorId,
            isMock: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }), { merge: true });
        count++;
        if (count >= batchSize) await commitBatch();
    }

    // 4. Seed Transactions
    console.log('\x1b[34m[Seed]\x1b[0m Seeding transactions...');
    for (const tx of transactions) {
        const docRef = realtorRef.collection('transactions').doc(tx.id);
        batch.set(docRef, sanitizeForFirestore({
            ...tx,
            realtorId,
            isMock: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }), { merge: true });
        count++;
        if (count >= batchSize) await commitBatch();
    }

    // 5. Seed some mock messages for the first few leads
    console.log('\x1b[34m[Seed]\x1b[0m Seeding mock messages...');
    const messageLeads = leads.slice(0, 5);
    for (const [index, lead] of messageLeads.entries()) {
        const threadId = `thread_${lead.id}`;
        const messages = [
            {
                message_id: `msg_in_${lead.id}_1`,
                content: `Hi, I'm interested in the property we discussed. Can we talk more about the neighborhood?`,
                direction: 'inbound',
                isInbound: true,
                status: 'received',
                requires_action: true,
                senderId: lead.id,
                receiverId: realtorId,
                timestamp: new Date(Date.now() - 3600000 * 2) // 2 hours ago
            },
            {
                message_id: `msg_out_${lead.id}_1`,
                content: `Absolutely! I'd love to go over the neighborhood details with you. Are you free for a quick call?`,
                direction: 'outbound',
                isInbound: false,
                status: 'sent',
                requires_action: false,
                senderId: realtorId,
                receiverId: lead.id,
                timestamp: new Date(Date.now() - 3600000 * 1) // 1 hour ago
            }
        ];

        for (const msg of messages) {
            const docRef = realtorRef.collection('messages').doc(msg.message_id);
            batch.set(docRef, sanitizeForFirestore({
                ...msg,
                lead_id: lead.id,
                lead_name: `${lead.firstName} ${lead.lastName}`,
                realtorId,
                threadId,
                channel: 'SMS',
                isMock: true
            }), { merge: true });
            count++;
            if (count >= batchSize) await commitBatch();
        }
    }

    await commitBatch();
    console.log('\x1b[32m[Seed]\x1b[0m Seeding complete for realtor.');
}

seedRealtorData().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('\x1b[31m[Fatal]\x1b[0m Error during seeding:', err);
    process.exit(1);
});
