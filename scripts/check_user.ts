
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function checkUser(email: string) {
    console.log(`Searching for user: ${email}...`);
    const userSnapshot = await db.collection('users').where('email', '==', email).get();
    
    if (userSnapshot.empty) {
        console.log(`No user found with email: ${email}`);
        return;
    }

    const docs = userSnapshot.docs;
    for (const doc of docs) {
        const data = doc.data();
        console.log(`\n--- User Document: ${doc.id} ---`);
        console.log('Email:', data.email);
        console.log('Display Name:', data.displayName);
        console.log('Role:', data.role);
        console.log('Realtor ID:', data.realtorId || 'NONE');
        
        if (data.realtorId) {
            console.log(`Fetching realtor profile for ID: ${data.realtorId}...`);
            const realtorDoc = await db.collection('users').doc(data.realtorId).get();
            if (realtorDoc.exists) {
                const rData = realtorDoc.data();
                console.log('Realtor Found:', rData?.displayName || 'Unnamed Realtor');
                console.log('Realtor Email:', rData?.email);
            } else {
                console.log('CRITICAL: Realtor document NOT found in "users" collection.');
            }
        }
    }
}

const email = process.argv[2] || 'buyer@fc.com';
checkUser(email).then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
