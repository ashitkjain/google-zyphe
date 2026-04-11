/**
 * BrowseByCitySection
 *
 * Self-contained city browse + ZypheAI buyer-story matching UI.
 * Extracted from ExploreTab.tsx to keep that file manageable.
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';


import { auth, generateCityStateKey } from '../../services/firebase/config';

import {
    getPropertiesByCity,
    CityPropertySummary,
    queryContextGraphs,
    getCityContextGraphFromCloud,
    getCityNeighborhoodsFromCloud,
} from '../../services/firebase/properties';

import { SaveSearchModal, SavedSearchesPanel, type SavedSearch } from './SaveSearchModals';

import { trackCityBrowsed, trackPropertyViewed, trackStorySearchRun, trackViewModeChanged } from '../../services/analytics/idxTracking';

import { FACTOR_NAMES, CITY_LEVEL_FACTOR_IDS, expandFactor } from '../../constants/contextGraphFactors';
import {
    executeGeminiRequest,
    FLASH_LITE_MODEL,
    FLASH_MODEL,
    mineCityNeighborhoods,
} from '../../services/geminiService';

import { buildExtractionPrompt, buildMatchingPrompt, PersonaContext } from '../../services/prompts/buyerStoryMatch';
import { Type } from '@google/genai';
import { getDaysOnMarket } from '../../utils/property.ts';
import LeadCaptureModal from './LeadCaptureModal';
import { BrowseResultsPanel } from './BrowseResultsPanel';
import StoryIntakeTab from '../client-hub/StoryIntakeTab';


/* ══════════════════════════════════════════════════════════════════
   Browse by City — self-contained section for the Explore home
   ══════════════════════════════════════════════════════════════════ */

const BROWSE_CITIES = ['Pleasanton', 'Dublin'] as const;

const BrowseHomeSection: React.FC<{ searchBar: React.ReactNode; setViewMode: any }> = ({ searchBar, setViewMode }) => {
    return (
        <div className="w-full px-6 py-6 space-y-8">
            {/* Browse + Search bar inline */}
            <BrowseByCitySection
                onPropertyClick={(addr) => {
                    if (typeof (setViewMode as any) === 'function') {
                        (setViewMode as any)('explore', addr);
                    }
                }}
                searchBar={searchBar}
            />



        </div>
    );
};

const BUYER_STORY_EXAMPLES = [
    { title: 'Tech Couple, First Home', icon: 'fa-solid fa-laptop-code', story: "We're a dual-income tech couple (Google + Apple) in our early 30s, no kids yet. Budget $1.2-1.6M. We both work from home 3 days a week so need fast internet and 2 separate office spaces. Love cooking — a great kitchen is a must. Walkable dining and nightlife are important. Low maintenance yard preferred." },
    { title: 'Growing Family, Schools', icon: 'fa-solid fa-graduation-cap', story: "Family with 3 kids (ages 4, 7, 10). Top-rated schools are non-negotiable — need 8+ rated elementary and middle. Want 4+ bedrooms, big backyard for the kids, and a quiet cul-de-sac. Budget $1.5-2M. Neighborhood safety is critical. Would love a pool." },
    { title: 'Multi-Gen Living', icon: 'fa-solid fa-people-roof', story: "Indian family looking for multi-gen living. My parents will live with us — need a bedroom and bathroom on the ground floor, separate entrance preferred. East-facing (Vastu) is very important. 4+ beds, modern kitchen. Budget up to $2.5M. Good schools for our 2 teenagers." },
    { title: 'Investor — Cash Flow', icon: 'fa-solid fa-chart-line', story: "Real estate investor looking for properties with ADU potential or house-hacking opportunity. Prefer homes with separate entrances, guest houses, or large lots that allow ADU construction. Budget $1-1.8M. Strong rental demand area. Don't care about schools." },
    { title: 'Retiring, Single-Story', icon: 'fa-solid fa-couch', story: "We're in our 60s, downsizing from a 4-bedroom. Need single-story living — no stairs. 2-3 beds, 2+ baths. Low maintenance landscape (drought-tolerant preferred). Walking distance to medical facilities and parks. Budget $900K-1.3M. Quiet neighborhood." },
    { title: 'Outdoor Lifestyle', icon: 'fa-solid fa-person-hiking', story: "Active family of 4. Trail access and parks are our top priority. Need space for bikes, kayaks, RV parking if possible. Big garage or extra storage. Solar panels already installed would be great. Budget $1.4-1.9M. Don't mind fixer-uppers if the location is right." },
    { title: 'WFH Entrepreneur', icon: 'fa-solid fa-house-laptop', story: "I run an e-commerce business from home. Need a dedicated office or den plus extra garage/workshop space for inventory. Fast fiber internet is critical. Prefer newer construction with smart home features. 3+ beds for when family visits. Budget $1.1-1.5M. Don't need great schools." },
    { title: 'Safety-Conscious', icon: 'fa-solid fa-shield-halved', story: "Moving from out of state, very concerned about natural disasters. Low wildfire risk is #1 priority. Also want low flood and seismic risk. Prefer flat terrain, not hillside. Newer construction (2000+) for modern building codes. Good air quality. Budget $1.3-1.8M. Family with 2 young kids." },
    { title: 'Luxury Entertainer', icon: 'fa-solid fa-champagne-glasses', story: "We entertain frequently. Need a chef's kitchen, open floor plan, resort-style backyard with pool and outdoor kitchen. Views would be amazing — hills or valley. High-end finishes throughout. 5+ beds, 4+ baths. Don't mind higher HOA if the community is gated. Budget $2.5M+." },
    { title: 'First-Time, Value', icon: 'fa-solid fa-piggy-bank', story: "First-time buyer, single income software engineer. Budget is tight: $800K-1.1M. Looking for best value — maybe a fixer with renovation upside. Townhomes OK. Need at least 2 beds. Close to BART or highway for commute to SF. Walkable to grocery and coffee shops. Low HOA preferred." },
];

const BrowseByCitySection: React.FC<{ onPropertyClick: (address: string) => void; onHasResults?: (has: boolean) => void; onMyStory?: (open: boolean) => void; searchBar?: React.ReactNode }> = ({ onPropertyClick, onHasResults, onMyStory, searchBar }) => {
    const [selectedCity, setSelectedCity] = useState<string>('');
    const [browsing, setBrowsing] = useState(false);
    const [results, setResults] = useState<CityPropertySummary[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [showMyStory, setShowMyStory] = useState(true);
    // Track which discovery path is active: browse (city), story (My Story), or search (address)
    const [activePath, setActivePath] = useState<'browse' | 'story' | 'search'>('story');

    // Notify parent when My Story is toggled
    React.useEffect(() => { onMyStory?.(showMyStory); }, [showMyStory]);

    // View, sort, filter, pagination state
    const [viewMode, setViewModeLocal] = useState<'zypheai' | 'gallery' | 'table' | 'map'>('gallery');
    const [sortField, setSortField] = useState<'address' | 'listPrice' | 'bedrooms' | 'bathrooms' | 'livingArea' | 'lotSize' | 'homeType' | 'neighborhood'>('address');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [filterMinPrice, setFilterMinPrice] = useState('');
    const [filterMaxPrice, setFilterMaxPrice] = useState('');
    const [filterBeds, setFilterBeds] = useState('');
    const [filterBaths, setFilterBaths] = useState('');
    const [filterNeighborhood, setFilterNeighborhood] = useState('');
    const [page, setPage] = useState(1);
    const [showTimings, setShowTimings] = useState(false);
    const PER_PAGE = 20;


    // Advanced filters
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [filterHomeType, setFilterHomeType] = useState('');
    const [filterMinSqft, setFilterMinSqft] = useState('');
    const [filterMaxSqft, setFilterMaxSqft] = useState('');
    const [filterMinYear, setFilterMinYear] = useState('');
    const [filterMaxYear, setFilterMaxYear] = useState('');
    const [filterStories, setFilterStories] = useState('');
    const [filterGarage, setFilterGarage] = useState('');
    const [filterPool, setFilterPool] = useState<'' | 'yes' | 'no'>('');
    const [filterMaxHoa, setFilterMaxHoa] = useState('');
    const [filterMaxDom, setFilterMaxDom] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterMinSchoolRating, setFilterMinSchoolRating] = useState('');
    const [filterOrientation, setFilterOrientation] = useState('');

    const advancedFilterCount = useMemo(() => {
        let count = 0;
        if (filterMinSqft || filterMaxSqft) count++;
        if (filterMinYear || filterMaxYear) count++;
        if (filterGarage) count++;
        if (filterMaxHoa) count++;
        if (filterMaxDom) count++;
        if (filterOrientation) count++;
        return count;
    }, [filterMinSqft, filterMaxSqft, filterMinYear, filterMaxYear, filterGarage, filterMaxHoa, filterMaxDom, filterOrientation]);

    const clearAdvancedFilters = () => {
        setFilterHomeType(''); setFilterMinSqft(''); setFilterMaxSqft('');
        setFilterMinYear(''); setFilterMaxYear(''); setFilterStories('');
        setFilterGarage(''); setFilterMaxHoa('');
        setFilterMaxDom(''); setPage(1);
    };

    // Listen for browse-city events from the search bar Browse button
    useEffect(() => {
        const handler = (e: Event) => {
            const city = (e as CustomEvent).detail?.city;
            if (city && typeof city === 'string') {
                setSelectedCity(city);
                // Auto-trigger browse after state update
                setTimeout(async () => {
                    setBrowsing(true);
                    setHasSearched(true);
                    setPage(1);
                    setShowMyStory(false);
                    setShowBuyerSearch(false);
                    setViewModeLocal('gallery');
                    setBuyerResults(null);
                    setBuyerExtracted(null);
                    try {
                        const data = await getPropertiesByCity(city);
                        setResults(data);
                    } catch (err) {
                        console.error('Browse by city failed:', err);
                        setResults([]);
                    } finally {
                        setBrowsing(false);
                    }
                }, 100);
            }
        };
        window.addEventListener('browse-city', handler);
        return () => window.removeEventListener('browse-city', handler);
    }, []);

    // Factor ID → Name lookup (shared constant — single source of truth)
    // Imported at file top level below

    // Buyer Story Search
    const [buyerStory, setBuyerStory] = useState('');
    const [buyerSearching, setBuyerSearching] = useState(false);
    const [buyerResults, setBuyerResults] = useState<{ zpid: string; address: string; score: number; matchWriteup: string; factors?: string[] }[] | null>(null);
    const [showBuyerSearch, setShowBuyerSearch] = useState(false);
    const [buyerError, setBuyerError] = useState<string | null>(null);
    const [buyerExtracted, setBuyerExtracted] = useState<{ priceMin: number; priceMax: number; beds?: number; baths?: number; homeType?: string; stories?: number; minSchoolRating?: number; mustHaves: string[]; niceToHaves: string[]; searchSummary?: string } | null>(null);
    const [showExamples, setShowExamples] = useState(false);
    const [sliderIdx, setSliderIdx] = useState(0);
    const [buyerTimings, setBuyerTimings] = useState<{ step: string; ms: number; detail?: string }[] | null>(null);
    const [buyerScoredCount, setBuyerScoredCount] = useState<number>(0);

    // Persona context from My Story intake form (who the buyer IS)
    const buyerPersonaRef = React.useRef<PersonaContext | undefined>(undefined);

    // Ref to hold a pending story search (set by My Story, auto-triggered after city loads)
    const pendingStoryRef = React.useRef<string | null>(null);


    // City Neighborhood Mining state
    const [mining, setMining] = useState(false);
    const [miningStatus, setMiningStatus] = useState<string>('');
    const [cachedNeighborhoodCount, setCachedNeighborhoodCount] = useState<number | null>(null);
    const [cityGraphs, setCityGraphs] = useState<Map<string, any>>(new Map());

    const handleBrowse = async (city?: string) => {
        const target = city || selectedCity;
        if (!target) return;
        if (city) setSelectedCity(city);
        setBrowsing(true);
        setHasSearched(true);
        setPage(1);
        try {
            const data = await getPropertiesByCity(target);
            setResults(data);
            // PostHog: track city browse
            trackCityBrowsed({ city: target, resultCount: data.length });
        } catch (e) {
            console.error('Browse by city failed:', e);
            setResults([]);
        } finally {
            setBrowsing(false);
        }
    };

    /**
     * Called by StoryIntakeTab when user clicks "Begin Discovery".
     * Orchestrates: load city → set AI prompt → switch to Zyphe AI view → auto-search.
     */
    const handleStoryDiscover = async (story: string, cities: string[], persona?: PersonaContext) => {
        const city = cities[0]; // Use the first city
        if (!city || !story.trim()) return;

        // Store persona context for use in extraction + matching prompts
        buyerPersonaRef.current = persona;

        // Set the buyer story text
        setBuyerStory(story);

        // Hide My Story panel and switch to Gallery view
        setShowMyStory(false);
        setActivePath('story');
        setViewModeLocal('gallery');
        setShowBuyerSearch(true);

        // Store the story so the useEffect auto-triggers after browse completes
        pendingStoryRef.current = story;

        // Browse the city (loads results + sets selectedCity)
        await handleBrowse(city);
    };

    // Auto-trigger buyer search when a pending story search is set and results are loaded
    React.useEffect(() => {
        // Use full Results as dependency to detect city/browse changes reliably
        if (buyerStory.trim() && results.length > 0 && !browsing) {
            // Re-trigger if specifically pending, OR if we switched to story mode and lost results
            if (pendingStoryRef.current || (activePath === 'story' && !buyerResults && !buyerSearching)) {
                console.log(`[ExploreTab] Auto-triggering buyer search. pendingStory=${!!pendingStoryRef.current}, activePath=${activePath}`);
                pendingStoryRef.current = null;
                // Small delay to let state settle
                setTimeout(() => {
                    handleBuyerSearch();
                }, 100);
            }
        }
    }, [results, browsing, activePath, buyerStory]);

    // Fetch context graphs for the whole city to show high-density insights on ALL cards
    useEffect(() => {
        if (!selectedCity) { setCityGraphs(new Map()); return; }
        (async () => {
            try {
                const graphs = await queryContextGraphs({ city: selectedCity, maxResults: 200 });
                setCityGraphs(graphs);
            } catch (err) {
                console.error('[ExploreTab] Failed to fetch city context graphs:', err);
            }
        })();
    }, [selectedCity]);

    // Check if neighborhoods are already cached when city changes
    useEffect(() => {
        if (!selectedCity) { setCachedNeighborhoodCount(null); return; }
        (async () => {
            try {
                const key = generateCityStateKey(selectedCity, 'CA');
                if (!key) return;
                const cached = await getCityNeighborhoodsFromCloud(key);
                setCachedNeighborhoodCount(cached?.neighborhoods?.length || 0);
            } catch { setCachedNeighborhoodCount(null); }
        })();
    }, [selectedCity]);

    const handleMineNeighborhoods = async () => {
        if (!selectedCity || mining) return;
        setMining(true);
        setMiningStatus('Starting neighborhood mining...');
        try {
            const result = await mineCityNeighborhoods(
                selectedCity,
                'CA',
                'admin',
                (msg) => setMiningStatus(msg)
            );
            const count = result.data?.neighborhoods?.length || 0;
            setCachedNeighborhoodCount(count);
            setMiningStatus(`✓ Mined ${count} neighborhoods for ${selectedCity}`);
        } catch (err: any) {
            setMiningStatus(`✗ Failed: ${err.message}`);
        } finally {
            setMining(false);
        }
    };

    // Available neighborhoods for filter dropdown
    const availableNeighborhoods = useMemo(() => {
        const hoods = new Set<string>();
        results.forEach(p => { if (p.neighborhood) hoods.add(p.neighborhood); });
        return Array.from(hoods).sort();
    }, [results]);

    // Filtered + sorted flat list
    const processed = useMemo(() => {
        let list = [...results];
        // Basic filters
        const minP = filterMinPrice ? parseFloat(filterMinPrice) : 0;
        const maxP = filterMaxPrice ? parseFloat(filterMaxPrice) : Infinity;
        const minBeds = filterBeds ? parseInt(filterBeds) : 0;
        const minBaths = filterBaths ? parseInt(filterBaths) : 0;
        if (minP > 0) list = list.filter(p => (p.listPrice || 0) >= minP);
        if (maxP < Infinity) list = list.filter(p => (p.listPrice || 0) <= maxP);
        if (minBeds > 0) list = list.filter(p => (p.bedrooms || 0) >= minBeds);
        if (minBaths > 0) list = list.filter(p => (p.bathrooms || 0) >= minBaths);
        if (filterNeighborhood) list = list.filter(p => p.neighborhood === filterNeighborhood);
        // Advanced filters
        if (filterHomeType) list = list.filter(p => (p.homeType || '').toUpperCase().includes(filterHomeType.toUpperCase()));
        if (filterMinSqft) list = list.filter(p => (p.livingArea || 0) >= parseInt(filterMinSqft));
        if (filterMaxSqft) list = list.filter(p => (p.livingArea || Infinity) <= parseInt(filterMaxSqft));
        if (filterMinYear) list = list.filter(p => (p.yearBuilt || 0) >= parseInt(filterMinYear));
        if (filterMaxYear) list = list.filter(p => (p.yearBuilt || 9999) <= parseInt(filterMaxYear));
        if (filterStories) list = list.filter(p => (p.stories || 0) === parseInt(filterStories));
        if (filterGarage) list = list.filter(p => (p.garage || 0) >= parseInt(filterGarage));
        if (filterPool === 'yes') list = list.filter(p => p.pool === true);
        if (filterPool === 'no') list = list.filter(p => !p.pool);
        if (filterMaxHoa) list = list.filter(p => (p.hoa || 0) <= parseInt(filterMaxHoa));
        if (filterMaxDom) list = list.filter(p => (getDaysOnMarket(p.listedDate, p.daysOnZillow) || 0) <= parseInt(filterMaxDom));
        if (filterStatus) list = list.filter(p => (p.homeStatus || '').toUpperCase().includes(filterStatus.toUpperCase()));
        if (filterMinSchoolRating) list = list.filter(p => (p.maxSchoolRating || 0) >= parseInt(filterMinSchoolRating));
        if (filterOrientation) list = list.filter(p => (p.orientation || '').toUpperCase() === filterOrientation.toUpperCase());
        // Sort
        list.sort((a, b) => {
            const av = a[sortField] ?? '';
            const bv = b[sortField] ?? '';
            if (typeof av === 'string' && typeof bv === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
            return sortDir === 'asc' ? (Number(av) - Number(bv)) : (Number(bv) - Number(av));
        });
        return list;
    }, [results, sortField, sortDir, filterMinPrice, filterMaxPrice, filterBeds, filterBaths, filterNeighborhood, filterHomeType, filterMinSqft, filterMaxSqft, filterMinYear, filterMaxYear, filterStories, filterGarage, filterPool, filterMaxHoa, filterMaxDom, filterStatus, filterMinSchoolRating]);

    // Notify parent about results state
    useEffect(() => {
        onHasResults?.(results.length > 0);
    }, [results.length, onHasResults]);

    // Build match lookup from buyer results
    const matchMap = useMemo(() => {
        const map: Record<string, { score: number; matchWriteup: string; rank: number; factors?: string[] }> = {};
        // Use string casting for ZPIDs to ensure key matches regardless of original source type
        buyerResults?.forEach((m, i) => { 
            const zpid = String(m.zpid);
            map[zpid] = { score: m.score, matchWriteup: m.matchWriteup, rank: i + 1, factors: m.factors }; 
        });
        return map;
    }, [buyerResults]);

    // When buyer results exist, show ONLY matches in score order
    const displayList = useMemo(() => {
        if (!buyerResults || buyerResults.length === 0) return processed;
        // Only show matched properties when AI search is active
        return buyerResults
            .map(m => processed.find(p => String(p.zpid) === String(m.zpid)))
            .filter(Boolean) as typeof processed;
    }, [processed, buyerResults]);

    const totalPages = Math.ceil(displayList.length / PER_PAGE);
    const pageItems = displayList.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    // Tooltip state for hover
    const [hoveredZpid, setHoveredZpid] = useState<string | null>(null);

    // ── Lead Capture Modal state ──
    const [leadModal, setLeadModal] = useState<{
        type: 'tour' | 'info';
        address: string;
        zpid?: string;
        price?: number;
    } | null>(null);

    // ── Save Search Modal state ──
    const [showSaveSearch, setShowSaveSearch] = useState(false);
    const [showSavedSearches, setShowSavedSearches] = useState(false);

    // ── Market Snapshot — computed from filtered list ──
    const snapshot = useMemo(() => {
        if (displayList.length === 0) return null;
        const prices = displayList.map(p => p.listPrice).filter(Boolean) as number[];
        const doms = displayList.map(p => getDaysOnMarket(p.listedDate, p.daysOnZillow)).filter(n => typeof n === 'number') as number[];
        const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
        const sorted = [...prices].sort((a, b) => a - b);
        const median = sorted.length ? (sorted.length % 2 === 0
            ? Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
            : sorted[Math.floor(sorted.length / 2)]) : null;
        const avgDom = doms.length ? Math.round(doms.reduce((a, b) => a + b, 0) / doms.length) : null;
        return { count: displayList.length, avg, median, avgDom };
    }, [displayList]);

    const fmtShort = (n: number) => {
        if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
        if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
        return `$${n}`;
    };

    // Get realtor ID from auth for lead capture
    const realtorId = auth.currentUser?.uid || '';

    // Current filter set for saved search
    const currentFilters = {
        minPrice: filterMinPrice,
        maxPrice: filterMaxPrice,
        beds: filterBeds,
        baths: filterBaths,
        homeType: filterHomeType,
        stories: filterStories,
        minSchoolRating: filterMinSchoolRating,
        neighborhood: filterNeighborhood,
        minSqft: filterMinSqft,
        maxSqft: filterMaxSqft,
        minYear: filterMinYear,
        maxYear: filterMaxYear,
        garage: filterGarage,
        maxHoa: filterMaxHoa,
        maxDom: filterMaxDom,
    };

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
        setPage(1);
    };

    const sortIcon = (field: typeof sortField) => {
        if (sortField !== field) return 'fa-sort opacity-20';
        return sortDir === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600';
    };

    const fmt = (n?: number) => n ? `$${n.toLocaleString()}` : '—';

    const handleBuyerSearch = async () => {
        if (!buyerStory.trim() || results.length === 0) return;
        setBuyerSearching(true);
        setBuyerResults(null);
        setBuyerError(null);
        setBuyerExtracted(null);
        setBuyerTimings(null);
        const timings: { step: string; ms: number; detail?: string }[] = [];

        try {
            // ── STEP 0: Extract structured attributes via Gemini Flash Lite ──
            const t0 = performance.now();
            const extractionPrompt = buildExtractionPrompt(buyerStory, buyerPersonaRef.current);

            type ExtResult = { price_min: number; price_max: number; beds: number; baths: number; home_type: string; stories: number; min_school_rating: number; must_haves: string[]; nice_to_haves: string[]; search_summary: string };
            const extractionSchema = {
                type: Type.OBJECT,
                properties: {
                    price_min: { type: Type.NUMBER },
                    price_max: { type: Type.NUMBER },
                    beds: { type: Type.NUMBER },
                    baths: { type: Type.NUMBER },
                    home_type: { type: Type.STRING },
                    stories: { type: Type.NUMBER },
                    min_school_rating: { type: Type.NUMBER },
                    must_haves: { type: Type.ARRAY, items: { type: Type.STRING } },
                    nice_to_haves: { type: Type.ARRAY, items: { type: Type.STRING } },
                    search_summary: { type: Type.STRING }
                },
                required: ['price_min', 'price_max', 'beds', 'baths', 'home_type', 'stories', 'min_school_rating', 'must_haves', 'nice_to_haves', 'search_summary']
            };

            const extractResult = await executeGeminiRequest<ExtResult>({
                model: FLASH_LITE_MODEL,
                contents: extractionPrompt,
                config: { temperature: 0.1, maxOutputTokens: 1024 },
                userId: auth.currentUser?.uid || 'anon',
                promptFilename: 'buyerStoryExtraction',
                extractResultJson: true,
                schema: extractionSchema,
                skipWatchdog: true
            });
            timings.push({ step: 'Gemini Extract', ms: Math.round(performance.now() - t0), detail: `model: ${FLASH_LITE_MODEL}` });

            const ext = extractResult.data;
            if (!ext || (ext.price_min === 0 && ext.price_max === 0)) {
                setBuyerError('Please mention a budget or price range in your story. For example: "Budget is $1.5M" or "Looking for homes up to $2M".');
                setBuyerSearching(false);
                return;
            }

            // Build final price range: -20% budget floor, +10% budget ceiling
            let priceMin = ext.price_min;
            let priceMax = ext.price_max;
            if (priceMin > 0 && priceMax > 0 && priceMin === priceMax) {
                priceMin = priceMin * 0.80;
                priceMax = priceMax * 1.10;
            } else if (priceMin > 0 && priceMax === 0) {
                priceMax = priceMin * 1.10;
            } else if (priceMax > 0 && priceMin === 0) {
                priceMin = priceMax * 0.80;
            }

            const extracted = {
                priceMin, priceMax,
                beds: ext.beds > 0 ? ext.beds : undefined,
                baths: ext.baths > 0 ? ext.baths : undefined,
                homeType: ext.home_type || undefined,
                stories: ext.stories > 0 ? ext.stories : undefined,
                minSchoolRating: ext.min_school_rating > 0 ? ext.min_school_rating : undefined,
                mustHaves: ext.must_haves || [],
                niceToHaves: ext.nice_to_haves || [],
                searchSummary: ext.search_summary || undefined
            };
            setBuyerExtracted(extracted);

            // Sync extracted values to UI filters
            if (priceMin > 0) setFilterMinPrice(String(Math.round(priceMin)));
            if (priceMax > 0) setFilterMaxPrice(String(Math.round(priceMax)));
            if (extracted.beds) setFilterBeds(String(extracted.beds));
            if (extracted.baths) setFilterBaths(String(extracted.baths));
            if (extracted.homeType) setFilterHomeType(extracted.homeType);
            if (extracted.stories) setFilterStories(String(extracted.stories));

            // ── STEP 1 & 2: Collate Candidates ──
            const t1 = performance.now();
            const cityForQuery = selectedCity || results[0]?.city || '';
            
            const graphMap = await queryContextGraphs({
                city: cityForQuery,
                priceMin: priceMin > 0 ? priceMin : undefined,
                priceMax: priceMax > 0 ? priceMax : undefined,
                minBeds: extracted.beds,
                maxResults: 40
            });

            // Standardize candidates (graphs vs visible results)
            const candidates = new Map<string, any>();
            
            // 1. Specialized graphs (high density insights)
            graphMap.forEach((g, zpid) => {
                const sid = String(zpid);
                candidates.set(sid, {
                    ...g, // Preserve all property fields (price, images, beds, etc.)
                    zpid: sid,
                    address: g.address || sid,
                    factors: g.factors || []
                });
            });

            // 2. Visible items (ensure something is always scored)
            results.slice(0, 30).forEach(p => {
                const sid = String(p.zpid);
                if (!candidates.has(sid)) {
                    candidates.set(sid, {
                        zpid: sid,
                        address: p.address,
                        factors: [
                            { name: 'Basic Info', tags: [`${fmt(p.price || 0)}`, `${p.bedrooms || 0}bd`, `${p.bathrooms || 0}ba`] },
                            { name: 'Home Type', tags: [p.homeType || 'Unknown'] }
                        ]
                    });
                }
            });

            if (candidates.size === 0) {
                setBuyerError(`No matching properties found in ${cityForQuery}.`);
                setBuyerSearching(false);
                return;
            }

            const graphsArr = Array.from(candidates.values()).slice(0, 40);
            timings.push({ step: 'Candidates Collected', ms: Math.round(performance.now() - t1) });
            setBuyerScoredCount(graphsArr.length);

            // Add candidate properties to the main results if missing
            // This ensures they are available in 'processed' for the UI to find
            setResults(prev => {
                const existingZpids = new Set(prev.map(p => String(p.zpid)));
                const toAdd: any[] = [];
                graphsArr.forEach(c => {
                    if (!existingZpids.has(String(c.zpid))) {
                        toAdd.push(c);
                    }
                });
                return [...prev, ...toAdd];
            });

            // ── STEP 3: Parallel Gemini Matching ──
            const t3 = performance.now();
            const CHUNK_SIZE = 10;
            const chunks = [];
            for (let i = 0; i < graphsArr.length; i += CHUNK_SIZE) chunks.push(graphsArr.slice(i, i + CHUNK_SIZE));

            const schema = {
                type: Type.OBJECT,
                properties: {
                    matches: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                zpid: { type: Type.STRING },
                                score: { type: Type.NUMBER },
                                match_writeup: { type: Type.STRING },
                            },
                            required: ['zpid', 'score', 'match_writeup']
                        }
                    }
                },
                required: ['matches']
            };

            const chunkPromises = chunks.map((chunk) => {
                const summaries = chunk.map(g => {
                    const factorStrings = (g.factors || []).map((f: any) => `${f.name || 'Feature'}: ${(f.tags || f.t || []).join(', ')}`);
                    return {
                        zpid: g.zpid,
                        address: g.address,
                        keyMetrics: {
                            price: g.detail?.price || g.detail?.list_price || 0,
                            beds: g.detail?.bedrooms || g.detail?.beds || 0,
                            baths: g.detail?.bathrooms || g.detail?.baths || 0,
                            sqft: g.detail?.livingAreaValue || g.detail?.sqft || 0
                        },
                        factors: factorStrings
                    };
                });

                const prompt = buildMatchingPrompt(buyerStory, extracted, summaries, buyerPersonaRef.current);
                return executeGeminiRequest<{ matches: { zpid: string; score: number; match_writeup: string }[] }>({
                    model: FLASH_MODEL,
                    contents: prompt,
                    config: { temperature: 0.3, maxOutputTokens: 4096 },
                    userId: auth.currentUser?.uid || 'anon',
                    promptFilename: 'buyerStorySearch',
                    extractResultJson: true,
                    schema,
                    skipWatchdog: true
                });
            });

            const chunkResults = await Promise.all(chunkPromises);

            const allMatches = chunkResults
                .flatMap(r => r.data?.matches || [])
                .map(m => {
                    const candidate = graphsArr.find(g => String(g.zpid) === String(m.zpid));
                    return { 
                        ...m, 
                        zpid: String(m.zpid),
                        matchWriteup: m.match_writeup || (m as any).matchWriteup,
                        factors: candidate?.factors || []
                    };
                })
                .filter(m => m.zpid && m.zpid !== 'undefined')
                .sort((a, b) => b.score - a.score);

            timings.push({ step: 'Gemini Scoring', ms: Math.round(performance.now() - t3), detail: `${allMatches.length} results` });
            setBuyerTimings(timings);

            if (allMatches.length > 0) {
                setBuyerResults(allMatches);
                setSliderIdx(0);
                if (viewMode !== 'zypheai') setViewModeLocal('zypheai');
            } else {
                setBuyerError("No strong AI matches found. Try refining your story.");
            }
        } catch (err: any) {
            console.error('[Buyer Search Error]', err);
            setBuyerError(`Search failed: ${err.message}`);
        } finally {
            setBuyerSearching(false);
        }
    };

    return (
        <div className="text-left">
            {/* Controls row + search bar */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Browse:</span>
                    {BROWSE_CITIES.map((c, i) => (
                        <span key={c} className="flex items-center gap-2">
                            {i > 0 && <span className="text-slate-300">|</span>}
                            <button
                                onClick={() => { 
                                    setPage(1); 
                                    setActivePath('browse'); 
                                    setShowMyStory(false); 
                                    setShowBuyerSearch(false);
                                    setViewModeLocal('gallery');
                                    setBuyerResults(null); 
                                    setBuyerExtracted(null); 
                                    handleBrowse(c); 
                                }}
                                disabled={browsing}
                                className={`text-sm font-bold transition-all ${browsing && selectedCity === c
                                    ? 'text-indigo-400 cursor-wait'
                                    : selectedCity === c && results.length > 0 && activePath === 'browse'
                                        ? 'text-indigo-700 underline underline-offset-4'
                                        : 'text-indigo-600 hover:text-indigo-800 hover:underline underline-offset-4'
                                    }`}
                            >
                                {browsing && selectedCity === c ? (
                                    <><i className="fa-solid fa-spinner animate-spin mr-1"></i>{c}</>
                                ) : c}
                            </button>
                        </span>
                    ))}

                    {/* Divider */}
                    <span className="text-slate-200 mx-1">|</span>

                    {/* My Story tab */}
                    <button
                        onClick={() => {
                            if (activePath === 'story' && !showMyStory) {
                                // Already in story mode, toggle the intake form
                                setShowMyStory(true);
                            } else if (activePath === 'story' && showMyStory) {
                                setShowMyStory(false);
                            } else {
                                // Switch to story mode
                                setActivePath('story');
                                setShowMyStory(true);
                            }
                        }}
                        className={`flex items-center gap-1.5 text-sm font-bold transition-all ${activePath === 'story'
                            ? 'text-indigo-700 underline underline-offset-4'
                            : 'text-indigo-500 hover:text-indigo-800 hover:underline underline-offset-4'
                            }`}
                    >
                        <i className="fa-solid fa-book-open-reader text-[11px]"></i>
                        My Story
                        {activePath === 'story' && selectedCity && !showMyStory && (
                            <span className="text-[9px] font-medium text-indigo-400 ml-0.5">({selectedCity})</span>
                        )}
                    </button>
                </div>
                {searchBar && (
                    <div className="flex-1 max-w-2xl">
                        {searchBar}
                    </div>
                )}
            </div>

            {/* My Story panel */}
            {showMyStory && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <StoryIntakeTab isRealtor={false} realtorId={realtorId} onStoryDiscover={handleStoryDiscover} />
                </div>
            )}

            {/* Results area - Hidden when intake form is open to prevent UI overlap */}
            {!showMyStory && (
                <>
                    {browsing && (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
                        </div>
                    )}

                    {!browsing && hasSearched && results.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 mt-6">
                            <i className="fa-solid fa-house-circle-xmark text-4xl text-slate-200 mb-3"></i>
                            <p className="text-sm font-bold text-slate-400">No properties found in {selectedCity}</p>
                        </div>
                    )}
                </>
            )}

            {!showMyStory && !browsing && results.length > 0 && (
                <div className="mt-6 space-y-3">

                    {/* ── MARKET SNAPSHOT BAR / STORY EDITOR ── */}
                    {snapshot && (
                        <div className="flex flex-wrap items-center gap-3 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100/80 rounded-2xl px-4 py-2">
                            {activePath === 'story' ? (
                                <div className="flex-1 flex items-center gap-3">
                                    <div className="flex items-center text-indigo-500">
                                        <i className="fa-solid fa-sparkles text-xs"></i>
                                    </div>
                                    <div className="flex-1 relative group">
                                        <textarea
                                            value={buyerStory}
                                            onChange={e => { setBuyerStory(e.target.value); setBuyerError(null); }}
                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleBuyerSearch(); } }}
                                            rows={4}
                                            className="w-full bg-white/60 hover:bg-white border border-indigo-100 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-all placeholder:text-slate-400 resize-none leading-tight"
                                            placeholder="Edit your story to refine results..."
                                        />
                                        <button 
                                            onClick={handleBuyerSearch}
                                            disabled={buyerSearching}
                                            className="absolute right-1 top-1.5 bottom-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[9px] font-black uppercase tracking-widest shadow-sm transition-opacity flex items-center gap-1 z-10"
                                        >
                                            {buyerSearching ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-arrows-rotate"></i>}
                                            Search
                                        </button>
                                        {/* Debug Indicator */}
                                        {buyerResults && (
                                            <div className="flex items-center gap-1.5 mt-1.5 mb-1 px-1">
                                                <span className="flex w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{buyerResults.length} Matched</span>
                                                <span className="text-[10px] text-slate-400 font-bold ml-1">— reasoning shown on cards below</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-1.5">
                                        <i className="fa-solid fa-house-circle-check text-indigo-400 text-xs"></i>
                                        <span className="text-[11px] font-black text-slate-700">{snapshot.count}</span>
                                        <span className="text-[10px] font-bold text-slate-400">Active</span>
                                    </div>
                                    <div className="w-px h-4 bg-slate-200"></div>
                                    {snapshot.avg && (
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-bold text-slate-400">Avg</span>
                                            <span className="text-[11px] font-black text-slate-700">{fmtShort(snapshot.avg)}</span>
                                        </div>
                                    )}
                                    {snapshot.median && (
                                        <>
                                            <div className="w-px h-4 bg-slate-200"></div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold text-slate-400">Median</span>
                                                <span className="text-[11px] font-black text-slate-700">{fmtShort(snapshot.median)}</span>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                            <div className="ml-auto flex items-center gap-2">
                                <button
                                    onClick={() => setShowSavedSearches(true)}
                                    className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-violet-600 bg-white border border-violet-200 hover:bg-violet-50 transition-all flex items-center gap-1"
                                >
                                    <i className="fa-solid fa-bell"></i> Saved
                                </button>
                                <button
                                    onClick={() => setShowSaveSearch(true)}
                                    className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-white bg-violet-600 hover:bg-violet-700 transition-all shadow-sm shadow-violet-200 flex items-center gap-1"
                                >
                                    <i className="fa-solid fa-bell-plus"></i> Save Search
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Row 1: View toggle */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex bg-slate-100 rounded-xl p-1">
                            <button
                                onClick={() => { trackViewModeChanged({ city: selectedCity, fromMode: viewMode, toMode: 'gallery', resultCount: displayList.length }); setViewModeLocal('gallery'); }}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'gallery' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <i className="fa-solid fa-grid-2 mr-1"></i> Gallery
                            </button>
                            {activePath === 'story' && buyerResults && (
                                <button
                                    onClick={() => { trackViewModeChanged({ city: selectedCity, fromMode: viewMode, toMode: 'zypheai', resultCount: displayList.length }); setViewModeLocal('zypheai'); }}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'zypheai' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <i className="fa-solid fa-sparkles mr-1"></i> Pro List
                                </button>
                            )}
                            <button
                                onClick={() => { trackViewModeChanged({ city: selectedCity, fromMode: viewMode, toMode: 'table', resultCount: displayList.length }); setViewModeLocal('table'); }}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <i className="fa-solid fa-table-list mr-1"></i> Table
                            </button>
                            <button
                                onClick={() => { trackViewModeChanged({ city: selectedCity, fromMode: viewMode, toMode: 'map', resultCount: displayList.length }); setViewModeLocal('map'); }}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <i className="fa-solid fa-map-location-dot mr-1"></i> Map
                            </button>
                        </div>
                    </div>

                    {/* Row 2: Filters, sort, count */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Sort By</label>
                            <select
                                value={`${sortField}-${sortDir}`}
                                onChange={e => {
                                    const [f, d] = e.target.value.split('-') as [typeof sortField, 'asc' | 'desc'];
                                    setSortField(f); setSortDir(d); setPage(1);
                                }}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none cursor-pointer"
                            >
                                <option value="address-asc">Address A→Z</option>
                                <option value="address-desc">Address Z→A</option>
                                <option value="listPrice-asc">Price Low→High</option>
                                <option value="listPrice-desc">Price High→Low</option>
                                <option value="bedrooms-desc">Beds Most→Least</option>
                                <option value="bathrooms-desc">Baths Most→Least</option>
                                <option value="livingArea-desc">Sqft Largest</option>
                                <option value="livingArea-asc">Sqft Smallest</option>
                                <option value="lotSize-desc">Lot Largest</option>
                                <option value="lotSize-asc">Lot Smallest</option>
                                <option value="homeType-asc">Type A→Z</option>
                                <option value="neighborhood-asc">Neighborhood A→Z</option>
                            </select>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Min $</label>
                            <input
                                type="number"
                                placeholder="..."
                                value={filterMinPrice}
                                onChange={e => { setFilterMinPrice(e.target.value); setPage(1); }}
                                className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none placeholder:text-slate-300"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Max $</label>
                            <input
                                type="number"
                                placeholder="..."
                                value={filterMaxPrice}
                                onChange={e => { setFilterMaxPrice(e.target.value); setPage(1); }}
                                className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none placeholder:text-slate-300"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Beds</label>
                            <select
                                value={filterBeds}
                                onChange={e => { setFilterBeds(e.target.value); setPage(1); }}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none cursor-pointer"
                            >
                                <option value="">Any</option>
                                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}+ bd</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Baths</label>
                            <select
                                value={filterBaths}
                                onChange={e => { setFilterBaths(e.target.value); setPage(1); }}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none cursor-pointer"
                            >
                                <option value="">Any</option>
                                {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}+ ba</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Type</label>
                            <select
                                value={filterHomeType}
                                onChange={e => { setFilterHomeType(e.target.value); setPage(1); }}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none cursor-pointer"
                            >
                                <option value="">Any</option>
                                <option value="SINGLE_FAMILY">Single Family</option>
                                <option value="TOWNHOUSE">Townhouse</option>
                                <option value="CONDO">Condo</option>
                                <option value="MULTI_FAMILY">Multi-Family</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Stories</label>
                            <select
                                value={filterStories}
                                onChange={e => { setFilterStories(e.target.value); setPage(1); }}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none cursor-pointer"
                            >
                                <option value="">Any</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Schools</label>
                            <select
                                value={filterMinSchoolRating}
                                onChange={e => { setFilterMinSchoolRating(e.target.value); setPage(1); }}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none cursor-pointer"
                            >
                                <option value="">Any</option>
                                <option value="5">5+</option>
                                <option value="6">6+</option>
                                <option value="7">7+</option>
                                <option value="8">8+</option>
                                <option value="9">9+</option>
                                <option value="10">10</option>
                            </select>
                        </div>
                        {availableNeighborhoods.length > 0 && (
                            <select
                                value={filterNeighborhood}
                                onChange={e => { setFilterNeighborhood(e.target.value); setPage(1); }}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none cursor-pointer max-w-[160px]"
                            >
                                <option value="">Neighborhood</option>
                                {availableNeighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        )}

                        {/* More Filters button */}
                        <button
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${advancedFilterCount > 0
                                ? 'bg-indigo-100 border border-indigo-300 text-indigo-700'
                                : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                                }`}
                        >
                            <i className="fa-solid fa-sliders text-[9px]"></i>
                            More Filters
                            {advancedFilterCount > 0 && (
                                <span className="bg-indigo-600 text-white text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center">{advancedFilterCount}</span>
                            )}
                        </button>

                        {/* Count */}
                        <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {displayList.length} {displayList.length === 1 ? 'property' : 'properties'}
                            {displayList.length !== results.length && ` (of ${results.length})`}
                        </span>


                    </div>

                    {/* ── ADVANCED FILTERS OVERLAY ── */}
                    {showAdvancedFilters && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-lg space-y-4 animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-sliders text-indigo-500"></i>
                                    <span className="text-sm font-black text-slate-700">Advanced Filters</span>
                                    {advancedFilterCount > 0 && (
                                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-md">{advancedFilterCount} active</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {advancedFilterCount > 0 && (
                                        <button onClick={clearAdvancedFilters} className="text-[10px] font-bold text-rose-500 hover:text-rose-700 transition-colors">
                                            <i className="fa-solid fa-xmark mr-1"></i>Clear All
                                        </button>
                                    )}
                                    <button onClick={() => setShowAdvancedFilters(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            </div>

                            {/* MLS Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Property Details</div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Garage</label>
                                            <select value={filterGarage} onChange={e => { setFilterGarage(e.target.value); setPage(1); }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 outline-none">
                                                <option value="">Any</option>
                                                <option value="1">1+ car</option>
                                                <option value="2">2+ car</option>
                                                <option value="3">3+ car</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Max HOA $/mo</label>
                                            <input value={filterMaxHoa} onChange={e => { setFilterMaxHoa(e.target.value); setPage(1); }} placeholder="e.g. 500" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 outline-none" />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Orientation & Vastu</div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Front Orientation</label>
                                            <select 
                                                value={filterOrientation} 
                                                onChange={e => { setFilterOrientation(e.target.value); setPage(1); }} 
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 outline-none"
                                            >
                                                <option value="">Any Direction</option>
                                                <option value="North">North</option>
                                                <option value="South">South</option>
                                                <option value="East">East (Vastu Friendly)</option>
                                                <option value="West">West</option>
                                                <option value="North-East">North-East</option>
                                                <option value="North-West">North-West</option>
                                                <option value="South-East">South-East</option>
                                                <option value="South-West">South-West</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Max Days on Market</label>
                                            <select value={filterMaxDom} onChange={e => { setFilterMaxDom(e.target.value); setPage(1); }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 outline-none">
                                                <option value="">Any</option>
                                                <option value="7">Under 1 week</option>
                                                <option value="14">Under 2 weeks</option>
                                                <option value="30">Under 30 days</option>
                                                <option value="60">Under 60 days</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Market Filters */}
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Market & Timing</div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Max Days on Market</label>
                                        <select value={filterMaxDom} onChange={e => { setFilterMaxDom(e.target.value); setPage(1); }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 outline-none">
                                            <option value="">Any</option>
                                            <option value="7">Under 1 week</option>
                                            <option value="14">Under 2 weeks</option>
                                            <option value="30">Under 30 days</option>
                                            <option value="60">Under 60 days</option>
                                            <option value="90">Under 90 days</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-1">
                                <button onClick={() => setShowAdvancedFilters(false)} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors">
                                    Apply Filters
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── BUYER STORY SEARCH PANEL (ZypheAI mode only) ── */}
                    {viewMode === 'zypheai' && showBuyerSearch && (
                        <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <i className="fa-solid fa-magnifying-glass-location text-indigo-500"></i>
                                <span className="text-sm font-black text-indigo-800">Tell Your Story</span>
                                <button
                                    onClick={() => setShowExamples(!showExamples)}
                                    className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors flex items-center gap-1"
                                >
                                    <i className={`fa-solid ${showExamples ? 'fa-chevron-up' : 'fa-lightbulb'} text-[9px]`}></i>
                                    {showExamples ? 'Hide' : 'Examples'}
                                </button>
                                <span className="text-[10px] font-bold text-indigo-400 ml-auto">AI extracts filters from your story · Max 20 properties</span>
                            </div>

                            {/* Examples Grid */}
                            {showExamples && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {BUYER_STORY_EXAMPLES.map((ex, i) => (
                                        <button
                                            key={i}
                                            onClick={() => { setBuyerStory(ex.story); setShowExamples(false); setBuyerError(null); }}
                                            className="text-left bg-white border border-indigo-100 hover:border-indigo-300 hover:shadow-md rounded-xl p-3 transition-all group"
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <i className={`${ex.icon} text-[10px] text-indigo-400 group-hover:text-indigo-600`}></i>
                                                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">{ex.title}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">{ex.story}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <textarea
                                value={buyerStory}
                                onChange={e => { setBuyerStory(e.target.value); setBuyerError(null); }}
                                placeholder="Example: I'm a tech worker at Google with 2 young kids. We need good schools, a home office, and a big backyard. Budget is $1.5M. Low wildfire risk is important."
                                className="w-full h-24 p-3 bg-white border border-indigo-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 outline-none resize-none"
                            />
                            <div className="flex items-center gap-3 flex-wrap">
                                <button
                                    onClick={handleBuyerSearch}
                                    disabled={buyerSearching || !buyerStory.trim() || results.length === 0}
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {buyerSearching ? (
                                        <><i className="fa-solid fa-spinner animate-spin"></i>Analyzing story &amp; matching...</>
                                    ) : (
                                        <><i className="fa-solid fa-wand-magic-sparkles"></i>Find My Match</>
                                    )}
                                </button>
                                {buyerResults && (
                                    <>
                                        <span className="text-xs font-bold text-indigo-600">{buyerResults.length} matches from {buyerScoredCount} scored — results sorted below</span>
                                        <button onClick={() => { setBuyerResults(null); setBuyerExtracted(null); }} className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors ml-1">
                                            <i className="fa-solid fa-xmark"></i> Clear
                                        </button>
                                    </>
                                )}
                            </div>

                            {/* Error */}
                            {buyerError && (
                                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
                                    <i className="fa-solid fa-circle-exclamation text-rose-500 mt-0.5"></i>
                                    <p className="text-xs font-bold text-rose-700">{buyerError}</p>
                                </div>
                            )}


                            {/* Extracted criteria — full breakdown */}
                            {buyerExtracted && !buyerError && (
                                <div className="bg-white border border-indigo-100 rounded-xl px-4 py-3 space-y-2.5">
                                    <div className="flex flex-col gap-3">
                                        {/* Original Narrative (Collapsible or truncated) */}
                                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-1.5 overflow-hidden">
                                                <i className="fa-solid fa-book-open text-slate-400 text-[10px]"></i>
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">Input Story</span>
                                            </div>
                                            <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic line-clamp-3">
                                                "{buyerStory}"
                                            </p>
                                        </div>

                                        {/* Search summary */}
                                        <div className="flex flex-col gap-1">
                                            <p className="text-xs text-slate-800 font-bold leading-relaxed">
                                                <i className="fa-solid fa-sparkles text-indigo-500 mr-2"></i>
                                                {buyerExtracted.searchSummary || `Searching for properties in the ${fmt(buyerExtracted.priceMin)}–${fmt(buyerExtracted.priceMax)} range.`}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Extracted filters */}
                                    <div className="flex flex-wrap gap-1.5">
                                        {buyerExtracted.priceMin > 0 && (
                                            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                                                💰 {fmt(buyerExtracted.priceMin)}–{fmt(buyerExtracted.priceMax)}
                                            </span>
                                        )}
                                        {buyerExtracted.beds && (
                                            <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                                                🛏 {buyerExtracted.beds}+ beds
                                            </span>
                                        )}
                                        {buyerExtracted.baths && (
                                            <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                                                🚿 {buyerExtracted.baths}+ baths
                                            </span>
                                        )}
                                        {buyerExtracted.homeType && (
                                            <span className="px-2 py-0.5 text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200 rounded-full">
                                                🏠 {buyerExtracted.homeType.replace(/_/g, ' ')}
                                            </span>
                                        )}
                                        {buyerExtracted.stories && (
                                            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                                                🏗 {buyerExtracted.stories} story
                                            </span>
                                        )}
                                        {buyerExtracted.minSchoolRating && (
                                            <span className="px-2 py-0.5 text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 rounded-full">
                                                🎓 Schools {buyerExtracted.minSchoolRating}+
                                            </span>
                                        )}
                                    </div>

                                    {/* Must-haves */}
                                    {buyerExtracted.mustHaves.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Must-Haves</p>
                                            <div className="flex flex-wrap gap-1">
                                                {buyerExtracted.mustHaves.map((mh, i) => (
                                                    <span key={i} className="px-2 py-0.5 text-[10px] bg-rose-50 text-rose-700 border border-rose-200 rounded-full">
                                                        {mh}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Nice-to-haves */}
                                    {buyerExtracted.niceToHaves.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Nice-to-Haves</p>
                                            <div className="flex flex-wrap gap-1">
                                                {buyerExtracted.niceToHaves.map((nth, i) => (
                                                    <span key={i} className={`px-2 py-0.5 text-[10px] rounded-full border ${nth.startsWith('[Inferred]')
                                                        ? 'bg-purple-50 text-purple-600 border-purple-200 italic'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200'
                                                        }`}>
                                                        {nth.startsWith('[Inferred]') ? '🤖 ' + nth.replace('[Inferred] ', '') : nth}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <BrowseResultsPanel
                        buyerTimings={buyerTimings}
                        buyerSearching={buyerSearching}
                        buyerResults={buyerResults}
                        buyerExtracted={buyerExtracted}
                        buyerError={buyerError}
                        showTimings={showTimings}
                        activePath={activePath}
                        pageItems={pageItems}
                        displayList={displayList}
                        totalPages={totalPages}
                        page={page}
                        setPage={setPage}
                        selectedCity={selectedCity}
                        viewMode={viewMode}
                        matchMap={matchMap}
                        cityGraphs={cityGraphs}
                        hoveredZpid={hoveredZpid}
                        setHoveredZpid={setHoveredZpid}
                        fmt={fmt}
                        expandFactor={expandFactor}
                        toggleSort={toggleSort}
                        sortIcon={sortIcon}
                        setBuyerResults={setBuyerResults}
                        setBuyerExtracted={setBuyerExtracted}
                        setSliderIdx={setSliderIdx}
                        setViewModeLocal={setViewModeLocal}
                        setShowBuyerSearch={setShowBuyerSearch}
                        onPropertyClick={onPropertyClick}
                        onLeadCapture={(type, address, zpid, price) => setLeadModal({ type, address, zpid, price })}
                    />
                </div>

            )}


            {/* ── LEAD CAPTURE MODAL ── */}
            {leadModal && (
                <LeadCaptureModal
                    type={leadModal.type}
                    propertyAddress={leadModal.address}
                    propertyZpid={leadModal.zpid}
                    propertyPrice={leadModal.price}
                    city={selectedCity}
                    realtorId={realtorId}
                    onClose={() => setLeadModal(null)}
                />
            )}

            {/* ── SAVE SEARCH MODAL ── */}
            {showSaveSearch && selectedCity && (
                <SaveSearchModal
                    city={selectedCity}
                    filters={currentFilters}
                    resultCount={displayList.length}
                    realtorId={realtorId}
                    onClose={() => setShowSaveSearch(false)}
                />
            )}

            {/* ── SAVED SEARCHES PANEL ── */}
            {showSavedSearches && (
                <SavedSearchesPanel
                    realtorId={realtorId}
                    onClose={() => setShowSavedSearches(false)}
                    onApply={(search: SavedSearch) => {
                        // Apply saved search filters
                        if (search.city) handleBrowse(search.city);
                        if (search.filters.minPrice) setFilterMinPrice(search.filters.minPrice);
                        if (search.filters.maxPrice) setFilterMaxPrice(search.filters.maxPrice);
                        if (search.filters.beds) setFilterBeds(search.filters.beds);
                        if (search.filters.baths) setFilterBaths(search.filters.baths);
                        if (search.filters.homeType) setFilterHomeType(search.filters.homeType);
                        if (search.filters.stories) setFilterStories(search.filters.stories);
                        if (search.filters.minSchoolRating) setFilterMinSchoolRating(search.filters.minSchoolRating);
                        if (search.filters.neighborhood) setFilterNeighborhood(search.filters.neighborhood);
                        if (search.filters.minSqft) setFilterMinSqft(search.filters.minSqft);
                        if (search.filters.maxSqft) setFilterMaxSqft(search.filters.maxSqft);
                        if (search.filters.garage) setFilterGarage(search.filters.garage);
                        if (search.filters.maxHoa) setFilterMaxHoa(search.filters.maxHoa);
                        if (search.filters.maxDom) setFilterMaxDom(search.filters.maxDom);
                        setPage(1);
                    }}
                />
            )}
        </div>
    );
};

export { BrowseHomeSection, BrowseByCitySection };
