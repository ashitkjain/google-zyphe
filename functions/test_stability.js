#!/usr/bin/env node
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Initialize Firebase
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

// Simplified version of the prompt builders from orientationBatch.js
function buildOrientationPrompt(usesDualImage, address, description, streetBearing, streetSide, svHeading, roadmapLabel, homeType) {
    const streetName = address ? (address.split(',')[0] || '').replace(/^\d+[A-Za-z]?\s+/, '').trim() : null;
    const roadmapStep = roadmapLabel ? `\nSTREET DIRECTION — ROAD MAP (Image ${roadmapLabel}):\n  Find "${streetName}" and read its bearing. Use as primary signal.` : '';
    
    return `You are a spatial analysis expert. Address: ${address}.
    Image A = Aerial satellite (North-up).
    ${usesDualImage ? 'Image B = Street View.' : ''}
    ${roadmapLabel ? `Image ${roadmapLabel} = Road map.` : ''}
    
    GUIDING PRINCIPLES:
    1. North is UP.
    2. Front faces TOWARD the street.
    3. ⚠️ TOWNHOUSE/CONDO HARD STOP: If the property is a townhouse or condo (check PROPERTY TYPE) and Image B shows only a garage with no clear front door, IMMEDIATELY set final_orientation='UNCLEAR', azimuth_degrees=null. Do NOT try to guess the front door from the aerial image.
    ${roadmapStep}
    
    Output JSON with final_orientation and azimuth_degrees.
    `.trim();
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

async function testStability(zpid, iterations = 5) {
    console.log(`Testing stability for ZPID: ${zpid} over ${iterations} iterations...\n`);
    
    const keys = await getApiKeys();
    const geminiKey = keys.gemini_key;
    if (!geminiKey) throw new Error('Missing Gemini API Key');
    
    const propSnap = await db.collection('properties').doc(zpid).get();
    if (!propSnap.exists) throw new Error('Property not found');
    const prop = propSnap.data();
    
    const aerialUrl = prop.satelliteImageUrl;
    const svUrl = prop.streetView;
    const address = prop.address;
    
    console.log(`Address: ${address}`);
    console.log(`Aerial URL: ${aerialUrl ? 'YES' : 'NO'}`);
    console.log(`SV URL: ${svUrl ? 'YES' : 'NO'}`);
    
    const aerialImg = await downloadImageBase64(aerialUrl);
    const svImg = await downloadImageBase64(svUrl);
    
    const prompt = buildOrientationPrompt(!!svImg, address, prop.description, null, null, null, null, prop.homeType);
    
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', responseSchema: ORIENTATION_SCHEMA },
    });
    
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
        console.log(`Iteration ${i+1}...`);
        const parts = [
            { text: prompt },
            { inlineData: { mimeType: aerialImg.mimeType, data: aerialImg.data } }
        ];
        if (svImg) parts.push({ inlineData: { mimeType: svImg.mimeType, data: svImg.data } });
        
        const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
        const responseText = result.response.text();
        const data = JSON.parse(responseText);
        results.push(data);
        console.log(`   Result: ${data.final_orientation} (${data.azimuth_degrees}°)`);
    }
    
    console.log('\n--- SUMMARY ---');
    results.forEach((r, i) => {
        console.log(`${i+1}: ${r.final_orientation} | ${r.azimuth_degrees}°`);
    });
    
    const orientations = results.map(r => r.final_orientation);
    const unique = new Set(orientations);
    if (unique.size === 1) {
        console.log('\n✅ Result is STABLE.');
    } else {
        console.log(`\n❌ Result is INSTABLE. Found ${unique.size} different orientations.`);
    }
}

const targetZpid = process.argv[2] || '124733791';
testStability(targetZpid).catch(console.error);
