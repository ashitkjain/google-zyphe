import HistoricalDisasterSection from './HistoricalDisasterSection';
import React from 'react';
import SeasonalSunCard from './SeasonalSunCard';
import { PropertyData } from '../../types';


interface Props {
    data: PropertyData;
    disasterData?: any;
    onRefresh?: () => void;
    refreshing?: boolean;
    micro?: { insight: string; fetchedAt: number } | null;
}

const EnvironmentResilienceSection: React.FC<Props> = ({ data, disasterData, onRefresh, refreshing, micro }) => {

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

    const [isMolecularExpanded, setIsMolecularExpanded] = React.useState(false);
    const [isPollenExpanded, setIsPollenExpanded] = React.useState(false);
    const [isTriggersExpanded, setIsTriggersExpanded] = React.useState(false);
    
    const aq = data.airQuality;
    const hasNoise = data.noiseScore != null;
    const getNoiseColor = (s: number) => s >= 80 ? '#22c55e' : s >= 65 ? '#eab308' : '#f97316';
    const noisePct = (s: number) => Math.max(0, Math.min(100, ((s - 0) / 100) * 100));

    const hasClimate = !!(data.windRiskScore || data.floodRiskScore || data.fireRiskScore || data.heatRiskScore);
    const hasPollen = !!(data.pollen?.score != null || data.pollen?.category);

    if (!aq && !hasClimate && !hasPollen && !disasterData) return null;

    const getAQIColor = (aqi: number) => {
        if (aqi <= 50) return 'text-emerald-500';
        if (aqi <= 100) return 'text-amber-500';
        if (aqi <= 150) return 'text-orange-500';
        return 'text-rose-500';
    };



    



    if (!hasNoise && !aq && !hasClimate && !hasPollen && !disasterData && !data.coordinates) return null;

    return (
        <div className="bg-white px-6 pt-6 pb-6 rounded-2xl border-2 border-slate-100 overflow-visible mb-6">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <i className="fa-solid fa-leaf text-emerald-600 text-[11px]"></i>
                </div>
                <span className="text-lg font-black text-slate-900 tracking-tight">Environment & Resilience</span>
            </div>
            
            {/* Row 1: AQ, Pollen, Climate, Sun */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">

                {/* Noise & Air Quality Stack */}
                <div className="flex flex-col gap-3 lg:col-span-1 h-full">
                {/* Noise */}
                <div className="flex flex-col gap-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                
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

                <div className="flex flex-col gap-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
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

                    
                </div>
                <div className="flex flex-col gap-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    {/* POLLEN */}
                    
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
                                    {(data.pollen as any).pollenTypeInfo?.length > 0 && (
                                        <div className="flex gap-1.5 px-2 pt-2">
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
                                    )}
                                    {/* Triggers — collapsible, collapsed by default */}
                                    {data.pollen.analysis?.primary_triggers && data.pollen.analysis.primary_triggers.length > 0 && (
                                        <div className="mt-2 border-t border-slate-100 overflow-hidden">
                                            <button
                                                onClick={() => setIsTriggersExpanded(!isTriggersExpanded)}
                                                className="w-full text-[11px] font-black text-slate-400 uppercase tracking-widest px-2 py-1.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <i className="fa-solid fa-bullseye text-amber-500 text-[8px]"></i>
                                                    Triggers
                                                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 text-[9px] font-black">
                                                        {data.pollen.analysis.primary_triggers.length}
                                                    </span>
                                                </div>
                                                <i className={`fa-solid fa-chevron-${isTriggersExpanded ? 'up' : 'down'} text-[8px] transition-transform duration-200`}></i>
                                            </button>
                                            {isTriggersExpanded && (
                                                <div className="px-2 pb-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <div className="flex flex-wrap gap-0.5">
                                                        {data.pollen.analysis.primary_triggers.map((t, i) => (
                                                            <span key={i} className="text-[12px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-100">{t}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                            </div>
                            <div className="text-[8px] text-slate-700 mt-1 text-right px-3 pb-1.5">Google Pollen API</div>
                        </div>
                    )}
                </div>

                </div>

                
                
{/* CLIMATE RISK & DISASTERS */}
                <div className="flex flex-col gap-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 col-span-1 lg:col-span-2">
                    
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

                    
                
            </div>
            </div>
            
                {/* Seasonal Sun */}
                <div className="flex flex-col gap-3">
                    {data.coordinates && (
                        <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
                            <div className="p-3">
                                <SeasonalSunCard
                                    lat={data.coordinates.latitude}
                                    lng={data.coordinates.longitude}
                                    orientation={(data as any).orientation_ai?.final_orientation}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Microclimate Thermal Fingerprint */}
                <div className="flex flex-col gap-3">
                    {micro && (
                        <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
                            <div className="p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                                        <i className="fa-solid fa-temperature-half text-blue-600 text-[12px]"></i>
                                    </div>
                                    <span className="text-[16px] font-black text-slate-700 tracking-tight">Microclimate</span>
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed italic">
                                    &ldquo;{micro.insight}&rdquo;
                                </p>
                                <div className="text-[8px] text-slate-400 mt-0.5 text-right">Tomorrow.io · {new Date(micro.fetchedAt).toLocaleTimeString()}</div>
                            </div>
                        </div>
                    )}
                </div>
            
            </div>
        </div>
    );
};

export default EnvironmentResilienceSection;
