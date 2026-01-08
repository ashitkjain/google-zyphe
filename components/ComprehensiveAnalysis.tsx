
import React, { useState, useEffect } from 'react';
import { ComprehensiveAnalysisResult } from '../types';

interface Props {
  analysis: ComprehensiveAnalysisResult | null;
  loading: boolean;
  onBack: () => void;
  address?: string;
}

const ComprehensiveAnalysis: React.FC<Props> = ({ analysis, loading, onBack, address }) => {
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
        <h2 className="text-4xl font-black text-gray-900 mb-6 tracking-tight">Drafting Comprehensive Intelligence...</h2>
        
        <div className="mb-10">
          <span className="px-6 py-3 bg-indigo-50 border border-indigo-100 rounded-full text-sm font-black text-indigo-600 uppercase tracking-[0.2em] shadow-sm inline-flex items-center gap-3">
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
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => (
      i % 2 === 1 ? <strong key={i} className="text-gray-900 font-black">{part}</strong> : part
    ));
  };

  const SectionCard = ({ title, icon, content, colorClass = "text-gray-700" }: { title: string, icon: string, content: string, colorClass?: string }) => (
    <div className="bg-white rounded-[2.5rem] p-10 md:p-12 border border-gray-100 shadow-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-6">
        <i className={`fa-solid ${icon} text-indigo-600 text-lg`}></i>
        <h3 className="text-xl font-black text-gray-900 tracking-tight">{title}</h3>
      </div>
      <div className={`text-sm font-sans font-medium ${colorClass} leading-relaxed text-justify`}>
        {renderContent(content)}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-20">
      <div className="flex items-center justify-between mb-8 sticky top-24 z-40 bg-gray-50/80 backdrop-blur-md py-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-3 px-6 py-3 bg-white border border-gray-200 rounded-xl font-black text-[10px] uppercase tracking-widest text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition-all group w-fit"
        >
          <i className="fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
          Back to Visual Analysis
        </button>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.print()}
            className="w-12 h-12 flex items-center justify-center bg-white border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          >
            <i className="fa-solid fa-print text-gray-600"></i>
          </button>
          <div className="bg-gradient-to-r from-indigo-700 to-gray-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100">
            Professional Report
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <SectionCard title="Executive Summary" icon="fa-arrow-trend-up" content={analysis.summary} colorClass="text-gray-800" />
        <SectionCard title="Location & Neighborhood" icon="fa-location-dot" content={analysis.detailed_analysis?.location_neighborhood} />
        <SectionCard title="Outdoors & View Quality" icon="fa-eye" content={analysis.detailed_analysis?.outdoors_view_quality} />
        <SectionCard title="Architectural Appeal & Condition" icon="fa-house-circle-check" content={analysis.detailed_analysis?.visual_appeal_condition} />
        <SectionCard title="Privacy, Layout & Expansion" icon="fa-maximize" content={analysis.detailed_analysis?.privacy_layout} />
        <SectionCard title="Climate Resilience & Sustainability" icon="fa-cloud-bolt" content={analysis.detailed_analysis?.climate_resilience} />
        <SectionCard title="Infrastructure & Tech" icon="fa-sliders" content={analysis.detailed_analysis?.additional_considerations} />

        <div className="bg-rose-50/50 rounded-[2.5rem] p-10 md:p-12 border border-rose-100 shadow-sm mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
              <i className="fa-solid fa-triangle-exclamation text-xl"></i>
            </div>
            <h3 className="text-xl font-black text-rose-900 tracking-tight">Critical Risks & Considerations</h3>
          </div>
          <div className="text-rose-800 leading-relaxed text-sm font-sans font-medium text-justify">
            {renderContent(analysis.risks_considerations)}
          </div>
        </div>

        <div className="bg-white rounded-[3rem] p-10 md:p-16 border border-gray-100 shadow-sm mt-10">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Lifestyle Suitability Assessment</h2>
            <p className="text-gray-400 font-black text-[9px] uppercase tracking-[0.3em]">AI-Driven Compatibility Score</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {[
              { title: 'Families & Education', content: analysis.lifestyle_fit?.families, color: 'indigo', icon: 'fa-children' },
              { title: 'Professionals & Remote Work', content: analysis.lifestyle_fit?.professionals, color: 'indigo', icon: 'fa-laptop-code' },
              { title: 'Retirees & Accessibility', content: analysis.lifestyle_fit?.retirees, color: 'indigo', icon: 'fa-wheelchair' },
              { title: 'Investors & Wealth Growth', content: analysis.lifestyle_fit?.investors, color: 'indigo', icon: 'fa-chart-line' },
            ].map((item, idx) => (
              <div 
                key={idx} 
                className="space-y-4 p-8 rounded-[2rem] transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl border border-transparent cursor-default bg-slate-50/50 hover:border-indigo-100"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-indigo-600`}>
                    <i className={`fa-solid ${item.icon} text-lg`}></i>
                  </div>
                  <h4 className="font-black text-gray-900 text-[11px] uppercase tracking-wider">{item.title}</h4>
                </div>
                <p className="text-gray-700 text-sm font-sans font-medium leading-relaxed text-justify">{renderContent(item.content)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <SectionCard title="Intelligence Verdict" icon="fa-gavel" content={analysis.buyer_recommendation} colorClass="text-gray-900 font-black italic text-sm" />
        </div>

        <div className="pt-20 flex flex-col items-center gap-6">
          <div className="h-px bg-gray-200 w-full max-w-sm"></div>
          <div className="text-[12px] font-black text-gray-400 uppercase tracking-[0.6em]">
            ZYPHE INTELLIGENCE SYSTEMS • V2.5
          </div>
          <div className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComprehensiveAnalysis;
