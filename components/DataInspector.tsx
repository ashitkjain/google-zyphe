import React from 'react';
import { PropertyData, AIAnalysisResult, CustomAIAnalysisResult } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: {
    property: PropertyData | null;
    analysis: AIAnalysisResult | null;
    visual: CustomAIAnalysisResult | null;
  };
}

const DataInspector: React.FC<Props> = ({ isOpen, onClose, data }) => {
  if (!isOpen) return null;

  const fullData = {
    timestamp: new Date().toISOString(),
    ...data
  };

  const jsonString = JSON.stringify(fullData, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    alert('JSON data copied to clipboard!');
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zyphe-intel-${data.property?.zpid || 'data'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative w-full max-w-5xl bg-gray-900 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-800 animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <i className="fa-solid fa-database text-indigo-400"></i>
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Raw Intelligence Data</h3>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Internal Data Schema Viewer</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleCopy}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
            >
              <i className="fa-solid fa-copy"></i>
              Copy JSON
            </button>
            <button 
              onClick={handleDownload}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-900/20"
            >
              <i className="fa-solid fa-download"></i>
              Download
            </button>
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8 font-mono text-[13px] leading-relaxed no-scrollbar bg-[#0B0F1A]">
          <pre className="text-indigo-300">
            {jsonString}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-gray-800/30 border-t border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Live Session</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Cached Object</span>
          </div>
          <p className="text-gray-600 text-[10px] font-bold">Zyphe™ DATA INSPECTOR V1.2</p>
        </div>
      </div>
      
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .no-scrollbar::-webkit-scrollbar-track {
          background: #0B0F1A;
        }
        .no-scrollbar::-webkit-scrollbar-thumb {
          background: #1F2937;
          border-radius: 4px;
        }
        .no-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #374151;
        }
      `}</style>
    </div>
  );
};

export default DataInspector;