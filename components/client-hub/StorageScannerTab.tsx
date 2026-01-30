
import React, { useState, useEffect } from 'react';
import { listPropertiesInStorage } from '../../services/firebase/storage';
import { checkExistingPropertiesBatch, deletePropertyAnalysis, getPropertyFromCloud } from '../../services/firebase/properties';
import { runFullIntelligencePipeline, PipelineProgress } from '../../services/preloadService';
import { auth } from '../../services/firebase/config';
import { getLLMLogsForTimeRange } from '../../services/firebase/llm_logs';
import { getAPILogsForTimeRange, APICallEvent } from '../../services/firebase/api_logs';
import { LLMCallEvent } from '../../types/ai';

interface StorageProperty {
    zpid: string;
    existsInFirestore: boolean;
    address?: string;
    loading: boolean;
    progress?: PipelineProgress | null;
    status: 'pending' | 'running' | 'completed' | 'error';
    startTime?: number;
    endTime?: number;
    error?: string;
}

const StorageScannerTab: React.FC = () => {
    const [properties, setProperties] = useState<StorageProperty[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [processing, setProcessing] = useState(false);
    const [statusLog, setStatusLog] = useState<string[]>([]);
    const [ingestionReport, setIngestionReport] = useState<{
        llmLogs: LLMCallEvent[];
        apiLogs: APICallEvent[];
    } | null>(null);

    useEffect(() => {
        scanStorage();
    }, []);

    const scanStorage = async () => {
        setLoading(true);
        try {
            const zpids = await listPropertiesInStorage();
            const existingSet = await checkExistingPropertiesBatch(zpids);

            // Enrich with address if it exists in Firestore
            const enriched: StorageProperty[] = await Promise.all(zpids.map(async (zpid) => {
                let address = 'Unknown Address';
                if (existingSet.has(zpid)) {
                    const data = await getPropertyFromCloud(zpid);
                    if (data?.address) address = data.address;
                }
                return {
                    zpid,
                    existsInFirestore: existingSet.has(zpid),
                    address,
                    loading: false,
                    status: 'pending'
                };
            }));

            setProperties(enriched);
        } catch (error) {
            console.error("Storage scan failed:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (zpid: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(zpid)) next.delete(zpid);
            else if (next.size < 5) next.add(zpid);
            return next;
        });
    };

    const addLog = (msg: string) => {
        setStatusLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
    };

    const handleRunPipeline = async () => {
        if (selectedIds.size === 0) return;
        setProcessing(true);
        setIngestionReport(null);
        const batchStartTime = Date.now() - 5000; // Add 5s buffer for clock drift
        addLog(`Starting fresh pipeline for ${selectedIds.size} properties...`);

        const targets = properties.filter(p => selectedIds.has(p.zpid));

        // Reset process state for selected
        setProperties(prev => prev.map(p => selectedIds.has(p.zpid) ? { ...p, status: 'pending', progress: null, error: undefined } : p));

        for (const item of targets) {
            try {
                const startTime = Date.now();
                setProperties(prev => prev.map(p => p.zpid === item.zpid ? { ...p, status: 'running', startTime } : p));

                if (item.existsInFirestore) {
                    addLog(`[${item.zpid}] Deleting existing database record for fresh start...`);
                    const delRes = await deletePropertyAnalysis(item.zpid);
                    if (delRes.success) {
                        addLog(`[${item.zpid}] Successfully cleared from ${delRes.tables?.length || 0} tables.`);
                    }
                }

                let currentAddress = item.address;
                if (!currentAddress || currentAddress === 'Unknown Address') {
                    addLog(`[${item.zpid}] Address missing. Fetching specs by ZPID...`);
                    const freshData = await getPropertyFromCloud(item.zpid) || await (async () => {
                        const { fetchPropertyDataFull } = await import('../../services/apiService');
                        return await fetchPropertyDataFull(item.zpid, true);
                    })();
                    if (freshData?.address) {
                        currentAddress = freshData.address;
                        addLog(`[${item.zpid}] Resolved: ${currentAddress}`);
                    }
                }

                if (currentAddress && currentAddress !== 'Unknown Address') {
                    addLog(`[${item.zpid}] Launching intelligence pipeline...`);
                    await runFullIntelligencePipeline(
                        currentAddress,
                        (p) => {
                            addLog(`[${item.zpid}] ${p.step}: ${p.message}`);
                            setProperties(prev => prev.map(itemProp => itemProp.zpid === item.zpid ? { ...itemProp, progress: p } : itemProp));
                        },
                        item.zpid
                    );
                    addLog(`[${item.zpid}] Pipeline COMPLETED.`);
                    setProperties(prev => prev.map(p => p.zpid === item.zpid ? { ...p, status: 'completed', endTime: Date.now() } : p));
                } else {
                    addLog(`[${item.zpid}] SKIPPING: Proper address missing for pipeline trigger.`);
                    setProperties(prev => prev.map(p => p.zpid === item.zpid ? { ...p, status: 'error', error: 'Missing address' } : p));
                }

            } catch (err: any) {
                addLog(`[${item.zpid}] ERROR: ${err.message}`);
                setProperties(prev => prev.map(p => p.zpid === item.zpid ? { ...p, status: 'error', error: err.message, endTime: Date.now() } : p));
            }
        }

        // Generate Report
        try {
            const maxEnd = Date.now();
            const userId = auth?.currentUser?.uid || 'unknown';
            const [llmLogs, apiLogs] = await Promise.all([
                getLLMLogsForTimeRange(userId, batchStartTime, maxEnd),
                getAPILogsForTimeRange(userId, batchStartTime, maxEnd)
            ]);
            setIngestionReport({ llmLogs, apiLogs });
            addLog(`Usage Report Generated: ${llmLogs.length} AI calls, ${apiLogs.length} API calls.`);
        } catch (reportErr) {
            console.error("Failed to generate report:", reportErr);
        }

        setProcessing(false);
        setSelectedIds(new Set());
    };

    return (
        <div className="max-w-6xl mx-auto py-12 px-6 animate-in fade-in duration-700">
            <div className="flex justify-between items-end mb-10">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">Storage Registry</h1>
                    <p className="text-slate-500 font-medium">Scan local asset storage and re-trigger intelligence pipelines for existing ZPIDs.</p>
                </div>
                <button
                    onClick={handleRunPipeline}
                    disabled={processing || selectedIds.size === 0}
                    className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 transition-all flex items-center gap-3 disabled:opacity-50 disabled:grayscale"
                >
                    {processing ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-bolt-lightning"></i>}
                    Run Pipeline ({selectedIds.size}/5)
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Status Log */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden h-[600px] flex flex-col">
                        <div className="flex items-center gap-3 mb-6 relative z-10">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Live Process Log</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 font-mono text-[10px] text-slate-300 custom-scrollbar pr-2">
                            {statusLog.length === 0 ? (
                                <div className="text-slate-600 italic">Awaiting selection...</div>
                            ) : (
                                statusLog.map((msg, i) => <div key={i} className="border-l border-slate-800 pl-3 py-1">{msg}</div>)
                            )}
                        </div>
                    </div>
                </div>

                {/* Table or Ingestion Progress */}
                <div className="lg:col-span-2 space-y-6">
                    {processing || properties.some(p => p.status === 'running' || p.status === 'completed' && selectedIds.has(p.zpid)) ? (
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest px-4">Active Ingestion Jobs</h3>
                            {properties.filter(p => p.status !== 'pending' || selectedIds.has(p.zpid)).map((item) => (
                                <div key={item.zpid} className={`bg-white p-6 rounded-[2rem] border transition-all ${item.status === 'completed' ? 'border-emerald-100 shadow-emerald-50' : item.status === 'error' ? 'border-rose-100 shadow-rose-50' : 'border-slate-100 shadow-lg shadow-slate-200/50'}`}>
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
                                            <span className="text-sm font-black text-slate-900 truncate">{item.address || item.zpid}</span>
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
                                                <div className="flex items-center gap-2">
                                                    <span>{item.progress.step}</span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                    <span className="font-mono text-indigo-500">
                                                        {item.startTime ? Math.floor((Date.now() - item.startTime) / 1000) : 0}s
                                                    </span>
                                                </div>
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

                                    {item.status === 'completed' && (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-emerald-600 text-[11px] font-black uppercase tracking-widest bg-emerald-50 py-2 px-4 rounded-xl w-fit">
                                                <i className="fa-solid fa-check"></i>
                                                Intelligence Suite Ready
                                            </div>
                                            {item.startTime && item.endTime && (
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    Total: <span className="text-slate-900 font-mono">{Math.floor((item.endTime - item.startTime) / 1000)}s</span>
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {properties.some(p => p.status === 'completed') && !processing && (
                                <button
                                    onClick={() => {
                                        setProperties(prev => prev.map(p => ({ ...p, status: 'pending', progress: null })));
                                        setIngestionReport(null);
                                    }}
                                    className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
                                >
                                    Clear Results & Return to List
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Select</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">ZPID / Address</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={3} className="px-8 py-20 text-center">
                                                <i className="fa-solid fa-circle-notch animate-spin text-indigo-600 text-2xl"></i>
                                                <div className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Scanning Storage Layers...</div>
                                            </td>
                                        </tr>
                                    ) : properties.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-8 py-20 text-center text-slate-400 italic">No storage assets found.</td>
                                        </tr>
                                    ) : (
                                        properties.map((prop) => (
                                            <tr
                                                key={prop.zpid}
                                                className={`transition-all ${selectedIds.has(prop.zpid) ? 'bg-indigo-50/50' : 'hover:bg-slate-50'} cursor-pointer`}
                                                onClick={() => toggleSelection(prop.zpid)}
                                            >
                                                <td className="px-8 py-6">
                                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedIds.has(prop.zpid) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 bg-white'}`}>
                                                        {selectedIds.has(prop.zpid) && <i className="fa-solid fa-check text-[10px]"></i>}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="font-bold text-slate-900">{prop.zpid}</div>
                                                    <div className="text-xs text-slate-500 font-medium">{prop.address}</div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    {prop.existsInFirestore ? (
                                                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest rounded-full border border-emerald-100 flex items-center gap-2 w-fit">
                                                            <i className="fa-solid fa-database"></i> Document Active
                                                        </span>
                                                    ) : (
                                                        <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[9px] font-black uppercase tracking-widest rounded-full border border-amber-100 flex items-center gap-2 w-fit">
                                                            <i className="fa-solid fa-cloud"></i> Storage Only
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Ingestion Summary Report */}
            {ingestionReport && (
                <div className="mt-16 bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-10 animate-in fade-in zoom-in duration-500">
                    <div className="flex items-center gap-6 mb-10 pb-8 border-b border-slate-100">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                            <i className="fa-solid fa-chart-line text-2xl"></i>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900">Ingestion Usage Report</h2>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Audit of intelligence pipeline execution</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* Gemini Summary */}
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-indigo-600 shadow-sm">
                                    <i className="fa-solid fa-brain text-sm"></i>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gemini AI</span>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-xs font-bold text-slate-600">Total Calls</span>
                                    <span className="text-lg font-black text-slate-900">{ingestionReport.llmLogs.length}</span>
                                </div>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-xs font-bold text-slate-600">Total Cost</span>
                                    <span className="text-lg font-black text-emerald-600">
                                        ${(ingestionReport.llmLogs.reduce((acc, log) => acc + (log.estimated_cost || 0), 0)).toFixed(4)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Performance Summary */}
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 md:col-span-2">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-amber-600 shadow-sm">
                                    <i className="fa-solid fa-bolt text-sm"></i>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Performance</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xs font-bold text-slate-600">Avg AI Response</span>
                                        <span className="text-lg font-black text-slate-900">
                                            {Math.round(ingestionReport.llmLogs.length > 0 ? (ingestionReport.llmLogs.reduce((acc, log) => {
                                                if (log.response_received_at && log.request_sent_at) {
                                                    const start = (log.request_sent_at as any).toMillis?.() || 0;
                                                    const end = (log.response_received_at as any).toMillis?.() || 0;
                                                    return acc + (end - start);
                                                }
                                                return acc;
                                            }, 0) / ingestionReport.llmLogs.length) / 1000 : 0)}s
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xs font-bold text-slate-600">Peak Pipeline</span>
                                        <span className="text-lg font-black text-slate-900">
                                            {Math.max(...properties.filter(p => p.status === 'completed').map(j => (j.endTime && j.startTime) ? (j.endTime - j.startTime) / 1000 : 0), 0).toFixed(0)}s
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xs font-bold text-slate-600">API Requests</span>
                                        <span className="text-lg font-black text-slate-900">{ingestionReport.apiLogs.length}</span>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xs font-bold text-slate-600">Data Points Sync</span>
                                        <span className="text-lg font-black text-slate-900">{properties.filter(p => p.status === 'completed').length * 12}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Credits / Rate etc */}
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-emerald-600 shadow-sm">
                                    <i className="fa-solid fa-microchip text-sm"></i>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Throughput</span>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-xs font-bold text-slate-600">Token Volume</span>
                                    <span className="text-lg font-black text-slate-900">
                                        {(ingestionReport.llmLogs.reduce((acc, log) => acc + (log.usage_metadata?.totalTokenCount || 0), 0) / 1000).toFixed(1)}k
                                    </span>
                                </div>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-xs font-bold text-slate-600">Success Rate</span>
                                    <span className="text-lg font-black text-emerald-600">
                                        {Math.round((properties.filter(p => p.status === 'completed').length / (properties.filter(p => p.status === 'completed' || p.status === 'error').length || 1)) * 100)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 overflow-x-auto rounded-3xl border border-slate-100">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <tr>
                                    <th className="p-5">Call Type</th>
                                    <th className="p-5">Endpoint / Agent</th>
                                    <th className="p-5 text-right">Tokens / Time</th>
                                    <th className="p-5 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {ingestionReport.llmLogs.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0)).map(log => (
                                    <tr key={log.id} className="text-sm transition-colors hover:bg-slate-50/50">
                                        <td className="p-5">
                                            <div className="flex items-center gap-2">
                                                <i className="fa-solid fa-robot text-indigo-500 w-4"></i>
                                                <span className="font-bold text-slate-900">Gemini</span>
                                            </div>
                                        </td>
                                        <td className="p-5 font-medium text-slate-600">{log.prompt_filename || 'Unknown Agent'}</td>
                                        <td className="p-5 text-right font-mono">
                                            <div className="text-indigo-600 font-bold">
                                                {log.usage_metadata?.totalTokenCount?.toLocaleString() || 0} tkn
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-medium">
                                                {log.usage_metadata?.promptTokenCount?.toLocaleString() || 0} in / {log.usage_metadata?.candidatesTokenCount?.toLocaleString() || 0} out
                                            </div>
                                            <div className="text-[11px] text-emerald-600 font-black mt-1">
                                                ${(log.estimated_cost || 0).toFixed(4)}
                                            </div>
                                        </td>
                                        <td className="p-5 text-right">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${log.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                {log.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {ingestionReport.apiLogs.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0)).map(log => (
                                    <tr key={log.id} className="text-sm transition-colors hover:bg-slate-50/50">
                                        <td className="p-5">
                                            <div className="flex items-center gap-2">
                                                <i className={`fa-solid ${log.api_name === 'Radar' ? 'fa-location-crosshairs text-emerald-500' : 'fa-server text-blue-500'} w-4`}></i>
                                                <span className="font-bold text-slate-900">{log.api_name}</span>
                                            </div>
                                        </td>
                                        <td className="p-5 font-medium text-slate-600">{log.endpoint}</td>
                                        <td className="p-5 text-right font-mono text-slate-500">
                                            {log.response_time_ms ? `${log.response_time_ms}ms` : '--'}
                                        </td>
                                        <td className="p-5 text-right">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${log.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                {log.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StorageScannerTab;
