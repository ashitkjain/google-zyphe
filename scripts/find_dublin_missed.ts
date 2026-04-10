import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// Using hardcoded config from config.ts to ensure match
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

async function diagnoseDublinProperties() {
  console.log("Fetching all properties from Firestore...");
  const q = collection(db, "properties");
  const snap = await getDocs(q);
  console.log(`Total properties found: ${snap.size}`);
  
  const dublin = snap.docs.filter(d => {
    const city = (d.data().city || '').toLowerCase();
    return city === 'dublin';
  });
  
  console.log(`Found ${dublin.length} properties in Dublin.`);
  
  const now = Date.now();
  const twoHoursAgo = now - (2 * 60 * 60 * 1000);
  
  const missed = dublin.filter(d => {
    const p = d.data();
    const type = (p.homeType || p.home_type || '').toLowerCase();
    const isTarget = type.includes('single_family') || type.includes('townhouse');
    if (!isTarget) return false;

    const calcAt = p.orientation_calculated_at;
    if (!calcAt) return true;
    
    const date = calcAt.toDate ? calcAt.toDate() : new Date(calcAt);
    return date.getTime() < twoHoursAgo;
  });
  
  console.log(`Identified ${missed.length} 'missed' properties.`);
  
  if (missed.length === 0) return;

  const target = missed[0];
  const p = target.data();
  console.log("\n--- INVESTIGATING ZPID:", target.id, "---");
  console.log("Address:", p.address);
  console.log("Coordinates:", p.coordinates);
  console.log("Home Type:", p.homeType);
  console.log("Calculated At:", p.orientation_calculated_at?.toDate?.() || p.orientation_calculated_at);
  console.log("Street View URL:", p.streetView || p.streetViewAnalysis?.imageUrl);
  console.log("Satellite URL:", p.satelliteImageUrl);
  console.log("Description Available:", !!p.description);
}

diagnoseDublinProperties().catch(console.error);
