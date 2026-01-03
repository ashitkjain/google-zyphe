
import React, { useState } from 'react';
import { CustomAIAnalysisResult } from '../types';

interface Props {
  analysis: CustomAIAnalysisResult;
  loading: boolean;
  onBack: () => void;
}

type TabType = 'interior' | 'rooms' | 'exterior';

const CustomAIAnalysis: React.FC<Props> = ({ analysis, loading, onBack }) => {
  const [activeTab, setActiveTab] = useState<TabType>('interior');

  if (loading) {
    return (
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-12 text-center my-10 shadow-sm flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative w-20 h-20 mb-8">
          <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
          <div className="absolute inset-0 border-t-4 border-indigo-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <i className="fa-solid fa-eye text-indigo-600 text-2xl animate-pulse"></i>
          </div>
        </div>
        <h3 className="text-3xl font-bold text-indigo-900 mb-4">Analyzing Property Visuals...</h3>
        <p className="text-indigo-700/70 max-w-md mx-auto text-lg">
          Gemini 3 Flash is scanning your property images to identify design styles, materials, and spatial quality.
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

  const { home_interior, room_highlights, exterior_and_neighborhood } = analysis;

  const tabs = [
    { id: 'interior', label: 'Interior', icon: 'fa-couch' },
    { id: 'rooms', label: 'Rooms', icon: 'fa-star' },
    { id: 'exterior', label: 'Exterior', icon: 'fa-tree' },
  ];

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
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 font-bold uppercase tracking-wider">
            <i className="fa-solid fa-bolt-lightning text-indigo-500"></i>
            Visual Intelligence Report
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 font-bold uppercase tracking-wider">
            <i className="fa-solid fa-shield-halved text-emerald-500"></i>
            AI Verified
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center sm:justify-start">
        <div className="inline-flex bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-3 px-6 py-3 rounded-xl font-black transition-all text-sm uppercase tracking-tight ${
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
                <div className="inline-block bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full mb-2">
                  {home_interior.design_style.style}
                </div>
                <p className="text-gray-600 text-base leading-relaxed">
                  {home_interior.design_style.reasoning}
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
                      <div className="text-2xl font-black mb-2">{home_interior.suggested_lifestyle.buyer_type}</div>
                      <p className="text-indigo-100/70 text-sm">{home_interior.suggested_lifestyle.lifestyle}</p>
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
          </section>
        )}

        {activeTab === 'rooms' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-100">
                <i className="fa-solid fa-star text-white text-xl"></i>
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-900">Space Analysis</h3>
                <p className="text-gray-500 text-sm font-medium">Standout features and potential upgrades</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {room_highlights.map((room, idx) => (
                <div key={idx} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group relative overflow-hidden flex flex-col">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                      <i className={`fa-solid ${room.room_name.toLowerCase().includes('kitchen') ? 'fa-kitchen-set' : 'fa-door-open'}`}></i>
                    </div>
                    <span className="text-[10px] font-black text-gray-400 uppercase bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">{room.floor}</span>
                  </div>
                  <h4 className="font-black text-gray-900 text-2xl mb-4 group-hover:text-purple-600 transition-colors">{room.room_name}</h4>
                  <p className="text-gray-600 text-base leading-relaxed mb-6">{room.description}</p>
                  
                  {room.potential_improvements && (
                    <div className="pt-6 border-t border-gray-100 bg-gray-50 -mx-8 -mb-8 p-8 mt-auto">
                      <div className="flex items-center gap-2 mb-3">
                        <i className="fa-solid fa-wand-magic-sparkles text-purple-600 text-sm"></i>
                        <div className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Enhancement Strategy</div>
                      </div>
                      <p className="text-gray-500 text-sm italic font-medium">"{room.potential_improvements}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'exterior' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-gray-900 rounded-[3rem] p-12 md:p-20 text-white relative overflow-hidden shadow-3xl">
              <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 relative z-10">
                <div>
                  <div className="flex items-center gap-6 mb-12">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-2xl shadow-emerald-500/20">
                      <i className="fa-solid fa-tree text-white text-3xl"></i>
                    </div>
                    <div>
                      <h3 className="text-4xl font-black">Exterior & Lot</h3>
                      <p className="text-emerald-400 font-bold uppercase tracking-widest text-sm mt-1">Grounds assessment</p>
                    </div>
                  </div>
                  
                  <div className="space-y-12">
                    <div className="group">
                      <h4 className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full group-hover:scale-150 transition-transform"></div>
                        Architecture & Style
                      </h4>
                      <p className="text-gray-300 text-xl leading-relaxed font-light">{exterior_and_neighborhood.exterior_and_lot_appeal.architecture_style}</p>
                    </div>
                    <div className="group">
                      <h4 className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full group-hover:scale-150 transition-transform"></div>
                        Curb Appeal & Landscaping
                      </h4>
                      <p className="text-gray-300 text-xl leading-relaxed font-light">{exterior_and_neighborhood.exterior_and_lot_appeal.curb_appeal}</p>
                    </div>
                    <div className="group">
                      <h4 className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full group-hover:scale-150 transition-transform"></div>
                        Outdoor Oasis
                      </h4>
                      <p className="text-gray-300 text-xl leading-relaxed font-light">{exterior_and_neighborhood.exterior_and_lot_appeal.backyard_and_patio}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-center">
                  <div className="bg-white/5 backdrop-blur-md rounded-[2.5rem] p-12 border border-white/10 shadow-inner">
                    <h4 className="text-2xl font-black mb-10 flex items-center gap-4">
                      <i className="fa-solid fa-mountain-sun text-orange-400"></i> Environmental Context
                    </h4>
                    
                    <div className="grid grid-cols-1 gap-10">
                      <div className="flex gap-6 items-start group">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex-shrink-0 flex items-center justify-center border border-white/10 group-hover:bg-orange-500/20 group-hover:border-orange-500/50 transition-all duration-500">
                          <i className="fa-solid fa-compass text-orange-400 text-xl"></i>
                        </div>
                        <div>
                          <div className="text-xs text-orange-400 font-black uppercase tracking-widest mb-2">Solar Orientation</div>
                          <p className="text-lg text-gray-200 leading-relaxed font-medium">{exterior_and_neighborhood.views_privacy_orientation.orientation}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-6 items-start group">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex-shrink-0 flex items-center justify-center border border-white/10 group-hover:bg-orange-500/20 group-hover:border-orange-500/50 transition-all duration-500">
                          <i className="fa-solid fa-panorama text-orange-400 text-xl"></i>
                        </div>
                        <div>
                          <div className="text-xs text-orange-400 font-black uppercase tracking-widest mb-2">Vista Perspectives</div>
                          <p className="text-lg text-gray-200 leading-relaxed font-medium">{exterior_and_neighborhood.views_privacy_orientation.views}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-6 items-start group">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex-shrink-0 flex items-center justify-center border border-white/10 group-hover:bg-orange-500/20 group-hover:border-orange-500/50 transition-all duration-500">
                          <i className="fa-solid fa-eye-slash text-orange-400 text-xl"></i>
                        </div>
                        <div>
                          <div className="text-xs text-orange-400 font-black uppercase tracking-widest mb-2">Privacy Index</div>
                          <p className="text-lg text-gray-200 leading-relaxed font-medium">{exterior_and_neighborhood.views_privacy_orientation.privacy}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Footer Action */}
      <div className="flex justify-center pt-10 border-t border-gray-100">
        <button 
          onClick={onBack}
          className="px-12 py-5 bg-gray-900 text-white rounded-2xl font-black text-lg shadow-2xl hover:bg-gray-800 hover:scale-[1.02] transition-all flex items-center gap-4 group"
        >
          <i className="fa-solid fa-check-circle text-emerald-400"></i>
          Finished Reviewing Report
        </button>
      </div>
    </div>
  );
};

export default CustomAIAnalysis;
