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
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    const buffer = await response.arrayBuffer();
    const data = Buffer.from(buffer).toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    return { data, mimeType };
}

const ORIENTATION_SCHEMA = {
    type: 'object',
    properties: {
        final_orientation: { type: 'string' },
        azimuth_degrees: { type: 'number', nullable: true },
        explanation: { type: 'string' },
        property_layout_type: { type: 'string' },
        street_view_shows_front: { type: 'boolean', nullable: true },
    },
    required: ['final_orientation', 'azimuth_degrees', 'explanation', 'property_layout_type'],
};

async function investigate(zpid, iterations = 5) {
    console.log(`Investigating instability for ZPID: ${zpid}...\n`);
    
    const keys = await getApiKeys();
    const geminiKey = keys.gemini_key;
    
    const propSnap = await db.collection('properties').doc(zpid).get();
    const prop = propSnap.data();
    
    const aerialImg = await downloadImageBase64(prop.satelliteImageUrl);
    const svImg = await downloadImageBase64(prop.streetView);
    
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', responseSchema: ORIENTATION_SCHEMA },
    });

    const prompt = `You are a spatial analysis expert. 
    Property Address: ${prop.address}
    
    Image A = Aerial satellite (North-up).
    Image B = Street View.
    
    TASK:
    1. Identify the front door orientation.
    2. Use the "Toward Rule": front faces toward the road.
    3. If Image B shows a garage but no front door, set street_view_shows_front=false.
    4. If street_view_shows_front=false, look for the front door on a DIFFERENT side in Image A.
    
    Output JSON.`.trim();

    for (let i = 0; i < iterations; i++) {
        console.log(`--- Iteration ${i+1} ---`);
        const parts = [
            { text: prompt },
            { inlineData: { mimeType: aerialImg.mimeType, data: aerialImg.data } }
        ];
        if (svImg) parts.push({ inlineData: { mimeType: svImg.mimeType, data: svImg.data } });
        
        const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
        const data = JSON.parse(result.response.text());
        
        console.log(`Orientation: ${data.final_orientation} (${data.azimuth_degrees}°)`);
        console.log(`Layout: ${data.property_layout_type}`);
        console.log(`Shows Front: ${data.street_view_shows_front}`);
        console.log(`Reasoning: ${data.explanation}`);
        console.log('\n');
    }
}

const targetZpid = process.argv[2] || '124733791';
investigate(targetZpid).catch(console.error);
