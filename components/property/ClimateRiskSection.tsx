
import React from 'react';
import { PropertyData } from '../../types';

interface Props {
  data: PropertyData;
}

const ClimateRiskSection: React.FC<Props> = ({ data }) => {
  const getScore = (type: string) => {
    if (!data.femaScores) {
      if (type === 'Wind') return data.windRiskScore;
      if (type === 'Inland Flood') return data.floodRiskScore;
      if (type === 'Fire') return data.fireRiskScore;
      if (type === 'Heat') return data.heatRiskScore;
      return null;
    }

    const hazards = data.femaScores.hazards;
    let rawScore = 0;
    if (type === 'Wind') rawScore = Math.max(hazards.hurricane, hazards.tornado, hazards.strongwind);
    if (type === 'Inland Flood') rawScore = hazards.flood;
    if (type === 'Fire') rawScore = hazards.wildfire;
    if (type === 'Heat') rawScore = hazards.heatwave;

    // Scale 0-100 to 1-10 (mirroring backend logic for UI consistency)
    if (rawScore === 0) return 0;
    return Math.max(1, Math.ceil(rawScore / 10));
  };

  const risks = [
    { type: 'Wind', score: getScore('Wind'), icon: 'fa-wind' },
    { type: 'Inland Flood', score: getScore('Inland Flood'), icon: 'fa-droplet' },
    { type: 'Fire', score: getScore('Fire'), icon: 'fa-fire' },
    { type: 'Heat', score: getScore('Heat'), icon: 'fa-temperature-high' },
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
    <div className="bg-white border-x border-gray-100 px-8 py-4">
      <div className="flex items-center justify-between text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
        <div className="flex items-center">
          <i className="fa-regular fa-shield-halved mr-2"></i>
          Climate Risk Assessment
        </div>
        <div className="flex items-center gap-4">
          {data.femaScores && (
            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-bold">
              Source: FEMA NRI
            </span>
          )}
          <span className="hidden sm:inline text-black font-bold">Insurance Est: {data.annualHomeownersInsurance ? `$${data.annualHomeownersInsurance.toLocaleString()}/yr` : 'N/A'}</span>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {risks.map((r, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-3 p-3 rounded-xl border border-gray-50 transition-all hover:shadow-sm ${getRiskBg(r.score)}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-white shadow-sm ${getRiskColor(r.score)}`}>
              <i className={`fa-solid ${r.icon} text-sm`}></i>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-baseline gap-1">
                <span className={`text-base font-black leading-none ${getRiskColor(r.score)}`}>
                  {r.score !== undefined ? r.score : '--'}
                </span>
                <span className="text-[10px] font-bold text-gray-400">/10</span>
              </div>
              <span className="text-[11px] font-black text-gray-500 uppercase tracking-tight truncate">
                {r.type} • {getStatusLabel(r.score)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClimateRiskSection;
