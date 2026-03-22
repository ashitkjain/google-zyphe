/**
 * Migration Script: Move user-scoped flat collections under /users/{uid}/
 * 
 * Moves:
 *   user_preferences/{uid}     → users/{uid}/preferences/{uid}
 *   user_property_comment/{id} → users/{userId}/property_comments/{id}
 *   user_activity/{id}         → users/{user_id}/activity_log/{id}
 * 
 * SAFE: Copies only, does NOT delete old data.
 * 
 * Run with: npx tsx scripts/migrate_user_subcollections.ts
 * Flags:   --dry-run
 */

import admin from 'firebase-admin';

const existingApps = admin.apps ?? [];
if (existingApps.length === 0) {
    admin.initializeApp({ projectId: 'zyphe-af0bf' });
}
const db = admin.firestore();

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const BATCH_LIMIT = 450;
const log = (msg: string) => console.log(`[MIGRATE] ${msg}`);
const warn = (msg: string) => console.warn(`[MIGRATE ⚠️] ${msg}`);
const success = (msg: string) => console.log(`[MIGRATE ✅] ${msg}`);

class BatchWriter {
    private batch = db.batch();
    private count = 0;
    private totalWrites = 0;

    async add(ref: admin.firestore.DocumentReference, data: admin.firestore.DocumentData) {
        if (DRY_RUN) { this.totalWrites++; return; }
        this.batch.set(ref, data, { merge: true });
        this.count++;
        if (this.count >= BATCH_LIMIT) await this.flush();
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

async function main() {
    log('╔══════════════════════════════════════════════════════════╗');
    log('║  USER SUBCOLLECTION MIGRATION                          ║');
    log('╚══════════════════════════════════════════════════════════╝');
    if (DRY_RUN) warn('DRY RUN MODE — no data will be written\n');

    const writer = new BatchWriter();

    // 1. user_preferences/{uid} → users/{uid}/preferences/main
    log('─── user_preferences → users/{uid}/preferences/main ───');
    const prefSnap = await db.collection('user_preferences').get();
    for (const docSnap of prefSnap.docs) {
        const uid = docSnap.id; // doc ID is the user's uid
        const targetRef = db.doc(`users/${uid}/preferences/main`);
        await writer.add(targetRef, docSnap.data());
    }
    log(`  ✓ user_preferences: ${prefSnap.size} docs`);

    // 2. user_property_comment/{id} → users/{userId}/property_comments/{id}
    log('─── user_property_comment → users/{userId}/property_comments/{id} ───');
    const commentsSnap = await db.collection('user_property_comment').get();
    let commentCount = 0;
    let skippedComments = 0;
    for (const docSnap of commentsSnap.docs) {
        const data = docSnap.data();
        const userId = data.userId;
        if (!userId) {
            skippedComments++;
            continue;
        }
        const targetRef = db.doc(`users/${userId}/property_comments/${docSnap.id}`);
        await writer.add(targetRef, data);
        commentCount++;
    }
    log(`  ✓ property_comments: ${commentCount} docs migrated` + (skippedComments > 0 ? `, ${skippedComments} skipped (no userId)` : ''));

    // 3. user_activity/{id} → users/{user_id}/activity_log/{id}
    log('─── user_activity → users/{user_id}/activity_log/{id} ───');
    const activitySnap = await db.collection('user_activity').get();
    let activityCount = 0;
    let skippedActivity = 0;
    for (const docSnap of activitySnap.docs) {
        const data = docSnap.data();
        const userId = data.user_id;
        if (!userId) {
            skippedActivity++;
            continue;
        }
        const targetRef = db.doc(`users/${userId}/activity_log/${docSnap.id}`);
        await writer.add(targetRef, data);
        activityCount++;
    }
    log(`  ✓ activity_log: ${activityCount} docs migrated` + (skippedActivity > 0 ? `, ${skippedActivity} skipped (no user_id)` : ''));

    await writer.flush();

    log(`\n${'─'.repeat(55)}`);
    log(`  TOTAL WRITES: ${writer.getTotal()}`);

    if (DRY_RUN) {
        warn('\nDRY RUN. No data was written.');
    } else {
        success('\nMigration complete! Old collections untouched.');
    }
}

main().catch(e => {
    console.error(`[MIGRATE ❌] Fatal: ${e.message}`);
    process.exit(1);
});
