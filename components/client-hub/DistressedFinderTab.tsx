import React, { useState, useRef, useEffect } from 'react';
import { doc, getDoc, setDoc, deleteField, Timestamp, collection, query, where, getDocs, documentId, writeBatch } from 'firebase/firestore';
import { db, auth } from '../../services/firebaseService';
import { getZipsForCity, getZipListings, saveZipMetadataBatch, getCachedCities, getZipSoldListings } from '../../services/firebase/cityData';
import { APP_CONFIG, SUPPORTED_STATES, STATE_NAME_MAP } from '../../config';
import { executeGeminiRequest, FLASH_MODEL } from '../../services/geminiService';
import { DISTRESS_PROMPT, DISTRESS_SCHEMA } from '../../prompts/property/distressAnalysis';
import PropertyCompsTab, { SaleComp } from './PropertyCompsTab';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DistressResult {
    zpid: string;
    address: string;
    city: string;
    state: string;
    cityKey: string;
    distressScore: number;
    primaryIndicators: string[];
    hiddenRisks: string;
    rawText: string;
    description?: string;
    propertyType?: string;
    mlsName?: string;
    fromCache?: boolean;
    isNew?: boolean;
    analyzedAt?: Date;
    error?: string;
    latitude?: number;
    longitude?: number;
    listPrice?: number;
    listingSubTypes?: string[];
    renovationStrategy?: string;
    estimatedArvPremium?: number;
    arvBreakdown?: { item: string; estimated_cost: number; value_add: number; roi_pct: number }[];
    bedrooms?: number;
    bathrooms?: number;
    livingArea?: number;
    lotAreaValue?: number;
    lotAreaUnit?: string;
}

type ScanStatus = 'idle' | 'fetching_zips' | 'fetching_listings' | 'analyzing' | 'done' | 'error';

/** Format listing sub-type keys like 'is_foreclosure' → 'Foreclosure' */
function subTypeLabel(key: string): string {
    const lower = key.toLowerCase();
    if (lower.includes('fsba')) return 'Sale By Agent';
    if (lower.includes('fsbo')) return 'Sale By Owner';
    const stripped = key.replace(/^is_/i, '');
    return stripped.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function scoreColor(score: number) {
    if (score >= 7) return { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', bar: 'bg-rose-500' };
    if (score >= 4) return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', bar: 'bg-amber-400' };
    return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', bar: 'bg-emerald-400' };
}

/** Normalize city input to Title Case so Firestore equality matches regardless of how user typed it. */
function toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface DistressedFinderTabProps {
    onNavigateToComps?: (address: string) => void;
    isAdmin?: boolean;
}

const DistressedFinderTab: React.FC<DistressedFinderTabProps> = ({ isAdmin }) => {
    const [compsAddress, setCompsAddress] = useState<{ address: string; zpid?: string; monthlyRate?: number; zestimate?: number; lat?: number; lng?: number; listPrice?: number; bedrooms?: number; bathrooms?: number; sqft?: number; yearBuilt?: number; homeType?: string; lotSize?: number } | null>(null);
    const [compsData, setCompsData] = useState<SaleComp[] | undefined>(undefined);
    const [city, setCity] = useState('Hayward');
    const [status, setStatus] = useState<ScanStatus>('idle');
    const [checkingNew, setCheckingNew] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [results, setResults] = useState<DistressResult[]>([]);
    const [searched, setSearched] = useState(false); // whether a search has been run
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [filterScore, setFilterScore] = useState(4); // default = Medium
    const [sortBy, setSortBy] = useState<'score' | 'address'>('score');
    const [priceMin, setPriceMin] = useState<number | ''>('');
    const [priceMax, setPriceMax] = useState<number | ''>('');
    const [filterPropertyTypes, setFilterPropertyTypes] = useState<Set<string>>(new Set());
    const [filterListingSubTypes, setFilterListingSubTypes] = useState<Set<string>>(new Set(['is_FSBA']));
    const [filterOnMLS, setFilterOnMLS] = useState<'all' | 'on' | 'off'>('all');
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);
    const [showSubTypeDropdown, setShowSubTypeDropdown] = useState(false);
    const [showMLSDropdown, setShowMLSDropdown] = useState(false);
    const [expandedDescZpid, setExpandedDescZpid] = useState<string | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [activeCityTab, setActiveCityTab] = useState<string | null>(null);
    const [lastSearchedCity, setLastSearchedCity] = useState('');
    const [availableCities, setAvailableCities] = useState<string[]>([]);
    const [cityQuery, setCityQuery] = useState('Hayward');
    const [cityFilter, setCityFilter] = useState(''); // separate filter text — cleared on focus
    const [showCitySuggestions, setShowCitySuggestions] = useState(false);
    const [refreshingZpid, setRefreshingZpid] = useState<string | null>(null);
    const PAGE_SIZE = 10;
    const logsEndRef = useRef<HTMLDivElement>(null);

    // On mount: fetch cities from city_zip_cache filtered to SUPPORTED_STATES
    useEffect(() => {
        getCachedCities(SUPPORTED_STATES)
            .then(setAvailableCities)
            .catch(e => console.warn('getCachedCities failed:', e));
    }, []);

    // Retry fetching cities on focus in case Firebase wasn't ready at mount
    const handleCityInputFocus = () => {
        setCityFilter('');   // clear filter so ALL cities appear on open
        setShowCitySuggestions(true);
        if (availableCities.length === 0) {
            getCachedCities(SUPPORTED_STATES)
                .then(setAvailableCities)
                .catch(e => console.warn('getCachedCities retry failed:', e));
        }
    };

    const addLog = (msg: string) => {
        console.log(`[DistressedFinder] ${msg}`);
        setLogs(prev => {
            const next = [...prev, `${new Date().toLocaleTimeString()} — ${msg}`];
            setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
            return next;
        });
    };

    const buildMlsText = (propData: any): string => {
        const parts: string[] = [];
        if (propData.address) parts.push(`Address: ${propData.address}`);
        if (propData.listPrice ?? propData.price) parts.push(`Price: $${(propData.listPrice ?? propData.price)?.toLocaleString()}`);
        if (propData.beds) parts.push(`Beds: ${propData.beds}`);
        if (propData.baths) parts.push(`Baths: ${propData.baths}`);
        if (propData.sqft) parts.push(`Sqft: ${propData.sqft}`);
        if (propData.yearBuilt) parts.push(`Year Built: ${propData.yearBuilt}`);
        if (propData.propertyType) parts.push(`Type: ${propData.propertyType}`);
        if (propData.status) parts.push(`Status: ${propData.status}`);
        if (propData.daysOnMarket != null) parts.push(`Days on Market: ${propData.daysOnMarket}`);
        if (propData.description) parts.push(`Description: ${propData.description}`);
        if (propData.remarks) parts.push(`Agent Remarks: ${propData.remarks}`);
        if (propData.publicRemarks) parts.push(`Public Remarks: ${propData.publicRemarks}`);
        if (propData.listingTerms) parts.push(`Listing Terms: ${propData.listingTerms}`);
        if (propData.specialConditions) parts.push(`Special Conditions: ${propData.specialConditions}`);
        if (propData.buyerAgentRemarks) parts.push(`Buyer Agent Remarks: ${propData.buyerAgentRemarks}`);
        return parts.join('\n') || 'No data available';
    };

    // ── Refresh single property ───────────────────────────────────────────────
    const handleRefreshSingle = async (r: DistressResult) => {
        setRefreshingZpid(r.zpid);
        addLog(`🔄 Re-analyzing: ${r.address}...`);
        try {
            const propSnap = await getDoc(doc(db, 'properties', r.zpid));
            if (!propSnap.exists()) {
                addLog(`⚠️ No property data found for ${r.address}`);
                setRefreshingZpid(null);
                return;
            }
            const propData = propSnap.data();
            const mlsText = buildMlsText(propData);
            const userId = auth?.currentUser?.uid || 'unknown';

            const { data: aiData } = await executeGeminiRequest<any>({
                model: FLASH_MODEL,
                contents: DISTRESS_PROMPT(mlsText),
                config: { temperature: 0.3 },
                userId,
                zpid: r.zpid,
                address: r.address,
                promptFilename: 'distressAnalysis.ts',
                extractResultJson: true,
                schema: DISTRESS_SCHEMA,
            });

            const coords = propData.coordinates;
            const latitude: number | undefined = coords?.latitude ?? r.latitude;
            const longitude: number | undefined = coords?.longitude ?? r.longitude;

            const cacheRef = doc(db, 'distress_analysis', r.zpid);
            await setDoc(cacheRef, {
                distress_score: aiData.distress_score ?? 0,
                primary_indicators: aiData.primary_indicators ?? [],
                hidden_risks: aiData.hidden_risks ?? '',
                ...(aiData.renovation_strategy && { renovation_strategy: aiData.renovation_strategy }),
                ...(aiData.estimated_arv_premium != null && { estimated_arv_premium: aiData.estimated_arv_premium }),
                ...(aiData.arv_breakdown && { arv_breakdown: aiData.arv_breakdown }),
                address: r.address,
                city: r.city,
                state: r.state,
                ...(latitude != null && { latitude }),
                ...(longitude != null && { longitude }),
                analyzed_at: Timestamp.now(),
            });

            setResults(prev => prev.map(item => item.zpid !== r.zpid ? item : {
                ...item,
                distressScore: aiData.distress_score ?? 0,
                primaryIndicators: aiData.primary_indicators ?? [],
                hiddenRisks: aiData.hidden_risks ?? '',
                renovationStrategy: aiData.renovation_strategy || undefined,
                estimatedArvPremium: aiData.estimated_arv_premium ?? undefined,
                arvBreakdown: aiData.arv_breakdown ?? undefined,
                analyzedAt: new Date(),
                isNew: false,
            }));
            addLog(`✅ Re-analysis complete for ${r.address}`);
        } catch (e: any) {
            addLog(`❌ Refresh failed for ${r.address}: ${e.message}`);
        } finally {
            setRefreshingZpid(null);
        }
    };

    // ── Mode 1: Load from cache (distress_analysis WHERE city == X) ──────────
    const handleSearch = async (cityOverride?: string) => {
        const trimmedCity = toTitleCase((cityOverride ?? city).trim());
        if (!trimmedCity) return;

        setStatus('fetching_listings');
        setLogs([]);
        setResults([]);
        setProgress(null);
        setSearched(true);
        setLastSearchedCity(trimmedCity);
        setActiveCityTab(null);
        setCurrentPage(1);
        addLog(`Checking distress_analysis cache for: ${trimmedCity}...`);

        try {
            // Query distress_analysis collection by city field
            const q = query(
                collection(db, 'distress_analysis'),
                where('city', '==', trimmedCity)
            );
            const snap = await getDocs(q);

            if (snap.empty) {
                addLog(`No cached results found for "${trimmedCity}". Click "Check for New" to run analysis.`);
                setStatus('done');
                return;
            }

            const loaded: DistressResult[] = snap.docs.map(d => {
                const data = d.data() as any;
                const rawAddress = data.address ?? d.id;
                const propCity = data.city ?? trimmedCity;
                const propState = data.state ?? '';
                return {
                    zpid: d.id,
                    address: rawAddress,
                    city: propCity,
                    state: propState,
                    cityKey: propState ? `${propCity}, ${propState}` : propCity,
                    distressScore: data.distress_score ?? 0,
                    primaryIndicators: data.primary_indicators ?? [],
                    hiddenRisks: data.hidden_risks ?? '',
                    rawText: '',
                    description: '',
                    fromCache: true,
                    analyzedAt: data.analyzed_at?.toDate?.() ?? undefined,
                    latitude: data.latitude ?? undefined,
                    longitude: data.longitude ?? undefined,
                    renovationStrategy: data.renovation_strategy || undefined,
                    estimatedArvPremium: data.estimated_arv_premium ?? undefined,
                    arvBreakdown: data.arv_breakdown ?? undefined,
                };
            }).filter(r => !r.state || SUPPORTED_STATES.includes(r.state));

            // ── Batch-enrich from properties collection (listPrice / propertyType / description)
            // Firestore 'in' query limit is 30 — chunk accordingly
            try {
                const zpids = loaded.map(r => r.zpid);
                const CHUNK = 30;
                const propMap = new Map<string, any>();
                for (let i = 0; i < zpids.length; i += CHUNK) {
                    const chunk = zpids.slice(i, i + CHUNK);
                    const propSnap = await getDocs(
                        query(collection(db, 'properties'), where(documentId(), 'in', chunk))
                    );
                    propSnap.docs.forEach(d => propMap.set(d.id, d.data()));
                }
                loaded.forEach(r => {
                    const pd = propMap.get(r.zpid);
                    if (!pd) return;
                    r.listPrice = pd.listPrice ?? pd.price ?? pd.list_price ?? undefined;
                    r.propertyType = pd.homeType ?? pd.propertyType ?? pd.property_type ?? undefined;
                    r.description = pd.description || pd.publicRemarks || pd.remarks || '';
                    r.mlsName = pd.attribution?.mlsName ?? undefined;
                });
            } catch { /* non-fatal — display without enrichment */ }

            // Enrich with specs from zip_listings_cache (bedrooms, bathrooms, livingArea, lot)
            try {
                // Resolve zips for this city so we can read zip_listings_cache
                const cachedGroups = await getZipsForCity(trimmedCity);
                const supportedUpper = SUPPORTED_STATES.map(s => s.toUpperCase());
                const cityZips: string[] = cachedGroups
                    ? Object.entries(cachedGroups)
                        .filter(([state]) => supportedUpper.includes(STATE_NAME_MAP[state.toLowerCase()] || state.toUpperCase()))
                        .flatMap(([, zips]) => zips)
                    : [];

                const zipListingsMap = new Map<string, any>();
                for (const zip of cityZips) {
                    const cache = await getZipListings(zip);
                    if (!cache?.listings?.length) continue;
                    for (const listing of cache.listings) {
                        const zpid = String(listing.zpid || listing.property_id || listing.listing_id || '');
                        if (zpid) zipListingsMap.set(zpid, listing);
                    }
                }
                loaded.forEach(r => {
                    const zl = zipListingsMap.get(r.zpid);
                    if (!zl) return;
                    r.bedrooms = zl.bedrooms ?? r.bedrooms ?? undefined;
                    r.bathrooms = zl.bathrooms ?? r.bathrooms ?? undefined;
                    r.livingArea = zl.livingArea ?? r.livingArea ?? undefined;
                    r.lotAreaValue = zl.lotAreaValue ?? r.lotAreaValue ?? undefined;
                    r.lotAreaUnit = zl.lotAreaUnit ?? r.lotAreaUnit ?? undefined;
                    // Also pick up listingSubType from zip cache if not already set
                    if (!r.listingSubTypes?.length) {
                        const lst: Record<string, unknown> = zl.listingSubType ?? {};
                        const truthy = Object.entries(lst).filter(([, v]) => v === true).map(([k]) => k);
                        if (truthy.length > 0) r.listingSubTypes = truthy;
                    }
                });
            } catch { /* non-fatal */ }

            loaded.sort((a, b) => b.distressScore - a.distressScore);
            setResults(loaded);
            addLog(`✅ Loaded ${loaded.length} cached results for "${trimmedCity}".`);
            setStatus('done');
        } catch (e: any) {
            addLog(`❌ Error: ${e.message}`);
            setStatus('error');
        }
    };

    // ── Mode 2: Check for New ─────────────────────────────────────────────────
    const handleCheckForNew = async () => {
        const trimmedCity = toTitleCase(lastSearchedCity || city.trim());
        if (!trimmedCity) return;
        setCheckingNew(true);
        setProgress(null);
        addLog(`--- Checking for new properties in ${trimmedCity} ---`);

        try {
            // Step A: resolve zips
            let targetZips: string[] = [];
            const isPostal = /^\d{5}(-\d{4})?$/.test(trimmedCity);
            if (isPostal) {
                targetZips = [trimmedCity];
            } else {
                const cachedGroups = await getZipsForCity(trimmedCity);
                if (cachedGroups) {
                    // zipsByState keys may be full names (e.g. "California") — resolve via STATE_NAME_MAP
                    const supportedUpper = SUPPORTED_STATES.map(s => s.toUpperCase());
                    targetZips = Object.entries(cachedGroups)
                        .filter(([state]) => {
                            const abbrev = STATE_NAME_MAP[state.toLowerCase()] || state.toUpperCase();
                            return supportedUpper.includes(abbrev);
                        })
                        .flatMap(([, zips]) => zips);
                }

                if (targetZips.length === 0) {
                    const zipConfig = APP_CONFIG.rapidapi.zipCodesApi;
                    addLog(`Resolving zip codes via API...`);
                    const resp = await fetch(
                        `https://${zipConfig.host}${zipConfig.path}?q=${encodeURIComponent(trimmedCity)}`,
                        { headers: { 'X-RapidAPI-Key': zipConfig.key, 'X-RapidAPI-Host': zipConfig.host } }
                    );
                    const zipResult = await resp.json();
                    let entries: { zip: string; city: string; state: string }[] = [];
                    if (Array.isArray(zipResult)) {
                        entries = zipResult.map((x: any) => ({
                            zip: x.zipCode || x.zip_code || '',
                            city: x.uspsMainCityName || x.city || trimmedCity,
                            state: x.stateCode || x.state || 'Unknown'
                        }));
                    }
                    entries = entries.filter(e => e.zip && SUPPORTED_STATES.includes(e.state));
                    targetZips = entries.map(e => e.zip);
                    if (entries.length > 0) {
                        await saveZipMetadataBatch(entries);
                        addLog(`Found ${targetZips.length} zip codes from API`);
                    }
                } else {
                    addLog(`Found ${targetZips.length} cached zip codes`);
                }
            }

            if (targetZips.length === 0) {
                addLog(`⚠️ No zip codes found for "${trimmedCity}".`);
                setCheckingNew(false);
                return;
            }

            // Step B: gather properties from zip listings (Firestore cached)
            const uniqueZips = [...new Set(targetZips)];
            addLog(`Scanning ${uniqueZips.length} zip codes for listings...`);

            // Collect all candidate zpids + their listing metadata from cache
            const candidateMap: Record<string, { address: string; city: string; state: string; bedrooms?: number; bathrooms?: number; livingArea?: number; lotAreaValue?: number; lotAreaUnit?: string; listingSubType?: Record<string, boolean> }> = {};
            for (const zip of uniqueZips) {
                const cache = await getZipListings(zip);
                if (!cache?.listings?.length) continue;
                for (const listing of cache.listings) {
                    const zpid = String(listing.zpid || listing.property_id || listing.listing_id || listing.mls_id || listing.mls?.id || '');
                    if (!zpid || candidateMap[zpid]) continue;
                    candidateMap[zpid] = {
                        address: listing.location?.address?.line || listing.address || zpid,
                        city: listing.location?.address?.city || trimmedCity,
                        state: listing.location?.address?.state_code || '',
                        bedrooms: listing.bedrooms ?? undefined,
                        bathrooms: listing.bathrooms ?? undefined,
                        livingArea: listing.livingArea ?? undefined,
                        lotAreaValue: listing.lotAreaValue ?? undefined,
                        lotAreaUnit: listing.lotAreaUnit ?? undefined,
                        listingSubType: listing.listingSubType ?? undefined,
                    };
                }
            }

            const allCandidateZpids = Object.keys(candidateMap);
            addLog(`Found ${allCandidateZpids.length} unique listings across ${uniqueZips.length} zips. Checking which are ingested...`);

            // Batch-fetch properties documents in chunks of 30 (Firestore 'in' limit)
            const CHUNK = 30;
            const propertiesWithData: { zpid: string; address: string; city: string; state: string; data: any }[] = [];
            const existingZpids = new Set(results.map(r => r.zpid));

            for (let i = 0; i < allCandidateZpids.length; i += CHUNK) {
                const chunk = allCandidateZpids.slice(i, i + CHUNK);
                const q = query(collection(db, 'properties'), where(documentId(), 'in', chunk));
                const snap = await getDocs(q);
                snap.forEach(docSnap => {
                    const zpid = docSnap.id;
                    const propData = docSnap.data();
                    const meta = candidateMap[zpid];
                    propertiesWithData.push({
                        zpid,
                        address: propData.address || meta.address,
                        city: propData.city || meta.city,
                        state: propData.state || meta.state,
                        data: propData,
                    });
                });
            }

            addLog(`Found ${propertiesWithData.length} properties total. Checking which are new...`);

            // ── Deprecation sweep ────────────────────────────────────────────
            // Any distress_analysis entry for this city that is no longer in the
            // active zip listings cache gets moved to deprecated_distressed_properties.
            const activeZpids = new Set(propertiesWithData.map(p => p.zpid));

            const distressQuery = query(
                collection(db, 'distress_analysis'),
                where('city', '==', trimmedCity)
            );
            const distressSnap = await getDocs(distressQuery);

            const deprecationBatch = writeBatch(db);
            let deprecatedCount = 0; // hoisted so final log can reference it

            for (const distressDoc of distressSnap.docs) {
                const zpid = distressDoc.id;
                if (!activeZpids.has(zpid)) {
                    const deprecatedRef = doc(db, 'deprecated_distressed_properties', zpid);
                    deprecationBatch.set(deprecatedRef, {
                        ...distressDoc.data(),
                        deprecated_at: Timestamp.now(),
                        original_zpid: zpid,
                    });
                    deprecationBatch.delete(distressDoc.ref);
                    deprecatedCount++;
                    addLog(`  ↩ Deprecated: ${distressDoc.data().address || zpid}`);
                }
            }

            if (deprecatedCount > 0) {
                await deprecationBatch.commit();
                addLog(`Deprecated ${deprecatedCount} stale propert${deprecatedCount === 1 ? 'y' : 'ies'} no longer in listings cache.`);
                setResults(prev => prev.filter(r => activeZpids.has(r.zpid)));
            } else {
                addLog(`No stale properties to deprecate.`);
            }
            // ────────────────────────────────────────────────────────────────

            // Step C: find those NOT already in distress_analysis
            const newProperties: typeof propertiesWithData = [];
            for (const prop of propertiesWithData) {
                if (existingZpids.has(prop.zpid)) continue;
                const cacheRef = doc(db, 'distress_analysis', prop.zpid);
                const cacheSnap = await getDoc(cacheRef);
                if (cacheSnap.exists()) {
                    // Already cached but not in current results — add it silently
                    existingZpids.add(prop.zpid);
                } else {
                    newProperties.push(prop);
                }
            }

            if (newProperties.length === 0) {
                addLog(`✅ No new properties found — all ${propertiesWithData.length} are already analyzed.`);
                setCheckingNew(false);
                return;
            }

            addLog(`Found ${newProperties.length} new properties. Running AI analysis...`);
            const userId = auth?.currentUser?.uid || 'unknown';
            const newResults: DistressResult[] = [];
            setProgress({ done: 0, total: newProperties.length });

            const CONCURRENCY = 3;
            for (let i = 0; i < newProperties.length; i += CONCURRENCY) {
                const batch = newProperties.slice(i, i + CONCURRENCY);
                await Promise.allSettled(batch.map(async ({ zpid, address, city: propCity, state: propState, data }) => {
                    const mlsText = buildMlsText(data);
                    const cacheRef = doc(db, 'distress_analysis', zpid);
                    addLog(`  Analyzing: ${address}`);
                    try {
                        const { data: aiData } = await executeGeminiRequest<any>({
                            model: FLASH_MODEL,
                            contents: DISTRESS_PROMPT(mlsText),
                            config: { temperature: 0.3 },
                            userId,
                            zpid,
                            address,
                            promptFilename: 'distressedFinder.ts',
                            extractResultJson: true,
                            schema: DISTRESS_SCHEMA,
                        });

                        // Extract subject lat/lng from the properties document
                        const coords = data.coordinates;
                        const latitude: number | undefined = coords?.latitude ?? undefined;
                        const longitude: number | undefined = coords?.longitude ?? undefined;

                        await setDoc(cacheRef, {
                            distress_score: aiData.distress_score ?? 0,
                            primary_indicators: aiData.primary_indicators ?? [],
                            hidden_risks: aiData.hidden_risks ?? '',
                            ...(aiData.renovation_strategy && { renovation_strategy: aiData.renovation_strategy }),
                            ...(aiData.estimated_arv_premium != null && { estimated_arv_premium: aiData.estimated_arv_premium }),
                            ...(aiData.arv_breakdown && { arv_breakdown: aiData.arv_breakdown }),
                            address,
                            city: propCity,
                            state: propState,
                            ...(latitude != null && { latitude }),
                            ...(longitude != null && { longitude }),
                            analyzed_at: Timestamp.now(),
                        });

                        const candidateMeta = candidateMap[zpid];

                        newResults.push({
                            zpid, address, city: propCity, state: propState,
                            cityKey: propState ? `${propCity}, ${propState}` : propCity,
                            distressScore: aiData.distress_score ?? 0,
                            primaryIndicators: aiData.primary_indicators ?? [],
                            hiddenRisks: aiData.hidden_risks ?? '',
                            renovationStrategy: aiData.renovation_strategy || undefined,
                            estimatedArvPremium: aiData.estimated_arv_premium ?? undefined,
                            arvBreakdown: aiData.arv_breakdown ?? undefined,
                            description: data.description || data.publicRemarks || data.remarks || '',
                            propertyType: data.homeType ?? data.propertyType ?? data.property_type ?? undefined,
                            mlsName: data.attribution?.mlsName ?? undefined,
                            rawText: mlsText,
                            fromCache: false,
                            isNew: true,
                            analyzedAt: new Date(),
                            latitude,
                            longitude,
                            listPrice: data.listPrice ?? data.price ?? data.list_price ?? undefined,
                            bedrooms: candidateMeta?.bedrooms,
                            bathrooms: candidateMeta?.bathrooms,
                            livingArea: candidateMeta?.livingArea,
                            lotAreaValue: candidateMeta?.lotAreaValue,
                            lotAreaUnit: candidateMeta?.lotAreaUnit,
                            listingSubTypes: (() => {
                                const lst = candidateMeta?.listingSubType;
                                if (!lst) return undefined;
                                return Object.entries(lst).filter(([, v]) => v === true).map(([k]) => k);
                            })(),
                        });
                    } catch (e: any) {
                        addLog(`  ⚠️ AI failed for ${address}: ${e.message}`);
                        newResults.push({
                            zpid, address, city: propCity, state: propState,
                            cityKey: propState ? `${propCity}, ${propState}` : propCity,
                            distressScore: 0, primaryIndicators: [],
                            hiddenRisks: '',
                            rawText: mlsText, isNew: true, error: e.message
                        });
                    }
                    setProgress(p => p ? { ...p, done: p.done + 1 } : null);
                }));
                if (i + CONCURRENCY < newProperties.length) {
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            // Merge new results into existing, new ones at top
            setResults(prev => {
                const merged = [...newResults, ...prev];
                return merged;
            });
            const deprecatedSuffix = deprecatedCount > 0 ? `, ${deprecatedCount} deprecated` : '';
            addLog(`✅ Done. ${newResults.length} new properties analyzed${deprecatedSuffix}.`);
            setProgress(null);
        } catch (e: any) {
            addLog(`❌ Error: ${e.message}`);
        } finally {
            setCheckingNew(false);
        }
    };

    // ── Derived display — group by City, State ───────────────────────────────────

    // Build a "City, State" key for each result
    const cityStateTabs = Array.from(new Set(results.map(r => {
        const c = r.city || 'Unknown';
        const s = r.state || '';
        return s ? `${c}, ${s}` : c;
    })))
        .map(key => ({
            key, count: results.filter(r => {
                const c = r.city || 'Unknown';
                const s = r.state || '';
                return (s ? `${c}, ${s}` : c) === key;
            }).length
        }))
        .sort((a, b) => b.count - a.count);

    const resolvedCityStateTab = activeCityTab && cityStateTabs.some(t => t.key === activeCityTab)
        ? activeCityTab
        : cityStateTabs[0]?.key ?? null;

    const filtered = results
        .filter(r => {
            const c = r.city || 'Unknown';
            const s = r.state || '';
            return (s ? `${c}, ${s}` : c) === resolvedCityStateTab;
        })
        .filter(r => r.distressScore >= filterScore)
        .filter(r => priceMin === '' || (r.listPrice != null && r.listPrice >= priceMin))
        .filter(r => priceMax === '' || (r.listPrice != null && r.listPrice <= priceMax))
        .filter(r => filterPropertyTypes.size === 0 || (r.propertyType != null && filterPropertyTypes.has(r.propertyType)))
        .filter(r => filterListingSubTypes.size === 0 || (r.listingSubTypes ?? []).some(s => filterListingSubTypes.has(s)))
        .filter(r => {
            if (filterOnMLS === 'on') return !!r.mlsName;
            if (filterOnMLS === 'off') return !r.mlsName;
            return true;
        })
        .sort((a, b) => {
            if (a.isNew && !b.isNew) return -1;
            if (!a.isNew && b.isNew) return 1;
            return sortBy === 'score' ? b.distressScore - a.distressScore : a.address.localeCompare(b.address);
        });

    // Unique property types from ALL results in active city tab (not just filtered)
    const availablePropertyTypes = Array.from(new Set(
        results
            .filter(r => {
                const c = r.city || 'Unknown';
                const s = r.state || '';
                return (s ? `${c}, ${s}` : c) === resolvedCityStateTab;
            })
            .map(r => r.propertyType)
            .filter((t): t is string => !!t)
    )).sort();

    // Unique listing sub-types from ALL results in active city tab
    const availableListingSubTypes: string[] = Array.from(new Set<string>(
        results
            .filter(r => {
                const c = r.city || 'Unknown';
                const s = r.state || '';
                return (s ? `${c}, ${s}` : c) === resolvedCityStateTab;
            })
            .flatMap(r => r.listingSubTypes ?? [])
            .filter((t): t is string => typeof t === 'string')
    )).sort();

    // Human-readable label for subtype keys
    const subTypeLabel = (key: string) =>
        key.replace(/^is_/, '').replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const highDistress = results.filter(r => r.distressScore >= 7).length;
    const medDistress = results.filter(r => r.distressScore >= 4 && r.distressScore < 7).length;
    const newCount = results.filter(r => r.isNew).length;
    const isRunning = status !== 'idle' && status !== 'done' && status !== 'error';

    return (
        <div className="max-w-7xl mx-auto py-12 px-6 space-y-8 animate-in fade-in duration-500">

            {/* ── Inline Comps view ─────────────────────────────────── */}
            {compsAddress && (
                <div className="animate-in fade-in duration-300">
                    <PropertyCompsTab
                        initialAddress={compsAddress.address}
                        onBack={() => { setCompsAddress(null); setCompsData(undefined); }}
                        onRefresh={async () => {
                            const zpid = compsAddress.zpid;
                            console.log('[Comps Refresh] clicked, zpid:', zpid);
                            if (!zpid) { console.log('[Comps Refresh] no zpid, aborting'); return; }
                            // Delete existing comps from distress_analysis
                            const cacheRef = doc(db, 'distress_analysis', zpid);
                            console.log('[Comps Refresh] deleting comps fields from distress_analysis/', zpid);
                            await setDoc(cacheRef, { comps: deleteField(), compsMonthlyRate: deleteField(), compsBestTier: deleteField() }, { merge: true });
                            console.log('[Comps Refresh] deleted successfully');
                            // Reset and re-trigger
                            setCompsAddress(null);
                            setCompsData(undefined);
                            setTimeout(() => {
                                const btn = document.querySelector(`[data-comps-zpid="${zpid}"]`) as HTMLButtonElement;
                                console.log('[Comps Refresh] looking for button, found:', !!btn);
                                if (btn) btn.click();
                            }, 300);
                        }}
                        subjectZpid={compsAddress.zpid}
                        subjectLat={compsAddress.lat}
                        subjectLng={compsAddress.lng}
                        subjectListPrice={compsAddress.listPrice}
                        subjectBedrooms={compsAddress.bedrooms}
                        subjectBathrooms={compsAddress.bathrooms}
                        subjectSqft={compsAddress.sqft}
                        subjectYearBuilt={compsAddress.yearBuilt}
                        subjectHomeType={compsAddress.homeType}
                        subjectLotSize={compsAddress.lotSize}
                        preloadedComps={compsData}
                        monthlyRate={compsAddress.monthlyRate}
                        subjectZestimate={compsAddress.zestimate}
                    />
                </div>
            )}

            {/* Hide main content while comps view is open */}
            {compsAddress ? null : <>

                {/* ── Title + Search row ──────────────────────────────── */}
                <div className="flex items-center gap-4 flex-wrap">
                    {/* Icon + title */}
                    <div className="flex items-center gap-3 shrink-0">
                        <span className="w-10 h-10 bg-rose-100 rounded-2xl flex items-center justify-center">
                            <i className="fa-solid fa-house-crack text-rose-600 text-sm" />
                        </span>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 whitespace-nowrap">Find Distressed Properties</h2>
                            <p className="text-[10px] text-slate-400 font-medium">AI-generated suggestions — verify independently before making investment decisions.</p>
                        </div>
                    </div>

                    {/* City autocomplete + buttons */}
                    <div className="flex gap-3 flex-1 min-w-0">
                        {/* Autocomplete city input */}
                        <div className="relative flex-1 min-w-0">
                            <i className="fa-solid fa-house-laptop absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                value={cityQuery}
                                onChange={e => {
                                    setCityQuery(e.target.value);
                                    setCityFilter(e.target.value);
                                    setShowCitySuggestions(true);
                                }}
                                onFocus={handleCityInputFocus}
                                onBlur={() => setTimeout(() => setShowCitySuggestions(false), 150)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && cityQuery.trim()) {
                                        setShowCitySuggestions(false);
                                        setCity(cityQuery.trim());
                                        handleSearch(cityQuery.trim());
                                    }
                                    if (e.key === 'Escape') setShowCitySuggestions(false);
                                }}
                                placeholder="Enter city…"
                                disabled={true}
                                className="w-full pl-12 pr-4 py-3 bg-slate-200 border-2 border-transparent rounded-2xl outline-none shadow-inner text-xs font-medium text-slate-500 cursor-not-allowed"
                            />
                            {/* Suggestions dropdown */}
                            {showCitySuggestions && availableCities.length > 0 && (
                                <div onMouseDown={(e) => e.preventDefault()} className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                                    <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cities — {SUPPORTED_STATES.join(', ')}</span>
                                        <span className="text-[10px] text-slate-300 font-medium">{availableCities.filter(c => !cityFilter || c.toLowerCase().includes(cityFilter.toLowerCase())).length} results</span>
                                    </div>
                                    <div className="max-h-[220px] overflow-y-auto p-1.5">
                                        {availableCities
                                            .filter(c => !cityFilter || c.toLowerCase().includes(cityFilter.toLowerCase()))
                                            .map(c => (
                                                <button
                                                    key={c}
                                                    onMouseDown={() => {
                                                        setCityQuery(c);
                                                        setCityFilter(c);
                                                        setCity(c);
                                                        setShowCitySuggestions(false);
                                                        handleSearch(c);
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-rose-50 text-slate-700 text-xs font-medium transition-colors flex items-center gap-3 group"
                                                >
                                                    <i className="fa-solid fa-location-dot text-slate-300 group-hover:text-rose-400 transition-colors text-[11px]" />
                                                    {c}
                                                </button>
                                            ))
                                        }
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Load Cached */}
                        <button
                            onClick={() => handleSearch()}
                            disabled={!city.trim() || isRunning || checkingNew}
                            className="px-8 py-3 bg-gradient-to-r from-rose-600 to-orange-500 text-white rounded-2xl font-black text-[12px] uppercase tracking-widest shadow-lg shadow-rose-200 hover:scale-[1.03] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2.5 shrink-0"
                        >
                            {isRunning ? (
                                <><i className="fa-solid fa-spinner animate-spin text-xs" /> Loading…</>
                            ) : (
                                <><i className="fa-solid fa-rocket text-xs" /> Go !!</>
                            )}
                        </button>

                        {/* Check for New */}
                        {searched && (
                            <button
                                onClick={handleCheckForNew}
                                disabled={checkingNew || isRunning}
                                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-black text-[12px] uppercase tracking-widest shadow-lg shadow-indigo-200 hover:scale-[1.03] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2.5 shrink-0"
                            >
                                {checkingNew ? (
                                    <><i className="fa-solid fa-spinner animate-spin text-xs" /> Scanning…</>
                                ) : (
                                    <><i className="fa-solid fa-radar text-xs" /> Check for New</>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress bar */}
                {progress && checkingNew && (
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">AI Analysis — New Properties</span>
                            <span className="text-[11px] font-mono text-slate-400">{progress.done} / {progress.total}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-violet-400 rounded-full transition-all duration-500"
                                style={{ width: `${(progress.done / progress.total) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {searched && results.length === 0 && status === 'done' && !isRunning && !checkingNew && (
                    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm py-16 text-center">
                        <i className="fa-solid fa-house-circle-xmark text-4xl text-slate-100 mb-4 block" />
                        <p className="text-sm font-black text-slate-400">No cached analysis found for <span className="text-slate-700">"{lastSearchedCity}"</span></p>
                        <p className="text-[11px] text-slate-300 font-medium mt-2">Click <strong className="text-indigo-500">Check for New</strong> above to scan listings and run AI analysis.</p>
                    </div>
                )}


                {/* Results */}
                {results.length > 0 && (
                    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">

                        {/* Filter bar — single row */}
                        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Filters</span>

                                {/* Distress score */}
                                <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5 shrink-0">
                                    {([{ score: 4, label: 'Medium' }, { score: 7, label: 'High' }, { score: 1, label: 'All' }] as { score: number; label: string }[]).map(({ score, label }) => (
                                        <button
                                            key={score}
                                            onClick={() => { setFilterScore(score); setCurrentPage(1); }}
                                            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${filterScore === score ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                {/* Price range */}
                                <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Price</span>
                                    <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">$</span>
                                        <input
                                            type="number"
                                            placeholder="Min"
                                            value={priceMin}
                                            onChange={e => { setPriceMin(e.target.value === '' ? '' : Number(e.target.value)); setCurrentPage(1); }}
                                            className="pl-4 pr-2 py-1 w-20 text-[11px] font-bold bg-slate-100 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                        />
                                    </div>
                                    <span className="text-[10px] text-slate-300 font-bold">–</span>
                                    <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">$</span>
                                        <input
                                            type="number"
                                            placeholder="Max"
                                            value={priceMax}
                                            onChange={e => { setPriceMax(e.target.value === '' ? '' : Number(e.target.value)); setCurrentPage(1); }}
                                            className="pl-4 pr-2 py-1 w-20 text-[11px] font-bold bg-slate-100 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                        />
                                    </div>
                                </div>

                                {/* Home Type dropdown */}
                                {availablePropertyTypes.length > 0 && (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Home Type</span>
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowTypeDropdown(p => !p)}
                                                onBlur={() => setTimeout(() => setShowTypeDropdown(false), 150)}
                                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-all ${filterPropertyTypes.size > 0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}
                                            >
                                                {filterPropertyTypes.size > 0 ? Array.from(filterPropertyTypes).join(', ') : 'All'}
                                                <i className={`fa-solid fa-chevron-${showTypeDropdown ? 'up' : 'down'} text-[9px]`} />
                                            </button>
                                            {showTypeDropdown && (
                                                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 min-w-[160px] py-1 overflow-hidden">
                                                    <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer group border-b border-slate-100">
                                                        <input type="checkbox" checked={filterPropertyTypes.size === 0} onChange={() => { setFilterPropertyTypes(new Set()); setCurrentPage(1); }} className="accent-indigo-600 w-3.5 h-3.5" />
                                                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide">All</span>
                                                    </label>
                                                    {availablePropertyTypes.map(t => (
                                                        <label key={t} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer group">
                                                            <input
                                                                type="checkbox"
                                                                checked={filterPropertyTypes.has(t)}
                                                                onChange={() => { setFilterPropertyTypes(prev => { const next = new Set(prev); if (next.has(t)) next.delete(t); else next.add(t); return next; }); setCurrentPage(1); }}
                                                                className="accent-indigo-600 w-3.5 h-3.5"
                                                            />
                                                            <span className="text-[11px] font-semibold text-slate-700 group-hover:text-slate-900">{t}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* MLS dropdown */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MLS</span>
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowMLSDropdown(p => !p)}
                                            onBlur={() => setTimeout(() => setShowMLSDropdown(false), 150)}
                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-all ${filterOnMLS !== 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}
                                        >
                                            {filterOnMLS === 'all' ? 'All' : filterOnMLS === 'on' ? 'On MLS' : 'Off MLS'}
                                            <i className={`fa-solid fa-chevron-${showMLSDropdown ? 'up' : 'down'} text-[9px]`} />
                                        </button>
                                        {showMLSDropdown && (
                                            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 min-w-[120px] py-1 overflow-hidden">
                                                {([{ val: 'all', label: 'All' }, { val: 'on', label: 'On MLS' }, { val: 'off', label: 'Off MLS' }] as { val: 'all' | 'on' | 'off'; label: string }[]).map(({ val, label }) => (
                                                    <button
                                                        key={val}
                                                        onMouseDown={() => { setFilterOnMLS(val); setShowMLSDropdown(false); setCurrentPage(1); }}
                                                        className={`w-full text-left px-3 py-2 text-[11px] font-semibold hover:bg-slate-50 transition-colors ${filterOnMLS === val ? 'text-indigo-600 font-black' : 'text-slate-700'}`}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Listing Type dropdown */}
                                {availableListingSubTypes.length > 0 && (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Listing Type</span>
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowSubTypeDropdown(p => !p)}
                                                onBlur={() => setTimeout(() => setShowSubTypeDropdown(false), 150)}
                                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-all ${filterListingSubTypes.size > 0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}
                                            >
                                                {filterListingSubTypes.size > 0 ? Array.from(filterListingSubTypes).map(s => subTypeLabel(String(s))).join(', ') : 'All'}
                                                <i className={`fa-solid fa-chevron-${showSubTypeDropdown ? 'up' : 'down'} text-[9px]`} />
                                            </button>
                                            {showSubTypeDropdown && (
                                                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 min-w-[170px] py-1 overflow-hidden">
                                                    <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer group border-b border-slate-100">
                                                        <input type="checkbox" checked={filterListingSubTypes.size === 0} onChange={() => { setFilterListingSubTypes(new Set()); setCurrentPage(1); }} className="accent-indigo-600 w-3.5 h-3.5" />
                                                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide">All</span>
                                                    </label>
                                                    {availableListingSubTypes.map(key => (
                                                        <label key={key} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer group">
                                                            <input
                                                                type="checkbox"
                                                                checked={filterListingSubTypes.has(key)}
                                                                onChange={() => { setFilterListingSubTypes(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; }); setCurrentPage(1); }}
                                                                className="accent-indigo-600 w-3.5 h-3.5"
                                                            />
                                                            <span className="text-[11px] font-semibold text-slate-700 group-hover:text-slate-900 capitalize">{subTypeLabel(key)}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Reset filters to defaults */}
                                {(priceMin !== '' || priceMax !== '' || filterPropertyTypes.size > 0 || !(filterListingSubTypes.size === 1 && filterListingSubTypes.has('is_FSBA')) || filterOnMLS !== 'all') && (
                                    <button
                                        onClick={() => { setPriceMin(''); setPriceMax(''); setFilterPropertyTypes(new Set()); setFilterListingSubTypes(new Set(['is_FSBA'])); setFilterOnMLS('all'); setCurrentPage(1); }}
                                        className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-wide transition-colors shrink-0"
                                    >
                                        <i className="fa-solid fa-arrow-rotate-left" />Reset Filters
                                    </button>
                                )}
                            </div>
                        </div>


                        {/* Cards */}
                        <div className="divide-y divide-slate-100">
                            {paginated.map(r => {
                                const colors = scoreColor(r.distressScore);
                                return (
                                    <div
                                        key={r.zpid}
                                        className={`relative p-6 hover:bg-slate-50/40 transition-colors ${r.isNew ? 'bg-indigo-50/30' : ''}`}
                                    >
                                        <div className="flex items-start gap-5">
                                            {/* Score ring */}
                                            <div className={`flex-shrink-0 w-16 h-16 rounded-2xl border-2 ${colors.bg} ${colors.border} flex flex-col items-center justify-center`}>
                                                <span className={`text-2xl font-black ${colors.text}`}>{r.distressScore}</span>
                                                <span className={`text-[9px] font-black uppercase tracking-wide opacity-60 ${colors.text}`}>/10</span>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        {/* Title row: address · price · New · Comps */}
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <a
                                                                href={`https://www.zillow.com/homes/${r.zpid}_zpid/`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-sm font-black text-slate-900 leading-tight hover:text-indigo-600 hover:underline transition-colors"
                                                            >{r.address}</a>
                                                            <button
                                                                onClick={() => handleRefreshSingle(r)}
                                                                disabled={refreshingZpid != null}
                                                                title="Re-run distress analysis"
                                                                className={`flex items-center justify-center w-6 h-6 rounded-lg text-[12px] transition-all shrink-0 ${refreshingZpid === r.zpid ? 'bg-indigo-100 text-indigo-600' : 'text-slate-300 hover:text-indigo-600 hover:bg-indigo-50'} disabled:opacity-40 disabled:cursor-not-allowed`}
                                                            >
                                                                <i className={`fa-solid fa-arrows-rotate ${refreshingZpid === r.zpid ? 'animate-spin' : ''}`} />
                                                            </button>
                                                            {r.listPrice != null && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-black shrink-0">
                                                                    <i className="fa-solid fa-tag text-[9px]" />
                                                                    ${r.listPrice.toLocaleString()}
                                                                </span>
                                                            )}
                                                            {r.isNew && (
                                                                <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wide flex items-center gap-1 shrink-0">
                                                                    <i className="fa-solid fa-sparkles text-[8px]" />New
                                                                </span>
                                                            )}
                                                            {/* Beds / Baths / SqFt / Lot */}
                                                            {(r.bedrooms || r.bathrooms || r.livingArea || r.lotAreaValue) && (
                                                                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400 shrink-0">
                                                                    {r.bedrooms != null && <span>{r.bedrooms} bd</span>}
                                                                    {r.bathrooms != null && <><span className="text-slate-200">|</span><span>{r.bathrooms} ba</span></>}
                                                                    {r.livingArea != null && <><span className="text-slate-200">|</span><span>{r.livingArea.toLocaleString()} sqft</span></>}
                                                                    {r.lotAreaValue != null && <><span className="text-slate-200">|</span><span>{r.lotAreaValue} {r.lotAreaUnit || 'sqft'}</span></>}
                                                                </span>
                                                            )}
                                                            {r.distressScore >= 4 && (
                                                                <button
                                                                    data-comps-zpid={r.zpid}
                                                                    onClick={async () => {
                                                                        addLog(`🔍 Finding comps for ${r.address}...`);
                                                                        try {
                                                                            // 0. Check for cached full comps in distress_analysis
                                                                            const daSnap = await getDoc(doc(db, 'distress_analysis', r.zpid));
                                                                            const daData = daSnap.exists() ? daSnap.data() : null;
                                                                            if (daData?.comps && Array.isArray(daData.comps) && daData.comps.length > 0 && typeof daData.comps[0] === 'object' && 'zestimate' in daData.comps[0]) {
                                                                                addLog(`  ✅ Found ${daData.comps.length} cached comps`);
                                                                                const cachedComps: SaleComp[] = daData.comps;
                                                                                const propSnap = await getDoc(doc(db, 'properties', r.zpid));
                                                                                const pd = propSnap.exists() ? propSnap.data() : null;
                                                                                setCompsData(cachedComps);
                                                                                setCompsAddress({
                                                                                    address: r.address,
                                                                                    zpid: r.zpid,
                                                                                    lat: r.latitude,
                                                                                    lng: r.longitude,
                                                                                    listPrice: pd?.listPrice ?? pd?.price ?? undefined,
                                                                                    monthlyRate: daData.compsMonthlyRate ?? undefined,
                                                                                    zestimate: pd?.zestimate ?? undefined,
                                                                                    bedrooms: pd?.bedrooms ?? undefined,
                                                                                    bathrooms: pd?.bathrooms ?? undefined,
                                                                                    sqft: pd?.livingAreaValue ?? undefined,
                                                                                    yearBuilt: pd?.yearBuilt ?? undefined,
                                                                                    homeType: pd?.homeType ?? undefined,
                                                                                    lotSize: (() => {
                                                                                        const raw = pd?.lotSize;
                                                                                        if (typeof raw === 'number' && raw > 0) return raw;
                                                                                        if (typeof raw === 'string') {
                                                                                            const num = parseFloat(raw.replace(/,/g, ''));
                                                                                            if (!isNaN(num) && num > 0) {
                                                                                                return raw.toLowerCase().includes('acre') ? Math.round(num * 43560) : num;
                                                                                            }
                                                                                        }
                                                                                        return undefined;
                                                                                    })(),
                                                                                });
                                                                                return;
                                                                            }

                                                                            // 1. Get property data (zip, lat, lng, details)
                                                                            let lat = r.latitude;
                                                                            let lng = r.longitude;
                                                                            let zipCode: string | undefined;
                                                                            let listPrice: number | undefined;
                                                                            let pd: any = null;

                                                                            const propSnap = await getDoc(doc(db, 'properties', r.zpid));
                                                                            console.log('[Comps] properties lookup zpid:', r.zpid, 'exists:', propSnap.exists());
                                                                            if (propSnap.exists()) {
                                                                                pd = propSnap.data();
                                                                                console.log('[Comps] pd.zestimate:', pd?.zestimate, 'type:', typeof pd?.zestimate);
                                                                                const coords = pd?.coordinates;
                                                                                if (coords?.latitude != null) { lat = coords.latitude; lng = coords.longitude; }
                                                                                listPrice = pd?.listPrice ?? pd?.price ?? pd?.list_price ?? undefined;
                                                                                zipCode = pd?.zipcode || pd?.zipCode || pd?.zip || pd?.postalCode || undefined;
                                                                            }

                                                                            // Try to extract zip from address if not in property doc
                                                                            if (!zipCode) {
                                                                                const zipMatch = r.address.match(/(\d{5})(?:\s|,|$)/);
                                                                                if (zipMatch) zipCode = zipMatch[1];
                                                                            }

                                                                            if (!zipCode || lat == null || lng == null) {
                                                                                addLog(`⚠️ Missing zip or coordinates for ${r.address}`);
                                                                                return;
                                                                            }

                                                                            // 2. Fetch sold listings from cache for this zip
                                                                            addLog(`  📦 Fetching sold listings for zip ${zipCode}...`);
                                                                            const soldCache = await getZipSoldListings(zipCode);
                                                                            if (!soldCache?.listings?.length) {
                                                                                addLog(`⚠️ No sold listings cached for zip ${zipCode}`);
                                                                                return;
                                                                            }
                                                                            addLog(`  Found ${soldCache.listings.length} sold listings in zip ${zipCode}`);

                                                                            // 3. Parse all listings into comp candidates with distance + sale date
                                                                            const R = 3958.8;
                                                                            const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
                                                                                const dLat = (lat2 - lat1) * Math.PI / 180;
                                                                                const dLng = (lng2 - lng1) * Math.PI / 180;
                                                                                const a = Math.sin(dLat / 2) ** 2 +
                                                                                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                                                                                    Math.sin(dLng / 2) ** 2;
                                                                                return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                                                            };

                                                                            const subjectSqft = pd?.livingAreaValue ?? pd?.livingArea ?? r.livingArea ?? 0;
                                                                            const subjectType = (pd?.homeType || pd?.propertyType || r.homeType || '').toString().toUpperCase().trim();
                                                                            const now = Date.now();

                                                                            // ── Time adjustment: calculate monthly appreciation rate ───────
                                                                            // Use all sold listings in zip, past 6 months, IQR-filtered, median $/sqft per month
                                                                            const sixMonthsAgo = now - 180 * 86_400_000;
                                                                            const trendData: { monthIdx: number; psfMedian: number }[] = [];
                                                                            const allPsf: number[] = [];

                                                                            // Collect $/sqft for all listings with valid data (same property type as subject)
                                                                            const psfByMonth = new Map<number, number[]>();
                                                                            for (const listing of soldCache.listings) {
                                                                                // Filter by property type — must match subject
                                                                                if (subjectType) {
                                                                                    const listingType = (listing.homeType || listing.propertyType || listing.description?.type || '').toString().toUpperCase().trim();
                                                                                    if (listingType && listingType !== subjectType) continue;
                                                                                }
                                                                                const rawD = listing.dateSold || listing.lastSoldDate || listing.soldDate ||
                                                                                    listing.date_sold || listing.sold_date || listing.contractDate || listing.closedDate;
                                                                                if (!rawD) continue;
                                                                                const dMs = typeof rawD === 'number' ? (rawD > 1e12 ? rawD : rawD * 1000) : new Date(String(rawD)).getTime();
                                                                                if (isNaN(dMs) || dMs < sixMonthsAgo) continue;
                                                                                const price = listing.price || listing.list_price || listing.lastSoldPrice || listing.soldPrice;
                                                                                const sqft = listing.livingArea ?? listing.description?.sqft;
                                                                                if (typeof price !== 'number' || typeof sqft !== 'number' || sqft <= 0 || price <= 0) continue;
                                                                                const psf = price / sqft;
                                                                                allPsf.push(psf);
                                                                                // Group by month offset from today
                                                                                const monthIdx = Math.floor((now - dMs) / (30.44 * 86_400_000));
                                                                                if (!psfByMonth.has(monthIdx)) psfByMonth.set(monthIdx, []);
                                                                                psfByMonth.get(monthIdx)!.push(psf);
                                                                            }

                                                                            // IQR filter on allPsf
                                                                            let monthlyRate = 0;
                                                                            let iqrLo = -Infinity;
                                                                            let iqrHi = Infinity;
                                                                            if (allPsf.length >= 5) {
                                                                                allPsf.sort((a, b) => a - b);
                                                                                const q1 = allPsf[Math.floor(allPsf.length * 0.25)];
                                                                                const q3 = allPsf[Math.floor(allPsf.length * 0.75)];
                                                                                const iqr = q3 - q1;
                                                                                iqrLo = q1 - 1.5 * iqr;
                                                                                iqrHi = q3 + 1.5 * iqr;

                                                                                // Rebuild medians per month using only non-outlier data
                                                                                for (const [mIdx, vals] of psfByMonth) {
                                                                                    const clean = vals.filter(v => v >= iqrLo && v <= iqrHi);
                                                                                    if (clean.length === 0) continue;
                                                                                    clean.sort((a, b) => a - b);
                                                                                    const med = clean[Math.floor(clean.length / 2)];
                                                                                    trendData.push({ monthIdx: mIdx, psfMedian: med });
                                                                                }

                                                                                // Simple linear regression: psfMedian = a + b * monthIdx
                                                                                // monthIdx 0 = this month, higher = older
                                                                                // So negative slope means prices are rising
                                                                                if (trendData.length >= 2) {
                                                                                    const n = trendData.length;
                                                                                    const sumX = trendData.reduce((s, d) => s + d.monthIdx, 0);
                                                                                    const sumY = trendData.reduce((s, d) => s + d.psfMedian, 0);
                                                                                    const sumXY = trendData.reduce((s, d) => s + d.monthIdx * d.psfMedian, 0);
                                                                                    const sumXX = trendData.reduce((s, d) => s + d.monthIdx ** 2, 0);
                                                                                    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX ** 2);
                                                                                    const avgPsf = sumY / n;
                                                                                    // slope is negative when prices rise (monthIdx increases into past)
                                                                                    // monthly appreciation = -slope / avgPsf
                                                                                    monthlyRate = avgPsf > 0 ? -slope / avgPsf : 0;
                                                                                    // Cap at ±2%/month
                                                                                    monthlyRate = Math.max(-0.02, Math.min(0.02, monthlyRate));
                                                                                }
                                                                            }
                                                                            addLog(`  📈 Monthly appreciation rate: ${(monthlyRate * 100).toFixed(2)}%/mo (from ${allPsf.length} sales)`);

                                                                            // ── Build all comps with distance, date, tier ────────────────
                                                                            type RawComp = SaleComp & { daysAgo: number };
                                                                            const allComps: RawComp[] = [];

                                                                            // Pass 1: find nearby candidates with zpids
                                                                            interface Candidate { listing: any; dist: number; zpid: string }
                                                                            const candidates: Candidate[] = [];
                                                                            for (const listing of soldCache.listings) {
                                                                                const lLat = listing.latitude ?? listing.location?.address?.coordinate?.lat;
                                                                                const lLng = listing.longitude ?? listing.location?.address?.coordinate?.lon;
                                                                                if (lLat == null || lLng == null) continue;
                                                                                // Filter by property type early to avoid unnecessary RapidAPI calls
                                                                                if (subjectType) {
                                                                                    const compType = (listing.homeType || listing.propertyType || listing.description?.type || '').toString().toUpperCase().trim();
                                                                                    if (compType && compType !== subjectType) continue;
                                                                                }
                                                                                const dist = haversine(lat, lng, lLat, lLng);
                                                                                if (dist > 1.0) continue;
                                                                                const zpid = String(listing.zpid || listing.property_id || listing.listing_id || listing.mls_id || '');
                                                                                if (!zpid) continue;
                                                                                candidates.push({ listing, dist, zpid });
                                                                            }
                                                                            addLog(`  📋 ${candidates.length} nearby candidates found, enriching...`);

                                                                            // Pass 2: enrich each candidate from sold_or_unlisted_properties, properties, or RapidAPI
                                                                            const enriched = new Map<string, any>();
                                                                            // Step A: check sold_or_unlisted_properties — only accept entries with bedrooms data
                                                                            const zpidsToEnrich = [...new Set(candidates.map(c => c.zpid))];
                                                                            for (const zid of zpidsToEnrich) {
                                                                                const soldSnap = await getDoc(doc(db, 'sold_or_unlisted_properties', zid));
                                                                                if (soldSnap.exists()) {
                                                                                    const d = soldSnap.data();
                                                                                    if (d.bedrooms != null) {
                                                                                        enriched.set(zid, d);
                                                                                    }
                                                                                }
                                                                            }
                                                                            const countFromSoldCache = enriched.size;

                                                                            // Step B: check properties collection for any still missing
                                                                            const missingAfterSold = zpidsToEnrich.filter(z => !enriched.has(z));
                                                                            if (missingAfterSold.length > 0) {
                                                                                for (const zid of missingAfterSold) {
                                                                                    const propSnap = await getDoc(doc(db, 'properties', zid));
                                                                                    if (propSnap.exists()) {
                                                                                        const d = propSnap.data();
                                                                                        if (d.bedrooms != null) {
                                                                                            enriched.set(zid, d);
                                                                                            // Also save to sold_or_unlisted_properties for future lookups
                                                                                            const stripUndef = (obj: any): any => {
                                                                                                if (obj === null || obj === undefined) return null;
                                                                                                if (Array.isArray(obj)) return obj.map(stripUndef);
                                                                                                if (typeof obj === 'object' && !(obj instanceof Date)) {
                                                                                                    return Object.fromEntries(
                                                                                                        Object.entries(obj).filter(([, v]) => v !== undefined).map(([k, v]) => [k, stripUndef(v)])
                                                                                                    );
                                                                                                }
                                                                                                return obj;
                                                                                            };
                                                                                            await setDoc(doc(db, 'sold_or_unlisted_properties', zid), stripUndef(d), { merge: true });
                                                                                        }
                                                                                    }
                                                                                }

                                                                            }

                                                                            // Step C: fetch remaining from RapidAPI (2 per second)
                                                                            const missing = zpidsToEnrich.filter(z => !enriched.has(z));
                                                                            if (missing.length > 0) {

                                                                                const { fetchPropertySpecs } = await import('../../services/apiService');
                                                                                for (let mi = 0; mi < missing.length; mi += 2) {
                                                                                    const batch = missing.slice(mi, mi + 2);
                                                                                    await Promise.allSettled(
                                                                                        batch.map(async (zid) => {
                                                                                            try {
                                                                                                const propData = await fetchPropertySpecs(zid);
                                                                                                if (!propData) return;
                                                                                                const stripUndef = (obj: any): any => {
                                                                                                    if (obj === null || obj === undefined) return null;
                                                                                                    if (Array.isArray(obj)) return obj.map(stripUndef);
                                                                                                    if (typeof obj === 'object' && !(obj instanceof Date)) {
                                                                                                        return Object.fromEntries(
                                                                                                            Object.entries(obj)
                                                                                                                .filter(([, v]) => v !== undefined)
                                                                                                                .map(([k, v]) => [k, stripUndef(v)])
                                                                                                        );
                                                                                                    }
                                                                                                    return obj;
                                                                                                };
                                                                                                const cleanData = stripUndef(propData);
                                                                                                await setDoc(doc(db, 'sold_or_unlisted_properties', zid), cleanData, { merge: true });
                                                                                                enriched.set(zid, propData);
                                                                                            } catch (e: any) {
                                                                                                console.warn(`[Comps] Failed to fetch ${zid}:`, e.message);
                                                                                            }
                                                                                        })
                                                                                    );
                                                                                    if (mi + 2 < missing.length) await new Promise(r => setTimeout(r, 1100));
                                                                                }
                                                                            }
                                                                            const countFromProps = enriched.size - countFromSoldCache - missing.filter(z => enriched.has(z)).length;
                                                                            const countFromApi = missing.filter(z => enriched.has(z)).length;
                                                                            const countFailed = zpidsToEnrich.length - enriched.size;
                                                                            addLog(`  ✅ Enriched ${enriched.size}/${zpidsToEnrich.length} — sold_cache: ${countFromSoldCache}, properties: ${countFromProps < 0 ? 0 : countFromProps}, RapidAPI: ${missing.length}${countFailed > 0 ? `, failed: ${countFailed}` : ''}`);

                                                                            // Pass 3: build comps using enriched data
                                                                            for (const { listing, dist, zpid: compZpid } of candidates) {
                                                                                const e = enriched.get(compZpid); // enriched property data
                                                                                const lLat = listing.latitude ?? listing.location?.address?.coordinate?.lat;
                                                                                const lLng = listing.longitude ?? listing.location?.address?.coordinate?.lon;

                                                                                // Use enriched data (authoritative) — only fall back to listing if no enriched data at all
                                                                                const compBeds = e ? e.bedrooms : (listing.bedrooms ?? listing.description?.beds ?? undefined);
                                                                                const compBaths = e ? e.bathrooms : (listing.bathrooms ?? listing.description?.baths ?? undefined);
                                                                                const compSqft = e ? e.livingAreaValue : (listing.livingArea ?? listing.description?.sqft ?? undefined);
                                                                                const compHomeType = (e?.homeType || listing.homeType || listing.propertyType || listing.description?.type || '').toString().toUpperCase().trim();

                                                                                // Filter by property type — must match subject
                                                                                if (subjectType && compHomeType && compHomeType !== subjectType) continue;

                                                                                // Filter by bedrooms — must be within ±1 of subject
                                                                                const subjectBeds = pd?.bedrooms;
                                                                                if (subjectBeds != null && compBeds != null && Math.abs(compBeds - subjectBeds) > 1) continue;

                                                                                // Extract sold date
                                                                                const rawDate = listing.dateSold || listing.lastSoldDate || listing.soldDate ||
                                                                                    listing.date_sold || listing.sold_date || listing.contractDate || listing.closedDate ||
                                                                                    e?.lastSoldDate || undefined;
                                                                                let soldDateStr: string | undefined;
                                                                                let soldMs = 0;
                                                                                if (rawDate != null) {
                                                                                    if (typeof rawDate === 'number') {
                                                                                        soldMs = rawDate > 1e12 ? rawDate : rawDate * 1000;
                                                                                    } else {
                                                                                        soldMs = new Date(String(rawDate)).getTime();
                                                                                    }
                                                                                    if (!isNaN(soldMs)) soldDateStr = new Date(soldMs).toISOString();
                                                                                }
                                                                                const daysAgo = soldMs > 0 ? Math.floor((now - soldMs) / 86_400_000) : 9999;

                                                                                let salePrice = typeof (listing.price || listing.list_price || listing.lastSoldPrice || listing.soldPrice) === 'number'
                                                                                    ? (listing.price || listing.list_price || listing.lastSoldPrice || listing.soldPrice)
                                                                                    : (e?.price ?? undefined);

                                                                                // For recent sales (≤60 days), flag as unverified if sold price diverges >10% from zestimate
                                                                                // (sold prices often inaccurate before official recording — exclude from estimation)
                                                                                let priceUnverified = false;
                                                                                const compZestimate = e?.zestimate;
                                                                                if (daysAgo <= 60 && typeof salePrice === 'number' && typeof compZestimate === 'number' && compZestimate > 0) {
                                                                                    const pctDiff = Math.abs(salePrice - compZestimate) / compZestimate;
                                                                                    if (pctDiff > 0.10) {
                                                                                        priceUnverified = true;
                                                                                    }
                                                                                }

                                                                                // Determine tier
                                                                                const sqftPctDiff = subjectSqft > 0 && compSqft ? Math.abs(compSqft - subjectSqft) / subjectSqft : 1;
                                                                                const compLotSize = e?.lotSize ?? listing.lotAreaValue ?? listing.lotSize ?? undefined;
                                                                                const subjectLot = pd?.lotAreaValue ?? pd?.lotSize ?? 0;
                                                                                const lotPctDiff = (typeof subjectLot === 'number' && subjectLot > 0 && typeof compLotSize === 'number' && compLotSize > 0)
                                                                                    ? Math.abs(compLotSize - subjectLot) / subjectLot : 0;
                                                                                let tier: number;
                                                                                if (dist <= 0.25 && sqftPctDiff <= 0.10 && daysAgo <= 30) tier = 1;
                                                                                else if (dist <= 0.50 && sqftPctDiff <= 0.15 && daysAgo <= 90) tier = 2;
                                                                                else if (dist <= 0.75 && sqftPctDiff <= 0.20 && daysAgo <= 180) tier = 3;
                                                                                else tier = 4;
                                                                                // Lot size penalty: demote if comp lot >2x or <0.5x subject lot
                                                                                if (typeof subjectLot === 'number' && subjectLot > 0 && typeof compLotSize === 'number' && compLotSize > 0) {
                                                                                    if (compLotSize > subjectLot * 2 || compLotSize < subjectLot * 0.5) {
                                                                                        tier = Math.min(tier + 1, 4);
                                                                                    }
                                                                                }

                                                                                // Time-adjusted price
                                                                                const monthsSince = daysAgo / 30.44;
                                                                                const adjPrice = typeof salePrice === 'number'
                                                                                    ? Math.round(salePrice * (1 + monthlyRate) ** monthsSince) : undefined;

                                                                                // Flag as outlier if $/sqft is outside IQR bounds
                                                                                const compPsf = (typeof salePrice === 'number' && compSqft && compSqft > 0) ? salePrice / compSqft : null;
                                                                                const isOutlier = compPsf != null && (compPsf < iqrLo || compPsf > iqrHi);

                                                                                allComps.push({
                                                                                    id: compZpid,
                                                                                    formattedAddress: e?.address || listing.location?.address?.line || listing.address || listing.streetAddress || '—',
                                                                                    city: e?.city || listing.location?.address?.city || listing.city || r.city,
                                                                                    state: e?.state || listing.location?.address?.state_code || listing.state || r.state,
                                                                                    zipCode: e?.zipCode || listing.location?.address?.postal_code || listing.zipCode || zipCode,
                                                                                    latitude: lLat,
                                                                                    longitude: lLng,
                                                                                    bedrooms: compBeds,
                                                                                    bathrooms: compBaths,
                                                                                    squareFootage: compSqft,
                                                                                    lotSize: e?.lotSize ?? listing.lotAreaValue ?? listing.lotSize ?? undefined,
                                                                                    yearBuilt: e?.yearBuilt ?? listing.yearBuilt ?? undefined,
                                                                                    lastSaleDate: soldDateStr,
                                                                                    lastSalePrice: salePrice,
                                                                                    distance: Math.round(dist * 100) / 100,
                                                                                    tier,
                                                                                    adjustedPrice: adjPrice,
                                                                                    isOutlier,
                                                                                    priceUnverified,
                                                                                    zestimate: e?.zestimate ?? undefined,
                                                                                    daysAgo,
                                                                                });
                                                                            }

                                                                            // ── If >10 comps, tighten by ±20% living area ──
                                                                            if (allComps.length > 10 && subjectSqft > 0) {
                                                                                const before = allComps.length;
                                                                                const lo = subjectSqft * 0.8;
                                                                                const hi = subjectSqft * 1.2;
                                                                                const filtered = allComps.filter(c => !c.squareFootage || (c.squareFootage >= lo && c.squareFootage <= hi));
                                                                                if (filtered.length >= 3) {
                                                                                    allComps.length = 0;
                                                                                    allComps.push(...filtered);
                                                                                    addLog(`  🔍 Filtered ${before} → ${allComps.length} comps (±20% sqft of ${subjectSqft})`);
                                                                                }
                                                                            }

                                                                            // ── Tiered selection: find best 3 from tightest available tier ──
                                                                            // Sort all by tier ASC, then distance ASC
                                                                            allComps.sort((a, b) => a.tier! - b.tier! || a.distance! - b.distance!);

                                                                            // Find the lowest tier that has ≥3 comps (cumulative)
                                                                            let bestTierCutoff = 4;
                                                                            let cumCount = 0;
                                                                            for (let t = 1; t <= 4; t++) {
                                                                                cumCount += allComps.filter(c => c.tier === t).length;
                                                                                if (cumCount >= 3) { bestTierCutoff = t; break; }
                                                                            }

                                                                            // All comps up to bestTierCutoff are the "pool"; rest are still shown in table
                                                                            const tierLabel = ['', 'Ideal', 'Strong', 'Good', 'Acceptable'];
                                                                            addLog(`  🏠 Tier ${bestTierCutoff} (${tierLabel[bestTierCutoff]}): ${cumCount} comps found`);
                                                                            addLog(`  ✅ ${allComps.length} total comps within 1.0 mile`);

                                                                            // Cast back to SaleComp[] (drop daysAgo helper field)
                                                                            const nearbyComps: SaleComp[] = allComps.map(({ daysAgo: _d, ...rest }) => rest);

                                                                            // 4. Save full comps to distress_analysis (with tier, adjustedPrice, isOutlier)
                                                                            if (nearbyComps.length > 0) {
                                                                                // Strip undefined values — Firestore rejects them
                                                                                const compsClean = nearbyComps.map(c =>
                                                                                    Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined))
                                                                                );
                                                                                const cacheRef = doc(db, 'distress_analysis', r.zpid);
                                                                                await setDoc(cacheRef, { comps: compsClean, compsMonthlyRate: monthlyRate, compsBestTier: bestTierCutoff }, { merge: true });
                                                                                addLog(`  💾 Saved ${compsClean.length} full comps to cache`);
                                                                            }

                                                                            // 5. Open comps view with preloaded data
                                                                            setCompsData(nearbyComps);
                                                                            setCompsAddress({
                                                                                address: r.address,
                                                                                zpid: r.zpid,
                                                                                lat, lng, listPrice,
                                                                                monthlyRate,
                                                                                zestimate: pd?.zestimate ?? undefined,
                                                                                bedrooms: pd?.bedrooms ?? undefined,
                                                                                bathrooms: pd?.bathrooms ?? undefined,
                                                                                sqft: pd?.livingAreaValue ?? undefined,
                                                                                yearBuilt: pd?.yearBuilt ?? undefined,
                                                                                homeType: pd?.homeType ?? undefined,
                                                                                lotSize: (() => {
                                                                                    const raw = pd?.lotSize;
                                                                                    if (typeof raw === 'number' && raw > 0) return raw;
                                                                                    if (typeof raw === 'string') {
                                                                                        const num = parseFloat(raw.replace(/,/g, ''));
                                                                                        if (!isNaN(num) && num > 0) {
                                                                                            return raw.toLowerCase().includes('acre') ? Math.round(num * 43560) : num;
                                                                                        }
                                                                                    }
                                                                                    return undefined;
                                                                                })(),
                                                                            });
                                                                        } catch (e: any) {
                                                                            addLog(`❌ Comps failed: ${e.message}`);
                                                                        }
                                                                    }}
                                                                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-violet-50 text-violet-600 border border-violet-200 rounded-xl text-xs font-black uppercase tracking-wide hover:bg-violet-100 hover:border-violet-300 transition-all shrink-0"
                                                                >
                                                                    <i className="fa-solid fa-chart-bar text-[11px]" />Comps
                                                                </button>
                                                            )}
                                                        </div>


                                                        {r.description && (
                                                            <div className="mb-1.5">
                                                                <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                                                                    {r.description}
                                                                </p>
                                                                {r.description.length > 120 && (
                                                                    <button
                                                                        onClick={() => setExpandedDescZpid(r.zpid)}
                                                                        className="text-[11px] text-indigo-500 font-bold hover:text-indigo-700 transition-colors mt-0.5"
                                                                    >
                                                                        See more
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Full-card description overlay */}
                                                        {expandedDescZpid === r.zpid && r.description && (
                                                            <div className="absolute top-0 right-0 w-3/5 z-50 bg-white border border-slate-200 shadow-2xl rounded-[2rem] p-5">
                                                                <button
                                                                    onClick={() => setExpandedDescZpid(null)}
                                                                    className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all"
                                                                >
                                                                    <i className="fa-solid fa-xmark text-[11px]" />
                                                                </button>
                                                                <p className="text-[13px] text-slate-700 leading-relaxed max-h-64 overflow-y-auto custom-scrollbar pr-6">{r.description}</p>
                                                            </div>
                                                        )}

                                                    </div>

                                                    {/* Top-right: property type + listing sub-types */}
                                                    <div className="flex-shrink-0 pt-0.5 flex items-center gap-1 flex-wrap justify-end">
                                                        {r.propertyType && (
                                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold border border-slate-200 whitespace-nowrap">
                                                                {r.propertyType}
                                                            </span>
                                                        )}
                                                        {(r.listingSubTypes && r.listingSubTypes.length > 0
                                                            ? r.listingSubTypes
                                                            : ['is_FSBA']
                                                        ).map((st, i) => (
                                                            <span key={i} className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded-lg text-[10px] font-bold border border-violet-200 whitespace-nowrap">
                                                                {subTypeLabel(st)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>


                                                {r.error ? (
                                                    <div className="mt-2 text-[12px] text-rose-500 font-bold">{r.error}</div>
                                                ) : (
                                                    <div className="mt-3 space-y-3">
                                                        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,_1fr)_minmax(0,_2fr)] gap-4">
                                                            <div>
                                                                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Primary Indicators</div>
                                                                {r.primaryIndicators.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {r.primaryIndicators.map((ind, i) => (
                                                                            <span key={i} className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${colors.bg} ${colors.text} ${colors.border}`}>
                                                                                {ind}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[12px] text-slate-300 font-bold">None detected</span>
                                                                )}

                                                                {/* ARV Breakdown Table */}
                                                                {r.arvBreakdown && r.arvBreakdown.length > 0 && (
                                                                    <div className="mt-3 overflow-hidden rounded-xl border border-emerald-200/60">
                                                                        <table className="w-full text-left">
                                                                            <thead>
                                                                                <tr className="bg-emerald-100/50">
                                                                                    <th className="px-2 py-1 text-[9px] font-black text-emerald-600 uppercase tracking-widest">Item</th>
                                                                                    <th className="px-2 py-1 text-[9px] font-black text-emerald-600 uppercase tracking-widest text-right">Cost</th>
                                                                                    <th className="px-2 py-1 text-[9px] font-black text-emerald-600 uppercase tracking-widest text-right">Value Add</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-emerald-100/40">
                                                                                {r.arvBreakdown.map((b, i) => (
                                                                                    <tr key={i} className="bg-white/60 hover:bg-emerald-50/40 transition-colors">
                                                                                        <td className="px-2 py-1 text-[10px] font-bold text-slate-700">{b.item}</td>
                                                                                        <td className="px-2 py-1 text-[10px] font-mono text-slate-500 text-right">${b.estimated_cost.toLocaleString()}</td>
                                                                                        <td className="px-2 py-1 text-[10px] font-mono text-emerald-700 font-bold text-right">+${b.value_add.toLocaleString()}</td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Renovation Strategy */}
                                                            {r.renovationStrategy && (
                                                                <div className="p-3 bg-gradient-to-r from-emerald-50/60 to-teal-50/40 rounded-2xl border border-emerald-100">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <i className="fa-solid fa-hammer text-emerald-600 text-[12px]" />
                                                                        <span className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">Renovation Strategy</span>
                                                                        <span className="ml-auto text-[11px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                                                                            Estimated ARV Upside: {(r.estimatedArvPremium ?? 0) > 0 ? `+$${r.estimatedArvPremium!.toLocaleString()}` : '—'}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-[12px] text-slate-700 leading-relaxed">{r.renovationStrategy}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {paginated.length === 0 && (
                                <div className="py-16 text-center">
                                    <i className="fa-solid fa-house-circle-check text-4xl text-slate-100 mb-3 block" />
                                    <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">No properties match this filter</p>
                                </div>
                            )}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={safePage === 1}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                                >
                                    <i className="fa-solid fa-chevron-left text-[10px]" /> Prev
                                </button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                                        .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                                            if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                                            acc.push(p);
                                            return acc;
                                        }, [])
                                        .map((p, i) => p === '…' ? (
                                            <span key={`ellipsis-${i}`} className="px-2 text-slate-300 text-[11px] font-bold">…</span>
                                        ) : (
                                            <button
                                                key={p}
                                                onClick={() => setCurrentPage(p as number)}
                                                className={`w-8 h-8 rounded-xl text-[11px] font-black transition-all ${safePage === p ? 'bg-rose-600 text-white shadow-md shadow-rose-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={safePage === totalPages}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                                >
                                    Next <i className="fa-solid fa-chevron-right text-[10px]" />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Log console — admin only */}
                {isAdmin && logs.length > 0 && (
                    <div className="bg-slate-900 rounded-[2rem] overflow-hidden">
                        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scan Log</span>
                            <button
                                onClick={() => setLogs([])}
                                className="text-[10px] font-black text-slate-600 hover:text-slate-400 uppercase tracking-widest transition-colors"
                            >
                                Clear
                            </button>
                        </div>
                        <div className="p-5 h-48 overflow-y-auto font-mono text-[11px] text-emerald-400 space-y-1 custom-scrollbar">
                            {logs.map((log, i) => <div key={i}>{log}</div>)}
                            <div ref={logsEndRef} />
                        </div>
                    </div>
                )}
            </> /* end main content */}
        </div>
    );
};

export default DistressedFinderTab;
