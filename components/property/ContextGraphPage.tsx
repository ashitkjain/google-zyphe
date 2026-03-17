import React, { useEffect, useState } from 'react';
import { ContextGraphExtractionResult } from '../../types';
import { ContextGraphView } from '../analysis/custom-ai/components/ContextGraphView';
import {
    getContextGraphFromCloud,
    saveContextGraphToCloud,
    getPropertyFromCloud,
    getVisualAnalysisFromCloud,
    getLifestyleFitFromCloud
} from '../../services/firebase/properties';
import { extractContextGraphFactors } from '../../services/geminiService';

interface Props {
    zpid: string;
    onBack: () => void;
}

const ContextGraphPage: React.FC<Props> = ({ zpid, onBack }) => {
    const [graphResult, setGraphResult] = useState<ContextGraphExtractionResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [propertyAddress, setPropertyAddress] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    // Keep references for re-extract
    const propertyDataRef = React.useRef<any>(null);
    const visualDataRef = React.useRef<any>(null);

    const loadOrExtract = async (forceRefresh = false) => {
        setLoading(true);
        setError(null);

        try {
            // 1. Check cache first (unless forced)
            if (!forceRefresh) {
                const cached = await getContextGraphFromCloud(zpid);
                if (cached && cached.factors && cached.factors.length > 0) {
                    setGraphResult(cached as ContextGraphExtractionResult);
                    setPropertyAddress(cached.address || zpid);
                    setLoading(false);
                    return;
                }
            }

            // 2. Load property data from cloud
            let propData = propertyDataRef.current;
            if (!propData) {
                propData = await getPropertyFromCloud(zpid);
                propertyDataRef.current = propData;
            }

            if (!propData) {
                setError('Property not found. Please search for the property first.');
                setLoading(false);
                return;
            }

            setPropertyAddress(propData.address || zpid);

            // 3. Load visual analysis, lifestyle fit, and comprehensive from cloud
            let visualData = visualDataRef.current;
            let comprehensiveData: any = null;
            if (!visualData) {
                const { getComprehensiveAnalysisFromCloud } = await import('../../services/firebase/properties');
                const [rawVisual, lifestyleFit, comprehensive] = await Promise.all([
                    getVisualAnalysisFromCloud(zpid),
                    getLifestyleFitFromCloud(zpid),
                    getComprehensiveAnalysisFromCloud(zpid)
                ]);
                visualData = rawVisual ? { ...rawVisual } : {} as any;
                if (lifestyleFit) (visualData as any).lifestyle_fit = lifestyleFit;
                visualDataRef.current = visualData;
                comprehensiveData = comprehensive;
            }

            // 4. Extract via AI
            const result = await extractContextGraphFactors(propData, visualData, comprehensiveData);

            if (result.data) {
                setGraphResult(result.data);
                await saveContextGraphToCloud(zpid, result.data);
            } else {
                setError('Failed to extract context graph factors.');
            }
        } catch (err: any) {
            console.error('[ContextGraphPage] Error:', err);
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!zpid) return;
        loadOrExtract(false);
    }, [zpid]);

    const handleReExtract = () => loadOrExtract(true);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header Bar */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-all group"
                        >
                            <i className="fa-solid fa-arrow-left text-xs transition-transform group-hover:-translate-x-1"></i>
                            Back
                        </button>
                        <div className="h-8 w-px bg-slate-200"></div>
                        <div>
                            <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                                <i className="fa-solid fa-diagram-project text-indigo-500"></i>
                                Context Graph
                            </h1>
                            {propertyAddress && (
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {propertyAddress}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const url = `${window.location.origin}/realtor/context-graph?zpid=${zpid}`;
                                navigator.clipboard.writeText(url);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-600 hover:bg-slate-50 transition-all"
                            title="Copy shareable link"
                        >
                            <i className="fa-solid fa-link text-xs"></i>
                            Copy Link
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {error ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center">
                            <i className="fa-solid fa-circle-exclamation text-2xl text-rose-400"></i>
                        </div>
                        <div>
                            <p className="text-slate-800 font-black text-lg tracking-tight">Unable to Load Context Graph</p>
                            <p className="text-slate-400 text-sm mt-1 max-w-md">{error}</p>
                        </div>
                        <button
                            onClick={onBack}
                            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2"
                        >
                            <i className="fa-solid fa-arrow-left text-xs"></i>
                            Go Back
                        </button>
                    </div>
                ) : loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center animate-pulse">
                            <i className="fa-solid fa-diagram-project text-3xl text-indigo-500"></i>
                        </div>
                        <div className="text-center">
                            <p className="text-slate-800 font-black text-lg tracking-tight">Loading Context Graph...</p>
                            <p className="text-slate-400 text-sm mt-1">Retrieving property intelligence factors</p>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                    </div>
                ) : graphResult ? (
                    <ContextGraphView
                        data={graphResult}
                        loading={loading}
                        onExtract={handleReExtract}
                    />
                ) : null}
            </div>
        </div>
    );
};

export default ContextGraphPage;
