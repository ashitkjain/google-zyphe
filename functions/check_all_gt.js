#!/usr/bin/env node
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'zyphe-af0bf'
    });
}

const db = admin.firestore();

async function checkAllGT() {
    console.log('Checking all Pleasanton GT records...');
    
    const gtSnap = await db.collection('orientation_ground_truth')
        .where('city', '==', 'Pleasanton')
        .get();
    
    console.log(`Found ${gtSnap.size} GT records.`);
    
    let count = 0;
    for (const gtDoc of gtSnap.docs) {
        const gt = gtDoc.data();
        const zpid = gtDoc.id;
        
        const propSnap = await db.collection('properties').doc(zpid).get();
        const prop = propSnap.exists ? propSnap.data() : {};
        const ai = prop.orientation_ai || {};
        
        const aiDir = (ai.final_orientation || 'N/A').split(' ')[0].toLowerCase();
        const gtDir = (gt.expected_orientation || 'N/A').split(' ')[0].toLowerCase();
        
        const isMismatch = gtDir !== 'n/a' && aiDir !== 'n/a' && aiDir !== gtDir;
        
        if (isMismatch || aiDir === 'unclear') {
            console.log(`${++count}. ${zpid} | ${gt.address || prop.address}`);
            console.log(`   GT: ${gt.expected_orientation} | AI: ${ai.final_orientation} | Ver: ${ai.batch_version || 'N/A'}`);
            if (isMismatch) console.log(`   ⚠️ MISMATCH`);
            if (aiDir === 'unclear') console.log(`   ❓ UNCLEAR`);
        }
    }
}

checkAllGT().catch(console.error);
