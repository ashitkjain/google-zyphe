import { db } from './config';
import { collection, doc, setDoc, serverTimestamp, query, orderBy, limit, getDocs, collectionGroup } from 'firebase/firestore';

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
        const historyColRef = collection(db, 'orientation_versions', city, 'zips', zip, 'zpids', zpid, 'history');
        
        // Find next version number for this specific property
        const qLast = query(
            historyColRef,
            orderBy('version', 'desc'),
            limit(1)
        );
        const lastSnap = await getDocs(qLast);
        let nextVersion = 1;
        if (!lastSnap.empty) {
            nextVersion = (lastSnap.docs[0].data().version || 0) + 1;
        }

        const docId = `v${nextVersion}`;
        await setDoc(doc(historyColRef, docId), {
            city,
            zip,
            zpid,
            version: nextVersion,
            details: {
                orientation: data.orientation,
                azimuth: data.azimuth,
                layout: data.layout
            },
            dateMined: serverTimestamp()
        });
    } catch (e) {
        console.error("[logOrientationVersion] Error saving history:", e);
    }
}

/**
 * Fetches the most recent previous orientation versions for a list of ZPIDs
 */
export async function getLatestOrientationVersions(zpids: string[]): Promise<Record<string, OrientationVersion>> {
    const results: Record<string, OrientationVersion> = {};
    if (!zpids.length) return results;

    try {
        // Use collectionGroup to fetch across all 'history' subcollections
        const snap = await getDocs(collectionGroup(db, 'history'));
        
        const latestByZpid: Record<string, any> = {};
        snap.docs.forEach(d => {
            const data = d.data();
            const zpid = data.zpid;
            const time = data.dateMined?.toMillis?.() || 0;
            if (!latestByZpid[zpid] || time > (latestByZpid[zpid].dateMined?.toMillis?.() || 0)) {
                latestByZpid[zpid] = { ...data };
            }
        });

        zpids.forEach(zpid => {
            if (latestByZpid[zpid]) {
                results[zpid] = latestByZpid[zpid] as OrientationVersion;
            }
        });
    } catch (e) {
        console.error("[getLatestOrientationVersions] Error fetching history:", e);
    }
    return results;
}
