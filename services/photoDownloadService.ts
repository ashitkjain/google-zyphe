// Centralized photo download service.
// Randomizes across Realtor.com, Redfin, Homes.com, and Trulia, with Zillow
// as last fallback, via the Chrome extension's 2-step tab navigation.
// Falls back to RapidAPI when the extension is unavailable. See docs/photo-download-architecture.md.

export interface PhotoDownloadResult {
    photos: string[];
    source: string | null;
}

interface SiteConfig {
    id: string;
    name: string;
    buildUrl: (zpid: string, address?: string) => string | null;
}

const PHOTO_SITES: SiteConfig[] = [
    {
        id: 'zillow',
        name: 'Zillow',
        buildUrl: (zpid) => zpid ? `https://www.zillow.com/homedetails/${zpid}_zpid/` : null,
    },
    {
        id: 'realtor',
        name: 'Realtor.com',
        buildUrl: (_, address) => address
            ? `https://www.realtor.com/realestateandhomes-search/?q=${encodeURIComponent(address)}`
            : null,
    },
    {
        id: 'redfin',
        name: 'Redfin',
        buildUrl: (_, address) => address
            ? `https://www.redfin.com/search?q=${encodeURIComponent(address)}`
            : null,
    },
    {
        id: 'homes',
        name: 'Homes.com',
        buildUrl: (_, address) => address
            ? `https://www.homes.com/search/?term=${encodeURIComponent(address)}`
            : null,
    },
    {
        id: 'trulia',
        name: 'Trulia',
        buildUrl: (_, address) => address
            ? `https://www.trulia.com/search#searchType=properties&searchQuery=${encodeURIComponent(address)}`
            : null,
    },
    {
        id: 'paragon',
        name: 'Paragon MLS',
        buildUrl: (_, address) => address
            ? `https://maxebrdi.paragonrels.com/CCR/shivaniyadav/listings/results?contactToken=2bac1e9a-8829-4fba-8d09-ac0991ae8b23&m=ZmFsc2U%3D&search=${encodeURIComponent(address)}`
            : null,
    },
];

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Randomize all sources, with Zillow as last fallback.
function buildSiteUrls(zpid: string, address?: string): Record<string, string> {
    const [zillow, ...rest] = PHOTO_SITES;
    const ordered = [zillow, ...shuffle(rest)];
    const result: Record<string, string> = {};
    for (const site of ordered) {
        const url = site.buildUrl(zpid, address);
        if (url) result[site.id] = url;
    }
    return result;
}

// Extension ID received via postMessage from content.js on page load.
let _extensionId: string | null = null;

export function _resetExtensionBridgeForTesting(): void {
    _extensionId = null;
}

export function initExtensionBridge(): void {
    window.addEventListener('message', (e) => {
        if (e.data?.type === 'ZYPHE_EXTENSION_READY' && e.data.extensionId) {
            _extensionId = e.data.extensionId;
            console.log('[PhotoDownload] Extension bridge ready:', _extensionId);
        }
    });
}

export function isExtensionAvailable(): boolean {
    return (
        _extensionId !== null &&
        typeof (window as any).chrome?.runtime?.sendMessage === 'function'
    );
}

export async function fetchPhotosViaExtension(
    zpid: string,
    address?: string
): Promise<PhotoDownloadResult> {
    if (!isExtensionAvailable() || !_extensionId) {
        return { photos: [], source: null };
    }

    // Try RealEstateAPI cached images first (zero-overhead lookup)
    if (address) {
        try {
            const cacheKey = address.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 100);
            const { db } = await import('./firebase/config');
            if (db) {
                const { doc, getDoc } = await import('firebase/firestore');
                const snap = await getDoc(doc(db, 'realestateapi_cache', cacheKey));
                if (snap.exists()) {
                    const d = snap.data();
                    const rawImages = d?.mls?.images || [];
                    const photos = rawImages
                        .map((img: any) => typeof img === 'string' ? img : (img?.highRes || img?.url || img?.midRes))
                        .filter(Boolean);
                    if (photos.length >= 5) {
                        console.log(`[PhotoDownload] RealEstateAPI Cache hit: ${photos.length} photos`);
                        return { photos, source: 'realestateapi' };
                    }
                }
            }
        } catch (e: any) {
            console.warn('[PhotoDownload] RealEstateAPI cache fetch failed:', e.message);
        }
    }

    const siteUrls = buildSiteUrls(zpid, address);
    const id = _extensionId;

    return new Promise((resolve) => {
        // 90s outer timeout — covers worst-case sequential tab scraping across all 5 sources
        const timeout = setTimeout(() => resolve({ photos: [], source: null }), 90_000);

        (window as any).chrome.runtime.sendMessage(
            id,
            { type: 'DOWNLOAD_PROPERTY_PHOTOS', siteUrls },
            (response: PhotoDownloadResult | undefined) => {
                clearTimeout(timeout);
                const lastError = (window as any).chrome?.runtime?.lastError;
                if (lastError || !response) {
                    console.warn('[PhotoDownload] Extension message failed:', lastError?.message);
                    resolve({ photos: [], source: null });
                    return;
                }
                resolve(response);
            }
        );
    });
}

export { PHOTO_SITES };
