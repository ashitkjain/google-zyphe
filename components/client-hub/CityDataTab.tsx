
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
import { savePropertyToCloud, checkExistingPropertiesBatch, deletePropertyAnalysis, runDeprecationSweep, refreshStreetView, getDeprecatedProperties } from '../../services/firebase/properties';
import { fetchPropertySpecs } from '../../services/api/property';
import { realEstateApiProvider } from '../../services/api/realEstateApiProvider';

import { PropertyData } from '../../types';
import { isSupportedPropertyType, hasEssentialData } from '../../utils/propertyPolicies';
import { GEMINI_CHECK_SOURCES, NON_GEMINI_CHECK_SOURCES } from '../../utils/pipelineCheckConfig';
import { PipelineProgress, runCityDeepResearch, runImageOnlyPipeline } from '../../services/preloadService';
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
import { generateCityStateKey } from '../../services/firebase/config';
import { getCityNeighborhoodsFromCloud, getContextGraphsBatch, getPropertyFromCloud } from '../../services/firebase/properties';
import { executeGeminiRequest, FLASH_MODEL } from '../../services/geminiService';
import { Type } from '@google/genai';


interface IngestionJob {
    zpid: string;
    address: string;
    status: 'pending' | 'running' | 'completed' | 'error';
    progress: PipelineProgress | null;
    logs?: string[];
    startTime?: number;
    endTime?: number;
    error?: string;
    completedSteps?: { name: string; outcome: 'ran' | 'cached' | 'skipped' | 'failed' }[];
}


/** Parses 'Dublin, CA' → { cityName: 'Dublin', stateCode: 'CA' | undefined } */
function parseCityInput(input: string): { cityName: string; stateCode?: string } {
    const match = input.trim().match(/^(.+),\s*([A-Z]{2})$/);
    if (match) return { cityName: match[1].trim(), stateCode: match[2] };
    return { cityName: input.trim() };
}

const JobTimer: React.FC<{ createdAt: any, status: string, updatedAt?: any }> = ({ createdAt, status, updatedAt }) => {
    const [elapsed, setElapsed] = React.useState<string>('--:--');
    
    const calculate = React.useCallback(() => {
        const start = createdAt?.toMillis?.() || createdAt?.toDate?.()?.getTime() || (typeof createdAt === 'number' ? createdAt : 0);
        if (!start) return '--:--';

        const end = ['running', 'queued'].includes(status) 
            ? Date.now() 
            : (updatedAt?.toMillis?.() || updatedAt?.toDate?.()?.getTime() || (typeof updatedAt === 'number' ? updatedAt : Date.now()));
            
        const diff = Math.max(0, end - start);
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, [createdAt, status, updatedAt]);

    React.useEffect(() => {
        setElapsed(calculate());
        if (!['running', 'queued'].includes(status)) return;

        const interval = setInterval(() => {
            setElapsed(calculate());
        }, 1000);

        return () => clearInterval(interval);
    }, [status, calculate]);

    return (
        <span className={`inline-flex items-center gap-1.5 font-mono text-[9px] px-2 py-0.5 rounded-lg ${
            ['running', 'queued'].includes(status) ? 'bg-slate-900 text-white animate-in fade-in' : 'bg-slate-100 text-slate-500'
        }`}>
            <i className={`fa-solid fa-clock text-[8px] ${['running', 'queued'].includes(status) ? 'animate-pulse text-indigo-400' : ''}`}></i>
            {elapsed}
        </span>
    );
};

function computeJobStats(job: any) {
    const vals: any[] = Object.values(job.results || {});
    const ran     = vals.filter(r => r.status === 'success').length;
    const cached  = vals.filter(r => r.status === 'cached').length;
    const failed  = vals.filter(r => r.status === 'failed').length;
    const skipped = vals.filter(r => r.status === 'skipped').length;

    // Intel-specific healed breakdown
    const healedVisual = vals.filter(r => r.healed?.visual).length;
    const healedEnv    = vals.filter(r => r.healed?.environmental).length;
    const healedScores = vals.filter(r => r.healed?.scores).length;

    // Asset-specific: total new images secured
    const newImages = vals.reduce((acc, r) => acc + (r.newCount || 0), 0);

    // Duration
    const startMs = job.startedAt?.toMillis?.() || job.createdAt?.toMillis?.() || 0;
    const endMs   = job.completedAt?.toMillis?.() || job.updatedAt?.toMillis?.() || 0;
    const durationMs = (endMs > startMs) ? endMs - startMs : null;
    const durationStr = durationMs != null
        ? durationMs >= 60000
            ? `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`
            : `${Math.floor(durationMs / 1000)}s`
        : null;

    return { ran, cached, failed, skipped, healedVisual, healedEnv, healedScores, newImages, durationStr };
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
        errorSummary?: { message: string; count: number; type: 'error' | 'warning' }[];
    } | null>(null);
    const [viewMode, setViewMode] = useState<'table' | 'ingestion' | 'audit' | 'monitoring'>('table');
    const [monitoringFilter, setMonitoringFilter] = useState<string | null>(null);
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
    const [smokeCheckFilter, setSmokeCheckFilter] = useState<string | null>(null);
    const [groupPages, setGroupPages] = useState<Record<string, number>>({});
    const GROUP_PAGE_SIZE = 20;
    const [availableCities, setAvailableCities] = useState<string[]>([]);
    const [cityQuery, setCityQuery] = useState('');
    const [showCitySuggestions, setShowCitySuggestions] = useState(false);

    // City Neighborhood Mining
    const [neighborhoodMining, setNeighborhoodMining] = useState(false);
    const [neighborhoodMiningStatus, setNeighborhoodMiningStatus] = useState<string>('');
    const [cachedNeighborhoodCount, setCachedNeighborhoodCount] = useState<number | null>(null);

    // Batch Context Graph
    const [graphBatchRunning, setGraphBatchRunning] = useState(false);
    const [graphBatchProgress, setGraphBatchProgress] = useState<{ done: number; skipped: number; failed: number; total: number } | null>(null);
    const [forceGraphRegen, setForceGraphRegen] = useState(false);
    const [cityGraphRunning, setCityGraphRunning] = useState(false);

    // Bootstrap Buyer DNA
    const [dnaBootstrapRunning, setDnaBootstrapRunning] = useState(false);
    const [dnaBootstrapProgress, setDnaBootstrapProgress] = useState<{ done: number; skipped: number; failed: number; total: number } | null>(null);

    // Backfill Context Graph Metadata
    const [backfillRunning, setBackfillRunning] = useState(false);
    const [backfillProgress, setBackfillProgress] = useState<{ done: number; skipped: number; total: number } | null>(null);

    // Buyer Story Search
    const [buyerStory, setBuyerStory] = useState('');
    const [buyerSearching, setBuyerSearching] = useState(false);
    const [buyerResults, setBuyerResults] = useState<{ zpid: string; address: string; score: number; reasons: string[]; highlight: string }[] | null>(null);
    const [showBuyerSearch, setShowBuyerSearch] = useState(false);
    const [buyerFilterPrice, setBuyerFilterPrice] = useState<[string, string]>(['', '']);
    const [buyerFilterBeds, setBuyerFilterBeds] = useState('');
    const [buyerFilterBaths, setBuyerFilterBaths] = useState('');

    const [activeTableTab, setActiveTableTab] = useState<'active' | 'sold'>('active');
    const [soldProperties, setSoldProperties] = useState<any[]>([]);
    const [loadingSold, setLoadingSold] = useState(false);

    // Batch Orientation
    const [orientBatchRunning, setOrientBatchRunning] = useState(false);
    const [orientBatchProgress, setOrientBatchProgress] = useState<{ computed: number; cached: number; failed: number; total: number; results?: Record<string, any> } | null>(null);

    // Active Batch tracking
    const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

    // Batch Intelligence
    const [intelBatchRunning, setIntelBatchRunning] = useState(false);
    const [intelBatchProgress, setIntelBatchProgress] = useState<{ done: number; failed: number; total: number; results?: Record<string, any> } | null>(null);

    // Batch Property Data
    const [propBatchRunning, setPropBatchRunning] = useState(false);
    const [propBatchProgress, setPropBatchProgress] = useState<{ done: number; failed: number; total: number; results?: Record<string, any> } | null>(null);

    // Advanced Filtering
    const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('ALL');
    const [missingStreetViewOnly, setMissingStreetViewOnly] = useState<boolean>(false);

    // Batch Narrative
    const [narrativeBatchRunning, setNarrativeBatchRunning] = useState(false);
    const [narrativeBatchProgress, setNarrativeBatchProgress] = useState<{ done: number; failed: number; total: number; results?: Record<string, any> } | null>(null);

    // Batch Asset Secure
    const [assetBatchRunning, setAssetBatchRunning] = useState(false);
    const [assetBatchProgress, setAssetBatchProgress] = useState<{ done: number; failed: number; total: number; results?: Record<string, any> } | null>(null);
    const [assetBatchTimedOut, setAssetBatchTimedOut] = useState<{ remainingZpids: string[] } | null>(null);
    const [runResultsFilter, setRunResultsFilter] = useState<'all' | 'failed'>('all');

    // Run Summary Modal State
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [lastRunStats, setLastRunStats] = useState<any>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(false);
    const [batchStartTime, setBatchStartTime] = useState<number | null>(null);

    const [allJobs, setAllJobs] = useState<any[]>([]);
    const [loadingJobs, setLoadingJobs] = useState(false);

    // Load available cities from the cities collection on mount
    useEffect(() => {
        getCachedCities(SUPPORTED_STATES).then(setAvailableCities).catch(() => { });
    }, []);

    const fetchAllRecentJobs = useCallback(async () => {
        setLoadingJobs(true);
        try {
            const { getFirestore, collection, query, orderBy, limit, getDocs, deleteDoc, doc } = await import('firebase/firestore');
            const db = getFirestore();
            const collections = [
                { id: 'full_intel_batch_jobs', label: 'Full Intel' },
                { id: 'narrative_batch_jobs', label: 'Narrative' },
                { id: 'orientation_batch_jobs', label: 'Orientation' },
                { id: 'asset_secure_batch_jobs', label: 'Asset Secure' },
                { id: 'property_data_batch_jobs', label: 'Property Data' }
            ];

            const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
            const cutoff = Date.now() - FIVE_DAYS_MS;

            const results: any[] = [];
            const deletePromises: Promise<void>[] = [];

            for (const col of collections) {
                const q = query(collection(db, col.id), orderBy('createdAt', 'desc'), limit(20));
                const snap = await getDocs(q);
                snap.forEach(d => {
                    const data = d.data();
                    const createdMs = data.createdAt?.toMillis?.() || 0;
                    const isTerminal = ['completed', 'failed', 'cancelled'].includes(data.status);
                    if (isTerminal && createdMs < cutoff) {
                        deletePromises.push(deleteDoc(doc(db, col.id, d.id)));
                        return; // Don't include stale jobs in the display list
                    }
                    results.push({ ...data, id: d.id, collectionId: col.id, typeLabel: col.label });
                });
            }

            if (deletePromises.length > 0) {
                await Promise.allSettled(deletePromises);
            }

            setAllJobs(results.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
        } catch (e) {
            console.error('Failed to fetch jobs:', e);
        } finally {
            setLoadingJobs(false);
        }
    }, []);

    useEffect(() => {
        if (viewMode === 'monitoring') {
            fetchAllRecentJobs();
            const interval = setInterval(fetchAllRecentJobs, 30000); // Refresh every 30s
            return () => clearInterval(interval);
        }
    }, [viewMode, fetchAllRecentJobs]);


    // ─── Universal Batch Job Listener ─────────────────────────────────────────
    useEffect(() => {
        if (!activeBatchId) return;

        // Clear running flags for batch types we're no longer tracking
        if (!activeBatchId.startsWith('asset_')) { setAssetBatchRunning(false); setAssetBatchTimedOut(null); }
        if (!activeBatchId.startsWith('intel_')) setIntelBatchRunning(false);
        if (!activeBatchId.startsWith('narrative_')) setNarrativeBatchRunning(false);
        if (!activeBatchId.startsWith('orient_')) setOrientBatchRunning(false);
        if (!activeBatchId.startsWith('prop_')) setPropBatchRunning(false);

        let unsubscribe: (() => void) | undefined;

        const setupListener = async () => {
            const { db } = await import('../../services/firebase/config');
            const { doc, onSnapshot } = await import('firebase/firestore');
            if (!db) return;

            // Determine collection based on ID prefix
            const collection = activeBatchId.startsWith('intel_') ? 'full_intel_batch_jobs'
                : activeBatchId.startsWith('orient_') ? 'orientation_batch_jobs'
                    : activeBatchId.startsWith('narrative_') ? 'narrative_batch_jobs'
                        : activeBatchId.startsWith('asset_') ? 'asset_secure_batch_jobs'
                            : 'property_data_batch_jobs';

            unsubscribe = onSnapshot(doc(db, collection, activeBatchId), (snap) => {
                const data = snap.data();
                if (!data) return;

                const progress = {
                    done: data.done || 0,
                    failed: data.failed || 0,
                    total: data.total || 0,
                    workingCount: data.workingCount || 0,
                    results: data.results || {}
                };

                const isFinished = ['completed', 'failed', 'cancelled', 'timeout'].includes(data.status);

                if (activeBatchId.startsWith('intel_')) {
                    setIntelBatchProgress(progress);
                    if (isFinished) setIntelBatchRunning(false);
                } else if (activeBatchId.startsWith('orient_')) {
                    setOrientBatchProgress({ ...progress, computed: data.done || 0, cached: data.cached || 0, results: data.results || {} });
                    if (isFinished) setOrientBatchRunning(false);
                } else if (activeBatchId.startsWith('narrative_')) {
                    setNarrativeBatchProgress(progress);
                    if (isFinished) setNarrativeBatchRunning(false);
                } else if (activeBatchId.startsWith('asset_')) {
                    setAssetBatchProgress(progress);
                    if (isFinished) {
                        setAssetBatchRunning(false);
                        if (data.status === 'timeout' && data.remainingZpids?.length > 0) {
                            setAssetBatchTimedOut({ remainingZpids: data.remainingZpids });
                        } else {
                            setAssetBatchTimedOut(null);
                        }
                    }
                } else {
                    setPropBatchProgress(progress);
                    if (isFinished) setPropBatchRunning(false);
                }

                if (data.status === 'completed') {
                    addLog(`Batch ${activeBatchId} complete.`);
                    if (activeBatchId.startsWith('asset_')) {
                        setLastRunStats({ ...data, id: snap.id, type: collection });
                        setShowSummaryModal(true);
                    }
                }
            });
        };

        setupListener();
        return () => { if (unsubscribe) unsubscribe(); };
    }, [activeBatchId]);

    const fetchLatestBatchJob = async () => {
        const { getFirestore, collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
        const db = getFirestore();
        // Put Full Intel first to prioritize it if timestamps are identical
        const collections = ['full_intel_batch_jobs', 'narrative_batch_jobs', 'orientation_batch_jobs', 'asset_secure_batch_jobs', 'property_data_batch_jobs'];
        let latestJob: any = null;

        for (const col of collections) {
            const q = query(collection(db, col), orderBy('createdAt', 'desc'), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const docData = snap.docs[0].data();
                if (!latestJob || (docData.createdAt?.toMillis() > latestJob.createdAt?.toMillis())) {
                    latestJob = { ...docData, id: snap.docs[0].id, type: col };
                }
            }
        }
        return latestJob;
    };

    // Dev-only: expose one-time key migration to browser console.
    // Run: window.__migrateCityKeys() — moves hyphen-keyed docs (e.g. pleasanton-ca)
    // to canonical underscore keys (pleasanton_ca) then deletes the old ones.
    useEffect(() => {
        if (process.env.NODE_ENV !== 'production') {
            (window as any).__migrateCityKeys = async () => {
                const { db } = await import('../../services/firebase/config');
                const { collectionGroup, getDocs, doc, getDoc, setDoc, deleteDoc } = await import('firebase/firestore');
                if (!db) { console.error('DB not ready'); return; }

                const SUBCOLLECTIONS = [
                    { type: 'index', docId: 'neighborhoods' },
                    { type: 'index', docId: 'zips' },
                    { type: 'index', docId: 'context_graph' },
                    { type: 'intel', docId: 'deep_research' },
                    { type: 'intel', docId: 'market_intelligence' },
                    { type: 'intel', docId: 'community_pulse' },
                ];

                const snap = await getDocs(collectionGroup(db, 'neighborhoods'));
                const allKeys = [...new Set(
                    snap.docs.filter(d => d.ref.parent.id === 'index').map(d => d.ref.parent.parent!.id)
                )];

                let migrated = 0;
                for (const oldKey of allKeys) {
                    const canonicalKey = oldKey.replace(/-/g, '_');
                    if (oldKey === canonicalKey) { console.log(`✓ Already canonical: ${oldKey}`); continue; }

                    for (const { type, docId } of SUBCOLLECTIONS) {
                        const oldRef = doc(db, 'cities', oldKey, type, docId);
                        const newRef = doc(db, 'cities', canonicalKey, type, docId);
                        const oldSnap = await getDoc(oldRef);
                        if (!oldSnap.exists()) continue;
                        const newSnap = await getDoc(newRef);
                        if (!newSnap.exists()) await setDoc(newRef, oldSnap.data());
                        await deleteDoc(oldRef);
                        console.log(`Moved ${oldKey}/${type}/${docId} → ${canonicalKey}/${type}/${docId}`);
                    }
                    migrated++;
                }
                console.log(`Migration complete. Moved ${migrated} city key(s). Refresh the page.`);
            };
            console.log('[Dev] City key migration available. Run: window.__migrateCityKeys()');

            // Deletes all city docs whose key does not end in _ca (non-California cities).
            (window as any).__cleanupNonCACities = async () => {
                const { db } = await import('../../services/firebase/config');
                const { collectionGroup, getDocs, collection, doc, getDoc, deleteDoc } = await import('firebase/firestore');
                if (!db) { console.error('DB not ready'); return; }

                const SUBCOLLECTIONS = [
                    { type: 'index', docId: 'neighborhoods' },
                    { type: 'index', docId: 'zips' },
                    { type: 'index', docId: 'context_graph' },
                    { type: 'intel', docId: 'deep_research' },
                    { type: 'intel', docId: 'market_intelligence' },
                    { type: 'intel', docId: 'community_pulse' },
                ];

                const snap = await getDocs(collectionGroup(db, 'neighborhoods'));
                const allKeys = [...new Set(
                    snap.docs.filter(d => d.ref.parent.id === 'index').map(d => d.ref.parent.parent!.id)
                )];

                const nonCA = allKeys.filter(k => !k.endsWith('_ca'));
                if (nonCA.length === 0) { console.log('✓ No non-CA city keys found.'); return; }

                console.log(`Found ${nonCA.length} non-CA key(s) to delete:`, nonCA);
                for (const key of nonCA) {
                    for (const { type, docId } of SUBCOLLECTIONS) {
                        const ref = doc(db, 'cities', key, type, docId);
                        const snap = await getDoc(ref);
                        if (snap.exists()) { await deleteDoc(ref); console.log(`Deleted cities/${key}/${type}/${docId}`); }
                    }
                    // Also delete parent doc if it exists
                    const parentRef = doc(db, 'cities', key);
                    const parentSnap = await getDoc(parentRef);
                    if (parentSnap.exists()) { await deleteDoc(parentRef); console.log(`Deleted cities/${key} (parent)`); }
                }
                console.log(`Cleanup complete. Deleted ${nonCA.length} non-CA city key(s). Refresh the page.`);
            };
            console.log('[Dev] Non-CA cleanup available. Run: window.__cleanupNonCACities()');
        }
    }, []);

    // Check cached neighborhood count whenever city changes
    useEffect(() => {
        if (!city) { setCachedNeighborhoodCount(null); return; }
        (async () => {
            try {
                // Resolve state same way as Run City Level Reports
                let s = stateFilter && stateFilter !== 'ALL' ? stateFilter : 'CA';
                const key = generateCityStateKey(city, s);
                if (!key) return;
                const cached = await getCityNeighborhoodsFromCloud(key);
                setCachedNeighborhoodCount(cached?.neighborhoods?.length || 0);
            } catch { setCachedNeighborhoodCount(null); }
        })();
    }, [city, stateFilter]);


    const sourceList = useMemo(() => 
        activeTableTab === 'active' ? listings : soldProperties
    , [activeTableTab, listings, soldProperties]);

    const availableStates = useMemo(() => {
        const states = new Set<string>();
        sourceList.forEach(item => {
            if (item.location?.address?.state_code) {
                states.add(item.location?.address?.state_code);
            }
        });
        return Array.from(states).sort();
    }, [sourceList]);

    const availablePropertyTypes = useMemo(() => {
        const types = new Set<string>();
        sourceList.forEach(item => {
            const hType = item.homeType || item.prop_type || item.propertyType || item.property_type;
            if (hType) types.add(hType);
        });
        return Array.from(types).sort();
    }, [sourceList]);

    // Reset group pages when listings or state filter changes
    React.useEffect(() => { setGroupPages({}); }, [listings, stateFilter]);

    // State Filter effect removed
    const zpidToAddressMap = useMemo(() => {
        const map: Record<string, string> = {};
        sourceList.forEach(item => {
            const id = String(item.zpid);
            const addrObj = item.location?.address;
            const builtAddress = addrObj
                ? centralFormatAddress(addrObj)
                : (item.location?.address?.line || id);
            map[id] = builtAddress;
        });
        return map;
    }, [sourceList]);

    const groupedListings = useMemo<Record<string, any[]>>(() => {
        const groups: Record<string, any[]> = {};

        sourceList.forEach(item => {
            const id = String(item.zpid);
            let itemCity = item.location?.address?.city || 'Unknown City';
            const state = item.location?.address?.state_code || 'Unknown State';
            const hType = item.homeType || item.prop_type || item.propertyType || item.property_type || 'Residential';

            // Clean up city name if it already includes state (e.g. "Dublin, CA" -> "Dublin")
            if (itemCity.includes(',') && state && state !== 'Unknown State') {
                const parts = itemCity.split(',');
                if (parts[1].trim().toUpperCase() === state.toUpperCase()) {
                    itemCity = parts[0].trim();
                }
            }

            // 1. Filter by State
            if (stateFilter && stateFilter !== 'ALL' && state !== stateFilter) return;

            // 2. Filter by Property Type
            if (propertyTypeFilter !== 'ALL' && hType !== propertyTypeFilter) return;

            // 3. Filter by Missing Street View Health
            if (missingStreetViewOnly) {
                const status = propertyStatuses[id];
                if (status?.assets?.streetView) return; // Skip if it HAS street view
            }

            const key = `${itemCity}, ${state}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        // Sort each group by recency (timestamp)
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => {
                const tsA = propertyStatuses[String(a.zpid)]?.property?.timestamp;
                const tsB = propertyStatuses[String(b.zpid)]?.property?.timestamp;
                
                const valA = tsA?.toMillis ? tsA.toMillis() : (typeof tsA === 'number' ? tsA : (tsA ? new Date(tsA).getTime() : 0));
                const valB = tsB?.toMillis ? tsB.toMillis() : (typeof tsB === 'number' ? tsB : (tsB ? new Date(tsB).getTime() : 0));
                
                return valB - valA;
            });
        });

        return groups;
    }, [sourceList, stateFilter, propertyTypeFilter, missingStreetViewOnly, propertyStatuses]);

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
        const allIds = targetListings.map(l => String(l.zpid));
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
        fetchStatuses(sourceList);
    }, [sourceList]);

    const requestStop = async (batchId: string) => {
        if (!window.confirm('Are you sure you want to stop this batch? Current progress will be saved but no new properties will be processed.')) return;
        
        try {
            const { db } = await import('../../services/firebase/config');
            const { doc, updateDoc } = await import('firebase/firestore');
            if (!db) return;

            const collection = batchId.startsWith('intel_') ? 'full_intel_batch_jobs'
                : batchId.startsWith('orient_') ? 'orientation_batch_jobs'
                    : batchId.startsWith('narrative_') ? 'narrative_batch_jobs'
                        : batchId.startsWith('asset_') ? 'asset_secure_batch_jobs'
                            : 'property_data_batch_jobs';

            await updateDoc(doc(db, collection, batchId), {
                status: 'cancelled',
                updatedAt: new Date()
            });
            
            addLog(`Stop requested for batch ${batchId}.`);
            if (viewMode === 'monitoring') fetchAllRecentJobs();
        } catch (e: any) {
            console.error('Failed to stop batch:', e);
            alert(`Failed to stop batch: ${e.message}`);
        }
    };

    // Load all cached cities for suggestion list
    React.useEffect(() => {
        const loadAvailableCities = async () => {
            const cities = await getCachedCities(SUPPORTED_STATES);
            setAvailableCities(cities);
        };
        loadAvailableCities();
    }, []);

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
            .map((item: any) => String(item.zpid))
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
                const id = String(item.zpid);
                const status = propertyStatuses[id];
                // No images at all
                if (!status?.assets?.images) return true;
                // Has some images but fewer than expected (check smoke test result if available)
                const smokeResult = smokeSummary?.results?.find(r => r.zpid === id);
                if (smokeResult) {
                    const imgCheck = smokeResult.checks.find(c => c.id === 'images');
                    if (imgCheck && !imgCheck.passed) return true;
                }
                // Also check against property data's photoCount if we have it
                const propData = (item as any);
                const expectedCount = propData?.photoCount || propData?.images?.length || 0;
                if (expectedCount > 0 && (status.assets.imageCount || 0) < expectedCount) return true;
                return false;
            })
            .map((item: any) => String(item.zpid));

        setSelectedIds(new Set(targetIds));
    };

    const selectStale = () => {
        const targetIds = Object.values(groupedListings)
            .flat()
            .filter((item: any) => {
                const id = String(item.zpid);
                const status = propertyStatuses[id];
                if (!status) return true; // not cached
                const getAge = (ts: any) => {
                    if (!ts) return null;
                    const ms = ts.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : new Date(ts).getTime());
                    return (Date.now() - ms) / (24 * 60 * 60 * 1000);
                };
                const pAge = getAge(status.property?.timestamp);
                const vAge = getAge(status.visual?.timestamp);
                const cAge = getAge((status as any).comprehensive?.timestamp);
                return !status.property || !status.visual || !status.comprehensive || (pAge !== null && pAge >= 30) || (vAge !== null && vAge >= 30) || (cAge !== null && cAge >= 30);
            })
            .map((item: any) => String(item.zpid));

        setSelectedIds(new Set(targetIds));
    };

    const handleBulkSecureImages = async (manualZpids?: string[]) => {
        const targetIds = manualZpids ? new Set(manualZpids) : selectedIds;
        if (targetIds.size === 0) return;
        setBatchStartTime(Date.now());

        setLoading(true);
        setError(null);
        setViewMode('ingestion');
        setPipelineType('images');
        addLog(`Queueing Secure Images Batch for ${targetIds.size} properties (Background/Cloud Reconciliation)...`);

        const targets = sourceList.filter(l => targetIds.has(String(l.zpid)));
        const zpids = targets.map(t => String(t.zpid));
        const batchId = `asset_batch_${Date.now()}`;

        try {
            const { db } = await import('../../services/firebase/config');
            const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
            if (!db) throw new Error('Firestore not initialized');

            await setDoc(doc(db, 'asset_secure_batch_jobs', batchId), {
                zpids,
                status: 'queued',
                total: zpids.length,
                done: 0,
                failed: 0,
                results: {},
                userId: auth?.currentUser?.uid || 'anonymous',
                createdAt: serverTimestamp(),
            });

            setAssetBatchRunning(true);
            setAssetBatchProgress({ done: 0, failed: 0, total: zpids.length });
            setActiveBatchId(batchId);
            setLoading(false);
            addLog(`Asset Secure Batch queued. Reconciliation will continue in the cloud.`);
        } catch (e: any) {
            setError(`Failed to queue asset batch: ${e.message}`);
            setLoading(false);
        }
    };

    const handleBulkPropertyData = async (manualZpids?: string[]) => {
        const targetIds = manualZpids ? new Set(manualZpids) : selectedIds;
        if (targetIds.size === 0) return;
        setBatchStartTime(Date.now());

        setLoading(true);
        setError(null);
        setViewMode('ingestion');
        setPipelineType('images'); // reuse ingestion view
        addLog(`Queueing Property Data Batch for ${targetIds.size} properties (Background/20x Concurrency)...`);

        // When retrying with explicit zpids, use them directly — don't filter through
        // sourceList, which may not contain properties that were cleaned from listings.
        const zpids = manualZpids
            ? manualZpids
            : sourceList.filter(l => targetIds.has(String(l.zpid))).map(t => String(t.zpid));
        const batchId = `prop_batch_${Date.now()}`;

        try {
            const { db } = await import('../../services/firebase/config');
            const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
            if (!db) throw new Error('Firestore not initialized');

            await setDoc(doc(db, 'property_data_batch_jobs', batchId), {
                zpids,
                status: 'queued',
                total: zpids.length,
                done: 0,
                failed: 0,
                results: {},
                userId: auth?.currentUser?.uid || 'anonymous',
                createdAt: serverTimestamp(),
            });

            setPropBatchRunning(true);
            setPropBatchProgress({ done: 0, failed: 0, total: zpids.length });
            setActiveBatchId(batchId);
            setLoading(false);
        } catch (e: any) {
            setError(`Failed to queue batch: ${e.message}`);
            setLoading(false);
        }
    };




    const handleBulkIngest = async (manualZpids?: string[], sequential = false) => {
        const targetIds = manualZpids ? new Set(manualZpids) : selectedIds;
        if (targetIds.size === 0) return;

        setBatchStartTime(Date.now());
        setLoading(true);
        setError(null);
        setPipelineType('full');
        setViewMode('ingestion');
        addLog(`Queueing Full Intel Batch for ${targetIds.size} properties (${sequential ? 'Sequential/1x' : 'Background/5x'} Concurrency)...`);

        // When retrying with explicit zpids, use them directly — don't filter through
        // sourceList, which may not contain properties that were cleaned from listings.
        const zpids = manualZpids
            ? manualZpids
            : sourceList.filter(l => targetIds.has(String(l.zpid))).map(t => String(t.zpid));
        const batchId = `intel_batch_${Date.now()}`;

        try {
            const { db } = await import('../../services/firebase/config');
            const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
            if (!db) throw new Error('Firestore not initialized');

            await setDoc(doc(db, 'full_intel_batch_jobs', batchId), {
                zpids,
                status: 'queued',
                total: zpids.length,
                done: 0,
                failed: 0,
                results: {},
                sequential,
                userId: auth?.currentUser?.uid || 'anonymous',
                createdAt: serverTimestamp(),
            });

            setIntelBatchRunning(true);
            setIntelBatchProgress({ done: 0, failed: 0, total: zpids.length });
            setActiveBatchId(batchId);
            setLoading(false);
            addLog(`Full Intel Batch queued. You can safely close this tab or navigate away.`);
        } catch (e: any) {
            setError(`Failed to queue intel batch: ${e.message}`);
            setLoading(false);
        }
    };

    const handleBulkNarrative = async (manualZpids?: string[]) => {
        const targetIds = manualZpids ? new Set(manualZpids) : selectedIds;
        if (targetIds.size === 0) return;

        setBatchStartTime(Date.now());
        setLoading(true);
        setError(null);
        setPipelineType('full');
        setViewMode('ingestion');
        addLog(`Queueing Narrative Synthesis Batch for ${targetIds.size} properties...`);

        const targets = sourceList.filter(l => targetIds.has(String(l.zpid)));
        const zpids = targets.map(t => String(t.zpid));
        const batchId = `narrative_batch_${Date.now()}`;

        try {
            const { db } = await import('../../services/firebase/config');
            const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
            if (!db) throw new Error('Firestore not initialized');

            await setDoc(doc(db, 'narrative_batch_jobs', batchId), {
                zpids,
                status: 'queued',
                total: zpids.length,
                done: 0,
                failed: 0,
                results: {},
                userId: auth?.currentUser?.uid || 'anonymous',
                createdAt: serverTimestamp(),
            });

            setNarrativeBatchRunning(true);
            setNarrativeBatchProgress({ done: 0, failed: 0, total: zpids.length });
            setActiveBatchId(batchId);
            setLoading(false);
            addLog(`Narrative Batch queued successfully.`);
        } catch (e: any) {
            setError(`Failed to queue narrative batch: ${e.message}`);
            setLoading(false);
        }
    };

    const handleRetryFailed = async () => {
        const failedZpids = ingestionQueue
            .filter(j => j.status === 'error' || j.status === 'partial')
            .map(j => j.zpid);
        
        if (failedZpids.length === 0) return;
        
        setSelectedIds(new Set(failedZpids));

        // Short timeout to let state update, then trigger ingest
        setTimeout(() => {
            if (pipelineType === 'images') {
                handleBulkSecureImages(failedZpids);
            } else {
                handleBulkIngest(failedZpids);
            }
        }, 100);
    };

    const handleRetryJobZPIDs = async (job: any) => {
        if (!job || !job.results) return;
        const failedZpids = Object.entries(job.results)
            .filter(([_, res]: [string, any]) => res.status === 'failed' || res.status === 'error')
            .map(([zpid]) => zpid);
        
        if (failedZpids.length === 0) {
            alert('No failed properties to retry.');
            return;
        }

        if (confirm(`Retry ${failedZpids.length} failed properties from this run?`)) {
            setSelectedIds(new Set(failedZpids));
            setShowSummaryModal(false);
            
            // Map job type to bulk handler
            setTimeout(() => {
                const type = job.type || '';
                if (type.includes('intel')) handleBulkIngest(failedZpids, true);
                else if (type.includes('property')) handleBulkPropertyData(failedZpids);
                else if (type.includes('narrative')) handleBulkNarrative(failedZpids);
                else if (type.includes('asset')) handleBulkSecureImages(failedZpids);
            }, 100);
        }
    };
    const handleRetryFailedBatch = async (batchType: 'property' | 'intel' | 'narrative' | 'asset') => {
        let progress = null;
        if (batchType === 'property') progress = propBatchProgress;
        else if (batchType === 'intel') progress = intelBatchProgress;
        else if (batchType === 'narrative') progress = narrativeBatchProgress;
        else if (batchType === 'asset') progress = assetBatchProgress;

        if (!progress || !progress.results) return;

        const failedZpids = Object.entries(progress.results)
            .filter(([_, res]: [string, any]) => res.status === 'failed' || res.status === 'error')
            .map(([zpid]) => zpid);

        if (failedZpids.length === 0) {
            alert('No failed properties to retry.');
            return;
        }

        if (confirm(`Retry ${failedZpids.length} failed properties?`)) {
            // Set these IDs as selected and trigger the appropriate bulk handler
            setSelectedIds(new Set(failedZpids));
            
            // Short timeout to let state update
            setTimeout(() => {
                if (batchType === 'property') handleBulkPropertyData(failedZpids);
                else if (batchType === 'intel') handleBulkIngest(failedZpids, true);
                else if (batchType === 'narrative') handleBulkNarrative(failedZpids);
                else if (batchType === 'asset') handleBulkSecureImages(failedZpids);
                else if (batchType === 'orientation') handleBatchOrientation(failedZpids);
            }, 100);
        }
    };
    


    // Property validation — imported from central utility (see top-level imports)

    const fetchListings = async (zip: string, fallbackCity?: string, fallbackState?: string, forceRefresh = false) => {
        const config = APP_CONFIG.usHousingApi;

        // 1. Cloud Cache (skip on force refresh)
        const cityStateKey = fallbackCity && fallbackState ? `${fallbackCity.toLowerCase().replace(/\s+/g, '_')}_${fallbackState.toLowerCase()}` : undefined;

        if (!forceRefresh) {
            try {
                const cloudCached = await getZipListings(zip, cityStateKey);
                if (cloudCached && (cloudCached.listings?.length ?? 0) > 0) {
                    const allCached = cloudCached.listings || [];
                    const cachedListings = allCached
                        .filter((item: any) => !!item.zpid)
                        .filter((item: any) => isSupportedPropertyType(item))
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
                    const removed = allCached.filter((item: any) => !!item.zpid && !isSupportedPropertyType(item));
                    if (removed.length > 0) {
                        addLog(`Cleaning ${removed.length} unsupported listing(s) from zip ${zip}...`);
                        // Update zip cache synchronously
                        saveZipListings(zip, cachedListings, cityStateKey).catch(console.error);
                        // Remove analysis subcollections only — leave the root property doc so
                        // cloud batch jobs (Intel, Orientation) can still find the property.
                        import('../../services/firebase/properties').then(({ deletePropertyAnalysis }) => {
                            for (const item of removed) {
                                const zpid = String(item.zpid);
                                addLog(`  ✗ Removing analysis for (${item.homeType || 'no type'}): ${item.location?.address?.line || zpid}`);
                                deletePropertyAnalysis(zpid, 'intelligence').catch(() => { });
                            }
                        });
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
                        saveZipListings(zip, resoListings, cityStateKey).catch(console.error);
                        return resoListings;
                    }
                } catch (e) {
                    addLog(`RESO Search failed, falling back to legacy: ${e}`);
                }
            }
        }

        // 3. RealEstateAPI — paginated active MLS search
        addLog(`Fetching live data from RealEstateAPI for ${zip}…`);
        try {
            const listings = await realEstateApiProvider.searchByZip(zip, fallbackCity, fallbackState);
            const data = listings.filter((item: any) => isSupportedPropertyType(item));
            addLog(`RealEstateAPI returned ${data.length} active listings for ${zip}`);
            if (data.length > 0) {
                saveZipListings(zip, data, cityStateKey).catch(console.error);
            }
            return data;
        } catch (e: any) {
            addLog(`RealEstateAPI fetch failed for ${zip}: ${e.message}`);
            return [];
        }
    };

    /**
     * Helper to fetch recently sold listings (comparables) for a zip.
     * Updates the zip_sold_listings_cache in Firestore.
     */
    const fetchSoldListings = async (zip: string, fallbackCity?: string, fallbackState?: string, forceRefresh = false) => {
        const config = APP_CONFIG.usHousingApi;
        const cityStateKey = fallbackCity && fallbackState ? `${fallbackCity.toLowerCase().replace(/\s+/g, '_')}_${fallbackState.toLowerCase()}` : undefined;

        if (!forceRefresh) {
            try {
                const cloudCached = await getZipSoldListings(zip, cityStateKey);
                if (cloudCached && (cloudCached.listings?.length ?? 0) > 0) {
                    addLog(`Cloud Cache Hit for Sold: ${zip} (${cloudCached.listings.length} items)`);
                    return cloudCached.listings;
                }
            } catch (e) {
                console.warn('Cloud sold cache check failed', e);
            }
        }

        const baseUrl = `https://${config.host}/propertyExtendedSearch?location=${zip}&status_type=RecentlySold&soldInLast=6m`;
        addLog(`Fetching live sold data for ${zip}…`);

        try {
            const allSold: any[] = [];
            let page = 1;
            let totalPages = 1;
            while (page <= totalPages) {
                const resp = await fetch(`${baseUrl}&page=${page}`, {
                    headers: { 'X-RapidAPI-Key': config.key, 'X-RapidAPI-Host': config.host }
                });
                if (!resp.ok) { addLog(`    Sold p${page} error: ${resp.status}`); break; }
                const result = await resp.json();
                const items = Array.isArray(result) ? result : (result.props || result.results || []);
                totalPages = result.totalPages ?? result.total_pages ?? 1;
                allSold.push(...items);
                addLog(`    Sold p${page}/${totalPages}: ${items.length}`);
                page++;
                if (page <= totalPages) await new Promise(r => setTimeout(r, 1000));
            }
            if (allSold.length > 0) {
                await saveZipSoldListings(zip, allSold, cityStateKey);
                addLog(`    ✓ Sold: ${allSold.length} saved for ${zip}`);
            }
            return allSold;
        } catch (e: any) {
            addLog(`    ⚠ Sold error for ${zip}: ${e.message}`);
            return [];
        }
    };

    const handleSearch = async (forceRefresh = true) => {
        if (!city) {
            setError('Please provide a City or Postal Code.');
            return;
        }

        // 1. Detect if input is a ZPID (7-12 digits)
        const isZpidInput = /^\d{7,12}$/.test(city.trim());
        if (isZpidInput) {
            const zpid = city.trim();
            addLog(`Detected ZPID search: ${zpid}`);
            // Route to property page
            window.open(`${window.location.origin}/?zpid=${zpid}`, '_blank');
            setLoading(false);
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
                const { cityName: parsedCity, stateCode: parsedState } = parseCityInput(city);
                const normalizedCity = parsedCity;
                addLog(`Checking regional resolution for ${normalizedCity}...`);
                cachedGroups = await getZipsForCity(normalizedCity, parsedState);

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
                                zip: x.zip_code,
                                city: x.city || normalizedCity,
                                state: x.state_code || 'Unknown',
                            }));
                        } else if (zipResult.results && Array.isArray(zipResult.results)) {
                            foundEntries = zipResult.results.map((x: any) => ({
                                zip: x.zip_code,
                                city: x.city || normalizedCity,
                                state: x.state_code || 'Unknown',
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
                    const id = item.zpid;
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
                // 1. Fetch fresh active listings (updates cache + adds to results)
                const zipListings = await fetchListings(zip, fallback?.city, fallback?.state, forceRefresh);
                rawResults.push(...zipListings);
                
                // 2. Fetch fresh sold listings (updates comps cache)
                await fetchSoldListings(zip, fallback?.city, fallback?.state, forceRefresh);
                
                // Tiny delay to avoid rate triggers
                await new Promise(r => setTimeout(r, 400));
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
            } else {
                // ── Step 5: Enrich new properties via fetchPropertySpecs ──────────
                // For every discovered zpid NOT already in Firestore, call the
                // RapidAPI /property endpoint to get ALL fields (risk scores,
                // schools, resoFacts, attribution, etc.) and save to `properties`.
                const allZpids = results.map((r: any) => String(r.zpid)).filter(Boolean);
                const existingSet = await checkExistingPropertiesBatch(allZpids);
                const newZpids = allZpids.filter((z: string) => !existingSet.has(z));
                if (newZpids.length > 0) {
                    addLog(`Enriching ${newZpids.length} new properties (${existingSet.size} already in Firestore)...`);
                    const ENRICH_CHUNK = 1; // Sequential — 1 request at a time
                    let enriched = 0;
                    let enrichFailed = 0;
                    let enrichSkipped = 0;
                    for (let i = 0; i < newZpids.length; i += ENRICH_CHUNK) {
                        const chunk = newZpids.slice(i, i + ENRICH_CHUNK);
                        const enrichResults = await Promise.allSettled(
                            chunk.map(async (zpid: string) => {
                                const specs = await realEstateApiProvider.getPropertyDetail(zpid);
                                if (!specs?.zpid) return false;

                                // Validate before saving: reject unsupported homeType OR no bedrooms
                                const isValidType = isSupportedPropertyType(specs);
                                const hasBedrooms = (specs.bedrooms ?? 0) > 0;
                                if (!isValidType || !hasBedrooms) {
                                    const reason = !isValidType
                                        ? `unsupported type (${(specs as any).homeType || 'unknown'})`
                                        : `no bedrooms (homeType=${(specs as any).homeType})`;
                                    addLog(`  ✗ Skipping ${zpid}: ${reason}`);
                                    // Remove from zip cache so it won't reappear
                                    const matchedListing = results.find((r: any) => String(r.zpid) === zpid);
                                    const zip = matchedListing?.location?.address?.postal_code;
                                    const fallbackCity = matchedListing?.location?.address?.city;
                                    const fallbackState = matchedListing?.location?.address?.state_code;
                                    const csk = fallbackCity && fallbackState ? `${fallbackCity.toLowerCase().replace(/\s+/g, '_')}_${fallbackState.toLowerCase()}` : undefined;
                                    if (zip) await removePropertyFromZipCache(zip, zpid, csk).catch(() => { });
                                    setListings(prev => prev.filter(l => String(l.zpid) !== zpid));
                                    enrichSkipped++;
                                    return false;
                                }

                                await savePropertyToCloud(String(specs.zpid), specs as any);
                                return true;
                            })
                        );
                        enrichResults.forEach(r => {
                            if (r.status === 'fulfilled' && r.value) enriched++;
                            else if (r.status === 'rejected') enrichFailed++;
                        });
                        addLog(`  Enriched ${Math.min(i + ENRICH_CHUNK, newZpids.length)}/${newZpids.length}...`);
                        if (i + ENRICH_CHUNK < newZpids.length) await new Promise(r => setTimeout(r, 1500));
                    }
                    addLog(`Enrichment complete: ${enriched} saved, ${enrichSkipped} skipped (invalid type/no rooms), ${enrichFailed} failed.`);
                    logPipelineAudit('Property Enrichment', city.trim(), enrichFailed === 0 ? 'success' : 'partial', `${enriched}/${newZpids.length} enriched`, undefined, { enriched, skipped: enrichSkipped, failed: enrichFailed, existing: existingSet.size });
                } else {
                    addLog(`All ${allZpids.length} properties already in Firestore — enrichment skipped.`);
                }

                // ── Step 6: Move Inactive Listings (Deprecation Sweep) ──────────
                // Now that we have fresh results, compare Firestore against this 
                // list and move anything that disappeared to Sold/Unlisted.
                addLog(`Starting active listing sweep for ${city.trim()}...`);
                const allActiveZpids = new Set<string>(results.map((r: any) => String(r.zpid)).filter(Boolean));
                const scopedCities = new Set<string>();
                results.forEach(r => {
                    const c = r.location?.address?.city;
                    if (c) scopedCities.add(c);
                });
                
                const sweepResult = await runDeprecationSweep(allActiveZpids, scopedCities, `${results.length} active listings`, addLog);
                addLog(`Sweep complete: ${sweepResult.deprecated.length} properties moved to Sold/Unlisted, ${sweepResult.skipped.length} verified active.`);
                logPipelineAudit('Refresh Active Listings', Array.from(scopedCities).join(', '), sweepResult.errors.length === 0 ? 'success' : 'partial', `${sweepResult.deprecated.length} off market, ${sweepResult.skipped.length} active`, undefined, { deprecated: sweepResult.deprecated.length, active: sweepResult.skipped.length });
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
        // Use selected properties if any are checked, otherwise all cached
        const targetIds = selectedIds.size > 0
            ? new Set(Array.from(selectedIds).filter(id => cachedPropertyIds.has(id)))
            : cachedPropertyIds;
        if (targetIds.size === 0) {
            addLog('Select properties or load listings and check cache first before running the smoke test.');
            return;
        }
        setSmokeRunning(true);
        setSmokeProgress(null);
        setSmokeSummary(null);
        setSmokeExpanded(new Set());
        addLog(`Starting smoke test for ${targetIds.size} properties...`);
        try {
            const zpids = Array.from(targetIds) as string[];
            const summary = await runCitySmokeTest(zpids, (done, total) => {
                setSmokeProgress({ done, total });
            }, zpidToAddressMap);
            setSmokeSummary(summary);
            addLog(`Smoke test complete: ${summary.passedCount}/${summary.totalProperties} passed, ${summary.failedCount} with errors.`);
            logPipelineAudit('Smoke Test', `${targetIds.size} properties`, summary.failedCount === 0 ? 'success' : 'partial', `${summary.passedCount} passed, ${summary.failedCount} failed`, undefined, { passed: summary.passedCount, failed: summary.failedCount, total: summary.totalProperties });
        } catch (e: any) {
            addLog(`Smoke test failed: ${e.message}`);
        } finally {
            setSmokeRunning(false);
            setSmokeProgress(null);
        }
    };

    const toggleSmokeCheckFilter = (id: string, isNA: boolean = false) => {
        const fullId = isNA ? `na:${id}` : id;
        if (smokeCheckFilter === fullId) {
            setSmokeCheckFilter(null);
        } else {
            setSmokeCheckFilter(fullId);
            if (smokeSummary) {
                const targetZpids = new Set<string>();
                smokeSummary.results.forEach(r => {
                    const match = isNA
                        ? r.checks.some(c => c.id === id && c.sourceNull)
                        : r.checks.some(c => c.id === id && !c.passed && !c.sourceNull);
                    if (match) targetZpids.add(r.zpid);
                });
                if (targetZpids.size > 0) {
                    setSelectedIds(targetZpids);
                    addLog(`[Selection] ${targetZpids.size} properties failing "${id}" are now selected.`);
                }
            }
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
                const zpid = String(item.zpid || '');
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


    // ── City-Level Context Graph Generator ────────────────────────────────
    const handleCityContextGraph = async () => {
        if (!city.trim()) {
            addLog('[City Context] No city entered.');
            return;
        }
        setCityGraphRunning(true);
        addLog(`[City Context] Extracting city-level factors for ${city.trim()}...`);

        try {
            const { extractCityContextGraph } = await import('../../services/geminiService');
            const { saveCityContextGraphToCloud } = await import('../../services/firebase/properties');
            const { getCommunityPulseFromCloud, getDeepInvestmentResearchFromCloud } = await import('../../services/firebase/properties');
            const { generateCityStateKey } = await import('../../services/firebase/config');

            // Resolve state from loaded listings
            const firstListing = listings[0];
            const resolvedState = firstListing?.location?.address?.state_code
                || firstListing?.location?.address?.state || '';
            const cityStateKey = generateCityStateKey(parseCityInput(city).cityName, resolvedState || parseCityInput(city).stateCode || '');

            if (!cityStateKey) {
                addLog('[City Context] Could not resolve city+state key.');
                setCityGraphRunning(false);
                return;
            }

            const [deepResearch, communityPulse] = await Promise.all([
                getDeepInvestmentResearchFromCloud(cityStateKey).catch(() => null),
                getCommunityPulseFromCloud(cityStateKey).catch(() => null)
            ]);

            if (!deepResearch && !communityPulse) {
                addLog(`[City Context] No city research data found for "${cityStateKey}". Run Deep Research + Community Pulse first.`);
                setCityGraphRunning(false);
                return;
            }

            addLog(`[City Context] Loaded: ${deepResearch ? '✓ deep_research' : '✗ no deep_research'}, ${communityPulse ? '✓ community_pulse' : '✗ no pulse'}`);

            const result = await extractCityContextGraph(
                parseCityInput(city).cityName,
                resolvedState,
                deepResearch,
                communityPulse,
                'admin'
            );

            if (result.data?.factors?.length > 0) {
                await saveCityContextGraphToCloud(cityStateKey, result.data);
                addLog(`[City Context] ✓ Saved ${result.data.factors.length} city-level factors for "${cityStateKey}"`);
                logPipelineAudit('City Context Graph', cityStateKey, 'success', `${result.data.factors.length} factors extracted`);
            } else {
                addLog(`[City Context] ✗ No factors returned from Gemini`);
            }
        } catch (e: any) {
            addLog(`[City Context] Error: ${e.message}`);
            console.error('[City Context]', e);
        } finally {
            setCityGraphRunning(false);
        }
    };

    // ── Batch Context Graph Generator (smart staleness) ───────────────────
    const handleBatchContextGraph = async (forceAll: boolean = forceGraphRegen) => {
        // Use selected properties if any are checked, otherwise all cached
        const targetIds = selectedIds.size > 0
            ? new Set(Array.from(selectedIds).filter(id => cachedPropertyIds.has(id)))
            : cachedPropertyIds;
        if (targetIds.size === 0) {
            addLog('Load listings and check cache first before running context graph sync.');
            return;
        }
        setGraphBatchRunning(true);
        setGraphBatchProgress({ done: 0, skipped: 0, failed: 0, total: targetIds.size });
        addLog(`[Context Graph] ${forceAll ? '⚡ Force regen' : 'Smart sync'} for ${targetIds.size}${selectedIds.size > 0 ? ' selected' : ' cached'} properties${forceAll ? ' — bypassing staleness check' : ' — checking staleness...'}`);

        const zpids = Array.from(targetIds) as string[];
        let done = 0;
        let skipped = 0;
        let failed = 0;
        let missingData = 0;
        const missingDataDetails: { addr: string; reasons: string[] }[] = [];

        // Lazy imports
        const { getContextGraphFromCloud, saveContextGraphToCloud, getCityContextGraphFromCloud, saveCityContextGraphToCloud, getCommunityPulseFromCloud, getDeepInvestmentResearchFromCloud } = await import('../../services/firebase/properties');
        const { getPropertyFromCloud } = await import('../../services/firebase/properties');
        const { getVisualAnalysisFromCloud, getComprehensiveAnalysisFromCloud } = await import('../../services/firebaseService');
        const { extractContextGraphFactors, extractCityContextGraph } = await import('../../services/geminiService');
        const { getDocs, query, collection, where, documentId } = await import('firebase/firestore');
        const { db: firestoreDb, generateCityStateKey } = await import('../../services/firebase/config');

        // ── Phase 0: Ensure city context graph is fresh ──────────────────
        const firstListing = listings[0];
        const resolvedState = firstListing?.location?.address?.state_code
            || firstListing?.location?.address?.state || '';
        const cityStateKey = generateCityStateKey(parseCityInput(city).cityName, resolvedState || parseCityInput(city).stateCode || '');

        if (cityStateKey) {
            const toMs = (ts: any): number => {
                if (!ts) return 0;
                if (ts.toMillis) return ts.toMillis();
                if (ts.seconds) return ts.seconds * 1000;
                if (ts instanceof Date) return ts.getTime();
                if (typeof ts === 'number') return ts;
                return 0;
            };

            try {
                const existingCityGraph = await getCityContextGraphFromCloud(cityStateKey);
                const cityGraphTs = toMs(existingCityGraph?.lastUpdated);

                // Check if source data is newer than city graph
                const [deepResearch, communityPulse] = await Promise.all([
                    getDeepInvestmentResearchFromCloud(cityStateKey).catch(() => null),
                    getCommunityPulseFromCloud(cityStateKey).catch(() => null)
                ]);
                const sourceTs = Math.max(
                    toMs((deepResearch as any)?.lastUpdated),
                    toMs((communityPulse as any)?.lastUpdated)
                );

                const needsCityGraph = !existingCityGraph?.factors?.length || (sourceTs > cityGraphTs) || forceAll;

                if (needsCityGraph && (deepResearch || communityPulse)) {
                    addLog(`[Context Graph] Phase 0: ${existingCityGraph?.factors?.length ? 'Refreshing' : 'Generating'} city context graph for "${cityStateKey}"...`);
                    const cityResult = await extractCityContextGraph(
                        city.trim(), resolvedState, deepResearch, communityPulse, 'admin'
                    );
                    if (cityResult.data?.factors?.length > 0) {
                        await saveCityContextGraphToCloud(cityStateKey, cityResult.data);
                        addLog(`[Context Graph] Phase 0: ✓ Saved ${cityResult.data.factors.length} city-level factors`);
                    }
                } else if (existingCityGraph?.factors?.length) {
                    addLog(`[Context Graph] Phase 0: City context graph up-to-date (${existingCityGraph.factors.length} factors)`);
                } else {
                    addLog(`[Context Graph] Phase 0: No city research data — skipping city context`);
                }
            } catch (e: any) {
                addLog(`[Context Graph] Phase 0: City context failed (non-blocking): ${e.message}`);
            }
        }

        // ── Phase 1: Batch-fetch timestamps from all source collections + context graphs ──
        const BATCH = 10;
        const graphTimestamps: Record<string, number> = {};   // zpid → context_graph.lastUpdated (ms)
        const sourceTimestamps: Record<string, number> = {};  // zpid → max(source lastUpdated) (ms)
        const graphExists: Record<string, boolean> = {};

        const toMs = (ts: any): number => {
            if (!ts) return 0;
            if (ts.toMillis) return ts.toMillis();          // Firestore Timestamp
            if (ts.seconds) return ts.seconds * 1000;        // Firestore Timestamp plain object
            if (ts instanceof Date) return ts.getTime();
            if (typeof ts === 'number') return ts;
            return 0;
        };

        addLog(`[Context Graph] Phase 1: Fetching timestamps from 5 source collections...`);
        for (let i = 0; i < zpids.length; i += BATCH) {
            const chunk = zpids.slice(i, i + BATCH);
            if (!firestoreDb) break;

            const [graphSnap, propSnap, visualSnap, compSnap, envSnap] = await Promise.all([
                getDocs(query(collection(firestoreDb, 'context_graph'), where(documentId(), 'in', chunk))),
                getDocs(query(collection(firestoreDb, 'properties'), where(documentId(), 'in', chunk))),
                getDocs(query(collection(firestoreDb, 'property_analyses_visual'), where(documentId(), 'in', chunk))),
                getDocs(query(collection(firestoreDb, 'property_analyses_comprehensive'), where(documentId(), 'in', chunk))),
                getDocs(query(collection(firestoreDb, 'google_environmental_data'), where(documentId(), 'in', chunk))),
            ]);

            // Context graph timestamps
            graphSnap.forEach(d => {
                const data = d.data();
                graphTimestamps[d.id] = toMs(data.lastUpdated);
                graphExists[d.id] = !!(data.factors?.length > 0);
            });

            // Source collection timestamps — take the MAX across all 5 sources
            const updateMax = (zpid: string, ts: any) => {
                const ms = toMs(ts);
                if (ms > (sourceTimestamps[zpid] || 0)) sourceTimestamps[zpid] = ms;
            };
            propSnap.forEach(d => updateMax(d.id, d.data().lastUpdated));
            visualSnap.forEach(d => updateMax(d.id, d.data().timestamp));
            compSnap.forEach(d => updateMax(d.id, d.data().timestamp));
            envSnap.forEach(d => updateMax(d.id, d.data().lastUpdated));  // env data updates trigger regen too
        }

        // ── Phase 2: Classify each property ──
        const needsGeneration: string[] = [];  // new — no graph exists
        const needsRegen: string[] = [];       // stale — source updated after graph
        const upToDate: string[] = [];         // fresh — graph is newer than all sources

        for (const zpid of zpids) {
            if (forceAll) {
                // Force mode: treat every property as needing generation/regen
                (graphExists[zpid] ? needsRegen : needsGeneration).push(zpid);
            } else if (!graphExists[zpid]) {
                needsGeneration.push(zpid);
            } else {
                const graphTs = graphTimestamps[zpid] || 0;
                const sourceTs = sourceTimestamps[zpid] || 0;
                if (sourceTs > graphTs) {
                    needsRegen.push(zpid);
                } else {
                    upToDate.push(zpid);
                }
            }
        }

        addLog(`[Context Graph] Phase 1 results: ${needsGeneration.length} new, ${needsRegen.length} stale${forceAll ? ' (forced)' : ''}, ${upToDate.length} up-to-date`);
        skipped = upToDate.length;
        setGraphBatchProgress({ done, skipped, failed, total: zpids.length });

        // ── Phase 3: Generate/regenerate only what's needed ──
        const toProcess = [...needsGeneration, ...needsRegen];
        if (toProcess.length === 0) {
            addLog(`[Context Graph] All ${zpids.length} graphs are up-to-date. Nothing to do.`);
            setGraphBatchRunning(false);
            return;
        }

        addLog(`[Context Graph] Phase 2: Extracting ${toProcess.length} context graphs (${needsGeneration.length} new + ${needsRegen.length} stale)...`);

        const CHUNK_SIZE = 5;

        for (let i = 0; i < toProcess.length; i += CHUNK_SIZE) {
            const chunk = toProcess.slice(i, i + CHUNK_SIZE);

            const results = await Promise.allSettled(chunk.map(async (zpid) => {
                const addr = zpidToAddressMap[zpid] || zpid;
                const isRegen = needsRegen.includes(zpid);

                // Load property, visual, comprehensive, and google_environmental_data from Firestore
                const { getGoogleDataFromCloud } = await import('../../services/firebase/googleData');
                const [property, visual, comprehensive, lifestyleFit, envData] = await Promise.all([
                    getPropertyFromCloud(zpid),
                    getVisualAnalysisFromCloud(zpid),
                    getComprehensiveAnalysisFromCloud(zpid),
                    import('../../services/firebase/properties').then(m => m.getLifestyleFitFromCloud(zpid)),
                    getGoogleDataFromCloud(zpid).catch(() => null),
                ]);

                if (!property) {
                    addLog(`[Context Graph] ⊘ Skip ${addr} — no property data`);
                    return { status: 'missing', reasons: ['no property data'] };
                }

                // Detailed check: identify exactly what's missing
                const missingReasons: string[] = [];
                const propAddr = property.address || property.location?.address?.line || '';
                if (!/^\d/.test(propAddr.trim())) missingReasons.push('address');
                if (!(property.price || property.list_price || property.zestimate)) missingReasons.push('price');
                if (!(property.bedrooms || property.beds)) missingReasons.push('beds');
                if (!(property.livingAreaValue || property.livingArea || property.sqft)) missingReasons.push('sqft');

                if (missingReasons.length > 0) {
                    addLog(`[Context Graph] ⊘ Skip ${addr} — missing: ${missingReasons.join(', ')}`);
                    return { status: 'missing', reasons: missingReasons };
                }

                // Merge google_environmental_data fields onto property so precompute factors
                // have access to google_places (walkable amenities, medical, nearby places),
                // noiseScore, solarData, evChargers, pollen, broadband, etc.
                // These fields are stripped from the `properties` doc to stay under 1MB.
                const enrichedProperty = envData
                    ? { ...property, ...envData }
                    : property;

                // City-level data (community_pulse, deep_investment_research, etc.) is now
                // extracted once per city via city_context_graph — no longer sent per-property.
                const city = property.city || '';
                const state = property.state || '';
                let enrichedVisual = visual || {} as any;
                if (lifestyleFit) enrichedVisual = { ...enrichedVisual, lifestyle_fit: lifestyleFit };

                // Extract context graph via Gemini
                addLog(`[Context Graph] ${isRegen ? '↻ Regen' : '▶ New'} ${addr}...`);
                const res = await extractContextGraphFactors(enrichedProperty as any, enrichedVisual, comprehensive || null);

                if (res.data?.factors?.length > 0) {
                    await saveContextGraphToCloud(zpid, res.data, enrichedProperty.city, enrichedProperty.state, {
                        price: enrichedProperty.price ?? enrichedProperty.zestimate,
                        beds: enrichedProperty.bedrooms,
                        baths: enrichedProperty.bathrooms,
                        sqft: enrichedProperty.livingAreaValue,
                        yearBuilt: enrichedProperty.yearBuilt,
                        homeType: enrichedProperty.homeType,
                        address: enrichedProperty.address
                    });
                    addLog(`[Context Graph] ✓ Saved ${res.data.factors.length} factors for ${addr}`);
                    return { status: 'done' };
                } else {
                    addLog(`[Context Graph] ✗ No factors returned for ${addr}`);
                    return { status: 'failed' };
                }
            }));

            // Tally results
            for (const r of results) {
                if (r.status === 'fulfilled') {
                    const val = r.value as any;
                    if (val.status === 'done') done++;
                    else if (val.status === 'missing') {
                        missingData++;
                        missingDataDetails.push({ addr: val.addr || '?', reasons: val.reasons || [] });
                    } else failed++;
                } else {
                    failed++;
                    console.error('[Context Graph Batch] Error:', r.reason);
                    addLog(`[Context Graph] ✗ Error: ${r.reason?.message || r.reason}`);
                }
            }

            setGraphBatchProgress({ done, skipped, failed, total: zpids.length });

            // Brief cooldown between chunks
            if (i + CHUNK_SIZE < toProcess.length) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        // Summary with missing-data breakdown
        const summaryParts = [
            `${done} generated/regenerated`,
            `${skipped} up-to-date`,
        ];
        if (missingData > 0) {
            // Count missing reasons
            const reasonCounts: Record<string, number> = {};
            for (const d of missingDataDetails) {
                for (const r of d.reasons) {
                    reasonCounts[r] = (reasonCounts[r] || 0) + 1;
                }
            }
            const reasonStr = Object.entries(reasonCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([r, c]) => `${c} no ${r}`)
                .join(', ');
            summaryParts.push(`${missingData} missing data (${reasonStr})`);
        }
        if (failed > 0) summaryParts.push(`${failed} failed`);
        addLog(`[Context Graph] Sync complete: ${summaryParts.join(', ')} / ${zpids.length} total.`);
        logPipelineAudit('Sync Context Graphs', `${zpids.length} properties`, failed === 0 && missingData === 0 ? 'success' : 'partial', summaryParts.join(', '), undefined, { done, skipped, failed, missingData, total: zpids.length, newCount: needsGeneration.length, staleCount: needsRegen.length });
        setGraphBatchRunning(false);
    };

    // ── Bootstrap Buyer DNA ───────────────────────────────────────────────
    const handleBootstrapBuyerDna = async () => {
        const targetIds = selectedIds.size > 0
            ? new Set(Array.from(selectedIds).filter(id => cachedPropertyIds.has(id)))
            : cachedPropertyIds;
        if (targetIds.size === 0) {
            addLog('Load listings and check cache first before running DNA bootstrap.');
            return;
        }

        setDnaBootstrapRunning(true);
        setDnaBootstrapProgress({ done: 0, skipped: 0, failed: 0, total: targetIds.size });
        addLog(`[Buyer DNA] Bootstrapping for ${targetIds.size} properties...`);

        const zpids = Array.from(targetIds) as string[];
        let done = 0;
        let skipped = 0;
        let failed = 0;

        const { db: firestoreDb } = await import('../../services/firebase/config');
        const { getDoc, doc, updateDoc } = await import('firebase/firestore');
        const { executeGeminiRequest, FLASH_MODEL } = await import('../../services/geminiService');
        const { getBuyerDnaCompressionPrompt, buyerDnaCompressionSchema } = await import('../../prompts/property/buyerDnaCompression');

        const CHUNK_SIZE = 5;

        for (let i = 0; i < zpids.length; i += CHUNK_SIZE) {
            const chunk = zpids.slice(i, i + CHUNK_SIZE);

            await Promise.allSettled(chunk.map(async (zpid) => {
                const addr = zpidToAddressMap[zpid] || zpid;
                try {
                    const ref = doc(firestoreDb!, 'context_graph', zpid);
                    const snap = await getDoc(ref);
                    
                    if (!snap.exists()) {
                        skipped++;
                        addLog(`[Buyer DNA] ⊘ Skip ${addr} — no context graph`);
                        return;
                    }

                    const data = snap.data();
                    if (!data.factors || data.factors.length === 0) {
                        skipped++;
                        addLog(`[Buyer DNA] ⊘ Skip ${addr} — no factors in graph`);
                        return;
                    }

                    if (data.buyerDna && !forceGraphRegen) {
                        skipped++;
                        addLog(`[Buyer DNA] ⊘ Skip ${addr} — already has Buyer DNA`);
                        return;
                    }

                    const factors = data.factors;
                    const prompt = getBuyerDnaCompressionPrompt(factors);
                    
                    const dnaResult = await executeGeminiRequest<any>({
                        model: FLASH_MODEL,
                        contents: prompt,
                        config: { temperature: 0.2, maxOutputTokens: 2048 },
                        userId: auth?.currentUser?.uid,
                        zpid,
                        address: addr,
                        promptFilename: "buyerDnaCompression.ts",
                        extractResultJson: true,
                        schema: buyerDnaCompressionSchema
                    });

                    if (dnaResult.data) {
                        await updateDoc(ref, {
                            'buyerDna': dnaResult.data,
                            'lastUpdated': new Date()
                        });
                        done++;
                        addLog(`[Buyer DNA] ✓ Generated and saved for ${addr}`);
                    } else {
                        failed++;
                        addLog(`[Buyer DNA] ✗ No data returned for ${addr}`);
                    }
                } catch (e: any) {
                    failed++;
                    addLog(`[Buyer DNA] ✗ Failed for ${addr}: ${e.message}`);
                    if (e.rawResponse) {
                        addLog(`[Buyer DNA] RAW RESPONSE: ${e.rawResponse.substring(0, 150)}...`);
                    }
                }
            }));
            
            setDnaBootstrapProgress({ done, skipped, failed, total: zpids.length });
            // Add a small delay between chunks to avoid rate limits
            if (i + CHUNK_SIZE < zpids.length) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        setDnaBootstrapRunning(false);
        addLog(`[Buyer DNA] Bootstrap complete: ${done} done, ${skipped} skipped, ${failed} failed out of ${zpids.length}.`);
    };

    // ── Backfill Context Graph Metadata ───────────────────────────────────
    const handleBackfillMetadata = async () => {
        if (cachedPropertyIds.size === 0) {
            addLog('Load listings and check cache first before running backfill.');
            return;
        }
        setBackfillRunning(true);
        setBackfillProgress({ done: 0, skipped: 0, total: cachedPropertyIds.size });
        addLog(`[Backfill] Starting metadata backfill for ${cachedPropertyIds.size} context graphs...`);

        try {
            const { backfillContextGraphMetadata } = await import('../../services/firebase/properties');
            const zpids = Array.from(cachedPropertyIds) as string[];
            const result = await backfillContextGraphMetadata(zpids, (done, skipped, total) => {
                setBackfillProgress({ done, skipped, total });
            });
            addLog(`[Backfill] Complete: ${result.updated} updated, ${result.skipped} skipped (already had city), ${result.failed} failed / ${zpids.length} total.`);
            logPipelineAudit('Backfill Graph Metadata', `${zpids.length} properties`, result.failed === 0 ? 'success' : 'partial', `${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed`);
        } catch (e: any) {
            addLog(`[Backfill] Error: ${e.message}`);
        } finally {
            setBackfillRunning(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) {
            addLog('[Delete] No properties selected.');
            return;
        }
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected properties? This will wipe all analysis, assets, and metadata from Firestore.`)) {
            return;
        }

        setLoading(true);
        addLog(`[Delete] Wiping ${selectedIds.size} properties from Firestore...`);
        let deleted = 0;
        let failed = 0;

        try {
            const { deletePropertyAnalysis } = await import('../../services/firebase/properties');
            const { deleteDoc, doc: firestoreDoc } = await import('firebase/firestore');
            const { db: firestoreDb } = await import('../../services/firebase/config');

            for (const zpid of Array.from(selectedIds)) {
                try {
                    // 1. Delete nested analysis subcollections
                    await deletePropertyAnalysis(String(zpid));
                    // 2. Delete core doc
                    if (firestoreDb) {
                        await deleteDoc(firestoreDoc(firestoreDb, 'properties', String(zpid)));
                    }
                    deleted++;
                } catch (e: any) {
                    console.error(`Failed to delete ${zpid}:`, e);
                    failed++;
                }
            }

            addLog(`[Delete] Complete: ${deleted} deleted, ${failed} failed.`);
            setCachedPropertyIds(prev => {
                const next = new Set(prev);
                selectedIds.forEach(id => next.delete(id));
                return next;
            });
            setSelectedIds(new Set());
            fetchStatuses(listings);
        } catch (e: any) {
            addLog(`[Delete] Critical failure: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    // ── Buyer Story Search ─────────────────────────────────────────────
    const handleBuyerSearch = async () => {
        if (!buyerStory.trim()) return;
        setBuyerSearching(true);
        setBuyerResults(null);
        addLog(`[Buyer Search] Starting search with story: "${buyerStory.substring(0, 80)}..."`);

        try {
            // 1. Apply filters from listings to narrow candidates
            const minPrice = buyerFilterPrice[0] ? parseFloat(buyerFilterPrice[0]) * 1000 : 0;
            const maxPrice = buyerFilterPrice[1] ? parseFloat(buyerFilterPrice[1]) * 1000 : Infinity;
            const minBeds = buyerFilterBeds ? parseInt(buyerFilterBeds) : 0;
            const minBaths = buyerFilterBaths ? parseInt(buyerFilterBaths) : 0;

            // Build a zpid → listing lookup from loaded listings
            const listingByZpid: Record<string, any> = {};
            for (const l of listings) {
                const id = String(l.property_id || l.zpid || '');
                if (id) listingByZpid[id] = l;
            }

            let candidateZpids = Array.from(cachedPropertyIds) as string[];

            // Filter by listing data if filters are set
            if (minPrice > 0 || maxPrice < Infinity || minBeds > 0 || minBaths > 0) {
                candidateZpids = candidateZpids.filter(zpid => {
                    const l = listingByZpid[zpid];
                    if (!l) return true; // keep if no listing data (will filter by graph later)
                    const price = l.list_price || 0;
                    if (price > 0 && (price < minPrice || price > maxPrice)) return false;
                    if (minBeds > 0 && l.beds && l.beds < minBeds) return false;
                    if (minBaths > 0 && l.baths && l.baths < minBaths) return false;
                    return true;
                });
                addLog(`[Buyer Search] Filtered to ${candidateZpids.length} properties (price: $${minPrice / 1000}K–$${maxPrice === Infinity ? '∞' : maxPrice / 1000 + 'K'}, beds≥${minBeds}, baths≥${minBaths})`);
            }

            // Cap at 20
            const MAX_PROPERTIES = 20;
            if (candidateZpids.length > MAX_PROPERTIES) {
                addLog(`[Buyer Search] Capping from ${candidateZpids.length} to ${MAX_PROPERTIES} properties`);
                candidateZpids = candidateZpids.slice(0, MAX_PROPERTIES);
            }

            // 2. Load context graphs for filtered candidates (single batch query)
            addLog(`[Buyer Search] Loading context graphs for ${candidateZpids.length} properties...`);
            const graphMap = await getContextGraphsBatch(candidateZpids);
            const graphs: { zpid: string; address: string; graph: any }[] = [];
            for (const zpid of candidateZpids) {
                const graph = graphMap.get(zpid);
                if (graph?.factors?.length > 0) {
                    graphs.push({ zpid, address: zpidToAddressMap[zpid] || zpid, graph });
                }
            }

            addLog(`[Buyer Search] Loaded ${graphs.length} context graphs. Sending to Gemini...`);

            // 2. Build compact property summaries for the prompt
            const propertySummaries = graphs.map(g => ({
                zpid: g.zpid,
                address: g.address,
                factors: g.graph.factors,
                keyMetrics: g.graph.keyMetrics,
                summary: g.graph.summary
            }));

            const prompt = `You are a real estate matchmaker. A buyer has described their story and preferences below. Match them to the most relevant properties from the portfolio.

## BUYER STORY
${buyerStory}

## PROPERTY PORTFOLIO (${propertySummaries.length} properties)
${JSON.stringify(propertySummaries)}

## INSTRUCTIONS
- Analyze the buyer's needs, lifestyle, priorities, and constraints
- Score each property 0-100 based on how well it matches the buyer's story
- Return the TOP 10 most relevant properties, ranked by score
- For each match, explain WHY this property fits the buyer's story (2-3 specific reasons)
- Write a highlight sentence that would resonate with this specific buyer`;

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
                                reasons: { type: Type.ARRAY, items: { type: Type.STRING } },
                                highlight: { type: Type.STRING }
                            },
                            required: ['zpid', 'score', 'reasons', 'highlight']
                        }
                    }
                },
                required: ['matches']
            };

            const result = await executeGeminiRequest<{ matches: { zpid: string; score: number; reasons: string[]; highlight: string }[] }>({
                model: FLASH_MODEL,
                contents: prompt,
                config: { temperature: 0.3, maxOutputTokens: 8192 },
                userId: auth.currentUser?.uid || 'admin',
                promptFilename: 'buyerStorySearch',
                extractResultJson: true,
                schema
            });

            if (result.data?.matches) {
                const matches = result.data.matches
                    .sort((a, b) => b.score - a.score)
                    .map(m => ({
                        ...m,
                        address: zpidToAddressMap[m.zpid] || m.zpid
                    }));
                setBuyerResults(matches);
                addLog(`[Buyer Search] Found ${matches.length} matches. Top: ${matches[0]?.address} (${matches[0]?.score}/100)`);
            } else {
                addLog('[Buyer Search] No matches returned from Gemini');
            }
        } catch (err: any) {
            addLog(`[Buyer Search] Error: ${err.message}`);
            console.error('[Buyer Search]', err);
        } finally {
            setBuyerSearching(false);
        }
    };

    // ── Batch Orientation Analysis ─────────────────────────────────────────
    const handleBatchOrientation = async (manualZpids?: string[] | React.MouseEvent) => {
        // If manualZpids is provided as an array, use it. 
        // If it's a MouseEvent or undefined, fall back to selectedIds or cachedPropertyIds.
        let targetIds: Set<string>;
        if (Array.isArray(manualZpids)) {
            targetIds = new Set(manualZpids);
        } else {
            targetIds = selectedIds.size > 0
                ? new Set(Array.from(selectedIds).filter(id => cachedPropertyIds.has(id)))
                : cachedPropertyIds;
        }

        if (targetIds.size === 0) return;

        setBatchStartTime(Date.now());
        setLoading(true);
        setError(null);
        setPipelineType('orientation');
        setViewMode('ingestion');
        addLog(`Queueing Orientation Batch for ${targetIds.size} properties...`);

        const zpids = Array.from(targetIds) as string[];
        const batchId = `orient_batch_${Date.now()}`;

        try {
            const { db } = await import('../../services/firebase/config');
            const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
            if (!db) throw new Error('Firestore not initialized');

            await setDoc(doc(db, 'orientation_batch_jobs', batchId), {
                zpids,
                status: 'queued',
                total: zpids.length,
                done: 0,
                failed: 0,
                results: {},
                userId: auth?.currentUser?.uid || 'anonymous',
                createdAt: serverTimestamp(),
            });

            setOrientBatchRunning(true);
            setOrientBatchProgress({ computed: 0, cached: 0, failed: 0, total: zpids.length });
            setActiveBatchId(batchId);
            setLoading(false);
            addLog(`Orientation Batch queued successfully.`);
        } catch (e: any) {
            setError(`Failed to queue orientation: ${e.message}`);
            setLoading(false);
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

    useEffect(() => {
        if (viewMode === 'audit') {
            loadAuditTrail();
        }
    }, [viewMode, loadAuditTrail]);

    // Table Row Component
    const ListingRow = ({ item }: { item: any, key?: any }) => {
        const itemId = String(item.zpid);

        // Helper to extract sold date
        const extractSoldDate = (p: any) => {
            const raw = p.dateSold || p.lastSoldDate || p.soldDate || p.date_sold || p.sold_date || p.closedDate;
            if (!raw) return null;
            try {
                const d = new Date(raw);
                if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            } catch { }
            return String(raw);
        };
        const soldDate = extractSoldDate(item);
        const isSelected = selectedIds.has(itemId);
        const isCached = cachedPropertyIds.has(itemId);
        const isDeprecated = sweepResult?.deprecated.includes(itemId) ?? false;

        const lastUpdated = propertyStatuses[itemId]?.property?.timestamp;
        const isNew = useMemo(() => {
            if (!lastUpdated) return false;
            const updatedDate = lastUpdated.toMillis ? lastUpdated.toMillis() : (typeof lastUpdated === 'number' ? lastUpdated : new Date(lastUpdated).getTime());
            const fiveDaysAgo = Date.now() - (5 * 24 * 60 * 60 * 1000);
            return updatedDate > fiveDaysAgo;
        }, [lastUpdated]);

        const STALE_THRESHOLD_DAYS = 30;
        const getStaleness = (ts: any) => {
            if (!ts) return null;
            const ms = ts.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : new Date(ts).getTime());
            const days = Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
            return days;
        };

        const status = propertyStatuses[itemId];
        const propertyAge = getStaleness(status?.property?.timestamp);
        const visualAge = getStaleness(status?.visual?.timestamp);
        const comprehensiveAge = getStaleness((status as any)?.comprehensive?.timestamp);
        const environmentalAge = getStaleness((status as any)?.environmental?.timestamp);

        const isPropertyStale = propertyAge !== null && propertyAge >= STALE_THRESHOLD_DAYS;
        const isVisualStale = visualAge !== null && visualAge >= STALE_THRESHOLD_DAYS;
        const isComprehensiveStale = comprehensiveAge !== null && comprehensiveAge >= STALE_THRESHOLD_DAYS;
        const isEnvironmentalStale = environmentalAge !== null && environmentalAge >= STALE_THRESHOLD_DAYS;

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
                                    <i className="fa-solid fa-house text-xs"></i>
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
                                {isNew && !isDeprecated && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest rounded-lg shadow-sm animate-in zoom-in-50 duration-300">
                                        <i className="fa-solid fa-sparkles text-[7px]"></i> New
                                    </span>
                                )}
                                {isCached && !propertyStatuses[itemId]?.visual && !isDeprecated && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 text-[8px] font-black uppercase tracking-widest rounded-lg animate-pulse">
                                        <i className="fa-solid fa-spinner animate-spin text-[7px]"></i> Pending AI
                                    </span>
                                )}
                                {isDeprecated && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 border border-amber-200 text-amber-700 text-[8px] font-black uppercase tracking-widest rounded-lg">
                                        <i className="fa-solid fa-ban text-[7px]"></i> Deprecated
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </td>

                <td className="p-4 text-right font-bold text-slate-800 text-[10px] uppercase tracking-widest bg-slate-50/20">
                    {item.homeType || item.prop_type || item.propertyType || item.property_type || 'Residential'}
                </td>
                {activeTableTab === 'sold' && (
                    <td className="p-4 text-right font-black text-rose-600 text-[10px] uppercase tracking-widest">
                        {soldDate || '—'}
                    </td>
                )}
                <td className="p-4">
                    <div className="flex items-center gap-3">
                        {/* Asset Icons */}
                        <div className="flex items-center gap-1.5 mt-1">
                            <div className="relative group/tooltip">
                                <i className={`fa-solid fa-image text-[10px] ${propertyStatuses[itemId]?.assets?.images ? 'text-emerald-500' : 'text-slate-200'}`}></i>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider rounded whitespace-nowrap z-50 opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all duration-200 translate-y-1 group-hover/tooltip:translate-y-0 shadow-lg">
                                    {propertyStatuses[itemId]?.assets?.images ? "Property Photos Verified" : "Photos Missing"}
                                </div>
                            </div>

                            <div className="relative group/tooltip">
                                <i className={`fa-solid fa-map-location-dot text-[10px] ${propertyStatuses[itemId]?.assets?.map ? 'text-emerald-500' : 'text-slate-200'}`}></i>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider rounded whitespace-nowrap z-50 opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all duration-200 translate-y-1 group-hover/tooltip:translate-y-0 shadow-lg">
                                    {propertyStatuses[itemId]?.assets?.map ? "Radar Maps (Close-up) Verified" : "Radar Maps Missing"}
                                </div>
                            </div>

                            <div className="relative group/tooltip">
                                <i className={`fa-solid fa-street-view text-[10px] ${propertyStatuses[itemId]?.assets?.streetView ? 'text-emerald-500' : 'text-slate-200'}`}></i>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider rounded whitespace-nowrap z-50 opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all duration-200 translate-y-1 group-hover/tooltip:translate-y-0 shadow-lg">
                                    {propertyStatuses[itemId]?.assets?.streetView ? "Street View Imagery Secured" : "Street View Missing"}
                                </div>
                            </div>

                            <div className="relative group/tooltip">
                                <i className={`fa-solid fa-satellite text-[10px] ${propertyStatuses[itemId]?.assets?.satellite ? 'text-emerald-500' : 'text-slate-200'}`}></i>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider rounded whitespace-nowrap z-50 opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all duration-200 translate-y-1 group-hover/tooltip:translate-y-0 shadow-lg">
                                    {propertyStatuses[itemId]?.assets?.satellite ? "Satellite Imagery (2x Res) Verified" : "Satellite Imagery Missing"}
                                </div>
                            </div>
                        </div>

                        <div className="w-px h-3 bg-slate-100"></div>

                        {/* Intel Icons */}
                        <div className="flex items-center gap-1.5 mt-1">
                            <div className="relative group/tooltip">
                                <i className={`fa-solid fa-compass text-[10px] ${(propertyStatuses[itemId]?.assets as any)?.orientation ? 'text-amber-500' : 'text-slate-200'}`}></i>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider rounded whitespace-nowrap z-50 opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all duration-200 translate-y-1 group-hover/tooltip:translate-y-0 shadow-lg">
                                    {(propertyStatuses[itemId]?.assets as any)?.orientation ? "Orientation & Compass Analysis Done" : "Orientation Analysis Missing"}
                                </div>
                            </div>

                            <div className="relative group/tooltip">
                                <i className={`fa-solid fa-file-invoice text-[10px] ${propertyStatuses[itemId]?.property ? 'text-indigo-500' : 'text-slate-200'}`}></i>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider rounded whitespace-nowrap z-50 opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all duration-200 translate-y-1 group-hover/tooltip:translate-y-0 shadow-lg">
                                    {propertyStatuses[itemId]?.property ? "Database Record Verified" : "No Database Record Found"}
                                </div>
                            </div>

                            <div className="relative group/tooltip">
                                <i className={`fa-solid fa-brain text-[10px] ${propertyStatuses[itemId]?.visual ? 'text-indigo-500' : 'text-slate-200'}`}></i>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider rounded whitespace-nowrap z-50 opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all duration-200 translate-y-1 group-hover/tooltip:translate-y-0 shadow-lg">
                                    {propertyStatuses[itemId]?.visual ? "Gemini Visual Analysis Complete" : "AI Analysis Pending"}
                                </div>
                            </div>
                        </div>
                    </div>
                </td>
                <td className="p-4 text-[10px] font-mono text-slate-400 text-center">
                    {propertyStatuses[itemId]?.property?.timestamp ? (
                        new Date(propertyStatuses[itemId].property.timestamp.toMillis ? propertyStatuses[itemId].property.timestamp.toMillis() : propertyStatuses[itemId].property.timestamp).toLocaleDateString()
                    ) : '--'}
                </td>
                <td className="p-4 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-1">
                        {isPropertyStale && (
                            <span className="px-1.5 py-0.5 bg-rose-50 border border-rose-100 text-rose-600 text-[8px] font-black uppercase tracking-tighter rounded" title={`Property specs stale (${propertyAge} days old)`}>
                                Specs
                            </span>
                        )}
                        {isVisualStale && (
                            <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-100 text-amber-600 text-[8px] font-black uppercase tracking-tighter rounded" title={`Visual AI stale (${visualAge} days old)`}>
                                Visual
                            </span>
                        )}
                        {isComprehensiveStale && (
                            <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 text-[8px] font-black uppercase tracking-tighter rounded" title={`Intel Suite stale (${comprehensiveAge} days old)`}>
                                Intel
                            </span>
                        )}
                        {isEnvironmentalStale && (
                            <span className="px-1.5 py-0.5 bg-sky-50 border border-sky-100 text-sky-600 text-[8px] font-black uppercase tracking-tighter rounded" title={`Environmental stale (${environmentalAge} days old)`}>
                                Env
                            </span>
                        )}
                        {!isPropertyStale && !isVisualStale && !isComprehensiveStale && !isEnvironmentalStale && isCached && (
                            <span className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-600 text-[8px] font-black uppercase tracking-tighter rounded">
                                Optimal
                            </span>
                        )}
                        {!isCached && <span className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">N/A</span>}
                    </div>
                </td>
                <td className="p-4 text-right">
                    <div className="flex justify-end items-center gap-1">
                        {isCached && (
                            <>
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        const fullAddress = centralFormatAddress(item.location?.address) || (item.location?.address?.line || itemId);

                                        // Simple immediate feedback
                                        const btn = e.currentTarget;
                                        const icon = btn.querySelector('i');
                                        if (icon) icon.className = 'fa-solid fa-spinner animate-spin';
                                        btn.disabled = true;

                                        const res = await refreshStreetView(itemId, fullAddress);

                                        if (res.success) {
                                            alert(`Success: ${res.detail}`);
                                            // Refresh local status
                                            const newStatuses = await getPropertyStatusesBatch([itemId]);
                                            setPropertyStatuses(prev => ({ ...prev, ...newStatuses }));
                                        } else {
                                            alert(`Unavailable: ${res.detail} (Status: ${res.status})`);
                                        }

                                        if (icon) icon.className = 'fa-solid fa-street-view';
                                        btn.disabled = false;
                                    }}
                                    className="p-2 text-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all relative group/action-tooltip"
                                    title="Refresh Street View"
                                >
                                    <i className="fa-solid fa-street-view"></i>
                                    <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider rounded whitespace-nowrap z-50 opacity-0 group-hover/action-tooltip:opacity-100 pointer-events-none transition-all duration-200 translate-y-1 group-hover/action-tooltip:translate-y-0 shadow-lg">
                                        Re-validate Street View
                                    </div>
                                </button>

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
                                    className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all relative group/action-tooltip"
                                    title="Clear from Cache"
                                >
                                    <i className="fa-solid fa-trash-can"></i>
                                    <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider rounded whitespace-nowrap z-50 opacity-0 group-hover/action-tooltip:opacity-100 pointer-events-none transition-all duration-200 translate-y-1 group-hover/action-tooltip:translate-y-0 shadow-lg">
                                        Clear from Cache
                                    </div>
                                </button>
                            </>
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

    const loadSoldProperties = useCallback(async () => {
        setLoadingSold(true);
        try {
            const allSold = await getDeprecatedProperties();
            // Filter by city if set
            if (city) {
                const { cityName } = parseCityInput(city);
                const filtered = allSold.filter(p => 
                    (p.location?.address?.city?.toLowerCase() === cityName.toLowerCase()) ||
                    (p.city?.toLowerCase() === cityName.toLowerCase())
                );
                setSoldProperties(filtered);
            } else {
                setSoldProperties(allSold);
            }
        } catch (err) {
            console.error('Error loading sold properties:', err);
        } finally {
            setLoadingSold(false);
        }
    }, [city]);

    useEffect(() => {
        if (activeTableTab === 'sold') {
            loadSoldProperties();
        }
    }, [activeTableTab, loadSoldProperties]);

    return (
        <div className="max-w-7xl mx-auto py-12 px-6 animate-in fade-in duration-700">
            {/* Header / Sub-tabs */}
            <div className="flex items-center gap-6 mb-8 border-b border-slate-100 pb-6">
                <button
                    onClick={() => setActiveTableTab('active')}
                    className={`flex items-center gap-3 pb-2 transition-all relative ${activeTableTab === 'active' ? 'text-indigo-600 font-black' : 'text-slate-400 font-bold hover:text-slate-600'}`}
                >
                    <i className="fa-solid fa-house-signal"></i>
                    Active Listings
                    {activeTableTab === 'active' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-full"></div>}
                </button>
                <button
                    onClick={() => setActiveTableTab('sold')}
                    className={`flex items-center gap-3 pb-2 transition-all relative ${activeTableTab === 'sold' ? 'text-amber-600 font-black' : 'text-slate-400 font-bold hover:text-slate-600'}`}
                >
                    <i className="fa-solid fa-house-circle-check"></i>
                    Sold & Unlisted
                    {activeTableTab === 'sold' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-600 rounded-full"></div>}
                </button>

                <div className="flex-1"></div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setViewMode(viewMode === 'monitoring' ? 'table' : 'monitoring')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'monitoring' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 text-slate-400 hover:text-indigo-600 border border-slate-100 hover:border-indigo-100'}`}
                        title="View real-time pipeline status"
                    >
                        <i className="fa-solid fa-tower-broadcast"></i>
                        Pipeline
                    </button>
                    <button
                        onClick={() => setViewMode(viewMode === 'audit' ? 'table' : 'audit')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'audit' ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'bg-slate-50 text-slate-400 hover:text-slate-900 border border-slate-100 hover:border-slate-300'}`}
                        title="View pipeline audit logs"
                    >
                        <i className="fa-solid fa-list-check"></i>
                        Audit
                    </button>
                    
                    <div className="w-px h-6 bg-slate-100"></div>

                    <button
                        onClick={async () => {
                            setIsLoadingStats(true);
                            try {
                                let latestJob = null;
                                if (activeBatchId) {
                                    const { getFirestore, doc, getDoc } = await import('firebase/firestore');
                                    const db = getFirestore();
                                    const collection = activeBatchId.startsWith('intel_') ? 'full_intel_batch_jobs'
                                        : activeBatchId.startsWith('orient_') ? 'orientation_batch_jobs'
                                            : activeBatchId.startsWith('narrative_') ? 'narrative_batch_jobs'
                                                : activeBatchId.startsWith('asset_') ? 'asset_secure_batch_jobs'
                                                    : 'property_data_batch_jobs';
                                    const snap = await getDoc(doc(db, collection, activeBatchId));
                                    if (snap.exists()) latestJob = { ...snap.data(), id: snap.id, type: collection };
                                }
                                if (!latestJob) latestJob = await fetchLatestBatchJob();
                                if (latestJob) {
                                    setLastRunStats(latestJob);
                                    setShowSummaryModal(true);
                                } else {
                                    addLog("No batch jobs found.");
                                }
                            } catch (err: any) {
                                console.error("Failed to fetch run summary:", err);
                                addLog(`Error: ${err.message}`);
                            } finally {
                                setIsLoadingStats(false);
                            }
                        }}
                        disabled={isLoadingStats}
                        className="px-5 py-2.5 bg-white border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                        title="View the status and cost summary of the most recent batch run"
                    >
                        {isLoadingStats ? (
                            <i className="fa-solid fa-spinner animate-spin"></i>
                        ) : (
                            <i className="fa-solid fa-chart-pie text-indigo-500"></i>
                        )}
                        Run Summary
                    </button>
                </div>
            </div>

            <div className="mb-6 items-center justify-between flex">
                <div className="flex items-center gap-3">
                    {viewMode === 'table' ? (
                        <>
                            {((activeTableTab === 'active' && listings.length > 0) || (activeTableTab === 'sold' && soldProperties.length > 0)) && (
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
                                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                                    <button
                                        onClick={selectStale}
                                        className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-amber-600 transition-all"
                                        title="Select properties with stale or failed data"
                                    >
                                        Select Stale
                                    </button>
                                </div>
                            )}

                            {selectedIds.size > 0 && (
                                <div className="flex items-center gap-3 animate-in slide-in-from-top-4">
                                    <button
                                        onClick={() => handleBulkSecureImages()}
                                        disabled={assetBatchRunning || loading}
                                        className="px-4 py-2.5 bg-white border border-slate-200 hover:border-blue-200 hover:bg-blue-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all flex items-center gap-2 group disabled:opacity-50"
                                        title="Reconcile and secure property images in background"
                                    >
                                        <i className="fa-solid fa-shield-halved text-blue-500 group-hover:scale-110 transition-transform"></i>
                                        Secure Assets ({visibleSelectedCount})
                                    </button>

                                    <button
                                        onClick={() => handleBulkPropertyData()}
                                        disabled={propBatchRunning || loading}
                                        className="px-4 py-2.5 bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all flex items-center gap-2 group disabled:opacity-50"
                                        title="Fetch Zillow specs & environmental data for selected properties"
                                    >
                                        <i className="fa-solid fa-database text-emerald-500 group-hover:scale-110 transition-transform"></i>
                                        Property Data ({visibleSelectedCount})
                                    </button>

                                    <button
                                        onClick={() => handleBulkIngest()}
                                        disabled={loading}
                                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-[1.2rem] text-[10px] font-black shadow-lg shadow-indigo-200 transition-all flex items-center gap-3 group"
                                    >
                                        <i className="fa-solid fa-bolt-lightning group-hover:scale-125 transition-transform"></i>
                                        Full Intel Suite ({visibleSelectedCount})
                                    </button>

                                    <button
                                        onClick={() => handleBulkNarrative()}
                                        disabled={loading}
                                        className="px-6 py-3 bg-white border-2 border-fuchsia-200 hover:border-fuchsia-400 hover:bg-fuchsia-50 text-slate-700 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest shadow-sm transition-all animate-in slide-in-from-right flex items-center gap-3 group disabled:opacity-50"
                                        title="Generate AI Comprehensive Analysis (Narrative, Risks, Interior/Rooms Summaries)"
                                    >
                                        <i className="fa-solid fa-pen-nib text-fuchsia-500 group-hover:scale-110 transition-transform"></i>
                                        Narrative Synthesis ({visibleSelectedCount})
                                    </button>

                                    <button
                                        onClick={() => handleBatchOrientation()}
                                        disabled={loading}
                                        className="px-6 py-3 bg-white border-2 border-amber-200 hover:border-amber-400 hover:bg-amber-50 text-slate-700 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest shadow-sm transition-all animate-in slide-in-from-right flex items-center gap-3 group disabled:opacity-50"
                                        title="Run Orientation & Compass analysis for selected properties"
                                    >
                                        <i className="fa-solid fa-compass text-amber-500 group-hover:scale-110 transition-transform"></i>
                                        Orientation ({visibleSelectedCount})
                                    </button>
                                </div>
                            )}
                            {/* Action Buttons — always visible if we have data or selection */}
                            {(listings.length > 0 || cachedPropertyIds.size > 0) && (
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
                                                <><i className="fa-solid fa-flask text-violet-400 group-hover:scale-110 transition-transform"></i>Smoke Test{visibleSelectedCount > 0 ? ` (${visibleSelectedCount})` : ''}</>
                                            )}
                                        </button>
                                    )}
                                    {visibleSelectedCount > 0 && (
                                        <button
                                            onClick={handleBulkDelete}
                                            disabled={loading}
                                            className="px-6 py-3 bg-white border-2 border-rose-200 hover:border-rose-400 hover:bg-rose-50 text-rose-700 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest shadow-sm transition-all animate-in slide-in-from-right flex items-center gap-3 group disabled:opacity-50"
                                            title={`Permanently delete ${visibleSelectedCount} selected properties from Firestore`}
                                        >
                                            <i className="fa-solid fa-trash-can text-rose-400 group-hover:scale-110 transition-transform"></i>
                                            Wipe Selection ({visibleSelectedCount})
                                        </button>
                                    )}

                                    {cachedPropertyIds.size > 0 && (
                                        <button
                                            onClick={handleCityContextGraph}
                                            disabled={cityGraphRunning || loading}
                                            className="px-6 py-3 bg-white border-2 border-amber-200 hover:border-amber-400 hover:bg-amber-50 text-slate-700 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest shadow-sm transition-all flex items-center gap-3 group disabled:opacity-50"
                                            title="Extract 14 city-level factors (market, community, investment) from deep research + community pulse — runs ONCE per city"
                                        >
                                            {cityGraphRunning ? (
                                                <><i className="fa-solid fa-spinner animate-spin text-amber-400"></i>Extracting...</>
                                            ) : (
                                                <><i className="fa-solid fa-city text-amber-500 group-hover:scale-110 transition-transform"></i>City Context</>
                                            )}
                                        </button>
                                    )}
                                    {cachedPropertyIds.size > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => handleBatchContextGraph()}
                                                disabled={graphBatchRunning || loading}
                                                className="px-6 py-3 bg-white border-2 border-cyan-200 hover:border-cyan-400 hover:bg-cyan-50 text-slate-700 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest shadow-sm transition-all animate-in slide-in-from-right flex items-center gap-3 group disabled:opacity-50"
                                                title={forceGraphRegen ? 'Force regenerate ALL context graphs (ignores staleness check)' : 'Smart sync: generates new context graphs + regenerates stale ones'}
                                            >
                                                {graphBatchRunning ? (
                                                    <>
                                                        <i className="fa-solid fa-spinner animate-spin text-cyan-400"></i>
                                                        {graphBatchProgress ? `${graphBatchProgress.done + graphBatchProgress.skipped}/${graphBatchProgress.total}` : 'Checking...'}
                                                    </>
                                                ) : (
                                                    <><i className={`fa-solid fa-diagram-project ${forceGraphRegen ? 'text-orange-500' : 'text-cyan-500'} group-hover:scale-110 transition-transform`}></i>{forceGraphRegen ? 'Force Regen' : 'Sync Graphs'}</>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => setForceGraphRegen(f => !f)}
                                                title={forceGraphRegen ? 'Force mode ON — click to switch back to smart sync' : 'Smart mode — click to enable force regen'}
                                                className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center text-xs transition-all ${forceGraphRegen ? 'bg-orange-100 border-orange-400 text-orange-600' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                            >
                                                <i className="fa-solid fa-bolt"></i>
                                            </button>
                                        </div>
                                    )}

                                    {cachedPropertyIds.size > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => handleBootstrapBuyerDna()}
                                                disabled={dnaBootstrapRunning || loading}
                                                className="px-6 py-3 bg-white border-2 border-fuchsia-200 hover:border-fuchsia-400 hover:bg-fuchsia-50 text-slate-700 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest shadow-sm transition-all animate-in slide-in-from-right flex items-center gap-3 group disabled:opacity-50"
                                                title="Run Pass 2: Compress Granular Factors into 16 Buyer DNA dimensions for all cached properties"
                                            >
                                                {dnaBootstrapRunning ? (
                                                    <>
                                                        <i className="fa-solid fa-spinner animate-spin text-fuchsia-400"></i>
                                                        {dnaBootstrapProgress ? `${dnaBootstrapProgress.done + dnaBootstrapProgress.skipped}/${dnaBootstrapProgress.total}` : 'Checking...'}
                                                    </>
                                                ) : (
                                                    <><i className="fa-solid fa-dna text-fuchsia-500 group-hover:scale-110 transition-transform"></i>Bootstrap DNA</>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {cachedPropertyIds.size > 0 && (
                                        <button
                                            onClick={handleBackfillMetadata}
                                            disabled={backfillRunning || loading}
                                            className="px-6 py-3 bg-white border-2 border-teal-200 hover:border-teal-400 hover:bg-teal-50 text-slate-700 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest shadow-sm transition-all flex items-center gap-3 group disabled:opacity-50"
                                            title="Backfill city/price/beds/baths metadata on existing context graphs (no AI re-extraction)"
                                        >
                                            {backfillRunning ? (
                                                <><i className="fa-solid fa-spinner animate-spin text-teal-400"></i>
                                                    {backfillProgress ? `${backfillProgress.done}/${backfillProgress.total}` : 'Starting...'}
                                                </>
                                            ) : (
                                                <><i className="fa-solid fa-database text-teal-500 group-hover:scale-110 transition-transform"></i>Backfill Meta</>
                                            )}
                                        </button>
                                    )}
                                    {cachedPropertyIds.size > 0 && (
                                        <button
                                            onClick={() => setShowBuyerSearch(!showBuyerSearch)}
                                            className={`px-6 py-3 border-2 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest shadow-sm transition-all flex items-center gap-3 group ${showBuyerSearch ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700'}`}
                                            title="Search properties by buyer story using AI"
                                        >
                                            <i className={`fa-solid fa-magnifying-glass-location ${showBuyerSearch ? 'text-indigo-200' : 'text-indigo-500'} group-hover:scale-110 transition-transform`}></i>
                                            Buyer Search
                                        </button>
                                    )}
                                    {cachedPropertyIds.size > 0 && (
                                        <button
                                            onClick={(e) => handleBatchOrientation(e)}
                                            disabled={orientBatchRunning || loading}
                                            className="px-6 py-3 bg-white border-2 border-amber-200 hover:border-amber-400 hover:bg-amber-50 text-slate-700 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest shadow-sm transition-all animate-in slide-in-from-right flex items-center gap-3 group disabled:opacity-50"
                                            title="Calculate front orientation for all cached properties (skips already-analyzed)"
                                        >
                                            {orientBatchRunning ? (
                                                <><i className="fa-solid fa-spinner animate-spin text-amber-400"></i>
                                                    {orientBatchProgress ? `${orientBatchProgress.computed + orientBatchProgress.cached}/${orientBatchProgress.total}` : 'Starting...'}
                                                </>
                                            ) : (
                                                <><i className="fa-solid fa-compass text-amber-500 group-hover:scale-110 transition-transform"></i>Orientation{visibleSelectedCount > 0 ? ` (${visibleSelectedCount})` : ''}</>
                                            )}
                                        </button>
                                    )}

                                    {orientBatchProgress && !orientBatchRunning && (
                                        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-2xl animate-in fade-in">
                                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Orient:</span>
                                            <span className="text-[11px] font-black text-emerald-600">{orientBatchProgress.computed} computed</span>
                                            <span className="text-slate-300">|</span>
                                            <span className="text-[11px] font-semibold text-slate-500">{orientBatchProgress.cached} cached</span>
                                            {orientBatchProgress.failed > 0 && (<><span className="text-slate-300">|</span><span className="text-[11px] font-black text-rose-600">{orientBatchProgress.failed} failed</span></>)}
                                            <button onClick={() => setOrientBatchProgress(null)} className="w-5 h-5 flex items-center justify-center text-amber-300 hover:text-amber-500 transition-colors ml-1">
                                                <i className="fa-solid fa-xmark text-[10px]"></i>
                                            </button>
                                        </div>
                                    )}
                                    {graphBatchProgress && !graphBatchRunning && (
                                        <div className="flex items-center gap-2 px-4 py-2.5 bg-cyan-50 border border-cyan-200 rounded-2xl animate-in fade-in">
                                            <span className="text-[10px] font-black text-cyan-600 uppercase tracking-widest">Graph:</span>
                                            <span className="text-[11px] font-black text-emerald-600">{graphBatchProgress.done} new</span>
                                            <span className="text-slate-300">|</span>
                                            <span className="text-[11px] font-semibold text-slate-500">{graphBatchProgress.skipped} cached</span>
                                            {graphBatchProgress.failed > 0 && (<><span className="text-slate-300">|</span><span className="text-[11px] font-black text-rose-600">{graphBatchProgress.failed} failed</span></>)}
                                            <button onClick={() => setGraphBatchProgress(null)} className="w-5 h-5 flex items-center justify-center text-cyan-300 hover:text-cyan-500 transition-colors ml-1">
                                                <i className="fa-solid fa-xmark text-[10px]"></i>
                                            </button>
                                        </div>
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
                                </div>
                            )}
                        </>
                    ) : viewMode === 'table' && showBuyerSearch ? (
                        /* ── Buyer Story Search Panel ── */
                        <div className="space-y-4">
                            <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-6">
                                <h3 className="text-sm font-black text-indigo-800 flex items-center gap-2 mb-3">
                                    <i className="fa-solid fa-magnifying-glass-location text-indigo-500"></i>
                                    Tell Your Story — AI Property Matchmaker
                                </h3>

                                {/* Filters Row */}
                                <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-white/70 border border-indigo-100 rounded-xl">
                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Filters</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-slate-500">Price</span>
                                        <input
                                            type="text" placeholder="Min (K)" value={buyerFilterPrice[0]}
                                            onChange={e => setBuyerFilterPrice([e.target.value, buyerFilterPrice[1]])}
                                            className="w-20 px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-300 outline-none"
                                        />
                                        <span className="text-slate-300">–</span>
                                        <input
                                            type="text" placeholder="Max (K)" value={buyerFilterPrice[1]}
                                            onChange={e => setBuyerFilterPrice([buyerFilterPrice[0], e.target.value])}
                                            className="w-20 px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-300 outline-none"
                                        />
                                    </div>
                                    <div className="w-px h-5 bg-indigo-200"></div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-slate-500">Beds ≥</span>
                                        <select value={buyerFilterBeds} onChange={e => setBuyerFilterBeds(e.target.value)}
                                            className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-300 outline-none">
                                            <option value="">Any</option>
                                            <option value="2">2+</option>
                                            <option value="3">3+</option>
                                            <option value="4">4+</option>
                                            <option value="5">5+</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-slate-500">Baths ≥</span>
                                        <select value={buyerFilterBaths} onChange={e => setBuyerFilterBaths(e.target.value)}
                                            className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-300 outline-none">
                                            <option value="">Any</option>
                                            <option value="2">2+</option>
                                            <option value="3">3+</option>
                                            <option value="4">4+</option>
                                        </select>
                                    </div>
                                    <div className="w-px h-5 bg-indigo-200"></div>
                                    <span className="text-[10px] font-bold text-slate-400">
                                        Max 20 sent to AI · {cachedPropertyIds.size} total
                                    </span>
                                </div>

                                <textarea
                                    value={buyerStory}
                                    onChange={e => setBuyerStory(e.target.value)}
                                    placeholder="Example: I'm a tech worker at Google with 2 young kids. We need good schools, a home office, and a big backyard for the kids. Budget is $1.5M. My wife works from home too so we need fast internet. Prefer newer construction or recently renovated. Low wildfire risk is important to us."
                                    className="w-full h-32 p-4 bg-white border border-indigo-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 outline-none resize-none"
                                />
                                <div className="flex items-center gap-3 mt-3">
                                    <button
                                        onClick={handleBuyerSearch}
                                        disabled={buyerSearching || !buyerStory.trim()}
                                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {buyerSearching ? (
                                            <><i className="fa-solid fa-spinner animate-spin"></i>Searching {cachedPropertyIds.size} properties...</>
                                        ) : (
                                            <><i className="fa-solid fa-wand-magic-sparkles"></i>Find My Match</>
                                        )}
                                    </button>
                                    {buyerResults && (
                                        <span className="text-xs font-bold text-indigo-600">
                                            {buyerResults.length} matches found
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Results */}
                            {buyerResults && buyerResults.length > 0 && (
                                <div className="space-y-3">
                                    {buyerResults.map((match, idx) => (
                                        <div key={match.zpid} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md hover:border-indigo-200 transition-all">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${idx === 0 ? 'bg-amber-100 text-amber-700 border border-amber-200' : idx <= 2 ? 'bg-indigo-100 text-indigo-600 border border-indigo-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                                            #{idx + 1}
                                                        </span>
                                                        <button
                                                            onClick={() => window.open(`/explore?q=${encodeURIComponent(match.address)}`, '_blank')}
                                                            className="text-sm font-black text-slate-800 hover:text-indigo-600 transition-colors cursor-pointer"
                                                        >
                                                            {match.address}
                                                        </button>
                                                    </div>
                                                    <p className="text-sm text-indigo-600 font-semibold italic mt-2 mb-2">
                                                        &ldquo;{match.highlight}&rdquo;
                                                    </p>
                                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                                        {match.reasons.map((reason, i) => (
                                                            <span key={i} className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                                                {reason}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-lg font-black ${match.score >= 80 ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-200' : match.score >= 60 ? 'bg-amber-100 text-amber-700 border-2 border-amber-200' : 'bg-slate-100 text-slate-600 border-2 border-slate-200'}`}>
                                                        {match.score}
                                                    </div>
                                                    <span className="text-[9px] font-black text-slate-400 mt-1 uppercase">Score</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
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

                                    addLog(`[City Neighborhoods] Force mining neighborhoods for ${c}, ${s}...`);
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
                                className={`px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2.5 disabled:opacity-50 ${cachedNeighborhoodCount && cachedNeighborhoodCount > 0
                                    ? 'bg-emerald-50 border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                    : 'bg-amber-50 border-2 border-amber-200 text-amber-700 hover:bg-amber-100'
                                    }`}
                                title={`Force re-mine all neighborhoods for ${city || 'this city'} using Gemini 3 Pro — overwrites cache`}
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

            {/* ─── Smoke Test Results Panel (Promoted to Top) ──────────────────────────────────────── */}
            {smokeSummary && (
                <div className="mb-10">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-100/60 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Header */}
                        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
                            <div className="flex items-center gap-4">
                                <div className="w-11 h-11 bg-violet-50 rounded-2xl flex items-center justify-center">
                                    <i className="fa-solid fa-flask text-violet-500 text-lg"></i>
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900">Smoke Test Results</h3>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                                        {smokeSummary.totalProperties} properties · ran {smokeSummary.ranAt instanceof Date ? smokeSummary.ranAt.toLocaleTimeString() : new Date(smokeSummary.ranAt).toLocaleTimeString()}
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

                        {/* Per-check failure counts */}
                        {(() => {
                            const failCounts: Record<string, { label: string; severity: string; count: number }> = {};
                            const sourceNullCounts: Record<string, { label: string; count: number }> = {};
                            smokeSummary.results.forEach(r => {
                                r.checks.forEach(c => {
                                    if (c.sourceNull) {
                                        if (!sourceNullCounts[c.id]) {
                                            sourceNullCounts[c.id] = { label: c.label, count: 0 };
                                        }
                                        sourceNullCounts[c.id].count++;
                                    } else if (!c.passed) {
                                        if (!failCounts[c.id]) {
                                            failCounts[c.id] = { label: c.label, severity: c.severity, count: 0 };
                                        }
                                        failCounts[c.id].count++;
                                    }
                                });
                            });
                            const sortedFails = Object.entries(failCounts).sort((a, b) => {
                                if (a[1].severity !== b[1].severity) return a[1].severity === 'error' ? -1 : 1;
                                return b[1].count - a[1].count;
                            });
                            const sortedNA = Object.entries(sourceNullCounts).sort((a, b) => b[1].count - a[1].count);
                            if (sortedFails.length === 0 && sortedNA.length === 0) return null;
                            return (
                                <div className="mx-6 mt-4 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                    <div className="flex items-center gap-2 mb-3">
                                        <i className="fa-solid fa-chart-bar text-slate-400 text-xs"></i>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            Failure Breakdown ({sortedFails.length} checks across {smokeSummary.totalProperties} properties)
                                        </span>
                                        {smokeCheckFilter && (
                                            <button
                                                onClick={() => setSmokeCheckFilter(null)}
                                                className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                                            >
                                                <i className="fa-solid fa-xmark text-[8px]"></i> Clear Filter
                                            </button>
                                        )}
                                    </div>

                                    {/* Actionable failures — these can be fixed by running the pipeline */}
                                    {sortedFails.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {sortedFails.map(([id, { label, severity, count }]) => (
                                                <button key={id}
                                                    onClick={() => toggleSmokeCheckFilter(id, false)}
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9.5px] font-bold border cursor-pointer transition-all ${severity === 'error'
                                                        ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                                                        : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                                                        } ${smokeCheckFilter === id ? 'ring-2 ring-offset-1 ' + (severity === 'error' ? 'ring-rose-400' : 'ring-amber-400') : ''}`}
                                                    title={`Click to filter: ${label} — ${count}/${smokeSummary.totalProperties} properties failing`}
                                                >
                                                    {label} <span className="font-black">{count}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Source Unavailable — API was called but data doesn't exist at source */}
                                    {sortedNA.length > 0 && (
                                        <div className="mt-3">
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <i className="fa-solid fa-ban text-slate-300 text-[9px]"></i>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                    Source Unavailable — data does not exist at source
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {sortedNA.map(([id, { label, count }]) => (
                                                    <button key={`na-${id}`}
                                                        onClick={() => toggleSmokeCheckFilter(id, true)}
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9.5px] font-bold border cursor-pointer transition-all
                                                            bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-150 hover:text-slate-500
                                                            ${smokeCheckFilter === `na:${id}` ? 'ring-2 ring-offset-1 ring-slate-300' : ''}`}
                                                        title={`${label} — ${count} properties where this field is unavailable at source (not actionable)`}
                                                    >
                                                        <i className="fa-solid fa-ban text-[8px]"></i> {label} <span className="font-black">{count}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Detailed Results */}
                        <div className="p-6">
                            <div className="space-y-4 max-h-[600px] overflow-y-auto px-2 custom-scrollbar">
                                {(smokeFilter === 'all'
                                    ? smokeSummary.results
                                    : smokeFilter === 'failed'
                                        ? smokeSummary.results.filter(r => r.errorCount > 0)
                                        : smokeSummary.results.filter(r => r.warnCount > 0)
                                )
                                    .filter(r => {
                                        if (!smokeCheckFilter) return true;
                                        const [prefix, id] = smokeCheckFilter.includes(':') ? smokeCheckFilter.split(':') : [null, smokeCheckFilter];
                                        if (prefix === 'na') {
                                            return r.checks.some(c => c.id === id && c.sourceNull);
                                        }
                                        return r.checks.some(c => c.id === id && !c.passed && !c.sourceNull);
                                    })
                                    .map((res) => (
                                        <div key={res.zpid} className="border border-slate-100 rounded-2xl overflow-hidden hover:border-violet-200 transition-all">
                                            <button
                                                onClick={() => {
                                                    const next = new Set(smokeExpanded);
                                                    if (next.has(res.zpid)) next.delete(res.zpid);
                                                    else next.add(res.zpid);
                                                    setSmokeExpanded(next);
                                                }}
                                                className="w-full flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${res.errorCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                        {res.errorCount > 0 ? <i className="fa-solid fa-xmark"></i> : <i className="fa-solid fa-check"></i>}
                                                    </div>
                                                    <div className="text-left">
                                                        <span className="text-[11px] font-black text-slate-800 block leading-tight">{res.address}</span>
                                                        <span className="text-[9px] font-bold text-slate-400 font-mono">ZPID: {res.zpid}</span>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{res.homeType}</span>
                                                            <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                                            <span className={`text-[9px] font-black uppercase tracking-widest ${res.errorCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                                {res.errorCount} errors · {res.warnCount} warnings
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <i className={`fa-solid fa-chevron-down text-slate-300 text-xs transition-transform ${smokeExpanded.has(res.zpid) ? 'rotate-180' : ''}`}></i>
                                            </button>

                                            {smokeExpanded.has(res.zpid) && (
                                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 bg-white">
                                                    {res.checks.map((c) => (
                                                        <div key={c.id} className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition-all
                                                            ${c.passed
                                                                ? 'bg-emerald-50/30 border-emerald-100/50 grayscale-[0.3]'
                                                                : c.severity === 'error'
                                                                    ? 'bg-rose-50 border-rose-200'
                                                                    : 'bg-amber-50 border-amber-200'
                                                            }`}>
                                                            <i className={`fa-solid ${c.passed ? 'fa-circle-check text-emerald-500' : c.severity === 'error' ? 'fa-circle-xmark text-rose-500' : 'fa-triangle-exclamation text-amber-500'} mt-0.5 text-[10px]`}></i>
                                                            <div>
                                                                <div className="text-[9.5px] font-black text-slate-700 leading-none mb-1">{c.label}</div>
                                                                {c.detail && (
                                                                    <div className={`text-[8.5px] font-medium leading-[1.2] ${c.passed ? 'text-slate-400' : 'text-slate-600'}`}>
                                                                        {c.detail}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {viewMode !== 'audit' && (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Left: Live Console */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden h-[600px] flex flex-col border border-slate-800">
                        <div className="flex items-center justify-between mb-6 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Live Process Log</h3>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-[9px] font-mono text-slate-600">{statusLog.length} events</span>
                                <button
                                    onClick={async () => {
                                    setIsLoadingStats(true);
                                    addLog("Identifying relevant run for log analysis...");
                                    try {
                                        let start: number;
                                        let end = Date.now();

                                        if (batchStartTime) {
                                            start = batchStartTime;
                                            addLog(`Analyzing active session logs (started ${new Date(start).toLocaleTimeString()})...`);
                                        } else {
                                            const latest = await fetchLatestBatchJob();
                                            if (latest) {
                                                // Buffer by 2 mins on each side to catch edge calls
                                                start = (latest.createdAt?.toMillis() || (end - 60 * 60 * 1000)) - (2 * 60 * 1000);
                                                end = (latest.completedAt?.toMillis() || latest.lastUpdated?.toMillis() || end) + (2 * 60 * 1000);
                                                addLog(`Analyzing last run: ${latest.type?.replace(/_/g, ' ')} (${new Date(start).toLocaleTimeString()})...`);
                                            } else {
                                                start = end - 60 * 60 * 1000;
                                                addLog("No previous runs found. Analyzing last hour of activity...");
                                            }
                                        }

                                        const userId = auth?.currentUser?.uid || 'unknown';
                                        const [llmLogs, apiLogs] = await Promise.all([
                                            getLLMLogsForTimeRange(userId, start, end),
                                            getAPILogsForTimeRange(userId, start, end)
                                        ]);

                                        // --- Compute Error & Warning Summary ---
                                        const errors: Record<string, { count: number; type: 'error' | 'warning' }> = {};
                                        
                                        // 1. Process LLM Failures
                                        llmLogs.forEach(log => {
                                            if (log.status === 'failed' || log.error) {
                                                const msg = log.error?.split('\n')[0].substring(0, 100) || 'Unknown AI Error';
                                                if (!errors[msg]) errors[msg] = { count: 0, type: 'error' };
                                                errors[msg].count++;
                                            }
                                            // Look for "Warning" in prompt or response if needed, but status is more reliable
                                        });

                                        // 2. Process API Failures
                                        apiLogs.forEach(log => {
                                            if (log.status === 'failed' || log.error) {
                                                const msg = log.error?.split('\n')[0].substring(0, 100) || `API Failure: ${log.api_name}`;
                                                if (!errors[msg]) errors[msg] = { count: 0, type: 'error' };
                                                errors[msg].count++;
                                            }
                                            // Check for high latency warnings (> 5s)
                                            if (log.response_time_ms && log.response_time_ms > 5000) {
                                                const msg = `High Latency: ${log.api_name} (>5s)`;
                                                if (!errors[msg]) errors[msg] = { count: 0, type: 'warning' };
                                                errors[msg].count++;
                                            }
                                        });

                                        const errorSummary = Object.entries(errors).map(([message, data]) => ({
                                            message,
                                            count: data.count,
                                            type: data.type
                                        })).sort((a, b) => b.count - a.count);

                                        setIngestionReport({ llmLogs, apiLogs, errorSummary });
                                        addLog(`Report generated: ${llmLogs.length} AI calls, ${apiLogs.length} API calls, ${errorSummary.length} unique faults identified.`);
                                        // Scroll to report
                                        setTimeout(() => {
                                            const reportEl = document.getElementById('ingestion-usage-report');
                                            if (reportEl) reportEl.scrollIntoView({ behavior: 'smooth' });
                                        }, 100);
                                    } catch (reportErr: any) {
                                        console.error("Failed to generate report:", reportErr);
                                        addLog(`Report failed: ${reportErr.message}`);
                                    } finally {
                                        setIsLoadingStats(false);
                                    }
                                }}
                                    disabled={isLoadingStats}
                                    className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest flex items-center gap-2 transition-colors disabled:opacity-50"
                                    title="Analyze recent LLM and API logs to calculate costs and performance"
                                >
                                    {isLoadingStats ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-chart-bar"></i>}
                                    Analyze
                                </button>
                            </div>
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

                    {/* Discovery Results */}
                    {viewMode === 'table' && (
                        listings.length > 0 ? (
                            <div className="space-y-12 pb-20">
                                <div className="flex flex-col gap-6">
                                    <div className="flex flex-wrap items-center gap-4">
                                        {/* State Selection */}
                                        {availableStates.length > 0 && (
                                            <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                                {availableStates.map(st => (
                                                    <button
                                                        key={st}
                                                        onClick={() => setStateFilter(st)}
                                                        className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${stateFilter === st ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}
                                                    >
                                                        {st}
                                                    </button>
                                                ))}
                                                <button
                                                    onClick={() => setStateFilter('ALL')}
                                                    className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${stateFilter === 'ALL' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}
                                                >
                                                    All States
                                                </button>
                                            </div>
                                        )}

                                        {/* Property Type Selection */}
                                        {availablePropertyTypes.length > 0 && (
                                            <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                                {availablePropertyTypes.map(pt => (
                                                    <button
                                                        key={pt}
                                                        onClick={() => setPropertyTypeFilter(pt)}
                                                        className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${propertyTypeFilter === pt ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}
                                                    >
                                                        {pt.replace(/_/g, ' ')}
                                                    </button>
                                                ))}
                                                <button
                                                    onClick={() => setPropertyTypeFilter('ALL')}
                                                    className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${propertyTypeFilter === 'ALL' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}
                                                >
                                                    All Types
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Asset Health Filters */}
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setMissingStreetViewOnly(!missingStreetViewOnly)}
                                            className={`flex items-center gap-2.5 px-6 py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-300 shadow-sm
                                                ${missingStreetViewOnly
                                                    ? 'bg-amber-500 border-amber-600 text-white shadow-amber-200/50 scale-105'
                                                    : 'bg-white border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50/10'}`}
                                        >
                                            <i className={`fa-solid fa-street-view ${missingStreetViewOnly ? 'animate-pulse' : ''}`}></i>
                                            {missingStreetViewOnly ? 'Isolating: Missing Street View' : 'Hide Solid Street View'}
                                            {missingStreetViewOnly && (
                                                <span className="flex h-2 w-2 relative">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                                </span>
                                            )}
                                        </button>

                                        {(stateFilter !== 'ALL' || propertyTypeFilter !== 'ALL' || missingStreetViewOnly) && (
                                            <button
                                                onClick={() => {
                                                    setStateFilter('ALL');
                                                    setPropertyTypeFilter('ALL');
                                                    setMissingStreetViewOnly(false);
                                                }}
                                                className="px-4 py-2 text-[9px] font-black text-slate-300 hover:text-indigo-600 uppercase tracking-widest transition-colors flex items-center gap-2"
                                            >
                                                <i className="fa-solid fa-filter-circle-xmark"></i>
                                                Reset Filters
                                            </button>
                                        )}
                                    </div>
                                </div>

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
                                                                const id = String(item.zpid);
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
                                                            <th className="p-6 text-right">Property Type</th>
                                                            {activeTableTab === 'sold' && <th className="p-6 text-right">Sold Date</th>}
                                                            <th className="p-6">Cache Status</th>
                                                            <th className="p-6 text-center">Last Scan</th>
                                                            <th className="p-6 text-center">API Health</th>
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



                    {viewMode === 'ingestion' && (propBatchProgress || intelBatchProgress || orientBatchProgress || narrativeBatchProgress || assetBatchProgress) && (
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-100/50 overflow-hidden mb-12 animate-in slide-in-from-top-4 duration-500">
                            <div className="p-8 border-b border-slate-100 bg-slate-50/30">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-6">
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-1 uppercase">Cloud Batch Dashboard</h3>
                                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest leading-relaxed">
                                                Server-side parallel execution active. You can safely navigate away.
                                            </p>
                                        </div>
                                        <div className="h-10 w-px bg-slate-200 hidden md:block"></div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setViewMode('audit')}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'audit' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                            >
                                                Audit Trail
                                            </button>
                                            <button
                                                onClick={() => { setViewMode('monitoring'); setMonitoringFilter(null); }}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'monitoring' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-100'}`}
                                            >
                                                Pipeline Monitor
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { setViewMode('table'); setIngestionReport(null); }}
                                        className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-300 rounded-xl transition-all shadow-sm group"
                                    >
                                        <i className="fa-solid fa-xmark group-hover:rotate-90 transition-transform"></i>
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Property Data Card */}
                                    {propBatchProgress && (
                                        <div 
                                            onClick={() => { setMonitoringFilter('Property Data'); setViewMode('monitoring'); }}
                                            className={`p-6 rounded-2xl border-2 transition-all cursor-pointer group/card ${propBatchRunning ? 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-400 hover:shadow-lg' : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-md'}`}
                                        >
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover/card:scale-110 ${propBatchRunning ? 'bg-emerald-500 text-white animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                                                    <i className="fa-solid fa-database text-xs"></i>
                                                </div>
                                                <span className="text-[11px] font-black uppercase tracking-widest text-slate-900">Property Data</span>
                                                {propBatchRunning && activeBatchId?.startsWith('prop_') && (
                                                    <JobTimer createdAt={parseInt(activeBatchId.split('_').pop() || '0')} status="running" />
                                                )}
                                            </div>
                                            <div className="flex items-end justify-between mb-2">
                                                <span className="text-2xl font-black tabular-nums">{propBatchProgress.done} <span className="text-xs text-slate-400 uppercase">/ {propBatchProgress.total}</span></span>
                                                {propBatchProgress.failed > 0 && <span className="text-[10px] font-black text-rose-500 uppercase tracking-tighter">{propBatchProgress.failed} Failed</span>}
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(propBatchProgress.done / propBatchProgress.total) * 100}%` }}></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Intelligence Card */}
                                    {intelBatchProgress && (
                                        <div 
                                            onClick={() => { setMonitoringFilter('Full Intel'); setViewMode('monitoring'); }}
                                            className={`p-6 rounded-2xl border-2 transition-all cursor-pointer group/card ${intelBatchRunning ? 'border-indigo-200 bg-indigo-50/30 hover:border-indigo-400 hover:shadow-lg' : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-md'}`}
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover/card:scale-110 ${intelBatchRunning ? 'bg-indigo-500 text-white animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                                                        <i className="fa-solid fa-brain text-xs"></i>
                                                    </div>
                                                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-900">Full Intel</span>
                                                    {intelBatchRunning && activeBatchId?.startsWith('intel_') && (
                                                        <JobTimer createdAt={parseInt(activeBatchId.split('_').pop() || '0')} status="running" />
                                                    )}
                                                </div>
                                                {intelBatchRunning && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); requestStop(activeBatchId!); }}
                                                        className="text-[9px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-widest bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-all"
                                                    >
                                                        Stop Run
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-end justify-between mb-2">
                                                <div className="flex flex-col">
                                                    <span className="text-2xl font-black tabular-nums">{intelBatchProgress.done} <span className="text-xs text-slate-400 uppercase">/ {intelBatchProgress.total}</span></span>
                                                    {intelBatchRunning && intelBatchProgress.workingCount > 0 && (
                                                        <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                                                            <i className="fa-solid fa-spinner fa-spin text-[8px]"></i>
                                                            Working on {intelBatchProgress.workingCount}
                                                        </span>
                                                    )}
                                                </div>
                                                {intelBatchProgress.failed > 0 && <span className="text-[10px] font-black text-rose-500 uppercase tracking-tighter">{intelBatchProgress.failed} Failed</span>}
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${(intelBatchProgress.done / intelBatchProgress.total) * 100}%` }}></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Orientation Card */}
                                    {orientBatchProgress && (
                                        <div 
                                            onClick={() => { setMonitoringFilter('Orientation'); setViewMode('monitoring'); }}
                                            className={`p-6 rounded-2xl border-2 transition-all cursor-pointer group/card ${orientBatchRunning ? 'border-amber-200 bg-amber-50/30 hover:border-amber-400 hover:shadow-lg' : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-md'}`}
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover/card:scale-110 ${orientBatchRunning ? 'bg-amber-500 text-white animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                                                        <i className="fa-solid fa-compass text-xs"></i>
                                                    </div>
                                                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-900">Orientation</span>
                                                    {orientBatchRunning && activeBatchId?.startsWith('orient_') && (
                                                        <JobTimer createdAt={parseInt(activeBatchId.split('_').pop() || '0')} status="running" />
                                                    )}
                                                </div>
                                                {orientBatchRunning && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); requestStop(activeBatchId!); }}
                                                        className="text-[9px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-widest bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-all"
                                                    >
                                                        Stop Run
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-end justify-between mb-2">
                                                <div className="flex flex-col">
                                                    <span className="text-2xl font-black tabular-nums">{orientBatchProgress.computed + orientBatchProgress.cached} <span className="text-xs text-slate-400 uppercase">/ {orientBatchProgress.total}</span></span>
                                                    {orientBatchRunning && (orientBatchProgress as any).workingCount > 0 && (
                                                        <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                                                            <i className="fa-solid fa-spinner fa-spin text-[8px]"></i>
                                                            Working on {(orientBatchProgress as any).workingCount}
                                                        </span>
                                                    )}
                                                </div>
                                                {orientBatchProgress.failed > 0 && <span className="text-[10px] font-black text-rose-500 uppercase tracking-tighter">{orientBatchProgress.failed} Failed</span>}
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${((orientBatchProgress.computed + orientBatchProgress.cached) / orientBatchProgress.total) * 100}%` }}></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Narrative Card */}
                                    {narrativeBatchProgress && (
                                        <div 
                                            onClick={() => { setMonitoringFilter('Narrative'); setViewMode('monitoring'); }}
                                            className={`p-6 rounded-2xl border-2 transition-all cursor-pointer group/card ${narrativeBatchRunning ? 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-400 hover:shadow-lg' : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-md'}`}
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover/card:scale-110 ${narrativeBatchRunning ? 'bg-emerald-500 text-white animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                                                        <i className="fa-solid fa-file-signature text-xs"></i>
                                                    </div>
                                                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-900">Narrative</span>
                                                    {narrativeBatchRunning && activeBatchId?.startsWith('narrative_') && (
                                                        <JobTimer createdAt={parseInt(activeBatchId.split('_').pop() || '0')} status="running" />
                                                    )}
                                                </div>
                                                {narrativeBatchRunning && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); requestStop(activeBatchId!); }}
                                                        className="text-[9px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-widest bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-all"
                                                    >
                                                        Stop Run
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-end justify-between mb-2">
                                                <div className="flex flex-col">
                                                    <span className="text-2xl font-black tabular-nums">{narrativeBatchProgress.done} <span className="text-xs text-slate-400 uppercase">/ {narrativeBatchProgress.total}</span></span>
                                                    {narrativeBatchRunning && (narrativeBatchProgress as any).workingCount > 0 && (
                                                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                                                            <i className="fa-solid fa-spinner fa-spin text-[8px]"></i>
                                                            Working on {(narrativeBatchProgress as any).workingCount}
                                                        </span>
                                                    )}
                                                </div>
                                                {narrativeBatchProgress.failed > 0 && <span className="text-[10px] font-black text-rose-500 uppercase tracking-tighter">{narrativeBatchProgress.failed} Failed</span>}
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(narrativeBatchProgress.done / narrativeBatchProgress.total) * 100}%` }}></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Asset Secure Card */}
                                    {assetBatchProgress && (
                                        <div 
                                            onClick={() => { setMonitoringFilter('Asset Secure'); setViewMode('monitoring'); }}
                                            className={`p-6 rounded-2xl border-2 transition-all cursor-pointer group/card ${assetBatchRunning ? 'border-rose-200 bg-rose-50/30 hover:border-rose-400 hover:shadow-lg' : assetBatchTimedOut ? 'border-amber-200 bg-amber-50/30 hover:border-amber-400 hover:shadow-lg' : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-md'}`}
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover/card:scale-110 ${assetBatchRunning ? 'bg-rose-500 text-white animate-pulse' : assetBatchTimedOut ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                        <i className={`fa-solid ${assetBatchTimedOut ? 'fa-clock' : 'fa-shield-halved'} text-xs`}></i>
                                                    </div>
                                                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-900">Security</span>
                                                    {assetBatchRunning && activeBatchId?.startsWith('asset_') && (
                                                        <JobTimer createdAt={parseInt(activeBatchId.split('_').pop() || '0')} status="running" />
                                                    )}
                                                    {assetBatchTimedOut && (
                                                        <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest bg-amber-100 px-2 py-0.5 rounded-md">Timed Out</span>
                                                    )}
                                                </div>
                                                {assetBatchRunning && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); requestStop(activeBatchId!); }}
                                                        className="text-[9px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-widest bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-all"
                                                    >
                                                        Stop Run
                                                    </button>
                                                )}
                                                {assetBatchTimedOut && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleBulkSecureImages(assetBatchTimedOut.remainingZpids);
                                                            setAssetBatchTimedOut(null);
                                                        }}
                                                        className="text-[9px] font-black text-amber-600 hover:text-amber-700 uppercase tracking-widest bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                                                    >
                                                        <i className="fa-solid fa-rotate-right text-[8px]"></i>
                                                        Resume ({assetBatchTimedOut.remainingZpids.length} left)
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-end justify-between mb-2">
                                                <div className="flex flex-col">
                                                    <span className="text-2xl font-black tabular-nums">{assetBatchProgress.done} <span className="text-xs text-slate-400 uppercase">/ {assetBatchProgress.total}</span></span>
                                                    {assetBatchRunning && (assetBatchProgress as any).workingCount > 0 && (
                                                        <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                                                            <i className="fa-solid fa-spinner fa-spin text-[8px]"></i>
                                                            Working on {(assetBatchProgress as any).workingCount}
                                                        </span>
                                                    )}
                                                </div>
                                                {assetBatchProgress.failed > 0 && <span className="text-[10px] font-black text-rose-500 uppercase tracking-tighter">{assetBatchProgress.failed} Failed</span>}
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full transition-all duration-500 ${assetBatchTimedOut ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${(assetBatchProgress.done / assetBatchProgress.total) * 100}%` }}></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-8 bg-white">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Processing Results</h4>
                                        <div className="flex bg-slate-100 p-1 rounded-xl">
                                            <button 
                                                onClick={() => setRunResultsFilter('all')}
                                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${runResultsFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                All
                                            </button>
                                            <button 
                                                onClick={() => setRunResultsFilter('failed')}
                                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${runResultsFilter === 'failed' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                Failed Only
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {(propBatchProgress?.failed || 0) + (intelBatchProgress?.failed || 0) + (narrativeBatchProgress?.failed || 0) + (assetBatchProgress?.failed || 0) > 0 && (
                                        <button 
                                            onClick={() => {
                                                if (propBatchProgress?.failed) handleRetryFailedBatch('property');
                                                else if (intelBatchProgress?.failed) handleRetryFailedBatch('intel');
                                                else if (narrativeBatchProgress?.failed) handleRetryFailedBatch('narrative');
                                                else if (assetBatchProgress?.failed) handleRetryFailedBatch('asset');
                                            }}
                                            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                        >
                                            <i className="fa-solid fa-rotate-right"></i>
                                            Retry Failed
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-3 max-h-[400px] overflow-y-auto px-2 custom-scrollbar">
                                    {/* Flattened results from all active batches */}
                                    {(() => {
                                        const merged: Record<string, any> = {};
                                        [propBatchProgress, orientBatchProgress, intelBatchProgress, narrativeBatchProgress, assetBatchProgress].forEach(batch => {
                                            if (!batch?.results) return;
                                            Object.entries(batch.results).forEach(([zpid, res]) => {
                                                const existing = merged[zpid];
                                                // Priority: failure > success > cached
                                                if (!existing || res.status === 'failed' || res.status === 'error' || (existing.status !== 'failed' && existing.status !== 'error')) {
                                                    merged[zpid] = { ...(res as any), zpid };
                                                }
                                            });
                                        });
                                        return Object.entries(merged);
                                    })()
                                        .filter(([_, result]: [string, any]) => runResultsFilter === 'all' || result.status === 'failed' || result.status === 'error')
                                        .reverse()
                                        .map(([zpid, result]: [string, any]) => (
                                            <div key={zpid} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl animate-in fade-in slide-in-from-left-4 duration-300">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-2 h-2 rounded-full ${result.status === 'success' || result.status === 'cached' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`}></div>
                                                        <div>
                                                            <p className="text-[11px] font-black text-slate-900 tabular-nums uppercase tracking-widest">{zpid}</p>
                                                            <p className="text-[10px] font-bold text-slate-500 uppercase">
                                                                {result.message || (
                                                                    result.newCount !== undefined 
                                                                        ? `${result.newCount} new, ${result.skipCount} cached` 
                                                                        : (result.status === 'cached' ? 'Pulled from cache' : 'Processing complete')
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${result.status === 'success' || result.status === 'cached' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                            {result.status}
                                                        </span>
                                                    </div>
                                                </div>

                                                {(result.steps || result.apis) && (
                                                    <div className="mt-3 pt-3 border-t border-slate-200/50">
                                                        {result.steps && result.steps.length > 0 && (
                                                            <div className="space-y-1 mb-2">
                                                                {result.steps.map((step: string, i: number) => (
                                                                    <p key={i} className="text-[9px] text-slate-500 font-medium flex items-start gap-2">
                                                                        <i className="fa-solid fa-angle-right mt-0.5 opacity-30"></i>
                                                                        {step}
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {result.apis && result.apis.length > 0 && (
                                                            <div className="flex flex-wrap gap-1">
                                                                {result.apis.map((api: string, i: number) => (
                                                                    <span key={i} className="text-[8px] px-1.5 py-0.5 bg-slate-200/60 text-slate-500 rounded font-black uppercase tracking-tighter border border-slate-300/30">
                                                                        {api}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                </div>

                                {((propBatchRunning && propBatchProgress && propBatchProgress.done + propBatchProgress.failed < propBatchProgress.total) ||
                                    (intelBatchRunning && intelBatchProgress && intelBatchProgress.done + intelBatchProgress.failed < intelBatchProgress.total) ||
                                    (narrativeBatchRunning && narrativeBatchProgress && narrativeBatchProgress.done + narrativeBatchProgress.failed < narrativeBatchProgress.total) ||
                                    (assetBatchRunning && assetBatchProgress && assetBatchProgress.done + assetBatchProgress.failed < assetBatchProgress.total)) && (
                                        <div className="mt-8 flex items-center justify-center gap-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                                            <i className="fa-solid fa-circle-notch animate-spin text-indigo-500"></i>
                                            <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600">Processing wave in parallel on cloud functions...</p>
                                        </div>
                                    )}
                            </div>
                        </div>
                    )}

                    {/* Property Data Batch Jobs (Background) */}
                    {viewMode === 'ingestion' && propBatchProgress && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-4">
                                <h3 className="text-sm font-black text-emerald-900 uppercase tracking-widest">Property Data Batch Status</h3>
                                <span className={`px-5 py-2.5 rounded-2xl text-sm font-black uppercase tracking-widest ${propBatchRunning ? 'bg-indigo-100 text-indigo-700 animate-pulse' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {propBatchProgress.done} / {propBatchProgress.total} Saved
                                    {propBatchProgress.failed > 0 && <span className="ml-2 text-rose-500">({propBatchProgress.failed} Failed)</span>}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {Object.entries(propBatchProgress.results || {}).reverse().map(([zpid, result]: [string, any]) => (
                                    <div key={zpid} className={`bg-white p-5 rounded-[2rem] border shadow-sm transition-all ${result.status === 'success' ? 'border-emerald-100' : 'border-rose-100'}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${result.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                    <i className={`fa-solid ${result.status === 'success' ? 'fa-check' : 'fa-xmark'}`}></i>
                                                </div>
                                                <span className="text-sm font-black text-slate-800 font-mono tracking-tight">{zpid}</span>
                                            </div>
                                            <span className={`text-[10px] font-bold px-3 py-1 rounded-lg ${result.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                {result.message}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {propBatchRunning && propBatchProgress.done + propBatchProgress.failed < propBatchProgress.total && (
                                    <div className="p-8 text-center text-slate-400 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-[2rem]">
                                        <i className="fa-solid fa-spinner animate-spin text-indigo-400 text-2xl mb-3"></i>
                                        <p className="text-[11px] font-black uppercase tracking-widest">Processing {Math.min(20, propBatchProgress.total - (propBatchProgress.done + propBatchProgress.failed))} properties in parallel...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Active Ingestion Jobs (Rich UI) */}
                    {viewMode === 'ingestion' && ingestionQueue.length > 0 && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-4">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Active Ingestion Jobs</h3>
                                <div className="flex items-center gap-3">
                                    {ingestionQueue.some(q => q.status === 'error' || q.status === 'partial') && (
                                        <button
                                            onClick={handleRetryFailed}
                                            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-200"
                                        >
                                            <i className="fa-solid fa-rotate-right mr-2"></i>
                                            Retry {ingestionQueue.filter(q => q.status === 'error' || q.status === 'partial').length} Failed
                                        </button>
                                    )}
                                    <span className="px-5 py-2.5 bg-slate-100 rounded-2xl text-sm font-black text-slate-700 uppercase tracking-widest">
                                        {ingestionQueue.filter(q => q.status === 'completed').length} / {ingestionQueue.length} {pipelineType === 'images' ? 'Images Secured' : 'Reports Synthesized'}
                                    </span>
                                </div>
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
                                                        <JobTimer createdAt={item.startTime} status={item.status} updatedAt={item.endTime} />
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
                                                        <JobTimer createdAt={item.startTime} status={item.status} updatedAt={item.endTime} />
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
                        <div id="ingestion-usage-report" className="mt-20 border-t border-slate-100 pt-20 animate-in slide-in-from-bottom-8">
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
                                    {ingestionReport.llmLogs.length + ingestionReport.apiLogs.length > 0 
                                        ? Math.round(((ingestionReport.llmLogs.filter(l => l.status === 'completed').length + ingestionReport.apiLogs.filter(l => l.status === 'completed').length) / (ingestionReport.llmLogs.length + ingestionReport.apiLogs.length)) * 100) 
                                        : 0}%
                                </div>
                            </div>
                            {(ingestionReport.errorSummary?.length || 0) > 0 && (
                                <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 text-right">
                                    <div className="text-[9px] font-black text-rose-600 uppercase tracking-widest mb-1">Faults Detected</div>
                                    <div className="text-xl font-mono font-black text-rose-700">
                                        {ingestionReport.errorSummary?.reduce((acc, e) => acc + e.count, 0)}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Diagnostic Summary */}
                    {ingestionReport.errorSummary && ingestionReport.errorSummary.length > 0 && (
                        <div className="mb-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {ingestionReport.errorSummary.map((err, i) => (
                                <div key={i} className={`p-4 rounded-2xl border ${err.type === 'error' ? 'bg-rose-50/30 border-rose-100' : 'bg-amber-50/30 border-amber-100'} animate-in fade-in slide-in-from-left duration-300`} style={{ animationDelay: `${i * 100}ms` }}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-1 w-2 h-2 rounded-full ${err.type === 'error' ? 'bg-rose-500' : 'bg-amber-500'}`}></div>
                                            <div>
                                                <div className={`text-[10px] font-black uppercase tracking-tight ${err.type === 'error' ? 'text-rose-600' : 'text-amber-600'}`}>
                                                    {err.type === 'error' ? 'System Error' : 'System Warning'}
                                                </div>
                                                <p className="text-xs font-bold text-slate-700 mt-1 line-clamp-2" title={err.message}>
                                                    {err.message}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`px-2 py-1 rounded-lg text-[10px] font-black ${err.type === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                            {err.count}x
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

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
                </>
            )}

            {/* ── Pipeline Monitor View ────────────────────────────────────────── */}
            {viewMode === 'monitoring' && (
                <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => { setViewMode('table'); setMonitoringFilter(null); }}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                            >
                                <i className="fa-solid fa-arrow-left"></i>
                                Back to City Data
                            </button>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                                    System Pipeline Monitor
                                    {monitoringFilter && (
                                        <span className="px-3 py-1 bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                            {monitoringFilter}
                                            <button 
                                                onClick={() => setMonitoringFilter(null)}
                                                className="hover:text-indigo-800"
                                            >
                                                <i className="fa-solid fa-xmark"></i>
                                            </button>
                                        </span>
                                    )}
                                </h2>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time status of all batch processing jobs</p>
                            </div>
                        </div>
                        <button 
                            onClick={fetchAllRecentJobs}
                            disabled={loadingJobs}
                            className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-all flex items-center justify-center shadow-sm disabled:opacity-50"
                        >
                            <i className={`fa-solid fa-rotate-right ${loadingJobs ? 'fa-spin' : ''}`}></i>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {allJobs.filter(j => !monitoringFilter || j.typeLabel === monitoringFilter).map((job) => {
                            const isRunning = job.status === 'running' || job.status === 'queued';
                            const progress = Math.round(((job.done || 0) / (job.total || 1)) * 100);
                            const stats = computeJobStats(job);
                            const hasResults = Object.keys(job.results || {}).length > 0;
                            const isIntel = job.typeLabel === 'Full Intel';
                            const isAsset = job.typeLabel === 'Asset Secure';
                            const isOrientation = job.typeLabel === 'Orientation';

                            return (
                                <div key={job.id} className={`bg-white border rounded-[2.5rem] p-6 shadow-sm hover:shadow-md transition-all ${isRunning ? 'border-indigo-100 ring-4 ring-indigo-50/30' : 'border-slate-100'}`}>
                                    {/* ── Header row ── */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="flex items-center gap-5">
                                            <div className={`w-14 h-14 rounded-3xl flex items-center justify-center text-xl flex-shrink-0 ${
                                                job.status === 'completed' ? 'bg-emerald-50 text-emerald-500' :
                                                job.status === 'cancelled' ? 'bg-slate-100 text-slate-400' :
                                                job.status === 'failed' ? 'bg-rose-50 text-rose-500' :
                                                'bg-indigo-50 text-indigo-500 animate-pulse'
                                            }`}>
                                                <i className={`fa-solid ${
                                                    isIntel ? 'fa-brain' :
                                                    isOrientation ? 'fa-compass' :
                                                    job.typeLabel === 'Narrative' ? 'fa-file-signature' :
                                                    isAsset ? 'fa-shield-halved' : 'fa-database'
                                                }`}></i>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{job.typeLabel}</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                                        job.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                                        job.status === 'cancelled' ? 'bg-slate-200 text-slate-600' :
                                                        job.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                                                        'bg-indigo-100 text-indigo-700'
                                                    }`}>
                                                        {job.status}
                                                    </span>
                                                    <JobTimer createdAt={job.createdAt} status={job.status} updatedAt={job.completedAt || job.updatedAt} />
                                                    {stats.durationStr && !isRunning && (
                                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                            <i className="fa-solid fa-hourglass-end text-[8px]"></i>
                                                            {stats.durationStr}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="text-lg font-black text-slate-900 leading-none mb-1">
                                                    {job.city || 'Global Batch'} <span className="text-slate-300 font-mono text-sm ml-2">{job.id.slice(-6)}</span>
                                                </h3>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                    {job.createdAt?.toDate?.().toLocaleString?.() || '—'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex-1 max-w-md">
                                            <div className="flex items-end justify-between mb-2">
                                                <span className="text-sm font-black text-slate-900">{job.done || 0} <span className="text-[10px] text-slate-400 uppercase">/ {job.total || 0} Processed</span></span>
                                                <span className="text-xs font-black text-slate-400">{progress}%</span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100 mb-3">
                                                <div
                                                    className={`h-full transition-all duration-1000 ${
                                                        job.status === 'completed' ? 'bg-emerald-500' :
                                                        job.status === 'failed' ? 'bg-rose-500' :
                                                        'bg-indigo-500'
                                                    }`}
                                                    style={{ width: `${progress}%` }}
                                                ></div>
                                            </div>

                                            {/* ── Stats chips ── */}
                                            {hasResults && (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {stats.ran > 0 && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                                                            <i className="fa-solid fa-bolt text-[7px]"></i>
                                                            {stats.ran} ran
                                                        </span>
                                                    )}
                                                    {stats.cached > 0 && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-50 text-sky-600 text-[9px] font-black uppercase tracking-widest border border-sky-100">
                                                            <i className="fa-solid fa-rotate text-[7px]"></i>
                                                            {stats.cached} cached
                                                        </span>
                                                    )}
                                                    {isOrientation && (job.cached || 0) > 0 && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-50 text-sky-600 text-[9px] font-black uppercase tracking-widest border border-sky-100">
                                                            <i className="fa-solid fa-rotate text-[7px]"></i>
                                                            {job.cached} cached
                                                        </span>
                                                    )}
                                                    {stats.failed > 0 && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 text-rose-600 text-[9px] font-black uppercase tracking-widest border border-rose-100">
                                                            <i className="fa-solid fa-triangle-exclamation text-[7px]"></i>
                                                            {stats.failed} failed
                                                        </span>
                                                    )}
                                                    {stats.skipped > 0 && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-50 text-slate-500 text-[9px] font-black uppercase tracking-widest border border-slate-100">
                                                            <i className="fa-solid fa-forward text-[7px]"></i>
                                                            {stats.skipped} skipped
                                                        </span>
                                                    )}
                                                    {isIntel && stats.healedVisual > 0 && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-50 text-violet-600 text-[9px] font-black uppercase tracking-widest border border-violet-100">
                                                            <i className="fa-solid fa-eye text-[7px]"></i>
                                                            {stats.healedVisual} visual
                                                        </span>
                                                    )}
                                                    {isIntel && stats.healedEnv > 0 && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-50 text-teal-600 text-[9px] font-black uppercase tracking-widest border border-teal-100">
                                                            <i className="fa-solid fa-leaf text-[7px]"></i>
                                                            {stats.healedEnv} env healed
                                                        </span>
                                                    )}
                                                    {isIntel && stats.healedScores > 0 && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-600 text-[9px] font-black uppercase tracking-widest border border-amber-100">
                                                            <i className="fa-solid fa-star text-[7px]"></i>
                                                            {stats.healedScores} scores healed
                                                        </span>
                                                    )}
                                                    {isAsset && stats.newImages > 0 && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                                                            <i className="fa-solid fa-images text-[7px]"></i>
                                                            {stats.newImages} images secured
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {isRunning && (
                                                <button
                                                    onClick={() => requestStop(job.id)}
                                                    className="px-6 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-black uppercase tracking-widest rounded-2xl transition-all border border-rose-100"
                                                >
                                                    Stop Run
                                                </button>
                                            )}
                                            {job.status === 'completed' && (
                                                <div className="px-6 py-3 bg-emerald-50 text-emerald-600 text-xs font-black uppercase tracking-widest rounded-2xl border border-emerald-100">
                                                    Complete
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        
                        {allJobs.length === 0 && !loadingJobs && (
                            <div className="py-20 text-center">
                                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 text-slate-200 text-2xl">
                                    <i className="fa-solid fa-ghost"></i>
                                </div>
                                <p className="text-sm font-bold text-slate-400">No recent batch jobs found.</p>
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
            const name = typeof n.neighborhood_name === 'string' ? n.neighborhood_name : (n.neighborhood_name?.social || n.neighborhood_name?.legal_subdivision || '');
            return name.toLowerCase().includes(q) ||
                n.alternative_names?.some((a: string) => typeof a === 'string' && a.toLowerCase().includes(q)) ||
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
                                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all ${selectedKey === c.key
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
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${selectedKey === c.key ? 'bg-slate-900 text-white shadow' : 'bg-white border border-slate-200 text-slate-400'
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
                                    {viewMode === 'audit' ? (
                                        <div className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-line max-h-[200px] overflow-y-auto pr-2">
                                            {neighborhoodData.city_summary}
                                        </div>
                                    ) : (
                                        <div className="py-4 text-center">
                                            <p className="text-xs font-bold text-indigo-600">Pipeline Monitoring View Active</p>
                                        </div>
                                    )}
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
                                                    <h4 className="text-sm font-black text-slate-900 leading-snug">
                                                        {typeof n.neighborhood_name === 'string' 
                                                            ? n.neighborhood_name 
                                                            : (n.neighborhood_name?.social || n.neighborhood_name?.legal_subdivision || 'Unnamed Neighborhood')}
                                                    </h4>
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
                                                            <p className="text-[10px] text-slate-600 mt-0.5">
                                                                {typeof n.infrastructure_quality === 'object' ? (
                                                                    (n.infrastructure_quality as any).notes || 
                                                                    Object.entries(n.infrastructure_quality)
                                                                        .filter(([k, v]) => k !== 'notes' && v)
                                                                        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
                                                                        .join(' · ')
                                                                ) : n.infrastructure_quality}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {n.upcoming_changes && (() => {
                                                        const val = typeof n.upcoming_changes === 'object'
                                                            ? Object.entries(n.upcoming_changes)
                                                                .filter(([_, v]) => v && typeof v === 'string' && v !== 'None known')
                                                                .map(([k, v]) => `${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}: ${v}`)
                                                                .join(' | ')
                                                            : n.upcoming_changes;
                                                        if (!val || val === 'None known') return null;
                                                        return (
                                                            <div>
                                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Upcoming Changes</span>
                                                                <p className="text-[10px] text-amber-700 mt-0.5">{val}</p>
                                                            </div>
                                                        );
                                                    })()}
                                                    {n.nextdoor?.found && (
                                                        <div className="pt-2 border-t border-slate-50 space-y-3">
                                                            <div className="flex flex-col gap-1 mb-1">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                                                                        <i className="fa-solid fa-people-group text-[9px]"></i>
                                                                        Community Intelligence
                                                                    </span>
                                                                    {n.nextdoor.overall_city_rank && (
                                                                        <span className="text-[8px] font-bold text-slate-400 italic">#{n.nextdoor.overall_city_rank} in {selectedCity?.city || 'the city'}</span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[7px] text-slate-400 font-medium italic opacity-60">*Aggregated from social platforms</div>
                                                            </div>

                                                            {/* Quick Metrics Grid */}
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="bg-emerald-50/50 rounded-xl p-2 border border-emerald-100/50">
                                                                    <div className="text-[7px] font-black text-emerald-500 uppercase tracking-tight mb-0.5">Friendliness</div>
                                                                    <div className="flex items-end gap-1">
                                                                        <span className="text-sm font-black text-emerald-700 leading-none">{n.nextdoor.friendliness_score || '—'}</span>
                                                                        <span className="text-[8px] font-bold text-emerald-600/60 pb-0.5">/ 10</span>
                                                                    </div>
                                                                </div>
                                                                <div className="bg-slate-50 rounded-xl p-2 border border-slate-200/50">
                                                                    <div className="text-[7px] font-black text-slate-400 uppercase tracking-tight mb-0.5">Ownership</div>
                                                                    <div className="text-sm font-black text-slate-700 leading-none">{n.nextdoor.home_ownership_pct || '—'}</div>
                                                                </div>
                                                                {n.nextdoor.local_events_count && (
                                                                    <div className="bg-indigo-50/50 rounded-xl p-2 border border-indigo-100/50">
                                                                        <div className="text-[7px] font-black text-indigo-500 uppercase tracking-tight mb-0.5">Local Events</div>
                                                                        <div className="text-xs font-black text-indigo-700 leading-none">{n.nextdoor.local_events_count} active</div>
                                                                    </div>
                                                                )}
                                                                <div className="bg-amber-50/50 rounded-xl p-2 border border-amber-100/50">
                                                                    <div className="text-[7px] font-black text-amber-500 uppercase tracking-tight mb-0.5">Affordability</div>
                                                                    <div className="flex items-end gap-1">
                                                                        <span className="text-sm font-black text-amber-700 leading-none">{n.nextdoor.affordability_score || '—'}</span>
                                                                        <span className="text-[8px] font-bold text-amber-600/60 pb-0.5">/ 10</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Topics */}
                                                            {n.nextdoor.key_topics?.length > 0 && (
                                                                <div>
                                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Active Discussion Topics</span>
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {n.nextdoor.key_topics.map((t: any, ti: number) => (
                                                                            <span key={ti} className="text-[9px] font-medium text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-sm hover:border-emerald-300 transition-colors" title={t.description}>
                                                                                {t.topic}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Events */}
                                                            {n.nextdoor.upcoming_events?.length > 0 && (
                                                                <div className="space-y-1.5">
                                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Upcoming Community Events</span>
                                                                    <div className="space-y-1">
                                                                        {n.nextdoor.upcoming_events.slice(0, 2).map((e: any, ei: number) => (
                                                                            <div key={ei} className="flex flex-col p-1.5 rounded-lg bg-slate-50/80 border border-slate-100">
                                                                                <div className="flex justify-between items-start gap-2">
                                                                                    <span className="text-[10px] font-bold text-slate-800 leading-tight">{e.name}</span>
                                                                                    {e.date && <span className="text-[7px] font-black text-indigo-500 uppercase tracking-tighter whitespace-nowrap bg-white px-1.5 py-0.5 rounded-md border border-indigo-100">{e.date}</span>}
                                                                                </div>
                                                                                {e.description && <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-1 italic">{e.description}</p>}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
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

            {/* Run Summary Modal */}
            {showSummaryModal && lastRunStats && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center">
                                        <i className="fa-solid fa-chart-line text-xs"></i>
                                    </div>
                                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Last Run Summary</h2>
                                </div>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-11">
                                    {lastRunStats.type?.replace(/_/g, ' ')} • {(() => {
                                        if (!lastRunStats.completedAt) return 'In Progress';
                                        if (typeof lastRunStats.completedAt?.toDate === 'function') return lastRunStats.completedAt.toDate().toLocaleString();
                                        if (lastRunStats.completedAt instanceof Date) return lastRunStats.completedAt.toLocaleString();
                                        return String(lastRunStats.completedAt);
                                    })()}
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowSummaryModal(false)}
                                className="w-10 h-10 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all flex items-center justify-center"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-8 overflow-y-auto custom-scrollbar bg-white">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                {/* Total Processed */}
                                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Properties</span>
                                    <div className="text-3xl font-black text-slate-900">
                                        {lastRunStats.done || 0}
                                        <span className="text-sm text-slate-300 ml-2 italic">/ {lastRunStats.total || 0}</span>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">Success</span>
                                        {lastRunStats.failed > 0 && (
                                            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full uppercase">{lastRunStats.failed} Failed</span>
                                        )}
                                    </div>
                                </div>

                                {/* Estimated Cost / Asset Stats */}
                                {lastRunStats.type === 'asset_secure_batch_jobs' ? (
                                    <div className="p-6 rounded-2xl bg-rose-50 border border-rose-100">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 block mb-2">Assets Secured</span>
                                        <div className="text-3xl font-black text-rose-600">
                                            {Object.values(lastRunStats.results || {}).reduce((acc: number, res: any) => acc + (res.newCount || 0), 0)}
                                            <span className="text-sm text-rose-300 ml-2 italic">new images</span>
                                        </div>
                                        <div className="mt-2 text-[10px] font-bold text-rose-400 uppercase tracking-tight">
                                            {Object.values(lastRunStats.results || {}).reduce((acc: number, res: any) => acc + (res.skipCount || 0), 0)} Already Covered
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-6 rounded-2xl bg-indigo-50 border border-indigo-100">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block mb-2">Estimated AI Cost</span>
                                        <div className="text-3xl font-black text-indigo-600">
                                            ${Object.values(lastRunStats.stats?.gemini || {}).reduce((acc: number, curr: any) => acc + (typeof curr === 'object' ? (curr.estimatedCost || 0) : 0), 0).toFixed(2)}
                                        </div>
                                        <div className="mt-2 text-[10px] font-bold text-indigo-400 uppercase tracking-tight">
                                            Based on Flash Pricing
                                        </div>
                                    </div>
                                )}

                                {/* Total LLM Calls / Storage Stats */}
                                {lastRunStats.type === 'asset_secure_batch_jobs' ? (
                                    <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Cloud Storage</span>
                                        <div className="text-3xl font-black text-slate-900">
                                            {Object.values(lastRunStats.results || {}).reduce((acc: number, res: any) => acc + (res.count || 0), 0)}
                                            <span className="text-sm text-slate-300 ml-2 italic">Total Files</span>
                                        </div>
                                        <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                            Persistent in Firebase
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-6 rounded-2xl bg-amber-50 border border-amber-100">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 block mb-2">Total AI Calls</span>
                                        <div className="text-3xl font-black text-amber-600">
                                            {Object.values(lastRunStats.stats?.gemini || {}).reduce((acc: number, curr: any) => acc + (typeof curr === 'object' ? (curr.calls || 0) : 0), 0)}
                                        </div>
                                        <div className="mt-2 text-[10px] font-bold text-amber-500 uppercase tracking-tight">
                                            {Object.values(lastRunStats.stats?.gemini || {}).reduce((acc: number, curr: any) => acc + (typeof curr === 'object' ? (curr.inputTokens || 0) : 0), 0).toLocaleString()} Total Tokens
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-8">
                                {/* Task Breakdown */}
                                <div>
                                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                        <i className="fa-solid fa-list-check"></i>
                                        Task Breakdown
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        {Object.entries(lastRunStats.stats?.tasks || {}).map(([task, count]) => (
                                            <div key={task} className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-all">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter block mb-1">{task.replace(/_/g, ' ')}</span>
                                                <span className="text-lg font-black text-slate-900">{count as number}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* AI Model Usage */}
                                <div>
                                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                        <i className="fa-solid fa-microchip"></i>
                                        Gemini Usage
                                    </h3>
                                    <div className="overflow-hidden rounded-2xl border border-slate-100">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50">
                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Model</th>
                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-right">Calls</th>
                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-right">Input Tokens</th>
                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-right">Output Tokens</th>
                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-right text-indigo-600">Est. Cost</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(lastRunStats.stats?.gemini || {}).map(([model, data]: [string, any]) => (
                                                    <tr key={model} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                                                        <td className="p-4 text-xs font-bold text-slate-700">{model}</td>
                                                        <td className="p-4 text-xs font-medium text-slate-600 text-right">{data.calls || 0}</td>
                                                        <td className="p-4 text-xs font-medium text-slate-600 text-right">{data.inputTokens?.toLocaleString() || 0}</td>
                                                        <td className="p-4 text-xs font-medium text-slate-600 text-right">{data.outputTokens?.toLocaleString() || 0}</td>
                                                        <td className="p-4 text-xs font-black text-indigo-600 text-right">${(data.estimatedCost || 0).toFixed(4)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* API Usage */}
                                <div>
                                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                        <i className="fa-solid fa-cloud"></i>
                                        External API Calls
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        {Object.entries(lastRunStats.stats?.apis || {}).map(([api, count]) => (
                                            <div key={api} className="p-4 rounded-xl border border-slate-100 bg-slate-50/30">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter block mb-1 truncate" title={api}>{api.split(':')[1]?.replace(/_/g, ' ') || api}</span>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-lg font-black text-slate-900">{count as number}</span>
                                                    <span className="text-[9px] font-bold text-slate-300 uppercase">{api.split(':')[0]}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Property Results */}
                                {lastRunStats.results && Object.keys(lastRunStats.results).length > 0 && (
                                    <div className="mt-8 border-t border-slate-100 pt-8">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                                    <i className="fa-solid fa-house-circle-check"></i>
                                                    Property Results
                                                </h3>
                                                <div className="flex bg-slate-100 p-1 rounded-xl">
                                                    <button 
                                                        onClick={() => setRunResultsFilter('all')}
                                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${runResultsFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                    >
                                                        All
                                                    </button>
                                                    <button 
                                                        onClick={() => setRunResultsFilter('failed')}
                                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${runResultsFilter === 'failed' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                    >
                                                        Failed Only
                                                    </button>
                                                </div>
                                            </div>
                                        <div className="grid gap-2">
                                            {Object.entries(lastRunStats.results)
                                                .filter(([_, res]: [string, any]) => runResultsFilter === 'all' || res.status === 'failed' || res.status === 'error')
                                                .map(([zpid, res]: [string, any]) => (
                                                <div key={zpid} className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <i className={`fa-solid ${res.status === 'success' || res.status === 'cached' ? 'fa-check-circle text-emerald-400' : 'fa-times-circle text-rose-400'} text-sm flex-shrink-0`}></i>
                                                        <div className="truncate">
                                                            <span className="text-[11px] font-black text-slate-700 block truncate">
                                                                {res.message || (
                                                                    res.newCount !== undefined 
                                                                        ? `${res.newCount} new, ${res.skipCount} cached` 
                                                                        : zpid
                                                                )}
                                                            </span>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">ZPID: {zpid}</span>
                                                                {res.healed && (
                                                                    <div className="flex gap-1">
                                                                        {Object.entries(res.healed).map(([key, healed]) => healed ? (
                                                                            <span key={key} className="text-[8px] font-black px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded uppercase">{key}</span>
                                                                        ) : null)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex-shrink-0">
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                                                            res.status === 'success' ? 'bg-emerald-50 text-emerald-600' :
                                                            res.status === 'cached' ? 'bg-indigo-50 text-indigo-600' :
                                                            'bg-rose-50 text-rose-600'
                                                        }`}>
                                                            {res.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div>
                                {lastRunStats.failed > 0 && (
                                    <button 
                                        onClick={() => handleRetryJobZPIDs(lastRunStats)}
                                        className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-200 flex items-center gap-2"
                                    >
                                        <i className="fa-solid fa-rotate-right"></i>
                                        Retry {lastRunStats.failed} Failed
                                    </button>
                                )}
                            </div>
                            <button 
                                onClick={() => setShowSummaryModal(false)}
                                className="px-8 py-3 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

