import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

// Read service account from standard location or environment
const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const dublinAddresses = [
  '7837 Kilrush Dr',
  '7258 Abbotsford Ln',
  '7847 Kilrush Dr',
  '7268 Abbotsford Ln',
  '7278 Abbotsford Ln',
  '7311 Abbotsford Ln',
  '7277 Abbotsford Ln',
  '7267 Abbotsford Ln',
  '7288 Abbotsford Ln',
  '7298 Abbotsford Ln'
];

async function checkDublinGT() {
  console.log('Checking Dublin Ground Truth status...');
  
  for (const addr of dublinAddresses) {
    // Try to find by address (partial match since DB might have City, State)
    const snapshot = await db.collection('properties')
      .where('address', '>=', addr)
      .where('address', '<=', addr + '\uf8ff')
      .get();
      
    if (snapshot.empty) {
      console.log(`[NOT FOUND] ${addr}`);
    } else {
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`[FOUND] ${data.address} | GT: ${data.orientation_gt || 'MISSING'}`);
      });
    }
  }
}

checkDublinGT().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
