
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
  logUserActivity,
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
import SystemLogs from './components/SystemLogs';
import PreloadManager from './components/PreloadManager';
import ChatInterface from './components/ChatInterface';
import Logo from './components/Logo';
import AuthModal from './components/AuthModal';
import AddClientModal from './components/AddClientModal';
import ClientHub from './components/ClientHub';

type ViewMode = 'main' | 'visual-report' | 'comprehensive-report' | 'dashboard';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [addClientModalOpen, setAddClientModalOpen] = useState(false);
  const [inviteData, setInviteData] = useState<{
    email: string, name: string, role: any, realtorId: string, realtorName: string
  } | null>(null);
  const [cloudHistory, setCloudHistory] = useState<any[]>([]);

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

  const addLog = (service: string, { type }: any, content: any) => {
    setLogs(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), service, type, content }]);
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

    logUserActivity(sessionId, searchAddress);

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
      setViewMode('visual-report');
      return;
    }

    setCustomAnalysisLoading(true);
    setViewMode('visual-report');

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
      const result = await analyzePropertyImages(propertyData.images || [], propertyData);

      if (propertyData.mapZoomOut) {
        const neighborhood = await analyzeNeighborhood(propertyData.mapZoomOut, propertyData);
        result.neighborhood = neighborhood;
      }

      const pulse = await analyzeCommunityPulse(propertyData);
      result.community_pulse = pulse;

      setCustomAnalysis(result);
      addLog('Gemini AI', { type: 'response' }, result);
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
      setViewMode('comprehensive-report');
      return;
    }

    setComprehensiveLoading(true);
    setViewMode('comprehensive-report');

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
      const result = await analyzeComprehensive(propertyData, customAnalysis);
      setComprehensiveAnalysis(result);
      addLog('Gemini AI', { type: 'response' }, result);
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
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

      {currentUser && (
        <div className={`py-4 px-4 shadow-inner border-b border-white/5 relative z-[60] transition-all duration-500 ${currentUser.role === 'realtor'
          ? 'bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white border-indigo-500/20'
          : 'bg-slate-900 text-white'
          }`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em]">
            <div className="flex items-center gap-3">
              {currentUser.role === 'realtor' ? (
                <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-amber-400/90 to-amber-600/90 rounded-full text-slate-900 text-[8px] shadow-lg shadow-amber-900/20">
                  <i className="fa-solid fa-crown text-[10px]"></i>
                  <span>Professional Realtor Mode</span>
                </div>
              ) : (
                <>
                  <span className="opacity-40">Intelligence Access:</span>
                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-[8px] border border-indigo-500/30">PRO</span>
                  <span className="hidden sm:inline opacity-20">|</span>
                  <span className="hidden sm:inline opacity-40">{currentUser.role} Account</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-6">
              {currentUser.role === 'realtor' && (
                <>
                  <button
                    onClick={() => setAddClientModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-500/20 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-500/30 transition-all border border-indigo-400/30"
                  >
                    <i className="fa-solid fa-user-plus text-xs"></i>
                    Add Client
                  </button>
                  <button
                    onClick={() => setViewMode('dashboard')}
                    className="flex items-center gap-2 bg-indigo-500/20 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-500/30 transition-all border border-indigo-400/30"
                  >
                    <i className="fa-solid fa-chart-line text-xs"></i>
                    Client Hub
                  </button>
                </>
              )}

              <div className="h-4 w-px bg-white/10 hidden sm:block"></div>

              <div className="relative" ref={settingsRef}>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end">
                    <span className={`${currentUser.role === 'realtor' ? 'text-indigo-300' : 'text-indigo-400'} tracking-[0.3em] font-black uppercase text-[10px]`}>
                      {currentUser.displayName}
                    </span>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 text-[10px] font-black text-white transition-colors tracking-widest mt-0.5 group/signout cursor-pointer"
                    >
                      <i className="fa-solid fa-right-from-bracket text-[11px] group-hover/signout:-translate-x-0.5 transition-transform text-white"></i>
                      SIGN OUT
                    </button>
                  </div>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${showSettings ? 'bg-white/10 text-white' : 'text-white hover:bg-white/5 shadow-inner'}`}
                    title="Account Settings"
                  >
                    <i className={`fa-solid fa-gear text-lg transition-transform duration-700 ${showSettings ? 'rotate-180' : ''}`}></i>
                  </button>
                </div>

                {showSettings && (
                  <div className="absolute top-full right-0 mt-3 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-2xl py-2 z-[70] animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={() => {
                        setShowSettings(false);
                        handleDeleteAccount();
                      }}
                      className="w-full text-left px-4 py-2 text-rose-500 hover:bg-rose-500/10 transition-colors flex items-center gap-2"
                    >
                      <i className="fa-solid fa-trash-can text-[10px]"></i>
                      <span>Delete Account</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )
      }

      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 py-3 shadow-sm backdrop-blur-md bg-white/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <Logo size={100} className="scale-75 md:scale-90 origin-left" onClick={() => setViewMode('main')} />
            <div className="flex-1 max-w-3xl relative" ref={historyRef}>
              <div className="flex items-center gap-4">
                <form onSubmit={(e) => { e.preventDefault(); performSearch(address); }} className="flex-1 relative z-50">
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
                    <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
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
                {!currentUser ? (
                  <button onClick={() => setAuthModalOpen(true)} className="flex items-center gap-2 bg-white border border-slate-200 px-6 py-3 rounded-2xl text-xs font-black uppercase text-slate-700 hover:bg-slate-50 transition-colors shadow-sm whitespace-nowrap">
                    <i className="fa-solid fa-user-circle text-lg text-indigo-600"></i>
                    <span>Sign In</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowHistory(true)}
                      className="flex items-center gap-2 bg-white border border-slate-200 px-6 py-3 rounded-2xl text-[10px] font-black uppercase text-slate-700 hover:bg-slate-50 transition-colors shadow-sm whitespace-nowrap"
                    >
                      <i className="fa-solid fa-heart text-rose-500"></i>
                      <span>Favorites ({favorites.length})</span>
                    </button>
                    {isFavorited && (
                      <button
                        onClick={(e) => { e.preventDefault(); handleToggleFavorite(); }}
                        className="flex items-center gap-2 bg-rose-50 border border-rose-100 px-4 py-3 rounded-2xl text-[10px] font-black uppercase text-rose-500 hover:bg-rose-100 transition-all shadow-sm shadow-rose-100 animate-in fade-in slide-in-from-right-2"
                        title="Remove from favorites"
                      >
                        <i className="fa-solid fa-trash-can text-xs"></i>
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-10">
        {error && <div className="bg-rose-50 border border-rose-100 text-rose-700 p-4 rounded-2xl mb-8">{error}</div>}

        {viewMode === 'dashboard' ? (
          currentUser?.role === 'realtor' ? (
            <ClientHub
              realtorId={currentUser.uid}
              realtorName={currentUser.displayName}
              onSignOut={async () => {
                await signOut(auth);
                setViewMode('main');
              }}
              onBack={() => setViewMode('main')}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400">
              <i className="fa-solid fa-lock text-6xl mb-6 text-slate-200"></i>
              <h2 className="text-2xl font-black text-slate-900">Restricted Access</h2>
              <p className="text-sm font-medium mt-2">The Client Hub is reserved for Realtor Pro accounts only.</p>
              <button onClick={() => setViewMode('main')} className="mt-8 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-200">Return to Search</button>
            </div>
          )
        ) : loading && !propertyData ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <Logo size={220} className="animate-pulse" />
            <h2 className="text-2xl font-black text-slate-900 mt-10">Analyzing Property DNA...</h2>
            <p className="text-sm font-black text-indigo-600 mt-4 uppercase tracking-[0.2em]">{loadingSublabel}</p>
          </div>
        ) : viewMode === 'main' ? (
          propertyData ? (
            <div className="space-y-10">
              <PropertyHeader
                data={propertyData}
                isFavorited={isFavorited}
                onToggleFavorite={handleToggleFavorite}
                onRunAnalysis={() => handleRunCustomAnalysis(false)}
              />
              <PropertyImages images={propertyData.images} loading={imagesLoading} />
              <PropertyFacts facts={propertyData.resoFacts} />
              <MobilityScores data={propertyData} />
              <SchoolScores data={propertyData} />
              <ClimateRiskSection data={propertyData} />
              <PropertyMaps mapZoomIn={propertyData.mapZoomIn} mapZoomOut={propertyData.mapZoomOut} />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto py-6 text-center space-y-12">
              <p className="text-2xl text-slate-500 font-medium leading-relaxed">The world's most advanced property analysis suite.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                {[
                  { title: 'For Buyers', icon: 'fa-shopping-bag', color: 'indigo', desc: "Navigate the market with unmatched clarity. Our AI cross-references public records, maps and property pictures, and resident sentiment to uncover hidden structural risks, neighborhood, community pulse on what people like and don't, and score lifestyle compatibility for your family." },
                  { title: 'For Sellers', icon: 'fa-money-bill-trend-up', color: 'slate', desc: 'Discover how to maximize your home value with AI-driven staging and market insights.' },
                  { title: 'For Realtors', icon: 'fa-briefcase', color: 'indigo', desc: 'Provide comprehensive home report, concierge chat box to your clients and track their preferences. Generate professional multi-source reports and compelling marketing copy in seconds.' }
                ].map((item, i) => (
                  <div key={i} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 hover:-translate-y-2 transition-all group">
                    <div className={`w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                      <i className={`fa-solid ${item.icon} text-2xl`}></i>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-4">{item.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed font-medium">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : viewMode === 'visual-report' ? (
          <CustomAIAnalysis
            analysis={customAnalysis}
            loading={customAnalysisLoading}
            onBack={() => setViewMode('main')}
            onRefresh={() => handleRunCustomAnalysis(true)}
            onRunComprehensive={() => handleRunComprehensive(false)}
            comprehensiveResult={comprehensiveAnalysis}
            hasImages={(propertyData?.images?.length || 0) > 0}
            userRole={currentUser?.role}
            propertyImages={propertyData?.images}
            zpid={propertyData?.zpid}
            propertyData={propertyData}
            onUpdateAnalysis={async (updated) => {
              setCustomAnalysis(updated);
              if (propertyData?.zpid) {
                const res = await saveVisualAnalysisToCloud(propertyData.zpid, updated);
                if (!res.success) {
                  addLog('System', { type: 'error' }, { message: "Cloud Cache Save Failed", task: 'visual_analysis', error: res.error });
                }
              }
            }}
            addLog={addLog}
            isFavorited={isFavorited}
            onToggleFavorite={handleToggleFavorite}
          />
        ) : (
          <ComprehensiveAnalysis
            analysis={comprehensiveAnalysis}
            loading={comprehensiveLoading}
            onBack={() => setViewMode('visual-report')}
            isFavorited={isFavorited}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
        {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
          <SystemLogs logs={logs} />
        )}
      </main>
      {propertyData && <ChatInterface property={propertyData} visual={customAnalysis} comprehensive={comprehensiveAnalysis} />}
    </div >
  );
};

export default App;
