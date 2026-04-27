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
const { _enrichProperty, _enrichEnvironmentalData } = require('./shared/propertyUtils');

const INTEL_CONCURRENCY = 20; // Parallel processing for Gemini scaling
const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Optimizes property data for AI context, removing large technical noise.
 */
function _optimizeProperty(prop) {
    if (!prop) return {};
    const {
        images, comps, nearbyHomes, neighborhoodPlaces, google_places,
        parcelPolygon, __cachedEnvEarly, __pipeline_timings, ...kept
    } = prop;
    return kept;
}

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

// Prompts are now loaded dynamically from shared files in ./prompts/



async function _fetchImageAsBase64(url) {
    try {
        // Optimization: If it's a Firebase Storage URL, fetch directly from the bucket
        if (url.startsWith('gs://') || url.includes('firebasestorage.googleapis.com')) {
            try {
                const bucket = admin.storage().bucket();
                let filePath = '';
                
                if (url.startsWith('gs://')) {
                    // gs://bucket-name/path/to/file
                    filePath = url.split('/').slice(3).join('/');
                } else {
                    // Extract encoded path: .../o/path%2Fto%2Ffile?alt=media...
                    const pathPart = url.split('/o/')[1].split('?')[0];
                    filePath = decodeURIComponent(pathPart);
                }
                
                const [buffer] = await bucket.file(filePath).download();
                return {
                    inlineData: {
                        data: buffer.toString('base64'),
                        mimeType: 'image/jpeg'
                    }
                };
            } catch (e) {
                console.warn(`[Intel] Direct bucket download failed for ${url}, falling back to fetch:`, e.message);
            }
        }

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

async function _processOneIntel(zpid, db, genAI, force = false, apiKeys = {}) {
    try {
        const propRef = db.collection('properties').doc(zpid);
        const analysisRef = propRef.collection('analysis');
        const envRef = propRef.collection('environmental').doc('thirdparty_data');

        const [propSnap, envSnap] = await Promise.all([
            propRef.get(),
            envRef.get()
        ]);

        if (!propSnap.exists) return { status: 'failed', message: 'Property not found. Run "Full Property Data" first.' };
        const propData = propSnap.data();
        const envData = envSnap.exists ? envSnap.data() : null;

        // ─── Phase 1: Refresh Analysis Snaps ─────────────────────────────────
        const [visualSnap, compSnap, graphSnap, investSnap, assetsSnap, insightsSnap, fitSnap] = await Promise.all([
            analysisRef.doc('visual').get(),
            analysisRef.doc('comprehensive').get(),
            analysisRef.doc('context_graph').get(),
            analysisRef.doc('investment').get(),
            analysisRef.doc('assets').get(),
            analysisRef.doc('lifestyle_insights').get(),
            analysisRef.doc('lifestyle_fit').get()
        ]);

        // 1. Data Refresh (Healing)
        const needsEnvRefresh = !envData || _isStale(envData.lastUpdated);
        const needsPropRefresh = !propData.apn || !propData.taxSqft;

        console.log(`[Intel] Processing ${zpid}: needsEnv=${needsEnvRefresh}, needsProp=${needsPropRefresh}`);

        if (needsEnvRefresh) {
            console.log(`[Intel] Healing Environmental Data for ${zpid}...`);
            await _enrichEnvironmentalData(zpid, propData.coordinates?.latitude, propData.coordinates?.longitude, apiKeys.maps_key, envRef);
        }

        if (needsPropRefresh) {
            console.log(`[Intel] Healing Property Data (Tax/APN) for ${zpid}...`);
            await _enrichProperty(zpid, db, apiKeys);
        }

        const needsVisualRefresh = force || !visualSnap.exists || !_isVisualComplete(visualSnap.data()) || _isStale(visualSnap.data().lastUpdated);

        let visualData = visualSnap.exists ? visualSnap.data() : null;

        // 2. AI Visual Pass
        if (needsVisualRefresh) {
            console.log(`[Intel] Running Visual Pass for ${zpid}...`);
            const assetData = assetsSnap.exists ? assetsSnap.data() : {};
            const galleryImages = propData.images || [];

            // Build the list of all targets: Maps first for context, then gallery
            const contextImages = [
                { url: assetData.streetView, label: 'Street View' },
                { url: assetData.mapZoomIn, label: 'Close-up Parcel Map' },
                { url: assetData.mapZoomOut, label: 'Neighborhood Context Map' },
                { url: assetData.satelliteImageUrl, label: 'Satellite/Radar Imagery' }
            ].filter(img => !!img.url);

            const galleryTargets = galleryImages.map(url => ({ url, label: 'Gallery Photo' }));
            const allTargets = [...contextImages, ...galleryTargets];

            if (allTargets.length > 0) {
                const imageParts = await Promise.all(allTargets.map(async (target) => {
                    const base64 = await _fetchImageAsBase64(target.url);
                    if (!base64) return null;
                    return [
                        { text: `--- ${target.label} ---` },
                        base64
                    ];
                }));

                const validParts = imageParts.filter(p => p !== null).flat();

                if (validParts.length > 0) {
                    const { getPropertyImagesPrompt } = await import('./prompts/property/propertyImages.js');
                    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
                    const prompt = getPropertyImagesPrompt(propData);

                    const result = await model.generateContent([
                        { text: prompt },
                        ...validParts
                    ]);

                    const text = result.response.text();
                    try {
                        visualData = _extractJson(text);
                    } catch (err) {
                        console.error(`[Intel JSON Error] Visual Pass malformed for ${zpid}. Raw text:`, text);
                        throw err;
                    }
                    await analysisRef.doc('visual').set({
                        ...visualData,
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                        version: 'batch-v2' // bumped version
                    });
                }
            }
        }

        // 3. Parallel Pass (Comprehensive + Lifestyle Insights + Lifestyle Fit)
        // We run these in parallel after Visual Pass is complete.
        const tasks = [];

        // 3a. Comprehensive Synthesis
        if (force || !compSnap.exists || _isStale(compSnap.data().lastUpdated)) {
            tasks.push((async () => {
                console.log(`[Intel] Running Comprehensive Pass for ${zpid}...`);
                const { getComprehensiveAnalysisPrompt } = await import('./prompts/property/comprehensiveAnalysis.js');
                const model = genAI.getGenerativeModel({ model: MODEL_NAME });
                const prompt = getComprehensiveAnalysisPrompt(propData, visualData || {});
                const result = await model.generateContent(prompt);
                const text = result.response.text();
                try {
                    const compData = _extractJson(text);
                    await analysisRef.doc('comprehensive').set({
                        ...compData,
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                    });
                } catch (err) {
                    console.error(`[Intel JSON Error] Comprehensive Pass malformed for ${zpid}. Raw text:`, text);
                }
            })());
        }

        // 3b. Lifestyle Insights (Neighborhood focus)
        if (force || !insightsSnap.exists || _isStale(insightsSnap.data().lastUpdated)) {
            tasks.push((async () => {
                console.log(`[Intel] Running Lifestyle Insights for ${zpid}...`);
                const { getLifestyleInsightsPrompt } = await import('./prompts/property/lifestyleInsights.js');
                const model = genAI.getGenerativeModel({ model: MODEL_NAME });
                const prompt = getLifestyleInsightsPrompt(propData);
                const result = await model.generateContent(prompt);
                const text = result.response.text();
                try {
                    const insightsData = _extractJson(text);
                    await analysisRef.doc('lifestyle_insights').set({
                        ...insightsData,
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                    });
                } catch (err) {
                    console.error(`[Intel JSON Error] Lifestyle Insights malformed for ${zpid}. Raw text:`, text);
                }
            })());
        }

        // 3c. Lifestyle Fit (Property focus)
        if (force || !fitSnap.exists || _isStale(fitSnap.data().lastUpdated)) {
            tasks.push((async () => {
                console.log(`[Intel] Running Lifestyle Fit for ${zpid}...`);
                const { getLifestyleFitPrompt } = await import('./prompts/property/lifestyleFit.js');
                const model = genAI.getGenerativeModel({ model: MODEL_NAME });
                // Note: Running in parallel means we don't have the fresh compData yet,
                // but we pass visualData and property basics which is the core of the fit.
                const prompt = getLifestyleFitPrompt(propData, visualData || {}, (envData?.streetViewAnalysis || null));
                const result = await model.generateContent(prompt);
                const text = result.response.text();
                try {
                    const fitData = _extractJson(text);
                    await analysisRef.doc('lifestyle_fit').set({
                        ...fitData,
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                    });
                } catch (err) {
                    console.error(`[Intel JSON Error] Lifestyle Fit malformed for ${zpid}. Raw text:`, text);
                }
            })());
        }

        if (tasks.length > 0) {
            await Promise.all(tasks);
        }

        const compData = (await analysisRef.doc('comprehensive').get()).data();

        // 4. Context Graph Pass
        if (force || !graphSnap.exists || _isStale(graphSnap.data().lastUpdated)) {
            console.log(`[Intel] Running Context Graph Pass for ${zpid}...`);
            const { getContextGraphExtractionPrompt, buildGraphExtractionContext } = await import('./prompts/property/contextGraphExtraction.js');
            const model = genAI.getGenerativeModel({ model: MODEL_NAME });
            const optProp = _optimizeProperty(propData);
            const context = buildGraphExtractionContext(optProp, visualData || {}, compData || {});
            const prompt = getContextGraphExtractionPrompt(context, []);
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            try {
                const graphData = _extractJson(text);
                await analysisRef.doc('context_graph').set({
                    ...graphData,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                });
            } catch (err) {
                console.error(`[Intel JSON Error] Context Graph Pass malformed for ${zpid}. Raw text:`, text);
            }
        }

        // 5. Investment Pass
        if (force || !investSnap.exists || _isStale(investSnap.data().lastUpdated)) {
            console.log(`[Intel] Running Investment Pass for ${zpid}...`);
            const { getInvestmentResearchPrompt } = await import('./prompts/property/investmentResearch.js');
            const model = genAI.getGenerativeModel({ model: MODEL_NAME });
            const optProp = _optimizeProperty(propData);
            const prompt = getInvestmentResearchPrompt(optProp);
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            try {
                const investmentData = _extractJson(text);
                await analysisRef.doc('investment').set({
                    ...investmentData,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                });
            } catch (err) {
                console.error(`[Intel JSON Error] Investment Pass malformed for ${zpid}. Raw text:`, text);
            }
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
        const apiKeys = {
            rapidapi_key: keys.rapidapi_key || process.env.RAPIDAPI_KEY,
            rapidapi_host: keys.rapidapi_host || 'us-housing-market-data1.p.rapidapi.com',
            radar_key: keys.radar_key || process.env.RADAR_KEY,
            gemini_key: keys.gemini_key || process.env.GEMINI_API_KEY,
            maps_key: keys.google_maps_key || keys.maps_key || process.env.MAPS_API_KEY,
            howloud_key: keys.howloud_key || process.env.HOWLOUD_KEY
        };

        if (!apiKeys.gemini_key) {
            console.error('Missing Gemini API Key');
            return snap.ref.update({ status: 'failed', error: 'Missing API Key' });
        }

        const genAI = new GoogleGenerativeAI(apiKeys.gemini_key);
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
            console.log(`[Intel Batch] Prioritization complete. Processing ${sortedZpids.length} properties.`);
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

            console.log(`[Intel Batch] Processing chunk of ${workChunk.length} properties...`);
            const batchResults = await Promise.allSettled(workChunk.map(async (zpid) => {
                const res = await _processOneIntel(zpid, db, genAI, !!jobData.force, apiKeys);
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

exports._processOneIntel = _processOneIntel;
