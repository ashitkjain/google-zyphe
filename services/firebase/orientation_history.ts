import { db } from './config';
import * as firestore from 'firebase/firestore';


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
}

/**
 * Logs a new orientation version to the history
 */
export async function logOrientationVersion(data: {
    zpid: string;
    city: string;
    zip: string;
    orientation: string;
    azimuth: number | null;
    layout?: string;
}) {
    try {
        const city = (data.city || 'Unknown').trim();
        const zip = (data.zip || 'Unknown').trim();
        const zpid = data.zpid;

        // Path: orientation_versions/{city}/zips/{zip}/zpids/{zpid}/history/{vN}
        const historyColRef = firestore.collection(db, 'orientation_versions', city, 'zips', zip, 'zpids', zpid, 'history');
        
        // Find next version number for this specific property
        const qLast = firestore.query(
            historyColRef,
            firestore.orderBy('version', 'desc'),
            firestore.limit(1)
        );
        const lastSnap = await firestore.getDocs(qLast);
        let nextVersion = 1;
        if (!lastSnap.empty) {
            nextVersion = (lastSnap.docs[0].data().version || 0) + 1;
        }

        const docId = `v${nextVersion}`;
        await firestore.setDoc(firestore.doc(historyColRef, docId), {
            city,
            zip,
            zpid,
            version: nextVersion,
            details: {
                orientation: data.orientation,
                azimuth: data.azimuth,
                layout: data.layout
            },
            dateMined: firestore.serverTimestamp()
        });

        console.log(`[logOrientationVersion] Successfully logged v${nextVersion} for ${zpid} under ${city}/${zip}`);
    } catch (e) {
        console.error('[logOrientationVersion] Error saving history:', e);
    }
}

/**
 * Retrieves latest versions for all zpids using collectionGroup
 */
export async function getLatestOrientationVersions(): Promise<Record<string, OrientationHistorySnapshot>> {
    const results: Record<string, OrientationHistorySnapshot> = {};
    try {
        // Use collectionGroup to fetch across all 'history' subcollections
        const snap = await firestore.getDocs(firestore.collectionGroup(db, 'history'));
        
        // Group by ZPID and sort by dateMined descending
        const grouped: Record<string, OrientationVersion[]> = {};
        snap.docs.forEach(d => {
            const data = d.data() as OrientationVersion;
            if (!grouped[data.zpid]) grouped[data.zpid] = [];
            grouped[data.zpid].push(data);
        });

        Object.keys(grouped).forEach(zpid => {
            // Sort by dateMined (latest first)
            const sorted = grouped[zpid].sort((a, b) => {
                const tA = a.dateMined?.toMillis?.() || 0;
                const tB = b.dateMined?.toMillis?.() || 0;
                return tB - tA;
            });

            results[zpid] = {
                latest: sorted[0],
                previous: sorted[1]
            };
        });
    } catch (e) {
        console.error("[getLatestOrientationVersions] Error fetching history:", e);
    }
    return results;
}
