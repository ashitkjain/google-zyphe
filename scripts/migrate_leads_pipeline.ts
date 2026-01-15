
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc } from "firebase/firestore";

// --- Configuration ---
// YOU MUST REPLACE THESE WITH YOUR ACTUAL FIREBASE CONFIG
// Copy this from your firebaseService.ts or .env
const firebaseConfig = {
    apiKey: "AIzaSyBiP85bXTptTAqvXUh4JwYC-6SQJqwukvI",
    authDomain: "zyphe-af0bf.firebaseapp.com",
    projectId: "zyphe-af0bf",
    storageBucket: "zyphe-af0bf.firebasestorage.app",
    messagingSenderId: "434538487700",
    appId: "1:434538487700:web:2d0880addbfdca71c13981",
    measurementId: "G-S07B3J7TJZ"
};

// --- Initialization ---
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

const migratePipeline = async () => {
    console.log("Starting pipeline migration...");

    try {
        const batch = writeBatch(db);
        let operationCount = 0;
        const BATCH_LIMIT = 450; // Safety limit below 500

        const commitBatch = async () => {
            if (operationCount > 0) {
                console.log(`Committing batch of ${operationCount} operations...`);
                await batch.commit();
                operationCount = 0;
            }
        };

        // 1. DELETE ALL DATA in 'buyers' and 'sellers' collections
        const buyersRef = collection(db, "buyers");
        const buyersSnap = await getDocs(buyersRef);
        console.log(`Found ${buyersSnap.size} buyer documents to delete.`);

        for (const docSnapshot of buyersSnap.docs) {
            batch.delete(docSnapshot.ref);
            operationCount++;
            if (operationCount >= BATCH_LIMIT) await commitBatch();
        }

        const sellersRef = collection(db, "sellers");
        const sellersSnap = await getDocs(sellersRef);
        console.log(`Found ${sellersSnap.size} seller documents to delete.`);

        for (const docSnapshot of sellersSnap.docs) {
            batch.delete(docSnapshot.ref);
            operationCount++;
            if (operationCount >= BATCH_LIMIT) await commitBatch();
        }

        // Commit deletions
        await commitBatch();
        console.log("Cleanup complete. Starting migration from 'leads'...");


        // 2. FETCH LEADS from 'leads' collection
        const leadsRef = collection(db, "leads");
        const leadsSnap = await getDocs(leadsRef);
        const leads = leadsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        console.log(`Found ${leads.length} total leads.`);

        // 3. COPY LEADS to appropriate collections & Update 'leads' status

        // Pick top 5 buyers and top 5 sellers to migrate
        const potentialBuyers = leads.filter(l => l.leadType === 'Buyer').slice(0, 5);
        const potentialSellers = leads.filter(l => l.leadType === 'Seller').slice(0, 5);

        console.log(`Migrating ${potentialBuyers.length} buyers and ${potentialSellers.length} sellers...`);

        // Migrate Buyers
        const newBatch = writeBatch(db); // refreshing batch for writes

        for (const lead of potentialBuyers) {
            const newDocRef = doc(db, "buyers", lead.id);
            const sourceDocRef = doc(db, "leads", lead.id);

            // Copy data to new buyer doc, ensure activated status
            newBatch.set(newDocRef, {
                ...lead,
                status: 'Active',
                funnelStage: 'Nurture', // Default stage
                activatedAt: new Date(),
                realtorId: lead.realtorId
            });

            // Update original lead status
            newBatch.update(sourceDocRef, {
                status: 'Connected'
            });
        }

        // Migrate Sellers
        for (const lead of potentialSellers) {
            const newDocRef = doc(db, "sellers", lead.id);
            const sourceDocRef = doc(db, "leads", lead.id);

            // Copy data to new seller doc
            newBatch.set(newDocRef, {
                ...lead,
                status: 'Active',
                funnelStage: 'Nurture', // Default stage
                activatedAt: new Date(),
                realtorId: lead.realtorId
            });

            // Update original lead status
            newBatch.update(sourceDocRef, {
                status: 'Connected'
            });
        }

        await newBatch.commit();

        console.log("Migration successfully completed!");

    } catch (error) {
        console.error("Migration failed:", error);
    }
};

migratePipeline();
