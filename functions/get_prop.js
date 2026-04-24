const admin = require('firebase-admin');
try { admin.initializeApp({ projectId: 'zyphe-af0bf' }); } catch (e) {}
const db = admin.firestore();

async function run() {
    const snap = await db.collection('properties').where('city', '==', 'Pleasanton').limit(1).get();
    if (snap.empty) {
        console.log("No pleasanton properties");
        process.exit(0);
    }
    const prop = snap.docs[0];
    console.log("ZPID:", prop.id);
    
    const compSnap = await prop.ref.collection('analysis').doc('comprehensive').get();
    const customSnap = await prop.ref.collection('analysis').doc('custom').get();
    
    console.log("Comp keys:", compSnap.exists ? Object.keys(compSnap.data()) : 'none');
    console.log("Custom keys:", customSnap.exists ? Object.keys(customSnap.data()) : 'none');
    
    if (compSnap.exists) {
        console.log("Comp schools:", !!compSnap.data().schoolsIntelligence);
    }
    process.exit(0);
}
run();
