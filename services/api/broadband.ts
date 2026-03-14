import { logAPICall, updateAPICall } from '../firebase/api_logs';
import { auth } from '../firebase/config';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InternetProvider {
    name: string;
    technology: string;          // "Fiber", "Cable", "Fixed Wireless", "LEO Satellite", etc.
    maxDownloadMbps: number;
    maxUploadMbps: number;
}

export interface CellCoverage {
    network: string;             // "AT&T", "T-Mobile", "Verizon"
    technology: string;          // "4G LTE", "5G NR"
    signalLevel: string;         // "Good", "Fair", "Weak"
    rsrpDbm: number;             // Signal strength in dBm
}

export interface BroadbandData {
    internetProviders: InternetProvider[];
    cellCoverage: CellCoverage[];
    topDownloadMbps: number;
    hasFiber: boolean;
    has5G: boolean;
    providerCount: number;
    fetchedAt: number;
}

// ─── broadbandmap.com API (free, no key, 60 req/hr) ──────────────────────────
// Docs: https://broadbandmap.com/api

const BASE_URL = 'https://broadbandmap.com/api/v1/location';

export const fetchBroadbandData = async (
    lat: number,
    lng: number,
    zpid?: string,
    address?: string
): Promise<BroadbandData | null> => {
    const logId = await logAPICall({
        user_id: auth?.currentUser?.uid || 'unknown',
        zpid, address,
        api_name: 'Broadband Map',
        endpoint: 'broadbandmap.com/api/v1/location',
        params: { lat, lng },
        status: 'pending'
    });
    const start = Date.now();

    try {
        // Fetch both internet & cell coverage in parallel
        const [internetRes, cellRes] = await Promise.all([
            fetch(`${BASE_URL}/internet?lat=${lat}&lng=${lng}`),
            fetch(`${BASE_URL}/cell?lat=${lat}&lng=${lng}`),
        ]);

        if (logId) {
            updateAPICall(logId, {
                status: internetRes.ok ? 'completed' : 'failed',
                response_time_ms: Date.now() - start,
                error: internetRes.ok ? undefined : `Status ${internetRes.status}`
            });
        }

        const internetProviders: InternetProvider[] = [];
        let topDownloadMbps = 0;
        let hasFiber = false;

        if (internetRes.ok) {
            const internetData = await internetRes.json();
            const providers = internetData?.providers || [];

            for (const p of providers) {
                // Skip satellite providers for the main list (they're available everywhere)
                const tech = p.technology || '';
                const dl = p.max_download_mbps || 0;
                const ul = p.max_upload_mbps || 0;

                internetProviders.push({
                    name: p.name || 'Unknown',
                    technology: tech,
                    maxDownloadMbps: dl,
                    maxUploadMbps: ul,
                });

                if (dl > topDownloadMbps) topDownloadMbps = dl;
                if (tech === 'Fiber') hasFiber = true;
            }
        }

        const cellCoverage: CellCoverage[] = [];
        let has5G = false;

        if (cellRes.ok) {
            const cellData = await cellRes.json();
            const coverage = cellData?.coverage || [];

            for (const c of coverage) {
                cellCoverage.push({
                    network: c.network || 'Unknown',
                    technology: c.technology || '',
                    signalLevel: c.signal_level || 'Unknown',
                    rsrpDbm: c.rsrp_dbm || 0,
                });
                if (c.technology?.includes('5G')) has5G = true;
            }
        }

        return {
            internetProviders,
            cellCoverage,
            topDownloadMbps,
            hasFiber,
            has5G,
            providerCount: internetProviders.length,
            fetchedAt: Date.now(),
        };
    } catch (e) {
        console.error('[Broadband] Failed to fetch broadband data:', e);
        if (logId) {
            updateAPICall(logId, {
                status: 'failed',
                response_time_ms: Date.now() - start,
                error: String(e)
            });
        }
        return null;
    }
};
