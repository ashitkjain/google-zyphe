/**
 * One-time migration script for city key normalization.
 *
 * Does two things in sequence:
 *   1. Migrate: moves any hyphen-keyed city docs (e.g. pleasanton-ca)
 *      to canonical underscore format (pleasanton_ca).
 *   2. Cleanup: deletes all city docs whose key does NOT end in _ca
 *      (i.e. removes any non-California city data).
 *
 * Uses firebase-admin (Application Default Credentials — no service account file needed).
 *
 * Usage:
 *   npx tsx scripts/normalize_city_keys.ts
 */

import admin from 'firebase-admin';

const PROJECT_ID = 'zyphe-af0bf';

if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: PROJECT_ID });
}
const db = admin.firestore();

const SUBCOLLECTIONS = [
    { type: 'index', docId: 'neighborhoods' },
    { type: 'index', docId: 'zips' },
    { type: 'index', docId: 'context_graph' },
    { type: 'intel', docId: 'deep_research' },
    { type: 'intel', docId: 'market_intelligence' },
    { type: 'intel', docId: 'community_pulse' },
] as const;

/** Returns all city keys present under cities/ */
async function getAllCityKeys(): Promise<string[]> {
    // Use collectionGroup on 'neighborhoods' to discover all city keys
    // that have a neighborhoods subcollection.
    const snap = await db.collectionGroup('neighborhoods').get();
    const keys = new Set<string>();
    for (const d of snap.docs) {
        // Path: cities/{key}/index/neighborhoods
        const cityKey = d.ref.parent.parent?.id;
        if (cityKey) keys.add(cityKey);
    }

    // Also list direct children of cities/ to catch any city docs
    // that may exist without a neighborhoods subcollection.
    const citiesSnap = await db.collection('cities').listDocuments();
    for (const ref of citiesSnap) {
        keys.add(ref.id);
    }

    return Array.from(keys);
}

async function migrateHyphenKeys(allKeys: string[]): Promise<void> {
    console.log('\n── Step 1: Migrate hyphen keys → underscore ──');
    const hyphenKeys = allKeys.filter(k => k.includes('-'));
    if (hyphenKeys.length === 0) {
        console.log('  ✓ No hyphen keys found. Nothing to migrate.');
        return;
    }

    for (const oldKey of hyphenKeys) {
        const newKey = oldKey.replace(/-/g, '_');
        console.log(`  Migrating: ${oldKey} → ${newKey}`);

        for (const { type, docId } of SUBCOLLECTIONS) {
            const oldRef = db.doc(`cities/${oldKey}/${type}/${docId}`);
            const newRef = db.doc(`cities/${newKey}/${type}/${docId}`);
            const oldSnap = await oldRef.get();
            if (!oldSnap.exists) continue;
            const newSnap = await newRef.get();
            if (!newSnap.exists) {
                await newRef.set(oldSnap.data()!);
                console.log(`    Copied  cities/${oldKey}/${type}/${docId} → cities/${newKey}/${type}/${docId}`);
            } else {
                console.log(`    Skipped cities/${newKey}/${type}/${docId} already exists`);
            }
            await oldRef.delete();
            console.log(`    Deleted cities/${oldKey}/${type}/${docId}`);
        }

        // Also copy/delete the parent doc if it exists
        const oldParent = db.doc(`cities/${oldKey}`);
        const newParent = db.doc(`cities/${newKey}`);
        const oldParentSnap = await oldParent.get();
        if (oldParentSnap.exists) {
            const newParentSnap = await newParent.get();
            if (!newParentSnap.exists) await newParent.set(oldParentSnap.data()!);
            await oldParent.delete();
            console.log(`    Moved parent doc: cities/${oldKey} → cities/${newKey}`);
        }
    }

    console.log(`  ✓ Migrated ${hyphenKeys.length} city key(s).`);
}

async function deleteAllSubcollections(docRef: admin.firestore.DocumentReference): Promise<void> {
    const subcollections = await docRef.listCollections();
    for (const col of subcollections) {
        const docs = await col.listDocuments();
        for (const subDocRef of docs) {
            await deleteAllSubcollections(subDocRef); // recurse
            await subDocRef.delete();
            console.log(`    Deleted ${subDocRef.path}`);
        }
    }
}

async function cleanupNonCACities(allKeys: string[]): Promise<void> {
    console.log('\n── Step 2: Delete non-CA cities ──');
    const nonCA = allKeys.filter(k => !k.replace(/-/g, '_').endsWith('_ca'));
    if (nonCA.length === 0) {
        console.log('  ✓ No non-CA city keys found.');
        return;
    }

    console.log(`  Found ${nonCA.length} non-CA key(s):`, nonCA);

    for (const key of nonCA) {
        const parentRef = db.doc(`cities/${key}`);
        // Delete all subcollections recursively first (Firestore does not cascade-delete)
        await deleteAllSubcollections(parentRef);
        // Always attempt to delete the parent doc (no-op if no data, but removes the reference)
        await parentRef.delete();
        console.log(`  ✓ Deleted cities/${key} and all subcollections`);
    }

    console.log(`  ✓ Removed ${nonCA.length} non-CA city key(s).`);
}


async function main() {
    console.log('=== City Key Normalization Script ===');
    console.log(`Project: ${PROJECT_ID}\n`);

    const allKeys = await getAllCityKeys();
    console.log(`Found ${allKeys.length} total city key(s):`, allKeys);

    await migrateHyphenKeys(allKeys);
    await cleanupNonCACities(allKeys);

    console.log('\n=== Done. ===');
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Script failed:', err);
        process.exit(1);
    });
