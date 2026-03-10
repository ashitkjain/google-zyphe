import React from 'react';
import { PropertyData } from '../../types';

interface StaticParcelMapProps {
    data: PropertyData;
    parcelPolygon?: [number, number][];
    className?: string;
}

const StaticParcelMap: React.FC<StaticParcelMapProps> = ({ data, parcelPolygon, className = "" }) => {
    if (!data.mapZoomIn) return null;

    return (
        <div className={`bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden h-full group relative ${className}`}>
            <img
                src={data.mapZoomIn}
                alt="Property Map View"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
            />
            {parcelPolygon && parcelPolygon.length > 3 && data.coordinates && (() => {
                const zoom = 20;
                const mapW = 2048;
                const mapH = 2048;
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
            })()}
            <div className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest text-slate-500 shadow-sm border border-slate-100">
                Property · Parcel
            </div>
        </div>
    );
};

export default StaticParcelMap;
