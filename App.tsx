import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PropertyData, AIAnalysisResult, CustomAIAnalysisResult, ComprehensiveAnalysisResult, LogEntry } from './types';
import { normalizeAddress, fetchPropertyData, fetchPropertyImages } from './services/apiService';
import { analyzeProperty, analyzePropertyImages, analyzeNeighborhood, analyzeCommunityPulse, analyzeComprehensive } from './services/geminiService';
import { 
  logUserActivity, 
  savePropertyToCloud, 
  saveDeepAnalysisToCloud, 
  saveVisualAnalysisToCloud,
  saveComprehensiveAnalysisToCloud,
  getDeepAnalysisFromCloud,
  getVisualAnalysisFromCloud,
  getComprehensiveAnalysisFromCloud
} from './services/firebaseService';
import PropertyHeader from './components/PropertyHeader';
import TablesSection from './components/TablesSection';
import PropertyFacts from './components/PropertyFacts';
import AIAnalysis from './components/AIAnalysis';
import CustomAIAnalysis from './components/CustomAIAnalysis';
import ComprehensiveAnalysis from './components/ComprehensiveAnalysis';
import PropertyImages from './components/PropertyImages';
import PropertyMaps from './components/PropertyMaps';
import SystemLogs from './components/SystemLogs';
import DataInspector from './components/DataInspector';

type ViewMode = 'main' | 'visual-report' | 'comprehensive-report';

const App: React.FC = () => {
  const [address, setAddress] = useState('3588 Ballantyne Dr, Pleasanton, CA 94588');
  const [loading, setLoading] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertyData, setPropertyData] = useState<PropertyData | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [customAnalysis, setCustomAnalysis] = useState<CustomAIAnalysisResult | null>(null);
  const [customAnalysisLoading, setCustomAnalysisLoading] = useState(false);
  const [comprehensiveAnalysis, setComprehensiveAnalysis] = useState<ComprehensiveAnalysisResult | null>(null);
  const [comprehensiveLoading, setComprehensiveLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [geoComponents, setGeoComponents] = useState<{ city: string; state: string } | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  
  // Search History State
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  // In-memory session ID (no localStorage)
  const sessionId = useMemo(() => Math.random().toString(36).substring(2, 15), []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [viewMode]);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('zyphe_search_history');
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse search history");
      }
    }
  }, []);

  // Handle click outside history dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addToHistory = (newAddress: string) => {
    const filtered = searchHistory.filter(item => item.toLowerCase() !== newAddress.toLowerCase());
    const newHistory = [newAddress, ...filtered].slice(0, 5);
    setSearchHistory(newHistory);
    localStorage.setItem('zyphe_search_history', JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('zyphe_search_history');
    setShowHistory(false);
  };

  const handleHistoryItemClick = (item: string) => {
    setAddress(item);
    setShowHistory(false);
    // Use a small timeout to ensure the state update for address is processed if needed
    setTimeout(() => performSearch(item), 10);
  };

  const performSearch = async (searchAddress: string) => {
    if (!searchAddress.trim()) return;

    setLoading(true);
    setImagesLoading(false);
    setError(null);
    setPropertyData(null);
    setAnalysis(null);
    setCustomAnalysis(null);
    setComprehensiveAnalysis(null);
    setLogs([]);
    setViewMode('main');
    setGeoComponents(null);

    logUserActivity(sessionId, searchAddress);

    try {
      addLog('Radar Geocode API', 'request', { address: searchAddress });
      const radarResult = await normalizeAddress(searchAddress);
      addLog('Radar Geocode API', 'response', radarResult);
      
      const normalizedAddr = radarResult.formattedAddress;
      addToHistory(normalizedAddr);
      setAddress(normalizedAddr);

      setGeoComponents({ city: radarResult.components.city, state: radarResult.components.state });

      addLog('Zyphe Data Layer (Properties Table)', 'request', { address: normalizedAddr });
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
        // Restore Analysis from Cloud Table
        const cloudDeepAnalysis = await getDeepAnalysisFromCloud(data.zpid);
        if (cloudDeepAnalysis) {
          setAnalysis(cloudDeepAnalysis);
          addLog('Zyphe Cloud', 'response', { message: 'Restored deep analysis from cloud', data: cloudDeepAnalysis });
        }

        const cloudVisualAnalysis = await getVisualAnalysisFromCloud(data.zpid);
        if (cloudVisualAnalysis) {
          setCustomAnalysis(cloudVisualAnalysis);
          addLog('Zyphe Cloud', 'response', { message: 'Restored visual analysis from cloud', data: cloudVisualAnalysis });
        }
        
        if (!data.images || data.images.length === 0) {
          setImagesLoading(true);
          const images = await fetchPropertyImages(data.zpid);
          setPropertyData(prev => prev ? { ...prev, images } : null);
          if (images.length > 0) {
            await savePropertyToCloud(data.zpid, { images });
          }
          setImagesLoading(false);
        }
      }

    } catch (err: any) {
      const errorMsg = err.message || 'An unexpected error occurred.';
      setError(errorMsg);
      addLog('System', 'error', { message: errorMsg });
      setLoading(false);
      setImagesLoading(false);
    }
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setShowHistory(false);
    performSearch(address);
  };

  const addLog = (service: string, type: 'request' | 'response' | 'error' | 'info', content: any) => {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      service,
      type,
      content
    };
    setLogs(prev => [...prev, entry]);
  };

  const handleTriggerAnalysis = async () => {
    if (!propertyData || !propertyData.zpid) return;
    setAnalysisLoading(true);
    addLog('Gemini 2.5 Flash', 'request', { model: 'gemini-2.5-flash', task: 'Deep Analysis' });
    try {
      const aiResult = await analyzeProperty(propertyData);
      setAnalysis(aiResult);
      addLog('Gemini 2.5 Flash', 'response', aiResult);
      await saveDeepAnalysisToCloud(propertyData.zpid, aiResult);
    } catch (err: any) {
      addLog('Gemini 2.5 Flash', 'error', { message: err.message });
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleRunComprehensiveAnalysis = async () => {
    if (!propertyData || !propertyData.zpid) return;
    if (comprehensiveAnalysis) {
      setViewMode('comprehensive-report');
      return;
    }

    let visual = customAnalysis;
    if (!visual) {
      alert("Visual intelligence required first.");
      return;
    }

    setComprehensiveLoading(true);
    setViewMode('comprehensive-report');
    addLog('Gemini 2.5 Flash', 'request', { model: 'gemini-2.5-flash', task: 'Comprehensive Report', search: true });
    
    try {
      const result = await analyzeComprehensive(propertyData, visual);
      addLog('Gemini 2.5 Flash', 'response', result);
      setComprehensiveAnalysis(result);
      await saveComprehensiveAnalysisToCloud(propertyData.zpid, result);
    } catch (err: any) {
      addLog('Gemini 2.5 Flash', 'error', { message: err.message });
      setViewMode('visual-report');
    } finally {
      setComprehensiveLoading(false);
    }
  };

  const handleRunCustomAnalysis = async (forceRefresh: boolean = false) => {
    if (!propertyData || !propertyData.zpid) return;
    
    if (imagesLoading) {
      alert("Photos are still downloading. Please wait a moment.");
      return;
    }

    if (!forceRefresh && customAnalysis) {
      setViewMode('visual-report');
      return;
    }

    setCustomAnalysisLoading(true);
    setViewMode('visual-report');
    
    let finalResult: CustomAIAnalysisResult | null = {
      report_title: 'Zyphe AI Visual Analysis',
      home_interior: { 
        overall_description: 'Analyzing...', 
        design_style: { style: 'Detecting...', reasoning: 'Processing images...' },
        color_and_materials: 'Detecting...',
        lighting: 'Detecting...',
        spatial_flow: 'Detecting...',
        staging_and_furnishings: 'Detecting...',
        condition_and_finish: 'Detecting...',
        suggested_lifestyle: { lifestyle: 'Predicting...', buyer_type: 'Detecting...' }
      },
      room_highlights: [],
      exterior_and_neighborhood: { 
        exterior_and_lot_appeal: { architecture_style: 'Detecting...', curb_appeal: 'Detecting...', backyard_and_patio: 'Detecting...' },
        views_privacy_orientation: { views: 'Detecting...', orientation: 'Detecting...', privacy: 'Detecting...' } 
      }
    };

    try {
      const tasks = [];
      
      if (propertyData.images && propertyData.images.length > 0) {
        tasks.push(analyzePropertyImages(propertyData.images).then(result => {
          if (finalResult) {
            finalResult = { ...finalResult, ...result };
          }
        }));
      } else {
        addLog('App Logic', 'info', 'No images found for visual analysis.');
      }

      if (propertyData.mapZoomOut) {
        tasks.push(analyzeNeighborhood(propertyData.mapZoomOut, propertyData.address).then(neighborhoodResult => {
          if (finalResult) finalResult.neighborhood = neighborhoodResult;
        }));
      }

      const cityState = geoComponents ? `${geoComponents.city}, ${geoComponents.state}` : '';
      tasks.push(analyzeCommunityPulse(propertyData.address, cityState).then(pulseResult => {
        if (finalResult) finalResult.community_pulse = pulseResult;
      }));
      
      await Promise.all(tasks);
      
      if (finalResult) {
        addLog('Gemini 2.5 Flash (Visual)', 'response', finalResult);
        await saveVisualAnalysisToCloud(propertyData.zpid, finalResult);
        setCustomAnalysis(finalResult);
      }
    } catch (err: any) {
      addLog('Gemini 2.5 Flash (Multimodal)', 'error', { message: err.message });
      setError(`Visual analysis failed: ${err.message}`);
    } finally {
      setCustomAnalysisLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 py-5 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4 cursor-pointer" onClick={() => setViewMode('main')}>
                <div className="h-12 w-12 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                  <i className="fa-solid fa-house-chimney text-white text-xl"></i>
                </div>
                <div>
                  <h1 className="text-2xl font-black text-gray-900 tracking-tighter leading-none">Zyphe <span className="text-indigo-600">AI</span></h1>
                  <p className="text-[10px] text-gray-400 uppercase font-black tracking-[0.2em]">Intelligent Real Estate</p>
                </div>
              </div>
            </div>

            <div className="flex-1 max-w-2xl relative" ref={historyRef}>
              <form onSubmit={handleSearchSubmit}>
                <div className="relative group">
                  <input
                    type="text"
                    value={address}
                    onFocus={() => setShowHistory(true)}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter property address..."
                    className="w-full pl-14 pr-4 py-4 bg-gray-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 rounded-2xl transition-all outline-none text-base font-medium"
                  />
                  <i className="fa-solid fa-magnifying-glass absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 text-lg"></i>
                  <button
                    type="submit"
                    disabled={loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-md"
                  >
                    {loading ? 'Analyzing...' : 'Analyze'}
                  </button>
                </div>
              </form>

              {/* History Dropdown */}
              {showHistory && searchHistory.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recent Searches</span>
                    <button 
                      onClick={clearHistory}
                      className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {searchHistory.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleHistoryItemClick(item)}
                        className="w-full px-5 py-4 text-left flex items-center gap-4 hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0 group"
                      >
                        <i className="fa-solid fa-clock-rotate-left text-gray-300 group-hover:text-indigo-400 transition-colors"></i>
                        <span className="text-sm font-medium text-gray-700 truncate">{item}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 p-5 rounded-xl mb-10 flex items-center">
            <i className="fa-solid fa-circle-exclamation mr-4 text-xl"></i>
            <p className="text-base font-medium">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <div className="relative mb-8">
              <div className="w-24 h-24 border-4 border-indigo-100 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 flex items-center justify-center animate-spin">
                <div className="w-14 h-14 border-t-4 border-indigo-600 rounded-full"></div>
              </div>
            </div>
            <p className="text-xl font-medium animate-pulse text-gray-600">Gathering intelligence...</p>
          </div>
        ) : viewMode === 'main' ? (
          propertyData ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <PropertyImages images={propertyData?.images} loading={imagesLoading} />
              <PropertyHeader data={propertyData} />
              <TablesSection data={propertyData} />
              <PropertyMaps mapZoomIn={propertyData.mapZoomIn} mapZoomOut={propertyData.mapZoomOut} />
              <PropertyFacts facts={propertyData.resoFacts} />
              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 my-8">
                <h3 className="font-bold text-gray-800 mb-5 flex items-center text-lg"><i className="fa-solid fa-align-left text-gray-400 mr-3"></i>Property Description</h3>
                <p className="text-base text-gray-600 leading-relaxed">{propertyData.description}</p>
              </div>
              
              <div className="flex flex-wrap items-center justify-center gap-4 mt-12 mb-16">
                {!analysis && (
                  <button onClick={handleTriggerAnalysis} disabled={analysisLoading} className="inline-flex items-center gap-4 px-8 py-5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-2xl font-bold hover:bg-indigo-100 transition-all group">
                    <i className="fa-solid fa-brain"></i>{analysisLoading ? 'Analyzing...' : 'Run Data Intelligence'}
                  </button>
                )}
                
                <button 
                  onClick={() => handleRunCustomAnalysis(false)} 
                  disabled={imagesLoading}
                  className={`inline-flex items-center gap-4 px-8 py-5 ${customAnalysis ? 'bg-indigo-900' : 'bg-gradient-to-r from-purple-600 to-indigo-600'} text-white rounded-2xl font-bold shadow-xl hover:scale-[1.02] transition-all group disabled:opacity-70 disabled:grayscale disabled:hover:scale-100`}
                >
                  <i className={`fa-solid ${imagesLoading ? 'fa-spinner animate-spin' : 'fa-wand-magic-sparkles'}`}></i>
                  {imagesLoading ? 'Gathering photos...' : (customAnalysis ? 'View Visual AI Analysis' : 'Run Visual Intelligence')}
                </button>
                
                <button onClick={() => setIsInspectorOpen(true)} className="inline-flex items-center gap-3 px-6 py-5 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold shadow-sm hover:bg-gray-50 transition-all">
                  <i className="fa-solid fa-code text-gray-400"></i>Data Inspector
                </button>
              </div>

              {analysis && <AIAnalysis analysis={analysis} loading={analysisLoading} />}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-28 h-28 bg-white border border-gray-100 rounded-full flex items-center justify-center mb-8 shadow-sm">
                <i className="fa-solid fa-house-laptop text-5xl text-indigo-500/20"></i>
              </div>
              <h2 className="text-3xl font-black text-gray-800 mb-3 tracking-tight">Intelligence Starts Here</h2>
              <p className="text-base text-gray-500 max-w-md">Enter any US property address to generate a comprehensive Zyphe™ intelligence report.</p>
            </div>
          )
        ) : viewMode === 'visual-report' ? (
          <CustomAIAnalysis 
            analysis={customAnalysis} 
            loading={customAnalysisLoading} 
            onBack={() => setViewMode('main')} 
            onRefresh={() => handleRunCustomAnalysis(true)} 
            onRunComprehensive={handleRunComprehensiveAnalysis}
            comprehensiveResult={comprehensiveAnalysis}
            mapUrl={propertyData?.mapZoomOut} 
          />
        ) : (
          <ComprehensiveAnalysis analysis={comprehensiveAnalysis} loading={comprehensiveLoading} onBack={() => setViewMode('visual-report')} address={propertyData?.address} />
        )}

        <div id="system-logs-section">
          <SystemLogs logs={logs} />
        </div>
      </main>

      <DataInspector isOpen={isInspectorOpen} onClose={() => setIsInspectorOpen(false)} data={{ property: propertyData, analysis: analysis, visual: customAnalysis }} />
    </div>
  );
};

export default App;