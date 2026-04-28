
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";

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

const RADAR_API_KEY = "prj_live_pk_eef2517d56b63939d892c06a7dac57af7f2278cb";

async function investigate() {
    const addressesToTest = [
        "3492 Dorset Ct, Pleasanton, CA 94566",
        "3492 Dorset Ct, Pleasanton",
        "1600 Lexington Ln, Pleasanton"
    ];

    for (const addr of addressesToTest) {
        console.log(`\n--- Investigating Search: "${addr}" ---`);

        // 1. Radar Geocode
        const url = `https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(addr)}`;
        const resp = await fetch(url, { headers: { 'Authorization': RADAR_API_KEY } });
        const data = await resp.json();
        
        if (data.addresses && data.addresses.length > 0) {
            const radarAddr = data.addresses[0].formattedAddress;
            console.log(`[Radar Geocode] Result: "${radarAddr}"`);

            // 2. Lookup by Radar Formatted Address
            const q = query(collection(db, "properties"), where("address", "==", radarAddr), limit(1));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
                console.log(`[Address Lookup] SUCCESS using Radar Address.`);
            } else {
                console.log(`[Address Lookup] FAILED using Radar Address.`);
                
                // Let's see what's actually in Firestore for this street
                const street = addr.split(',')[0].trim();
                console.log(`[Street Lookup] Searching for street: "${street}"`);
                const qStreet = query(collection(db, "properties"), where("address", ">=", street), where("address", "<=", street + '\uf8ff'), limit(5));
                const qStreetSnap = await getDocs(qStreet);
                if (!qStreetSnap.empty) {
                    console.log(`[Street Lookup] Found ${qStreetSnap.size} matches for "${street}":`);
                    qStreetSnap.forEach(d => {
                        console.log(` - "${d.data().address}" (ZPID: ${d.id})`);
                    });
                } else {
                    console.log(`[Street Lookup] No matches found for street: "${street}"`);
                }
            }
        } else {
            console.log(`[Radar Geocode] FAILED to find address. Data: ${JSON.stringify(data)}`);
        }
    }
}

investigate().catch(console.error);
