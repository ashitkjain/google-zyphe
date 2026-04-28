
import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

async function checkZipCache() {
    const snap = await db.collection('zip_listings_cache').doc('94568').get();
    if (!snap.exists) {
        console.log('Zip cache for 94568 not found');
        return;
    }
    
    const listings = snap.data().listings || [];
    const match = listings.find(l => (l.location?.address?.line || '').includes('Chesterfield'));
    
    if (match) {
        console.log('Match in Zip Cache:');
        console.log('ZPID:', match.zpid);
        console.log('Address:', match.location?.address?.line);
        console.log('Photos (primary_photo):', match.primary_photo ? 'Yes' : 'No');
        console.log('Photos (images array):', match.images?.length || 0);
        console.log('Photo Count:', match.photoCount || 0);
    } else {
        console.log('No match in Zip Cache for "Chesterfield"');
    }
}

checkZipCache();
