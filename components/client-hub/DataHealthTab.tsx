
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, limit, documentId } from 'firebase/firestore';
import { db, auth } from '../../services/firebase/config';
import { APICallEvent } from '../../services/firebase/api_logs';
import { LLMCallEvent } from '../../types/ai';
import { PipelineProgress, runFullIntelligencePipeline } from '../../services/preloadService';

interface PropertyHealth {
    zpid: string;
    address: string;
    city: string;
    apiCalls: APICallEvent[];
    llmCalls: LLMCallEvent[];
    lastUpdated?: any;
    status: 'healthy' | 'warning' | 'error' | 'pending';
}

const DataHealthTab: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [healthData, setHealthData] = useState<PropertyHealth[]>([]);
    const [filter, setFilter] = useState<'ALL' | 'ERROR' | 'WARNING'>('ALL');
    const [retryingZpids, setRetryingZpids] = useState<Set<string>>(new Set());
    const [activeCity, setActiveCity] = useState<string>('All Cities');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);
    const [totalCount, setTotalCount] = useState(0);

    const cities = useMemo(() => {
        const uniqueCities = Array.from(new Set(healthData.map(h => h.city))).sort();
        return [...uniqueCities, 'All Cities'];
    }, [healthData]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const userId = auth?.currentUser?.uid || 'unknown';

            // 1. Fetch properties (Primary list)
            const propertyQuery = query(
                collection(db, "properties"),
                orderBy("address", "asc")
            );
            const propertySnapshot = await getDocs(propertyQuery);
            const properties = propertySnapshot.docs.map(doc => ({ zpid: doc.id, ...doc.data() } as any));
            setTotalCount(properties.length);

            // 2. Fetch Data Collections (Source of Truth) - Fetch sequentially to avoid saturating network
            const visualSnapshot = await getDocs(collection(db, "property_analyses_visual"));
            const qualitySnapshot = await getDocs(collection(db, "image_quality_analysis"));
            const investmentSnapshot = await getDocs(collection(db, "property_investment_research"));
            const comprehensiveSnapshot = await getDocs(collection(db, "property_analyses_comprehensive"));

            const visualAnalysisMap = Object.fromEntries(visualSnapshot.docs.map(d => [d.id, d.data()]));
            const qualityMap = Object.fromEntries(qualitySnapshot.docs.map(d => [d.id, d.data()]));
            const investmentMap = Object.fromEntries(investmentSnapshot.docs.map(d => [d.id, d.data()]));
            const comprehensiveMap = Object.fromEntries(comprehensiveSnapshot.docs.map(d => [d.id, d.data()]));

            // 3. Map properties to Health items purely based on Table Data
            const healthItems: PropertyHealth[] = properties.map(p => {
                const zpid = p.zpid;
                const visual = visualAnalysisMap[zpid] as any;
                const quality = qualityMap[zpid] as any;
                const investment = investmentMap[zpid] as any;

                // DATA INSPECTION
                const hasSolar = !!p.solarData;
                const hasAir = !!p.airQuality;
                const hasPollen = !!p.pollen;
                const hasAnalysis = !!p.analysis;
                const hasComprehensive = !!p.comprehensive_analysis || !!comprehensiveMap[zpid];
                const hasImages = (p.images && p.images.length > 0);
                const hasComps = (p.comps && p.comps.length > 0);
                const hasCoreData = (p.bedrooms !== undefined && p.bedrooms !== null) &&
                    (p.bathrooms !== undefined && p.bathrooms !== null) &&
                    !!p.description &&
                    !!(p.listPrice ?? p.price);

                // Deep Node Verification
                const hasInterior = !!visual?.home_interior;
                const hasRooms = !!(visual?.room_highlights && visual.room_highlights.length > 0);
                const hasExterior = !!visual?.exterior_and_neighborhood;
                const hasNeighborhood = !!visual?.neighborhood;
                const hasImageByImage = !!(visual?.image_by_image_analysis && visual.image_by_image_analysis.length > 0);
                const hasInvestment = !!investment;
                const hasQuality = !!quality;

                // 1. Map API Status (From Property Table)
                const apiStatus = [
                    { name: 'Core Data', verified: hasCoreData },
                    { name: 'Images', verified: hasImages },
                    { name: 'Comps', verified: hasComps },
                    { name: 'WalkScore', verified: !!p.walkScore },
                    { name: 'Geocode', verified: !!p.coordinates },
                    { name: 'Solar', verified: hasSolar },
                    { name: 'AirQuality', verified: hasAir },
                    { name: 'Pollen', verified: hasPollen },
                    { name: 'Static Maps (In)', verified: !!p.mapZoomIn },
                    { name: 'Static Maps (Out)', verified: !!p.mapZoomOut },
                    { name: 'StreetView Analysis', verified: !!p.streetViewAnalysis }
                ].map(item => ({
                    api_name: item.name,
                    endpoint: 'Verified',
                    status: item.verified ? 'completed' : 'failed',
                    timestamp: new Date()
                } as any));

                // 2. Map Gemini Status (From Analysis Tables)
                const aiStatus = [
                    { name: 'Interior', verified: hasInterior },
                    { name: 'Rooms', verified: hasRooms },
                    { name: 'Exterior', verified: hasExterior },
                    { name: 'Neighborhood', verified: hasNeighborhood },
                    { name: 'Visual IQ', verified: hasQuality },
                    { name: 'Financial', verified: hasInvestment },
                    { name: 'Image Analysis', verified: hasImageByImage },
                    { name: 'Narrative Synthesis', verified: hasComprehensive }
                ].map(item => ({
                    prompt_filename: item.name,
                    status: item.verified ? 'completed' : 'failed',
                    timestamp: new Date()
                } as any));

                const hasApiError = apiStatus.some(c => c.status === 'failed');
                const hasLlmError = aiStatus.some(c => c.status === 'failed');

                let status: PropertyHealth['status'] = 'healthy';
                if (hasApiError || hasLlmError) status = 'error';
                else if (!hasComprehensive) status = 'warning';

                return {
                    zpid,
                    address: p.address,
                    city: p.city || 'Other',
                    apiCalls: apiStatus,
                    llmCalls: aiStatus,
                    status
                };
            });

            setHealthData(healthItems);
        } catch (error) {
            console.error("Error fetching health data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredData = useMemo(() => {
        let base = healthData;
        if (activeCity !== 'All Cities') base = base.filter(h => h.city === activeCity);
        if (filter === 'ERROR') base = base.filter(h => h.status === 'error');
        if (filter === 'WARNING') base = base.filter(h => h.status === 'warning');

        return base;
    }, [healthData, filter, activeCity]);

    const paginatedData = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredData.slice(start, start + pageSize);
    }, [filteredData, page, pageSize]);

    const totalPages = Math.ceil(filteredData.length / pageSize);

    const handleRetry = async (property: PropertyHealth) => {
        if (retryingZpids.has(property.zpid)) return;

        setRetryingZpids(prev => new Set(prev).add(property.zpid));
        try {
            await runFullIntelligencePipeline(property.address, (progress) => {
                console.log(`Retrying ${property.address}: ${progress.message}`);
            });
            setTimeout(fetchData, 2000);
        } catch (error) {
            console.error(`Retry failed for ${property.address}:`, error);
        } finally {
            setRetryingZpids(prev => {
                const next = new Set(prev);
                next.delete(property.zpid);
                return next;
            });
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen bg-slate-50/50">
            <div className="flex items-center justify-between mb-6">
                <div className="flex gap-2">
                    {/* Diagnostic Controls */}
                    <div className="flex gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                        {(['ALL', 'ERROR', 'WARNING'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {f}
                            </button>
                        ))}
                        <button
                            onClick={fetchData}
                            className="ml-2 w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                            title="Refresh Diagnostic"
                        >
                            <i className={`fa-solid fa-arrows-rotate ${loading ? 'animate-spin' : ''}`}></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* City Tabs */}
            <div className="flex gap-4 mb-8 overflow-x-auto pb-2 no-scrollbar">
                {cities.map(city => {
                    const count = city === 'All Cities' ? healthData.length : healthData.filter(h => h.city === city).length;
                    const hasError = city === 'All Cities' ? healthData.some(h => h.status === 'error') : healthData.filter(h => h.city === city).some(h => h.status === 'error');

                    return (
                        <button
                            key={city}
                            onClick={() => { setActiveCity(city); setPage(1); }}
                            className={`flex items-center gap-3 px-6 py-3 rounded-2xl whitespace-nowrap transition-all border
                                ${activeCity === city ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'}
                            `}
                        >
                            {hasError && activeCity !== city && <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>}
                            <span className="text-[11px] font-black uppercase tracking-widest">{city}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${activeCity === city ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {loading && healthData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-40">
                    <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Running System Diagnostics...</p>
                </div>
            ) : (
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Property Intelligence</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">API Gateway</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Gemini Analysis</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginatedData.length > 0 ? paginatedData.map((prop: PropertyHealth) => (
                                <tr key={prop.zpid} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="p-6">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner border
                                                ${prop.status === 'healthy' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    prop.status === 'error' ? 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse' :
                                                        'bg-amber-50 text-amber-600 border-amber-100'}
                                            `}>
                                                <i className={`fa-solid ${prop.status === 'healthy' ? 'fa-square-check' : prop.status === 'error' ? 'fa-triangle-exclamation' : 'fa-clock-rotate-left'} text-xl`}></i>
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                    {prop.address || (prop.zpid ? `Property ${prop.zpid}` : 'Unnamed Property')}
                                                </div>
                                                <div className="text-[10px] font-mono text-slate-400 mt-1">ZPID: {prop.zpid || 'N/A'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex flex-wrap gap-1.5">
                                            {prop.apiCalls.length > 0 ? [...prop.apiCalls].sort((a, b) => (a.status === 'failed' ? -1 : 1)).map((call, i) => (
                                                <div key={i}
                                                    className={`px-2 py-1 rounded text-[9px] font-black uppercase border
                                                        ${call.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}
                                                    `}
                                                    title={`${call.api_name}: ${call.endpoint}`}
                                                >
                                                    {call.api_name === 'RapidAPI' ? call.endpoint : call.api_name}
                                                </div>
                                            )) : (
                                                <span className="text-[10px] text-slate-300 italic font-medium">No API calls recorded</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex flex-wrap gap-1.5">
                                            {prop.llmCalls.length > 0 ? [...prop.llmCalls].sort((a, b) => (a.status === 'failed' ? -1 : 1)).map((call, i) => (
                                                <div key={i}
                                                    className={`px-2 py-1 rounded text-[9px] font-black uppercase border
                                                        ${call.status === 'completed' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-rose-50 text-rose-600 border-rose-100'}
                                                    `}
                                                    title={call.prompt_filename}
                                                >
                                                    {call.prompt_filename.split('.')[0]}
                                                </div>
                                            )) : (
                                                <span className="text-[10px] text-slate-300 italic font-medium">No LLM analysis recorded</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-6 text-right">
                                        {prop.status !== 'healthy' && (
                                            <button
                                                onClick={() => handleRetry(prop)}
                                                disabled={retryingZpids.has(prop.zpid)}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                                                    ${retryingZpids.has(prop.zpid) ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95'}
                                                `}
                                            >
                                                {retryingZpids.has(prop.zpid) ? (
                                                    <i className="fa-solid fa-spinner animate-spin mr-2"></i>
                                                ) : (
                                                    <i className="fa-solid fa-redo mr-2"></i>
                                                )}
                                                Re-Analyze
                                            </button>
                                        )}
                                        {prop.status === 'healthy' && (
                                            <div className="text-emerald-500 flex items-center justify-end gap-2 px-4 py-2">
                                                <i className="fa-solid fa-check-circle"></i>
                                                <span className="text-[10px] font-black uppercase tracking-widest">Verified</span>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={4} className="p-20 text-center">
                                        <div className="flex flex-col items-center opacity-30">
                                            <i className="fa-solid fa-shield-heart text-6xl mb-4 text-slate-200"></i>
                                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">All systems operational</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-4">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 disabled:opacity-30 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <i className="fa-solid fa-chevron-left"></i>
                    </button>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Page {page} of {totalPages}
                    </div>
                    <button
                        disabled={page === totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 disabled:opacity-30 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <i className="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
            )}

            <div className="mt-8 flex gap-8">
                <div className="flex-1 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xs border border-rose-100">
                            <i className="fa-solid fa-triangle-exclamation"></i>
                        </div>
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">RapidAPI Failures</h3>
                    </div>
                    <div className="text-3xl font-black text-slate-900 mb-1">
                        {healthData.filter(h => h.apiCalls.some(c => c.status === 'failed')).length}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Properties with broken housing data</p>
                </div>

                <div className="flex-1 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs border border-indigo-100">
                            <i className="fa-solid fa-robot"></i>
                        </div>
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Gemini Gaps</h3>
                    </div>
                    <div className="text-3xl font-black text-slate-900 mb-1">
                        {healthData.filter(h => h.llmCalls.some(c => c.status === 'failed')).length}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Properties missing structural analysis</p>
                </div>

                <div className="flex-1 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs border border-emerald-100">
                            <i className="fa-solid fa-bolt"></i>
                        </div>
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Direct Action</h3>
                    </div>
                    <button
                        onClick={() => setFilter('ERROR')}
                        className="w-full mt-2 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                    >
                        Repair All Failures
                        <i className="fa-solid fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DataHealthTab;
