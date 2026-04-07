/**
 * Flattens city data structure in Firestore.
 *
 * Old structure:
 *   cities/{key}/index/neighborhoods
 *   cities/{key}/index/context_graph
 *   cities/{key}/index/zips          → renamed to city_zips
 *   cities/{key}/intel/deep_research
 *   cities/{key}/intel/market_intelligence
 *   cities/{key}/intel/community_pulse
 *
 * New flat structure (all under one 'data' subcollection):
 *   cities/{key}/data/neighborhoods
 *   cities/{key}/data/context_graph
 *   cities/{key}/data/city_zips
 *   cities/{key}/data/deep_research
 *   cities/{key}/data/market_intelligence
 *   cities/{key}/data/community_pulse
 *
 * Also writes a parent city doc at cities/{key} so getAllMinedCities() works.
 *
 * Usage:
 *   npx tsx scripts/flatten_city_structure.ts
 */

import admin from 'firebase-admin';

const PROJECT_ID = 'zyphe-af0bf';
if (admin.apps.length === 0) admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const MIGRATIONS = [
    { from: { sub: 'index', doc: 'neighborhoods' }, to: { sub: 'data', doc: 'neighborhoods' } },
    { from: { sub: 'index', doc: 'context_graph' }, to: { sub: 'data', doc: 'context_graph' } },
    { from: { sub: 'index', doc: 'zips' },          to: { sub: 'data', doc: 'city_zips' } },
    { from: { sub: 'intel', doc: 'deep_research' },       to: { sub: 'data', doc: 'deep_research' } },
    { from: { sub: 'intel', doc: 'market_intelligence' }, to: { sub: 'data', doc: 'market_intelligence' } },
    { from: { sub: 'intel', doc: 'community_pulse' },     to: { sub: 'data', doc: 'community_pulse' } },
];

async function getAllCityKeys(): Promise<string[]> {
    const refs = await db.collection('cities').listDocuments();
    return refs.map(r => r.id);
}

async function main() {
    console.log('=== Flatten City Data Structure ===');
    console.log(`Project: ${PROJECT_ID}\n`);

    const cities = await getAllCityKeys();
    console.log(`Found ${cities.length} city key(s):`, cities, '\n');

    for (const key of cities) {
        console.log(`── ${key} ──`);

        for (const { from, to } of MIGRATIONS) {
            const fromRef = db.doc(`cities/${key}/${from.sub}/${from.doc}`);
            const toRef   = db.doc(`cities/${key}/${to.sub}/${to.doc}`);

            const snap = await fromRef.get();
            if (!snap.exists) {
                console.log(`  skip  ${from.sub}/${from.doc} (not found)`);
                continue;
            }

            const existing = await toRef.get();
            if (!existing.exists) {
                await toRef.set(snap.data()!);
                console.log(`  moved ${from.sub}/${from.doc} → ${to.sub}/${to.doc}`);
            } else {
                console.log(`  skip  ${to.sub}/${to.doc} already exists at target`);
            }

            await fromRef.delete();
            console.log(`  deleted ${from.sub}/${from.doc}`);
        }

        // Write/update the parent city doc for getAllMinedCities()
        const neighborsSnap = await db.doc(`cities/${key}/data/neighborhoods`).get();
        const neighborsData = neighborsSnap.data();
        await db.doc(`cities/${key}`).set({
            city: neighborsData?.city || key,
            state: neighborsData?.state || '',
            total_neighborhoods: neighborsData?.neighborhoods?.length || 0,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log(`  wrote parent doc cities/${key}`);
    }

    console.log('\n=== Done. ===');
}

main()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
