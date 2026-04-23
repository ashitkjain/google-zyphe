import React, { useState, useEffect, useCallback, useRef } from 'react';

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
  imageAnalysis?: Array<{
    image_id: string;
    analysis: string;
  }>;
}

const MAX_SIDEBAR_IMAGES = 7; // Thumbnails shown in the sidebar

const PropertyImages: React.FC<Props> = ({ images, loading, homeStatus, attribution, imageAnalysis }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxStripRef = useRef<HTMLDivElement>(null);

  const allImages = images ?? [];
  const totalCount = allImages.length;
  const displayImages = allImages.slice(0, MAX_SIDEBAR_IMAGES);
  const hiddenCount = totalCount - displayImages.length;

  useEffect(() => {
    setSelectedImage(displayImages[0] ?? null);
  }, [images]);

  // Keep thumbnail strip in sync with the active lightbox index
  useEffect(() => {
    if (!lightboxOpen || !lightboxStripRef.current) return;
    const strip = lightboxStripRef.current;
    const thumb = strip.children[lightboxIndex] as HTMLElement | undefined;
    thumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [lightboxIndex, lightboxOpen]);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(Math.max(0, Math.min(index, totalCount - 1)));
    setLightboxOpen(true);
  }, [totalCount]);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  const prevImage = useCallback(() =>
    setLightboxIndex(i => (i - 1 + totalCount) % totalCount), [totalCount]);

  const nextImage = useCallback(() =>
    setLightboxIndex(i => (i + 1) % totalCount), [totalCount]);

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevImage();
      else if (e.key === 'ArrowRight') nextImage();
      else if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen, prevImage, nextImage, closeLightbox]);

  // Helper to match image URLs robustly
  const getAnalysisForImage = (imageUrl: string | null) => {
    if (!imageUrl || !imageAnalysis) return null;
    
    const cleanUrl = (url: string) => url.split('?')[0].split('#')[0];
    const getFilename = (url: string) => {
      try {
        const decoded = decodeURIComponent(url);
        return decoded.split('/').pop()?.split('?')[0] || url;
      } catch {
        return url.split('/').pop()?.split('?')[0] || url;
      }
    };
    
    const targetClean = cleanUrl(imageUrl);
    const targetFile = getFilename(imageUrl);
    
    return imageAnalysis.find(a => {
      const analysisClean = cleanUrl(a.image_id);
      const analysisFile = getFilename(a.image_id);
      return analysisClean === targetClean || analysisFile === targetFile;
    });
  };

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

  const isOffMarket = totalCount === 0;
  const currentMainAnalysis = getAnalysisForImage(selectedImage || displayImages[0]);

  return (
    <>
      <div className="mb-2">
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
          <div className="flex flex-col md:flex-row md:items-start gap-3">
            {/* Main large image — click to open lightbox */}
            <div
              className="min-w-0 flex-1 rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-white group relative cursor-zoom-in self-start aspect-[4/3] md:aspect-auto"
              onClick={() => openLightbox(allImages.indexOf(selectedImage ?? allImages[0]))}
            >
              <img
                src={selectedImage || displayImages[0]}
                alt="Property Main View"
                className="w-full h-full object-contain transition-all duration-700 ease-in-out"
                loading="eager"
                decoding="async"
              />
              
              {/* Overlay Gradient (static but hidden) */}
              {currentMainAnalysis && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              )}

              {/* Expand hint */}
              <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm text-white text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <i className="fa-solid fa-expand text-[9px]" />
                All photos
              </div>

              {/* AI Description Tooltip (Main Image) - Simplified Animation */}
              {currentMainAnalysis && (
                <div className="absolute inset-x-0 bottom-0 p-6 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 ease-out pointer-events-none z-10">
                  <div className="flex items-start gap-3 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-2xl">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/40">
                      <i className="fa-solid fa-sparkles text-white text-xs" />
                    </div>
                    <p className="text-white text-[13px] leading-relaxed font-bold drop-shadow-md">
                      {currentMainAnalysis.analysis}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Thumbnail sidebar */}
            <div className="flex flex-col gap-2 w-full md:w-28 shrink-0">
              <div className="flex md:flex-col flex-row gap-2 w-full overflow-x-auto md:overflow-y-auto snap-x md:snap-y scroll-smooth">
                {displayImages.map((img, idx) => {
                  const isLast = idx === displayImages.length - 1 && hiddenCount > 0;
                  const thumbAnalysis = getAnalysisForImage(img);

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (isLast) {
                          openLightbox(MAX_SIDEBAR_IMAGES);
                        } else {
                          setSelectedImage(img);
                        }
                      }}
                      className={`relative flex-shrink-0 w-24 md:w-full h-16 md:h-20 rounded-xl overflow-hidden border-2 transition-all snap-start group ${selectedImage === img && !isLast
                        ? 'border-indigo-500 ring-2 ring-indigo-100 z-10'
                        : 'border-transparent hover:border-gray-200'
                        }`}
                    >
                      <img
                        src={img}
                        alt={`Thumbnail ${idx + 1}`}
                        className={`w-full h-full object-cover transition-transform duration-300 ${selectedImage === img ? 'scale-110' : 'group-hover:scale-110'
                          }`}
                        loading="lazy"
                        decoding="async"
                      />
                      {/* "+N more" overlay */}
                      {isLast && (
                        <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
                          <i className="fa-solid fa-images text-white/80 text-sm" />
                          <span className="text-white text-xs font-black">+{hiddenCount}</span>
                          <span className="text-white/60 text-[8px] font-semibold uppercase tracking-tight">more</span>
                        </div>
                      )}

                      {/* AI Description Tooltip (Thumbnail Overlay) - More robust */}
                      {!isLast && thumbAnalysis && (
                        <div className="absolute inset-0 bg-indigo-600/90 flex flex-col items-center justify-center p-2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                           <i className="fa-solid fa-sparkles text-white/40 text-[10px] mb-1" />
                           <p className="text-white text-[9px] font-bold leading-tight text-center line-clamp-4">
                            {thumbAnalysis.analysis}
                          </p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Full-screen Lightbox ────────────────────────────────────────────── */}
      {lightboxOpen && totalCount > 0 && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex flex-col"
          onClick={closeLightbox}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            onClick={e => e.stopPropagation()}
          >
            <span className="text-white/60 text-sm font-bold">
              {lightboxIndex + 1} / {totalCount}
            </span>
            <button
              onClick={closeLightbox}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
              title="Close (Esc)"
            >
              <i className="fa-solid fa-xmark text-sm" />
            </button>
          </div>

          {/* Main image area */}
          <div
            className="flex-1 flex items-center justify-center relative min-h-0 px-16"
            onClick={e => e.stopPropagation()}
          >
            <img
              key={lightboxIndex}
              src={allImages[lightboxIndex]}
              alt={`Photo ${lightboxIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-2xl select-none"
              draggable={false}
            />

            {/* AI Description (Lightbox Overlay) */}
            {(() => {
                const lightboxAnalysis = getAnalysisForImage(allImages[lightboxIndex]);
                if (!lightboxAnalysis) return null;
                return (
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 pointer-events-none">
                    <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                          <i className="fa-solid fa-sparkles text-indigo-400 text-[11px]" />
                        </div>
                        <p className="text-white/90 text-[13px] leading-relaxed font-semibold">
                          {lightboxAnalysis.analysis}
                        </p>
                      </div>
                    </div>
                  </div>
                );
            })()}

            {/* Prev */}
            {totalCount > 1 && (
              <button
                onClick={prevImage}
                className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all backdrop-blur-sm"
                title="Previous (←)"
              >
                <i className="fa-solid fa-chevron-left" />
              </button>
            )}

            {/* Next */}
            {totalCount > 1 && (
              <button
                onClick={nextImage}
                className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all backdrop-blur-sm"
                title="Next (→)"
              >
                <i className="fa-solid fa-chevron-right" />
              </button>
            )}
          </div>

          {/* Thumbnail strip */}
          <div
            ref={lightboxStripRef}
            className="flex gap-2 px-6 py-4 overflow-x-auto flex-shrink-0 scroll-smooth"
            onClick={e => e.stopPropagation()}
            style={{ scrollbarWidth: 'none' }}
          >
            {allImages.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setLightboxIndex(idx)}
                className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${idx === lightboxIndex
                  ? 'border-indigo-400 ring-2 ring-indigo-400/30 scale-105'
                  : 'border-white/10 hover:border-white/40 opacity-60 hover:opacity-100'
                  }`}
              >
                <img
                  src={img}
                  alt={`Thumb ${idx + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>

          {/* Keyboard hint */}
          <div className="text-center pb-3 text-white/20 text-[10px] font-medium flex-shrink-0">
            ← → to navigate &nbsp;·&nbsp; Esc to close
          </div>
        </div>
      )}
    </>
  );
};

export default PropertyImages;
