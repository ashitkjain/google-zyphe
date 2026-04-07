import { CensusDemographics } from './api/environmental';

/**
 * Calculates a data-backed Affordability Score (1-10) using Census and HUD recommended metrics.
 * 
 * Formula (Weighted):
 * - Rent-to-Income / Housing Cost Burden (40%)
 * - Price-to-Income / Median Home Value (30%)
 * - Location Affordability / Transport Proxy (20%)
 * - Income Growth Trend (10%)
 */
export const calculateAffordabilityScore = (
    census: CensusDemographics,
    transportScore: number = 7, // Default baseline if LAI is unavailable
    incomeGrowthScore: number = 8 // Default baseline
): { score: number; signals: any } => {
    
    // 1. Rent burden score (40%)
    // Using ACS Cost Burden (spending >30% on rent)
    let rentScore = 5;
    if (census.rentBurdenPct !== null) {
        // Lower % of cost-burdened households = Higher score
        if (census.rentBurdenPct < 20) rentScore = 10;
        else if (census.rentBurdenPct < 25) rentScore = 9;
        else if (census.rentBurdenPct < 30) rentScore = 8;
        else if (census.rentBurdenPct < 35) rentScore = 7;
        else if (census.rentBurdenPct < 40) rentScore = 6;
        else if (census.rentBurdenPct < 45) rentScore = 5;
        else if (census.rentBurdenPct < 50) rentScore = 4;
        else if (census.rentBurdenPct < 55) rentScore = 3;
        else if (census.rentBurdenPct < 60) rentScore = 2;
        else rentScore = 1;
    } else if (census.medianGrossRent && census.medianHouseholdIncome) {
        // Fallback to Rent-to-Income ratio
        const ratio = (census.medianGrossRent * 12) / census.medianHouseholdIncome;
        if (ratio < 0.15) rentScore = 10;
        else if (ratio < 0.20) rentScore = 9;
        else if (ratio < 0.25) rentScore = 8;
        else if (ratio < 0.30) rentScore = 7;
        else if (ratio < 0.35) rentScore = 6;
        else if (ratio < 0.40) rentScore = 5;
        else rentScore = 4;
    }

    // 2. Price-to-Income score (30%)
    let priceScore = 5;
    if (census.medianHomeValue && census.medianHouseholdIncome) {
        const ratio = census.medianHomeValue / census.medianHouseholdIncome;
        if (ratio < 3) priceScore = 10;
        else if (ratio < 4) priceScore = 9;
        else if (ratio < 5) priceScore = 8;
        else if (ratio < 6) priceScore = 7;
        else if (ratio < 7) priceScore = 6;
        else if (ratio < 8) priceScore = 5;
        else if (ratio < 10) priceScore = 4;
        else if (ratio < 12) priceScore = 3;
        else if (ratio < 15) priceScore = 2;
        else priceScore = 1;
    }

    // 3. Final weighted calculation
    const weighted = (
        (rentScore * 0.40) +
        (priceScore * 0.30) +
        (transportScore * 0.20) +
        (incomeGrowthScore * 0.10)
    );

    const finalScore = Math.round(weighted * 10) / 10;

    return {
        score: finalScore,
        signals: {
            rentBurden: census.rentBurdenPct,
            medianRent: census.medianGrossRent,
            priceToIncome: census.medianHomeValue && census.medianHouseholdIncome 
                ? (census.medianHomeValue / census.medianHouseholdIncome).toFixed(1) 
                : null,
            rentScore,
            priceScore,
            transportScore,
            incomeGrowthScore
        }
    };
};
