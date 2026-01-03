
import React, { useState } from 'react';
import { PropertyData, AIAnalysisResult, LogEntry } from './types';
import { normalizeAddress, fetchPropertyData, fetchPropertyImages } from './services/apiService';
import { analyzeProperty } from './services/geminiService';
import PropertyHeader from './components/PropertyHeader';
import TablesSection from './components/TablesSection';
import PropertyFacts from './components/PropertyFacts';
import AIAnalysis from './components/AIAnalysis';
import PropertyImages from './components/PropertyImages';
import SystemLogs from './components/SystemLogs';

const App: React.FC = () => {
  const [address, setAddress] = useState('3588 Ballantyne Dr, Pleasanton, CA 94588');
  const [loading, setLoading] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertyData, setPropertyData] = useState<PropertyData | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

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
    setLogs([]); // Reset logs for new search

    try {
      // Step 1: Normalize via Radar
      addLog('Radar API', 'request', { url: `https://api.radar.io/v1/geocode/forward?query=${address}`, method: 'GET' });
      const normalized = await normalizeAddress(address);
      addLog('Radar API', 'response', { formattedAddress: normalized, status: 'OK' });
      
      // Step 2: Fetch Basic Property Data
      addLog('US Housing Data API (Property)', 'request', { 
        url: `https://us-housing-market-data1.p.rapidapi.com/property?address=${encodeURIComponent(normalized)}`,
        headers: { 'x-rapidapi-host': 'us-housing-market-data1.p.rapidapi.com' }
      });
      const data = await fetchPropertyData(normalized);
      addLog('US Housing Data API (Property)', 'response', data);
      setPropertyData(data);
      setLoading(false);

      // Step 3: Fetch Images using zpid if available
      if (data.zpid) {
        setImagesLoading(true);
        addLog('US Housing Data API (Images)', 'request', { 
          url: `https://us-housing-market-data1.p.rapidapi.com/images?zpid=${data.zpid}`,
          headers: { 'x-rapidapi-host': 'us-housing-market-data1.p.rapidapi.com' }
        });
        const images = await fetchPropertyImages(data.zpid);
        addLog('US Housing Data API (Images)', 'response', { zpid: data.zpid, imagesCount: images.length, imagesUrls: images });
        setPropertyData(prev => prev ? { ...prev, images } : null);
        setImagesLoading(false);
      }

    } catch (err: any) {
      const errorMsg = err.message || 'An unexpected error occurred.';
      setError(errorMsg);
      addLog('System', 'error', { message: errorMsg, stack: err.stack });
      setLoading(false);
      setImagesLoading(false);
    }
  };

  const handleTriggerAnalysis = async () => {
    if (!propertyData) return;
    
    setAnalysisLoading(true);
    addLog('Gemini AI', 'request', { 
      model: 'gemini-3-flash-preview', 
      task: 'Intelligent Real Estate Analysis',
      context: { address: propertyData.address, zpid: propertyData.zpid, price: propertyData.price }
    });
    
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

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Search Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 py-5 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <i className="fa-solid fa-building-circle-check text-white text-2xl"></i>
              </div>
              <div>
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
            <p className="text-base">Fetching from Radar and US Housing APIs</p>
          </div>
        ) : propertyData ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Gallery Section */}
            <PropertyImages images={propertyData.images} loading={imagesLoading} />

            <PropertyHeader data={propertyData} />
            <TablesSection data={propertyData} />
            <PropertyFacts facts={propertyData.resoFacts} />

            {/* Property Description Section */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 mb-8 mt-8">
              <h3 className="font-bold text-gray-800 mb-5 flex items-center text-lg">
                <i className="fa-solid fa-align-left text-gray-400 mr-3"></i>
                Property Description
              </h3>
              <p className="text-base text-gray-600 leading-relaxed">
                {propertyData.description}
              </p>
            </div>

            {/* AI Analysis Section Toggle */}
            {!analysis && !analysisLoading ? (
              <div className="mt-10 mb-14 text-center">
                <button
                  onClick={handleTriggerAnalysis}
                  className="inline-flex items-center gap-4 px-10 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:scale-[1.02] transition-all group text-base"
                >
                  <i className="fa-solid fa-brain text-xl group-hover:animate-bounce"></i>
                  Run PropIntel™ Deep AI Analysis
                </button>
                <p className="text-sm text-gray-400 mt-4 font-medium">Powered by Gemini 3 Flash</p>
              </div>
            ) : (
              <AIAnalysis analysis={analysis!} loading={analysisLoading} />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-28 h-28 bg-gray-100 rounded-full flex items-center justify-center mb-8">
              <i className="fa-solid fa-house-chimney-window text-5xl text-gray-300"></i>
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-3">Ready to Analyze?</h2>
            <p className="text-base text-gray-500 max-w-md">Enter a US property address above to generate a comprehensive PropIntel report using Radar, US Housing Data, and Gemini AI.</p>
          </div>
        )}

        {/* System Logs Section */}
        <SystemLogs logs={logs} />
      </main>
    </div>
  );
};

export default App;
