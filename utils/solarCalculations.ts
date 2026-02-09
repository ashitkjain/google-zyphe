
/**
 * Automates solar potential estimation based on Google Solar API response.
 */
export const calculateSolarPotential = (data: {
    carbonOffsetFactorKgPerMwh?: number;
    maxSunshineHoursPerYear?: number;
    wholeRoofStats?: {
        areaMeters2?: number;
    };
}) => {
    if (!data.carbonOffsetFactorKgPerMwh || !data.maxSunshineHoursPerYear || !data.wholeRoofStats?.areaMeters2) {
        return null;
    }

    // CONFIGURATION CONSTANTS
    const PANEL_SIZE_M2 = 1.7;         // Avg size of a 400W panel
    const PANEL_CAPACITY_KW = 0.4;     // 400W per panel
    const USABLE_AREA_RATIO = 0.5;     // Assuming 50% of roof is usable (shading/offsets)
    const SYSTEM_EFFICIENCY = 0.85;    // Accounts for DC/AC conversion and wiring losses

    // 1. Estimate Number of Panels
    const usableArea = data.wholeRoofStats.areaMeters2 * USABLE_AREA_RATIO;
    const panelCount = Math.floor(usableArea / PANEL_SIZE_M2);

    // 2. Calculate System Capacity (DC kW)
    const systemCapacityKw = panelCount * PANEL_CAPACITY_KW;

    // 3. Estimate Annual Energy Production (kWh)
    // Formula: Capacity * Sunshine Hours * Efficiency
    const annualKwh = systemCapacityKw * data.maxSunshineHoursPerYear * SYSTEM_EFFICIENCY;

    // 4. Calculate Carbon Offset (Metric Tons)
    const annualMwh = annualKwh / 1000;
    const carbonOffsetKg = annualMwh * data.carbonOffsetFactorKgPerMwh;
    const carbonOffsetTons = carbonOffsetKg / 1000;

    return {
        estimatedPanels: panelCount,
        systemCapacityKw: parseFloat(systemCapacityKw.toFixed(2)),
        annualKwh: Math.round(annualKwh),
        carbonOffsetTons: parseFloat(carbonOffsetTons.toFixed(2)),
    };
};
