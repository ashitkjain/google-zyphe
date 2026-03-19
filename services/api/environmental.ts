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
