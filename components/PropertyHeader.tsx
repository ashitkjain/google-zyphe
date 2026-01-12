
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
      <div className="w-5 flex justify-center flex-shrink-0 mt-0.5">
        <i className={`fa-solid ${m.icon} text-slate-400 text-sm group-hover:text-indigo-500 transition-colors`}></i>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 text-base leading-tight">
        <span className="font-bold text-slate-600 whitespace-nowrap">{m.label}:</span>
        <span className="font-semibold text-slate-900 break-words">{m.value || 'N/A'}</span>
      </div>
    </div>
  );

  return (
    <div className="bg-white p-8 md:p-10 rounded-t-[2.5rem] border-x border-t border-slate-100 shadow-sm space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-8">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">{data.address}</h2>
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
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">List Price</div>
            <div className="text-2xl font-black text-indigo-600">{formatCurrency(data.price)}</div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-10">
        {/* Physical Specs */}
        <div className="space-y-5">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <span className="w-4 h-px bg-slate-200"></span>
            Physical Specifications
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            {coreSpecs.map((m, idx) => <MetricItem key={idx} m={m} />)}
          </div>
        </div>

        {/* Financial & Status */}
        <div className="space-y-5">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <span className="w-4 h-px bg-slate-200"></span>
            Value & Market Status
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            {financialSpecs.map((m, idx) => <MetricItem key={idx} m={m} />)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyHeader;
