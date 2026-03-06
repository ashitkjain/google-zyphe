
import React, { useState, lazy, Suspense } from 'react';
import Property3DMap from './Property3DMap';

const ParcelPolygonMap = lazy(() => import('./ParcelPolygonMap'));

interface Props {
  mapZoomIn?: string;
  mapZoomOut?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  address?: string;
  solarData?: any;
  parcelPolygon?: [number, number][];
  parcelApn?: string;
  parcelAreaSqft?: number;
}

const PropertyMaps: React.FC<Props> = ({ mapZoomIn, mapZoomOut, coordinates, address, solarData, parcelPolygon, parcelApn, parcelAreaSqft }) => {
  const [expandedMap, setExpandedMap] = useState<string | null>(null);
  const [show3D, setShow3D] = useState(false);

  if (!mapZoomIn && !mapZoomOut && !coordinates) return null;

  const handleClose = () => setExpandedMap(null);

  return (
    <div className="bg-white border-x border-b border-gray-100 px-5 py-5 shadow-sm rounded-b-[1.5rem] space-y-5">


      {coordinates && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-base font-black text-slate-900 uppercase tracking-widest">
              <i className="fa-brands fa-google text-indigo-500 mr-3"></i>
              Google 3D Map Exploration
            </div>
            <button
              onClick={() => setShow3D(!show3D)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${show3D ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {show3D ? 'Disable Engine' : 'Initialize 3D Engine'}
            </button>
          </div>

          <div className="relative group">
            {show3D ? (
              <Property3DMap
                latitude={coordinates.latitude}
                longitude={coordinates.longitude}
                address={address || "Property Location"}
              />
            ) : (
              <div
                className="w-full h-[300px] rounded-[2.5rem] bg-slate-900 overflow-hidden relative cursor-pointer group shadow-xl"
                onClick={() => setShow3D(true)}
              >
                <div className="absolute inset-0 opacity-40 group-hover:opacity-60 transition-opacity bg-[url('https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80')] bg-cover bg-center"></div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10 transition-transform group-hover:scale-105 duration-700">
                  <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-6">
                    <i className="fa-brands fa-google text-3xl"></i>
                  </div>
                  <h4 className="text-xl font-black tracking-tight mb-2">Google 3D Map Exploration</h4>
                  <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Powered by Google Maps 3D Tiles · Click to Launch</p>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-900 to-transparent"></div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-6 pt-4">
        <div className="flex items-center text-base font-black text-slate-900 uppercase tracking-widest">
          <i className="fa-solid fa-map-location-dot text-indigo-500 mr-3"></i>
          Context Maps
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            onClick={() => mapZoomOut && setExpandedMap(mapZoomOut)}
            className={`rounded-3xl overflow-hidden border border-gray-100 shadow-sm aspect-square bg-gray-50 group relative ${mapZoomOut ? 'cursor-zoom-in' : ''}`}
          >
            {mapZoomOut ? (
              <>
                <img
                  src={mapZoomOut}
                  alt="Neighborhood Map View"
                  className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-1000"
                />
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm border border-slate-100">Neighborhood View</div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                  <i className="fa-solid fa-magnifying-glass-plus text-white opacity-0 group-hover:opacity-100 transition-all scale-50 group-hover:scale-100 text-3xl drop-shadow-md"></i>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 italic text-sm font-medium">Neighborhood map not available</div>
            )}
          </div>

          <div
            onClick={() => mapZoomIn && setExpandedMap(mapZoomIn)}
            className={`rounded-3xl overflow-hidden border border-gray-100 shadow-sm aspect-square bg-gray-50 group relative ${mapZoomIn ? 'cursor-zoom-in' : ''}`}
          >
            {mapZoomIn ? (
              <>
                <img
                  src={mapZoomIn}
                  alt="Property Map View"
                  className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-1000"
                />
                {/* Parcel polygon overlay on the zoom-in map */}
                {parcelPolygon && parcelPolygon.length > 3 && coordinates && (() => {
                  // Web Mercator projection: convert lon/lat to pixel on a zoom=20, 2048x2048 static map
                  const zoom = 20;
                  const mapW = 2048;
                  const mapH = 2048;
                  const scale = Math.pow(2, zoom) * 256; // total world pixels at this zoom
                  const deg2rad = Math.PI / 180;

                  // Center of the map in world pixel coords
                  const cxWorld = ((coordinates.longitude + 180) / 360) * scale;
                  const cyWorld = (1 - Math.log(Math.tan(deg2rad * coordinates.latitude) + 1 / Math.cos(deg2rad * coordinates.latitude)) / Math.PI) / 2 * scale;

                  const points = parcelPolygon.map(([lon, lat]) => {
                    const xWorld = ((lon + 180) / 360) * scale;
                    const yWorld = (1 - Math.log(Math.tan(deg2rad * lat) + 1 / Math.cos(deg2rad * lat)) / Math.PI) / 2 * scale;
                    // Pixel offset from center, then shift to SVG viewBox center
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
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm border border-slate-100">
                  Property Focus{parcelPolygon && parcelPolygon.length > 3 ? ' · Parcel' : ''}
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                  <i className="fa-solid fa-magnifying-glass-plus text-white opacity-0 group-hover:opacity-100 transition-all scale-50 group-hover:scale-100 text-3xl drop-shadow-md"></i>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 italic text-sm font-medium">Property map not available</div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Map Overlay */}
      {expandedMap && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-500"
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-xl"></div>

          <div
            className="relative max-w-6xl w-full bg-white rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 flex flex-col"
            style={{ maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleClose}
              className="absolute top-6 right-6 z-20 w-12 h-12 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-all border border-slate-100 active:scale-95"
            >
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>

            <div className="flex-1 overflow-hidden bg-slate-50 flex items-center justify-center p-2">
              <img
                src={expandedMap}
                alt="Expanded Map View"
                className="max-w-full max-h-full w-auto h-auto object-contain rounded-2xl shadow-lg"
              />
            </div>

            <div className="bg-white px-10 py-8 border-t border-slate-50 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                  <i className="fa-solid fa-map-location-dot text-indigo-600 text-xl"></i>
                </div>
                <div>
                  <div className="text-slate-900 font-black text-xl tracking-tight">Intelligence Map Context</div>
                  <div className="text-slate-400 text-xs font-bold uppercase tracking-widest">{address}</div>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="px-10 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyMaps;
