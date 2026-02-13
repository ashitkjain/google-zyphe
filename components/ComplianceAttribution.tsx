
import React from 'react';
import { PropertyData } from '../types';

interface ComplianceAttributionProps {
    data: PropertyData;
}

const ComplianceAttribution: React.FC<ComplianceAttributionProps> = ({ data }) => {
    if (!data.attribution || (!data.attribution.listingAgentName && !data.attribution.brokerageName)) {
        return null;
    }

    return (
        <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100/80 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 mx-8 md:mx-10 mb-20">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-indigo-500 shadow-sm flex-shrink-0">
                    <i className="fa-solid fa-id-card-clip text-xl"></i>
                </div>
                <div>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] leading-none mb-1.5">Compliance Attribution</p>
                    <h4 className="text-sm font-black text-slate-900 leading-tight">
                        Listing Agent: {data.attribution.listingAgentName || 'Listing Agent'}
                        {data.attribution.brokerageName && <span className="text-slate-300 mx-3">/</span>}
                        <span className="text-indigo-600">{data.attribution.brokerageName}</span>
                    </h4>
                    {data.attribution.mlsName && (
                        <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
                            Data provided by {data.attribution.mlsName} {data.attribution.mlsId && `(MLS #${data.attribution.mlsId})`}
                        </p>
                    )}
                </div>
            </div>
            {data.attribution.listingAgentNumber && (
                <div className="flex items-center gap-3 py-2 px-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <i className="fa-solid fa-phone text-xs text-indigo-400"></i>
                    <span className="text-[11px] font-black text-slate-600 font-mono italic tracking-tight">{data.attribution.listingAgentNumber}</span>
                </div>
            )}
        </div>
    );
};

export default ComplianceAttribution;
