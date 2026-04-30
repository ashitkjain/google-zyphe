'use strict';
/**
 * Compares Zyphe OSM noise score vs HowLoud score from RapidAPI
 * for up to 50 Pleasanton properties.
 *
 * Run from functions/: node scratch/compare_noise_scores.js
 */
const admin = require('firebase-admin');
const turf  = require('@turf/turf');

admin.initializeApp();
const db = admin.firestore();

// ── Same constants as osmNoise.ts ─────────────────────────────────────────────
const AMBIENT_FLOOR_DB   = 42.0;
const NOISE_RADIUS_METERS = 800;
const BASE_DB = {
    motorway: 90, trunk: 84, primary: 78,
    secondary: 70, tertiary: 62, rail: 85, runway: 95
};

async function fetchOsmAndComputeScore(lat, lng) {
    const bbox = turf.bbox(turf.circle([lng, lat], 1, { units: 'kilometers' }));
    const [minLng, minLat, maxLng, maxLat] = bbox;

    const query = `
        [out:json][timeout:25];
        (
          way["highway"~"motorway|trunk|primary|secondary|tertiary"](${minLat},${minLng},${maxLat},${maxLng});
          way["railway"="rail"](${minLat},${minLng},${maxLat},${maxLng});
          way["aeroway"="runway"](${minLat},${minLng},${maxLat},${maxLng});
          way["building"](${minLat},${minLng},${maxLat},${maxLng});
        );
        out body;>;out skel qt;
    `;

    const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded',
                   'User-Agent': 'Zyphe-Noise-Compare/1.0' },
    });
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    const data = await res.json();

    const nodes = new Map();
    data.elements.filter(e => e.type === 'node').forEach(n => nodes.set(n.id, [n.lon, n.lat]));

    const roads = [], buildings = [];
    data.elements.filter(e => e.type === 'way').forEach(w => {
        const coords = w.nodes.map(id => nodes.get(id)).filter(Boolean);
        if (coords.length < 2) return;
        if (w.tags && w.tags.building) {
            if (w.nodes[0] === w.nodes[w.nodes.length - 1] && coords.length > 3)
                buildings.push(turf.polygon([coords], w.tags));
        } else {
            roads.push(turf.lineString(coords, w.tags));
        }
    });

    const prop = turf.point([lng, lat]);
    let totalEnergy = Math.pow(10, AMBIENT_FLOOR_DB / 10);
    let maxDb = AMBIENT_FLOOR_DB, primarySource = 'Ambient';

    for (const road of roads) {
        const t = road.properties.highway || (road.properties.railway ? 'rail' : 'runway');
        const baseDb = BASE_DB[t] || 60;
        const closest = turf.nearestPointOnLine(road, prop);
        const dist = turf.distance(prop, closest, { units: 'meters' });
        if (dist > NOISE_RADIUS_METERS) continue;

        const los = turf.lineString([[lng, lat], closest.geometry.coordinates]);
        let barriers = 0;
        for (const b of buildings) { if (turf.booleanIntersects(los, b)) barriers++; }
        const barrierDb = barriers === 1 ? 8 : barriers === 2 ? 11 : Math.min(20, 11 + (barriers - 2));

        const finalDb = baseDb - 20 * Math.log10(Math.max(dist, 10) / 10) - barrierDb;
        if (finalDb > maxDb) {
            maxDb = finalDb;
            primarySource = (road.properties.name || t);
        }
        totalEnergy += Math.pow(10, finalDb / 10);
    }

    const totalDb = 10 * Math.log10(totalEnergy);
    const score = Math.max(0, Math.min(100, Math.round(100 - (totalDb - AMBIENT_FLOOR_DB) * (100 / (85 - AMBIENT_FLOOR_DB)))));
    return { score, totalDb: Math.round(totalDb), primarySource };
}

function pad(s, n) { return String(s ?? '—').padEnd(n); }

async function main() {
    console.log('\n🔊  Noise Score Comparison — Pleasanton (up to 50 properties)\n');

    const snap = await db.collection('properties')
        .where('city', '==', 'Pleasanton')
        .limit(50)
        .get();

    if (snap.empty) { console.log('No Pleasanton properties found.'); return; }

    const props = snap.docs.map(d => ({ zpid: d.id, ...d.data() }));
    console.log(`Found ${props.length} properties.\n`);

    const rows = [];
    rows.push([pad('ZPID',12), pad('Address',36), pad('HowLoud',9), pad('Zyphe',7), pad('Diff',6), pad('Est.dB',8), 'Primary Source'].join(' | '));
    rows.push('─'.repeat(115));

    const diffs = [], scores = { hasBoth:0, onlyHL:0, onlyZ:0, neither:0 };

    for (const p of props) {
        const lat = p.coordinates?.latitude  ?? p.latitude;
        const lng = p.coordinates?.longitude ?? p.longitude;
        const howLoud = p.noiseScore ?? null;        // HowLoud from RapidAPI (50–100)
        let zyphe    = p.zypheNoiseScore ?? null;    // Our OSM score (0–100)
        let estDb = '—', primarySrc = '';

        // Compute live if missing and we have coords
        if (zyphe == null && lat && lng) {
            process.stdout.write(`  Simulating ${p.zpid}...`);
            try {
                const r = await fetchOsmAndComputeScore(lat, lng);
                zyphe = r.score; estDb = r.totalDb; primarySrc = r.primarySource;
                process.stdout.write(` ${zyphe} (${r.totalDb} dB) — ${r.primarySource}\n`);
                await new Promise(r => setTimeout(r, 2500));   // Overpass rate limit
            } catch(e) {
                process.stdout.write(` ERROR: ${e.message}\n`);
            }
        } else if (zyphe != null) {
            primarySrc = p.primaryNoiseSource || '';
        }

        if (howLoud != null && zyphe != null) { scores.hasBoth++; diffs.push(zyphe - howLoud); }
        else if (howLoud != null) scores.onlyHL++;
        else if (zyphe  != null) scores.onlyZ++;
        else scores.neither++;

        const diffStr = (howLoud != null && zyphe != null) ? (zyphe - howLoud >= 0 ? '+' : '') + (zyphe - howLoud) : '—';
        rows.push([
            pad(p.zpid.substring(0,10), 12),
            pad((p.address||'').substring(0,34), 36),
            pad(howLoud != null ? howLoud : 'N/A', 9),
            pad(zyphe   != null ? zyphe   : 'N/A', 7),
            pad(diffStr, 6),
            pad(estDb, 8),
            primarySrc.substring(0,30),
        ].join(' | '));
    }

    console.log('\n' + rows.join('\n'));
    console.log('\n' + '─'.repeat(115));

    console.log('\n📊  SUMMARY');
    console.log(`   Both scores present   : ${scores.hasBoth}`);
    console.log(`   Only HowLoud          : ${scores.onlyHL}`);
    console.log(`   Only Zyphe            : ${scores.onlyZ}`);
    console.log(`   Neither               : ${scores.neither}`);

    if (diffs.length > 0) {
        const avg    = diffs.reduce((a,b)=>a+b,0)/diffs.length;
        const absAvg = diffs.map(Math.abs).reduce((a,b)=>a+b,0)/diffs.length;
        const sorted = [...diffs].sort((a,b)=>a-b);
        console.log(`\n   Zyphe − HowLoud:`);
        console.log(`     Mean bias           : ${avg.toFixed(1)}`);
        console.log(`     Mean absolute error : ${absAvg.toFixed(1)}`);
        console.log(`     Range               : ${sorted[0]} to ${sorted[sorted.length-1]}`);
        console.log(`\n   Scales:`);
        console.log(`     HowLoud: 50=very loud, 100=very quiet`);
        console.log(`     Zyphe  :  0=very loud, 100=very quiet`);
        console.log(`     Positive diff → Zyphe thinks quieter than HowLoud`);
        console.log(`     Negative diff → Zyphe thinks louder  than HowLoud`);
    }
    console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
