
import React, { useState, useEffect } from 'react';
import { PropertyData, AIAnalysisResult } from './types';
import { normalizeAddress, fetchPropertyData } from './services/apiService';
import { analyzeProperty } from './services/geminiService';
import PropertyHeader from './components/PropertyHeader';
import TablesSection from './components/TablesSection';
import PropertyFacts from './components/PropertyFacts';
import AIAnalysis from './components/AIAnalysis';

const App: React.FC = () => {
  const [address, setAddress] = useState('3588 Ballantyne Dr, Pleasanton, CA 94588');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertyData, setPropertyData] = useState<PropertyData | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!address.trim()) return;

    setLoading(true);
    setError(null);
    setPropertyData(null);
    setAnalysis(null);

    try {
      // Step 1: Normalize via Radar
      const normalized = await normalizeAddress(address);
      
      // Step 2: Fetch Property Data via US Housing Data API
      const data = await fetchPropertyData(normalized);
      setPropertyData(data);
      setLoading(false);

      // Step 3: Trigger AI Analysis
      setAnalysisLoading(true);
      const aiResult = await analyzeProperty(data);
      setAnalysis(aiResult);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setLoading(false);
    } finally {
      setAnalysisLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Search Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <i className="fa-solid fa-building-circle-check text-white text-xl"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">PropIntel AI</h1>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Intelligent Market Analysis</p>
              </div>
            </div>

            <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
              <div className="relative group">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter property address..."
                  className="w-full pl-12 pr-4 py-3 bg-gray-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 rounded-2xl transition-all outline-none text-sm font-medium"
                />
                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors"></i>
                <button
                  type="submit"
                  disabled={loading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 text-white px-5 py-1.5 rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-100"
                >
                  {loading ? 'Analyzing...' : 'Search'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-xl mb-8 flex items-center shadow-sm">
            <i className="fa-solid fa-circle-exclamation mr-3 text-lg"></i>
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="relative mb-6">
              <div className="w-20 h-20 border-4 border-indigo-100 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 flex items-center justify-center animate-spin">
                <div className="w-12 h-12 border-t-4 border-indigo-600 rounded-full"></div>
              </div>
            </div>
            <p className="text-lg font-medium animate-pulse">Gathering real-time housing data...</p>
            <p className="text-sm">Fetching from Radar and US Housing APIs</p>
          </div>
        ) : propertyData ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <PropertyHeader data={propertyData} />
            <TablesSection data={propertyData} />
            <PropertyFacts facts={propertyData.resoFacts} />

            {/* Property Description Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                <i className="fa-solid fa-align-left text-gray-400 mr-2"></i>
                Property Description
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {propertyData.description}
              </p>
            </div>

            {/* AI Analysis Section */}
            {(analysis || analysisLoading) && (
              <AIAnalysis analysis={analysis!} loading={analysisLoading} />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <i className="fa-solid fa-house-chimney-window text-4xl text-gray-300"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Ready to Analyze?</h2>
            <p className="text-gray-500 max-w-sm">Enter a US property address above to generate a comprehensive PropIntel report using Radar, US Housing Data, and Gemini AI.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
