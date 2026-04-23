#!/usr/bin/env node
const admin = require('firebase-admin');
const fs = require('fs');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'zyphe-af0bf'
    });
}
const db = admin.firestore();

async function downloadImages(zpid) {
    const propSnap = await db.collection('properties').doc(zpid).get();
    const prop = propSnap.data();
    
    if (prop.satelliteImageUrl) {
        const res = await fetch(prop.satelliteImageUrl);
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(`aerial_${zpid}.jpg`, Buffer.from(buffer));
        console.log(`Saved aerial_${zpid}.jpg`);
    }
    
    if (prop.streetView) {
        const res = await fetch(prop.streetView);
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(`sv_${zpid}.jpg`, Buffer.from(buffer));
        console.log(`Saved sv_${zpid}.jpg`);
    }
}

const targetZpid = process.argv[2] || '124733791';
downloadImages(targetZpid).catch(console.error);
