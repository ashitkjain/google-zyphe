
import React from 'react';
import { PropertyData } from '../../types';

import { calculateSolarPotential } from '../../utils/solarCalculations';

interface Props {
    data: PropertyData;
}

const AirQualitySection: React.FC<Props> = ({ data }) => {
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

    return (
        <div className="bg-white border-x border-slate-100 px-6 pt-0 pb-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">


                {/* MODULE: CLIMATE RISK + NOISE (stacked) */}
                <div className="flex flex-col gap-3">
                    {/* Climate Risk */}
                    {hasClimate && (
                        <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden hover:bg-white transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 group">
                            <div className="p-3">
                                <div className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                                    <i className="fa-solid fa-shield-halved text-[13px]"></i>
                                    Climate Risk
                                </div>
                                <div className="grid grid-cols-2 gap-y-1.5 gap-x-3">
                                    <MetricItem
                                        icon="fa-wind"
                                        label="Wind"
                                        value={data.windRiskScore ? `${data.windRiskScore}/10` : 'N/A'}
                                        isCritical={!!(data.windRiskScore && data.windRiskScore > 5)}
                                    />
                                    <MetricItem
                                        icon="fa-droplet"
                                        label="Flood"
                                        value={data.floodRiskScore ? `${data.floodRiskScore}/10` : 'N/A'}
                                        isCritical={!!(data.floodRiskScore && data.floodRiskScore > 5)}
                                    />
                                    <MetricItem
                                        icon="fa-fire"
                                        label="Fire"
                                        value={data.fireRiskScore ? `${data.fireRiskScore}/10` : 'N/A'}
                                        isCritical={!!(data.fireRiskScore && data.fireRiskScore > 5)}
                                    />
                                    <MetricItem
                                        icon="fa-temperature-high"
                                        label="Heat"
                                        value={data.heatRiskScore ? `${data.heatRiskScore}/10` : 'N/A'}
                                        isCritical={!!(data.heatRiskScore && data.heatRiskScore > 5)}
                                    />
                                    {data.annualHomeownersInsurance && (
                                        <MetricItem icon="fa-shield-heart" label="Insurance" value={`$${data.annualHomeownersInsurance.toLocaleString()}/yr`} />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Noise */}
                    {hasNoise && (
                        <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden hover:bg-white transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 group">
                            <div className="p-3">
                                <div className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                                    <i className="fa-solid fa-volume-xmark text-[13px]"></i>
                                    Noise
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all" style={{ width: `${noisePct(data.noiseScore!)}%`, background: getNoiseColor(data.noiseScore!) }} />
                                        </div>
                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-lg whitespace-nowrap ${getNoiseBadge(data.noiseScore!)}`}>
                                            {data.noiseScore}/100 · {data.noiseScoreDesc ?? ''}
                                        </span>
                                    </div>
                                    {[
                                        { label: 'Traffic', score: data.noiseTrafficScore, desc: data.noiseTrafficDesc },
                                        { label: 'Local', score: data.noiseLocalScore, desc: data.noiseLocalDesc },
                                        { label: 'Airport', score: data.noiseAirportScore, desc: data.noiseAirportDesc },
                                    ].filter(s => s.score != null).map(({ label, score, desc }) => (
                                        <div key={label} className="flex items-center gap-1.5">
                                            <span className="text-[9px] text-slate-400 uppercase tracking-widest w-10 flex-shrink-0">{label}</span>
                                            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all" style={{ width: `${noisePct(score!)}%`, background: getNoiseColor(score!) }} />
                                            </div>
                                            <span className="text-[9px] text-slate-500 w-10 text-right flex-shrink-0">{desc ?? score}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* MODULE 1: ATMOSPHERIC HEALTH (AQI + MOLECULAR) */}
                {aq && (
                    <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden flex flex-col hover:bg-white transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 group">
                        <div className="p-5 pb-0">
                            <div className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <i className="fa-solid fa-wind text-[15px]"></i>
                                Atmospheric Health
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-4 mb-4">
                                <MetricItem
                                    icon="fa-gauge-high"
                                    label="UAQI Score"
                                    value={`${aq.aqi} (Global)`}
                                    colorClass={getAQIColor(aq.aqi)}
                                />
                                <MetricItem
                                    icon="fa-leaf"
                                    label="Current Level"
                                    value={aq.category}
                                    colorClass={getAQIColor(aq.aqi)}
                                />
                                <MetricItem
                                    icon="fa-atom"
                                    label="Dominant"
                                    value={aq.dominantPollutant?.toUpperCase() || 'N/A'}
                                />
                                <MetricItem
                                    icon="fa-person-shelter"
                                    label="Safety"
                                    value={aq.aqi > 100 ? 'Caution' : 'Safe'}
                                />
                            </div>
                        </div>

                        {/* Molecular Sub-section */}
                        {aq.pollutants && (
                            <div className="mx-3 mb-3 bg-white/50 rounded-xl border border-slate-100 overflow-hidden">
                                <button
                                    onClick={() => setIsMolecularExpanded(!isMolecularExpanded)}
                                    className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest p-4 pb-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <i className="fa-solid fa-flask-vial text-[11px]"></i>
                                        Molecular Breakdown
                                    </div>
                                    <i className={`fa-solid fa-chevron-${isMolecularExpanded ? 'up' : 'down'} text-[9px] transition-transform`}></i>
                                </button>
                                {isMolecularExpanded && (
                                    <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <div className="grid grid-cols-2 gap-y-3 gap-x-3">
                                            {aq.pollutants.slice(0, 4).map((p, idx) => (
                                                <MetricItem
                                                    key={idx}
                                                    icon={p.name.includes('CO') ? 'fa-cloud' : p.name.includes('PM') ? 'fa-smog' : 'fa-atom'}
                                                    label={p.name}
                                                    value={`${p.concentration.toFixed(1)} ${p.unit === 'PARTS_PER_BILLION' ? 'ppb' : 'µg/m³'}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* AI Guidance footer */}
                        {aq.recommendations && (
                            <div className="p-5 pt-3 pb-4 bg-indigo-50/30 border-t border-indigo-100/30 space-y-3">
                                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                    <i className="fa-solid fa-user-doctor text-[12px]"></i>
                                    Health Insights
                                </div>
                                <div className="space-y-3">
                                    {aq.recommendations.general && (
                                        <div className="flex gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/30 mt-1.5 flex-shrink-0" />
                                            <p className="text-[12.5px] text-slate-600 font-normal leading-relaxed italic">
                                                <span className="font-bold text-slate-400 not-italic uppercase text-[9px] tracking-tighter mr-2">General:</span>
                                                "{aq.recommendations.general}"
                                            </p>
                                        </div>
                                    )}
                                    {aq.recommendations.sensitiveGroups && (
                                        <div className="flex gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-400/30 mt-1.5 flex-shrink-0" />
                                            <p className="text-[12.5px] text-slate-600 font-normal leading-relaxed italic">
                                                <span className="font-bold text-rose-400 not-italic uppercase text-[9px] tracking-tighter mr-2">Sensitive:</span>
                                                "{aq.recommendations.sensitiveGroups}"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}



                {/* MODULE 3: SOLAR & STRUCTURAL DNA */}
                {solar && (
                    <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden flex flex-col hover:bg-white transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 group">
                        <div className="p-6">
                            <div className="text-[14px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                <i className="fa-solid fa-solar-panel text-[16px]"></i>
                                Solar Strategy
                            </div>

                            <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-6">
                                <MetricItem
                                    icon="fa-cloud-sun"
                                    label="Annual Sunshine"
                                    value={`${Math.round(solar.maxSunshineHoursPerYear || 0).toLocaleString()} Hours`}
                                />
                                {solarPotential ? (
                                    <>
                                        <MetricItem
                                            icon="fa-bolt"
                                            label="Est. Annual Production"
                                            value={`${solarPotential.annualKwh.toLocaleString()} kWh`}
                                            colorClass="text-indigo-600"
                                            helpText={`Calculated using ${solar.panelCapacityWatts || 400}W panel standard with 1.7m² footprint and 85% system efficiency.`}
                                        />
                                        <MetricItem
                                            icon="fa-layer-group"
                                            label="Capacity"
                                            value={`${solarPotential.estimatedPanels} Panels`}
                                        />
                                        <MetricItem
                                            icon="fa-earth-americas"
                                            label="CO2 Offset"
                                            value={`${solarPotential.carbonOffsetTons} t/yr`}
                                            colorClass="text-emerald-600"
                                        />
                                    </>
                                ) : (
                                    <MetricItem
                                        icon="fa-leaf"
                                        label="Offset Constant"
                                        value={`${Math.round(solar.carbonOffsetFactorKgPerMwh || 0)} kg/MWh`}
                                    />
                                )}
                            </div>

                            {/* Roof Topology Sub-section */}
                            {solar.wholeRoofStats && (
                                <div className="bg-white/50 rounded-2xl p-4 border border-slate-100">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <i className="fa-solid fa-cube text-[11px]"></i>
                                        Roof Topology
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <MetricItem
                                            icon="fa-up-right-and-down-left-from-center"
                                            label="Surface Area"
                                            value={`${Math.round(solar.wholeRoofStats.areaMeters2 || 0)} m²`}
                                        />
                                        <MetricItem
                                            icon="fa-vector-square"
                                            label="Footprint"
                                            value={`${Math.round(solar.wholeRoofStats.groundAreaMeters2 || 0)} m²`}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* FULL WIDTH BOTTOM: POLLEN INTELLIGENCE dashboard */}
            {hasPollen && data.pollen && (
                <div className="mt-6">
                    <div className="bg-slate-50/50 rounded-[2rem] border border-slate-100/80 overflow-hidden hover:bg-white transition-all duration-500 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/5 group">
                        <div className="p-8">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
                                        <i className="fa-solid fa-seedling text-indigo-600 text-xl"></i>
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em]">Allergy Intelligence</div>
                                        <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none mt-1">Neighborhood Pollen Profile</h3>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    {data.pollen.category && (
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Index Score</span>
                                            <span className={`text-xl font-black ${data.pollen.score != null && data.pollen.score >= 4 ? 'text-rose-500' : data.pollen.score != null && data.pollen.score >= 2 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                {data.pollen.category}
                                            </span>
                                        </div>
                                    )}
                                    <div className="w-px h-8 bg-slate-200"></div>
                                    {data.pollen.dominantPollenType && (
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Dominant</span>
                                            <span className="text-xl font-black text-slate-800">{data.pollen.dominantPollenType}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch font-sans">
                                {/* Left Content: Summary & Triggers */}
                                <div className="lg:col-span-7 space-y-6">
                                    {data.pollen.analysis?.breathe_easy_summary && (
                                        <div className="p-6 bg-white/70 rounded-3xl border border-white shadow-sm ring-1 ring-slate-100">
                                            <p className="text-[14px] text-slate-700 font-medium leading-[1.625] italic text-balance">
                                                "{data.pollen.analysis.breathe_easy_summary}"
                                            </p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="p-5 bg-white rounded-2xl border border-slate-100">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <i className="fa-solid fa-bullseye text-amber-500"></i>
                                                Primary Triggers
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {data.pollen.analysis?.primary_triggers?.map((t, i) => (
                                                    <span key={i} className="text-[11px] font-bold px-3 py-1 bg-amber-50 text-amber-700 rounded-lg border border-amber-100">{t}</span>
                                                )) || <span className="text-xs text-slate-400 italic">None identified</span>}
                                            </div>
                                        </div>
                                        <div className="p-5 bg-white rounded-2xl border border-slate-100">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <i className="fa-solid fa-lightbulb text-indigo-500"></i>
                                                Maintenance Tip
                                            </div>
                                            <p className="text-[12px] text-slate-500 font-medium leading-relaxed">
                                                {data.pollen.analysis?.maintenance_tip || 'No specific maintenance recommended for current levels.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Content: Species & Types */}
                                <div className="lg:col-span-5 space-y-6">
                                    {/* Types Grid */}
                                    <div className="grid grid-cols-3 gap-3 p-4 bg-white/60 rounded-3xl border border-white backdrop-blur-sm shadow-inner">
                                        {(data.pollen as any).pollenTypeInfo?.map((type: any, i: number) => {
                                            const score = type.indexInfo?.value || 0;
                                            const ratingColor = score >= 4 ? 'bg-rose-500' : score >= 2 ? 'bg-amber-500' : 'bg-emerald-500';
                                            const textColor = score >= 4 ? 'text-rose-600' : score >= 2 ? 'text-amber-600' : 'text-emerald-600';
                                            const icon = type.pollenType === 'GRASS' ? 'fa-leaf' : type.pollenType === 'TREE' ? 'fa-tree' : 'fa-plant-wilt';
                                            return (
                                                <div key={i} className="flex flex-col items-center bg-white/80 p-3 rounded-2xl border border-white shadow-soft">
                                                    <div className={`w-8 h-8 rounded-xl ${ratingColor} bg-opacity-10 flex items-center justify-center mb-2`}>
                                                        <i className={`fa-solid ${icon} ${textColor} text-xs`}></i>
                                                    </div>
                                                    <div className="text-[10px] font-black uppercase tracking-tighter text-slate-400 mb-0.5">{type.displayName}</div>
                                                    <div className={`text-[12px] font-black ${textColor}`}>{type.indexInfo?.category}</div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Species Badges */}
                                    <div className="p-6 bg-slate-900/5 rounded-3xl border border-slate-900/5">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <i className="fa-solid fa-dna"></i>
                                            Active Species Detected
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {(data.pollen as any).plantInfo?.filter((p: any) => (p.indexInfo?.value || 0) > 0).map((plant: any, i: number) => (
                                                <div key={i} className="group/plant relative px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-200 hover:shadow-md transition-all cursor-help">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${plant.indexInfo.value >= 4 ? 'bg-rose-400' : 'bg-amber-400'}`}></div>
                                                        <span className="text-[11px] font-bold text-slate-700">{plant.displayName}</span>
                                                    </div>
                                                    <div className="invisible group-hover/plant:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 p-3 bg-slate-950 text-white text-[11px] rounded-2xl shadow-2xl z-50 ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-200">
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <span className="font-black uppercase tracking-widest text-[9px] opacity-60">Pollen Index</span>
                                                            <span className="font-black text-indigo-400">{plant.indexInfo.category}</span>
                                                        </div>
                                                        <div className="font-medium leading-normal opacity-90">{plant.indexInfo.indexDescription}</div>
                                                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-950 rotate-45"></div>
                                                    </div>
                                                </div>
                                            )) || <span className="text-xs text-slate-400 italic">No specific species identified</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AirQualitySection;
