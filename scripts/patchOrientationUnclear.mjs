/**
 * One-time script: patch stale orientation_ai entries where
 * final_orientation is NOT 'UNCLEAR'/'UNCLEAR_IMAGE' but
 * aerial_only_mode=true AND confidence != 'high'.
 *
 * These were incorrectly stored with a guessed direction (e.g. 'East (~75°)')
 * before the fix to satellitaryService.ts. The fix ensures new analyses emit
 * 'UNCLEAR' in these cases, but existing Firestore docs need to be patched.
 *
 * Usage: node scripts/patchOrientationUnclear.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load service account key — adjust path if needed
const serviceAccount = JSON.parse(
    readFileSync(resolve(__dirname, '../serviceAccountKey.json'), 'utf8')
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
    console.log('Scanning properties for stale orientation_ai entries...\n');

    // Fetch all properties that have orientation_ai set
    const snap = await db.collection('properties')
        .where('orientation_ai', '!=', null)
        .get();

    const toFix = [];
    for (const docSnap of snap.docs) {
        const d = docSnap.data();
        const ai = d.orientation_ai;
        if (!ai || !ai.final_orientation) continue;

        const fo = ai.final_orientation;
        const isAlreadyUnclear = fo === 'UNCLEAR' || fo === 'UNCLEAR_IMAGE';
        const isAerialOnlyLowConf = ai.aerial_only_mode === true && ai.confidence !== 'high';

        if (!isAlreadyUnclear && isAerialOnlyLowConf) {
            toFix.push({
                id: docSnap.id,
                address: d.address,
                current_fo: fo,
                confidence: ai.confidence,
            });
        }
    }

    console.log(`Found ${toFix.length} properties to patch:\n`);
    toFix.forEach(p => console.log(`  ${p.id} — "${p.address}" — ${p.current_fo} (${p.confidence})`));

    if (toFix.length === 0) {
        console.log('Nothing to patch. Done.');
        return;
    }

    const batch = db.batch();
    for (const p of toFix) {
        const ref = db.collection('properties').doc(p.id);
        batch.update(ref, {
            'orientation_ai.final_orientation': 'UNCLEAR',
            'orientation_ai.azimuth_degrees': null,
        });
    }

    await batch.commit();
    console.log(`\n✅ Patched ${toFix.length} documents.`);
}

main().catch(e => { console.error(e); process.exit(1); });
