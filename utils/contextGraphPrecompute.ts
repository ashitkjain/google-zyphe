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
    value?: string;
    tags: string[];
}

// ── Helpers ────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, prefix = '', suffix = ''): string | null {
    if (n == null) return null;
    return `${prefix}${n.toLocaleString()}${suffix}`;
}

/**
 * Safely coerce a field that may be a string OR string[] (Zillow API inconsistency)
 * into a comma-joined string. Returns '' for null/undefined/invalid types.
 */
function toStr(v: any): string {
    if (v == null) return '';
    if (Array.isArray(v)) return v.join(', ');
    return String(v);
}

function calcMonthlyMortgage(price: number, annualRate = 0.07, years = 30): number {
    const r = annualRate / 12;
    const n = years * 12;
    return (price * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// ── Factor Computers ───────────────────────────────────────────────

function factor1_priceBracket(p: PropertyData): ExtractedFactor {
    const price = p.price ?? p.zestimate;
    if (price == null) return { id: 1, name: 'Price Bracket', tags: [] };
    const label = fmt(price, '$')!;
    if (price < 800_000) return { id: 1, name: 'Price Bracket', tags: ['Entry', label] };
    if (price <= 1_500_000) return { id: 1, name: 'Price Bracket', tags: ['Mid-Range', label] };
    return { id: 1, name: 'Price Bracket', tags: ['Luxury', label] };
}

function factor2_hoaFriction(p: PropertyData): ExtractedFactor {
    const raw = p.resoFacts?.feesAndDues;
    if (raw == null) return { id: 2, name: 'HOA Friction', tags: ['No HOA'] };
    const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.]/g, ''));
    if (isNaN(num) || num <= 0) return { id: 2, name: 'HOA Friction', tags: ['No HOA'] };
    const tags = [num > 500 ? 'High HOA' : 'Low HOA', `$${num}/mo`];
    const units = p.resoFacts?.numberOfUnitsInCommunity;
    if (units != null && units > 0) {
        tags.push(`${units} Units`);
        if (units >= 200) tags.push('Large Community');
        else if (units <= 20) tags.push('Small Community');
    }
    return { id: 2, name: 'HOA Friction', tags };
}

function factor4_trueCarryingCost(p: PropertyData): ExtractedFactor {
    const price = p.price ?? p.zestimate;
    if (price == null) return { id: 4, name: 'True Carrying Cost', tags: [] };
    const mortgage = calcMonthlyMortgage(price);
    const taxes = p.propertyTaxRate ? (price * p.propertyTaxRate) / 100 / 12 : price * 0.012 / 12;
    const insurance = p.annualHomeownersInsurance ? p.annualHomeownersInsurance / 12 : price * 0.005 / 12;
    const hoaRaw = p.resoFacts?.feesAndDues;
    const hoa = hoaRaw ? parseFloat(String(hoaRaw).replace(/[^0-9.]/g, '')) || 0 : 0;
    const total = Math.round(mortgage + taxes + insurance + hoa);
    return { id: 4, name: 'True Carrying Cost', tags: [`~$${Math.round(total / 1000)}K/mo`] };
}

function factor5_sellerMotivation(p: PropertyData): ExtractedFactor {
    const dom = p.timeOnZillow ?? p.resoFacts?.daysOnZillow;
    const cuts = (p.priceHistory ?? []).filter(h => h.event?.toLowerCase().includes('price cut') || h.event?.toLowerCase().includes('reduced')).length;
    const desc = toStr(p.description ?? '').toLowerCase();
    const isHot = desc.includes('hot home') || desc.includes('multiple offers') || desc.includes('offer deadline');
    const backOnMarket = (p.priceHistory ?? []).some(h => h.event?.toLowerCase().includes('back on market'));
    const tags: string[] = [];
    if (isHot) tags.push('Hot Home', 'Act Fast');
    if (backOnMarket) tags.push('Back on Market');
    if (cuts > 0) tags.push('Motivated Seller', `${cuts} Price Cut${cuts > 1 ? 's' : ''}`);
    if (dom != null && dom > 90) tags.push(`${dom} DOM`);
    if (tags.length === 0) tags.push('Standard', ...(dom != null ? [`${dom} DOM`] : []));
    return { id: 5, name: 'Seller Motivation', tags };
}

function factor8_ltrYield(p: PropertyData): ExtractedFactor {
    const price = p.price ?? p.zestimate;
    const rent = p.rentZestimate;
    if (price && rent) {
        const yield_ = ((rent * 12) / price * 100).toFixed(1);
        return { id: 8, name: 'Long-Term Rental Yield', tags: [`${yield_}% Yield`, `$${rent.toLocaleString()}/mo`, rent > 4000 ? 'Strong Rent' : 'Moderate Rent'] };
    }
    return { id: 8, name: 'Long-Term Rental Yield', tags: price ? ['Estimated Yield'] : [] };
}


function factor14_sqft(p: PropertyData): ExtractedFactor {
    const sqft = p.livingAreaValue;
    if (sqft == null) return { id: 14, name: 'Usable Square Footage', tags: [] };
    const tier = sqft < 1500 ? 'Compact' : sqft < 2500 ? 'Mid-Size' : sqft < 4000 ? 'Spacious' : 'Estate';
    const tags = [tier, `${sqft.toLocaleString()} sqft`];
    const taxSqft = (p as any).taxSqft;
    if (taxSqft && taxSqft > 0 && Math.abs((sqft - taxSqft) / taxSqft) > 0.1) tags.push('Sqft Discrepancy');
    return { id: 14, name: 'Usable Square Footage', tags };
}

function factor16_singleStoryFlow(p: PropertyData): ExtractedFactor {
    const stories = p.resoFacts?.stories;
    if (stories == null) return { id: 16, name: 'Single-Story Flow', tags: [] };
    if (stories === 1) return { id: 16, name: 'Single-Story Flow', tags: ['Single Story', 'No Stairs'] };
    if (stories === 2) return { id: 16, name: 'Single-Story Flow', tags: ['Two Story'] };
    if (stories === 3) return { id: 16, name: 'Single-Story Flow', tags: ['Three Story'] };
    return { id: 16, name: 'Single-Story Flow', tags: [`${stories} Stories`] };
}

function factor18_garageParkingCapacity(p: PropertyData): ExtractedFactor {
    const capacity = p.resoFacts?.garageParkingCapacity;
    const features = p.resoFacts?.parkingFeatures;
    if (capacity == null && !features) return { id: 18, name: 'Garage & Parking', tags: [] };
    const tags: string[] = [];
    if (capacity != null) {
        const cap = typeof capacity === 'number' ? capacity : parseInt(String(capacity)) || 0;
        if (cap >= 3) tags.push('3+ Car Garage');
        else if (cap === 2) tags.push('2-Car Garage');
        else if (cap === 1) tags.push('1-Car Garage');
        else tags.push('No Garage');
    }
    if (features) {
        const lower = toStr(features).toLowerCase();
        if (lower.includes('attached')) tags.push('Attached');
        else if (lower.includes('detached')) tags.push('Detached');
        if (lower.includes('ev') || lower.includes('electric vehicle') || lower.includes('240v')) tags.push('EV-Ready');
        if (lower.includes('tandem')) tags.push('Tandem');
    }
    return { id: 18, name: 'Garage & Parking', tags: [...new Set(tags)].slice(0, 4) };
}

function factor21_moveInReadiness(p: PropertyData): ExtractedFactor {
    const condition = p.resoFacts?.propertyCondition;
    if (!condition) return { id: 21, name: 'Move-In Readiness', tags: [] };
    const lower = toStr(condition).toLowerCase();
    const tags: string[] = [];
    if (lower.includes('new') || lower.includes('excellent') || lower.includes('updated') || lower.includes('remodel')) {
        tags.push('Turn-Key');
    } else if (lower.includes('good') || lower.includes('well') || lower.includes('maintain')) {
        tags.push('Well Maintained');
    } else if (lower.includes('fair') || lower.includes('average')) {
        tags.push('Average Condition');
    } else if (lower.includes('fixer') || lower.includes('tlc') || lower.includes('needs') || lower.includes('dated')) {
        tags.push('Needs TLC');
    } else {
        // Use condition value directly as a tag
        tags.push(toStr(condition).split(',')[0].trim());
    }
    return { id: 21, name: 'Move-In Readiness', tags };
}

function factor30_interiorFinishes(p: PropertyData): ExtractedFactor {
    const interior = p.resoFacts?.interiorFeatures;
    if (!interior) return { id: 30, name: 'Interior Finishes', tags: [] };
    const features = toStr(interior).split(',').map(s => s.trim()).filter(Boolean);
    const tags: string[] = [];
    const lower = features.map(f => f.toLowerCase());
    // Extract key keywords
    if (lower.some(f => f.includes('granite') || f.includes('quartz') || f.includes('marble'))) tags.push('Stone Counters');
    if (lower.some(f => f.includes('hardwood'))) tags.push('Hardwood');
    if (lower.some(f => f.includes('crown') || f.includes('molding'))) tags.push('Crown Molding');
    if (lower.some(f => f.includes('skylight'))) tags.push('Skylight');
    if (lower.some(f => f.includes('fireplace'))) tags.push('Fireplace');
    if (lower.some(f => f.includes('smart') || f.includes('wired'))) tags.push('Smart Home');
    if (lower.some(f => f.includes('open') || f.includes('great room'))) tags.push('Open Floor Plan');
    // If no keywords matched, take first few features as-is
    if (tags.length === 0) {
        for (const feat of features.slice(0, 3)) tags.push(feat);
    }
    return { id: 30, name: 'Interior Finishes', tags: [...new Set(tags)].slice(0, 5) };
}


function factor20_constructionEra(p: PropertyData): ExtractedFactor {
    const year = p.yearBuilt;
    if (year == null) return { id: 20, name: 'Construction Era', tags: [] };
    let era: string;
    if (year < 1945) era = 'Pre-War';
    else if (year <= 1975) era = 'Mid-Century';
    else if (year <= 1999) era = '80s–90s';
    else if (year <= 2015) era = '2000s';
    else era = 'New Build';
    return { id: 20, name: 'Construction Era', tags: [era, `Built ${year}`] };
}

function factor28_flooring(p: PropertyData): ExtractedFactor {
    const f = p.resoFacts?.flooring;
    if (!f) return { id: 28, name: 'Flooring Material', tags: [] };
    return { id: 28, name: 'Flooring Material', tags: toStr(f).split(',').map(s => s.trim()).filter(Boolean).slice(0, 3) };
}



function factor43_walkability(p: PropertyData): ExtractedFactor {
    const score = p.walkScore;
    if (score == null) return { id: 43, name: 'Walkability', tags: [] };
    const desc = score >= 90 ? "Walker's Paradise" : score >= 70 ? 'Very Walkable' : score >= 50 ? 'Somewhat Walkable' : 'Car-Dependent';
    return { id: 43, name: 'Walkability', tags: [desc, `WS ${score}`] };
}

function factor52_airQuality(p: PropertyData): ExtractedFactor {
    const aq = p.airQuality;
    if (!aq) return { id: 52, name: 'Asthma / Respiratory Safety', tags: [] };
    return { id: 52, name: 'Asthma / Respiratory Safety', tags: [aq.category, `AQI ${aq.aqi}`] };
}


function factor59_laundry(p: PropertyData): ExtractedFactor {
    const lf = p.resoFacts?.laundryFeatures;
    if (!lf) return { id: 59, name: 'Laundry Logistics', tags: [] };
    const lower = toStr(lf).toLowerCase();
    const indoor = lower.includes('inside') || lower.includes('indoor') || lower.includes('laundry room');
    return { id: 59, name: 'Laundry Logistics', tags: [indoor ? 'Indoor Laundry' : 'Garage/Exterior Laundry'] };
}

function factor7_strViability(visual: CustomAIAnalysisResult | null): ExtractedFactor {
    const str = (visual as any)?.property_investment?.str_performance;
    if (!str) return { id: 7, name: 'STR Viability', tags: [] };
    const occMatch = String(str.occupancy_rate ?? '').match(/(\d+)%/);
    const adrMatch = String(str.adr ?? '').match(/\$(\d+)/);
    if (occMatch && adrMatch) return { id: 7, name: 'STR Viability', tags: [`${occMatch[1]}% Occupancy`, `$${adrMatch[1]}/night`, 'STR'] };
    return { id: 7, name: 'STR Viability', tags: ['STR'] };
}

function factor41_exteriorStyle(p: PropertyData, visual: CustomAIAnalysisResult | null): ExtractedFactor {
    const tags: string[] = [];

    // 1. Architecture style from resoFacts (listing data) — short keyword like "Contemporary"
    const resoStyle = p.resoFacts?.architecturalStyle;
    if (resoStyle && resoStyle !== 'N/A') {
        tags.push(toStr(resoStyle).split(',')[0].trim());
    }

    // 2. From visual AI exterior analysis — extract style keyword only
    const ext = visual?.exterior_and_neighborhood?.exterior_and_lot_appeal;
    if (ext?.architecture_style && tags.length === 0) {
        const stylePatterns = ['contemporary', 'mediterranean', 'craftsman', 'colonial', 'ranch', 'modern', 'traditional', 'tudor', 'victorian', 'spanish', 'cape cod', 'farmhouse', 'mid-century', 'bungalow', 'split-level'];
        const lower = ext.architecture_style.toLowerCase();
        for (const style of stylePatterns) {
            if (lower.includes(style)) {
                tags.push(style.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' '));
                break;
            }
        }
    }

    // 3. Exterior materials from resoFacts
    const materials = (p.resoFacts as any)?.constructionMaterials;
    if (materials && materials !== 'N/A') {
        for (const mat of toStr(materials).split(',').map((s: string) => s.trim()).slice(0, 2)) {
            if (mat && !tags.some(t => t.toLowerCase() === mat.toLowerCase())) tags.push(mat);
        }
    }

    // 4. Roof type
    const roof = (p.resoFacts as any)?.roofType;
    if (roof && roof !== 'N/A') {
        tags.push(`${toStr(roof).split(',')[0].trim()} Roof`);
    }

    // 5. Curb appeal note from visual
    if (ext?.curb_appeal) {
        const curbLower = ext.curb_appeal.toLowerCase();
        if (curbLower.includes('excellent') || curbLower.includes('stunning')) tags.push('Excellent Curb Appeal');
        else if (curbLower.includes('good') || curbLower.includes('attractive')) tags.push('Good Curb Appeal');
        else if (curbLower.includes('dated') || curbLower.includes('needs')) tags.push('Dated Exterior');
    }

    if (tags.length === 0) return { id: 41, name: 'Exterior Style & Architecture', tags: [] };

    return {
        id: 41, name: 'Exterior Style & Architecture',
        tags: [...new Set(tags)].slice(0, 5)
    };
}

// ── Outdoor Factors from Street View & Visual AI ────────────────────

function factor33_privacyLevel(p: PropertyData, visual: CustomAIAnalysisResult | null, comprehensive: ComprehensiveAnalysisResult | null): ExtractedFactor {
    const sv = p.streetViewAnalysis;
    const visualPrivacy = visual?.exterior_and_neighborhood?.views_privacy_orientation?.privacy;

    // Prefer street view rating, fallback to visual analysis, then comprehensive
    const rating = sv?.privacyRating || visualPrivacy || comprehensive?.detailed_analysis?.privacy_layout;
    if (!rating) return { id: 33, name: 'Privacy Level', tags: [] };

    // Truncate to a concise value (max 10 words)
    const valueTrunc = rating.split(/[.!]/).filter(Boolean)[0]?.trim() || rating;
    const value = valueTrunc.split(/\s+/).slice(0, 10).join(' ');

    const lower = rating.toLowerCase();
    const tags: string[] = [];

    // Primary privacy level tag
    if (lower.includes('high') || lower.includes('private') || lower.includes('secluded') || lower.includes('excellent privacy')) {
        tags.push('Private');
    } else if (lower.includes('low') || lower.includes('exposed') || lower.includes('minimal privacy') || lower.includes('limited privacy')) {
        tags.push('Exposed');
    } else {
        tags.push('Moderate Privacy');
    }

    // Additional detail tags from the rating text
    if (lower.includes('fence') || lower.includes('fenced')) tags.push('Fenced');
    if (lower.includes('hedge') || lower.includes('screening')) tags.push('Hedge Screening');
    if (lower.includes('tree') || lower.includes('mature')) tags.push('Mature Trees');
    if (lower.includes('neighbor') && (lower.includes('close') || lower.includes('overlook'))) tags.push('Close Neighbors');
    if (lower.includes('cul-de-sac') || lower.includes('cul de sac')) tags.push('Cul-de-sac');

    return {
        id: 33, name: 'Privacy Level',
        value,
        tags: [...new Set(tags)].slice(0, 5)
    };
}



// ── Environmental Factors (46-50) ───────────────────────────────────

function factor46_wildfireRisk(p: PropertyData): ExtractedFactor {
    const score = p.fireRiskScore;
    if (score == null) return { id: 46, name: 'Wildfire Risk', tags: [] };
    const tier = score <= 3 ? 'Low' : score <= 6 ? 'Moderate' : 'High';
    return {
        id: 46, name: 'Wildfire Risk',
        tags: [tier, `${score}/10`, ...(score >= 7 ? ['High Fire Risk'] : [])]
    };
}

function factor47_floodRisk(p: PropertyData): ExtractedFactor {
    const score = p.floodRiskScore;
    if (score == null) return { id: 47, name: 'Flood Risk', tags: [] };
    const tier = score <= 3 ? 'Low' : score <= 6 ? 'Moderate' : 'High';
    return {
        id: 47, name: 'Flood Risk',
        tags: [tier, `${score}/10`, ...(score >= 7 ? ['Flood Insurance'] : [])]
    };
}

function factor48_solarYield(p: PropertyData): ExtractedFactor {
    const solar = p.solarData;
    if (!solar?.estimatedSolarProduction) return { id: 48, name: 'Solar Yield Potential', tags: [] };

    const tags: string[] = [];

    // Sunshine hours
    if (solar.maxSunshineHoursPerYear) {
        tags.push(`${Math.round(solar.maxSunshineHoursPerYear).toLocaleString()} hrs sun/yr`);
    }

    // Annual production
    const kwh = solar.estimatedSolarProduction.annualKwh;
    if (kwh) {
        tags.push(`${Math.round(kwh).toLocaleString()} kWh/yr`);
    }

    // System cost (upfront)
    const cash = solar.financialAnalysis?.cashPurchase;
    if (cash?.outOfPocketCost) {
        tags.push(`Cost: $${Math.round(cash.outOfPocketCost).toLocaleString()}`);
    }

    // Payback period
    if (cash?.paybackYears) {
        tags.push(`Payback: ${cash.paybackYears} yrs`);
    }

    // Year 1 savings
    if (cash?.savings?.savingsYear1) {
        tags.push(`Yr1 Savings: $${Math.round(cash.savings.savingsYear1).toLocaleString()}`);
    }

    // City benchmark + natural light + smart tags
    try {
        const { computeSolarBenchmarks, computeNaturalLightScore, computeSolarSmartTags } = require('./solarCityBenchmarks');
        const bench = computeSolarBenchmarks(solar, p.city, p.state);
        if (bench) {
            tags.push(`${bench.sunshinePctOfAvg}% of ${bench.benchmarkCity} avg sunshine`);
        }
        const light = computeNaturalLightScore(solar, p.city, p.state);
        if (light) {
            tags.push(...light.tags);
        }
        const smartTags = computeSolarSmartTags(solar, (p as any).lotSize, p.city, p.state);
        tags.push(...smartTags);
    } catch (_) { /* benchmark module not critical */ }

    // Deduplicate
    const unique = [...new Set(tags)];

    return {
        id: 48, name: 'Solar Yield Potential',
        tags: unique.slice(0, 12)
    };
}

function factor49_pollenSafety(p: PropertyData): ExtractedFactor {
    const pollen = p.pollen;
    if (!pollen) return { id: 49, name: 'Allergen / Pollen Safety', tags: [] };

    const analysis = pollen.analysis;
    if (!analysis) return { id: 49, name: 'Allergen / Pollen Safety', tags: [] };

    const tags: string[] = [];

    // Primary triggers (e.g. ["Oak", "Cedar"])
    if (analysis.primary_triggers?.length) {
        for (const trigger of analysis.primary_triggers) {
            tags.push(trigger);
        }
    }

    // Seasonality window (e.g. "March–June")
    if (analysis.seasonality_window) {
        tags.push(`Season: ${analysis.seasonality_window}`);
    }

    // Breathe easy summary as a tag
    if (analysis.breathe_easy_summary) {
        tags.push(analysis.breathe_easy_summary);
    }

    return {
        id: 49, name: 'Allergen / Pollen Safety',
        tags: [...new Set(tags)].slice(0, 8)
    };
}

function factor50_hvacQuality(p: PropertyData): ExtractedFactor {
    const heating = p.resoFacts?.heating;
    const cooling = p.resoFacts?.cooling;
    if (!heating && !cooling) return { id: 50, name: 'HVAC Quality / Air Filtration', tags: [] };

    const parts: string[] = [];
    const tags: string[] = [];
    if (cooling) {
        const coolingStr = toStr(cooling);
        const isCentral = coolingStr.toLowerCase().includes('central');
        parts.push(isCentral ? 'Central AC' : coolingStr);
        tags.push(isCentral ? 'Central AC' : 'AC');
    }
    if (heating) {
        const heatingStr = toStr(heating);
        const isForced = heatingStr.toLowerCase().includes('forced air') || heatingStr.toLowerCase().includes('central');
        parts.push(isForced ? 'Forced Air Heat' : heatingStr);
        tags.push(isForced ? 'Forced Air' : 'Heat');
    }

    return {
        id: 50, name: 'HVAC Quality / Air Filtration',
        tags
    };
}

// ── New Factors: Infrastructure & Environment ──────────────────────

function factor76_internetConnectivity(p: PropertyData): ExtractedFactor {
    const bb = (p as any).broadband;
    if (!bb) return { id: 76, name: 'Internet & Connectivity', tags: [] };

    const parts: string[] = [];
    if (bb.hasFiber) parts.push('Fiber');
    else if (bb.topDownloadMbps > 0) parts.push(`Cable ${bb.topDownloadMbps}Mbps`);
    if (bb.has5G) parts.push('5G');
    parts.push(`${bb.providerCount} provider${bb.providerCount !== 1 ? 's' : ''}`);

    const speed = bb.topDownloadMbps;
    const tier = speed >= 1000 ? 'Gigabit' : speed >= 300 ? 'Fast' : speed >= 100 ? 'Moderate' : speed > 0 ? 'Basic' : 'Unknown';



    return {
        id: 76, name: 'Internet & Connectivity',
        tags: [tier, ...(bb.hasFiber ? ['Fiber'] : []), ...(bb.has5G ? ['5G'] : [])]
    };
}

function factor77_noiseProfile(p: PropertyData): ExtractedFactor {
    if (p.noiseScore == null) return { id: 77, name: 'Noise Profile (Measured)', tags: [] };

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
        tags: [label, `Score ${score}`]
    };
}



function factor79_disasterHistory(p: PropertyData): ExtractedFactor {
    const hd = (p as any).historical_disasters;
    const femaDeclarations = hd?.femaDeclarations || [];
    const events = Array.isArray(hd?.events) ? hd.events : [];

    if (!hd) {
        return { id: 79, name: 'Disaster History (FEMA)', tags: [] };
    }

    if (events.length === 0 && femaDeclarations.length === 0) {
        return { id: 79, name: 'Disaster History (FEMA)', tags: ['Clean Record', 'No FEMA Declarations'] };
    }

    const tags: string[] = [];

    // Disaster events
    if (events.length === 0) {
        tags.push('Clean Record');
    } else {
        const typeCounts: Record<string, number> = {};
        for (const e of events) {
            const type = e.type || e.disasterType || 'Unknown';
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        }
        for (const [t, c] of Object.entries(typeCounts).slice(0, 3)) tags.push(`${c} ${t.toLowerCase()}`);
        const severity = events.length >= 5 ? 'High Risk' : events.length >= 2 ? 'Moderate' : 'Low';
        tags.push(severity);
    }

    // FEMA declarations
    if (femaDeclarations.length > 0) {
        tags.push(`${femaDeclarations.length} FEMA Declaration${femaDeclarations.length > 1 ? 's' : ''}`);
        const sorted = [...femaDeclarations].sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
        const recent = sorted[0];
        if (recent?.date) tags.push(`Latest: ${new Date(recent.date).getFullYear()}`);
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
        const recentCount = femaDeclarations.filter((d: any) => d.date && new Date(d.date) >= fiveYearsAgo).length;
        if (recentCount > 0) tags.push(`${recentCount} in Last 5yr`);
    } else {
        tags.push('No FEMA Declarations');
    }

    const parts: string[] = [];
    if (events.length > 0) parts.push(`${events.length} events`);
    if (femaDeclarations.length > 0) parts.push(`${femaDeclarations.length} FEMA`);
    if (parts.length === 0) parts.push('Clean — no records');
    const val = parts.join(' · ');

    return {
        id: 79, name: 'Disaster History (FEMA)',
        tags: [...new Set(tags)].slice(0, 8)
    };
}

function factor84_walkableAmenities(p: PropertyData): ExtractedFactor {
    const places = (p as any).google_places;
    if (!places?.walkable) return { id: 84, name: 'Walkable Amenity Score', tags: [] };

    const w = places.walkable;
    const diningCount = w.dining?.length || 0;
    const parksCount = w.parks?.length || 0;
    const shoppingCount = w.shopping?.length || 0;
    const fitnessCount = w.fitness?.length || 0;
    const total = diningCount + parksCount + shoppingCount + fitnessCount + (w.schools?.length || 0) + (w.community?.length || 0);

    if (total === 0) {
        return { id: 84, name: 'Walkable Amenity Score', tags: ['Car-Dependent'] };
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
    const placeNames = allWalkable.map((pl: any) => `${pl.name} (${(pl.distanceMeters / 1609.34).toFixed(1)}mi)`).join(', ');

    return {
        id: 84, name: 'Walkable Amenity Score',
        tags: [tier, `${total} Walkable`]
    };
}

function factor85_medicalProximity(p: PropertyData): ExtractedFactor {
    const places = (p as any).google_places;
    const medical = places?.drivable?.medical || places?.medical || [];
    if (!medical.length) return { id: 85, name: 'Medical Proximity', tags: [] };

    const closest = medical.reduce((a: any, b: any) => (a.distanceMeters || Infinity) < (b.distanceMeters || Infinity) ? a : b);
    const closestMi = closest.distanceMeters ? (closest.distanceMeters / 1609.34).toFixed(1) : '?';

    // Detail: name the hospitals
    const hospitalNames = medical.slice(0, 3).map((h: any) => {
        const mi = h.distanceMeters ? `${(h.distanceMeters / 1609.34).toFixed(1)}mi` : '';
        return `${h.name}${mi ? ` (${mi})` : ''}`;
    }).join(', ');

    return {
        id: 85, name: 'Medical Proximity',
        tags: [`${medical.length} Hospitals`, `${closestMi}mi`]
    };
}

function factor86_evInfrastructure(p: PropertyData): ExtractedFactor {
    const tags: string[] = [];

    // On-property EV features from listing description
    const desc = toStr(p.description).toLowerCase();
    const garage = toStr(p.resoFacts?.exteriorFeatures).toLowerCase();
    const combined = `${desc} ${garage}`;
    if (combined.includes('ev charger') || combined.includes('ev charging')) tags.push('EV Charger Installed');
    else if (combined.includes('240v') || combined.includes('level 2')) tags.push('240V / Level 2 Ready');
    else if (combined.includes('electric vehicle') || combined.includes('ev-ready')) tags.push('EV-Ready Garage');

    // NREL EV charger data (nearby public stations)
    const ev = (p as any).evChargers;
    if (ev && ev.totalStations > 0) {
        tags.push(`${ev.totalStations} Stations Nearby`);
        if (ev.closestDistanceMi != null) {
            tags.push(`Closest ${ev.closestDistanceMi}mi`);
        }
        if (ev.dcFastPorts > 0) {
            tags.push(`${ev.dcFastPorts} DC Fast Ports`);
        }
        if (ev.level2Ports > 0) {
            tags.push(`${ev.level2Ports} Level 2 Ports`);
        }
        if (ev.networks?.length > 0) {
            tags.push(ev.networks.slice(0, 3).join(', '));
        }
    } else if (!ev) {
        // Fallback to Google Places data if NREL hasn't been fetched yet
        const places = (p as any).google_places;
        const transit = [...(places?.walkable?.transit || []), ...(places?.drivable?.transit || [])];
        const evStations = transit.filter((pl: any) => (pl.types || []).some((t: string) => t.includes('electric_vehicle') || t.includes('ev_charging')));
        if (evStations.length > 0) {
            tags.push(`${evStations.length} Stations Nearby`);
        } else {
            tags.push('No Public Charging Nearby');
        }
    } else {
        tags.push('No Public Charging Nearby');
    }

    return { id: 86, name: 'EV Infrastructure', tags: [...new Set(tags)].slice(0, 8) };
}

function factor39_usableYard(p: PropertyData): ExtractedFactor {
    const pv = (p as any).parcelValidation;

    // Path 1: If we have slope data from parcelValidation, use it
    if (pv?.slopePercent != null) {
        const slope = pv.slopePercent;
        const cat = pv.slopeCategory || '';
        let pct = 100;
        const tags: string[] = [];
        if (slope <= 5) { pct = 100; }
        else if (slope <= 10) { pct = 85; tags.push('Mild Slope'); }
        else if (slope <= 20) { pct = 65; tags.push('Hillside Limitation'); }
        else if (slope <= 35) { pct = 40; tags.push('Steep Terrain'); tags.push('Retaining Walls Likely'); }
        else { pct = 20; tags.push('Very Steep'); tags.push('Limited Usability'); }
        return {
            id: 39, name: 'Usable Yard Space',
            tags
        };
    }

    // Path 2: Estimate from lot size vs living area (no slope data)
    const lotRaw = (p as any).lotSize;
    const arcgisLot = (p as any).parcelAreaSqft;
    const livingArea = p.livingAreaValue;
    const lotSqft = arcgisLot || (typeof lotRaw === 'number' ? lotRaw : (lotRaw ? parseFloat(String(lotRaw).replace(/[^0-9.]/g, '')) : null));

    if (lotSqft && lotSqft > 0 && livingArea && livingArea > 0) {
        // Standard setback deduction (~25% for lots < 12k sqft)
        const cappedLot = Math.min(lotSqft, 30000);
        const setbackDeduction = cappedLot <= 12000 ? cappedLot * 0.25 : 3000 + (cappedLot - 12000) * 0.01;
        const usableYard = Math.max(0, Math.round(lotSqft - livingArea - setbackDeduction));
        const yardPct = Math.round((usableYard / lotSqft) * 100);
        const tags: string[] = [];
        if (usableYard > 3000) tags.push('Large Yard');
        else if (usableYard > 1500) tags.push('Moderate Yard');
        else if (usableYard > 500) tags.push('Small Yard');
        else tags.push('Minimal Yard');
        tags.push(`${usableYard.toLocaleString()} sqft`);
        const source = arcgisLot ? 'ArcGIS' : 'listing';
        return {
            id: 39, name: 'Usable Yard Space',
            tags
        };
    }

    return { id: 39, name: 'Usable Yard Space', tags: [] };
}

function factor83_microNeighborhood(p: PropertyData, visual: CustomAIAnalysisResult | null): ExtractedFactor {
    const ni = (p as any).neighborhood_identity;
    const gem = ni?.gemini;
    const nf = visual?.neighborhood?.neighborhood_features;

    const tags: string[] = [];

    if (ni?.resolved_name) {
        tags.push(ni.resolved_name);
    }
    if (gem?.unique_features?.length) {
        for (const feat of gem.unique_features.slice(0, 3)) tags.push(feat);
    }
    if (gem?.price_context?.typical_range) tags.push(gem.price_context.typical_range);
    if (gem?.character?.era_built) tags.push(`Built ${gem.character.era_built}`);
    if (gem?.character?.architectural_style) tags.push(gem.character.architectural_style);
    if (gem?.price_context?.tier) tags.push(gem.price_context.tier);
    if (gem?.character?.community_type) tags.push(gem.character.community_type);

    // Neighborhood infrastructure from visual AI neighborhood analysis
    if (nf) {
        const extractKeyword = (text: string, keywords: [string, string][]) => {
            const lower = text.toLowerCase();
            for (const [match, tag] of keywords) {
                if (lower.includes(match)) return tag;
            }
            return null;
        };

        if (nf.neighborhood_density) {
            const d = extractKeyword(nf.neighborhood_density, [
                ['low density', 'Low Density'], ['sparse', 'Low Density'],
                ['high density', 'High Density'], ['dense', 'High Density'],
                ['moderate', 'Medium Density'], ['suburban', 'Suburban Density'],
            ]);
            if (d) tags.push(d);
        }

        if (nf.street_layout_and_traffic) {
            const s = extractKeyword(nf.street_layout_and_traffic, [
                ['cul-de-sac', 'Cul-de-sac'], ['quiet', 'Quiet Streets'],
                ['grid', 'Grid Layout'], ['wide', 'Wide Streets'],
                ['busy', 'Busy Traffic'], ['heavy traffic', 'Heavy Traffic'],
            ]);
            if (s) tags.push(s);
        }

        if (nf.sidewalks_and_pedestrian_infra) {
            const sw = extractKeyword(nf.sidewalks_and_pedestrian_infra, [
                ['well-maintained', 'Good Sidewalks'], ['continuous', 'Good Sidewalks'],
                ['no sidewalk', 'No Sidewalks'], ['limited', 'Limited Sidewalks'],
            ]);
            if (sw) tags.push(sw);
        }
    }

    if (tags.length === 0) return { id: 83, name: 'Neighborhood Character', tags: [] };

    return { id: 83, name: 'Neighborhood Character', tags: [...new Set(tags)].slice(0, 8) };
}


function factor65_upcomingDevImpact(p: PropertyData): ExtractedFactor {
    const upcoming = (p as any).neighborhood_identity?.gemini?.upcoming_changes;
    if (!upcoming || upcoming === 'None known' || upcoming === 'N/A') {
        return { id: 65, name: 'Upcoming Dev Impact', tags: [] };
    }
    return { id: 65, name: 'Upcoming Dev Impact', tags: [upcoming] };
}

function factor106_seismicRisk(p: PropertyData): ExtractedFactor {
    const hd = p.historical_disasters;
    const sz = hd?.seismicZone;
    if (!sz) return { id: 106, name: 'Seismic Risk', tags: [] };
    const tags: string[] = [];
    tags.push(`Zone ${sz.designCategory}`);
    if (sz.riskLevel) tags.push(`${sz.riskLevel.charAt(0).toUpperCase() + sz.riskLevel.slice(1).replace('_', ' ')} Risk`);
    if (sz.pga) tags.push(`PGA ${sz.pga.toFixed(2)}g`);
    if (sz.designCategory === 'D' || sz.designCategory === 'E') tags.push('Seismic Retrofit May Apply');

    // Earthquake counts from historical data
    const quakes = hd?.earthquakes || [];
    const currentYear = new Date().getFullYear();
    const ytd = quakes.filter((q: any) => {
        const yr = q.date ? new Date(q.date).getFullYear() : 0;
        return yr === currentYear;
    });
    const total = quakes.length;

    if (total > 0) {
        tags.push(`${total} Quakes Recorded`);
        if (ytd.length > 0) tags.push(`${ytd.length} YTD (${currentYear})`);

        // Strongest quake
        const strongest = quakes.reduce((max: any, q: any) => (q.magnitude || 0) > (max.magnitude || 0) ? q : max, quakes[0]);
        if (strongest?.magnitude) tags.push(`Strongest: M${strongest.magnitude}`);

        // Nearest quake
        const nearest = quakes.reduce((min: any, q: any) => {
            const d = q.distanceMi ?? Infinity;
            return d < (min.distanceMi ?? Infinity) ? q : min;
        }, quakes[0]);
        if (nearest?.distanceMi != null && nearest.distanceMi < 50) {
            tags.push(`Nearest: ${nearest.distanceMi.toFixed(1)}mi`);
        }
    } else {
        tags.push('No Recent Quakes');
    }

    const val = `Zone ${sz.designCategory} — ${sz.riskLevel?.replace('_', ' ')} risk (PGA ${sz.pga?.toFixed(2)}g)${total > 0 ? ` • ${total} quakes` : ''}`;
    return { id: 106, name: 'Seismic Risk', tags };
}



function factor108_sqftDiscrepancy(p: PropertyData): ExtractedFactor {
    const listed = p.livingAreaValue;
    const tax = (p as any).taxSqft;
    if (!listed || !tax) return { id: 108, name: 'Sqft Discrepancy', tags: [] };
    const listedNum = typeof listed === 'number' ? listed : parseFloat(String(listed).replace(/[^0-9.]/g, ''));
    const taxNum = typeof tax === 'number' ? tax : parseFloat(String(tax).replace(/[^0-9.]/g, ''));
    if (!listedNum || !taxNum || isNaN(listedNum) || isNaN(taxNum)) return { id: 108, name: 'Sqft Discrepancy', tags: [] };
    const diff = Math.abs(listedNum - taxNum);
    const pct = Math.round((diff / taxNum) * 100);
    if (pct <= 5) return { id: 108, name: 'Sqft Discrepancy', tags: ['Match', `${pct}% Diff`] };
    return { id: 108, name: 'Sqft Discrepancy', tags: [pct > 15 ? 'Major Discrepancy' : 'Minor Discrepancy', `${pct}% Diff`] };
}

function factor109_lotSizeVerification(p: PropertyData): ExtractedFactor {
    const raw = (p as any).lotSize;
    const arcgis = (p as any).parcelAreaSqft;
    if (!raw || !arcgis) return { id: 109, name: 'Lot Size Verification', tags: [] };
    // lotSize can be a string like "7,405 sqft" or a number
    const listed = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.]/g, ''));
    if (!listed || isNaN(listed)) return { id: 109, name: 'Lot Size Verification', tags: [] };
    const diff = Math.abs(listed - arcgis);
    const pct = Math.round((diff / arcgis) * 100);
    if (pct <= 10) return { id: 109, name: 'Lot Size Verification', tags: ['Verified', `${pct}% Diff`] };
    return { id: 109, name: 'Lot Size Verification', tags: [pct > 20 ? 'Lot Size Mismatch' : 'Minor Lot Diff', `${pct}% Diff`] };
}



function factor80_professionalLifestyleFit(visual: CustomAIAnalysisResult | null, comprehensive: ComprehensiveAnalysisResult | null): ExtractedFactor {
    // Try structured lifestyle_fit first
    const lf = (visual as any)?.lifestyle_fit?.working_professionals;
    console.log('[Factor 80 Debug] lifestyle_fit:', !!(visual as any)?.lifestyle_fit, 'working_professionals:', !!lf, 'comprehensive:', !!comprehensive, 'lifestyle_insights:', !!comprehensive?.lifestyle_insights, 'professionals:', !!comprehensive?.lifestyle_insights?.professionals);
    if (lf?.verdict) {
        const tags: string[] = [];
        tags.push(lf.verdict);
        if (lf.strengths?.length) for (const s of lf.strengths.slice(0, 3)) tags.push(s);
        if (lf.weaknesses?.length) for (const w of lf.weaknesses.slice(0, 2)) tags.push(w);
        return { id: 80, name: 'Professional Lifestyle Fit', tags };
    }
    // Fallback to comprehensive.lifestyle_insights.professionals
    const text = comprehensive?.lifestyle_insights?.professionals;
    if (text) {
        const val = text.length > 60 ? text.substring(0, 57) + '...' : text;
        return { id: 80, name: 'Professional Lifestyle Fit', tags: [text] };
    }
    return { id: 80, name: 'Professional Lifestyle Fit', tags: [] };
}

function factor81_familyLifestyleFit(visual: CustomAIAnalysisResult | null, comprehensive: ComprehensiveAnalysisResult | null): ExtractedFactor {
    const lf = (visual as any)?.lifestyle_fit?.families_with_kids;
    if (lf?.verdict) {
        const tags: string[] = [];
        tags.push(lf.verdict);
        if (lf.strengths?.length) for (const s of lf.strengths.slice(0, 3)) tags.push(s);
        if (lf.weaknesses?.length) for (const w of lf.weaknesses.slice(0, 2)) tags.push(w);
        return { id: 81, name: 'Family Lifestyle Fit', tags };
    }
    const text = comprehensive?.lifestyle_insights?.family;
    if (text) {
        const val = text.length > 60 ? text.substring(0, 57) + '...' : text;
        return { id: 81, name: 'Family Lifestyle Fit', tags: [text] };
    }
    return { id: 81, name: 'Family Lifestyle Fit', tags: [] };
}

function factor82_seniorLifestyleFit(visual: CustomAIAnalysisResult | null, comprehensive: ComprehensiveAnalysisResult | null): ExtractedFactor {
    const lf = (visual as any)?.lifestyle_fit?.seniors;
    if (lf?.verdict) {
        const tags: string[] = [];
        tags.push(lf.verdict);
        if (lf.strengths?.length) for (const s of lf.strengths.slice(0, 3)) tags.push(s);
        if (lf.weaknesses?.length) for (const w of lf.weaknesses.slice(0, 2)) tags.push(w);
        return { id: 82, name: 'Senior Lifestyle Fit', tags };
    }
    const text = comprehensive?.lifestyle_insights?.senior;
    if (text) {
        const val = text.length > 60 ? text.substring(0, 57) + '...' : text;
        return { id: 82, name: 'Senior Lifestyle Fit', tags: [text] };
    }
    return { id: 82, name: 'Senior Lifestyle Fit', tags: [] };
}

function factor120_nearbyAmenitiesProfile(p: PropertyData): ExtractedFactor {
    const places = (p as any).google_places;
    if (!places) return { id: 120, name: 'Nearby Places Profile', tags: [] };

    const tags: string[] = [];

    // Categories to scan — combine walkable + drivable for complete picture
    const categories: { label: string; key: string }[] = [
        { label: 'Medical', key: 'medical' },
        { label: 'Shopping', key: 'shopping' },
        { label: 'Parks', key: 'parks' },
        { label: 'Dining', key: 'dining' },
        { label: 'Fitness', key: 'fitness' },
        { label: 'Transit', key: 'transit' },
        { label: 'Schools', key: 'schools' },
        { label: 'Community', key: 'community' },
    ];

    for (const cat of categories) {
        // Merge walkable + drivable, dedup by name
        const walkable = places.walkable?.[cat.key] || [];
        const drivable = places.drivable?.[cat.key] || [];
        const seen = new Set<string>();
        const merged: any[] = [];
        for (const pl of [...walkable, ...drivable]) {
            const norm = pl.name?.toLowerCase().trim();
            if (norm && !seen.has(norm)) {
                seen.add(norm);
                merged.push(pl);
            }
        }
        if (merged.length === 0) continue;

        // Sort by distance
        merged.sort((a: any, b: any) => (a.distanceMeters || Infinity) - (b.distanceMeters || Infinity));

        // Count tag
        tags.push(`${merged.length} ${cat.label}`);

        // Top 1-2 closest with distance
        for (const pl of merged.slice(0, 2)) {
            const dist = pl.distanceMeters
                ? `${(pl.distanceMeters / 1609.34).toFixed(1)}mi`
                : '';
            tags.push(`${cat.label}: ${pl.name}${dist ? ` (${dist})` : ''}`);
        }
    }

    if (tags.length === 0) return { id: 120, name: 'Nearby Places Profile', tags: ['No POI Data'] };

    return { id: 120, name: 'Nearby Places Profile', tags: tags.slice(0, 25) };
}

// ── Main Export ────────────────────────────────────────────────────



function factor121_microclimate(p: PropertyData): ExtractedFactor {
    const micro = (p as any).microclimate;
    if (!micro) return { id: 121, name: 'Microclimate (Thermal Fingerprint)', tags: [] };
    const tags: string[] = [];
    const cToF = (c: number) => Math.round(c * 9 / 5 + 32);
    tags.push(`RealFeel: ${cToF(micro.propertyApparentTemp)}°F vs ${micro.baselineLabel} ${cToF(micro.baselineApparentTemp)}°F`);
    tags.push(`Delta: ${micro.deltaF > 0 ? '+' : ''}${micro.deltaF}°F`);
    tags.push(`${micro.survivalRating.score} — ${micro.survivalRating.label}`);
    tags.push(`Mechanism: ${micro.survivalRating.mechanism}`);
    if (micro.windSpeed > 3) tags.push(`Canyon/Gap wind effect (${Math.round(micro.windSpeed * 2.237)} mph)`);
    if (micro.humidity > 60) tags.push(`High humidity (${Math.round(micro.humidity)}%)`);
    if (micro.delta <= -1.5) tags.push('Summer Survival Property — cooler than city baseline');
    if (micro.delta >= 1.5) tags.push('Heat pocket — higher AC costs expected');
    return { id: 121, name: 'Microclimate (Thermal Fingerprint)', tags: tags.slice(0, 8) };
}

function factor122_censusDemographics(p: PropertyData): ExtractedFactor {
    const census = (p as any).censusDemographics;
    if (!census) return { id: 122, name: 'Census Demographics', tags: [] };
    const tags: string[] = [];
    if (census.medianHouseholdIncome) tags.push(`Median household income: $${census.medianHouseholdIncome.toLocaleString()}`);
    if (census.medianAge) tags.push(`Median age: ${census.medianAge}`);
    if (census.ownerPct != null) tags.push(`Owner-occupied: ${census.ownerPct}%`);
    if (census.renterPct != null) tags.push(`Renter-occupied: ${census.renterPct}%`);
    if (census.medianHomeValue) tags.push(`Median home value: $${census.medianHomeValue.toLocaleString()}`);
    if (census.bachelorsPlusPct != null) tags.push(`College-educated (bachelor's+): ${census.bachelorsPlusPct}%`);
    if (census.totalPopulation) tags.push(`Tract population: ${census.totalPopulation.toLocaleString()}`);
    if (census.tractLabel) tags.push(census.tractLabel);
    return { id: 122, name: 'Census Demographics', tags: tags.slice(0, 8) };
}

/**
 * Pre-computes all pure-data factors from property fields.
 * Returns a map of factorId → ExtractedFactor for fast merging.
 */
export function precomputeDataFactors(
    property: PropertyData,
    visual: CustomAIAnalysisResult | null,
    comprehensive: ComprehensiveAnalysisResult | null
): Map<number, ExtractedFactor> {
    const factors: ExtractedFactor[] = [
        factor1_priceBracket(property),
        factor2_hoaFriction(property),
        factor4_trueCarryingCost(property),
        factor5_sellerMotivation(property),
        factor7_strViability(visual),
        factor8_ltrYield(property),

        factor14_sqft(property),
        factor16_singleStoryFlow(property),
        factor18_garageParkingCapacity(property),

        factor20_constructionEra(property),
        factor21_moveInReadiness(property),
        factor28_flooring(property),
        factor30_interiorFinishes(property),
        factor33_privacyLevel(property, visual, comprehensive),
        factor41_exteriorStyle(property, visual),


        factor39_usableYard(property),

        factor43_walkability(property),
        factor46_wildfireRisk(property),
        factor47_floodRisk(property),
        factor48_solarYield(property),
        factor49_pollenSafety(property),
        factor50_hvacQuality(property),
        factor52_airQuality(property),

        factor59_laundry(property),

        // ── New factors ──
        factor76_internetConnectivity(property),
        factor77_noiseProfile(property),

        factor79_disasterHistory(property),
        factor80_professionalLifestyleFit(visual, comprehensive),
        factor81_familyLifestyleFit(visual, comprehensive),
        factor82_seniorLifestyleFit(visual, comprehensive),
        factor83_microNeighborhood(property, visual),
        factor84_walkableAmenities(property),
        factor85_medicalProximity(property),
        factor86_evInfrastructure(property),
        factor120_nearbyAmenitiesProfile(property),
        factor106_seismicRisk(property),
        factor108_sqftDiscrepancy(property),
        factor109_lotSizeVerification(property),
        factor65_upcomingDevImpact(property),
        factor121_microclimate(property),
        factor122_censusDemographics(property),


    ];

    const map = new Map<number, ExtractedFactor>();
    for (const f of factors) map.set(f.id, f);
    return map;
}


