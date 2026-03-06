import React, { useState, useEffect } from 'react';
import { PropertyData } from '../../types';

/**
 * ParcelValidationCard — Self-contained component for the Explore page.
 *
 * On mount:
 * 1. Checks if property already has cached parcelValidation
 * 2. If not, checks for cached polygon; if missing, fetches from ArcGIS
 * 3. Runs the deterministic validation engine
 * 4. Caches both polygon + validation result to Firestore (properties collection)
 */

interface ValidationFlag {
    check: string;
    severity: 'info' | 'warning' | 'alert';
    listed: string;
    measured: string;
    delta: string;
    finding: string;
}

interface ParcelValidationCardProps {
    propertyData: PropertyData;
}



const OPPOSITE_DIR: Record<string, string> = {
    N: 'S', NE: 'SW', E: 'W', SE: 'NW',
    S: 'N', SW: 'NE', W: 'E', NW: 'SE',
};

const ParcelValidationCard: React.FC<ParcelValidationCardProps> = ({ propertyData }) => {
    const [flags, setFlags] = useState<ValidationFlag[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [arcgisArea, setArcgisArea] = useState<number | null>(null);
    const [apn, setApn] = useState<string | null>(null);
    const [countyName, setCountyName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const zpid = propertyData?.zpid;
    const lat = propertyData?.coordinates?.latitude;
    const lon = propertyData?.coordinates?.longitude;

    useEffect(() => {
        if (!zpid || !lat || !lon) return;

        let cancelled = false;
        const run = async () => {
            setLoading(true);
            setError(null);

            const { doc, getDoc, setDoc } = await import('firebase/firestore');
            const { db } = await import('../../services/firebase/config');

            try {
                // ── Step 1: Check for cached validation ──
                const propSnap = await getDoc(doc(db, 'properties', String(zpid)));
                const propData = propSnap.exists() ? propSnap.data() : null;

                if (propData?.parcelValidation?.flags?.length > 0 && propData?.parcelValidation?.cachedAt) {
                    if (!cancelled) {
                        setFlags(propData.parcelValidation.flags);
                        setArcgisArea(propData.parcelAreaSqft || null);
                        setApn(propData.parcelApn || null);
                        setLoading(false);
                    }
                    return;
                }

                // ── Step 2: Get polygon (cached or fresh from ArcGIS) ──
                let polygon: [number, number][] | null = null;
                let areaSqft: number | null = null;
                let parcelApn: string | null = null;

                if (propData?.parcelPolygon?.length > 3) {
                    const { firestoreToPolygon } = await import('../../services/arcgis/countyParcels');
                    polygon = firestoreToPolygon(propData.parcelPolygon);
                    areaSqft = propData.parcelAreaSqft || null;
                    parcelApn = propData.parcelApn || null;
                } else {
                    // Also check sold_or_unlisted_properties
                    try {
                        const soldSnap = await getDoc(doc(db, 'sold_or_unlisted_properties', String(zpid)));
                        if (soldSnap.exists()) {
                            const soldData = soldSnap.data();
                            if (soldData?.parcelPolygon?.length > 3) {
                                const { firestoreToPolygon } = await import('../../services/arcgis/countyParcels');
                                polygon = firestoreToPolygon(soldData.parcelPolygon);
                                areaSqft = soldData.parcelAreaSqft || null;
                                parcelApn = soldData.parcelApn || null;
                            }
                        }
                    } catch { }

                    // Fetch from ArcGIS if not cached anywhere (auto-routes to correct county)
                    if (!polygon) {
                        try {
                            const { fetchParcelFromCounty, polygonToFirestore } = await import('../../services/arcgis/countyParcels');
                            const result = await fetchParcelFromCounty(lat, lon);

                            if (result) {
                                polygon = result.polygon;
                                areaSqft = result.areaSqft;
                                parcelApn = result.apn;
                                setCountyName(result.county);

                                // Cache polygon to properties doc
                                await setDoc(doc(db, 'properties', String(zpid)), {
                                    parcelPolygon: polygonToFirestore(polygon),
                                    parcelApn: parcelApn,
                                    parcelAreaSqft: areaSqft,
                                    parcelCounty: result.county,
                                    parcelCachedAt: new Date().toISOString(),
                                }, { merge: true });
                            }
                        } catch (e: any) {
                            console.warn('[ParcelValidation] ArcGIS fetch failed:', e.message);
                        }
                    }
                }

                if (cancelled) return;
                setArcgisArea(areaSqft);
                setApn(parcelApn);

                // ── Step 3: Get slope data from cached analysis or sampleSlope ──
                // Check if we have slope data from a previous land utility run
                let slopePercent = propData?.slopePercent ?? null;
                let slopeCategory = propData?.slopeCategory ?? null;
                let uphillDir = propData?.uphillDir ?? null;

                // If no slope data cached, do a quick scout
                if (slopePercent == null && lat && lon) {
                    try {
                        const DEG_LAT_PER_FT = 1 / 364000;
                        const cosLat = Math.cos(lat * Math.PI / 180);
                        const DEG_LON_PER_FT = 1 / (364000 * cosLat);

                        const DIRECTIONS = [
                            { name: 'N', dLat: DEG_LAT_PER_FT, dLon: 0 },
                            { name: 'NE', dLat: DEG_LAT_PER_FT * 0.707, dLon: DEG_LON_PER_FT * 0.707 },
                            { name: 'E', dLat: 0, dLon: DEG_LON_PER_FT },
                            { name: 'SE', dLat: -DEG_LAT_PER_FT * 0.707, dLon: DEG_LON_PER_FT * 0.707 },
                            { name: 'S', dLat: -DEG_LAT_PER_FT, dLon: 0 },
                            { name: 'SW', dLat: -DEG_LAT_PER_FT * 0.707, dLon: -DEG_LON_PER_FT * 0.707 },
                            { name: 'W', dLat: 0, dLon: -DEG_LON_PER_FT },
                            { name: 'NW', dLat: DEG_LAT_PER_FT * 0.707, dLon: -DEG_LON_PER_FT * 0.707 },
                        ];

                        // Quick elevation scout — 8 points 100ft out
                        const scoutResults = await Promise.all(
                            DIRECTIONS.map(async d => {
                                const sLat = lat + d.dLat * 100;
                                const sLon = lon + d.dLon * 100;
                                try {
                                    const r = await fetch(`https://epqs.nationalmap.gov/v1/json?x=${sLon}&y=${sLat}&wkid=4326&units=Feet&includeDate=false`);
                                    const j = await r.json();
                                    return { ...d, ft: j?.value ? parseFloat(j.value) : 0 };
                                } catch {
                                    return { ...d, ft: 0 };
                                }
                            })
                        );

                        // Get pin elevation
                        const pinResp = await fetch(`https://epqs.nationalmap.gov/v1/json?x=${lon}&y=${lat}&wkid=4326&units=Feet&includeDate=false`);
                        const pinJson = await pinResp.json();
                        const pinFt = pinJson?.value ? parseFloat(pinJson.value) : 0;

                        const uphill = scoutResults.reduce((a, b) => a.ft > b.ft ? a : b);
                        const delta = Math.abs(uphill.ft - pinFt);
                        const depth = 150; // fallback depth

                        slopePercent = Math.round((delta / depth) * 1000) / 10;
                        if (slopePercent < 5) slopeCategory = 'Flat';
                        else if (slopePercent <= 15) slopeCategory = 'Moderate';
                        else if (slopePercent <= 30) slopeCategory = 'Steep';
                        else slopeCategory = 'Heavy';
                        uphillDir = uphill.name;
                    } catch (e: any) {
                        console.warn('[ParcelValidation] Elevation scout failed:', e.message);
                    }
                }

                if (cancelled || slopePercent == null || !uphillDir) {
                    setLoading(false);
                    return;
                }

                // ── Step 4: Run validation engine ──
                const listedLot = (propertyData as any).lotSize || null;
                const description = propertyData.description || null;

                const validationFlags = runValidation({
                    listedLotSqft: listedLot,
                    arcgisAreaSqft: areaSqft || undefined,
                    slopePercent,
                    slopeCategory: slopeCategory!,
                    uphillDir: uphillDir!,
                    description,
                });

                if (cancelled) return;
                setFlags(validationFlags);

                // ── Step 5: Cache validation result ──
                try {
                    await setDoc(doc(db, 'properties', String(zpid)), {
                        parcelValidation: {
                            flags: validationFlags,
                            slopePercent,
                            slopeCategory,
                            uphillDir,
                            cachedAt: new Date().toISOString(),
                        },
                    }, { merge: true });
                } catch (e: any) {
                    console.warn('[ParcelValidation] Cache save failed:', e.message);
                }

            } catch (e: any) {
                console.error('[ParcelValidation] Error:', e.message);
                if (!cancelled) setError(e.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        run();
        return () => { cancelled = true; };
    }, [zpid, lat, lon]);

    // Don't render anything until we have data
    if (!zpid || !lat || !lon) return null;
    if (loading) {
        return (
            <div className="max-w-4xl mx-auto px-4 mt-4">
                <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center animate-pulse">
                            <i className="fa-solid fa-shield-halved text-slate-400 text-sm" />
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Zyphe Ground Truth Verification</div>
                            <div className="text-xs text-slate-500 mt-0.5">Checking county records & elevation data...</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!flags || flags.length === 0) return null;

    const alertCount = flags.filter(f => f.severity === 'alert').length;
    const warnCount = flags.filter(f => f.severity === 'warning').length;
    const infoCount = flags.filter(f => f.severity === 'info').length;

    const summaryColor = alertCount > 0 ? 'from-red-50 to-orange-50 border-red-200' :
        warnCount > 0 ? 'from-amber-50 to-yellow-50 border-amber-200' :
            'from-emerald-50 to-teal-50 border-emerald-200';

    const summaryText = alertCount > 0 ? `${alertCount} Alert${alertCount > 1 ? 's' : ''} Found` :
        warnCount > 0 ? `${warnCount} Warning${warnCount > 1 ? 's' : ''}` :
            'All Checks Passed';

    const summaryIcon = alertCount > 0 ? '🚨' : warnCount > 0 ? '⚠️' : '✅';

    return (
        <div className="max-w-4xl mx-auto px-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className={`rounded-2xl border bg-gradient-to-br ${summaryColor} overflow-hidden shadow-sm`}>
                {/* Header */}
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${alertCount > 0 ? 'bg-red-100' : warnCount > 0 ? 'bg-amber-100' : 'bg-emerald-100'
                            }`}>
                            <i className={`fa-solid fa-shield-halved text-sm ${alertCount > 0 ? 'text-red-600' : warnCount > 0 ? 'text-amber-600' : 'text-emerald-600'
                                }`} />
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Zyphe Ground Truth Verification
                            </div>
                            <div className="text-xs font-bold text-slate-600 mt-0.5 flex items-center gap-2">
                                <span>{summaryIcon} {summaryText}</span>
                                {apn && <span className="text-[10px] text-slate-400 font-mono">APN: {apn}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {alertCount > 0 && <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">{alertCount} alert{alertCount > 1 ? 's' : ''}</span>}
                        {warnCount > 0 && <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">{warnCount} warning{warnCount > 1 ? 's' : ''}</span>}
                        {infoCount > 0 && <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">{infoCount} verified</span>}
                    </div>
                </div>

                {/* Flags */}
                <div className="px-4 pb-3 space-y-1.5">
                    {flags.map((f, i) => (
                        <div key={i} className={`flex items-start gap-2 text-[11px] leading-relaxed px-3 py-2 rounded-xl ${f.severity === 'alert' ? 'bg-red-50/80 border border-red-200/80' :
                            f.severity === 'warning' ? 'bg-amber-50/80 border border-amber-200/80' :
                                'bg-white/60 border border-emerald-100'
                            }`}>
                            <span className="shrink-0 mt-0.5 text-sm">
                                {f.severity === 'alert' ? '🚨' : f.severity === 'warning' ? '⚠️' : '✅'}
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className={`font-black uppercase text-[10px] tracking-wider ${f.severity === 'alert' ? 'text-red-700' :
                                        f.severity === 'warning' ? 'text-amber-700' :
                                            'text-emerald-700'
                                        }`}>
                                        {f.check.replace(/_/g, ' ')}
                                    </span>
                                    {f.delta !== 'N/A' && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${f.severity === 'alert' ? 'bg-red-100 text-red-600' :
                                            f.severity === 'warning' ? 'bg-amber-100 text-amber-600' :
                                                'bg-emerald-100 text-emerald-600'
                                            }`}>{f.delta}</span>
                                    )}
                                </div>
                                <div className="text-slate-600 mt-0.5 font-medium">{f.finding}</div>
                                {f.listed && f.measured && (
                                    <div className="flex gap-3 mt-1 text-[10px] text-slate-400">
                                        <span>Listed: <span className="font-semibold text-slate-500">{f.listed}</span></span>
                                        <span>Measured: <span className="font-semibold text-slate-500">{f.measured}</span></span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                {arcgisArea && (() => {
                    const listedLot = (propertyData as any).lotSize || 0;
                    const pctDiff = listedLot > 0 ? Math.abs(arcgisArea - listedLot) / listedLot : 1;
                    return (
                        <div className="px-4 pb-3 pt-0">
                            <div className="text-[9px] text-slate-400 flex items-center gap-3">
                                {pctDiff > 0.05 && (
                                    <>
                                        <span>📐 Parcel Boundary Area: <span className="font-bold">{arcgisArea.toLocaleString()} sf</span></span>
                                        <span>vs Listed: <span className="font-bold">{listedLot.toLocaleString()} sf</span></span>
                                    </>
                                )}
                                <span className="ml-auto">Source: {countyName || 'County'} ArcGIS + USGS LiDAR</span>
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

// ─── Inline Validation Engine (mirrors landUtility.ts but standalone) ──────

function runValidation(opts: {
    listedLotSqft?: number | null;
    arcgisAreaSqft?: number;
    slopePercent: number;
    slopeCategory: string;
    uphillDir: string;
    description?: string | null;
}): ValidationFlag[] {
    const flags: ValidationFlag[] = [];

    // CHECK 1: Lot Size
    if (opts.listedLotSqft && opts.arcgisAreaSqft && opts.listedLotSqft > 0 && opts.arcgisAreaSqft > 0) {
        const pctDiff = ((opts.listedLotSqft - opts.arcgisAreaSqft) / opts.arcgisAreaSqft) * 100;
        const absDiff = Math.abs(pctDiff);
        if (absDiff > 5) {
            const direction = pctDiff > 0 ? 'larger' : 'smaller';
            flags.push({
                check: 'lot_size',
                severity: absDiff > 15 ? 'alert' : 'warning',
                listed: `${opts.listedLotSqft.toLocaleString()} sqft`,
                measured: `${opts.arcgisAreaSqft.toLocaleString()} sqft (ArcGIS)`,
                delta: `${pctDiff > 0 ? '+' : ''}${pctDiff.toFixed(1)}%`,
                finding: `Listed lot is ${absDiff.toFixed(0)}% ${direction} than county parcel boundary (${Math.abs(opts.listedLotSqft - opts.arcgisAreaSqft).toLocaleString()} sqft difference).${absDiff > 15 ? ' Possible easement, right-of-way, or measurement discrepancy.' : ''}`,
            });
        } else {
            flags.push({
                check: 'lot_size', severity: 'info',
                listed: `${opts.listedLotSqft.toLocaleString()} sqft`,
                measured: `${opts.arcgisAreaSqft.toLocaleString()} sqft (ArcGIS)`,
                delta: `${pctDiff > 0 ? '+' : ''}${pctDiff.toFixed(1)}%`,
                finding: 'Lot size matches county records within 5%.',
            });
        }
    }

    // CHECK 2: Slope vs Description
    const desc = (opts.description || '').toLowerCase();
    const claimsFlat = /\b(flat|level|gentle slope|gently?\s*slop|mostly flat|near flat)\b/i.test(desc);
    const claimsSteep = /\b(steep|hillside|hilltop|dramatic slope|significant slope|canyon)\b/i.test(desc);
    const claimsViews = /\b(view|panoramic|vista|overlook|bay view|mountain view|city view|sweeping)\b/i.test(desc);

    if (claimsFlat && opts.slopePercent > 15) {
        flags.push({
            check: 'slope_reality', severity: 'alert',
            listed: 'Description implies flat/level',
            measured: `${opts.slopePercent}% slope (${opts.slopeCategory})`,
            delta: `${opts.slopePercent}%`,
            finding: `Listing describes "flat" terrain but elevation data measures ${opts.slopePercent}% grade — classified ${opts.slopeCategory}. Foundation costs may be $50k–$100k above standard.`,
        });
    } else if (claimsFlat && opts.slopePercent > 8) {
        flags.push({
            check: 'slope_reality', severity: 'warning',
            listed: 'Description implies flat/level',
            measured: `${opts.slopePercent}% slope (${opts.slopeCategory})`,
            delta: `${opts.slopePercent}%`,
            finding: `Listing suggests flat terrain but measured slope is ${opts.slopePercent}%. This is ${opts.slopeCategory} — grading costs apply.`,
        });
    } else if (!claimsSteep && opts.slopePercent > 25) {
        flags.push({
            check: 'slope_reality', severity: 'warning',
            listed: 'Description does not mention steep slope',
            measured: `${opts.slopePercent}% slope (${opts.slopeCategory})`,
            delta: `${opts.slopePercent}%`,
            finding: `${opts.slopeCategory} slope of ${opts.slopePercent}% not disclosed in listing. Significant earthwork and retaining walls likely required.`,
        });
    }
    if (claimsViews && opts.slopePercent < 5) {
        flags.push({
            check: 'slope_reality', severity: 'info',
            listed: 'Description claims views',
            measured: `${opts.slopePercent}% slope (Flat)`,
            delta: 'N/A',
            finding: 'Listing mentions views but property is on flat terrain. Views may be limited unless elevated position is confirmed.',
        });
    }

    // CHECK 3: Orientation / Solar
    const backyardDir = OPPOSITE_DIR[opts.uphillDir] || opts.uphillDir;
    const isSouthFacing = ['S', 'SE', 'SW'].includes(backyardDir);
    const isNorthFacing = ['N', 'NE', 'NW'].includes(backyardDir);

    const claimsSunny = /\b(sunny|sun-filled|sun[\s-]*drenched|bright backyard|solar|south.?facing)\b/i.test(desc);
    const claimsSolar = /\b(solar ready|solar panels|solar potential|solar roof)\b/i.test(desc);

    if (claimsSunny && isNorthFacing) {
        flags.push({
            check: 'orientation', severity: 'warning',
            listed: 'Description claims sunny/bright',
            measured: `Backyard faces ${backyardDir} (shaded)`,
            delta: 'N/A',
            finding: `Listing promotes "sunny" but backyard faces ${backyardDir} — a shaded orientation in the Northern Hemisphere. Expect limited direct sunlight, especially in winter.`,
        });
    } else if (isSouthFacing) {
        flags.push({
            check: 'orientation', severity: 'info',
            listed: claimsSunny ? 'Description confirms sunny' : 'Not mentioned',
            measured: `Backyard faces ${backyardDir} (south-facing)`,
            delta: 'N/A',
            finding: 'South-facing backyard confirmed. Optimal for natural light and solar potential.',
        });
    }

    if (claimsSolar && isNorthFacing) {
        flags.push({
            check: 'solar_roi', severity: 'alert',
            listed: 'Description claims solar potential',
            measured: `Primary rear exposure faces ${backyardDir}`,
            delta: 'N/A',
            finding: `Listing promotes solar but rear roof pitch likely faces ${backyardDir}. Solar panel efficiency could be 30–50% below optimal south-facing installations.`,
        });
    }

    return flags;
}

export default ParcelValidationCard;
