import { APP_CONFIG } from '../../config';
import { logAPICall, updateAPICall } from '../firebase/api_logs';
import { auth } from '../firebase/config';
import { calculateSolarPotential } from '../../utils/solarCalculations';

const MAPS_API_KEY = APP_CONFIG.maps.key;

// ─── Solar ────────────────────────────────────────────────────────────────────
export const fetchSolarData = async (lat: number, lng: number, zpid?: string, address?: string): Promise<any> => {
    const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${MAPS_API_KEY}`;

    const logId = await logAPICall({
        user_id: auth?.currentUser?.uid || 'unknown',
        zpid,
        address,
        api_name: 'Google Solar',
        endpoint: 'findClosest',
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
            console.warn(`[Solar API] Error or no data for this location: ${response.status}`);
            return null;
        }
        const data = await response.json();
        if (!data.solarPotential) return null;

        // We explicitly only extract the high-level metrics and a LEAN version of the panel data.
        // solarPanels and solarPanelConfigs arrays can be multiple MBs.
        // We only keep the yearlyEnergyDcKwh for each panel to allow accurate calculations.
        const {
            maxSunshineHoursPerYear,
            carbonOffsetFactorKgPerMwh,
            wholeRoofStats,
            panelCapacityWatts,
            solarPanels,
            financialAnalyses
        } = data.solarPotential;

        const solarDataLean = {
            maxSunshineHoursPerYear,
            carbonOffsetFactorKgPerMwh,
            panelCapacityWatts,
            solarPanels: (solarPanels || []).map((p: any) => ({
                yearlyEnergyDcKwh: p.yearlyEnergyDcKwh
            })),
            wholeRoofStats
        };

        const production = calculateSolarPotential(solarDataLean);

        // Extract the default financial analysis (U.S. only)
        let financialAnalysis: any = undefined;
        if (financialAnalyses && Array.isArray(financialAnalyses) && financialAnalyses.length > 0) {
            // Find the one marked as defaultBill, or fall back to the first entry
            const defaultFA = financialAnalyses.find((fa: any) => fa.defaultBill) || financialAnalyses[0];
            if (defaultFA) {
                const cashSavings = defaultFA.cashPurchaseSavings;
                const leaseSavings = defaultFA.leasingSavings;
                const financedSavings = defaultFA.financedPurchaseSavings;
                financialAnalysis = {
                    monthlyBill: defaultFA.monthlyBill?.units ? Number(defaultFA.monthlyBill.units) : undefined,
                    // Remaining bill after solar
                    remainingLifetimeCostBill: defaultFA.financialDetails?.remainingLifetimeCost?.units
                        ? Number(defaultFA.financialDetails.remainingLifetimeCost.units) : undefined,
                    // Cost of electricity without solar over lifetime
                    costOfElectricityWithoutSolar: defaultFA.financialDetails?.costOfElectricityWithoutSolar?.units
                        ? Number(defaultFA.financialDetails.costOfElectricityWithoutSolar.units) : undefined,
                    // Cash purchase
                    cashPurchase: cashSavings ? {
                        outOfPocketCost: cashSavings.outOfPocketCost?.units ? Number(cashSavings.outOfPocketCost.units) : undefined,
                        upfrontCost: cashSavings.upfrontCost?.units ? Number(cashSavings.upfrontCost.units) : undefined,
                        rebateValue: cashSavings.rebateValue?.units ? Number(cashSavings.rebateValue.units) : undefined,
                        paybackYears: cashSavings.paybackYears ?? undefined,
                        savings: {
                            savingsYear1: cashSavings.savings?.savingsYear1?.units ? Number(cashSavings.savings.savingsYear1.units) : undefined,
                            savingsYear20: cashSavings.savings?.savingsYear20?.units ? Number(cashSavings.savings.savingsYear20.units) : undefined,
                            savingsLifetime: cashSavings.savings?.savingsLifetime?.units ? Number(cashSavings.savings.savingsLifetime.units) : undefined,
                            presentValueOfSavingsYear20: cashSavings.savings?.presentValueOfSavingsYear20?.units ? Number(cashSavings.savings.presentValueOfSavingsYear20.units) : undefined,
                        }
                    } : undefined,
                    // Lease option
                    lease: leaseSavings ? {
                        leasesAllowed: leaseSavings.leasesAllowed,
                        annualLeasingCost: leaseSavings.annualLeasingCost?.units ? Number(leaseSavings.annualLeasingCost.units) : undefined,
                        savings: {
                            savingsYear1: leaseSavings.savings?.savingsYear1?.units ? Number(leaseSavings.savings.savingsYear1.units) : undefined,
                            savingsYear20: leaseSavings.savings?.savingsYear20?.units ? Number(leaseSavings.savings.savingsYear20.units) : undefined,
                            savingsLifetime: leaseSavings.savings?.savingsLifetime?.units ? Number(leaseSavings.savings.savingsLifetime.units) : undefined,
                        }
                    } : undefined,
                    // Financed purchase
                    financed: financedSavings ? {
                        annualLoanPayment: financedSavings.annualLoanPayment?.units ? Number(financedSavings.annualLoanPayment.units) : undefined,
                        loanInterestRate: financedSavings.loanInterestRate,
                        savings: {
                            savingsYear1: financedSavings.savings?.savingsYear1?.units ? Number(financedSavings.savings.savingsYear1.units) : undefined,
                            savingsYear20: financedSavings.savings?.savingsYear20?.units ? Number(financedSavings.savings.savingsYear20.units) : undefined,
                            savingsLifetime: financedSavings.savings?.savingsLifetime?.units ? Number(financedSavings.savings.savingsLifetime.units) : undefined,
                        }
                    } : undefined,
                };
            }
        }

        return {
            maxSunshineHoursPerYear,
            carbonOffsetFactorKgPerMwh,
            panelCapacityWatts,
            maxArrayPanelsCount: (solarPanels || []).length,
            solarPanels: (solarPanels || []).map((p: any) => ({
                yearlyEnergyDcKwh: p.yearlyEnergyDcKwh
            })),
            estimatedSolarProduction: production,
            financialAnalysis,
            wholeRoofStats: wholeRoofStats ? {
                areaMeters2: wholeRoofStats.areaMeters2,
                sunshineQuantiles: wholeRoofStats.sunshineQuantiles,
                groundAreaMeters2: wholeRoofStats.groundAreaMeters2
            } : undefined
        };
    } catch (e) {
        console.error('Failed to fetch solar data', e);
        return null;
    }
};

// ─── Air Quality ──────────────────────────────────────────────────────────────
export const fetchAirQuality = async (lat: number, lng: number, zpid?: string, address?: string): Promise<any> => {
    const url = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${MAPS_API_KEY}`;

    const logId = await logAPICall({
        user_id: auth?.currentUser?.uid || 'unknown',
        zpid,
        address,
        api_name: 'Google AirQuality',
        endpoint: 'lookup',
        params: { lat, lng },
        status: 'pending'
    });
    const start = Date.now();

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location: { latitude: lat, longitude: lng },
                extraComputations: [
                    'HEALTH_RECOMMENDATIONS',
                    'DOMINANT_POLLUTANT_CONCENTRATION',
                    'POLLUTANT_CONCENTRATION'
                ],
                languageCode: 'en'
            })
        });

        if (logId) {
            updateAPICall(logId, {
                status: response.ok ? 'completed' : 'failed',
                response_time_ms: Date.now() - start,
                error: response.ok ? undefined : `Status ${response.status}`
            });
        }

        if (!response.ok) {
            console.warn(`[Air Quality API] Error: ${response.status}`);
            return null;
        }

        const data = await response.json();
        console.log('[Air Quality API] Successful response:', data);

        const uaqi = data.indexes?.find((idx: any) => idx.code === 'uaqi') || data.indexes?.[0];

        return {
            aqi: uaqi?.aqi,
            category: uaqi?.category,
            dominantPollutant: data.dominantPollutant,
            recommendations: {
                general: data.healthRecommendations?.generalPopulation,
                sensitiveGroups: data.healthRecommendations?.sensitiveGroups
            },
            pollutants: data.pollutants?.map((p: any) => ({
                name: p.code,
                fullName: p.displayName,
                concentration: p.concentration?.value,
                unit: p.concentration?.units
            }))
        };
    } catch (e) {
        console.error('Failed to fetch air quality data', e);
        return null;
    }
};

// ─── Pollen ───────────────────────────────────────────────────────────────────
export const fetchPollenData = async (lat: number, lng: number, zpid?: string, address?: string): Promise<any> => {
    const url = `https://pollen.googleapis.com/v1/forecast:lookup?key=${MAPS_API_KEY}&location.latitude=${lat}&location.longitude=${lng}&days=1`;

    const logId = await logAPICall({
        user_id: auth?.currentUser?.uid || 'unknown',
        zpid,
        address,
        api_name: 'Google Pollen',
        endpoint: 'lookup',
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
            console.warn(`[Pollen API] Error: ${response.status}`);
            return null;
        }

        const data = await response.json();
        console.log('[Pollen API] Successful response:', data);

        const today = data.dailyInfo?.[0];
        if (!today) return null;

        const maxPollen = today.pollenTypeInfo?.reduce((prev: any, current: any) => {
            return (prev.indexInfo?.value || 0) > (current.indexInfo?.value || 0) ? prev : current;
        });

        return {
            score: maxPollen?.indexInfo?.value,
            category: maxPollen?.indexInfo?.category,
            description: maxPollen?.indexInfo?.indexDescription,
            dominantPollenType: maxPollen?.displayName,
            pollenTypeInfo: today.pollenTypeInfo,
            plantInfo: today.plantInfo
        };
    } catch (e) {
        console.error('Failed to fetch pollen data', e);
        return null;
    }
};

// ─── Noise Score (HowLoud SoundScore) ────────────────────────────────────────
// Free tier: 2,500 req/mo — https://howloud.com/developers
export const fetchNoiseScore = async (
    lat: number,
    lng: number,
    zpid?: string,
    address?: string
): Promise<{
    score: number | null;
    description: string | null;
    trafficScore: number | null;
    trafficDesc: string | null;
    localScore: number | null;
    localDesc: string | null;
    airportScore: number | null;
    airportDesc: string | null;
} | null> => {
    const logId = await logAPICall({
        user_id: auth?.currentUser?.uid || 'unknown',
        zpid,
        address,
        api_name: 'HowLoud',
        endpoint: 'score',
        params: { lat, lng },
        status: 'pending'
    });
    const start = Date.now();

    try {
        // HowLoud blocks CORS — route through Cloud Function proxy (onRequest with explicit CORS headers).
        const { auth: firebaseAuth } = await import('../firebase/config');
        const idToken = firebaseAuth?.currentUser
            ? await firebaseAuth.currentUser.getIdToken()
            : null;

        if (!idToken) {
            console.warn('[HowLoud] No auth token available — skipping noise score.');
            return null;
        }

        const proxyUrl = 'https://us-central1-zyphe-af0bf.cloudfunctions.net/proxyNoiseScore';
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({ lat, lng }),
        });

        const data = await response.json();

        if (logId) {
            updateAPICall(logId, { status: 'completed', response_time_ms: Date.now() - start });
        }

        if (data?.status !== 'OK' || !Array.isArray(data?.result) || data.result.length === 0) {
            console.warn('[HowLoud] Unexpected response:', data);
            return null;
        }

        const { extractNumericValue } = await import('./utils');
        const row = data.result[0];
        return {
            score: extractNumericValue(row.score ?? null),
            description: row.scoretext ?? null,
            trafficScore: extractNumericValue(row.traffic ?? null),
            trafficDesc: row.traffictext ?? null,
            localScore: extractNumericValue(row.local ?? null),
            localDesc: row.localtext ?? null,
            airportScore: extractNumericValue(row.airports ?? null),
            airportDesc: row.airportstext ?? null,
        };
    } catch (e: any) {
        if (logId) {
            updateAPICall(logId, { status: 'failed', response_time_ms: Date.now() - start, error: e.message });
        }
        console.error('[HowLoud] Failed to fetch noise score via proxy:', e);
        return null;
    }
};

// ─── EV Chargers (NREL Alternative Fuel Station Locator) ─────────────────────
const NREL_API_KEY = 'tJazmG4548XD5humNAdLvG55RxdDCmxDbcBrxfDb';

export interface EVChargerData {
    totalStations: number;
    totalPorts: number;
    dcFastPorts: number;
    level2Ports: number;
    closestStationName: string | null;
    closestDistanceMi: number | null;
    networks: string[];
    connectorTypes: string[];
    fetchedAt: string;
}

export const fetchNearbyEVChargers = async (
    lat: number,
    lng: number,
    zpid?: string,
    address?: string
): Promise<EVChargerData | null> => {
    const url = `https://developer.nrel.gov/api/alt-fuel-stations/v1/nearest.json?api_key=${NREL_API_KEY}&latitude=${lat}&longitude=${lng}&radius=5&fuel_type=ELEC&status=E&access=public&limit=20`;

    const logId = await logAPICall({
        user_id: auth?.currentUser?.uid || 'unknown',
        zpid,
        address,
        api_name: 'NREL EV Stations',
        endpoint: 'nearest',
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
            console.warn(`[NREL EV API] Error: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const stations = data.fuel_stations || [];

        if (stations.length === 0) {
            return {
                totalStations: 0,
                totalPorts: 0,
                dcFastPorts: 0,
                level2Ports: 0,
                closestStationName: null,
                closestDistanceMi: null,
                networks: [],
                connectorTypes: [],
                fetchedAt: new Date().toISOString(),
            };
        }

        let totalDcFast = 0;
        let totalLevel2 = 0;
        const networkSet = new Set<string>();
        const connectorSet = new Set<string>();

        for (const s of stations) {
            totalDcFast += s.ev_dc_fast_num || 0;
            totalLevel2 += s.ev_level2_evse_num || 0;
            if (s.ev_network) networkSet.add(s.ev_network);
            if (s.ev_connector_types) {
                for (const c of s.ev_connector_types) connectorSet.add(c);
            }
        }

        const closest = stations[0]; // API returns sorted by distance

        return {
            totalStations: stations.length,
            totalPorts: totalDcFast + totalLevel2,
            dcFastPorts: totalDcFast,
            level2Ports: totalLevel2,
            closestStationName: closest.station_name || null,
            closestDistanceMi: closest.distance != null ? Math.round(closest.distance * 10) / 10 : null,
            networks: [...networkSet],
            connectorTypes: [...connectorSet],
            fetchedAt: new Date().toISOString(),
        };
    } catch (e) {
        console.error('[NREL EV API] Failed to fetch EV charger data', e);
        if (logId) {
            updateAPICall(logId, { status: 'failed', response_time_ms: Date.now() - start, error: (e as any).message });
        }
        return null;
    }
};

// ─── Census ACS Demographics ──────────────────────────────────────────────────

export interface CensusDemographics {
    tractId: string;               // e.g. "451502"
    countyFips: string;
    stateFips: string;
    medianHouseholdIncome: number | null;
    medianAge: number | null;
    totalPopulation: number | null;
    ownerOccupied: number | null;
    renterOccupied: number | null;
    ownerPct: number | null;       // 0-100
    renterPct: number | null;
    medianHomeValue: number | null;
    bachelorsPlusPct: number | null; // % with bachelor's or higher
    tractLabel: string;            // human-friendly label e.g. "Census Tract 4515.02"
    insight: string;
    fetchedAt: string;
}

// ACS 5-Year variable codes
const ACS_VARIABLES = [
    'B19013_001E', // Median household income
    'B01002_001E', // Median age
    'B01003_001E', // Total population
    'B25003_001E', // Total housing units (tenure)
    'B25003_002E', // Owner-occupied
    'B25003_003E', // Renter-occupied
    'B25077_001E', // Median home value
    'B15003_001E', // Total education (25+)
    'B15003_022E', // Bachelor's degree
    'B15003_023E', // Master's degree
    'B15003_024E', // Professional degree
    'B15003_025E', // Doctorate degree
].join(',');

export const fetchCensusDemographics = async (
    lat: number,
    lng: number,
    zpid?: string,
    address?: string,
): Promise<CensusDemographics | null> => {
    const start = Date.now();
    const logId = await logAPICall({
        user_id: auth?.currentUser?.uid || 'unknown',
        zpid,
        address,
        api_name: 'U.S. Census ACS',
        endpoint: 'acs5 + geocoder',
        params: { lat, lng },
        status: 'pending',
    });

    try {
        // Step 1: Geocode lat/lng → Census Tract FIPS
        const geoUrl = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
        const geoRes = await fetch(geoUrl);
        if (!geoRes.ok) throw new Error(`Census Geocoder failed: ${geoRes.status}`);
        const geoData = await geoRes.json();

        const geographies = geoData?.result?.geographies?.['Census Tracts'];
        if (!geographies || geographies.length === 0) {
            throw new Error('No census tract found for coordinates');
        }

        const tract = geographies[0];
        const stateFips = tract.STATE;   // e.g. "06" (California)
        const countyFips = tract.COUNTY; // e.g. "001" (Alameda)
        const tractId = tract.TRACT;     // e.g. "451502"
        const tractName = tract.BASENAME || `Tract ${tractId}`;

        // Step 2: Fetch ACS 5-Year Estimates for this tract
        const acsUrl = `https://api.census.gov/data/2022/acs/acs5?get=${ACS_VARIABLES}&for=tract:${tractId}&in=state:${stateFips}&in=county:${countyFips}`;
        const acsRes = await fetch(acsUrl);
        if (!acsRes.ok) throw new Error(`Census ACS failed: ${acsRes.status}`);
        const acsData = await acsRes.json();

        // ACS returns [headers[], values[]]
        if (!acsData || acsData.length < 2) throw new Error('No ACS data returned');
        const headers: string[] = acsData[0];
        const values: string[] = acsData[1];

        const getVal = (varCode: string): number | null => {
            const idx = headers.indexOf(varCode);
            if (idx === -1) return null;
            const v = parseInt(values[idx], 10);
            return isNaN(v) || v < 0 ? null : v;
        };

        const medianIncome = getVal('B19013_001E');
        const medianAge = (() => {
            const idx = headers.indexOf('B01002_001E');
            if (idx === -1) return null;
            const v = parseFloat(values[idx]);
            return isNaN(v) || v < 0 ? null : v;
        })();
        const totalPop = getVal('B01003_001E');
        const totalTenure = getVal('B25003_001E');
        const ownerOcc = getVal('B25003_002E');
        const renterOcc = getVal('B25003_003E');
        const medianHomeVal = getVal('B25077_001E');

        // Education: bachelor's + master's + professional + doctorate
        const totalEdu = getVal('B15003_001E');
        const bachelors = getVal('B15003_022E') || 0;
        const masters = getVal('B15003_023E') || 0;
        const professional = getVal('B15003_024E') || 0;
        const doctorate = getVal('B15003_025E') || 0;
        const collegeTotal = bachelors + masters + professional + doctorate;
        const bachelorsPlusPct = totalEdu && totalEdu > 0 ? Math.round((collegeTotal / totalEdu) * 100) : null;

        const ownerPct = totalTenure && totalTenure > 0 && ownerOcc != null ? Math.round((ownerOcc / totalTenure) * 100) : null;
        const renterPct = totalTenure && totalTenure > 0 && renterOcc != null ? Math.round((renterOcc / totalTenure) * 100) : null;

        // Generate insight
        let insight = `Census Tract ${tractName}`;
        if (medianIncome) insight += ` · Median income $${medianIncome.toLocaleString()}`;
        if (ownerPct != null) insight += ` · ${ownerPct}% owner-occupied`;
        if (bachelorsPlusPct != null) insight += ` · ${bachelorsPlusPct}% college-educated`;
        insight += '.';

        if (logId) {
            updateAPICall(logId, { status: 'completed', response_time_ms: Date.now() - start });
        }

        return {
            tractId,
            countyFips,
            stateFips,
            medianHouseholdIncome: medianIncome,
            medianAge,
            totalPopulation: totalPop,
            ownerOccupied: ownerOcc,
            renterOccupied: renterOcc,
            ownerPct,
            renterPct,
            medianHomeValue: medianHomeVal,
            bachelorsPlusPct,
            tractLabel: `Census Tract ${tractName}`,
            insight,
            fetchedAt: new Date().toISOString(),
        };
    } catch (e) {
        console.error('[Census ACS] Failed to fetch', e);
        if (logId) {
            updateAPICall(logId, { status: 'failed', response_time_ms: Date.now() - start, error: (e as any).message });
        }
        return null;
    }
};

// ─── Microclimate Delta (Tomorrow.io) ─────────────────────────────────────────

// Downtown baselines per city (lat, lng) — the "valley floor" reference points
const CITY_BASELINES: Record<string, { lat: number; lng: number; label: string }> = {
    'pleasanton': { lat: 37.6624, lng: -121.8747, label: 'Downtown Pleasanton' },
    'dublin': { lat: 37.7022, lng: -121.9358, label: 'Downtown Dublin' },
};

// In-memory cache for downtown baseline temps (saves 50% of API calls)
const baselineCache: Record<string, { temp: number; apparentTemp: number; humidity: number; windSpeed: number; fetchedAt: number }> = {};
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface MicroclimateDelta {
    propertyTemp: number;        // °C
    propertyApparentTemp: number;
    baselineTemp: number;        // °C
    baselineApparentTemp: number;
    delta: number;               // °C (negative = cooler than baseline)
    deltaF: number;              // °F equivalent
    baselineLabel: string;
    // Extra weather fields for richer insights
    humidity: number;            // % relative humidity at property
    windSpeed: number;           // m/s at property
    windGust: number;            // m/s at property
    survivalRating: { score: string; label: string; tip: string; color: string; mechanism: string };
    insight: string;
    fetchedAt: string;
}

function getSurvivalRating(delta: number, windSpeed: number, humidity: number): { score: string; label: string; tip: string; color: string; mechanism: string } {
    if (delta <= -3.0) return {
        score: '10/10', label: 'Cool Pocket', color: 'blue',
        mechanism: 'Thermal Buffering + Elevation',
        tip: 'Hill breezes and tree canopy create a natural cooling zone — perfect for summer dinners without the valley heat.'
    };
    if (delta <= -1.5) return {
        score: '8/10', label: 'Cool Retreat', color: 'emerald',
        mechanism: windSpeed > 3 ? 'Gap Wind Cooling' : 'Canopy Shade',
        tip: windSpeed > 3
            ? 'Canyon breezes reach this lot before the rest of the city — a natural AC.'
            : 'Dense vegetation and shade lower the effective temperature.'
    };
    if (delta <= -0.5) return {
        score: '7/10', label: 'Slightly Cooler', color: 'emerald',
        mechanism: 'Mild Elevation Benefit',
        tip: 'A subtle but real cooling effect — every degree counts on 100°F days.'
    };
    if (delta <= 0.5) return {
        score: '6/10', label: 'Typical Valley', color: 'slate',
        mechanism: 'Valley Floor Baseline',
        tip: 'Standard microclimate — matches the official weather station.'
    };
    if (delta <= 1.5) return {
        score: '5/10', label: 'Warm Pocket', color: 'amber',
        mechanism: humidity > 50 ? 'Humidity Trap' : 'Surface Albedo',
        tip: humidity > 50
            ? 'Higher humidity makes this lot feel warmer than official readings.'
            : 'Concrete and dark roofing absorb extra solar radiation.'
    };
    return {
        score: '4/10', label: 'Heat Island', color: 'orange',
        mechanism: 'Urban Heat Island',
        tip: 'Dense paving and low vegetation trap heat — budget for higher AC costs.'
    };
}

export const fetchMicroclimateDelta = async (
    propertyLat: number,
    propertyLng: number,
    city?: string,
    zpid?: string,
    address?: string,
): Promise<MicroclimateDelta | null> => {
    const TOMORROW_KEY = APP_CONFIG.tomorrow.key;
    if (!TOMORROW_KEY || TOMORROW_KEY === 'placeholder') {
        console.warn('[Microclimate] No VITE_TOMORROW_API_KEY configured');
        return null;
    }

    const cityKey = (city || 'pleasanton').toLowerCase().trim();
    const baseline = CITY_BASELINES[cityKey] || CITY_BASELINES['pleasanton'];

    const start = Date.now();
    const logId = await logAPICall({
        user_id: auth?.currentUser?.uid || 'unknown',
        zpid,
        address,
        api_name: 'Tomorrow.io Microclimate',
        endpoint: 'weather/realtime',
        params: { lat: propertyLat, lng: propertyLng, city: cityKey },
        status: 'pending',
    });

    try {
        // 1. Check baseline cache
        let baseTemp: number;
        let baseApparent: number;
        let baseHumidity: number;
        let baseWindSpeed: number;
        const cached = baselineCache[cityKey];
        if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
            baseTemp = cached.temp;
            baseApparent = cached.apparentTemp;
            baseHumidity = cached.humidity;
            baseWindSpeed = cached.windSpeed;
        } else {
            const baseRes = await fetch(
                `https://api.tomorrow.io/v4/weather/realtime?location=${baseline.lat},${baseline.lng}&apikey=${TOMORROW_KEY}`
            );
            if (!baseRes.ok) throw new Error(`Baseline fetch failed: ${baseRes.status}`);
            const baseData = await baseRes.json();
            const v = baseData.data.values;
            baseTemp = v.temperature;
            baseApparent = v.temperatureApparent;
            baseHumidity = v.humidity || 0;
            baseWindSpeed = v.windSpeed || 0;
            baselineCache[cityKey] = { temp: baseTemp, apparentTemp: baseApparent, humidity: baseHumidity, windSpeed: baseWindSpeed, fetchedAt: Date.now() };
        }

        // 2. Fetch property temperature + wind + humidity
        const propRes = await fetch(
            `https://api.tomorrow.io/v4/weather/realtime?location=${propertyLat},${propertyLng}&apikey=${TOMORROW_KEY}`
        );
        if (!propRes.ok) throw new Error(`Property fetch failed: ${propRes.status}`);
        const propData = await propRes.json();
        const pv = propData.data.values;
        const propTemp = pv.temperature;
        const propApparent = pv.temperatureApparent;
        const propHumidity = pv.humidity || 0;
        const propWindSpeed = pv.windSpeed || 0;
        const propWindGust = pv.windGust || 0;

        // 3. Compute delta (using RealFeel/apparent temp)
        const delta = parseFloat((propApparent - baseApparent).toFixed(1));
        const deltaF = parseFloat((delta * 9 / 5).toFixed(1));
        const survivalRating = getSurvivalRating(delta, propWindSpeed, propHumidity);

        // 4. Generate "Thermal Fingerprint" insight
        const absDeltaF = Math.abs(deltaF);
        const officialF = Math.round(baseApparent * 9 / 5 + 32);
        const actualFeelF = Math.round(propApparent * 9 / 5 + 32);
        let insight: string;
        if (delta <= -1.5) {
            insight = `Every home has a unique thermal fingerprint. While the official temperature at ${baseline.label} is ${officialF}°F, this specific lot actually feels like ${actualFeelF}°F — a ${absDeltaF}°F "Summer Survival Gap." ${survivalRating.mechanism === 'Gap Wind Cooling' ? 'Canyon breezes reach this location before the rest of town.' : 'Elevation and tree canopy create a natural cooling buffer.'}`;
        } else if (delta >= 1.5) {
            insight = `This lot's thermal fingerprint runs ${absDeltaF}°F warmer than ${baseline.label} (${officialF}°F vs ${actualFeelF}°F here). ${survivalRating.mechanism === 'Humidity Trap' ? 'Higher local humidity amplifies the warmth.' : 'Dark roofing and paved surroundings absorb extra solar radiation.'}`;
        } else {
            insight = `This property's thermal fingerprint closely matches ${baseline.label} (${officialF}°F official vs ${actualFeelF}°F here). No significant microclimate variation detected at this time.`;
        }

        if (logId) {
            updateAPICall(logId, { status: 'completed', response_time_ms: Date.now() - start });
        }

        return {
            propertyTemp: propTemp,
            propertyApparentTemp: propApparent,
            baselineTemp: baseTemp,
            baselineApparentTemp: baseApparent,
            delta,
            deltaF,
            baselineLabel: baseline.label,
            humidity: propHumidity,
            windSpeed: propWindSpeed,
            windGust: propWindGust,
            survivalRating,
            insight,
            fetchedAt: new Date().toISOString(),
        };
    } catch (e) {
        console.error('[Microclimate] Failed to fetch', e);
        if (logId) {
            updateAPICall(logId, { status: 'failed', response_time_ms: Date.now() - start, error: (e as any).message });
        }
        return null;
    }
};
