
import React, { useState, useEffect } from 'react';
import { runFullIntelligencePipeline, PipelineProgress } from '../services/preloadService';

interface Props {
  onClose: () => void;
  initialAddress: string;
}

const PreloadManager: React.FC<Props> = ({ onClose, initialAddress }) => {
  const [address, setAddress] = useState(initialAddress);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<PipelineProgress[]>([]);
  const [success, setSuccess] = useState(false);
  const [timer, setTimer] = useState(0);

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

  const handleStartPipeline = async () => {
    setLoading(true);
    setSuccess(false);
    setProgress([]);

    try {
      await runFullIntelligencePipeline(address, (p) => {
        setProgress(prev => {
          const existing = prev.findIndex(item => item.step === p.step);
          if (existing !== -1) {
            const next = [...prev];
            next[existing] = p;
            return next;
          }
          return [...prev, p];
        });
      });
      setSuccess(true);
    } catch (err) {
      console.error("Pipeline failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-gray-900/90 backdrop-blur-md" onClick={onClose}></div>

      <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100 animate-in zoom-in-95 duration-300">
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <i className="fa-solid fa-microchip text-white text-sm"></i>
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Intelligence Pipeline</h3>
              <p className="text-indigo-500 text-[10px] font-black uppercase tracking-widest">Cache Warming Engine</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="p-8 overflow-y-auto space-y-8 no-scrollbar">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Target Property</label>
            <div className="relative">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={loading}
                className="w-full pl-5 pr-32 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl transition-all outline-none font-medium text-gray-800"
                placeholder="Enter address..."
              />
              <button
                onClick={handleStartPipeline}
                disabled={loading || !address}
                className="absolute right-2 top-2 bottom-2 bg-gradient-to-r from-indigo-700 to-gray-900 text-white px-6 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.05] active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? 'RUNNING...' : 'START PIPELINE'}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Process Monitor</label>
              <div className="flex items-center gap-3">
                {loading && (
                  <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-clock animate-pulse"></i>
                    Pipeline Active: <span className="font-mono text-[11px]">{timer}s</span>
                  </span>
                )}
                {loading && <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-ping"></span>}
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-4">
              {progress.length === 0 && !loading && (
                <div className="text-center py-8">
                  <i className="fa-solid fa-terminal text-gray-200 text-4xl mb-4"></i>
                  <p className="text-gray-400 text-sm font-medium">Pipeline idle. Enter address to begin.</p>
                </div>
              )}
              {progress.map((p, i) => (
                <div key={i} className="flex items-start gap-4 group">
                  <div className={`mt-1 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${p.status === 'completed' ? 'bg-indigo-100 text-indigo-600' :
                      p.status === 'running' ? 'bg-indigo-100 text-indigo-600' :
                        p.status === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-gray-200 text-gray-400'
                    }`}>
                    <i className={`fa-solid ${p.status === 'completed' ? 'fa-check text-[10px]' :
                        p.status === 'running' ? 'fa-spinner animate-spin text-[10px]' :
                          p.status === 'error' ? 'fa-xmark text-[10px]' : 'fa-circle text-[6px]'
                      }`}></i>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-gray-900 uppercase tracking-tight">{p.step}</span>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${p.status === 'completed' ? 'text-indigo-600' :
                          p.status === 'running' ? 'text-indigo-500' :
                            p.status === 'error' ? 'text-rose-500' : 'text-gray-400'
                        }`}>
                        {p.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-1">{p.message}</p>

                    {p.usage && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 p-3 bg-white rounded-xl border border-gray-100 shadow-sm animate-in fade-in slide-in-from-left-2 transition-all">
                        <div className="flex items-center gap-1.5">
                          <i className="fa-solid fa-microchip text-[10px] text-indigo-400"></i>
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Tokens:</span>
                          <span className="text-[10px] font-black text-gray-900">
                            {p.usage.promptTokens.toLocaleString()}
                            <span className="text-gray-300 mx-1">/</span>
                            {p.usage.candidatesTokens.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <i className="fa-solid fa-dollar-sign text-[10px] text-emerald-500"></i>
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Est. Cost:</span>
                          <span className="text-[10px] font-black text-emerald-600">${p.usage.cost.toFixed(4)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {success && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 flex items-center gap-5 animate-in slide-in-from-top-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-100 text-white">
                <i className="fa-solid fa-bolt-lightning text-xl"></i>
              </div>
              <div>
                <h4 className="font-black text-indigo-900 text-sm">Property Ready!</h4>
                <p className="text-indigo-700/70 text-xs">All intelligence layers are now cached in the cloud for this address.</p>
              </div>
              <button onClick={onClose} className="ml-auto bg-gradient-to-r from-indigo-700 to-gray-900 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:scale-[1.05] transition-all">Close</button>
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-center">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">Zyphe™ Enterprise Preload API</p>
        </div>
      </div>
    </div>
  );
};

export default PreloadManager;
