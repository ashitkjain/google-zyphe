
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function getPleasantonNeighborhoods() {
    const cityStateKey = 'pleasanton-ca';
    console.log(`Fetching neighborhoods for ${cityStateKey}...`);

    // Check consolidated "cities" collection
    const cityRef = db.doc(`cities/${cityStateKey}/index/neighborhoods`);
    const citySnap = await cityRef.get();

    if (citySnap.exists) {
        console.log('Found in cities collection.');
        return citySnap.data().neighborhoods.map(n => n.neighborhood_name);
    }

    // Fallback to legacy
    const legacyKey = 'pleasanton_ca';
    const legacyRef = db.doc(`city_neighborhoods/${legacyKey}`);
    const legacySnap = await legacyRef.get();

    if (legacySnap.exists) {
        console.log('Found in legacy city_neighborhoods collection.');
        return legacySnap.data().neighborhoods.map(n => n.neighborhood_name);
    }

    console.log('No neighborhoods found in backend.');
    return [];
}

getPleasantonNeighborhoods()
    .then(list => {
        console.log('--- BACKEND NEIGHBORHOODS ---');
        console.log(JSON.stringify(list, null, 2));
        process.exit(0);
    })
    .catch(err => {
        console.error('Fetch failed:', err);
        process.exit(1);
    });
