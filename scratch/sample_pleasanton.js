
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp();
const db = getFirestore();

async function sample() {
  console.log("--- SAMPLING PLEASANTON PROPERTIES ---");
  const snap = await db.collection('properties')
    .where('city', '==', 'Pleasanton')
    .limit(5)
    .get();
  
  if (snap.empty) {
    console.log("No properties found with city='Pleasanton'. Trying alternate search...");
    const snap2 = await db.collection('properties').limit(5).get();
    snap2.forEach(doc => {
      const d = doc.data();
      console.log(`- Address: "${d.address}" | City: "${d.city}"`);
    });
    return;
  }

  snap.forEach(doc => {
    const d = doc.data();
    console.log(`\nZPID: ${doc.id}`);
    console.log(`  Address: "${d.address}"`);
    console.log(`  City:    "${d.city}"`);
    console.log(`  Zip:     "${d.zipCode}"`);
  });
}

sample().catch(console.error);
