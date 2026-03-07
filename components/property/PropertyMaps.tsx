
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
  const [show3DOverlay, setShow3DOverlay] = useState(false);

  if (!mapZoomIn && !mapZoomOut && !coordinates) return null;

  const handleClose = () => setExpandedMap(null);

  return (
    <div className="bg-white border-x border-b border-gray-100 px-5 py-5 shadow-sm rounded-b-[1.5rem] space-y-5">

      <div className="space-y-4">
        <div className="flex items-center text-base font-black text-slate-900 uppercase tracking-widest">
          <i className="fa-solid fa-map-location-dot text-indigo-500 mr-3"></i>
          Maps
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Column 1: Neighborhood View */}
          <div
            onClick={() => mapZoomOut && setExpandedMap(mapZoomOut)}
            className={`rounded-2xl overflow-hidden border border-gray-100 shadow-sm aspect-square bg-gray-50 group relative ${mapZoomOut ? 'cursor-zoom-in' : ''}`}
          >
            {mapZoomOut ? (
              <>
                <img
                  src={mapZoomOut}
                  alt="Neighborhood Map View"
                  className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-1000"
                />
                <div className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest text-slate-500 shadow-sm border border-slate-100">Neighborhood</div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                  <i className="fa-solid fa-magnifying-glass-plus text-white opacity-0 group-hover:opacity-100 transition-all scale-50 group-hover:scale-100 text-2xl drop-shadow-md"></i>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 italic text-xs font-medium">Neighborhood map not available</div>
            )}
          </div>

          {/* Column 2: Google 3D Map (disabled by default, click to open overlay) */}
          {coordinates && (
            <div
              className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm aspect-square bg-slate-900 group relative cursor-pointer"
              onClick={() => setShow3DOverlay(true)}
            >
              <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity bg-[url('https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80&w=400')] bg-cover bg-center"></div>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10 transition-transform group-hover:scale-105 duration-700">
                <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-3">
                  <i className="fa-brands fa-google text-lg"></i>
                </div>
                <h4 className="text-xs font-black tracking-tight mb-1">3D Satellite</h4>
                <p className="text-white/50 text-[8px] font-bold uppercase tracking-widest">Click to Launch</p>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-900 to-transparent"></div>
              <div className="absolute top-2.5 left-2.5 bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest text-white/80 border border-white/10">3D Map</div>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Static Map Overlay */}
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

      {/* Google 3D Map Fullscreen Overlay */}
      {show3DOverlay && coordinates && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-500"
          onClick={() => setShow3DOverlay(false)}
        >
          <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-xl"></div>

          <div
            className="relative w-full h-full max-w-[90vw] max-h-[75vh] bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShow3DOverlay(false)}
              className="absolute top-4 right-4 z-20 w-12 h-12 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-all border border-slate-100 active:scale-95"
            >
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>

            <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
              <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg border border-white/20 flex items-center gap-2">
                <i className="fa-brands fa-google text-indigo-500"></i>
                <span className="text-xs font-black uppercase tracking-widest text-slate-700">3D Map Exploration</span>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <Property3DMap
                latitude={coordinates.latitude}
                longitude={coordinates.longitude}
                address={address || "Property Location"}
              />
            </div>

            <div className="bg-slate-900/80 backdrop-blur-md px-6 py-4 border-t border-white/5 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <i className="fa-solid fa-cube text-indigo-400 text-sm"></i>
                </div>
                <div>
                  <div className="text-white font-bold text-sm tracking-tight">{address}</div>
                  <div className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Google Maps 3D Tiles · Scroll to zoom · Drag to rotate</div>
                </div>
              </div>
              <button
                onClick={() => setShow3DOverlay(false)}
                className="px-6 py-2.5 bg-white text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all shadow-xl active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyMaps;

