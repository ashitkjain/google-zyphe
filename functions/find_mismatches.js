#!/usr/bin/env node
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'zyphe-af0bf'
    });
}

const db = admin.firestore();

async function findMismatches() {
    console.log('Finding v29 mismatches in Pleasanton...');
    
    // 1. Get all orientation ground truth for Pleasanton
    const gtSnap = await db.collection('orientation_ground_truth')
        .where('city', '==', 'Pleasanton')
        .get();
    
    const mismatches = [];
    
    for (const gtDoc of gtSnap.docs) {
        const gt = gtDoc.data();
        const zpid = gtDoc.id;
        
        if (!gt.expected_orientation) continue;
        
        // 2. Get the property data
        const propSnap = await db.collection('properties').doc(zpid).get();
        if (!propSnap.exists) continue;
        
        const prop = propSnap.data();
        const ai = prop.orientation_ai;
        
        if (!ai || ai.batch_version !== 'v29') continue;
        
        const aiDir = (ai.final_orientation || '').split(' ')[0].toLowerCase();
        const gtDir = (gt.expected_orientation || '').split(' ')[0].toLowerCase();
        
        if (aiDir !== gtDir && aiDir !== 'unclear') {
            mismatches.push({
                zpid,
                address: gt.address,
                expected: gt.expected_orientation,
                actual: ai.final_orientation,
                confidence: ai.confidence
            });
        }
    }
    
    console.log(`Found ${mismatches.length} mismatches:`);
    mismatches.forEach((m, i) => {
        console.log(`${i+1}. ${m.zpid} | ${m.address}`);
        console.log(`   Expected: ${m.expected} | AI: ${m.actual} (${m.confidence})`);
    });
    
    return mismatches;
}

findMismatches().catch(console.error);
