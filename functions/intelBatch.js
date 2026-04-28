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
const { _enrichEnvironmentalData } = require('./shared/propertyUtils');
const { _analyzeOneProperty } = require('./orientationBatch.js');

const INTEL_CONCURRENCY = 10;
const MAX_GALLERY_IMAGES = 15;
const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Optimizes property data for AI context, removing large technical noise.
 */
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

function _isVisualComplete(visual) {
    if (!visual) return false;
    const interior = visual.home_interior || {};
    const hasDescription = !!(interior.overall_description && interior.overall_description.length > 50);
    const hasInteriorSummary = !!(interior.interior_summary && interior.interior_summary.length > 20);
    const hasExterior = !!(visual.exterior_and_neighborhood?.exterior_and_lot_appeal?.architecture_style);
    return hasDescription && hasInteriorSummary && hasExterior;
}

function _isCompComplete(comp) {
    if (!comp) return false;
    const hasSummary = !!(comp.summary && comp.summary.length > 50);
    const hasRisks = !!(comp.risks_considerations && comp.risks_considerations.length > 20);
    return hasSummary && hasRisks;
}

exports._isCompComplete = _isCompComplete;

function _isFitComplete(fit) {
    if (!fit) return false;
    return !!(fit.working_professionals?.verdict && fit.families_with_kids?.verdict && fit.seniors?.verdict);
}

function _normalizeVisualData(data) {
    if (!data) return {};
    const d = data || {};
    const interior = d.home_interior || {};
    
    // Ensure the new summary fields are at the root of home_interior
    return {
        ...d,
        home_interior: {
            ...interior,
            interior_summary: interior.interior_summary || '',
            rooms_summary: interior.rooms_summary || '',
            vibe: interior.vibe || '',
            objective_tags: interior.objective_tags || []
        }
    };
}

/**
 * Normalizes field names for the Comprehensive Analysis pass to handle AI drift.
 */
function _normalizeComprehensiveData(data) {
    if (!data) return {};
    const d = data || {};
    
    // The schema is now just summary and risks_considerations
    return {
        summary: d.summary || '',
        risks_considerations: d.risks_considerations || d.risks || d.risksAndConsiderations || ''
    };
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
    if (!text) throw new Error("Empty AI response");

    const tryParse = (str) => {
        try { return JSON.parse(str); } catch { return null; }
    };

    // 1. Direct Clean
    let cleaned = text.replace(/```json\s*|```/g, '').trim();
    let res = tryParse(cleaned);
    if (res) return res;

    // 2. Greedy Extraction for { ... }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        const cand = cleaned.substring(firstBrace, lastBrace + 1);
        res = tryParse(cand);
        if (res) return res;

        // 3. Structural Repair (Fixing missing quotes, trailing commas, common AI errors)
        const repairJson = (str) => {
            let fixed = str
                .replace(/,\s*([}\]])/g, '$1') // Trailing commas
                .replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3') // Missing quotes on keys
                .replace(/:(\s*)'([^']*)'/g, ':$1"$2"') // Single quotes to double quotes
                .replace(/\n/g, ' ') // Remove newlines inside strings (simplified)
                .replace(/\r/g, ' ');
            return fixed;
        };
        
        res = tryParse(repairJson(cand));
        if (res) return res;
        
        // 4. Extreme: Balancing braces (if truncated)
        let balance = 0;
        let truncated = '';
        for (let i = firstBrace; i < cleaned.length; i++) {
            const ch = cleaned[i];
            truncated += ch;
            if (ch === '{') balance++;
            if (ch === '}') balance--;
            if (balance === 0 && truncated.length > 1) {
                res = tryParse(truncated) || tryParse(repairJson(truncated));
                if (res) return res;
            }
        }
        
        // Final attempt: manual closure of the last seen object
        if (balance > 0) {
            let closure = truncated.trim();
            for(let j=0; j<balance; j++) closure += '}';
            res = tryParse(closure) || tryParse(repairJson(closure));
            if (res) return res;
        }
    }

    throw new Error("Could not parse AI response as JSON even after repair attempts");
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

        // ── Environmental Data Healing (Google APIs only, no RapidAPI) ────────
        // RapidAPI property data fetching belongs in propertyBatch.js, NOT here.
        // If property data is missing, the user should run "Get Property Data" first.
        const needsEnvRefresh = !envData || _isStale(envData.lastUpdated);

        console.log(`[Intel] Processing ${zpid}: needsEnv=${needsEnvRefresh}`);

        if (needsEnvRefresh) {
            console.log(`[Intel] Healing Environmental Data for ${zpid}...`);
            // Correct signature: _enrichEnvironmentalData(zpid, db, keys, lat, lng)
            await _enrichEnvironmentalData(
                zpid,
                db,
                apiKeys,
                propData.coordinates?.latitude,
                propData.coordinates?.longitude
            );
        }

        const needsVisualRefresh = force || !visualSnap.exists || !_isVisualComplete(visualSnap.data()) || _isStale(visualSnap.data()?.lastUpdated);
        const needsInsightsRefresh = force || !insightsSnap.exists || _isStale(insightsSnap.data()?.lastUpdated);
        const needsFitRefresh = force || !fitSnap.exists || !_isFitComplete(fitSnap.data()) || _isStale(fitSnap.data()?.lastUpdated);
        const needsGraphRefresh = force || !graphSnap.exists || _isStale(graphSnap.data()?.lastUpdated);
        const needsInvestRefresh = force || !investSnap.exists || _isStale(investSnap.data()?.lastUpdated);
        const orientationAi = propData?.orientation_ai;
        const needsOrientationRefresh = force || !orientationAi || (orientationAi.batch_version !== 'v30' && orientationAi.orientation_version !== 'v30') || _isStale(propData.orientation_calculated_at);

        if (needsVisualRefresh) console.log(`[Intel] Refreshing Visual data for ${zpid} (force=${force}, exists=${visualSnap.exists}, stale=${_isStale(visualSnap.data()?.lastUpdated)}, incomplete=${!_isVisualComplete(visualSnap.data())})`);
        if (needsFitRefresh) console.log(`[Intel] Refreshing Fit data for ${zpid} (force=${force}, exists=${fitSnap.exists}, stale=${_isStale(fitSnap.data()?.lastUpdated)}, incomplete=${!_isFitComplete(fitSnap.data())})`);

        let visualData = visualSnap.exists ? visualSnap.data() : null;

        // 2. AI Visual Pass
        if (needsVisualRefresh) {
            console.log(`[Intel] Running Visual Pass for ${zpid}...`);
            const assetData = assetsSnap.exists ? assetsSnap.data() : {};
            const galleryImages = assetData.images || [];

            // Limit gallery images to prevent memory crashes (191 props * 50 images = OOM)
            const limitedGallery = galleryImages.slice(0, MAX_GALLERY_IMAGES);

            // Build the list of all targets: Maps first for context, then gallery
            const contextImages = [
                { url: assetData.streetView, label: 'Street View' },
                { url: assetData.mapZoomIn, label: 'Close-up Parcel Map' },
                { url: assetData.mapZoomOut, label: 'Neighborhood Context Map' },
                { url: assetData.satelliteImageUrl, label: 'Satellite/Radar Imagery' }
            ].filter(img => !!img.url);

            const galleryTargets = limitedGallery.map(url => ({ url, label: 'Gallery Photo' }));
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
                        visualData = _normalizeVisualData(_extractJson(text));
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

        // 3. Parallel Pass (Lifestyle Insights + Lifestyle Fit)
        // We run these in parallel after Visual Pass is complete.
        // Comprehensive Synthesis is now a separate pass.
        const tasks = [];

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
                const prompt = getLifestyleFitPrompt(_optimizeProperty(propData), _optimizeVisual(visualData || {}), (envData?.streetViewAnalysis || null));
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

        // 3d. Orientation Pass (Runs independently, uses own image fetching)
        if (needsOrientationRefresh) {
            console.log(`[Intel] Running Orientation Pass for ${zpid}...`);
            try {
                const geminiKey = apiKeys.gemini_key || process.env.GEMINI_API_KEY || '';
                const mapsKey = apiKeys.maps_key || process.env.MAPS_API_KEY || '';
                const radarKey = apiKeys.radar_key || process.env.RADAR_API_KEY || '';
                await _analyzeOneProperty(zpid, db, geminiKey, mapsKey, radarKey);
            } catch (err) {
                console.error(`[Intel Error] Orientation Pass failed for ${zpid}:`, err.message);
            }
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

exports.runFullIntelBatchOnWrite = functions
    .runWith({ timeoutSeconds: 540, memory: '4GB' })
    .firestore
    .document('full_intel_batch_jobs/{jobId}')
    .onWrite(async (change, context) => {
        const before = change.before.exists ? change.before.data() : null;
        const after = change.after.exists ? change.after.data() : null;

        if (!after) return null; // Deleted
        if (after.status !== 'queued') return null; // Only run when status is queued

        const startTime = Date.now();
        const TIMEOUT_SAFETY_MARGIN_MS = 90000; // 90 seconds safety margin
        const MAX_EXECUTION_TIME_MS = 540000; // 9 minutes

        const jobData = after;
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
        // Using change.after.ref instead of snap.ref
        await change.after.ref.update({ status: 'running', startedAt: admin.firestore.FieldValue.serverTimestamp() });

        // 1. Prioritization & Resumability Check
        // We load existing progress to support resumption after timeouts
        let results = jobData.results || {};
        let done = jobData.done || 0;
        let failed = jobData.failed || 0;

        let sortedZpids = [...zpids];
        try {
            console.log(`[Intel Batch] Pre-scanning ${zpids.length} properties for prioritization in chunks...`);
            const needsWorkMap = new Map();
            const PRESCAN_CHUNK_SIZE = 50;

            for (let i = 0; i < zpids.length; i += PRESCAN_CHUNK_SIZE) {
                const chunk = zpids.slice(i, i + PRESCAN_CHUNK_SIZE);
                const statusSnaps = await Promise.all(chunk.map(zpid =>
                    db.collection('properties').doc(zpid).collection('analysis').doc('visual').get()
                ));

                statusSnaps.forEach((s, idx) => {
                    const zpid = chunk[idx];
                    const data = s.exists ? s.data() : null;
                    const isNew = !s.exists || !_isVisualComplete(data);
                    const isStale = data && _isStale(data.lastUpdated);
                    // Priority Weight: New (2) > Stale (1) > Fresh (0)
                    needsWorkMap.set(zpid, isNew ? 2 : (isStale ? 1 : 0));
                });
            }

            sortedZpids.sort((a, b) => needsWorkMap.get(b) - needsWorkMap.get(a));
            console.log(`[Intel Batch] Prioritization complete. Top 5 ZPIDs to process: ${sortedZpids.slice(0, 5).join(', ')}`);
            console.log(`[Intel Batch] ${sortedZpids.filter(z => needsWorkMap.get(z) > 0).length} properties need refresh/healing.`);
        } catch (e) {
            console.warn('[Intel Batch] Prioritization failed:', e.message);
        }

        // 2. Process in waves
        for (let i = 0; i < sortedZpids.length; i += INTEL_CONCURRENCY) {
            const waveNum = Math.floor(i / INTEL_CONCURRENCY) + 1;
            const wave = sortedZpids.slice(i, i + INTEL_CONCURRENCY);

            // Skip ZPIDs already in jobData.results
            const workChunk = wave.filter(zpid => !results[zpid]);
            const totalWaves = Math.ceil(sortedZpids.length / INTEL_CONCURRENCY);

            if (workChunk.length === 0) {
                console.log(`[Intel Batch] Wave ${waveNum}/${totalWaves}: Skipping (already in results).`);
                continue;
            }

            console.log(`[Intel Batch] Wave ${waveNum}/${totalWaves}: Starting processing for ${workChunk.length} properties...`);
            const batchResults = await Promise.allSettled(workChunk.map(async (zpid) => {
                const res = await _processOneIntel(zpid, db, genAI, !!jobData.force, apiKeys);
                return { zpid, ...res };
            }));

            console.log(`[Intel Batch] Wave ${waveNum}/${totalWaves}: Completed. Updating Firestore...`);


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
            await change.after.ref.update({
                done: newDone,
                failed: newFailed,
                results
            });

            // ─── TIMEOUT SAFETY CHECK ───
            const elapsed = Date.now() - startTime;
            if (elapsed > (MAX_EXECUTION_TIME_MS - TIMEOUT_SAFETY_MARGIN_MS)) {
                console.warn(`[Intel Batch] Approaching timeout (${Math.round(elapsed / 1000)}s). Exiting wave loop to allow resumption.`);
                await change.after.ref.update({
                    status: 'queued', // Set back to queued to trigger a new run
                    lastWaveAt: admin.firestore.FieldValue.serverTimestamp()
                });
                return null;
            }

            // 3. 2-Second Gap between chunks
            if (i + INTEL_CONCURRENCY < sortedZpids.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        await change.after.ref.update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return null;
    });

/**
 * ─── Narrative (Comprehensive Analysis) Batch ──────────────────────────────
 * Triggered by narrative_batch_jobs/{jobId}.
 * Specialized pass for text synthesis and narrative analysis.
 */
exports.runNarrativeBatchOnWrite = functions
    .runWith({ timeoutSeconds: 540, memory: '2GB' })
    .firestore
    .document('narrative_batch_jobs/{jobId}')
    .onWrite(async (change, context) => {
        const after = change.after.exists ? change.after.data() : null;
        if (!after || after.status !== 'queued') return null;

        const db = admin.firestore();
        const zpids = after.zpids || [];
        const keysSnap = await db.collection('app_config').doc('api_keys').get();
        const keys = keysSnap.exists ? keysSnap.data() : {};
        const genAI = new GoogleGenerativeAI(keys.gemini_key || process.env.GEMINI_API_KEY);

        await change.after.ref.update({ status: 'running', startedAt: admin.firestore.FieldValue.serverTimestamp() });

        let results = after.results || {};
        for (let i = 0; i < zpids.length; i += 10) {
            const wave = zpids.slice(i, i + 10);
            await Promise.all(wave.map(async (zpid) => {
                try {
                    const propRef = db.collection('properties').doc(zpid);
                    const [propSnap, visualSnap] = await Promise.all([
                        propRef.get(),
                        propRef.collection('analysis').doc('visual').get()
                    ]);

                    if (!propSnap.exists) return;
                    const propData = propSnap.data();
                    const visualData = visualSnap.exists ? visualSnap.data() : null;

                    console.log(`[Narrative] Processing ${zpid}...`);
                    const { getComprehensiveAnalysisPrompt } = await import('./prompts/property/comprehensiveAnalysis.js');
                    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
                    const prompt = getComprehensiveAnalysisPrompt(_optimizeProperty(propData), _optimizeVisual(visualData || {}));
                    const result = await model.generateContent(prompt);
                    const text = result.response.text();

                    let compData = _extractJson(text);
                    compData = _normalizeComprehensiveData(compData);
                    await propRef.collection('analysis').doc('comprehensive').set({
                        ...compData,
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                    });
                    results[zpid] = { status: 'success' };
                } catch (e) {
                    console.error(`[Narrative Error] ${zpid}:`, e.message);
                    results[zpid] = { status: 'failed', message: e.message };
                }
            }));

            await change.after.ref.update({
                done: Object.values(results).filter(r => r.status === 'success').length,
                failed: Object.values(results).filter(r => r.status === 'failed').length,
                results
            });
        }

        await change.after.ref.update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return null;
    });

exports._processOneIntel = _processOneIntel;
