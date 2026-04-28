'use strict';
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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
async function _enrichEnvironmentalData(zpid, db, keys, lat, lng) {
    const MAPS_API_KEY = keys.maps_key;
    const envRef = db.collection('properties').doc(zpid).collection('environmental').doc('thirdparty_data');

    const results = {
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    // 1. Solar
    try {
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
        } else {
            console.warn(`[Enrichment] Solar failed for ${zpid}: ${res.status} ${res.statusText}`);
        }
    } catch (e) { console.warn(`[Enrichment] Solar failed for ${zpid}:`, e.message); }

    // 2. Air Quality
    try {
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
            results.airQuality = {
                aqi: uaqi?.aqi,
                category: uaqi?.category,
                dominantPollutant: data.dominantPollutant
            };
        } else {
            console.warn(`[Enrichment] Air Quality failed for ${zpid}: ${res.status} ${res.statusText}`);
        }
    } catch (e) { console.warn(`[Enrichment] Air Quality failed for ${zpid}:`, e.message); }

    // 3. Pollen
    try {
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
                    score: maxPollen?.indexInfo?.value,
                    category: maxPollen?.indexInfo?.category,
                    dominantPollenType: maxPollen?.displayName
                };
            }
        }
    } catch (e) { console.warn(`[Enrichment] Pollen failed for ${zpid}:`, e.message); }

    // 4. Noise Score (HowLoud)
    const howloudKey = keys.howloud_key;
    if (howloudKey) {
        try {
            const url = `https://api.howloud.com/score?lat=${lat}&lng=${lng}&apiKey=${howloudKey}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'OK' && data.result?.length > 0) {
                    const row = data.result[0];
                    results.noiseScore = extractNumericValue(row.score);
                    results.noiseScoreDesc = row.scoretext;
                }
            }
        } catch (e) { console.warn(`[Enrichment] Noise failed for ${zpid}:`, e.message); }
    }

    console.log(`  ✅ Environmental saved for ${zpid}: ${Object.keys(results).join(', ')}`);
    await envRef.set(results, { merge: true });
    return results;
}

/**
 * Core: process one property (Enrichment)
 * Fetches specs from RapidAPI, geocodes with Radar, and does Gemini Tax Lookup.
 */
async function _enrichProperty(zpid, db, keys) {
    const RAPID_API_KEY = keys.rapidapi_key;
    const RAPID_API_HOST = keys.rapidapi_host || 'us-housing-market-data1.p.rapidapi.com';
    const RADAR_API_KEY = keys.radar_key;
    const geminiKey = keys.gemini_key;

    // 1. Fetch from RapidAPI
    const propertyUrl = `https://${RAPID_API_HOST}/property?zpid=${zpid}`;
    const propRes = await fetch(propertyUrl, {
        headers: { 'x-rapidapi-host': RAPID_API_HOST, 'x-rapidapi-key': RAPID_API_KEY }
    });
    if (!propRes.ok) throw new Error(`RapidAPI Error: ${propRes.status}`);
    const data = await propRes.json();
    const root = data.property || data.props || data;
    const resoRaw = root.resoFacts || {};

    // 2. Normalize Address (Radar)
    const rawAddress = root.address?.line || root.address?.streetAddress || zpid;
    const radarUrl = `https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(rawAddress)}`;
    const radarRes = await fetch(radarUrl, { headers: { 'Authorization': RADAR_API_KEY } });
    let coordinates = root.longitude && root.latitude ? { latitude: root.latitude, longitude: root.longitude } : null;
    let formattedAddress = root.address?.line || zpid;

    if (radarRes.ok) {
        const radarData = await radarRes.json();
        if (radarData.addresses && radarData.addresses.length > 0) {
            const first = radarData.addresses[0];
            coordinates = { latitude: first.latitude, longitude: first.longitude };
            formattedAddress = first.formattedAddress;
        }
    }

    // 3. Gemini Tax Lookup (if taxSqft missing)
    let taxData = null;
    if (!resoRaw.livingArea && !root.livingAreaValue && formattedAddress && geminiKey) {
        try {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({
                model: 'gemini-2.5-flash',
                generationConfig: { responseMimeType: 'application/json', responseSchema: TAX_RECORD_LOOKUP_SCHEMA }
            });
            const prompt = TAX_RECORD_LOOKUP_PROMPT(formattedAddress);
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                tools: [{ googleSearch: {} }]
            });
            taxData = JSON.parse(result.response.text());
        } catch (e) {
            console.warn(`[Enrichment] Gemini Tax Lookup failed for ${zpid}:`, e.message);
        }
    }

    // 4. Environmental Enrichment
    let envResults = null;
    if (coordinates) {
        try {
            envResults = await _enrichEnvironmentalData(zpid, db, keys, coordinates.latitude, coordinates.longitude);
        } catch (e) {
            console.warn(`[Enrichment] Environmental step failed for ${zpid}:`, e.message);
        }
    }

    // 5. Map and Save
    const mapped = {
        zpid,
        address: formattedAddress,
        coordinates,
        city: root.address?.city,
        state: root.address?.state,
        zipCode: root.address?.zipcode || root.address?.zipCode,
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
    return { status: 'success', address: formattedAddress, data: mapped };
}

module.exports = {
    _enrichProperty,
    _enrichEnvironmentalData,
    extractNumericValue
};
