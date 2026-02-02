
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, orderBy, limit, getDocs } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBEPZ14POfqhB2wgfqAsgXkzuVPy2w-l90",
    authDomain: "zyphe-ai.firebaseapp.com",
    projectId: "zyphe-ai",
    storageBucket: "zyphe-ai.firebasestorage.app",
    messagingSenderId: "1098654321",
    appId: "1:1098654321:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function getLastLog() {
    try {
        const q = query(collection(db, "llm_call_events"), orderBy("timestamp", "desc"), limit(5));
        const snapshot = await getDocs(q);
        const logs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log(JSON.stringify(logs, null, 2));
    } catch (error) {
        console.error("Error fetching logs:", error);
    }
}

getLastLog();
