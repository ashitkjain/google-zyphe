
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  PropertyData,
  CustomAIAnalysisResult,
  ComprehensiveAnalysisResult,
  LogEntry,
  UserProfile
} from './types';
import { normalizeAddress, fetchPropertyDataFull } from './services/apiService';
import { analyzePropertyImages, analyzeNeighborhood, analyzeCommunityPulse, analyzeComprehensive, AiResponseError } from './services/geminiService';
import {
  savePropertyToCloud,
  saveVisualAnalysisToCloud,
  getVisualAnalysisFromCloud,
  saveComprehensiveAnalysisToCloud,
  getComprehensiveAnalysisFromCloud,
  auth,
  getUserProfile,
  trackUserPropertyView,
  getUserViewHistory,

  verifyFirestoreConnection,
  getImageQualityAnalysisFromCloud,
  getInvestmentResearchFromCloud,
  deleteUserAccount,
  toggleFavorite,
  getUserFavorites
} from './services/firebaseService';
import { APP_CONFIG } from './config';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import PropertyHeader from './components/PropertyHeader';
import PropertyFacts from './components/PropertyFacts';
import CustomAIAnalysis from './components/CustomAIAnalysis';
import ComprehensiveAnalysis from './components/ComprehensiveAnalysis';
import PropertyImages from './components/PropertyImages';
import PropertyMaps from './components/PropertyMaps';
import ClimateRiskSection from './components/ClimateRiskSection';
import MobilityScores from './components/MobilityScores';
import SchoolScores from './components/SchoolScores';

import PreloadManager from './components/PreloadManager';
import ChatInterface from './components/ChatInterface';
import Logo from './components/Logo';
import AuthModal from './components/AuthModal';
import AddClientModal from './components/AddClientModal';
import ClientHub from './components/ClientHub';
import Footer from './components/Footer';
import ExploreTab from './components/ExploreTab';
import GuidesTab from './components/client-hub/GuidesTab';
import LegalDisclaimer from './components/LegalDisclaimer';
import TermsView from './components/TermsView';
import PrivacyPolicy from './components/PrivacyPolicy';

type ViewMode = 'main' | 'visual-report' | 'comprehensive-report' | 'dashboard' | 'guides' | 'legal-disclaimer' | 'terms' | 'privacy' | 'explore' | 'leads' | 'tasks' | 'settings' | 'whiteboard' | 'closing' | 'reactivate' | 'best_practices' | 'clients' | 'creative_studio' | 'realtor-landing';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [addClientModalOpen, setAddClientModalOpen] = useState(false);
  const [inviteData, setInviteData] = useState<{
    email: string, name: string, role: any, realtorId: string, realtorName: string
  } | null>(null);
  const [cloudHistory, setCloudHistory] = useState<any[]>([]);
  const [realtorName, setRealtorName] = useState<string | null>(null);

  const [searchHistory, setSearchHistory] = useState<{ address: string, timestamp: number }[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);

  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSublabel, setLoadingSublabel] = useState('');
  const [loadingTimer, setLoadingTimer] = useState(0);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertyData, setPropertyData] = useState<PropertyData | null>(null);
  const [customAnalysis, setCustomAnalysis] = useState<CustomAIAnalysisResult | null>(null);
  const [customAnalysisLoading, setCustomAnalysisLoading] = useState(false);
  const [comprehensiveAnalysis, setComprehensiveAnalysis] = useState<ComprehensiveAnalysisResult | null>(null);
  const [comprehensiveLoading, setComprehensiveLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [showPreload, setShowPreload] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Simple Routing Logic
  // Simple Routing Logic
  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname;
      const parts = path.split('/').filter(Boolean);
      const isRealtorPath = parts[0] === 'realtor';
      const subPath = isRealtorPath ? parts.slice(1) : parts;

      // Escrow specific handling: if it's just /escrow, redirect to /realtor/escrow to maintain structure
      // But will be blocked if not signed in, per new rule.
      if (path === '/escrow' || (parts.length === 1 && parts[0] === 'escrow')) {
        window.history.replaceState({ mode: 'guides' }, '', '/realtor/escrow');
        // Fall through to authentication check
      }

      // If unauthenticated, protect all /realtor routes
      if (!currentUser) {
        if (isRealtorPath) {
          setViewMode('realtor-landing');
          return;
        }

        if (path === '/legal-disclaimer' || path === '/terms' || path === '/privacy') {
          setViewMode(path === '/legal-disclaimer' ? 'legal-disclaimer' : path === '/terms' ? 'terms' : 'privacy');
          return;
        }

        if (path === '/guides' || path === '/') {
          setViewMode(path === '/guides' ? 'guides' : 'main');
          return;
        }
      }

      // Authenticated paths
      if (isRealtorPath) {
        if (subPath.length === 0) {
          setViewMode('main'); // Dashboard
        } else if (subPath[0] === 'guides' || subPath.length === 2 || ['hoa', 'insurance', 'escrow', 'property-taxes', 'repairs-liability'].includes(subPath[0])) {
          setViewMode('guides');
        } else {
          // Dynamic tab matching
          setViewMode(subPath[0] as ViewMode);
        }
      } else if (path === '/legal-disclaimer' || path === '/terms' || path === '/privacy') {
        setViewMode(path === '/legal-disclaimer' ? 'legal-disclaimer' : path === '/terms' ? 'terms' : 'privacy');
      } else {
        setViewMode('main');
      }
    };

    // Set initial view mode based on URL
    handleUrlChange();

    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [currentUser]); // Re-run when auth status changes

  // Wrapper for setViewMode to handle URL updates
  const transitionToView = (newMode: ViewMode, customPath?: string) => {
    // Prevent unauthenticated users from leaving educational areas
    if (!currentUser && newMode !== 'guides' && newMode !== 'legal-disclaimer' && newMode !== 'terms' && newMode !== 'privacy') {
      setAuthModalOpen(true);
      return;
    }

    // Check if customPath is actually an address payload (doesn't start with /)
    const isAddress = customPath && !customPath.startsWith('/');
    if (newMode === 'explore' && isAddress) {
      setAddress(customPath);
      performSearch(customPath);
    }

    setViewMode(newMode);
    let path = '/';

    if (customPath && !isAddress) {
      path = customPath;
    } else if (newMode === 'guides') {
      path = '/guides';
    } else if (newMode === 'legal-disclaimer' || newMode === 'terms' || newMode === 'privacy') {
      path = newMode === 'legal-disclaimer' ? '/legal-disclaimer' : newMode === 'terms' ? '/terms' : '/privacy';
    } else if (newMode === 'main' || newMode === 'explore') {
      path = currentUser?.role === 'realtor' ? '/realtor' : '/';
    } else {
      path = `/realtor/${newMode}`;
    }

    if (window.location.pathname !== path) {
      window.history.pushState({ mode: newMode }, '', path);
    }
  };

  const sessionId = useMemo(() => Math.random().toString(36).substring(2, 15), []);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'invite') {
      const email = params.get('email') || '';
      const name = params.get('name') || '';
      const role = params.get('role') as any || 'buyer';
      const realtorId = params.get('realtorId') || '';
      const realtorName = params.get('realtorName') || '';

      setInviteData({ email, name, role, realtorId, realtorName });
      setAuthModalOpen(true);

      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        let profile = null;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          try {
            profile = await getUserProfile(user.uid);
            if (profile) {
              // Successfully got profile, clear temporary role storage
              localStorage.removeItem('zyphe_pending_role');
              break;
            }
          } catch (e: any) {
            if (e.code === 'permission-denied') {
              console.warn("Initial permission sync attempt failed, retrying...");
            }
          }
          attempts++;
          if (attempts < maxAttempts) {
            console.log(`Retrying profile fetch (attempt ${attempts})...`);
            await new Promise(resolve => setTimeout(resolve, 800 * attempts));
          }
        }

        if (profile) {
          setCurrentUser(profile);
        } else {
          // Fallback to localStorage role if available, otherwise default to buyer
          const pendingRole = (localStorage.getItem('zyphe_pending_role') as any) || 'buyer';
          console.log(`Profile not found in Firestore. Using role: ${pendingRole}`);

          setCurrentUser({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Guest User',
            role: pendingRole,
            createdAt: new Date()
          });
        }

        // Fetch cloud data regardless of profile existence as long as we have a UID
        try {
          const history = await getUserViewHistory(user.uid);
          setCloudHistory(history);
          const favs = await getUserFavorites(user.uid);
          console.log("[Auth] Loaded favorites for user:", favs.length);
          setFavorites(favs);
        } catch (e) {
          console.warn("Could not retrieve cloud data:", e);
        }
      } else {
        setCurrentUser(null);
        setCloudHistory([]);
        setFavorites([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser?.realtorId) {
      getUserProfile(currentUser.realtorId).then(profile => {
        if (profile) setRealtorName(profile.displayName);
      });
    } else {
      setRealtorName(null);
    }
  }, [currentUser]);

  useEffect(() => {
    const checkConnection = async () => {
      const result = await verifyFirestoreConnection();
      if (result.success) {
        addLog('Cloud Cache', { type: 'info' }, result.message);
      } else {
        addLog('System', { type: 'error' }, { message: "Firestore Connection Failed", error: result.message });
      }
    };
    checkConnection();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [viewMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    // Load local history
    try {
      const stored = localStorage.getItem('zyphe_search_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        const now = Date.now();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        const valid = parsed.filter((item: any) => (now - item.timestamp) < thirtyDays);
        setSearchHistory(valid);
      }
    } catch (e) {
      console.error("Failed to load search history", e);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addLog = (service: string, { type }: any, content: any, usage?: any) => {
    setLogs(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), service, type, content, usage }]);
  };

  const addToHistory = (newAddress: string) => {
    setSearchHistory(prev => {
      const now = Date.now();
      const newItem = { address: newAddress, timestamp: now };
      const filtered = prev.filter(item => item.address.toLowerCase() !== newAddress.toLowerCase());
      const updated = [newItem, ...filtered].slice(0, 20); // Keep last 20
      localStorage.setItem('zyphe_search_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleHistoryItemClick = (item: string) => {
    setAddress(item);
    setShowHistory(false);
    performSearch(item);
  };

  const performSearch = async (searchAddress: string, forceRefresh: boolean = false) => {
    if (!searchAddress.trim()) return;

    setLoading(true);
    setLoadingSublabel("Initializing session...");
    setImagesLoading(true);
    setError(null);
    setPropertyData(null);
    setCustomAnalysis(null);
    setComprehensiveAnalysis(null);
    setLogs([]);
    setViewMode('main');

    // logUserActivity(sessionId, searchAddress); // Removed as per user request

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

      addLog('Zyphe Data Layer', { type: 'request' }, { target: finalAddress, isZpid });

      const fullData = await fetchPropertyDataFull(
        finalAddress,
        isZpid,
        (step) => setLoadingSublabel(step)
      );

      const mergedData: PropertyData = {
        ...fullData,
        coordinates: coords || fullData.coordinates,
        mapZoomIn: mapIn || fullData.mapZoomIn,
        mapZoomOut: mapOut || fullData.mapZoomOut,
        address: finalAddress || fullData.address
      };

      addLog('Zyphe Data Layer', { type: 'response' }, mergedData);

      const { db_instance } = await import('./services/firebaseService');
      if (!db_instance) {
        addLog('System', { type: 'error' }, "Firestore Database not initialized. Cloud caching will be disabled.");
      }
      console.log(`[Zyphe API] Property Data Loaded. ZPID: ${mergedData.zpid || 'MISSING'}`);
      setPropertyData(mergedData);
      setLoading(false);
      setImagesLoading(false);

      if (currentUser && mergedData.zpid) {
        trackUserPropertyView(currentUser.uid, mergedData);
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

    if (!force && customAnalysis) {
      transitionToView('visual-report' as ViewMode);
      return;
    }

    setCustomAnalysisLoading(true);
    transitionToView('visual-report' as ViewMode);

    try {
      if (!force && propertyData.zpid) {
        addLog('Cloud Cache', { type: 'request' }, { zpid: propertyData.zpid, task: 'visual_analysis' });
        const cached = await getVisualAnalysisFromCloud(propertyData.zpid);
        if (cached) {
          // Use config-driven cache pre-fetching
          if (APP_CONFIG.caching.image_quality) {
            const qualityCached = await getImageQualityAnalysisFromCloud(propertyData.zpid);
            if (qualityCached) cached.image_quality_analysis = qualityCached;
          }

          if (APP_CONFIG.caching.investment_research) {
            const investmentCached = await getInvestmentResearchFromCloud(propertyData.zpid);
            if (investmentCached) cached.investment_research = investmentCached;
          }



          addLog('Cloud Cache', { type: 'response' }, { status: 'Hit', data: cached });
          setCustomAnalysis(cached);
          setCustomAnalysisLoading(false);
          return;
        }
        addLog('Cloud Cache', { type: 'info' }, { status: 'Miss' });
      }

      addLog('Gemini AI', { type: 'request' }, { task: 'visual_analysis', forced: force });
      const res = await analyzePropertyImages(propertyData.images || [], propertyData);
      const result = res.data;

      if (propertyData.mapZoomOut) {
        const neighborRes = await analyzeNeighborhood(propertyData.mapZoomOut, propertyData);
        result.neighborhood = neighborRes.data;
        addLog('Gemini AI', { type: 'response' }, neighborRes.data, neighborRes.usage);
      }

      const pulseRes = await analyzeCommunityPulse(propertyData);
      result.community_pulse = pulseRes.data;
      addLog('Gemini AI', { type: 'response' }, pulseRes.data, pulseRes.usage);

      setCustomAnalysis(result);
      addLog('Gemini AI', { type: 'response' }, result, res.usage);
      if (propertyData.zpid) {
        const saveResult = await saveVisualAnalysisToCloud(propertyData.zpid, result);
        if (!saveResult.success) {
          addLog('System', { type: 'error' }, { message: "Cloud Cache Save Failed", task: 'visual_analysis', error: saveResult.error });
        }
      }
    } catch (err: any) {
      const logContent = err instanceof AiResponseError
        ? { message: err.message, raw: err.rawResponse, prompt: err.prompt }
        : err;
      addLog('Gemini AI', { type: 'error' }, logContent);
      setError("AI analysis failed. Check logs for details.");
    } finally {
      setCustomAnalysisLoading(false);
    }
  };

  const handleRunComprehensive = async (force = false) => {
    if (!propertyData || !customAnalysis) return;

    if (!force && comprehensiveAnalysis) {
      transitionToView('comprehensive-report' as ViewMode);
      return;
    }

    setComprehensiveLoading(true);
    transitionToView('comprehensive-report' as ViewMode);

    try {
      if (!force && propertyData.zpid) {
        addLog('Cloud Cache', { type: 'request' }, { zpid: propertyData.zpid, task: 'comprehensive_analysis' });
        const cached = await getComprehensiveAnalysisFromCloud(propertyData.zpid);
        if (cached) {
          addLog('Cloud Cache', { type: 'response' }, { status: 'Hit', data: cached });
          setComprehensiveAnalysis(cached);
          setComprehensiveLoading(false);
          return;
        }
        addLog('Cloud Cache', { type: 'info' }, { status: 'Miss' });
      }

      addLog('Gemini AI', { type: 'request' }, { task: 'comprehensive_analysis', forced: force });
      const res = await analyzeComprehensive(propertyData, customAnalysis);
      const result = res.data;
      setComprehensiveAnalysis(result);
      addLog('Gemini AI', { type: 'response' }, result, res.usage);
      if (propertyData.zpid) await saveComprehensiveAnalysisToCloud(propertyData.zpid, result);
    } catch (err: any) {
      const logContent = err instanceof AiResponseError
        ? { message: err.message, raw: err.rawResponse, prompt: err.prompt }
        : err;
      addLog('Gemini AI', { type: 'error' }, logContent);
      setError("Comprehensive report failed. Check logs for details.");
    } finally {
      setComprehensiveLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (auth) {
      try {
        await signOut(auth);
        setCurrentUser(null);
        setCloudHistory([]);
        setError(null);
      } catch (err) {
        console.error("Sign out failed", err);
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) {
      console.warn("Delete account aborted: No current user in state.");
      return;
    }

    const input = window.prompt("WARNING: All your data and saved analysis will be permanently deleted.\n\nType DELETE to confirm.");
    if (input !== 'DELETE') {
      if (input !== null) alert("Account deletion cancelled. You must type DELETE exactly.");
      return;
    }

    setLoading(true);
    setError(null);
    console.log("Starting account deletion for UID:", currentUser.uid);

    try {
      await deleteUserAccount(currentUser.uid);
      console.log("Account deletion completed successfully.");
      setCurrentUser(null);
      setCloudHistory([]);
    } catch (err: any) {
      console.error("Account deletion failed:", err);
      setError(err.message || "An unexpected error occurred during account deletion.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!currentUser || !propertyData || !propertyData.zpid) return;

    const currentZpid = String(propertyData.zpid);
    const wasFavorited = favorites.some(f => String(f.zpid) === currentZpid);

    // Optimistic Update
    setFavorites(prev => {
      if (wasFavorited) {
        return prev.filter(f => String(f.zpid) !== currentZpid);
      } else {
        return [{
          zpid: currentZpid,
          address: propertyData.address,
          price: propertyData.price || propertyData.zestimate || null,
          images: propertyData.images || [],
          timestamp: Date.now()
        }, ...prev];
      }
    });

    try {
      const res = await toggleFavorite(currentUser.uid, propertyData);
      if (!res.success) {
        // Rollback on failure
        const refreshed = await getUserFavorites(currentUser.uid);
        setFavorites(refreshed);
      }
    } catch (err) {
      const refreshed = await getUserFavorites(currentUser.uid);
      setFavorites(refreshed);
    }
  };
  const handleRemoveFavoriteItem = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    if (!currentUser || !item.zpid) return;

    // Optimistic Update
    setFavorites(prev => prev.filter(f => String(f.zpid) !== String(item.zpid)));

    try {
      const res = await toggleFavorite(currentUser.uid, item);
      if (!res.success) {
        const refreshed = await getUserFavorites(currentUser.uid);
        setFavorites(refreshed);
      }
    } catch (err) {
      const refreshed = await getUserFavorites(currentUser.uid);
      setFavorites(refreshed);
    }
  };

  const isFavorited = (propertyData?.zpid && favorites.length > 0)
    ? favorites.some(f => String(f.zpid) === String(propertyData.zpid))
    : false;

  /* ---------------------- Render Helpers ---------------------- */
  const searchBar = (
    <form onSubmit={(e) => { e.preventDefault(); performSearch(address); }} className="flex-1 relative z-50 w-full">
      <div className="relative group">
        <input
          type="text"
          value={address}
          onFocus={() => setShowHistory(true)}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter property address..."
          className="w-full pl-12 pr-44 py-3 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl outline-none shadow-inner focus:shadow-lg transition-all text-xs font-medium"
        />
        <i className="fa-solid fa-house-laptop absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {propertyData && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleFavorite(); }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isFavorited ? 'bg-rose-50 text-rose-500 shadow-inner' : 'bg-slate-200/50 text-slate-400 hover:text-rose-400 hover:bg-rose-50'}`}
              title={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
            >
              <i className={`${isFavorited ? 'fa-solid' : 'fa-regular'} fa-heart text-sm`}></i>
            </button>
          )}
          <button type="submit" disabled={loading} className="bg-indigo-700 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-200">Analyze</button>
        </div>
      </div>

      {showHistory && (searchHistory.length > 0 || cloudHistory.length > 0 || favorites.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[60]">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50/50 border-b border-slate-100">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Search History</span>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowHistory(false); }}
              className="w-6 h-6 rounded-lg hover:bg-white hover:shadow-sm text-slate-400 hover:text-slate-600 transition-all flex items-center justify-center"
            >
              <i className="fa-solid fa-xmark text-xs"></i>
            </button>
          </div>
          <div className="max-h-[300px] overflow-y-auto p-2">
            {favorites.length > 0 && (
              <div className="mb-2">
                <div className="px-3 py-2 text-[10px] font-black pointer-events-none select-none text-rose-500 uppercase tracking-widest flex items-center gap-2">
                  <i className="fa-solid fa-heart"></i>
                  Favorites
                </div>
                {favorites.map((item: any, idx) => (
                  <div key={`fav-wrapper-${idx}`} className="group relative">
                    <button
                      onClick={() => handleHistoryItemClick(item.address)}
                      className="w-full text-left px-4 py-3 rounded-xl hover:bg-rose-50/50 text-slate-700 text-sm font-medium transition-colors flex items-center justify-between"
                    >
                      <span className="truncate pr-8">{item.address}</span>
                      <i className="fa-solid fa-heart text-rose-500 text-xs"></i>
                    </button>
                    <button
                      onClick={(e) => handleRemoveFavoriteItem(e, item)}
                      className="absolute right-10 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                      title="Remove from favorites"
                    >
                      <i className="fa-solid fa-trash-can text-xs"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searchHistory.length > 0 && (
              <div className="mb-2">
                <div className="px-3 py-2 text-[10px] font-black pointer-events-none select-none text-indigo-400 uppercase tracking-widest flex items-center gap-2 border-t border-gray-100 mt-2 pt-4 first:border-t-0 first:mt-0 first:pt-2">
                  <i className="fa-solid fa-clock-rotate-left"></i>
                  Recent Searches
                </div>
                {searchHistory.map((item, idx) => (
                  <button
                    key={`local-${idx}`}
                    onClick={() => handleHistoryItemClick(item.address)}
                    className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors flex items-center justify-between group"
                  >
                    <span className="truncate">{item.address}</span>
                    <i className="fa-solid fa-arrow-right -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all text-indigo-500 text-xs"></i>
                  </button>
                ))}
              </div>
            )}

            {cloudHistory.length > 0 && (
              <div>
                <div className="px-3 py-2 text-[10px] font-black pointer-events-none select-none text-indigo-400 uppercase tracking-widest flex items-center gap-2 border-t border-gray-100 mt-2 pt-4">
                  <i className="fa-solid fa-cloud"></i>
                  Saved History
                </div>
                {cloudHistory.map((item: any, idx) => (
                  <button
                    key={`cloud-${idx}`}
                    onClick={() => handleHistoryItemClick(item.address)}
                    className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors flex items-center justify-between group"
                  >
                    <span className="truncate">{item.address}</span>
                    <i className="fa-solid fa-cloud-arrow-down -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all text-indigo-500 text-xs"></i>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </form>
  );

  const exploreTab = (
    <ExploreTab
      propertyData={propertyData}
      loading={loading}
      loadingSublabel={loadingSublabel}
      viewMode={(viewMode === 'dashboard' || viewMode === 'guides' || viewMode === 'explore') ? 'main' : viewMode} // Fallback just in case
      setViewMode={transitionToView as any}
      imagesLoading={imagesLoading}
      isFavorited={isFavorited}
      onToggleFavorite={handleToggleFavorite}
      onRunCustomAnalysis={handleRunCustomAnalysis}
      customAnalysis={customAnalysis}
      customAnalysisLoading={customAnalysisLoading}
      onRunComprehensive={handleRunComprehensive}
      comprehensiveAnalysis={comprehensiveAnalysis}
      comprehensiveLoading={comprehensiveLoading}
      onUpdateAnalysis={async (updated) => {
        setCustomAnalysis(updated);
        if (propertyData?.zpid) {
          await saveVisualAnalysisToCloud(propertyData.zpid, updated);
        }
      }}
      addLog={addLog}
      logs={logs}
      userRole={currentUser?.role}
      searchBar={searchBar}
    />
  );

  /* ------------------- Render Logic ------------------- */

  if (viewMode === 'legal-disclaimer') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="flex-1"><LegalDisclaimer /></div>
        <Footer onNavigate={transitionToView} />
      </div>
    );
  }

  if (viewMode === 'terms') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="flex-1"><TermsView /></div>
        <Footer onNavigate={transitionToView} />
      </div>
    );
  }

  if (viewMode === 'privacy') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="flex-1"><PrivacyPolicy /></div>
        <Footer onNavigate={transitionToView} />
      </div>
    );
  }

  // REALTOR LAYOUT: Merged ClientHub + Homepage
  if (currentUser?.role === 'realtor') {
    return (
      <div className="min-h-screen bg-slate-50">
        {showPreload && <PreloadManager onClose={() => setShowPreload(false)} initialAddress={address} />}
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} inviteData={inviteData} />
        {currentUser && (
          <AddClientModal
            isOpen={addClientModalOpen}
            onClose={() => setAddClientModalOpen(false)}
            realtorName={currentUser.displayName}
            realtorId={currentUser.uid}
          />
        )}

        <ClientHub
          realtorId={currentUser.uid}
          realtorName={currentUser.displayName}
          onSignOut={handleSignOut}
          onBack={() => transitionToView('main')} // This might be redundant now
          exploreContent={exploreTab}
          initialTab={(viewMode === 'main' || viewMode === 'visual-report' || viewMode === 'comprehensive-report' ? 'explore' : viewMode) as any}
          onNavigate={transitionToView}
          onUpdateProfile={(updates) => {
            setCurrentUser(prev => {
              if (!prev) return null;
              const next = { ...prev, ...updates };
              if (updates.realtor && prev.realtor) {
                next.realtor = { ...prev.realtor, ...updates.realtor };
              }
              return next;
            });
          }}
        />

        {/* Chat Interface needs to be rendered at top level if it's fixed? 
            Actually ClientHub is z-100. ChatInterface is usually z-50.
            Need to ensure ChatInterface works. It is fixed bottom right. 
            If ClientHub is fixed inset-0, ChatInterface might be hidden if z-index is lower. 
            Let's check ChatInterface z-index. Usually z-[60] or z-50.
            ClientHub is z-[100]. ChatInterface will be behind it.
            ExploreTab renders ChatInterface! So it will be INSIDE ClientHub content area.
            That area is 'flex-1 overflow-y-auto'.
            Fixed position inside a transformed/flex container can behave weirdly.
            But ClientHub main content is just a div.
            Actually, let's keep ChatInterface in ExploreTab (Line 869 of original App.tsx was OUTSIDE main).
            Wait, ExploreTab renders ChatInterface internally now.
            If ChatInterface uses 'fixed bottom-4', it will be relative to the viewport.
            But ClientHub is on top.
            If ChatInterface is rendered INSIDE ExploreTab, and ExploreTab is inside ClientHub,
            it should appear on top of ClientHub's white background.
            We should double check z-index of ChatInterface in the file if possible, or just trust ExploreTab.
        */}
      </div>
    );
  }

  // STANDARD LAYOUT (Non-Realtor / Guest)
  return (
    <div className={`${viewMode === 'guides' ? 'h-screen' : 'min-h-screen'} bg-slate-50 flex flex-col`}>
      {showPreload && <PreloadManager onClose={() => setShowPreload(false)} initialAddress={address} />}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} inviteData={inviteData} />

      {/* Top Bar (Visible if not in guides mode OR if user is signed in) */}
      {((viewMode !== 'guides' && window.location.pathname !== '/') || currentUser) && (
        <div className="py-4 px-4 bg-slate-900 text-white border-b border-white/5 relative z-[60]">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em]">
            <div className="flex items-center gap-3">
              {currentUser ? (
                <>
                  <span className="opacity-40">Intelligence Access:</span>
                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-[8px] border border-indigo-500/30">PRO</span>
                  <span className="hidden sm:inline opacity-20">|</span>
                  <span className="hidden sm:inline opacity-40">
                    {realtorName ? `Client of ${realtorName}` : `${currentUser.role} Account`}
                  </span>
                </>
              ) : (
                <span className="text-slate-500"></span>
              )}
            </div>

            <div className="flex items-center gap-6">
              <button
                onClick={() => transitionToView(viewMode === 'guides' ? 'main' : 'guides')}
                className="text-white/60 hover:text-white transition-colors flex items-center gap-2"
              >
                <i className={`fa-solid ${viewMode === 'guides' ? 'fa-house' : 'fa-book-open'} text-[10px]`}></i>
                {viewMode === 'guides' ? 'BACK TO EXPLORE' : 'LEARN'}
              </button>
              {currentUser && (
                <>
                  <div className="h-4 w-px bg-white/10 hidden sm:block"></div>
                  <div className="flex items-center gap-4">
                    <span className="text-indigo-400 tracking-[0.3em] font-black uppercase text-[10px]">{currentUser.displayName}</span>
                    <button onClick={handleSignOut} className="text-white hover:text-rose-400 transition-colors">SIGN OUT</button>
                    <button onClick={() => handleDeleteAccount()} className="text-slate-500 hover:text-rose-500 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode !== 'guides' && (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50 py-3 shadow-sm backdrop-blur-md bg-white/90">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <Logo size={80} className="scale-75 md:scale-90 origin-left" onClick={() => transitionToView('main')} />

            </div>
          </div>
        </header>
      )}

      <main className={`flex-1 w-full ${viewMode === 'guides' ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 overflow-y-auto'}`}>
        {error && <div className="bg-rose-50 border border-rose-100 text-rose-700 p-4 rounded-2xl mb-8">{error}</div>}

        {viewMode === 'realtor-landing' ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="relative">
              <div className="absolute -inset-4 bg-indigo-500/20 blur-xl rounded-full"></div>
              <Logo size={96} className="relative drop-shadow-xl" />
            </div>
            <div className="max-w-md space-y-4">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Realtor Access</h1>
              <p className="text-slate-500 font-medium leading-relaxed text-lg">
                Sign in to access your professional dashboard, manage leads, and generate intelligent property reports.
              </p>
            </div>
            <div className="flex flex-col items-center gap-6">
              <button
                onClick={() => setAuthModalOpen(true)}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 text-lg"
              >
                <span>Sign In to Zyphe</span>
                <i className="fa-solid fa-arrow-right"></i>
              </button>

              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <button
                  onClick={() => {
                    alert("Please sign in first to reset your specific account data. You can also find these options in 'Data Fields' once logged in.");
                  }}
                  className="hover:text-rose-500 transition-colors"
                >
                  <i className="fa-solid fa-trash-can mr-2"></i>
                  Reset Data
                </button>
                <span className="opacity-20 text-slate-300">|</span>
                <button
                  onClick={() => {
                    alert("Please sign in first to seed your specific account data. You can also find these options in 'Data Fields' once logged in.");
                  }}
                  className="hover:text-indigo-600 transition-colors"
                >
                  <i className="fa-solid fa-database mr-2"></i>
                  Add Mock Data
                </button>
              </div>
            </div>
          </div>
        ) : (viewMode === 'guides' || !currentUser ? (
          <div className="bg-white shadow-2xl overflow-hidden flex-1 min-h-0 flex flex-col animate-in fade-in duration-500">

            <GuidesTab onNavigate={transitionToView} />
          </div>
        ) : exploreTab)}

        <Footer onNavigate={transitionToView} />
      </main>
    </div>
  );
};

export default App;
