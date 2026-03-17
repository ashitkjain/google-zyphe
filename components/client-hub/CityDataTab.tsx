
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { APP_CONFIG, SUPPORTED_STATES, STATE_NAME_MAP } from '../../config';
import {
    saveZipMetadataBatch,
    getZipsForCity,
    saveZipListings,
    getZipListings,
    saveZipSoldListings,
    removePropertyFromZipCache,
    getCachedCities
} from '../../services/firebase/cityData';
import { savePropertyToCloud, checkExistingPropertiesBatch, deletePropertyAnalysis, runDeprecationSweep } from '../../services/firebase/properties';

import { PropertyData } from '../../types';
import { runFullIntelligencePipeline, runImageOnlyPipeline, runPropertyDataOnlyPipeline, PipelineProgress, runCityDeepResearch } from '../../services/preloadService';
import { getLLMLogsForTimeRange } from '../../services/firebase/llm_logs';
import { getAPILogsForTimeRange } from '../../services/firebase/api_logs';
import { auth, STATE_MAP } from '../../services/firebase/config';
import { LLMCallEvent } from '../../types/ai';
import { APICallEvent } from '../../services/firebase/api_logs';
import { getPropertyStatusesBatch, PropertyStatusDetails } from '../../services/firebase/properties';
import { getUserProfile } from '../../services/firebase/user';
import { searchResoProperties } from '../../services/resoService';
import { formatAddress as centralFormatAddress } from '../../services/apiService';
import { runCitySmokeTest, CitySmokeSummary, PropertySmokeResult } from '../../services/smokeTest';
import { logPipelineAudit, getPipelineAuditTrail, PipelineAuditEntry } from '../../services/firebase/pipelineAudit';


interface IngestionJob {
    zpid: string;
    address: string;
    status: 'pending' | 'running' | 'completed' | 'error';
    progress: PipelineProgress | null;
    startTime?: number;
    endTime?: number;
    error?: string;
    completedSteps?: { name: string; outcome: 'ran' | 'cached' | 'skipped' | 'failed' }[];
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
    const [viewMode, setViewMode] = useState<'table' | 'ingestion' | 'audit'>('table');
    const [auditEntries, setAuditEntries] = useState<PipelineAuditEntry[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [activeReportTab, setActiveReportTab] = useState<'ai' | 'api'>('ai');
    const [pipelineType, setPipelineType] = useState<'full' | 'images'>('full');
    const [deletionStatus, setDeletionStatus] = useState<{ address: string, tables: string[] } | null>(null);
    const [propertyStatuses, setPropertyStatuses] = useState<Record<string, PropertyStatusDetails>>({});
    const [sweepRunning, setSweepRunning] = useState(false);
    const [sweepResult, setSweepResult] = useState<{ deprecated: string[]; skipped: string[]; errors: string[] } | null>(null);
    const [smokeRunning, setSmokeRunning] = useState(false);
    const [smokeProgress, setSmokeProgress] = useState<{ done: number; total: number } | null>(null);
    const [smokeSummary, setSmokeSummary] = useState<CitySmokeSummary | null>(null);
    const [smokeExpanded, setSmokeExpanded] = useState<Set<string>>(new Set());
    const [smokeFilter, setSmokeFilter] = useState<'all' | 'failed' | 'warned'>('all');
    const [groupPages, setGroupPages] = useState<Record<string, number>>({});
    const GROUP_PAGE_SIZE = 20;
    const [availableCities, setAvailableCities] = useState<string[]>([]);
    const [cityQuery, setCityQuery] = useState('');
    const [showCitySuggestions, setShowCitySuggestions] = useState(false);

    // City Neighborhood Mining
    const [neighborhoodMining, setNeighborhoodMining] = useState(false);
    const [neighborhoodMiningStatus, setNeighborhoodMiningStatus] = useState<string>('');
    const [cachedNeighborhoodCount, setCachedNeighborhoodCount] = useState<number | null>(null);

    // Load cities from city_zip_cache filtered to SUPPORTED_STATES on mount
    useEffect(() => {
        getCachedCities(SUPPORTED_STATES).then(setAvailableCities).catch(() => { });
    }, []);

    // Check cached neighborhood count whenever city changes
    useEffect(() => {
        if (!city) { setCachedNeighborhoodCount(null); return; }
        (async () => {
            try {
                const { generateCityStateKey } = await import('../../services/firebase/config');
                const { getCityNeighborhoodsFromCloud } = await import('../../services/firebase/properties');
                // Resolve state same way as Run City Level Reports
                let s = stateFilter && stateFilter !== 'ALL' ? stateFilter : 'CA';
                const key = generateCityStateKey(city, s);
                if (!key) return;
                const cached = await getCityNeighborhoodsFromCloud(key);
                setCachedNeighborhoodCount(cached?.neighborhoods?.length || 0);
            } catch { setCachedNeighborhoodCount(null); }
        })();
    }, [city, stateFilter]);


    const availableStates = useMemo(() => {
        const states = new Set<string>();
        listings.forEach(item => {
            if (item.location?.address?.state_code) {
                states.add(item.location?.address?.state_code);
            }
        });
        return Array.from(states).sort();
    }, [listings]);

    // Reset group pages when listings or state filter changes
    React.useEffect(() => { setGroupPages({}); }, [listings, stateFilter]);

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

    const formatIngestionIdentifier = (id: string | null | undefined, address?: string) => {
        if (address) return address;
        if (!id) return '--';
        if (zpidToAddressMap[id]) return zpidToAddressMap[id];

        // Handle Regional Research (city-state) keys
        if (id.includes('-') && id.split('-').length === 2) {
            const [c, s] = id.split('-');
            const prettyCity = c.charAt(0).toUpperCase() + c.slice(1);
            const prettyState = s.toUpperCase();
            return `Regional Research: ${prettyCity}, ${prettyState}`;
        }
        return id;
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

    // IDs visible in the current state-filtered view
    const visibleIds = useMemo(() =>
        new Set(Object.values(groupedListings)
            .flat()
            .map((item: any) => String(item.property_id || item.listing_id || item.mls_id || item.mls?.id))
        ),
        [groupedListings]);

    // How many selected IDs are actually visible right now — used for button counts
    const visibleSelectedCount = useMemo(() =>
        Array.from(selectedIds).filter(id => visibleIds.has(id)).length,
        [selectedIds, visibleIds]);


    const selectAll = () => {
        // Replace selection with only the currently-visible (state-filtered) listings
        setSelectedIds(new Set(visibleIds));
    };

    const deselectAll = () => {
        setSelectedIds(new Set());
    };

    const selectUnsecured = () => {
        const targetIds = Object.values(groupedListings)
            .flat()
            .filter((item: any) => {
                const id = String(item.property_id || item.listing_id || item.mls_id || item.mls?.id);
                return !propertyStatuses[id]?.assets?.images;
            })
            .map((item: any) => String(item.property_id || item.listing_id || item.mls_id || item.mls?.id));

        setSelectedIds(new Set(targetIds));
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
            const fullAddress = centralFormatAddress(item.location?.address) || (item.location?.address?.line || id);
            return {
                zpid: id,
                address: fullAddress,
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

                // If property doesn't have a real ZPID, it's a "ghost" listing that will fail downstream.
                // We should remove it from the zip cache so it doesn't reappear in future scans.
                const hasRealZpid = item.zpid || (item.property_id && !String(item.property_id).includes('.')); // Math.random often has decimals
                if (!hasRealZpid) {
                    const zip = item.location?.address?.postal_code;
                    if (zip) {
                        addLog(`[System] Removing ghost listing with no ZPID from cache: ${builtAddress}`);
                        await removePropertyFromZipCache(zip, zpid);
                        // Refresh local state by removing it from listings
                        setListings(prev => prev.filter(l => String(l.property_id || l.listing_id || l.mls_id || l.mls?.id) !== zpid));
                    }
                    setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, status: 'error', error: 'No valid ZPID found. Listing removed from cache.' } : j));
                    return false;
                }

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
        const duration = Date.now() - batchStartTime;
        logPipelineAudit('Secure Images', `${targets.length} properties`, successCount === targets.length ? 'success' : 'partial', `${successCount}/${targets.length} succeeded`, duration, { successCount, total: targets.length });
        setLoading(false);
        if (successCount === targets.length) setSelectedIds(new Set());
    };

    const handleBulkPropertyData = async () => {
        if (selectedIds.size === 0) return;
        setLoading(true);
        setError(null);
        setViewMode('ingestion');
        setPipelineType('images'); // reuse ingestion view
        setIngestionReport(null);
        addLog(`Starting Property Data pipeline (RapidAPI only, no images)...`);

        const targets = listings.filter(l => {
            const id = String(l.property_id || l.listing_id || l.mls_id || l.mls?.id);
            return selectedIds.has(id);
        });
        addLog(`Processing ${targets.length} properties...`);

        const newJobs: IngestionJob[] = targets.map(item => {
            const id = String(item.property_id || item.listing_id || item.mls_id || item.mls?.id);
            const fullAddress = centralFormatAddress(item.location?.address) || (item.location?.address?.line || id);
            return { zpid: id, address: fullAddress, status: 'pending', progress: null };
        });
        setIngestionQueue(newJobs);

        const CHUNK_SIZE = 2; // RapidAPI: 2 requests/sec max
        const INTER_CHUNK_DELAY_MS = 1000; // 1s between chunks to stay within rate limit
        let successCount = 0;

        for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
            const chunk = targets.slice(i, i + CHUNK_SIZE);
            addLog(`Processing batch ${Math.floor(i / CHUNK_SIZE) + 1} of ${Math.ceil(targets.length / CHUNK_SIZE)}...`);

            const chunkPromises = chunk.map(async (item) => {
                const zpid = String(item.property_id || item.listing_id || item.mls_id || item.mls?.id);
                const addrObj = item.location?.address;
                const builtAddress = addrObj
                    ? `${addrObj.line}, ${addrObj.city}, ${addrObj.state_code} ${addrObj.postal_code}`
                    : (item.location?.address?.line || zpid);

                setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, status: 'running', startTime: Date.now() } : j));
                try {
                    await runPropertyDataOnlyPipeline(builtAddress, (progress) => {
                        setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, progress } : j));
                    }, zpid, (msg) => addLog(`[${builtAddress}] ${msg}`));
                    setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, status: 'completed', endTime: Date.now() } : j));
                    return true;
                } catch (e: any) {
                    setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, status: 'error', error: e.message } : j));
                    return false;
                }
            });

            const results = await Promise.all(chunkPromises);
            successCount += results.filter(r => r === true).length;
            if (i + CHUNK_SIZE < targets.length) await new Promise(r => setTimeout(r, INTER_CHUNK_DELAY_MS));
        }


        addLog(`Property Data Complete. ${successCount} / ${targets.length} saved.`);
        logPipelineAudit('Full Property Data', `${targets.length} properties`, successCount === targets.length ? 'success' : 'partial', `${successCount}/${targets.length} saved`, undefined, { successCount, total: targets.length });
        setLoading(false);
        if (successCount === targets.length) setSelectedIds(new Set());
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
            const addrObj = item.location?.address;
            const fullAddress = addrObj
                ? `${addrObj.line}, ${addrObj.city}, ${addrObj.state_code} ${addrObj.postal_code}`
                : (item.location?.address?.line || id);
            return {
                zpid: id,
                address: fullAddress,
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

        // Phase 1 (city-level intelligence warm-up) is intentionally skipped here.
        // Deep Research, Community Pulse, and Market Intelligence are city-level tasks
        // that run separately via the "Run City Research" button — not per-property ingestion.


        const CHUNK_SIZE = 3; // 3 parallel properties × ~5 Gemini calls each = ~15 concurrent requests (safe limit)
        let successCount = 0;

        for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
            const chunk = targets.slice(i, i + CHUNK_SIZE);
            addLog(`Phase 2: Processing batch ${Math.floor(i / CHUNK_SIZE) + 1} of ${Math.ceil(targets.length / CHUNK_SIZE)} (${chunk.length} properties)...`);

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
                    const { zpid: resultZpid, warnings } = await runFullIntelligencePipeline(builtAddress, (progress) => {
                        // Accumulate AI sub-task outcomes
                        if (progress.step.startsWith('AI:')) {
                            const name = progress.step.replace('AI:', '');
                            const outcome = progress.status === 'error' ? 'failed' as const
                                : progress.status === 'pending' ? 'skipped' as const
                                : progress.message === 'Cache hit' ? 'cached' as const
                                : 'ran' as const;
                            setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? {
                                ...j,
                                completedSteps: [...(j.completedSteps || []), { name, outcome }]
                            } : j));
                        } else {
                            setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, progress } : j));
                        }
                    }, zpid, userId, (msg) => addLog(`[${builtAddress}] ${msg}`), true);

                    if (warnings && warnings.length > 0) {
                        addLog(`Completed with warnings for: ${builtAddress} — ${warnings.join(', ')} needs retry.`);
                        setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? {
                            ...j,
                            status: 'partial',
                            endTime: Date.now(),
                            error: `Needs retry: ${warnings.join(', ')}`
                        } : j));
                        return 'partial';
                    } else {
                        addLog(`Successfully completed intelligence suite for: ${builtAddress}`);
                        setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, status: 'completed', endTime: Date.now() } : j));
                        return true;
                    }
                } catch (e: any) {
                    console.error(`Ingestion failed for ${zpid}:`, e);
                    setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, status: 'error', error: e.message } : j));
                    return false;
                }
            });

            // Wait for current batch to complete
            const results = await Promise.all(chunkPromises);
            successCount += results.filter(r => r === true).length;
            const partialCount = results.filter(r => r === 'partial').length;
            if (partialCount > 0) addLog(`${partialCount} properties completed with warnings (Visual AI needs retry).`);

            // Rest between chunks — give Gemini quota time to recover before next burst
            if (i + CHUNK_SIZE < targets.length) {
                addLog(`[System] Cooling down 5s before next batch...`);
                await new Promise(r => setTimeout(r, 5000));
            }
        }

        const partialTotal = ingestionQueue.filter(j => j.status === 'partial').length;
        const ingestDuration = Date.now() - batchStartTime;
        addLog(`Bulk Ingest Complete. ${successCount} fully processed, ${partialTotal} partial (need retry) / ${targets.length} total.`);
        logPipelineAudit('Full Intel Suite', `${targets.length} properties`, successCount === targets.length ? 'success' : (successCount > 0 ? 'partial' : 'error'), `${successCount} done, ${partialTotal} partial, ${targets.length - successCount - partialTotal} failed`, ingestDuration, { successCount, partialTotal, total: targets.length });
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


    const fetchListings = async (zip: string, fallbackCity?: string, fallbackState?: string, forceRefresh = false) => {
        const config = APP_CONFIG.usHousingApi;

        // 1. Cloud Cache (skip on force refresh)
        if (!forceRefresh) {
            try {
                const cloudCached = await getZipListings(zip);
                if (cloudCached && (cloudCached.listings?.length ?? 0) > 0) {
                    const allCached = cloudCached.listings || [];
                    const cachedListings = allCached
                        .filter((item: any) => !!(item.zpid || item.property_id || item.listing_id || item.id || item.mls_id))
                        .map((item: any) => ({
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
                    // If ghost listings were removed, persist the clean list back to Firestore
                    const removed = allCached.length - cachedListings.length;
                    if (removed > 0) {
                        addLog(`Cleaned ${removed} ghost listing(s) with no ZPID from cache for zip ${zip}`);
                        saveZipListings(zip, cachedListings).catch(console.error);
                    }
                    addLog(`Cloud Cache Hit for Zip: ${zip} (${cachedListings.length} items)`);
                    return cachedListings;
                }
            } catch (e) {
                console.warn('Cloud cache check failed', e);
            }
        }

        // 2. RESO (if configured)
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
                        saveZipListings(zip, resoListings).catch(console.error);
                        return resoListings;
                    }
                } catch (e) {
                    addLog(`RESO Search failed, falling back to legacy: ${e}`);
                }
            }
        }

        // 3. Paginated RapidAPI fallback
        const baseUrl = `https://${config.host}/propertyExtendedSearch?location=${zip}&status_type=ForSale`;
        addLog(`Fetching live data (paginated) for ${zip}…`);

        const mapPage = (rawData: any[]) => rawData
            .filter((item: any) => !!(item.zpid || item.property_id || item.listing_id || item.id || item.mls_id))
            .map((item: any) => {
            const legacyLoc = (item.location && typeof item.location === 'object') ? item.location : {};
            const legacyAddr = legacyLoc.address || {};
            const rawPrice = item.list_price || item.price || item.last_sale_price || 0;
            const numericPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;
            return {
                ...item,
                property_id: String(item.property_id || item.zpid || item.listing_id || item.id || item.mls_id || Math.random()),
                location: {
                    address: {
                        line: legacyAddr.line || item.address || item.streetAddress || item.full_address || 'Unknown Address',
                        city: legacyAddr.city || item.city || item.town || fallbackCity || 'Unknown City',
                        state_code: legacyAddr.state_code || item.state || item.state_code || item.stateId || fallbackState || 'Unknown State',
                        postal_code: legacyAddr.postal_code || item.zipcode || item.zipCode || item.postal_code || zip
                    }
                },
                list_price: numericPrice,
                primary_photo: item.primary_photo || (item.imgSrc || item.main_image ? { href: item.imgSrc || item.main_image } : null)
            };
        });

        try {
            const allData: any[] = [];

            // Page 1
            const resp1 = await fetch(`${baseUrl}&page=1`, {
                method: 'GET',
                headers: { 'X-RapidAPI-Key': config.key, 'X-RapidAPI-Host': config.host }
            });
            if (!resp1.ok) {
                const txt = await resp1.text();
                addLog(`API Error for ${zip}: ${resp1.status} - ${txt}`);
                return [];
            }
            const result1 = await resp1.json();
            const raw1 = Array.isArray(result1) ? result1 : (result1.props || result1.results || []);
            const totalPages: number = result1.totalPages ?? result1.total_pages ?? 1;
            allData.push(...raw1);
            addLog(`  p1/${totalPages}: ${raw1.length} listings`);

            // Pages 2..N
            for (let p = 2; p <= totalPages; p++) {
                await new Promise(r => setTimeout(r, 1000));
                const respN = await fetch(`${baseUrl}&page=${p}`, {
                    method: 'GET',
                    headers: { 'X-RapidAPI-Key': config.key, 'X-RapidAPI-Host': config.host }
                });
                if (!respN.ok) {
                    addLog(`  p${p} error: ${respN.status} — stopping pagination`);
                    break;
                }
                const resultN = await respN.json();
                const rawN = Array.isArray(resultN) ? resultN : (resultN.props || resultN.results || []);
                allData.push(...rawN);
                addLog(`  p${p}/${totalPages}: ${rawN.length} listings`);
            }

            const data = mapPage(allData);
            addLog(`Live API returned ${data.length} total listings for ${zip} (${totalPages} page${totalPages !== 1 ? 's' : ''})`);

            if (data.length > 0) {
                saveZipListings(zip, data).catch(console.error);
            }
            return data;
        } catch (e: any) {
            addLog(`Fetch failed for ${zip}: ${e.message}`);
            return [];
        }
    };

    const handleSearch = async (forceRefresh = false) => {
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
                    // zipsByState keys may be full names (e.g. "California") — resolve via STATE_NAME_MAP
                    const supportedUpper = SUPPORTED_STATES.map(s => s.toUpperCase());
                    const resolveState = (s: string) => STATE_NAME_MAP[s.toLowerCase()] || s.toUpperCase();
                    const filteredZips = Object.entries(cachedGroups)
                        .filter(([state]) => supportedUpper.includes(resolveState(state)))
                        .flatMap(([, zips]) => zips);
                    if (filteredZips.length > 0) {
                        const statesFound = Object.keys(cachedGroups)
                            .filter(s => supportedUpper.includes(resolveState(s))).join(', ');
                        addLog(`Cloud Cache Hit for City: ${normalizedCity}. Found ${filteredZips.length} zips across [${statesFound}].`);
                        targetZips = filteredZips;
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

                        foundEntries = foundEntries.filter(z => z.zip && typeof z.zip === 'string' && SUPPORTED_STATES.includes(z.state));
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
                        // st may be a full name like "California" — normalize to 2-letter code
                        const stateCode = STATE_NAME_MAP[st.toLowerCase()] || (st.length === 2 ? st.toUpperCase() : st);
                        zips.forEach(z => {
                            zipRegistry[z] = { city: city.trim(), state: stateCode };
                        });
                    });
                }
            }

            for (const zip of zipsToScan) {
                const fallback = zipRegistry[zip];
                const zipListings = await fetchListings(zip, fallback?.city, fallback?.state, forceRefresh);
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
            logPipelineAudit('Launch Ingestion', city.trim(), 'success', `${results.length} listings found across ${targetZips.length} zips`, undefined, { listingsCount: results.length, zipsScanned: targetZips.length });

            // Update state
            setListings(results);

            if (results.length === 0) {
                setError('No listings found in the resolved areas.');
            }

        } catch (err: any) {
            console.error(err);
            addLog(`Critical Error: ${err.message}`);
            setError(err.message || 'Workflow failed. See log.');
            logPipelineAudit('Launch Ingestion', city.trim(), 'error', err.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    // ── Smoke Test ────────────────────────────────────────────────────────────
    const handleSmokeTest = async () => {
        if (cachedPropertyIds.size === 0) {
            addLog('Load listings and check cache first before running the smoke test.');
            return;
        }
        setSmokeRunning(true);
        setSmokeProgress(null);
        setSmokeSummary(null);
        setSmokeExpanded(new Set());
        addLog(`Starting smoke test for ${cachedPropertyIds.size} cached properties...`);
        try {
            const zpids = Array.from(cachedPropertyIds) as string[];
            const summary = await runCitySmokeTest(zpids, (done, total) => {
                setSmokeProgress({ done, total });
            }, zpidToAddressMap);
            setSmokeSummary(summary);
            addLog(`Smoke test complete: ${summary.passedCount}/${summary.totalProperties} passed, ${summary.failedCount} with errors.`);
            logPipelineAudit('Smoke Test', `${cachedPropertyIds.size} properties`, summary.failedCount === 0 ? 'success' : 'partial', `${summary.passedCount} passed, ${summary.failedCount} failed`, undefined, { passed: summary.passedCount, failed: summary.failedCount, total: summary.totalProperties });
        } catch (e: any) {
            addLog(`Smoke test failed: ${e.message}`);
        } finally {
            setSmokeRunning(false);
            setSmokeProgress(null);
        }
    };

    const handleDeprecationSweep = async () => {
        if (listings.length === 0) {
            addLog('Please search and load listings first before running Refresh Active Listings.');
            return;
        }

        setSweepRunning(true);
        setSweepResult(null);
        addLog('Starting Refresh Active Listings...');

        try {
            // Collect ALL active ZPIDs + the unique city names from the currently-loaded listings.
            // scopedCities ensures we ONLY deprecate properties from cities we actually searched —
            // properties from other cities (e.g. Dublin when only Pleasanton is loaded) are left untouched.
            const allActiveZpids = new Set<string>();
            const scopedCities = new Set<string>();

            listings.forEach(item => {
                const zpid = String(item.property_id || item.listing_id || item.mls_id || item.mls?.id || '');
                if (zpid) allActiveZpids.add(zpid);
                const city = item.location?.address?.city || '';
                if (city) scopedCities.add(city);
            });

            addLog(`[Sweep] ${allActiveZpids.size} active ZPIDs across cities: ${Array.from(scopedCities).join(', ')}`);
            const result = await runDeprecationSweep(allActiveZpids, scopedCities, `${listings.length} listings`, addLog);

            setSweepResult({ deprecated: result.deprecated, skipped: result.skipped, errors: result.errors });
            addLog(`Refresh complete! Off Market: ${result.deprecated.length}, Active: ${result.skipped.length}, Errors: ${result.errors.length}`);
            logPipelineAudit('Refresh Active Listings', Array.from(scopedCities).join(', '), result.errors.length === 0 ? 'success' : 'partial', `${result.deprecated.length} off market, ${result.skipped.length} active, ${result.errors.length} errors`, undefined, { deprecated: result.deprecated.length, active: result.skipped.length, errors: result.errors.length });
        } catch (e: any) {
            addLog(`Refresh Active Listings failed: ${e.message}`);
            logPipelineAudit('Refresh Active Listings', city || 'unknown', 'error', e.message);
        } finally {
            setSweepRunning(false);
        }
    };


    const loadAuditTrail = useCallback(async () => {
        setAuditLoading(true);
        try {
            const entries = await getPipelineAuditTrail(200);
            setAuditEntries(entries);
        } catch (e) {
            console.error('Failed to load audit trail:', e);
        } finally {
            setAuditLoading(false);
        }
    }, []);

    // Table Row Component
    const ListingRow = ({ item }: { item: any, key?: any }) => {
        const itemId = String(item.property_id || item.listing_id || item.mls_id || item.mls?.id);
        const isSelected = selectedIds.has(itemId);
        const isCached = cachedPropertyIds.has(itemId);
        const isDeprecated = sweepResult?.deprecated.includes(itemId) ?? false;

        return (
            <tr
                className={`transition-all duration-300 border-b border-slate-100 last:border-0 
                    ${isDeprecated ? 'bg-amber-50/30 opacity-60' : isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50'} 
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
                            {isDeprecated && (
                                <div className="absolute inset-0 bg-amber-100/60 flex items-center justify-center">
                                    <i className="fa-solid fa-ban text-amber-600 text-base"></i>
                                </div>
                            )}
                            {!isDeprecated && isCached && (
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
                                        const fullAddress = centralFormatAddress(item.location?.address) || (item.location?.address?.line || itemId);
                                        window.open(`${window.location.origin}/?q=${encodeURIComponent(fullAddress)}&zpid=${itemId}`, '_blank');
                                    }}
                                    className="font-bold text-slate-900 text-sm hover:text-indigo-600 hover:underline text-left transition-colors"
                                >
                                    {item.location?.address?.line || 'Unknown Address'}
                                </button>
                                {isDeprecated && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 border border-amber-200 text-amber-700 text-[8px] font-black uppercase tracking-widest rounded-lg">
                                        <i className="fa-solid fa-ban text-[7px]"></i> Deprecated
                                    </span>
                                )}
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
                                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                                    <button
                                        onClick={selectUnsecured}
                                        className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-amber-600 transition-all"
                                        title="Select properties without images in Firebase Storage"
                                    >
                                        Select Unsecured
                                    </button>
                                </div>
                            )}

                            {visibleSelectedCount > 0 && (
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleBulkSecureImages}
                                        className="px-6 py-3 bg-white border-2 border-slate-200 hover:border-indigo-400 hover:bg-slate-50 text-slate-700 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest shadow-sm transition-all animate-in slide-in-from-right flex items-center gap-3 group"
                                    >
                                        <i className="fa-solid fa-cloud-arrow-down text-indigo-500 group-hover:bounce"></i>
                                        Secure Images ({visibleSelectedCount})
                                    </button>
                                    <button
                                        onClick={handleBulkPropertyData}
                                        disabled={loading}
                                        className="px-6 py-3 bg-white border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 text-slate-700 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest shadow-sm transition-all animate-in slide-in-from-right flex items-center gap-3 group disabled:opacity-50"
                                        title="Fetch property specs & scores from RapidAPI only — no images, no AI"
                                    >
                                        <i className="fa-solid fa-database text-emerald-500 group-hover:scale-110 transition-transform"></i>
                                        Full Property Data ({visibleSelectedCount})
                                    </button>



                                    <button
                                        onClick={handleBulkIngest}
                                        disabled={loading}
                                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-[1.2rem] text-sm font-black shadow-lg shadow-indigo-200 transition-all animate-in slide-in-from-right flex items-center gap-3 group"
                                    >
                                        <i className="fa-solid fa-bolt-lightning group-hover:scale-125 transition-transform"></i>
                                        Full Intel Suite ({visibleSelectedCount})
                                    </button>
                                </div>
                            )}
                            {/* Refresh Active Listings + Smoke Test — visible whenever listings are loaded */}
                            {listings.length > 0 && (
                                <div className="flex items-center gap-3 ml-auto">
                                    {/* Smoke Test button — only when we have cached properties to test */}
                                    {cachedPropertyIds.size > 0 && (
                                        <button
                                            onClick={handleSmokeTest}
                                            disabled={smokeRunning || loading}
                                            className="px-6 py-3 bg-white border-2 border-violet-200 hover:border-violet-400 hover:bg-violet-50 text-slate-700 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest shadow-sm transition-all animate-in slide-in-from-right flex items-center gap-3 group disabled:opacity-50"
                                            title="Run completeness and sanity checks across all cached properties"
                                        >
                                            {smokeRunning ? (
                                                <>
                                                    <i className="fa-solid fa-spinner animate-spin text-violet-400"></i>
                                                    {smokeProgress ? `Testing ${smokeProgress.done}/${smokeProgress.total}...` : 'Initializing...'}
                                                </>
                                            ) : (
                                                <><i className="fa-solid fa-flask text-violet-400 group-hover:scale-110 transition-transform"></i>Smoke Test</>
                                            )}
                                        </button>
                                    )}
                                    {smokeSummary && !smokeRunning && (
                                        <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-2xl animate-in fade-in">
                                            <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest">Test:</span>
                                            <span className="text-[11px] font-black text-emerald-600">{smokeSummary.passedCount} pass</span>
                                            {smokeSummary.failedCount > 0 && (<><span className="text-slate-300">|</span><span className="text-[11px] font-black text-rose-600">{smokeSummary.failedCount} errors</span></>)}
                                            <button onClick={() => setSmokeSummary(null)} className="w-5 h-5 flex items-center justify-center text-violet-300 hover:text-violet-500 transition-colors ml-1">
                                                <i className="fa-solid fa-xmark text-[10px]"></i>
                                            </button>
                                        </div>
                                    )}
                                    <button
                                        onClick={handleDeprecationSweep}
                                        disabled={sweepRunning || loading}
                                        className="px-6 py-3 bg-white border-2 border-rose-200 hover:border-rose-400 hover:bg-rose-50 text-slate-700 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest shadow-sm transition-all animate-in slide-in-from-right flex items-center gap-3 group disabled:opacity-50"
                                        title="Compare properties in Firestore against current listings and mark unlisted ones as off market"
                                    >
                                        {sweepRunning ? (
                                            <><i className="fa-solid fa-spinner animate-spin text-rose-400"></i>Refreshing...</>
                                        ) : (
                                            <><i className="fa-solid fa-arrows-rotate text-rose-400 group-hover:scale-110 transition-transform"></i>Refresh Active Listings</>
                                        )}
                                    </button>
                                    {sweepResult && (
                                        <div className="flex items-center gap-3 px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-2xl animate-in fade-in">
                                            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Result:</span>
                                            <span className="text-[11px] font-black text-rose-700">{sweepResult.deprecated.length} off market</span>
                                            <span className="text-slate-300">|</span>
                                            <span className="text-[11px] font-semibold text-emerald-600">{sweepResult.skipped.length} active</span>
                                            {sweepResult.errors.length > 0 && (<><span className="text-slate-300">|</span><span className="text-[11px] font-semibold text-amber-600">{sweepResult.errors.length} errors</span></>)}
                                            <button onClick={() => setSweepResult(null)} className="w-5 h-5 flex items-center justify-center text-rose-300 hover:text-rose-500 transition-colors ml-1">
                                                <i className="fa-solid fa-xmark text-[10px]"></i>
                                            </button>
                                        </div>
                                    )}
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
                            <div className="relative">
                                <i className="fa-solid fa-city absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm" />
                                <input
                                    type="text"
                                    value={cityQuery}
                                    onChange={(e) => {
                                        setCityQuery(e.target.value);
                                        setCity(e.target.value);
                                        setShowCitySuggestions(true);
                                    }}
                                    onFocus={() => setShowCitySuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowCitySuggestions(false), 150)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && cityQuery.trim()) {
                                            setShowCitySuggestions(false);
                                            handleSearch();
                                        }
                                        if (e.key === 'Escape') setShowCitySuggestions(false);
                                    }}
                                    placeholder="Search city…"
                                    disabled={loading}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-sm shadow-inner disabled:opacity-50"
                                />
                                {showCitySuggestions && availableCities.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50">
                                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cities — {SUPPORTED_STATES.join(', ')}</span>
                                            <span className="text-[9px] text-slate-300 font-medium">
                                                {availableCities.filter(c => !cityQuery || c.toLowerCase().includes(cityQuery.toLowerCase())).length} cities
                                            </span>
                                        </div>
                                        <div className="max-h-[220px] overflow-y-auto p-1.5">
                                            {availableCities
                                                .filter(c => !cityQuery || c.toLowerCase().includes(cityQuery.toLowerCase()))
                                                .map(c => (
                                                    <button
                                                        key={c}
                                                        onMouseDown={() => {
                                                            setCityQuery(c);
                                                            setCity(c);
                                                            setShowCitySuggestions(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-indigo-50 text-slate-700 text-xs font-medium transition-colors flex items-center gap-3 group"
                                                    >
                                                        <i className="fa-solid fa-location-dot text-slate-300 group-hover:text-indigo-400 transition-colors text-[10px]" />
                                                        {c}
                                                    </button>
                                                ))
                                            }
                                        </div>
                                    </div>
                                )}
                            </div>
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
                                    if (!city) { addLog('Please enter a city name.'); return; }
                                    setLoading(true);
                                    setListings([]);
                                    setStateFilter('ALL');
                                    const normalizedCity = city.trim();
                                    addLog(`[Cache Refresh] Resolving zips for ${normalizedCity}...`);

                                    // Resolve zips
                                    const cachedGroups = await getZipsForCity(normalizedCity);
                                    if (!cachedGroups) {
                                        addLog('⚠ No zips found in city_zip_cache. Run ingestion first.');
                                        setLoading(false);
                                        return;
                                    }
                                    const supportedUpper = SUPPORTED_STATES.map(s => s.toUpperCase());
                                    const resolveState = (s: string) => STATE_NAME_MAP[s.toLowerCase()] || s.toUpperCase();
                                    const allZips = Object.entries(cachedGroups)
                                        .filter(([state]) => supportedUpper.includes(resolveState(state)))
                                        .flatMap(([, zips]) => zips);
                                    const uniqueZips = [...new Set(allZips)];

                                    // Build a zip → state code lookup from cachedGroups
                                    const zipStateMap: Record<string, string> = {};
                                    Object.entries(cachedGroups).forEach(([st, zips]) => {
                                        const stateCode = resolveState(st);
                                        zips.forEach(z => { zipStateMap[z] = stateCode; });
                                    });

                                    if (uniqueZips.length === 0) {
                                        addLog('⚠ No supported-state zips found.');
                                        setLoading(false);
                                        return;
                                    }

                                    const config = APP_CONFIG.usHousingApi;
                                    addLog(`[Cache Refresh] Force-refreshing ${uniqueZips.length} zips (ForSale + RecentlySold)...`);

                                    const allForSaleResults: any[] = [];

                                    for (let i = 0; i < uniqueZips.length; i++) {
                                        const zip = uniqueZips[i];
                                        const fallbackState = zipStateMap[zip] || 'Unknown State';
                                        addLog(`  [${i + 1}/${uniqueZips.length}] Zip ${zip}...`);

                                        // ForSale listings
                                        try {
                                            const allForSale: any[] = [];
                                            let page = 1;
                                            let totalPages = 1;
                                            while (page <= totalPages) {
                                                const resp = await fetch(
                                                    `https://${config.host}/propertyExtendedSearch?location=${zip}&status_type=ForSale&page=${page}`,
                                                    { headers: { 'X-RapidAPI-Key': config.key, 'X-RapidAPI-Host': config.host } }
                                                );
                                                if (!resp.ok) { addLog(`    ForSale p${page} error: ${resp.status}`); break; }
                                                const result = await resp.json();
                                                const items = Array.isArray(result) ? result : (result.props || result.results || []);
                                                totalPages = result.totalPages ?? result.total_pages ?? 1;
                                                allForSale.push(...items);
                                                addLog(`    ForSale p${page}/${totalPages}: ${items.length}`);
                                                page++;
                                                if (page <= totalPages) await new Promise(r => setTimeout(r, 1000));
                                            }
                                            if (allForSale.length > 0) {
                                                // Normalize listings WITH fallback state before saving to cache
                                                const mapped = allForSale.map((item: any) => {
                                                    const legacyLoc = (item.location && typeof item.location === 'object') ? item.location : {};
                                                    const legacyAddr = legacyLoc.address || {};
                                                    const rawPrice = item.list_price || item.price || item.last_sale_price || 0;
                                                    const numericPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;
                                                    return {
                                                        ...item,
                                                        property_id: String(item.property_id || item.zpid || item.listing_id || item.id || item.mls_id || Math.random()),
                                                        location: {
                                                            address: {
                                                                line: legacyAddr.line || item.address || item.streetAddress || item.full_address || 'Unknown Address',
                                                                city: legacyAddr.city || item.city || item.town || normalizedCity || 'Unknown City',
                                                                state_code: legacyAddr.state_code || item.state || item.state_code || item.stateId || fallbackState || 'Unknown State',
                                                                postal_code: legacyAddr.postal_code || item.zipcode || item.zipCode || item.postal_code || zip
                                                            }
                                                        },
                                                        list_price: numericPrice,
                                                        primary_photo: item.primary_photo || (item.imgSrc || item.main_image ? { href: item.imgSrc || item.main_image } : null)
                                                    };
                                                });
                                                await saveZipListings(zip, mapped);
                                                allForSaleResults.push(...mapped);
                                            }
                                            addLog(`    ✓ ForSale: ${allForSale.length} saved`);
                                        } catch (e: any) {
                                            addLog(`    ⚠ ForSale error: ${e.message}`);
                                        }

                                        // RecentlySold listings
                                        try {
                                            const allSold: any[] = [];
                                            let page = 1;
                                            let totalPages = 1;
                                            while (page <= totalPages) {
                                                const resp = await fetch(
                                                    `https://${config.host}/propertyExtendedSearch?location=${zip}&status_type=RecentlySold&soldInLast=6m&page=${page}`,
                                                    { headers: { 'X-RapidAPI-Key': config.key, 'X-RapidAPI-Host': config.host } }
                                                );
                                                if (!resp.ok) { addLog(`    Sold p${page} error: ${resp.status}`); break; }
                                                const result = await resp.json();
                                                const items = Array.isArray(result) ? result : (result.props || result.results || []);
                                                totalPages = result.totalPages ?? result.total_pages ?? 1;
                                                allSold.push(...items);
                                                addLog(`    Sold p${page}/${totalPages}: ${items.length}`);
                                                page++;
                                                if (page <= totalPages) await new Promise(r => setTimeout(r, 1000));
                                            }
                                            if (allSold.length > 0) await saveZipSoldListings(zip, allSold);
                                            addLog(`    ✓ Sold: ${allSold.length} saved`);
                                        } catch (e: any) {
                                            addLog(`    ⚠ Sold error: ${e.message}`);
                                        }

                                        // Brief pause between zips
                                        if (i < uniqueZips.length - 1) await new Promise(r => setTimeout(r, 500));
                                    }

                                    // Deduplicate and update the UI table
                                    const seenIds = new Set<string>();
                                    const deduped = allForSaleResults.filter(item => {
                                        const id = item.property_id || item.listing_id || item.mls_id || item.mls?.id;
                                        const addrId = item.location?.address?.line;
                                        const compositeId = id ? String(id) : (addrId ? addrId.toLowerCase().replace(/\s+/g, '') : null);
                                        if (!compositeId || seenIds.has(compositeId)) return false;
                                        seenIds.add(compositeId);
                                        return true;
                                    });
                                    setListings(deduped);
                                    addLog(`[Cache Refresh] Done. ${deduped.length} unique ForSale listings loaded. All zip caches refreshed for ${normalizedCity}.`);
                                    logPipelineAudit('Refresh Zip Listing Caches', normalizedCity, 'success', `${deduped.length} listings loaded, ${uniqueZips.length} zips refreshed`, undefined, { listings: deduped.length, zips: uniqueZips.length });
                                    setLoading(false);
                                }}
                                disabled={loading || !city}
                                title="Force refresh ForSale and RecentlySold zip listing caches for all zips in this city"
                                className="px-6 py-4 border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                            >
                                <i className="fa-solid fa-arrows-rotate" />
                                Refresh Zip Listing Caches
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

                                    // 1. If state missing, try to prioritize current active filter
                                    if (!s) {
                                        if (stateFilter && stateFilter !== 'ALL') {
                                            s = stateFilter;
                                        } else if (listings.length > 0) {
                                            const firstMatch = listings.find(l =>
                                                l.location?.address?.city?.toLowerCase() === c.toLowerCase()
                                            );
                                            if (firstMatch) {
                                                s = firstMatch.location?.address?.state_code || firstMatch.location?.address?.state;
                                            }
                                        }
                                    }

                                    // Normalize state (handle full names to codes)
                                    if (s) {
                                        const normState = s.trim().toUpperCase();
                                        s = (STATE_MAP[normState] || (normState.length === 2 ? normState : normState));
                                    }

                                    // 2. Secondary fallback for common testing
                                    if (!s) s = 'CA'; // Default to CA for speed in common regions

                                    const displayTarget = `${c}, ${s}`;
                                    addLog(`[Deep Research] Triggering for ${displayTarget}...`);

                                    try {
                                        const userId = auth?.currentUser?.uid || 'unknown';
                                        await runCityDeepResearch(c, s, userId, addLog);
                                        addLog(`[Deep Research] Complete for ${displayTarget}. Research is now live in DB.`);
                                        logPipelineAudit('Run City Level Reports', displayTarget, 'success', `Deep research complete for ${displayTarget}`);
                                    } catch (e: any) {
                                        addLog(`[Deep Research] Error for ${displayTarget}: ${e.message}`);
                                        logPipelineAudit('Run City Level Reports', displayTarget, 'error', e.message);
                                    }
                                    setLoading(false);
                                }}
                                disabled={loading || !city}
                                className="px-6 py-4 bg-white border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all flex items-center gap-3 disabled:opacity-50"
                                title="Run City Level Reports"
                            >
                                <i className="fa-solid fa-earth-americas text-emerald-500"></i>
                                Run City Level Reports
                            </button>
                            <button
                                onClick={async () => {
                                    if (!city) { addLog('Please enter a city name.'); return; }
                                    setNeighborhoodMining(true);
                                    setNeighborhoodMiningStatus('Starting...');

                                    let [c, s] = city.split(',').map(x => x.trim());
                                    if (!s) {
                                        if (stateFilter && stateFilter !== 'ALL') s = stateFilter;
                                        else if (listings.length > 0) {
                                            const firstMatch = listings.find((l: any) => l.location?.address?.city?.toLowerCase() === c.toLowerCase());
                                            if (firstMatch) s = firstMatch.location?.address?.state_code || firstMatch.location?.address?.state;
                                        }
                                    }
                                    if (s) {
                                        const normState = s.trim().toUpperCase();
                                        s = (STATE_MAP[normState] || (normState.length === 2 ? normState : normState));
                                    }
                                    if (!s) s = 'CA';

                                    addLog(`[City Neighborhoods] Mining neighborhoods for ${c}, ${s}...`);
                                    try {
                                        const { mineCityNeighborhoods } = await import('../../services/geminiService');
                                        const userId = auth?.currentUser?.uid || 'unknown';
                                        const result = await mineCityNeighborhoods(c, s, userId, (msg) => {
                                            setNeighborhoodMiningStatus(msg);
                                            addLog(msg);
                                        });
                                        const count = result.data?.neighborhoods?.length || 0;
                                        setCachedNeighborhoodCount(count);
                                        setNeighborhoodMiningStatus(`✓ ${count} neighborhoods`);
                                        addLog(`[City Neighborhoods] ✓ Mined and cached ${count} neighborhoods for ${c}, ${s}.`);
                                        logPipelineAudit('Mine Neighborhoods', `${c}, ${s}`, 'success', `${count} neighborhoods mined and cached`);
                                    } catch (e: any) {
                                        setNeighborhoodMiningStatus(`✗ Failed`);
                                        addLog(`[City Neighborhoods] Error: ${e.message}`);
                                        logPipelineAudit('Mine Neighborhoods', `${c}, ${s}`, 'error', e.message);
                                    }
                                    setNeighborhoodMining(false);
                                }}
                                disabled={loading || !city || neighborhoodMining}
                                className={`px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2.5 disabled:opacity-50 ${
                                    cachedNeighborhoodCount && cachedNeighborhoodCount > 0
                                        ? 'bg-emerald-50 border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                        : 'bg-amber-50 border-2 border-amber-200 text-amber-700 hover:bg-amber-100'
                                }`}
                                title={cachedNeighborhoodCount ? `${cachedNeighborhoodCount} neighborhoods cached — click to re-mine` : 'Mine all neighborhoods for this city using Gemini 3 Flash Preview'}
                            >
                                {neighborhoodMining ? (
                                    <><i className="fa-solid fa-spinner animate-spin"></i> Mining...</>
                                ) : cachedNeighborhoodCount && cachedNeighborhoodCount > 0 ? (
                                    <><i className="fa-solid fa-check-circle"></i> {cachedNeighborhoodCount} Neighborhoods</>
                                ) : (
                                    <><i className="fa-solid fa-mountain-city"></i> Mine Neighborhoods</>
                                )}
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
                            <button
                                onClick={() => {
                                    loadAuditTrail();
                                    setViewMode('audit');
                                }}
                                className="p-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl transition-all"
                                title="View Audit Trail"
                            >
                                <i className="fa-solid fa-clock-rotate-left"></i>
                            </button>
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

            {/* ─── City Neighborhoods Intelligence Panel ──────────────────────────── */}
            {viewMode === 'table' && (
                <CityNeighborhoodsPanel cityHint={city} stateHint={stateFilter} />
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
                                {(Object.entries(groupedListings) as [string, any[]][]).map(([groupKey, groupItems]) => {
                                    const groupPage = groupPages[groupKey] ?? 1;
                                    const totalGroupPages = Math.max(1, Math.ceil(groupItems.length / GROUP_PAGE_SIZE));
                                    const safeGroupPage = Math.min(groupPage, totalGroupPages);
                                    const paginatedItems = groupItems.slice(
                                        (safeGroupPage - 1) * GROUP_PAGE_SIZE,
                                        safeGroupPage * GROUP_PAGE_SIZE
                                    );
                                    const setGroupPage = (p: number) =>
                                        setGroupPages(prev => ({ ...prev, [groupKey]: p }));

                                    return (
                                        <div key={groupKey} className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden animate-in fade-in slide-in-from-bottom-8">
                                            {/* Header */}
                                            <div className="p-8 border-b border-slate-50 bg-slate-50/20 flex items-center justify-between">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shadow-inner">
                                                        <i className="fa-solid fa-map-pin"></i>
                                                    </div>
                                                    <div>
                                                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{groupKey}</h2>
                                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{groupItems.length} Active Listings</span>
                                                            <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Market Live</span>
                                                        </div>
                                                        {/* Cache stats */}
                                                        {(() => {
                                                            const total = groupItems.length;
                                                            if (total === 0 || isCheckingCache) return null;
                                                            const stats = groupItems.reduce((acc, item) => {
                                                                const id = String(item.property_id || item.listing_id || item.mls_id || item.mls?.id);
                                                                const s = propertyStatuses[id];
                                                                if (!s) return acc;
                                                                if (s.assets?.images) acc.images++;
                                                                if (s.assets?.map) acc.maps++;
                                                                if (s.assets?.streetView) acc.street++;
                                                                if (s.assets?.satellite) acc.satellite++;
                                                                if (s.visual) acc.ai++;
                                                                if (s.property) acc.cached++;
                                                                return acc;
                                                            }, { images: 0, maps: 0, street: 0, satellite: 0, ai: 0, cached: 0 });

                                                            const pill = (icon: string, label: string, count: number, color: string) => (
                                                                <span key={label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${count === total ? `bg-${color}-50 border-${color}-200 text-${color}-700` : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                                                    <i className={`fa-solid ${icon} text-[8px]`}></i>
                                                                    {label}: {count}/{total}
                                                                </span>
                                                            );

                                                            return (
                                                                <div className="flex flex-wrap gap-1.5 mt-2.5">
                                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${stats.images === total ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : stats.images > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                                                        <i className="fa-solid fa-image text-[8px]"></i>
                                                                        Images: {stats.images}/{total}
                                                                    </span>
                                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${stats.maps === total ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : stats.maps > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                                                        <i className="fa-solid fa-map-location-dot text-[8px]"></i>
                                                                        Radar Maps: {stats.maps}/{total}
                                                                    </span>
                                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${stats.street === total ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : stats.street > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                                                        <i className="fa-solid fa-street-view text-[8px]"></i>
                                                                        Street View: {stats.street}/{total}
                                                                    </span>
                                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${stats.satellite === total ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : stats.satellite > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                                                        <i className="fa-solid fa-satellite text-[8px]"></i>
                                                                        Satellite: {stats.satellite}/{total}
                                                                    </span>
                                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${stats.ai === total ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : stats.ai > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                                                        <i className="fa-solid fa-brain text-[8px]"></i>
                                                                        AI Run: {stats.ai}/{total}
                                                                    </span>
                                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${stats.cached === total ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : stats.cached > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                                                        <i className="fa-solid fa-cloud text-[8px]"></i>
                                                                        Cached: {stats.cached}/{total}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })()}
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
                                                        {paginatedItems.map((item, idx) => (
                                                            <ListingRow key={idx} item={item} />
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Pagination */}
                                            {totalGroupPages > 1 && (
                                                <div className="px-8 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        {(safeGroupPage - 1) * GROUP_PAGE_SIZE + 1}–{Math.min(safeGroupPage * GROUP_PAGE_SIZE, groupItems.length)} of {groupItems.length}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setGroupPage(Math.max(1, safeGroupPage - 1))}
                                                            disabled={safeGroupPage === 1}
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[11px]"
                                                        >
                                                            <i className="fa-solid fa-chevron-left"></i>
                                                        </button>
                                                        {Array.from({ length: totalGroupPages }, (_, i) => i + 1).map(p => (
                                                            <button
                                                                key={p}
                                                                onClick={() => setGroupPage(p)}
                                                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-[10px] font-black transition-all ${p === safeGroupPage
                                                                    ? 'bg-indigo-600 text-white shadow-sm'
                                                                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                                                                    }`}
                                                            >
                                                                {p}
                                                            </button>
                                                        ))}
                                                        <button
                                                            onClick={() => setGroupPage(Math.min(totalGroupPages, safeGroupPage + 1))}
                                                            disabled={safeGroupPage === totalGroupPages}
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[11px]"
                                                        >
                                                            <i className="fa-solid fa-chevron-right"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
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

                    {/* ─── Smoke Test Results Panel ──────────────────────────────────────── */}
                    {smokeSummary && (
                        <div className="mt-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-100/60 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Header */}
                            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 bg-violet-50 rounded-2xl flex items-center justify-center">
                                        <i className="fa-solid fa-flask text-violet-500 text-lg"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-900">Smoke Test Results</h3>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                                            {smokeSummary.totalProperties} properties · ran {smokeSummary.ranAt.toLocaleTimeString()}
                                        </p>
                                    </div>
                                    {/* Summary pills */}
                                    <div className="flex items-center gap-2 ml-4">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest">
                                            <i className="fa-solid fa-circle-check text-[9px]"></i>{smokeSummary.passedCount} passed
                                        </span>
                                        {smokeSummary.failedCount > 0 && (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-[10px] font-black uppercase tracking-widest">
                                                <i className="fa-solid fa-circle-xmark text-[9px]"></i>{smokeSummary.failedCount} errors
                                            </span>
                                        )}
                                        {smokeSummary.results.some(r => r.warnCount > 0) && (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest">
                                                <i className="fa-solid fa-triangle-exclamation text-[9px]"></i>
                                                {smokeSummary.results.reduce((s, r) => s + r.warnCount, 0)} warnings
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {/* Filter toggle */}
                                    <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                                        {(['all', 'failed', 'warned'] as const).map(f => (
                                            <button key={f} onClick={() => setSmokeFilter(f)}
                                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${smokeFilter === f ? 'bg-white shadow text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
                                                {f === 'all' ? 'All' : f === 'failed' ? 'Errors Only' : 'With Warnings'}
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={() => setSmokeSummary(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            </div>
                            {/* Results table */}
                            <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                                {smokeSummary.results
                                    .filter(r => {
                                        if (smokeFilter === 'failed') return !r.passed;
                                        if (smokeFilter === 'warned') return r.warnCount > 0;
                                        return true;
                                    })
                                    .sort((a, b) => b.errorCount - a.errorCount || b.warnCount - a.warnCount)
                                    .map(result => {
                                        const isExpanded = smokeExpanded.has(result.zpid);
                                        return (
                                            <div key={result.zpid} className="group">
                                                {/* Row */}
                                                <div
                                                    className={`flex items-center gap-4 px-8 py-4 cursor-pointer hover:bg-slate-50/80 transition-colors ${result.errorCount > 0 ? 'bg-rose-50/20' : result.warnCount > 0 ? 'bg-amber-50/10' : ''}`}
                                                    onClick={() => setSmokeExpanded(prev => {
                                                        const next = new Set(prev);
                                                        isExpanded ? next.delete(result.zpid) : next.add(result.zpid);
                                                        return next;
                                                    })}
                                                >
                                                    {/* Status icon */}
                                                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${result.passed ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                        <i className={`fa-solid text-[11px] ${result.passed ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
                                                    </div>
                                                    {/* Address */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-bold text-slate-900 truncate">{result.address}</div>
                                                        <div className="text-[10px] text-slate-400 font-medium">{result.zpid}</div>
                                                    </div>
                                                    {/* Counts */}
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {result.errorCount > 0 && (
                                                            <span className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 text-[9px] font-black uppercase rounded-lg">
                                                                {result.errorCount} error{result.errorCount > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                        {result.warnCount > 0 && (
                                                            <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-black uppercase rounded-lg">
                                                                {result.warnCount} warn{result.warnCount > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                        {result.errorCount === 0 && result.warnCount === 0 && (
                                                            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-black uppercase rounded-lg">clean</span>
                                                        )}
                                                        <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-slate-300 text-[10px] ml-2`}></i>
                                                    </div>
                                                </div>
                                                {/* Expanded checks */}
                                                {isExpanded && (
                                                    <div className="px-12 pb-5 pt-1 grid grid-cols-2 lg:grid-cols-3 gap-2 bg-slate-50/40 border-t border-slate-100 animate-in fade-in duration-200">
                                                        {result.checks.map(check => (
                                                            <div key={check.id}
                                                                className={`flex items-start gap-2 px-3 py-2 rounded-xl border text-[10px] ${check.passed ? 'bg-white border-slate-100 text-slate-600' : check.severity === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                                                <i className={`fa-solid mt-0.5 text-[9px] shrink-0 ${check.passed ? 'fa-check text-emerald-500' : check.severity === 'error' ? 'fa-xmark text-rose-500' : 'fa-triangle-exclamation text-amber-500'}`}></i>
                                                                <div className="min-w-0">
                                                                    <div className="font-black truncate">{check.label}</div>
                                                                    {check.detail && <div className="font-medium opacity-70 truncate mt-0.5" title={check.detail}>{check.detail}</div>}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    )}

                    {/* Active Ingestion Jobs (Rich UI) */}
                    {viewMode === 'ingestion' && ingestionQueue.length > 0 && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-4">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Active Ingestion Jobs</h3>
                                <span className="px-5 py-2.5 bg-slate-100 rounded-2xl text-sm font-black text-slate-700 uppercase tracking-widest">
                                    {ingestionQueue.filter(q => q.status === 'completed').length} / {ingestionQueue.length} {pipelineType === 'images' ? 'Images Secured' : 'Reports Synthesized'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {ingestionQueue.map((item) => (
                                    <div key={item.zpid} className={`bg-white p-6 rounded-[2rem] border transition-all ${item.status === 'completed' ? 'border-emerald-100 shadow-emerald-50' : item.status === 'partial' ? 'border-amber-200 shadow-amber-50' : item.status === 'error' ? 'border-rose-100 shadow-rose-50' : 'border-slate-100 shadow-lg shadow-slate-200/50'}`}>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                                    item.status === 'partial' ? 'bg-amber-50 text-amber-600' :
                                                        item.status === 'error' ? 'bg-rose-50 text-rose-600' :
                                                            item.status === 'running' ? 'bg-indigo-50 text-indigo-600' :
                                                                'bg-slate-50 text-slate-400'
                                                    }`}>
                                                    <i className={`fa-solid ${item.status === 'completed' ? 'fa-circle-check' :
                                                        item.status === 'partial' ? 'fa-triangle-exclamation' :
                                                            item.status === 'error' ? 'fa-circle-xmark' :
                                                                item.status === 'running' ? 'fa-spinner animate-spin' :
                                                                    'fa-hourglass-start'
                                                        }`}></i>
                                                </div>
                                                {['completed', 'partial', 'error'].includes(item.status) ? (
                                                    <button
                                                        onClick={() => window.open(`${window.location.origin}/?q=${encodeURIComponent(item.address)}`, '_blank')}
                                                        className="text-sm font-black text-slate-900 truncate hover:text-indigo-600 hover:underline transition-colors text-left"
                                                    >
                                                        {item.address}
                                                    </button>
                                                ) : (
                                                    <span className="text-sm font-black text-slate-900 truncate">{item.address}</span>
                                                )}
                                            </div>
                                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${item.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                                item.status === 'partial' ? 'bg-amber-50 text-amber-600' :
                                                    item.status === 'error' ? 'bg-rose-50 text-rose-600' :
                                                        item.status === 'running' ? 'bg-indigo-50 text-indigo-600' :
                                                            'bg-slate-100 text-slate-400'
                                                }`}>
                                                {item.status === 'partial' ? 'Needs Retry' : item.status}
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

                                        {item.status === 'partial' && (
                                            <div className="space-y-2">
                                                {item.completedSteps && item.completedSteps.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {item.completedSteps.map((step, idx) => {
                                                            const colors = {
                                                                ran: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                                                cached: 'bg-blue-50 text-blue-700 border-blue-200',
                                                                skipped: 'bg-slate-50 text-slate-400 border-slate-200',
                                                                failed: 'bg-rose-50 text-rose-600 border-rose-200'
                                                            };
                                                            const icons = {
                                                                ran: 'fa-circle-check',
                                                                cached: 'fa-bolt-lightning',
                                                                skipped: 'fa-forward',
                                                                failed: 'fa-circle-xmark'
                                                            };
                                                            return (
                                                                <span key={idx}
                                                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${colors[step.outcome]}`}
                                                                >
                                                                    <i className={`fa-solid ${icons[step.outcome]} text-[8px]`}></i>
                                                                    {step.name}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                {item.error && (
                                                    <p className="text-[11px] text-amber-700 font-medium bg-amber-50 p-3 rounded-xl border border-amber-100">
                                                        <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                                                        {item.error}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {item.status === 'error' && (
                                            <p className="text-[11px] text-rose-600 font-medium bg-rose-50 p-3 rounded-xl border border-rose-100">
                                                <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                                                {item.error}
                                            </p>
                                        )}

                                        {item.status === 'completed' && (
                                            <div className="space-y-3">
                                                {/* Step breakdown */}
                                                {item.completedSteps && item.completedSteps.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {item.completedSteps.map((step, idx) => {
                                                            const colors = {
                                                                ran: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                                                cached: 'bg-blue-50 text-blue-700 border-blue-200',
                                                                skipped: 'bg-slate-50 text-slate-400 border-slate-200',
                                                                failed: 'bg-rose-50 text-rose-600 border-rose-200'
                                                            };
                                                            const icons = {
                                                                ran: 'fa-circle-check',
                                                                cached: 'fa-bolt-lightning',
                                                                skipped: 'fa-forward',
                                                                failed: 'fa-circle-xmark'
                                                            };
                                                            return (
                                                                <span
                                                                    key={idx}
                                                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${colors[step.outcome]}`}
                                                                >
                                                                    <i className={`fa-solid ${icons[step.outcome]} text-[8px]`}></i>
                                                                    {step.name}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between">
                                                    <button
                                                        onClick={() => window.open(`${window.location.origin}/?q=${encodeURIComponent(item.address)}&zpid=${item.zpid}`, '_blank')}
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
                                                            {formatIngestionIdentifier(logEntry.zpid, logEntry.address)}
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
                                                            {logEntry.raw_payload?.tools?.some((t: any) => t.googleSearch || t.google_search_retrieval) && (
                                                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded text-[9px] font-black uppercase tracking-tighter">
                                                                    <i className="fa-solid fa-earth-americas text-[8px]"></i>
                                                                    Grounded
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
                                                            {formatIngestionIdentifier(apiLog.zpid, apiLog.address)}
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

            {/* ── Audit Trail View ────────────────────────────────────────────── */}
            {viewMode === 'audit' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setViewMode('table')}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                            >
                                <i className="fa-solid fa-arrow-left"></i>
                                Back to City Data
                            </button>
                            <h2 className="text-2xl font-black text-slate-900">Pipeline Audit Trail</h2>
                        </div>
                        <button
                            onClick={loadAuditTrail}
                            disabled={auditLoading}
                            className="px-4 py-2 bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            <i className={`fa-solid fa-arrows-rotate ${auditLoading ? 'animate-spin' : ''}`}></i>
                            Refresh
                        </button>
                    </div>

                    {auditLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <i className="fa-solid fa-spinner animate-spin text-indigo-400 text-2xl"></i>
                        </div>
                    ) : auditEntries.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                            <i className="fa-solid fa-clipboard-list text-4xl mb-4 block"></i>
                            <p className="font-bold">No audit entries yet</p>
                            <p className="text-sm mt-1">Pipeline actions will appear here as you use the buttons above.</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50">
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Time</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Action</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Target</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Summary</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Duration</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">User</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditEntries.map((entry, idx) => {
                                        const statusColors = {
                                            success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                            partial: 'bg-amber-50 text-amber-700 border-amber-200',
                                            error: 'bg-rose-50 text-rose-700 border-rose-200',
                                        };
                                        const actionIcons: Record<string, string> = {
                                            'Launch Ingestion': 'fa-radar text-indigo-400',
                                            'Refresh Zip Listing Caches': 'fa-arrows-rotate text-amber-500',
                                            'Run City Level Reports': 'fa-earth-americas text-emerald-500',
                                            'Secure Images': 'fa-images text-sky-500',
                                            'Full Property Data': 'fa-database text-emerald-500',
                                            'Full Intel Suite': 'fa-bolt-lightning text-indigo-500',
                                            'Smoke Test': 'fa-flask text-violet-500',
                                            'Refresh Active Listings': 'fa-arrows-rotate text-rose-400',
                                        };
                                        const icon = actionIcons[entry.action] || 'fa-circle text-slate-400';
                                        const time = entry.startedAt ? new Date(entry.startedAt).toLocaleString() : '--';
                                        const duration = entry.durationMs
                                            ? entry.durationMs > 60000
                                                ? `${(entry.durationMs / 60000).toFixed(1)}m`
                                                : `${(entry.durationMs / 1000).toFixed(1)}s`
                                            : '--';

                                        return (
                                            <tr key={entry.id || idx} className="border-b border-slate-50 hover:bg-slate-25 transition-colors">
                                                <td className="p-4 text-xs text-slate-500 font-mono whitespace-nowrap">{time}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <i className={`fa-solid ${icon} text-sm`}></i>
                                                        <span className="text-xs font-bold text-slate-800">{entry.action}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-xs font-semibold text-slate-600 max-w-[200px] truncate" title={entry.target}>{entry.target}</td>
                                                <td className="p-4">
                                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${statusColors[entry.status]}`}>
                                                        {entry.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-xs text-slate-600 max-w-[300px]" title={entry.summary}>{entry.summary}</td>
                                                <td className="p-4 text-xs font-mono text-slate-500 text-right">{duration}</td>
                                                <td className="p-4 text-xs text-slate-400 truncate max-w-[120px]" title={entry.userName}>{entry.userName}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CityDataTab;

// ─── City Neighborhoods Intelligence Panel (sub-component) ───────────────────
const LAST_NH_CITY_KEY = 'zyphe_last_nh_city';

const CityNeighborhoodsPanel: React.FC<{ cityHint?: string; stateHint?: string }> = ({ cityHint, stateHint }) => {
    const [minedCities, setMinedCities] = useState<{ key: string; city: string; state: string; count: number }[]>([]);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [showNeighborhoods, setShowNeighborhoods] = useState(false);
    const [neighborhoodData, setNeighborhoodData] = useState<any>(null);
    const [nhFilter, setNhFilter] = useState<string>('all');
    const [nhSearch, setNhSearch] = useState('');
    const [expandedNh, setExpandedNh] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    // On mount: load all mined cities
    useEffect(() => {
        (async () => {
            try {
                const { getAllMinedCities } = await import('../../services/firebase/properties');
                const cities = await getAllMinedCities();
                setMinedCities(cities);

                // Auto-select: prefer cityHint, then localStorage, then first available
                const lastKey = localStorage.getItem(LAST_NH_CITY_KEY);
                if (cityHint) {
                    const { generateCityStateKey } = await import('../../services/firebase/config');
                    const s = stateHint && stateHint !== 'ALL' ? stateHint : 'CA';
                    const hintKey = generateCityStateKey(cityHint, s);
                    const match = cities.find(c => c.key === hintKey);
                    if (match) {
                        setSelectedKey(match.key);
                        setShowNeighborhoods(true);
                    } else if (lastKey && cities.find(c => c.key === lastKey)) {
                        setSelectedKey(lastKey);
                    } else if (cities.length > 0) {
                        setSelectedKey(cities[0].key);
                    }
                } else if (lastKey && cities.find(c => c.key === lastKey)) {
                    setSelectedKey(lastKey);
                } else if (cities.length > 0) {
                    setSelectedKey(cities[0].key);
                }
            } catch (e) { console.warn('Failed to load mined cities:', e); }
            setLoading(false);
        })();
    }, []);

    // When cityHint changes, try to match
    useEffect(() => {
        if (!cityHint || minedCities.length === 0) return;
        (async () => {
            const { generateCityStateKey } = await import('../../services/firebase/config');
            const s = stateHint && stateHint !== 'ALL' ? stateHint : 'CA';
            const hintKey = generateCityStateKey(cityHint, s);
            const match = minedCities.find(c => c.key === hintKey);
            if (match && match.key !== selectedKey) {
                setSelectedKey(match.key);
                setNeighborhoodData(null);
            }
        })();
    }, [cityHint, stateHint]);

    // Load neighborhood data when a city is selected and panel is expanded
    useEffect(() => {
        if (!showNeighborhoods || !selectedKey) return;
        setNeighborhoodData(null);
        (async () => {
            try {
                const { getCityNeighborhoodsFromCloud } = await import('../../services/firebase/properties');
                const data = await getCityNeighborhoodsFromCloud(selectedKey);
                setNeighborhoodData(data);
                localStorage.setItem(LAST_NH_CITY_KEY, selectedKey);
            } catch (e) { console.warn('Failed to load neighborhoods:', e); }
        })();
    }, [showNeighborhoods, selectedKey]);

    const selectedCity = minedCities.find(c => c.key === selectedKey);

    const tierColors: Record<string, string> = {
        'entry-level': 'bg-emerald-50 border-emerald-200 text-emerald-700',
        'mid-range': 'bg-blue-50 border-blue-200 text-blue-700',
        'upper mid-range': 'bg-indigo-50 border-indigo-200 text-indigo-700',
        'premium': 'bg-purple-50 border-purple-200 text-purple-700',
        'ultra-luxury': 'bg-amber-50 border-amber-200 text-amber-800',
    };
    const getTierColor = (tier: string) => tierColors[tier?.toLowerCase()] || 'bg-slate-50 border-slate-200 text-slate-600';

    const tiers = neighborhoodData?.neighborhoods
        ? [...new Set(neighborhoodData.neighborhoods.map((n: any) => n.price_context?.tier).filter(Boolean))]
        : [];

    const filtered = neighborhoodData?.neighborhoods?.filter((n: any) => {
        if (nhFilter !== 'all' && n.price_context?.tier !== nhFilter) return false;
        if (nhSearch) {
            const q = nhSearch.toLowerCase();
            return n.neighborhood_name?.toLowerCase().includes(q) ||
                n.alternative_names?.some((a: string) => a.toLowerCase().includes(q)) ||
                n.character?.description?.toLowerCase().includes(q);
        }
        return true;
    }) || [];

    // Don't render if no mined cities and done loading
    if (!loading && minedCities.length === 0) return null;

    return (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 mb-10 overflow-hidden animate-in fade-in">
            {/* Toggle Header */}
            <button
                onClick={() => setShowNeighborhoods(!showNeighborhoods)}
                className="w-full flex items-center justify-between p-6 hover:bg-slate-50/50 transition-colors"
            >
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600 flex items-center justify-center shadow-inner">
                        <i className="fa-solid fa-mountain-city text-lg"></i>
                    </div>
                    <div className="text-left">
                        <h3 className="text-lg font-black text-slate-900">City Neighborhoods Intelligence</h3>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                            {loading ? 'Loading...' : `${minedCities.length} ${minedCities.length === 1 ? 'city' : 'cities'} mined`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* City pills on the header */}
                    <div className="hidden md:flex items-center gap-1.5">
                        {minedCities.map(c => (
                            <span
                                key={c.key}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedKey(c.key);
                                    setNeighborhoodData(null);
                                    setShowNeighborhoods(true);
                                }}
                                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                                    selectedKey === c.key
                                        ? 'bg-emerald-100 border border-emerald-300 text-emerald-800 shadow-sm'
                                        : 'bg-slate-50 border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                }`}
                            >
                                {c.city}, {c.state} ({c.count})
                            </span>
                        ))}
                    </div>
                    <i className={`fa-solid fa-chevron-${showNeighborhoods ? 'up' : 'down'} text-slate-400 transition-transform`}></i>
                </div>
            </button>

            {/* Expanded Content */}
            {showNeighborhoods && (
                <div className="border-t border-slate-100">
                    {/* Mobile city selector */}
                    {minedCities.length > 1 && (
                        <div className="md:hidden px-6 py-3 bg-slate-50/50 border-b border-slate-100 flex flex-wrap gap-1.5">
                            {minedCities.map(c => (
                                <button
                                    key={c.key}
                                    onClick={() => { setSelectedKey(c.key); setNeighborhoodData(null); }}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                        selectedKey === c.key ? 'bg-slate-900 text-white shadow' : 'bg-white border border-slate-200 text-slate-400'
                                    }`}
                                >
                                    {c.city}, {c.state} ({c.count})
                                </button>
                            ))}
                        </div>
                    )}

                    {!selectedKey ? (
                        <div className="flex items-center justify-center py-16 text-slate-400 text-sm font-bold">
                            Select a city above to view neighborhoods
                        </div>
                    ) : !neighborhoodData ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-10 h-10 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <>
                            {/* City Summary / Buyer's Guide */}
                            {neighborhoodData.city_summary && (
                                <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/40 to-purple-50/30">
                                    <div className="flex items-center gap-2 mb-3">
                                        <i className="fa-solid fa-compass text-indigo-500 text-sm"></i>
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Buyer&apos;s Guide — {selectedCity?.city || 'City'}</h4>
                                    </div>
                                    <div className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-line max-h-[200px] overflow-y-auto pr-2">
                                        {neighborhoodData.city_summary}
                                    </div>
                                </div>
                            )}
                            {/* Filter + Search bar */}
                            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center gap-3">
                                <div className="flex items-center bg-white border border-slate-200 p-1 rounded-xl flex-wrap">
                                    <button
                                        onClick={() => setNhFilter('all')}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${nhFilter === 'all' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        All ({neighborhoodData.neighborhoods?.length || 0})
                                    </button>
                                    {(tiers as string[]).map((tier: string) => {
                                        const cnt = neighborhoodData.neighborhoods?.filter((n: any) => n.price_context?.tier === tier).length || 0;
                                        return (
                                            <button
                                                key={tier}
                                                onClick={() => setNhFilter(nhFilter === tier ? 'all' : tier)}
                                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${nhFilter === tier ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                {tier} ({cnt})
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="relative flex-1 min-w-[200px] max-w-sm">
                                    <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]"></i>
                                    <input
                                        value={nhSearch}
                                        onChange={e => setNhSearch(e.target.value)}
                                        placeholder="Search neighborhoods..."
                                        className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                                    />
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 ml-auto">
                                    Showing {filtered.length} of {neighborhoodData.neighborhoods?.length || 0}
                                </span>
                            </div>

                            {/* Neighborhood Cards Grid */}
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[700px] overflow-y-auto">
                                {filtered.map((n: any, idx: number) => {
                                    const isExpanded = expandedNh.has(n.neighborhood_name);
                                    return (
                                        <div
                                            key={idx}
                                            className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
                                            onClick={() => setExpandedNh(prev => {
                                                const next = new Set(prev);
                                                isExpanded ? next.delete(n.neighborhood_name) : next.add(n.neighborhood_name);
                                                return next;
                                            })}
                                        >
                                            {/* Card Header */}
                                            <div className="p-4 pb-3">
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <h4 className="text-sm font-black text-slate-900 leading-snug">{n.neighborhood_name}</h4>
                                                    <span className={`shrink-0 px-2.5 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${getTierColor(n.price_context?.tier)}`}>
                                                        {n.price_context?.tier || 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mb-2.5">
                                                    <span className="text-[11px] font-bold text-indigo-600">{n.price_context?.typical_range || '—'}</span>
                                                    {n.character?.community_type && (
                                                        <span className="text-[9px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">{n.character.community_type}</span>
                                                    )}
                                                </div>
                                                <p className={`text-[10px] text-slate-500 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                                                    {n.character?.description || 'No description available.'}
                                                </p>
                                            </div>

                                            <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1">
                                                {n.character?.architectural_style && (
                                                    <span className="text-[9px] text-slate-500">
                                                        <i className="fa-solid fa-home text-[7px] text-slate-300 mr-1"></i>
                                                        {n.character.architectural_style}
                                                    </span>
                                                )}
                                                {n.character?.era_built && (
                                                    <span className="text-[9px] text-slate-500">
                                                        <i className="fa-solid fa-calendar text-[7px] text-slate-300 mr-1"></i>
                                                        {n.character.era_built}
                                                    </span>
                                                )}
                                                {n.character?.typical_home_size && (
                                                    <span className="text-[9px] text-slate-500">
                                                        <i className="fa-solid fa-ruler-combined text-[7px] text-slate-300 mr-1"></i>
                                                        {n.character.typical_home_size}
                                                    </span>
                                                )}
                                                {n.hoa?.has_hoa && (
                                                    <span className="text-[9px] text-amber-600 font-semibold">
                                                        <i className="fa-solid fa-shield text-[7px] mr-1"></i>
                                                        HOA{n.hoa.monthly_fee ? ` ${n.hoa.monthly_fee}` : ''}
                                                    </span>
                                                )}
                                            </div>

                                            {isExpanded && (
                                                <div className="px-4 py-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-200 bg-white">
                                                    {n.alternative_names?.length > 0 && (
                                                        <div>
                                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Also Known As</span>
                                                            <p className="text-[10px] text-slate-600 mt-0.5">{n.alternative_names.join(', ')}</p>
                                                        </div>
                                                    )}
                                                    {n.character?.typical_lot_size && (
                                                        <div>
                                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Typical Lot Size</span>
                                                            <p className="text-[10px] text-slate-600 mt-0.5">{n.character.typical_lot_size}</p>
                                                        </div>
                                                    )}
                                                    {n.price_context?.context && (
                                                        <div>
                                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Market Position</span>
                                                            <p className="text-[10px] text-slate-600 mt-0.5">{n.price_context.context}</p>
                                                        </div>
                                                    )}
                                                    {n.hoa?.has_hoa && (n.hoa.covers || n.hoa.notable_rules) && (
                                                        <div>
                                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">HOA Details</span>
                                                            {n.hoa.covers && <p className="text-[10px] text-slate-600 mt-0.5"><strong>Covers:</strong> {n.hoa.covers}</p>}
                                                            {n.hoa.notable_rules && <p className="text-[10px] text-slate-600 mt-0.5"><strong>Rules:</strong> {n.hoa.notable_rules}</p>}
                                                        </div>
                                                    )}
                                                    {n.infrastructure_quality && (
                                                        <div>
                                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Infrastructure</span>
                                                            <p className="text-[10px] text-slate-600 mt-0.5">{n.infrastructure_quality}</p>
                                                        </div>
                                                    )}
                                                    {n.upcoming_changes && n.upcoming_changes !== 'None known' && (
                                                        <div>
                                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Upcoming Changes</span>
                                                            <p className="text-[10px] text-amber-700 mt-0.5">{n.upcoming_changes}</p>
                                                        </div>
                                                    )}
                                                    {n.unique_features?.length > 0 && (
                                                        <div>
                                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Standout Features</span>
                                                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                                {n.unique_features.map((f: string, fi: number) => (
                                                                    <span key={fi} className="px-2 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-[9px] font-semibold">
                                                                        {f}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="pt-1">
                                                        <span className="text-[8px] text-slate-300 font-medium">Source: {n.source_type || 'Unknown'}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <div className="col-span-full text-center py-12">
                                        <i className="fa-solid fa-search text-3xl text-slate-200 mb-3"></i>
                                        <p className="text-sm font-bold text-slate-400">No neighborhoods match your search</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

