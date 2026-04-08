
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function migrateHistory() {
    console.log('--- Migrating orientation_versions to new schema (details + version) ---');

    const snapshot = await db.collection('orientation_versions').get();
    console.log(`Found ${snapshot.size} records to check.`);

    let migratedCount = 0;
    let skippedCount = 0;

    // Group in memory to avoid needing complex indices
    const groups: Record<string, any[]> = {};
    snapshot.docs.forEach(d => {
        const data = d.data();
        const zpid = String(data.zpid);
        if (!groups[zpid]) groups[zpid] = [];
        groups[zpid].push({ id: d.id, ref: d.ref, data });
    });

    console.log(`Unique ZPIDs in history: ${Object.keys(groups).length}`);

    for (const zpid in groups) {
        // Sort by dateMined in memory
        const sorted = groups[zpid].sort((a, b) => {
            const da = a.data.dateMined?.toMillis?.() || (a.data.dateMined?._seconds * 1000) || 0;
            const db = b.data.dateMined?.toMillis?.() || (b.data.dateMined?._seconds * 1000) || 0;
            return da - db;
        });

        let ver = 1;
        for (const item of sorted) {
            const data = item.data;
            
            // Avoid double migration
            if (data.details && typeof data.version === 'number') {
                skippedCount++;
                continue;
            }

            const details = {
                orientation: data.orientation || 'Unknown',
                azimuth: data.azimuth ?? null,
                layout: data.layout || 'standard'
            };

            await item.ref.update({
                version: ver++,
                details: details,
                // Clean up old fields
                orientation: admin.firestore.FieldValue.delete(),
                azimuth: admin.firestore.FieldValue.delete(),
                layout: admin.firestore.FieldValue.delete()
            });
            migratedCount++;
        }
        if (migratedCount > 0 && migratedCount % 100 === 0) console.log(`  Processed ${migratedCount} records...`);
    }

    console.log(`--- Migration Complete ---`);
    console.log(`Total Migrated: ${migratedCount}`);
    console.log(`Total Skipped: ${skippedCount}`);
}

migrateHistory()
    .then(() => {
        console.log('Script finished.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
