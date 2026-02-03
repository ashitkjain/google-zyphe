
import React, { useEffect, useRef, useState } from 'react';

interface Property3DMapProps {
    latitude: number;
    longitude: number;
    address: string;
}

// Google Maps 3D Custom Element types are handled via any casting in the component

const Property3DMap: React.FC<Property3DMapProps> = ({ latitude, longitude, address }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const isLoadedRef = useRef(false);
    const [error, setError] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<string>("");

    useEffect(() => {
        let timeoutId: any;
        isLoadedRef.current = false;
        setIsLoaded(false);
        setError(null);

        const initMap = async () => {
            setDebugInfo(`Loc: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);

            if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
                setError("Neural data missing: Latitude/Longitude not found.");
                return;
            }

            // Start a safety timeout
            timeoutId = setTimeout(() => {
                if (!isLoadedRef.current) {
                    console.error("[3D Map] Link Timeout reached.");
                    setError("Neural Link Timed Out. Likely 'Map Tiles API' is not enabled for this key, or your project is not authorized.");
                }
            }, 12000);

            try {
                // @ts-ignore
                if (!window.google || !window.google.maps || !window.google.maps.importLibrary) {
                    console.warn("[3D Map] Maps Runtime not found. Postponing...");
                    return;
                }

                // @ts-ignore
                const { Map3DElement } = await google.maps.importLibrary("maps3d");

                if (!containerRef.current) return;
                containerRef.current.innerHTML = '';

                const map3d = new Map3DElement({
                    center: { lat: latitude, lng: longitude, altitude: 300 },
                    tilt: 65,
                    heading: 0,
                    range: 600
                });

                containerRef.current.appendChild(map3d);
                mapRef.current = map3d;

                // Allow some time for tiles to start streaming
                setTimeout(() => {
                    isLoadedRef.current = true;
                    setIsLoaded(true);
                    clearTimeout(timeoutId);
                }, 2000);
            } catch (err) {
                console.error("[3D Map] Fail:", err);
                setError("Google Maps Library Error. Check console for details.");
                clearTimeout(timeoutId);
            }
        };

        // Delay start slightly to ensure DOM and Google script are ready
        const timer = setTimeout(initMap, 500);

        return () => {
            clearTimeout(timer);
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [latitude, longitude]);

    return (
        <div className="relative w-full h-[500px] rounded-3xl overflow-hidden shadow-2xl bg-slate-900 border border-slate-800">
            {!isLoaded && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-900/50 backdrop-blur-sm z-10">
                    <div className="animate-spin mb-4">
                        <i className="fa-solid fa-circle-notch text-3xl text-indigo-500"></i>
                    </div>
                    <span className="font-black text-[10px] uppercase tracking-[0.2em]">Initializing 3D Neural Engine...</span>
                    <span className="text-[9px] text-slate-600 mt-2 font-mono uppercase">{debugInfo}</span>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-rose-400 p-8 text-center bg-slate-900 z-10">
                    <i className="fa-solid fa-triangle-exclamation text-4xl mb-4"></i>
                    <p className="font-bold text-sm tracking-tight mb-2">Neural Link Failed</p>
                    <p className="text-xs text-slate-500 max-w-xs">{error}</p>
                </div>
            )}

            <div ref={containerRef} className="w-full h-full" />

            <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end pointer-events-none">
                <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 pointer-events-auto">
                    <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-0.5">Location Intelligence</div>
                    <div className="text-xs font-bold text-white max-w-[200px] md:max-w-md truncate">{address}</div>
                </div>

                <div className="flex gap-2 pointer-events-auto">
                    <button
                        onClick={() => {
                            window.location.reload();
                        }}
                        className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white flex items-center justify-center transition-all active:scale-95"
                        title="Hard Refresh"
                    >
                        <i className="fa-solid fa-sync"></i>
                    </button>
                    <button
                        onClick={() => {
                            if (mapRef.current) {
                                mapRef.current.heading += 45;
                            }
                        }}
                        className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white flex items-center justify-center transition-all active:scale-95"
                        title="Rotate"
                    >
                        <i className="fa-solid fa-rotate-right"></i>
                    </button>
                    <button
                        onClick={() => {
                            if (mapRef.current) {
                                mapRef.current.tilt = mapRef.current.tilt === 0 ? 65 : 0;
                            }
                        }}
                        className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white flex items-center justify-center transition-all active:scale-95"
                        title="Toggle Tilt"
                    >
                        <i className="fa-solid fa-cube"></i>
                    </button>
                </div>
            </div>

            <div className="absolute top-6 left-6">
                <div className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/30">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    Photorealistic 3D Active
                </div>
            </div>
        </div>
    );
};

export default Property3DMap;
