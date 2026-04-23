/**
 * diagnose_specific.cjs
 * Deep-dive into specific UNCLEAR properties — prints the full orientation_ai
 * object so we can see exactly what Gemini returned and why it ended up UNCLEAR.
 */
const admin = require('firebase-admin');
const serviceAccount = require('/Users/ashitjain/Downloads/zyphe-af0bf-firebase-adminsdk-fbsvc-7b27dbc99e.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const TARGET_ADDRESSES = [
    '1421 Calle Enrique',
    '1558 Calle Enrique',
    '150 Trenton Cir',
    '1647 Harvest Rd',
];

async function main() {
    const snap = await db.collection('properties').where('city', '==', 'Pleasanton').get();

    for (const d of snap.docs) {
        const p = d.data();
        if (!TARGET_ADDRESSES.some(a => (p.address || '').startsWith(a))) continue;

        const ai = p.orientation_ai || {};
        console.log('\n' + '═'.repeat(60));
        console.log(`ADDRESS:    ${p.address}`);
        console.log(`ZPID:       ${d.id}`);
        console.log(`HOME TYPE:  ${p.homeType || p.home_type || '(none)'}`);
        console.log(`─── orientation_ai fields ───`);
        console.log(`final_orientation:       ${ai.final_orientation}`);
        console.log(`confidence:              ${ai.confidence}`);
        console.log(`azimuth_degrees:         ${ai.azimuth_degrees ?? 'null'}`);
        console.log(`visual_azimuth_estimate: ${ai.visual_azimuth_estimate ?? 'null'}`);
        console.log(`property_layout_type:    ${ai.property_layout_type}`);
        console.log(`standard_street_layout:  ${ai.standard_street_layout}`);
        console.log(`aerial_only_mode:        ${ai.aerial_only_mode}`);
        console.log(`street_view_shows_front: ${ai.street_view_shows_front ?? 'null'}`);
        console.log(`listing_photos_used:     ${JSON.stringify(ai.listing_photos_used ?? null)}`);
        console.log(`batch_version:           ${ai.batch_version || 'unknown'}`);
        console.log(`street_bearing_deg:      ${ai.street_bearing_deg ?? ai._debug?.streetBearing ?? 'null'}`);
        console.log(`street_bearing_visual:   ${ai.street_bearing_visual_deg ?? 'null'}`);
        console.log(`_debug:                  ${JSON.stringify(ai._debug ?? {})}`);
        console.log(`─── explanation ───`);
        console.log(ai.explanation || '(none)');
    }

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
