#!/usr/bin/env node
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'zyphe-af0bf'
    });
}
const db = admin.firestore();

async function getApiKeys() {
    const snap = await db.collection('app_config').doc('api_keys').get();
    return snap.exists ? snap.data() : {};
}

async function downloadImageBase64(url) {
    if (!url) return null;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const buffer = await response.arrayBuffer();
        const data = Buffer.from(buffer).toString('base64');
        const mimeType = response.headers.get('content-type') || 'image/jpeg';
        return { data, mimeType };
    } catch (e) {
        return null;
    }
}

const ORIENTATION_SCHEMA = {
    type: 'object',
    properties: {
        final_orientation: { type: 'string' },
        azimuth_degrees: { type: 'number', nullable: true },
        explanation: { type: 'string' },
    },
    required: ['final_orientation', 'azimuth_degrees', 'explanation'],
};

const ZPIDS = [
    '124733791', '18435919', '24931205', '25074542', 
    '25074628', '25075060', '25077044', '25080941', 
    '25080968', '25083314', '25085903', '25087255'
];

async function massTest() {
    const keys = await getApiKeys();
    const geminiKey = keys.gemini_key;
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', responseSchema: ORIENTATION_SCHEMA },
    });

    console.log(`Starting Mass Stability Test for ${ZPIDS.length} ZPIDs...\n`);

    for (const zpid of ZPIDS) {
        const propSnap = await db.collection('properties').doc(zpid).get();
        const prop = propSnap.data();
        const gtSnap = await db.collection('orientation_ground_truth').doc(zpid).get();
        const gt = gtSnap.data();
        
        console.log(`ZPID: ${zpid} | ${prop.address}`);
        console.log(`GT: ${gt.expected_orientation}`);
        
        const aerialImg = await downloadImageBase64(prop.satelliteImageUrl);
        const svImg = await downloadImageBase64(prop.streetView);
        
        if (!aerialImg) {
            console.log(`   ❌ Skipped: No aerial image\n`);
            continue;
        }

        const prompt = `You are a spatial analysis expert. Address: ${prop.address}.
        Image A = Aerial satellite (North-up).
        ${svImg ? 'Image B = Street View.' : ''}
        
        TASK:
        1. Identify the front door orientation.
        2. Use the "Toward Rule": front faces toward the road.
        
        Output JSON.`.trim();

        const results = [];
        for (let i = 0; i < 3; i++) {
            const parts = [{ text: prompt }, { inlineData: { mimeType: aerialImg.mimeType, data: aerialImg.data } }];
            if (svImg) parts.push({ inlineData: { mimeType: svImg.mimeType, data: svImg.data } });
            
            try {
                const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
                const data = JSON.parse(result.response.text());
                results.push(data.final_orientation);
            } catch (e) {
                results.push('ERROR');
            }
        }
        
        const unique = new Set(results);
        const stability = unique.size === 1 ? 'STABLE' : 'INSTABLE';
        console.log(`   Results: [${results.join(', ')}] — ${stability}`);
        
        const hitsGT = results.filter(r => r.toLowerCase().includes(gt.expected_orientation.toLowerCase())).length;
        console.log(`   GT Accuracy: ${hitsGT}/3\n`);
    }
}

massTest().catch(console.error);
