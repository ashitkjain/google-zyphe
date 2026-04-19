import { useState, useMemo, useEffect } from 'react';
import { 
  PropertyData, 
  CustomAIAnalysisResult, 
  ComprehensiveAnalysisResult, 
  LogEntry, 
  UserProfile 
} from '../types';
import { normalizeAddress, fetchPropertyDataFull } from '../services/apiService';
import { 
  analyzePropertyImages, 
  analyzeNeighborhood, 
  analyzeCommunityPulse, 
  analyzeComprehensive, 
  AiResponseError 
} from '../services/geminiService';
import { 
  savePropertyToCloud, 
  saveVisualAnalysisToCloud, 
  getVisualAnalysisFromCloud, 
  saveComprehensiveAnalysisToCloud, 
  getComprehensiveAnalysisFromCloud,
  getImageQualityAnalysisFromCloud,
  getPropertyInvestmentFromCloud,
  getGeneralMarketIntelligenceFromCloud,
  getCommunityPulseFromCloud,
  saveCommunityPulseToCloud,
  deletePropertyAnalysis,
  getContextGraphFromCloud,
  getDeepInvestmentResearchFromCloud,
  updateAddressIndex,
  generateCityStateKey,
  trackUserPropertyView
} from '../services/firebaseService';
import { runSatellitaryAnalysis, runOrientationViaBatch, deleteOrientationVersionsForProperty } from '../services/satellitaryService';
import { APP_CONFIG } from '../config';

interface UsePropertyAnalysisProps {
  currentUser: UserProfile | null;
  transitionToView: (view: any, addr?: string) => void;
  addToHistory: (addr: string) => void;
  setAddress: (addr: string) => void;
  setAddressIndex: React.Dispatch<React.SetStateAction<any[]>>;
}

export function usePropertyAnalysis({ 
  currentUser, 
  transitionToView, 
  addToHistory, 
  setAddress,
  setAddressIndex
}: UsePropertyAnalysisProps) {
  const [propertyData, setPropertyData] = useState<PropertyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSublabel, setLoadingSublabel] = useState('');
  const [loadingTimer, setLoadingTimer] = useState(0);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customAnalysis, setCustomAnalysis] = useState<CustomAIAnalysisResult | null>(null);
  const [customAnalysisLoading, setCustomAnalysisLoading] = useState(false);
  const [comprehensiveAnalysis, setComprehensiveAnalysis] = useState<ComprehensiveAnalysisResult | null>(null);
  const [comprehensiveLoading, setComprehensiveLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [envRefreshing, setEnvRefreshing] = useState(false);

  const addLog = (service: string, { type }: any, content: any, usage?: any) => {
    setLogs(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), service, type, content, usage }]);
  };

  useEffect(() => {
    let interval: number;
    if (loading && !propertyData) {
      setLoadingTimer(0);
      interval = window.setInterval(() => {
        setLoadingTimer(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [loading, propertyData]);

  const performSearch = async (searchAddress: string, forceRefresh: boolean = false, displayAddressOverride?: string) => {
    if (!searchAddress.trim()) return;

    const _t0 = performance.now();
    const _elapsed = () => `${(performance.now() - _t0).toFixed(0)}ms`;
    console.log(`%c[⏱ PageLoad] START search: "${searchAddress}"`, 'color: #f59e0b; font-weight: bold;');

    setLoading(true);
    setLoadingSublabel("Initializing session...");
    setImagesLoading(true);
    setError(null);
    setPropertyData(null);
    setCustomAnalysis(null);
    setComprehensiveAnalysis(null);
    setLogs([]);
    transitionToView('main');

    try {
      let finalAddress = searchAddress;
      let coords = null;
      let mapIn = undefined;
      let mapOut = undefined;

      const isZpid = /^\d+$/.test(searchAddress);

      if (!isZpid) {
        setLoadingSublabel("Normalizing address...");
        addLog('Radar Geocode API', { type: 'request' }, { address: searchAddress });
        const radarResult = await normalizeAddress(searchAddress);
        addLog('Radar Geocode API', { type: 'response' }, radarResult);
        finalAddress = radarResult.formattedAddress;
        coords = radarResult.coordinates;
        mapIn = radarResult.mapZoomIn;
        mapOut = radarResult.mapZoomOut;
        addToHistory(finalAddress);
        setAddress(finalAddress);
      } else {
        setLoadingSublabel(`Direct ZPID Search: ${searchAddress}`);
      }

      const fullData = await fetchPropertyDataFull(
        finalAddress,
        isZpid,
        false, 
        (step) => setLoadingSublabel(step)
      );

      let resolvedAddress = "";
      if (displayAddressOverride) {
        resolvedAddress = displayAddressOverride;
      } else if (isZpid) {
        resolvedAddress = fullData.address || `Property ID: ${searchAddress}`;
      } else {
        resolvedAddress = finalAddress || fullData.address || searchAddress;
      }

      const mergedData: PropertyData = {
        ...fullData,
        coordinates: coords || fullData.coordinates,
        mapZoomIn: mapIn || fullData.mapZoomIn,
        mapZoomOut: mapOut || fullData.mapZoomOut,
        address: resolvedAddress
      };

      addLog('Zyphe Data Layer', { type: 'response' }, mergedData);

      setPropertyData(mergedData);
      setAddress(mergedData.address);
      setLoading(false);
      setImagesLoading(false);

      if (currentUser && mergedData.zpid) {
        trackUserPropertyView(currentUser.uid, mergedData);
      }

      if (mergedData.zpid && mergedData.city && mergedData.address) {
        updateAddressIndex(mergedData.city, mergedData.address, mergedData.zpid).catch(() => {});
        setAddressIndex(prev => {
          if (prev.some(e => e.z === mergedData.zpid)) return prev;
          return [...prev, { a: mergedData.address, z: mergedData.zpid! }];
        });
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during property retrieval.');
      addLog('System', { type: 'error' }, err);
      setLoading(false);
      setImagesLoading(false);
    }
  };

  const handleRunCustomAnalysis = async (force = false) => {
    if (!propertyData) return;

    if (force) {
      setComprehensiveAnalysis(null);
      if (propertyData.zpid) {
        await deletePropertyAnalysis(propertyData.zpid, 'intelligence');
        addLog('System', { type: 'info' }, "Forced Refresh: Intelligence cache cleared.");
      }
    }

    setCustomAnalysisLoading(true);
    transitionToView('visual-report');

    try {
      const city = propertyData?.city || (propertyData?.address && propertyData.address.split(',')[1]?.trim());
      const state = propertyData?.state || (propertyData?.address && propertyData.address.split(',')[2]?.split(' ')[1]?.trim());
      const cityStateKey = generateCityStateKey(city, state);

      const [pulseCached, genMarket, propInv, deepResearch] = await Promise.all([
        cityStateKey ? getCommunityPulseFromCloud(cityStateKey) : Promise.resolve(null),
        (APP_CONFIG.caching.investment_research && cityStateKey) ? getGeneralMarketIntelligenceFromCloud(cityStateKey) : Promise.resolve(null),
        APP_CONFIG.caching.investment_research ? getPropertyInvestmentFromCloud(propertyData.zpid) : Promise.resolve(null),
        cityStateKey ? getDeepInvestmentResearchFromCloud(cityStateKey) : Promise.resolve(null),
      ]);

      if (!force && propertyData.zpid) {
        const [cached, qualityCached, graphCached] = await Promise.all([
          getVisualAnalysisFromCloud(propertyData.zpid),
          APP_CONFIG.caching.image_quality ? getImageQualityAnalysisFromCloud(propertyData.zpid) : Promise.resolve(null),
          getContextGraphFromCloud(propertyData.zpid)
        ]);

        if (cached) {
          if (qualityCached) cached.image_quality_analysis = qualityCached;
          if (pulseCached) cached.community_pulse = pulseCached;
          if (propInv) cached.property_investment = propInv;
          if (genMarket) cached.general_market_intelligence = genMarket;
          if (graphCached) cached.context_graph = graphCached;
          if (deepResearch?.content) cached.deep_investment_research = deepResearch;
          setCustomAnalysis(cached);
          setCustomAnalysisLoading(false);
          return;
        }
      }

      const cityDataSeed: any = {};
      if (pulseCached) cityDataSeed.community_pulse = pulseCached;
      if (propInv) cityDataSeed.property_investment = propInv;
      if (genMarket) cityDataSeed.general_market_intelligence = genMarket;
      if (deepResearch?.content) cityDataSeed.deep_investment_research = deepResearch;

      let currentImages = propertyData.images || [];
      let propToAnalyze = propertyData;

      if (force && propertyData.zpid) {
        try {
          const { securePropertyAssets } = await import('../services/assetService');
          const assets = await securePropertyAssets(
            propertyData.zpid,
            currentImages,
            { zoomIn: propertyData.mapZoomIn, zoomOut: propertyData.mapZoomOut }
          );
          currentImages = assets.images;
          propToAnalyze = { ...propertyData, images: currentImages };
          setPropertyData(propToAnalyze);
          await savePropertyToCloud(propertyData.zpid, propToAnalyze);
        } catch (e) {
          console.warn("[Hook] Asset securing failed", e);
        }
      }

      const res = await analyzePropertyImages(currentImages, propToAnalyze);
      const result = { ...cityDataSeed, ...res.data };

      if (propToAnalyze.mapZoomIn && propToAnalyze.mapZoomOut) {
        try {
          const neighborRes = await analyzeNeighborhood(propToAnalyze.mapZoomIn, propToAnalyze.mapZoomOut, propToAnalyze);
          result.neighborhood = neighborRes.data;
        } catch (neighborErr) {}
      }

      if (!result.community_pulse) {
        try {
          const pulseRes = await analyzeCommunityPulse(propToAnalyze);
          result.community_pulse = pulseRes.data;
          const city = propToAnalyze?.city || (propToAnalyze?.address && propToAnalyze.address.split(',')[1]?.trim());
          const state = propToAnalyze?.state || (propToAnalyze?.address && propToAnalyze.address.split(',')[2]?.split(' ')[1]?.trim());
          const cityStateKey = generateCityStateKey(city, state);
          if (cityStateKey) await saveCommunityPulseToCloud(cityStateKey, pulseRes.data);
        } catch (pulseErr) {}
      }

      setCustomAnalysis(result);
      if (propToAnalyze.zpid) await saveVisualAnalysisToCloud(propToAnalyze.zpid, result);

      if (force) handleRunComprehensive(true, result);
      return result;
    } catch (err: any) {
      setError("AI analysis failed. Check logs for details.");
      return null;
    } finally {
      setCustomAnalysisLoading(false);
    }
  };

  const handleRunComprehensive = async (force = false, providedVisual?: CustomAIAnalysisResult) => {
    const visualContext = providedVisual || customAnalysis;
    if (!propertyData || !visualContext) return;

    if (!force && comprehensiveAnalysis) {
      transitionToView('comprehensive-report');
      return;
    }

    setComprehensiveLoading(true);
    transitionToView('comprehensive-report');

    try {
      if (!force && propertyData.zpid) {
        const cached = await getComprehensiveAnalysisFromCloud(propertyData.zpid);
        if (cached) {
          setComprehensiveAnalysis(cached);
          setComprehensiveLoading(false);
          return;
        }
      }

      const res = await analyzeComprehensive(propertyData, visualContext);
      const result = res.data;
      setComprehensiveAnalysis(result);
      if (propertyData.zpid) await saveComprehensiveAnalysisToCloud(propertyData.zpid, result);
    } catch (err: any) {
      setError("Comprehensive report failed. Check logs for details.");
    } finally {
      setComprehensiveLoading(false);
    }
  };

  const handleRefreshCommunityPulse = async () => {
    if (!propertyData) return;
    try {
      const pulseRes = await analyzeCommunityPulse(propertyData);
      const updatedCustom = { ...(customAnalysis || {}), community_pulse: pulseRes.data } as CustomAIAnalysisResult;
      setCustomAnalysis(updatedCustom);
      const compRes = await analyzeComprehensive(propertyData, updatedCustom);
      setComprehensiveAnalysis(compRes.data);
      if (propertyData.zpid) {
        await saveVisualAnalysisToCloud(propertyData.zpid, updatedCustom);
        await saveComprehensiveAnalysisToCloud(propertyData.zpid, compRes.data);
        const city = propertyData?.city || propertyData?.address?.split(',')[1]?.trim();
        const state = propertyData?.state || propertyData?.address?.split(',')[2]?.split(' ')[1]?.trim();
        const cityStateKey = generateCityStateKey(city, state);
        if (cityStateKey) await saveCommunityPulseToCloud(cityStateKey, pulseRes.data);
      }
    } catch (err: any) {
      addLog('Gemini AI', { type: 'error' }, err.message || err);
    }
  };

  const handleRefreshEnvironment = async (setLoadingSublabel: (s: string) => void) => {
    if (!propertyData?.coordinates || loading) return;
    setEnvRefreshing(true);
    setLoadingSublabel('Refreshing environment data...');
    try {
      const lat = propertyData.coordinates.latitude;
      const lng = propertyData.coordinates.longitude;
      const zpid = propertyData.zpid ? String(propertyData.zpid) : undefined;
      const addr = propertyData.address || undefined;

      const { fetchSolarData, fetchAirQuality, fetchPollenData, fetchNoiseScore } = await import('../services/api/environmental');
      const { fetchHistoricalDisasters } = await import('../services/api/disasters');
      const { fetchBroadbandData } = await import('../services/api/broadband');
      const { fetchDroughtData } = await import('../services/api/drought');
      const { analyzePollen } = await import('../services/geminiService');
      const { auth: fbAuth } = await import('../services/firebase/config');

      const [freshSolar, freshAirQual, freshPollenRaw, freshNoise, freshDisasters, freshBroadband, freshDrought] = await Promise.all([
        fetchSolarData(lat, lng, zpid, addr),
        fetchAirQuality(lat, lng, zpid, addr),
        fetchPollenData(lat, lng, zpid, addr),
        fetchNoiseScore(lat, lng, zpid, addr),
        fetchHistoricalDisasters(lat, lng, propertyData.state, propertyData.city, zpid, addr),
        fetchBroadbandData(lat, lng, zpid, addr),
        fetchDroughtData(lat, lng, zpid, addr),
      ]);

      const updated = { ...propertyData };
      if (freshSolar) updated.solarData = freshSolar;
      if (freshAirQual) updated.airQuality = freshAirQual;
      if (freshNoise) {
        updated.noiseScore = freshNoise.score;
        updated.noiseScoreDesc = freshNoise.description ?? undefined;
        updated.noiseTrafficScore = freshNoise.trafficScore;
        updated.noiseTrafficDesc = freshNoise.trafficDesc ?? undefined;
        updated.noiseLocalScore = freshNoise.localScore;
        updated.noiseLocalDesc = freshNoise.localDesc ?? undefined;
        updated.noiseAirportScore = freshNoise.airportScore;
        updated.noiseAirportDesc = freshNoise.airportDesc ?? undefined;
      }
      if (freshDisasters) updated.historical_disasters = freshDisasters;
      if (freshBroadband) updated.broadband = freshBroadband;
      if (freshDrought) updated.drought = freshDrought;

      if (freshPollenRaw) {
        try {
          const userId = fbAuth?.currentUser?.uid || 'unknown';
          const pollenAnalysis = await analyzePollen(freshPollenRaw, updated, userId);
          updated.pollen = { ...freshPollenRaw, analysis: pollenAnalysis.data };
        } catch (e) {
          updated.pollen = freshPollenRaw;
        }
      }

      setPropertyData(updated);
      addLog('Zyphe Data Layer', { type: 'env-refresh' }, { target: addr, result: 'success' });
    } catch (err: any) {
      addLog('Zyphe Data Layer', { type: 'env-refresh' }, { target: propertyData.address, result: 'failed', error: err.message });
    } finally {
      setEnvRefreshing(false);
      setLoadingSublabel('');
    }
  };

  const handleRefreshOrientation = async () => {
    if (!propertyData?.coordinates || loading) return;
    const zpid = propertyData.zpid ? String(propertyData.zpid) : undefined;
    const addr = propertyData.address || undefined;

    setEnvRefreshing(true);
    try {
      if (zpid) {
        // ── Preferred path: delegate to Cloud Function ───────────────────────
        // All analysis logic (prompt, GPS math, UNCLEAR overrides) lives in
        // functions/orientationBatch.js — the single source of truth.
        const result = await runOrientationViaBatch(zpid);
        if (!result) throw new Error('Orientation batch job timed out or failed');

        setPropertyData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            orientation_ai: {
              ...(prev as any).orientation_ai,
              ...result,
            },
          };
        });
        addLog('Satellitary', { type: 'orientation-refresh' }, { address: addr, result: result.final_orientation, source: 'cloud-function' });

      } else {
        // ── Fallback: browser-side analysis (no zpid — rare edge case) ───────
        const lat = propertyData.coordinates.latitude;
        const lng = propertyData.coordinates.longitude;
        const description = (propertyData as any).description ?? null;
        const { auth: fbAuth } = await import('../services/firebase/config');
        const userId = fbAuth?.currentUser?.uid || 'unknown';

        const result = await runSatellitaryAnalysis(
          lat, lng,
          null,   // force fresh street view lookup
          userId,
          undefined,
          addr,
          description
        );

        setPropertyData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            orientation_ai: {
              ...(prev as any).orientation_ai,
              final_orientation: result.final_orientation,
              azimuth_degrees: result.azimuth_degrees,
              confidence: result.confidence,
              explanation: result.explanation,
              aerial_only_mode: result.aerial_only_mode,
              aerial_url: result.aerial_url,
              street_view_url: result.street_view_url,
              pool_visible: result.pool_visible,
              pool_direction: result.pool_direction,
              garage_direction: result.garage_direction,
              open_sky_direction: result.open_sky_direction,
              privacy_insight: result.privacy_insight,
              orientation_highlights: result.orientation_highlights,
              buyer_pro: result.buyer_pro,
              buyer_con: result.buyer_con,
            },
          };
        });
        addLog('Satellitary', { type: 'orientation-refresh' }, { address: addr, result: result.final_orientation, source: 'browser-direct' });
      }
    } catch (err: any) {
      console.error('[Orientation] Refresh failed:', err);
      addLog('Satellitary', { type: 'error' }, { address: addr, error: err.message });
    } finally {
      setEnvRefreshing(false);
    }
  };

  return {
    propertyData, setPropertyData,
    loading, setLoading,
    loadingSublabel, setLoadingSublabel,
    loadingTimer,
    imagesLoading,
    error, setError,
    customAnalysis, setCustomAnalysis,
    customAnalysisLoading,
    comprehensiveAnalysis, setComprehensiveAnalysis,
    comprehensiveLoading,
    logs, setLogs,
    envRefreshing,
    addLog,
    performSearch,
    handleRunCustomAnalysis,
    handleRunComprehensive,
    handleRefreshCommunityPulse,
    handleRefreshEnvironment,
    handleRefreshOrientation
  };
}
