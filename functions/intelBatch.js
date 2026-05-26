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
const { _enrichEnvironmentalData, _extractJson, _enrichStreetInsights, _enrichNeighborhoodIdentity, ENV_SCHEMA_VERSION } = require('./shared/propertyUtils');
const UsageLogger = require('./shared/usageLogger');

const INTEL_CONCURRENCY = 5;
const DELAY_MS = 500;
const MAX_GALLERY_IMAGES = 15;
const MODEL_NAME = 'gemini-2.5-flash-lite';
const TIMEOUT_SAFETY_MARGIN_MS = 90000; // 90 seconds safety margin
const MAX_EXECUTION_TIME_MS = 540000; // 9 minutes

/**
 * Calls model.generateContent with one automatic retry on failure.
 * Returns { result, text } on success; throws on permanent failure.
 */
const _isTransientError = (e) => {
    const msg = String(e?.message || '').toLowerCase();
    // 400 errors are permanent client errors (bad image data, invalid request) — never retry
    if (msg.includes('400') || msg.includes('bad request') || msg.includes('unable to process input image')) return false;
    return (
        msg.includes('error fetching') ||
        msg.includes('fetch failed') ||
        msg.includes('network error') ||
        msg.includes('econnreset') ||
        msg.includes('econnrefused') ||
        msg.includes('etimedout') ||
        msg.includes('socket hang up') ||
        msg.includes('429') ||
        msg.includes('resource_exhausted') ||
        msg.includes('resource exhausted') ||
        msg.includes('503') ||
        msg.includes('service unavailable')
    );
};

async function _geminiCall(model, content, label) {
    const MAX_ATTEMPTS = 3;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
            if (attempt > 0) {
                const delay = Math.pow(2, attempt) * 2000 + Math.random() * 2000;
                console.log(`[Intel] Retrying ${label} (attempt ${attempt + 1}/${MAX_ATTEMPTS}) in ${Math.round(delay / 1000)}s...`);
                await new Promise(r => setTimeout(r, delay));
            }
            const result = await model.generateContent(content);
            const text = result.response.text();
            if (!text?.trim()) throw new Error('Empty response from Gemini');
            return { result, text };
        } catch (e) {
            const isTransient = _isTransientError(e);
            if (attempt < MAX_ATTEMPTS - 1 && isTransient) {
                console.warn(`[Intel] ${label} transient error (attempt ${attempt + 1}): ${e.message}`);
                continue;
            }
            throw e;
        }
    }
}

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
    const hasRooms = Array.isArray(visual.room_highlights) && visual.room_highlights.length > 0;
    // rooms are required unless the interior was well-described (photos likely all exterior — re-running won't help)
    const roomsOk = hasRooms || (hasDescription && hasInteriorSummary);
    return hasDescription && hasInteriorSummary && hasExterior && roomsOk;
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



// Gemini-supported image MIME types
const GEMINI_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);

function _mimeFromPath(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (ext === 'png')  return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'gif')  return 'image/gif';
    return 'image/jpeg';
}

async function _fetchImageAsBase64(url) {
    try {
        // Optimization: If it's a Firebase Storage URL, fetch directly from the bucket
        if (url.startsWith('gs://') || url.includes('firebasestorage.googleapis.com')) {
            try {
                const bucket = admin.storage().bucket();
                let filePath = '';

                if (url.startsWith('gs://')) {
                    filePath = url.split('/').slice(3).join('/');
                } else {
                    const pathPart = url.split('/o/')[1].split('?')[0];
                    filePath = decodeURIComponent(pathPart);
                }

                const [buffer] = await bucket.file(filePath).download();
                if (buffer.length < 1000) return null; // too small — likely an error stub
                // Validate magic bytes — reject HTML error pages or corrupt files
                const magic = buffer.slice(0, 4);
                const isJpeg = magic[0] === 0xFF && magic[1] === 0xD8;
                const isPng  = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47;
                const isWebp = magic[0] === 0x52 && magic[1] === 0x49 && magic[2] === 0x46 && magic[3] === 0x46;
                if (!isJpeg && !isPng && !isWebp) {
                    console.warn(`[Intel] Skipping non-image file in Storage (bad magic bytes): ${filePath}`);
                    return null;
                }
                const mimeType = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';
                return {
                    inlineData: {
                        data: buffer.toString('base64'),
                        mimeType,
                    }
                };
            } catch (e) {
                console.warn(`[Intel] Direct bucket download failed for ${url}, falling back to fetch:`, e.message);
            }
        }

        const response = await fetch(url);
        if (!response.ok) return null;

        const rawType = response.headers.get('content-type') || '';
        const mimeType = rawType.split(';')[0].trim() || 'image/jpeg';
        if (!GEMINI_IMAGE_TYPES.has(mimeType)) {
            console.warn(`[Intel] Skipping unsupported image type "${mimeType}": ${url}`);
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.length < 1000) return null; // too small — probably an error page
        return {
            inlineData: {
                data: buffer.toString('base64'),
                mimeType,
            }
        };
    } catch (e) {
        console.warn(`[Intel] Failed to fetch image ${url}:`, e.message);
        return null;
    }
}


/**
 * Re-downloads a gallery image from its original source URL and re-uploads to Firebase Storage,
 * replacing the corrupt file. Returns a Gemini-ready inlineData part on success, null on failure.
 */
async function _healGalleryImage(storageUrl, imageMetadata, bucket) {
    const originalUrl = imageMetadata?.[storageUrl]?.originalUrl;
    if (!originalUrl) return null;

    try {
        const response = await fetch(originalUrl);
        if (!response.ok) return null;

        const rawType = response.headers.get('content-type') || '';
        const mimeType = rawType.split(';')[0].trim() || 'image/jpeg';
        if (!GEMINI_IMAGE_TYPES.has(mimeType)) return null;

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.length < 1000) return null;

        // Validate magic bytes — content-type header can lie (e.g. Zillow error page)
        const magic = buffer.slice(0, 4);
        const isJpeg = magic[0] === 0xFF && magic[1] === 0xD8;
        const isPng  = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47;
        const isWebp = magic[0] === 0x52 && magic[1] === 0x49 && magic[2] === 0x46 && magic[3] === 0x46;
        if (!isJpeg && !isPng && !isWebp) {
            console.warn(`[Intel] Gallery heal: source image also corrupt (bad magic bytes): ${originalUrl}`);
            return null;
        }
        const validMime = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';

        // Derive the Storage path from the URL so we can overwrite the corrupt file
        let storagePath = null;
        if (storageUrl.includes('firebasestorage.googleapis.com') && storageUrl.includes('/o/')) {
            storagePath = decodeURIComponent(storageUrl.split('/o/')[1].split('?')[0]);
        } else if (storageUrl.startsWith('gs://')) {
            storagePath = storageUrl.split('/').slice(3).join('/');
        }

        if (storagePath) {
            await bucket.file(storagePath).save(buffer, {
                metadata: { contentType: validMime },
                resumable: false,
            });
            console.log(`[Intel] Healed corrupt image → ${storagePath}`);
        }

        return { inlineData: { data: buffer.toString('base64'), mimeType: validMime } };
    } catch (e) {
        console.warn(`[Intel] Heal failed for ${storageUrl}: ${e.message}`);
        return null;
    }
}

/**
 * Re-fetches a corrupt/missing context image from its original source API,
 * overwrites the bad Storage file, updates Firestore, and returns a Gemini-ready
 * inlineData part. Called when _fetchImageAsBase64 returns null for a context image.
 */
async function _healContextImage(zpid, label, propData, apiKeys, db) {
    const lat = propData.coordinates?.latitude;
    const lng = propData.coordinates?.longitude;
    if (!lat || !lng) return null;

    let sourceUrl = null;
    let storagePath = null;

    if (label === 'Street View') {
        const mapsKey = apiKeys.google_maps_key;
        if (!mapsKey) return null;
        const heading = propData.streetViewHeadingDeg ?? 0;
        sourceUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x640&location=${lat},${lng}&fov=80&heading=${heading}&pitch=0&key=${mapsKey}`;
        storagePath = `properties/${zpid}/maps/street_view.jpg`;
    } else if (label === 'Close-up Parcel Map') {
        const radarKey = apiKeys.radar_key;
        if (!radarKey) return null;
        sourceUrl = `https://api.radar.io/maps/static?publishableKey=${radarKey}&center=${lat},${lng}&zoom=20&width=2048&height=2048&style=radar-default-v1&scale=1&markers=color:0x000257%7C${lat},${lng}`;
        storagePath = `properties/${zpid}/maps/zoom_in.png`;
    } else if (label === 'Neighborhood Context Map') {
        const radarKey = apiKeys.radar_key;
        if (!radarKey) return null;
        sourceUrl = `https://api.radar.io/maps/static?publishableKey=${radarKey}&center=${lat},${lng}&zoom=15&width=1024&height=1024&style=radar-default-v1&scale=1&markers=color:0x000257%7C${lat},${lng}`;
        storagePath = `properties/${zpid}/maps/location_context.png`;
    } else if (label === 'Satellite/Radar Imagery') {
        const mapsKey = apiKeys.google_maps_key;
        if (!mapsKey) return null;
        const northLat = Math.round((lat + 0.00027) * 1e7) / 1e7;
        sourceUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=20&size=640x640&scale=2&maptype=satellite&markers=color:red%7Csize:tiny%7C${lat},${lng}&markers=color:blue%7Csize:tiny%7Clabel:N%7C${northLat},${lng}&key=${mapsKey}`;
        storagePath = `properties/${zpid}/maps/satellite.jpg`;
    }

    if (!sourceUrl || !storagePath) return null;

    try {
        console.log(`[Intel] Healing context image "${label}" for ${zpid}...`);
        const response = await fetch(sourceUrl);
        if (!response.ok) {
            console.warn(`[Intel] Heal fetch failed for "${label}" (${zpid}): HTTP ${response.status}`);
            return null;
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.length < 1000) return null;

        const magic = buffer.slice(0, 4);
        const isJpeg = magic[0] === 0xFF && magic[1] === 0xD8;
        const isPng  = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47;
        const isWebp = magic[0] === 0x52 && magic[1] === 0x49 && magic[2] === 0x46 && magic[3] === 0x46;
        if (!isJpeg && !isPng && !isWebp) {
            console.warn(`[Intel] Heal: re-fetched image is also corrupt for "${label}" (${zpid})`);
            return null;
        }
        const mimeType = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';

        // Force-overwrite the corrupt Storage file
        const bucket = admin.storage().bucket();
        await bucket.file(storagePath).save(buffer, {
            metadata: { contentType: mimeType },
            resumable: false,
        });

        const newUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media`;
        const propRef = db.collection('properties').doc(zpid);
        if (label === 'Street View') {
            // streetView: root doc is single source of truth
            await propRef.set({ streetView: newUrl }, { merge: true });
        } else {
            // Other context images: write to both root doc and assets
            const fieldMap = {
                'Close-up Parcel Map': 'mapZoomIn',
                'Neighborhood Context Map': 'mapZoomOut',
                'Satellite/Radar Imagery': 'satelliteImageUrl',
            };
            const field = fieldMap[label];
            if (field) {
                await Promise.all([
                    propRef.collection('analysis').doc('assets').set({ [field]: newUrl }, { merge: true }),
                    propRef.set({ [field]: newUrl }, { merge: true }),
                ]);
            }
        }
        console.log(`[Intel] Context image healed: "${label}" → ${storagePath}`);
        return { inlineData: { data: buffer.toString('base64'), mimeType } };
    } catch (e) {
        console.warn(`[Intel] Context image heal failed for "${label}" (${zpid}): ${e.message}`);
        return null;
    }
}

async function _processOneIntel(zpid, db, genAI, force = false, apiKeys = {}, logger = null) {
    const tStart = Date.now();
    const timings = {};
    try {
        if (logger) logger.logTask('total_processed');
        const propRef = db.collection('properties').doc(zpid);
        const analysisRef = propRef.collection('analysis');
        const envRef = propRef.collection('environmental').doc('thirdparty_data');

        let [propSnap, envSnap] = await Promise.all([
            propRef.get(),
            envRef.get()
        ]);

        // Property Data and Full Intel often run in parallel; the property doc may not
        // exist yet if Property Data is still writing. Retry once after a short delay
        // before giving up, so a race condition doesn't produce a permanent failure.
        if (!propSnap.exists) {
            await new Promise(r => setTimeout(r, 15000));
            propSnap = await propRef.get();
        }

        if (!propSnap.exists) return { status: 'failed', message: 'Property not found. Run "Full Property Data" first.' };
        const propData = propSnap.data();
        const envData = envSnap.exists ? envSnap.data() : null;

        // Skip land/lot properties — no interior photos, visual pass produces garbage
        const skipTypes = ['LOT', 'LAND', 'VACANT_LAND', 'LOT_LAND'];
        if (skipTypes.includes(propData.homeType?.toUpperCase())) {
            return { status: 'skipped', message: `Skipping LOT/LAND property (homeType=${propData.homeType})` };
        }

        // ─── Phase 1: Refresh Analysis Snaps ─────────────────────────────────
        const [visualSnap, investSnap, assetsSnap, insightsSnap, fitSnap] = await Promise.all([
            analysisRef.doc('visual').get(),
            analysisRef.doc('investment').get(),
            analysisRef.doc('assets').get(),
            analysisRef.doc('lifestyle_insights').get(),
            analysisRef.doc('lifestyle_fit').get(),
        ]);

        // ── Environmental Data Healing (Google APIs only, no RapidAPI) ────────
        // RapidAPI property data fetching belongs in propertyBatch.js, NOT here.
        // If property data is missing, the user should run "Get Property Data" first.
        const needsPollenAiHeal = !!(envData?.pollen && !envData.pollen?.analysis?.breathe_easy_summary);
        const needsEnvRefresh = !envData || _isStale(envData.lastUpdated)
            || (envData.__env_version || 0) < ENV_SCHEMA_VERSION
            || needsPollenAiHeal;

        console.log(`[Intel] Processing ${zpid}: needsEnv=${needsEnvRefresh}`);

        const tEnv0 = Date.now();
        let envResults = null;
        if (needsEnvRefresh) {
            if (logger) logger.logAPICall('google_maps', 'environmental_enrichment', zpid);
            envResults = await _enrichEnvironmentalData(
                zpid,
                db,
                apiKeys,
                propData.coordinates?.latitude,
                propData.coordinates?.longitude,
                logger
            );
        }
        // Always use the freshest env data for downstream prompts — merge enrichment results
        // over the snapshot so Lifestyle Fit sees the newly-fetched solar/AQ/pollen/noise data.
        const activeEnvData = envResults ? { ...envData, ...envResults } : envData;
        timings.environmental = Date.now() - tEnv0;

        // ── Neighborhood Identity Healing ─────────────────────────────────────
        const tNeigh0 = Date.now();
        const needsNeighborhoodId = !propData.neighborhood_identity?.resolved_name
            || propData.neighborhood_identity.resolved_name === 'Unknown';
        if (needsNeighborhoodId && propData.coordinates?.latitude && apiKeys.gemini_key) {
            await _enrichNeighborhoodIdentity(
                zpid, db,
                propData.address || propData.streetAddress,
                propData.city, propData.state,
                propData.coordinates.latitude, propData.coordinates.longitude,
                propData.description,
                apiKeys.gemini_key, logger
            );
        }
        timings.neighborhood_identity = Date.now() - tNeigh0;

        // ── Neighborhood Narrative Healing ────────────────────────────────────
        const tNarr0 = Date.now();
        const needsNarrative = !propData.neighborhood_narrative || propData.neighborhood_narrative.length < 50;
        if (needsNarrative && propData.address && apiKeys.gemini_key) {
            try {
                console.log(`[Intel] Generating neighborhood narrative for ${zpid}...`);
                const { getNeighborhoodNarrativePrompt } = await import('./prompts/property/neighborhoodNarrative.js');
                const narrativeModel = genAI.getGenerativeModel({
                    model: 'gemini-2.5-flash-lite',
                    generationConfig: { responseMimeType: 'application/json' }
                });
                const places = activeEnvData?.google_places || null;
                const prompt = getNeighborhoodNarrativePrompt(propData, places);
                const { result, text } = await _geminiCall(narrativeModel, prompt, `Neighborhood Narrative ${zpid}`);
                const narrativeData = _extractJson(text);
                if (narrativeData?.narrative && narrativeData.narrative.length > 20) {
                    await propRef.set({ neighborhood_narrative: narrativeData.narrative }, { merge: true });
                    if (logger) logger.logLLMCall('gemini-2.5-flash-lite', result.response.usageMetadata?.promptTokenCount, result.response.usageMetadata?.candidatesTokenCount, zpid, 'neighborhoodNarrative.js');
                    console.log(`[Intel] Neighborhood narrative saved for ${zpid}`);
                }
            } catch (e) {
                console.warn(`[Intel] Neighborhood narrative failed for ${zpid}:`, e.message);
            }
        }
        timings.neighborhood_narrative = Date.now() - tNarr0;

        const needsVisualRefresh = force || !visualSnap.exists || !_isVisualComplete(visualSnap.data()) || _isStale(visualSnap.data()?.lastUpdated);
        const needsInsightsRefresh = force || !insightsSnap.exists || _isStale(insightsSnap.data()?.lastUpdated);
        const needsFitRefresh = force || !fitSnap.exists || !_isFitComplete(fitSnap.data()) || _isStale(fitSnap.data()?.lastUpdated);
        const needsInvestRefresh = force || !investSnap.exists || _isStale(investSnap.data()?.lastUpdated);
        if (needsVisualRefresh) console.log(`[Intel] Refreshing Visual data for ${zpid} (force=${force}, exists=${visualSnap.exists}, stale=${_isStale(visualSnap.data()?.lastUpdated)}, incomplete=${!_isVisualComplete(visualSnap.data())})`);
        if (needsFitRefresh) console.log(`[Intel] Refreshing Fit data for ${zpid} (force=${force}, exists=${fitSnap.exists}, stale=${_isStale(fitSnap.data()?.lastUpdated)}, incomplete=${!_isFitComplete(fitSnap.data())})`);

        let visualData = visualSnap.exists ? visualSnap.data() : null;

        // 2. AI Visual Pass
        const tVisual0 = Date.now();
        if (needsVisualRefresh) {
            console.log(`[Intel] Running Visual Pass for ${zpid}...`);
            const assetData = assetsSnap.exists ? assetsSnap.data() : {};
            const galleryImages = assetData.images || [];

            // Limit gallery images to prevent memory crashes (191 props * 50 images = OOM)
            const limitedGallery = galleryImages.slice(0, MAX_GALLERY_IMAGES);

            // Build the list of all targets: Maps first for context, then gallery.
            // Prefer assets doc URLs (Storage); fall back to root prop doc (set by Orientation Batch).
            const contextImages = [
                { url: propData.streetView, label: 'Street View' },
                { url: assetData.mapZoomIn || propData.mapZoomIn, label: 'Close-up Parcel Map' },
                { url: assetData.mapZoomOut || propData.mapZoomOut, label: 'Neighborhood Context Map' },
                { url: assetData.satelliteImageUrl || propData.satelliteImageUrl, label: 'Satellite/Radar Imagery' }
            ].filter(img => !!img.url);

            const galleryTargets = limitedGallery.map(url => ({ url, label: 'Gallery Photo' }));
            const allTargets = [...contextImages, ...galleryTargets];

            const healBucket = admin.storage().bucket();
            const imageMetadata = assetData.imageMetadata || {};

            if (allTargets.length > 0) {
                const imageParts = await Promise.all(allTargets.map(async (target) => {
                    let base64 = await _fetchImageAsBase64(target.url);
                    if (!base64 && target.label === 'Gallery Photo') {
                        // Image missing or corrupt in Storage — attempt one heal from original source
                        base64 = await _healGalleryImage(target.url, imageMetadata, healBucket);
                    }
                    if (!base64 && target.label !== 'Gallery Photo') {
                        // Context image corrupt or missing — re-fetch from source API and overwrite Storage
                        base64 = await _healContextImage(zpid, target.label, propData, apiKeys, db);
                    }
                    if (!base64) return null;
                    return [
                        { text: `--- ${target.label} ---` },
                        base64
                    ];
                }));

                const validParts = imageParts.filter(p => p !== null).flat();

                if (validParts.length > 0) {
                    const { getPropertyImagesPrompt } = await import('./prompts/property/propertyImages.js');
                    const model = genAI.getGenerativeModel({
                        model: MODEL_NAME,
                        generationConfig: { responseMimeType: "application/json" }
                    });
                    const prompt = getPropertyImagesPrompt(propData);

                    // Helper: build context-only parts from Storage (lazy — only called on failure)
                    const buildContextOnlyParts = async () =>
                        (await Promise.all(contextImages.map(async (target) => {
                            const base64 = await _fetchImageAsBase64(target.url);
                            if (!base64) return null;
                            return [{ text: `--- ${target.label} ---` }, base64];
                        }))).filter(p => p !== null).flat();

                    let callResult;
                    try {
                        // Attempt 1: full set (context + gallery from Storage cache)
                        callResult = await _geminiCall(model, [{ text: prompt }, ...validParts], `Visual Pass ${zpid}`);
                    } catch (e) {
                        if (!(e.message?.includes('400') && e.message?.includes('image'))) throw e;

                        // Attempt 2: re-fetch gallery from original source URLs + context from Storage
                        console.warn(`[Intel] Visual Pass ${zpid}: bad image detected — re-fetching gallery from original source...`);
                        const contextParts = await buildContextOnlyParts();
                        const healedGalleryParts = (await Promise.all(limitedGallery.map(async (url) => {
                            const base64 = await _healGalleryImage(url, imageMetadata, healBucket);
                            if (!base64) return null;
                            return [{ text: '--- Gallery Photo ---' }, base64];
                        }))).filter(p => p !== null).flat();

                        try {
                            const healedFullParts = [...contextParts, ...healedGalleryParts];
                            if (healedFullParts.length === 0) throw e;
                            callResult = await _geminiCall(model, [{ text: prompt }, ...healedFullParts], `Visual Pass ${zpid} (healed-gallery)`);
                        } catch (e2) {
                            if (!(e2.message?.includes('400') && e2.message?.includes('image'))) throw e2;

                            // Attempt 3: context images only (drop all gallery)
                            if (contextParts.length === 0) throw e2;
                            console.warn(`[Intel] Visual Pass ${zpid}: gallery heal failed — retrying with context-only images`);
                            try {
                                callResult = await _geminiCall(model, [{ text: prompt }, ...contextParts], `Visual Pass ${zpid} (context-only)`);
                            } catch (e3) {
                                if (!(e3.message?.includes('400') && e3.message?.includes('image'))) throw e3;

                                // Attempt 4: force-heal context images from source APIs (bypasses cached Storage)
                                console.warn(`[Intel] Visual Pass ${zpid}: context-only also failed — force-healing context images from source...`);
                                const healedContextParts = (await Promise.all(contextImages.map(async (target) => {
                                    const healed = await _healContextImage(zpid, target.label, propData, apiKeys, db);
                                    if (healed) return [{ text: `--- ${target.label} ---` }, healed];
                                    return null;
                                }))).filter(p => p !== null).flat();

                                if (healedContextParts.length === 0) throw e3;
                                callResult = await _geminiCall(model, [{ text: prompt }, ...healedContextParts], `Visual Pass ${zpid} (healed-context)`);
                            }
                        }
                    }
                    const { result, text } = callResult;

                    if (logger) {
                        logger.logTask('visual_pass');
                        logger.logLLMCall(MODEL_NAME, result.response.usageMetadata?.promptTokenCount, result.response.usageMetadata?.candidatesTokenCount, zpid, 'propertyImages.js');
                    }
                    visualData = _normalizeVisualData(_extractJson(text));
                    await analysisRef.doc('visual').set({
                        ...visualData,
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                        version: 'batch-v2'
                    });
                }
            }
        }
        timings.visual_ai = Date.now() - tVisual0;

        // 2b. Street Insights healing: run only when visual pass didn't already handle it.
        // If visual pass ran AND had street view, insights come from the visual output — no re-download.
        // Only heal when: (a) visual pass was skipped (cached), OR (b) visual pass ran but prop had no street view URL.
        const tStreet0 = Date.now();
        const svUrlForInsights = propData.streetView;
        const hasStreetInsights = !!(visualData?.exterior_and_neighborhood?.neighborhood_street_insights?.length > 20);
        const visualPassHandledSv = needsVisualRefresh && !!propData.streetView;
        if (svUrlForInsights && !hasStreetInsights && !visualPassHandledSv) {
            try {
                await _enrichStreetInsights(zpid, db, apiKeys.gemini_key, svUrlForInsights, logger);
            } catch (e) {
                console.warn(`[Intel] Street insights healing failed for ${zpid}:`, e.message);
            }
        }
        timings.street_insights = Date.now() - tStreet0;

        // 3. Parallel Pass (Lifestyle Insights + Lifestyle Fit + Pollen AI)
        // Run these in parallel after Visual Pass is complete, BEFORE the slow Orientation pass.
        const tLifestyle0 = Date.now();
        const tasks = [];

        // 3b. Lifestyle Insights (Neighborhood focus)
        if (force || !insightsSnap.exists || _isStale(insightsSnap.data().lastUpdated)) {
            tasks.push((async () => {
                console.log(`[Intel] Running Lifestyle Insights for ${zpid}...`);
                const { getLifestyleInsightsPrompt } = await import('./prompts/property/lifestyleInsights.js');
                const model = genAI.getGenerativeModel({
                    model: MODEL_NAME,
                    generationConfig: { responseMimeType: "application/json" }
                });
                const prompt = getLifestyleInsightsPrompt(propData);
                const { result, text } = await _geminiCall(model, prompt, `Lifestyle Insights ${zpid}`);
                if (logger) {
                    logger.logTask('lifestyle_insights');
                    logger.logLLMCall(MODEL_NAME, result.response.usageMetadata?.promptTokenCount, result.response.usageMetadata?.candidatesTokenCount, zpid, 'lifestyleInsights.js');
                }
                const insightsData = _extractJson(text);
                await analysisRef.doc('lifestyle_insights').set({
                    ...insightsData,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                });
            })());
        }

        // 3c. Lifestyle Fit (Property focus)
        if (needsFitRefresh) {
            tasks.push((async () => {
                console.log(`[Intel] Running Lifestyle Fit for ${zpid}...`);
                const { getLifestyleFitPrompt } = await import('./prompts/property/lifestyleFit.js');
                const model = genAI.getGenerativeModel({
                    model: MODEL_NAME,
                    generationConfig: { responseMimeType: "application/json" }
                });
                const prompt = getLifestyleFitPrompt(
                    _optimizeProperty(propData),
                    _optimizeVisual(visualData || {}),
                    activeEnvData?.streetViewAnalysis || null,
                    activeEnvData || null,
                );
                const { result, text } = await _geminiCall(model, prompt, `Lifestyle Fit ${zpid}`);
                if (logger) {
                    logger.logTask('lifestyle_fit');
                    logger.logLLMCall(MODEL_NAME, result.response.usageMetadata?.promptTokenCount, result.response.usageMetadata?.candidatesTokenCount, zpid, 'lifestyleFit.js');
                }
                const fitData = _extractJson(text);
                await analysisRef.doc('lifestyle_fit').set({
                    ...fitData,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                });
            })());
        }

        if (tasks.length > 0) {
            await Promise.all(tasks);
        }
        timings.lifestyle = Date.now() - tLifestyle0;

        // 4. Investment Pass
        const tInvest0 = Date.now();
        if (force || !investSnap.exists || _isStale(investSnap.data().lastUpdated)) {
            console.log(`[Intel] Running Investment Pass for ${zpid}...`);
            const { getInvestmentResearchPrompt } = await import('./prompts/property/investmentResearch.js');
            const model = genAI.getGenerativeModel({
                model: MODEL_NAME,
                generationConfig: { responseMimeType: "application/json" }
            });
            const optProp = _optimizeProperty(propData);
            const prompt = getInvestmentResearchPrompt(optProp);
            const { result, text } = await _geminiCall(model, prompt, `Investment Pass ${zpid}`);
            if (logger) {
                logger.logTask('investment_pass');
                logger.logLLMCall(MODEL_NAME, result.response.usageMetadata?.promptTokenCount, result.response.usageMetadata?.candidatesTokenCount, zpid, 'investmentResearch.js');
            }
            const investmentData = _extractJson(text);
            await analysisRef.doc('investment').set({
                ...investmentData,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        timings.investment = Date.now() - tInvest0;
        timings.total = Date.now() - tStart;

        return {
            status: (needsVisualRefresh || force) ? 'success' : 'cached',
            zpid,
            message: (needsVisualRefresh || force) ? 'Analyzed (Fresh)' : 'Loaded from Cache',
            healed: {
                visual: needsVisualRefresh,
                environmental: needsEnvRefresh,
                scores: envResults?.__healed?.scores || false,
                parcel: envResults?.__healed?.parcel || false,
                satellite: envResults?.__healed?.satellite || false
            },
            timings
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
        try {
            const before = change.before.exists ? change.before.data() : null;
        const after = change.after.exists ? change.after.data() : null;

        if (!after) return null; // Deleted
        if (after.status !== 'queued') return null; // Only run when status is queued

        const startTime = Date.now();

        const jobData = after;
        if (jobData.status !== 'queued') return null;

        const jobId = context.params.jobId;
        const zpids = jobData.zpids || [];
        const concurrency = jobData.sequential ? 1 : INTEL_CONCURRENCY;
        const db = admin.firestore();
        const logger = new UsageLogger(change.after.ref);
        await logger.initialize();

        // Fetch API Keys
        const keysSnap = await db.collection('app_config').doc('api_keys').get();
        const keys = keysSnap.exists ? keysSnap.data() : {};
        const apiKeys = {
            rapidapi_key: keys.rapidapi_key || process.env.RAPIDAPI_KEY,
            rapidapi_host: keys.rapidapi_host || 'us-housing-market-data1.p.rapidapi.com',
            radar_key: keys.radar_key || process.env.RADAR_KEY,
            gemini_key: keys.gemini_key || process.env.GEMINI_API_KEY,
            google_maps_key: keys.google_maps_key || process.env.MAPS_API_KEY,
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
        for (let i = 0; i < sortedZpids.length; i += concurrency) {
            // Check for cancellation before each wave
            const freshJob = await change.after.ref.get();
            if (freshJob.exists && freshJob.data()?.status === 'cancelled') {
                console.log(`[Intel Batch] ${jobId} cancelled. Terminating.`);
                return null;
            }

            const waveNum = Math.floor(i / concurrency) + 1;
            const wave = sortedZpids.slice(i, i + concurrency);

            // Skip ZPIDs already in jobData.results
            const workChunk = wave.filter(zpid => !results[zpid]);
            const totalWaves = Math.ceil(sortedZpids.length / concurrency);

            if (workChunk.length === 0) {
                console.log(`[Intel Batch] Wave ${waveNum}/${totalWaves}: Skipping (already in results).`);
                continue;
            }

            console.log(`[Intel Batch] Wave ${waveNum}/${totalWaves}: Starting processing for ${workChunk.length} properties...`);
            
            // Update UI with working count
            await change.after.ref.update({ workingCount: workChunk.length });

            const batchResults = await Promise.allSettled(workChunk.map(async (zpid) => {
                // Check for cancellation before processing each property
                const freshJob = await change.after.ref.get();
                if (freshJob.exists && freshJob.data()?.status === 'cancelled') {
                    throw new Error('CANCELLED');
                }

                const res = await _processOneIntel(zpid, db, genAI, !!jobData.force, apiKeys, logger);
                return { zpid, ...res };
            }));

            // If cancelled mid-wave, terminate
            if (batchResults.some(r => r.status === 'rejected' && r.reason?.message === 'CANCELLED')) {
                console.log(`[Intel Batch] ${jobId} cancellation confirmed mid-wave. Terminating.`);
                return null;
            }

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
                workingCount: 0, // Reset after wave
                results,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Flush stats to Firestore
            await logger.flush();

            // ─── TIMEOUT SAFETY CHECK ───
            const elapsed = Date.now() - startTime;
            if (elapsed > (MAX_EXECUTION_TIME_MS - TIMEOUT_SAFETY_MARGIN_MS)) {
                console.warn(`[Intel Batch] Approaching timeout (${Math.round(elapsed / 1000)}s). Exiting wave loop to allow resumption.`);
                await change.after.ref.update({
                    status: 'queued', // Set back to queued to trigger a new run
                    workingCount: 0,
                    lastWaveAt: admin.firestore.FieldValue.serverTimestamp()
                });
                return null;
            }

            // 3. Gap between chunks — longer for sequential retries to ease rate pressure
            if (i + concurrency < sortedZpids.length) {
                await new Promise(resolve => setTimeout(resolve, concurrency === 1 ? 4000 : 2000));
            }
        }

        const finalResults = Object.values(results);
        const finalDone = finalResults.filter(r => r.status === 'success' || r.status === 'cached').length;
        const finalFailed = finalResults.filter(r => r.status === 'failed').length;

        await change.after.ref.update({
            status: 'completed',
            done: finalDone,
            failed: finalFailed,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return null;
        } catch (e) {
            console.error(`[Intel Batch Error] Job ${context.params.jobId} crashed:`, e);
            await change.after.ref.update({
                status: 'failed',
                error: e.message || 'Unknown internal crash',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return null;
        }
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
        try {
            const after = change.after.exists ? change.after.data() : null;
        if (!after || after.status !== 'queued') return null;

        const startTime = Date.now();
        const db = admin.firestore();
        const zpids = after.zpids || [];
        const keysSnap = await db.collection('app_config').doc('api_keys').get();
        const keys = keysSnap.exists ? keysSnap.data() : {};
        const genAI = new GoogleGenerativeAI(keys.gemini_key || process.env.GEMINI_API_KEY);
        const logger = new UsageLogger(change.after.ref);
        await logger.initialize();

        await change.after.ref.update({ status: 'running', startedAt: admin.firestore.FieldValue.serverTimestamp() });

        let results = after.results || {};
        const NARRATIVE_CONCURRENCY = 10;

        for (let i = 0; i < zpids.length; i += NARRATIVE_CONCURRENCY) {
            const wave = zpids.slice(i, i + NARRATIVE_CONCURRENCY);
            const workChunk = wave.filter(zpid => !results[zpid]);

            if (workChunk.length === 0) continue;

            // Update UI with working count
            await change.after.ref.update({ workingCount: workChunk.length });

            await Promise.all(workChunk.map(async (zpid) => {
                // Check for cancellation before processing each property
                const freshJob = await change.after.ref.get();
                if (freshJob.exists && freshJob.data()?.status === 'cancelled') {
                    return; // Stop processing this item
                }

                let text = '';
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
                    const model = genAI.getGenerativeModel({
                        model: MODEL_NAME,
                        generationConfig: { responseMimeType: "application/json" }
                    });
                    const prompt = getComprehensiveAnalysisPrompt(_optimizeProperty(propData), _optimizeVisual(visualData || {}));
                    const result = await model.generateContent(prompt);
                    text = result.response.text();

                    let compData = _extractJson(text);
                    compData = _normalizeComprehensiveData(compData);
                    await propRef.collection('analysis').doc('comprehensive').set({
                        ...compData,
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                    });
                    if (logger) {
                        logger.logTask('comprehensive_pass');
                        logger.logLLMCall(MODEL_NAME, result.response.usageMetadata?.promptTokenCount, result.response.usageMetadata?.candidatesTokenCount, zpid, 'comprehensiveAnalysis.js');
                    }
                    results[zpid] = { status: 'success' };
                } catch (e) {
                    console.error(`[Narrative Error] ${zpid} (JSON Parse Failed):`, e.message);
                    console.error(`[Narrative Raw Text] ${zpid}:`, text);
                    results[zpid] = { status: 'failed', message: e.message };
                }
            }));

            // Recalculate counts
            const currentResArr = Object.values(results);
            const newDone = currentResArr.filter(r => r.status === 'success' || r.status === 'cached').length;
            const newFailed = currentResArr.filter(r => r.status === 'failed').length;

            // Update progress in Firestore
            await change.after.ref.update({
                done: newDone,
                failed: newFailed,
                workingCount: 0, // Reset after wave
                results,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Flush stats
            await logger.flush();

            // ─── TIMEOUT SAFETY CHECK ───
            const elapsed = Date.now() - startTime;
            if (elapsed > (MAX_EXECUTION_TIME_MS - TIMEOUT_SAFETY_MARGIN_MS)) {
                console.warn(`[Narrative Batch] Approaching timeout (${Math.round(elapsed / 1000)}s). Exiting wave loop to allow resumption.`);
                await change.after.ref.update({
                    status: 'queued', 
                    workingCount: 0,
                    lastWaveAt: admin.firestore.FieldValue.serverTimestamp()
                });
                return null;
            }
        }

        const finalResultsArr = Object.values(results);
        const finalDoneCount = finalResultsArr.filter(r => r.status === 'success').length;
        const finalFailedCount = finalResultsArr.filter(r => r.status === 'failed').length;

        await change.after.ref.update({
            status: 'completed',
            done: finalDoneCount,
            failed: finalFailedCount,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return null;
        } catch (e) {
            console.error(`[Narrative Batch Error] Job ${context.params.jobId} crashed:`, e);
            await change.after.ref.update({
                status: 'failed',
                error: e.message || 'Unknown internal crash',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return null;
        }
    });

exports._processOneIntel = _processOneIntel;
