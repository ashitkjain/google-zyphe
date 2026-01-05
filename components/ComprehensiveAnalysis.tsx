import React from 'react';
import { ComprehensiveAnalysisResult } from '../types';

interface Props {
  analysis: ComprehensiveAnalysisResult | null;
  loading: boolean;
  onBack: () => void;
  address?: string;
}

const ComprehensiveAnalysis: React.FC<Props> = ({ analysis, loading, onBack, address }) => {
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
        <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">Drafting Comprehensive Intelligence...</h2>
        <p className="text-gray-500 max-w-xl mx-auto text-lg leading-relaxed">
          Zyphe AI is currently synthesizing multi-source data, search grounding, and visual scans into a professional narrative report. This usually takes 30-60 seconds.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <span className="px-4 py-2 bg-gray-50 rounded-full text-xs font-bold text-gray-400 uppercase tracking-widest border border-gray-100">Market Grounding</span>
          <span className="px-4 py-2 bg-gray-50 rounded-full text-xs font-bold text-gray-400 uppercase tracking-widest border border-gray-100">Permit Lookup</span>
          <span className="px-4 py-2 bg-gray-50 rounded-full text-xs font-bold text-gray-400 uppercase tracking-widest border border-gray-100">Narrative Synthesis</span>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const renderContent = (text?: string) => {
    if (!text) return null;
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => (
      i % 2 === 1 ? <strong key={i} className="text-gray-900 font-bold">{part}</strong> : part
    ));
  };

  const SectionCard = ({ title, icon, content, colorClass = "text-gray-700" }: { title: string, icon: string, content: string, colorClass?: string }) => (
    <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-5">
        <i className={`fa-solid ${icon} text-gray-700 text-base`}></i>
        <h3 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h3>
      </div>
      <div className={`text-base ${colorClass} leading-relaxed text-justify`}>
        {renderContent(content)}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-20">
      {/* Report Controls */}
      <div className="flex items-center justify-between mb-8 sticky top-24 z-40 bg-gray-50/80 backdrop-blur-md py-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-3 px-6 py-3 bg-white border border-gray-200 rounded-2xl text-gray-700 font-bold shadow-sm hover:bg-gray-50 transition-all group"
        >
          <i className="fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
          Back to Overview
        </button>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.print()}
            className="w-12 h-12 flex items-center justify-center bg-white border border-gray-200 rounded-2xl text-gray-500 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"
          >
            <i className="fa-solid fa-print"></i>
          </button>
          <div className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-200">
            Professional Report
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Executive Summary Card */}
        <SectionCard 
          title="Summary" 
          icon="fa-arrow-trend-up" 
          content={analysis.summary} 
        />

        {/* Detailed Analysis Cards */}
        <SectionCard 
          title="Location & Neighborhood" 
          icon="fa-location-dot" 
          content={analysis.detailed_analysis?.location_neighborhood} 
        />

        <SectionCard 
          title="Outdoors & View Quality" 
          icon="fa-eye" 
          content={analysis.detailed_analysis?.outdoors_view_quality} 
        />

        <SectionCard 
          title="Architectural Appeal & Condition" 
          icon="fa-house-circle-check" 
          content={analysis.detailed_analysis?.visual_appeal_condition} 
        />

        <SectionCard 
          title="Privacy, Layout & Expansion" 
          icon="fa-maximize" 
          content={analysis.detailed_analysis?.privacy_layout} 
        />

        <SectionCard 
          title="Climate Resilience & Sustainability" 
          icon="fa-cloud-bolt" 
          content={analysis.detailed_analysis?.climate_resilience} 
        />

        <SectionCard 
          title="Infrastructure & Special Features" 
          icon="fa-sliders" 
          content={analysis.detailed_analysis?.additional_considerations} 
        />

        {/* Critical Risks - Rose Tinted */}
        <div className="bg-rose-50/50 rounded-2xl p-10 border border-rose-100 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 bg-rose-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-rose-200">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h3 className="text-xl font-bold text-rose-900">Critical Risks & Considerations</h3>
          </div>
          <div className="text-rose-800/80 leading-relaxed text-sm text-justify font-medium">
            {renderContent(analysis.risks_considerations)}
          </div>
        </div>

        {/* Lifestyle Matrix */}
        <div className="bg-white rounded-2xl p-10 border border-gray-100 shadow-sm">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-black text-gray-900 mb-2">Lifestyle Suitability Assessment</h2>
            <p className="text-gray-400 font-medium text-sm">Categorical analysis for target buyer demographics</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              { title: 'Families & Education', content: analysis.lifestyle_fit?.families, color: 'blue', icon: 'fa-children' },
              { title: 'Professionals & Remote Work', content: analysis.lifestyle_fit?.professionals, color: 'purple', icon: 'fa-laptop-code' },
              { title: 'Retirees & Low-Maintenance', content: analysis.lifestyle_fit?.retirees, color: 'emerald', icon: 'fa-wheelchair' },
              { title: 'Investors & Growth', content: analysis.lifestyle_fit?.investors, color: 'indigo', icon: 'fa-chart-line' },
            ].map((item, idx) => (
              <div 
                key={idx} 
                className={`space-y-4 p-6 rounded-2xl transition-all duration-300 hover:scale-[1.03] hover:shadow-xl border border-transparent cursor-default
                  ${item.color === 'blue' ? 'bg-blue-50/40 hover:border-blue-100' : ''}
                  ${item.color === 'purple' ? 'bg-purple-50/40 hover:border-purple-100' : ''}
                  ${item.color === 'emerald' ? 'bg-emerald-50/40 hover:border-emerald-100' : ''}
                  ${item.color === 'indigo' ? 'bg-indigo-50/40 hover:border-indigo-100' : ''}
                `}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl bg-white shadow-sm flex items-center justify-center text-${item.color}-600`}>
                    <i className={`fa-solid ${item.icon} text-base`}></i>
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wider">{item.title}</h4>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed text-justify">{renderContent(item.content)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Final Verdict - White Background */}
        <SectionCard 
          title="Final Analyst Verdict" 
          icon="fa-gavel" 
          content={analysis.buyer_recommendation}
          colorClass="text-gray-900 font-medium italic"
        />

        {/* Footer branding */}
        <div className="pt-10 flex flex-col items-center gap-4">
          <div className="h-px bg-gray-200 w-full max-w-xs"></div>
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.5em]">
            Zyphe Intelligence Systems • v2.1
          </div>
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            Generated on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComprehensiveAnalysis;