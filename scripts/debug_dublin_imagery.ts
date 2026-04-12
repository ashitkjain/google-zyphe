import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import * as dotenv from "dotenv";
import { resolve } from "path";
import fetch from "node-fetch";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const firebaseConfig = {
    apiKey: "AIzaSyBiP85bXTptTAqvXUh4JwYC-6SQJqwukvI",
    authDomain: "zyphe-af0bf.firebaseapp.com",
    projectId: "zyphe-af0bf",
    storageBucket: "zyphe-af0bf.firebasestorage.app",
    messagingSenderId: "434538487700",
    appId: "1:434538487700:web:2d0880addbfdca71c13981",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkDublinImagery() {
    console.log("Fetching Dublin properties...");
    const q = collection(db, "properties");
    const snap = await getDocs(q);
    
    const dublin = snap.docs.filter(d => (d.data().city || '').toLowerCase() === 'dublin');
    console.log(`Total Dublin properties: ${dublin.length}`);

    const missed = dublin.filter(d => {
        const p = d.data();
        const calcAt = p.orientation_calculated_at;
        return !calcAt;
    });

    console.log(`Missed Dublin properties: ${missed.length}`);

    for (const d of missed.slice(0, 5)) {
        const p = d.data();
        console.log(`\n--- ZPID: ${d.id} ---`);
        console.log(`Address: ${p.address}`);
        console.log(`Type: ${p.homeType}`);
        
        const satUrl = p.satelliteImageUrl;
        if (!satUrl) {
            console.log("No satellite URL cached.");
            continue;
        }

        try {
            console.log(`Testing Satellite URL: ${satUrl.substring(0, 50)}...`);
            const res = await fetch(satUrl);
            console.log(`Fetch Result: ${res.status} ${res.statusText}`);
            if (!res.ok) {
                const text = await res.text();
                console.log(`Error Body: ${text.substring(0, 100)}`);
            }
        } catch (e: any) {
            console.log(`Fetch Error: ${e.message}`);
        }
    }
}

checkDublinImagery().catch(console.error);
