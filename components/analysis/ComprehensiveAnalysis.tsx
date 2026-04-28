
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
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ width: 24, height: 1, background: color, display: 'inline-block' }} />
          <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.18em', fontWeight: 700, color, textTransform: 'uppercase' as const }}>{kicker}</span>
        </div>
        <h2 style={{ fontFamily: serif, fontSize: 30, lineHeight: 1.05, margin: 0, fontWeight: 400, letterSpacing: '-0.02em', color: '#0f172a' }}>
          {parts ? <>{parts[0]}<em style={{ color, fontStyle: 'italic' }}>{italicWord}</em>{parts[1]}</> : title}
        </h2>
      </div>
    );
  };

  const SectionCard = ({ kicker, title, italicWord, icon, content, color }: { kicker: string, title: string, italicWord?: string, icon: string, content: string | undefined, color: string, colorClass?: string }) => {
    if (!content) return null;
    return (
      <div style={{
        background: `linear-gradient(180deg, ${color}12 0%, #fff 140px)`,
        borderRadius: 14,
        border: '1px solid #e2e8f0',
        padding: 24,
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, color, display: 'grid', placeItems: 'center', fontSize: 15, flexShrink: 0 }}>
            <i className={`fa-solid ${icon}`}></i>
          </div>
          <SectionTitleBar kicker={kicker} title={title} italicWord={italicWord} color={color} />
        </div>
        <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.65, margin: 0 }}>
          {renderContent(content)}
        </p>
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

        {analysis.risks_considerations && (
          <div style={{
            background: 'linear-gradient(180deg, #e11d4812 0%, #fff 140px)',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            padding: 24,
            marginBottom: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#e11d4818', color: '#e11d48', display: 'grid', placeItems: 'center', fontSize: 15, flexShrink: 0 }}>
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <SectionTitleBar kicker="Risk Advisory" title="Critical risks & considerations" italicWord="Critical" color="#e11d48" />
            </div>
            <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.65, margin: 0 }}>
              {renderContent(analysis.risks_considerations)}
            </p>
          </div>
        )}

      </div>
    </div >
  );
};

export default ComprehensiveAnalysis;
