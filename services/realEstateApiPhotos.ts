import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebaseService';
import { APP_CONFIG } from '../config';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function makeCacheKey(id: string): string {
    return id.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 100);
}

async function loadFromCache(cacheKey: string): Promise<string[] | null> {
    try {
        const snap = await getDoc(doc(db, 'realestateapi_cache', cacheKey));
        if (!snap.exists()) return null;
        const d = snap.data() as any;
        const fetchedAt: Date = d.fetchedAt instanceof Timestamp ? d.fetchedAt.toDate() : new Date(d.fetchedAt);
        if (Date.now() - fetchedAt.getTime() > CACHE_TTL_MS || !d.mls) return null;
        return (d.mls.media?.photosList ?? []).map((p: any) => p.highRes).filter(Boolean);
    } catch { return null; }
}

async function fetchFromApi(cacheKey: string, address: string): Promise<string[]> {
    const key = APP_CONFIG.realEstateApi.key;
    const base = APP_CONFIG.realEstateApi.baseUrl;
    const res = await fetch(`${base}/MLSDetail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body: JSON.stringify({ address }),
    });
    if (!res.ok) throw new Error(`MLSDetail ${res.status}`);
    const json = await res.json();
    const mls = (Array.isArray(json.data) ? json.data[0] : json.data) ?? null;
    if (mls) {
        try { await setDoc(doc(db, 'realestateapi_cache', cacheKey), { mls, fetchedAt: Timestamp.now() }); }
        catch { /* non-blocking */ }
    }
    return (mls?.media?.photosList ?? []).map((p: any) => p.highRes).filter(Boolean);
}

/**
 * Load MLS photos for a property. Checks Firestore cache first, falls back to
 * RealEstateAPI MLSDetail. Photos are hosted on the RealEstateAPI CDN — callers
 * receive URLs only; no images are stored in Firestore.
 */
export async function loadMLSPhotos(address: string, mlsId?: string): Promise<string[]> {
    const cacheKey = makeCacheKey(mlsId || address);
    const cached = await loadFromCache(cacheKey);
    if (cached) return cached;
    return fetchFromApi(cacheKey, address);
}

/**
 * Load the full MLSDetail object from cache (populated by loadMLSPhotos).
 * Returns null if not cached or cache is stale.
 */
export async function loadMLSDetail(address: string, mlsId?: string): Promise<Record<string, any> | null> {
    try {
        const cacheKey = makeCacheKey(mlsId || address);
        const snap = await getDoc(doc(db, 'realestateapi_cache', cacheKey));
        if (!snap.exists()) return null;
        const d = snap.data() as any;
        const fetchedAt: Date = d.fetchedAt instanceof Timestamp ? d.fetchedAt.toDate() : new Date(d.fetchedAt);
        if (Date.now() - fetchedAt.getTime() > CACHE_TTL_MS || !d.mls) return null;
        return d.mls;
    } catch { return null; }
}
