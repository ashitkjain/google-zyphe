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
  marketDynamics?: { summary?: string; details?: string[] } | null;
  section?: 'top' | 'details';
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

const ExpandableList: React.FC<{ items: React.ReactNode[]; limit?: number; className?: string }> = ({ items, limit = 2, className = "flex flex-col gap-3" }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  if (items.length <= limit) return <div className={className}>{items}</div>;

  return (
    <div className={className}>
      {isExpanded ? items : items.slice(0, limit)}
      <button
        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
        className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition-colors mt-1 flex items-center gap-1.5 w-fit"
      >
        <i className={`fa-solid ${isExpanded ? 'fa-minus' : 'fa-plus'} text-[8px]`}></i>
        {isExpanded ? 'Show Less' : `${items.length - limit} More`}
      </button>
    </div>
  );
};

const parseValue = (val: any) => {
  if (val === null || val === undefined || val === '') return null;
  if (Array.isArray(val)) return val.filter(Boolean).join(', ') || null;
  if (typeof val === 'string' && val.startsWith('[')) {
    try {
      const p = JSON.parse(val);
      if (Array.isArray(p)) return p.filter(Boolean).join(', ');
    } catch (e) { }
  }
  return String(val);
};

const PropertyHeader: React.FC<Props> = ({ data, isFavorited, onToggleFavorite, onRunAnalysis, parcelPolygon, designStyle, marketDynamics, section }) => {
  const [isDescExpanded, setIsDescExpanded] = React.useState(false);

  // Compute days on market dynamically from listedDate → today.
  const computedDaysOnMarket = (() => {
    const raw = data.listedDate;
    if (raw == null || raw === 0) return data.resoFacts?.daysOnZillow ?? null;
    let listed: Date | null = null;
    if (typeof raw === 'string') {
      const parsed = new Date(raw);
      if (!isNaN(parsed.getTime())) listed = parsed;
    } else if (typeof raw === 'number') {
      listed = new Date(raw > 1e10 ? raw : raw * 1000);
      if (isNaN(listed.getTime())) listed = null;
    }
    if (!listed) return data.resoFacts?.daysOnZillow ?? null;
    const diffMs = Date.now() - listed.getTime();
    const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    return days;
  })();

  const financialSpecs: any[] = [];

  // ── Details-only section ──────────────────────────────────────────
  if (section === 'details') {
    return (
      <div className="bg-white px-5 pb-5 pt-2 md:px-6 md:pb-2 md:pt-2 rounded-[1.5rem] border border-slate-100 shadow-sm space-y-3">

        {/* MLS Description — full width */}
        {data.description && data.description !== "No description available." && (
          <div className="bg-slate-50/30 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
            <div className="relative">
              <p className={`text-[13px] text-slate-700 leading-relaxed font-normal whitespace-pre-wrap ${!isDescExpanded && data.description.length > 300 ? 'line-clamp-5' : ''}`}>
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

        {/* Detail cards — masonry columns layout */}
        <div className="columns-1 lg:columns-3 gap-3 [&>*]:break-inside-avoid [&>*]:mb-3">

          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
            <ExpandableList
              items={[
                { icon: 'fa-landmark', label: 'Architectural Style', value: parseValue(data.resoFacts?.architecturalStyle) },
                { icon: 'fa-stairs', label: 'Stories', value: data.resoFacts?.stories ? `${data.resoFacts.stories}` : null },
                { icon: 'fa-hammer', label: 'Construction', value: parseValue(data.resoFacts?.constructionMaterials) },
                { icon: 'fa-rug', label: 'Flooring', value: parseValue(data.resoFacts?.flooring) },
                { icon: 'fa-house-chimney-window', label: 'Roof Type', value: parseValue(data.resoFacts?.roofType) },
                { icon: 'fa-car-side', label: 'Garage', value: parseValue(data.resoFacts?.garageParkingCapacity) },
                { icon: 'fa-square-parking', label: 'Parking', value: parseValue(data.resoFacts?.parkingFeatures) },
                { icon: 'fa-clipboard-check', label: 'Condition', value: parseValue(data.resoFacts?.propertyCondition) },
              ].filter(m => m.value).map((m, idx) => <MetricItem key={idx} m={m} />)}
            />

            {/* Real Estate Dynamics (from Deep Investment Research) */}
            {marketDynamics && (marketDynamics.summary || (marketDynamics.details && marketDynamics.details.length > 0)) && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                  <i className="fa-solid fa-chart-line text-[13px]"></i>
                  Real Estate Dynamics
                </div>
                {marketDynamics.summary && (
                  <p className="text-[13px] text-slate-700 leading-relaxed font-normal mb-2">{marketDynamics.summary}</p>
                )}
                <ExpandableList
                  className="flex flex-col gap-1.5"
                  items={marketDynamics.details.map((detail, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 mt-[6px]"></div>
                      <span className="text-[12px] text-slate-600 leading-relaxed">{detail}</span>
                    </div>
                  ))}
                />
              </div>
            )}
          </div>

          {data.hoa && (
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
              <div className="flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 shadow-sm group/hoa">
                  <i className="fa-solid fa-building text-[10px] text-indigo-400 group-hover/hoa:text-indigo-600 transition-colors"></i>
                  <span>
                    {data.hoa.name || 'HOA'}
                    {data.hoa.phone && <span className="text-slate-400 font-normal ml-1.5 text-[11px]">({data.hoa.phone})</span>}
                    {data.hoa.fee && <span className="text-emerald-600 ml-2 font-black tracking-tight">{data.hoa.fee}</span>}
                  </span>
                </div>
                {data.resoFacts?.numberOfUnitsInCommunity != null && data.resoFacts.numberOfUnitsInCommunity > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[12px] font-bold text-slate-600 shadow-sm">
                    <i className="fa-solid fa-people-roof text-[9px] text-slate-300"></i>
                    {data.resoFacts.numberOfUnitsInCommunity} units
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Interior */}
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
            <ExpandableList
              items={[
                { icon: 'fa-fire-flame-simple', label: 'Heating', value: parseValue(data.resoFacts?.heating) },
                { icon: 'fa-snowflake', label: 'Cooling', value: parseValue(data.resoFacts?.cooling) },
                { icon: 'fa-blender', label: 'Appliances', value: parseValue(data.resoFacts?.appliances) },
                { icon: 'fa-arrow-down-wide-short', label: 'Basement', value: parseValue(data.resoFacts?.basement) },
                { icon: 'fa-couch', label: 'Interior Features', value: parseValue(data.resoFacts?.interiorFeatures) },
              ].filter(m => m.value).map((m, idx) => <MetricItem key={idx} m={m} />)}
            />
          </div>

          {/* Utilities */}
          {(() => {
            const utilItems = [
              { icon: 'fa-plug', label: 'Utilities', value: parseValue(data.resoFacts?.utilities) },
              { icon: 'fa-bolt', label: 'Electric', value: parseValue(data.resoFacts?.electric) },
              { icon: 'fa-faucet', label: 'Sewer', value: parseValue(data.resoFacts?.sewer) },
              { icon: 'fa-droplet', label: 'Water Source', value: parseValue(data.resoFacts?.waterSource) },
            ].filter(m => m.value);
            if (!utilItems.length) return null;
            return (
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
                <ExpandableList
                  items={utilItems.map((m, idx) => <MetricItem key={idx} m={m} />)}
                />
              </div>
            );
          })()}


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
                <ExpandableList
                  items={features.map((f, idx) => (
                    <MetricItem key={idx} m={{ icon: 'fa-circle-check', label: f.split(':')[0], value: f.split(':').slice(1).join(':').trim() }} />
                  ))}
                />
              </div>
            );
          })()}

        </div>

        {/* HOA Amenities — full width */}
        {data.hoa?.amenities && data.hoa.amenities.filter((a: string) => a !== 'Other').length > 0 && (
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
            <div className="flex items-center gap-2 mb-2">
              <i className="fa-solid fa-building-shield text-[10px] text-slate-300"></i>
              <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">HOA Amenities</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.hoa.amenities.filter((a: string) => a !== 'Other').map((amenity: string, i: number) => (
                <span key={i} className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {amenity}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* HOA Fee Includes — full width */}
        {data.hoa?.feeIncludes && data.hoa.feeIncludes.filter((a: string) => a !== 'Other' && a !== 'None').length > 0 && (
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
            <div className="flex items-center gap-2 mb-2">
              <i className="fa-solid fa-receipt text-[10px] text-slate-300"></i>
              <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">HOA Fee Includes</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.hoa.feeIncludes.filter((a: string) => a !== 'Other' && a !== 'None').map((item: string, i: number) => (
                <span key={i} className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Top section (address + tags + buttons) ────────────────────────
  return (
    <div>
      <div className="flex flex-col gap-1">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <a
              href={data.zpid ? `https://www.zillow.com/homedetails/${data.zpid}_zpid/` : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="group/address"
            >
              <h2 className="text-lg font-black text-slate-900 tracking-tight group-hover/address:text-indigo-600 transition-colors leading-none">
                {data.address || 'Property Details'}
                <i className="fa-solid fa-arrow-up-right-from-square text-[12px] ml-2 opacity-0 group-hover/address:opacity-100 transition-all"></i>
              </h2>
            </a>
            {(data.listPrice ?? data.price) && (
              <span className="text-lg font-black text-emerald-600 tracking-tight leading-none">
                {formatCurrency(data.listPrice ?? data.price)}
              </span>
            )}
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
            {data.neighborhood_identity?.resolved_name && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 border border-violet-200 rounded-md text-[11px] font-bold text-violet-700">
                <i className="fa-solid fa-map-location-dot text-[7px]" />Neighborhood: {data.neighborhood_identity.resolved_name}
              </span>
            )}
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
            {(data.listPrice ?? data.price) && data.livingAreaValue && data.livingAreaValue > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-md text-[11px] font-bold text-emerald-700">
                <i className="fa-solid fa-tag text-[7px]" />${Math.round((data.listPrice ?? data.price!) / data.livingAreaValue)}/sf
              </span>
            )}

            {computedDaysOnMarket != null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-slate-600">
                <i className="fa-solid fa-clock text-[7px] text-slate-400" />DOM: {computedDaysOnMarket}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyHeader;
