import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PropertyData, CustomAIAnalysisResult, ComprehensiveAnalysisResult, LogEntry } from './types';
import { normalizeAddress, fetchPropertyData, fetchPropertyImages } from './services/apiService';
import { analyzePropertyImages, analyzeNeighborhood, analyzeCommunityPulse, analyzeComprehensive, AiResponseError } from './services/geminiService';
import { 
  logUserActivity, 
  savePropertyToCloud, 
  saveVisualAnalysisToCloud,
  saveComprehensiveAnalysisToCloud,
  getVisualAnalysisFromCloud,
  getComprehensiveAnalysisFromCloud
} from './services/firebaseService';
import PropertyHeader from './components/PropertyHeader';
import TablesSection from './components/TablesSection';
import PropertyFacts from './components/PropertyFacts';
import CustomAIAnalysis from './components/CustomAIAnalysis';
import ComprehensiveAnalysis from './components/ComprehensiveAnalysis';
import PropertyImages from './components/PropertyImages';
import PropertyMaps from './components/PropertyMaps';
import SystemLogs from './components/SystemLogs';
import PreloadManager from './components/PreloadManager';
import Logo from './components/Logo';

type ViewMode = 'main' | 'visual-report' | 'comprehensive-report';

const App: React.FC = () => {
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('zyphe_search_history');
    if (saved) {
      try {
        const history = JSON.parse(saved);
        return Array.isArray(history) ? history : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
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

  const addLog = (service: string, type: 'request' | 'response' | 'error' | 'info', content: any) => {
    setLogs(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), service, type, content }]);
  };

  const addToHistory = (newAddress: string) => {
    setSearchHistory(prev => {
      const filtered = prev.filter(item => item.toLowerCase() !== newAddress.toLowerCase());
      const newHistory = [newAddress, ...filtered].slice(0, 10);
      localStorage.setItem('zyphe_search_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const handleHistoryItemClick = (item: string) => {
    setAddress(item);
    setShowHistory(false);
    performSearch(item);
  };

  const performSearch = async (searchAddress: string) => {
    if (!searchAddress.trim()) return;

    setLoading(true);
    setImagesLoading(false);
    setError(null);
    setPropertyData(null);
    setCustomAnalysis(null);
    setComprehensiveAnalysis(null);
    setLogs([]);
    setViewMode('main');

    logUserActivity(sessionId, searchAddress);

    try {
      addLog('Radar Geocode API', 'request', { address: searchAddress });
      const radarResult = await normalizeAddress(searchAddress);
      addLog('Radar Geocode API', 'response', radarResult);
      
      const normalizedAddr = radarResult.formattedAddress;
      addToHistory(normalizedAddr);
      setAddress(normalizedAddr);

      addLog('Zyphe Data Layer', 'request', { address: normalizedAddr });
      const data = await fetchPropertyData(normalizedAddr);
      
      const mergedData: PropertyData = {
        ...data,
        coordinates: radarResult.coordinates,
        mapZoomIn: radarResult.mapZoomIn,
        mapZoomOut: radarResult.mapZoomOut,
        address: normalizedAddr
      };
      
      addLog('Zyphe Data Layer', 'response', data);
      setPropertyData(mergedData);
      setLoading(false);

      if (data.zpid) {
        const cloudVisualAnalysis = await getVisualAnalysisFromCloud(data.zpid);
        if (cloudVisualAnalysis) setCustomAnalysis(cloudVisualAnalysis);

        const cloudCompAnalysis = await getComprehensiveAnalysisFromCloud(data.zpid);
        if (cloudCompAnalysis) setComprehensiveAnalysis(cloudCompAnalysis);
        
        setImagesLoading(true);
        const images = await fetchPropertyImages(data.zpid);
        setPropertyData(prev => prev ? { ...prev, images } : null);
        setImagesLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      addLog('System', 'error', err);
      setLoading(false);
    }
  };

  const handleRunCustomAnalysis = async () => {
    if (!propertyData) return;
    setCustomAnalysisLoading(true);
    setViewMode('visual-report');
    
    try {
      addLog('Gemini AI', 'request', { task: 'visual_analysis' });
      const result = await analyzePropertyImages(propertyData.images || [], propertyData);
      
      if (propertyData.mapZoomOut) {
        const neighborhood = await analyzeNeighborhood(propertyData.mapZoomOut, propertyData);
        result.neighborhood = neighborhood;
      }
      
      const pulse = await analyzeCommunityPulse(propertyData);
      result.community_pulse = pulse;
      
      setCustomAnalysis(result);
      addLog('Gemini AI', 'response', result);
      if (propertyData.zpid) await saveVisualAnalysisToCloud(propertyData.zpid, result);
    } catch (err: any) {
      const logContent = err instanceof AiResponseError ? { message: err.message, raw: err.rawResponse } : err;
      addLog('Gemini AI', 'error', logContent);
      setError("AI analysis failed. Check logs for details.");
    } finally {
      setCustomAnalysisLoading(false);
    }
  };

  const handleRunComprehensive = async () => {
    if (!propertyData || !customAnalysis) return;
    setComprehensiveLoading(true);
    setViewMode('comprehensive-report');

    try {
      addLog('Gemini AI', 'request', { task: 'comprehensive_analysis' });
      const result = await analyzeComprehensive(propertyData, customAnalysis);
      setComprehensiveAnalysis(result);
      addLog('Gemini AI', 'response', result);
      if (propertyData.zpid) await saveComprehensiveAnalysisToCloud(propertyData.zpid, result);
    } catch (err: any) {
      const logContent = err instanceof AiResponseError ? { message: err.message, raw: err.rawResponse } : err;
      addLog('Gemini AI', 'error', logContent);
      setError("Comprehensive report failed. Check logs for details.");
    } finally {
      setComprehensiveLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {showPreload && <PreloadManager onClose={() => setShowPreload(false)} initialAddress={address} />}
      
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 py-2 shadow-sm backdrop-blur-md bg-white/90">
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
                    placeholder="Enter property address for AI analysis..."
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
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Searches</span>
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
            
            <button onClick={() => setShowPreload(true)} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg active:scale-95 flex items-center gap-2">
              <i className="fa-solid fa-bolt"></i>
              Pipeline
            </button>
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

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <div className="relative mb-10">
               <Logo size={220} className="animate-pulse" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Analyzing Property DNA...</h2>
            <p className="text-sm font-medium text-slate-500 animate-pulse">Our AI is fetching market specs, mapping neighborhood context, and assessing risk factors.</p>
          </div>
        ) : viewMode === 'main' ? (
          propertyData ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50">
                <div className="flex-1">
                   <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">{propertyData.address}</h2>
                   <p className="text-slate-500 font-medium flex items-center gap-2">
                     <i className="fa-solid fa-location-dot text-indigo-500"></i>
                     {propertyData.homeType?.replace('_', ' ')} • Built in {propertyData.yearBuilt}
                   </p>
                </div>
                <button onClick={handleRunCustomAnalysis} className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-indigo-700 to-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 hover:scale-[1.05] active:scale-95 transition-all flex items-center justify-center gap-3">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  Generate AI Intelligence
                </button>
              </div>

              <PropertyImages images={propertyData.images} loading={imagesLoading} homeStatus={propertyData.homeStatus} />
              <PropertyHeader data={propertyData} />
              <TablesSection data={propertyData} />
              <PropertyMaps mapZoomIn={propertyData.mapZoomIn} mapZoomOut={propertyData.mapZoomOut} />
              <PropertyFacts facts={propertyData.resoFacts} />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto py-12">
              <div className="text-center space-y-4 mb-16 flex flex-col items-center">
                <Logo size={480} className="hover:scale-105 transition-transform duration-700 drop-shadow-2xl" />
                <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed mt-10">
                  The world's most advanced property analysis suite. Instant deep-dives into property value, neighborhood pulse, and structural visual intelligence.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { title: 'For Buyers', icon: 'fa-shopping-bag', color: 'indigo', desc: 'Identify hidden risks, school quality, and lifestyle suitability before you make an offer.' },
                  { title: 'For Sellers', icon: 'fa-money-bill-trend-up', color: 'slate', desc: 'Discover how to maximize your home value with AI-driven staging and market insights.' },
                  { title: 'For Realtors', icon: 'fa-briefcase', color: 'indigo', desc: 'Generate professional multi-source reports and compelling marketing copy in seconds.' }
                ].map((item, i) => (
                  <div key={i} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 hover:-translate-y-2 transition-all group">
                    <div className={`w-14 h-14 rounded-2xl bg-${item.color}-50 text-${item.color}-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
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
            onRefresh={handleRunCustomAnalysis} 
            onRunComprehensive={handleRunComprehensive} 
            comprehensiveResult={comprehensiveAnalysis} 
            hasImages={(propertyData?.images?.length || 0) > 0} 
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

      <footer className="bg-slate-900 py-16 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
          <Logo size={240} className="mb-10 brightness-0 invert opacity-60 hover:opacity-100 transition-opacity" />
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mb-10">Intelligence Suite • 2025</p>
          <div className="flex gap-12 text-slate-400 text-xs font-bold">
            <a href="#" className="hover:text-indigo-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-indigo-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-indigo-400 transition-colors">Enterprise API</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;