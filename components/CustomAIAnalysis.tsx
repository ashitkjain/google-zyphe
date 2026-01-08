
import React, { useState, useEffect } from 'react';
import { CustomAIAnalysisResult, CommunityPulseSection, ComprehensiveAnalysisResult, ImageQualityAnalysisResult } from '../types';
import { analyzeImageQuality, AiResponseError } from '../services/geminiService';

interface Props {
  analysis: CustomAIAnalysisResult | null;
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onRunComprehensive: () => void;
  comprehensiveResult: ComprehensiveAnalysisResult | null;
  mapUrl?: string;
  hasImages: boolean;
  userRole?: string;
  propertyImages?: string[];
  onUpdateAnalysis: (updated: CustomAIAnalysisResult) => void;
}

type TabType = 'interior' | 'rooms' | 'exterior' | 'neighborhood' | 'pulse' | 'quality';

const CustomAIAnalysis: React.FC<Props> = ({ 
  analysis, 
  loading, 
  onBack, 
  onRefresh, 
  onRunComprehensive,
  comprehensiveResult,
  mapUrl,
  hasImages,
  userRole,
  propertyImages = [],
  onUpdateAnalysis
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('interior');
  const [timer, setTimer] = useState(0);
  const [qualityLoading, setQualityLoading] = useState(false);

  useEffect(() => {
    let interval: number;
    if (loading) {
      setTimer(0);
      interval = window.setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleRunQualityAnalysis = async () => {
    if (!analysis || !propertyImages.length || qualityLoading) return;
    
    setQualityLoading(true);
    try {
      const result = await analyzeImageQuality(propertyImages);
      onUpdateAnalysis({
        ...analysis,
        image_quality_analysis: result
      });
    } catch (err) {
      console.error("Quality Analysis Failed:", err);
    } finally {
      setQualityLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-12 text-center my-10 shadow-sm flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative w-20 h-20 mb-8">
          <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
          <div className="absolute inset-0 border-t-4 border-indigo-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <i className="fa-solid fa-wand-magic-sparkles text-indigo-600 text-2xl animate-pulse"></i>
          </div>
        </div>
        <h3 className="text-3xl font-black text-indigo-900 mb-4 tracking-tight">Zyphe™ Visual Scanning...</h3>
        
        <div className="mb-8">
          <span className="px-5 py-2 bg-white border border-indigo-100 rounded-full text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] shadow-sm inline-flex items-center gap-2">
            <i className="fa-solid fa-clock animate-pulse"></i>
            Time Elapsed: <span className="font-mono text-xs">{timer}s</span>
          </span>
        </div>

        <p className="text-indigo-700/70 max-w-md mx-auto text-lg font-medium">
          Our multimodal engine is dissecting architecture and neighborhood context.
        </p>
      </div>
    );
  }

  if (!analysis) return null;

  const { 
    home_interior = {} as any, 
    room_highlights = [], 
    exterior_and_neighborhood = {} as any, 
    neighborhood,
    community_pulse,
    image_quality_analysis
  } = analysis;

  const tabs = [
    { id: 'interior', label: 'Interior', icon: 'fa-couch' },
    { id: 'rooms', label: 'Rooms', icon: 'fa-star' },
    { id: 'exterior', label: 'Exterior', icon: 'fa-tree' },
    { id: 'neighborhood', label: 'Neighborhood', icon: 'fa-map-location-dot' },
    { id: 'pulse', label: 'Community Pulse', icon: 'fa-users-viewfinder' },
  ];

  if (userRole === 'realtor') {
    tabs.push({ id: 'quality', label: 'Image Quality Analysis', icon: 'fa-camera-rotate' });
  }

  const getCleanDomain = (src: string) => {
    try {
      let url = new URL(src);
      if (url.hostname.includes('vertexaisearch.cloud.google.com') || url.hostname.includes('google.com')) {
        const uriParam = url.searchParams.get('uri');
        if (uriParam) url = new URL(uriParam);
      }
      return url.hostname.replace('www.', '');
    } catch (e) {
      return src.replace(/^https?:\/\//, '').split('/')[0].replace('www.', '');
    }
  };

  const PulseCard = ({ title, data, icon, color }: { title: string, data?: CommunityPulseSection, icon: string, color: string }) => {
    if (!data || !data.summary) return null;
    const cleanSources = Array.from(new Set(data.sources?.map(getCleanDomain))).filter(Boolean);
    return (
      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col transition-all hover:shadow-xl hover:-translate-y-1">
        <div className="flex items-center gap-4 mb-6">
          <div className={`w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400`}>
            <i className={`fa-solid ${icon} text-xl`}></i>
          </div>
          <h4 className="text-xl font-black text-gray-900 tracking-tight">{title}</h4>
        </div>
        <p className="text-gray-700 font-sans font-medium mb-4 leading-relaxed text-sm">{data.summary}</p>
        <ul className="space-y-2 mb-6 flex-1">
          {data.points?.map((pt, i) => (
            <li key={i} className="flex gap-3 text-gray-600 text-sm leading-relaxed font-sans font-medium">
              <span className={`w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 flex-shrink-0`}></span>
              {pt}
            </li>
          ))}
        </ul>
        {cleanSources.length > 0 && (
          <div className="pt-4 border-t border-gray-50">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Knowledge Sources</div>
            <div className="text-[10px] text-gray-400 font-sans font-black leading-relaxed italic">
              {cleanSources.join(', ')}
            </div>
          </div>
        )}
      </div>
    );
  };

  const QualityScoreWidget = ({ score, summary }: { score: number, summary: string }) => {
    const getColor = (s: number) => {
      if (s >= 80) return 'text-emerald-500 stroke-emerald-500';
      if (s >= 50) return 'text-amber-500 stroke-amber-500';
      return 'text-rose-500 stroke-rose-500';
    };
    
    return (
      <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm flex flex-col md:flex-row items-center gap-10">
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#f1f5f9" strokeWidth="10" />
            <circle 
              cx="50" cy="50" r="45" fill="none" strokeWidth="10" 
              className={`${getColor(score)} transition-all duration-1000 ease-out`}
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - score / 100)}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-gray-900">{score}</span>
            <span className="text-[10px] font-black text-gray-400 uppercase">Score</span>
          </div>
        </div>
        <div className="flex-1 text-center md:text-left">
          <div className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em] mb-2">Overall Listing Visual Score</div>
          <h4 className="text-2xl font-black text-gray-900 mb-2">Professional Audit Verdict</h4>
          <p className="text-gray-600 font-medium leading-relaxed italic">"{summary}"</p>
        </div>
      </div>
    );
  };

  const QualityRatingCard = ({ title, data, icon }: { title: string, data: { rating: string, observations: string[], issues: string[] }, icon: string }) => (
    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col transition-all hover:shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-indigo-600">
            <i className={`fa-solid ${icon}`}></i>
          </div>
          <h4 className="font-black text-gray-900 tracking-tight">{title}</h4>
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
          data.rating.toLowerCase().includes('good') ? 'bg-emerald-50 text-emerald-600' :
          data.rating.toLowerCase().includes('fair') ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
        }`}>
          {data.rating}
        </span>
      </div>
      
      <div className="space-y-6 flex-1">
        <div>
          <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Observations</div>
          <ul className="space-y-2">
            {data.observations.map((obs, i) => (
              <li key={i} className="text-xs text-gray-700 font-medium flex gap-2">
                <span className="text-indigo-400">•</span> {obs}
              </li>
            ))}
          </ul>
        </div>
        {data.issues.length > 0 && (
          <div>
            <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-2">Potential Issues</div>
            <ul className="space-y-2">
              {data.issues.map((issue, i) => (
                <li key={i} className="text-xs text-rose-700/80 font-medium flex gap-2 italic">
                  <span className="text-rose-400">!</span> {issue}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );

  const EmptyState = ({ section }: { section: string }) => (
    <div className="p-20 bg-white/50 rounded-[2rem] text-center border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-gray-400">
        <i className="fa-solid fa-magnifying-glass-chart text-3xl"></i>
      </div>
      <h4 className="text-xl font-black text-gray-900 mb-2">Analysis Missing for {section}</h4>
      <p className="text-gray-500 max-w-sm mx-auto mb-8 font-medium text-sm">This section of the report couldn't be generated from the available data.</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-3 px-6 py-3 bg-white border border-gray-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-700 shadow-sm hover:shadow-md hover:bg-gray-50 transition-all group w-fit"
        >
          <i className="fa-solid fa-arrow-left transition-transform group-hover:-translate-x-1"></i>
          Back to Overview
        </button>
        
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={onRefresh}
            className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:shadow-md hover:bg-slate-50 active:scale-95 transition-all group"
            title="Refresh AI Analysis"
          >
            <i className={`fa-solid fa-rotate group-hover:rotate-180 transition-transform duration-500`}></i>
            Refresh Analysis
          </button>
          
          <button 
            onClick={onRunComprehensive} 
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-indigo-700 to-gray-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-[1.05] active:scale-95 transition-all group"
          >
            <i className="fa-solid fa-file-invoice-dollar text-sm"></i>
            {comprehensiveResult ? 'Full Narrative Report' : 'Generate Full Report'}
          </button>
          <div className="flex items-center gap-2 text-[10px] text-gray-400 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 font-black uppercase tracking-widest">
            <i className="fa-solid fa-bolt-lightning text-indigo-500"></i>
            Zyphe™ Visual Intelligence
          </div>
        </div>
      </div>

      <div className="flex justify-center sm:justify-start">
        <div className="inline-flex bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm overflow-x-auto no-scrollbar max-w-full">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-3 px-6 py-3 rounded-xl font-black transition-all text-[10px] uppercase tracking-tight whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-indigo-700 to-gray-900 text-white shadow-lg'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <i className={`fa-solid ${tab.icon} ${activeTab === tab.id ? 'text-white' : 'text-gray-400'}`}></i>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'interior' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-5xl mx-auto space-y-8">
            {!home_interior?.overall_description ? (
              <EmptyState section="Interior" />
            ) : (
              <>
                <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">
                  <div className="space-y-4">
                    <div className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em]">Core Interior Narrative</div>
                    <p className="text-gray-800 font-sans font-medium text-sm leading-relaxed">{home_interior.overall_description}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 pt-12 border-t border-gray-100">
                    <div className="space-y-3">
                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Design Philosophy</div>
                      <div className="inline-block bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase px-3 py-1.5 rounded-full mb-2">
                        {home_interior.design_style?.style}
                      </div>
                      <p className="text-gray-700 font-sans font-medium text-sm leading-relaxed">{home_interior.design_style?.reasoning}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Colors & Materials</div>
                      <p className="text-gray-700 font-sans font-medium text-sm leading-relaxed">{home_interior.color_and_materials}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Lighting Environment</div>
                      <p className="text-gray-700 font-sans font-medium text-sm leading-relaxed">{home_interior.lighting}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Spatial Architecture</div>
                      <p className="text-gray-700 font-sans font-medium text-sm leading-relaxed">{home_interior.spatial_flow}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Staging & Furnishings</div>
                      <p className="text-gray-700 font-sans font-medium text-sm leading-relaxed">{home_interior.staging_and_furnishings}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Condition & Finish Quality</div>
                      <p className="text-gray-700 font-sans font-medium text-sm leading-relaxed">{home_interior.condition_and_finish}</p>
                    </div>
                  </div>
                </div>

                {home_interior.suggested_lifestyle && (
                  <div className="bg-indigo-700 text-white rounded-[3rem] p-10 md:p-12 shadow-xl shadow-indigo-100 flex flex-col md:flex-row items-center gap-10">
                    <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-[2rem] flex items-center justify-center flex-shrink-0 border border-white/20">
                      <i className="fa-solid fa-user-astronaut text-3xl"></i>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <div className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-200 mb-2">AI-Driven Suggested Lifestyle</div>
                      <h4 className="text-2xl font-black mb-4 tracking-tight">Best Suited for: <span className="text-indigo-200 italic">{home_interior.suggested_lifestyle.buyer_type}</span></h4>
                      <p className="text-indigo-50 font-sans font-medium text-sm leading-relaxed opacity-90">
                        {home_interior.suggested_lifestyle.lifestyle}
                      </p>
                    </div>
                    <div className="flex-shrink-0 px-6 py-4 bg-white/10 border border-white/20 rounded-2xl text-center">
                      <div className="text-[9px] font-black uppercase tracking-widest mb-1 text-indigo-200">Persona Fit</div>
                      <div className="text-2xl font-black">Optimum</div>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {activeTab === 'rooms' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {room_highlights.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {room_highlights.map((room, idx) => (
                  <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-12 h-12 bg-gray-50 rounded-[1.25rem] flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                        <i className={`fa-solid ${room.room_name?.toLowerCase().includes('kitchen') ? 'fa-kitchen-set' : 'fa-door-open'} text-xl`}></i>
                      </div>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">{room.floor || 'N/A'}</span>
                    </div>
                    <h4 className="font-black text-gray-900 text-xl mb-4 tracking-tight">{room.room_name}</h4>
                    <p className="text-gray-700 font-sans font-medium text-sm leading-relaxed mb-6">{room.description}</p>
                    {room.potential_improvements && (
                      <div className="pt-6 border-t border-gray-100 bg-gray-50 -mx-8 -mb-8 p-8 mt-auto">
                        <div className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3">Strategic Enhancement</div>
                        <p className="text-gray-500 text-sm font-sans font-black italic leading-relaxed">"{room.potential_improvements}"</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState section="Room Highlights" />
            )}
          </section>
        )}

        {activeTab === 'exterior' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-5xl mx-auto space-y-8">
             {!exterior_and_neighborhood?.exterior_and_lot_appeal?.architecture_style ? (
              <EmptyState section="Exterior" />
            ) : (
              <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                      <i className="fa-solid fa-house-chimney text-lg"></i>
                    </div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">Curb Appeal & Exterior Assessment</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Architectural DNA</h4>
                      <p className="text-gray-800 font-sans font-medium text-sm leading-relaxed">{exterior_and_neighborhood.exterior_and_lot_appeal.architecture_style}</p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Frontage Presence</h4>
                      <p className="text-gray-800 font-sans font-medium text-sm leading-relaxed">{exterior_and_neighborhood.exterior_and_lot_appeal.curb_appeal}</p>
                    </div>
                    <div className="col-span-full space-y-2">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Outdoor Living Potential</h4>
                      <p className="text-gray-800 font-sans font-medium text-sm leading-relaxed">{exterior_and_neighborhood.exterior_and_lot_appeal.backyard_and_patio}</p>
                    </div>
                  </div>
                </div>

                {exterior_and_neighborhood.views_privacy_orientation && (
                  <div className="pt-12 border-t border-gray-100 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 shadow-sm">
                        <i className="fa-solid fa-compass text-lg"></i>
                      </div>
                      <h3 className="text-xl font-black text-gray-900 tracking-tight">Environmental Orientation</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visual Scope</h4>
                        <p className="text-gray-800 font-sans font-medium text-sm leading-relaxed">{exterior_and_neighborhood.views_privacy_orientation.views}</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Luminosity Orientation</h4>
                        <p className="text-gray-800 font-sans font-medium text-sm leading-relaxed">{exterior_and_neighborhood.views_privacy_orientation.orientation}</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Privacy Perimeter</h4>
                        <p className="text-gray-800 font-sans font-medium text-sm leading-relaxed">{exterior_and_neighborhood.views_privacy_orientation.privacy}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {exterior_and_neighborhood.neighborhood_street_insights && (
                  <div className="pt-12 border-t border-gray-100 space-y-4">
                    <div className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">Micro-Neighborhood Insight</div>
                    <p className="text-gray-700 font-sans font-medium text-sm leading-relaxed italic">"{exterior_and_neighborhood.neighborhood_street_insights}"</p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === 'neighborhood' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-5xl mx-auto">
             {neighborhood ? (
              <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm p-8 md:p-12 space-y-12">
                <div className="space-y-4">
                  <div className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em]">Spatial Intelligence Summary</div>
                  <p className="text-gray-800 font-sans font-medium text-sm leading-relaxed">{neighborhood.overview}</p>
                </div>
                
                {neighborhood.neighborhood_features && (
                  <div className="pt-12 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    {Object.entries(neighborhood.neighborhood_features).map(([key, value]) => {
                      if (!value || key === 'general') return null;
                      const label = key
                        .split('_')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                      
                      return (
                        <div key={key} className="space-y-2">
                          <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                            {label}
                          </h4>
                          <p className="text-gray-700 font-sans font-medium text-sm leading-relaxed">{value as string}</p>
                        </div>
                      );
                    })}
                    {neighborhood.neighborhood_features.general && (
                      <div className="col-span-1 md:col-span-2 space-y-3 pt-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Historical & Cultural Context</h4>
                        <p className="text-gray-800 font-sans font-medium text-sm italic leading-relaxed">
                          {neighborhood.neighborhood_features.general}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState section="Neighborhood" />
            )}
          </section>
        )}

        {activeTab === 'pulse' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {community_pulse ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <PulseCard title="Resident Satisfaction" data={community_pulse.what_residents_like} icon="fa-face-smile" color="indigo" />
                <PulseCard title="Common Concerns" data={community_pulse.common_complaints} icon="fa-comment-slash" color="slate" />
                <PulseCard title="Safety & Community" data={community_pulse.safety_and_concerns} icon="fa-shield-halved" color="indigo" />
                <PulseCard title="Family & Schools" data={community_pulse.schools_family_friendliness} icon="fa-children" color="indigo" />
                <PulseCard title="Lifestyle Fit" data={community_pulse.lifestyle_convenience} icon="fa-bolt-lightning" color="indigo" />
                <PulseCard title="Investor View" data={community_pulse.investment_insights} icon="fa-chart-line" color="indigo" />
              </div>
            ) : (
              <EmptyState section="Community Pulse" />
            )}
          </section>
        )}

        {activeTab === 'quality' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-8">
            {!image_quality_analysis && !qualityLoading ? (
              <div className="p-20 bg-white rounded-[3rem] text-center border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
                <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center mb-8 text-indigo-600 shadow-xl shadow-indigo-100">
                  <i className="fa-solid fa-camera-rotate text-4xl"></i>
                </div>
                <h3 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Realtor Listing Quality Audit</h3>
                <p className="text-gray-500 max-w-md mx-auto mb-10 font-medium text-lg">Perform a professional audit of your property photos to ensure maximum engagement and listing performance.</p>
                <button 
                  onClick={handleRunQualityAnalysis}
                  className="px-10 py-5 bg-gradient-to-r from-indigo-700 to-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl hover:scale-[1.05] active:scale-95 transition-all"
                >
                  <i className="fa-solid fa-wand-magic-sparkles mr-3"></i>
                  Run Quality Audit
                </button>
              </div>
            ) : qualityLoading ? (
              <div className="bg-indigo-50 border border-indigo-100 rounded-[3rem] p-12 text-center my-10 shadow-sm flex flex-col items-center justify-center min-h-[50vh]">
                <div className="w-20 h-20 mb-8 relative">
                  <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
                  <div className="absolute inset-0 border-t-4 border-indigo-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fa-solid fa-camera text-indigo-600 text-2xl animate-pulse"></i>
                  </div>
                </div>
                <h3 className="text-3xl font-black text-indigo-900 mb-4 tracking-tight">AI Audit in Progress...</h3>
                <p className="text-indigo-700/70 max-w-md mx-auto text-lg font-medium">Analyzing lighting, composition, staging, and technical photo metrics.</p>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000">
                <QualityScoreWidget score={image_quality_analysis.overall_score.score} summary={image_quality_analysis.overall_score.summary} />
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  <QualityRatingCard title="Lighting & Color" data={image_quality_analysis.lighting_and_color} icon="fa-sun" />
                  <QualityRatingCard title="Staging & Clutter" data={image_quality_analysis.staging_and_clutter} icon="fa-couch" />
                  <QualityRatingCard title="Composition" data={image_quality_analysis.composition} icon="fa-crop-simple" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-rose-50 p-10 rounded-[3rem] border border-rose-100 flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
                        <i className="fa-solid fa-trash-can text-xl"></i>
                      </div>
                      <h4 className="text-2xl font-black text-rose-900 tracking-tight">Critical Removals</h4>
                    </div>
                    <div className="space-y-4">
                      <div className="text-rose-800 font-bold leading-relaxed">{image_quality_analysis.delete_list.description}</div>
                      <div className="flex flex-wrap gap-2">
                        {image_quality_analysis.delete_list.reasons.map((reason, i) => (
                          <span key={i} className="px-4 py-2 bg-white border border-rose-200 rounded-xl text-[10px] font-black text-rose-600 uppercase tracking-widest">{reason}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-indigo-700 p-10 rounded-[3rem] shadow-xl shadow-indigo-100 text-white flex flex-col gap-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white text-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <i className="fa-solid fa-rocket text-xl"></i>
                      </div>
                      <h4 className="text-2xl font-black tracking-tight">Realtor Action Plan</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div>
                        <div className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-4">Priority Actions</div>
                        <ul className="space-y-3">
                          {image_quality_analysis.action_plan.priority_actions.map((act, i) => (
                            <li key={i} className="text-xs font-bold flex gap-3"><span className="text-indigo-300">#</span>{act}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-4">Editing Suite</div>
                        <ul className="space-y-3">
                          {image_quality_analysis.action_plan.editing_suggestions.map((act, i) => (
                            <li key={i} className="text-xs font-bold flex gap-3"><span className="text-indigo-300">#</span>{act}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-4">Reshoot Reqs</div>
                        <ul className="space-y-3">
                          {image_quality_analysis.action_plan.reshoot_suggestions.map((act, i) => (
                            <li key={i} className="text-xs font-bold flex gap-3"><span className="text-indigo-300">#</span>{act}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default CustomAIAnalysis;
