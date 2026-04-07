/**
 * Cost-of-Living Data Service
 *
 * Provides local utility cost estimates for the AffordabilityCard.
 * Data sources:
 *  - Electricity: EIA (eia.gov) state average ¢/kWh + EnergySage regional estimates
 *  - Gas: GasBuddy regional averages (live endpoint via proxy when available)
 *  - Grocery: Numbeo / MIT Living Wage state cost index (indexed to US avg = 100)
 *  - Water: AWWA bi-annual survey + local district rate sheets
 *
 * TODO: Wire each section to a live Cloud Function proxy as APIs become available.
 */

export interface CostOfLivingData {
    electricity: ElectricityCost;
    gas: GasCost;
    grocery: GroceryCost;
    water: WaterCost;
    /** Total estimated monthly cost of living (utilities + groceries baseline) */
    totalMonthlyEstimate: number;
    fetchedAt: string;
}

export interface ElectricityCost {
    /** Cents per kWh */
    rateCentsPerKwh: number;
    /** Estimated monthly bill for a ~1,800 sq ft home */
    estimatedMonthlyBill: number;
    /** vs US avg (e.g. +15% means 15% higher than national) */
    vsNationalAvgPct: number;
    tier: 'low' | 'average' | 'high' | 'very-high';
    geminiCallout: string;
    source: string;
}

export interface GasCost {
    /** Price per gallon (regular unleaded) */
    pricePerGallon: number;
    vsNationalAvgPct: number;
    tier: 'low' | 'average' | 'high' | 'very-high';
    geminiCallout: string;
    source: string;
}

export interface GroceryCost {
    /** Cost index: 100 = US average */
    costIndex: number;
    /** Estimated monthly grocery spend for a family of 4 */
    estimatedMonthlySpend: number;
    vsNationalAvgPct: number;
    tier: 'low' | 'average' | 'high' | 'very-high';
    geminiCallout: string;
    source: string;
}

export interface WaterCost {
    /** Price per CCF (100 cubic feet) */
    pricePerCcf: number;
    /** Estimated monthly bill for typical residential use (~6 CCF/mo) */
    estimatedMonthlyBill: number;
    droughtTier: 'none' | 'tier1' | 'tier2' | 'drought-surcharge';
    vsNationalAvgPct: number;
    tier: 'low' | 'average' | 'high' | 'very-high';
    geminiCallout: string;
    source: string;
}

// ─── Static Regional Baselines ───────────────────────────────────────────────
// Source: EIA 2024, GasBuddy Q1 2025, Numbeo 2024, AWWA 2023 survey

const US_AVG_ELECTRICITY_CENTS = 16.0;  // EIA US avg ¢/kWh
const US_AVG_GAS_PPG = 3.55;            // GasBuddy 2025 US avg
const US_AVG_GROCERY_INDEX = 100;       // Numbeo baseline
const US_AVG_GROCERY_MONTHLY = 900;     // MIT Living Wage family-of-4 food baseline
const US_AVG_WATER_CCF = 3.0;           // AWWA avg $/CCF

interface StateBaseline {
    electricityCents: number;
    gasPPG: number;
    groceryIndex: number;
    waterCcf: number;
    droughtTier: WaterCost['droughtTier'];
}

// State-level baselines — city overrides below
const STATE_BASELINES: Record<string, StateBaseline> = {
    CA: { electricityCents: 33.0, gasPPG: 5.10, groceryIndex: 115, waterCcf: 6.40, droughtTier: 'tier2' },
    NY: { electricityCents: 22.0, gasPPG: 3.90, groceryIndex: 125, waterCcf: 4.20, droughtTier: 'none' },
    TX: { electricityCents: 14.5, gasPPG: 3.05, groceryIndex: 92,  waterCcf: 3.10, droughtTier: 'tier1' },
    FL: { electricityCents: 13.8, gasPPG: 3.50, groceryIndex: 98,  waterCcf: 3.80, droughtTier: 'none' },
    IL: { electricityCents: 14.2, gasPPG: 3.60, groceryIndex: 100, waterCcf: 3.20, droughtTier: 'none' },
    WA: { electricityCents: 11.5, gasPPG: 4.50, groceryIndex: 108, waterCcf: 3.50, droughtTier: 'tier1' },
    OR: { electricityCents: 12.0, gasPPG: 4.30, groceryIndex: 105, waterCcf: 3.30, droughtTier: 'tier1' },
    CO: { electricityCents: 13.5, gasPPG: 3.30, groceryIndex: 99,  waterCcf: 2.80, droughtTier: 'tier1' },
    AZ: { electricityCents: 14.0, gasPPG: 3.60, groceryIndex: 96,  waterCcf: 3.00, droughtTier: 'drought-surcharge' },
    NV: { electricityCents: 13.5, gasPPG: 4.00, groceryIndex: 102, waterCcf: 3.20, droughtTier: 'drought-surcharge' },
    MA: { electricityCents: 26.0, gasPPG: 3.75, groceryIndex: 118, waterCcf: 5.50, droughtTier: 'none' },
    GA: { electricityCents: 12.0, gasPPG: 3.15, groceryIndex: 95,  waterCcf: 2.70, droughtTier: 'none' },
    NC: { electricityCents: 12.5, gasPPG: 3.20, groceryIndex: 94,  waterCcf: 2.80, droughtTier: 'none' },
    OH: { electricityCents: 13.0, gasPPG: 3.50, groceryIndex: 93,  waterCcf: 2.90, droughtTier: 'none' },
    MN: { electricityCents: 14.5, gasPPG: 3.45, groceryIndex: 97,  waterCcf: 2.75, droughtTier: 'none' },
    VA: { electricityCents: 12.5, gasPPG: 3.30, groceryIndex: 98,  waterCcf: 3.00, droughtTier: 'none' },
};

// City-level overrides (PG&E zones, LADWP, etc.)
const CITY_OVERRIDES: Record<string, Partial<StateBaseline>> = {
    'san francisco':    { electricityCents: 38.0, waterCcf: 8.50 },
    'san jose':         { electricityCents: 35.0, waterCcf: 7.20 },
    'los angeles':      { electricityCents: 30.0, waterCcf: 4.80, gasPPG: 5.30 },
    'san diego':        { electricityCents: 42.0, waterCcf: 7.80 },
    'pleasanton':       { electricityCents: 33.0, waterCcf: 6.10 },
    'dublin':           { electricityCents: 33.0, waterCcf: 6.30 },
    'fremont':          { electricityCents: 33.5, waterCcf: 5.90 },
    'oakland':          { electricityCents: 35.0, waterCcf: 9.20 },
    'sacramento':       { electricityCents: 25.0, waterCcf: 5.00 },
    'new york':         { electricityCents: 28.0, groceryIndex: 140, waterCcf: 5.80 },
    'chicago':          { electricityCents: 15.0, groceryIndex: 105 },
    'austin':           { electricityCents: 13.0, gasPPG: 2.99, groceryIndex: 95 },
    'seattle':          { electricityCents: 11.0, gasPPG: 4.70, groceryIndex: 112 },
    'denver':           { electricityCents: 14.0, gasPPG: 3.25 },
    'phoenix':          { electricityCents: 14.5, gasPPG: 3.55 },
    'miami':            { electricityCents: 14.5, groceryIndex: 104 },
};

const DEFAULT_BASELINE: StateBaseline = {
    electricityCents: US_AVG_ELECTRICITY_CENTS,
    gasPPG: US_AVG_GAS_PPG,
    groceryIndex: US_AVG_GROCERY_INDEX,
    waterCcf: US_AVG_WATER_CCF,
    droughtTier: 'none',
};

function getBaseline(state?: string, city?: string): StateBaseline {
    const stateBase = STATE_BASELINES[state?.toUpperCase() || ''] || DEFAULT_BASELINE;
    const cityKey = city?.toLowerCase().trim() || '';
    const cityOverride = CITY_OVERRIDES[cityKey] || {};
    return { ...stateBase, ...cityOverride };
}

function calcVsAvg(value: number, avg: number): number {
    return Math.round(((value - avg) / avg) * 100);
}

function elecTier(cents: number): ElectricityCost['tier'] {
    if (cents < 12) return 'low';
    if (cents < 18) return 'average';
    if (cents < 28) return 'high';
    return 'very-high';
}

function gasTier(ppg: number): GasCost['tier'] {
    if (ppg < 2.80) return 'low';
    if (ppg < 3.80) return 'average';
    if (ppg < 4.80) return 'high';
    return 'very-high';
}

function groceryTier(idx: number): GroceryCost['tier'] {
    if (idx < 90)  return 'low';
    if (idx < 108) return 'average';
    if (idx < 125) return 'high';
    return 'very-high';
}

function waterTier(ccf: number): WaterCost['tier'] {
    if (ccf < 2.50) return 'low';
    if (ccf < 4.00) return 'average';
    if (ccf < 7.00) return 'high';
    return 'very-high';
}

// ─── Monthly estimate helpers ──────────────────────────────────────────────────

/** Estimated kWh/month for a typical 1,800 sq ft home */
function estimateMonthlyKwh(sqft: number = 1800): number {
    // EIA avg: ~900 kWh/mo for 1000 sqft, roughly linearly scales
    return Math.round((sqft / 1000) * 900);
}

// ─── Gemini-style narrative callouts ──────────────────────────────────────────

function elecCallout(cents: number, city: string, monthlyBill: number, vsAvg: number): string {
    const direction = vsAvg > 0 ? `${vsAvg}% above` : `${Math.abs(vsAvg)}% below`;
    const cityLabel = city || 'this area';
    if (cents >= 30) {
        return `At ${cents}¢/kWh, ${cityLabel}'s grid is one of the priciest in the country — ${direction} the national avg. Expect ~$${monthlyBill}/mo in cooling costs; a 6kW solar system could cut that by 60-80%.`;
    } else if (cents >= 20) {
        return `At ${cents}¢/kWh (${direction} national avg), electricity here is above average. A typical 1,800 sqft home runs ~$${monthlyBill}/mo — plan ahead for AC-heavy summers.`;
    } else {
        return `At ${cents}¢/kWh (${direction} national avg), electricity here is relatively affordable. A typical home runs ~$${monthlyBill}/mo.`;
    }
}

function gasCallout(ppg: number, city: string, vsAvg: number): string {
    const direction = vsAvg > 0 ? `${vsAvg}% above` : `${Math.abs(vsAvg)}% below`;
    const cityLabel = city || 'Local pumps';
    if (ppg >= 5) {
        return `${cityLabel} currently averages $${ppg.toFixed(2)}/gal — ${direction} the US average. Hybrid or EV ownership pays off faster here.`;
    } else if (ppg >= 4) {
        return `Gas averages $${ppg.toFixed(2)}/gal locally (${direction} national). Budget ~$${Math.round(ppg * 50)}/mo for a 1,000-mile-per-month driver.`;
    } else {
        return `At $${ppg.toFixed(2)}/gal (${direction} national avg), fuel costs here are manageable. Daily commutes under 30 miles are very affordable.`;
    }
}

function groceryCallout(idx: number, monthlySpend: number, vsAvg: number, state: string): string {
    const direction = vsAvg > 0 ? `${vsAvg}% higher` : `${Math.abs(vsAvg)}% lower`;
    if (idx >= 125) {
        return `Groceries here trend ${direction} than the California average. A family of 4 typically spends ~$${monthlySpend}/mo — upscale chains and limited competition drive costs up.`;
    } else if (idx >= 108) {
        return `Grocery prices run ${direction} than the state average (~$${monthlySpend}/mo for a family of 4). Mix of premium and budget stores available.`;
    } else {
        return `Grocery costs here are ${direction} than the state average (~$${monthlySpend}/mo for a family of 4). Competitive market with strong discount options.`;
    }
}

function waterCallout(ccf: number, monthlyBill: number, drought: WaterCost['droughtTier'], vsAvg: number): string {
    const direction = vsAvg > 0 ? `${vsAvg}% above` : `${Math.abs(vsAvg)}% below`;
    const droughtNote = drought === 'drought-surcharge'
        ? ' Active drought surcharges currently apply — conservation rebates may offset costs.'
        : drought === 'tier2'
        ? ' Tiered drought pricing — heavy outdoor use triggers Tier 2 rates.'
        : '';
    return `At $${ccf.toFixed(2)}/CCF (${direction} national avg), typical residential use runs ~$${monthlyBill}/mo.${droughtNote}`;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function buildCostOfLivingData(
    state?: string,
    city?: string,
    sqft?: number,
): CostOfLivingData {
    const b = getBaseline(state, city);
    const monthlyKwh = estimateMonthlyKwh(sqft);
    const elecBill = Math.round(monthlyKwh * b.electricityCents / 100);

    // Water: assume ~6 CCF/mo average residential
    const waterBill = Math.round(6 * b.waterCcf);

    // Grocery: scale index against MIT baseline
    const groceryMonthly = Math.round(US_AVG_GROCERY_MONTHLY * b.groceryIndex / 100);

    const elecVsAvg = calcVsAvg(b.electricityCents, US_AVG_ELECTRICITY_CENTS);
    const gasVsAvg  = calcVsAvg(b.gasPPG, US_AVG_GAS_PPG);
    const groceryVsAvg = calcVsAvg(b.groceryIndex, US_AVG_GROCERY_INDEX);
    const waterVsAvg = calcVsAvg(b.waterCcf, US_AVG_WATER_CCF);

    const cityLabel = city ? city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : (state || 'this area');

    const electricity: ElectricityCost = {
        rateCentsPerKwh: b.electricityCents,
        estimatedMonthlyBill: elecBill,
        vsNationalAvgPct: elecVsAvg,
        tier: elecTier(b.electricityCents),
        geminiCallout: elecCallout(b.electricityCents, cityLabel, elecBill, elecVsAvg),
        source: 'EIA 2024 (via EnergySage regional model)',
    };

    const gas: GasCost = {
        pricePerGallon: b.gasPPG,
        vsNationalAvgPct: gasVsAvg,
        tier: gasTier(b.gasPPG),
        geminiCallout: gasCallout(b.gasPPG, cityLabel, gasVsAvg),
        source: 'GasBuddy Q1 2025 regional avg',
    };

    const grocery: GroceryCost = {
        costIndex: b.groceryIndex,
        estimatedMonthlySpend: groceryMonthly,
        vsNationalAvgPct: groceryVsAvg,
        tier: groceryTier(b.groceryIndex),
        geminiCallout: groceryCallout(b.groceryIndex, groceryMonthly, groceryVsAvg, state || ''),
        source: 'Numbeo 2024 · MIT Living Wage Calculator',
    };

    const water: WaterCost = {
        pricePerCcf: b.waterCcf,
        estimatedMonthlyBill: waterBill,
        droughtTier: b.droughtTier,
        vsNationalAvgPct: waterVsAvg,
        tier: waterTier(b.waterCcf),
        geminiCallout: waterCallout(b.waterCcf, waterBill, b.droughtTier, waterVsAvg),
        source: 'AWWA 2023 survey · Local district rate sheets',
    };

    const totalMonthlyEstimate = elecBill + waterBill + groceryMonthly;

    return {
        electricity,
        gas,
        grocery,
        water,
        totalMonthlyEstimate,
        fetchedAt: new Date().toISOString(),
    };
}
