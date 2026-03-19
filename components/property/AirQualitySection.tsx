
import React from 'react';
import { PropertyData } from '../../types';

import { calculateSolarPotential } from '../../utils/solarCalculations';
import HistoricalDisasterSection from './HistoricalDisasterSection';
import CommuteCalculator from './CommuteCalculator';
import SeasonalSunCard from './SeasonalSunCard';

interface Props {
    data: PropertyData;
    neighborhoodOverview?: string;
    disasterData?: any;
    onRefresh?: () => void;
    refreshing?: boolean;
}

const AirQualitySection: React.FC<Props> = ({ data, neighborhoodOverview, disasterData, onRefresh, refreshing }) => {

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
    const aq = data.airQuality;
    const solar = data.solarData;
    const solarPotential = solar?.estimatedSolarProduction || (solar ? calculateSolarPotential(solar) : null);
    const hasNoise = data.noiseScore != null;
    const hasClimate = !!(data.windRiskScore || data.floodRiskScore || data.fireRiskScore || data.heatRiskScore);
    const hasPollen = !!(data.pollen?.score != null || data.pollen?.category);

    if (!aq && !solar && !hasNoise && !hasClimate && !hasPollen && !data.broadband) return null;

    const getAQIColor = (aqi: number) => {
        if (aqi <= 50) return 'text-emerald-500';
        if (aqi <= 100) return 'text-amber-500';
        if (aqi <= 150) return 'text-orange-500';
        return 'text-rose-500';
    };


    const MetricItem: React.FC<{
        icon: string;
        label: string;
        value: string;
        colorClass?: string;
        helpText?: string;
        helpLink?: string;
        isCritical?: boolean;
    }> = ({ icon, label, value, colorClass, helpText, helpLink, isCritical }) => (
        <div className={`flex items-start gap-3 group relative rounded-lg transition-colors ${isCritical ? 'bg-red-50/50 p-1.5 -m-1.5' : ''}`}>
            <div className="w-4 flex justify-center flex-shrink-0 mt-0.5">
                <i className={`fa-solid ${icon} ${isCritical ? 'text-red-500' : (colorClass || 'text-slate-300')} text-[12px] group-hover:text-indigo-500 transition-colors`}></i>
            </div>
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className={`text-[11px] font-black uppercase tracking-widest leading-none ${isCritical ? 'text-red-400' : 'text-gray-400'}`}>{label}</span>
                    {helpLink && (
                        <div className="group/tooltip relative inline-block">
                            <i className="fa-solid fa-circle-info text-[9px] text-slate-300 hover:text-indigo-500 cursor-help transition-colors"></i>
                            <div className="invisible group-hover/tooltip:visible absolute left-0 bottom-full mb-2 w-48 p-3 bg-slate-900 text-white text-[10px] rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-bottom-1 duration-200">
                                <div className="font-bold mb-1 opacity-70 uppercase tracking-tighter">Information</div>
                                <div className="font-medium leading-normal mb-2 whitespace-normal">{helpText}</div>
                                <a
                                    href={helpLink}
                                    className="block text-indigo-400 font-bold hover:text-white transition-colors flex items-center gap-1 mt-1 border-t border-white/10 pt-1"
                                >
                                    Read Full Guide <i className="fa-solid fa-arrow-right text-[8px]"></i>
                                </a>
                                <div className="absolute -bottom-1 left-2 w-2 h-2 bg-slate-900 rotate-45"></div>
                            </div>
                        </div>
                    )}
                </div>
                <span className={`text-[14px] ${isCritical ? 'font-black text-red-600' : 'font-normal ' + (colorClass || 'text-slate-800')} leading-[1.625]`}>{value}</span>
            </div>
        </div>
    );

    const getNoiseColor = (s: number) => s >= 80 ? '#22c55e' : s >= 65 ? '#eab308' : '#f97316';
    const getNoiseBadge = (s: number) => s >= 80 ? 'bg-green-50 text-green-700' : s >= 65 ? 'bg-yellow-50 text-yellow-700' : 'bg-orange-50 text-orange-700';
    const noisePct = (s: number) => Math.max(0, Math.min(100, ((s - 0) / 100) * 100));

    const [isMolecularExpanded, setIsMolecularExpanded] = React.useState(false);
    const [isPollenExpanded, setIsPollenExpanded] = React.useState(false);
    const [isSolarExpanded, setIsSolarExpanded] = React.useState(false);
    const [isSolarSpecsExpanded, setIsSolarSpecsExpanded] = React.useState(false);

    return (
        <div className="bg-white border-x border-slate-100 px-6 pt-0 pb-6">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">

                {/* MODULE: MOBILITY + NOISE (stacked) */}
                <div className="flex flex-col gap-3 bg-white rounded-xl border border-slate-100/80 p-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
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

                    {/* Connectivity */}
                    {data.broadband && (
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
                    )}

                    {/* Commute Calculator */}
                    {data.coordinates && (
                        <CommuteCalculator originLat={data.coordinates.latitude} originLng={data.coordinates.longitude} propertyAddress={data.address} />
                    )}

                </div>

                {/* MODULE: SOLAR + EV (stacked) */}
                <div className="flex flex-col gap-3 bg-white rounded-xl border border-slate-100/80 p-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">

                    {/* Solar */}
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
                                {/* Sunshine + Production row */}
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
                                </div>


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

                                            {/* Lifetime cost without solar */}
                                            {solar.financialAnalysis.costOfElectricityWithoutSolar != null && (
                                                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                                                    <i className="fa-solid fa-bolt text-[10px] text-slate-400"></i>
                                                    <div className="min-w-0">
                                                        <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Lifetime Cost (No Solar)</div>
                                                        <div className="text-[13px] font-normal text-slate-700 leading-snug">${solar.financialAnalysis.costOfElectricityWithoutSolar.toLocaleString()}</div>
                                                    </div>
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

                    {/* Seasonal Sun */}
                    {data.coordinates && (
                        <SeasonalSunCard
                            lat={data.coordinates.latitude}
                            lng={data.coordinates.longitude}
                            orientation={(data as any).orientation_ai?.final_orientation}
                        />
                    )}

                    {/* EV Charging */}
                    {(() => {
                        const ev = (data as any).evChargers;
                        const [evLoading, setEvLoading] = React.useState(false);
                        const [liveEv, setLiveEv] = React.useState<any>(null);
                        const evData = liveEv || ev;

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
                                        const { saveGoogleDataToCloud } = await import('../../services/firebaseService');
                                        await saveGoogleDataToCloud(key, { evChargers: fresh });
                                    }
                                }
                            } catch (e) {
                                console.error('[EV Refresh] Failed', e);
                            }
                            setEvLoading(false);
                        };

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

                {/* MODULE: AIR QUALITY */}
                <div className="flex flex-col gap-3 bg-white rounded-xl border border-slate-100/80 p-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    {aq && (
                        <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden flex flex-col shadow-sm">
                            <div className="p-3">
                                {/* Header */}
                                <div className="flex items-center justify-between gap-3 mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                                            <i className="fa-solid fa-wind text-emerald-600 text-[12px]"></i>
                                        </div>
                                        <span className="text-[16px] font-black text-slate-700 tracking-tight">Air Quality</span>
                                        <RefreshBtn />
                                    </div>
                                    <div className="flex items-center gap-3 text-[12px]">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">UAQI</span>
                                            <span className={`font-black ${getAQIColor(aq.aqi)}`}>{aq.aqi}</span>
                                        </div>
                                        <div className="w-px h-6 bg-slate-200"></div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Level</span>
                                            <span className={`font-black ${getAQIColor(aq.aqi)}`}>{aq.category}</span>
                                        </div>
                                        {aq.dominantPollutant && (
                                            <>
                                                <div className="w-px h-6 bg-slate-200"></div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Pollutant</span>
                                                    <span className="font-black text-slate-700">{aq.dominantPollutant.toUpperCase()}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Safety status */}
                                <div className={`flex items-center gap-2 p-1.5 rounded-lg border ${aq.aqi > 100 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                    <i className={`fa-solid fa-person-shelter text-[10px] ${aq.aqi > 100 ? 'text-amber-500' : 'text-emerald-500'}`}></i>
                                    <span className={`text-[13px] font-black ${aq.aqi > 100 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                        {aq.aqi > 100 ? 'Caution Advised' : 'Safe — No Limitations'}
                                    </span>
                                </div>
                            </div>

                            {/* General recommendation */}
                            {aq.recommendations?.general && (
                                <div className="mx-3 mb-2 flex gap-2">
                                    <div className="w-1 h-1 rounded-full bg-indigo-400/30 mt-1.5 flex-shrink-0" />
                                    <p className="text-[13px] text-slate-600 leading-snug italic">
                                        "{aq.recommendations.general}"
                                    </p>
                                </div>
                            )}

                            {/* Molecular Sub-section */}
                            {aq.pollutants && (
                                <div className="mx-3 mb-2 bg-white/50 rounded-lg border border-slate-100 overflow-hidden">
                                    <button
                                        onClick={() => setIsMolecularExpanded(!isMolecularExpanded)}
                                        className="w-full text-[11px] font-black text-slate-400 uppercase tracking-widest p-2 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <i className="fa-solid fa-flask-vial text-[9px]"></i>
                                            Molecular Breakdown
                                        </div>
                                        <i className={`fa-solid fa-chevron-${isMolecularExpanded ? 'up' : 'down'} text-[8px] transition-transform`}></i>
                                    </button>
                                    {isMolecularExpanded && (
                                        <div className="px-2 pb-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <div className="grid grid-cols-2 gap-2">
                                                {aq.pollutants.slice(0, 4).map((p, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                                        <i className={`fa-solid ${p.name.includes('CO') ? 'fa-cloud' : p.name.includes('PM') ? 'fa-smog' : 'fa-atom'} text-[10px] text-slate-300`}></i>
                                                        <div className="min-w-0">
                                                            <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{p.name}</div>
                                                            <div className="text-[13px] font-bold text-slate-700 leading-none">{p.concentration.toFixed(1)} {p.unit === 'PARTS_PER_BILLION' ? 'ppb' : 'µg/m³'}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Health Insights footer */}
                            {aq.recommendations && (
                                <div className="p-2.5 bg-indigo-50/30 border-t border-indigo-100/30 space-y-1.5">


                                    {aq.recommendations.sensitiveGroups && (
                                        <div className="flex gap-2">
                                            <div className="w-1 h-1 rounded-full bg-rose-400/30 mt-1.5 flex-shrink-0" />
                                            <p className="text-[13px] text-slate-600 leading-snug italic">
                                                <span className="font-bold text-rose-400 not-italic uppercase text-[9px] tracking-tighter mr-1">Sensitive:</span>
                                                "{aq.recommendations.sensitiveGroups}"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="px-3 pb-1.5 text-[8px] text-slate-700 text-right">Google Air Quality API</div>
                        </div>
                    )}

                    {/* POLLEN — below Air Quality in same column */}
                    {hasPollen && data.pollen && (
                        <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                            <div className="p-3">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                            <i className="fa-solid fa-seedling text-indigo-600 text-[11px]"></i>
                                        </div>
                                        <span className="text-[16px] font-black text-slate-700 tracking-tight">Pollen</span>
                                    </div>
                                </div>

                                {data.pollen.description && (
                                    <p className="text-[12px] text-slate-400 font-medium leading-snug mb-2">{data.pollen.description}</p>
                                )}
                                {data.pollen.analysis?.breathe_easy_summary && (
                                    <p className="text-[13px] text-slate-500 font-medium leading-snug italic p-2 bg-white rounded-lg border border-slate-100">
                                        "{data.pollen.analysis.breathe_easy_summary}"
                                    </p>
                                )}
                                <div className="mt-2 bg-white/50 rounded-lg border border-slate-100 overflow-hidden">
                                    <div className="px-2 py-2 space-y-2">
                                        <div className="flex gap-1.5">
                                            <div className="flex-1 p-2 bg-white rounded-lg border border-slate-100">
                                                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                                    <i className="fa-solid fa-bullseye text-amber-500 text-[6px]"></i>
                                                    Triggers
                                                </div>
                                                <div className="flex flex-wrap gap-0.5">
                                                    {data.pollen.analysis?.primary_triggers?.map((t, i) => (
                                                        <span key={i} className="text-[12px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-100">{t}</span>
                                                    )) || <span className="text-[9px] text-slate-400 italic">None</span>}
                                                </div>
                                            </div>
                                            {(data.pollen as any).pollenTypeInfo?.map((type: any, i: number) => {
                                                const score = type.indexInfo?.value || 0;
                                                const textColor = score >= 4 ? 'text-rose-600' : score >= 2 ? 'text-amber-600' : 'text-emerald-600';
                                                const icon = type.pollenType === 'GRASS' ? 'fa-leaf' : type.pollenType === 'TREE' ? 'fa-tree' : 'fa-plant-wilt';
                                                return (
                                                    <div key={i} className="flex-1 flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-slate-100">
                                                        <i className={`fa-solid ${icon} ${textColor} text-[10px]`}></i>
                                                        <div className="min-w-0">
                                                            <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">{type.displayName}</div>
                                                            <div className={`text-[13px] font-black ${textColor} leading-none`}>{type.indexInfo?.category || 'None'}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="text-[8px] text-slate-700 mt-1 text-right px-3 pb-1.5">Google Pollen API</div>
                        </div>
                    )}
                </div>

                {/* MODULE: CLIMATE RISK + HAZARD ZONES (in 4th column) */}
                <div className="flex flex-col gap-3 bg-white rounded-xl border border-slate-100/80 p-3 overflow-visible hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    {/* Climate Risk */}
                    {hasClimate && (
                        <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                            <div className="p-4">
                                {/* Header */}
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                                            <i className="fa-solid fa-shield-halved text-amber-600 text-[13px]"></i>
                                        </div>
                                        <span className="text-[16px] font-black text-slate-700 tracking-tight">Climate Risk</span>
                                        <RefreshBtn />
                                    </div>
                                    <div className="flex items-center gap-3 text-[13px]">
                                        {data.annualHomeownersInsurance && (
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Insurance</span>
                                                <span className="font-black text-slate-700">${data.annualHomeownersInsurance.toLocaleString()}/yr</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* Risk grid */}
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { icon: 'fa-wind', label: 'Wind', score: data.windRiskScore },
                                        { icon: 'fa-droplet', label: 'Flood', score: data.floodRiskScore },
                                        { icon: 'fa-fire', label: 'Fire', score: data.fireRiskScore },
                                        { icon: 'fa-temperature-high', label: 'Heat', score: data.heatRiskScore },
                                    ].map(({ icon, label, score }) => {
                                        const isCritical = !!(score && score > 5);
                                        return (
                                            <div key={label} className={`flex items-center gap-2 p-2 rounded-lg border ${isCritical ? 'bg-red-50/50 border-red-100' : 'bg-white border-slate-100'}`}>
                                                <i className={`fa-solid ${icon} text-[10px] ${isCritical ? 'text-red-500' : 'text-slate-300'}`}></i>
                                                <div className="min-w-0">
                                                    <div className={`text-[11px] font-black uppercase tracking-wider ${isCritical ? 'text-red-400' : 'text-slate-400'}`}>{label}</div>
                                                    <div className={`text-[13px] font-black leading-none ${isCritical ? 'text-red-600' : 'text-slate-700'}`}>
                                                        {score ? `${score}/10` : 'N/A'}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="text-[8px] text-slate-700 mt-2 text-right">ClimateCheck</div>
                            </div>
                        </div>
                    )}
                    {disasterData && (
                        <>
                            <HistoricalDisasterSection data={disasterData} drought={data.drought} compact onRefresh={onRefresh} refreshing={refreshing} />
                            <div className="text-[8px] text-slate-700 mt-1 text-right">USGS · FEMA · US Drought Monitor</div>
                        </>
                    )}

                    {/* Noise */}
                    {hasNoise && (
                        <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                            <div className="p-4">
                                {/* Header */}
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                                            <i className="fa-solid fa-volume-xmark text-purple-600 text-[13px]"></i>
                                        </div>
                                        <span className="text-[16px] font-black text-slate-700 tracking-tight">Noise</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[13px]">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Score</span>
                                            <span className={`font-black ${data.noiseScore! >= 80 ? 'text-emerald-500' : data.noiseScore! >= 65 ? 'text-amber-500' : 'text-orange-500'}`}>
                                                {data.noiseScore}/100
                                            </span>
                                        </div>
                                        <div className="w-px h-6 bg-slate-200"></div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Level</span>
                                            <span className="font-black text-slate-700">{data.noiseScoreDesc ?? 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                                {/* Bars */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all" style={{ width: `${noisePct(data.noiseScore!)}%`, background: getNoiseColor(data.noiseScore!) }} />
                                        </div>
                                    </div>
                                    {[
                                        { label: 'Traffic', score: data.noiseTrafficScore, desc: data.noiseTrafficDesc },
                                        { label: 'Local', score: data.noiseLocalScore, desc: data.noiseLocalDesc },
                                        { label: 'Airport', score: data.noiseAirportScore, desc: data.noiseAirportDesc },
                                    ].filter(s => s.score != null).map(({ label, score, desc }) => (
                                        <div key={label} className="flex items-center gap-1.5">
                                            <span className="text-[11px] text-slate-400 uppercase tracking-widest w-12 flex-shrink-0">{label}</span>
                                            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all" style={{ width: `${noisePct(score!)}%`, background: getNoiseColor(score!) }} />
                                            </div>
                                            <span className="text-[12px] text-slate-500 w-10 text-right flex-shrink-0">{desc ?? score}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-[8px] text-slate-700 mt-2 text-right">HowLoud</div>
                            </div>
                        </div>
                    )}
                </div>


            </div>
        </div >
    );
};

export default AirQualitySection;
