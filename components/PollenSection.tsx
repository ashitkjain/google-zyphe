
import React from 'react';
import { PropertyData } from '../types';

interface Props {
    data: PropertyData;
}

const PollenSection: React.FC<Props> = ({ data }) => {
    const pollen = data.pollen;
    if (!pollen) return null;

    const getPollenColor = (score: number) => {
        if (score <= 1) return 'text-emerald-500';
        if (score <= 2) return 'text-lime-500';
        if (score <= 3) return 'text-amber-500';
        if (score <= 4) return 'text-orange-500';
        return 'text-rose-600';
    };

    const getPollenBg = (score: number) => {
        if (score <= 1) return 'bg-emerald-50';
        if (score <= 2) return 'bg-lime-50';
        if (score <= 3) return 'bg-amber-50';
        if (score <= 4) return 'bg-orange-50';
        return 'bg-rose-50';
    };

    return (
        <div className="bg-white border-x border-gray-100 px-8 py-4 border-t border-gray-50">
            <div className="flex items-center justify-between text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                <div className="flex items-center">
                    <i className="fa-solid fa-seedling mr-2 text-lime-500"></i>
                    Pollen Forecast (Today)
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-black font-bold">Source: Google Pollen API</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`p-4 rounded-2xl border border-gray-50 flex items-center gap-4 ${getPollenBg(pollen.score)}`}>
                    <div className={`w-14 h-14 rounded-full bg-white flex flex-col items-center justify-center shadow-md ${getPollenColor(pollen.score)}`}>
                        <span className="text-xl font-black leading-none">{pollen.score}</span>
                        <span className="text-[8px] uppercase font-bold tracking-widest opacity-60">UPI</span>
                    </div>
                    <div className="flex flex-col">
                        <span className={`text-lg font-black uppercase tracking-tight ${getPollenColor(pollen.score)}`}>
                            {pollen.category}
                        </span>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                            Level
                        </span>
                    </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-center">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Dominant Type
                    </div>
                    <div className="flex items-center text-slate-700 font-bold text-base">
                        <i className="fa-solid fa-tree mr-2 text-emerald-400"></i>
                        {pollen.dominantPollenType || "Low Activity"}
                    </div>
                    <p className="text-[13px] text-slate-700 font-normal mt-1 leading-[1.625]">
                        {pollen.description}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PollenSection;
