/**
 * audit_pleasanton.cjs
 * Pulls all Pleasanton properties that have ground truth, compares with AI result,
 * and prints a detailed mismatch report with root-cause hints.
 */
const admin = require('firebase-admin');
const sa = require('/Users/ashitjain/Downloads/zyphe-af0bf-firebase-adminsdk-fbsvc-7b27dbc99e.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

async function main() {
    const [propSnap, gtSnap] = await Promise.all([
        db.collection('properties').where('city', '==', 'Pleasanton').get(),
        db.collection('orientation_ground_truth').get(),
    ]);

    const gtMap = {};
    for (const d of gtSnap.docs) {
        const g = d.data();
        if (g.city === 'Pleasanton' || (g.address || '').includes('Pleasanton')) {
            gtMap[d.id] = g;
        }
    }

    const rows = [];
    for (const d of propSnap.docs) {
        const gt = gtMap[d.id];
        if (!gt) continue;
        const p = d.data();
        const ai = p.orientation_ai || {};
        const gtAz = gt.expected_azimuth_deg ?? null;
        const aiAz = ai.azimuth_degrees ?? null;
        const diff = (gtAz != null && aiAz != null) ? angDiff(gtAz, aiAz) : null;
        const match = diff != null ? diff <= 45 : (ai.final_orientation === gt.expected_orientation);
        rows.push({ zpid: d.id, address: p.address, homeType: p.homeType, ai, gt, diff, match });
    }

    rows.sort((a, b) => {
        if (a.match !== b.match) return a.match ? 1 : -1;
        return (a.diff ?? 999) - (b.diff ?? 999);
    });

    const mismatches = rows.filter(r => !r.match);
    const matches = rows.filter(r => r.match);

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`PLEASANTON AUDIT — ${mismatches.length} mismatches, ${matches.length} correct`);
    console.log(`${'═'.repeat(70)}\n`);

    for (const r of mismatches) {
        const ai = r.ai;
        console.log(`ADDRESS:     ${r.address}`);
        console.log(`home type:   ${r.homeType}`);
        console.log(`layout:      ${ai.property_layout_type}`);
        console.log(`AI result:   ${ai.final_orientation} (${ai.azimuth_degrees ?? 'null'}°)  conf=${ai.confidence}`);
        console.log(`GT:          ${r.gt.expected_orientation} (${r.gt.expected_azimuth_deg ?? '?'}°)`);
        console.log(`diff:        ${r.diff != null ? r.diff + '°' : 'unclear'}`);
        console.log(`version:     ${ai.batch_version}`);
        console.log(`bearing_map: ${ai.street_bearing_from_map ?? 'null'}`);
        console.log(`aerial_only: ${ai.aerial_only_mode ?? false}`);
        console.log(`sv_shows:    ${ai.street_view_shows_front ?? 'null'}`);
        // Street context from explanation
        const expl = ai.explanation || '';
        const ctx = expl.match(/\(2\)[^(]*/)?.[0]?.replace(/\s+/g, ' ').trim() || '(none)';
        const aerial = expl.match(/\(3\)[^(]*/)?.[0]?.replace(/\s+/g, ' ').trim() || '(none)';
        console.log(`street ctx:  ${ctx.slice(0, 200)}`);
        console.log(`aerial evid: ${aerial.slice(0, 200)}`);
        console.log();
    }

    console.log(`${'─'.repeat(70)}`);
    console.log(`CORRECT (${matches.length}):`);
    for (const r of matches) {
        console.log(`  ✓ ${r.address} — AI=${r.ai.final_orientation}, GT=${r.gt.expected_orientation}, diff=${r.diff ?? '?'}°, layout=${r.ai.property_layout_type}`);
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
