/**
 * audit_all2.cjs — concise mismatch table, Pleasanton + Dublin
 * Only rows with real GT (non-null expected_orientation) and that have been run.
 * Groups: (A) diff > 45°, (B) UNCLEAR when GT is directional, (C) never run
 */
const admin = require('firebase-admin');
const sa = require('/Users/ashitjain/Downloads/zyphe-af0bf-firebase-adminsdk-fbsvc-7b27dbc99e.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

async function main() {
    const [propSnap, gtSnap] = await Promise.all([
        db.collection('properties').where('city', 'in', ['Pleasanton', 'Dublin']).get(),
        db.collection('orientation_ground_truth').get(),
    ]);

    const gtMap = {};
    for (const d of gtSnap.docs) gtMap[d.id] = d.data();

    const rows = [];
    for (const d of propSnap.docs) {
        const gt = gtMap[d.id];
        if (!gt || !gt.expected_orientation || gt.expected_orientation === 'null') continue;
        const p = d.data();
        const ai = p.orientation_ai || {};
        const city = p.city || '?';
        const gtAz = gt.expected_azimuth_deg ?? null;
        const aiAz = ai.azimuth_degrees ?? null;
        const diff = (gtAz != null && aiAz != null) ? angDiff(gtAz, aiAz) : null;
        const match = diff != null ? diff <= 45 : (ai.final_orientation === gt.expected_orientation);

        if (!match) {
            const ver = ai.batch_version;
            let group;
            if (!ver || ver === 'undefined') group = 'C_never_run';
            else if (!aiAz && ai.final_orientation === 'UNCLEAR') group = 'B_unclear';
            else group = 'A_wrong';

            // root cause hints
            const expl = ai.explanation || '';
            const streetCtx = expl.match(/\(2\)[^(]*/)?.[0]?.replace(/\s+/g, ' ').trim().slice(0, 150) || '';

            rows.push({
                city, group, ver,
                address: (p.address || '').replace(/, CA.*/, ''),
                homeType: p.homeType || '?',
                layout: ai.property_layout_type || '?',
                aiResult: ai.final_orientation || 'none',
                aiAz, gtResult: gt.expected_orientation, gtAz,
                diff,
                conf: ai.confidence || '?',
                bearing_map: ai.street_bearing_from_map ?? null,
                aerial_only: ai.aerial_only_mode ?? false,
                sv: ai.street_view_shows_front,
                streetCtx,
            });
        }
    }

    // Sort: city, group, diff desc
    rows.sort((a, b) => {
        if (a.city !== b.city) return a.city < b.city ? -1 : 1;
        if (a.group !== b.group) return a.group < b.group ? -1 : 1;
        return (b.diff ?? 999) - (a.diff ?? 999);
    });

    // Print TSV-ish table
    console.log('\n== MISMATCH SUMMARY TABLE ==\n');
    console.log(['City','Address','Type','Layout','AI Result','AI°','GT','GT°','Diff°','Ver','BearingMap','AerialOnly','SV'].join('\t'));
    for (const r of rows) {
        console.log([
            r.city, r.address, r.homeType, r.layout,
            r.aiResult, r.aiAz ?? '-', r.gtResult, r.gtAz ?? '-',
            r.diff ?? 'unclear', r.ver || 'NOT RUN',
            r.bearing_map ?? '-', r.aerial_only ? 'yes' : 'no',
            r.sv == null ? 'null' : r.sv ? 'true' : 'false',
        ].join('\t'));
    }

    console.log(`\nTotal mismatches: ${rows.length}`);
    console.log(`  A (wrong direction):   ${rows.filter(r=>r.group==='A_wrong').length}`);
    console.log(`  B (UNCLEAR, GT known): ${rows.filter(r=>r.group==='B_unclear').length}`);
    console.log(`  C (never run):         ${rows.filter(r=>r.group==='C_never_run').length}`);
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
