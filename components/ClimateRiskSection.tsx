
import React from 'react';
import { PropertyData } from '../types';

interface Props {
  data: PropertyData;
}

const ClimateRiskSection: React.FC<Props> = ({ data }) => {
  const risks = [
    { type: 'Wind', score: data.windRiskScore, icon: 'fa-wind' },
    { type: 'Flood', score: data.floodRiskScore, icon: 'fa-droplet' },
    { type: 'Fire', score: data.fireRiskScore, icon: 'fa-fire' },
    { type: 'Heat', score: data.heatRiskScore, icon: 'fa-temperature-high' },
  ];

  const getRiskColor = (score?: number) => {
    if (score === undefined || score === null) return 'text-gray-400';
    if (score >= 7) return 'text-rose-600';
    if (score >= 4) return 'text-amber-500';
    return 'text-emerald-500';
  };

  const getRiskBg = (score?: number) => {
    if (score === undefined || score === null) return 'bg-gray-50';
    if (score >= 7) return 'bg-rose-50';
    if (score >= 4) return 'bg-amber-50';
    return 'bg-emerald-50';
  };

  const getStatusLabel = (score?: number) => {
    if (score === undefined || score === null) return 'No Data';
    if (score >= 7) return 'Critical';
    if (score >= 4) return 'Moderate';
    return 'Low Risk';
  };

  return (
    <div className="bg-white border-x border-b border-gray-200 px-8 py-8 rounded-b-[2rem] shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center text-base font-bold text-gray-700">
          <i className="fa-regular fa-shield-halved text-gray-400 mr-3"></i>
          Climate Risk Assessment
        </div>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
          Actuarial Scoring
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {risks.map((r, idx) => (
          <div 
            key={idx} 
            className={`flex flex-col p-4 rounded-2xl border border-gray-100 transition-all hover:shadow-md ${getRiskBg(r.score)}`}
          >
            <div className="flex items-center justify-between mb-3">
              <i className={`fa-solid ${r.icon} ${getRiskColor(r.score)} text-sm`}></i>
              <span className={`text-[11px] font-black uppercase tracking-tight ${getRiskColor(r.score)}`}>
                {getStatusLabel(r.score)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{r.type} Risk</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-black ${getRiskColor(r.score)}`}>
                  {r.score !== undefined ? r.score : '--'}
                </span>
                <span className="text-xs font-bold text-gray-400">/10</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase tracking-widest px-1">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Low</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Moderate</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Critical</span>
        </div>
        <span>Annual Insurance: {data.annualHomeownersInsurance ? `$${data.annualHomeownersInsurance.toLocaleString()}/yr` : 'N/A'}</span>
      </div>
    </div>
  );
};

export default ClimateRiskSection;
