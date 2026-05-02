#!/usr/bin/env node
/**
 * Env Diagnostics + Healing Script
 *
 * 1. Reads env docs for the specified zpids from Firestore.
 * 2. Prints what fields are present/missing and the current __env_version.
 * 3. Directly calls supplemental enrichment APIs (solar, AQ, pollen, noise)
 *    for any zpid that is missing those fields.
 *
 * Usage:
 *   node functions/diagEnv.js [zpid1 zpid2 ...]
 *   # If no zpids given, uses the 4 failing Pleasanton properties from smoke test.
 */
'use strict';

const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { calculateZypheNoiseScore } = require('./shared/osmNoise');
const { _enrichNearbyPlaces, _enrichBroadband, _enrichDrought, _enrichEVChargers, _enrichHistoricalDisasters, ENV_SCHEMA_VERSION } = require('./shared/propertyUtils');

try { admin.initializeApp({ projectId: 'zyphe-af0bf' }); } catch (e) {}
const db = admin.firestore();

const MAPS_API_KEY = process.env.MAPS_API_KEY || '';
const GEMINI_KEY   = process.env.GEMINI_API_KEY || '';

const DEFAULT_ZPIDS = ['25079229', '25079576', '25078136', '25079951'];

async function diagAndHeal(zpid) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`ZPID: ${zpid}`);
    console.log('═'.repeat(60));

    const propRef  = db.collection('properties').doc(zpid);
    const envRef   = propRef.collection('environmental').doc('thirdparty_data');
    const [propSnap, envSnap] = await Promise.all([propRef.get(), envRef.get()]);

    if (!propSnap.exists) { console.log('  ❌ Property doc does not exist'); return; }
    const prop = propSnap.data();
    const lat  = prop.coordinates?.latitude;
    const lng  = prop.coordinates?.longitude;
    console.log(`  Address : ${prop.streetAddress || prop.address || zpid}`);
    console.log(`  HomeType: ${prop.homeType}`);
    console.log(`  Coords  : ${lat}, ${lng}`);

    if (!envSnap.exists) {
        console.log('  ⚠️  No env doc found — needs full enrichment (run Full Intel)');
        return;
    }

    const env = envSnap.data();
    const version = env.__env_version || 0;
    const lastUpdated = env.lastUpdated?.toDate?.()?.toLocaleDateString() || '?';

    console.log(`\n  Env doc  : v${version} (current target: v${ENV_SCHEMA_VERSION}) · last updated ${lastUpdated}`);

    const fields = [
        { name: 'solarData',              present: !!env.solarData },
        { name: 'airQuality',             present: !!env.airQuality },
        { name: 'pollen',                 present: !!env.pollen },
        { name: 'pollen.analysis',        present: !!env.pollen?.analysis?.breathe_easy_summary },
        { name: 'zypheNoiseScore',        present: env.zypheNoiseScore != null },
        { name: 'broadband',              present: !!env.broadband },
        { name: 'drought',                present: !!env.drought },
        { name: 'evChargers',             present: !!env.evChargers },
        { name: 'google_places',          present: !!env.google_places },
        { name: 'historical_disasters',   present: !!env.historical_disasters?.seismicZone },
    ];

    console.log('\n  Field status:');
    for (const f of fields) {
        console.log(`    ${f.present ? '✅' : '❌'} ${f.name}`);
    }

    const propFields = [
        { name: 'walkScore',     present: prop.walkScore != null },
        { name: 'parcelPolygon', present: !!prop.parcelPolygon },
        { name: 'parcelNotFound',present: !!prop.parcelNotFound },
        { name: 'satelliteImageUrl', present: !!prop.satelliteImageUrl },
    ];
    console.log('\n  Property doc fields:');
    for (const f of propFields) {
        console.log(`    ${f.present ? '✅' : '❌'} ${f.name}`);
    }

    if (!lat || !lng) {
        console.log('\n  ⚠️  No coordinates — skipping enrichment');
        return;
    }

    // ── Heal missing fields ───────────────────────────────────────────────────
    console.log('\n  Healing missing fields...');
    const updates = {};

    // Solar
    if (!env.solarData) {
        process.stdout.write('    → Solar API... ');
        try {
            const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${MAPS_API_KEY}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.solarPotential) {
                    updates.solarData = {
                        maxSunshineHoursPerYear: data.solarPotential.maxSunshineHoursPerYear,
                        carbonOffsetFactorKgPerMwh: data.solarPotential.carbonOffsetFactorKgPerMwh,
                        panelCapacityWatts: data.solarPotential.panelCapacityWatts,
                        maxArrayPanelsCount: (data.solarPotential.solarPanels || []).length,
                    };
                    console.log(`✅ ${updates.solarData.maxSunshineHoursPerYear} hrs/yr`);
                } else {
                    console.log('⚠️  ok but no solarPotential in response');
                }
            } else if (res.status === 404) {
                updates.solarData = { unavailable: true };
                console.log('⚠️  No solar coverage (404) — marking unavailable');
            } else {
                const body = await res.text();
                console.log(`❌ HTTP ${res.status}: ${body.slice(0, 120)}`);
            }
        } catch (e) { console.log(`❌ ${e.message}`); }
    }

    // Air Quality
    if (!env.airQuality) {
        process.stdout.write('    → Air Quality API... ');
        try {
            const url = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${MAPS_API_KEY}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ location: { latitude: lat, longitude: lng }, languageCode: 'en' })
            });
            if (res.ok) {
                const data = await res.json();
                const uaqi = data.indexes?.find(i => i.code === 'uaqi') || data.indexes?.[0];
                if (uaqi) {
                    updates.airQuality = { aqi: uaqi.aqi, category: uaqi.category, dominantPollutant: data.dominantPollutant };
                    console.log(`✅ AQI ${uaqi.aqi} (${uaqi.category})`);
                } else {
                    console.log(`⚠️  no uaqi index in response: ${JSON.stringify(data).slice(0, 120)}`);
                }
            } else {
                const body = await res.text();
                console.log(`❌ HTTP ${res.status}: ${body.slice(0, 120)}`);
            }
        } catch (e) { console.log(`❌ ${e.message}`); }
    }

    // Pollen
    if (!env.pollen) {
        process.stdout.write('    → Pollen API... ');
        try {
            const url = `https://pollen.googleapis.com/v1/forecast:lookup?key=${MAPS_API_KEY}&location.latitude=${lat}&location.longitude=${lng}&days=1`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                const today = data.dailyInfo?.[0];
                if (today) {
                    const maxPollen = today.pollenTypeInfo?.reduce((prev, curr) =>
                        (prev.indexInfo?.value || 0) > (curr.indexInfo?.value || 0) ? prev : curr);
                    updates.pollen = {
                        score: maxPollen?.indexInfo?.value,
                        category: maxPollen?.indexInfo?.category,
                        dominantPollenType: maxPollen?.displayName,
                        pollenTypes: today.pollenTypeInfo?.map(p => ({
                            type: p.displayName,
                            inSeason: p.inSeason,
                            indexValue: p.indexInfo?.value,
                            indexCategory: p.indexInfo?.category,
                        })) || [],
                    };
                    console.log(`✅ ${updates.pollen.category || 'fetched'} (${updates.pollen.dominantPollenType})`);
                } else {
                    console.log(`⚠️  no dailyInfo in response`);
                }
            } else {
                const body = await res.text();
                console.log(`❌ HTTP ${res.status}: ${body.slice(0, 120)}`);
            }
        } catch (e) { console.log(`❌ ${e.message}`); }
    }

    // Noise
    if (env.zypheNoiseScore == null) {
        process.stdout.write('    → Noise simulation... ');
        try {
            const result = await calculateZypheNoiseScore(lat, lng);
            if (result) {
                updates.zypheNoiseScore = result.score;
                updates.noiseCharacterization = result.characterization;
                updates.primaryNoiseSource = result.primarySource;
                updates.noiseSimulationFetchedAt = new Date().toISOString();
                console.log(`✅ score=${result.score} (${result.characterization})`);
            } else {
                console.log('⚠️  returned null');
            }
        } catch (e) { console.log(`❌ ${e.message}`); }
    }

    // Broadband
    if (!env.broadband) {
        process.stdout.write('    → Broadband... ');
        try {
            await _enrichBroadband(zpid, db, lat, lng);
            console.log('✅');
        } catch (e) { console.log(`❌ ${e.message}`); }
    }

    // Drought
    if (!env.drought) {
        process.stdout.write('    → Drought... ');
        try {
            await _enrichDrought(zpid, db, lat, lng);
            console.log('✅');
        } catch (e) { console.log(`❌ ${e.message}`); }
    }

    // EV Chargers
    if (!env.evChargers) {
        process.stdout.write('    → EV Chargers... ');
        try {
            await _enrichEVChargers(zpid, db, lat, lng);
            console.log('✅');
        } catch (e) { console.log(`❌ ${e.message}`); }
    }

    // Nearby Places
    if (!env.google_places) {
        process.stdout.write('    → Nearby Places... ');
        try {
            await _enrichNearbyPlaces(zpid, db, lat, lng, MAPS_API_KEY);
            console.log('✅');
        } catch (e) { console.log(`❌ ${e.message}`); }
    }

    // Historical Disasters / Seismic
    if (!env.historical_disasters?.seismicZone) {
        process.stdout.write('    → Historical Disasters / Seismic... ');
        try {
            await _enrichHistoricalDisasters(zpid, db, lat, lng);
            console.log('✅');
        } catch (e) { console.log(`❌ ${e.message}`); }
    }

    // Write accumulated env updates + bump version
    if (Object.keys(updates).length > 0) {
        updates.__env_version = ENV_SCHEMA_VERSION;
        await envRef.update(updates);
        console.log(`\n  ✅ Env doc updated (${Object.keys(updates).length} fields)`);
    } else {
        // Still bump version even if nothing changed
        await envRef.update({ __env_version: ENV_SCHEMA_VERSION });
        console.log('\n  ✅ No new fields needed — version bumped');
    }

    // Pollen AI heal (if pollen data now exists but analysis missing)
    const freshEnvSnap = await envRef.get();
    const freshEnv = freshEnvSnap.data();
    if (freshEnv?.pollen && !freshEnv.pollen?.analysis?.breathe_easy_summary) {
        process.stdout.write('    → Pollen AI analysis... ');
        try {
            const { getPollenAnalysisPrompt, POLLEN_ANALYSIS_SCHEMA } = require('./prompts/property/pollenAnalysis.js');
            const genAI = new GoogleGenerativeAI(GEMINI_KEY);
            const model = genAI.getGenerativeModel({
                model: 'gemini-2.5-flash',
                generationConfig: { responseMimeType: 'application/json', responseSchema: POLLEN_ANALYSIS_SCHEMA }
            });
            const ctx = {
                dominantPollenType: freshEnv.pollen.dominantPollenType,
                overallScore: freshEnv.pollen.score,
                category: freshEnv.pollen.category,
                pollenTypes: freshEnv.pollen.pollenTypes || [],
            };
            const result = await model.generateContent(getPollenAnalysisPrompt(ctx));
            const { _extractJson } = require('./shared/propertyUtils');
            const analysis = _extractJson(result.response.text());
            if (analysis?.breathe_easy_summary) {
                await envRef.update({ 'pollen.analysis': analysis });
                console.log('✅');
            } else {
                console.log('⚠️  no breathe_easy_summary in response');
            }
        } catch (e) { console.log(`❌ ${e.message}`); }
    }
}

async function main() {
    const zpids = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ZPIDS;
    console.log(`\nEnv Diagnostics + Healing for ${zpids.length} properties`);
    console.log(`Target schema version: v${ENV_SCHEMA_VERSION}\n`);

    for (const zpid of zpids) {
        await diagAndHeal(zpid);
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log('Done. Re-run the smoke test to verify.');
    process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
