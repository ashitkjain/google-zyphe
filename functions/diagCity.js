#!/usr/bin/env node
/**
 * City-wide smoke diagnostics — finds which zpids are actually failing on each check.
 * Usage: node functions/diagCity.js [cityName]
 * Default city: Pleasanton
 */
'use strict';

const admin = require('firebase-admin');
try { admin.initializeApp({ projectId: 'zyphe-af0bf' }); } catch (e) {}
const db = admin.firestore();

const CITY = process.argv[2] || 'Pleasanton';

async function main() {
    console.log(`\nCity Diagnostics for: ${CITY}\n`);

    // 1. Get all zpids for this city
    const snap = await db.collection('properties')
        .where('city', '==', CITY)
        .select('city', 'homeType', 'streetAddress', 'coordinates', 'orientation_ai', 'parcelPolygon', 'parcelNotFound', 'walkScore')
        .get();

    const zpids = snap.docs.map(d => d.id);
    console.log(`Found ${zpids.length} properties in ${CITY}\n`);

    if (zpids.length === 0) return;

    // 2. Batch-fetch env docs and analysis docs
    const CHUNK = 10;
    const envMap = {};
    const visualMap = {};
    const insightsMap = {};
    const fitMap = {};
    const investMap = {};
    const propMap = {};

    snap.docs.forEach(d => { propMap[d.id] = d.data(); });

    for (let i = 0; i < zpids.length; i += CHUNK) {
        const chunk = zpids.slice(i, i + CHUNK);
        await Promise.all(chunk.map(async zpid => {
            const [envSnap, visualSnap, insightsSnap, fitSnap, investSnap] = await Promise.all([
                db.collection('properties').doc(zpid).collection('environmental').doc('thirdparty_data').get(),
                db.collection('properties').doc(zpid).collection('analysis').doc('visual').get(),
                db.collection('properties').doc(zpid).collection('analysis').doc('lifestyle_insights').get(),
                db.collection('properties').doc(zpid).collection('analysis').doc('lifestyle_fit').get(),
                db.collection('properties').doc(zpid).collection('analysis').doc('investment').get(),
            ]);
            if (envSnap.exists)      envMap[zpid]      = envSnap.data();
            if (visualSnap.exists)   visualMap[zpid]   = visualSnap.data();
            if (insightsSnap.exists) insightsMap[zpid] = insightsSnap.data();
            if (fitSnap.exists)      fitMap[zpid]       = fitSnap.data();
            if (investSnap.exists)   investMap[zpid]    = investSnap.data();
        }));
        process.stdout.write(`\r  Fetching... ${Math.min(i + CHUNK, zpids.length)}/${zpids.length}`);
    }
    console.log('\n');

    // 3. Analyze failures
    const checks = {
        noEnvDoc:           [],
        envVersionOld:      [],
        missingSolar:       [],
        missingAirQuality:  [],
        missingPollen:      [],
        missingPollenAi:    [],
        missingNoise:       [],
        missingBroadband:   [],
        missingSeismic:     [],
        missingParcel:      [],
        noVisual:           [],
        noLifestyleInsights:[],
        noLifestyleFit:     [],
        noInvestment:       [],
        orientMissing:      [],
        orientOldVersion:   [],
        orientLowConf:      [],
    };

    for (const zpid of zpids) {
        const env  = envMap[zpid];
        const prop = propMap[zpid];
        const vis  = visualMap[zpid];

        const addr = prop?.streetAddress || zpid;

        if (!env) { checks.noEnvDoc.push(`${zpid} (${addr})`); continue; }

        const v = env.__env_version || 0;
        if (v < 3) checks.envVersionOld.push(`${zpid} (${addr}) — v${v}`);

        if (!env.solarData)                              checks.missingSolar.push(`${zpid} (${addr})`);
        if (!env.airQuality)                             checks.missingAirQuality.push(`${zpid} (${addr})`);
        if (!env.pollen)                                 checks.missingPollen.push(`${zpid} (${addr})`);
        if (env.pollen && !env.pollen?.analysis?.breathe_easy_summary) checks.missingPollenAi.push(`${zpid} (${addr})`);
        if (env.zypheNoiseScore == null)                 checks.missingNoise.push(`${zpid} (${addr})`);
        if (!env.broadband)                              checks.missingBroadband.push(`${zpid} (${addr})`);
        if (!env.historical_disasters?.seismicZone)      checks.missingSeismic.push(`${zpid} (${addr})`);

        if (!prop.parcelPolygon && !prop.parcelNotFound) checks.missingParcel.push(`${zpid} (${addr})`);

        if (!vis?.home_interior?.overall_description)    checks.noVisual.push(`${zpid} (${addr})`);

        const ins = insightsMap[zpid];
        if (!ins?.outdoor)                               checks.noLifestyleInsights.push(`${zpid} (${addr})`);

        const fit = fitMap[zpid];
        if (!fit?.working_professionals?.verdict)        checks.noLifestyleFit.push(`${zpid} (${addr})`);

        const inv = investMap[zpid];
        if (!inv?.str_performance?.adr)                  checks.noInvestment.push(`${zpid} (${addr})`);

        const oa = prop.orientation_ai;
        if (!oa?.final_orientation || oa.final_orientation === 'UNCLEAR') checks.orientMissing.push(`${zpid} (${addr})`);
        else if (oa.orientation_version !== 'v30' && oa.batch_version !== 'v30') checks.orientOldVersion.push(`${zpid} (${addr})`);
        else if (oa.confidence !== 'high') checks.orientLowConf.push(`${zpid} (${addr})`);
    }

    // 4. Print summary
    const labels = {
        noEnvDoc:           'No env doc at all',
        envVersionOld:      'Env doc old version (< v3)',
        missingSolar:       'Missing solarData',
        missingAirQuality:  'Missing airQuality',
        missingPollen:      'Missing pollen',
        missingPollenAi:    'Missing pollen AI analysis',
        missingNoise:       'Missing zypheNoiseScore',
        missingBroadband:   'Missing broadband',
        missingSeismic:     'Missing seismicZone',
        missingParcel:      'Missing parcelPolygon (no parcelNotFound flag)',
        noVisual:           'Missing AI Visual analysis',
        noLifestyleInsights:'Missing Lifestyle Insights',
        noLifestyleFit:     'Missing Lifestyle Fit',
        noInvestment:       'Missing Investment Research',
        orientMissing:      'Orientation missing/UNCLEAR',
        orientOldVersion:   'Orientation old version (<v30)',
        orientLowConf:      'Orientation low confidence',
    };

    for (const [key, list] of Object.entries(checks)) {
        if (list.length === 0) continue;
        console.log(`\n❌ ${labels[key]} (${list.length}):`);
        list.slice(0, 10).forEach(s => console.log(`   ${s}`));
        if (list.length > 10) console.log(`   ... and ${list.length - 10} more`);
    }

    // 5. Print zpids for missing solar (for targeted healing)
    const solarMissingZpids = zpids.filter(z => envMap[z] && !envMap[z].solarData);
    if (solarMissingZpids.length > 0) {
        console.log(`\n\nZPIDs missing solar (for diagEnv.js):\n${solarMissingZpids.join(' ')}`);
    }

    console.log('\n\nDone.');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
