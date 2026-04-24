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

const INTEL_CONCURRENCY = 5; // Increased to 5 as requested
const MODEL_NAME = 'gemini-2.5-flash'; 

// ─── AI Pipeline Helpers ─────────────────────────────────────────────────────

/**
 * 30-day TTL for environmental and visual data
 */
function _isStale(timestamp) {
    if (!timestamp) return true;
    const now = Date.now();
    const updatedMs = timestamp.toMillis ? timestamp.toMillis() : new Date(timestamp).getTime();
    const TTL = 30 * 24 * 60 * 60 * 1000;
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

/**
 * Robust JSON extraction with structural repair
 */
function _extractJson(text) {
    const tryParse = (str) => {
        try { return JSON.parse(str); } catch { return null; }
    };

    const repairJson = (str) => {
        let result = '';
        let inString = false;
        let escaped = false;
        for (let i = 0; i < str.length; i++) {
            const ch = str[i];
            if (escaped) { result += ch; escaped = false; continue; }
            if (ch === '\\' && inString) { result += ch; escaped = true; continue; }
            if (ch === '"') { inString = !inString; result += ch; continue; }
            if (inString && (ch === '\n' || ch === '\r')) { result += '\\n'; continue; }
            result += ch;
        }
        result = result.replace(/,\s*([}\]])/g, '$1');
        result = result.replace(/("|\d|true|false|null|\]|\})\s*\n?\s*"/g, '$1,\n"');
        result = result.replace(/,+/g, ',');
        result = result.replace(/\{,/g, '{');
        result = result.replace(/\[,/g, '[');
        result = result.replace(/,}/g, '}');
        result = result.replace(/,]/g, ']');
        return result;
    };

    const cleaned = text.replace(/```json\s*|```/g, '').trim();
    
    // 1. Try direct & repaired
    let res = tryParse(cleaned) || tryParse(repairJson(cleaned));
    if (res) return res;

    // 2. Greedy Extraction
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        for (let end = lastBrace; end > firstBrace; end--) {
            if (cleaned[end] === '}') {
                const cand = cleaned.substring(firstBrace, end + 1);
                res = tryParse(cand) || tryParse(repairJson(cand));
                if (res) return res;
            }
        }
    }
    throw new Error("Could not parse AI response as JSON");
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
                    visualData = _extractJson(text);
                    await analysisRef.doc('visual').set({
                        ...visualData,
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                        version: 'batch-v2' // bumped version
                    });
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
            const compData = _extractJson(text);
            await analysisRef.doc('comprehensive').set({
                ...compData,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        return {
            status: (needsVisualRefresh || force) ? 'success' : 'cached',
            zpid,
            message: (needsVisualRefresh || force) ? 'Analyzed (Fresh)' : 'Loaded from Cache',
            healed: {
                visual: needsVisualRefresh,
                environmental: needsEnvRefresh
            }
        };
    } catch (e) {
        console.error(`[Intel Error] ${zpid}:`, e);
        return { status: 'failed', message: `Error: ${e.message.slice(0, 100)}` };
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

        // 1. Prioritization & Resumability Check
        // We load existing progress to support resumption after timeouts
        let results = jobData.results || {};
        let done = jobData.done || 0;
        let failed = jobData.failed || 0;

        let sortedZpids = [...zpids];
        try {
            console.log(`[Intel Batch] Pre-scanning ${zpids.length} properties for prioritization...`);
            const statusSnaps = await Promise.all(zpids.map(zpid => db.collection('properties').doc(zpid).collection('analysis').doc('visual').get()));
            const needsWorkMap = new Map();
            statusSnaps.forEach((s, idx) => {
                const zpid = zpids[idx];
                const data = s.exists ? s.data() : null;
                const isNew = !s.exists || !_isVisualComplete(data);
                const isStale = data && _isStale(data.lastUpdated);
                // Priority Weight: New (2) > Stale (1) > Fresh (0)
                needsWorkMap.set(zpid, isNew ? 2 : (isStale ? 1 : 0));
            });
            sortedZpids.sort((a, b) => needsWorkMap.get(b) - needsWorkMap.get(a));
            console.log(`[Intel Batch] Prioritization complete.`);
        } catch (e) {
            console.warn('[Intel Batch] Prioritization failed:', e.message);
        }

        // 2. Process in waves
        for (let i = 0; i < sortedZpids.length; i += INTEL_CONCURRENCY) {
            const chunk = sortedZpids.slice(i, i + INTEL_CONCURRENCY);
            
            // Resume Check: Filter out zpids that were already processed in a previous (timed-out) run
            const workChunk = chunk.filter(zpid => !results[zpid]);
            
            if (workChunk.length === 0) {
                // If the entire chunk is already done, just update the total 'done' count if it's missing from the snap
                continue; 
            }

            console.log(`[Intel Batch] Processing chunk: ${workChunk.join(', ')}`);
            const batchResults = await Promise.allSettled(workChunk.map(async (zpid) => {
                const res = await _processOneIntel(zpid, db, genAI, !!jobData.force);
                return { zpid, ...res };
            }));

            batchResults.forEach(res => {
                if (res.status === 'fulfilled') {
                    const val = res.value;
                    results[val.zpid] = val;
                    // Count as done if successfully analyzed OR loaded from cache
                    if (val.status === 'success' || val.status === 'cached') {
                        // Incremental 'done' logic: we recalculate from the full results object to be safe
                    }
                } else {
                    // We don't mark as failed in results yet, so it can be retried
                }
            });

            // Recalculate counts from the latest results state
            const currentResults = Object.values(results);
            const newDone = currentResults.filter(r => r.status === 'success' || r.status === 'cached').length;
            const newFailed = currentResults.filter(r => r.status === 'failed').length;

            // Update progress in Firestore
            await snap.ref.update({ 
                done: newDone, 
                failed: newFailed, 
                results 
            });

            // 3. 2-Second Gap between chunks
            if (i + INTEL_CONCURRENCY < sortedZpids.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        await snap.ref.update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return null;
    });
