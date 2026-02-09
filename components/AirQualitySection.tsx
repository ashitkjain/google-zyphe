
import React from 'react';
import { PropertyData } from '../types';

import { calculateSolarPotential } from '../utils/solarCalculations';

interface Props {
    data: PropertyData;
}

const AirQualitySection: React.FC<Props> = ({ data }) => {
    const aq = data.airQuality;
    const pollen = data.pollen;
    const solar = data.solarData;
    const solarPotential = solar?.estimatedSolarProduction || (solar ? calculateSolarPotential(solar) : null);

    if (!aq && !pollen && !solar) return null;

    const getAQIColor = (aqi: number) => {
        if (aqi <= 50) return 'text-emerald-500';
        if (aqi <= 100) return 'text-amber-500';
        if (aqi <= 150) return 'text-orange-500';
        return 'text-rose-500';
    };

    const getPollenColor = (score: number) => {
        if (score <= 1) return 'text-emerald-500';
        if (score <= 3) return 'text-amber-500';
        return 'text-rose-600';
    };

    const MetricItem: React.FC<{
        icon: string;
        label: string;
        value: string;
        colorClass?: string;
        helpText?: string;
        helpLink?: string;
    }> = ({ icon, label, value, colorClass, helpText, helpLink }) => (
        <div className="flex items-start gap-3 group relative">
            <div className="w-4 flex justify-center flex-shrink-0 mt-0.5">
                <i className={`fa-solid ${icon} ${colorClass || 'text-slate-300'} text-[12px] group-hover:text-indigo-500 transition-colors`}></i>
            </div>
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none">{label}</span>
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
                <span className={`text-[14px] font-normal ${colorClass || 'text-slate-800'} leading-[1.625]`}>{value}</span>
            </div>
        </div>
    );

    return (
        <div className="bg-white border-x border-slate-100 px-8 pt-0 pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 items-start">

                {/* MODULE 1: ATMOSPHERIC HEALTH (AQI + MOLECULAR) */}
                {aq && (
                    <div className="bg-slate-50/50 rounded-[2.5rem] border border-slate-100/80 overflow-hidden flex flex-col hover:bg-white transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 group">
                        <div className="p-8 pb-0">
                            <div className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                                <i className="fa-solid fa-wind text-[15px]"></i>
                                Atmospheric Health
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-6 mb-8">
                                <MetricItem
                                    icon="fa-gauge-high"
                                    label="UAQI Score"
                                    value={`${aq.aqi} (Global)`}
                                    colorClass={getAQIColor(aq.aqi)}
                                />
                                <MetricItem
                                    icon="fa-leaf"
                                    label="Status"
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
                            <div className="mx-4 mb-4 bg-white/50 rounded-[2rem] p-6 border border-slate-100">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2 px-1">
                                    <i className="fa-solid fa-flask-vial text-[11px]"></i>
                                    Molecular Breakdown
                                </div>
                                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
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

                        {/* AI Guidance footer */}
                        {aq.recommendations && (
                            <div className="p-8 pt-4 bg-indigo-50/30 border-t border-indigo-100/30 space-y-4">
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

                {/* MODULE 2: ALLERGY & WELLNESS (POLLEN + AI ANALYSIS) */}
                {pollen && (
                    <div className="bg-slate-50/50 rounded-[2.5rem] border border-slate-100/80 overflow-hidden flex flex-col hover:bg-white transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 group">
                        <div className="p-8">
                            <div className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                                <i className="fa-solid fa-seedling text-[15px]"></i>
                                Allergy & Wellness
                            </div>

                            <div className="grid grid-cols-1 gap-y-8">
                                <MetricItem
                                    icon="fa-chart-simple"
                                    label="Allergy Risk"
                                    value={`${pollen.score}/5 - ${pollen.category}`}
                                    colorClass={getPollenColor(pollen.score)}
                                />
                                <MetricItem
                                    icon="fa-calendar-days"
                                    label="Seasonality window"
                                    value={pollen.analysis?.seasonality_window || 'N/A'}
                                />
                                <MetricItem
                                    icon="fa-dna"
                                    label="Primary Triggers"
                                    value={pollen.analysis?.primary_triggers?.join(', ') || pollen.dominantPollenType || 'Minimal'}
                                />
                            </div>
                        </div>

                        {/* AI Summary Sub-section */}
                        {(pollen.analysis?.breathe_easy_summary || pollen.analysis?.maintenance_tip) && (
                            <div className="mx-4 mb-4 space-y-3">
                                {pollen.analysis.breathe_easy_summary && (
                                    <div className="bg-white/50 rounded-[1.8rem] p-5 border border-slate-100">
                                        <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <i className="fa-solid fa-lungs text-[11px]"></i>
                                            Breathe Easy Summary
                                        </div>
                                        <p className="text-[12px] text-slate-600 font-medium leading-[1.6]">{pollen.analysis.breathe_easy_summary}</p>
                                    </div>
                                )}
                                {pollen.analysis.maintenance_tip && (
                                    <div className="bg-white/50 rounded-[1.8rem] p-5 border border-slate-100">
                                        <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <i className="fa-solid fa-house-chimney-medical text-[11px]"></i>
                                            Maintenance Insight
                                        </div>
                                        <p className="text-[12px] text-slate-600 font-medium leading-[1.6]">{pollen.analysis.maintenance_tip}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-auto p-4 bg-emerald-50/10 border-t border-emerald-100/10"></div>
                    </div>
                )}

                {/* MODULE 3: SOLAR & STRUCTURAL DNA */}
                {solar && (
                    <div className="bg-slate-50/50 rounded-[2.5rem] border border-slate-100/80 overflow-hidden flex flex-col hover:bg-white transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 group">
                        <div className="p-8 pb-0">
                            <div className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                                <i className="fa-solid fa-solar-panel text-[15px]"></i>
                                Solar & Structural DNA
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-6 mb-8">
                                <MetricItem
                                    icon="fa-cloud-sun"
                                    label="Annual Sunshine"
                                    value={`${Math.round(solar.maxSunshineHoursPerYear || 0).toLocaleString()} Hours`}
                                />
                                {solarPotential ? (
                                    <>
                                        <MetricItem
                                            icon="fa-bolt"
                                            label="Production"
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
                        </div>

                        {/* Roof Topology Sub-section */}
                        {solar.wholeRoofStats && (
                            <div className="mx-4 mb-4 bg-white/50 rounded-[2rem] p-6 border border-slate-100">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2 px-1">
                                    <i className="fa-solid fa-cube text-[11px]"></i>
                                    Roof Topology
                                </div>
                                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
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

                        <div className="mt-auto p-4 bg-slate-50/10 border-t border-slate-100/10"></div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default AirQualitySection;
