
import React from 'react';

interface Props {
  mapZoomIn?: string;
  mapZoomOut?: string;
}

const PropertyMaps: React.FC<Props> = ({ mapZoomIn, mapZoomOut }) => {
  if (!mapZoomIn && !mapZoomOut) return null;

  return (
    <div className="bg-white border-x border-gray-200 px-8 py-6">
      <div className="flex items-center text-base font-bold text-gray-700 mb-4">
        <i className="fa-solid fa-map-location-dot text-gray-400 mr-3"></i>
        Location Context
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm h-48 md:h-56 bg-gray-50 group">
          {mapZoomOut ? (
            <img 
              src={mapZoomOut} 
              alt="Neighborhood Map View" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 italic text-sm">Neighborhood map not available</div>
          )}
        </div>

        <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm h-48 md:h-56 bg-gray-50 group">
          {mapZoomIn ? (
            <img 
              src={mapZoomIn} 
              alt="Property Map View" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 italic text-sm">Property map not available</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyMaps;
