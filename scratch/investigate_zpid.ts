
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

async function investigateZpid(zpid: string) {
    console.log(`\n--- Deep Dive for ZPID: ${zpid} ---`);
    
    // 1. Core Property Doc
    const docRef = doc(db, "properties", zpid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        const data = docSnap.data();
        console.log(`[Properties] Found. Address: "${data.address}"`);
        console.log(`[Properties] _fetchMeta: ${JSON.stringify(data._fetchMeta || "MISSING")}`);
        
        // 2. Check analysis subcollections
        const analysisTypes = ['visual', 'comprehensive', 'investment', 'assets', 'lifestyle_insights', 'lifestyle_fit'];
        for (const type of analysisTypes) {
            const aRef = doc(db, "properties", zpid, "analysis", type);
            const aSnap = await getDoc(aRef);
            console.log(`[Analysis/${type}] ${aSnap.exists() ? "PRESENT" : "MISSING"}`);
        }

        // 3. Check environmental
        const envRef = doc(db, "properties", zpid, "environmental", "thirdparty_data");
        const envSnap = await getDoc(envRef);
        console.log(`[Environmental] ${envSnap.exists() ? "PRESENT" : "MISSING"}`);
        if (envSnap.exists()) {
            console.log(`[Environmental] Keys: ${Object.keys(envSnap.data()).join(", ")}`);
        }
    } else {
        console.log(`[Properties] NOT FOUND.`);
    }
}

investigateZpid("124736377").catch(console.error);
