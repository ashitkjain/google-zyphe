
import React from 'react';
import { PropertyData, School } from '../types';

interface Props {
  data: PropertyData;
}

const SchoolScores: React.FC<Props> = ({ data }) => {
  if (!data.schools || data.schools.length === 0) return null;

  const getRatingColor = (rating: string | number) => {
    const r = typeof rating === 'string' ? parseInt(rating) : rating;
    if (isNaN(r)) return 'text-gray-400';
    if (r >= 7) return 'text-emerald-500';
    if (r >= 4) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getRatingBg = (rating: string | number) => {
    const r = typeof rating === 'string' ? parseInt(rating) : rating;
    if (isNaN(r)) return 'bg-gray-50';
    if (r >= 7) return 'bg-emerald-50';
    if (r >= 4) return 'bg-amber-50';
    return 'bg-rose-50';
  };

  const getRatingLabel = (rating: string | number) => {
    const r = typeof rating === 'string' ? parseInt(rating) : rating;
    if (isNaN(r)) return 'Unrated';
    if (r >= 7) return 'Excellent';
    if (r >= 4) return 'Average';
    return 'Below Avg';
  };

  return (
    <div className="bg-white border-x border-gray-100 px-8 py-4">
      <div className="flex items-center text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
        <i className="fa-solid fa-graduation-cap mr-2"></i>
        Educational Institution Performance
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {data.schools.slice(0, 3).map((school, idx) => (
          <div 
            key={idx} 
            className={`flex items-center gap-3 p-3 rounded-xl border border-gray-50 transition-all hover:shadow-sm ${getRatingBg(school.rating)}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-white shadow-sm ${getRatingColor(school.rating)}`}>
              <span className="text-base font-black">{school.rating || '?'}</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-black text-gray-900 uppercase tracking-tight truncate">
                {school.name}
              </span>
              <div className="flex items-center gap-2">
                 <span className={`text-[10px] font-black uppercase tracking-widest ${getRatingColor(school.rating)}`}>
                  {getRatingLabel(school.rating)}
                </span>
                <span className="text-gray-300 text-[10px]">•</span>
                <span className="text-[10px] font-bold text-gray-500 uppercase">
                  {school.distance} away
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SchoolScores;
