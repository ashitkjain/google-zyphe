
import React, { useState, useMemo } from 'react';
import { APP_CONFIG } from '../../config';
import {
    saveZipMetadataBatch,
    getZipsForCity,
    saveZipListings,
    getZipListings
} from '../../services/firebase/cityData';
import { savePropertyToCloud, checkExistingPropertiesBatch, deletePropertyAnalysis } from '../../services/firebase/properties';
import { PropertyData } from '../../types';
import { runFullIntelligencePipeline, runImageOnlyPipeline, PipelineProgress, prefetchCityIntelligence } from '../../services/preloadService';
import { getLLMLogsForTimeRange } from '../../services/firebase/llm_logs';
import { getAPILogsForTimeRange } from '../../services/firebase/api_logs';
import { auth } from '../../services/firebase/config';
import { LLMCallEvent } from '../../types/ai';
import { APICallEvent } from '../../services/firebase/api_logs';
import { getPropertyStatusesBatch, PropertyStatusDetails } from '../../services/firebase/properties';
import { getUserProfile } from '../../services/firebase/user';
import { searchResoProperties } from '../../services/resoService';

interface IngestionJob {
    zpid: string;
    address: string;
    status: 'pending' | 'running' | 'completed' | 'error';
    progress: PipelineProgress | null;
    startTime?: number;
    endTime?: number;
    error?: string;
}

const CityDataTab: React.FC<{ onNavigate?: (view: string, address: string) => void }> = ({ onNavigate }) => {
    const [city, setCity] = useState('');
    // State removed as per new API requirements
    const [listings, setListings] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [statusLog, setStatusLog] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [stateFilter, setStateFilter] = useState<string>('ALL');
    const [ingestionQueue, setIngestionQueue] = useState<IngestionJob[]>([]);
    const [cachedPropertyIds, setCachedPropertyIds] = useState<Set<string>>(new Set());
    const [isCheckingCache, setIsCheckingCache] = useState(false);
    const [ingestionReport, setIngestionReport] = useState<{
        llmLogs: LLMCallEvent[];
        apiLogs: APICallEvent[];
    } | null>(null);
    const [viewMode, setViewMode] = useState<'table' | 'ingestion'>('table');
    const [activeReportTab, setActiveReportTab] = useState<'ai' | 'api'>('ai');
    const [pipelineType, setPipelineType] = useState<'full' | 'images'>('full');
    const [deletionStatus, setDeletionStatus] = useState<{ address: string, tables: string[] } | null>(null);
    const [propertyStatuses, setPropertyStatuses] = useState<Record<string, PropertyStatusDetails>>({});

    const availableStates = useMemo(() => {
        const states = new Set<string>();
        listings.forEach(item => {
            if (item.location?.address?.state_code) {
                states.add(item.location?.address?.state_code);
            }
        });
        return Array.from(states).sort();
    }, [listings]);

    // State Filter effect removed
    const zpidToAddressMap = useMemo(() => {
        const map: Record<string, string> = {};
        listings.forEach(item => {
            const id = String(item.property_id || item.listing_id || item.mls_id || item.mls?.id);
            const addrObj = item.location?.address;
            const builtAddress = addrObj
                ? `${addrObj.line}, ${addrObj.city}, ${addrObj.state_code} ${addrObj.postal_code}`
                : (item.location?.address?.line || id);
            map[id] = builtAddress;
        });
        return map;
    }, [listings]);

    const groupedListings = useMemo<Record<string, any[]>>(() => {
        const groups: Record<string, any[]> = {};

        listings.forEach(item => {
            const itemCity = item.location?.address?.city || 'Unknown City';
            const state = item.location?.address?.state_code || 'Unknown State';

            // ONLY filter by state if a specific state is selected in the UI
            if (stateFilter && stateFilter !== 'ALL' && state !== stateFilter) return;

            const key = `${itemCity}, ${state}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    }, [listings, stateFilter]);

    const addLog = (message: string) => {
        console.log(message);
        setStatusLog(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev].slice(0, 100));
    };

    const fetchStatuses = async (targetListings: any[]) => {
        if (targetListings.length === 0) return;
        setIsCheckingCache(true);
        const allIds = targetListings.map(l => String(l.property_id || l.listing_id || l.mls_id || l.mls?.id));
        const statusMap = await getPropertyStatusesBatch(allIds);
        setPropertyStatuses(statusMap);

        // Also update cached IDs for graying out
        const cached = new Set<string>();
        Object.entries(statusMap).forEach(([id, details]) => {
            if (details.property) cached.add(id);
        });
        setCachedPropertyIds(cached);
        setIsCheckingCache(false);
    };

    // Auto-fetch statuses for results
    React.useEffect(() => {
        fetchStatuses(listings);
    }, [listings]);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        const visibleIds = Object.values(groupedListings)
            .flat()
            .map((item: any) => String(item.property_id || item.listing_id || item.mls_id || item.mls?.id));

        setSelectedIds(prev => {
            const next = new Set(prev);
            visibleIds.forEach(id => next.add(id));
            return next;
        });
    };

    const deselectAll = () => {
        setSelectedIds(new Set());
    };

    const handleBulkSecureImages = async () => {
        if (selectedIds.size === 0) return;

        setLoading(true);
        setError(null);
        setViewMode('ingestion');
        setPipelineType('images');
        setIngestionReport(null);
        const batchStartTime = Date.now();
        addLog(`Starting Bulk Image Secure pipeline...`);

        const targets = listings.filter(l => {
            const id = String(l.property_id || l.listing_id || l.mls_id || l.mls?.id);
            return selectedIds.has(id);
        });


        addLog(`Processing ${targets.length} properties...`);

        // Initialize Queue
        const newJobs: IngestionJob[] = targets.map(item => {
            const id = String(item.property_id || item.listing_id || item.mls_id || item.mls?.id);
            return {
                zpid: id,
                address: item.location?.address?.line || id,
                status: 'pending',
                progress: null
            };
        });
        setIngestionQueue(newJobs);

        const CHUNK_SIZE = 5;
        let successCount = 0;

        for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
            const chunk = targets.slice(i, i + CHUNK_SIZE);
            addLog(`Phase: Processing batch ${Math.floor(i / CHUNK_SIZE) + 1} of ${Math.ceil(targets.length / CHUNK_SIZE)}...`);

            const chunkPromises = chunk.map(async (item) => {
                const zpid = String(item.property_id || item.listing_id || item.mls_id || item.mls?.id);
                const addrObj = item.location?.address;
                const builtAddress = addrObj
                    ? `${addrObj.line}, ${addrObj.city}, ${addrObj.state_code} ${addrObj.postal_code}`
                    : (item.location?.address?.line || zpid);

                const startTime = Date.now();
                setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, status: 'running', startTime } : j));

                try {
                    await runImageOnlyPipeline(builtAddress, (progress) => {
                        setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, progress } : j));
                    }, undefined, (msg) => addLog(`[${builtAddress}] ${msg}`));

                    setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, status: 'completed', endTime: Date.now() } : j));
                    return true;
                } catch (e: any) {
                    setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, status: 'error', error: e.message } : j));
                    return false;
                }
            });

            const results = await Promise.all(chunkPromises);
            successCount += results.filter(r => r === true).length;

            // Short rest between chunks to stabilize Firebase storage and APIs
            if (i + CHUNK_SIZE < targets.length) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        addLog(`Image Bulk Secure Complete. Successfully processed ${successCount} / ${targets.length} properties.`);
        setLoading(false);
        if (successCount === targets.length) setSelectedIds(new Set());
    };

    const handleCityWarmUp = async () => {
        if (selectedIds.size === 0) {
            addLog("No properties selected. Please select at least one property to identify target cities.");
            return;
        }

        setLoading(true);
        addLog(`Phase 1: Starting Manual Region Warming for selected contexts...`);

        const targets = listings.filter(l => {
            const id = String(l.property_id || l.listing_id || l.mls_id || l.mls?.id);
            return selectedIds.has(id);
        });

        const cityContexts = new Set<string>();
        const stateMap: Record<string, string> = {
            'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA',
            'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA',
            'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA',
            'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
            'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO',
            'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
            'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH',
            'OKLAHOMA': 'OK', 'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
            'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT', 'VERMONT': 'VT',
            'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY'
        };

        targets.forEach(t => {
            const city = t.location?.address?.city;
            const stateRaw = t.location?.address?.state_code || t.location?.address?.state;

            if (city && stateRaw) {
                const normState = stateRaw.trim().toUpperCase();
                const state = (stateMap[normState] || (normState.length === 2 ? normState : normState));
                cityContexts.add(`${city.trim()}|${state.trim()}`);
            }
        });

        if (cityContexts.size > 0) {
            for (const context of Array.from(cityContexts)) {
                const [city, state] = context.split('|');
                try {
                    const userId = auth?.currentUser?.uid || 'unknown';
                    addLog(`Manual Warm: Triggering deep research for ${city}, ${state}...`);
                    await prefetchCityIntelligence(city, state, userId, addLog);
                    addLog(`Manual Warm: Success for ${city}.`);
                } catch (e: any) {
                    addLog(`Manual Warm: Error for ${city}: ${e.message || String(e)}`);
                }
            }
            addLog(`Manual Regional Warming Complete.`);
        } else {
            addLog("No valid city/state contexts found in selection.");
        }
        setLoading(false);
    };

    const handleBulkIngest = async () => {
        if (selectedIds.size === 0) return;

        setLoading(true);
        setError(null);
        setPipelineType('full');
        setViewMode('ingestion');
        setIngestionReport(null); // Reset previous report
        const batchStartTime = Date.now();
        addLog(`Starting Parallel Bulk Ingest & Intelligence Pipeline...`);

        const targets = listings.filter(l => {
            const id = String(l.property_id || l.listing_id || l.mls_id || l.mls?.id);
            return selectedIds.has(id);
        });



        addLog(`Processing ${targets.length} properties...`);

        // Initialize Queue
        const newJobs: IngestionJob[] = targets.map(item => {
            const id = String(item.property_id || item.listing_id || item.mls_id || item.mls?.id);
            return {
                zpid: id,
                address: item.location?.address?.line || id,
                status: 'pending',
                progress: null
            };
        });
        setIngestionQueue(newJobs);

        // Step 1: Prefetch City-Level Intelligence (Pulse & General Market)
        // We find all unique city/state combinations in our target properties
        const cityContexts = new Set<string>();
        const stateMap: Record<string, string> = {
            'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA',
            'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA',
            'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA',
            'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
            'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO',
            'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
            'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH',
            'OKLAHOMA': 'OK', 'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
            'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT', 'VERMONT': 'VT',
            'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY'
        };

        targets.forEach(t => {
            const city = t.location?.address?.city;
            const stateRaw = t.location?.address?.state_code || t.location?.address?.state;

            if (city && stateRaw) {
                const normState = stateRaw.trim().toUpperCase();
                const state = (stateMap[normState] || (normState.length === 2 ? normState : normState));
                cityContexts.add(`${city.trim()}|${state.trim()}`);
            }
        });

        if (cityContexts.size > 0) {
            addLog(`Phase 1: Warming Regional Intelligence for ${cityContexts.size} cities...`);
            for (const context of Array.from(cityContexts)) {
                const [city, state] = context.split('|');
                try {
                    const userId = auth?.currentUser?.uid || 'unknown';
                    await prefetchCityIntelligence(city, state, userId, addLog);
                } catch (e) {
                    addLog(`Warning: Failed to warm context for ${city}: ${e}`);
                }
            }
            addLog(`Phase 1 Complete. Regional contexts established.`);
        }

        const CHUNK_SIZE = 5;
        let successCount = 0;

        for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
            const chunk = targets.slice(i, i + CHUNK_SIZE);
            addLog(`Phase 2: Processing batch ${Math.floor(i / CHUNK_SIZE) + 1} of ${Math.ceil(targets.length / CHUNK_SIZE)}...`);

            const chunkPromises = chunk.map(async (item, index) => {
                const zpid = String(item.property_id || item.listing_id || item.mls_id || item.mls?.id);
                const addrObj = item.location?.address;
                const builtAddress = addrObj
                    ? `${addrObj.line}, ${addrObj.city}, ${addrObj.state_code} ${addrObj.postal_code}`
                    : (item.location?.address?.line || zpid);

                // Small stagger within chunk to avoid hitting API rate limit bursts
                if (index > 0) {
                    await new Promise(r => setTimeout(r, index * 1000));
                }

                const startTime = Date.now();
                addLog(`Starting pipeline for property: ${builtAddress}`);
                // Mark running
                setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, status: 'running', startTime } : j));

                try {
                    const userId = auth?.currentUser?.uid || 'unknown';
                    // Run Full Intelligence Pipeline
                    await runFullIntelligencePipeline(builtAddress, (progress) => {
                        setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, progress } : j));
                    }, zpid, userId, (msg) => addLog(`[${builtAddress}] ${msg}`), true);

                    addLog(`Successfully completed intelligence suite for: ${builtAddress}`);
                    setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, status: 'completed', endTime: Date.now() } : j));
                    return true;
                } catch (e: any) {
                    console.error(`Ingestion failed for ${zpid}:`, e);
                    setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, status: 'error', error: e.message } : j));
                    return false;
                }
            });

            // Wait for current batch to complete
            const results = await Promise.all(chunkPromises);
            successCount += results.filter(r => r === true).length;

            // Short rest between chunks to stabilize Firebase storage and APIs
            if (i + CHUNK_SIZE < targets.length) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        addLog(`Bulk Ingest Complete. Successfully processed ${successCount} / ${targets.length} properties.`);
        setLoading(false);

        if (successCount === targets.length) {
            setSelectedIds(new Set());
        }

        // Generate Report
        try {
            const maxEnd = Date.now();
            const userId = auth?.currentUser?.uid || 'unknown';

            const [llmLogs, apiLogs] = await Promise.all([
                getLLMLogsForTimeRange(userId, batchStartTime, maxEnd),
                getAPILogsForTimeRange(userId, batchStartTime, maxEnd)
            ]);

            setIngestionReport({ llmLogs, apiLogs });
            addLog(`Usage Report Generated: ${llmLogs.length} AI calls, ${apiLogs.length} API calls.`);
        } catch (reportErr) {
            console.error("Failed to generate ingestion report:", reportErr);
        }
    };


    const fetchListings = async (zip: string, fallbackCity?: string, fallbackState?: string) => {
        const config = APP_CONFIG.usHousingApi;

        // 1. Check Cloud Cache first (Database)
        try {
            const cloudCached = await getZipListings(zip);
            if (cloudCached && cloudCached.timestamp) {
                const timestamp = cloudCached.timestamp.toDate?.()?.getTime() || cloudCached.timestamp;
                // 24 hour TTL for listings
                if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
                    const cachedListings = (cloudCached.listings || []).map((item: any) => ({
                        ...item,
                        location: {
                            ...item.location,
                            address: {
                                ...item.location?.address,
                                city: item.location?.address?.city === 'Unknown City' ? (fallbackCity || 'Unknown City') : (item.location?.address?.city || fallbackCity || 'Unknown City'),
                                state_code: item.location?.address?.state_code === 'Unknown State' ? (fallbackState || 'Unknown State') : (item.location?.address?.state_code || fallbackState || 'Unknown State')
                            }
                        }
                    }));
                    addLog(`Cloud Cache Hit for Zip: ${zip} (${cachedListings.length} items)`);
                    return cachedListings;
                }
            }
        } catch (e) {
            console.warn('Cloud cache check failed', e);
        }

        // 2. Hybrid Network Request: Try RESO first if keys exist
        const uid = auth?.currentUser?.uid;
        if (uid) {
            const profile = await getUserProfile(uid);
            const resoConfig = profile?.realtor?.resoConfig;
            if (resoConfig) {
                addLog(`Checking RESO Web API for listings in ${zip}...`);
                try {
                    const resoListings = await searchResoProperties(resoConfig, zip);
                    if (resoListings && resoListings.length > 0) {
                        addLog(`RESO API Success: Found ${resoListings.length} listings.`);
                        // Save to cache before returning
                        saveZipListings(zip, resoListings).catch(console.error);
                        return resoListings;
                    }
                } catch (e) {
                    addLog(`RESO Search failed, falling back to legacy: ${e}`);
                }
            }
        }

        const url = `https://${config.host}/propertyExtendedSearch?location=${zip}&status_type=ForSale`;
        addLog(`Fetching live data from (Fallback): ${url}`);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-RapidAPI-Key': config.key,
                    'X-RapidAPI-Host': config.host
                }
            });

            if (!response.ok) {
                const txt = await response.text();
                addLog(`API Error for ${zip}: ${response.status} - ${txt}`);
                return [];
            }

            const result = await response.json();
            const rawData = Array.isArray(result) ? result : (result.props || result.results || []);

            // Map to ensure UI consistency - status_type filter is already done by API
            const data = rawData.map((item: any) => {
                const legacyLoc = (item.location && typeof item.location === 'object') ? item.location : {};
                const legacyAddr = legacyLoc.address || {};

                // Extract price safely
                const rawPrice = item.list_price || item.price || item.last_sale_price || 0;
                const numericPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;

                return {
                    ...item,
                    property_id: String(item.property_id || item.zpid || item.listing_id || item.id || item.mls_id || Math.random()),
                    location: {
                        address: {
                            line: legacyAddr.line || item.address || item.streetAddress || item.full_address || "Unknown Address",
                            city: legacyAddr.city || item.city || item.town || fallbackCity || "Unknown City",
                            state_code: legacyAddr.state_code || item.state || item.state_code || item.stateId || fallbackState || "Unknown State",
                            postal_code: legacyAddr.postal_code || item.zipcode || item.zipCode || item.postal_code || zip
                        }
                    },
                    list_price: numericPrice,
                    primary_photo: item.primary_photo || (item.imgSrc || item.main_image ? { href: item.imgSrc || item.main_image } : null)
                };
            });

            addLog(`Live API returned ${data.length} listings for ${zip}`);

            // 3. Save to Cloud Cache
            if (data.length > 0) {
                saveZipListings(zip, data).catch(console.error);
            }

            return data;
        } catch (e: any) {
            addLog(`Fetch failed for ${zip}: ${e.message}`);
            return [];
        }
    };

    const handleSearch = async () => {
        if (!city) {
            setError('Please provide a City or Postal Code.');
            return;
        }

        const config = APP_CONFIG.usHousingApi;
        const zipConfig = APP_CONFIG.rapidapi.zipCodesApi;
        if (!config.key) {
            setError('RapidAPI Key not configured in system.');
            return;
        }

        setLoading(true);
        setError(null);
        setStatusLog([]);
        setListings([]);
        setStateFilter('ALL');

        addLog(`Starting ingestion for: ${city}`);

        try {
            const isPostalCodeInput = /^\d{5}(-\d{4})?$/.test(city.trim());
            let targetZips: string[] = [];
            let cachedGroups: Record<string, string[]> | null = null;
            let foundEntries: { zip: string, city: string, state: string }[] = [];

            if (isPostalCodeInput) {
                targetZips = [city.trim()];
                addLog(`Identified direct Zip Code: ${targetZips[0]}`);
            } else {
                const normalizedCity = city.trim();
                addLog(`Checking regional resolution for ${normalizedCity}...`);
                cachedGroups = await getZipsForCity(normalizedCity);

                if (cachedGroups) {
                    const allCachedZips = Object.values(cachedGroups).flat();
                    if (allCachedZips.length > 0) {
                        const statesFound = Object.keys(cachedGroups).join(', ');
                        addLog(`Cloud Cache Hit for City: ${normalizedCity}. Found ${allCachedZips.length} zips across [${statesFound}].`);
                        targetZips = allCachedZips;
                    }
                }

                if (targetZips.length === 0) {
                    const zipConfig = APP_CONFIG.rapidapi.zipCodesApi;
                    const zipApiUrl = `https://${zipConfig.host}${zipConfig.path}?q=${encodeURIComponent(normalizedCity)}`;
                    addLog(`Querying Registry: ${zipApiUrl}`);
                    try {
                        const zipResp = await fetch(zipApiUrl, {
                            method: 'GET',
                            headers: {
                                'X-RapidAPI-Key': zipConfig.key,
                                'X-RapidAPI-Host': zipConfig.host
                            }
                        });

                        const zipResult = await zipResp.json();

                        if (Array.isArray(zipResult)) {
                            foundEntries = zipResult.map((x: any) => ({
                                zip: x.zipCode || x.zip_code || (typeof x === 'string' ? x : ''),
                                city: x.uspsMainCityName || x.city || normalizedCity,
                                state: x.stateCode || x.state || x.state_code || 'Unknown'
                            }));
                        } else if (zipResult.results && Array.isArray(zipResult.results)) {
                            foundEntries = zipResult.results.map((x: any) => ({
                                zip: x.zipCode || x.zip_code,
                                city: x.uspsMainCityName || x.city || normalizedCity,
                                state: x.stateCode || x.state || x.state_code || 'Unknown'
                            }));
                        } else if (zipResult.zip_codes) {
                            foundEntries = zipResult.zip_codes.map((z: any) => ({
                                zip: z,
                                city: normalizedCity,
                                state: 'Unknown'
                            }));
                        }

                        foundEntries = foundEntries.filter(z => z.zip && typeof z.zip === 'string');
                        targetZips = foundEntries.map(z => z.zip);

                        if (foundEntries.length > 0) {
                            const uniqueStates = [...new Set(foundEntries.map(z => z.state).filter(s => s !== 'Unknown'))];
                            addLog(`Resolved ${targetZips.length} Zip Codes from API. States: ${uniqueStates.join(', ') || 'N/A'}`);
                            await saveZipMetadataBatch(foundEntries);
                        }
                    } catch (e) {
                        addLog(`Zip resolution failed: ${e}`);
                    }
                }
            }

            // Step 2: Define De-duplication Logic
            const deduplicate = (items: any[]) => {
                const seenIds = new Set<string>();
                return items.filter(item => {
                    const id = item.property_id || item.listing_id || item.mls_id || item.mls?.id;
                    const addrId = item.location?.address?.line;

                    // Create a composite string ID to handle number/string type differences
                    // and provide a robust fallback if primary IDs (ZPID/ListingID/MLSID) are missing
                    const compositeId = id ? String(id) : (addrId ? addrId.toLowerCase().replace(/\s+/g, '') : null);

                    if (!compositeId || seenIds.has(compositeId)) return false;
                    seenIds.add(compositeId);
                    return true;
                });
            };

            // Step 3: Fetch Data (Zip Scan or Direct Fallback)
            let rawResults: any[] = [];

            if (targetZips.length === 0) {
                addLog('No Zip Codes resolved. Search cancelled.');
                setLoading(false);
                return;
            }

            const uniqueZips = [...new Set(targetZips)];
            const zipsToScan = uniqueZips.slice(0, 10);
            addLog(`Scanning ${zipsToScan.length} unique Zip Codes...`);

            // Use a local registry for city/state info to avoid "Unknown" labels
            const zipRegistry: Record<string, { city: string, state: string }> = {};

            // Populate registry from whatever resolved our zips
            if (!isPostalCodeInput) {
                // If we have foundEntries from the API, use those first
                if (typeof foundEntries !== 'undefined' && foundEntries.length > 0) {
                    foundEntries.forEach(entry => {
                        zipRegistry[entry.zip] = { city: entry.city, state: entry.state };
                    });
                } else if (cachedGroups) {
                    // Fallback to cachedGroups if we didn't hit the API
                    Object.entries(cachedGroups).forEach(([st, zips]) => {
                        zips.forEach(z => {
                            zipRegistry[z] = { city: city.trim(), state: st };
                        });
                    });
                }
            }

            for (const zip of zipsToScan) {
                const fallback = zipRegistry[zip];
                const zipListings = await fetchListings(zip, fallback?.city, fallback?.state);
                rawResults.push(...zipListings);
                // Tiny delay to avoid rate triggers
                await new Promise(r => setTimeout(r, 200));
            }

            // Step 4: De-duplicate and Set State
            const deDuplicated = deduplicate(rawResults);

            // Step 4: Finalize Results
            addLog(`Aggregating results across ${targetZips.length} zones...`);
            const results = deduplicate(rawResults);

            addLog(`Discovery complete. Found ${results.length} unique properties.`);

            // Update state
            setListings(results);

            if (results.length === 0) {
                setError('No listings found in the resolved areas.');
            }

        } catch (err: any) {
            console.error(err);
            addLog(`Critical Error: ${err.message}`);
            setError(err.message || 'Workflow failed. See log.');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    // Table Row Component
    const ListingRow = ({ item }: { item: any, key?: any }) => {
        const itemId = String(item.property_id || item.listing_id || item.mls_id || item.mls?.id);
        const isSelected = selectedIds.has(itemId);
        const isCached = cachedPropertyIds.has(itemId);

        return (
            <tr
                className={`transition-all duration-300 border-b border-slate-100 last:border-0 
                    ${isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50'} 
                    cursor-pointer`}
                onClick={() => toggleSelection(itemId)}
            >
                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    {isCheckingCache ? (
                        <div className="w-5 h-5 flex items-center justify-center">
                            <i className="fa-solid fa-circle-notch animate-spin text-[10px] text-slate-300"></i>
                        </div>
                    ) : (
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection(itemId)}
                            className={`w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer hover:border-indigo-400`}
                        />
                    )}
                </td>
                <td className="p-4">
                    <div className="flex items-center gap-4">
                        <div className={`w-16 h-12 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0 relative`}>
                            {propertyStatuses[itemId]?.assets?.thumbnailUrl ? (
                                <img src={propertyStatuses[itemId].assets.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                            ) : item.primary_photo?.href ? (
                                <img src={item.primary_photo.href} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                    <i className="fa-solid fa-image"></i>
                                </div>
                            )}
                            {isCached && (
                                <div className="absolute top-1 right-1 bg-emerald-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                                    <i className="fa-solid fa-cloud"></i>
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const addrObj = item.location?.address;
                                        const fullAddress = addrObj
                                            ? `${addrObj.line}, ${addrObj.city}, ${addrObj.state_code} ${addrObj.postal_code}`
                                            : (item.location?.address?.line || itemId);
                                        if (onNavigate) onNavigate('explore', fullAddress);
                                    }}
                                    className="font-bold text-slate-900 text-sm hover:text-indigo-600 hover:underline text-left transition-colors"
                                >
                                    {item.location?.address?.line || 'Unknown Address'}
                                </button>
                            </div>
                        </div>
                    </div>
                </td>
                <td className={`p-4 text-right font-medium text-slate-900`}>
                    ${item.list_price?.toLocaleString() || '--'}
                </td>
                <td className="p-4">
                    <div className="flex items-center gap-3">
                        {/* Asset Icons */}
                        <div className="flex items-center gap-1.5">
                            <i className={`fa-solid fa-image text-[10px] ${propertyStatuses[itemId]?.assets?.images ? 'text-emerald-500' : 'text-slate-200'}`} title="Photos"></i>
                            <i className={`fa-solid fa-map-location-dot text-[10px] ${propertyStatuses[itemId]?.assets?.map ? 'text-emerald-500' : 'text-slate-200'}`} title="Radar Maps"></i>
                            <i className={`fa-solid fa-street-view text-[10px] ${propertyStatuses[itemId]?.assets?.streetView ? 'text-emerald-500' : 'text-slate-200'}`} title="StreetView"></i>
                        </div>
                        <div className="w-px h-3 bg-slate-100"></div>
                        {/* Intel Icons */}
                        <div className="flex items-center gap-1.5">
                            <i className={`fa-solid fa-file-invoice text-[10px] ${propertyStatuses[itemId]?.property ? 'text-indigo-500' : 'text-slate-200'}`} title="Property View"></i>
                            <i className={`fa-solid fa-brain text-[10px] ${propertyStatuses[itemId]?.visual ? 'text-indigo-500' : 'text-slate-200'}`} title="Visual AI Analysis"></i>
                        </div>
                    </div>
                </td>
                <td className="p-4 text-[10px] font-mono text-slate-400 text-center">
                    {propertyStatuses[itemId]?.property?.timestamp ? (
                        new Date(propertyStatuses[itemId].property.timestamp.toMillis ? propertyStatuses[itemId].property.timestamp.toMillis() : propertyStatuses[itemId].property.timestamp).toLocaleDateString()
                    ) : '--'}
                </td>
                <td className="p-4 text-right">
                    <div className="flex justify-end items-center gap-1">
                        {isCached && (
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Are you sure you want to delete ${item.location?.address?.line} from cache? This will remove all AI analysis.`)) {
                                        const res = await deletePropertyAnalysis(itemId);
                                        if (res.success) {
                                            setDeletionStatus({ address: item.location?.address?.line || itemId, tables: res.tables });
                                            setCachedPropertyIds(prev => {
                                                const next = new Set(prev);
                                                next.delete(itemId);
                                                return next;
                                            });
                                            // Clear notification after 5 seconds
                                            setTimeout(() => setDeletionStatus(null), 5000);
                                        }
                                    }
                                }}
                                className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title="Clear from Cache"
                            >
                                <i className="fa-solid fa-trash-can"></i>
                            </button>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(item.location?.address?.line);
                            }}
                            className={`p-2 rounded-lg transition-all ${isCached ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            disabled={isCached}
                            title={isCached ? "Already in database" : "Copy Address"}
                        >
                            <i className="fa-solid fa-copy"></i>
                        </button>
                    </div>
                </td>
            </tr>
        );
    };

    return (
        <div className="max-w-7xl mx-auto py-12 px-6 animate-in fade-in duration-700">
            <div className="mb-6 items-center justify-between flex">
                <div className="flex items-center gap-3">
                    {viewMode === 'table' ? (
                        <>
                            {listings.length > 0 && (
                                <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                                    <button
                                        onClick={selectAll}
                                        className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-indigo-600 transition-all"
                                    >
                                        Select All
                                    </button>
                                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                                    <button
                                        onClick={deselectAll}
                                        className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-rose-600 transition-all"
                                    >
                                        Deselect
                                    </button>
                                </div>
                            )}

                            {selectedIds.size > 0 && (
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleBulkSecureImages}
                                        className="px-6 py-3 bg-white border-2 border-slate-200 hover:border-indigo-400 hover:bg-slate-50 text-slate-700 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest shadow-sm transition-all animate-in slide-in-from-right flex items-center gap-3 group"
                                    >
                                        <i className="fa-solid fa-cloud-arrow-down text-indigo-500 group-hover:bounce"></i>
                                        Secure Images ({selectedIds.size})
                                    </button>
                                    <button
                                        onClick={handleCityWarmUp}
                                        disabled={loading}
                                        className="px-6 py-3 bg-white border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 text-slate-700 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest shadow-sm transition-all animate-in slide-in-from-right flex items-center gap-3 group"
                                    >
                                        <i className="fa-solid fa-earth-americas text-emerald-500 group-hover:rotate-12 transition-transform"></i>
                                        Warm Region ({selectedIds.size})
                                    </button>
                                    <button
                                        onClick={handleBulkIngest}
                                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.2rem] text-sm font-black shadow-lg shadow-indigo-200 transition-all animate-in slide-in-from-right flex items-center gap-3 group"
                                    >
                                        <i className="fa-solid fa-bolt-lightning group-hover:scale-125 transition-transform"></i>
                                        Full Intel Suite ({selectedIds.size})
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <button
                            onClick={() => {
                                // Update local cache state with successfully ingested properties so they appear grayed out
                                const successfulZjids = ingestionQueue
                                    .filter(j => j.status === 'completed')
                                    .map(j => j.zpid);

                                if (successfulZjids.length > 0) {
                                    setCachedPropertyIds(prev => {
                                        const next = new Set(prev);
                                        successfulZjids.forEach(id => next.add(id));
                                        return next;
                                    });
                                    // CRITICAL: Also remove from selectedIds so we don't try to re-process them
                                    setSelectedIds(prev => {
                                        const next = new Set(prev);
                                        successfulZjids.forEach(id => next.delete(id));
                                        return next;
                                    });

                                    // Trigger a full status refresh to show the new data in the table
                                    fetchStatuses(listings);
                                }

                                setViewMode('table');
                                setIngestionQueue([]); // Clear the queue when returning to table view
                            }}
                            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-[1.2rem] text-sm font-black shadow-lg shadow-slate-200 transition-all animate-in zoom-in"
                        >
                            Done & Return to Listings
                        </button>
                    )}
                </div>
            </div>

            {/* Search Panel (Full Width) */}
            {viewMode === 'table' && (
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 mb-10 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <i className="fa-solid fa-magnifying-glass-location text-xl"></i>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900">Market Discovery</h3>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest px-1">Enter a City or Zip Code to scan live markets</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        <div className="lg:col-span-7">
                            <input
                                type="text"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="Aspen, CO or 81611..."
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-sm shadow-inner"
                            />
                        </div>

                        <div className="lg:col-span-5 flex gap-2">
                            <button
                                onClick={handleSearch}
                                disabled={loading}
                                className="px-8 py-4 bg-slate-900 hover:bg-black text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {loading ? (
                                    <>
                                        <i className="fa-solid fa-spinner animate-spin"></i>
                                        Scanning...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-radar"></i>
                                        Launch Ingestion
                                    </>
                                )}
                            </button>
                            <button
                                onClick={async () => {
                                    if (!city) {
                                        addLog("Please enter a city name to warm.");
                                        return;
                                    }
                                    setLoading(true);

                                    // Parse input
                                    let [c, s] = city.split(',').map(x => x.trim());

                                    // 1. If state missing, try to find it in current listings
                                    if (!s && listings.length > 0) {
                                        const firstMatch = listings.find(l =>
                                            l.location?.address?.city?.toLowerCase() === c.toLowerCase()
                                        );
                                        if (firstMatch) {
                                            s = firstMatch.location?.address?.state_code || firstMatch.location?.address?.state;
                                        }
                                    }

                                    // 2. Secondary fallback for common testing
                                    if (!s) s = 'CA'; // Default to CA for speed in common regions

                                    const displayTarget = `${c}, ${s}`;
                                    addLog(`Manual Warm: Triggering deep research for ${displayTarget}...`);

                                    try {
                                        const userId = auth?.currentUser?.uid || 'unknown';
                                        await prefetchCityIntelligence(c, s, userId, addLog);
                                        addLog(`Manual Warm: Success for ${displayTarget}. Research is now live in DB.`);
                                    } catch (e: any) {
                                        addLog(`Manual Warm: Error for ${displayTarget}: ${e.message}`);
                                    }
                                    setLoading(false);
                                }}
                                disabled={loading || !city}
                                className="px-6 py-4 bg-white border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all flex items-center gap-3 disabled:opacity-50"
                                title="Warm Regional Intelligence"
                            >
                                <i className="fa-solid fa-earth-americas text-emerald-500"></i>
                                Warm Region
                            </button>
                            {listings.length > 0 && (
                                <button
                                    onClick={() => {
                                        setListings([]);
                                        setCity('');
                                        setError(null);
                                    }}
                                    className="p-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl transition-all"
                                    title="Reset Search"
                                >
                                    <i className="fa-solid fa-rotate-left"></i>
                                </button>
                            )}
                        </div>
                    </div>
                    {error && (
                        <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold animate-in slide-in-from-top-2">
                            <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                            {error}
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Left: Live Console */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden h-[600px] flex flex-col border border-slate-800">
                        <div className="flex items-center justify-between mb-6 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Live Process Log</h3>
                            </div>
                            <span className="text-[9px] font-mono text-slate-600">{statusLog.length} events</span>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 font-mono text-[10px] text-slate-300 custom-scrollbar pr-2">
                            {statusLog.length === 0 ? (
                                <div className="text-slate-600 italic">System idle. Awaiting discovery requests...</div>
                            ) : (
                                statusLog.map((msg, i) => (
                                    <div key={i} className="border-l border-slate-800 pl-3 py-1 animate-in slide-in-from-left-2 transition-all">
                                        {msg}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Status Footer */}
                        <div className="mt-6 pt-6 border-t border-slate-800/50 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-500 uppercase">Engine Status</span>
                                <span className="text-[10px] font-black text-emerald-500 uppercase bg-emerald-500/10 px-2 py-0.5 rounded">Optimal</span>
                            </div>
                            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full bg-indigo-500 transition-all duration-1000 ${loading || ingestionQueue.some(j => j.status === 'running') ? 'w-full animate-pulse' : 'w-0'}`}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Results or Queue */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Operational Diagnostics */}

                    {deletionStatus && (
                        <div className="p-4 bg-rose-50 border border-emerald-100 rounded-2xl text-rose-600 text-sm font-bold flex items-center justify-between animate-in slide-in-from-top-4 shadow-lg shadow-rose-100/50">
                            <div className="flex items-center gap-3">
                                <i className="fa-solid fa-trash-can animate-bounce"></i>
                                <span>Removed {deletionStatus.address} from all {deletionStatus.tables.length} tables.</span>
                            </div>
                            <button onClick={() => setDeletionStatus(null)} className="opacity-50 hover:opacity-100 transition-opacity">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    )}

                    {/* Discovery Results */}
                    {viewMode === 'table' && (
                        listings.length > 0 ? (
                            <div className="space-y-12 pb-20">
                                {/* State Selection */}
                                {availableStates.length > 0 && (
                                    <div className="flex items-center gap-2 p-1.5 bg-white border border-slate-200 rounded-2xl w-fit shadow-sm">
                                        {availableStates.map(st => (
                                            <button
                                                key={st}
                                                onClick={() => setStateFilter(st)}
                                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${stateFilter === st ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-500 hover:bg-slate-50'}`}
                                            >
                                                {st}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => setStateFilter('ALL')}
                                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${stateFilter === 'ALL' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            View All
                                        </button>
                                    </div>
                                )}

                                {/* Location Groups */}
                                {(Object.entries(groupedListings) as [string, any[]][]).map(([groupKey, groupItems]) => (
                                    <div key={groupKey} className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden animate-in fade-in slide-in-from-bottom-8">
                                        {/* Header */}
                                        <div className="p-8 border-b border-slate-50 bg-slate-50/20 flex items-center justify-between">
                                            <div className="flex items-center gap-5">
                                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shadow-inner">
                                                    <i className="fa-solid fa-map-pin"></i>
                                                </div>
                                                <div>
                                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{groupKey}</h2>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{groupItems.length} Active Listings</span>
                                                        <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Market Live</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => copyToClipboard(groupItems.map(l => l.location?.address?.line).join('\n'))}
                                                className="px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-600 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"
                                            >
                                                Copy Addresses
                                            </button>
                                        </div>

                                        {/* Table */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                                                        <th className="p-6 w-20 text-center">Batch</th>
                                                        <th className="p-6">Property</th>
                                                        <th className="p-6 text-right">Market Price</th>
                                                        <th className="p-6">Cache Status</th>
                                                        <th className="p-6 text-center">Last Scan</th>
                                                        <th className="p-6 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {groupItems.map((item, idx) => (
                                                        <ListingRow key={idx} item={item} />
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            !loading && !error && (
                                <div className="text-center py-40 bg-white rounded-[3rem] border border-slate-100 shadow-inner flex flex-col items-center justify-center">
                                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 animate-in zoom-in-50 duration-500">
                                        <i className="fa-solid fa-layer-group text-4xl text-slate-200"></i>
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Market Intelligence Terminal</h3>
                                    <p className="text-slate-400 text-sm font-medium max-w-sm mx-auto leading-relaxed">
                                        Enter a city or zip code above to initialize discovery. Use the "Launch Ingestion" button to begin scanning.
                                    </p>
                                </div>
                            )
                        )
                    )}

                    {/* Active Ingestion Jobs (Rich UI) */}
                    {viewMode === 'ingestion' && ingestionQueue.length > 0 && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-4">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Active Ingestion Jobs</h3>
                                <span className="px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black text-slate-500 uppercase">
                                    {ingestionQueue.filter(q => q.status === 'completed').length} / {ingestionQueue.length} {pipelineType === 'images' ? 'Images Secured' : 'Reports Synthesized'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {ingestionQueue.map((item) => (
                                    <div key={item.zpid} className={`bg-white p-6 rounded-[2rem] border transition-all ${item.status === 'completed' ? 'border-emerald-100 shadow-emerald-50' : item.status === 'error' ? 'border-rose-100 shadow-rose-50' : 'border-slate-100 shadow-lg shadow-slate-200/50'}`}>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                                    item.status === 'error' ? 'bg-rose-50 text-rose-600' :
                                                        item.status === 'running' ? 'bg-indigo-50 text-indigo-600' :
                                                            'bg-slate-50 text-slate-400'
                                                    }`}>
                                                    <i className={`fa-solid ${item.status === 'completed' ? 'fa-circle-check' :
                                                        item.status === 'error' ? 'fa-circle-xmark' :
                                                            item.status === 'running' ? 'fa-spinner animate-spin' :
                                                                'fa-hourglass-start'
                                                        }`}></i>
                                                </div>
                                                {item.status === 'completed' ? (
                                                    <button
                                                        onClick={() => onNavigate && onNavigate('explore', item.address)}
                                                        className="text-sm font-black text-slate-900 truncate hover:text-indigo-600 hover:underline transition-colors text-left"
                                                    >
                                                        {item.address}
                                                    </button>
                                                ) : (
                                                    <span className="text-sm font-black text-slate-900 truncate">{item.address}</span>
                                                )}
                                            </div>
                                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${item.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                                item.status === 'error' ? 'bg-rose-50 text-rose-600' :
                                                    item.status === 'running' ? 'bg-indigo-50 text-indigo-600' :
                                                        'bg-slate-100 text-slate-400'
                                                }`}>
                                                {item.status}
                                            </span>
                                        </div>

                                        {item.status === 'running' && item.progress && (
                                            <div className="space-y-3 animate-in fade-in">
                                                <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter text-slate-400">
                                                    <div className="flex items-center gap-2">
                                                        <span>{item.progress.step}</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                        <span className="font-mono text-indigo-500">
                                                            {item.startTime ? Math.floor((Date.now() - item.startTime) / 1000) : 0}s
                                                        </span>
                                                    </div>
                                                    <span className="text-indigo-600">Active</span>
                                                </div>
                                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                                                        style={{ width: `${(100 / 9) * (['Geocoding', 'Status Check', 'Property Data', 'Gallery', 'Visual AI', 'Spatial AI', 'Market AI', 'Quality Audit', 'Narrative AI'].indexOf(item.progress.step) + 1)}%` }}
                                                    ></div>
                                                </div>
                                                <p className="text-[11px] text-slate-500 font-medium italic">
                                                    {item.progress.message}
                                                </p>
                                            </div>
                                        )}

                                        {item.status === 'error' && (
                                            <p className="text-[11px] text-rose-600 font-medium bg-rose-50 p-3 rounded-xl border border-rose-100">
                                                <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                                                {item.error}
                                            </p>
                                        )}

                                        {item.status === 'completed' && (
                                            <div className="flex items-center justify-between">
                                                <button
                                                    onClick={() => onNavigate && onNavigate('explore', item.address)}
                                                    className="flex items-center gap-2 text-emerald-600 text-[11px] font-black uppercase tracking-widest bg-emerald-50 py-2 px-4 rounded-xl hover:bg-emerald-100 transition-colors w-fit group"
                                                >
                                                    <i className="fa-solid fa-check"></i>
                                                    {pipelineType === 'images' ? 'Assets Secured in Cloud' : 'Intelligence Suite Ready'}
                                                    <i className="fa-solid fa-arrow-right ml-1 group-hover:translate-x-1 transition-transform"></i>
                                                </button>
                                                {item.startTime && item.endTime && (
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        Total: <span className="text-slate-900 font-mono">{Math.floor((item.endTime - item.startTime) / 1000)}s</span>
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Ingestion Usage Report */}
            {ingestionReport && (
                <div className="mt-20 border-t border-slate-100 pt-20 animate-in slide-in-from-bottom-8">
                    <div className="flex items-end justify-between mb-12">
                        <div>
                            <div className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-4">Post-Analysis Intelligence</div>
                            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Usage & Performance</h2>
                        </div>
                        <div className="flex gap-4">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-right">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">AI Cost (Est)</div>
                                <div className="text-xl font-mono font-black text-slate-900">
                                    ${ingestionReport.llmLogs.reduce((acc, l) => acc + (l.estimated_cost || 0), 0).toFixed(4)}
                                </div>
                            </div>
                            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-right">
                                <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Success Rate</div>
                                <div className="text-xl font-mono font-black text-emerald-700">
                                    {ingestionQueue.length > 0 ? Math.round((ingestionQueue.filter(q => q.status === 'completed').length / ingestionQueue.length) * 100) : 0}%
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 mb-12 border-b border-slate-100">
                        <button
                            onClick={() => setActiveReportTab('ai')}
                            className={`pb-4 text-sm font-black uppercase tracking-widest transition-all relative ${activeReportTab === 'ai' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <div className="flex items-center gap-3">
                                <i className="fa-solid fa-brain"></i>
                                Gemini Analysis
                                <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg text-[10px]">{ingestionReport.llmLogs.length}</span>
                            </div>
                            {activeReportTab === 'ai' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-full animate-in fade-in zoom-in duration-300"></div>}
                        </button>
                        <button
                            onClick={() => setActiveReportTab('api')}
                            className={`pb-4 text-sm font-black uppercase tracking-widest transition-all relative ${activeReportTab === 'api' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <div className="flex items-center gap-3">
                                <i className="fa-solid fa-cloud"></i>
                                API Gateway
                                <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg text-[10px]">{ingestionReport.apiLogs.length}</span>
                            </div>
                            {activeReportTab === 'api' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-full animate-in fade-in zoom-in duration-300"></div>}
                        </button>
                    </div>

                    <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                        {activeReportTab === 'ai' ? (
                            /* Gemini Logs */
                            <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
                                <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs">
                                            <i className="fa-solid fa-brain"></i>
                                        </div>
                                        <span className="font-black text-slate-900 uppercase text-[11px] tracking-widest">Gemini Architecture Calls</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-400">{ingestionReport?.llmLogs?.length || 0} events</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30">
                                                <th className="p-5">Agent / Task</th>
                                                <th className="p-5 text-right">Consumption</th>
                                                <th className="p-5 text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {ingestionReport?.llmLogs && Array.isArray(ingestionReport.llmLogs) && [...ingestionReport.llmLogs].sort((a, b) => b.timestamp - a.timestamp).map((logEntry, i) => (
                                                <tr key={i} className="text-sm transition-colors hover:bg-slate-50/50">
                                                    <td className="p-5">
                                                        <div className="font-bold text-slate-900 mb-0.5">
                                                            {logEntry.prompt_filename?.replace('.ts', '').replace(/([A-Z])/g, ' $1').trim() || 'Unspecified Task'}
                                                        </div>
                                                        <div className="text-[10px] text-indigo-600 font-black truncate max-w-[250px] mb-0.5">
                                                            {logEntry.address || (logEntry.zpid && zpidToAddressMap[logEntry.zpid]) || logEntry.zpid || '--'}
                                                        </div>
                                                        <div className="text-[9px] text-slate-400 font-mono truncate max-w-[200px]">Model: {logEntry.llm_name || 'Gemini'}</div>
                                                    </td>
                                                    <td className="p-5 text-right">
                                                        <div className="text-indigo-600 font-bold flex items-center justify-end gap-1.5">
                                                            {logEntry.usage_metadata?.cachedContentTokenCount && logEntry.usage_metadata.cachedContentTokenCount > 0 && (
                                                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded text-[9px] font-black animate-pulse">
                                                                    <i className="fa-solid fa-bolt-lightning text-[8px]"></i>
                                                                    CACHED
                                                                </span>
                                                            )}
                                                            {logEntry.usage_metadata?.totalTokenCount?.toLocaleString() || 0} tkn
                                                        </div>
                                                        <div className="text-[10px] text-emerald-600 font-black">
                                                            ${(logEntry.estimated_cost || 0).toFixed(4)}
                                                        </div>
                                                    </td>
                                                    <td className="p-5 text-right">
                                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${logEntry.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                            {logEntry.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            /* API Logs */
                            <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
                                <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs">
                                            <i className="fa-solid fa-cloud"></i>
                                        </div>
                                        <span className="font-black text-slate-900 uppercase text-[11px] tracking-widest">External API Gateway</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-400">{ingestionReport?.apiLogs?.length || 0} events</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30">
                                                <th className="p-5">Provider / Endpoint</th>
                                                <th className="p-5 text-right">Latency</th>
                                                <th className="p-5 text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {ingestionReport?.apiLogs && Array.isArray(ingestionReport.apiLogs) && [...ingestionReport.apiLogs].sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0)).map((apiLog, i) => (
                                                <tr key={i} className="text-sm transition-colors hover:bg-slate-50/50">
                                                    <td className="p-5">
                                                        <div className="font-bold text-slate-900 mb-0.5">
                                                            {apiLog.api_name}
                                                        </div>
                                                        <div className="text-[10px] text-blue-600 font-black truncate max-w-[250px] mb-0.5">
                                                            {apiLog.address || (apiLog.zpid && zpidToAddressMap[apiLog.zpid]) || apiLog.zpid || '--'}
                                                        </div>
                                                        <div className="text-[9px] text-slate-400 font-mono truncate max-w-[200px]">
                                                            {apiLog.api_name === 'RapidAPI' ? 'Endpoint: ' + apiLog.endpoint : apiLog.endpoint}
                                                        </div>
                                                    </td>
                                                    <td className="p-5 text-right font-mono text-slate-500">
                                                        {apiLog.response_time_ms ? `${apiLog.response_time_ms}ms` : '--'}
                                                    </td>
                                                    <td className="p-5 text-right">
                                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${apiLog.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                            {apiLog.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CityDataTab;
