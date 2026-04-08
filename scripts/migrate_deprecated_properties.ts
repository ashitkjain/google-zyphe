
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function migrateDeprecated() {
    console.log('--- Moving deprecated properties from "properties" to "sold_or_unlisted_properties" ---');

    console.log('Fetching all properties in Firestore...');
    const snapshot = await db.collection('properties').get();
    const docs = snapshot.docs;

    console.log(`Found ${docs.length} total properties in Firestore.`);

    const deprecatedDocs = docs.filter(d => {
        const data = d.data();
        return data.deprecated === true || data.deprecated === 'true';
    });

    console.log(`Of those, ${deprecatedDocs.length} are marked as deprecated.`);

    if (deprecatedDocs.length === 0) {
        console.log('No deprecated properties found to move.');
        return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const d of deprecatedDocs) {
        const zpid = d.id;
        const data = d.data();
        console.log(`Moving ZPID ${zpid} (${data.address || 'No Address'})...`);

        try {
            // 1. Write to sold_or_unlisted_properties (using set with no merge, but preserving all data)
            // We want to move everything, including any nested subfields if they are part of the main doc.
            await db.collection('sold_or_unlisted_properties').doc(zpid).set({
                ...data,
                zpid: String(zpid),
                movedAt: admin.firestore.FieldValue.serverTimestamp(),
                movedReason: data.movedReason || 'bulk_migration_deprecated_flag'
            });

            // 2. Delete from properties (Hard move)
            await db.collection('properties').doc(zpid).delete();

            console.log(`  Successfully moved ${zpid}`);
            successCount++;
        } catch (err: any) {
            console.error(`  Failed to move ${zpid}:`, err.message);
            failCount++;
        }
    }

    console.log(`--- Migration Complete ---`);
    console.log(`Total Moved: ${successCount}`);
    console.log(`Total Failed: ${failCount}`);
}

migrateDeprecated()
    .then(() => {
        console.log('Script finished.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
