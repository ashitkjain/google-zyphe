
import React from 'react';
import { PropertyData } from '../types';

interface Props {
  data: PropertyData;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  onRunAnalysis?: () => void;
}

const PropertyHeader: React.FC<Props> = ({ data, isFavorited, onToggleFavorite, onRunAnalysis }) => {
  const formatCurrency = (val?: number) => val ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : 'N/A';

  const coreSpecs = [
    { icon: 'fa-bed', label: 'Bedrooms', value: data.bedrooms },
    { icon: 'fa-bath', label: 'Bathrooms', value: data.bathrooms },
    { icon: 'fa-maximize', label: 'Living Area', value: data.livingAreaValue ? `${data.livingAreaValue.toLocaleString()} sq ft` : 'N/A' },
    { icon: 'fa-chart-area', label: 'Lot Size', value: data.lotSize || 'N/A' },
    { icon: 'fa-calendar-days', label: 'Year Built', value: data.yearBuilt },
    { icon: 'fa-house', label: 'Property Type', value: data.homeType?.replace(/_/g, ' ') },
  ];

  const financialSpecs = [
    { icon: 'fa-tag', label: 'List Price', value: formatCurrency(data.price) },
    { icon: 'fa-chart-line', label: 'Zestimate', value: formatCurrency(data.zestimate) },
    { icon: 'fa-house-circle-check', label: 'Home Status', value: data.homeStatus?.replace(/_/g, ' ') || 'N/A' },
    { icon: 'fa-hand-holding-dollar', label: 'Rent Estimate', value: data.rentZestimate ? `${formatCurrency(data.rentZestimate)}/month` : 'N/A' },
    { icon: 'fa-shield-heart', label: 'Annual Insurance', value: data.annualHomeownersInsurance ? `${formatCurrency(data.annualHomeownersInsurance)}/year` : 'N/A' },
  ];

  // Fix: Explicitly type MetricItem as React.FC to handle React-reserved props like 'key' in mapped components
  const MetricItem: React.FC<{ m: any }> = ({ m }) => (
    <div className="flex items-start gap-3 group">
      <div className="w-4 flex justify-center flex-shrink-0 mt-0.5">
        <i className={`fa-solid ${m.icon} text-slate-300 text-[12px] group-hover:text-indigo-500 transition-colors`}></i>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none">{m.label}</span>
        <span className="text-[14px] font-normal text-slate-800 leading-[1.625]">{m.value || 'N/A'}</span>
      </div>
    </div>
  );

  return (
    <div className="bg-white p-8 md:p-10 md:pb-2 rounded-t-[2.5rem] border-x border-t border-slate-100 shadow-sm space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-8">
        <div className="flex items-center gap-4">
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">{data.address}</h2>
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={() => onToggleFavorite && onToggleFavorite()}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm cursor-pointer ${isFavorited ? 'bg-rose-50 text-rose-500 border border-rose-100 shadow-rose-100' : 'bg-slate-50 text-slate-300 border border-slate-100 hover:text-rose-400 hover:bg-rose-50/50 hover:border-rose-200'}`}
              title={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
            >
              <i className={`${isFavorited ? 'fa-solid' : 'fa-regular'} fa-heart text-xl`}></i>
            </button>
            {isFavorited && (
              <button
                onClick={() => onToggleFavorite && onToggleFavorite()}
                className="h-12 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer bg-slate-50 text-slate-400 border border-slate-100 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-200 group"
                title="Remove from Favorites"
              >
                <i className="fa-solid fa-trash-can text-lg"></i>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-rose-500">Remove from favorites</span>
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">List Price</div>
            <div className="text-3xl font-black text-indigo-600">{formatCurrency(data.price)}</div>
          </div>
          <button
            onClick={onRunAnalysis}
            className="hidden sm:block bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-indigo-800 transition-all active:scale-95"
          >
            View Visual AI Analysis
          </button>
        </div>
      </div>

      <button
        onClick={onRunAnalysis}
        className="sm:hidden w-full bg-indigo-700 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-xl"
      >
        View Visual AI Analysis
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Box 1: Physical Specifications */}
        <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100/80 hover:bg-white transition-colors duration-300">
          <div className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <i className="fa-solid fa-house-chimney text-[13px]"></i>
            Physical Specifications
          </div>
          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
            {coreSpecs.map((m, idx) => <MetricItem key={idx} m={m} />)}
          </div>
        </div>

        {/* Box 2: Value & Market Status */}
        <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100/80 hover:bg-white transition-colors duration-300">
          <div className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <i className="fa-solid fa-chart-line text-[13px]"></i>
            Value & Market Status
          </div>
          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
            {financialSpecs.map((m, idx) => <MetricItem key={idx} m={m} />)}
          </div>
        </div>

        {/* Box 3: Mobility & Connectivity */}
        <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100/80 hover:bg-white transition-colors duration-300">
          <div className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <i className="fa-solid fa-route text-[13px]"></i>
            Mobility & Connectivity
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
            {[
              { icon: 'fa-person-walking', label: 'Walk Score', value: data.walkScore ? `${data.walkScore}/100 (${data.walkScoreDesc || 'N/A'})` : 'N/A' },
              { icon: 'fa-bus', label: 'Transit Score', value: data.transitScore ? `${data.transitScore}/100 (${data.transitScoreDesc || 'N/A'})` : 'N/A' },
              { icon: 'fa-bicycle', label: 'Bike Score', value: data.bikeScore ? `${data.bikeScore}/100 (${data.bikeScoreDesc || 'N/A'})` : 'N/A' },
            ].map((m, idx) => <MetricItem key={idx} m={m} />)}
          </div>
        </div>

        {/* Box 4: Schools */}
        <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100/80 hover:bg-white transition-colors duration-300 lg:col-span-2">
          <div className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <i className="fa-solid fa-graduation-cap text-[13px]"></i>
            Schools
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {data.schools?.slice(0, 3).map((s, idx) => (
              <MetricItem key={idx} m={{
                icon: 'fa-school-flag',
                label: s.name,
                value: `Rating: ${s.rating}/10 • ${s.distance} miles away`
              }} />
            ))}
            {(!data.schools || data.schools.length === 0) && <p className="text-[11px] text-slate-400 font-normal">No school data available for this area.</p>}
          </div>
        </div>

        {/* Box 5: Climate Risk Assessment */}
        <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100/80 hover:bg-white transition-colors duration-300">
          <div className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <i className="fa-solid fa-shield-halved text-[13px]"></i>
            Climate Risk Assessment
          </div>
          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
            {[
              { icon: 'fa-wind', label: 'Wind Risk', value: data.windRiskScore ? `${data.windRiskScore}/10` : 'N/A' },
              { icon: 'fa-droplet', label: 'Flood Risk', value: data.floodRiskScore ? `${data.floodRiskScore}/10` : 'N/A' },
              { icon: 'fa-fire', label: 'Fire Risk', value: data.fireRiskScore ? `${data.fireRiskScore}/10` : 'N/A' },
              { icon: 'fa-temperature-high', label: 'Heat Risk', value: data.heatRiskScore ? `${data.heatRiskScore}/10` : 'N/A' },
            ].map((m, idx) => <MetricItem key={idx} m={m} />)}
          </div>
        </div>
      </div>

    </div>
  );
};

export default PropertyHeader;
