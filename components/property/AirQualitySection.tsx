
import React from 'react';
import { PropertyData } from '../../types';

import { calculateSolarPotential } from '../../utils/solarCalculations';

interface Props {
    data: PropertyData;
    neighborhoodOverview?: string;
}

const AirQualitySection: React.FC<Props> = ({ data, neighborhoodOverview }) => {
    const aq = data.airQuality;
    const solar = data.solarData;
    const solarPotential = solar?.estimatedSolarProduction || (solar ? calculateSolarPotential(solar) : null);
    const hasNoise = data.noiseScore != null;
    const hasClimate = !!(data.windRiskScore || data.floodRiskScore || data.fireRiskScore || data.heatRiskScore);
    const hasPollen = !!(data.pollen?.score != null || data.pollen?.category);

    if (!aq && !solar && !hasNoise && !hasClimate && !hasPollen) return null;

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

    return (
        <div className="bg-white border-x border-slate-100 px-6 pt-0 pb-6">
            <div className={`grid grid-cols-1 gap-3 ${data.hoa ? 'lg:[grid-template-columns:0.5fr_0.5fr_0.28fr_0.45fr_0.45fr_0.6fr]' : 'lg:[grid-template-columns:0.5fr_0.28fr_0.45fr_0.45fr_0.6fr]'}`}>

                {/* MODULE: SCHOOLS */}
                <div className="flex flex-col gap-3">
                    <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                        <div className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <i className="fa-solid fa-graduation-cap text-blue-600 text-[11px]"></i>
                                </div>
                                <span className="text-[16px] font-black text-slate-700 tracking-tight">Schools</span>
                            </div>
                            <div className="space-y-2">
                                {data.schools?.slice(0, 3).map((s, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                        <i className="fa-solid fa-school-flag text-[10px] text-slate-300"></i>
                                        <div className="min-w-0">
                                            <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider truncate">{s.name}</div>
                                            <div className="text-[13px] font-normal text-slate-800 leading-snug">{s.rating}/10 · {s.distance} mi</div>
                                        </div>
                                    </div>
                                ))}
                                {(!data.schools || data.schools.length === 0) && (
                                    <p className="text-[11px] text-slate-400 font-normal">No school data available.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* MODULE: HOA */}
                {data.hoa && (
                    <div className="flex flex-col gap-3">
                        <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                            <div className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                                        <i className="fa-solid fa-building-columns text-indigo-600 text-[11px]"></i>
                                    </div>
                                    <span className="text-[16px] font-black text-slate-700 tracking-tight">HOA</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                        <i className="fa-solid fa-building text-[10px] text-slate-300"></i>
                                        <div className="min-w-0">
                                            <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Association</div>
                                            <div className="text-[13px] font-normal text-slate-800 leading-snug">{data.hoa.name ?? 'N/A'}</div>
                                        </div>
                                    </div>
                                    {data.hoa.fee && (
                                        <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                            <i className="fa-solid fa-dollar-sign text-[10px] text-indigo-400"></i>
                                            <div className="min-w-0">
                                                <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Fee</div>
                                                <div className="text-[13px] font-black text-indigo-600 leading-none">{data.hoa.fee}</div>
                                            </div>
                                        </div>
                                    )}
                                    {data.hoa.phone && (
                                        <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                            <i className="fa-solid fa-phone text-[10px] text-slate-300"></i>
                                            <div className="min-w-0">
                                                <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Phone</div>
                                                <div className="text-[13px] font-normal text-slate-800 leading-snug">{data.hoa.phone}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {data.hoa.amenities && data.hoa.amenities.filter(a => a !== 'Other').length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-100">
                                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Amenities</div>
                                        <div className="flex flex-wrap gap-1">
                                            {data.hoa.amenities.filter(a => a !== 'Other').map((amenity, i) => (
                                                <span key={i} className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                    {amenity}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}


                {/* MODULE: ORIENTATION */}
                <div className="flex flex-col gap-3">
                    {/* Orientation */}
                    {(data as any).orientation_ai && (data as any).orientation_ai.final_orientation !== 'UNCLEAR_IMAGE' && (() => {
                        const sat = (data as any).orientation_ai;
                        const confidenceColor = sat.confidence === 'high' ? 'text-emerald-600 bg-emerald-50' : sat.confidence === 'medium' ? 'text-amber-600 bg-amber-50' : 'text-slate-500 bg-slate-100';
                        return (
                            <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                <div className="p-4">
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                                                <i className="fa-solid fa-compass text-amber-600 text-[11px]"></i>
                                            </div>
                                            <span className="text-[16px] font-black text-slate-700 tracking-tight">Front Orientation</span>
                                        </div>
                                        {sat.confidence && (
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${confidenceColor}`}>{sat.confidence}</span>
                                        )}
                                    </div>
                                    {sat.orientation_highlights && (
                                        <p className="text-[12px] text-slate-600 leading-relaxed mb-2">
                                            The front of the home likely faces <strong>{sat.final_orientation}</strong>. {sat.orientation_highlights}
                                        </p>
                                    )}
                                    <div className="space-y-2">
                                        {/* Lot Coverage */}
                                        {sat.lot_coverage_hardscape != null && (
                                            <div className="p-2 bg-white rounded-lg border border-slate-100">
                                                <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1">Lot Coverage</div>
                                                <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                                    <div className="h-full bg-slate-400 rounded-full" style={{ width: `${sat.lot_coverage_hardscape}%` }} />
                                                </div>
                                                <div className="flex justify-between text-[10px] font-bold text-slate-500 mt-0.5">
                                                    <span>{sat.lot_coverage_hardscape}% hard</span>
                                                    <span className="text-emerald-600">{sat.lot_coverage_pervious ?? (100 - sat.lot_coverage_hardscape)}% green</span>
                                                </div>
                                            </div>
                                        )}
                                        {/* Pro / Con */}
                                        {sat.buyer_pro && (
                                            <div className="flex items-start gap-1.5 p-2 bg-emerald-50/50 rounded-lg border border-emerald-100">
                                                <i className="fa-solid fa-plus text-[8px] text-emerald-500 mt-0.5"></i>
                                                <div className="text-[11px] text-emerald-700 font-medium leading-snug">{sat.buyer_pro}</div>
                                            </div>
                                        )}
                                        {sat.buyer_con && (
                                            <div className="flex items-start gap-1.5 p-2 bg-rose-50/50 rounded-lg border border-rose-100">
                                                <i className="fa-solid fa-minus text-[8px] text-rose-500 mt-0.5"></i>
                                                <div className="text-[11px] text-rose-700 font-medium leading-snug">{sat.buyer_con}</div>
                                            </div>
                                        )}
                                        {/* Feng Shui */}
                                        {sat.feng_shui_vastu && (
                                            <div className="flex items-start gap-1.5 p-2 bg-purple-50/50 rounded-lg border border-purple-100">
                                                <i className="fa-solid fa-yin-yang text-[8px] text-purple-500 mt-0.5"></i>
                                                <div className="text-[11px] text-purple-700 font-medium leading-snug">{sat.feng_shui_vastu}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* MODULE: MOBILITY + NOISE (stacked) */}
                <div className="flex flex-col gap-3">
                    <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                        <div className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center">
                                    <i className="fa-solid fa-route text-teal-600 text-[11px]"></i>
                                </div>
                                <span className="text-[16px] font-black text-slate-700 tracking-tight">Mobility</span>
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
                        </div>
                    </div>

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
                            </div>
                        </div>
                    )}
                </div>

                {/* MODULE: CLIMATE RISK + SOLAR (stacked) */}
                <div className="flex flex-col gap-3">
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
                            </div>
                        </div>
                    )}

                    {/* Solar */}
                    {solar && (

                        <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden flex flex-col shadow-sm">
                            <div className="p-4">
                                {/* Header */}
                                <div className="flex items-center justify-between gap-3 mb-1 cursor-pointer" onClick={() => setIsSolarExpanded(!isSolarExpanded)}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-yellow-100 flex items-center justify-center">
                                            <i className="fa-solid fa-solar-panel text-yellow-600 text-[12px]"></i>
                                        </div>
                                        <span className="text-[16px] font-black text-slate-700 tracking-tight">Solar</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-3 text-[12px]">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Sunshine</span>
                                                <span className="font-black text-slate-700">{Math.round(solar.maxSunshineHoursPerYear || 0).toLocaleString()} hrs/yr</span>
                                            </div>
                                            {solarPotential && (
                                                <>
                                                    <div className="w-px h-6 bg-slate-200"></div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Production</span>
                                                        <span className="font-black text-indigo-600">{solarPotential.annualKwh.toLocaleString()} kWh</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform duration-300 ${isSolarExpanded ? 'rotate-180' : ''}`}></i>
                                    </div>
                                </div>

                                {/* Expand/collapse hint */}
                                {!isSolarExpanded && (
                                    <div className="mt-2 flex items-center justify-center gap-1.5 py-1.5 bg-slate-100/80 rounded-lg cursor-pointer hover:bg-slate-200/80 transition-colors" onClick={() => setIsSolarExpanded(true)}>
                                        <i className="fa-solid fa-chevron-down text-[8px] text-slate-400"></i>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Show Details</span>
                                    </div>
                                )}

                                {/* Metrics grid - collapsible */}
                                {isSolarExpanded && (
                                    <div className="grid grid-cols-2 gap-2 mt-3">
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
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* MODULE: AIR QUALITY + POLLEN (stacked) */}
                <div className="flex flex-col gap-3">
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
                                    <div className="text-[11px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <i className="fa-solid fa-user-doctor text-[9px]"></i>
                                        Health Insights
                                    </div>
                                    {aq.recommendations.general && (
                                        <div className="flex gap-2">
                                            <div className="w-1 h-1 rounded-full bg-indigo-400/30 mt-1.5 flex-shrink-0" />
                                            <p className="text-[13px] text-slate-600 leading-snug italic">
                                                <span className="font-bold text-slate-400 not-italic uppercase text-[9px] tracking-tighter mr-1">General:</span>
                                                "{aq.recommendations.general}"
                                            </p>
                                        </div>
                                    )}
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
                        </div>
                    )}

                    {/* POLLEN */}
                    {hasPollen && data.pollen && (
                        <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                            <div className="p-3">
                                {/* Header */}
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                            <i className="fa-solid fa-seedling text-indigo-600 text-[11px]"></i>
                                        </div>
                                        <span className="text-[16px] font-black text-slate-700 tracking-tight">Pollen</span>
                                    </div>
                                </div>

                                {/* Inline stats */}
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] mb-2">
                                    {data.pollen.category && (
                                        <div>
                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Current Level </span>
                                            <span className={`font-black ${data.pollen.score != null && data.pollen.score >= 4 ? 'text-rose-500' : data.pollen.score != null && data.pollen.score >= 2 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                {data.pollen.category}{data.pollen.score != null && <span className="text-slate-400 font-bold"> ({data.pollen.score}/5)</span>}
                                            </span>
                                        </div>
                                    )}
                                    {data.pollen.dominantPollenType && (
                                        <div>
                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Dom </span>
                                            <span className="font-black text-slate-700">{data.pollen.dominantPollenType}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Description */}
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
                                        {/* Triggers + Types — single row */}
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
                        </div>
                    )}
                </div>

                {/* MODULE: NEIGHBORHOOD SUMMARY (spans full width) */}
                {neighborhoodOverview && (
                    <div className="col-span-full bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                        <div className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                                    <i className="fa-solid fa-map-location-dot text-indigo-600 text-[11px]"></i>
                                </div>
                                <span className="text-lg font-black text-slate-900 tracking-tight">What's Nearby</span>
                            </div>
                            <p className="text-[13px] text-slate-600 leading-relaxed">{neighborhoodOverview}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AirQualitySection;
