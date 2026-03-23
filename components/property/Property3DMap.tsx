
import React, { useEffect, useRef, useState } from 'react';

interface Props {
    latitude: number;
    longitude: number;
    address?: string;
}

const CESIUM_VERSION = '1.122';
const CESIUM_BASE = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium`;
const GOOGLE_MAPS_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

/** Generates a data URL for an indigo map pin SVG used as the Cesium billboard. */
function buildPinSVG(): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
      <path fill="#4f46e5" stroke="#312e81" stroke-width="1.5"
        d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30S36 31.5 36 18C36 8.06 27.94 0 18 0z"/>
      <circle cx="18" cy="18" r="8" fill="white"/>
      <circle cx="18" cy="18" r="5" fill="#4f46e5"/>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}


/** Dynamically load a CSS link tag (idempotent) */
function loadCSS(href: string, id: string) {
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
}

/** Dynamically load a script tag (idempotent, returns promise) */
function loadScript(src: string, id: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (document.getElementById(id)) { resolve(); return; }
        const script = document.createElement('script');
        script.id = id;
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
    });
}

const Property3DMap: React.FC<Props> = ({ latitude, longitude, address }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<any>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingStep, setLoadingStep] = useState('Initializing...');

    useEffect(() => {
        let isCancelled = false;

        const init = async () => {
            try {
                if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
                    setError('Invalid coordinates — latitude/longitude not found.');
                    return;
                }

                // 1. Load Cesium assets from CDN
                setLoadingStep('Loading 3D Engine...');
                loadCSS(`${CESIUM_BASE}/Widgets/widgets.css`, 'cesium-css');
                await loadScript(`${CESIUM_BASE}/Cesium.js`, 'cesium-js');

                if (isCancelled) return;

                const Cesium = (window as any).Cesium;
                if (!Cesium) {
                    setError('Cesium failed to load from CDN.');
                    return;
                }

                // Use a blank Ion token — we're using Google tiles directly, not Cesium Ion
                Cesium.Ion.defaultAccessToken = '';

                if (isCancelled || !containerRef.current) return;
                containerRef.current.innerHTML = '';

                setLoadingStep('Initializing 3D Viewer...');

                // 2. Create Cesium Viewer with minimal UI — disable all Ion-dependent assets
                const viewer = new Cesium.Viewer(containerRef.current, {
                    baseLayerPicker: false,
                    geocoder: false,
                    homeButton: false,
                    sceneModePicker: false,
                    navigationHelpButton: false,
                    animation: false,
                    timeline: false,
                    fullscreenButton: false,
                    vrButton: false,
                    infoBox: false,
                    selectionIndicator: false,
                    skyBox: false,           // prevents the green/blue sky before tiles load
                    skyAtmosphere: false,    // same
                    // Prevent any Cesium Ion asset loading (no Ion token needed)
                    imageryProvider: false,
                    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
                    creditContainer: Object.assign(document.createElement('div'), {
                        style: 'display:none'
                    }),
                });

                // Dark background so the pre-tile gap is slate, not green
                viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0f172a');

                // Hide the globe entirely — we use Google 3D tiles, not Cesium's globe
                viewer.scene.globe.show = false;

                viewerRef.current = viewer;

                // 3. Add Google Photorealistic 3D Tiles
                // NOTE: Cesium 1.122 takes the key as a direct string argument, not { key }
                setLoadingStep('Streaming Photorealistic Tiles...');
                const tileset = await Cesium.createGooglePhotorealistic3DTileset(GOOGLE_MAPS_KEY);

                if (isCancelled) { viewer.destroy(); return; }

                viewer.scene.primitives.add(tileset);

                // 4. Property marker pin + label
                // Use HeightReference.NONE + explicit altitude — CLAMP_TO_GROUND requires globe
                viewer.entities.add({
                    position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 80),
                    billboard: {
                        image: buildPinSVG(),
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        heightReference: Cesium.HeightReference.NONE,
                        scale: 1.2,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    },
                    label: {
                        text: address || 'Property',
                        font: '700 11px sans-serif',
                        fillColor: Cesium.Color.WHITE,
                        outlineColor: Cesium.Color.fromCssColorString('#312e81'),
                        outlineWidth: 3,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -52),
                        heightReference: Cesium.HeightReference.NONE,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        showBackground: true,
                        backgroundColor: Cesium.Color.fromCssColorString('#312e81').withAlpha(0.85),
                        backgroundPadding: new Cesium.Cartesian2(10, 6),
                    },
                });

                // 5. Point camera AT the property (lookAt keeps it centered regardless of pitch)
                viewer.resize();
                const target = Cesium.Cartesian3.fromDegrees(longitude, latitude, 80);
                viewer.camera.lookAt(
                    target,
                    new Cesium.HeadingPitchRange(
                        Cesium.Math.toRadians(0),    // heading (north)
                        Cesium.Math.toRadians(-45),  // pitch (-90 = straight down)
                        400                           // distance from target in metres
                    )
                );
                // Allow user to orbit freely after initial lookAt
                viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

                // 6. Keep loading overlay visible until the first batch of tiles finishes
                //    rendering — this prevents the brief green flash between "viewer ready"
                //    and "tiles actually drawn".
                if (!isCancelled) {
                    const onTilesDone = () => {
                        if (!isCancelled) setIsLoaded(true);
                        tileset.allTilesLoaded.removeEventListener(onTilesDone);
                    };
                    // allTilesLoaded fires once per frame when queue is empty.
                    // Use a one-shot render listener as a fallback for fast tile loads too.
                    tileset.allTilesLoaded.addEventListener(onTilesDone);

                    // Safety fallback: show after 4 s regardless
                    setTimeout(() => {
                        if (!isCancelled) setIsLoaded(true);
                    }, 4000);
                }



            } catch (err: any) {
                if (isCancelled) return;
                console.error('[3D Map] Cesium error:', err);
                // Cesium Ion auth errors are confusing — give a cleaner message
                const msg = err?.message || 'Unknown error';
                const isIonError = msg.includes('ion') || msg.includes('401') || msg.includes('403');
                setError(
                    isIonError
                        ? 'Google Photorealistic Tiles API key issue. Ensure Map Tiles API is enabled in Google Cloud Console.'
                        : `3D Engine Error: ${msg}`
                );
            }
        };

        init();

        return () => {
            isCancelled = true;
            if (viewerRef.current && !viewerRef.current.isDestroyed()) {
                viewerRef.current.destroy();
                viewerRef.current = null;
            }
        };
    }, [latitude, longitude]);

    return (
        <div
            className="relative w-full h-full shadow-2xl bg-slate-900 border border-slate-800"
            style={{ borderRadius: '1.5rem', clipPath: 'inset(0% round 1.5rem)' }}
        >

            {/* Loading overlay */}
            {!isLoaded && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-900/80 backdrop-blur-sm z-10 pointer-events-none">
                    <div className="animate-spin mb-4">
                        <i className="fa-solid fa-circle-notch text-3xl text-indigo-400"></i>
                    </div>
                    <span className="font-black text-[10px] uppercase tracking-[0.25em] text-white/80">
                        {loadingStep}
                    </span>
                    <span className="mt-3 text-[9px] font-mono text-slate-600 uppercase tracking-widest">
                        {latitude.toFixed(4)}, {longitude.toFixed(5)}
                    </span>
                </div>
            )}

            {/* Error state */}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-rose-400 p-8 text-center bg-slate-900 z-10">
                    <i className="fa-solid fa-triangle-exclamation text-4xl mb-4"></i>
                    <p className="font-bold text-sm tracking-tight mb-2">Neural Link Failed</p>
                    <p className="text-xs text-slate-500 max-w-xs mb-4">{error}</p>
                    <div className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                            LOC: {latitude.toFixed(4)}, {longitude.toFixed(5)}
                        </span>
                    </div>
                </div>
            )}

            {/* Cesium mounts here */}
            <div ref={containerRef} className="w-full h-full" />
        </div>
    );
};

export default Property3DMap;
