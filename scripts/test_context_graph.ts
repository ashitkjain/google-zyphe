import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function run() {
    console.log("Looking up 4129 Grant Ct...");
    const propertiesSnap = await db.collection('properties')
        .where('address', '>=', '4129 Grant Ct')
        .limit(5)
        .get();

    let zpid = null;
    propertiesSnap.forEach(doc => {
        if (doc.data().address.includes('4129 Grant Ct')) {
            zpid = doc.id;
        }
    });

    if (!zpid) {
        console.error("ZPID not found for 4129 Grant Ct");
        return;
    }
    console.log("Found ZPID:", zpid);

    // Read the property data and analysis subcollections
    const propRef = db.collection('properties').doc(zpid);
    const [propSnap, visualSnap, investmentSnap, visionExtSnap] = await Promise.all([
        propRef.get(),
        propRef.collection('analysis').doc('visual').get(),
        propRef.collection('analysis').doc('investment').get(),
        propRef.collection('analysis').doc('vision_v2').get(),
    ]);

    const prop = propSnap.data();
    const visual = visualSnap.exists ? visualSnap.data() : null;
    const investment = investmentSnap.exists ? investmentSnap.data() : null;
    const visionExtension = visionExtSnap.exists ? visionExtSnap.data() : null;

    console.log("Vision Extension data loaded?", !!visionExtension);
    if (visionExtension && visionExtension.photos) {
        console.log("Vision Extension Spaces Found:");
        visionExtension.photos.filter(p => p.group_label && p.analysis).forEach(p => {
            console.log(`- ${p.group_label}`);
        });
    }

    // Rather than invoking the whole pipeline, let's output the prompt that *would* be sent to the LLM.
    const { buildGraphExtractionContext } = await import('../prompts/property/contextGraphExtraction');
    const { getContextGraphExtractionPrompt } = await import('../prompts/property/contextGraphExtraction');
    const { precomputeDataFactors } = await import('../utils/contextGraphPrecompute');

    // Mocks for visual / comprehensive (using just what we fetched)
    const context = buildGraphExtractionContext(prop, visual, null, visionExtension);
    const precomputed = precomputeDataFactors(prop, visual, null);
    
    const successfulSkipIds = Array.from(precomputed.entries())
        .filter(([, f]) => (f.tags && f.tags.length > 0) || (f.value && f.value.trim().length > 0))
        .map(([id]) => id);

    const prompt = getContextGraphExtractionPrompt(context, successfulSkipIds);

    console.log("\n==================== FACTOR 113 DEFINITION IN PROMPT ====================");
    const promptLines = prompt.split('\n');
    const factor113Idx = promptLines.findIndex(line => line.includes('113. **Room-by-Room Character'));
    if (factor113Idx !== -1) {
        console.log(promptLines[factor113Idx]);
    } else {
        console.log("Factor 113 not found in prompt!");
    }

    console.log("\n==================== VISION EXTENSION CONTEXT ====================");
    if (context.visionExtension) {
        console.log(JSON.stringify(context.visionExtension, null, 2));
    } else {
        console.log("No visionExtension in context.");
    }

    // Now let's try to actually extract factor 113 via the gemini API!
    console.log("\n==================== RUNNING GEMINI ====================");
    const { extractContextGraphFactors } = await import('../services/geminiService');
    const res = await extractContextGraphFactors(prop, visual, null, visionExtension);

    console.log("Response received from Gemini!");
    if (res.data && res.data.factors) {
        const factor113 = res.data.factors.find(f => f.id === 113);
        console.log("\n=== FACTOR 113 EXTRACTION RESULT ===");
        console.log(JSON.stringify(factor113, null, 2));
    } else {
        console.log("No factors returned.", res.data);
    }
}

run().catch(console.error);
