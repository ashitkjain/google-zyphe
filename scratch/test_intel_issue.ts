import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { _processOneIntel } from '../functions/intelBatch';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Admin SDK
if (getApps().length === 0) {
    initializeApp({
        projectId: 'zyphe-af0bf'
    });
}

const db = getFirestore();

async function testProperty(zpid: string) {
    console.log(`\n=== Testing ZPID: ${zpid} ===`);
    
    // 1. Get API Keys
    const keysSnap = await db.collection('app_config').doc('api_keys').get();
    const keys = keysSnap.data() || {};
    const apiKeys = {
        gemini_key: keys.gemini_api_key || process.env.VITE_GEMINI_API_KEY,
        maps_key: keys.google_maps_api_key || process.env.VITE_GOOGLE_MAPS_API_KEY,
    };
    
    const genAI = new GoogleGenerativeAI(apiKeys.gemini_key);

    // 2. Run Full Intel
    console.log(`[Test] Triggering _processOneIntel for ${zpid}...`);
    const intelResult = await _processOneIntel(zpid, db, genAI, true, apiKeys);
    console.log(`[Test] Intel Result:`, JSON.stringify(intelResult, null, 2));

    // 3. Wait a bit for Firestore consistency (though Admin SDK is usually immediate)
    await new Promise(r => setTimeout(r, 1000));

    // 4. Load all data for smoke test
    const propRef = db.collection('properties').doc(zpid);
    const analysisRef = propRef.collection('analysis');
    const envRef = propRef.collection('environmental');

    const [propSnap, assetsSnap, visualSnap, compSnap, investSnap, insightsSnap, fitSnap, graphSnap, envSnap] = await Promise.all([
        propRef.get(),
        analysisRef.doc('assets').get(),
        analysisRef.doc('visual').get(),
        analysisRef.doc('comprehensive').get(),
        analysisRef.doc('investment').get(),
        analysisRef.doc('lifestyle_insights').get(),
        analysisRef.doc('lifestyle_fit').get(),
        analysisRef.doc('context_graph').get(),
        envRef.doc('thirdparty_data').get()
    ]);

    const propData = propSnap.data();
    const assetsData = assetsSnap.data();
    const visualData = visualSnap.data();
    const compData = compSnap.data();
    const investData = investSnap.data();
    const insightsData = insightsSnap.data();
    const fitData = fitSnap.data();
    const graphData = graphSnap.data();
    const envData = envSnap.data();

    console.log(`[Test] Data Check:`);
    console.log(`  - Visual: ${visualSnap.exists ? 'EXISTS' : 'MISSING'}`);
    console.log(`  - Comprehensive: ${compSnap.exists ? 'EXISTS' : 'MISSING'}`);
    console.log(`  - Lifestyle Insights: ${insightsSnap.exists ? 'EXISTS' : 'MISSING'}`);
    if (insightsSnap.exists) {
        console.log(`    Keys: ${Object.keys(insightsData || {}).join(', ')}`);
    }
    console.log(`  - Lifestyle Fit: ${fitSnap.exists ? 'EXISTS' : 'MISSING'}`);
    if (fitSnap.exists) {
        console.log(`    Keys: ${Object.keys(fitData || {}).join(', ')}`);
    }

    // 5. Run Smoke Test logic (simulated)
    // We need to pass the data in the format runChecks expects
    // Note: runChecks uses Web SDK types/refs, but here we have Admin SDK data.
    // We'll just run a simplified version of the checks here to see what's missing.
    
    const errors = [];
    if (!insightsSnap.exists) errors.push('Lifestyle Insights document missing');
    else {
        const data = insightsSnap.data() || {};
        const required = ['outdoor', 'family', 'senior', 'pets', 'food', 'professionals'];
        const missing = required.filter(k => !data[k]);
        if (missing.length > 0) {
            errors.push(`Lifestyle Insights missing keys. Found: ${Object.keys(data).join(', ')}. Need: ${required.join(', ')}`);
        }
    }

    if (!fitSnap.exists) errors.push('Lifestyle Fit document missing');
    else {
        const fit = fitData;
        if (!(fit?.working_professionals?.verdict && fit?.families_with_kids?.verdict && fit?.seniors?.verdict)) {
            errors.push(`Lifestyle Fit missing fields. Found: ${JSON.stringify(fit)}`);
        }
    }

    if (errors.length > 0) {
        console.log(`[Test] SMOKE TEST FAILED:`);
       if (compSnap.exists) {
        console.log(`  - Comprehensive: EXISTS`);
        console.log(`    Keys: ${Object.keys(compSnap.data() || {}).join(', ')}`);
    } else {
        console.log(`  - Comprehensive: MISSING`);
    }
        errors.forEach(e => console.log(`  - ${e}`));
    } else {
        console.log(`[Test] SMOKE TEST PASSED!`);
    }
}

async function run() {
    try {
        await testProperty('25062807');
        await testProperty('115828488');
    } catch (e) {
        console.error(e);
    }
}

run();
