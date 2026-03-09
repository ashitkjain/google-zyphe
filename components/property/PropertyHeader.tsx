
import React from 'react';
import { PropertyData } from '../../types';
import ParcelValidationCard from './ParcelValidationCard';

interface Props {
  data: PropertyData;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  onRunAnalysis?: () => void;
  parcelPolygon?: [number, number][];
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
      <span className="text-[13px] font-normal text-slate-800 leading-snug line-clamp-2">{m.value || 'N/A'}</span>
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

const ParcelMap: React.FC<{ data: PropertyData; parcelPolygon?: [number, number][] }> = ({ data, parcelPolygon }) => {
  if (!data.mapZoomIn) return null;

  return (
    <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden h-full group relative cursor-zoom-in">
      <img
        src={data.mapZoomIn}
        alt="Property Map View"
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
      />
      {parcelPolygon && parcelPolygon.length > 3 && data.coordinates && (() => {
        const zoom = 20;
        const mapW = 2048;
        const mapH = 2048;
        const scale = Math.pow(2, zoom) * 256;
        const deg2rad = Math.PI / 180;

        const cxWorld = ((data.coordinates.longitude + 180) / 360) * scale;
        const cyWorld = (1 - Math.log(Math.tan(deg2rad * data.coordinates.latitude) + 1 / Math.cos(deg2rad * data.coordinates.latitude)) / Math.PI) / 2 * scale;

        const points = parcelPolygon.map(([lon, lat]) => {
          const xWorld = ((lon + 180) / 360) * scale;
          const yWorld = (1 - Math.log(Math.tan(deg2rad * lat) + 1 / Math.cos(deg2rad * lat)) / Math.PI) / 2 * scale;
          const px = (xWorld - cxWorld) + mapW / 2;
          const py = (yWorld - cyWorld) + mapH / 2;
          return `${px},${py}`;
        }).join(' ');

        return (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${mapW} ${mapH}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <polygon
              points={points}
              fill="rgba(99, 102, 241, 0.12)"
              stroke="#6366f1"
              strokeWidth="4"
              strokeDasharray="12 6"
              strokeLinejoin="round"
            />
          </svg>
        );
      })()}
      <div className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest text-slate-500 shadow-sm border border-slate-100">
        Property · Parcel
      </div>
    </div>
  );
};

const PropertyHeader: React.FC<Props> = ({ data, isFavorited, onToggleFavorite, onRunAnalysis, parcelPolygon }) => {
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_1fr_480px_306px] gap-3">

        {/* Parcel Map — Column 5 */}
        <div className="lg:col-start-5 lg:row-start-1 lg:row-end-5 group">
          <div className="w-full aspect-square">
            <ParcelMap data={data} parcelPolygon={parcelPolygon} />
          </div>
        </div>

        {/* Ground Truth — Column 6 */}
        <div className="lg:col-start-6 lg:row-start-1 lg:row-end-5 group">
          <div className="w-full h-full bg-slate-50/50 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
            <ParcelValidationCard propertyData={data} />
          </div>
        </div>

        {/* MLS Description — Spanning Box */}
        {data.description && data.description !== "No description available." && (
          <div className="lg:col-span-4 bg-slate-50/30 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
            <div className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
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

        {/* Combined HOA Box */}
        {(financialSpecs.length > 0 || data.hoa) && (
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
            <div className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <i className="fa-solid fa-building-columns text-[13px]"></i>
              HOA
            </div>

            {financialSpecs.length > 0 && (
              <div className="grid grid-cols-2 gap-y-3 gap-x-3 mb-4">
                {financialSpecs.map((m, idx) => <MetricItem key={idx} m={m} />)}
              </div>
            )}

            {data.hoa && (
              <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 ${financialSpecs.length > 0 ? 'pt-4 border-t border-slate-100/50' : ''}`}>
                {/* Name */}
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-slate-800">{data.hoa.name ?? 'Association N/A'}</span>
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

                {/* Amenity chips */}
                {data.hoa.amenities && data.hoa.amenities.filter(a => a !== 'Other').length > 0 && (
                  <div className="w-full mt-2 pt-2 border-t border-slate-100/50">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Amenities</div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {data.hoa.amenities.filter(a => a !== 'Other').map((amenity, i) => (
                        <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Schools — stacked vertically, single column */}
        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
          <div className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
            <i className="fa-solid fa-graduation-cap text-[13px]"></i>
            Schools
          </div>
          <div className="flex flex-col gap-3">
            {data.schools?.slice(0, 3).map((s, idx) => (
              <MetricItem key={idx} m={{
                icon: 'fa-school-flag',
                label: s.name,
                value: `${s.rating}/10 · ${s.distance} mi`
              }} />
            ))}
            {(!data.schools || data.schools.length === 0) && <p className="text-[11px] text-slate-400 font-normal">No school data available for this area.</p>}
          </div>
        </div>

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
        </div>


        {/* Box 4: Mobility & Connectivity */}
        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
          <div className="text-[13px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
            <i className="fa-solid fa-route text-[13px]"></i>
            Mobility
          </div>
          <div className="flex flex-col gap-3">
            {[
              {
                icon: 'fa-person-walking',
                label: 'Walk',
                value: data.walkScore ? `${data.walkScore}/100${data.walkScoreDesc ? ` · ${data.walkScoreDesc}` : ''}` : 'N/A'
              },
              {
                icon: 'fa-bus',
                label: 'Transit',
                value: data.transitScore ? `${data.transitScore}/100${data.transitScoreDesc ? ` · ${data.transitScoreDesc}` : ''}` : 'N/A'
              },
              {
                icon: 'fa-bicycle',
                label: 'Bike',
                value: data.bikeScore ? `${data.bikeScore}/100${data.bikeScoreDesc ? ` · ${data.bikeScoreDesc}` : ''}` : 'N/A'
              },
            ].map((m, idx) => <MetricItem key={idx} m={m} />)}
          </div>
        </div>




      </div>



    </div>
  );
};

export default PropertyHeader;
