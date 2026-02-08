
import React from 'react';
import { PropertyData } from '../types';

interface Props {
    data: PropertyData;
}

const AirQualitySection: React.FC<Props> = ({ data }) => {
    const aq = data.airQuality;

    if (!aq) return null;

    const getAQIColor = (aqi: number) => {
        if (aqi <= 50) return 'text-emerald-500';
        if (aqi <= 100) return 'text-amber-500';
        if (aqi <= 150) return 'text-orange-500';
        if (aqi <= 200) return 'text-rose-500';
        if (aqi <= 300) return 'text-purple-600';
        return 'text-red-900';
    };

    const getAQIBg = (aqi: number) => {
        if (aqi <= 50) return 'bg-emerald-50';
        if (aqi <= 100) return 'bg-amber-50';
        if (aqi <= 150) return 'bg-orange-50';
        if (aqi <= 200) return 'bg-rose-50';
        if (aqi <= 300) return 'bg-purple-50';
        return 'bg-red-50';
    };

    return (
        <div className="bg-white border-x border-gray-100 px-8 py-4 border-t border-gray-50">
            <div className="flex items-center justify-between text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                <div className="flex items-center">
                    <i className="fa-solid fa-wind mr-2"></i>
                    Air Quality Intelligence
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-black font-bold">Source: Google Environmental APIs</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Score */}
                <div className={`p-4 rounded-2xl border border-gray-50 flex items-center gap-4 ${getAQIBg(aq.aqi)}`}>
                    <div className={`w-16 h-16 rounded-full bg-white flex flex-col items-center justify-center shadow-lg ${getAQIColor(aq.aqi)}`}>
                        <span className="text-2xl font-black leading-none">{aq.aqi}</span>
                        <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">UAQI</span>
                    </div>
                    <div className="flex flex-col">
                        <span className={`text-lg font-black uppercase tracking-tight ${getAQIColor(aq.aqi)}`}>
                            {aq.category}
                        </span>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                            Dominant: {aq.dominantPollutant?.toUpperCase()}
                        </span>
                    </div>
                </div>

                {/* Recommendations */}
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center">
                            <i className="fa-solid fa-users text-indigo-400 mr-2"></i>
                            General Population
                        </div>
                        <p className="text-[13px] text-slate-700 font-normal leading-[1.625]">
                            {aq.recommendations?.general || "No specific advice for the general public at this time."}
                        </p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center">
                            <i className="fa-solid fa-person-dots-from-line text-rose-400 mr-2"></i>
                            Sensitive Groups
                        </div>
                        <p className="text-[13px] text-slate-700 font-normal leading-[1.625]">
                            {aq.recommendations?.sensitiveGroups || "No heightened risk for sensitive groups currently."}
                        </p>
                    </div>
                </div>
            </div>

            {/* Pollutant Breakdown */}
            {aq.pollutants && aq.pollutants.length > 0 && (
                <div className="mt-6">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center">
                        Detailed Pollutant Concentrations
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {aq.pollutants.map((p, idx) => (
                            <div key={idx} className="bg-gray-50 border border-gray-100 px-3 py-2 rounded-xl flex items-center gap-3">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-gray-400 uppercase">{p.fullName || p.name}</span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-sm font-black text-slate-700">{p.concentration.toFixed(2)}</span>
                                        <span className="text-[9px] font-bold text-slate-400">{p.unit}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AirQualitySection;
