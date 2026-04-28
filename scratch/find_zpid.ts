
import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

async function findZpid() {
    const snap = await db.collection('properties')
        .get();
    
    const matches = snap.docs.filter(d => {
        const line = d.data().location?.address?.line || '';
        return line.includes('Chesterfield');
    });
    
    if (matches.length === 0) {
        console.log('No properties matching "Chesterfield" found');
        return;
    }
    
    matches.forEach(doc => {
        console.log('ZPID:', doc.id);
        console.log('Address:', doc.data().location?.address?.line);
        console.log('Images:', doc.data().images?.length || 0);
    });
}

findZpid();
