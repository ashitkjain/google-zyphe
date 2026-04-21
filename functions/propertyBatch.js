'use strict';
/**
 * Property Data Batch Processing — Cloud Function
 *
 * Triggered by document creation in property_data_batch_jobs/{jobId}.
 * Fetches property specs (RapidAPI), scores, and Gemini tax fallbacks server-side
 * with 20-way concurrency.
 *
 * Client writes:
 *   { zpids: string[], status: 'queued', total: N, done: 0, failed: 0, userId: string, batchId: string }
 *
 * CF updates:
 *   { status: 'running' | 'completed', done: N, failed: N, results: { [zpid]: { status, message } } }
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const BATCH_CONCURRENCY = 20;

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

const TAX_RECORD_LOOKUP_SYSTEM_INSTRUCTION =
    'You are a real estate data specialist. Your ONLY task is to find the official living area square footage from public tax/assessor records. Always return valid JSON.';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractNumericValue(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    const cleaned = String(val).replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

// ─── Core: process one property ──────────────────────────────────────────────

async function _processOneProperty(zpid, db, keys) {
    const RAPID_API_KEY = keys.rapidapi_key;
    const RAPID_API_HOST = keys.rapidapi_host || 'us-real-estate-listings.p.rapidapi.com';
    const RADAR_API_KEY = keys.radar_key;
    const geminiKey = keys.gemini_key;

    // 1. Fetch from RapidAPI
    const propertyUrl = `https://${RAPID_API_HOST}/property?zpid=${zpid}`;
    const propRes = await fetch(propertyUrl, {
        headers: { 'x-rapidapi-host': RAPID_API_HOST, 'x-rapidapi-key': RAPID_API_KEY }
    });
    if (!propRes.ok) throw new Error(`RapidAPI Error: ${propRes.status}`);
    const propData = await propRes.json();
    const root = propData.property || propData.props || propData;

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
    if (!root.resoFacts?.livingArea && !root.livingAreaValue && formattedAddress && geminiKey) {
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
            console.warn(`[PropertyBatch] Gemini Tax Lookup failed for ${zpid}:`, e.message);
        }
    }

    // 4. Map and Save
    const mapped = {
        zpid,
        address: formattedAddress,
        coordinates,
        city: root.address?.city,
        state: root.address?.state,
        zipCode: root.address?.zipcode,
        homeType: root.homeType,
        bedrooms: extractNumericValue(root.bedrooms),
        bathrooms: extractNumericValue(root.bathrooms),
        livingAreaValue: extractNumericValue(root.livingAreaValue || root.livingArea),
        yearBuilt: extractNumericValue(root.yearBuilt),
        price: extractNumericValue(root.price || root.listPrice),
        zestimate: extractNumericValue(root.zestimate),
        description: root.description,
        images: root.images || [],
        ...(taxData ? {
            taxSqft: taxData.tax_sqft,
            taxSqftSource: taxData.source,
            taxSqftConfidence: taxData.confidence,
            taxSqftCachedAt: new Date().toISOString(),
        } : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('properties').doc(zpid).set(mapped, { merge: true });
    return { status: 'success', address: formattedAddress };
}

// ─── Exported Function ───────────────────────────────────────────────────────

exports._processOneProperty = _processOneProperty;

exports.runPropertyDataBatchOnCreate = functions
    .runWith({ timeoutSeconds: 540, memory: '1GB' })
    .firestore
    .document('property_data_batch_jobs/{jobId}')
    .onCreate(async (snap, context) => {
        const jobData = snap.data();
        if (jobData.status !== 'queued') return null;

        const { zpids } = jobData;
        if (!Array.isArray(zpids) || zpids.length === 0) {
            await snap.ref.update({ status: 'completed', done: 0, failed: 0 });
            return null;
        }

        await snap.ref.update({ status: 'running', startedAt: admin.firestore.FieldValue.serverTimestamp() });

        const db = admin.firestore();
        const keysSnap = await db.collection('app_config').doc('api_keys').get();
        const keys = keysSnap.exists ? keysSnap.data() : {};
        
        // Map keys to match expected names or use defaults
        const apiKeys = {
            rapidapi_key: keys.rapidapi_key || process.env.RAPIDAPI_KEY,
            rapidapi_host: keys.rapidapi_host || 'us-real-estate-listings.p.rapidapi.com',
            radar_key: keys.radar_key || process.env.RADAR_KEY,
            gemini_key: keys.gemini_key || process.env.GEMINI_API_KEY,
            maps_key: keys.maps_key || process.env.MAPS_API_KEY
        };

        let done = 0, failed = 0;
        const results = {};

        for (let i = 0; i < zpids.length; i += BATCH_CONCURRENCY) {
            const wave = zpids.slice(i, i + BATCH_CONCURRENCY);
            await Promise.allSettled(
                wave.map(async (zpid) => {
                    try {
                        const res = await _processOneProperty(zpid, db, apiKeys);
                        done++;
                        results[zpid] = { status: 'success', message: `Saved: ${res.address}` };
                    } catch (e) {
                        console.error(`[PropertyBatch] ✗ ${zpid}:`, e.message);
                        failed++;
                        results[zpid] = { status: 'error', message: e.message };
                    }
                    // Update progress and partial results
                    await snap.ref.update({ 
                        done, 
                        failed, 
                        results, 
                        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
                    });
                })
            );
        }

        await snap.ref.update({
            status: 'completed',
            done,
            failed,
            results,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return null;
    });
