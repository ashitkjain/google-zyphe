import { db } from './config';
import * as firestore from 'firebase/firestore';

// ─── Shared shape expected by OrientationAuditTab ──────────────────────────
export interface OrientationVersion {
    zpid: string;
    city: string;
    zip: string;
    version: number;
    details: {
        orientation: string;
        azimuth: number | null;
        layout?: string;
    };
    dateMined: any;
}

export interface OrientationHistorySnapshot {
    latest?: OrientationVersion;
    previous?: OrientationVersion;
    /** The very first orientation ever recorded for this property (v1 baseline). */
    first?: OrientationVersion;
}

// ─── Internal shape stored in orientation_ground_truth.test_results ────────
interface AutomatedTestResult {
    remark: string | null;
    ai_assessed_orientation: string | null;
    ai_assessed_azimuth: number | null;
    ai_layout_type: string | null;
    notes: string | null;
    tester: 'automated';
    date: string;        // ISO string — serverTimestamp not usable inside arrays
    city: string;
    zip: string;
    zpid: string;
    version: number;
}

/**
 * Appends a new AI-generated orientation run to orientation_ground_truth/{zpid}.test_results[].
 * Replaces the old orientation_versions subcollection write.
 */
export async function logOrientationVersion(data: {
    zpid: string;
    city: string;
    zip: string;
    orientation: string;
    azimuth: number | null;
    property_layout_type?: string | null;
    layout?: string | null;
}) {
    try {
        const city = (data.city || 'Unknown').trim();
        const zip  = (data.zip  || 'Unknown').trim();
        const zpid = data.zpid;

        const gtRef = firestore.doc(db, 'orientation_ground_truth', zpid);

        // Read existing test_results to determine the next version number
        const snap = await firestore.getDoc(gtRef);
        const existing = snap.exists() ? snap.data() : {};
        const prevResults: AutomatedTestResult[] = (existing?.test_results ?? [])
            .filter((r: any) => r.tester === 'automated');
        const nextVersion = prevResults.length + 1;

        const newEntry: AutomatedTestResult = {
            remark:                  null,
            ai_assessed_orientation: data.orientation,
            ai_assessed_azimuth:     data.azimuth,
            ai_layout_type:          data.property_layout_type || data.layout || null,
            notes:                   null,
            tester:                  'automated',
            date:                    new Date().toISOString(),
            city,
            zip,
            zpid,
            version:                 nextVersion,
        };

        if (snap.exists()) {
            // Append to existing array
            await firestore.updateDoc(gtRef, {
                test_results: firestore.arrayUnion(newEntry),
            });
        } else {
            // Create minimal shell — no expected_orientation since this is AI-only
            await firestore.setDoc(gtRef, {
                zpid,
                city,
                address:              null,
                expected_orientation: null,
                expected_azimuth_deg: null,
                test_results:         [newEntry],
            });
        }

        console.log(`[logOrientationVersion] Appended automated v${nextVersion} for ${zpid} to orientation_ground_truth`);
    } catch (e) {
        console.error('[logOrientationVersion] Error saving to orientation_ground_truth:', e);
    }
}

/**
 * Sets (or overwrites) the expected_orientation in orientation_ground_truth/{zpid}
 * when the orientation was extracted directly from the listing description.
 *
 * Description-sourced orientations are treated as authoritative GT — they come from
 * the official property listing data and are more reliable than human tester notes.
 */
export async function setGroundTruthFromDescription(data: {
    zpid: string;
    city: string;
    zip: string;
    address?: string | null;
    orientation: string;   // e.g. "South"
    azimuth: number;       // e.g. 180
}) {
    try {
        const gtRef = firestore.doc(db, 'orientation_ground_truth', data.zpid);
        const snap  = await firestore.getDoc(gtRef);

        const payload: Record<string, any> = {
            expected_orientation: data.orientation,
            expected_azimuth_deg: data.azimuth,
            gt_source: 'description',   // track where this GT came from
        };

        if (snap.exists()) {
            await firestore.updateDoc(gtRef, payload);
        } else {
            await firestore.setDoc(gtRef, {
                zpid:                 data.zpid,
                city:                 (data.city || 'Unknown').trim(),
                zip:                  (data.zip  || 'Unknown').trim(),
                address:              data.address ?? null,
                ...payload,
                test_results:         [],
            });
        }

        console.log(`[setGroundTruthFromDescription] GT expected_orientation set to "${data.orientation}" for ${data.zpid}`);
    } catch (e) {
        console.error('[setGroundTruthFromDescription] Error:', e);
    }
}

/**
 * Writes (or overwrites) a manual GT orientation chosen by the user from the audit UI.
 * Sets gt_source = 'manual' so the UI can distinguish it from description-sourced GT.
 */
export async function saveManualGroundTruth(data: {
    zpid: string;
    city: string;
    zip: string;
    address?: string | null;
    orientation: string;   // e.g. "South" or "UNCLEAR"
}) {
    const azimuth = (await import('../orientation_ground_truth_data'))
        .AZIMUTH_FOR_ORIENTATION[data.orientation] ?? null;
    try {
        const gtRef = firestore.doc(db, 'orientation_ground_truth', data.zpid);
        const snap  = await firestore.getDoc(gtRef);
        const payload: Record<string, any> = {
            expected_orientation: data.orientation,
            expected_azimuth_deg: azimuth,
            gt_source: 'manual',
            gt_updated_at: firestore.serverTimestamp(),
        };
        if (snap.exists()) {
            await firestore.updateDoc(gtRef, payload);
        } else {
            await firestore.setDoc(gtRef, {
                zpid:  data.zpid,
                city:  (data.city || 'Unknown').trim(),
                zip:   (data.zip  || 'Unknown').trim(),
                address: data.address ?? null,
                ...payload,
                test_results: [],
            });
        }
        console.log(`[saveManualGroundTruth] GT set to "${data.orientation}" for ${data.zpid}`);
    } catch (e) {
        console.error('[saveManualGroundTruth] Error:', e);
        throw e;
    }
}

/**
 * Fetches the ground truth record for a specific property.
 */
export async function getPropertyGroundTruth(zpid: string): Promise<{ expected_orientation: string; expected_azimuth_deg: number | null; gt_source: string } | null> {
    try {
        const gtRef = firestore.doc(db, 'orientation_ground_truth', zpid);
        const snap = await firestore.getDoc(gtRef);
        if (snap.exists()) {
            const data = snap.data();
            if (data.expected_orientation) {
                return {
                    expected_orientation: data.expected_orientation,
                    expected_azimuth_deg: data.expected_azimuth_deg ?? null,
                    gt_source: data.gt_source ?? 'unknown',
                };
            }
        }
    } catch (e) {
        console.error('[getPropertyGroundTruth] Error:', e);
    }
    return null;
}

/**
 * Reads expected_orientation and gt_source from all orientation_ground_truth docs.
 * Used by the audit tab to overlay Firestore-based GT over the static local dataset.
 */
export async function fetchFirestoreGroundTruths(): Promise<Record<string, { expected_orientation: string; gt_source: string }>> {
    const results: Record<string, { expected_orientation: string; gt_source: string }> = {};
    try {
        const snap = await firestore.getDocs(firestore.collection(db, 'orientation_ground_truth'));
        snap.docs.forEach(d => {
            const data = d.data();
            if (data.expected_orientation) {
                results[d.id] = {
                    expected_orientation: data.expected_orientation,
                    gt_source: data.gt_source ?? 'unknown',
                };
            }
        });
    } catch (e) {
        console.error('[fetchFirestoreGroundTruths] Error:', e);
    }
    return results;
}

/**
 * Reads orientation history from orientation_ground_truth collection.
 * Reconstructs the same OrientationHistorySnapshot shape used by OrientationAuditTab —
 * latest, previous, and first are derived from automated test_results sorted by date.
 */
export async function getLatestOrientationVersions(): Promise<Record<string, OrientationHistorySnapshot>> {
    const results: Record<string, OrientationHistorySnapshot> = {};
    try {
        const snap = await firestore.getDocs(firestore.collection(db, 'orientation_ground_truth'));

        snap.docs.forEach(d => {
            const data  = d.data();
            const zpid  = data.zpid ?? d.id;
            const city  = data.city  ?? 'Unknown';
            const zip   = data.zip   ?? 'Unknown';

            // Only automated entries carry AI orientation history
            const automated: AutomatedTestResult[] = (data.test_results ?? [])
                .filter((r: any) => r.tester === 'automated' && r.ai_assessed_orientation);

            if (automated.length === 0) return;

            // Sort by date ascending so [last] = latest, [0] = first
            const sorted = [...automated].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            // Map to the OrientationVersion shape expected by the tab
            const toVersion = (r: AutomatedTestResult, idx: number): OrientationVersion => ({
                zpid,
                city: r.city ?? city,
                zip:  r.zip  ?? zip,
                version: r.version ?? idx + 1,
                details: {
                    orientation: r.ai_assessed_orientation!,
                    azimuth:     r.ai_assessed_azimuth ?? null,
                    layout:      r.ai_layout_type ?? undefined,
                },
                dateMined: r.date,   // ISO string — compatible with the tab's optional toMillis check
            });

            const latestIdx  = sorted.length - 1;
            const previousIdx = sorted.length - 2;

            results[zpid] = {
                latest:   toVersion(sorted[latestIdx],  latestIdx),
                previous: sorted.length > 1 ? toVersion(sorted[previousIdx], previousIdx) : undefined,
                first:    toVersion(sorted[0], 0),
            };
        });
    } catch (e) {
        console.error('[getLatestOrientationVersions] Error fetching from orientation_ground_truth:', e);
    }
    return results;
}
