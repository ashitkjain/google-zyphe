
import React, { useState, useEffect } from 'react';
import { listPropertiesInStorage } from '../../services/firebase/storage';
import { checkExistingPropertiesBatch, deletePropertyAnalysis, getPropertyFromCloud } from '../../services/firebase/properties';
import { runFullIntelligencePipeline } from '../../services/preloadService';
import { auth } from '../../services/firebase/config';

interface StorageProperty {
    zpid: string;
    existsInFirestore: boolean;
    address?: string;
    loading: boolean;
}

const StorageScannerTab: React.FC = () => {
    const [properties, setProperties] = useState<StorageProperty[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [processing, setProcessing] = useState(false);
    const [statusLog, setStatusLog] = useState<string[]>([]);

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
                    loading: false
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
        addLog(`Starting fresh pipeline for ${selectedIds.size} properties...`);

        const targets = properties.filter(p => selectedIds.has(p.zpid));

        for (const item of targets) {
            try {
                if (item.existsInFirestore) {
                    addLog(`[${item.zpid}] Deleting existing database record for fresh start...`);
                    const delRes = await deletePropertyAnalysis(item.zpid);
                    if (delRes.success) {
                        addLog(`[${item.zpid}] Successfully cleared from ${delRes.tables?.length || 0} tables.`);
                    }
                }

                addLog(`[${item.zpid}] Launching intelligence pipeline...`);
                // We use the address from the storage if we have it, otherwise we might need a way to find it.
                // If it's in storage but not firestore, we don't have the address yet unless we look it up.
                // Wait, runFullIntelligencePipeline takes address OR zpid? 
                // Let's check preloadService.ts signature.

                if (item.address === 'Unknown Address') {
                    addLog(`[${item.zpid}] Address missing. Fetching specs by ZPID...`);
                    const freshData = await getPropertyFromCloud(item.zpid) || await (async () => {
                        const { fetchPropertyDataFull } = await import('../../services/apiService');
                        return await fetchPropertyDataFull(item.zpid, true);
                    })();
                    if (freshData?.address) {
                        item.address = freshData.address;
                        addLog(`[${item.zpid}] Resolved: ${item.address}`);
                    }
                }

                if (item.address && item.address !== 'Unknown Address') {
                    addLog(`[${item.zpid}] Launching intelligence pipeline...`);
                    await runFullIntelligencePipeline(
                        item.address,
                        (p) => addLog(`[${item.zpid}] ${p.step}: ${p.message}`),
                        item.zpid
                    );
                    addLog(`[${item.zpid}] Pipeline COMPLETED.`);
                } else {
                    addLog(`[${item.zpid}] SKIPPING: Proper address missing for pipeline trigger.`);
                }

            } catch (err: any) {
                addLog(`[${item.zpid}] ERROR: ${err.message}`);
            }
        }

        setProcessing(false);
        setSelectedIds(new Set());
        scanStorage(); // Refresh list
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

                {/* Table */}
                <div className="lg:col-span-2">
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
                </div>
            </div>
        </div>
    );
};

export default StorageScannerTab;
