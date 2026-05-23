import { doc, setDoc, getDocs, collection, query, where, Timestamp } from 'firebase/firestore';
import { db } from './firebaseService';
import { findComps, SubjectProperty, CompAnalysisResult } from './compService';
import { normalizeAddress } from './api/geocoding';
import { getZipListings, saveZipListings, getZipSoldListings } from './firebase/cityData';
import { APP_CONFIG } from '../config';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BulkPhaseStatus = 'pending' | 'skipped_p0' | 'skipped_p1' | 'candidate' | 'confirmed' | 'error';

export interface BulkScreeningRow {
    address: string;
    mlsId?: string;
    listPrice: number | null;
    sqft: number | null;
    zestimate: number | null;
    rawMarketValue: number | null;
    geminiMarketValue: number | null;
    discountDollars: number | null;
    discountPct: number | null;
    compsCount: number;
    phase: BulkPhaseStatus;
    error?: string;
}

export interface BulkScreeningResult {
    rows: BulkScreeningRow[];
    phase0Eliminated: number;
    phase1Candidates: number;
    phase2Confirmed: number;
    errors: number;
    durationMs: number;
}

export interface BulkScreeningOptions {
    /** Properties where listPrice >= zestimate * threshold are skipped in Phase 0. Default 0.95 */
    phase0ZestimateThreshold?: number;
    /** Phase 1 parallel concurrency (no-Gemini raw comps). Default 2 */
    phase1Concurrency?: number;
    /** Phase 2 parallel concurrency (Gemini). Default 4 */
    phase2Concurrency?: number;
    /** Minimum discount % to pass Phase 1. Default 10 */
    discountPctThreshold?: number;
    /** Minimum discount $ to pass Phase 1. Default 180000 */
    discountDollarThreshold?: number;
    onProgress?: (msg: string) => void;
}

// ─── Concurrency Limiter ──────────────────────────────────────────────────────

async function pLimit<T>(
    fns: (() => Promise<T>)[],
    concurrency: number,
    onTaskDone?: (doneCount: number, total: number) => void
): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = new Array(fns.length);
    let nextIdx = 0;
    let doneCount = 0;

    async function worker() {
        while (nextIdx < fns.length) {
            const i = nextIdx++;
            try {
                results[i] = { status: 'fulfilled', value: await fns[i]() };
            } catch (e: any) {
                results[i] = { status: 'rejected', reason: e };
            }
            doneCount++;
            onTaskDone?.(doneCount, fns.length);
        }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));
    return results;
}

// ─── Gemini Valuation Extractor ───────────────────────────────────────────────

function extractGeminiValuation(res: CompAnalysisResult, sqft: number): number | null {
    const recs = res.geminiResult?.comp_analysis as any[] | undefined;
    if (!recs || sqft <= 0) return null;
    let finalComps = recs.filter((r: any) => r.zyphe_in_avg && typeof r.normalized_psf === 'number');
    if (finalComps.length === 0) {
        finalComps = recs.filter((r: any) => r.include_in_avg && !r.zyphe_excluded && typeof r.normalized_psf === 'number');
    }
    if (finalComps.length === 0) return null;
    const avgPsf = finalComps.reduce((s: number, c: any) => s + c.normalized_psf, 0) / finalComps.length;
    return Math.round(avgPsf * sqft);
}

// ─── Address Normalization ────────────────────────────────────────────────────

// Strips state, zip, and punctuation from an address string for comparison.
// Used to match Radar-canonical CSV addresses against cache listing addresses.
function normalizeAddressForMatch(addr: string): string {
    return addr
        .replace(/,?\s*(CA|California)\s*\d{5}(-\d{4})?$/i, '')
        .replace(/,?\s*(CA|California)$/i, '')
        .replace(/\bUnited States\b/i, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Strips non-alphanumeric chars from an MLS ID for reliable comparison.
function normalizeMlsId(id: string): string {
    return id.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ─── Pre-phase: Resolve Zip Codes via Geocoding ───────────────────────────────

async function resolveZipCodes(
    subjects: (SubjectProperty & { mlsId?: string })[],
    concurrency: number,
    onProgress: (msg: string) => void
): Promise<void> {
    const missing = subjects.filter(s => !s.zipCode);
    if (missing.length === 0) return;

    onProgress(`Pre-phase: geocoding ${missing.length} properties to resolve zip codes...`);
    let done = 0;

    const tasks = missing.map(subj => async () => {
        try {
            const result = await normalizeAddress(subj.address);
            const zip = result.components?.zipCode
                || result.formattedAddress.match(/(\d{5})(?:\s|,|$)/)?.[1]
                || undefined;
            if (zip) (subj as any).zipCode = zip;
            if (!subj.latitude) subj.latitude = result.coordinates.latitude;
            if (!subj.longitude) subj.longitude = result.coordinates.longitude;
            // Store Radar-canonical address for reliable cache matching fallback
            (subj as any).canonicalAddress = result.formattedAddress
                .replace(/(?:\s*,?\s*)(?:US|USA|United States)$/i, '');
        } catch {
            // Non-fatal — property proceeds without zip or canonical address
        }
        done++;
        if (done % 10 === 0 || done === missing.length) {
            onProgress(`Pre-phase: geocoded ${done}/${missing.length}`);
        }
    });

    await pLimit(tasks, concurrency);
}

// ─── Per-zip: Load Active Listings Cache ─────────────────────────────────────

// Reads the existing zip_listings_cache. If empty, fetches from RapidAPI
// propertyExtendedSearch with status_type=ForSale (mirrors the sold listings
// fetch pattern used in CityDataTab/SoldListingsTab).
async function loadZipActiveCache(
    zip: string,
    onProgress: (msg: string) => void
): Promise<any[]> {
    const cached = await getZipListings(zip);
    if (cached?.listings?.length) {
        onProgress(`Zip ${zip}: using ${cached.listings.length} cached active listings`);
        return cached.listings;
    }

    onProgress(`Zip ${zip}: fetching active listings from RapidAPI (ForSale)...`);
    const apiConfig = APP_CONFIG.usHousingApi;
    const baseUrl = `https://${apiConfig.host}/propertyExtendedSearch?location=${zip}&status_type=ForSale`;

    try {
        const allActive: any[] = [];
        let page = 1;
        let totalPages = 1;

        while (page <= totalPages) {
            const resp = await fetch(`${baseUrl}&page=${page}`, {
                headers: { 'X-RapidAPI-Key': apiConfig.key, 'X-RapidAPI-Host': apiConfig.host },
            });
            if (!resp.ok) {
                onProgress(`Zip ${zip}: RapidAPI ForSale p${page} error ${resp.status}`);
                break;
            }
            const result = await resp.json();
            const items: any[] = Array.isArray(result) ? result : (result.props || result.results || []);
            totalPages = result.totalPages ?? result.total_pages ?? 1;
            allActive.push(...items);
            onProgress(`Zip ${zip}: active p${page}/${totalPages} — ${items.length} listings`);
            page++;
            if (page <= totalPages) await new Promise(r => setTimeout(r, 1000));
        }

        if (allActive.length > 0) {
            await saveZipListings(zip, allActive);
            onProgress(`Zip ${zip}: cached ${allActive.length} active listings`);
        }
        return allActive;
    } catch (e: any) {
        onProgress(`Zip ${zip}: active listings fetch failed (${e.message})`);
        return [];
    }
}

// ─── Per-zip: Refresh Sold Listings Cache ─────────────────────────────────────

async function refreshZipSoldCache(zip: string): Promise<void> {
    try {
        // Re-use the existing sold listings fetch from compService's zip cache path.
        // The actual RapidAPI sold fetch is triggered lazily inside findComps, so here
        // we just ensure the cache entry exists; if it's stale findComps will refresh it.
        const existing = await getZipSoldListings(zip);
        if (!existing) {
            console.log(`[BulkScreening] Zip ${zip}: no sold cache entry yet — will be fetched on first comp run`);
        }
    } catch {
        // Non-fatal
    }
}

// ─── Per-zip: Move Stale Properties to Sold/Unlisted ─────────────────────────

async function moveStaleProperties(
    zip: string,
    activeZpidSet: Set<string>,
    onProgress: (msg: string) => void
): Promise<void> {
    try {
        // Query properties for this zip that are no longer in the active listings
        const snap = await getDocs(query(collection(db, 'properties'), where('zipCode', '==', zip)));
        const stale = snap.docs.filter(d => !activeZpidSet.has(d.id));
        if (stale.length === 0) return;

        onProgress(`Zip ${zip}: moving ${stale.length} stale properties to sold/unlisted...`);
        await Promise.all(stale.map(async d => {
            const data = d.data();
            await setDoc(doc(db, 'sold_or_unlisted_properties', d.id), {
                ...data,
                homeStatus: data.homeStatus || 'OFF_MARKET',
                movedAt: Timestamp.now(),
                source: data.source || 'stale_migration',
            }, { merge: true });
            // Remove from active properties collection
            await setDoc(doc(db, 'properties', d.id), { deprecated: true, deprecatedAt: Timestamp.now() }, { merge: true });
        }));
    } catch (e: any) {
        console.warn(`[BulkScreening] moveStaleProperties(${zip}) failed:`, e.message);
    }
}

// ─── Per-zip: Ensure Property Docs Exist ─────────────────────────────────────

async function ensurePropertyDocs(
    zipSubjects: (SubjectProperty & { mlsId?: string })[],
    activeListings: any[],
    zip: string,
    onProgress: (msg: string) => void
): Promise<void> {
    // ── Step 1: Active listings indexes (for is-active check) ────────────────
    const activeMlsIds = new Set<string>();
    const activeAddresses = new Set<string>();
    for (const l of activeListings) {
        const rawMlsId = l.mlsId ?? l.mlsListingId ?? l.mlsNumber ?? l.mls_id ?? l.listingId ?? null;
        if (rawMlsId) activeMlsIds.add(normalizeMlsId(String(rawMlsId)));
        const line = l.location?.address?.line || '';
        const city = l.location?.address?.city || '';
        if (line) activeAddresses.add(normalizeAddressForMatch(`${line}, ${city}`));
    }

    // ── Step 2: Batch-load ALL properties for this zip from Firestore ─────────
    onProgress(`Zip ${zip}: loading existing properties from Firestore...`);
    const snap = await getDocs(query(collection(db, 'properties'), where('zipCode', '==', zip)));

    // Build in-memory indexes: mlsId → doc, normalizedAddress → doc
    const cachedByMlsId = new Map<string, any>();
    const cachedByAddress = new Map<string, any>();
    for (const d of snap.docs) {
        const data = d.data();
        if (data.mlsId) cachedByMlsId.set(normalizeMlsId(String(data.mlsId)), { zpid: d.id, ...data });
        if (data.address) cachedByAddress.set(normalizeAddressForMatch(data.address), { zpid: d.id, ...data });
    }
    onProgress(`Zip ${zip}: ${snap.size} properties loaded from Firestore`);

    // ── Step 3: Match each CSV property and fetch missing ones ────────────────
    const missing: (SubjectProperty & { mlsId?: string })[] = [];

    for (const subj of zipSubjects) {
        // Confirm it's still an active listing
        let isActive = subj.mlsId ? activeMlsIds.has(normalizeMlsId(subj.mlsId)) : false;
        if (!isActive) {
            const canonical = (subj as any).canonicalAddress as string | undefined;
            if (canonical) isActive = activeAddresses.has(normalizeAddressForMatch(canonical));
        }
        if (!isActive) continue;

        // Check in-memory cache — MLS ID first, then address
        let cached = subj.mlsId ? cachedByMlsId.get(normalizeMlsId(subj.mlsId)) : null;
        if (!cached) {
            const canonical = (subj as any).canonicalAddress ?? subj.address;
            cached = cachedByAddress.get(normalizeAddressForMatch(canonical));
        }

        if (cached?.zpid) {
            (subj as any).zpid = cached.zpid;
            // Backfill zestimate onto subject if properties table has it
            if (!subj.zestimate && cached.zestimate) (subj as any).zestimate = cached.zestimate;
        } else {
            missing.push(subj);
        }
    }

    if (missing.length === 0) {
        onProgress(`Zip ${zip}: all properties already cached — no RapidAPI calls needed`);
        return;
    }

    onProgress(`Zip ${zip}: ${missing.length} properties not in Firestore — fetching from RapidAPI...`);

    // ── Step 4: Fetch only the missing ones from RapidAPI ─────────────────────
    const fetchTasks = missing.map(subj => async () => {
        try {
            const apiConfig = APP_CONFIG.usHousingApi;
            const url = `https://${apiConfig.host}/property?address=${encodeURIComponent(subj.address)}`;
            const resp = await fetch(url, {
                method: 'GET',
                headers: { 'x-rapidapi-host': apiConfig.host, 'x-rapidapi-key': apiConfig.key },
            });
            if (!resp.ok) return;

            const detail = await resp.json();
            if (!detail?.zpid) return;

            const zpid = String(detail.zpid);
            (subj as any).zpid = zpid;
            if (detail.zestimate) (subj as any).zestimate = detail.zestimate;

            await setDoc(doc(db, 'properties', zpid), {
                zpid,
                address: subj.address,
                zipCode: zip,
                homeStatus: 'FOR_SALE',
                bedrooms: subj.bedrooms ?? detail.bedrooms ?? detail.beds ?? null,
                bathrooms: subj.bathrooms ?? detail.bathrooms ?? detail.baths ?? null,
                livingAreaValue: subj.squareFootage ?? detail.livingArea ?? detail.livingAreaValue ?? null,
                lotSize: subj.lotSize ?? detail.lotSize ?? null,
                yearBuilt: subj.yearBuilt ?? detail.yearBuilt ?? null,
                homeType: subj.homeType ?? detail.propertyType ?? detail.homeType ?? null,
                listPrice: subj.listPrice ?? detail.price ?? detail.listPrice ?? null,
                zestimate: detail.zestimate ?? null,
                mlsId: subj.mlsId ?? detail.mlsid ?? detail.mlsId ?? null,
                cachedAt: Timestamp.now(),
                source: 'bulk_screening_prefetch',
            }, { merge: true });
        } catch (e: any) {
            console.warn(`[BulkScreening] RapidAPI fetch failed for ${subj.address}:`, e.message);
        }
    });

    await pLimit(fetchTasks, 2);
    onProgress(`Zip ${zip}: fetched and cached ${missing.length} properties from RapidAPI`);
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

export async function runBulkScreening(
    subjects: (SubjectProperty & { mlsId?: string })[],
    options: BulkScreeningOptions = {}
): Promise<BulkScreeningResult> {
    const {
        phase0ZestimateThreshold = 0.95,
        phase1Concurrency = 2,
        phase2Concurrency = 4,
        discountPctThreshold = 10,
        discountDollarThreshold = 180_000,
        onProgress = () => {},
    } = options;

    const startMs = Date.now();

    const rows: BulkScreeningRow[] = subjects.map(s => ({
        address: s.address,
        mlsId: s.mlsId,
        listPrice: s.listPrice ?? null,
        sqft: s.squareFootage ?? null,
        zestimate: s.zestimate ?? null,
        rawMarketValue: null,
        geminiMarketValue: null,
        discountDollars: null,
        discountPct: null,
        compsCount: 0,
        phase: 'pending',
    }));

    // ── Pre-phase: Geocode to resolve zip codes ───────────────────────────────
    await resolveZipCodes(subjects, phase1Concurrency, onProgress);

    // ── Pre-phase: Group by zip, refresh caches, ensure property docs ─────────
    const byZip = new Map<string, (SubjectProperty & { mlsId?: string })[]>();
    for (const s of subjects) {
        const zip = s.zipCode || 'unknown';
        if (!byZip.has(zip)) byZip.set(zip, []);
        byZip.get(zip)!.push(s);
    }

    const knownZips = [...byZip.keys()].filter(z => z !== 'unknown');
    onProgress(`Pre-phase: found ${knownZips.length} zip codes — refreshing caches...`);

    for (const zip of knownZips) {
        const zipSubjects = byZip.get(zip)!;

        // Load active listings cache (from Firestore; seeds from RealEstateAPI if empty)
        const activeListings = await loadZipActiveCache(zip, onProgress);
        const activeZpidSet = new Set(
            activeListings.map((l: any) => String(l.zpid || l.property_id)).filter(Boolean)
        );

        // Move properties no longer active to sold/unlisted (fire-and-forget — non-blocking)
        moveStaleProperties(zip, activeZpidSet, onProgress).catch(() => {});

        // Kick off sold cache refresh in background (findComps will use it in Phase 1)
        refreshZipSoldCache(zip).catch(() => {});

        // Ensure each CSV property for this zip has a properties doc (so compService skips API)
        await ensurePropertyDocs(zipSubjects, activeListings, zip, onProgress);
    }

    // Sync zestimate back into rows — pre-phase may have fetched it from RapidAPI after rows were initialized
    for (let i = 0; i < subjects.length; i++) {
        if (subjects[i].zestimate && !rows[i].zestimate) rows[i].zestimate = subjects[i].zestimate;
    }

    onProgress(`Pre-phase complete — starting 3-phase analysis on ${subjects.length} properties`);

    // ── Phase 0: instant zestimate pre-filter ─────────────────────────────────
    onProgress(`Phase 0: filtering ${subjects.length} properties by Zestimate...`);
    const p1Queue: (SubjectProperty & { mlsId?: string })[] = [];

    for (let i = 0; i < subjects.length; i++) {
        const subj = subjects[i];
        const { listPrice, zestimate } = subj;
        if (listPrice && zestimate && listPrice >= zestimate * phase0ZestimateThreshold) {
            rows[i].phase = 'skipped_p0';
            rows[i].rawMarketValue = zestimate;
            rows[i].discountDollars = zestimate - listPrice;
            rows[i].discountPct = ((zestimate - listPrice) / zestimate) * 100;
        } else {
            p1Queue.push(subj);
        }
    }
    onProgress(`Phase 0 done: ${subjects.length - p1Queue.length} eliminated, ${p1Queue.length} advancing to Phase 1`);

    // ── Phase 1: parallel raw comps, no Gemini ────────────────────────────────
    onProgress(`Phase 1: parallel raw comps on ${p1Queue.length} properties (concurrency=${phase1Concurrency})...`);

    const p1Tasks = p1Queue.map(subj => async () => {
        const idx = subjects.findIndex(s => s.address === subj.address);
        try {
            const res = await findComps(subj, { skipGemini: true, useZipCache: true });
            const sqft = subj.squareFootage || res.subjectProperty?.squareFootage || 0;
            const eligible = (res.rawComps || [])
                .filter(c => !c.isOutlier && !c.priceUnverified && c.adjustedPrice && c.squareFootage && c.squareFootage > 0)
                .sort((a, b) => (a.tier ?? 4) - (b.tier ?? 4) || (a.distance ?? 99) - (b.distance ?? 99))
                .slice(0, 5);

            let rawMarketValue: number | null = null;
            if (eligible.length > 0 && sqft > 0) {
                const avgPsf = eligible.reduce((s, c) => s + (c.adjustedPrice! / c.squareFootage!), 0) / eligible.length;
                rawMarketValue = Math.round(avgPsf * sqft);
            }

            const listPrice = subj.listPrice ?? null;
            const discount = rawMarketValue && listPrice ? rawMarketValue - listPrice : null;
            const discountPct = rawMarketValue && listPrice ? ((rawMarketValue - listPrice) / rawMarketValue) * 100 : null;
            const isUndervalued = rawMarketValue && listPrice &&
                (discountPct! >= discountPctThreshold || discount! >= discountDollarThreshold);

            if (idx >= 0) {
                rows[idx] = {
                    ...rows[idx],
                    rawMarketValue,
                    discountDollars: discount,
                    discountPct,
                    compsCount: res.rawComps?.length || 0,
                    phase: isUndervalued ? 'candidate' : 'skipped_p1',
                };
            }
        } catch (e: any) {
            if (idx >= 0) rows[idx] = { ...rows[idx], phase: 'error', error: e.message };
        }
    });

    await pLimit(p1Tasks, phase1Concurrency, (done, total) => {
        if (done % 5 === 0 || done === total) onProgress(`Phase 1: ${done}/${total} done`);
    });

    const p2Queue = rows
        .filter(r => r.phase === 'candidate')
        .map(r => subjects.find(s => s.address === r.address)!)
        .filter(Boolean);

    onProgress(`Phase 1 done: ${p2Queue.length} candidates advancing to Phase 2 (Gemini)`);

    // ── Phase 2: Gemini on undervalued candidates only ────────────────────────
    onProgress(`Phase 2: Gemini comp normalization on ${p2Queue.length} candidates (concurrency=${phase2Concurrency})...`);

    const p2Tasks = p2Queue.map(subj => async () => {
        const idx = subjects.findIndex(s => s.address === subj.address);
        try {
            const res = await findComps(subj, { skipLandUtility: true, useZipCache: true });
            const sqft = subj.squareFootage || res.subjectProperty?.squareFootage || 0;
            const geminiValue = extractGeminiValuation(res, sqft);
            const listPrice = subj.listPrice ?? null;
            const geminiDiscount = geminiValue && listPrice ? geminiValue - listPrice : null;
            const geminiDiscountPct = geminiValue && listPrice ? ((geminiValue - listPrice) / geminiValue) * 100 : null;

            if (idx >= 0) {
                rows[idx] = {
                    ...rows[idx],
                    geminiMarketValue: geminiValue,
                    discountDollars: geminiDiscount ?? rows[idx].discountDollars,
                    discountPct: geminiDiscountPct ?? rows[idx].discountPct,
                    phase: 'confirmed',
                };
            }
        } catch (e: any) {
            if (idx >= 0) rows[idx] = { ...rows[idx], phase: 'error', error: e.message };
        }
    });

    await pLimit(p2Tasks, phase2Concurrency, (done, total) => {
        onProgress(`Phase 2: ${done}/${total} done`);
    });

    const confirmed = rows.filter(r => r.phase === 'confirmed');
    onProgress(`Phase 2 done: ${confirmed.length} confirmed undervalued properties`);

    return {
        rows,
        phase0Eliminated: rows.filter(r => r.phase === 'skipped_p0').length,
        phase1Candidates: p2Queue.length,
        phase2Confirmed: confirmed.length,
        errors: rows.filter(r => r.phase === 'error').length,
        durationMs: Date.now() - startMs,
    };
}
