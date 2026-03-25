
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
const existingApps = admin.apps ?? [];
if (existingApps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();
const auth = admin.auth();

async function createVCUsers() {
    const users = [
        {
            email: 'buyer@fc.com',
            displayName: 'VC Buyer Test',
            role: 'buyer' as const,
            password: 'password123'
        },
        {
            email: 'agent@fc.com',
            displayName: 'VC Realtor Test',
            role: 'realtor' as const,
            password: 'password123'
        }
    ];

    for (const u of users) {
        console.log(`Creating user: ${u.email}...`);
        try {
            // 1. Create in Firebase Auth
            let userRecord;
            try {
                userRecord = await auth.getUserByEmail(u.email);
                console.log(`  User already exists in Auth: ${userRecord.uid}`);
            } catch (e: any) {
                if (e.code === 'auth/user-not-found') {
                    userRecord = await auth.createUser({
                        email: u.email,
                        password: u.password,
                        displayName: u.displayName,
                    });
                    console.log(`  Created user in Auth: ${userRecord.uid}`);
                } else {
                    throw e;
                }
            }

            // 2. Create/Update in Firestore
            const userRef = db.collection('users').doc(userRecord.uid);
            await userRef.set({
                uid: userRecord.uid,
                email: u.email,
                displayName: u.displayName,
                role: u.role,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                isMock: true // Mark as test account
            }, { merge: true });
            console.log(`  Updated user profile in Firestore: users/${userRecord.uid}`);

        } catch (error) {
            console.error(`  Error processing ${u.email}:`, error);
        }
    }
}

createVCUsers().then(() => {
    console.log('Seeding complete.');
    process.exit(0);
}).catch(err => {
    console.error('Fatal error during seeding:', err);
    process.exit(1);
});
