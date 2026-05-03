/**
 * Deduplicated prefetch for the cache reads ExploreTab needs after a property
 * loads. Both `fetchPropertyDataFull` (kicks this off the moment we know the
 * zpid) and `useExploreTabData` (consumes it) call `prefetchExploreCache`; the
 * second caller gets the in-flight promise instead of re-issuing reads.
 *
 * Cache entries are dropped after `TTL_MS` so a refresh of the same property
 * later in the session re-reads (Firestore is the source of truth, this is
 * just a per-session intra-load coordination layer).
 */
import {
    getVisualAnalysisFromCloud,
    getPropertyInvestmentFromCloud,
    getDeepInvestmentResearchFromCloud,
    getCommunityPulseFromCloud,
    getInteriorSummaryFromCloud,
    getEnvironmentalDataFromCloud,
    getFemaNriFromCloud,
} from './firebase/properties';
import { getPropertyGroundTruth } from './firebase/orientation_history';
import { generateCityStateKey } from './firebase/config';

export interface ExploreCacheBundle {
    visualCache: any;
    investmentCache: any;
    deepResearchCache: any;
    communityPulseCache: any;
    interiorCache: any;
    orientationGTCache: any;
    envCache: any;
    femaNriCache: any;
}

const TTL_MS = 30_000;
const _inflight = new Map<string, { promise: Promise<ExploreCacheBundle>; ts: number }>();

export function prefetchExploreCache(
    zpid: string | undefined | null,
    city?: string,
    state?: string,
): Promise<ExploreCacheBundle> {
    if (!zpid) return Promise.resolve(emptyBundle());
    const key = String(zpid);

    const now = Date.now();
    const cached = _inflight.get(key);
    if (cached && now - cached.ts < TTL_MS) return cached.promise;

    const cityStateKey = city && state ? generateCityStateKey(city, state) : null;
    const promise = (async () => {
        const [
            visualCache,
            investmentCache,
            deepResearchCache,
            communityPulseCache,
            interiorCache,
            orientationGTCache,
            envCache,
            femaNriCache,
        ] = await Promise.all([
            getVisualAnalysisFromCloud(key),
            getPropertyInvestmentFromCloud(key),
            cityStateKey ? getDeepInvestmentResearchFromCloud(cityStateKey) : Promise.resolve(null),
            cityStateKey ? getCommunityPulseFromCloud(cityStateKey) : Promise.resolve(null),
            getInteriorSummaryFromCloud(key),
            getPropertyGroundTruth(key),
            getEnvironmentalDataFromCloud(key),
            getFemaNriFromCloud(key),
        ]);
        return {
            visualCache,
            investmentCache,
            deepResearchCache,
            communityPulseCache,
            interiorCache,
            orientationGTCache,
            envCache,
            femaNriCache,
        };
    })().catch(err => {
        _inflight.delete(key); // allow retry on failure
        throw err;
    });

    _inflight.set(key, { promise, ts: now });
    return promise;
}

export function invalidateExploreCache(zpid: string | undefined | null) {
    if (zpid) _inflight.delete(String(zpid));
}

function emptyBundle(): ExploreCacheBundle {
    return {
        visualCache: null,
        investmentCache: null,
        deepResearchCache: null,
        communityPulseCache: null,
        interiorCache: null,
        orientationGTCache: null,
        envCache: null,
        femaNriCache: null,
    };
}
