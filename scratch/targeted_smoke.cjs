
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: 'zyphe-af0bf' });
}

const db = admin.firestore();

async function runSmoke() {
    console.log('--- Targeted Smoke Test (Dublin, CA) ---');
    
    // 1. Get all properties (since address is a string)
    const snap = await db.collection('properties').get();
    const dublinProps = snap.docs.filter(doc => {
        const addr = doc.data().address || '';
        return addr.includes('Dublin, CA');
    });

    console.log(`Found ${dublinProps.length} properties in Dublin.`);

    let missingNarrative = 0;
    let missingRisks = 0;
    let missingInterior = 0;
    let failedZpids = [];

    for (const doc of dublinProps) {
        const zpid = doc.id;
        const comp = await doc.ref.collection('analysis').doc('comprehensive').get();
        
        const data = comp.data() || {};
        const hasNarrative = !!(data.summary && data.summary.length > 50);
        const hasRisks = !!(data.risks_considerations && data.risks_considerations.length > 50);
        const hasInterior = !!(data.interior_summary?.interior_summary && data.interior_summary.interior_summary.length > 50);

        if (!hasNarrative) missingNarrative++;
        if (!hasRisks) missingRisks++;
        if (!hasInterior) missingInterior++;

        if (!hasNarrative || !hasRisks || !hasInterior) {
            failedZpids.push(zpid);
        }
    }

    console.log('\nResults:');
    console.log(`Total: ${snap.size}`);
    console.log(`Missing Narrative: ${missingNarrative}`);
    console.log(`Missing Risks: ${missingRisks}`);
    console.log(`Missing Interior: ${missingInterior}`);
    
    if (failedZpids.length > 0) {
        console.log(`\nFailed ZPIDs (${failedZpids.length}):`, failedZpids.slice(0, 10).join(', '), failedZpids.length > 10 ? '...' : '');
        console.log('\nTo fix these, run the Narrative Synthesis batch for these ZPIDs.');
    } else {
        console.log('\n✅ ALL PROPERTIES PASSED NARRATIVE SMOKE TEST!');
    }
}

runSmoke().catch(console.error);
