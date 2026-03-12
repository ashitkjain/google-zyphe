/**
 * Context Graph Pre-computation
 *
 * Computes the 23 pure-data factors directly from property fields,
 * without any AI call. The AI prompt is then told to skip these IDs
 * and only fill in the remaining factors.
 *
 * Total factors: 75 (STR Legality + STR Performance merged into factor 7)
 */

import { PropertyData } from '../types/property';
import { CustomAIAnalysisResult, ComprehensiveAnalysisResult } from '../types/ai';

export interface ExtractedFactor {
    id: number;
    name: string;
    value: string;
    confidence: 'high' | 'medium' | 'low';
    tags: string[];
}

// ── Helpers ────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, prefix = '', suffix = ''): string | null {
    if (n == null) return null;
    return `${prefix}${n.toLocaleString()}${suffix}`;
}

function calcMonthlyMortgage(price: number, annualRate = 0.07, years = 30): number {
    const r = annualRate / 12;
    const n = years * 12;
    return (price * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// ── Factor Computers ───────────────────────────────────────────────

function factor1_priceBracket(p: PropertyData): ExtractedFactor {
    const price = p.price ?? p.zestimate;
    let value = 'Data not available';
    let tags: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';

    if (price != null) {
        confidence = p.price != null ? 'high' : 'medium';
        if (price < 800_000) {
            value = `Entry — ${fmt(price, '$')}`;
            tags = ['Entry', 'Under $800K'];
        } else if (price <= 1_500_000) {
            value = `Mid — ${fmt(price, '$')}`;
            tags = ['Mid-Range', '$800K–$1.5M'];
        } else {
            value = `Luxury — ${fmt(price, '$')}`;
            tags = ['Luxury', '$1.5M+'];
        }
    }
    return { id: 1, name: 'Price Bracket', value, confidence, tags };
}

function factor2_hoaFriction(p: PropertyData): ExtractedFactor {
    const raw = p.resoFacts?.feesAndDues ?? (p as any).hoaFees;
    let value = 'None/Low';
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    let tags = ['No HOA'];

    if (raw != null) {
        const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.]/g, ''));
        if (!isNaN(num) && num > 0) {
            value = `$${num.toLocaleString()}/month`;
            confidence = 'high';
            tags = num > 500 ? ['High HOA', `$${num}/mo`] : ['Low HOA', `$${num}/mo`];
        } else {
            confidence = 'high';
        }
    }
    return { id: 2, name: 'HOA Friction', value, confidence, tags };
}

function factor4_trueCarryingCost(p: PropertyData): ExtractedFactor {
    const price = p.price ?? p.zestimate;
    if (price == null) {
        return { id: 4, name: 'True Carrying Cost', value: 'Data not available', confidence: 'low', tags: [] };
    }

    const mortgage = calcMonthlyMortgage(price);
    const taxes = p.propertyTaxRate ? (price * p.propertyTaxRate) / 100 / 12 : price * 0.012 / 12;
    const insurance = p.annualHomeownersInsurance ? p.annualHomeownersInsurance / 12 : price * 0.005 / 12;
    const hoaRaw = p.resoFacts?.feesAndDues ?? (p as any).hoaFees;
    const hoa = hoaRaw ? parseFloat(String(hoaRaw).replace(/[^0-9.]/g, '')) || 0 : 0;

    const total = Math.round(mortgage + taxes + insurance + hoa);
    const confidence = p.price != null ? 'medium' : 'low'; // always estimated
    return {
        id: 4,
        name: 'True Carrying Cost',
        value: `~$${total.toLocaleString()}/month est.`,
        confidence,
        tags: [`$${Math.round(total / 1000)}K/mo`, 'Estimated']
    };
}

function factor5_sellerMotivation(p: PropertyData): ExtractedFactor {
    const dom = p.timeOnZillow ?? p.resoFacts?.daysOnZillow;
    const cuts = (p.priceHistory ?? []).filter(h => h.event?.toLowerCase().includes('price cut') || h.event?.toLowerCase().includes('reduced')).length;

    if (cuts > 0 || (dom != null && dom > 90)) {
        const reasons: string[] = [];
        if (cuts > 0) reasons.push(`${cuts} price cut${cuts > 1 ? 's' : ''}`);
        if (dom != null && dom > 90) reasons.push(`${dom} DOM`);
        return {
            id: 5, name: 'Seller Motivation',
            value: `High — ${reasons.join(', ')}`,
            confidence: 'high',
            tags: ['Motivated Seller', 'Negotiable']
        };
    }
    return {
        id: 5, name: 'Seller Motivation',
        value: dom != null ? `Standard — ${dom} DOM` : 'Standard',
        confidence: dom != null ? 'high' : 'medium',
        tags: ['Standard']
    };
}

function factor8_ltrYield(p: PropertyData): ExtractedFactor {
    const price = p.price ?? p.zestimate;
    const rent = p.rentZestimate;
    if (price && rent) {
        const yield_ = ((rent * 12) / price * 100).toFixed(1);
        return {
            id: 8, name: 'Long-Term Rental Yield',
            value: `${yield_}% gross yield ($${rent.toLocaleString()}/mo rent)`,
            confidence: 'high',
            tags: [`${yield_}% Yield`, rent > 4000 ? 'Strong Rent' : 'Moderate Rent']
        };
    }
    if (price) {
        return {
            id: 8, name: 'Long-Term Rental Yield',
            value: '~5% est. (no rent data)',
            confidence: 'low',
            tags: ['Estimated Yield']
        };
    }
    return { id: 8, name: 'Long-Term Rental Yield', value: 'Data not available', confidence: 'low', tags: [] };
}

function factor10_listingUrgency(p: PropertyData): ExtractedFactor {
    const desc = (p.description ?? '').toLowerCase();
    const isHot = desc.includes('hot home') || desc.includes('multiple offers') || desc.includes('offer deadline');
    const backOnMarket = (p.priceHistory ?? []).some(h => h.event?.toLowerCase().includes('back on market'));

    if (isHot) return { id: 10, name: 'Listing Urgency', value: 'High — Hot Home', confidence: 'high', tags: ['Hot Home', 'Act Fast'] };
    if (backOnMarket) return { id: 10, name: 'Listing Urgency', value: 'Moderate — back on market', confidence: 'high', tags: ['Back on Market'] };
    return { id: 10, name: 'Listing Urgency', value: 'Standard', confidence: 'medium', tags: ['Standard'] };
}

function factor11_propertyTypology(p: PropertyData): ExtractedFactor {
    const type = p.homeType ?? 'Unknown';
    const map: Record<string, string> = {
        SINGLE_FAMILY: 'Single Family', SingleFamily: 'Single Family',
        CONDO: 'Condo', Condo: 'Condo',
        TOWNHOUSE: 'Townhouse', Townhouse: 'Townhouse',
        MULTI_FAMILY: 'Multi-Family', MultiFamily: 'Multi-Family',
        MANUFACTURED: 'Manufactured', LOT: 'Lot/Land'
    };
    const label = map[type] ?? type;
    return { id: 11, name: 'Property Typology', value: label, confidence: 'high', tags: [label] };
}

function factor12_bedrooms(p: PropertyData): ExtractedFactor {
    const b = p.bedrooms;
    if (b == null) return { id: 12, name: 'Bedroom Count', value: 'Data not available', confidence: 'low', tags: [] };
    return { id: 12, name: 'Bedroom Count', value: `${b} bedroom${b !== 1 ? 's' : ''}`, confidence: 'high', tags: [`${b}BR`] };
}

function factor13_bathrooms(p: PropertyData): ExtractedFactor {
    const b = p.bathrooms;
    if (b == null) return { id: 13, name: 'Bathroom Count', value: 'Data not available', confidence: 'low', tags: [] };
    const full = Math.floor(b);
    const half = b % 1 >= 0.5 ? 1 : 0;
    const label = half ? `${full} full, 1 half` : `${full} full`;
    return { id: 13, name: 'Bathroom Count', value: label, confidence: 'high', tags: [`${b}BA`] };
}

function factor14_sqft(p: PropertyData): ExtractedFactor {
    const sqft = p.livingAreaValue;
    if (sqft == null) return { id: 14, name: 'Usable Square Footage', value: 'Data not available', confidence: 'low', tags: [] };
    const tier = sqft < 1500 ? 'Compact' : sqft < 2500 ? 'Mid-Size' : sqft < 4000 ? 'Spacious' : 'Estate';

    // Flag discrepancy vs tax records
    const taxSqft = (p as any).taxSqft;
    let discrepancy = '';
    if (taxSqft && taxSqft > 0) {
        const pctDiff = ((sqft - taxSqft) / taxSqft) * 100;
        if (Math.abs(pctDiff) > 10) {
            discrepancy = ` ⚠️ ${pctDiff > 0 ? '+' : ''}${pctDiff.toFixed(0)}% vs tax record (${taxSqft.toLocaleString()} sf)`;
        }
    }
    return {
        id: 14, name: 'Usable Square Footage',
        value: `${sqft.toLocaleString()} sq ft${discrepancy}`,
        confidence: 'high',
        tags: [`${sqft.toLocaleString()} sqft`, tier, ...(discrepancy ? ['Sqft Discrepancy'] : [])]
    };
}

function factor15_lotSize(p: PropertyData): ExtractedFactor {
    const lot = p.lotSize;
    if (!lot) return { id: 15, name: 'Lot Size', value: 'Data not available', confidence: 'low', tags: [] };

    // Enrich with ArcGIS measured area if available
    const arcgisSqft = (p as any).parcelAreaSqft;
    let measured = '';
    if (arcgisSqft && arcgisSqft > 0) {
        const lotNum = parseFloat(String(lot).replace(/[^0-9.]/g, ''));
        // lotSize is often in text like "5,200 sqft" or "0.12 acres"
        if (lotNum > 0 && lotNum < 50) {
            // Likely acres — convert to sqft for comparison
            const lotSqft = lotNum * 43560;
            const pctDiff = ((lotSqft - arcgisSqft) / arcgisSqft) * 100;
            if (Math.abs(pctDiff) > 5) {
                measured = ` (ArcGIS: ${arcgisSqft.toLocaleString()} sqft, ${pctDiff > 0 ? '+' : ''}${pctDiff.toFixed(0)}% diff)`;
            }
        } else if (lotNum > 0) {
            const pctDiff = ((lotNum - arcgisSqft) / arcgisSqft) * 100;
            if (Math.abs(pctDiff) > 5) {
                measured = ` (ArcGIS: ${arcgisSqft.toLocaleString()} sqft, ${pctDiff > 0 ? '+' : ''}${pctDiff.toFixed(0)}% diff)`;
            }
        }
    }
    return { id: 15, name: 'Lot Size', value: `${lot}${measured}`, confidence: 'high', tags: [lot] };
}

function factor18_garage(p: PropertyData): ExtractedFactor {
    const cap = p.resoFacts?.garageParkingCapacity ?? (p as any).garageSpaces;
    if (cap == null) return { id: 18, name: 'Garage & Parking Capacity', value: 'Data not available', confidence: 'low', tags: [] };
    const num = typeof cap === 'number' ? cap : parseInt(String(cap));
    const label = isNaN(num) ? String(cap) : `${num}-car garage`;
    return { id: 18, name: 'Garage & Parking Capacity', value: label, confidence: 'high', tags: [label] };
}

function factor20_constructionEra(p: PropertyData): ExtractedFactor {
    const year = p.yearBuilt;
    if (year == null) return { id: 20, name: 'Construction Era', value: 'Data not available', confidence: 'low', tags: [] };
    let era: string;
    if (year < 1945) era = 'Pre-War';
    else if (year <= 1975) era = 'Mid-Century';
    else if (year <= 1999) era = '80s–90s';
    else if (year <= 2015) era = '2000s';
    else era = 'New Build';
    return { id: 20, name: 'Construction Era', value: `${era} (built ${year})`, confidence: 'high', tags: [era, String(year)] };
}

function factor28_flooring(p: PropertyData): ExtractedFactor {
    const f = p.resoFacts?.flooring;
    if (!f) return { id: 28, name: 'Flooring Material', value: 'Data not available', confidence: 'low', tags: [] };
    return { id: 28, name: 'Flooring Material', value: f, confidence: 'high', tags: f.split(',').map(s => s.trim()).slice(0, 3) };
}

function factor41_schoolQuality(p: PropertyData): ExtractedFactor {
    const schools = p.schools ?? [];
    if (!schools.length) return { id: 41, name: 'School Quality (Max)', value: 'Data not available', confidence: 'low', tags: [] };

    let maxRating = 0;
    let bestSchool = '';
    for (const s of schools) {
        const r = typeof s.rating === 'number' ? s.rating : parseFloat(String(s.rating));
        if (!isNaN(r) && r > maxRating) { maxRating = r; bestSchool = s.name; }
    }
    if (maxRating === 0) return { id: 41, name: 'School Quality (Max)', value: 'Ratings unavailable', confidence: 'low', tags: [] };

    const tier = maxRating >= 8 ? 'Top-Rated' : maxRating >= 6 ? 'Good' : 'Average';
    return {
        id: 41, name: 'School Quality (Max)',
        value: `${maxRating}/10 — ${bestSchool}`,
        confidence: 'high',
        tags: [tier, `${maxRating}/10`]
    };
}

function factor43_walkability(p: PropertyData): ExtractedFactor {
    const score = p.walkScore;
    if (score == null) return { id: 43, name: 'Walkability', value: 'Data not available', confidence: 'low', tags: [] };
    const desc = score >= 90 ? "Walker's Paradise" : score >= 70 ? 'Very Walkable' : score >= 50 ? 'Somewhat Walkable' : 'Car-Dependent';
    return {
        id: 43, name: 'Walkability',
        value: `Walk Score ${score} — ${desc}`,
        confidence: 'high',
        tags: [desc, `WS ${score}`]
    };
}

function factor51_vastu(p: PropertyData): ExtractedFactor {
    // Read from orientation_ai (satellite analysis) — the authoritative source
    const orientationAI = (p as any).orientation_ai;
    const orientation = orientationAI?.final_orientation;
    if (!orientation) return { id: 51, name: 'Vastu / Feng Shui Readiness', value: 'Data not available', confidence: 'low', tags: [] };

    const favorable = ['North', 'East', 'North-East', 'Northeast'].includes(orientation);
    const confidence = orientationAI.confidence ?? 'medium';
    const vastuNote = orientationAI.feng_shui_vastu || '';

    let value = `${orientation}-facing${favorable ? ' (favorable)' : ''}`;
    if (vastuNote) value += ` — ${vastuNote}`;

    return {
        id: 51, name: 'Vastu / Feng Shui Readiness',
        value,
        confidence,
        tags: [`${orientation}-Facing`, favorable ? 'Vastu Favorable' : 'Vastu Neutral']
    };
}

function factor52_airQuality(p: PropertyData): ExtractedFactor {
    const aq = p.airQuality;
    if (!aq) return { id: 52, name: 'Asthma / Respiratory Safety', value: 'Data not available', confidence: 'low', tags: [] };
    return {
        id: 52, name: 'Asthma / Respiratory Safety',
        value: `AQI ${aq.aqi} — ${aq.category}`,
        confidence: 'high',
        tags: [aq.category, `AQI ${aq.aqi}`]
    };
}

function factor54_topography(p: PropertyData): ExtractedFactor {
    const pv = (p as any).parcelValidation;
    const slopePercent = pv?.slopePercent;
    const slopeCategory = pv?.slopeCategory;
    const uphillDir = pv?.uphillDir;

    if (slopePercent == null || !slopeCategory) {
        return { id: 54, name: 'Topography & Elevation', value: 'Data not available', confidence: 'low', tags: [] };
    }

    const OPPOSITE: Record<string, string> = { N: 'S', NE: 'SW', E: 'W', SE: 'NW', S: 'N', SW: 'NE', W: 'E', NW: 'SE' };
    const backyardDir = uphillDir ? (OPPOSITE[uphillDir] || uphillDir) : null;
    const isSouthFacing = backyardDir ? ['S', 'SE', 'SW'].includes(backyardDir) : false;

    let value = `${slopePercent}% slope (${slopeCategory})`;
    if (uphillDir) value += `, uphill ${uphillDir}`;
    if (backyardDir) value += `, backyard faces ${backyardDir}`;

    const tags: string[] = [slopeCategory, `${slopePercent}% Slope`];
    if (slopePercent > 15) tags.push('Steep — Foundation Cost Impact');
    if (isSouthFacing) tags.push('South-Facing Backyard');
    if (slopePercent < 5) tags.push('Flat Lot');

    return {
        id: 54, name: 'Topography & Elevation',
        value,
        confidence: 'high',
        tags
    };
}

function factor55_solar(p: PropertyData): ExtractedFactor {
    const solar = p.solarData;
    const est = solar?.estimatedSolarProduction;
    if (!est) return { id: 55, name: 'Renewable Potential', value: 'Data not available', confidence: 'low', tags: [] };

    const kwh = est.annualKwh;
    const tier = kwh > 15000 ? 'High' : kwh > 8000 ? 'Medium' : 'Low';
    return {
        id: 55, name: 'Renewable Potential',
        value: `${tier} — ${kwh.toLocaleString()} kWh/yr`,
        confidence: 'high',
        tags: [tier, `${Math.round(kwh / 1000)}K kWh/yr`, 'Solar']
    };
}

function factor59_laundry(p: PropertyData): ExtractedFactor {
    const lf = p.resoFacts?.laundryFeatures;
    if (!lf) return { id: 59, name: 'Laundry Logistics', value: 'Data not available', confidence: 'low', tags: [] };
    const lower = lf.toLowerCase();
    const indoor = lower.includes('inside') || lower.includes('indoor') || lower.includes('laundry room');
    return {
        id: 59, name: 'Laundry Logistics',
        value: lf,
        confidence: 'high',
        tags: [indoor ? 'Indoor Laundry' : 'Garage/Exterior Laundry']
    };
}

function factor75_marketVelocity(visual: CustomAIAnalysisResult | null): ExtractedFactor {
    const dom = (visual as any)?.general_market_intelligence?.market_dynamics?.days_on_market;
    if (!dom) return { id: 75, name: 'Market Velocity (DOM)', value: 'Data not available', confidence: 'low', tags: [] };

    const num = parseFloat(String(dom).replace(/[^0-9.]/g, ''));
    if (isNaN(num)) {
        return { id: 75, name: 'Market Velocity (DOM)', value: dom, confidence: 'medium', tags: [] };
    }
    const speed = num < 14 ? 'Fast' : num <= 30 ? 'Moderate' : 'Slow';
    return {
        id: 75, name: 'Market Velocity (DOM)',
        value: `${speed} — ${Math.round(num)} days median DOM`,
        confidence: 'high',
        tags: [speed, `${Math.round(num)} DOM`]
    };
}

function factor7_strViability(visual: CustomAIAnalysisResult | null): ExtractedFactor {
    const str = (visual as any)?.property_investment?.str_performance;
    if (!str) return { id: 7, name: 'STR Viability', value: 'Data not available', confidence: 'low', tags: [] };

    const occ = str.occupancy_rate ?? '';
    const adr = str.adr ?? '';
    const occMatch = String(occ).match(/(\d+)%/);
    const adrMatch = String(adr).match(/\$(\d+)/);
    if (occMatch && adrMatch) {
        return {
            id: 7, name: 'STR Viability',
            value: `${occMatch[1]}% occ @ $${adrMatch[1]}/night`,
            confidence: 'medium',
            tags: [`${occMatch[1]}% Occupancy`, `$${adrMatch[1]}/night`, 'STR']
        };
    }
    return { id: 7, name: 'STR Viability', value: 'STR data available — see investment tab', confidence: 'low', tags: ['STR'] };
}

// ── Main Export ────────────────────────────────────────────────────

/**
 * Pre-computes all 23 pure-data factors from property fields.
 * Returns a map of factorId → ExtractedFactor for fast merging.
 */
export function precomputeDataFactors(
    property: PropertyData,
    visual: CustomAIAnalysisResult | null,
    _comprehensive: ComprehensiveAnalysisResult | null
): Map<number, ExtractedFactor> {
    const factors: ExtractedFactor[] = [
        factor1_priceBracket(property),
        factor2_hoaFriction(property),
        factor4_trueCarryingCost(property),
        factor5_sellerMotivation(property),
        factor7_strViability(visual),
        factor8_ltrYield(property),
        factor10_listingUrgency(property),
        factor11_propertyTypology(property),
        factor12_bedrooms(property),
        factor13_bathrooms(property),
        factor14_sqft(property),
        factor15_lotSize(property),
        factor18_garage(property),
        factor20_constructionEra(property),
        factor28_flooring(property),
        factor41_schoolQuality(property),
        factor43_walkability(property),
        factor51_vastu(property),
        factor52_airQuality(property),
        factor54_topography(property),
        factor55_solar(property),
        factor59_laundry(property),
        factor75_marketVelocity(visual),
    ];

    const map = new Map<number, ExtractedFactor>();
    for (const f of factors) map.set(f.id, f);
    return map;
}

/** IDs of all pre-computed factors — used to tell AI to skip these */
export const PRECOMPUTED_FACTOR_IDS = [1, 2, 4, 5, 7, 8, 10, 11, 12, 13, 14, 15, 18, 20, 28, 41, 43, 51, 52, 54, 55, 59, 75];
