
import React from 'react';
import { PropertyData } from '../../types';

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

  // Compute days on market dynamically from listedDate → today.
  // listedDate can be an ISO string ("2025-12-15"), a Unix timestamp in seconds (~10 digits),
  // or milliseconds (~13 digits). Falls back to cached daysOnZillow if unparseable.
  const computedDaysOnMarket = (() => {
    const raw = data.listedDate;
    if (raw == null || raw === 0) return data.resoFacts?.daysOnZillow ?? null;
    let listed: Date | null = null;
    if (typeof raw === 'string') {
      const parsed = new Date(raw);
      if (!isNaN(parsed.getTime())) listed = parsed;
    } else if (typeof raw === 'number') {
      // Heuristic: seconds vs ms
      listed = new Date(raw > 1e10 ? raw : raw * 1000);
      if (isNaN(listed.getTime())) listed = null;
    }
    if (!listed) return data.resoFacts?.daysOnZillow ?? null;
    const diffMs = Date.now() - listed.getTime();
    const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    return days;
  })();

  const financialSpecs = [
    { icon: 'fa-tag', label: 'List Price', value: formatCurrency(data.price) },
    { icon: 'fa-chart-line', label: 'Zestimate', value: formatCurrency(data.zestimate) },
    { icon: 'fa-house-circle-check', label: 'Home Status', value: data.homeStatus?.replace(/_/g, ' ') || 'N/A' },
    { icon: 'fa-hand-holding-dollar', label: 'Rent Estimate', value: data.rentZestimate ? `${formatCurrency(data.rentZestimate)}/month` : 'N/A' },
    { icon: 'fa-shield-heart', label: 'Annual Insurance', value: data.annualHomeownersInsurance ? `${formatCurrency(data.annualHomeownersInsurance)}/year` : 'N/A' },
    { icon: 'fa-clock', label: 'Days on Market', value: computedDaysOnMarket != null ? `${computedDaysOnMarket} days` : 'N/A' },
  ];

  // Fix: Explicitly type MetricItem as React.FC to handle React-reserved props like 'key' in mapped components
  const MetricItem: React.FC<{ m: any }> = ({ m }) => (
    <div className="flex items-start gap-2 group">
      <div className="w-3.5 flex justify-center flex-shrink-0 mt-0.5">
        <i className={`fa-solid ${m.icon} text-slate-300 text-[11px] group-hover:text-indigo-500 transition-colors`}></i>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">{m.label}</span>
        <span className="text-[13px] font-normal text-slate-800 leading-snug">{m.value || 'N/A'}</span>
      </div>
    </div>
  );

  return (
    <div className="bg-white p-5 md:p-6 md:pb-2 rounded-t-[1.5rem] border-x border-t border-slate-100 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-50 pb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">{data.address || 'Property Details'}</h2>
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={() => onToggleFavorite && onToggleFavorite()}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm cursor-pointer ${isFavorited ? 'bg-rose-50 text-rose-500 border border-rose-100 shadow-rose-100' : 'bg-slate-50 text-slate-300 border border-slate-100 hover:text-rose-400 hover:bg-rose-50/50 hover:border-rose-200'}`}
              title={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
            >
              <i className={`${isFavorited ? 'fa-solid' : 'fa-regular'} fa-heart text-base`}></i>
            </button>
            {isFavorited && (
              <button
                onClick={() => onToggleFavorite && onToggleFavorite()}
                className="h-9 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer bg-slate-50 text-slate-400 border border-slate-100 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-200 group"
                title="Remove from Favorites"
              >
                <i className="fa-solid fa-trash-can text-sm"></i>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-rose-500">Remove from favorites</span>
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">List Price</div>
            <div className="text-2xl font-black text-indigo-600">{formatCurrency(data.listPrice ?? data.price)}</div>
          </div>
          <button
            onClick={onRunAnalysis}
            className="hidden sm:block bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-indigo-800 transition-all active:scale-95"
          >
            View Visual AI Analysis
          </button>
        </div>
      </div>

      <button
        onClick={onRunAnalysis}
        className="sm:hidden w-full bg-indigo-700 text-white py-2.5 rounded-xl font-black text-[10px] uppercase shadow-lg"
      >
        View Visual AI Analysis
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Box 1: Physical Specifications */}
        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
          <div className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
            <i className="fa-solid fa-house-chimney text-[13px]"></i>
            Physical Specifications
          </div>
          <div className="grid grid-cols-2 gap-y-3 gap-x-3">
            {coreSpecs.map((m, idx) => <MetricItem key={idx} m={m} />)}
          </div>
        </div>

        {/* Box 2: Value & Market Status */}
        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
          <div className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
            <i className="fa-solid fa-chart-line text-[13px]"></i>
            Value & Market Status
          </div>
          <div className="grid grid-cols-2 gap-y-3 gap-x-3">
            {financialSpecs.map((m, idx) => <MetricItem key={idx} m={m} />)}
          </div>
        </div>

        {/* Box 3c: Schools */}
        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300 lg:col-span-2">
          <div className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
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

        {/* Box 3d: Utilities */}
        {(data.resoFacts?.heating || data.resoFacts?.cooling || data.resoFacts?.utilities || data.resoFacts?.sewer || data.resoFacts?.waterSource) && (
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
            <div className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <i className="fa-solid fa-plug text-[13px]"></i>
              Utilities
            </div>
            <div className="grid grid-cols-2 gap-y-3 gap-x-3">
              {[
                { icon: 'fa-fire-flame-simple', label: 'Heating', value: data.resoFacts?.heating },
                { icon: 'fa-snowflake', label: 'Cooling', value: data.resoFacts?.cooling },
                { icon: 'fa-plug', label: 'Utilities', value: data.resoFacts?.utilities },
                { icon: 'fa-faucet', label: 'Sewer', value: data.resoFacts?.sewer },
                { icon: 'fa-droplet', label: 'Water Source', value: data.resoFacts?.waterSource },
              ].filter(m => m.value).map((m, idx) => <MetricItem key={idx} m={m} />)}
            </div>
          </div>
        )}

        {/* Box 4: Mobility & Connectivity */}
        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
          <div className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
            <i className="fa-solid fa-route text-[13px]"></i>
            Mobility & Connectivity
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-3">
            {[
              { icon: 'fa-person-walking', label: 'Walk Score', value: data.walkScore ? `${data.walkScore}/100 (${data.walkScoreDesc || 'N/A'})` : 'N/A' },
              { icon: 'fa-bus', label: 'Transit Score', value: data.transitScore ? `${data.transitScore}/100 (${data.transitScoreDesc || 'N/A'})` : 'N/A' },
              { icon: 'fa-bicycle', label: 'Bike Score', value: data.bikeScore ? `${data.bikeScore}/100 (${data.bikeScoreDesc || 'N/A'})` : 'N/A' },
            ].map((m, idx) => <MetricItem key={idx} m={m} />)}
          </div>
        </div>

        {/* Box 5: HOA / Association — only shown when hoa data exists */}
        {data.hoa && (
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300 lg:col-span-2">
            <div className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <i className="fa-solid fa-building-columns text-[13px]"></i>
              HOA / Association
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {/* Name */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none">Association</span>
                <span className="text-[13px] font-semibold text-slate-800">{data.hoa.name ?? 'N/A'}</span>
              </div>
              {/* Phone */}
              {data.hoa.phone && (
                <div className="flex items-center gap-1.5">
                  <i className="fa-solid fa-phone text-slate-300 text-[10px]"></i>
                  <span className="text-[12px] text-slate-600">{data.hoa.phone}</span>
                </div>
              )}
              {/* Fee */}
              {data.hoa.fee && (
                <span className="text-[12px] text-indigo-600 font-bold">· {data.hoa.fee}</span>
              )}
              {/* Fee includes */}
              {data.hoa.feeIncludes && data.hoa.feeIncludes.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Includes</span>
                  <span className="text-[12px] text-slate-600">{data.hoa.feeIncludes.join(' · ')}</span>
                </div>
              )}
              {/* Amenity chips */}
              {data.hoa.amenities && data.hoa.amenities.filter(a => a !== 'Other').length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {data.hoa.amenities.filter(a => a !== 'Other').map((amenity, i) => (
                    <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {amenity}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}


      </div>



    </div>
  );
};

export default PropertyHeader;
