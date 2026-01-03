
import React from 'react';

interface Props {
  mapZoomIn?: string;
  mapZoomOut?: string;
}

const PropertyMaps: React.FC<Props> = ({ mapZoomIn, mapZoomOut }) => {
  if (!mapZoomIn && !mapZoomOut) return null;

  return (
    <div className="bg-white border-x border-gray-200 px-8 py-8">
      <div className="flex items-center text-lg font-bold text-gray-800 mb-6">
        <i className="fa-solid fa-map-location-dot text-gray-400 mr-3"></i>
        Location & Surrounding Area
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm aspect-square bg-gray-50 group">
          {mapZoomOut ? (
            <img 
              src={mapZoomOut} 
              alt="Neighborhood Map View" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 italic text-base">Map not available</div>
          )}
        </div>

        <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm aspect-square bg-gray-50 group">
          {mapZoomIn ? (
            <img 
              src={mapZoomIn} 
              alt="Property Map View" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 italic text-base">Map not available</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyMaps;
