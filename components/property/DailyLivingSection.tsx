import React from 'react';
import { PropertyData } from '../../types';
import { calculateSolarPotential } from '../../utils/solarCalculations';
import { computeSolarBenchmarks, computeNaturalLightScore, computeSolarSmartTags } from '../../utils/solarCityBenchmarks';
import CommuteCalculator from './CommuteCalculator';

interface Props {
    data: PropertyData;
    onRefresh?: () => void;
    refreshing?: boolean;
}

const DailyLivingSection: React.FC<Props> = ({ data, onRefresh, refreshing }) => {
    const RefreshBtn = () => onRefresh ? (
        <button
            onClick={onRefresh}
            disabled={refreshing}
            className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${refreshing ? 'text-indigo-400 animate-spin' : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
            title="Refresh"
        >
            <i className="fa-solid fa-arrows-rotate text-[9px]"></i>
        </button>
    ) : null;

    const [evLoading, setEvLoading] = React.useState(false);
    const [liveEv, setLiveEv] = React.useState<any>(null);

    const handleRefreshEV = async () => {
        if (!data.coordinates) return;
        setEvLoading(true);
        try {
            const { fetchNearbyEVChargers } = await import('../../services/api/environmental');
            const fresh = await fetchNearbyEVChargers(
                data.coordinates.latitude,
                data.coordinates.longitude,
                data.zpid,
                data.address
            );
            if (fresh) {
                setLiveEv(fresh);
                // Save to cache
                const key = data.zpid || data.address?.toLowerCase().replace(/[^a-z0-9]/g, '_');
                if (key) {
                    const { saveThirdPartyDataToCloud } = await import('../../services/firebaseService');
                    await saveThirdPartyDataToCloud(key, { evChargers: fresh });
                }
            }
        } catch (e) {
            console.error('[EV Refresh] Failed', e);
        }
        setEvLoading(false);
    };


    const [isSolarSpecsExpanded, setIsSolarSpecsExpanded] = React.useState(false);
    const solar = data.solarData;
    const solarPotential = solar?.estimatedSolarProduction || (solar ? calculateSolarPotential(solar) : null);

    if (!data.walkScore && !data.broadband && !data.coordinates && !(data as any).evChargers && !liveEv && !solar) return null;


    return (
        <div className="bg-white px-6 pt-6 pb-6 rounded-2xl border-2 border-slate-100 overflow-visible mb-6">
                        <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center">
                    <i className="fa-solid fa-route text-teal-600 text-[11px]"></i>
                </div>
                <span className="text-lg font-black text-slate-900 tracking-tight">Daily Living & Commute</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                


                {/* Mobility & Commute */}
                <div className="flex flex-col gap-3 lg:col-span-2 h-full">
                    <div className="flex flex-col gap-3 hover:shadow-xl transition-all duration-300 h-full">
                    <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                        <div className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center">
                                    <i className="fa-solid fa-route text-teal-600 text-[11px]"></i>
                                </div>
                                <span className="text-[16px] font-black text-slate-700 tracking-tight flex-1">Mobility</span>
                                <RefreshBtn />
                            </div>
                            <div className="space-y-2">
                                {[
                                    { icon: 'fa-person-walking', label: 'Walk', score: data.walkScore, desc: data.walkScoreDesc },
                                    { icon: 'fa-bus', label: 'Transit', score: data.transitScore, desc: data.transitScoreDesc },
                                    { icon: 'fa-bicycle', label: 'Bike', score: data.bikeScore, desc: data.bikeScoreDesc },
                                ].map(({ icon, label, score, desc }) => (
                                    <div key={label} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                        <i className={`fa-solid ${icon} text-[10px] text-slate-300`}></i>
                                        <div className="min-w-0">
                                            <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">{label}</div>
                                            <div className="text-[13px] font-normal text-slate-800 leading-snug">
                                                {score ? `${score}/100` : 'N/A'}{desc ? ` · ${desc}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="text-[8px] text-slate-700 mt-2 text-right">Walk Score</div>
                        </div>
                    </div>
                </div>

                                        {/* Commute Calculator */}
                    {data.coordinates && (
                    <div className="flex flex-col gap-3 hover:shadow-xl transition-all duration-300 h-full">
                        <CommuteCalculator originLat={data.coordinates.latitude} originLng={data.coordinates.longitude} propertyAddress={data.address} />
                    </div>
                    )}

                </div>

                {/* Connectivity */}
                    {data.broadband && (
                    <div className="flex flex-col gap-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full">
                        <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                            <div className="p-3">
                                <div className="flex items-center gap-2 mb-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                                        <i className="fa-solid fa-wifi text-blue-600 text-[11px]"></i>
                                    </div>
                                    <span className="text-[16px] font-black text-slate-700 tracking-tight">Connectivity</span>
                                </div>

                                {/* Summary badges */}
                                <div className="flex flex-wrap gap-1.5 mb-2.5">
                                    {data.broadband.hasFiber && (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider">Fiber ✓</span>
                                    )}
                                    {data.broadband.has5G && (
                                        <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-black uppercase tracking-wider">5G ✓</span>
                                    )}
                                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-wider">
                                        {data.broadband.providerCount} ISPs
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider">
                                        ↓ {data.broadband.topDownloadMbps >= 1000 ? `${(data.broadband.topDownloadMbps / 1000).toFixed(0)} Gbps` : `${data.broadband.topDownloadMbps} Mbps`}
                                    </span>
                                </div>

                                {/* Internet Providers — top 4 wired/fixed */}
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Internet Providers</div>
                                <div className="space-y-1 mb-3">
                                    {data.broadband.internetProviders
                                        .filter(p => !p.technology.includes('Satellite'))
                                        .slice(0, 4)
                                        .map((p, i) => {
                                            const techColor = p.technology === 'Fiber' ? 'bg-emerald-100 text-emerald-700'
                                                : p.technology === 'Cable' ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-slate-100 text-slate-600';
                                            return (
                                                <div key={i} className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-slate-100">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <i className={`fa-solid ${p.technology === 'Fiber' ? 'fa-bolt' : p.technology === 'Cable' ? 'fa-ethernet' : 'fa-tower-broadcast'} text-[9px] text-slate-400`}></i>
                                                        <span className="text-[12px] font-bold text-slate-700 truncate">{p.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${techColor}`}>{p.technology}</span>
                                                        <span className="text-[11px] font-black text-slate-500">
                                                            {p.maxDownloadMbps >= 1000 ? `${(p.maxDownloadMbps / 1000).toFixed(0)}G` : `${p.maxDownloadMbps}M`}↓
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>

                                {/* Cell Coverage */}
                                {data.broadband.cellCoverage.length > 0 && (
                                    <>
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Cell Coverage</div>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {/* Group by carrier, pick best signal */}
                                            {(() => {
                                                const byCarrier: Record<string, any> = {};
                                                for (const c of data.broadband!.cellCoverage) {
                                                    const existing = byCarrier[c.network];
                                                    if (!existing || c.rsrpDbm > existing.rsrpDbm) {
                                                        byCarrier[c.network] = c;
                                                    }
                                                }
                                                return Object.values(byCarrier).slice(0, 3).map((c: any, i: number) => {
                                                    const signalColor = c.signalLevel === 'Good' ? 'text-emerald-500'
                                                        : c.signalLevel === 'Fair' ? 'text-amber-500' : 'text-red-500';
                                                    const bars = c.signalLevel === 'Good' ? 4 : c.signalLevel === 'Fair' ? 2 : 1;
                                                    return (
                                                        <div key={i} className="p-2 bg-white rounded-lg border border-slate-100 text-center">
                                                            <div className="flex items-end justify-center gap-px mb-1 h-3.5">
                                                                {[1, 2, 3, 4].map(b => (
                                                                    <div
                                                                        key={b}
                                                                        className={`w-1 rounded-sm ${b <= bars ? signalColor.replace('text-', 'bg-') : 'bg-slate-200'}`}
                                                                        style={{ height: `${b * 25}%` }}
                                                                    />
                                                                ))}
                                                            </div>
                                                            <div className="text-[10px] font-black text-slate-700 leading-none">{c.network}</div>
                                                            <div className={`text-[9px] font-bold ${signalColor} capitalize`}>{c.signalLevel}</div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </>
                                )}
                                <div className="text-[8px] text-slate-700 mt-1 text-right">BroadbandMap</div>
                            </div>
                        </div>
                    </div>
                    )}


                
                    


                
        
                {/* Solar */}
                <div className="flex flex-col gap-3 col-span-1 lg:col-span-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                
                    {solar && (

                        <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden flex flex-col shadow-sm">
                            <div className="p-4">
                                {/* Header */}
                                <div className="flex items-center justify-between gap-3 mb-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-yellow-100 flex items-center justify-center">
                                            <i className="fa-solid fa-solar-panel text-yellow-600 text-[12px]"></i>
                                        </div>
                                        <span className="text-[16px] font-black text-slate-700 tracking-tight">Solar</span>
                                    </div>
                                </div>
                                {/* Sunshine + Production + City Benchmark row */}
                                <div className="flex items-center gap-3 mt-2 text-[12px]">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Sunshine</span>
                                        <span className="font-black text-slate-700">{Math.round(solar.maxSunshineHoursPerYear || 0).toLocaleString()} hrs/yr</span>
                                    </div>
                                    {solarPotential && (
                                        <>
                                            <div className="w-px h-6 bg-slate-200"></div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Production</span>
                                                <span className="font-black text-indigo-600">{solarPotential.annualKwh.toLocaleString()} kWh</span>
                                            </div>
                                        </>
                                    )}
                                    {(() => {
                                        const bench = computeSolarBenchmarks(solar, data.city, data.state);
                                        if (!bench) return null;
                                        const pct = bench.sunshinePctOfAvg;
                                        let label: string;
                                        let labelColor: string;
                                        if (pct >= 102) { label = 'Sun-Drenched'; labelColor = 'emerald'; }
                                        else if (pct >= 95) { label = 'Average'; labelColor = 'slate'; }
                                        else if (pct >= 85) { label = 'Below Avg'; labelColor = 'amber'; }
                                        else { label = 'Likely Shaded'; labelColor = 'orange'; }
                                        return (
                                            <>
                                                <div className="w-px h-6 bg-slate-200"></div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">vs {bench.benchmarkCity}</span>
                                                    <span className={`font-black text-${labelColor}-600`}>{pct}% <span className={`text-[9px] font-bold text-${labelColor}-500`}>{label}</span></span>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Natural Light Score + Smart Tags */}
                                {(() => {
                                    const light = computeNaturalLightScore(solar, data.city, data.state);
                                    const smartTags: string[] = computeSolarSmartTags(solar, (data as any).lotSize, data.city, data.state) || [];
                                    if (!light && smartTags.length === 0) return null;

                                    const barColor = light && light.score >= 80 ? 'bg-emerald-500' : light && light.score >= 60 ? 'bg-blue-500' : light && light.score >= 45 ? 'bg-slate-400' : light && light.score >= 30 ? 'bg-amber-500' : 'bg-orange-500';
                                    const textColor = light && light.score >= 80 ? 'text-emerald-700' : light && light.score >= 60 ? 'text-blue-700' : light && light.score >= 45 ? 'text-slate-600' : light && light.score >= 30 ? 'text-amber-700' : 'text-orange-700';

                                    // Choose pill color based on tag sentiment
                                    const pillColor = (tag: string) => {
                                        if (tag.includes('Sun-Drenched') || tag.includes('Great Natural') || tag.includes('Top Solar') || tag.includes('Garden') || tag.includes('Pool'))
                                            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                        if (tag.includes('High Solar') || tag.includes('Energy Efficient') || tag.includes('Solar Ready') || tag.includes('Good Natural') || tag.includes('Open Sky'))
                                            return 'bg-blue-50 text-blue-700 border-blue-200';
                                        if (tag.includes('Shaded') || tag.includes('Limited') || tag.includes('Dark'))
                                            return 'bg-orange-50 text-orange-700 border-orange-200';
                                        return 'bg-slate-50 text-slate-600 border-slate-200';
                                    };

                                    return (
                                        <>
                                            {light && (
                                                <div className="mt-2 flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Light</span>
                                                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${light.score}%` }}></div>
                                                    </div>
                                                    <span className={`text-[11px] font-black ${textColor} whitespace-nowrap`}>{light.score} <span className="text-[9px] font-bold">{light.label}</span></span>
                                                </div>
                                            )}
                                            {smartTags.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {smartTags.slice(0, 5).map((tag: string, i: number) => (
                                                        <span key={i} className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border ${pillColor(tag)}`}>
                                                            {tag}
                                                         </span>
                                                    ))}
                                                </div>
                                            )}
                                            {/* Methodology note */}
                                            <div className="mt-1.5 text-[8px] text-slate-400 leading-relaxed">
                                                <i className="fa-solid fa-circle-info mr-0.5"></i>
                                                Light score derived from Google Solar API's 3D roof model — accounts for roof pitch, nearby trees, buildings, and orientation vs {(() => { const b = computeSolarBenchmarks(solar, data.city, data.state); return b?.benchmarkCity || 'local'; })()} averages.
                                            </div>
                                        </>
                                    );
                                })()}


                                <>
                                    {/* Key financial metrics */}
                                    {solar.financialAnalysis && (
                                        <div className="mt-3 space-y-2">
                                            {/* After Solar estimate */}
                                            {solar.financialAnalysis.remainingLifetimeCostBill != null && (
                                                <div className="p-2 bg-emerald-50/60 rounded-lg border border-emerald-100/60">
                                                    <div className="text-[11px] font-black uppercase text-emerald-400 tracking-wider">After Solar</div>
                                                    <div className="text-[13px] font-black text-emerald-600 leading-snug">${Math.round(solar.financialAnalysis.remainingLifetimeCostBill / 240).toLocaleString()}<span className="text-[10px] font-normal text-emerald-400">/mo est.</span></div>
                                                </div>
                                            )}

                                            {/* Cash purchase metrics grid */}
                                            {solar.financialAnalysis.cashPurchase && (
                                                <div className="grid grid-cols-2 gap-2">
                                                    {solar.financialAnalysis.cashPurchase.paybackYears != null && (
                                                        <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                                            <i className="fa-solid fa-clock-rotate-left text-[10px] text-amber-400"></i>
                                                            <div className="min-w-0">
                                                                <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Payback</div>
                                                                <div className="text-[13px] font-black text-amber-600 leading-snug">{Number(solar.financialAnalysis.cashPurchase.paybackYears).toFixed(1)} years</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {solar.financialAnalysis.cashPurchase.savings?.savingsYear20 != null && (
                                                        <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                                            <i className="fa-solid fa-chart-line text-[10px] text-emerald-400"></i>
                                                            <div className="min-w-0">
                                                                <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">20-Yr Savings</div>
                                                                <div className="text-[13px] font-black text-emerald-600 leading-snug">${solar.financialAnalysis.cashPurchase.savings.savingsYear20.toLocaleString()}</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {solar.financialAnalysis.cashPurchase.upfrontCost != null && (
                                                        <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                                            <i className="fa-solid fa-receipt text-[10px] text-indigo-400"></i>
                                                            <div className="min-w-0">
                                                                <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">System Cost</div>
                                                                <div className="text-[13px] font-normal text-slate-800 leading-snug">${solar.financialAnalysis.cashPurchase.upfrontCost.toLocaleString()}</div>
                                                                {solar.financialAnalysis.cashPurchase.rebateValue != null && solar.financialAnalysis.cashPurchase.rebateValue > 0 && (
                                                                    <div className="text-[10px] text-emerald-500 font-semibold">incl. ${solar.financialAnalysis.cashPurchase.rebateValue.toLocaleString()} rebate</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {solar.financialAnalysis.cashPurchase.savings?.savingsYear1 != null && (
                                                        <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                                            <i className="fa-solid fa-calendar-check text-[10px] text-slate-300"></i>
                                                            <div className="min-w-0">
                                                                <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Year 1 Savings</div>
                                                                <div className="text-[13px] font-normal text-slate-800 leading-snug">${solar.financialAnalysis.cashPurchase.savings.savingsYear1.toLocaleString()}</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                        </div>
                                    )}

                                    {/* System Specs — collapsible, below financial */}
                                    <div className="mt-3 bg-white/50 rounded-lg border border-slate-100 overflow-hidden">
                                        <button
                                            onClick={() => setIsSolarSpecsExpanded(!isSolarSpecsExpanded)}
                                            className="w-full text-[11px] font-black text-slate-400 uppercase tracking-widest p-2 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <i className="fa-solid fa-microchip text-[9px]"></i>
                                                System Specs
                                            </div>
                                            <i className={`fa-solid fa-chevron-${isSolarSpecsExpanded ? 'up' : 'down'} text-[8px] transition-transform`}></i>
                                        </button>
                                        {isSolarSpecsExpanded && (
                                            <div className="px-2 pb-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                <div className="grid grid-cols-2 gap-2">
                                                    {solarPotential ? (
                                                        <>
                                                            <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                                                <i className="fa-solid fa-layer-group text-[10px] text-slate-300"></i>
                                                                <div className="min-w-0">
                                                                    <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Capacity</div>
                                                                    <div className="text-[13px] font-normal text-slate-800 leading-snug">{solarPotential.estimatedPanels} Panels</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                                                <i className="fa-solid fa-earth-americas text-[10px] text-emerald-400"></i>
                                                                <div className="min-w-0">
                                                                    <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">CO₂ Offset</div>
                                                                    <div className="text-[12px] font-black text-emerald-600 leading-none">{solarPotential.carbonOffsetTons} t/yr</div>
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100 col-span-2">
                                                            <i className="fa-solid fa-leaf text-[10px] text-slate-300"></i>
                                                            <div className="min-w-0">
                                                                <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Offset Constant</div>
                                                                <div className="text-[13px] font-normal text-slate-800 leading-snug">{Math.round(solar.carbonOffsetFactorKgPerMwh || 0)} kg/MWh</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {solar.wholeRoofStats && (
                                                        <>
                                                            <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                                                <i className="fa-solid fa-up-right-and-down-left-from-center text-[8px] text-slate-300"></i>
                                                                <div className="min-w-0">
                                                                    <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Surface</div>
                                                                    <div className="text-[13px] font-normal text-slate-800 leading-snug">{Math.round(solar.wholeRoofStats.areaMeters2 || 0)} m²</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                                                <i className="fa-solid fa-vector-square text-[8px] text-slate-300"></i>
                                                                <div className="min-w-0">
                                                                    <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Footprint</div>
                                                                    <div className="text-[13px] font-normal text-slate-800 leading-snug">{Math.round(solar.wholeRoofStats.groundAreaMeters2 || 0)} m²</div>
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>


                                <div className="text-[8px] text-slate-700 mt-2 text-right">Google Solar API</div>
                            </div>
                        </div>
                    )}

                    
                </div>

                {/* EV Charging */}
                <div className="flex flex-col gap-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                
                    {(() => {
                        const ev = (data as any).evChargers;
                        const evData = liveEv || ev;

                        return (
                            <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                <div className="p-4">
                                    {/* Header */}
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                                                <i className="fa-solid fa-charging-station text-emerald-600 text-[12px]"></i>
                                            </div>
                                            <span className="text-[16px] font-black text-slate-700 tracking-tight">EV Charging</span>
                                        </div>
                                        <button
                                            onClick={handleRefreshEV}
                                            disabled={evLoading}
                                            className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${evLoading ? 'text-emerald-400 animate-spin' : 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50'}`}
                                            title="Fetch EV chargers from NREL"
                                        >
                                            <i className="fa-solid fa-arrows-rotate text-[9px]"></i>
                                        </button>
                                    </div>

                                    {!evData ? (
                                        <div className="flex flex-col items-center py-4 gap-2">
                                            <i className="fa-solid fa-plug-circle-xmark text-slate-300 text-lg"></i>
                                            <span className="text-[11px] font-bold text-slate-400">No data yet</span>
                                            <button
                                                onClick={handleRefreshEV}
                                                disabled={evLoading}
                                                className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                                            >
                                                {evLoading ? 'Fetching...' : 'Fetch from NREL'}
                                            </button>
                                        </div>
                                    ) : evData.totalStations === 0 ? (
                                        <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
                                            <i className="fa-solid fa-circle-exclamation text-amber-500 text-[10px]"></i>
                                            <span className="text-[12px] font-bold text-amber-700">No public chargers within 5 mi</span>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Top stat row */}
                                            <div className="flex items-center gap-3 text-[12px] mb-3">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Stations</span>
                                                    <span className="font-black text-slate-700">{evData.totalStations}</span>
                                                </div>
                                                <div className="w-px h-6 bg-slate-200"></div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Closest</span>
                                                    <span className="font-black text-emerald-600">{evData.closestDistanceMi} mi</span>
                                                </div>
                                                <div className="w-px h-6 bg-slate-200"></div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Total Ports</span>
                                                    <span className="font-black text-slate-700">{evData.totalPorts}</span>
                                                </div>
                                            </div>

                                            {/* Port breakdown */}
                                            <div className="grid grid-cols-2 gap-2 mb-2">
                                                {evData.dcFastPorts > 0 && (
                                                    <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                                        <i className="fa-solid fa-bolt text-[10px] text-amber-400"></i>
                                                        <div className="min-w-0">
                                                            <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">DC Fast</div>
                                                            <div className="text-[13px] font-black text-amber-600 leading-snug">{evData.dcFastPorts} ports</div>
                                                        </div>
                                                    </div>
                                                )}
                                                {evData.level2Ports > 0 && (
                                                    <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                                        <i className="fa-solid fa-plug text-[10px] text-blue-400"></i>
                                                        <div className="min-w-0">
                                                            <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Level 2</div>
                                                            <div className="text-[13px] font-black text-blue-600 leading-snug">{evData.level2Ports} ports</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Networks */}
                                            {evData.networks?.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {evData.networks.slice(0, 5).map((n: string, i: number) => (
                                                        <span key={i} className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-wider border border-emerald-100">
                                                            {n}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Closest station name */}
                                            {evData.closestStationName && (
                                                <div className="mt-2 text-[11px] text-slate-500 font-medium truncate">
                                                    <i className="fa-solid fa-location-dot text-emerald-400 mr-1 text-[9px]"></i>
                                                    {evData.closestStationName}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                                <div className="text-[8px] text-slate-700 text-right px-4 pb-1.5">NREL Alt-Fuel API</div>
                            </div>
                        );
                    })()}
            </div>
            </div>
        </div>
    );
};

export default DailyLivingSection;
