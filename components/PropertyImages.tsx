
import React, { useState, useEffect } from 'react';

interface Props {
  images?: string[];
  loading: boolean;
}

const PropertyImages: React.FC<Props> = ({ images, loading }) => {
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

  if (!images || images.length === 0) return null;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-5 px-1">
        <h3 className="font-bold text-gray-800 flex items-center text-lg">
          <i className="fa-solid fa-images text-gray-400 mr-3"></i>
          Property Gallery
        </h3>
        <span className="text-sm font-bold text-gray-500 bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200 shadow-sm">
          {images.length} Photos
        </span>
      </div>

      <div className="flex flex-col md:flex-row gap-5 h-auto md:h-[400px]">
        {/* Main Large Image */}
        <div className="flex-1 rounded-3xl overflow-hidden shadow-xl border border-gray-100 bg-gray-900 group relative aspect-video md:aspect-auto">
          <img 
            src={selectedImage || images[0]} 
            alt="Property Main View" 
            className="w-full h-full object-cover transition-all duration-700 ease-in-out group-hover:scale-[1.02]"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-8">
             <p className="text-white text-base font-bold drop-shadow-md">High-Resolution Property Preview</p>
          </div>
          
          {/* Mobile Overlay Dots */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 md:hidden">
            {images.slice(0, 8).map((_, i) => (
              <div 
                key={i} 
                className={`w-2 h-2 rounded-full transition-all ${images[i] === selectedImage ? 'bg-white w-5' : 'bg-white/50'}`}
              ></div>
            ))}
          </div>
        </div>

        {/* Vertical Thumbnail List */}
        <div className="flex md:flex-col flex-row gap-4 w-full md:w-32 overflow-x-auto md:overflow-y-auto no-scrollbar snap-x md:snap-y scroll-smooth">
          {images.map((img, idx) => (
            <button 
              key={idx}
              onClick={() => setSelectedImage(img)}
              className={`relative flex-shrink-0 w-24 md:w-full h-20 md:h-24 rounded-xl overflow-hidden border-2 transition-all snap-start group ${
                selectedImage === img 
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
              {selectedImage !== img && (
                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default PropertyImages;
