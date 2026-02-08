
import React from 'react';
import { PropertyData } from '../types';

interface Props {
    data: PropertyData;
}

const AirQualitySection: React.FC<Props> = ({ data }) => {
    const aq = data.airQuality;
    const pollen = data.pollen;
    const solar = data.solarData;

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

    const MetricItem: React.FC<{ icon: string; label: string; value: string; colorClass?: string }> = ({ icon, label, value, colorClass }) => (
        <div className="flex items-start gap-3 group">
            <div className="w-4 flex justify-center flex-shrink-0 mt-0.5">
                <i className={`fa-solid ${icon} ${colorClass || 'text-slate-300'} text-[12px] group-hover:text-indigo-500 transition-colors`}></i>
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none truncate">{label}</span>
                <span className={`text-[13px] font-normal ${colorClass || 'text-slate-800'} leading-[1.625] truncate`}>{value}</span>
            </div>
        </div>
    );

    return (
        <div className="bg-white border-x border-slate-100 px-8 pt-0 pb-0">
            <div className={`grid grid-cols-1 md:grid-cols-2 ${solar ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>
                {/* Box 1: Air Quality */}
                {aq && (
                    <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100/80 hover:bg-white transition-colors duration-300">
                        <div className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <i className="fa-solid fa-wind text-[12px]"></i>
                            Air Quality
                        </div>
                        <div className="grid grid-cols-2 gap-y-6 gap-x-4">
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
                )}

                {/* Box 2: Pollen AI Analysis */}
                {pollen && (
                    <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100/80 hover:bg-white transition-colors duration-300">
                        <div className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <i className="fa-solid fa-seedling text-[12px]"></i>
                            Allergy Profile (AI)
                        </div>
                        <div className="grid grid-cols-1 gap-y-6">
                            <div className="flex items-center justify-between">
                                <MetricItem
                                    icon="fa-chart-simple"
                                    label="Allergy Risk"
                                    value={`${pollen.score}/5 - ${pollen.category}`}
                                    colorClass={getPollenColor(pollen.score)}
                                />
                            </div>
                            <MetricItem
                                icon="fa-calendar-days"
                                label="Seasonality Risk"
                                value={pollen.analysis?.seasonality_window || 'N/A'}
                            />
                            <MetricItem
                                icon="fa-dna"
                                label="Primary Triggers"
                                value={pollen.analysis?.primary_triggers?.join(', ') || pollen.dominantPollenType || 'Minimal'}
                            />
                        </div>
                    </div>
                )}

                {/* Box 3: Solar Infrastructure */}
                {solar && (
                    <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100/80 hover:bg-white transition-colors duration-300">
                        <div className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <i className="fa-solid fa-sun text-[12px]"></i>
                            Solar Potential
                        </div>
                        <div className="grid grid-cols-1 gap-y-6">
                            <MetricItem
                                icon="fa-cloud-sun"
                                label="Annual Sunshine"
                                value={`${Math.round(solar.maxSunshineHoursPerYear || 0).toLocaleString()} Hours`}
                            />
                            <MetricItem
                                icon="fa-leaf"
                                label="Carbon Offset"
                                value={`${Math.round(solar.carbonOffsetFactorKgPerMwh || 0)} kg/MWh`}
                            />
                            <MetricItem
                                icon="fa-solar-panel"
                                label="Max Panel Cap"
                                value={`${(solar.solarPanels?.[0]?.totalCount || 0)} Panels`}
                            />
                        </div>
                    </div>
                )}

                {/* Box 4: Molecular Breakdowns */}
                {aq?.pollutants && (
                    <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100/80 hover:bg-white transition-colors duration-300">
                        <div className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <i className="fa-solid fa-flask-vial text-[12px]"></i>
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
            </div>

            {/* AI Analysis & Recommendations Sub-Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Breathe Easy Summary */}
                {pollen?.analysis?.breathe_easy_summary && (
                    <div className="bg-emerald-50/10 p-5 rounded-[1.8rem] border border-emerald-100/30">
                        <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <i className="fa-solid fa-wind text-[10px]"></i>
                            Breathe Easy Summary
                        </div>
                        <p className="text-[12px] text-slate-600 font-normal leading-relaxed">{pollen.analysis.breathe_easy_summary}</p>
                    </div>
                )}

                {/* Home Maintenance Tip */}
                {pollen?.analysis?.maintenance_tip && (
                    <div className="bg-amber-50/10 p-5 rounded-[1.8rem] border border-amber-100/30">
                        <div className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <i className="fa-solid fa-house-medical text-[10px]"></i>
                            Maintenance Insight
                        </div>
                        <p className="text-[12px] text-slate-600 font-normal leading-relaxed">{pollen.analysis.maintenance_tip}</p>
                    </div>
                )}

                {/* Health Recommendations (Combined) */}
                {aq?.recommendations && (
                    <div className="bg-indigo-50/10 p-5 rounded-[1.8rem] border border-indigo-100/30">
                        <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <i className="fa-solid fa-user-doctor text-[10px]"></i>
                            Health Guidance
                        </div>
                        <p className="text-[12px] text-slate-600 font-normal leading-relaxed truncate-3-lines" title={aq.recommendations.general}>
                            {aq.recommendations.general}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AirQualitySection;
