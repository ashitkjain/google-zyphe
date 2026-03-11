import React, { useState } from 'react';
import { PropertyData } from '../../types';

interface StaticParcelMapProps {
    data: PropertyData;
    parcelPolygon?: [number, number][];
    className?: string;
}

const StaticParcelMap: React.FC<StaticParcelMapProps> = ({ data, parcelPolygon, className = "" }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!data.mapZoomIn) return null;

    const renderParcelOverlay = (mapW: number, mapH: number) => {
        if (!parcelPolygon || parcelPolygon.length <= 3 || !data.coordinates) return null;
        const zoom = 20;
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
    };

    return (
        <>
            <div
                className={`bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden h-full group relative cursor-pointer ${className}`}
                onClick={() => setIsExpanded(true)}
            >
                <img
                    src={data.mapZoomIn}
                    alt="Property Map View"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                />
                {renderParcelOverlay(2048, 2048)}
                <div className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest text-slate-500 shadow-sm border border-slate-100">
                    Property · Parcel
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                        <i className="fa-solid fa-expand text-slate-700 text-sm"></i>
                    </div>
                </div>
            </div>

            {/* Expanded Map Overlay */}
            {isExpanded && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300"
                    onClick={() => setIsExpanded(false)}
                >
                    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl"></div>
                    <div
                        className="relative max-w-5xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col"
                        style={{ maxHeight: '90vh' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setIsExpanded(false)}
                            className="absolute top-4 right-4 z-20 w-10 h-10 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-all border border-slate-100 active:scale-95"
                        >
                            <i className="fa-solid fa-xmark text-lg"></i>
                        </button>

                        <div className="flex-1 overflow-hidden bg-slate-50 flex items-center justify-center relative">
                            <img
                                src={data.mapZoomIn}
                                alt="Expanded Property Map"
                                className="max-w-full max-h-[75vh] w-auto h-auto object-contain"
                            />
                            {renderParcelOverlay(2048, 2048)}
                        </div>

                        <div className="bg-white px-6 py-4 border-t border-slate-100 flex justify-between items-center flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                                    <i className="fa-solid fa-map-location-dot text-indigo-600 text-sm"></i>
                                </div>
                                <div>
                                    <div className="text-slate-900 font-black text-sm tracking-tight">Property · Parcel Map</div>
                                    <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{data.address}</div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default StaticParcelMap;
