import { logAPICall, updateAPICall } from '../firebase/api_logs';
import { auth } from '../firebase/config';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DisasterEvent {
    id: string;
    date: string;                   // ISO date "YYYY-MM-DD"
    type: 'earthquake' | 'flood' | 'fire' | 'hurricane' | 'tornado' | 'severe_storm' | 'other';
    title: string;
    severity: string;               // e.g. "M4.2", "Major", "Emergency"
    source: 'usgs' | 'fema';
    description: string;
    distanceMi?: number | null;     // Distance from property in miles
    magnitude?: number | null;      // Earthquake magnitude
    depth?: number | null;          // Earthquake depth in km
    url?: string;                   // Link to source detail page
}

export interface SeismicZone {
    designCategory: string;         // A, B, C, D, E — seismic design category
    pga: number;                    // Peak Ground Acceleration (g)
    ss: number;                     // Spectral response at 0.2s (g)
    s1: number;                     // Spectral response at 1.0s (g)
    riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
}

export interface FloodZone {
    zone: string;                   // e.g. "X", "AE", "A", "VE"
    zoneSubtype?: string;           // e.g. "FLOODWAY", "0.2 PCT ANNUAL CHANCE"
    riskLevel: 'minimal' | 'moderate' | 'high';
    insuranceRequired: boolean;     // True for special flood hazard areas (A/V zones)
}

export interface HistoricalDisasterData {
    seismicZone?: SeismicZone | null;
    floodZone?: FloodZone | null;
    earthquakes: DisasterEvent[];
    femaDeclarations: DisasterEvent[];
    fetchedAt: number;              // Date.now() timestamp
    coordinates: { latitude: number; longitude: number };
    radiusMi: number;
}

// ─── USGS Seismic Design Maps API ─────────────────────────────────────────────
// Free, no API key.  Returns seismic hazard parameters for a location.
// Docs: https://earthquake.usgs.gov/ws/designmaps/

export const fetchSeismicZone = async (
    lat: number,
    lng: number,
    zpid?: string,
    address?: string
): Promise<SeismicZone | null> => {
    const url = `https://earthquake.usgs.gov/ws/designmaps/asce7-22.json` +
        `?latitude=${lat}&longitude=${lng}&riskCategory=II&siteClass=D&title=query`;

    const logId = await logAPICall({
        user_id: auth?.currentUser?.uid || 'unknown',
        zpid, address,
        api_name: 'USGS Seismic Design',
        endpoint: 'ws/designmaps/asce7-22',
        params: { lat, lng },
        status: 'pending'
    });
    const start = Date.now();

    try {
        const response = await fetch(url);

        if (logId) {
            updateAPICall(logId, {
                status: response.ok ? 'completed' : 'failed',
                response_time_ms: Date.now() - start,
                error: response.ok ? undefined : `Status ${response.status}`
            });
        }

        if (!response.ok) {
            console.warn(`[USGS Seismic] Error: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const output = data?.response?.data?.multiPeriodDesignSpectrum;
        const ss = data?.response?.data?.ss ?? 0;
        const s1 = data?.response?.data?.s1 ?? 0;
        const pga = data?.response?.data?.pga ?? 0;
        const sdc = data?.response?.data?.sdc ?? '';

        // Determine risk level from Seismic Design Category
        let riskLevel: SeismicZone['riskLevel'] = 'low';
        if (sdc === 'D' || sdc === 'E' || sdc === 'F') riskLevel = 'very_high';
        else if (sdc === 'C') riskLevel = 'high';
        else if (sdc === 'B') riskLevel = 'moderate';

        return {
            designCategory: sdc || 'Unknown',
            pga: Math.round(pga * 1000) / 1000,
            ss: Math.round(ss * 100) / 100,
            s1: Math.round(s1 * 100) / 100,
            riskLevel,
        };
    } catch (e) {
        console.error('[USGS Seismic] Failed to fetch seismic zone:', e);
        return null;
    }
};

// ─── FEMA Flood Zone (National Flood Hazard Layer) ────────────────────────────
// Free, no API key.  ArcGIS Map Service query.
// Layer 28 = Flood Hazard Zones

export const fetchFloodZone = async (
    lat: number,
    lng: number,
    zpid?: string,
    address?: string
): Promise<FloodZone | null> => {
    const geometry = encodeURIComponent(JSON.stringify({ x: lng, y: lat }));
    const url = `https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query` +
        `?geometry=${geometry}` +
        `&geometryType=esriGeometryPoint` +
        `&inSR=4326&outFields=FLD_ZONE,ZONE_SUBTY&returnGeometry=false&f=json`;

    const logId = await logAPICall({
        user_id: auth?.currentUser?.uid || 'unknown',
        zpid, address,
        api_name: 'FEMA Flood Zone',
        endpoint: 'NFHL/MapServer/28',
        params: { lat, lng },
        status: 'pending'
    });
    const start = Date.now();

    try {
        const response = await fetch(url);

        if (logId) {
            updateAPICall(logId, {
                status: response.ok ? 'completed' : 'failed',
                response_time_ms: Date.now() - start,
                error: response.ok ? undefined : `Status ${response.status}`
            });
        }

        if (!response.ok) {
            console.warn(`[FEMA Flood Zone] Error: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const features = data?.features;
        if (!features || features.length === 0) {
            // No NFHL data — likely outside mapped area
            return { zone: 'X', riskLevel: 'minimal', insuranceRequired: false };
        }

        const attrs = features[0].attributes;
        const zone = attrs.FLD_ZONE || 'X';
        const subtype = attrs.ZONE_SUBTY || '';

        // Classify risk
        const highRiskZones = ['A', 'AE', 'AH', 'AO', 'AR', 'A99', 'V', 'VE'];
        const moderateZones = ['X']; // "0.2 PCT ANNUAL CHANCE" subtype = moderate
        const isHighRisk = highRiskZones.includes(zone);
        const isModerate = subtype.includes('0.2 PCT') || subtype.includes('LEVEE');

        return {
            zone,
            zoneSubtype: subtype || undefined,
            riskLevel: isHighRisk ? 'high' : isModerate ? 'moderate' : 'minimal',
            insuranceRequired: isHighRisk,
        };
    } catch (e) {
        console.error('[FEMA Flood Zone] Failed to fetch flood zone:', e);
        return null;
    }
};

// ─── USGS Earthquake History ──────────────────────────────────────────────────
// Free, no API key.  Returns GeoJSON.
// Docs: https://earthquake.usgs.gov/fdsnws/event/1/

const EARTHQUAKE_RADIUS_KM = 8;       // ~5 miles
const EARTHQUAKE_RADIUS_MI = 5;       // Display value
const EARTHQUAKE_MIN_MAG = 3.0;       // Only felt earthquakes
const EARTHQUAKE_LOOKBACK_YEARS = 2;  // Last 2 years

export const fetchEarthquakeHistory = async (
    lat: number,
    lng: number,
    zpid?: string,
    address?: string
): Promise<DisasterEvent[]> => {
    const now = new Date();
    const startDate = `${now.getFullYear() - EARTHQUAKE_LOOKBACK_YEARS}-01-01`;
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson` +
        `&latitude=${lat}&longitude=${lng}` +
        `&maxradiuskm=${EARTHQUAKE_RADIUS_KM}` +
        `&minmagnitude=${EARTHQUAKE_MIN_MAG}` +
        `&starttime=${startDate}` +
        `&orderby=time&limit=50`;

    const logId = await logAPICall({
        user_id: auth?.currentUser?.uid || 'unknown',
        zpid, address,
        api_name: 'USGS Earthquake',
        endpoint: 'fdsnws/event/1/query',
        params: { lat, lng, radiusMi: EARTHQUAKE_RADIUS_MI, minMag: EARTHQUAKE_MIN_MAG },
        status: 'pending'
    });
    const start = Date.now();

    try {
        const response = await fetch(url);

        if (logId) {
            updateAPICall(logId, {
                status: response.ok ? 'completed' : 'failed',
                response_time_ms: Date.now() - start,
                error: response.ok ? undefined : `Status ${response.status}`
            });
        }

        if (!response.ok) {
            console.warn(`[USGS Earthquake] Error: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const features = data.features || [];

        return features.map((f: any) => {
            const props = f.properties;
            const coords = f.geometry?.coordinates; // [lng, lat, depth]
            const eqDate = props.time ? new Date(props.time).toISOString().split('T')[0] : 'Unknown';

            let distMi: number | null = null;
            if (coords && coords.length >= 2) {
                const distKm = haversineDistance(lat, lng, coords[1], coords[0]);
                distMi = Math.round(distKm * 0.621371 * 10) / 10;
            }

            return {
                id: f.id || `usgs-${props.time}`,
                date: eqDate,
                type: 'earthquake' as const,
                title: props.title || `M${props.mag} Earthquake`,
                severity: `M${props.mag?.toFixed(1) || '?'}`,
                source: 'usgs' as const,
                description: props.place || 'Unknown location',
                distanceMi: distMi,
                magnitude: props.mag,
                depth: coords?.[2] ?? null,
                url: props.url || null,
            };
        });
    } catch (e) {
        console.error('[USGS Earthquake] Failed to fetch earthquake data:', e);
        return [];
    }
};

// ─── FEMA Disaster Declarations ───────────────────────────────────────────────
// Free, no API key.
// Docs: https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries

const FEMA_TYPE_MAP: Record<string, DisasterEvent['type']> = {
    'Flood': 'flood',
    'Hurricane': 'hurricane',
    'Fire': 'fire',
    'Tornado': 'tornado',
    'Severe Storm(s)': 'severe_storm',
    'Earthquake': 'earthquake',
    'Severe Ice Storm': 'severe_storm',
    'Snow': 'severe_storm',
    'Coastal Storm': 'severe_storm',
    'Typhoon': 'hurricane',
    'Mud/Landslide': 'other',
    'Dam/Levee Break': 'flood',
};

export const fetchFemaDisasterHistory = async (
    state: string,
    county?: string,
    zpid?: string,
    address?: string
): Promise<DisasterEvent[]> => {
    if (!state) return [];

    const now = new Date();
    const startYear = now.getFullYear() - EARTHQUAKE_LOOKBACK_YEARS;

    let filterStr = `$filter=state eq '${state.toUpperCase()}' and declarationDate ge '${startYear}-01-01T00:00:00.000z'`;
    if (county) {
        const cleanCounty = county.replace(/ County$/i, '').trim();
        filterStr += ` and contains(designatedArea,'${cleanCounty}')`;
    }

    const url = `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?` +
        `${filterStr}` +
        `&$orderby=declarationDate desc` +
        `&$top=50` +
        `&$select=disasterNumber,declarationDate,incidentType,declarationTitle,state,designatedArea,incidentBeginDate,incidentEndDate,femaDeclarationString`;

    const logId = await logAPICall({
        user_id: auth?.currentUser?.uid || 'unknown',
        zpid, address,
        api_name: 'FEMA OpenFEMA',
        endpoint: 'DisasterDeclarationsSummaries',
        params: { state, county },
        status: 'pending'
    });
    const start = Date.now();

    try {
        const response = await fetch(url);

        if (logId) {
            updateAPICall(logId, {
                status: response.ok ? 'completed' : 'failed',
                response_time_ms: Date.now() - start,
                error: response.ok ? undefined : `Status ${response.status}`
            });
        }

        if (!response.ok) {
            console.warn(`[FEMA] Error: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const records = data.DisasterDeclarationsSummaries || [];

        // Deduplicate by disasterNumber
        const seen = new Set<string>();
        const unique: any[] = [];
        for (const r of records) {
            const key = `${r.disasterNumber}-${r.incidentType}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(r);
            }
        }

        return unique.map((r: any) => {
            const incidentDate = r.incidentBeginDate || r.declarationDate || '';
            const dateStr = incidentDate ? new Date(incidentDate).toISOString().split('T')[0] : 'Unknown';

            return {
                id: `fema-${r.disasterNumber}`,
                date: dateStr,
                type: FEMA_TYPE_MAP[r.incidentType] || 'other',
                title: r.declarationTitle || r.incidentType || 'Disaster Declaration',
                severity: r.femaDeclarationString || 'Federal Declaration',
                source: 'fema' as const,
                description: `${r.incidentType} — ${r.designatedArea || r.state}`,
                distanceMi: null,
                magnitude: null,
                depth: null,
                url: `https://www.fema.gov/disaster/${r.disasterNumber}`,
            };
        });
    } catch (e) {
        console.error('[FEMA] Failed to fetch disaster declarations:', e);
        return [];
    }
};

// ─── Combined Fetcher ─────────────────────────────────────────────────────────

export const fetchHistoricalDisasters = async (
    lat: number,
    lng: number,
    state?: string,
    county?: string,
    zpid?: string,
    address?: string
): Promise<HistoricalDisasterData> => {
    const [seismicZone, floodZone, earthquakes, femaDeclarations] = await Promise.all([
        fetchSeismicZone(lat, lng, zpid, address),
        fetchFloodZone(lat, lng, zpid, address),
        fetchEarthquakeHistory(lat, lng, zpid, address),
        state ? fetchFemaDisasterHistory(state, county, zpid, address) : Promise.resolve([]),
    ]);

    return {
        seismicZone,
        floodZone,
        earthquakes,
        femaDeclarations,
        fetchedAt: Date.now(),
        coordinates: { latitude: lat, longitude: lng },
        radiusMi: EARTHQUAKE_RADIUS_MI,
    };
};

// ─── Haversine Distance Helper ────────────────────────────────────────────────
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return deg * Math.PI / 180;
}
