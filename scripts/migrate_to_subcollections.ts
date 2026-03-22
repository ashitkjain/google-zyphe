/**
 * Multi-Tenant Migration Script: Flat Collections → /realtors/{rid}/subcollections
 * 
 * Uses Firebase Admin SDK (bypasses security rules).
 * Requires: `firebase login` to have been run (uses default credentials).
 * 
 * SAFE: This script COPIES data to new subcollections. It does NOT modify or delete
 * any existing data. Old collections remain untouched as a rollback safety net.
 * 
 * Run with: npx tsx scripts/migrate_to_subcollections.ts
 * 
 * Optional flags:
 *   --dry-run       Preview what would be copied without writing
 *   --realtor=UID   Migrate only a specific realtor (for testing)
 */

import admin from 'firebase-admin';

// ── Initialize Admin SDK (uses default credentials from firebase CLI login) ──
const existingApps = admin.apps ?? [];
if (existingApps.length === 0) {
    admin.initializeApp({
        projectId: 'zyphe-af0bf',
    });
}
const db = admin.firestore();

// ── CLI Flags ──
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SINGLE_REALTOR = args.find(a => a.startsWith('--realtor='))?.split('=')[1] || null;

// ── Constants ──
const BATCH_LIMIT = 450; // Firestore batch limit is 500, stay under

// ── Logging ──
const log = (msg: string) => console.log(`[MIGRATE] ${msg}`);
const warn = (msg: string) => console.warn(`[MIGRATE ⚠️] ${msg}`);
const success = (msg: string) => console.log(`[MIGRATE ✅] ${msg}`);
const err = (msg: string) => console.error(`[MIGRATE ❌] ${msg}`);

// ── Stats ──
const stats: Record<string, number> = {};
const addStat = (key: string, count: number) => {
    stats[key] = (stats[key] || 0) + count;
};

// ── Batch Writer ──
class BatchWriter {
    private batch = db.batch();
    private count = 0;
    private totalWrites = 0;

    async add(ref: admin.firestore.DocumentReference, data: admin.firestore.DocumentData) {
        if (DRY_RUN) {
            this.totalWrites++;
            return;
        }
        this.batch.set(ref, data, { merge: true });
        this.count++;
        if (this.count >= BATCH_LIMIT) {
            await this.flush();
        }
    }

    async flush() {
        if (this.count > 0 && !DRY_RUN) {
            await this.batch.commit();
            this.totalWrites += this.count;
            this.count = 0;
            this.batch = db.batch();
        }
    }

    getTotal() { return DRY_RUN ? this.totalWrites : this.totalWrites + this.count; }
}

// ── Collection Migrators ──

/**
 * Copies docs from a flat collection filtered by a field 
 * to /realtors/{rid}/{subcollectionName}/{docId}
 */
async function migrateByField(
    realtorId: string,
    sourceCollection: string,
    targetSubcollection: string,
    writer: BatchWriter,
    filterField: string = 'realtorId'
): Promise<number> {
    const snap = await db.collection(sourceCollection)
        .where(filterField, '==', realtorId)
        .get();
    
    for (const docSnap of snap.docs) {
        const targetRef = db.doc(`realtors/${realtorId}/${targetSubcollection}/${docSnap.id}`);
        await writer.add(targetRef, docSnap.data());
    }
    
    return snap.size;
}

/**
 * Copies docs linked by transaction IDs
 */
async function migrateByTransactionIds(
    realtorId: string,
    transactionIds: string[],
    sourceCollection: string,
    targetSubcollection: string,
    writer: BatchWriter,
    filterField: string = 'transaction_id'
): Promise<number> {
    let total = 0;
    for (const txId of transactionIds) {
        const snap = await db.collection(sourceCollection)
            .where(filterField, '==', txId)
            .get();
        
        for (const docSnap of snap.docs) {
            const targetRef = db.doc(`realtors/${realtorId}/${targetSubcollection}/${docSnap.id}`);
            await writer.add(targetRef, docSnap.data());
        }
        total += snap.size;
    }
    return total;
}

/**
 * Copies messages where senderId or receiverId matches the realtorId
 */
async function migrateMessages(realtorId: string, writer: BatchWriter): Promise<number> {
    const seen = new Set<string>();

    // Messages where realtor is sender
    const senderSnap = await db.collection('messages')
        .where('senderId', '==', realtorId)
        .get();
    
    for (const docSnap of senderSnap.docs) {
        if (!seen.has(docSnap.id)) {
            seen.add(docSnap.id);
            const targetRef = db.doc(`realtors/${realtorId}/messages/${docSnap.id}`);
            await writer.add(targetRef, docSnap.data());
        }
    }

    // Messages where realtor is receiver
    const receiverSnap = await db.collection('messages')
        .where('receiverId', '==', realtorId)
        .get();
    
    for (const docSnap of receiverSnap.docs) {
        if (!seen.has(docSnap.id)) {
            seen.add(docSnap.id);
            const targetRef = db.doc(`realtors/${realtorId}/messages/${docSnap.id}`);
            await writer.add(targetRef, docSnap.data());
        }
    }

    return seen.size;
}

/**
 * Copies the whiteboard doc (keyed by userId) 
 */
async function migrateWhiteboard(realtorId: string, writer: BatchWriter): Promise<number> {
    const docSnap = await db.doc(`whiteboards/${realtorId}`).get();
    if (docSnap.exists) {
        const targetRef = db.doc(`realtors/${realtorId}/whiteboards/${realtorId}`);
        await writer.add(targetRef, docSnap.data()!);
        return 1;
    }
    return 0;
}

// ── Main Migration ──

async function migrateRealtor(realtorId: string, realtorData: admin.firestore.DocumentData) {
    const writer = new BatchWriter();
    const label = realtorData.displayName || realtorData.email || realtorId;
    log(`\n${'═'.repeat(60)}`);
    log(`Migrating realtor: ${label} (${realtorId})`);
    log(`${'═'.repeat(60)}`);

    // 1. Create the realtor root document
    const realtorRef = db.doc(`realtors/${realtorId}`);
    await writer.add(realtorRef, {
        uid: realtorId,
        displayName: realtorData.displayName || '',
        email: realtorData.email || '',
        role: realtorData.role || 'realtor',
        phoneNumber: realtorData.phoneNumber || null,
        realtor: realtorData.realtor || null,
        createdAt: realtorData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    log(`  ✓ Created /realtors/${realtorId} root doc`);

    // 2. Copy clients (users with this realtorId)
    const clientsSnap = await db.collection('users')
        .where('realtorId', '==', realtorId)
        .get();
    
    for (const clientDoc of clientsSnap.docs) {
        const clientRef = db.doc(`realtors/${realtorId}/clients/${clientDoc.id}`);
        await writer.add(clientRef, clientDoc.data());
    }
    log(`  ✓ clients: ${clientsSnap.size} docs`);
    addStat('clients', clientsSnap.size);

    // 3. Migrate all realtorId-keyed collections
    const realtorIdCollections = [
        { source: 'leads', target: 'leads' },
        { source: 'buyers', target: 'buyers' },
        { source: 'sellers', target: 'sellers' },
        { source: 'tasks', target: 'tasks' },
        { source: 'transactions', target: 'transactions' },
        { source: 'calendar_events', target: 'calendar_events' },
        { source: 'templates', target: 'templates' },
        { source: 'notes', target: 'notes' },
        { source: 'reminderRules', target: 'reminderRules' },
        { source: 'journey_events', target: 'journey_events' },
        { source: 'leads_documents', target: 'leads_documents' },
    ];

    for (const { source, target } of realtorIdCollections) {
        try {
            const count = await migrateByField(realtorId, source, target, writer);
            if (count > 0) {
                log(`  ✓ ${target}: ${count} docs`);
                addStat(target, count);
            } else {
                log(`  · ${target}: 0 docs (empty)`);
            }
        } catch (e: any) {
            warn(`  ${target}: ${e.message}`);
        }
    }

    // 4. Migrate transaction-linked collections (parties, documents, audit)
    const txSnap = await db.collection('transactions')
        .where('realtorId', '==', realtorId)
        .get();
    const txIds = txSnap.docs.map(d => d.id);

    if (txIds.length > 0) {
        const txLinkedCollections = [
            { source: 'transaction_parties', target: 'transaction_parties' },
            { source: 'transaction_documents', target: 'transaction_documents' },
            { source: 'audit_events', target: 'audit_events' },
        ];

        for (const { source, target } of txLinkedCollections) {
            try {
                const count = await migrateByTransactionIds(realtorId, txIds, source, target, writer);
                if (count > 0) {
                    log(`  ✓ ${target}: ${count} docs (via ${txIds.length} transactions)`);
                    addStat(target, count);
                } else {
                    log(`  · ${target}: 0 docs`);
                }
            } catch (e: any) {
                warn(`  ${target}: ${e.message}`);
            }
        }
    }

    // 5. Migrate messages (senderId/receiverId pattern)
    try {
        const msgCount = await migrateMessages(realtorId, writer);
        if (msgCount > 0) {
            log(`  ✓ messages: ${msgCount} docs`);
            addStat('messages', msgCount);
        } else {
            log(`  · messages: 0 docs`);
        }
    } catch (e: any) {
        warn(`  messages: ${e.message}`);
    }

    // 6. Migrate whiteboard
    try {
        const wbCount = await migrateWhiteboard(realtorId, writer);
        if (wbCount > 0) {
            log(`  ✓ whiteboards: ${wbCount} doc`);
            addStat('whiteboards', wbCount);
        } else {
            log(`  · whiteboards: 0 docs`);
        }
    } catch (e: any) {
        warn(`  whiteboards: ${e.message}`);
    }

    // 7. Migrate userId-keyed collections (reactivation data)
    const userIdCollections = [
        { source: 'reactivation_analysis_summary', target: 'reactivation_analysis_summary', field: 'userId' },
        { source: 'market_context', target: 'market_context', field: 'userId' },
        { source: 'lead_plans', target: 'lead_plans', field: 'userId' },
    ];

    for (const { source, target, field } of userIdCollections) {
        try {
            const count = await migrateByField(realtorId, source, target, writer, field);
            if (count > 0) {
                log(`  ✓ ${target}: ${count} docs`);
                addStat(target, count);
            } else {
                log(`  · ${target}: 0 docs`);
            }
        } catch (e: any) {
            warn(`  ${target}: ${e.message}`);
        }
    }

    // 8. Migrate message_events (agent_id)
    try {
        const count = await migrateByField(realtorId, 'message_events', 'message_events', writer, 'agent_id');
        if (count > 0) {
            log(`  ✓ message_events: ${count} docs`);
            addStat('message_events', count);
        } else {
            log(`  · message_events: 0 docs`);
        }
    } catch (e: any) {
        warn(`  message_events: ${e.message}`);
    }

    // Flush remaining writes
    await writer.flush();
    success(`Realtor ${label}: ${writer.getTotal()} total writes`);
    addStat('_total_writes', writer.getTotal());
}

async function main() {
    log('╔══════════════════════════════════════════════════════════╗');
    log('║  MULTI-TENANT MIGRATION: Flat → /realtors/{rid}/...    ║');
    log('╚══════════════════════════════════════════════════════════╝');
    
    if (DRY_RUN) warn('DRY RUN MODE — no data will be written\n');
    if (SINGLE_REALTOR) log(`Single realtor mode: ${SINGLE_REALTOR}\n`);

    // 1. Find all realtors
    let realtors: { id: string; data: admin.firestore.DocumentData }[] = [];

    if (SINGLE_REALTOR) {
        const snap = await db.doc(`users/${SINGLE_REALTOR}`).get();
        if (snap.exists) {
            realtors = [{ id: snap.id, data: snap.data()! }];
        } else {
            err(`Realtor ${SINGLE_REALTOR} not found in /users`);
            process.exit(1);
        }
    } else {
        // Get all users with role=realtor or role=admin
        const [realtorSnap, adminSnap] = await Promise.all([
            db.collection('users').where('role', '==', 'realtor').get(),
            db.collection('users').where('role', '==', 'admin').get(),
        ]);
        
        const seen = new Set<string>();
        [...realtorSnap.docs, ...adminSnap.docs].forEach(d => {
            if (!seen.has(d.id)) {
                seen.add(d.id);
                realtors.push({ id: d.id, data: d.data() });
            }
        });
    }

    log(`Found ${realtors.length} realtor(s) to migrate\n`);

    // 2. Migrate each realtor
    for (const realtor of realtors) {
        try {
            await migrateRealtor(realtor.id, realtor.data);
        } catch (e: any) {
            err(`Failed migrating ${realtor.id}: ${e.message}`);
            console.error(e);
        }
    }

    // 3. Summary
    log('\n╔══════════════════════════════════════════════════════════╗');
    log('║  MIGRATION SUMMARY                                     ║');
    log('╚══════════════════════════════════════════════════════════╝');
    
    const statEntries = Object.entries(stats)
        .filter(([k]) => !k.startsWith('_'))
        .sort((a, b) => b[1] - a[1]);
    
    for (const [collectionName, count] of statEntries) {
        log(`  ${collectionName.padEnd(40)} ${count} docs`);
    }
    log(`${'─'.repeat(55)}`);
    log(`  ${'TOTAL WRITES'.padEnd(40)} ${stats['_total_writes'] || 0}`);
    
    if (DRY_RUN) {
        warn('\nThis was a DRY RUN. No data was written.');
        warn('Run without --dry-run to execute the migration.');
    } else {
        success('\nMigration complete! Old collections are untouched.');
        success('To rollback: just revert the app code. Old data is still there.');
    }
}

main().catch(e => {
    err(`Fatal: ${e.message}`);
    console.error(e);
    process.exit(1);
});
