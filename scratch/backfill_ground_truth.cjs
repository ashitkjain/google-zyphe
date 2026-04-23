
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
}

const db = admin.firestore();

const mappings = [
    { address: '2332 Carbondale Way, Dublin', orientation: 'North', azimuth: 0 },
    { address: '4934 Hibernia Dr, Dublin', orientation: 'West', azimuth: 270 },
    { address: '6668 Adare Ln, Dublin', orientation: 'Northwest', azimuth: 315 },
    { address: '6380 Monterey Way, Dublin', orientation: 'North', azimuth: 0 },
    { address: '3910 Scottfield St, Dublin', orientation: 'South', azimuth: 180 },
    { address: '11418 Betlen Dr, Dublin', orientation: 'South', azimuth: 180 },
    { address: '1676 N Terracina Dr, Dublin', orientation: 'Northeast', azimuth: 45 },
    { address: '1695 N Terracina Dr, Dublin', orientation: 'Southwest', azimuth: 225 },
    { address: '2008 Confidence Way, Dublin', orientation: 'East', azimuth: 90 },
    { address: '2100 Carbondale Cir, Dublin', orientation: 'South', azimuth: 180 },
    { address: '2539 Brandini Dr, Dublin', orientation: 'South', azimuth: 180 },
    { address: '2730 Mount Dana Dr, Dublin', orientation: 'North', azimuth: 0 },
    { address: '2813 Stringham Way, Dublin', orientation: 'Southeast', azimuth: 135 },
    { address: '2829 Mount Dana Dr, Dublin', orientation: 'Southeast', azimuth: 135 },
    { address: '2890 Sable Oaks Way, Dublin', orientation: 'Northwest', azimuth: 315 },
    { address: '2933 Stringham Way, Dublin', orientation: 'Southeast', azimuth: 135 },
    { address: '3063 Ridgefield Ct, Dublin', orientation: 'Southeast', azimuth: 135 },
    { address: '3159 Central Pkwy, Dublin', orientation: 'South', azimuth: 180 },
    { address: '3851 Hereford Rd, Dublin', orientation: 'UNDER_CONSTRUCTION', azimuth: null },
    { address: '3930 Viggo Way, Dublin', orientation: 'UNDER_CONSTRUCTION', azimuth: null },
    { address: '3938 Viggo Way, Dublin', orientation: 'UNDER_CONSTRUCTION', azimuth: null },
    { address: '3952 Viggo Way, Dublin', orientation: 'UNDER_CONSTRUCTION', azimuth: null }
];

async function updateGroundTruth() {
    console.log(`Starting ground truth update for ${mappings.length} properties...`);
    
    for (const item of mappings) {
        try {
            // 1. Find the property ZPID
            const street = item.address.split(',')[0].trim();
            const city = item.address.split(',')[1].trim();
            
            // Search by address start (to handle minor casing/suffix differences)
            const snap = await db.collection('properties')
                .where('address', '>=', street)
                .where('address', '<=', street + '\uf8ff')
                .get();
            
            if (snap.empty) {
                console.warn(`[FAIL] Could not find property with address matching: "${street}"`);
                continue;
            }
            
            // Pick the best match (usually should be only one)
            const doc = snap.docs[0];
            const zpid = doc.id;
            const data = doc.data();
            const fullAddress = data.address;
            
            console.log(`[MATCH] Found ZPID ${zpid} for "${item.address}" -> "${fullAddress}"`);
            
            // 2. Update orientation_ground_truth
            const gtRef = db.collection('orientation_ground_truth').doc(zpid);
            await gtRef.set({
                zpid,
                address: fullAddress,
                city: city,
                expected_orientation: item.orientation,
                expected_azimuth_deg: item.azimuth,
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                source: 'user_provided_spreadsheet_audit'
            }, { merge: true });
            
            console.log(`[OK] Updated ground truth for ${zpid} to ${item.orientation}`);
        } catch (e) {
            console.error(`[ERROR] Failed processing ${item.address}:`, e.message);
        }
    }
    
    console.log('Ground truth update complete.');
    process.exit(0);
}

updateGroundTruth();
