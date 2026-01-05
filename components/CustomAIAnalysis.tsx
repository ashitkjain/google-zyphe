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
}

type TabType = 'interior' | 'rooms' | 'exterior' | 'neighborhood' | 'pulse';

const CustomAIAnalysis: React.FC<Props> = ({ 
  analysis, 
  loading, 
  onBack, 
  onRefresh, 
  onRunComprehensive,
  comprehensiveResult,
  mapUrl 
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
      
      // If it's a Vertex AI or Google Search wrapper, try to extract the real target URI
      if (url.hostname.includes('vertexaisearch.cloud.google.com') || url.hostname.includes('google.com')) {
        const uriParam = url.searchParams.get('uri');
        if (uriParam) {
          url = new URL(uriParam);
        }
      }
      
      return url.hostname.replace('www.', '');
    } catch (e) {
      // If parsing fails, just try simple cleanup or return the raw string
      return src.replace(/^https?:\/\//, '').split('/')[0].replace('www.', '');
    }
  };

  const PulseCard = ({ title, data, icon, color }: { title: string, data?: CommunityPulseSection, icon: string, color: string }) => {
    if (!data || !data.summary) return null;
    
    // Deduplicate and clean hostnames
    const cleanSources = Array.from(new Set(data.sources?.map(getCleanDomain))).filter(Boolean);
    
    return (
      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col transition-all hover:shadow-xl hover:-translate-y-1">
        <div className="flex items-center gap-4 mb-6">
          <div className={`w-12 h-12 rounded-2xl bg-${color}-50 flex items-center justify-center text-${color}-600`}>
            <i className={`fa-solid ${icon} text-xl`}></i>
          </div>
          <h4 className="text-xl font-black text-gray-900 tracking-tight">{title}</h4>
        </div>
        <p className="text-gray-700 font-medium mb-4 leading-relaxed">{data.summary}</p>
        <ul className="space-y-3 mb-4 flex-1">
          {data.points?.map((pt, i) => (
            <li key={i} className="flex gap-3 text-gray-600 text-sm leading-relaxed">
              <span className={`w-1.5 h-1.5 rounded-full bg-${color}-400 mt-2 flex-shrink-0`}></span>
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
        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-3"
      >
        <i className="fa-solid fa-rotate"></i>
        Retry Analysis
      </button>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      {/* Top Action Bar */}
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
            className="flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 font-bold uppercase tracking-wider hover:bg-indigo-100 transition-colors"
          >
            <i className="fa-solid fa-rotate"></i>
            Refresh
          </button>
          
          <button 
            onClick={onRunComprehensive} 
            className="flex items-center gap-3 px-6 py-2.5 bg-gradient-to-r from-indigo-700 to-gray-900 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-[1.05] transition-all group"
          >
            <i className="fa-solid fa-file-invoice-dollar text-sm"></i>
            {comprehensiveResult ? 'Full Narrative Report' : 'Generate Full Report'}
          </button>

          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 font-bold uppercase tracking-wider">
            <i className="fa-solid fa-bolt-lightning text-indigo-500"></i>
            Zyphe™ Visual Intelligence
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center sm:justify-start">
        <div className="inline-flex bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm overflow-x-auto no-scrollbar max-w-full">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-3 px-6 py-3 rounded-xl font-black transition-all text-sm uppercase tracking-tight whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <i className={`fa-solid ${tab.icon} ${activeTab === tab.id ? 'text-white' : 'text-gray-400'}`}></i>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {activeTab === 'interior' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-4xl mx-auto">
            {!home_interior?.overall_description ? (
              <EmptyState section="Interior" />
            ) : (
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-10">
                {/* Overall Description */}
                <div className="space-y-4">
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-wide">Overall Description</h3>
                  <p className="text-gray-600 text-base leading-relaxed">
                    {home_interior.overall_description}
                  </p>
                </div>

                {/* Design Style */}
                <div className="space-y-4 pt-6 border-t border-gray-50">
                  <div className="flex items-center gap-3">
                    <i className="fa-solid fa-wand-magic-sparkles text-gray-400"></i>
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-wide">Design Style</h3>
                  </div>
                  {home_interior.design_style?.style && (
                    <div className="inline-block bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full mb-2">
                      {home_interior.design_style.style}
                    </div>
                  )}
                  <p className="text-gray-600 text-base leading-relaxed">
                    {home_interior.design_style?.reasoning || 'Analysis not available for this section.'}
                  </p>
                </div>

                {/* Color & Materials */}
                <div className="space-y-4 pt-6 border-t border-gray-50">
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-wide">Color & Materials</h3>
                  <p className="text-gray-600 text-base leading-relaxed">
                    {home_interior.color_and_materials}
                  </p>
                </div>

                {/* Lighting */}
                <div className="space-y-4 pt-6 border-t border-gray-50">
                  <div className="flex items-center gap-3">
                    <i className="fa-solid fa-lightbulb text-gray-400"></i>
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-wide">Lighting</h3>
                  </div>
                  <p className="text-gray-600 text-base leading-relaxed">
                    {home_interior.lighting}
                  </p>
                </div>

                {/* Spatial Flow */}
                <div className="space-y-4 pt-6 border-t border-gray-50">
                  <div className="flex items-center gap-3">
                    <i className="fa-solid fa-arrow-right text-gray-400"></i>
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-wide">Spatial Flow</h3>
                  </div>
                  <p className="text-gray-600 text-base leading-relaxed">
                    {home_interior.spatial_flow}
                  </p>
                </div>

                {/* Staging & Furnishings */}
                <div className="space-y-4 pt-6 border-t border-gray-50">
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-wide">Staging & Furnishings</h3>
                  <p className="text-gray-600 text-base leading-relaxed">
                    {home_interior.staging_and_furnishings}
                  </p>
                </div>

                {/* Condition & Finish */}
                <div className="space-y-4 pt-6 border-t border-gray-50">
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-wide">Condition & Finish</h3>
                  <p className="text-gray-600 text-base leading-relaxed">
                    {home_interior.condition_and_finish}
                  </p>
                </div>

                {/* Market Context Bottom Card */}
                <div className="pt-10">
                  <div className="bg-indigo-900 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-1">
                        <h4 className="text-indigo-300 text-xs font-black uppercase tracking-widest mb-2">Ideal Profile</h4>
                        <div className="text-2xl font-black mb-2 tracking-tight">{home_interior.suggested_lifestyle?.buyer_type || 'Prospective Resident'}</div>
                        <p className="text-indigo-100/70 text-sm">{home_interior.suggested_lifestyle?.lifestyle || 'Lifestyle analysis based on current interior features.'}</p>
                    </div>
                    <div className="flex -space-x-3">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="w-12 h-12 rounded-full border-4 border-indigo-900 bg-indigo-800 flex items-center justify-center">
                            <i className="fa-solid fa-user text-indigo-400 text-sm"></i>
                          </div>
                        ))}
                    </div>
                  </div>
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
                  <div key={idx} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group relative overflow-hidden flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <i className={`fa-solid ${room.room_name?.toLowerCase().includes('kitchen') ? 'fa-kitchen-set' : 'fa-door-open'}`}></i>
                      </div>
                      <span className="text-[10px] font-black text-gray-400 uppercase bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">{room.floor || 'N/A'}</span>
                    </div>
                    <h4 className="font-black text-gray-900 text-2xl mb-4 group-hover:text-purple-600 transition-colors tracking-tight">{room.room_name || 'Room Highlight'}</h4>
                    <p className="text-gray-600 text-base leading-relaxed mb-6">{room.description}</p>
                    
                    {room.potential_improvements && (
                      <div className="pt-6 border-t border-gray-100 bg-gray-50 -mx-8 -mb-8 p-8 mt-auto">
                        <div className="flex items-center gap-2 mb-3">
                          <i className="fa-solid fa-wand-magic-sparkles text-purple-600 text-sm"></i>
                          <div className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Potential Improvements</div>
                        </div>
                        <p className="text-gray-500 text-sm italic font-medium">"{room.potential_improvements}"</p>
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
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-4xl mx-auto">
            {!exterior_and_neighborhood?.exterior_and_lot_appeal?.architecture_style ? (
              <EmptyState section="Exterior" />
            ) : (
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-10">
                <div className="space-y-8">
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-wide">Exterior & Lot Appeal</h3>
                  
                  <div className="space-y-6 pl-0 md:pl-4 border-l-2 border-gray-50">
                    <div className="space-y-2">
                      <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">Architecture Style</h4>
                      <p className="text-gray-600 text-base leading-relaxed">
                        {exterior_and_neighborhood.exterior_and_lot_appeal.architecture_style}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">Curb Appeal</h4>
                      <p className="text-gray-600 text-base leading-relaxed">
                        {exterior_and_neighborhood.exterior_and_lot_appeal.curb_appeal}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">Backyard & Patio</h4>
                      <p className="text-gray-600 text-base leading-relaxed">
                        {exterior_and_neighborhood.exterior_and_lot_appeal.backyard_and_patio}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-8 pt-8 border-t border-gray-50">
                  <div className="flex items-center gap-3">
                    <i className="fa-solid fa-eye text-gray-400"></i>
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-wide">Views, Privacy & Orientation</h3>
                  </div>

                  <div className="space-y-6 pl-0 md:pl-4 border-l-2 border-gray-50">
                    <div className="space-y-2">
                      <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">Views</h4>
                      <p className="text-gray-600 text-base leading-relaxed">
                        {exterior_and_neighborhood.views_privacy_orientation?.views || 'Not specified.'}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">Orientation</h4>
                      <p className="text-gray-600 text-base leading-relaxed">
                        {exterior_and_neighborhood.views_privacy_orientation?.orientation || 'Not specified.'}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">Privacy</h4>
                      <p className="text-gray-600 text-base leading-relaxed">
                        {exterior_and_neighborhood.views_privacy_orientation?.privacy || 'Not specified.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-10">
                  <div className="bg-emerald-900 rounded-3xl p-8 text-white flex items-center gap-6">
                    <div className="w-16 h-16 bg-emerald-800 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                      <i className="fa-solid fa-leaf text-emerald-400 text-2xl"></i>
                    </div>
                    <div>
                      <h4 className="text-emerald-300 text-xs font-black uppercase tracking-widest mb-1">Environmental Assessment</h4>
                      <p className="text-lg font-medium">The property grounds demonstrate characteristic architectural integrity suitable for the regional environment.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'neighborhood' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-7xl mx-auto">
            {!neighborhood?.overview ? (
              <EmptyState section="Neighborhood" />
            ) : (
              <div className="bg-[#F3F4F6] rounded-[2.5rem] p-6 sm:p-10 space-y-10">
                <div className="flex flex-col lg:flex-row gap-10 items-center">
                  <div className="lg:w-[15%] flex-shrink-0">
                    <div className="bg-white rounded-2xl p-3 shadow-xl shadow-gray-200/50 border border-white">
                      <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative group">
                        {mapUrl ? (
                          <img src={mapUrl} alt="Neighborhood Context" className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <i className="fa-solid fa-map-marked-alt text-3xl"></i>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none"></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3">
                    <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-3">
                      <span className="w-8 h-[2px] bg-indigo-600"></span>
                      Neighborhood Overview
                    </h3>
                    <p className="text-gray-700 text-xl font-medium leading-relaxed italic">
                      "{neighborhood.overview}"
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(neighborhood.neighborhood_features || {}).map(([key, value]) => {
                    const labels: Record<string, string> = {
                      general: 'General Characteristics',
                      topography: 'Topography',
                      nearby_amenities: 'Nearby Amenities',
                      development_patterns: 'Development Patterns',
                      neighborhood_density: 'Neighborhood Density',
                      transportation_access: 'Transportation Access',
                      walkability_indicators: 'Walkability Indicators',
                      street_layout_and_traffic: 'Street Layout & Traffic',
                      sidewalks_and_pedestrian_infra: 'Sidewalks & Pedestrian Infra',
                      proximity_to_greenery_and_water: 'Proximity to Greenery & Water'
                    };

                    return (
                      <div 
                        key={key} 
                        className="bg-white p-6 sm:p-8 rounded-[2rem] border border-white shadow-sm flex flex-col justify-start group transition-all hover:shadow-xl hover:-translate-y-1"
                      >
                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-indigo-500"></span>
                          {labels[key] || key.replace(/_/g, ' ')}
                        </h4>
                        <p className="text-gray-700 text-sm sm:text-base leading-relaxed">
                          {value as string}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'pulse' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {!community_pulse ? (
              <EmptyState section="Community Pulse" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <PulseCard 
                  title="What Residents Like" 
                  data={community_pulse.what_residents_like} 
                  icon="fa-heart" 
                  color="emerald" 
                />
                <PulseCard 
                  title="Common Complaints" 
                  data={community_pulse.common_complaints} 
                  icon="fa-circle-exclamation" 
                  color="rose" 
                />
                <PulseCard 
                  title="Safety & Concerns" 
                  data={community_pulse.safety_and_concerns} 
                  icon="fa-shield-halved" 
                  color="orange" 
                />
                <PulseCard 
                  title="Schools & Family" 
                  data={community_pulse.schools_family_friendliness} 
                  icon="fa-children" 
                  color="blue" 
                />
                <PulseCard 
                  title="Lifestyle & Commute" 
                  data={community_pulse.lifestyle_convenience} 
                  icon="fa-route" 
                  color="purple" 
                />
                <PulseCard 
                  title="Investment Insights" 
                  data={community_pulse.investment_insights} 
                  icon="fa-chart-line" 
                  color="indigo" 
                />
              </div>
            )}
          </section>
        )}
      </div>

      {/* Footer Action */}
      <div className="flex flex-col items-center gap-8 pt-10 border-t border-gray-100">
        <button 
          onClick={onBack}
          className="text-gray-400 hover:text-gray-600 font-bold uppercase tracking-widest text-xs transition-colors"
        >
          Return to Summary Overview
        </button>
      </div>
    </div>
  );
};

export default CustomAIAnalysis;