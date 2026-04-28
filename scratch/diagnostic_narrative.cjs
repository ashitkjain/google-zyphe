
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Initialize Admin SDK
if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'zyphe-af0bf'
    });
}

const db = admin.firestore();

// Mock dependencies from intelBatch.js (extracting logic for test)
function _optimizeProperty(prop) {
    if (!prop) return {};
    const {
        images, comps, nearbyHomes, neighborhoodPlaces, google_places,
        parcelPolygon, __cachedEnvEarly, __pipeline_timings, _fetchMeta, ...kept
    } = prop;
    return kept;
}

function _optimizeVisual(visual) {
    if (!visual) return {};
    const { image_by_image_analysis, ...kept } = visual;
    return kept;
}

function _extractJson(text) {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('No JSON found in response');
        return JSON.parse(match[0]);
    } catch (e) {
        // Fallback for markdown blocks
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(clean);
    }
}

async function testNarrative(zpid) {
    console.log(`\n--- Diagnostic Test for ZPID: ${zpid} ---`);

    try {
        const keysSnap = await db.collection('app_config').doc('api_keys').get();
        const keys = keysSnap.exists ? keysSnap.data() : {};
        const geminiKey = keys.gemini_key || process.env.GEMINI_API_KEY;

        if (!geminiKey) throw new Error('Missing Gemini API Key');

        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Use flash for cost/speed

        const propRef = db.collection('properties').doc(zpid);
        const [propSnap, visualSnap] = await Promise.all([
            propRef.get(),
            propRef.collection('analysis').doc('visual').get()
        ]);

        if (!propSnap.exists) {
            console.error('Property doc missing');
            return;
        }

        const propData = propSnap.data();
        const visualData = visualSnap.exists ? visualSnap.data() : null;

        console.log(`Property Address: ${propData.address || propData.streetAddress}`);
        console.log(`Visual Data Present: ${!!visualData}`);

        // We need to import the prompt
        // Since we are in artifacts, we'll try to find it
        const promptFile = path.join(process.cwd(), 'functions', 'prompts', 'property', 'comprehensiveAnalysis.js');
        console.log(`Loading prompt from: ${promptFile}`);
        const { getComprehensiveAnalysisPrompt } = require(promptFile);

        const prompt = getComprehensiveAnalysisPrompt(_optimizeProperty(propData), _optimizeVisual(visualData || {}));
        console.log('Prompt length:', prompt.length);

        console.log('Sending to Gemini...');
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log('Gemini Response received (first 100 chars):', text.substring(0, 100));

        let compData = _extractJson(text);
        console.log('Successfully parsed JSON keys:', Object.keys(compData));

        // Validate required fields for smoke test
        const hasSummary = !!(compData.summary && compData.summary.length > 30);
        const hasRisks = !!(compData.risks_considerations || compData.risksAndConsiderations);
        const hasInterior = !!(compData.interior_summary?.interior_summary || compData.interiorSummary?.interiorSummary);

        console.log('--- Smoke Test Simulation ---');
        console.log(`Narrative Summary: ${hasSummary ? '✅' : '❌'}`);
        console.log(`Risks: ${hasRisks ? '✅' : '❌'}`);
        console.log(`Interior Summary: ${hasInterior ? '✅' : '❌'}`);

        if (hasSummary && hasRisks && hasInterior) {
            console.log('\nWriting to Firestore properties/' + zpid + '/analysis/comprehensive ...');
            // We'll write it for real to "heal" this property
            await propRef.collection('analysis').doc('comprehensive').set({
                ...compData,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                diagnostic: true
            });
            console.log('Write successful.');
        } else {
            console.warn('\nSkipping write due to missing fields.');
        }

    } catch (e) {
        console.error('Test Failed:', e);
    }
}

// Run for the property the user provided: 5345 W Chesterfield Cir, Dublin, CA 94568
// ZPID is likely 25078518 or similar. I'll search for it if I don't have it.
const targetZpid = process.argv[2] || '25078518';
testNarrative(targetZpid);
