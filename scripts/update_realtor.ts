
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function updateRealtorLink(email: string, realtorId: string) {
    console.log(`Updating realtorId for ${email} to ${realtorId}...`);
    const userSnapshot = await db.collection('users').where('email', '==', email).get();
    
    if (userSnapshot.empty) {
        console.log(`No user found with email: ${email}`);
        return;
    }

    const docs = userSnapshot.docs;
    for (const doc of docs) {
        await db.collection('users').doc(doc.id).update({ realtorId });
        console.log(`Updated User Document: ${doc.id}`);
        
        // Also check if realtor exists
        const realtorDoc = await db.collection('users').doc(realtorId).get();
        if (realtorDoc.exists) {
            console.log(`Linked to Realtor: ${realtorDoc.data()?.displayName}`);
        } else {
            console.warn(`WARNING: Realtor ID ${realtorId} not found!`);
        }
    }
}

const email = process.argv[2] || 'buyer@fc.com';
const rId = process.argv[3] || '4lG8nrcrMgeNQTfLKAz8TMDbiK33';
updateRealtorLink(email, rId).then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
