'use strict';
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { fetchScores } = require('./walkscore');
const { fetchParcelFromCounty } = require('./arcgisParcels');
const { calculateZypheNoiseScore, fetchCityBoundary, computeCityNoiseGridRaw } = require('./osmNoise');
const { isSupportedState } = require('./config');

// Bump this whenever a new field is added to _enrichEnvironmentalData so that
// cached env docs from before the field was introduced get re-enriched automatically.
// v2: noise, broadband, drought, EV, seismic/historical disasters, nearby places
// v3: solar, air quality, pollen (retry if missing — API may have failed at original fetch time)
const ENV_SCHEMA_VERSION = 3;

// ─── Gemini tax record schema ────────────────────────────────────────────────
const TAX_RECORD_LOOKUP_SCHEMA = {
    type: 'object',
    properties: {
        tax_sqft: { type: 'number', description: 'Living area from tax records in sqft' },
        tax_year_built: { type: 'number', description: 'Year built from tax records' },
        tax_lot_sqft: { type: 'number', description: 'Lot size from tax records in sqft' },
        source: { type: 'string', description: 'Source of the data' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    },
    required: ['tax_sqft', 'source', 'confidence'],
};

const TAX_RECORD_LOOKUP_PROMPT = (address) => `Task: Find the **official Living Area (Total Finished Area)** from county TAX/ASSESSOR RECORDS for this property.

Property: ${address}

Instructions:
1. Use Google Search to find the TAX RECORD / ASSESSOR RECORD for this property. Try these sources IN ORDER:
   a. County Assessor / Tax Assessor website
   b. Redfin "Public Facts" section
   c. Zillow "Public Facts" or "Home Facts"
   d. Realtor.com property details

2. Extract the "Total Living Area", "Finished Area", "Building Area", or "Gross Living Area" from the TAX RECORD.
   - This is the OFFICIAL public record value, NOT the listing/MLS square footage.
   - If the tax record says 912 but the listing says 1,812 — return 912.
   - If you cannot find a tax record value from ANY source, return null.

3. Also extract the year built and lot size from tax records if available.

Return ONLY valid JSON:
{
  "tax_sqft": number or null,
  "tax_year_built": number or null,
  "tax_lot_sqft": number or null,
  "source": "string",
  "confidence": "high" | "medium" | "low"
}`;

function extractNumericValue(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    const cleaned = String(val).replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

/**
 * Fetches environmental data (Solar, Air Quality, Pollen, Noise)
 */
async function _enrichEnvironmentalData(zpid, db, keys, lat, lng, logger = null, city = null, state = null) {
    const MAPS_API_KEY = keys.google_maps_key;
    const envRef = db.collection('properties').doc(zpid).collection('environmental').doc('thirdparty_data');
    const envSnap = await envRef.get();
    const existing = envSnap.exists ? envSnap.data() : null;
    const force = keys?.bypassCache === true;

    // Check TTL (30 days)
    if (!force && existing && existing.lastUpdated) {
        const ms = existing.lastUpdated.toMillis ? existing.lastUpdated.toMillis() : new Date(existing.lastUpdated).getTime();
        const ageDays = (Date.now() - ms) / (24 * 60 * 60 * 1000);
        if (ageDays < 30) {
            console.log(`[Enrichment] Using cached environmental data for ${zpid} (Age: ${Math.round(ageDays)} days)`);
            // Heal missing pollen AI even when env data is fresh
            if (existing.pollen && !existing.pollen.analysis?.breathe_easy_summary && keys.gemini_key) {
                try {
                    const { getPollenAnalysisPrompt, POLLEN_ANALYSIS_SCHEMA } = require('../prompts/property/pollenAnalysis.js');
                    const genAI = new GoogleGenerativeAI(keys.gemini_key);
                    const pollenModel = genAI.getGenerativeModel({
                        model: 'gemini-2.5-flash-lite',
                        generationConfig: { responseMimeType: 'application/json', responseSchema: POLLEN_ANALYSIS_SCHEMA }
                    });
                    const pollenContext = {
                        dominantPollenType: existing.pollen.dominantPollenType,
                        overallScore: existing.pollen.score,
                        category: existing.pollen.category,
                        pollenTypes: existing.pollen.pollenTypes || []
                    };
                    const pollenResult = await pollenModel.generateContent(getPollenAnalysisPrompt(pollenContext));
                    if (logger) {
                        logger.logTask('pollen_ai_heal');
                        logger.logLLMCall('gemini-2.5-flash', pollenResult.response.usageMetadata?.promptTokenCount, pollenResult.response.usageMetadata?.candidatesTokenCount, zpid, 'pollenAnalysis.js');
                    }
                    const pollenAnalysis = _extractJson(pollenResult.response.text());
                    if (pollenAnalysis?.breathe_easy_summary) {
                        await envRef.update({ 'pollen.analysis': pollenAnalysis });
                        existing.pollen.analysis = pollenAnalysis;
                        console.log(`[Enrichment] Pollen AI healed for ${zpid}`);
                    } else {
                        console.warn(`[Enrichment] Pollen AI heal produced no breathe_easy_summary for ${zpid}:`, JSON.stringify(pollenAnalysis));
                    }
                } catch (e) {
                    console.warn(`[Enrichment] Pollen AI healing failed for ${zpid}:`, e.message);
                }
            }

            // Back-fill any supplemental fields that are missing — either because the schema
            // version is old, OR because an individual API call failed at original fetch time.
            const docVersion = existing.__env_version || 0;
            const hasAnyMissingField =
                !existing.zypheNoiseScore || !existing.broadband || !existing.google_places ||
                !existing.drought || !existing.evChargers || !existing.historical_disasters?.seismicZone ||
                !existing.solarData || !existing.airQuality || !existing.pollen || !existing.faults;
            if (docVersion < ENV_SCHEMA_VERSION || hasAnyMissingField) {
                console.log(`[Enrichment] Schema v${docVersion}, missing fields=${hasAnyMissingField} — running supplemental enrichments for ${zpid}`);
                try {
                    const femaNriSnap = await db.collection('properties').doc(zpid)
                        .collection('environmental').doc('fema_nri').get();
                    await Promise.all([
                        !existing.zypheNoiseScore ? (async () => {
                            const noiseResult = await calculateZypheNoiseScore(lat, lng);
                            if (noiseResult) {
                                await envRef.update({
                                    zypheNoiseScore: noiseResult.score,
                                    noiseCharacterization: noiseResult.characterization,
                                    primaryNoiseSource: noiseResult.primarySource,
                                    noiseSimulationFetchedAt: new Date().toISOString(),
                                });
                            }
                        })() : Promise.resolve(),
                        !existing.google_places ? _enrichNearbyPlaces(zpid, db, lat, lng, MAPS_API_KEY) : Promise.resolve(),
                        !existing.broadband ? _enrichBroadband(zpid, db, lat, lng) : Promise.resolve(),
                        !existing.drought ? _enrichDrought(zpid, db, lat, lng) : Promise.resolve(),
                        !existing.evChargers ? _enrichEVChargers(zpid, db, lat, lng) : Promise.resolve(),
                        !existing.faults ? _enrichFaults(zpid, db, lat, lng) : Promise.resolve(),
                        (!existing.historical_disasters?.seismicZone || !femaNriSnap.exists)
                            ? _enrichHistoricalDisasters(zpid, db, lat, lng) : Promise.resolve(),
                        // v3: retry solar/AQ/pollen if they were missing at original fetch time
                        !existing.solarData ? (async () => {
                            try {
                                const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${MAPS_API_KEY}`;
                                const res = await fetch(url);
                                if (res.ok) {
                                    const data = await res.json();
                                    if (data.solarPotential) {
                                        await envRef.update({
                                            solarData: {
                                                maxSunshineHoursPerYear: data.solarPotential.maxSunshineHoursPerYear,
                                                carbonOffsetFactorKgPerMwh: data.solarPotential.carbonOffsetFactorKgPerMwh,
                                                panelCapacityWatts: data.solarPotential.panelCapacityWatts,
                                                maxArrayPanelsCount: (data.solarPotential.solarPanels || []).length,
                                            }
                                        });
                                    }
                                } else if (res.status === 404) {
                                    await envRef.update({ solarData: { unavailable: true } });
                                }
                            } catch (e) { console.warn(`[Enrichment] Solar backfill failed for ${zpid}:`, e.message); }
                        })() : Promise.resolve(),
                        !existing.airQuality ? (async () => {
                            try {
                                const url = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${MAPS_API_KEY}`;
                                const res = await fetch(url, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ location: { latitude: lat, longitude: lng }, languageCode: 'en' })
                                });
                                if (res.ok) {
                                    const data = await res.json();
                                    const uaqi = data.indexes?.find(idx => idx.code === 'uaqi') || data.indexes?.[0];
                                    if (uaqi) {
                                        const aqData = { aqi: uaqi.aqi, category: uaqi.category };
                                        if (data.dominantPollutant !== undefined) aqData.dominantPollutant = data.dominantPollutant;
                                        await envRef.update({ airQuality: aqData });
                                    }
                                }
                            } catch (e) { console.warn(`[Enrichment] Air Quality backfill failed for ${zpid}:`, e.message); }
                        })() : Promise.resolve(),
                        !existing.pollen ? (async () => {
                            try {
                                const url = `https://pollen.googleapis.com/v1/forecast:lookup?key=${MAPS_API_KEY}&location.latitude=${lat}&location.longitude=${lng}&days=1`;
                                const res = await fetch(url);
                                if (res.ok) {
                                    const data = await res.json();
                                    const today = data.dailyInfo?.[0];
                                    if (today) {
                                        const maxPollen = today.pollenTypeInfo?.reduce((prev, current) =>
                                            (prev.indexInfo?.value || 0) > (current.indexInfo?.value || 0) ? prev : current);
                                        await envRef.update({
                                            pollen: {
                                                score: maxPollen?.indexInfo?.value ?? null,
                                                category: maxPollen?.indexInfo?.category ?? null,
                                                dominantPollenType: maxPollen?.displayName ?? null,
                                            }
                                        });
                                    }
                                }
                            } catch (e) { console.warn(`[Enrichment] Pollen backfill failed for ${zpid}:`, e.message); }
                        })() : Promise.resolve(),
                    ]);
                    await envRef.update({ __env_version: ENV_SCHEMA_VERSION });
                    console.log(`[Enrichment] Supplemental enrichments complete for ${zpid}`);
                } catch (e) {
                    console.warn(`[Enrichment] Supplemental enrichment failed for ${zpid}:`, e.message);
                }
            }

            return existing;
        }
    }

    const results = {
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        __env_version: ENV_SCHEMA_VERSION,
    };

    // 1. Solar
    try {
        if (logger) logger.logAPICall('google_maps', 'solar', zpid);
        const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${MAPS_API_KEY}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data.solarPotential) {
                results.solarData = {
                    maxSunshineHoursPerYear: data.solarPotential.maxSunshineHoursPerYear,
                    carbonOffsetFactorKgPerMwh: data.solarPotential.carbonOffsetFactorKgPerMwh,
                    panelCapacityWatts: data.solarPotential.panelCapacityWatts,
                    maxArrayPanelsCount: (data.solarPotential.solarPanels || []).length
                };
            } else {
                console.warn(`[Enrichment] Solar ok but no potential for ${zpid}`);
            }
        } else if (res.status === 404) {
            results.solarData = { unavailable: true };
        } else {
            console.warn(`[Enrichment] Solar failed for ${zpid}: ${res.status} ${res.statusText}`);
        }
    } catch (e) { console.warn(`[Enrichment] Solar failed for ${zpid}:`, e.message); }

    // 2. Air Quality
    try {
        if (logger) logger.logAPICall('google_maps', 'air_quality', zpid);
        const url = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${MAPS_API_KEY}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location: { latitude: lat, longitude: lng },
                languageCode: 'en'
            })
        });
        if (res.ok) {
            const data = await res.json();
            const uaqi = data.indexes?.find(idx => idx.code === 'uaqi') || data.indexes?.[0];
            const aqData = { aqi: uaqi?.aqi, category: uaqi?.category };
            if (data.dominantPollutant !== undefined) aqData.dominantPollutant = data.dominantPollutant;
            results.airQuality = aqData;
        } else {
            console.warn(`[Enrichment] Air Quality failed for ${zpid}: ${res.status} ${res.statusText}`);
        }
    } catch (e) { console.warn(`[Enrichment] Air Quality failed for ${zpid}:`, e.message); }

    // 3. Pollen
    try {
        if (logger) logger.logAPICall('google_maps', 'pollen', zpid);
        const url = `https://pollen.googleapis.com/v1/forecast:lookup?key=${MAPS_API_KEY}&location.latitude=${lat}&location.longitude=${lng}&days=1`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            const today = data.dailyInfo?.[0];
            if (today) {
                const maxPollen = today.pollenTypeInfo?.reduce((prev, current) => {
                    return (prev.indexInfo?.value || 0) > (current.indexInfo?.value || 0) ? prev : current;
                });
                results.pollen = {
                    score: maxPollen?.indexInfo?.value ?? null,
                    category: maxPollen?.indexInfo?.category ?? null,
                    dominantPollenType: maxPollen?.displayName ?? null
                };

                // Run AI analysis immediately while we have pollen context
                if (keys.gemini_key) {
                    try {
                        const pollenContext = {
                            dominantPollenType: maxPollen?.displayName,
                            overallScore: maxPollen?.indexInfo?.value,
                            category: maxPollen?.indexInfo?.category,
                            pollenTypes: today.pollenTypeInfo?.map(p => ({
                                type: p.displayName ?? null,
                                inSeason: p.inSeason ?? null,
                                indexValue: p.indexInfo?.value ?? null,
                                indexCategory: p.indexInfo?.category ?? null
                            })) || []
                        };
                        const { getPollenAnalysisPrompt, POLLEN_ANALYSIS_SCHEMA } = require('../prompts/property/pollenAnalysis.js');
                        const genAI = new GoogleGenerativeAI(keys.gemini_key);
                        const pollenModel = genAI.getGenerativeModel({
                            model: 'gemini-2.5-flash-lite',
                            generationConfig: { responseMimeType: 'application/json', responseSchema: POLLEN_ANALYSIS_SCHEMA }
                        });
                        const pollenResult = await pollenModel.generateContent(getPollenAnalysisPrompt(pollenContext));
                        if (logger) {
                            logger.logTask('pollen_ai');
                            logger.logLLMCall('gemini-2.5-flash', pollenResult.response.usageMetadata?.promptTokenCount, pollenResult.response.usageMetadata?.candidatesTokenCount, zpid, 'pollenAnalysis.js');
                        }
                        const pollenAnalysis = _extractJson(pollenResult.response.text());
                        if (pollenAnalysis?.breathe_easy_summary) {
                            results.pollen.analysis = pollenAnalysis;
                        }
                    } catch (e) {
                        console.warn(`[Enrichment] Pollen AI failed for ${zpid}:`, e.message);
                    }
                }
            }
        }
    } catch (e) { console.warn(`[Enrichment] Pollen failed for ${zpid}:`, e.message); }

    // 4. Noise Score (Zyphe OSM simulation)
    try {
        if (logger) logger.logAPICall('osm_overpass', 'noise_simulation', zpid);
        const noiseResult = await calculateZypheNoiseScore(lat, lng);
        if (noiseResult) {
            results.zypheNoiseScore = noiseResult.score;
            results.noiseCharacterization = noiseResult.characterization;
            results.primaryNoiseSource = noiseResult.primarySource;
            results.noiseSimulationFetchedAt = new Date().toISOString();
        }
    } catch (e) { console.warn(`[Enrichment] Noise simulation failed for ${zpid}:`, e.message); }

    // Commute Destinations (Gemini + Google Maps Distance Matrix)
    if (city && state && keys.gemini_key && keys.google_maps_key) {
        try {
            if (logger) logger.logAPICall('gemini', 'commute_destinations', zpid);
            const { getCommuteDestinationsPrompt, commuteDestinationsSchema } = await import('../prompts/property/commuteDestinations.js');
            const genAI = new GoogleGenerativeAI(keys.gemini_key);
            const commuteModel = genAI.getGenerativeModel({
                model: 'gemini-2.5-flash-lite',
                generationConfig: { responseMimeType: 'application/json', responseSchema: commuteDestinationsSchema }
            });
            const commuteResult = await commuteModel.generateContent(getCommuteDestinationsPrompt({ city, state }));
            if (logger) logger.logLLMCall('gemini-2.5-flash-lite', commuteResult.response.usageMetadata?.promptTokenCount, commuteResult.response.usageMetadata?.candidatesTokenCount, zpid, 'commuteDestinations.js');
            const commuteData = _extractJson(commuteResult.response.text());
            const destinations = commuteData?.destinations || [];
            if (destinations.length > 0) {
                const destStrings = destinations.map(d => d.search_query).join('|');
                const dmUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(`${lat},${lng}`)}&destinations=${encodeURIComponent(destStrings)}&departure_time=now&traffic_model=best_guess&key=${keys.google_maps_key}`;
                const dmRes = await fetch(dmUrl);
                const dmData = await dmRes.json();
                const COLORS = ['#0ea5e9', '#16a34a', '#d97706', '#6366f1'];
                results.commuteDestinations = destinations.map((d, i) => {
                    const element = dmData.rows?.[0]?.elements?.[i];
                    const timeSec = element?.duration_in_traffic?.value || element?.duration?.value;
                    const distMeters = element?.distance?.value;
                    return {
                        name: d.name,
                        description: d.description,
                        timeMin: timeSec ? Math.round(timeSec / 60) : null,
                        distanceMi: distMeters ? Math.round((distMeters / 1609.34) * 10) / 10 : null,
                        color: COLORS[i % COLORS.length],
                    };
                });
                results.commuteFetchedAt = new Date().toISOString();
            }
        } catch (e) { console.warn(`[Enrichment] Commute destinations failed for ${zpid}:`, e.message); }
    }

    console.log(`  ✅ Environmental saved for ${zpid}: ${Object.keys(results).join(', ')}`);
    await envRef.set(results, { merge: true });

    // Fetch supplemental environmental data (all idempotent — skip if already present)
    try {
        const [existingEnv, femaNriSnap] = await Promise.all([
            envRef.get(),
            db.collection('properties').doc(zpid).collection('environmental').doc('fema_nri').get()
        ]);
        const envData = existingEnv.exists ? existingEnv.data() : {};
        await Promise.all([
            // Run historical disasters if: forced, seismic data missing, OR dedicated fema_nri doc absent.
            // The old check (thirdparty_data.historical_disasters.femaRiskIndex) is intentionally dropped —
            // FEMA NRI now lives in fema_nri and may never have been backfilled for older properties.
            (force || !envData.historical_disasters?.seismicZone || !femaNriSnap.exists) ? _enrichHistoricalDisasters(zpid, db, lat, lng) : Promise.resolve(),
            !envData.google_places ? _enrichNearbyPlaces(zpid, db, lat, lng, MAPS_API_KEY) : Promise.resolve(),
            !envData.broadband ? _enrichBroadband(zpid, db, lat, lng) : Promise.resolve(),
            !envData.drought ? _enrichDrought(zpid, db, lat, lng) : Promise.resolve(),
            !envData.evChargers ? _enrichEVChargers(zpid, db, lat, lng) : Promise.resolve(),
            !envData.faults ? _enrichFaults(zpid, db, lat, lng) : Promise.resolve(),
        ]);
        await envRef.update({ __env_version: ENV_SCHEMA_VERSION });
    } catch (e) {
        console.warn(`[Enrichment] Supplemental environmental enrichment failed for ${zpid}:`, e.message);
    }

    const healed = {
        scores: false,
        parcel: false,
        satellite: false
    };

    // 5. NEW: Heal missing Walk Score, Parcel, and Satellite (on the main doc)
    try {
        const propRef = db.collection('properties').doc(zpid);
        const propSnap = await propRef.get();
        const propData = propSnap.exists ? propSnap.data() : {};

        const isStorageUrl = url => !!(url && (url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com')));

        if (!propData.walkScore || !propData.transitScore) {
            console.log(`[Enrichment] Healing missing scores for ${zpid}`);
            await _enrichWalkScore(zpid, db, keys, logger);
            healed.scores = true;
        }
        if (!propData.parcelPolygon) {
            console.log(`[Enrichment] Healing missing parcel for ${zpid}`);
            await _enrichParcelData(zpid, db, lat, lng, logger);
            healed.parcel = true;
        }
        // Re-fetch satellite if missing OR if existing URL is not a persistent Storage URL
        if (!isStorageUrl(propData.satelliteImageUrl)) {
            console.log(`[Enrichment] ${propData.satelliteImageUrl ? 'Moving satellite to Storage' : 'Healing missing satellite'} for ${zpid}`);
            await _enrichSatelliteImage(zpid, db, keys, lat, lng, logger);
            healed.satellite = true;
        }
        // Fetch map zoom images from Radar if missing or not in Storage (no CF ever fetched these before)
        if (!isStorageUrl(propData.mapZoomIn) || !isStorageUrl(propData.mapZoomOut)) {
            console.log(`[Enrichment] Fetching map zoom images for ${zpid}`);
            await _fetchAndStoreMapZooms(zpid, db, lat, lng, keys.radar_key);
        }
        // Mirror any storage URLs to assets doc
        await _healMapImages(zpid, db, logger);
    } catch (e) {
        console.warn(`[Enrichment] Healing step failed for ${zpid}:`, e.message);
    }

    const finalSnap = await envRef.get();
    return { ...finalSnap.data(), __healed: healed };
}

/**
 * Fetches Walk/Transit scores from RapidAPI
 */
async function _enrichWalkScore(zpid, db, keys, logger = null) {
    const scores = await fetchScores(zpid, keys, logger);
    if (scores) {
        await db.collection('properties').doc(zpid).set(scores, { merge: true });
        return scores;
    }
    return null;
}

/**
 * Fetches Parcel data from ArcGIS
 */
async function _enrichParcelData(zpid, db, lat, lng, logger = null) {
    const parcel = await fetchParcelFromCounty(lat, lng);
    if (parcel) {
        const payload = {
            parcelPolygon: parcel.polygon,
            parcelApn: parcel.apn,
            parcelAreaSqft: parcel.areaSqft,
            parcelCounty: parcel.county,
            parcelFetchedAt: new Date().toISOString()
        };
        if (parcel.buildingSqft) {
            payload.taxSqft = parcel.buildingSqft;
            payload.taxSqftSource = `ArcGIS ${parcel.county}`;
        }
        await db.collection('properties').doc(zpid).set(payload, { merge: true });
        return parcel;
    }
    // ArcGIS was called but returned no parcel record — mark as source-confirmed not found
    // so the smoke test can classify this as sourceNull instead of a pipeline gap.
    await db.collection('properties').doc(zpid).set({
        parcelNotFound: true,
        parcelFetchedAt: new Date().toISOString(),
    }, { merge: true });
    return null;
}

/**
 * Downloads a remote image URL and uploads it to Firebase Storage using the Admin SDK.
 * Returns the persistent Firebase Storage HTTPS URL, or null on failure.
 */
async function _secureImageToStorage(remoteUrl, storagePath) {
    try {
        const bucket = admin.storage().bucket();
        const file = bucket.file(storagePath);

        // Skip if already uploaded (idempotent)
        const [exists] = await file.exists();
        if (exists) {
            return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media`;
        }

        const response = await fetch(remoteUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${remoteUrl}`);
        const buffer = await response.arrayBuffer();
        await file.save(Buffer.from(buffer), {
            metadata: { contentType: 'image/jpeg', metadata: { originalUrl: remoteUrl } }
        });
        return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media`;
    } catch (e) {
        console.warn(`[Enrichment] _secureImageToStorage failed for ${storagePath}:`, e.message);
        return null;
    }
}

/**
 * Fetches and caches Satellite image — uploads to Firebase Storage so it's persistent.
 */
async function _enrichSatelliteImage(zpid, db, keys, lat, lng, logger = null) {
    const MAPS_API_KEY = keys.google_maps_key;
    if (!MAPS_API_KEY) {
        console.warn(`[Enrichment] Missing Google Maps API key for satellite fetch`);
        return null;
    }

    const northLat = Math.round((lat + 0.00027) * 1e7) / 1e7;
    const aerialUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=20&size=640x640&scale=2&maptype=satellite&markers=color:red%7Csize:tiny%7C${lat},${lng}&markers=color:blue%7Csize:tiny%7Clabel:N%7C${northLat},${lng}&key=${MAPS_API_KEY}`;

    const storageUrl = await _secureImageToStorage(aerialUrl, `properties/${zpid}/maps/satellite.jpg`);
    const finalUrl = storageUrl || aerialUrl;

    const propRef = db.collection('properties').doc(zpid);
    await Promise.all([
        propRef.set({ satelliteImageUrl: finalUrl }, { merge: true }),
        propRef.collection('analysis').doc('assets').set({ satelliteImageUrl: finalUrl }, { merge: true })
    ]);
    return { satelliteImageUrl: finalUrl };
}

/**
 * Fetches Radar Maps Static zoom-in/out images and uploads to Firebase Storage.
 * Mirrors what the browser-side geocoding service does — no CF was previously doing this.
 */
async function _fetchAndStoreMapZooms(zpid, db, lat, lng, radarKey) {
    if (!radarKey || lat == null || lng == null) return;
    try {
        const zoomInUrl = `https://api.radar.io/maps/static?publishableKey=${radarKey}&center=${lat},${lng}&zoom=20&width=2048&height=2048&style=radar-default-v1&scale=1&markers=color:0x000257%7C${lat},${lng}`;
        const zoomOutUrl = `https://api.radar.io/maps/static?publishableKey=${radarKey}&center=${lat},${lng}&zoom=15&width=1024&height=1024&style=radar-default-v1&scale=1&markers=color:0x000257%7C${lat},${lng}`;

        const [zoomInStorage, zoomOutStorage] = await Promise.all([
            _secureImageToStorage(zoomInUrl, `properties/${zpid}/maps/zoom_in.png`),
            _secureImageToStorage(zoomOutUrl, `properties/${zpid}/maps/location_context.png`),
        ]);

        const updates = {};
        if (zoomInStorage) updates.mapZoomIn = zoomInStorage;
        if (zoomOutStorage) updates.mapZoomOut = zoomOutStorage;

        if (Object.keys(updates).length > 0) {
            const propRef = db.collection('properties').doc(zpid);
            await Promise.all([
                propRef.set(updates, { merge: true }),
                propRef.collection('analysis').doc('assets').set(updates, { merge: true })
            ]);
            console.log(`[Enrichment] Map zooms stored for ${zpid}: ${Object.keys(updates).join(', ')}`);
        }
    } catch (e) {
        console.warn(`[Enrichment] Map zoom fetch failed for ${zpid}:`, e.message);
    }
}

/**
 * Heals missing map zoom images (Radar URLs → Firebase Storage) for the assets doc.
 */
async function _healMapImages(zpid, db, logger = null) {
    try {
        const propRef = db.collection('properties').doc(zpid);
        const assetsRef = propRef.collection('analysis').doc('assets');

        const [propSnap, assetsSnap] = await Promise.all([propRef.get(), assetsRef.get()]);
        const propData = propSnap.exists ? propSnap.data() : {};
        const assetsData = assetsSnap.exists ? assetsSnap.data() : {};

        const isStorage = url => !!(url && (url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com')));

        const updates = {};
        const propUpdates = {};

        if (!isStorage(assetsData.mapZoomIn) && propData.mapZoomIn) {
            const url = await _secureImageToStorage(propData.mapZoomIn, `properties/${zpid}/maps/zoom_in.png`);
            if (url) { updates.mapZoomIn = url; propUpdates.mapZoomIn = url; }
        }
        if (!isStorage(assetsData.mapZoomOut) && propData.mapZoomOut) {
            const url = await _secureImageToStorage(propData.mapZoomOut, `properties/${zpid}/maps/location_context.png`);
            if (url) { updates.mapZoomOut = url; propUpdates.mapZoomOut = url; }
        }

        if (Object.keys(updates).length > 0) {
            console.log(`[Enrichment] Healing map images for ${zpid}: ${Object.keys(updates).join(', ')}`);
            await Promise.all([
                assetsRef.set(updates, { merge: true }),
                propRef.set(propUpdates, { merge: true })
            ]);
        }
    } catch (e) {
        console.warn(`[Enrichment] Map image healing failed for ${zpid}:`, e.message);
    }
}

/**
 * Fetches seismic zone + earthquake history from USGS (free, no key).
 * Saves to environmental/thirdparty_data as historical_disasters.
 */
async function _enrichHistoricalDisasters(zpid, db, lat, lng) {
    try {
        const now = new Date();
        const startDate = `${now.getFullYear() - 2}-01-01`;

        const [seismicRes, quakeRes, nriData] = await Promise.all([
            fetch(`https://earthquake.usgs.gov/ws/designmaps/asce7-22.json?latitude=${lat}&longitude=${lng}&riskCategory=II&siteClass=D&title=query`),
            fetch(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat}&longitude=${lng}&maxradiuskm=8&minmagnitude=3.0&starttime=${startDate}&orderby=time&limit=50`),
            _fetchFemaRiskIndex(lat, lng)
        ]);

        let seismicZone = null;
        if (seismicRes.ok) {
            const d = await seismicRes.json();
            const sdc = d?.response?.data?.sdc ?? '';
            const pga = d?.response?.data?.pga ?? 0;
            const ss = d?.response?.data?.ss ?? 0;
            const s1 = d?.response?.data?.s1 ?? 0;
            let riskLevel = 'low';
            if (sdc === 'D' || sdc === 'E' || sdc === 'F') riskLevel = 'very_high';
            else if (sdc === 'C') riskLevel = 'high';
            else if (sdc === 'B') riskLevel = 'moderate';
            seismicZone = { designCategory: sdc || 'Unknown', pga: Math.round(pga * 1000) / 1000, ss: Math.round(ss * 100) / 100, s1: Math.round(s1 * 100) / 100, riskLevel };
        }

        let earthquakes = [];
        if (quakeRes.ok) {
            const qd = await quakeRes.json();
            earthquakes = (qd.features || []).map(f => {
                const p = f.properties;
                const coords = f.geometry?.coordinates;
                let distMi = null;
                if (coords?.length >= 2) {
                    const R = 6371;
                    const dLat = (coords[1] - lat) * Math.PI / 180;
                    const dLng = (coords[0] - lng) * Math.PI / 180;
                    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(coords[1] * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
                    distMi = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 0.621371 * 10) / 10;
                }
                return {
                    id: f.id || `usgs-${p.time}`,
                    date: p.time ? new Date(p.time).toISOString().split('T')[0] : 'Unknown',
                    type: 'earthquake',
                    title: (p.title || `M${p.mag} Earthquake`).replace(/(\d+\.?\d*)\s*km/gi, m => `${Math.round(parseFloat(m) * 0.621)} mi`),
                    severity: `M${p.mag?.toFixed(1) || '?'}`,
                    source: 'usgs',
                    description: (p.place || 'Unknown location').replace(/(\d+\.?\d*)\s*km/gi, m => `${Math.round(parseFloat(m) * 0.621)} mi`),
                    distanceMi: distMi,
                    magnitude: p.mag,
                    depth: coords?.[2] ?? null,
                    url: p.url || null
                };
            });
        }

        const seismicPayload = { seismicZone, earthquakes, fetchedAt: new Date().toISOString() };
        await db.collection('properties').doc(zpid).collection('environmental').doc('thirdparty_data')
            .set({ historical_disasters: seismicPayload }, { merge: true });

        if (nriData) {
            await db.collection('properties').doc(zpid).collection('environmental').doc('fema_nri')
                .set(nriData, { merge: true });
        }

        return { ...seismicPayload, femaRiskIndex: nriData };
    } catch (e) {
        console.warn(`[Enrichment] Historical disasters failed for ${zpid}:`, e.message);
        return null;
    }
}

/**
 * Fetches FEMA National Risk Index (NRI) by Spatial Intersection.
 */
async function _fetchFemaRiskIndex(lat, lng) {
    try {
        const baseUrl = 'https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Census_Tracts/FeatureServer/0/query';
        // outFields=* avoids "Invalid query parameters" errors caused by URL length
        // when all 41 field names are listed explicitly for certain census tracts.
        const SHARED = { inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: '*', f: 'json', returnGeometry: 'false' };

        const buildEnvelope = (bufDeg) => new URLSearchParams({
            ...SHARED,
            geometry: JSON.stringify({ xmin: lng - bufDeg, ymin: lat - bufDeg, xmax: lng + bufDeg, ymax: lat + bufDeg, spatialReference: { wkid: 4326 } }),
            geometryType: 'esriGeometryEnvelope',
        });

        const pointParams = new URLSearchParams({
            ...SHARED,
            geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
            geometryType: 'esriGeometryPoint',
        });

        console.log(`   [FEMA NRI] Spatial Query for ${lat},${lng}`);

        const fetchOpts = { headers: { 'User-Agent': 'curl/8.7.1' } };
        let res = await fetch(`${baseUrl}?${pointParams.toString()}`, fetchOpts);
        if (!res.ok) { console.warn(`   [FEMA NRI] API Error: ${res.status}`); return null; }
        let data = await res.json();

        // Graduated buffer fallback: 0.005° (~550m) then 0.015° (~1.6km)
        for (const bufDeg of [0.005, 0.015]) {
            if (data.features?.length) break;
            console.log(`   [FEMA NRI] No point data, retrying with ${bufDeg}° buffer...`);
            res = await fetch(`${baseUrl}?${buildEnvelope(bufDeg).toString()}`, fetchOpts);
            if (!res.ok) break;
            data = await res.json();
        }

        const attrs = data.features?.[0]?.attributes;
        console.log(`   [FEMA NRI] Attributes Found: ${!!attrs}`);
        if (!attrs) return null;
        console.log(`   [FEMA NRI] Raw Data: ${JSON.stringify(attrs)}`);

        const nri = (key) => attrs[key] ?? null;
        return {
            overall: nri('RISK_SCORE'),
            rating: nri('RISK_RATNG'),
            hazards: {
                flood: { score: nri('RFLD_RISKS'), rating: nri('RFLD_RISKR') },
                coastal_flood: { score: nri('CFLD_RISKS'), rating: nri('CFLD_RISKR') },
                inland_flood: { score: nri('IFLD_RISKS'), rating: nri('IFLD_RISKR') },
                wildfire: { score: nri('WFIR_RISKS'), rating: nri('WFIR_RISKR') },
                heatwave: { score: nri('HWAV_RISKS'), rating: nri('HWAV_RISKR') },
                hurricane: { score: nri('HRCN_RISKS'), rating: nri('HRCN_RISKR') },
                tornado: { score: nri('TRND_RISKS'), rating: nri('TRND_RISKR') },
                strongwind: { score: nri('SWND_RISKS'), rating: nri('SWND_RISKR') },
                earthquake: { score: nri('ERQK_RISKS'), rating: nri('ERQK_RISKR') },
                drought: { score: nri('DRGT_RISKS'), rating: nri('DRGT_RISKR') },
                hail: { score: nri('HAIL_RISKS'), rating: nri('HAIL_RISKR') },
                lightning: { score: nri('LTNG_RISKS'), rating: nri('LTNG_RISKR') },
                landslide: { score: nri('LNDS_RISKS'), rating: nri('LNDS_RISKR') },
                tsunami: { score: nri('TSUN_RISKS'), rating: nri('TSUN_RISKR') },
                avalanche: { score: nri('AVLN_RISKS'), rating: nri('AVLN_RISKR') },
                coldwave: { score: nri('CWAV_RISKS'), rating: nri('CWAV_RISKR') },
                icestorm: { score: nri('ISTM_RISKS'), rating: nri('ISTM_RISKR') },
                volcano: { score: nri('VLCN_RISKS'), rating: nri('VLCN_RISKR') },
                winterweather: { score: nri('WNTW_RISKS'), rating: nri('WNTW_RISKR') }
            },
            censusTract: nri('TRACTFIPS'),
            source: 'FEMA NRI'
        };
    } catch (e) {
        console.warn(`[Enrichment] FEMA NRI fetch failed:`, e.message);
        return null;
    }
}

/**
 * Fetches nearby places (walkable + drivable) from Google Places API.
 * Saves to environmental/thirdparty_data as google_places.
 */
async function _enrichNearbyPlaces(zpid, db, lat, lng, mapsKey) {
    if (!mapsKey) return null;
    const PLACES_URL = 'https://places.googleapis.com/v1/places:searchNearby';
    const FIELD_MASK = 'places.displayName,places.types,places.rating,places.userRatingCount,places.priceLevel,places.googleMapsUri,places.primaryTypeDisplayName,places.location';

    try {
        const [walkRes, driveRes] = await Promise.all([
            fetch(PLACES_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': mapsKey, 'X-Goog-FieldMask': FIELD_MASK },
                body: JSON.stringify({ includedTypes: ['cafe', 'bakery', 'restaurant', 'park', 'playground', 'hiking_area', 'school', 'primary_school', 'library', 'gym', 'grocery_store', 'bank'], maxResultCount: 20, locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 1500.0 } }, rankPreference: 'DISTANCE' })
            }).catch(() => null),
            fetch(PLACES_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': mapsKey, 'X-Goog-FieldMask': FIELD_MASK },
                body: JSON.stringify({ includedTypes: ['supermarket', 'shopping_mall', 'hospital', 'police', 'fire_station', 'transit_station', 'parking', 'electric_vehicle_charging_station', 'gas_station', 'stadium'], maxResultCount: 20, locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 5000.0 } } })
            }).catch(() => null)
        ]);

        const parsePlaces = async (res) => {
            if (!res || !res.ok) return [];
            const data = await res.json();
            return (data.places || []).map(p => ({
                name: p.displayName?.text || 'Unknown',
                rating: p.rating ?? null,
                userRatingCount: p.userRatingCount ?? null,
                types: p.types || [],
                primaryTypeDisplayName: p.primaryTypeDisplayName?.text ?? null,
                priceLevel: p.priceLevel ?? null,
                googleMapsUri: p.googleMapsUri ?? null,
                source: 'google',
                location: p.location ?? null
            }));
        };

        const walkable = await parsePlaces(walkRes);
        const driveableRaw = await parsePlaces(driveRes);
        const walkNames = new Set(walkable.map(p => p.name.toLowerCase()));
        const driveable = driveableRaw.filter(p => !walkNames.has(p.name.toLowerCase()));

        const payload = { walkable, driveable, fetchedAt: new Date().toISOString(), isUnified: true };
        await db.collection('properties').doc(zpid).collection('environmental').doc('thirdparty_data')
            .set({ google_places: payload }, { merge: true });
        return payload;
    } catch (e) {
        console.warn(`[Enrichment] Nearby places failed for ${zpid}:`, e.message);
        return null;
    }
}

const NREL_API_KEY = 'tJazmG4548XD5humNAdLvG55RxdDCmxDbcBrxfDb';

/**
 * Broadband providers + cell coverage via broadbandmap.com (free, no key).
 * Saves to environmental/thirdparty_data as broadband.
 */
async function _enrichBroadband(zpid, db, lat, lng) {
    try {
        const [internetRes, cellRes] = await Promise.all([
            fetch(`https://broadbandmap.com/api/v1/location/internet?lat=${lat}&lng=${lng}`).catch(() => null),
            fetch(`https://broadbandmap.com/api/v1/location/cell?lat=${lat}&lng=${lng}`).catch(() => null),
        ]);

        const internetProviders = [];
        let topDownloadMbps = 0;
        let hasFiber = false;

        if (internetRes?.ok) {
            const data = await internetRes.json();
            for (const p of (data.providers || [])) {
                internetProviders.push({
                    name: p.name || 'Unknown',
                    technology: p.technology || '',
                    maxDownloadMbps: p.max_download_mbps || 0,
                    maxUploadMbps: p.max_upload_mbps || 0,
                });
                if ((p.max_download_mbps || 0) > topDownloadMbps) topDownloadMbps = p.max_download_mbps || 0;
                if (p.technology === 'Fiber') hasFiber = true;
            }
        }

        const cellCoverage = [];
        let has5G = false;

        if (cellRes?.ok) {
            const data = await cellRes.json();
            for (const c of (data.coverage || [])) {
                cellCoverage.push({
                    network: c.network || 'Unknown',
                    technology: c.technology || '',
                    signalLevel: c.signal_level || 'Unknown',
                    rsrpDbm: c.rsrp_dbm || 0,
                });
                if (c.technology?.includes('5G')) has5G = true;
            }
        }

        const payload = {
            internetProviders, cellCoverage, topDownloadMbps, hasFiber, has5G,
            providerCount: internetProviders.length,
            fetchedAt: new Date().toISOString()
        };

        await db.collection('properties').doc(zpid).collection('environmental').doc('thirdparty_data')
            .set({ broadband: payload }, { merge: true });
        return payload;
    } catch (e) {
        console.warn(`[Enrichment] Broadband failed for ${zpid}:`, e.message);
        return null;
    }
}

/**
 * Drought severity via FCC Census FIPS lookup + US Drought Monitor (both free, no key).
 * Saves to environmental/thirdparty_data as drought.
 */
async function _enrichDrought(zpid, db, lat, lng) {
    try {
        const fccRes = await fetch(`https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lng}&censusYear=2020&format=json`);
        if (!fccRes.ok) return null;
        const fccData = await fccRes.json();
        const fccResult = fccData?.results?.[0];
        if (!fccResult?.county_fips) return null;

        const fips = fccResult.county_fips;
        const countyName = fccResult.county_name || '';
        const stateName = fccResult.state_code || '';

        const now = new Date();
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const fmt = d => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
        const usdmUrl = `https://usdmdataservices.unl.edu/api/CountyStatistics/GetDroughtSeverityStatisticsByAreaPercent?aoi=${fips}&startdate=${fmt(twoWeeksAgo)}&enddate=${fmt(now)}&statisticsType=1`;

        const usdmRes = await fetch(usdmUrl, { headers: { Accept: 'application/json' } });
        if (!usdmRes.ok) return null;
        const records = await usdmRes.json();
        if (!Array.isArray(records) || records.length === 0) return null;

        const latest = records[0];
        const SEVERITY_LABELS = { 4: 'Exceptional', 3: 'Extreme', 2: 'Severe', 1: 'Moderate', 0: 'Abnormally Dry', '-1': 'None' };
        let severityLevel = -1;
        if ((latest.d4 || 0) > 0) severityLevel = 4;
        else if ((latest.d3 || 0) > 0) severityLevel = 3;
        else if ((latest.d2 || 0) > 0) severityLevel = 2;
        else if ((latest.d1 || 0) > 0) severityLevel = 1;
        else if ((latest.d0 || 0) > 0) severityLevel = 0;

        const payload = {
            countyFips: fips,
            countyName: latest.county || countyName,
            state: latest.state || stateName,
            none: latest.none ?? 0, d0: latest.d0 ?? 0, d1: latest.d1 ?? 0,
            d2: latest.d2 ?? 0, d3: latest.d3 ?? 0, d4: latest.d4 ?? 0,
            severity: SEVERITY_LABELS[String(severityLevel)] || 'None',
            severityLevel,
            mapDate: latest.mapDate?.split('T')[0] || '',
            fetchedAt: new Date().toISOString()
        };

        await db.collection('properties').doc(zpid).collection('environmental').doc('thirdparty_data')
            .set({ drought: payload }, { merge: true });
        return payload;
    } catch (e) {
        console.warn(`[Enrichment] Drought failed for ${zpid}:`, e.message);
        return null;
    }
}

/**
 * EV charging stations within 5 mi via NREL API.
 * Saves to environmental/thirdparty_data as evChargers.
 */
async function _enrichEVChargers(zpid, db, lat, lng) {
    try {
        const url = `https://developer.nrel.gov/api/alt-fuel-stations/v1/nearest.json?api_key=${NREL_API_KEY}&latitude=${lat}&longitude=${lng}&radius=5&fuel_type=ELEC&status=E&access=public&limit=20`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const stations = data.fuel_stations || [];

        let totalDcFast = 0;
        let totalLevel2 = 0;
        const networkSet = new Set();
        const connectorSet = new Set();

        for (const s of stations) {
            totalDcFast += s.ev_dc_fast_num || 0;
            totalLevel2 += s.ev_level2_evse_num || 0;
            if (s.ev_network) networkSet.add(s.ev_network);
            if (s.ev_connector_types) for (const c of s.ev_connector_types) connectorSet.add(c);
        }

        const closest = stations[0];
        const payload = {
            totalStations: stations.length,
            totalPorts: totalDcFast + totalLevel2,
            dcFastPorts: totalDcFast,
            level2Ports: totalLevel2,
            closestStationName: closest?.station_name || null,
            closestDistanceMi: closest?.distance != null ? Math.round(closest.distance * 10) / 10 : null,
            networks: [...networkSet],
            connectorTypes: [...connectorSet],
            stations: stations.map(s => ({
                name: s.station_name,
                distanceMi: s.distance,
                portCount: (s.ev_dc_fast_num || 0) + (s.ev_level2_evse_num || 0),
                network: s.ev_network,
                address: s.street_address
            })),
            fetchedAt: new Date().toISOString()
        };

        await db.collection('properties').doc(zpid).collection('environmental').doc('thirdparty_data')
            .set({ evChargers: payload }, { merge: true });
        return payload;
    } catch (e) {
        console.warn(`[Enrichment] EV chargers failed for ${zpid}:`, e.message);
        return null;
    }
}

/**
 * Quaternary faults within ~35 mi via USGS Qfaults ArcGIS service.
 * Saves to environmental/thirdparty_data as faults.
 */
async function _enrichFaults(zpid, db, lat, lng) {
    try {
        const buffer = 0.5; // ~35 mi
        const geometry = JSON.stringify({
            xmin: lng - buffer, ymin: lat - buffer, xmax: lng + buffer, ymax: lat + buffer,
            spatialReference: { wkid: 4326 }
        });
        const url = `https://earthquake.usgs.gov/arcgis/rest/services/haz/Qfaults/MapServer/21/query`
            + `?geometry=${encodeURIComponent(geometry)}`
            + `&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects`
            + `&inSR=4326&outSR=4326`
            + `&outFields=fault_name,age,slip_rate,slip_sense,dip_direction`
            + `&returnGeometry=true&f=json`;

        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const features = data.features || [];

        const haversineMi = (lat1, lon1, lat2, lon2) => {
            const R = 6371;
            const toRad = d => d * Math.PI / 180;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 0.621371;
        };
        const mapAge = (age) => {
            const a = (age || '').toLowerCase();
            if (a.includes('holocene') || a.includes('15,000') || a.includes('latest quaternary')) return '< 15,000 yrs ago';
            if (a.includes('late quaternary') || a.includes('130,000')) return '< 130,000 yrs ago';
            if (a.includes('middle') || a.includes('750,000')) return '< 750,000 yrs ago';
            if (a.includes('quaternary')) return '< 2.6M yrs ago';
            return age || 'Unknown';
        };
        const activityStatus = (slipRate, age) => {
            const s = (slipRate || '').toLowerCase(); const a = (age || '').toLowerCase();
            if (s.includes('> 5') || s.includes('1-5') || s.includes('high')) return 'High Activity';
            if (a.includes('holocene') || a.includes('15,000') || a.includes('latest')) return 'Historically Active';
            return 'Potentially Active';
        };

        const faults = features.map((f, idx) => {
            const attrs = f.attributes || {};
            const path = ((f.geometry && f.geometry.paths && f.geometry.paths[0]) || []).map(p => ({ lng: p[0], lat: p[1] }));
            let minDistKm = Infinity;
            for (const p of path) {
                const d = haversineMi(lat, lng, p.lat, p.lng) / 0.621371;
                if (d < minDistKm) minDistKm = d;
            }
            const age = attrs.age || 'Unknown';
            const slipRate = attrs.slip_rate || 'Unspecified';
            return {
                id: `fault-${idx}-${attrs.fault_name || 'unknown'}`,
                name: attrs.fault_name || 'Unnamed Fault',
                age, slipRate,
                slipSense: attrs.slip_sense || 'Unknown',
                dipDirection: attrs.dip_direction || 'Unknown',
                distanceMi: Math.round(minDistKm * 0.621371 * 10) / 10,
                activityStatus: activityStatus(slipRate, age),
                lastActive: mapAge(age),
                geometry: path,
            };
        });

        const unique = {};
        for (const fl of faults) {
            const k = (fl.name || 'Unnamed Fault').trim().toLowerCase();
            if (!unique[k] || fl.distanceMi < unique[k].distanceMi) unique[k] = fl;
        }
        const finalFaults = Object.values(unique).sort((a, b) => a.distanceMi - b.distanceMi).slice(0, 10);

        const payload = { faults: finalFaults, fetchedAt: new Date().toISOString() };
        await db.collection('properties').doc(zpid).collection('environmental').doc('thirdparty_data')
            .set({ faults: payload }, { merge: true });
        return payload;
    } catch (e) {
        console.warn(`[Enrichment] Faults failed for ${zpid}:`, e.message);
        return null;
    }
}

const _NEIGHBORHOOD_IDENTITY_SCHEMA = {
    type: 'object',
    properties: {
        neighborhood_name: { type: 'string' },
        alternative_names: { type: 'array', items: { type: 'string' } },
        source_type: { type: 'string' },
        character: {
            type: 'object',
            properties: {
                description: { type: 'string' },
                architectural_style: { type: 'string' },
                era_built: { type: 'string' },
                community_type: { type: 'string' },
                typical_home_size: { type: 'string' },
                typical_lot_size: { type: 'string' },
            },
            required: ['description']
        },
        price_context: {
            type: 'object',
            properties: {
                tier: { type: 'string' },
                typical_range: { type: 'string' },
                context: { type: 'string' }
            },
            required: ['tier', 'typical_range']
        },
        hoa: {
            type: 'object',
            properties: {
                has_hoa: { type: 'boolean' },
                monthly_fee: { type: 'string' },
                covers: { type: 'string' },
                notable_rules: { type: 'string' }
            },
            required: ['has_hoa']
        },
        infrastructure_quality: { type: 'string' },
        upcoming_changes: { type: 'string' },
        unique_features: { type: 'array', items: { type: 'string' } }
    },
    required: ['neighborhood_name', 'alternative_names', 'source_type', 'character', 'price_context']
};

/**
 * Resolves neighborhood identity via:
 *   1. Gemini grounded search (neighborhood name + character)
 *   2. Alameda County surveyor tract (ArcGIS, free)
 *   3. Pleasanton city plan data (ArcGIS, free — gracefully no-ops for other cities)
 * Saves to properties/{zpid} as neighborhood_identity.
 */
async function _enrichNeighborhoodIdentity(zpid, db, address, city, state, lat, lng, description, geminiKey, logger = null) {
    if (!geminiKey) return null;
    try {
        const descBlock = description ? `\nLISTING DESCRIPTION (from the listing agent — check this FIRST for neighborhood name clues):\n"${description.slice(0, 1500)}"\n` : '';
        const prompt = `Act as a neighborhood intelligence tool specializing in micro-level residential neighborhood identification.

TASK: Identify the specific, social-level neighborhood name and gather unique intelligence for the address below.

ADDRESS: ${address}, ${city}, ${state}
${descBlock}
INSTRUCTIONS:
1. FIRST, check the listing description above (if provided) for any neighborhood, subdivision, or community name the agent mentioned.
2. THEN, use Google Search grounding to verify and enrich — find the "social name" residents and agents actually use (e.g., 'Birdland', 'Vintage Hills', 'Ruby Hill', 'Kottinger Ranch').
3. IGNORE broad city-level names — drill down to the micro-neighborhood.
4. If no social name is found, return the legal subdivision or tract name from county records.
5. NEIGHBORHOOD CHARACTER: architectural style, era built, community type, typical sizes.
6. PRICE CONTEXT: where does this neighborhood sit in the city's hierarchy?
7. HOA DETAILS: fees and coverage if applicable.
8. INFRASTRUCTURE QUALITY: road conditions, sidewalks, street lighting, landscaping, maintenance.
9. UPCOMING CHANGES: planned developments, construction, or zoning changes.
10. UNIQUE FEATURES: trails, parks, views, landmarks, water features, green belts.

CRITICAL: Do NOT include ANY demographic, racial, ethnic, or familial information. Focus exclusively on physical characteristics, market data, and infrastructure.

Return ONLY valid JSON matching this schema:
${JSON.stringify(_NEIGHBORHOOD_IDENTITY_SCHEMA, null, 2)}
`.trim();

        // Run Gemini + ArcGIS sources in parallel
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-lite'
        });

        const [geminiResult, surveyorResult, cityPlanResult] = await Promise.allSettled([
            model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                tools: [{ googleSearch: {} }]
            }).then(r => {
                if (logger) {
                    logger.logTask('neighborhood_identity');
                    logger.logLLMCall('gemini-2.5-flash', r.response.usageMetadata?.promptTokenCount, r.response.usageMetadata?.candidatesTokenCount, zpid, 'neighborhoodIdentity.js');
                }
                return _extractJson(r.response.text());
            }).catch(() => null),

            // Alameda County Surveyor Tract Map (works for all Alameda County properties)
            fetch(
                `https://services5.arcgis.com/ROBnTHSNjoZ2Wm1P/arcgis/rest/services/Surveyor_TM_RS_PM_SubLayers/FeatureServer/0/query?` +
                `geometry=${lng},${lat}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects` +
                `&inSR=4326&outFields=DocumentId,LocationDescription,Year,Roads&f=json&returnGeometry=false`
            ).then(async r => {
                if (!r.ok) return null;
                const d = await r.json();
                const features = d?.features || [];
                const sorted = features
                    .map(f => f.attributes)
                    .filter(a => a?.DocumentId)
                    .sort((a, b) => {
                        if (a.Roads && !b.Roads) return -1;
                        if (!a.Roads && b.Roads) return 1;
                        return (parseInt(b.Year) || 0) - (parseInt(a.Year) || 0);
                    });
                const feat = sorted[0];
                return feat ? { tract_id: feat.DocumentId || '', description: feat.LocationDescription || feat.DocumentId || '', year: feat.Year || '', roads: feat.Roads || '' } : null;
            }).catch(() => null),

            // Pleasanton city plan data — no-ops gracefully for non-Pleasanton cities
            (async () => {
                const CITY_BASE = 'https://maps.cityofpleasantonca.gov/server/rest/services/Hosted';
                const LAND_USE_BASE = 'https://services1.arcgis.com/vQBE9cyhukJHVTrT/arcgis/rest/services';
                const queryLayer = async (layerUrl, fields) => {
                    const r = await fetch(`${layerUrl}/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&inSR=4326&outFields=${fields}&f=json&returnGeometry=false`);
                    if (!r.ok) return null;
                    const d = await r.json();
                    return d?.features?.[0]?.attributes || null;
                };
                const [lmd, sp, lu] = await Promise.allSettled([
                    queryLayer(`${CITY_BASE}/LandscapeMaintenanceDistrictNoticingArea_Public/FeatureServer/0`, 'districtname'),
                    queryLayer(`${CITY_BASE}/SpecificPlanAreas_Public/FeatureServer/0`, 'boundary'),
                    queryLayer(`${LAND_USE_BASE}/GeneralPlanLandUse20052025_vwPublic/FeatureServer/0`, 'landusedesignation,landusecategory'),
                ]);
                const fmtCamel = s => s ? s.replace(/([A-Z])/g, ' $1').trim() : null;
                const cleanSp = s => s ? s.replace(/ Specific Plan Area Boundary$/i, '').trim() : null;
                const lmdAttrs = lmd.status === 'fulfilled' ? lmd.value : null;
                const spAttrs = sp.status === 'fulfilled' ? sp.value : null;
                const luAttrs = lu.status === 'fulfilled' ? lu.value : null;
                const lmdName = lmdAttrs?.districtname ? fmtCamel(lmdAttrs.districtname) : null;
                const spName = cleanSp(spAttrs?.boundary);
                const luDesig = fmtCamel(luAttrs?.landusedesignation);
                return (lmdName || spName || luDesig) ? { lmd_name: lmdName, specific_plan: spName, land_use_designation: luDesig, land_use_category: fmtCamel(luAttrs?.landusecategory) } : null;
            })().catch(() => null)
        ]);

        const gemini = geminiResult.status === 'fulfilled' ? geminiResult.value : null;
        const tract = surveyorResult.status === 'fulfilled' ? surveyorResult.value : null;
        const cityPlan = cityPlanResult.status === 'fulfilled' ? cityPlanResult.value : null;

        const resolvedName = gemini?.neighborhood_name
            || cityPlan?.lmd_name
            || cityPlan?.specific_plan
            || tract?.description
            || null;

        const identityData = {
            gemini: gemini || null,
            city_plan: cityPlan || null,
            surveyor_tract: tract || null,
            resolved_name: resolvedName,
            last_updated: new Date().toISOString()
        };

        await db.collection('properties').doc(zpid).set({ neighborhood_identity: identityData }, { merge: true });
        console.log(`[Enrichment] Neighborhood identity for ${zpid}: "${resolvedName || 'Unknown'}"`);
        return identityData;
    } catch (e) {
        console.warn(`[Enrichment] Neighborhood identity failed for ${zpid}:`, e.message);
        return null;
    }
}


/**
 * Core: process one property (Enrichment)
 * Fetches specs from RapidAPI, geocodes with Radar, and does Gemini Tax Lookup.
 */
async function _enrichProperty(zpid, db, keys, logger = null) {
    const RAPID_API_KEY = keys.rapidapi_key;
    const RAPID_API_HOST = keys.rapidapi_host || 'us-housing-market-data1.p.rapidapi.com';
    const RADAR_API_KEY = keys.radar_key;
    const geminiKey = keys.gemini_key;

    // 0. Cache Check (Healing Mode - 30 days TTL)
    const propSnap = await db.collection('properties').doc(zpid).get();
    let root = null;
    let resoRaw = {};
    let isFresh = false;

    if (propSnap.exists) {
        const propData = propSnap.data();
        const lastTs = propData?.updatedAt;
        if (lastTs) {
            const ms = lastTs.toMillis ? lastTs.toMillis() : new Date(lastTs).getTime();
            const ageDays = (Date.now() - ms) / (24 * 60 * 60 * 1000);
            if (ageDays < 30) {
                console.log(`[Enrichment] Healing property specs for ${zpid}: Cache is fresh (${Math.round(ageDays)} days old).`);
                root = propData;
                resoRaw = propData.resoFacts || {};
                isFresh = true;
            }
        }
    }

    if (!isFresh) {
        // 1. Fetch from RapidAPI
        const propertyUrl = `https://${RAPID_API_HOST}/property?zpid=${zpid}`;
        if (logger) logger.logAPICall('rapidapi', 'property_specs', zpid);
        const propRes = await fetch(propertyUrl, {
            headers: { 'x-rapidapi-host': RAPID_API_HOST, 'x-rapidapi-key': RAPID_API_KEY }
        });
        if (!propRes.ok) throw new Error(`RapidAPI Error: ${propRes.status}`);
        const data = await propRes.json();
        root = data.property || data.props || data;
        resoRaw = root.resoFacts || {};
        console.log(`[Enrichment] Fetched fresh RapidAPI specs for ${zpid}`);
    }

    // Normalize address fields to flat top-level fields so the rest of the code
    // has a single consistent shape regardless of whether root came from RapidAPI
    // (nested root.address object) or the Firestore cache (already flat).
    if (root.address && typeof root.address === 'object') {
        root._streetLine = root.address.line || root.address.streetAddress || null;
        root.city        = root.city  || root.address.city;
        root.state       = root.state || root.address.state;
        root.zipCode     = root.zipCode || root.address.zipcode || root.address.zipCode;
    } else {
        root._streetLine = null;
    }

    // 2. Address & Coordinates
    // RapidAPI lat/lng is the authoritative source — use it directly when present.
    // Fall back to stored coordinates (isFresh path) rather than re-deriving from geocoding.
    let coordinates = (root.latitude && root.longitude)
        ? { latitude: root.latitude, longitude: root.longitude }
        : (root.coordinates?.latitude ? { latitude: root.coordinates.latitude, longitude: root.coordinates.longitude } : null);

    // Build formattedAddress from normalized flat fields (set above).
    const streetPart = root._streetLine;
    const cityPart   = root.city;
    const statePart  = root.state;
    const rawZip     = root.zipCode;
    // Strip zip if the state isn't one we support — avoids carrying over stale/wrong zip codes
    // from properties that were misrouted or have bad RapidAPI address data.
    const zipPart = isSupportedState(statePart) ? rawZip : null;
    if (rawZip && !zipPart) {
        console.warn(`[Enrichment] Dropping zip ${rawZip} for ${zpid}: state '${statePart}' not in supported states`);
    }
    // If we have a previously stored full address string but no structured components,
    // use it directly rather than reconstructing (which would append city/state/zip again).
    const existingFullAddress = typeof root.address === 'string' && root.address !== zpid ? root.address : null;
    let formattedAddress = streetPart
        ? [streetPart, cityPart, statePart, zipPart].filter(Boolean).join(', ')
        : (existingFullAddress || zpid);

    // If RapidAPI didn't return lat/lng, forward geocode the full address with Radar to get coordinates.
    if (!coordinates && streetPart) {
        if (logger) logger.logAPICall('radar', 'geocoding', zpid);
        const fullAddress = [streetPart, cityPart, statePart, zipPart].filter(Boolean).join(', ');
        const radarUrl = `https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(fullAddress)}`;
        const radarRes = await fetch(radarUrl, { headers: { 'Authorization': RADAR_API_KEY } });
        if (radarRes.ok) {
            const radarData = await radarRes.json();
            if (radarData.addresses && radarData.addresses.length > 0) {
                const first = radarData.addresses[0];
                coordinates = { latitude: first.latitude, longitude: first.longitude };
            }
        }
    }

    // 3. Gemini Tax Lookup — always fetch for comparison against listing sqft,
    //    unless taxSqft is already cached in Firestore from a previous run.
    let taxData = null;
    const existingSnap = await db.collection('properties').doc(zpid).get();
    const alreadyHasTaxSqft = existingSnap.exists && existingSnap.data()?.taxSqft > 0;
    if (!alreadyHasTaxSqft && formattedAddress && geminiKey) {
        try {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({
                model: 'gemini-2.5-flash-lite'
            });
            const prompt = TAX_RECORD_LOOKUP_PROMPT(formattedAddress);
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                tools: [{ googleSearch: {} }]
            });
            if (logger) {
                logger.logTask('tax_lookup');
                logger.logLLMCall('gemini-2.5-flash-lite', result.response.usageMetadata?.promptTokenCount, result.response.usageMetadata?.candidatesTokenCount, zpid, 'taxLookup.js');
            }
            taxData = _extractJson(result.response.text());
        } catch (e) {
            console.warn(`[Enrichment] Gemini Tax Lookup failed for ${zpid}:`, e.message);
        }
    }

    // 4. Environmental Enrichment + Neighborhood Identity (parallel)
    let envResults = null;
    if (coordinates) {
        const propSnap = await db.collection('properties').doc(zpid).get();
        const existingNeighborhoodId = propSnap.exists ? propSnap.data()?.neighborhood_identity : null;
        const needsNeighborhoodId = !existingNeighborhoodId?.resolved_name || existingNeighborhoodId.resolved_name === 'Unknown';

        const [envRes] = await Promise.allSettled([
            _enrichEnvironmentalData(zpid, db, keys, coordinates.latitude, coordinates.longitude, logger, cityPart, statePart).catch(e => {
                console.warn(`[Enrichment] Environmental step failed for ${zpid}:`, e.message);
                return null;
            }),
            needsNeighborhoodId
                ? _enrichNeighborhoodIdentity(zpid, db, formattedAddress, root.city, root.state, coordinates.latitude, coordinates.longitude, root.description, geminiKey, logger)
                : Promise.resolve(null)
        ]);
        envResults = envRes.status === 'fulfilled' ? envRes.value : null;
    }

    // 5. Map and Save
    const mapped = {
        zpid,
        address: formattedAddress,
        coordinates,
        city: root.city,
        state: root.state,
        zipCode: root.zipCode,
        homeType: root.homeType,
        bedrooms: extractNumericValue(root.bedrooms),
        bathrooms: extractNumericValue(root.bathrooms),
        livingAreaValue: extractNumericValue(root.livingAreaValue || root.livingArea),
        yearBuilt: extractNumericValue(root.yearBuilt),
        price: extractNumericValue(root.price || root.listPrice),
        zestimate: extractNumericValue(root.zestimate),
        description: root.description,
        images: root.images || [],
        apn: resoRaw.parcelNumber || root.parcelNumber,
        lotAreaValue: extractNumericValue(resoRaw.lotSizeAreaSqFt || root.lotSizeValue || root.lotArea),
        schools: root.schools?.map(s => ({
            name: s.name || 'Unknown',
            level: s.level || 'N/A',
            rating: s.rating ?? 'N/A',
            distance: s.distance ? `${s.distance} mi` : 'N/A',
        })),
        // Climate risk scores (Side-by-Side Comparison Mode)
        // First Street (Paid)
        floodRiskScore: extractNumericValue(root.floodRiskScore ?? root.climate?.floodSources?.primary?.riskScore?.value),
        fireRiskScore: extractNumericValue(root.fireRiskScore ?? root.climate?.fireSources?.primary?.riskScore?.value),
        heatRiskScore: extractNumericValue(root.heatRiskScore ?? root.climate?.heatSources?.primary?.riskScore?.value),
        windRiskScore: extractNumericValue(root.windRiskScore ?? root.climate?.windSources?.primary?.riskScore?.value),

        // Price history
        priceHistory: root.priceHistory?.map(ph => ({
            date: ph.date || '',
            price: extractNumericValue(ph.price),
            event: ph.event || (ph.priceChangeRate ? `Change (${ph.priceChangeRate})` : ''),
        })) || undefined,

        // Attribution
        attribution: (() => {
            if (root.attributionInfo?.agentName || root.attributionInfo?.brokerName) {
                return {
                    listingAgentName: root.attributionInfo.agentName || root.attributionInfo.brokerName || undefined,
                    listingAgentNumber: root.attributionInfo.agentPhoneNumber || root.attributionInfo.brokerPhoneNumber || undefined,
                    brokerageName: root.attributionInfo.brokerName || root.brokerageName || undefined,
                    mlsName: root.attributionInfo.mlsName || undefined,
                    mlsId: root.attributionInfo.mlsId || resoRaw.mlsid || root.mlsid || undefined,
                };
            }
            const lb = root.listed_by;
            if (lb?.display_name || lb?.business_name) {
                const phone = lb.phone ? `${lb.phone.areacode}-${lb.phone.prefix}-${lb.phone.number}` : undefined;
                return {
                    listingAgentName: lb.display_name || undefined,
                    listingAgentNumber: phone,
                    brokerageName: lb.business_name || root.brokerageName || undefined,
                    mlsId: resoRaw.mlsid || root.mlsid || undefined,
                };
            }
            if (root.brokerageName) {
                return { brokerageName: root.brokerageName, mlsId: resoRaw.mlsid || root.mlsid || undefined };
            }
            return undefined;
        })(),

        resoFacts: Object.keys(resoRaw).length > 0 ? {
            flooring: resoRaw.flooring,
            rooms: resoRaw.rooms,
            roomTypes: resoRaw.roomTypes,
            exteriorFeatures: resoRaw.exteriorFeatures,
            architecturalStyle: resoRaw.architecturalStyle,
            garageParkingCapacity: resoRaw.garageParkingCapacity,
            roofType: resoRaw.roofType,
            daysOnZillow: extractNumericValue(resoRaw.daysOnZillow),
            appliances: resoRaw.appliances,
            fencing: resoRaw.fencing,
            cooling: resoRaw.cooling,
            heating: resoRaw.heating,
            mlsid: resoRaw.mlsid,
            propertyCondition: resoRaw.propertyCondition,
            interiorFeatures: resoRaw.interiorFeatures || undefined,
            electric: resoRaw.electric || undefined,
        } : undefined,
        ...(taxData ? {
            taxSqft: taxData.tax_sqft,
            taxSqftSource: taxData.source,
            taxSqftConfidence: taxData.confidence,
            taxSqftCachedAt: new Date().toISOString(),
        } : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        _fetchMeta: {
            rapidapi: {
                lastFetched: new Date().toISOString(),
                fieldsPopulated: ['address', 'coordinates', 'bedrooms', 'bathrooms', 'livingAreaValue', 'yearBuilt', 'price', 'images'],
                fieldsNull: []
            },
            environmental: envResults ? {
                lastFetched: new Date().toISOString(),
                fieldsPopulated: Object.keys(envResults).filter(k => k !== 'lastUpdated'),
                fieldsNull: []
            } : undefined
        }
    };

    await db.collection('properties').doc(zpid).set(mapped, { merge: true });

    // Normalize legacy flat coordinate fields → canonical `coordinates` nested object.
    // Old docs stored `latitude`/`longitude` at root; clean those up so the smoke test
    // (which checks `coordinates.latitude`) is the single source of truth.
    if (coordinates && (root.latitude || root.longitude)) {
        await db.collection('properties').doc(zpid).update({
            latitude: admin.firestore.FieldValue.delete(),
            longitude: admin.firestore.FieldValue.delete(),
        });
    }

    // Always heal map images — runs regardless of env TTL or isFresh flag.
    // This ensures satellite/zoom images are always in Storage even on cached runs.
    if (coordinates) {
        try {
            const isStorageUrl = url => !!(url && (url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com')));
            const freshSnap = await db.collection('properties').doc(zpid).get();
            const freshData = freshSnap.exists ? freshSnap.data() : {};

            if (!isStorageUrl(freshData.satelliteImageUrl)) {
                await _enrichSatelliteImage(zpid, db, keys, coordinates.latitude, coordinates.longitude, logger);
            }
            if (!isStorageUrl(freshData.mapZoomIn) || !isStorageUrl(freshData.mapZoomOut)) {
                await _fetchAndStoreMapZooms(zpid, db, coordinates.latitude, coordinates.longitude, keys.radar_key);
            }
            await _healMapImages(zpid, db, logger);
        } catch (e) {
            console.warn(`[Enrichment] Final image heal failed for ${zpid}:`, e.message);
        }
    }


    return { status: 'success', address: formattedAddress, data: mapped };
}

/**
 * Targeted street neighborhood insights from a single street view image.
 * Saves exterior_and_neighborhood.neighborhood_street_insights to analysis/visual (merge).
 * preloadedImg: optional Gemini inlineData part { inlineData: { data, mimeType } } — skips re-download.
 */
async function _enrichStreetInsights(zpid, db, geminiKey, streetViewUrl, logger = null, preloadedImg = null) {
    if (!geminiKey || !streetViewUrl) return null;
    try {
        let imgPart = preloadedImg;
        if (!imgPart) {
            // Try Firebase Storage bucket path first
            let imgBuf = null;
            if (streetViewUrl.includes('storage.googleapis.com') || streetViewUrl.startsWith('gs://')) {
                try {
                    const bucket = admin.storage().bucket();
                    const filePath = streetViewUrl.startsWith('gs://')
                        ? streetViewUrl.split('/').slice(3).join('/')
                        : streetViewUrl.includes('/o/')
                            ? decodeURIComponent(streetViewUrl.split('/o/')[1].split('?')[0])
                            : streetViewUrl.split(`${bucket.name}/`)[1];
                    if (filePath) {
                        const [buf] = await bucket.file(filePath).download();
                        imgBuf = buf;
                    }
                } catch (e) { /* fall through to public fetch */ }
            }
            if (!imgBuf) {
                const resp = await fetch(streetViewUrl);
                if (!resp.ok) return null;
                imgBuf = Buffer.from(await resp.arrayBuffer());
            }
            imgPart = { inlineData: { data: imgBuf.toString('base64'), mimeType: 'image/jpeg' } };
        }

        const propSnap = await db.collection('properties').doc(zpid).get();
        const address = propSnap.exists ? (propSnap.data().formattedAddress || propSnap.data().address || '') : '';

        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-lite',
            generationConfig: { responseMimeType: 'text/plain' }
        });
        const prompt = `You are a real estate advisor analyzing a Google Street View image for a buyer.

Property: ${address}

In 2-3 sentences, describe the street environment visible in this image: the condition of the road and sidewalks, the upkeep of neighboring homes and landscaping, and any notable amenities, noise sources, or character of the block. Be specific and observational — no generic filler.`;

        const result = await model.generateContent([{ text: prompt }, imgPart]);
        if (logger) {
            logger.logTask('street_insights');
            logger.logLLMCall('gemini-2.5-flash-lite', result.response.usageMetadata?.promptTokenCount, result.response.usageMetadata?.candidatesTokenCount, zpid, 'streetInsights.js');
        }
        const insights = result.response.text().trim();
        if (!insights || insights.length < 20) return null;

        await db.collection('properties').doc(zpid).collection('analysis').doc('visual').set(
            { exterior_and_neighborhood: { neighborhood_street_insights: insights } },
            { merge: true }
        );
        console.log(`[StreetInsights] Saved for ${zpid}`);
        return insights;
    } catch (e) {
        console.warn(`[StreetInsights] Failed for ${zpid}:`, e.message);
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
            for (let j = 0; j < balance; j++) closure += '}';
            res = tryParse(closure) || tryParse(repairJson(closure));
            if (res) return res;
        }
    }

    throw new Error("Could not parse AI response as JSON even after repair attempts");
}

module.exports = {
    _enrichProperty,
    _enrichEnvironmentalData,
    _enrichStreetInsights,
    _enrichWalkScore,
    _enrichParcelData,
    _enrichSatelliteImage,
    _enrichNearbyPlaces,
    _enrichBroadband,
    _enrichDrought,
    _enrichEVChargers,
    _enrichFaults,
    _enrichHistoricalDisasters,
    _enrichNeighborhoodIdentity,
    _extractJson,
    extractNumericValue,
    ENV_SCHEMA_VERSION,
};
