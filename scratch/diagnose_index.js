
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp();
const db = getFirestore();

async function diagnose() {
  console.log("--- ADDRESS INDEX DIAGNOSTIC ---");
  const snap = await db.collection('address_index').get();
  
  if (snap.empty) {
    console.log("Collection 'address_index' is EMPTY.");
    return;
  }

  console.log(`Found ${snap.size} documents in 'address_index':`);
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`\nDocument ID: "${doc.id}"`);
    console.log(`Count: ${data.count || 0}`);
    if (data.entries && data.entries.length > 0) {
      console.log("Sample Entries (first 3):");
      data.entries.slice(0, 3).forEach(e => console.log(`  - Address: "${e.a}" | ZPID: ${e.z}`));
    } else {
      console.log("No entries found in this document.");
    }
  });
}

diagnose().catch(console.error);
