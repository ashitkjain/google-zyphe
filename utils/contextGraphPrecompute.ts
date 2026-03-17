/**
 * Context Graph Pre-computation
 *
 * Computes the 35 pure-data factors directly from property fields,
 * without any AI call. The AI prompt is then told to skip these IDs
 * and only fill in the remaining factors.
 *
 * Total factors: 88 (STR Legality + STR Performance merged into factor 7)
 */

import { PropertyData } from '../types/property';
import { CustomAIAnalysisResult, ComprehensiveAnalysisResult } from '../types/ai';

export interface ExtractedFactor {
    id: number;
    name: string;
    value: string;
    detail?: string;  // Optional 1-2 sentence qualitative context behind the value
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
    const breakdownParts = [
        `Mortgage: $${Math.round(mortgage).toLocaleString()}`,
        `Taxes: $${Math.round(taxes).toLocaleString()}`,
        `Insurance: $${Math.round(insurance).toLocaleString()}`,
        ...(hoa > 0 ? [`HOA: $${Math.round(hoa).toLocaleString()}`] : [])
    ];
    return {
        id: 4,
        name: 'True Carrying Cost',
        value: `~$${total.toLocaleString()}/month est.`,
        detail: `Breakdown (7% 30yr): ${breakdownParts.join(', ')}.`,
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
        // Build detail with actual price history events
        const historyDetail = (p.priceHistory ?? []).filter(h => h.price != null).slice(0, 4)
            .map(h => `${h.event} $${(h.price || 0).toLocaleString()} (${h.date})`).join('. ');
        return {
            id: 5, name: 'Seller Motivation',
            value: `High — ${reasons.join(', ')}`,
            detail: historyDetail || undefined,
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

function factor75_marketVelocity(visual: CustomAIAnalysisResult | null, property?: PropertyData): ExtractedFactor {
    // 1. City-level market intelligence (best source — median DOM for the area)
    const cityDom = (visual as any)?.general_market_intelligence?.market_dynamics?.days_on_market;
    // 2. Property-level DOM (fallback — this specific listing's days on market)
    const propDom = property?.resoFacts?.daysOnZillow ?? (property as any)?.timeOnZillow;

    const dom = cityDom ?? propDom;
    if (!dom) return { id: 75, name: 'Market Velocity (DOM)', value: 'Data not available', confidence: 'low', tags: [] };

    const num = parseFloat(String(dom).replace(/[^0-9.]/g, ''));
    if (isNaN(num)) {
        return { id: 75, name: 'Market Velocity (DOM)', value: String(dom), confidence: 'medium', tags: [] };
    }
    const speed = num < 14 ? 'Fast' : num <= 30 ? 'Moderate' : 'Slow';
    const source = cityDom ? 'median DOM' : 'listing DOM';
    return {
        id: 75, name: 'Market Velocity (DOM)',
        value: `${speed} — ${Math.round(num)} days ${source}`,
        confidence: cityDom ? 'high' : 'medium',
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

// ── Outdoor Factors from Street View & Visual AI ────────────────────

function factor33_privacyLevel(p: PropertyData, visual: CustomAIAnalysisResult | null): ExtractedFactor {
    const sv = p.streetViewAnalysis;
    const visualPrivacy = visual?.exterior_and_neighborhood?.views_privacy_orientation?.privacy;

    // Prefer street view rating, fallback to visual analysis
    const rating = sv?.privacyRating || visualPrivacy;
    if (!rating) return { id: 33, name: 'Privacy Level', value: 'Data not available', confidence: 'low', tags: [] };

    // Truncate to a concise value (max 10 words)
    const valueTrunc = rating.split(/[.!]/).filter(Boolean)[0]?.trim() || rating;
    const value = valueTrunc.split(/\s+/).slice(0, 10).join(' ');

    // Use both sources for detail
    const detailParts: string[] = [];
    if (sv?.privacyRating) detailParts.push(`Street View: ${sv.privacyRating}`);
    if (visualPrivacy && visualPrivacy !== sv?.privacyRating) detailParts.push(`Photo analysis: ${visualPrivacy}`);

    return {
        id: 33, name: 'Privacy Level',
        value,
        detail: detailParts.length ? detailParts.join('. ').substring(0, 300) : undefined,
        confidence: sv ? 'high' : 'medium',
        tags: [rating.toLowerCase().includes('high') || rating.toLowerCase().includes('private') ? 'Private' : rating.toLowerCase().includes('low') || rating.toLowerCase().includes('exposed') ? 'Exposed' : 'Moderate Privacy']
    };
}

function factor34_curbAppeal(p: PropertyData, visual: CustomAIAnalysisResult | null): ExtractedFactor {
    const sv = p.streetViewAnalysis;
    const visualCurb = visual?.exterior_and_neighborhood?.exterior_and_lot_appeal?.curb_appeal;

    const score = sv?.curbAppealScore;
    const narrative = visualCurb;

    if (score == null && !narrative) return { id: 34, name: 'Curb Appeal', value: 'Data not available', confidence: 'low', tags: [] };

    // Build value from score + first sentence of narrative
    let value: string;
    if (score != null) {
        const tier = score >= 8 ? 'Excellent' : score >= 6 ? 'Good' : score >= 4 ? 'Average' : 'Below Average';
        value = `${tier} — ${score}/10`;
    } else {
        // Use first fragment of the narrative
        value = (narrative || '').split(/[.!]/).filter(Boolean)[0]?.trim().split(/\s+/).slice(0, 10).join(' ') || 'See detail';
    }

    // Rich detail combining both sources
    const detailParts: string[] = [];
    if (narrative) detailParts.push(narrative);
    if (sv?.gardenDescription) detailParts.push(`Garden: ${sv.gardenDescription}`);
    if (sv?.neighborCondition) detailParts.push(`Neighbors: ${sv.neighborCondition}`);

    return {
        id: 34, name: 'Curb Appeal',
        value,
        detail: detailParts.length ? detailParts.join('. ').substring(0, 400) : undefined,
        confidence: sv ? 'high' : 'medium',
        tags: score != null
            ? [score >= 8 ? 'Great Curb Appeal' : score >= 6 ? 'Good Curb Appeal' : 'Needs Curb Work', `${score}/10`]
            : ['Visual Assessment']
    };
}

// ── Environmental Factors (46-50) ───────────────────────────────────

function factor46_wildfireRisk(p: PropertyData): ExtractedFactor {
    const score = p.fireRiskScore;
    if (score == null) return { id: 46, name: 'Wildfire Risk', value: 'Data not available', confidence: 'low', tags: [] };
    const tier = score <= 3 ? 'Low' : score <= 6 ? 'Moderate' : 'High';
    return {
        id: 46, name: 'Wildfire Risk',
        value: `${tier} — ${score}/10`,
        detail: score >= 7 ? `Fire risk score ${score}/10 may impact insurance premiums and evacuaton planning.` : undefined,
        confidence: 'high',
        tags: [tier, `${score}/10`, ...(score >= 7 ? ['High Fire Risk'] : [])]
    };
}

function factor47_floodRisk(p: PropertyData): ExtractedFactor {
    const score = p.floodRiskScore;
    if (score == null) return { id: 47, name: 'Flood Risk', value: 'Data not available', confidence: 'low', tags: [] };
    const tier = score <= 3 ? 'Low' : score <= 6 ? 'Moderate' : 'High';
    return {
        id: 47, name: 'Flood Risk',
        value: `${tier} — ${score}/10`,
        detail: score >= 7 ? `Flood risk score ${score}/10. Flood insurance may be required. Check FEMA flood zone designation.` : undefined,
        confidence: 'high',
        tags: [tier, `${score}/10`, ...(score >= 7 ? ['Flood Insurance'] : [])]
    };
}

function factor48_solarYield(p: PropertyData): ExtractedFactor {
    const solar = p.solarData;
    if (!solar?.estimatedSolarProduction) return { id: 48, name: 'Solar Yield Potential', value: 'Data not available', confidence: 'low', tags: [] };

    const kwh = solar.estimatedSolarProduction.annualKwh;
    const panels = solar.estimatedSolarProduction.estimatedPanels;
    const capacity = solar.estimatedSolarProduction.systemCapacityKw;
    const tier = kwh > 15000 ? 'High' : kwh > 8000 ? 'Moderate' : 'Low';

    const detailParts: string[] = [];
    if (panels) detailParts.push(`${panels} panels`);
    if (capacity) detailParts.push(`${capacity.toFixed(1)}kW system`);
    if (solar.financialAnalysis?.cashPurchase?.savings?.savingsYear20) {
        detailParts.push(`20yr savings: $${solar.financialAnalysis.cashPurchase.savings.savingsYear20.toLocaleString()}`);
    }

    return {
        id: 48, name: 'Solar Yield Potential',
        value: `${tier} — ${kwh.toLocaleString()} kWh/year`,
        detail: detailParts.length ? `Google Solar API: ${detailParts.join(', ')}.` : undefined,
        confidence: 'high',
        tags: [tier, `${Math.round(kwh / 1000)}K kWh`, ...(kwh > 15000 ? ['High Solar'] : [])]
    };
}

function factor49_pollenSafety(p: PropertyData): ExtractedFactor {
    const pollen = p.pollen;
    if (!pollen) return { id: 49, name: 'Allergen / Pollen Safety', value: 'Data not available', confidence: 'low', tags: [] };

    const score = pollen.score;
    const tier = score <= 2 ? 'Low Risk' : score <= 3 ? 'Moderate' : 'High Risk';
    const dominant = pollen.dominantPollenType || 'Unknown';

    return {
        id: 49, name: 'Allergen / Pollen Safety',
        value: `${tier} — ${pollen.category} (${dominant})`,
        detail: pollen.description || undefined,
        confidence: 'high',
        tags: [tier, dominant, pollen.category]
    };
}

function factor50_hvacQuality(p: PropertyData): ExtractedFactor {
    const heating = p.resoFacts?.heating;
    const cooling = p.resoFacts?.cooling;
    if (!heating && !cooling) return { id: 50, name: 'HVAC Quality / Air Filtration', value: 'Data not available', confidence: 'low', tags: [] };

    const parts: string[] = [];
    const tags: string[] = [];
    if (cooling) {
        const isCentral = cooling.toLowerCase().includes('central');
        parts.push(isCentral ? 'Central AC' : cooling);
        tags.push(isCentral ? 'Central AC' : 'AC');
    }
    if (heating) {
        const isForced = heating.toLowerCase().includes('forced air') || heating.toLowerCase().includes('central');
        parts.push(isForced ? 'Forced Air Heat' : heating);
        tags.push(isForced ? 'Forced Air' : 'Heat');
    }

    return {
        id: 50, name: 'HVAC Quality / Air Filtration',
        value: parts.join(', '),
        detail: `Heating: ${heating || 'N/A'}. Cooling: ${cooling || 'N/A'}.`,
        confidence: 'high',
        tags
    };
}

// ── New Factors: Infrastructure & Environment ──────────────────────

function factor76_internetConnectivity(p: PropertyData): ExtractedFactor {
    const bb = (p as any).broadband;
    if (!bb) return { id: 76, name: 'Internet & Connectivity', value: 'Data not available', confidence: 'low', tags: [] };

    const parts: string[] = [];
    if (bb.hasFiber) parts.push('Fiber');
    else if (bb.topDownloadMbps > 0) parts.push(`Cable ${bb.topDownloadMbps}Mbps`);
    if (bb.has5G) parts.push('5G');
    parts.push(`${bb.providerCount} provider${bb.providerCount !== 1 ? 's' : ''}`);

    const speed = bb.topDownloadMbps;
    const tier = speed >= 1000 ? 'Gigabit' : speed >= 300 ? 'Fast' : speed >= 100 ? 'Moderate' : speed > 0 ? 'Basic' : 'Unknown';

    // Build rich detail with provider names and cell coverage
    const detailParts: string[] = [`Max download: ${speed}Mbps`];
    if (bb.providers?.length) detailParts.push(`Providers: ${bb.providers.slice(0, 3).map((pr: any) => pr.name || pr).join(', ')}`);
    if (bb.cellCoverage?.length) {
        const carriers = bb.cellCoverage.slice(0, 3).map((c: any) => `${c.carrier || c.name} (${c.technology || ''})`).join(', ');
        detailParts.push(`Cell: ${carriers}`);
    }

    return {
        id: 76, name: 'Internet & Connectivity',
        value: `${tier} — ${parts.join(', ')}`,
        detail: detailParts.join('. ') + '.',
        confidence: 'high',
        tags: [tier, ...(bb.hasFiber ? ['Fiber'] : []), ...(bb.has5G ? ['5G'] : [])]
    };
}

function factor77_noiseProfile(p: PropertyData): ExtractedFactor {
    if (p.noiseScore == null) return { id: 77, name: 'Noise Profile (Measured)', value: 'Data not available', confidence: 'low', tags: [] };

    const score = p.noiseScore;
    const label = score >= 90 ? 'Very Quiet' : score >= 80 ? 'Calm' : score >= 70 ? 'Moderate' : score >= 60 ? 'Active' : 'Loud';

    const details: string[] = [];
    if (p.noiseTrafficDesc) details.push(`Traffic: ${p.noiseTrafficDesc}`);
    if (p.noiseAirportDesc) details.push(`Airport: ${p.noiseAirportDesc}`);
    if (p.noiseLocalDesc) details.push(`Local: ${p.noiseLocalDesc}`);

    // Rich detail with all sub-scores
    const subScores: string[] = [];
    if (p.noiseTrafficScore != null) subScores.push(`Traffic ${p.noiseTrafficScore}/100`);
    if (p.noiseAirportScore != null) subScores.push(`Airport ${p.noiseAirportScore}/100`);
    if (p.noiseLocalScore != null) subScores.push(`Local ${p.noiseLocalScore}/100`);

    return {
        id: 77, name: 'Noise Profile (Measured)',
        value: `${label} — Score ${score}/100${details.length ? ` (${details.join(', ')})` : ''}`,
        detail: subScores.length ? `HowLoud breakdown: ${subScores.join(', ')}. ${details.join('. ')}.` : undefined,
        confidence: 'high',
        tags: [label, `Score ${score}`]
    };
}

function factor78_droughtRisk(p: PropertyData): ExtractedFactor {
    const d = (p as any).drought;
    if (!d) return { id: 78, name: 'Water & Drought Risk', value: 'Data not available', confidence: 'low', tags: [] };

    if (d.severityLevel < 0 || d.none >= 100) {
        return { id: 78, name: 'Water & Drought Risk', value: `None — ${d.countyName} fully hydrated`, confidence: 'high', tags: ['No Drought'] };
    }

    const pctAffected = Math.round(100 - d.none);
    // Detail with full severity breakdown
    const levels: string[] = [];
    if (d.d0 > 0) levels.push(`${d.d0.toFixed(0)}% Abnormally Dry`);
    if (d.d1 > 0) levels.push(`${d.d1.toFixed(0)}% Moderate`);
    if (d.d2 > 0) levels.push(`${d.d2.toFixed(0)}% Severe`);
    if (d.d3 > 0) levels.push(`${d.d3.toFixed(0)}% Extreme`);
    if (d.d4 > 0) levels.push(`${d.d4.toFixed(0)}% Exceptional`);

    return {
        id: 78, name: 'Water & Drought Risk',
        value: `${d.severity} — ${pctAffected}% of ${d.countyName} affected`,
        detail: levels.length ? `US Drought Monitor: ${levels.join(', ')}. May impact landscaping costs and water restrictions.` : undefined,
        confidence: 'high',
        tags: [d.severity, `${pctAffected}% Affected`]
    };
}

function factor79_disasterHistory(p: PropertyData): ExtractedFactor {
    const hd = (p as any).historical_disasters;
    if (!hd || !hd.events) return { id: 79, name: 'Disaster History', value: 'Data not available', confidence: 'low', tags: [] };

    const events = Array.isArray(hd.events) ? hd.events : [];
    if (events.length === 0) {
        return { id: 79, name: 'Disaster History', value: 'Clean — no recent disasters', confidence: 'high', tags: ['Clean Record'] };
    }

    // Count by type
    const typeCounts: Record<string, number> = {};
    for (const e of events) {
        const type = e.type || e.disasterType || 'Unknown';
        typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
    const typeList = Object.entries(typeCounts).map(([t, c]) => `${c} ${t.toLowerCase()}`).slice(0, 3).join(', ');
    const severity = events.length >= 5 ? 'High' : events.length >= 2 ? 'Moderate' : 'Low';

    return {
        id: 79, name: 'Disaster History',
        value: `${events.length} events — ${typeList}`,
        confidence: 'high',
        tags: [severity, `${events.length} Events`]
    };
}

function factor84_walkableAmenities(p: PropertyData): ExtractedFactor {
    const places = (p as any).neighborhoodPlaces;
    if (!places?.walkable) return { id: 84, name: 'Walkable Amenity Score', value: 'Data not available', confidence: 'low', tags: [] };

    const w = places.walkable;
    const diningCount = w.dining?.length || 0;
    const parksCount = w.parks?.length || 0;
    const shoppingCount = w.shopping?.length || 0;
    const fitnessCount = w.fitness?.length || 0;
    const total = diningCount + parksCount + shoppingCount + fitnessCount + (w.schools?.length || 0) + (w.community?.length || 0);

    if (total === 0) {
        return { id: 84, name: 'Walkable Amenity Score', value: 'Low — no walkable POIs found', confidence: 'high', tags: ['Car-Dependent'] };
    }

    const tier = total >= 10 ? 'High' : total >= 5 ? 'Moderate' : 'Low';
    const parts: string[] = [];
    if (diningCount > 0) parts.push(`${diningCount} dining`);
    if (parksCount > 0) parts.push(`${parksCount} parks`);
    if (shoppingCount > 0) parts.push(`${shoppingCount} shops`);

    // Detail: name the top 3 closest walkable places
    const allWalkable = [...(w.dining || []), ...(w.parks || []), ...(w.shopping || []), ...(w.fitness || [])]
        .filter((pl: any) => pl.name && pl.distanceMeters)
        .sort((a: any, b: any) => (a.distanceMeters || 0) - (b.distanceMeters || 0))
        .slice(0, 5);
    const placeNames = allWalkable.map((pl: any) => `${pl.name} (${(pl.distanceMeters / 1000).toFixed(1)}km)`).join(', ');

    return {
        id: 84, name: 'Walkable Amenity Score',
        value: `${tier} — ${total} walkable POIs (${parts.join(', ')})`,
        detail: placeNames ? `Closest: ${placeNames}.` : undefined,
        confidence: 'high',
        tags: [tier, `${total} Walkable`]
    };
}

function factor85_medicalProximity(p: PropertyData): ExtractedFactor {
    const places = (p as any).neighborhoodPlaces;
    const medical = places?.drivable?.medical || places?.medical || [];
    if (!medical.length) return { id: 85, name: 'Medical Proximity', value: 'Data not available', confidence: 'low', tags: [] };

    const closest = medical.reduce((a: any, b: any) => (a.distanceMeters || Infinity) < (b.distanceMeters || Infinity) ? a : b);
    const closestKm = closest.distanceMeters ? (closest.distanceMeters / 1000).toFixed(1) : '?';

    // Detail: name the hospitals
    const hospitalNames = medical.slice(0, 3).map((h: any) => {
        const km = h.distanceMeters ? `${(h.distanceMeters / 1000).toFixed(1)}km` : '';
        return `${h.name}${km ? ` (${km})` : ''}`;
    }).join(', ');

    return {
        id: 85, name: 'Medical Proximity',
        value: `${medical.length} hospital${medical.length > 1 ? 's' : ''} within 5km, closest ${closestKm}km`,
        detail: hospitalNames ? `Facilities: ${hospitalNames}.` : undefined,
        confidence: 'high',
        tags: [`${medical.length} Hospitals`, `${closestKm}km`]
    };
}

function factor86_evInfrastructure(p: PropertyData): ExtractedFactor {
    const places = (p as any).neighborhoodPlaces;
    // EV charging stations are in the transit bucket
    const transit = [...(places?.walkable?.transit || []), ...(places?.drivable?.transit || [])];
    const evStations = transit.filter((pl: any) => (pl.types || []).some((t: string) => t.includes('electric_vehicle') || t.includes('ev_charging')));

    if (evStations.length === 0) {
        return { id: 86, name: 'EV Infrastructure', value: 'None nearby — no charging stations found', confidence: 'high', tags: ['No EV Charging'] };
    }

    const closest = evStations.reduce((a: any, b: any) => (a.distanceMeters || Infinity) < (b.distanceMeters || Infinity) ? a : b);
    const closestKm = closest.distanceMeters ? (closest.distanceMeters / 1000).toFixed(1) : '?';

    return {
        id: 86, name: 'EV Infrastructure',
        value: `${evStations.length} charging station${evStations.length > 1 ? 's' : ''}, closest ${closestKm}km`,
        confidence: 'high',
        tags: ['EV Ready', `${evStations.length} Stations`]
    };
}

// ── Main Export ────────────────────────────────────────────────────

/**
 * Pre-computes all pure-data factors from property fields.
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
        factor33_privacyLevel(property, visual),
        factor34_curbAppeal(property, visual),
        factor41_schoolQuality(property),
        factor43_walkability(property),
        factor46_wildfireRisk(property),
        factor47_floodRisk(property),
        factor48_solarYield(property),
        factor49_pollenSafety(property),
        factor50_hvacQuality(property),
        factor51_vastu(property),
        factor52_airQuality(property),
        factor54_topography(property),
        factor55_solar(property),
        factor59_laundry(property),
        factor75_marketVelocity(visual, property),
        // ── New factors ──
        factor76_internetConnectivity(property),
        factor77_noiseProfile(property),
        factor78_droughtRisk(property),
        factor79_disasterHistory(property),
        factor84_walkableAmenities(property),
        factor85_medicalProximity(property),
        factor86_evInfrastructure(property),
    ];

    const map = new Map<number, ExtractedFactor>();
    for (const f of factors) map.set(f.id, f);
    return map;
}

/** IDs of all pre-computed factors — used to tell AI to skip these */
export const PRECOMPUTED_FACTOR_IDS = [1, 2, 4, 5, 7, 8, 10, 11, 12, 13, 14, 15, 18, 20, 28, 33, 34, 41, 43, 46, 47, 48, 49, 50, 51, 52, 54, 55, 59, 75, 76, 77, 78, 79, 84, 85, 86];
