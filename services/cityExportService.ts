/**
 * City Data Export Service
 * 
 * Aggregates city-level + property-level intelligence from Firestore,
 * using the SAME optimized format the chatbot uses (getChatContext)
 * so the context graph taxonomy sees exactly what buyers see.
 *
 * Supports exporting multiple cities in a single pass.
 */

import {
    getPropertyFromCloud,
    getVisualAnalysisFromCloud,
    getComprehensiveAnalysisFromCloud,
    getCommunityPulseFromCloud,
    getGeneralMarketIntelligenceFromCloud,
    getDeepInvestmentResearchFromCloud,
    getPropertyZpidsByCity,
} from './firebase/properties';
import { getZipsForCity, getZipListings } from './firebase/cityData';
import { generateCityStateKey } from './firebase/config';
import { getChatContext } from '../prompts/property/chatInterface';
import {
    CommunityPulseResult,
    GeneralMarketIntelligenceResult,
    DeepInvestmentResearchResult,
} from '../types';

// ── Types ──────────────────────────────────────────────

/** Single property in chatbot-optimized format */
export interface PropertyExport {
    zpid: string;
    address?: string;
    price?: number;
    /** The exact context object the chatbot receives */
    chatContext: Record<string, any>;
    /** Flags for what data was available */
    dataCoverage: {
        hasMLS: boolean;
        hasVisual: boolean;
        hasComprehensive: boolean;
    };
}

/** Single city's data */
export interface CityData {
    city: string;
    state: string;
    cityStateKey: string;
    zipCodes: string[];
    cityIntelligence: {
        community_pulse: CommunityPulseResult | null;
        general_market_intelligence: GeneralMarketIntelligenceResult | null;
        deep_investment_research: DeepInvestmentResearchResult | null;
    };
    properties: PropertyExport[];
}

/** Full multi-city export */
export interface CityExport {
    meta: {
        cities: { city: string; state: string }[];
        exportedAt: string;
        totalProperties: number;
        format: 'chatbot-context';
    };
    cityData: CityData[];
    // Keep legacy accessors for backward compat with UI
    city_level: CityData['cityIntelligence'];
    properties: PropertyExport[];
}

export type ExportProgress = {
    phase: 'init' | 'city_data' | 'zip_listings' | 'properties' | 'done' | 'error';
    message: string;
    current: number;
    total: number;
};

// ── Export Function ────────────────────────────────────

/**
 * Export data for one or more cities.
 * @param cities  Array of {city, state} pairs
 * @param onProgress  Progress callback
 * @param maxPropertiesPerCity  Max properties to export per city
 */
export const exportCityData = async (
    cities: { city: string; state: string }[],
    onProgress?: (progress: ExportProgress) => void,
    maxPropertiesPerCity: number = 15
): Promise<CityExport> => {
    const report = (phase: ExportProgress['phase'], message: string, current = 0, total = 0) => {
        onProgress?.({ phase, message, current, total });
    };

    report('init', `Exporting data for ${cities.map(c => `${c.city}, ${c.state}`).join(' & ')}...`);

    const allCityData: CityData[] = [];
    const allProperties: PropertyExport[] = [];

    for (const { city, state } of cities) {
        const cityStateKey = generateCityStateKey(city, state);
        if (!cityStateKey) {
            console.warn(`Cannot generate key for ${city}, ${state} — skipping`);
            continue;
        }

        // ── 1. Fetch city-level data (parallel) ──
        report('city_data', `Fetching city intelligence for ${city}, ${state}...`);
        const [communityPulse, marketIntel, deepResearch] = await Promise.all([
            getCommunityPulseFromCloud(cityStateKey),
            getGeneralMarketIntelligenceFromCloud(cityStateKey),
            getDeepInvestmentResearchFromCloud(cityStateKey),
        ]);
        report('city_data', `${city} city-level data loaded.`, 1, 1);

        // ── 2. Fetch zip codes and listings ──
        report('zip_listings', `Looking up zip codes for ${city}...`);
        const zipsByState = await getZipsForCity(city);
        const allZips: string[] = [];
        if (zipsByState) {
            Object.values(zipsByState).forEach(zips => allZips.push(...zips));
        }
        report('zip_listings', `${city}: Found ${allZips.length} zip codes. Fetching listings...`);

        const zpidSet = new Set<string>();

        // Source 1: Zip listings
        for (let i = 0; i < allZips.length; i++) {
            const zip = allZips[i];
            report('zip_listings', `${city}: Fetching listings for ${zip}...`, i + 1, allZips.length);
            const cached = await getZipListings(zip);
            if (cached?.listings) {
                cached.listings.forEach((l: any) => {
                    const id = String(l.property_id || l.listing_id || l.zpid || '');
                    if (id) zpidSet.add(id);
                });
            }
        }

        // Source 2: Properties collection (catches analyzed properties not in zip listings)
        report('properties', `${city}: Querying properties collection directly...`);
        const cityZpids = await getPropertyZpidsByCity(city, maxPropertiesPerCity * 2);
        cityZpids.forEach(zpid => zpidSet.add(zpid));
        report('properties', `${city}: Found ${zpidSet.size} total unique properties from both sources.`);

        // ── 3. Fetch property-level data and transform to chatbot context ──
        const zpids = Array.from(zpidSet).slice(0, maxPropertiesPerCity);
        report('properties', `${city}: Fetching ${zpids.length} properties...`, 0, zpids.length);

        const cityProperties: PropertyExport[] = [];
        const BATCH_SIZE = 5;

        for (let i = 0; i < zpids.length; i += BATCH_SIZE) {
            const batch = zpids.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
                batch.map(async (zpid): Promise<PropertyExport | null> => {
                    const [property, visual, comprehensive] = await Promise.all([
                        getPropertyFromCloud(zpid),
                        getVisualAnalysisFromCloud(zpid),
                        getComprehensiveAnalysisFromCloud(zpid),
                    ]);

                    // Skip properties with NO data at all
                    if (!property && !visual && !comprehensive) return null;

                    // Build the SAME context the chatbot uses
                    const chatContext = property
                        ? getChatContext(property, visual, comprehensive)
                        : { visualIntelligence: visual, comprehensive: comprehensive };

                    // ── Deduplicate & clean for export ──
                    // general_market_intelligence lives at city level — remove from property
                    delete (chatContext as any).generalMarketIntelligence;
                    if ((chatContext as any).visualIntelligence && typeof (chatContext as any).visualIntelligence === 'object') {
                        delete (chatContext as any).visualIntelligence.general_market_intelligence;
                        // Per-image analysis is noisy truncated text — not useful for taxonomy
                        delete (chatContext as any).visualIntelligence.imageAnalysis;
                    }
                    // Strip web_sources/citations from deep_investment_research (token hog, not useful for taxonomy)
                    stripResearchSources((chatContext as any).visualIntelligence?.deep_investment_research);

                    return {
                        zpid,
                        address: property?.address || undefined,
                        price: property?.price || undefined,
                        chatContext,
                        dataCoverage: {
                            hasMLS: !!property,
                            hasVisual: !!visual,
                            hasComprehensive: !!comprehensive,
                        },
                    };
                })
            );

            cityProperties.push(...results.filter((r): r is PropertyExport => r !== null));
            report(
                'properties',
                `${city}: Loaded ${Math.min(i + BATCH_SIZE, zpids.length)} / ${zpids.length} properties...`,
                Math.min(i + BATCH_SIZE, zpids.length),
                zpids.length
            );
        }

        // Strip web_sources/citations from city-level deep research too
        stripResearchSources(deepResearch);

        const cityData: CityData = {
            city,
            state,
            cityStateKey,
            zipCodes: allZips,
            cityIntelligence: {
                community_pulse: communityPulse,
                general_market_intelligence: marketIntel,
                deep_investment_research: deepResearch,
            },
            properties: cityProperties,
        };

        allCityData.push(cityData);
        allProperties.push(...cityProperties);
    }

    const result: CityExport = {
        meta: {
            cities: cities.map(c => ({ city: c.city, state: c.state })),
            exportedAt: new Date().toISOString(),
            totalProperties: allProperties.length,
            format: 'chatbot-context',
        },
        cityData: allCityData,
        // Legacy accessors — point to first city for backward compat
        city_level: allCityData[0]?.cityIntelligence ?? {
            community_pulse: null,
            general_market_intelligence: null,
            deep_investment_research: null,
        },
        properties: allProperties,
    };

    report('done', `Export complete. ${allProperties.length} properties across ${cities.length} cities.`, allProperties.length, allProperties.length);
    return result;
};

// ── Utility: Strip web_sources & citations from research ──

function stripResearchSources(research: any): void {
    if (!research || typeof research !== 'object') return;
    delete research.citations;
    delete research.web_sources;
    // Also check structured_report sub-sections
    if (research.structured_report) {
        for (const section of Object.values(research.structured_report)) {
            if (section && typeof section === 'object') {
                delete (section as any).web_sources;
                delete (section as any).citations;
            }
        }
    }
}

// ── Utility: Estimate JSON size ───────────────────────

export const estimateExportSize = (data: CityExport): string => {
    const bytes = new Blob([JSON.stringify(data)]).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
