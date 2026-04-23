#!/usr/bin/env node
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'zyphe-af0bf'
    });
}

const db = admin.firestore();

async function findAllMismatches() {
    console.log('Finding all Pleasanton mismatches (ignoring version)...');
    
    const gtSnap = await db.collection('orientation_ground_truth')
        .where('city', '==', 'Pleasanton')
        .get();
    
    const mismatches = [];
    
    for (const gtDoc of gtSnap.docs) {
        const gt = gtDoc.data();
        const zpid = gtDoc.id;
        
        if (!gt.expected_orientation) continue;
        
        const propSnap = await db.collection('properties').doc(zpid).get();
        if (!propSnap.exists) continue;
        
        const prop = propSnap.data();
        const ai = prop.orientation_ai;
        if (!ai) continue;
        
        const aiDir = (ai.final_orientation || '').split(' ')[0].toLowerCase();
        const gtDir = (gt.expected_orientation || '').split(' ')[0].toLowerCase();
        
        if (aiDir !== gtDir) {
            mismatches.push({
                zpid,
                address: gt.address,
                expected: gt.expected_orientation,
                actual: ai.final_orientation,
                version: ai.batch_version || 'N/A'
            });
        }
    }
    
    console.log(`Found ${mismatches.length} total mismatches in Pleasanton:`);
    mismatches.forEach((m, i) => {
        console.log(`${i+1}. [${m.version}] ${m.zpid} | ${m.address}`);
        console.log(`   Expected: ${m.expected} | AI: ${m.actual}`);
    });
    
    return mismatches;
}

findAllMismatches().catch(console.error);
