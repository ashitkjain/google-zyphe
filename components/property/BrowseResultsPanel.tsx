/**
 * BrowseResultsPanel
 *
 * Renders the results area of the Browse by City section:
 *   Step Timings · AI Matching Loading State · AI Match Results
 *   Gallery View · Table View · Map View · Pagination
 *
 * Extracted from BrowseByCitySection.tsx for maintainability.
 */
import React from 'react';
import PropertyCard from './PropertyCard';
import PropertyMapView from './PropertyMapView';
import { CityPropertySummary } from '../../services/firebase/properties';
import { getDaysOnMarket } from '../../utils/property.ts';

interface BrowseResultsPanelProps {
    // Buyer AI search
    buyerTimings: Record<string, number> | null;
    buyerSearching: boolean;
    buyerResults: Array<{ zpid: string; score: number; explanation: string, matchWriteup?: string; factors?: string[] }> | null;
    buyerExtracted: any;
    buyerError: string | null;
    showTimings: boolean;
    activePath: 'browse' | 'story' | 'search';
    // Results data
    pageItems: CityPropertySummary[];
    displayList: CityPropertySummary[];
    totalPages: number;
    page: number;
    setPage: React.Dispatch<React.SetStateAction<number>>;
    selectedCity: string;
    // View
    viewMode: 'zypheai' | 'gallery' | 'table' | 'map';
    // Derived / computed
    matchMap: Record<string, { score: number; rank: number; explanation?: string; matchWriteup?: string; factors?: string[] }>;
    cityGraphs: Map<string, any>;
    hoveredZpid: string | null;
    setHoveredZpid: (zpid: string | null) => void;
    // Formatters & sorters
    fmt: (n?: number) => string;
    expandFactor: (f: string) => string;
    toggleSort: (field: string) => void;
    sortIcon: (field: string) => string;
    // AI result state setters
    setBuyerResults: (v: any) => void;
    setBuyerExtracted: (v: any) => void;
    setSliderIdx: (v: number) => void;
    setViewModeLocal: (v: 'zypheai' | 'gallery' | 'table' | 'map') => void;
    setShowBuyerSearch: (v: boolean) => void;
    // Callbacks
    onPropertyClick: (address: string) => void;
    onLeadCapture?: (type: 'tour' | 'info', address: string, zpid?: string, price?: number) => void;
}


export const BrowseResultsPanel: React.FC<BrowseResultsPanelProps> = ({
    buyerTimings,
    buyerSearching,
    buyerResults,
    buyerExtracted,
    buyerError,
    showTimings,
    activePath,
    pageItems,
    displayList,
    totalPages,
    page,
    setPage,
    selectedCity,
    viewMode,
    matchMap,
    cityGraphs,
    hoveredZpid,
    setHoveredZpid,
    fmt,
    expandFactor,
    toggleSort,
    sortIcon,
    setBuyerResults,
    setBuyerExtracted,
    setSliderIdx,
    setViewModeLocal,
    setShowBuyerSearch,
    onPropertyClick,
    onLeadCapture,
}) => {

    return (
        <>
                    {/* ── STEP TIMINGS ── */}
                    {buyerTimings && (
                        <div className="flex flex-wrap items-center gap-2 text-[10px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                            <span className="font-black text-slate-500 uppercase tracking-wider mr-1">
                                <i className="fa-solid fa-stopwatch text-teal-500 mr-1"></i>Performance:
                            </span>
                            {buyerTimings.map((t, i) => (
                                <span
                                    key={i}
                                    className={`font-bold px-2 py-0.5 rounded-md border ${t.step === 'TOTAL'
                                        ? t.ms < 5000
                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-black'
                                            : t.ms < 8000
                                                ? 'bg-amber-100 text-amber-800 border-amber-300 font-black'
                                                : 'bg-rose-100 text-rose-800 border-rose-300 font-black'
                                        : 'bg-white text-slate-700 border-slate-200'
                                        }`}
                                    title={t.detail || ''}
                                >
                                    {t.step}: {t.ms < 1000 ? `${t.ms}ms` : `${(t.ms / 1000).toFixed(1)}s`}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* ── AI MATCHING LOADING STATE ── */}
                    {buyerSearching && (
                        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in-95 duration-500">
                            {/* Animated AI Pulse Visual */}
                            <div className="relative mb-8">
                                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-3xl animate-pulse scale-150"></div>
                                <div className="relative flex items-center justify-center">
                                    <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin duration-[2s]"></div>
                                    <div className="absolute inset-0 flex items-center justify-center translate-y-[-2px]">
                                        <i className="fa-solid fa-sparkles text-indigo-500 text-3xl animate-pulse"></i>
                                    </div>
                                </div>
                            </div>

                            <div className="text-center max-w-md px-6">
                                <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight mb-2 uppercase">
                                    {!buyerExtracted ? "AI is Extracting Requirements..." : "AI is Scoring & Matching Homes..."}
                                </h3>
                                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                    {!buyerExtracted 
                                        ? "Analyzing your narrative to identify key filters, architectural preferences, and neighborhood priorities."
                                        : "Comparing your specific requirements against the entire local inventory to find the perfect home."
                                    }
                                </p>
                            </div>

                            {/* Show extracted criteria while scoring, with a partial layout */}
                            {buyerExtracted && (
                                <div className="mt-12 w-full max-w-3xl opacity-60 pointer-events-none scale-[0.98] transition-all">
                                    <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest text-center mb-3">Extracted Requirements: Stage 1 Complete</div>
                                    <div className="bg-white border-2 border-dashed border-indigo-100 rounded-3xl p-6 shadow-sm">
                                        <div className="flex flex-wrap justify-center gap-2 mb-4">
                                            {buyerExtracted.priceMin > 0 && <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-black rounded-lg text-xs">💰 {fmt(buyerExtracted.priceMin)}–{fmt(buyerExtracted.priceMax)}</span>}
                                            {buyerExtracted.beds && <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-black rounded-lg text-xs">🛏 {buyerExtracted.beds}+ beds</span>}
                                            {buyerExtracted.baths && <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-black rounded-lg text-xs">🚿 {buyerExtracted.baths}+ baths</span>}
                                            {buyerExtracted.homeType && <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-black rounded-lg text-xs">🏠 {buyerExtracted.homeType.replace(/_/g, ' ')}</span>}
                                            {buyerExtracted.stories && <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-black rounded-lg text-xs">🏗 {buyerExtracted.stories} story</span>}
                                            {buyerExtracted.minSchoolRating && <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-black rounded-lg text-xs">🎓 Schools {buyerExtracted.minSchoolRating}+</span>}
                                        </div>
                                        <div className="space-y-3">
                                            {buyerExtracted.mustHaves.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 justify-center">
                                                    {buyerExtracted.mustHaves.map((mh, i) => (
                                                        <span key={i} className="text-[10px] bg-rose-50 text-rose-600 font-bold px-2 py-0.5 rounded border border-rose-100">✔ {mh}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Progress feedback bar */}
                            <div className="mt-12 w-48 h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full bg-indigo-600 transition-all duration-700 ${buyerExtracted ? 'w-3/4' : 'w-1/4 animate-pulse'}`}></div>
                            </div>
                        </div>
                    )}

                    {/* ── AI MATCH RESULTS (VERTICAL SCROLL) ── */}
                    {viewMode === 'zypheai' && buyerResults && buyerResults.length > 0 && !buyerSearching && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            

                            {/* Header */}
                            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl px-5 py-3 flex items-center gap-3">
                                <i className="fa-solid fa-trophy text-amber-300"></i>
                                <span className="text-sm font-black text-white">AI Match Results</span>
                                <span className="text-[10px] font-bold text-indigo-200 ml-1">{displayList.length} matches</span>
                                <button
                                    onClick={() => { setBuyerResults(null); setBuyerExtracted(null); setSliderIdx(0); setViewModeLocal('gallery'); setShowBuyerSearch(false); }}
                                    className="ml-auto text-[10px] font-bold text-indigo-200 hover:text-white transition-colors flex items-center gap-1"
                                >
                                    <i className="fa-solid fa-xmark"></i> Clear & Show All
                                </button>
                            </div>

                            {/* Scrollable results list */}
                            <div className="max-h-[70vh] overflow-y-auto space-y-3 pr-1" style={{ scrollbarWidth: 'thin' }}>
                                {displayList.map((prop, idx) => {
                                    const match = matchMap[String(prop.zpid)];
                                    if (!match) return null;
                                    const img = prop.imgSrc || prop.images?.[0] || '';
                                    return (
                                        <div
                                            key={match.zpid}
                                            className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all overflow-hidden"
                                        >
                                            <div className="flex flex-col sm:flex-row">
                                                {/* Image */}
                                                {img && (
                                                    <div
                                                        className="sm:w-56 h-40 sm:h-auto flex-shrink-0 bg-cover bg-center cursor-pointer relative"
                                                        style={{ backgroundImage: `url(${img})`, minHeight: 160 }}
                                                        onClick={() => window.open(`/explore?q=${encodeURIComponent(match.address || prop.address)}`, '_blank')}
                                                    >
                                                        {/* Rank badge */}
                                                        <span className={`absolute top-2 left-2 text-[10px] font-black px-2 py-1 rounded-lg shadow-md ${idx === 0 ? 'bg-amber-400 text-white' : idx < 3 ? 'bg-indigo-600 text-white' : 'bg-white/95 text-slate-600 border border-slate-200'
                                                            }`}>
                                                            #{idx + 1}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Content */}
                                                <div className="flex-1 p-4 space-y-3">
                                                    {/* Address + Score row */}
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <button
                                                                onClick={() => window.open(`/explore?q=${encodeURIComponent(match.address || prop.address)}`, '_blank')}
                                                                className="text-sm font-black text-slate-800 hover:text-indigo-600 transition-colors text-left"
                                                            >
                                                                {prop.address}
                                                            </button>
                                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                                                {prop.listPrice && <span className="text-sm font-black text-emerald-600">{fmt(prop.listPrice)}</span>}
                                                                {prop.bedrooms && <span className="text-[11px] text-slate-500 font-bold">{prop.bedrooms} bd</span>}
                                                                {prop.bathrooms && <span className="text-[11px] text-slate-500 font-bold">{prop.bathrooms} ba</span>}
                                                                {prop.livingArea && <span className="text-[11px] text-slate-500 font-bold">{prop.livingArea.toLocaleString()} sqft</span>}
                                                            </div>
                                                        </div>
                                                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center ${match.score >= 80 ? 'bg-emerald-50 border border-emerald-200' : match.score >= 60 ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-slate-200'}`}>
                                                            <span className={`text-lg font-black ${match.score >= 80 ? 'text-emerald-600' : match.score >= 60 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                                {match.score}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        {match.matchWriteup && (
                                                            <div className="flex flex-wrap gap-1.5 pb-1">
                                                                {(match.matchWriteup.match(/✅\s*([^✅❌👤\.]+)/g) || []).map((tag, tIdx) => (
                                                                    <span key={tIdx} className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                                        {tag.replace('✅', '').trim()}
                                                                    </span>
                                                                ))}
                                                                {(match.matchWriteup.match(/❌\s*([^✅❌👤\.]+)/g) || []).map((tag, tIdx) => (
                                                                    <span key={tIdx} className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100">
                                                                        {tag.replace('❌', '').trim()}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {match.matchWriteup && (
                                                            <p className="text-[11.5px] text-slate-700 leading-relaxed italic">
                                                                {match.matchWriteup}
                                                            </p>
                                                        )}
                                                        
                                                        {/* Context Graph Insights */}
                                                        {match.factors && match.factors.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-2 mb-1">
                                                                {match.factors.map((f, i) => (
                                                                    <span key={i} className="px-1.5 py-0.5 rounded bg-amber-50/50 border border-amber-100/50 text-[9px] font-bold text-amber-700/80">
                                                                        <i className="fa-solid fa-sparkles text-[7px] mr-1 opacity-50"></i>{expandFactor(f)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── GALLERY VIEW ── */}
                    {viewMode === 'gallery' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {pageItems.map(prop => {
                                const match = matchMap[String(prop.zpid)];
                                return (
                                    <PropertyCard
                                        key={prop.zpid}
                                        property={prop}
                                        match={match}
                                        factors={cityGraphs.get(String(prop.zpid))?.factors}
                                        onClick={() => window.open(`/explore?q=${encodeURIComponent(prop.address)}`, '_blank')}
                                        onTourClick={(e) => { e.stopPropagation(); onLeadCapture?.('tour', prop.address, prop.zpid, prop.listPrice); }}
                                        onInfoClick={(e) => { e.stopPropagation(); onLeadCapture?.('info', prop.address, prop.zpid, prop.listPrice); }}

                                    />
                                );
                            })}
                        </div>
                    )}

                    {/* ── TABLE VIEW ── */}
                    {viewMode === 'table' && (
                        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => toggleSort('address')}>
                                            Address <i className={`fa-solid ${sortIcon('address')} ml-1`}></i>
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors text-right" onClick={() => toggleSort('listPrice')}>
                                            Price <i className={`fa-solid ${sortIcon('listPrice')} ml-1`}></i>
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors text-center" onClick={() => toggleSort('bedrooms')}>
                                            Beds <i className={`fa-solid ${sortIcon('bedrooms')} ml-1`}></i>
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors text-center" onClick={() => toggleSort('bathrooms')}>
                                            Baths <i className={`fa-solid ${sortIcon('bathrooms')} ml-1`}></i>
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors text-right" onClick={() => toggleSort('livingArea')}>
                                            Sq Ft <i className={`fa-solid ${sortIcon('livingArea')} ml-1`}></i>
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors text-right" onClick={() => toggleSort('lotSize')}>
                                            Lot <i className={`fa-solid ${sortIcon('lotSize')} ml-1`}></i>
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors text-center" onClick={() => toggleSort('homeType')}>
                                            Type <i className={`fa-solid ${sortIcon('homeType')} ml-1`}></i>
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors text-left" onClick={() => toggleSort('neighborhood')}>
                                            Neighborhood <i className={`fa-solid ${sortIcon('neighborhood')} ml-1`}></i>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageItems.map((prop, i) => {
                                        const match = matchMap[prop.zpid];
                                        return (
                                            <tr
                                                key={prop.zpid}
                                                onClick={() => window.open(`/explore?q=${encodeURIComponent(prop.address)}`, '_blank')}
                                                onMouseEnter={() => match && setHoveredZpid(prop.zpid)}
                                                onMouseLeave={() => setHoveredZpid(null)}
                                                className={`cursor-pointer transition-colors relative ${match ? 'bg-indigo-50/40 hover:bg-indigo-50' : i % 2 === 0 ? 'bg-white hover:bg-indigo-50/50' : 'bg-slate-50/30 hover:bg-indigo-50/50'}`}
                                            >
                                                <td className="px-4 py-3 text-xs font-bold text-slate-900 hover:text-indigo-600 max-w-[320px] relative">
                                                    <div className="flex items-center gap-2">
                                                        {match && (
                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0 ${match.rank === 1 ? 'bg-amber-400 text-white' : match.rank <= 3 ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                                                                #{match.rank}
                                                            </span>
                                                        )}
                                                        <span className="truncate">{prop.address}</span>
                                                    </div>
                                                    {/* Hover tooltip for table row */}
                                                    {match && hoveredZpid === prop.zpid && (
                                                        <div className="absolute left-0 top-full z-30 w-[400px] bg-white border border-indigo-200 rounded-xl shadow-xl p-3 space-y-1.5 animate-in fade-in duration-150">
                                                            <p className="text-[11px] text-slate-700 leading-relaxed">{match.matchWriteup}</p>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-black text-indigo-600 text-right">
                                                    {fmt(prop.listPrice)}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-bold text-slate-600 text-center">
                                                    {prop.bedrooms || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-bold text-slate-600 text-center">
                                                    {prop.bathrooms || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-bold text-slate-600 text-right">
                                                    {prop.livingArea ? prop.livingArea.toLocaleString() : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-bold text-slate-600 text-right">
                                                    {prop.lotSize || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-bold text-slate-400 text-center">
                                                    {prop.homeType || '—'}
                                                </td>
                                                {match ? (
                                                    <td className="px-4 py-3 min-w-[300px]">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-[10px] font-black px-2 py-1 rounded-md flex-shrink-0 ${match.score >= 80 ? 'bg-emerald-100 text-emerald-700' : match.score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                                    {match.score}/100
                                                                </span>
                                                                <span className="text-[10px] font-bold text-slate-500 italic truncate max-w-[200px]">{match.matchWriteup}</span>
                                                            </div>
                                                            {match.matchWriteup && (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {(match.matchWriteup.match(/✅\s*([^✅❌👤\.]+)/g) || [])
                                                                        .slice(0, 3)
                                                                        .map((tag, tIdx) => (
                                                                            <span key={tIdx} className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter mr-1 truncate max-w-[80px]">#{tag.replace('✅', '').trim().replace(/\s+/g, '')}</span>
                                                                        ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                ) : (
                                                    <td className="px-4 py-3 text-xs font-bold text-emerald-600">
                                                        {prop.neighborhood || '—'}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ── MAP VIEW (split: map left, property list right) ── */}
                    {viewMode === 'map' && (
                        <div className="flex w-full rounded-2xl border border-slate-200 shadow-sm">
                            {/* Map — left ~60%, relative for overlay */}
                            <div className="flex-[3] min-w-0 relative">
                                <PropertyMapView
                                    properties={displayList}
                                    onPropertyClick={(addr) => window.open(`/explore?q=${encodeURIComponent(addr)}`, '_blank')}
                                    selectedCity={selectedCity}
                                    matchMap={buyerResults ? Object.fromEntries(
                                        buyerResults.map((r, i) => [r.zpid, { score: r.score, rank: i + 1, highlight: r.matchWriteup?.split('.')[0] }])
                                    ) : undefined}
                                    containerClassName="w-full h-full relative bg-white"
                                />

                            </div>

                            {/* Property list — right ~40% */}
                            <div
                                className="flex-[2] min-w-0 flex flex-col bg-white border-l border-slate-200"
                                style={{ height: 'calc(100dvh - 310px)', minHeight: '480px' }}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-white shrink-0">
                                    <span className="text-xs font-black text-slate-700">{displayList.length} Results</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Recently Listed</span>
                                </div>

                                {/* Scrollable cards (2-col grid) */}
                                <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin' }}>
                                    <div className="grid grid-cols-2 gap-2 p-2">
                                        {displayList.map(prop => {
                                            const match = matchMap[String(prop.zpid)];
                                            const img = prop.images?.[0] || '';
                                            return (
                                                <div
                                                    key={prop.zpid}
                                                    onClick={() => window.open(`/explore?q=${encodeURIComponent(prop.address)}`, '_blank')}
                                                    className="bg-white border border-slate-200 rounded-xl overflow-hidden cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all"
                                                >
                                                    {/* Image */}
                                                    <div className="relative h-40 bg-slate-100">
                                                        {img ? (
                                                            <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <i className="fa-solid fa-house text-slate-300 text-2xl"></i>
                                                            </div>
                                                        )}
                                                        {match && (
                                                            <span className={`absolute top-1.5 left-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm ${match.score >= 80 ? 'bg-emerald-500 text-white' : match.score >= 60 ? 'bg-amber-500 text-white' : 'bg-white/90 text-slate-600'}`}>
                                                                {match.score}
                                                            </span>
                                                        )}
                                                        {prop.daysOnZillow !== undefined && (
                                                            <span className="absolute top-1.5 right-1.5 text-[9px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded-md">
                                                                {prop.daysOnZillow === 0 ? 'New' : `${prop.daysOnZillow}d`}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Details */}
                                                    <div className="p-2 space-y-0.5">
                                                        <div className="text-sm font-black text-slate-900">{fmt(prop.listPrice)}</div>
                                                        <div className="text-[10px] text-slate-500 font-bold">
                                                            {[
                                                                prop.bedrooms && `${prop.bedrooms} bd`,
                                                                prop.bathrooms && `${prop.bathrooms} ba`,
                                                                prop.livingArea && `${prop.livingArea.toLocaleString()} sf`,
                                                            ].filter(Boolean).join(' · ')}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 truncate">{prop.address}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── PAGINATION ── */}
                    {totalPages > 1 && displayList.length > 0 && !buyerResults && viewMode !== 'zypheai' && viewMode !== 'map' && (
                        <div className="flex items-center justify-center gap-2 pt-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <i className="fa-solid fa-chevron-left"></i>
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                                .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis');
                                    acc.push(p);
                                    return acc;
                                }, [])
                                .map((p, i) =>
                                    p === 'ellipsis' ? (
                                        <span key={`e${i}`} className="text-xs text-slate-300 px-1">…</span>
                                    ) : (
                                        <button
                                            key={p}
                                            onClick={() => setPage(p)}
                                            className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${page === p
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    )
                                )}
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <i className="fa-solid fa-chevron-right"></i>
                            </button>
                        </div>
                    )}
        </>
    );
};

