import { db } from '../services/firebase/config.js';
import * as firestore from 'firebase/firestore';

async function listPleasanton() {
    try {
        console.log("Searching properties in Pleasanton...");
        const q = firestore.query(
            firestore.collection(db, "properties"),
            firestore.where("city", "==", "Pleasanton"),
            firestore.limit(100)
        );
        const snapshot = await firestore.getDocs(q);
        console.log(`Found ${snapshot.size} properties.`);
        
        snapshot.docs.forEach(d => {
            const data = d.data();
            if (data.address && data.address.toLowerCase().includes('dorset')) {
                console.log("MATCH_FOUND");
                console.log(JSON.stringify({
                    id: d.id,
                    address: data.address,
                    orientation_ai: data.orientation_ai
                }, null, 2));
            }
        });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

listPleasanton();
