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
    const raw = p.resoFacts?.feesAndDues ?? (p as any).hoaFees;
    if (raw == null) return { id: 2, name: 'HOA Friction', tags: ['No HOA'] };
    const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.]/g, ''));
    if (isNaN(num) || num <= 0) return { id: 2, name: 'HOA Friction', tags: ['No HOA'] };
    return { id: 2, name: 'HOA Friction', tags: [num > 500 ? 'High HOA' : 'Low HOA', `$${num}/mo`] };
}

function factor4_trueCarryingCost(p: PropertyData): ExtractedFactor {
    const price = p.price ?? p.zestimate;
    if (price == null) return { id: 4, name: 'True Carrying Cost', tags: [] };
    const mortgage = calcMonthlyMortgage(price);
    const taxes = p.propertyTaxRate ? (price * p.propertyTaxRate) / 100 / 12 : price * 0.012 / 12;
    const insurance = p.annualHomeownersInsurance ? p.annualHomeownersInsurance / 12 : price * 0.005 / 12;
    const hoaRaw = p.resoFacts?.feesAndDues ?? (p as any).hoaFees;
    const hoa = hoaRaw ? parseFloat(String(hoaRaw).replace(/[^0-9.]/g, '')) || 0 : 0;
    const total = Math.round(mortgage + taxes + insurance + hoa);
    return { id: 4, name: 'True Carrying Cost', tags: [`~$${Math.round(total / 1000)}K/mo`, 'Estimated'] };
}

function factor5_sellerMotivation(p: PropertyData): ExtractedFactor {
    const dom = p.timeOnZillow ?? p.resoFacts?.daysOnZillow;
    const cuts = (p.priceHistory ?? []).filter(h => h.event?.toLowerCase().includes('price cut') || h.event?.toLowerCase().includes('reduced')).length;
    const desc = (p.description ?? '').toLowerCase();
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
    return { id: 28, name: 'Flooring Material', tags: f.split(',').map(s => s.trim()).slice(0, 3) };
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
    const lower = lf.toLowerCase();
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

    // 1. Architecture style from resoFacts (listing data)
    const resoStyle = p.resoFacts?.architecturalStyle;
    if (resoStyle && resoStyle !== 'N/A') {
        tags.push(resoStyle.split(',')[0].trim());
    }

    // 2. From visual AI exterior analysis
    const ext = visual?.exterior_and_neighborhood?.exterior_and_lot_appeal;
    if (ext?.architecture_style) {
        const aiStyle = ext.architecture_style.split(/[.,;]/)[0].trim();
        // Only add if different from reso style
        if (aiStyle && !tags.some(t => t.toLowerCase() === aiStyle.toLowerCase())) {
            tags.push(aiStyle);
        }
    }

    // 3. Exterior materials from resoFacts
    const materials = p.resoFacts?.constructionMaterials;
    if (materials && materials !== 'N/A') {
        for (const mat of materials.split(',').map(s => s.trim()).slice(0, 2)) {
            if (mat && !tags.some(t => t.toLowerCase() === mat.toLowerCase())) tags.push(mat);
        }
    }

    // 4. Roof type
    const roof = p.resoFacts?.roofType;
    if (roof && roof !== 'N/A') {
        tags.push(`${roof.split(',')[0].trim()} Roof`);
    }

    // 5. Curb appeal note from visual or street view
    if (ext?.curb_appeal) {
        const curbLower = ext.curb_appeal.toLowerCase();
        if (curbLower.includes('excellent') || curbLower.includes('stunning')) tags.push('Excellent Curb Appeal');
        else if (curbLower.includes('good') || curbLower.includes('attractive')) tags.push('Good Curb Appeal');
        else if (curbLower.includes('dated') || curbLower.includes('needs')) tags.push('Dated Exterior');
    }

    if (tags.length === 0) return { id: 41, name: 'Exterior Style & Architecture', tags: [] };

    return {
        id: 41, name: 'Exterior Style & Architecture',
        tags: [...new Set(tags)].slice(0, 6)
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

    const kwh = solar.estimatedSolarProduction.annualKwh;
    const panels = solar.estimatedSolarProduction.estimatedPanels;
    const capacity = solar.estimatedSolarProduction.systemCapacityKw;
    const tier = kwh > 15000 ? 'High' : kwh > 8000 ? 'Moderate' : 'Low';



    return {
        id: 48, name: 'Solar Yield Potential',
        tags: [tier, `${Math.round(kwh / 1000)}K kWh`, ...(kwh > 15000 ? ['High Solar'] : [])]
    };
}

function factor49_pollenSafety(p: PropertyData): ExtractedFactor {
    const pollen = p.pollen;
    if (!pollen) return { id: 49, name: 'Allergen / Pollen Safety', tags: [] };

    const score = pollen.score;
    const tier = score <= 2 ? 'Low Risk' : score <= 3 ? 'Moderate' : 'High Risk';
    const dominant = pollen.dominantPollenType || 'Unknown';
    const tags: string[] = [tier, dominant, pollen.category];

    // Merge pollen sensitivity triggers (was factor 53)
    const analysis = pollen.analysis;
    if (analysis) {
        const raw = (pollen as any).raw_data;
        // Extract individual pollen types from raw data if available
        if (raw?.dailyInfo?.[0]?.plantInfo) {
            for (const plant of raw.dailyInfo[0].plantInfo) {
                if (plant.indexInfo?.value >= 2 && plant.displayName) {
                    tags.push(`${plant.displayName} Pollen`);
                }
            }
        }
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

function factor78_droughtRisk(p: PropertyData): ExtractedFactor {
    const d = (p as any).drought;
    if (!d) return { id: 78, name: 'Water & Drought Risk', tags: [] };

    if (d.severityLevel < 0 || d.none >= 100) {
        return { id: 78, name: 'Water & Drought Risk', tags: ['No Drought'] };
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
        tags: [d.severity, `${pctAffected}% Affected`]
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
    const places = (p as any).neighborhoodPlaces;
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
    const places = (p as any).neighborhoodPlaces;
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

    // On-property EV features (was factor 56)
    const desc = (p.description || '').toLowerCase();
    const garage = (p.resoFacts?.exteriorFeatures || '').toLowerCase();
    const combined = `${desc} ${garage}`;
    if (combined.includes('ev charger') || combined.includes('ev charging')) tags.push('EV Charger Installed');
    else if (combined.includes('240v') || combined.includes('level 2')) tags.push('240V / Level 2 Ready');
    else if (combined.includes('electric vehicle') || combined.includes('ev-ready')) tags.push('EV-Ready Garage');

    // Nearby EV charging stations
    const places = (p as any).neighborhoodPlaces;
    const transit = [...(places?.walkable?.transit || []), ...(places?.drivable?.transit || [])];
    const evStations = transit.filter((pl: any) => (pl.types || []).some((t: string) => t.includes('electric_vehicle') || t.includes('ev_charging')));

    if (evStations.length > 0) {
        const closest = evStations.reduce((a: any, b: any) => (a.distanceMeters || Infinity) < (b.distanceMeters || Infinity) ? a : b);
        const closestMi = closest.distanceMeters ? (closest.distanceMeters / 1609.34).toFixed(1) : '?';
        tags.push(`${evStations.length} Stations Nearby`);
        tags.push(`Closest ${closestMi}mi`);
    } else {
        tags.push('No Public Charging Nearby');
    }

    const hasOnProperty = tags.some(t => t.includes('Charger') || t.includes('240V') || t.includes('EV-Ready'));
    const val = hasOnProperty
        ? `${tags[0]}${evStations.length > 0 ? ` + ${evStations.length} nearby stations` : ''}`
        : evStations.length > 0
            ? `${evStations.length} charging station${evStations.length > 1 ? 's' : ''} nearby`
            : 'No EV infrastructure found';

    return { id: 86, name: 'EV Infrastructure', tags };
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

function factor83_microNeighborhood(p: PropertyData): ExtractedFactor {
    const ni = (p as any).neighborhood_identity;
    const gem = ni?.gemini;
    if (!ni?.resolved_name) {
        return { id: 83, name: 'Micro-Neighborhood Identity', tags: [] };
    }
    const parts: string[] = [ni.resolved_name];
    if (gem?.price_context?.tier) parts.push(gem.price_context.tier);
    if (gem?.character?.community_type) parts.push(gem.character.community_type);
    const tags: string[] = [];
    if (gem?.unique_features?.length) {
        for (const feat of gem.unique_features.slice(0, 5)) tags.push(feat);
    }
    if (gem?.price_context?.typical_range) tags.push(gem.price_context.typical_range);
    if (gem?.character?.era_built) tags.push(`Built ${gem.character.era_built}`);
    if (gem?.character?.architectural_style) tags.push(gem.character.architectural_style);
    return { id: 83, name: 'Micro-Neighborhood Identity', tags };
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

function factor107_floodZone(p: PropertyData): ExtractedFactor {
    const fz = p.historical_disasters?.floodZone;
    if (!fz) return { id: 107, name: 'Flood Zone Status', tags: [] };
    const tags: string[] = [];
    tags.push(`Zone ${fz.zone}`);
    if (fz.riskLevel) tags.push(`${fz.riskLevel.charAt(0).toUpperCase() + fz.riskLevel.slice(1)} Risk`);
    if (fz.insuranceRequired) tags.push('Flood Insurance Required');
    if (fz.zoneSubtype) tags.push(fz.zoneSubtype);
    const val = `Zone ${fz.zone} — ${fz.riskLevel} risk${fz.insuranceRequired ? ' (Insurance Required)' : ''}`;
    return { id: 107, name: 'Flood Zone Status', tags };
}

function factor112_femaDeclarations(p: PropertyData): ExtractedFactor {
    const declarations = p.historical_disasters?.femaDeclarations;
    if (!declarations?.length) return { id: 112, name: 'FEMA Declarations', tags: ['No Declarations'] };

    const tags: string[] = [];
    const total = declarations.length;
    tags.push(`${total} Declaration${total > 1 ? 's' : ''}`);

    // Count by type
    const typeCounts: Record<string, number> = {};
    for (const d of declarations) {
        const t = d.type || 'other';
        typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
        const label = type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
        tags.push(`${count} ${label}`);
    }

    // Most recent declaration
    const sorted = [...declarations].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const recent = sorted[0];
    if (recent?.date) {
        const yr = new Date(recent.date).getFullYear();
        tags.push(`Latest: ${yr}`);
    }
    if (recent?.severity) tags.push(recent.severity);

    // Recent 5 years count
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const recentCount = declarations.filter((d: any) => d.date && new Date(d.date) >= fiveYearsAgo).length;
    if (recentCount > 0) tags.push(`${recentCount} in Last 5 Years`);

    const val = `${total} FEMA declaration${total > 1 ? 's' : ''} on record${recent?.date ? ` • Latest: ${new Date(recent.date).getFullYear()}` : ''}`;
    return { id: 112, name: 'FEMA Declarations', tags: [...new Set(tags)].slice(0, 10) };
}

function factor108_sqftDiscrepancy(p: PropertyData): ExtractedFactor {
    const listed = p.livingAreaValue || (p as any).livingArea;
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

function factor110_listingClaimFlags(p: PropertyData): ExtractedFactor {
    const pv = (p as any).parcelValidation;
    const flags = pv?.flags?.filter((f: any) => f.severity === 'warning' || f.severity === 'error');
    if (!flags?.length) return { id: 110, name: 'Listing Claim Flags', tags: [] };
    const tags = flags.slice(0, 3).map((f: any) => f.check || 'Flag');
    return { id: 110, name: 'Listing Claim Flags', tags: [`${flags.length} Flags`, ...tags] };
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

function factor87_nearbyPlaces(p: PropertyData): ExtractedFactor {
    const places = (p as any).neighborhoodPlaces;
    if (!places) return { id: 87, name: 'Top Nearby Places', tags: [] };

    const allPlaces = [
        ...(places.walkable?.dining || []),
        ...(places.walkable?.parks || []),
        ...(places.walkable?.shopping || []),
        ...(places.drivable?.medical || []),
        ...(places.drivable?.transit || []),
    ]
      .filter((pl: any) => pl.name && pl.distanceMeters)
      .sort((a: any, b: any) => (a.distanceMeters || 0) - (b.distanceMeters || 0))
      .slice(0, 8);

    if (!allPlaces.length) return { id: 87, name: 'Top Nearby Places', tags: [] };

    const tags = allPlaces.map((pl: any) => {
        const dist = `${(pl.distanceMeters / 1609.34).toFixed(1)}mi`;
        return `${pl.name} (${dist})`;
    });

    const closest = allPlaces[0];
    const val = `${allPlaces.length} places — nearest: ${closest.name}`;
    return { id: 87, name: 'Top Nearby Places', tags };
}

function factor120_nearbyAmenitiesProfile(p: PropertyData): ExtractedFactor {
    const places = (p as any).neighborhoodPlaces;
    if (!places) return { id: 120, name: 'Nearby Amenities Profile', tags: [] };

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

    if (tags.length === 0) return { id: 120, name: 'Nearby Amenities Profile', tags: ['No POI Data'] };

    return { id: 120, name: 'Nearby Amenities Profile', tags: tags.slice(0, 25) };
}

// ── Main Export ────────────────────────────────────────────────────


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

        factor20_constructionEra(property),
        factor28_flooring(property),
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
        factor78_droughtRisk(property),
        factor79_disasterHistory(property),
        factor80_professionalLifestyleFit(visual, comprehensive),
        factor81_familyLifestyleFit(visual, comprehensive),
        factor82_seniorLifestyleFit(visual, comprehensive),
        factor83_microNeighborhood(property),
        factor84_walkableAmenities(property),
        factor85_medicalProximity(property),
        factor86_evInfrastructure(property),
        factor87_nearbyPlaces(property),
        factor120_nearbyAmenitiesProfile(property),
        factor106_seismicRisk(property),
        factor108_sqftDiscrepancy(property),
        factor109_lotSizeVerification(property),
        factor110_listingClaimFlags(property),

    ];

    const map = new Map<number, ExtractedFactor>();
    for (const f of factors) map.set(f.id, f);
    return map;
}


/** IDs of all pre-computed factors — used to tell AI to skip these */
export const PRECOMPUTED_FACTOR_IDS = [1, 2, 4, 5, 7, 8, 14, 20, 28, 33, 39, 41, 43, 46, 47, 48, 49, 50, 52, 59, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 106, 108, 109, 110, 120];


