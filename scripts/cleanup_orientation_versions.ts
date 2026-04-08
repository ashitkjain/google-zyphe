
import admin from 'firebase-admin';
import { SUPPORTED_STATES, STATE_NAME_MAP } from '../config';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function cleanupOrientationVersions() {
    console.log('--- Cleaning up orientation_versions for non-supported states ---');
    console.log(`Supported states (abbr): ${SUPPORTED_STATES.join(', ')}`);

    const snapshot = await db.collection('orientation_versions').get();
    console.log(`Found ${snapshot.size} history records total.`);

    if (snapshot.size === 0) {
        console.log('No records to check.');
        return;
    }

    let removedCount = 0;
    let keepCount = 0;
    let unknownCount = 0;

    // Cache to avoid multi-reads for same ZPID if there are multiple versions
    const stateCache: Record<string, string | null> = {};

    for (const d of snapshot.docs) {
        const v = d.data();
        const zpid = String(v.zpid);

        if (!(zpid in stateCache)) {
            let propSnap = await db.collection('properties').doc(zpid).get();
            let propData = propSnap.exists ? propSnap.data() : null;

            if (!propData) {
                propSnap = await db.collection('sold_or_unlisted_properties').doc(zpid).get();
                propData = propSnap.exists ? propSnap.data() : null;
            }

            if (propData) {
                const rawState = (propData.state || '').trim();
                const stateAbbr = (STATE_NAME_MAP[rawState.toLowerCase()] || rawState).toUpperCase();
                stateCache[zpid] = stateAbbr;
            } else {
                stateCache[zpid] = null;
            }
        }

        const state = stateCache[zpid];

        if (state) {
            if (!SUPPORTED_STATES.includes(state)) {
                console.log(`  Deleting ${d.id} (ZPID: ${zpid}, State: ${state}) - Not supported.`);
                await d.ref.delete();
                removedCount++;
            } else {
                keepCount++;
            }
        } else {
            // Cannot find property to determine state. 
            // Conservative approach: keep it to avoid deleting data we are unsure about.
            unknownCount++;
        }
    }

    console.log(`--- Cleanup Complete ---`);
    console.log(`Total Scanned: ${snapshot.size}`);
    console.log(`Records Kept: ${keepCount}`);
    console.log(`Records Removed: ${removedCount}`);
    console.log(`Records Unknown/Unverifiable: ${unknownCount}`);
}

cleanupOrientationVersions()
    .then(() => {
        console.log('Script finished.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Cleanup failed:', err);
        process.exit(1);
    });
