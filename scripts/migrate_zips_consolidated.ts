
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function migrateZips() {
    console.log('--- MIGRATION START: Zip Listing Consolidation ---');

    const collections = ['zip_listings_cache', 'zip_sold_listings_cache'];
    
    for (const col of collections) {
        console.log(`Processing ${col}...`);
        const snapshot = await db.collection(col).get();
        if (snapshot.empty) {
            console.log(`  ${col} is empty.`);
            continue;
        }

        console.log(`  Migrating ${snapshot.size} documents from ${col}...`);
        const type = col.includes('sold') ? 'sold' : 'active';
        
        const batchSize = 100;
        for (let i = 0; i < snapshot.docs.length; i += batchSize) {
            const batch = db.batch();
            const chunk = snapshot.docs.slice(i, i + batchSize);
            
            for (const doc of chunk) {
                const zipCode = doc.id;
                const data = doc.data();
                const listings = data.listings || [];
                
                let cityStateKey = '';
                if (listings.length > 0) {
                    const first = listings[0];
                    let city = (first.location?.address?.city || first.city || '').toLowerCase().trim().replace(/\s+/g, '_');
                    let state = (first.location?.address?.state_code || first.state || '').toLowerCase().trim();
                    
                    if (!city || !state) {
                        const addrString = first.address || '';
                        // E.g. "210 3rd St, Hayward, MN 56043"
                        const match = addrString.match(/,\s*([^,]+),\s*([A-Z]{2})\s*\d{5}/);
                        if (match) {
                            city = match[1].toLowerCase().trim().replace(/\s+/g, '_');
                            state = match[2].toLowerCase().trim();
                        }
                    }

                    if (city && state) cityStateKey = `${city}_${state}`;
                }

                if (cityStateKey) {
                    const targetPath = `cities/${cityStateKey}/zips/${zipCode}/${type}/listings`;
                    const targetRef = db.doc(targetPath);
                    batch.set(targetRef, data, { merge: true });
                } else {
                    console.warn(`    Skipping ${zipCode} (no city context)`);
                }
            }
            await batch.commit();
        }
    }

    console.log('--- MIGRATION COMPLETE ---');
}

migrateZips()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
