'use strict';
/**
 * Diagnostic: finds aerial-only UNCLEAR Pleasanton properties,
 * reads their image_by_image_analysis, and shows which listing photos
 * likely contain an exterior/front door shot.
 */

const admin = require('firebase-admin');

// Use GOOGLE_APPLICATION_CREDENTIALS env var or inline key
const appOptions = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? { credential: admin.credential.applicationDefault() }
    : (() => {
        try {
            const key = require('/Users/ashitjain/colorado/zyphe/google-zyphe/functions/.env.json');
            return { credential: admin.credential.cert(key) };
        } catch {
            // Try firebase-admin's default app if already running with FIREBASE_CONFIG
            return {};
        }
    })();

admin.initializeApp({ ...appOptions, projectId: 'zyphe-ai' });
const db = admin.firestore();

// Keywords that suggest a photo shows the building exterior / front door
const EXTERIOR_KEYWORDS = [
    'front door', 'entryway', 'entry door', 'entrance', 'front of', 'facade', 'curb',
    'exterior', 'driveway', 'garage door', 'front yard', 'front porch', 'porch',
    'street view', 'front facing', 'front walk', 'landscaping', 'front elevation',
];

function scorePhotoForFront(analysis = '') {
    const lower = analysis.toLowerCase();
    return EXTERIOR_KEYWORDS.filter(kw => lower.includes(kw)).length;
}

async function main() {
    console.log('[Scout] Fetching Pleasanton properties...');
    const snap = await db.collection('properties')
        .where('city', '==', 'Pleasanton')
        .get();

    const aerialOnly = [];
    snap.docs.forEach(d => {
        const p = d.data();
        if (p.deprecated) return;
        const ai = p.orientation_ai;
        if (!ai || ai.aerial_only_mode !== true || ai.final_orientation !== 'UNCLEAR') return;
        aerialOnly.push({ zpid: d.id, address: p.address });
    });

    console.log(`[Scout] Found ${aerialOnly.length} aerial-only UNCLEAR Pleasanton properties. Checking first 8...`);

    const targets = aerialOnly.slice(0, 8);

    for (const { zpid, address } of targets) {
        const visualSnap = await db.collection('property_analyses_visual').doc(zpid).get();
        if (!visualSnap.exists) {
            console.log(`\n--- ${address} (${zpid})\n  [no visual analysis cached]`);
            continue;
        }
        const visual = visualSnap.data();
        const imgs = visual.image_by_image_analysis || [];
        if (imgs.length === 0) {
            console.log(`\n--- ${address} (${zpid})\n  [image_by_image_analysis empty]`);
            continue;
        }

        // Score each image and find best exterior candidates
        const scored = imgs.map((item, idx) => ({
            idx,
            url: item.image_id || '',
            analysis: item.analysis || '',
            score: scorePhotoForFront(item.analysis),
        })).sort((a, b) => b.score - a.score);

        const best = scored.filter(s => s.score > 0).slice(0, 3);
        console.log(`\n--- ${address} (${zpid})`);
        console.log(`  Total listing photos: ${imgs.length}`);
        if (best.length === 0) {
            console.log(`  No exterior photos detected in image_by_image_analysis`);
            // Show first 3 snippets so we can check manually
            imgs.slice(0, 3).forEach((item, i) => {
                console.log(`  [img ${i}] ${(item.analysis || '').slice(0, 100)}`);
            });
        } else {
            best.forEach(b => {
                console.log(`  [img ${b.idx} score=${b.score}] ${b.url.slice(0, 80)}`);
                console.log(`    → ${b.analysis.slice(0, 150)}`);
            });
        }
    }

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
