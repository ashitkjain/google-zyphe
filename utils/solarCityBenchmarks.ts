/**
 * Static city-level solar benchmarks used to compare individual property
 * Google Solar API data against local averages.
 *
 * Sources: Google Solar API regional data, EIA consumption stats, PG&E rate schedules.
 * Last verified: March 2026.
 */

export interface CitySolarBenchmark {
    /** City name (lowercase for lookup) */
    city: string;
    state: string;
    /** Average max sunshine hours per year for a typical roof in this city */
    avgSunshineHoursPerYear: number;
    /** Average peak sun hours per day (solar-intensity equivalent) */
    avgPeakSunHoursPerDay: number;
    /** Annual solar flux threshold in kWh/kW/year */
    avgFluxKwhPerKw: number;
    /** Annual production for a typical 5kW system (kWh/yr) */
    avgSystemProductionKwh: number;
    /** Average monthly household electricity consumption (kWh) */
    avgMonthlyConsumptionKwh: number;
    /** Average annual household electricity consumption (kWh) */
    avgAnnualConsumptionKwh: number;
    /** Average electricity rate ($/kWh) */
    avgElectricRate: number;
    /** Average monthly electric bill ($) */
    avgMonthlyBill: number;
    /** Thresholds for sunshine classification */
    sunshineThresholds: {
        excellent: number;  // Above this = "Excellent Natural Light"
        good: number;       // Above this = "Good Natural Light"
        belowAvg: number;   // Below this = "Below Average"
    };
    /** Thresholds for flux classification */
    fluxThresholds: {
        highEfficiency: number;  // Above this = "High Efficiency Roof"
        low: number;             // Below this = "Considerable Shade/Obstruction"
    };
}

/**
 * Pre-researched city benchmarks.
 * Add more cities as we expand coverage.
 */
const CITY_BENCHMARKS: CitySolarBenchmark[] = [
    {
        city: 'pleasanton',
        state: 'CA',
        avgSunshineHoursPerYear: 3058,
        avgPeakSunHoursPerDay: 5.5,
        avgFluxKwhPerKw: 1300,
        avgSystemProductionKwh: 8500,
        avgMonthlyConsumptionKwh: 907,
        avgAnnualConsumptionKwh: 10884,
        avgElectricRate: 0.30,
        avgMonthlyBill: 271,
        sunshineThresholds: { excellent: 3100, good: 2900, belowAvg: 2700 },
        fluxThresholds: { highEfficiency: 1700, low: 1100 },
    },
    {
        city: 'dublin',
        state: 'CA',
        avgSunshineHoursPerYear: 3020,
        avgPeakSunHoursPerDay: 5.4,
        avgFluxKwhPerKw: 1280,
        avgSystemProductionKwh: 8300,
        avgMonthlyConsumptionKwh: 920,
        avgAnnualConsumptionKwh: 11040,
        avgElectricRate: 0.30,
        avgMonthlyBill: 276,
        sunshineThresholds: { excellent: 3050, good: 2850, belowAvg: 2650 },
        fluxThresholds: { highEfficiency: 1680, low: 1080 },
    },
    {
        city: 'livermore',
        state: 'CA',
        avgSunshineHoursPerYear: 3100,
        avgPeakSunHoursPerDay: 5.6,
        avgFluxKwhPerKw: 1320,
        avgSystemProductionKwh: 8600,
        avgMonthlyConsumptionKwh: 940,
        avgAnnualConsumptionKwh: 11280,
        avgElectricRate: 0.30,
        avgMonthlyBill: 282,
        sunshineThresholds: { excellent: 3150, good: 2950, belowAvg: 2750 },
        fluxThresholds: { highEfficiency: 1720, low: 1120 },
    },
    {
        city: 'san ramon',
        state: 'CA',
        avgSunshineHoursPerYear: 2980,
        avgPeakSunHoursPerDay: 5.3,
        avgFluxKwhPerKw: 1270,
        avgSystemProductionKwh: 8200,
        avgMonthlyConsumptionKwh: 890,
        avgAnnualConsumptionKwh: 10680,
        avgElectricRate: 0.30,
        avgMonthlyBill: 267,
        sunshineThresholds: { excellent: 3020, good: 2820, belowAvg: 2620 },
        fluxThresholds: { highEfficiency: 1660, low: 1060 },
    },
    {
        city: 'danville',
        state: 'CA',
        avgSunshineHoursPerYear: 2960,
        avgPeakSunHoursPerDay: 5.2,
        avgFluxKwhPerKw: 1260,
        avgSystemProductionKwh: 8100,
        avgMonthlyConsumptionKwh: 950,
        avgAnnualConsumptionKwh: 11400,
        avgElectricRate: 0.30,
        avgMonthlyBill: 285,
        sunshineThresholds: { excellent: 3000, good: 2800, belowAvg: 2600 },
        fluxThresholds: { highEfficiency: 1650, low: 1050 },
    },
];

/** Fallback for California cities not in our database */
const CA_FALLBACK: CitySolarBenchmark = {
    city: '_california_default',
    state: 'CA',
    avgSunshineHoursPerYear: 3000,
    avgPeakSunHoursPerDay: 5.4,
    avgFluxKwhPerKw: 1299,
    avgSystemProductionKwh: 8400,
    avgMonthlyConsumptionKwh: 907,
    avgAnnualConsumptionKwh: 10884,
    avgElectricRate: 0.30,
    avgMonthlyBill: 271,
    sunshineThresholds: { excellent: 3050, good: 2850, belowAvg: 2650 },
    fluxThresholds: { highEfficiency: 1700, low: 1100 },
};

/**
 * Look up city benchmarks. Falls back to California default if city not found.
 */
export function getCityBenchmark(city?: string, state?: string): CitySolarBenchmark {
    if (!city) return CA_FALLBACK;
    const key = city.toLowerCase().trim();
    return CITY_BENCHMARKS.find(b => b.city === key) || CA_FALLBACK;
}

// ─── COMPUTED SOLAR INSIGHTS ─────────────────────────────────────────────────

export interface SolarBenchmarkResult {
    /** "Excellent Natural Light" | "Good Natural Light" | "Average" | "Below Average" */
    sunshineRating: string;
    /** Percentage vs city average sunshine */
    sunshinePctOfAvg: number;
    /** "High Efficiency Roof" | "Average Roof" | "Shaded / Obstructed" */
    roofEfficiencyRating: string;
    /** Percentage of average household consumption that solar can offset */
    energyOffsetPct: number;
    /** "Net Zero Potential" | "High Offset" | "Partial Offset" | "Low Offset" */
    offsetRating: string;
    /** Estimated monthly savings vs average bill ($) */
    estMonthlySavings: number;
    /** Insight text for display */
    insight: string;
    /** City name used for comparison */
    benchmarkCity: string;
    /** Whether we used a city-specific benchmark (true) or fallback (false) */
    isCitySpecific: boolean;
}

/**
 * Compute solar benchmark comparison for a property.
 *
 * @param solarData - Google Solar API data from property
 * @param city - City name (e.g. "Pleasanton")
 * @param state - State code (e.g. "CA")
 */
export function computeSolarBenchmarks(
    solarData: any,
    city?: string,
    state?: string,
): SolarBenchmarkResult | null {
    if (!solarData) return null;

    const bench = getCityBenchmark(city, state);
    const isCitySpecific = bench.city !== '_california_default';
    const cityLabel = isCitySpecific ? city! : 'California';

    // 1. Sunshine Rating
    const sunshine = solarData.maxSunshineHoursPerYear || 0;
    const sunshinePct = bench.avgSunshineHoursPerYear > 0
        ? Math.round((sunshine / bench.avgSunshineHoursPerYear) * 100)
        : 0;

    let sunshineRating: string;
    if (sunshine >= bench.sunshineThresholds.excellent) sunshineRating = 'Excellent Natural Light';
    else if (sunshine >= bench.sunshineThresholds.good) sunshineRating = 'Good Natural Light';
    else if (sunshine >= bench.sunshineThresholds.belowAvg) sunshineRating = 'Average';
    else sunshineRating = 'Below Average';

    // 2. Roof Efficiency Rating (based on per-kW flux, uses ALL panels to measure roof quality)
    const maxProduction = solarData.estimatedSolarProduction?.annualKwh
        || solarData.yearlyEnergyDcKwh || 0;
    const totalPanels = solarData.estimatedSolarProduction?.estimatedPanels
        || solarData.maxArrayPanelsCount || 1;
    const panelWatts = solarData.panelCapacityWatts || 400;
    const totalSystemKw = totalPanels * (panelWatts / 1000);
    const fluxPerKw = totalSystemKw > 0 ? maxProduction / totalSystemKw : 0;

    let roofEfficiencyRating: string;
    if (fluxPerKw >= bench.fluxThresholds.highEfficiency) roofEfficiencyRating = 'High Efficiency Roof';
    else if (fluxPerKw >= bench.fluxThresholds.low) roofEfficiencyRating = 'Average Roof';
    else roofEfficiencyRating = 'Shaded / Obstructed';

    // 3. Energy Offset — use REALISTIC system production, not theoretical max
    // Priority: financial analysis optimal → typical 20-panel system → capped estimate
    let realisticProduction = 0;

    // (a) Financial analysis already picks the optimal panel count
    const financialPanelCount = solarData.financialAnalysis?.panelCount;
    if (financialPanelCount && financialPanelCount > 0 && solarData.solarPanels?.length) {
        // Sum per-panel production for the optimal panel count (panels are sorted best-first)
        const optimalPanels = solarData.solarPanels.slice(0, financialPanelCount);
        const dcKwh = optimalPanels.reduce((s: number, p: any) => s + (p.yearlyEnergyDcKwh || 0), 0);
        realisticProduction = dcKwh * 0.85; // 85% DC→AC efficiency
    }

    // (b) Fallback: estimate a typical residential system (~20 panels, ~8kW)
    if (!realisticProduction && solarData.solarPanels?.length) {
        const typicalPanelCount = Math.min(20, solarData.solarPanels.length);
        const bestPanels = solarData.solarPanels.slice(0, typicalPanelCount);
        const dcKwh = bestPanels.reduce((s: number, p: any) => s + (p.yearlyEnergyDcKwh || 0), 0);
        realisticProduction = dcKwh * 0.85;
    }

    // (c) Last resort: scale down max production to a ~8kW equivalent
    if (!realisticProduction && maxProduction > 0) {
        const typicalKw = 8;
        realisticProduction = totalSystemKw > 0
            ? maxProduction * (typicalKw / totalSystemKw)
            : maxProduction;
    }

    const energyOffsetPct = bench.avgAnnualConsumptionKwh > 0
        ? Math.round((realisticProduction / bench.avgAnnualConsumptionKwh) * 100)
        : 0;

    let offsetRating: string;
    if (energyOffsetPct >= 100) offsetRating = 'Net Zero Potential';
    else if (energyOffsetPct >= 75) offsetRating = 'High Offset';
    else if (energyOffsetPct >= 40) offsetRating = 'Partial Offset';
    else offsetRating = 'Low Offset';

    // 4. Estimated monthly savings (based on realistic production)
    const annualSavings = realisticProduction * bench.avgElectricRate;
    const estMonthlySavings = Math.round(annualSavings / 12);

    // 5. Generate insight
    const sunshineStr = Math.round(sunshine).toLocaleString();
    const realisticKwhStr = Math.round(realisticProduction).toLocaleString();
    let insight: string;
    if (energyOffsetPct >= 100) {
        insight = `With a typical system producing ~${realisticKwhStr} kWh/yr, this home has ${energyOffsetPct}% energy offset potential for the average ${cityLabel} household — enough to eliminate the electric bill.`;
    } else if (energyOffsetPct >= 75) {
        insight = `A typical solar system here would produce ~${realisticKwhStr} kWh/yr, offsetting ~${energyOffsetPct}% of a ${cityLabel} household's energy use and saving ~$${estMonthlySavings}/mo.`;
    } else if (sunshine < bench.sunshineThresholds.belowAvg) {
        insight = `This property receives ${sunshinePct}% of ${cityLabel}'s average sunshine (${sunshineStr} vs ${bench.avgSunshineHoursPerYear.toLocaleString()} hrs). Nearby trees or structures may reduce solar potential.`;
    } else {
        insight = `With ${sunshineStr} sunshine hours (${sunshinePct}% of ${cityLabel} avg), a typical system could offset ~${energyOffsetPct}% of usage, saving ~$${estMonthlySavings}/mo.`;
    }

    return {
        sunshineRating,
        sunshinePctOfAvg: sunshinePct,
        roofEfficiencyRating,
        energyOffsetPct,
        offsetRating,
        estMonthlySavings,
        insight,
        benchmarkCity: cityLabel,
        isCitySpecific,
    };
}

// ─── NATURAL LIGHT SCORE ─────────────────────────────────────────────────────

export interface NaturalLightResult {
    /** 0–100 brightness score */
    score: number;
    /** "Exceptional" | "Bright" | "Average" | "Below Average" | "Dark" */
    label: string;
    /** Percentile bucket based on sunshineQuantiles (p25, p50, p75 etc.) */
    quantileBucket: string;
    /** The quantile values [p0, p25, p50, p75, p100] if available */
    quantiles?: number[];
    /** Tags for context graph */
    tags: string[];
}

/**
 * Compute a Natural Light / Brightness Score from Google Solar API data.
 *
 * Uses `sunshineQuantiles` from wholeRoofStats (11 quantile values from p0 to p100)
 * and `maxSunshineHoursPerYear` compared to city averages.
 *
 * The score represents how bright/sunny the property is relative to its city,
 * factoring in roof geometry, neighboring obstructions (trees, chimneys), and orientation.
 */
export function computeNaturalLightScore(
    solarData: any,
    city?: string,
    state?: string,
): NaturalLightResult | null {
    if (!solarData) return null;

    const bench = getCityBenchmark(city, state);
    const sunshine = solarData.maxSunshineHoursPerYear || 0;
    const quantiles: number[] | undefined = solarData.wholeRoofStats?.sunshineQuantiles;

    // Ratio vs city average (0–2+ range, 1.0 = exactly average)
    const ratio = bench.avgSunshineHoursPerYear > 0
        ? sunshine / bench.avgSunshineHoursPerYear
        : 0;

    // Quantile-based analysis: where does the median roof segment fall?
    let quantileBucket = 'Unknown';
    let quantileBonus = 0;
    if (quantiles && quantiles.length >= 5) {
        // quantiles typically: [p0, p10, p20, ..., p100] — 11 values
        const median = quantiles[Math.floor(quantiles.length / 2)]; // ~p50
        const p75 = quantiles[Math.floor(quantiles.length * 0.75)];
        const p25 = quantiles[Math.floor(quantiles.length * 0.25)];
        const spread = p75 - p25;

        if (median > sunshine * 0.9) {
            quantileBucket = 'Uniformly Bright';
            quantileBonus = 10; // Most of the roof gets great sun
        } else if (median > sunshine * 0.7) {
            quantileBucket = 'Mostly Bright';
            quantileBonus = 5;
        } else if (spread > sunshine * 0.5) {
            quantileBucket = 'Mixed (Sunny + Shaded Zones)';
            quantileBonus = 0;
        } else {
            quantileBucket = 'Uniformly Shaded';
            quantileBonus = -10;
        }
    }

    // Score: ratio maps to 0–100, with quantile bonus
    const rawScore = Math.round(ratio * 50 + quantileBonus);
    const score = Math.max(0, Math.min(100, rawScore));

    // Label
    let label: string;
    if (score >= 80) label = 'Exceptional';
    else if (score >= 60) label = 'Bright';
    else if (score >= 45) label = 'Average';
    else if (score >= 30) label = 'Below Average';
    else label = 'Dark';

    // Context-aware tags
    const tags: string[] = [];
    tags.push(`Natural Light: ${label} (${score}/100)`);
    tags.push(quantileBucket);

    if (score >= 60) {
        tags.push('Great Natural Light');
    }
    if (score < 35) {
        tags.push('May feel dark — consider obstructions');
    }

    return { score, label, quantileBucket, quantiles, tags };
}

// ─── SOLAR SMART TAGS ────────────────────────────────────────────────────────

/**
 * Generate buyer-facing "smart tags" from Google Solar API data.
 * These can be injected into search tags, context graphs, and AI prompts.
 */
export function computeSolarSmartTags(
    solarData: any,
    lotSizeSqft?: number,
    city?: string,
    state?: string,
): string[] {
    if (!solarData) return [];

    const tags: string[] = [];
    const sunshine = solarData.maxSunshineHoursPerYear || 0;
    const panelCount = solarData.maxArrayPanelsCount || solarData.solarPanels?.length || 0;
    const roofArea = solarData.wholeRoofStats?.areaMeters2 || 0;
    const groundArea = solarData.wholeRoofStats?.groundAreaMeters2 || 0;

    // Sun-Drenched / Natural Light
    if (sunshine > 1500) {
        tags.push('Sun-Drenched');
        tags.push('Great Natural Light');
    } else if (sunshine > 1200) {
        tags.push('Good Natural Light');
    } else if (sunshine < 800) {
        tags.push('Limited Natural Light');
    }

    // High Solar Potential
    if (panelCount > 20) {
        tags.push('High Solar Potential');
        tags.push('Energy Efficient');
    } else if (panelCount > 10) {
        tags.push('Solar Ready');
    }

    // Open Sky View — large array area relative to lot
    if (lotSizeSqft && groundArea > 0) {
        const lotM2 = lotSizeSqft * 0.0929;
        const roofToLotRatio = groundArea / lotM2;
        if (roofToLotRatio > 0.3) {
            tags.push('Open Sky View');
        }
    }

    // High flux = Garden-Ready / Pool-Prime
    const production = solarData.estimatedSolarProduction?.annualKwh || 0;
    if (groundArea > 0 && production > 0) {
        const fluxPerM2 = production / groundArea;
        if (fluxPerM2 > 200) {
            tags.push('Garden-Ready (High Solar Flux)');
            tags.push('Pool-Prime');
        }
    }

    // City benchmark-aware tags
    const bench = getCityBenchmark(city, state);
    const pct = bench.avgSunshineHoursPerYear > 0
        ? (sunshine / bench.avgSunshineHoursPerYear) * 100
        : 0;
    if (pct >= 110) {
        tags.push(`Top Solar Exposure in ${city || 'area'}`);
    } else if (pct < 70) {
        tags.push('Likely Shaded by Obstructions');
    }

    return tags;
}
