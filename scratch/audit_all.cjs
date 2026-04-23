/**
 * audit_all.cjs — combined Pleasanton + Dublin mismatch audit
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
        if (!gt) continue;
        const p = d.data();
        const ai = p.orientation_ai || {};
        const city = p.city || '?';
        const gtAz = gt.expected_azimuth_deg ?? null;
        const aiAz = ai.azimuth_degrees ?? null;
        const diff = (gtAz != null && aiAz != null) ? angDiff(gtAz, aiAz) : null;
        // match = within 45° OR both UNCLEAR
        const match = diff != null ? diff <= 45
            : (ai.final_orientation === gt.expected_orientation);
        rows.push({ zpid: d.id, city, address: p.address, homeType: p.homeType, ai, gt, diff, match });
    }

    const mismatches = rows.filter(r => !r.match);
    const correct = rows.filter(r => r.match);

    console.log(`\nTotal with GT: ${rows.length}  |  Correct: ${correct.length}  |  Mismatch: ${mismatches.length}\n`);

    // Sort mismatches: city, then diff desc
    mismatches.sort((a, b) => {
        if (a.city !== b.city) return a.city < b.city ? -1 : 1;
        return (b.diff ?? 999) - (a.diff ?? 999);
    });

    for (const r of mismatches) {
        const ai = r.ai;
        const expl = ai.explanation || '';
        const streetCtx = expl.match(/\(2\)[^(]*/)?.[0]?.replace(/\s+/g, ' ').trim().slice(0, 180) || '';
        const aerialEv = expl.match(/\(3\)[^(]*/)?.[0]?.replace(/\s+/g, ' ').trim().slice(0, 180) || '';
        const finalEv = expl.match(/\(5\)[^(]*/)?.[0]?.replace(/\s+/g, ' ').trim().slice(0, 120) || '';
        console.log(`CITY:    ${r.city}`);
        console.log(`ADDR:    ${r.address}`);
        console.log(`TYPE:    ${r.homeType}  layout=${ai.property_layout_type}`);
        console.log(`AI:      ${ai.final_orientation} (${ai.azimuth_degrees ?? 'null'}°)  conf=${ai.confidence}  ver=${ai.batch_version}`);
        console.log(`GT:      ${r.gt.expected_orientation} (${r.gt.expected_azimuth_deg ?? '?'}°)`);
        console.log(`DIFF:    ${r.diff != null ? r.diff + '°' : 'unclear (UNCLEAR or not run)'}`);
        console.log(`map_brg: ${ai.street_bearing_from_map ?? 'null'}  aerial_only=${ai.aerial_only_mode ?? false}  sv=${ai.street_view_shows_front ?? 'null'}`);
        if (streetCtx) console.log(`STR CTX: ${streetCtx}`);
        if (aerialEv) console.log(`AERIAL:  ${aerialEv}`);
        if (finalEv) console.log(`FINAL:   ${finalEv}`);
        console.log();
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
