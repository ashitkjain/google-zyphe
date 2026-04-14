
import React, { useState, useEffect } from 'react';
import { PropertyData } from '../../types';

interface Props {
    data: PropertyData;
    onRefresh?: () => void;
    refreshing?: boolean;
}

const MAPS_API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

/** Compute bearing from point A to point B (in degrees 0-360) */
function computeHeading(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
    const lat1 = fromLat * (Math.PI / 180);
    const lat2 = toLat * (Math.PI / 180);
    const dLon = (toLng - fromLng) * (Math.PI / 180);
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return Math.round(((Math.atan2(y, x) * (180 / Math.PI)) + 360) % 360);
}

const StreetViewAnalysisSection: React.FC<Props> = ({ data, onRefresh, refreshing }) => {
    const analysis = data.streetViewAnalysis;
    const [showStreetView, setShowStreetView] = useState(false);
    const [svHeading, setSvHeading] = useState<number | null>(null);

    if (!analysis || analysis.isImageryAvailable === false) return null;

    // Belt-and-suspenders: if all key fields are empty the AI saw a blank/error image
    const hasContent = analysis.privacyRating || analysis.curbAppealScore || analysis.neighborhoodVibe;
    if (!hasContent) return null;

    const coords = data.coordinates;
    const address = data.address;

    // Fetch Street View metadata to compute correct heading when modal opens
    useEffect(() => {
        if (!showStreetView || !coords) return;
        let cancelled = false;
        (async () => {
            try {
                const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${coords.latitude},${coords.longitude}&radius=100&source=outdoor&key=${MAPS_API_KEY}`;
                const meta = await fetch(metaUrl).then(r => r.json());
                if (cancelled || meta.status !== 'OK') return;

                // If API provides heading directly, use it
                if (meta.heading != null) {
                    setSvHeading(Math.round(meta.heading));
                    return;
                }

                // Otherwise compute bearing: panorama position → property position
                const pano = meta.location;
                if (pano?.lat != null && pano?.lng != null) {
                    const heading = computeHeading(pano.lat, pano.lng, coords.latitude, coords.longitude);
                    setSvHeading(heading);
                }
            } catch (e) {
                console.warn('[StreetView] Failed to fetch heading metadata:', e);
            }
        })();
        return () => { cancelled = true; };
    }, [showStreetView, coords]);

    const getScoreColor = (score: number) => {
        if (score >= 8) return 'text-emerald-500';
        if (score >= 5) return 'text-amber-500';
        return 'text-rose-500';
    };

    const getScoreBg = (score: number) => {
        if (score >= 8) return 'bg-emerald-50';
        if (score >= 5) return 'bg-amber-50';
        return 'bg-rose-50';
    };

    const InfoStat = ({ icon, label, value, colorClass, bgClass, subValue }: any) => (
        <div className={`p-4 rounded-[1.5rem] border border-slate-100 flex items-center gap-4 ${bgClass || 'bg-slate-50/50'}`}>
            <div className={`w-10 h-10 rounded-xl bg-white flex flex-col items-center justify-center shadow-sm ${colorClass || 'text-slate-600'} flex-shrink-0`}>
                <i className={`fa-solid ${icon} text-[14px]`}></i>
            </div>
            <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</span>
                <div className="text-[13px] font-black text-slate-800 leading-snug">
                    {value}
                </div>
                {subValue && <span className="text-[10px] text-slate-400 font-medium leading-snug">{subValue}</span>}
            </div>
        </div>
    );

    return (
        <div className="bg-white border-x border-slate-100 scroll-mt-24">
            {/* Main Section Header — Standardized Style */}
            <div className="px-5 py-3 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <i className="fa-solid fa-eye text-indigo-500 text-[12px]" />
                </div>
                <h3 className="text-[18px] font-black text-slate-900 tracking-tight leading-tight">
                    Eyes on the Street
                </h3>
            </div>

            <div className="p-4 space-y-4">
                {/* Visual Side — Almost square */}
                {analysis.imageUrl && (
                    <div
                        className="w-4/5 mx-auto h-[375px] rounded-2xl overflow-hidden border border-slate-100 shadow-inner group relative cursor-pointer"
                        onClick={() => coords && setShowStreetView(true)}
                    >
                        <img
                            src={analysis.imageUrl}
                            alt="Property Street View"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2s]"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent"></div>
                        <div className="absolute bottom-6 left-6 flex flex-col gap-2">
                            <div className="px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-white text-[9px] font-black uppercase tracking-widest border border-white/30 w-fit">
                                <i className="fa-solid fa-street-view mr-1.5"></i> Google Street View
                            </div>
                        </div>
                        {coords && (
                            <div className="absolute top-3 right-3 px-3 py-1.5 bg-white/90 backdrop-blur-md rounded-full text-slate-700 text-[9px] font-black uppercase tracking-widest border border-slate-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                <i className="fa-solid fa-up-right-and-down-left-from-center mr-1.5"></i> Explore 360°
                            </div>
                        )}
                    </div>
                )}

                {showStreetView && coords && (
                    <div
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-6 md:p-10 animate-in fade-in duration-300"
                        onClick={() => setShowStreetView(false)}
                    >
                        {/* Backdrop — pointer-events-none prevents mouse-leave flicker */}
                        <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl pointer-events-none" />
                        <div
                            className="relative w-full max-w-5xl bg-white rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col"
                            style={{ aspectRatio: '16/9', maxHeight: '85vh' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setShowStreetView(false)}
                                className="absolute top-4 right-4 z-20 w-10 h-10 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-all border border-slate-100 active:scale-95"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>

                            <div className="flex-1 overflow-hidden">
                                <iframe
                                    src={`https://www.google.com/maps/embed/v1/streetview?key=${MAPS_API_KEY}&location=${coords!.latitude},${coords!.longitude}&heading=${svHeading ?? 0}&pitch=0&fov=90&source=outdoor`}
                                    width="100%"
                                    height="100%"
                                    style={{ border: 0, display: 'block' }}
                                    allowFullScreen
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                />
                            </div>

                            <div className="bg-white px-5 py-3 border-t border-slate-100 flex justify-between items-center flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                                        <i className="fa-solid fa-street-view text-indigo-600 text-sm"></i>
                                    </div>
                                    <div>
                                        <div className="text-slate-900 font-black text-sm tracking-tight">Interactive Street View</div>
                                        <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Drag to look around · Scroll to zoom · Click arrows to move</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowStreetView(false)}
                                    className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Information — AI label inside, larger text */}
                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                    <div className="p-4">

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
                            {/* Analysis items with larger text size */}
                            {analysis.privacyRating && (
                                <div className="flex items-start gap-2">
                                    <i className="fa-solid fa-shield-halved text-[11px] text-indigo-500 mt-1"></i>
                                    <div className="text-[13px] font-medium leading-relaxed"><strong className="text-slate-900">Privacy:</strong> <span className="text-slate-600">{analysis.privacyRating}</span></div>
                                </div>
                            )}
                            {analysis.parkingLogistics && (
                                <div className="flex items-start gap-2">
                                    <i className="fa-solid fa-car-side text-[11px] text-blue-500 mt-1"></i>
                                    <div className="text-[13px] font-medium leading-relaxed"><strong className="text-slate-900">Parking:</strong> <span className="text-slate-600">{analysis.parkingLogistics}</span></div>
                                </div>
                            )}
                            {analysis.utilityAesthetic && (
                                <div className="flex items-start gap-2">
                                    <i className="fa-solid fa-plug-circle-bolt text-[11px] text-amber-500 mt-1"></i>
                                    <div className="text-[13px] font-medium leading-relaxed"><strong className="text-slate-900">Utilities:</strong> <span className="text-slate-600">{analysis.utilityAesthetic}</span></div>
                                </div>
                            )}
                            {analysis.neighborhoodVibe && (
                                <div className="flex items-start gap-2">
                                    <i className="fa-solid fa-tree-city text-[11px] text-slate-500 mt-1"></i>
                                    <div className="text-[13px] font-medium leading-relaxed"><strong className="text-slate-900">Vibe:</strong> <span className="text-slate-600">{analysis.neighborhoodVibe}</span></div>
                                </div>
                            )}
                            {analysis.familySafety && (
                                <div className="flex items-start gap-2">
                                    <i className="fa-solid fa-children text-[11px] text-emerald-500 mt-1"></i>
                                    <div className="text-[13px] font-medium leading-relaxed"><strong className="text-slate-900">Safety:</strong> <span className="text-slate-600">{analysis.familySafety}</span></div>
                                </div>
                            )}
                            {analysis.solarObstructions && (
                                <div className="flex items-start gap-2">
                                    <i className="fa-solid fa-cloud-sun text-[11px] text-orange-500 mt-1"></i>
                                    <div className="text-[13px] font-medium leading-relaxed"><strong className="text-slate-900">Solar:</strong> <span className="text-slate-600">{analysis.solarObstructions}</span></div>
                                </div>
                            )}
                            {analysis.neighborCondition && (
                                <div className="flex items-start gap-2">
                                    <i className="fa-solid fa-house-chimney-window text-[11px] text-sky-500 mt-1"></i>
                                    <div className="text-[13px] font-medium leading-relaxed"><strong className="text-slate-900">Streetscape:</strong> <span className="text-slate-600">{analysis.neighborCondition}</span></div>
                                </div>
                            )}

                            {analysis.maintenanceRisks && analysis.maintenanceRisks.length > 0 && (
                                <div className="flex items-start gap-2">
                                    <i className="fa-solid fa-toolbox text-[11px] text-rose-500 mt-1"></i>
                                    <div className="text-[13px] text-slate-900 font-medium leading-relaxed">
                                        <strong>Risks:</strong> {analysis.maintenanceRisks.join(' · ')}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StreetViewAnalysisSection;
