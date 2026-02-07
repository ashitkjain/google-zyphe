import React from 'react';
import { BiddingStrategyResult, PropertyComp, PriceHistoryItem } from '../../../../types';

interface BiddingViewProps {
    data: BiddingStrategyResult;
    comps?: PropertyComp[];
    priceHistory?: PriceHistoryItem[];
    onRefresh: () => void;
}

export const BiddingView: React.FC<BiddingViewProps> = ({ data, comps, priceHistory, onRefresh }) => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-5xl mx-auto space-y-8">
        <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                    <div className="text-xl font-black text-indigo-600 uppercase tracking-[0.3em]">BIDDING STRATEGY REPORT</div>
                    <button
                        onClick={onRefresh}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all active:scale-95"
                    >
                        <i className="fa-solid fa-rotate"></i>
                        Refresh Strategy
                    </button>
                </div>
                <p className="text-gray-800 font-sans font-normal text-[13px] leading-[1.625]">{data.negotiation_strategy.leverage_analysis}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                    <div className="px-6 py-5 bg-white rounded-[2rem] border border-gray-100 flex flex-col shadow-sm gap-2">
                        <span className="text-xl font-black text-gray-400 uppercase tracking-widest mb-2">Inventory Pressure</span>
                        <div className="flex flex-wrap gap-2 items-center">
                            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg border border-indigo-100 w-fit">
                                {data.inventory_pressure.market_category}
                            </span>
                            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg border border-indigo-100 w-fit">
                                {data.inventory_pressure.months_of_supply} MOS
                            </span>
                        </div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625] mt-1">
                            {data.inventory_pressure.pressure_analysis}
                        </p>
                    </div>
                    <div className="px-6 py-5 bg-white rounded-[2rem] border border-gray-100 flex flex-col shadow-sm gap-2">
                        <span className="text-xl font-black text-gray-400 uppercase tracking-widest mb-2">Offer Velocity</span>
                        <div className="flex flex-wrap gap-2 items-center">
                            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg border border-indigo-100 w-fit">
                                {data.offer_velocity.velocity_status}
                            </span>
                        </div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625] mt-1">
                            {data.offer_velocity.recent_offer_trends}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 pt-12 border-t border-gray-100">
                <div className="space-y-3">
                    <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Property DOM</div>
                    <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.property_specifics.days_on_market}</p>
                    {(() => {
                        const history = data.property_specifics.listing_history;
                        const isMeaningfulArray = Array.isArray(history) &&
                            history.length > 0 &&
                            !history.some(h =>
                                h.toLowerCase().includes('unknown') ||
                                h.toLowerCase().includes('no history') ||
                                h.toLowerCase().includes('no meaningful')
                            );

                        const isMeaningfulString = typeof history === 'string' &&
                            history.length > 10 &&
                            !history.toLowerCase().includes('unknown');

                        if (!isMeaningfulArray && !isMeaningfulString) return null;

                        return (
                            <div className="mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Listing History</span>
                                <ul className="space-y-1">
                                    {priceHistory && priceHistory.length > 0 ? (
                                        priceHistory.map((item, i) => (
                                            <li key={i} className="text-[11px] font-bold text-gray-600 list-disc list-inside font-sans">
                                                {item.date}: {item.event} {item.price ? `at $${item.price.toLocaleString()}` : ''}
                                            </li>
                                        ))
                                    ) : Array.isArray(history) ? (
                                        history.map((h, i) => (
                                            <li key={i} className="text-[11px] font-bold text-gray-600 list-disc list-inside font-sans">{h}</li>
                                        ))
                                    ) : (
                                        <li className="text-[11px] font-bold text-gray-600 list-disc list-inside font-sans">{history as string}</li>
                                    )}
                                </ul>
                            </div>
                        );
                    })()}
                </div>

                <div className="space-y-3">
                    <div className="text-xl font-black text-gray-400 uppercase tracking-widest">ZIP Benchmarks</div>
                    <div className="mt-2">
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.zip_code_benchmarks.median_days_on_market}</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Offer Tactics</div>
                    <div className="space-y-2">
                        {Array.isArray(data.negotiation_strategy.suggested_offer_tactics) && data.negotiation_strategy.suggested_offer_tactics.map((t, i) => (
                            <div key={i} className="px-3 py-2 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg border border-indigo-100 flex items-center gap-2">
                                <i className="fa-solid fa-check-double text-[8px]"></i>
                                {t}
                            </div>
                        ))}
                        {!Array.isArray(data.negotiation_strategy.suggested_offer_tactics) && typeof data.negotiation_strategy.suggested_offer_tactics === 'string' && (
                            <div className="px-3 py-2 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg border border-indigo-100 flex items-center gap-2">
                                <i className="fa-solid fa-check-double text-[8px]"></i>
                                {data.negotiation_strategy.suggested_offer_tactics}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="pt-12 border-t border-gray-100">
                <div className="bg-indigo-700 rounded-[2.5rem] p-8 md:p-10 text-white shadow-xl shadow-indigo-100 flex flex-col md:flex-row items-center gap-8">
                    <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/20"><i className="fa-solid fa-calculator text-2xl"></i></div>
                    <div className="flex-1">
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200 mb-2">Calculated Negotiation Strategy</div>
                        <p className="text-indigo-50 font-sans font-normal text-[13px] leading-[1.625] opacity-90">{data.negotiation_strategy.calculated_discount_strategy}</p>
                    </div>
                </div>
            </div>

            {comps && comps.length > 0 && (
                <div className="pt-12 border-t border-gray-100 space-y-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="text-xl font-black text-gray-900 uppercase tracking-[0.3em]">COMPARABLE SALES</div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-gray-200">
                            <i className="fa-solid fa-database text-gray-400"></i>
                            {comps.length} Grounded Comps Found
                        </div>
                    </div>

                    <div className="overflow-x-auto -mx-8 md:-mx-12 px-8 md:px-12">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="text-left py-4 px-2 text-[11px] font-bold text-gray-900 uppercase tracking-widest">Address</th>
                                    <th className="text-left py-4 px-2 text-[11px] font-bold text-gray-900 uppercase tracking-widest">Sale Price</th>
                                    <th className="text-center py-4 px-2 text-[11px] font-bold text-gray-900 uppercase tracking-widest">PPSF</th>
                                    <th className="text-center py-4 px-2 text-[11px] font-bold text-gray-900 uppercase tracking-widest">DOM</th>
                                    <th className="text-right py-4 px-2 text-[11px] font-bold text-gray-900 uppercase tracking-widest">Specs & Lot</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {comps.map((comp, idx) => (
                                    <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                                        <td className="py-5 px-2">
                                            <div className="text-sm font-medium text-gray-900">{comp.address}</div>
                                            <div className="text-[11px] font-medium text-gray-400 uppercase tracking-tight mt-0.5">{comp.homeType?.replace(/_/g, ' ') || 'Single Family'}</div>
                                        </td>
                                        <td className="py-5 px-2 whitespace-nowrap">
                                            <div className="text-sm font-bold text-gray-900">
                                                {comp.price ? `$${comp.price.toLocaleString()}` : 'N/A'}
                                            </div>
                                            {comp.listPrice && comp.listPrice !== comp.price && (
                                                <div className="text-[10px] text-gray-400 font-medium">List: ${comp.listPrice.toLocaleString()}</div>
                                            )}
                                        </td>
                                        <td className="py-5 px-2 text-center whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {comp.pricePerSqFt ? `$${comp.pricePerSqFt}` : 'N/A'}
                                            </div>
                                        </td>
                                        <td className="py-5 px-2 text-center whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {comp.daysOnMarket !== null && comp.daysOnMarket !== undefined ? comp.daysOnMarket : 'N/A'}
                                            </div>
                                        </td>
                                        <td className="py-5 px-2 text-right whitespace-nowrap">
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="flex items-center gap-3 text-sm font-medium text-gray-600">
                                                    <span>{comp.bedrooms !== null ? `${comp.bedrooms} bd` : 'N/A'}</span>
                                                    <span>{comp.bathrooms !== null ? `${comp.bathrooms} ba` : 'N/A'}</span>
                                                    <span>{comp.livingAreaValue ? `${comp.livingAreaValue.toLocaleString()} sf` : 'N/A'}</span>
                                                </div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                                    Lot: {comp.lotSize || 'N/A'}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    </div>
);
