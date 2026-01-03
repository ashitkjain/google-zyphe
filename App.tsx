
import React, { useState, useEffect } from 'react';
import { PropertyData, AIAnalysisResult, CustomAIAnalysisResult, LogEntry } from './types';
import { normalizeAddress, fetchPropertyData, fetchPropertyImages } from './services/apiService';
import { analyzeProperty, analyzePropertyImages } from './services/geminiService';
import PropertyHeader from './components/PropertyHeader';
import TablesSection from './components/TablesSection';
import PropertyFacts from './components/PropertyFacts';
import AIAnalysis from './components/AIAnalysis';
import CustomAIAnalysis from './components/CustomAIAnalysis';
import PropertyImages from './components/PropertyImages';
import PropertyMaps from './components/PropertyMaps';
import SystemLogs from './components/SystemLogs';

type ViewMode = 'main' | 'visual-report';

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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('main');

  // Scroll to top when switching views
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [viewMode]);

  const addLog = (service: string, type: 'request' | 'response' | 'error', content: any) => {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      service,
      type,
      content
    };
    setLogs(prev => [...prev, entry]);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!address.trim()) return;

    setLoading(true);
    setImagesLoading(false);
    setError(null);
    setPropertyData(null);
    setAnalysis(null);
    setCustomAnalysis(null);
    setLogs([]);
    setViewMode('main');

    try {
      addLog('Radar Geocode API', 'request', { address });
      const radarResult = await normalizeAddress(address);
      addLog('Radar Geocode API', 'response', radarResult);
      
      addLog('US Housing Data API (Property)', 'request', { address: radarResult.formattedAddress });
      const data = await fetchPropertyData(radarResult.formattedAddress);
      
      const mergedData: PropertyData = {
        ...data,
        coordinates: radarResult.coordinates,
        mapZoomIn: radarResult.mapZoomIn,
        mapZoomOut: radarResult.mapZoomOut,
        address: radarResult.formattedAddress
      };
      
      addLog('US Housing Data API (Property)', 'response', data);
      setPropertyData(mergedData);
      setLoading(false);

      if (data.zpid) {
        setImagesLoading(true);
        addLog('US Housing Data API (Images)', 'request', { zpid: data.zpid });
        const images = await fetchPropertyImages(data.zpid);
        addLog('US Housing Data API (Images)', 'response', { imagesCount: images.length });
        setPropertyData(prev => prev ? { ...prev, images } : null);
        setImagesLoading(false);
      }

    } catch (err: any) {
      const errorMsg = err.message || 'An unexpected error occurred.';
      setError(errorMsg);
      addLog('System', 'error', { message: errorMsg });
      setLoading(false);
      setImagesLoading(false);
    }
  };

  const handleTriggerAnalysis = async () => {
    if (!propertyData) return;
    
    setAnalysisLoading(true);
    addLog('Gemini AI', 'request', { model: 'gemini-3-flash-preview', task: 'Deep Analysis' });
    
    try {
      const aiResult = await analyzeProperty(propertyData);
      addLog('Gemini AI', 'response', aiResult);
      setAnalysis(aiResult);
    } catch (err: any) {
      const errorMsg = err.message || 'AI analysis failed.';
      addLog('Gemini AI', 'error', { message: errorMsg });
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleRunCustomAnalysis = async () => {
    if (!propertyData?.images || propertyData.images.length === 0) return;

    setCustomAnalysisLoading(true);
    setViewMode('visual-report');
    addLog('Gemini AI (Multimodal)', 'request', { model: 'gemini-3-flash-preview', task: 'Visual Analysis', imageCount: Math.min(propertyData.images.length, 15) });
    
    try {
      const result = await analyzePropertyImages(propertyData.images);
      addLog('Gemini AI (Multimodal)', 'response', result);
      setCustomAnalysis(result);
    } catch (err: any) {
      const errorMsg = err.message || 'Custom AI analysis failed.';
      addLog('Gemini AI (Multimodal)', 'error', { message: errorMsg });
      // If error occurs, stay on page but show error state is handled by CustomAIAnalysis component normally 
      // but if we want to go back we can.
    } finally {
      setCustomAnalysisLoading(false);
    }
  };

  // Main Page Content
  const renderMainContent = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <PropertyImages images={propertyData?.images} loading={imagesLoading} />

      {propertyData && (
        <>
          <PropertyHeader data={propertyData} />
          <TablesSection data={propertyData} />
          <PropertyMaps mapZoomIn={propertyData.mapZoomIn} mapZoomOut={propertyData.mapZoomOut} />
          <PropertyFacts facts={propertyData.resoFacts} />

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 mb-8 mt-8">
            <h3 className="font-bold text-gray-800 mb-5 flex items-center text-lg">
              <i className="fa-solid fa-align-left text-gray-400 mr-3"></i>
              Property Description
            </h3>
            <p className="text-base text-gray-600 leading-relaxed">
              {propertyData.description}
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-6 mt-12 mb-16">
            {!analysis && !analysisLoading && (
              <button
                onClick={handleTriggerAnalysis}
                className="inline-flex items-center gap-4 px-8 py-5 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:scale-[1.02] transition-all group text-base"
              >
                <i className="fa-solid fa-brain text-xl group-hover:animate-bounce"></i>
                Run PropIntel™ Data Analysis
              </button>
            )}
            
            {propertyData.images && propertyData.images.length > 0 && (
              <button
                onClick={customAnalysis ? () => setViewMode('visual-report') : handleRunCustomAnalysis}
                className={`inline-flex items-center gap-4 px-8 py-5 ${customAnalysis ? 'bg-indigo-900' : 'bg-gradient-to-r from-purple-600 to-indigo-600'} text-white rounded-2xl font-bold shadow-xl shadow-purple-100 hover:scale-[1.02] transition-all group text-base border-2 border-white/20`}
              >
                <i className={`fa-solid ${customAnalysis ? 'fa-chart-pie' : 'fa-wand-magic-sparkles'} text-xl group-hover:animate-spin`}></i>
                {customAnalysis ? 'View Visual AI Analysis' : 'Run Custom Visual AI Analysis'}
              </button>
            )}
          </div>

          {analysisLoading || analysis ? (
            <AIAnalysis analysis={analysis!} loading={analysisLoading} />
          ) : null}
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 py-5 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div 
                className="h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 cursor-pointer"
                onClick={() => setViewMode('main')}
              >
                <i className="fa-solid fa-building-circle-check text-white text-2xl"></i>
              </div>
              <div className="cursor-pointer" onClick={() => setViewMode('main')}>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">PropIntel AI</h1>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Intelligent Market Analysis</p>
              </div>
            </div>

            <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
              <div className="relative group">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter property address..."
                  className="w-full pl-14 pr-4 py-4 bg-gray-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 rounded-2xl transition-all outline-none text-base font-medium"
                />
                <i className="fa-solid fa-magnifying-glass absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors text-lg"></i>
                <button
                  type="submit"
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-100"
                >
                  {loading ? 'Analyzing...' : 'Search'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 p-5 rounded-xl mb-10 flex items-center shadow-sm">
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
            <p className="text-xl font-medium animate-pulse">Gathering real-time housing data...</p>
            <p className="text-base">Geocoding via Radar & Fetching from US Housing APIs</p>
          </div>
        ) : viewMode === 'main' ? (
          propertyData ? renderMainContent() : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-28 h-28 bg-gray-100 rounded-full flex items-center justify-center mb-8">
                <i className="fa-solid fa-house-chimney-window text-5xl text-gray-300"></i>
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-3">Ready to Analyze?</h2>
              <p className="text-base text-gray-500 max-w-md">Enter a US property address above to generate a comprehensive PropIntel report using Radar, US Housing Data, and Gemini AI.</p>
            </div>
          )
        ) : (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <CustomAIAnalysis 
              analysis={customAnalysis!} 
              loading={customAnalysisLoading} 
              onBack={() => setViewMode('main')}
            />
          </div>
        )}

        {viewMode === 'main' && <SystemLogs logs={logs} />}
      </main>
    </div>
  );
};

export default App;
