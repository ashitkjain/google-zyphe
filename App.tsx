
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  PropertyData, 
  CustomAIAnalysisResult, 
  ComprehensiveAnalysisResult, 
  LogEntry,
  UserProfile
} from './types.ts';
import { normalizeAddress, fetchPropertyDataFull } from './services/apiService.ts';
import { analyzePropertyImages, analyzeNeighborhood, analyzeCommunityPulse, analyzeComprehensive, AiResponseError } from './services/geminiService.ts';
import { 
  logUserActivity, 
  saveVisualAnalysisToCloud,
  saveComprehensiveAnalysisToCloud,
  auth,
  getUserProfile,
  trackUserPropertyView,
  getUserViewHistory,
  getVisualAnalysisFromCloud,
  getComprehensiveAnalysisFromCloud,
  deleteUserAccount
} from './services/firebaseService.ts';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import PropertyHeader from './components/PropertyHeader.tsx';
import PropertyFacts from './components/PropertyFacts.tsx';
import CustomAIAnalysis from './components/CustomAIAnalysis.tsx';
import ComprehensiveAnalysis from './components/ComprehensiveAnalysis.tsx';
import PropertyImages from './components/PropertyImages.tsx';
import PropertyMaps from './components/PropertyMaps.tsx';
import ClimateRiskSection from './components/ClimateRiskSection.tsx';
import MobilityScores from './components/MobilityScores.tsx';
import SchoolScores from './components/SchoolScores.tsx';
import SystemLogs from './components/SystemLogs.tsx';
import PreloadManager from './components/PreloadManager.tsx';
import ChatInterface from './components/ChatInterface.tsx';
import Logo from './components/Logo.tsx';
import AuthModal from './components/AuthModal.tsx';

type ViewMode = 'main' | 'visual-report' | 'comprehensive-report';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [cloudHistory, setCloudHistory] = useState<any[]>([]);
  
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

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
  const historyRef = useRef<HTMLDivElement>(null);

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
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        let profile = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        // Use a more relaxed attempt loop for user profiles to handle initialization lags
        while (attempts < maxAttempts) {
          try {
            profile = await getUserProfile(user.uid);
            if (profile) break;
          } catch (e: any) {
            // Silently retry permission issues on initial load to handle Firebase rule propagation
            if (e.code === 'permission-denied') {
              console.warn("Initial permission sync attempt failed, retrying...");
            }
          }
          attempts++;
          if (attempts < maxAttempts) await new Promise(resolve => setTimeout(resolve, 500 * attempts));
        }

        if (profile) {
          setCurrentUser(profile);
          try {
            const history = await getUserViewHistory(user.uid);
            setCloudHistory(history);
          } catch (e) {
             console.warn("Could not retrieve cloud history:", e);
          }
        } else {
          // If no profile found after attempts, create a temporary guest session for the UI
          setCurrentUser({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Guest User',
            role: 'buyer',
            createdAt: new Date()
          });
        }
      } else {
        setCurrentUser(null);
        setCloudHistory([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [viewMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addLog = (service: string, {type}: any, content: any) => {
    setLogs(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), service, type, content }]);
  };

  const addToHistory = (newAddress: string) => {
    setSearchHistory(prev => {
      const filtered = prev.filter(item => item.toLowerCase() !== newAddress.toLowerCase());
      return [newAddress, ...filtered].slice(0, 10);
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
        addLog('Radar Geocode API', {type: 'request'}, { address: searchAddress });
        const radarResult = await normalizeAddress(searchAddress);
        addLog('Radar Geocode API', {type: 'response'}, radarResult);
        finalAddress = radarResult.formattedAddress;
        coords = radarResult.coordinates;
        mapIn = radarResult.mapZoomIn;
        mapOut = radarResult.mapZoomOut;
        addToHistory(finalAddress);
        setAddress(finalAddress);
      } else {
        setLoadingSublabel(`Direct ZPID Search: ${searchAddress}`);
      }

      addLog('Zyphe Data Layer', {type: 'request'}, { target: finalAddress, isZpid });
      
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
      
      addLog('Zyphe Data Layer', {type: 'response'}, mergedData);
      
      setPropertyData(mergedData);
      setLoading(false);
      setImagesLoading(false);

      if (currentUser && mergedData.zpid) {
        trackUserPropertyView(currentUser.uid, mergedData);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during property retrieval.');
      addLog('System', {type: 'error'}, err);
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
        addLog('Cloud Cache', {type: 'request'}, { zpid: propertyData.zpid, task: 'visual_analysis' });
        const cached = await getVisualAnalysisFromCloud(propertyData.zpid);
        if (cached) {
          addLog('Cloud Cache', {type: 'response'}, { status: 'Hit', data: cached });
          setCustomAnalysis(cached);
          setCustomAnalysisLoading(false);
          return;
        }
        addLog('Cloud Cache', {type: 'info'}, { status: 'Miss' });
      }

      addLog('Gemini AI', {type: 'request'}, { task: 'visual_analysis', forced: force });
      const result = await analyzePropertyImages(propertyData.images || [], propertyData);
      
      if (propertyData.mapZoomOut) {
        const neighborhood = await analyzeNeighborhood(propertyData.mapZoomOut, propertyData);
        result.neighborhood = neighborhood;
      }
      
      const pulse = await analyzeCommunityPulse(propertyData);
      result.community_pulse = pulse;
      
      setCustomAnalysis(result);
      addLog('Gemini AI', {type: 'response'}, result);
      if (propertyData.zpid) await saveVisualAnalysisToCloud(propertyData.zpid, result);
    } catch (err: any) {
      const logContent = err instanceof AiResponseError ? { message: err.message, raw: err.rawResponse } : err;
      addLog('Gemini AI', {type: 'error'}, logContent);
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
        addLog('Cloud Cache', {type: 'request'}, { zpid: propertyData.zpid, task: 'comprehensive_analysis' });
        const cached = await getComprehensiveAnalysisFromCloud(propertyData.zpid);
        if (cached) {
          addLog('Cloud Cache', {type: 'response'}, { status: 'Hit', data: cached });
          setComprehensiveAnalysis(cached);
          setComprehensiveLoading(false);
          return;
        }
        addLog('Cloud Cache', {type: 'info'}, { status: 'Miss' });
      }

      addLog('Gemini AI', {type: 'request'}, { task: 'comprehensive_analysis', forced: force });
      const result = await analyzeComprehensive(propertyData, customAnalysis);
      setComprehensiveAnalysis(result);
      addLog('Gemini AI', {type: 'response'}, result);
      if (propertyData.zpid) await saveComprehensiveAnalysisToCloud(propertyData.zpid, result);
    } catch (err: any) {
      const logContent = err instanceof AiResponseError ? { message: err.message, raw: err.rawResponse } : err;
      addLog('Gemini AI', {type: 'error'}, logContent);
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
    if (!currentUser) return;
    const confirm = window.confirm("WARNING: Are you absolutely sure? This will permanently delete your account, saved preferences, and viewing history. This action cannot be undone.");
    if (!confirm) return;

    setLoading(true);
    setLoadingSublabel("Safely purging account data...");
    try {
      await deleteUserAccount(currentUser.uid);
      setCurrentUser(null);
      setCloudHistory([]);
      setError("Your account has been permanently deleted.");
    } catch (err: any) {
      setError(err.message || "Failed to delete account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {showPreload && <PreloadManager onClose={() => setShowPreload(false)} initialAddress={address} />}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      
      {currentUser && (
        <div className="bg-slate-900 text-white py-2 px-4 shadow-inner border-b border-white/5 relative z-[60]">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em]">
            <div className="flex items-center gap-3">
              <span className="opacity-40">Intelligence Access:</span>
              <span className="text-indigo-400">{currentUser.displayName}</span>
              <span className="hidden sm:inline opacity-20">|</span>
              <span className="hidden sm:inline opacity-40">{currentUser.role} Account</span>
            </div>
            <div className="flex items-center gap-6">
              <button 
                onClick={handleDeleteAccount}
                className="text-rose-600 hover:text-rose-400 transition-colors flex items-center gap-2 group border-r border-white/10 pr-6"
              >
                Delete Account
              </button>
              <button 
                onClick={handleSignOut}
                className="text-white/60 hover:text-white transition-colors flex items-center gap-2 group"
              >
                Sign Out <i className="fa-solid fa-arrow-right-from-bracket group-hover:translate-x-1 transition-transform"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 py-3 shadow-sm backdrop-blur-md bg-white/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center cursor-pointer scale-75 md:scale-90 origin-left" onClick={() => setViewMode('main')}>
              <Logo size={120} className="hover:ring-4 ring-indigo-50 transition-all" />
            </div>

            <div className="flex-1 max-w-2xl relative" ref={historyRef}>
              <form onSubmit={(e) => { e.preventDefault(); performSearch(address); }}>
                <div className="relative group">
                  <input
                    type="text"
                    value={address}
                    onFocus={() => setShowHistory(true)}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter property address..."
                    className="w-full pl-12 pr-4 py-3 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 rounded-2xl transition-all outline-none text-base font-medium shadow-inner"
                  />
                  <i className="fa-solid fa-house-laptop absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 text-lg"></i>
                  <button type="submit" disabled={loading} className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-indigo-700 to-gray-900 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.05] active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-indigo-200">
                    {loading ? 'Thinking...' : 'Analyze'}
                  </button>
                </div>
              </form>
              {showHistory && searchHistory.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Searches (Session)</span>
                    <button onClick={() => setSearchHistory([])} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800">Clear</button>
                  </div>
                  {searchHistory.map((item, idx) => (
                    <button key={idx} onClick={() => handleHistoryItemClick(item)} className="w-full px-5 py-3.5 text-left flex items-center gap-4 hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0">
                      <i className="fa-solid fa-clock-rotate-left text-slate-300"></i>
                      <span className="text-sm font-medium text-slate-700 truncate">{item}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <button onClick={() => setShowPreload(true)} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg active:scale-95 flex items-center gap-2">
                <i className="fa-solid fa-bolt"></i>
                Pipeline
              </button>

              {currentUser ? (
                <div className="flex items-center gap-3 pl-3 border-l border-slate-100">
                  <div className="flex flex-col items-end">
                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight leading-none">{currentUser.displayName}</span>
                    <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-[0.1em] mt-1">{currentUser.role}</span>
                  </div>
                  <div className="h-10 w-px bg-slate-100 mx-1"></div>
                  <button 
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-100 rounded-xl transition-all group"
                    title="Sign Out"
                  >
                    <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Logout</span>
                    <i className="fa-solid fa-power-off text-xs group-hover:rotate-12 transition-transform"></i>
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setAuthModalOpen(true)}
                  className="px-6 py-2.5 bg-white border-2 border-slate-100 hover:border-indigo-600 text-slate-700 hover:text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-10">
        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-700 p-4 rounded-2xl mb-8 flex items-center gap-4 animate-in slide-in-from-top-4">
            <i className="fa-solid fa-circle-exclamation text-xl"></i>
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        {loading && !propertyData ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <div className="relative mb-10">
               <Logo size={220} className="animate-pulse" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Analyzing Property DNA...</h2>
            <div className="mb-6 flex flex-col items-center gap-2">
              <span className="px-5 py-2 bg-indigo-50 border border-indigo-100 rounded-full text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-3 shadow-sm">
                <i className="fa-solid fa-stopwatch animate-pulse"></i>
                Analysis Active: <span className="font-mono text-xs">{loadingTimer}s</span>
              </span>
            </div>
            <p className="text-sm font-black text-indigo-600 animate-pulse uppercase tracking-[0.2em]">{loadingSublabel}</p>
          </div>
        ) : viewMode === 'main' ? (
          propertyData ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50">
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-4">
                   <div className="flex-1">
                     <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight flex items-center gap-4">
                       {propertyData.address}
                       <button 
                         onClick={() => performSearch(propertyData.zpid || propertyData.address, true)}
                         className="p-2 text-slate-400 hover:text-indigo-600 transition-colors bg-slate-50 rounded-xl hover:bg-indigo-50 border border-transparent hover:border-indigo-100 active:scale-90"
                         title="Refresh All Data"
                       >
                         <i className={`fa-solid fa-rotate ${loading ? 'animate-spin' : ''}`}></i>
                       </button>
                     </h2>
                     <p className="text-slate-500 font-medium flex items-center gap-2">
                       <i className="fa-solid fa-location-dot text-indigo-500"></i>
                       {propertyData.homeType?.replace(/_/g, ' ')} • Built in {propertyData.yearBuilt}
                     </p>
                   </div>
                </div>
                <button 
                  onClick={() => handleRunCustomAnalysis(false)} 
                  className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-indigo-700 to-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 hover:scale-[1.05] active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <i className="fa-solid fa-eye"></i>
                  View Visual AI Analysis
                </button>
              </div>

              <PropertyImages images={propertyData.images} loading={imagesLoading} homeStatus={propertyData.homeStatus} />
              <PropertyHeader data={propertyData} />
              <PropertyFacts facts={propertyData.resoFacts} />
              <MobilityScores data={propertyData} />
              <SchoolScores data={propertyData} />
              <ClimateRiskSection data={propertyData} />
              <PropertyMaps mapZoomIn={propertyData.mapZoomIn} mapZoomOut={propertyData.mapZoomOut} />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto py-6">
              <div className="text-center space-y-4 mb-12 flex flex-col items-center">
                <p className="text-2xl text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">
                  The world's most advanced property analysis suite. Instant fresh deep-dives into property value, neighborhood pulse, and structural visual intelligence.
                </p>
              </div>

              {currentUser && cloudHistory.length > 0 && (
                <div className="mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="flex items-center justify-between mb-6 px-2">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Recently Viewed Intelligence</h3>
                    <div className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-200"></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cloudHistory.map((item, i) => (
                      <button 
                        key={i} 
                        onClick={() => performSearch(item.zpid || item.address)}
                        className="p-5 bg-white border border-slate-100 rounded-3xl text-left hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-100 transition-all group"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                            <i className="fa-solid fa-house-circle-check text-xs"></i>
                          </div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.homeType?.replace(/_/g, ' ') || 'Property'}</span>
                        </div>
                        <h4 className="text-sm font-black text-slate-900 mb-1 truncate">{item.address}</h4>
                        <p className="text-indigo-600 font-black text-[10px] uppercase tracking-wider">
                          {item.price ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(item.price) : 'Value Analyzed'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
            onUpdateAnalysis={(updated) => setCustomAnalysis(updated)}
          />
        ) : (
          <ComprehensiveAnalysis 
            analysis={comprehensiveAnalysis} 
            loading={comprehensiveLoading} 
            onBack={() => setViewMode('visual-report')} 
            address={propertyData?.address} 
          />
        )}
        <SystemLogs logs={logs} />
      </main>

      <footer className="bg-slate-900 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
          <Logo size={120} className="mb-6 brightness-0 invert opacity-60 hover:opacity-100 transition-opacity" />
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mb-6">Intelligence Suite • 2025</p>
          <div className="flex gap-12 text-slate-400 text-xs font-bold">
            <a href="#" className="hover:text-indigo-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-indigo-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-indigo-400 transition-colors">Enterprise API</a>
          </div>
        </div>
      </footer>

      {propertyData && (
        <ChatInterface 
          property={propertyData} 
          visual={customAnalysis} 
          comprehensive={comprehensiveAnalysis} 
        />
      )}
    </div>
  );
};

export default App;
