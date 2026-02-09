/**
 * Calculates production for a custom number of panels
 * using individual panel data from the API.
 */
export function calculateCustomSystem(solarPotential: any, requestedPanelCount: number) {
    const allPanels = solarPotential.solarPanels || [];

    // Cap the request at the maximum panels available on this roof
    const actualCount = Math.min(requestedPanelCount, allPanels.length);

    // Slice the best N panels and sum their individual production
    // (Note: Google API returns panels already sorted by production descending)
    const selectedPanels = allPanels.slice(0, actualCount);
    const totalDcKwh = selectedPanels.reduce((sum: number, p: any) => sum + p.yearlyEnergyDcKwh, 0);

    const systemSizeKw = (actualCount * (solarPotential.panelCapacityWatts || 400)) / 1000;
    const annualKwh = totalDcKwh * 0.85; // Applying standard 85% efficiency for AC conversion

    // Calculate Carbon Offset (Metric Tons)
    // annualMwh = annualKwh / 1000
    const carbonOffsetTons = ((annualKwh / 1000) * (solarPotential.carbonOffsetFactorKgPerMwh || 0)) / 1000;

    return {
        estimatedPanels: actualCount,
        systemCapacityKw: parseFloat(systemSizeKw.toFixed(2)),
        annualKwh: Math.round(annualKwh),
        carbonOffsetTons: parseFloat(carbonOffsetTons.toFixed(2)),
    };
}

/**
 * Automates solar potential estimation based on Google Solar API response.
 * This now uses accurate panel-level data instead of heuristics.
 */
export const calculateSolarPotential = (data: any) => {
    if (!data.solarPanels || data.solarPanels.length === 0) {
        return null;
    }

    // By default, we calculate for the MAXIMUM possible panels on the roof
    return calculateCustomSystem(data, data.solarPanels.length);
};
