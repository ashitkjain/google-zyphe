import React, { useState } from 'react';
import { CustomAIAnalysisResult, CommunityPulseSection, ComprehensiveAnalysisResult } from '../types';

interface Props {
  analysis: CustomAIAnalysisResult | null;
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onRunComprehensive: () => void;
  comprehensiveResult: ComprehensiveAnalysisResult | null;
  mapUrl?: string;
  hasImages: boolean;
}

type TabType = 'interior' | 'rooms' | 'exterior' | 'neighborhood' | 'pulse';

const CustomAIAnalysis: React.FC<Props> = ({ 
  analysis, 
  loading, 
  onBack, 
  onRefresh, 
  onRunComprehensive,
  comprehensiveResult,
  mapUrl,
  hasImages
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('interior');

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
        <h3 className="text-3xl font-bold text-indigo-900 mb-4">Zyphe™ Visual Scanning...</h3>
        <p className="text-indigo-700/70 max-w-md mx-auto text-lg">
          Our multimodal engine is dissecting architecture and neighborhood context.
        </p>
        <div className="mt-12 flex gap-3">
          <div className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const { 
    home_interior = {} as any, 
    room_highlights = [], 
    exterior_and_neighborhood = {} as any, 
    neighborhood,
    community_pulse
  } = analysis;

  const tabs = [
    { id: 'interior', label: 'Interior', icon: 'fa-couch' },
    { id: 'rooms', label: 'Rooms', icon: 'fa-star' },
    { id: 'exterior', label: 'Exterior', icon: 'fa-tree' },
    { id: 'neighborhood', label: 'Neighborhood', icon: 'fa-map-location-dot' },
    { id: 'pulse', label: 'Community Pulse', icon: 'fa-users-viewfinder' },
  ];

  const getCleanDomain = (src: string) => {
    try {
      let url = new URL(src);
      if (url.hostname.includes('vertexaisearch.cloud.google.com') || url.hostname.includes('google.com')) {
        const uriParam = url.searchParams.get('uri');
        if (uriParam) {
          url = new URL(uriParam);
        }
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
          <div className={`w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600`}>
            <i className={`fa-solid ${icon} text-xl`}></i>
          </div>
          <h4 className="text-xl font-black text-gray-900 tracking-tight">{title}</h4>
        </div>
        <p className="text-gray-700 font-medium mb-4 leading-relaxed">{data.summary}</p>
        <ul className="space-y-3 mb-4 flex-1">
          {data.points?.map((pt, i) => (
            <li key={i} className="flex gap-3 text-gray-600 text-sm leading-relaxed">
              <span className={`w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 flex-shrink-0`}></span>
              {pt}
            </li>
          ))}
        </ul>
        {cleanSources.length > 0 && (
          <div className="pt-4 border-t border-gray-50">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Sources</div>
            <div className="text-[10px] text-gray-400 font-medium leading-relaxed italic">
              {cleanSources.join(', ')}
            </div>
          </div>
        )}
      </div>
    );
  };

  const EmptyState = ({ section }: { section: string }) => (
    <div className="p-20 bg-white/50 rounded-[2rem] text-center border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-gray-400">
        <i className="fa-solid fa-magnifying-glass-chart text-3xl"></i>
      </div>
      <h4 className="text-xl font-bold text-gray-800 mb-2">Analysis Missing for {section}</h4>
      <p className="text-gray-500 max-w-sm mx-auto mb-8">This section of the report couldn't be generated from the available data.</p>
      <button 
        onClick={onRefresh}
        className="px-8 py-3 bg-gradient-to-r from-indigo-700 to-gray-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-[1.05] transition-all flex items-center gap-3"
      >
        <i className="fa-solid fa-rotate"></i>
        Retry Analysis
      </button>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-3 px-6 py-3 bg-white border border-gray-200 rounded-2xl text-gray-700 font-bold shadow-sm hover:shadow-md hover:bg-gray-50 transition-all group w-fit"
        >
          <i className="fa-solid fa-arrow-left transition-transform group-hover:-translate-x-1"></i>
          Back to Overview
        </button>
        
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={onRefresh}
            title="Refresh current analysis"
            className="flex items-center gap-2 text-[10px] text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 font-black uppercase tracking-wider hover:bg-indigo-100 transition-colors"
          >
            <i className="fa-solid fa-rotate"></i>
            Refresh
          </button>
          
          <button 
            onClick={onRunComprehensive} 
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-indigo-700 to-gray-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-[1.05] active:scale-95 transition-all group"
          >
            <i className="fa-solid fa-file-invoice-dollar text-sm"></i>
            {comprehensiveResult ? 'Full Narrative Report' : 'Generate Full Report'}
          </button>

          <div className="flex items-center gap-2 text-[10px] text-gray-400 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 font-black uppercase tracking-wider">
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
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-4xl mx-auto">
            {!home_interior?.overall_description ? (
              <EmptyState section="Interior" />
            ) : (
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-10">
                <div className="space-y-4">
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-wide">Overall Description</h3>
                  <p className="text-gray-600 text-base leading-relaxed">{home_interior.overall_description}</p>
                </div>
                <div className="space-y-4 pt-6 border-t border-gray-50">
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-wide">Design Style</h3>
                  {home_interior.design_style?.style && (
                    <div className="inline-block bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase px-3 py-1.5 rounded-full mb-2">
                      {home_interior.design_style.style}
                    </div>
                  )}
                  <p className="text-gray-600 text-base leading-relaxed">{home_interior.design_style?.reasoning}</p>
                </div>
                <div className="space-y-4 pt-6 border-t border-gray-50">
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-wide">Color & Materials</h3>
                  <p className="text-gray-600 text-base leading-relaxed">{home_interior.color_and_materials}</p>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'rooms' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {room_highlights.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {room_highlights.map((room, idx) => (
                  <div key={idx} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                        <i className={`fa-solid ${room.room_name?.toLowerCase().includes('kitchen') ? 'fa-kitchen-set' : 'fa-door-open'}`}></i>
                      </div>
                      <span className="text-[10px] font-black text-gray-400 uppercase bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">{room.floor || 'N/A'}</span>
                    </div>
                    <h4 className="font-black text-gray-900 text-2xl mb-4 tracking-tight">{room.room_name}</h4>
                    <p className="text-gray-600 text-base leading-relaxed mb-6">{room.description}</p>
                    {room.potential_improvements && (
                      <div className="pt-6 border-t border-gray-100 bg-gray-50 -mx-8 -mb-8 p-8 mt-auto">
                        <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3">Enhancement Strategy</div>
                        <p className="text-gray-500 text-sm italic">"{room.potential_improvements}"</p>
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
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-4xl mx-auto space-y-8">
             {!exterior_and_neighborhood?.exterior_and_lot_appeal?.architecture_style ? (
              <EmptyState section="Exterior" />
            ) : (
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">
                {/* Lot & Architecture */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <i className="fa-solid fa-house-chimney text-indigo-600"></i>
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-wide">Exterior & Lot Appeal</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Architectural Style</h4>
                      <p className="text-gray-600 text-sm leading-relaxed">{exterior_and_neighborhood.exterior_and_lot_appeal.architecture_style}</p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Curb Appeal</h4>
                      <p className="text-gray-600 text-sm leading-relaxed">{exterior_and_neighborhood.exterior_and_lot_appeal.curb_appeal}</p>
                    </div>
                    <div className="col-span-full space-y-2">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Backyard & Outdoor Living</h4>
                      <p className="text-gray-600 text-sm leading-relaxed">{exterior_and_neighborhood.exterior_and_lot_appeal.backyard_and_patio}</p>
                    </div>
                  </div>
                </div>

                {/* Views & Privacy */}
                {exterior_and_neighborhood.views_privacy_orientation && (
                  <div className="pt-10 border-t border-gray-50 space-y-6">
                    <div className="flex items-center gap-3">
                      <i className="fa-solid fa-compass text-indigo-600"></i>
                      <h3 className="text-lg font-black text-gray-900 uppercase tracking-wide">Views, Privacy & Orientation</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scenic Views</h4>
                        <p className="text-gray-600 text-sm leading-relaxed">{exterior_and_neighborhood.views_privacy_orientation.views}</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sun Exposure</h4>
                        <p className="text-gray-600 text-sm leading-relaxed">{exterior_and_neighborhood.views_privacy_orientation.orientation}</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Privacy Level</h4>
                        <p className="text-gray-600 text-sm leading-relaxed">{exterior_and_neighborhood.views_privacy_orientation.privacy}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Street Level Insights */}
                {exterior_and_neighborhood.neighborhood_street_insights && (
                  <div className="pt-10 border-t border-gray-50 space-y-4">
                    <div className="flex items-center gap-3">
                      <i className="fa-solid fa-road text-indigo-600"></i>
                      <h3 className="text-lg font-black text-gray-900 uppercase tracking-wide">Street-Level Insights</h3>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed italic">{exterior_and_neighborhood.neighborhood_street_insights}</p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === 'neighborhood' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-4xl mx-auto">
             {neighborhood ? (
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8 md:p-12 space-y-10">
                <div className="space-y-4">
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-wide">Neighborhood Context</h3>
                  <p className="text-gray-600 text-base leading-relaxed">{neighborhood.overview}</p>
                </div>
                
                {neighborhood.neighborhood_features && (
                  <div className="pt-10 border-t border-gray-50 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    {Object.entries(neighborhood.neighborhood_features).map(([key, value]) => {
                      if (!value || key === 'general') return null;
                      const label = key
                        .split('_')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                      
                      return (
                        <div key={key} className="space-y-2">
                          <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-indigo-600"></span>
                            {label}
                          </h4>
                          <p className="text-gray-600 text-sm leading-relaxed">{value as string}</p>
                        </div>
                      );
                    })}
                    {neighborhood.neighborhood_features.general && (
                      <div className="col-span-1 md:col-span-2 space-y-2 pt-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Additional Spatial Notes</h4>
                        <p className="text-gray-500 text-sm italic leading-relaxed">
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
      </div>
    </div>
  );
};

export default CustomAIAnalysis;