
import admin from 'firebase-admin';
import { SUPPORTED_STATES, STATE_NAME_MAP } from '../config';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function seedOrientationVersions() {
    console.log('--- Seeding orientation_versions history (NEW FORMAT) from active properties ---');
    console.log(`Filtering for supported states: ${SUPPORTED_STATES.join(', ')}`);

    console.log('Fetching all properties...');
    const snapshot = await db.collection('properties').get();
    console.log(`Found ${snapshot.size} properties in active collection.`);

    let seedCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (const d of snapshot.docs) {
        const p = d.data();
        const oAI = p.orientation_ai;

        // Only seed if there is actual orientation data to record
        if (oAI && oAI.final_orientation) {
            // Check state
            const rawState = (p.state || '').trim();
            const stateAbbr = (STATE_NAME_MAP[rawState.toLowerCase()] || rawState).toUpperCase();
            
            if (!SUPPORTED_STATES.includes(stateAbbr)) {
                skipCount++;
                continue;
            }

            try {
                const city = (p.city || 'Unknown').trim();
                const zip = (p.zipCode || p.zip || 'Unknown').trim();
                const zpid = d.id;

                // Path: orientation_versions/{city}/zips/{zip}/zpids/{zpid}/history/v1
                const docRef = db.doc(`orientation_versions/${city}/zips/${zip}/zpids/${zpid}/history/v1`);

                await docRef.set({
                    city,
                    zip,
                    zpid,
                    version: 1,
                    details: {
                        orientation: oAI.final_orientation,
                        azimuth: oAI.azimuth_degrees || null,
                        layout: oAI.property_layout_type || 'standard'
                    },
                    dateMined: admin.firestore.FieldValue.serverTimestamp()
                });
                seedCount++;
                if (seedCount % 20 === 0) console.log(`  Seeded ${seedCount} properties...`);
            } catch (err: any) {
                console.error(`  Failed to seed ${d.id}:`, err.message);
                failCount++;
            }
        } else {
            skipCount++;
        }
    }

    console.log(`--- Seeding Complete ---`);
    console.log(`Total Seeds Created: ${seedCount}`);
    console.log(`Total Skipped (missing data or already existing): ${skipCount}`);
    console.log(`Total Failures: ${failCount}`);
}

seedOrientationVersions()
    .then(() => {
        console.log('Script finished.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Seeding failed:', err);
        process.exit(1);
    });
