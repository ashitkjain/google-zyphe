
import React, { useState } from 'react';

interface Props {
  mapZoomIn?: string;
  mapZoomOut?: string;
}

const PropertyMaps: React.FC<Props> = ({ mapZoomIn, mapZoomOut }) => {
  const [expandedMap, setExpandedMap] = useState<string | null>(null);

  if (!mapZoomIn && !mapZoomOut) return null;

  const handleClose = () => setExpandedMap(null);

  return (
    <div className="bg-white border-x border-gray-200 px-8 py-6">
      <div className="flex items-center text-base font-bold text-gray-700 mb-4">
        <i className="fa-solid fa-map-location-dot text-gray-400 mr-3"></i>
        Location Context (Click to expand)
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          onClick={() => mapZoomOut && setExpandedMap(mapZoomOut)}
          className={`rounded-xl overflow-hidden border border-gray-100 shadow-sm h-48 md:h-56 bg-gray-50 group relative ${mapZoomOut ? 'cursor-zoom-in' : ''}`}
        >
          {mapZoomOut ? (
            <>
              <img 
                src={mapZoomOut} 
                alt="Neighborhood Map View" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                <i className="fa-solid fa-expand text-white opacity-0 group-hover:opacity-100 transition-opacity text-2xl drop-shadow-md"></i>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 italic text-sm">Neighborhood map not available</div>
          )}
        </div>

        <div 
          onClick={() => mapZoomIn && setExpandedMap(mapZoomIn)}
          className={`rounded-xl overflow-hidden border border-gray-100 shadow-sm h-48 md:h-56 bg-gray-50 group relative ${mapZoomIn ? 'cursor-zoom-in' : ''}`}
        >
          {mapZoomIn ? (
            <>
              <img 
                src={mapZoomIn} 
                alt="Property Map View" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                <i className="fa-solid fa-expand text-white opacity-0 group-hover:opacity-100 transition-opacity text-2xl drop-shadow-md"></i>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 italic text-sm">Property map not available</div>
          )}
        </div>
      </div>

      {/* Expanded Map Overlay */}
      {expandedMap && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300"
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-gray-900/95 backdrop-blur-md"></div>
          
          <div 
            className="relative max-w-6xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col"
            style={{ maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={handleClose}
              className="absolute top-4 right-4 z-20 w-10 h-10 bg-white/90 hover:bg-white text-gray-900 rounded-full flex items-center justify-center shadow-xl transition-all"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
            
            <div className="flex-1 overflow-hidden bg-gray-100 flex items-center justify-center">
              <img 
                src={expandedMap} 
                alt="Expanded Map View" 
                className="max-w-full max-h-full w-auto h-auto object-contain"
              />
            </div>
            
            <div className="bg-white p-5 border-t border-gray-100 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                   <i className="fa-solid fa-map-location-dot text-indigo-600 text-sm"></i>
                </div>
                <span className="text-gray-700 font-bold tracking-tight">Intelligence Map Context</span>
              </div>
              <button 
                onClick={handleClose}
                className="px-8 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-black hover:bg-gray-800 transition-all shadow-lg active:scale-95"
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
