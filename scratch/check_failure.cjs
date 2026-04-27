
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json'); // I'll assume I can find one or use default

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'zyphe-af0bf'
  });
}

const db = admin.firestore();

async function checkFailedProperty(zpid) {
  const jobsRef = db.collection('full_intel_batch_jobs');
  const snapshot = await jobsRef.orderBy('startedAt', 'desc').limit(1).get();
  
  if (snapshot.empty) {
    console.log('No jobs found');
    return;
  }
  
  const jobData = snapshot.docs[0].data();
  console.log('Latest Job ID:', snapshot.docs[0].id);
  console.log('Status:', jobData.status);
  
  const result = jobData.results?.[zpid];
  if (result) {
    console.log(`Result for ${zpid}:`, JSON.stringify(result, null, 2));
  } else {
    console.log(`No result found for ${zpid} in the latest job.`);
  }
}

const zpid = process.argv[2] || '461622240';
checkFailedProperty(zpid);
