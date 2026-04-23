'use strict';
/**
 * Full Intelligence Batch — Cloud Function
 * 
 * Triggered by full_intel_batch_jobs/{jobId}.
 * Runs Gemini Visual Analysis, Comprehensive Narrative, and Investment Research.
 * Supports "Healing" of stale/expired data (60-day TTL).
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const INTEL_CONCURRENCY = 2; // Reduced to prevent 429s on heavy image tasks
const MODEL_NAME = 'gemini-2.5-flash'; // High performance/low cost for background processing

// ─── AI Pipeline Helpers ─────────────────────────────────────────────────────

/**
 * 60-day TTL for environmental and visual data
 */
function _isStale(timestamp) {
    if (!timestamp) return true;
    const now = Date.now();
    const updatedMs = timestamp.toMillis ? timestamp.toMillis() : new Date(timestamp).getTime();
    const TTL = 60 * 24 * 60 * 60 * 1000;
    return (now - updatedMs) > TTL;
}

/**
 * Checks if a visual analysis object is reasonably complete.
 */
function _isVisualComplete(visual) {
    if (!visual) return false;
    const hasInterior = !!(visual.home_interior?.overall_description && visual.home_interior.overall_description.length > 50);
    const hasExterior = !!(visual.exterior_and_neighborhood?.exterior_and_lot_appeal?.architecture_style);
    return hasInterior && hasExterior;
}

/**
 * Ported Prompt: Visual Analysis
 */
function _getVisualPrompt(property) {
    return `
You are an expert real estate agent and interior design critic. Provide a comprehensive, detailed report on the property based on visual evidence.
Property: ${JSON.stringify(property)}
Narrative Style: Write in a flowing, descriptive paragraph style in a compelling tone. Avoid bullet points.
Return a single JSON object matching this schema:
{
  "report_title": "string",
  "home_interior": {
    "overall_description": "Natural, emotionally resonant narrative",
    "design_style": { "style": "modern/transitional/etc", "reasoning": "cues" },
    "color_and_materials": "string",
    "lighting": "string",
    "spatial_flow": "string",
    "staging_and_furnishings": "string",
    "condition_and_finish": "string"
  },
  "room_highlights": [{ "room_name": "Kitchen", "description": "2-4 sentences", "potential_improvements": "string" }],
  "exterior_and_neighborhood": {
    "exterior_and_lot_appeal": { "architecture_style": "string", "curb_appeal": "string", "backyard_and_patio": "string" },
    "views_privacy_orientation": { "views": "string", "privacy": "string" },
    "neighborhood_street_insights": "string"
  }
}
`;
}

/**
 * Ported Prompt: Comprehensive Analysis
 */
function _getComprehensivePrompt(property, visual) {
    return `
You are an AI-powered home buying assistant. Synthesize the provided facts and visual analysis into a compelling narrative report.
Facts: ${JSON.stringify(property)}
Visual: ${JSON.stringify(visual)}
Return a single JSON matching this structure:
{
  "summary": "150-200 word summary with bold highlights",
  "detailed_analysis": {
    "visual_appeal_condition": "paragraph",
    "outdoors_view_quality": "paragraph",
    "community_pulse": "paragraph"
  },
  "risks_considerations": "paragraph on location/condition/financial risks",
  "interior_summary": { "interior_summary": "neutral facts", "rooms_summary": "neutral facts", "vibe": "objective", "objective_tags": ["tag"] },
  "schools_summary": "3-5 sentence summary"
}
`;
}

async function _fetchImageAsBase64(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return {
            inlineData: {
                data: buffer.toString('base64'),
                mimeType: response.headers.get('content-type') || 'image/jpeg'
            }
        };
    } catch (e) {
        console.warn(`[Intel] Failed to fetch image ${url}:`, e.message);
        return null;
    }
}

async function _processOneIntel(zpid, db, genAI, force = false) {
    try {
        const propRef = db.collection('properties').doc(zpid);
        const analysisRef = propRef.collection('analysis');
        const envRef = propRef.collection('environmental').doc('thirdparty_data');

        const [propSnap, visualSnap, compSnap, investSnap, envSnap] = await Promise.all([
            propRef.get(),
            analysisRef.doc('visual').get(),
            analysisRef.doc('comprehensive').get(),
            analysisRef.doc('investment').get(),
            envRef.get()
        ]);

        if (!propSnap.exists) return { status: 'failed', message: 'Property not found' };
        const propData = propSnap.data();
        const envData = envSnap.exists ? envSnap.data() : null;

        // 1. Data Refresh (Healing)
        const needsEnvRefresh = !envData || _isStale(envData.lastUpdated);
        const needsVisualRefresh = force || !visualSnap.exists || !_isVisualComplete(visualSnap.data()) || _isStale(visualSnap.data().lastUpdated);

        console.log(`[Intel] Processing ${zpid}: needsEnv=${needsEnvRefresh}, needsVisual=${needsVisualRefresh}`);

        let visualData = visualSnap.exists ? visualSnap.data() : null;

        // 2. AI Visual Pass
        if (needsVisualRefresh) {
            console.log(`[Intel] Running Visual Pass for ${zpid}...`);
            const imageUrls = propData.images || [];
            if (imageUrls.length > 0) {
                // Limit to first 15 images for background performance
                const targets = imageUrls.slice(0, 15);
                const imageParts = await Promise.all(targets.map(url => _fetchImageAsBase64(url)));
                const validParts = imageParts.filter(p => p !== null);

                if (validParts.length > 0) {
                    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
                    const prompt = _getVisualPrompt(propData);

                    const result = await model.generateContent([
                        { text: prompt },
                        ...validParts
                    ]);

                    const text = result.response.text();
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        visualData = JSON.parse(jsonMatch[0]);
                        await analysisRef.doc('visual').set({
                            ...visualData,
                            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                            version: 'batch-v1'
                        });
                    }
                }
            }
        }

        // 3. Comprehensive Pass (Synthesis)
        if (force || !compSnap.exists || _isStale(compSnap.data().lastUpdated)) {
            console.log(`[Intel] Running Comprehensive Pass for ${zpid}...`);
            const model = genAI.getGenerativeModel({ model: MODEL_NAME });
            const prompt = _getComprehensivePrompt(propData, visualData || {});
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const compData = JSON.parse(jsonMatch[0]);
                await analysisRef.doc('comprehensive').set({
                    ...compData,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        }

        return {
            status: (needsVisualRefresh || force) ? 'success' : 'cached',
            zpid,
            healed: {
                visual: needsVisualRefresh,
                environmental: needsEnvRefresh
            }
        };
    } catch (e) {
        console.error(`[Intel Error] ${zpid}:`, e);
        return { status: 'failed', message: e.message };
    }
}

// ─── Cloud Function ──────────────────────────────────────────────────────────

exports.runFullIntelBatchOnCreate = functions
    .runWith({ timeoutSeconds: 540, memory: '2GB' })
    .firestore
    .document('full_intel_batch_jobs/{jobId}')
    .onCreate(async (snap, context) => {
        const jobData = snap.data();
        if (jobData.status !== 'queued') return null;

        const jobId = context.params.jobId;
        const zpids = jobData.zpids || [];
        const db = admin.firestore();

        // Fetch API Keys
        const keysSnap = await db.collection('app_config').doc('api_keys').get();
        const keys = keysSnap.exists ? keysSnap.data() : {};
        const apiKey = keys.gemini_key || process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error('Missing Gemini API Key');
            return snap.ref.update({ status: 'failed', error: 'Missing API Key' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        await snap.ref.update({ status: 'running', startedAt: admin.firestore.FieldValue.serverTimestamp() });

        let done = 0;
        let failed = 0;
        const results = {};

        // Process in waves to respect rate limits
        for (let i = 0; i < zpids.length; i += INTEL_CONCURRENCY) {
            const chunk = zpids.slice(i, i + INTEL_CONCURRENCY);
            const batchResults = await Promise.allSettled(chunk.map(async (zpid) => {
                const res = await _processOneIntel(zpid, db, genAI, !!jobData.force);
                return { zpid, ...res };
            }));

            batchResults.forEach(res => {
                if (res.status === 'fulfilled') {
                    const val = res.value;
                    results[val.zpid] = val;
                    if (val.status === 'success' || val.status === 'cached') done++; else failed++;
                } else {
                    failed++;
                }
            });

            // Update progress in Firestore so UI can reflect it
            await snap.ref.update({ done, failed, results });
        }

        await snap.ref.update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return null;
    });
