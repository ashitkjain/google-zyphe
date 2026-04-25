
import React, { useState, useEffect } from 'react';
import { ComprehensiveAnalysisResult } from '../../types';

interface Props {
  analysis: ComprehensiveAnalysisResult | null;
  loading: boolean;
  onBack: () => void;
  address?: string;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  hideHeader?: boolean;
}

const serif = "'Instrument Serif', Georgia, serif";
const mono = "'JetBrains Mono', ui-monospace, monospace";

const ComprehensiveAnalysis: React.FC<Props> = ({ analysis, loading, onBack, address, isFavorited, onToggleFavorite, hideHeader }) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let interval: number;
    if (loading) {
      setSeconds(0);
      interval = window.setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-12 text-center bg-white rounded-[3rem] shadow-xl border border-gray-100 my-10 animate-in fade-in duration-500">
        <div className="relative mb-12">
          <div className="w-24 h-24 border-8 border-indigo-50 rounded-full"></div>
          <div className="absolute inset-0 border-t-8 border-indigo-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <i className="fa-solid fa-feather-pointed text-indigo-600 text-3xl animate-pulse"></i>
          </div>
        </div>
        <h2 className="text-5xl font-normal text-gray-900 mb-6 tracking-tight" style={{ fontFamily: serif }}>Drafting Comprehensive Intelligence...</h2>

        <div className="mb-10">
          <span className="px-6 py-3 bg-indigo-50 border border-indigo-100 rounded-full text-sm font-bold text-indigo-600 uppercase tracking-[0.2em] shadow-sm inline-flex items-center gap-3" style={{ fontFamily: mono }}>
            <i className="fa-solid fa-stopwatch animate-bounce"></i>
            Report Compilation: <span className="font-mono text-base">{seconds}s</span>
          </span>
        </div>

        <p className="text-gray-500 max-w-xl mx-auto text-lg leading-relaxed font-medium">
          Zyphe AI is currently synthesizing multi-source data, search grounding, and visual scans into a professional narrative report. This usually takes 30-60 seconds.
        </p>
      </div>
    );
  }

  if (!analysis) return null;

  const renderContent = (text?: string) => {
    if (!text) return null;
    if (typeof text !== 'string') return String(text);
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => (
      i % 2 === 1 ? <strong key={i} className="text-gray-900 font-bold">{part}</strong> : part
    ));
  };

  const SectionTitleBar = ({ kicker, title, italicWord, color }: { kicker: string, title: string, italicWord?: string, color: string }) => {
    const parts = italicWord && title.includes(italicWord) ? title.split(italicWord) : null;
    return (
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-6" style={{ background: color }}></div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ fontFamily: mono, color }}>{kicker}</span>
        </div>
        <h3 className="text-3xl font-normal text-gray-900 tracking-tight" style={{ fontFamily: serif }}>
          {parts ? <>{parts[0]}<em style={{ color, fontStyle: 'italic' }}>{italicWord}</em>{parts[1]}</> : title}
        </h3>
      </div>
    );
  };

  const SectionCard = ({ kicker, title, italicWord, icon, content, color, colorClass = "text-gray-700" }: { kicker: string, title: string, italicWord?: string, icon: string, content: string | undefined, color: string, colorClass?: string }) => {
    if (!content) return null;
    return (
      <div 
        className="rounded-[2.5rem] pt-8 pb-10 px-10 md:pt-10 md:pb-12 md:px-12 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative overflow-hidden group"
        style={{ 
          background: `linear-gradient(135deg, ${color}0d 0%, #fff 100%)`,
          border: `1px solid ${color}15`,
          boxShadow: `0 25px 50px -12px ${color}10`
        }}
      >
        {/* Subtle corner accent */}
        <div className="absolute top-0 right-0 w-64 h-64 opacity-[0.05] pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-700" style={{ background: `radial-gradient(circle at top right, ${color}, transparent 70%)` }}></div>
        
        <div className="flex items-start gap-5 mb-6 relative z-10">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0" style={{ background: `${color}15`, color }}>
            <i className={`fa-solid ${icon} text-lg`}></i>
          </div>
          <SectionTitleBar kicker={kicker} title={title} italicWord={italicWord} color={color} />
        </div>
        <div className={`text-[15.33px] font-sans font-medium ${colorClass} leading-relaxed text-justify px-2 md:px-4 relative z-10`}>
          {renderContent(content)}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-20">
      {!hideHeader && (
        <div className="flex items-center justify-between mb-12 sticky top-0 z-40 bg-gray-50/80 backdrop-blur-md py-6 -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={onBack}
            className="flex items-center gap-3 px-6 py-3 bg-white border border-gray-200 rounded-xl font-bold text-[11px] uppercase tracking-widest text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition-all group w-fit"
            style={{ fontFamily: mono }}
          >
            <i className="fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
            Back to Visual Analysis
          </button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleFavorite}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-sm ${isFavorited ? 'bg-rose-50 text-rose-500 border border-rose-100' : 'bg-white text-slate-300 border border-slate-200 hover:text-rose-400 hover:bg-rose-50/50'}`}
                title={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
              >
                <i className={`${isFavorited ? 'fa-solid' : 'fa-regular'} fa-heart text-xl`}></i>
              </button>
            </div>
            <button
              onClick={() => window.print()}
              className="w-12 h-12 flex items-center justify-center bg-white border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
            >
              <i className="fa-solid fa-print text-gray-600"></i>
            </button>
            <div className="bg-gradient-to-r from-indigo-700 to-gray-900 text-white px-6 py-3 rounded-xl font-bold text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-100" style={{ fontFamily: mono }}>
              Professional Report
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <SectionCard
          kicker="Executive Snapshot"
          title="The property at a glance"
          italicWord="glance"
          icon="fa-arrow-trend-up"
          content={analysis.summary}
          color="#4f46e5"
          colorClass="text-gray-800"
        />

        {analysis.interior_summary && (
          <div 
            className="rounded-[2.5rem] p-8 md:p-10 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative overflow-hidden group"
            style={{ 
              background: `linear-gradient(135deg, #0d94880d 0%, #fff 100%)`,
              border: `1px solid #0d948815`,
              boxShadow: `0 25px 50px -12px #0d948810`
            }}
          >
            {/* Subtle corner accent */}
            <div className="absolute top-0 right-0 w-64 h-64 opacity-[0.05] pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-700" style={{ background: `radial-gradient(circle at top right, #0d9488, transparent 70%)` }}></div>
            
            <div className="flex items-start gap-5 mb-8 relative z-10">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
                <i className="fa-solid fa-wand-magic-sparkles text-xl"></i>
              </div>
              <SectionTitleBar kicker="Interior Vibe" title="Atmosphere & spaces" italicWord="Atmosphere" color="#0d9488" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-8">
                <div>
                  <p className="text-[15.33px] text-gray-700 leading-relaxed font-medium">
                    {analysis.interior_summary.interior_summary}
                  </p>
                </div>
                {analysis.interior_summary.rooms_summary && (
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2" style={{ fontFamily: mono }}>
                      <i className="fa-solid fa-door-open text-indigo-400"></i>
                      Spaces
                    </div>
                    <p className="text-[15.33px] text-gray-700 leading-relaxed font-medium">
                      {analysis.interior_summary.rooms_summary}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-8">
                {analysis.interior_summary.vibe && (
                  <div className="p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                    <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2" style={{ fontFamily: mono }}>
                      <i className="fa-solid fa-palette"></i>
                      Aesthetic Vibe
                    </div>
                    <div className="text-[17px] font-bold text-indigo-900 tracking-tight leading-snug" style={{ fontFamily: serif, fontStyle: 'italic' }}>
                      {analysis.interior_summary.vibe}
                    </div>
                  </div>
                )}
                {analysis.interior_summary.objective_tags && analysis.interior_summary.objective_tags.length > 0 && (
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2" style={{ fontFamily: mono }}>
                      <i className="fa-solid fa-tags"></i>
                      Physical Attributes
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {analysis.interior_summary.objective_tags.map((tag, idx) => (
                        <span key={idx} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 shadow-sm" style={{ fontFamily: mono }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <SectionCard
          kicker="Architecture"
          title="Architectural appeal & condition"
          italicWord="appeal"
          icon="fa-house-circle-check"
          content={analysis.detailed_analysis?.visual_appeal_condition}
          color="#2563eb"
        />
        <SectionCard
          kicker="Layout & Expansion"
          title="Privacy, layout & potential"
          italicWord="potential"
          icon="fa-maximize"
          content={analysis.detailed_analysis?.privacy_layout}
          color="#9333ea"
        />
        <SectionCard
          kicker="Outdoor Living"
          title="Outdoors & view quality"
          italicWord="Outdoors"
          icon="fa-eye"
          content={analysis.detailed_analysis?.outdoors_view_quality}
          color="#16a34a"
        />
        <SectionCard
          kicker="Neighborhood"
          title="Location & neighborhood context"
          italicWord="context"
          icon="fa-location-dot"
          content={analysis.detailed_analysis?.location_neighborhood}
          color="#d97706"
        />
        <SectionCard
          kicker="Community Pulse"
          title="The neighborhood vibe & people"
          italicWord="vibe"
          icon="fa-users"
          content={analysis.detailed_analysis?.community_pulse}
          color="#db2777"
        />
        <SectionCard
          kicker="Tech & Infra"
          title="Infrastructure & smart tech"
          italicWord="smart"
          icon="fa-sliders"
          content={analysis.detailed_analysis?.additional_considerations}
          color="#0891b2"
        />
        <SectionCard
          kicker="Resilience"
          title="Climate resilience & sustainability"
          italicWord="resilience"
          icon="fa-cloud-bolt"
          content={analysis.detailed_analysis?.climate_resilience}
          color="#ea580c"
        />

        {analysis.strategic_insights && (
          <div className="bg-indigo-900 rounded-[3rem] p-10 md:p-16 border border-indigo-950 shadow-2xl mb-12 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-indigo-500/20 transition-all duration-1000"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-slate-500/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl"></div>

            <div className="relative z-10">
              <div className="flex items-center gap-6 mb-10">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/20 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-indigo-900/50">
                  <i className="fa-solid fa-brain-circuit text-2xl"></i>
                </div>
                <div>
                  <SectionTitleBar kicker="Senior Strategist" title="Strategic forensics" italicWord="forensics" color="#fcd34d" />
                  <p className="text-indigo-300 text-[11px] font-bold uppercase tracking-[0.25em] -mt-4" style={{ fontFamily: mono }}>Investment Thesis</p>
                </div>
              </div>

              <div className="text-indigo-100 leading-relaxed text-[17px] font-medium text-justify px-2 md:px-6 italic">
                {renderContent(analysis.strategic_insights)}
              </div>
            </div>
          </div>
        )}

        {analysis.risks_considerations && (
          <div 
            className="rounded-[2.5rem] p-10 md:p-12 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative overflow-hidden group"
            style={{ 
              background: `linear-gradient(135deg, #e11d480d 0%, #fff 100%)`,
              border: `1px solid #e11d4815`,
              boxShadow: `0 25px 50px -12px #e11d4810`
            }}
          >
            {/* Subtle corner accent */}
            <div className="absolute top-0 right-0 w-64 h-64 opacity-[0.05] pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-700" style={{ background: `radial-gradient(circle at top right, #e11d48, transparent 70%)` }}></div>
            
            <div className="flex items-start gap-5 mb-6 relative z-10">
              <div className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200 flex-shrink-0">
                <i className="fa-solid fa-triangle-exclamation text-xl"></i>
              </div>
              <SectionTitleBar kicker="Risk Advisory" title="Critical risks & considerations" italicWord="Critical" color="#e11d48" />
            </div>
            <div className="text-rose-800 leading-relaxed text-[15.33px] font-sans font-medium text-justify px-2 md:px-4 relative z-10">
              {renderContent(analysis.risks_considerations)}
            </div>
          </div>
        )}

      </div>
    </div >
  );
};

export default ComprehensiveAnalysis;
