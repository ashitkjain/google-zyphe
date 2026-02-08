
import React from 'react';
import { PropertyData } from '../types';

interface Props {
  data: PropertyData;
}

const MobilityScores: React.FC<Props> = ({ data }) => {
  const scores = [
    { type: 'Walk', score: data.walkScore, desc: data.walkScoreDesc, icon: 'fa-person-walking' },
    { type: 'Transit', score: data.transitScore, desc: data.transitScoreDesc, icon: 'fa-bus' },
    { type: 'Bike', score: data.bikeScore, desc: data.bikeScoreDesc, icon: 'fa-bicycle' },
  ];

  const getColor = (score?: number) => {
    if (score === undefined || score === null) return 'text-gray-400';
    if (score >= 70) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getBg = (score?: number) => {
    if (score === undefined || score === null) return 'bg-gray-50';
    if (score >= 70) return 'bg-emerald-50';
    if (score >= 50) return 'bg-amber-50';
    return 'bg-rose-50';
  };

  return (
    <div className="bg-white border-x border-gray-100 px-8 py-4">
      <div className="flex items-center text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
        <i className="fa-solid fa-route mr-2"></i>
        Mobility scores
      </div>
      <div className="grid grid-cols-3 gap-4">
        {scores.map((s, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-3 p-3 rounded-xl border border-gray-50 transition-all hover:shadow-sm ${getBg(s.score)}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-white shadow-sm ${getColor(s.score)}`}>
              <i className={`fa-solid ${s.icon} text-sm`}></i>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-baseline gap-1">
                <span className={`text-base font-black leading-none ${getColor(s.score)}`}>
                  {s.score !== undefined ? s.score : '--'}
                </span>
                <span className="text-[10px] font-bold text-gray-400">/100</span>
              </div>
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-tight truncate">
                {s.type} {s.desc ? `• ${s.desc}` : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MobilityScores;
