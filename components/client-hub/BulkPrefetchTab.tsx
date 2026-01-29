
import React, { useState } from 'react';
import { runFullIntelligencePipeline, PipelineProgress } from '../../services/preloadService';

interface PrefetchStatus {
    address: string;
    progress: PipelineProgress | null;
    status: 'idle' | 'running' | 'completed' | 'error';
    error?: string;
}

const BulkPrefetchTab: React.FC = () => {
    const [input, setInput] = useState('');
    const [queue, setQueue] = useState<PrefetchStatus[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleStart = async () => {
        const addresses = input
            .split('\n')
            .map(a => a.trim())
            .filter(a => a.length > 0);

        if (addresses.length === 0) return;

        const initialQueue: PrefetchStatus[] = addresses.map(addr => ({
            address: addr,
            progress: null,
            status: 'idle'
        }));

        setQueue(initialQueue);
        setIsProcessing(true);

        for (let i = 0; i < addresses.length; i++) {
            const currentAddr = addresses[i];

            setQueue(prev => prev.map((item, idx) =>
                idx === i ? { ...item, status: 'running' } : item
            ));

            try {
                await runFullIntelligencePipeline(currentAddr, (p) => {
                    setQueue(prev => prev.map((item, idx) =>
                        idx === i ? { ...item, progress: p } : item
                    ));
                });

                setQueue(prev => prev.map((item, idx) =>
                    idx === i ? { ...item, status: 'completed' } : item
                ));
            } catch (err: any) {
                console.error(`Prefetch failed for ${currentAddr}:`, err);
                setQueue(prev => prev.map((item, idx) =>
                    idx === i ? { ...item, status: 'error', error: err.message || 'Unknown error' } : item
                ));
            }
        }

        setIsProcessing(false);
    };

    return (
        <div className="max-w-5xl mx-auto py-10 px-6 animate-in fade-in duration-700">
            <div className="mb-12">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-4">Bulk Property Ingestion</h1>
                <p className="text-slate-500 text-lg font-medium leading-relaxed max-w-2xl">
                    Queue multiple properties for deep intelligence pre-fetching. Our AI will normalize data, analyze imagery, and generate comprehensive reports in the background.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Input Area */}
                <div className="space-y-6">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <i className="fa-solid fa-list-check text-xl"></i>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900">Ingestion Queue</h3>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Specify one address per line</p>
                            </div>
                        </div>

                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={isProcessing}
                            placeholder="123 Main St, Aspen, CO&#10;456 Pine Ave, Boulder, CO"
                            className="w-full h-64 p-6 bg-slate-50 border-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-3xl outline-none text-sm font-medium transition-all shadow-inner resize-none mb-6"
                        />

                        <button
                            onClick={handleStart}
                            disabled={isProcessing || !input.trim()}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
                        >
                            {isProcessing ? (
                                <>
                                    <i className="fa-solid fa-spinner animate-spin"></i>
                                    Processing Queue...
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-rocket"></i>
                                    Launch Ingestion
                                </>
                            )}
                        </button>
                    </div>

                </div>

                {/* Progress Tracking */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-4">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Active Jobs</h3>
                        {queue.length > 0 && (
                            <span className="px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black text-slate-500 uppercase">
                                {queue.filter(q => q.status === 'completed').length} / {queue.length} Done
                            </span>
                        )}
                    </div>

                    <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                        {queue.length === 0 ? (
                            <div className="bg-white border-2 border-dashed border-slate-100 rounded-[2.5rem] py-20 px-8 text-center">
                                <i className="fa-solid fa-layer-group text-slate-200 text-5xl mb-6"></i>
                                <p className="text-slate-400 font-medium italic">No active ingestion jobs in queue.</p>
                            </div>
                        ) : (
                            queue.map((item, idx) => (
                                <div key={idx} className={`bg-white p-6 rounded-[2rem] border transition-all ${item.status === 'completed' ? 'border-emerald-100 shadow-emerald-50' : item.status === 'error' ? 'border-rose-100 shadow-rose-50' : 'border-slate-100 shadow-lg shadow-slate-200/50'}`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                                item.status === 'error' ? 'bg-rose-50 text-rose-600' :
                                                    item.status === 'running' ? 'bg-indigo-50 text-indigo-600' :
                                                        'bg-slate-50 text-slate-400'
                                                }`}>
                                                <i className={`fa-solid ${item.status === 'completed' ? 'fa-circle-check' :
                                                    item.status === 'error' ? 'fa-circle-xmark' :
                                                        item.status === 'running' ? 'fa-spinner animate-spin' :
                                                            'fa-hourglass-start'
                                                    }`}></i>
                                            </div>
                                            <span className="text-sm font-black text-slate-900 truncate">{item.address}</span>
                                        </div>
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${item.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                            item.status === 'error' ? 'bg-rose-50 text-rose-600' :
                                                item.status === 'running' ? 'bg-indigo-50 text-indigo-600' :
                                                    'bg-slate-100 text-slate-400'
                                            }`}>
                                            {item.status}
                                        </span>
                                    </div>

                                    {item.status === 'running' && item.progress && (
                                        <div className="space-y-3 animate-in fade-in">
                                            <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter text-slate-400">
                                                <span>{item.progress.step}</span>
                                                <span className="text-indigo-600">Active</span>
                                            </div>
                                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                                                    style={{ width: `${(100 / 9) * (['Geocoding', 'Status Check', 'Property Data', 'Gallery', 'Visual AI', 'Spatial AI', 'Market AI', 'Quality Audit', 'Narrative AI'].indexOf(item.progress.step) + 1)}%` }}
                                                ></div>
                                            </div>
                                            <p className="text-[11px] text-slate-500 font-medium italic">
                                                {item.progress.message}
                                            </p>
                                        </div>
                                    )}

                                    {item.status === 'error' && (
                                        <p className="text-[11px] text-rose-600 font-medium bg-rose-50 p-3 rounded-xl border border-rose-100">
                                            <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                                            {item.error}
                                        </p>
                                    )}

                                    {item.status === 'completed' && (
                                        <div className="flex items-center gap-2 text-emerald-600 text-[11px] font-black uppercase tracking-widest bg-emerald-50 py-2 px-4 rounded-xl w-fit">
                                            <i className="fa-solid fa-check"></i>
                                            Intelligence Suite Ready
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulkPrefetchTab;
