
import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

async function checkProperty() {
    const zpid = '53050869';
    const snap = await db.collection('properties').doc(zpid).get();
    
    if (!snap.exists) {
        console.log('Property doc does not exist in collection');
        return;
    }
    
    const data = snap.data();
    console.log('Address:', data.location?.address?.line);
    console.log('Images Array length:', data.images?.length || 0);
    console.log('Photo Count field:', data.photoCount || 0);
}

checkProperty();
