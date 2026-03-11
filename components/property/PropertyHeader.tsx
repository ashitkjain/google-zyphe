import React from 'react';
import { PropertyData } from '../../types';
import ParcelValidationCard from './ParcelValidationCard';
import StaticParcelMap from './StaticParcelMap';

interface Props {
  data: PropertyData;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  onRunAnalysis?: () => void;
  parcelPolygon?: [number, number][];
  designStyle?: { style?: string; reasoning?: string } | null;
}

const formatCurrency = (val?: number) => val ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : 'N/A';

// Explicitly type MetricItem as React.FC to handle React-reserved props like 'key' in mapped components
const MetricItem: React.FC<{ m: any }> = ({ m }) => (
  <div className="flex items-start gap-2 group">
    <div className="w-3.5 flex justify-center flex-shrink-0 mt-0.5">
      <i className={`fa-solid ${m.icon} text-slate-300 text-[11px] group-hover:text-indigo-500 transition-colors`}></i>
    </div>
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none truncate">{m.label}</span>
      <span className="text-[13px] font-normal text-slate-800 leading-snug">{m.value || 'N/A'}</span>
    </div>
  </div>
);

const parseValue = (val: any) => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'string' && val.startsWith('[')) {
    try {
      const p = JSON.parse(val);
      if (Array.isArray(p)) return p.filter(Boolean).join(', ');
    } catch (e) { }
  }
  return String(val);
};

const PropertyHeader: React.FC<Props> = ({ data, isFavorited, onToggleFavorite, onRunAnalysis, parcelPolygon, designStyle }) => {
  const [isDescExpanded, setIsDescExpanded] = React.useState(false);

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

  const financialSpecs: any[] = [];

  return (
    <div className="bg-white p-5 md:p-6 md:pb-2 rounded-t-[1.5rem] border-x border-t border-slate-100 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 border-b border-slate-50 pb-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <a
              href={data.zpid ? `https://www.zillow.com/homedetails/${data.zpid}_zpid/` : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="group/address"
            >
              <h2 className="text-2xl font-black text-slate-900 tracking-tight group-hover/address:text-indigo-600 transition-colors">
                {data.address || 'Property Details'}
                <i className="fa-solid fa-arrow-up-right-from-square text-[12px] ml-2 opacity-0 group-hover/address:opacity-100 transition-all"></i>
              </h2>
            </a>
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

          {/* Inline physical specs badges — comps style */}
          <div className="flex flex-wrap gap-1.5">
            {data.homeType && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-md text-[11px] font-bold text-indigo-700">
                <i className="fa-solid fa-house text-[7px]" />{data.homeType.replace(/_/g, ' ')}
              </span>
            )}
            {data.bedrooms != null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-slate-600">
                <i className="fa-solid fa-bed text-[7px] text-slate-400" />{data.bedrooms} bd
              </span>
            )}
            {data.bathrooms != null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-slate-600">
                <i className="fa-solid fa-bath text-[7px] text-slate-400" />{data.bathrooms} ba
              </span>
            )}
            {data.livingAreaValue && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-slate-600">
                <i className="fa-solid fa-maximize text-[7px] text-slate-400" />{data.livingAreaValue.toLocaleString()} sf
              </span>
            )}
            {data.lotSize && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-slate-600">
                <i className="fa-solid fa-chart-area text-[7px] text-slate-400" />{data.lotSize} lot
              </span>
            )}
            {data.yearBuilt && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-slate-600">
                <i className="fa-solid fa-calendar text-[7px] text-slate-400" />Built {data.yearBuilt}
              </span>
            )}
            {data.price && data.livingAreaValue && data.livingAreaValue > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-md text-[11px] font-bold text-emerald-700">
                <i className="fa-solid fa-tag text-[7px]" />${Math.round(data.price / data.livingAreaValue)}/sf
              </span>
            )}
            {data.price && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-md text-[11px] font-bold text-indigo-700">
                <i className="fa-solid fa-tag text-[7px]" />{formatCurrency(data.listPrice ?? data.price)}
              </span>
            )}
            {data.homeStatus && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-100 rounded-md text-[11px] font-bold text-amber-700">
                <i className="fa-solid fa-house-circle-check text-[7px]" />{data.homeStatus.replace(/_/g, ' ')}
              </span>
            )}
            {computedDaysOnMarket != null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-slate-600">
                <i className="fa-solid fa-clock text-[7px] text-slate-400" />DOM: {computedDaysOnMarket}
              </span>
            )}
            {data.rentZestimate && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-slate-600">
                <i className="fa-solid fa-hand-holding-dollar text-[7px] text-slate-400" />Rent: {formatCurrency(data.rentZestimate)}/mo
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_480px_306px] gap-3">

        {/* Ground Truth Engine intro — spans map + Ground Truth columns */}
        <div className="lg:col-start-4 lg:col-span-2 flex items-center gap-3 bg-slate-50/50 rounded-xl border border-slate-100/80 px-4 py-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-shield-halved text-indigo-600 text-[11px]"></i>
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-black text-slate-900 uppercase tracking-[0.2em]">The Ground Truth Engine</div>
            <p className="text-[13px] text-slate-700 leading-relaxed font-normal mt-0.5">
              Zyphe's verification system cross-references active real estate listings against municipal and federal databases to detect discrepancies and structural risks before you invest.
            </p>
          </div>
        </div>

        {/* Parcel Map — Column 4 */}
        <div className="lg:col-start-4 lg:row-start-2 lg:row-end-6 group">
          <div className="w-full aspect-square">
            <StaticParcelMap data={data} parcelPolygon={parcelPolygon} />
          </div>
        </div>

        {/* Ground Truth — Column 5 */}
        <div className="lg:col-start-5 lg:row-start-2 lg:row-end-6 group">
          <div className="w-full h-full bg-slate-50/50 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
            <ParcelValidationCard propertyData={data} />
          </div>
        </div>

        {/* MLS Description — Row 1, spanning columns 1-3 */}
        {data.description && data.description !== "No description available." && (
          <div className="lg:col-start-1 lg:col-span-3 lg:row-start-1 bg-slate-50/30 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
            <div className="text-[13px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <i className="fa-solid fa-align-left text-[11px]"></i>
              MLS Property Description
            </div>
            <div className="relative">
              <p className={`text-[13px] text-slate-700 leading-relaxed font-normal whitespace-pre-wrap ${!isDescExpanded && data.description.length > 300 ? 'line-clamp-3' : ''}`}>
                {data.description}
              </p>
              {data.description.length > 300 && (
                <button
                  onClick={() => setIsDescExpanded(!isDescExpanded)}
                  className="mt-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition-colors"
                >
                  {isDescExpanded ? 'Show Less' : 'Read Full Description'}
                </button>
              )}
            </div>
          </div>
        )}



        {/* Structural & Exterior */}
        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
          <div className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
            <i className="fa-solid fa-house-chimney text-[13px]"></i>
            Exterior
          </div>
          <div className="flex flex-col gap-3">
            {[
              { icon: 'fa-landmark', label: 'Architectural Style', value: parseValue(data.resoFacts?.architecturalStyle) },
              { icon: 'fa-hammer', label: 'Construction', value: parseValue(data.resoFacts?.constructionMaterials) },
              { icon: 'fa-rug', label: 'Flooring', value: parseValue(data.resoFacts?.flooring) },
              { icon: 'fa-house-chimney-window', label: 'Roof Type', value: parseValue(data.resoFacts?.roofType) },
              { icon: 'fa-car-side', label: 'Garage', value: parseValue(data.resoFacts?.garageParkingCapacity) },
            ].filter(m => m.value).map((m, idx) => <MetricItem key={idx} m={m} />)}
          </div>

          {/* Design Philosophy (from Visual AI) */}
          {designStyle?.style && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                <i className="fa-solid fa-palette text-[13px]"></i>
                Design Philosophy
              </div>
              <span className="inline-block bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase px-2.5 py-1 rounded-full mb-2">{designStyle.style}</span>
              {designStyle.reasoning && (
                <p className="text-[13px] text-slate-700 leading-relaxed font-normal">{designStyle.reasoning}</p>
              )}
            </div>
          )}
        </div>

        {/* Interior */}
        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
          <div className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
            <i className="fa-solid fa-couch text-[13px]"></i>
            Interior
          </div>
          <div className="flex flex-col gap-3">
            {[
              { icon: 'fa-fire-flame-simple', label: 'Heating', value: parseValue(data.resoFacts?.heating) },
              { icon: 'fa-snowflake', label: 'Cooling', value: parseValue(data.resoFacts?.cooling) },
              { icon: 'fa-blender', label: 'Appliances', value: parseValue(data.resoFacts?.appliances) },
              { icon: 'fa-arrow-down-wide-short', label: 'Basement', value: parseValue(data.resoFacts?.basement) },
            ].filter(m => m.value).map((m, idx) => <MetricItem key={idx} m={m} />)}
          </div>

          {/* Utilities (below Interior) */}
          {(() => {
            const utilItems = [
              { icon: 'fa-plug', label: 'Utilities', value: parseValue(data.resoFacts?.utilities) },
              { icon: 'fa-faucet', label: 'Sewer', value: parseValue(data.resoFacts?.sewer) },
              { icon: 'fa-droplet', label: 'Water Source', value: parseValue(data.resoFacts?.waterSource) },
            ].filter(m => m.value);
            if (!utilItems.length) return null;
            return (
              <>
                <div className="border-t border-slate-200/80 my-3"></div>
                <div className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-plug text-[13px]"></i>
                  Utilities
                </div>
                <div className="flex flex-col gap-3">
                  {utilItems.map((m, idx) => <MetricItem key={idx} m={m} />)}
                </div>
              </>
            );
          })()}

        </div>

        {/* Additional Features */}
        {(() => {
          const parseComplexFact = (val: any): string[] => {
            if (!val) return [];
            if (typeof val === 'string') {
              if (val.startsWith('[')) {
                try { return JSON.parse(val).filter(Boolean); } catch { return [val]; }
              }
              return val.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
            if (Array.isArray(val)) return val.filter(Boolean).map(String);
            return [String(val)];
          };
          const getFeature = (label: string, value: any) => {
            const vals = parseComplexFact(value);
            if (!vals.length || (vals.length === 1 && vals[0].toLowerCase() === 'null')) return null;
            const cleanLabel = label.replace(/Features/gi, '').trim();
            return `${cleanLabel}: ${vals.join(', ')}`;
          };
          const features = [
            getFeature('Fireplace Features', data.resoFacts?.fireplaceFeatures),
            getFeature('Lot Features', data.resoFacts?.lotFeatures),
            getFeature('Security Features', data.resoFacts?.securityFeatures),
            getFeature('Window Features', data.resoFacts?.windowFeatures),
            getFeature('Laundry Features', data.resoFacts?.laundryFeatures),
            getFeature('Fencing', data.resoFacts?.fencing),
          ].filter(Boolean) as string[];
          if (!features.length) return null;
          return (
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
              <div className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                <i className="fa-solid fa-list-check text-[13px]"></i>
                Additional Features
              </div>
              <div className="flex flex-col gap-3">
                {features.map((f, idx) => (
                  <MetricItem key={idx} m={{ icon: 'fa-circle-check', label: f.split(':')[0], value: f.split(':').slice(1).join(':').trim() }} />
                ))}
              </div>
            </div>
          );
        })()}

        {/* Schools — Row below Exterior/Interior/Additional Features, spanning 3 cols */}
        {data.schools && data.schools.length > 0 && (
          <div className="lg:col-span-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
            <div className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <i className="fa-solid fa-graduation-cap text-[13px]"></i>
              Schools
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {data.schools.slice(0, 3).map((s: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                  <i className="fa-solid fa-school-flag text-[10px] text-slate-300"></i>
                  <div className="min-w-0">
                    <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider truncate">{s.name}</div>
                    <div className="text-[13px] font-normal text-slate-800 leading-snug">{s.rating}/10 · {s.distance} mi</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyHeader;
