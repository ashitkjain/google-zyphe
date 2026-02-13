
import React, { useState, useEffect } from 'react';

interface Props {
  images?: string[];
  loading: boolean;
  homeStatus?: string;
  attribution?: {
    listingAgentName?: string;
    listingAgentNumber?: string;
    brokerageName?: string;
    mlsName?: string;
    mlsId?: string;
  };
}

const PropertyImages: React.FC<Props> = ({ images, loading, homeStatus, attribution }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (images && images.length > 0) {
      setSelectedImage(images[0]);
    } else {
      setSelectedImage(null);
    }
  }, [images]);

  if (loading) {
    return (
      <div className="flex flex-col md:flex-row gap-5 h-[350px] md:h-[400px] mb-10">
        <div className="flex-1 bg-gray-200 animate-pulse rounded-2xl"></div>
        <div className="hidden md:flex flex-col gap-4 w-36 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-xl flex-shrink-0"></div>
          ))}
        </div>
      </div>
    );
  }

  const isOffMarket = !images || images.length === 0;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-5 px-1">
        <h3 className="font-bold text-gray-800 flex items-center text-lg">
          <i className="fa-solid fa-images text-gray-400 mr-3"></i>
          Property Gallery
        </h3>
        <span className={`text-sm font-bold px-4 py-1.5 rounded-full border shadow-sm ${isOffMarket ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-gray-100 text-gray-500 border-gray-200'
          }`}>
          {isOffMarket ? 'Data Restricted' : `${images.length} Photos`}
        </span>
      </div>

      {isOffMarket ? (
        <div className="bg-gray-100 rounded-[2.5rem] border-2 border-dashed border-gray-200 h-[350px] md:h-[400px] flex flex-col items-center justify-center text-center px-10">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-lg mb-6">
            <i className="fa-solid fa-eye-slash text-gray-300 text-3xl"></i>
          </div>
          <h4 className="text-xl font-black text-gray-900 mb-2">Off-Market Data Restriction</h4>
          <p className="text-gray-500 max-w-md text-sm leading-relaxed">
            Photographs are withheld for this property because it is not currently actively listed for sale.
            <br /><span className="font-bold text-indigo-600">Zyphe AI will instead use the legal description and specifications for analysis.</span>
          </p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-5 h-auto md:h-[400px]">
          {/* Main Large Image */}
          <div className="flex-1 rounded-3xl overflow-hidden shadow-xl border border-gray-100 bg-gray-900 group relative aspect-video md:aspect-auto">
            <img
              src={selectedImage || images[0]}
              alt="Property Main View"
              className="w-full h-full object-cover transition-all duration-700 ease-in-out group-hover:scale-[1.02]"
              loading="eager"
            />
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 md:hidden">
              {images.slice(0, 8).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${images[i] === selectedImage ? 'bg-white w-5' : 'bg-white/50'}`}
                ></div>
              ))}
            </div>
          </div>

          {/* Thumbnails */}
          <div className="flex md:flex-col flex-row gap-4 w-full md:w-32 overflow-x-auto md:overflow-y-auto snap-x md:snap-y scroll-smooth">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImage(img)}
                className={`relative flex-shrink-0 w-24 md:w-full h-20 md:h-24 rounded-xl overflow-hidden border-2 transition-all snap-start group ${selectedImage === img
                  ? 'border-indigo-500 ring-2 ring-indigo-100 z-10'
                  : 'border-transparent hover:border-gray-300'
                  }`}
              >
                <img
                  src={img}
                  alt={`Thumbnail ${idx + 1}`}
                  className={`w-full h-full object-cover transition-transform duration-300 ${selectedImage === img ? 'scale-110' : 'group-hover:scale-110'}`}
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {images && images.length > 0 && attribution && (attribution.listingAgentName || attribution.brokerageName) && (
        <div className="mt-4 px-2 py-3 border-t border-slate-50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-circle-info text-[10px] text-slate-300"></i>
            <p className="text-[10px] text-slate-400 font-medium">
              Listing provided courtesy of <span className="font-bold text-slate-500">{attribution.listingAgentName || 'Listing Agent'}</span>
              {attribution.brokerageName && <> at <span className="font-bold text-slate-500">{attribution.brokerageName}</span></>}
            </p>
          </div>
          {attribution.mlsName && (
            <p className="text-[9px] text-slate-300 font-bold uppercase tracking-wider">
              {attribution.mlsName} {attribution.mlsId && `#${attribution.mlsId}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default PropertyImages;
