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
    const [taxSqft, setTaxSqft] = useState<number | null>(null);
    const [taxSqftSource, setTaxSqftSource] = useState<string | null>(null);
    const [polygonVertices, setPolygonVertices] = useState<number | null>(null);
    const [slopeDisplay, setSlopeDisplay] = useState<{ percent: number; category: string; uphillDir: string } | null>(null);
    const [drivewayDisplay, setDrivewayDisplay] = useState<{ grade: number; category: string; dir: string } | null>(null);
    const [viewDisplay, setViewDisplay] = useState<{ potential: string; dropFt: number; dir: string } | null>(null);
    const [elevationFt, setElevationFt] = useState<number | null>(null);

    const [showHelp, setShowHelp] = useState(false);
    const helpRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleHelpEnter = () => {
        if (helpRef.current) clearTimeout(helpRef.current);
        setShowHelp(true);
    };
    const handleHelpLeave = () => {
        // Small delay so tooltip doesn't flicker when moving between button and panel
        helpRef.current = setTimeout(() => setShowHelp(false), 100);
    };

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

                // ── Early exit: no record or property no longer on sale ──
                if (!propData) {
                    if (!cancelled) setLoading(false);
                    return;
                }
                if (propData.deprecated) {
                    if (!cancelled) setLoading(false);
                    return;
                }

                if (propData?.parcelValidation?.flags?.length > 0 && propData?.parcelValidation?.cachedAt) {
                    if (!cancelled) {
                        setFlags(propData.parcelValidation.flags);
                        setArcgisArea(propData.parcelAreaSqft || null);
                        setApn(propData.parcelApn || null);
                        setTaxSqft(propData.taxSqft || null);
                        setCountyName(propData.parcelCounty || null);
                        if (propData.parcelPolygon?.length) setPolygonVertices(propData.parcelPolygon.length);
                        if (propData.parcelValidation.slopePercent != null) {
                            setSlopeDisplay({
                                percent: propData.parcelValidation.slopePercent,
                                category: propData.parcelValidation.slopeCategory || 'Unknown',
                                uphillDir: propData.parcelValidation.uphillDir || '?',
                            });
                        }
                        setLoading(false);
                    }
                    return;
                }

                // ── Step 1b: Fetch tax_sqft from comp normalization cache ──
                let cachedTaxSqft: number | null = null;
                try {
                    const daSnap = await getDoc(doc(db, 'distress_analysis', String(zpid)));
                    if (daSnap.exists()) {
                        const da = daSnap.data();
                        cachedTaxSqft = da?.compNormalization?.subject_audit?.tax_sqft ?? null;
                    }
                } catch { /* ignore */ }
                // Also check properties doc for cached tax sqft
                if (!cachedTaxSqft && propData?.taxSqft) {
                    cachedTaxSqft = propData.taxSqft;
                    if (!cancelled) setTaxSqftSource((propData as any).taxSqftSource || null);
                }
                if (!cancelled) setTaxSqft(cachedTaxSqft);

                // ── Step 2: Get polygon (cached or fresh from ArcGIS) ──
                let polygon: [number, number][] | null = null;
                let areaSqft: number | null = null;
                let parcelApn: string | null = null;
                let parcelCounty: string | null = null;

                if (propData?.parcelPolygon?.length > 3) {
                    const { firestoreToPolygon } = await import('../../services/arcgis/countyParcels');
                    polygon = firestoreToPolygon(propData.parcelPolygon);
                    areaSqft = propData.parcelAreaSqft || null;
                    parcelApn = propData.parcelApn || null;
                    parcelCounty = propData.parcelCounty || null;
                    if (parcelCounty && !cancelled) setCountyName(parcelCounty);
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
                                parcelCounty = result.county;
                                setCountyName(result.county);

                                // Use ArcGIS building sqft as tax sqft fallback
                                if (!cachedTaxSqft && result.buildingSqft && result.buildingSqft > 0) {
                                    cachedTaxSqft = result.buildingSqft;
                                    if (!cancelled) setTaxSqft(cachedTaxSqft);
                                    if (!cancelled) setTaxSqftSource(`ArcGIS ${result.county}`);
                                }

                                // Cache polygon + taxSqft to properties doc
                                await setDoc(doc(db, 'properties', String(zpid)), {
                                    parcelPolygon: polygonToFirestore(polygon),
                                    parcelApn: parcelApn,
                                    parcelAreaSqft: areaSqft,
                                    parcelCounty: result.county,
                                    parcelCachedAt: new Date().toISOString(),
                                    ...(result.buildingSqft ? { taxSqft: result.buildingSqft } : {}),
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
                if (polygon) setPolygonVertices(polygon.length);

                // ── Step 3: Get slope + driveway + view data (Google Elevation API) ──
                // Check Firestore cache first
                let slopePercent: number | null = propData?.parcelValidation?.slopePercent ?? propData?.slopePercent ?? null;
                let slopeCategory: string | null = propData?.parcelValidation?.slopeCategory ?? propData?.slopeCategory ?? null;
                let uphillDir: string | null = propData?.parcelValidation?.uphillDir ?? propData?.uphillDir ?? null;
                let downhillDir: string | null = propData?.parcelValidation?.downhillDir ?? null;
                let drivewayGradePercent: number | null = propData?.parcelValidation?.drivewayGradePercent ?? null;
                let drivewayCategory: string | null = propData?.parcelValidation?.drivewayCategory ?? null;
                let viewDropFt: number | null = propData?.parcelValidation?.viewDropFt ?? null;
                let viewDropDir: string | null = propData?.parcelValidation?.viewDropDir ?? null;
                let viewPotential: string | null = propData?.parcelValidation?.viewPotential ?? null;
                let propertyElevationFt: number | null = propData?.parcelValidation?.elevationFt ?? null;

                // If no slope data cached, fetch via single Google Elevation API batch call
                if (slopePercent == null && lat && lon) {
                    try {
                        const { computePropertySlopeGoogle } = await import('../../services/elevationService');
                        const result = await computePropertySlopeGoogle(lat, lon);
                        slopePercent          = result.slopePercent;
                        slopeCategory         = result.slopeCategory;
                        uphillDir             = result.uphillDir;
                        downhillDir           = result.downhillDir;
                        drivewayGradePercent  = result.drivewayGradePercent;
                        drivewayCategory      = result.drivewayCategory;
                        viewDropFt            = result.viewDropFt;
                        viewDropDir           = result.viewDropDir;
                        viewPotential         = result.viewPotential;
                        propertyElevationFt   = result.elevationFt;
                        console.log('[ParcelValidation] Google Elevation result:', result);
                    } catch (e: any) {
                        console.warn('[ParcelValidation] Google Elevation API failed:', e.message);
                    }
                }

                if (cancelled) return;

                // Expose slope + driveway + view data to the UI
                if (slopePercent != null && slopeCategory && uphillDir) {
                    setSlopeDisplay({ percent: slopePercent, category: slopeCategory, uphillDir });
                }
                if (drivewayGradePercent != null && drivewayCategory && downhillDir) {
                    setDrivewayDisplay({ grade: drivewayGradePercent, category: drivewayCategory, dir: downhillDir });
                }
                if (viewDropFt != null && viewPotential && viewDropDir) {
                    setViewDisplay({ potential: viewPotential, dropFt: viewDropFt, dir: viewDropDir });
                }
                if (propertyElevationFt != null) setElevationFt(propertyElevationFt);

                // ── Step 3b: Gemini tax record lookup (if no cached tax sqft) ──
                if (!cachedTaxSqft && !cancelled) {
                    try {
                        console.log('[ParcelValidation] No cached tax sqft — running Gemini lookup...');
                        const { executeGeminiRequest, FLASH_MODEL } = await import('../../services/geminiService');
                        const { TAX_RECORD_LOOKUP_PROMPT, TAX_RECORD_LOOKUP_SYSTEM_INSTRUCTION } = await import('../../prompts/property/taxRecordLookup');
                        const address = propertyData.address || '';
                        const city = propertyData.city || '';
                        const state = propertyData.state || '';
                        const listingSqft = propertyData.livingAreaValue || undefined;

                        const prompt = TAX_RECORD_LOOKUP_PROMPT(
                            address, city, state,
                            parcelCounty || undefined,
                            parcelApn || undefined,
                            listingSqft,
                        );

                        // Race the Gemini call against a 15s timeout
                        const lookupPromise = executeGeminiRequest<any>({
                            model: FLASH_MODEL,
                            contents: prompt,
                            config: {
                                tools: [{ googleSearch: {} }],
                                systemInstruction: TAX_RECORD_LOOKUP_SYSTEM_INSTRUCTION,
                                maxOutputTokens: 1024,
                            },
                            userId: 'parcel-validation',
                            promptFilename: 'taxRecordLookup',
                            zpid: String(zpid),
                            address,
                            extractResultJson: true,
                        });
                        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000));
                        const lookupResult = await Promise.race([lookupPromise, timeoutPromise]);

                        if (lookupResult && (lookupResult as any).data?.tax_sqft && (lookupResult as any).data.tax_sqft > 0) {
                            const taxData = (lookupResult as any).data;
                            cachedTaxSqft = taxData.tax_sqft;
                            if (!cancelled) setTaxSqft(cachedTaxSqft);
                            if (!cancelled) setTaxSqftSource(taxData.source || 'Gemini Lookup');
                            console.log(`[ParcelValidation] Gemini tax lookup: ${cachedTaxSqft} sf (source: ${taxData.source}, confidence: ${taxData.confidence})`);

                            // Cache to properties doc
                            await setDoc(doc(db, 'properties', String(zpid)), {
                                taxSqft: cachedTaxSqft,
                                taxSqftSource: taxData.source || 'gemini-lookup',
                                taxSqftConfidence: taxData.confidence || 'medium',
                                taxSqftCachedAt: new Date().toISOString(),
                            }, { merge: true });
                        } else {
                            console.log('[ParcelValidation] Gemini tax lookup: no result or timed out');
                        }
                    } catch (e: any) {
                        console.warn('[ParcelValidation] Gemini tax lookup failed:', e.message);
                    }
                }

                if (cancelled) return;

                // ── Step 4: Run validation engine ──
                const rawLot = (propertyData as any).lotSize;
                const listedLot = (() => {
                    if (rawLot == null) return null;
                    if (typeof rawLot === 'number') return rawLot > 0 ? rawLot : null;
                    const s = String(rawLot);
                    const isAcres = /acre/i.test(s);
                    const num = parseFloat(s.replace(/,/g, '').replace(/[^0-9.]/g, ''));
                    if (isNaN(num) || num <= 0) return null;
                    // If value looks like acres (has "acre" in text or < 10 assuming acres)
                    if (isAcres || (num < 10 && !s.includes('sqft') && !s.includes('sq'))) return Math.round(num * 43560);
                    return Math.round(num);
                })();
                const description = propertyData.description || null;
                const listingSqft = propertyData.livingAreaValue || null;

                const validationFlags = runValidation({
                    listedLotSqft: listedLot,
                    arcgisAreaSqft: areaSqft || undefined,
                    slopePercent: slopePercent ?? undefined,
                    slopeCategory: slopeCategory ?? undefined,
                    uphillDir: uphillDir ?? undefined,
                    drivewayGradePercent: drivewayGradePercent ?? undefined,
                    drivewayCategory: drivewayCategory ?? undefined,
                    viewPotential: viewPotential ?? undefined,
                    viewDropFt: viewDropFt ?? undefined,
                    description,
                    listingSqft: listingSqft || undefined,
                    taxSqft: cachedTaxSqft || undefined,
                });

                if (cancelled) return;
                setFlags(validationFlags);

                // ── Step 5: Cache validation result (all elevation fields) ──
                try {
                    await setDoc(doc(db, 'properties', String(zpid)), {
                        parcelValidation: {
                            flags: validationFlags,
                            slopePercent,
                            slopeCategory,
                            uphillDir,
                            downhillDir,
                            drivewayGradePercent,
                            drivewayCategory,
                            viewDropFt,
                            viewDropDir,
                            viewPotential,
                            elevationFt: propertyElevationFt,
                            elevationSource: 'google_elevation',
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
            <div className="px-2 pt-4">
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

    // Always show card when we have parcel or tax data, even if no flags
    if (!flags && !arcgisArea && !taxSqft) return null;
    const displayFlags = flags || [];

    const alertCount = displayFlags.filter(f => f.severity === 'alert').length;
    const warnCount = displayFlags.filter(f => f.severity === 'warning').length;
    const infoCount = displayFlags.filter(f => f.severity === 'info').length;

    const summaryColor = alertCount > 0 ? 'from-red-50 to-orange-50 border-red-200' :
        warnCount > 0 ? 'from-amber-50 to-yellow-50 border-amber-200' :
            'from-emerald-50 to-teal-50 border-emerald-200';

    const summaryText = alertCount > 0 ? `${alertCount} Alert${alertCount > 1 ? 's' : ''} Found` :
        warnCount > 0 ? `${warnCount} Warning${warnCount > 1 ? 's' : ''}` :
            'All Checks Passed';

    const summaryIcon = alertCount > 0 ? '🚨' : warnCount > 0 ? '⚠️' : '✅';

    return (
        <div className="px-2 pt-4 animate-in fade-in slide-in-from-top-2 duration-500 relative">

            {/* Help tooltip */}
            {showHelp && (
                <div
                    className="absolute top-12 right-2 z-50 w-64 bg-white/98 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
                    onMouseEnter={handleHelpEnter}
                    onMouseLeave={handleHelpLeave}
                >
                    <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">Data Sources</div>
                    <ul className="space-y-1.5 text-[11px] text-slate-600">
                        <li><span className="font-bold text-slate-800">Municipal ArcGIS:</span> County boundary data</li>
                        <li><span className="font-bold text-slate-800">USGS LiDAR:</span> Elevation & slope analysis</li>
                        <li><span className="font-bold text-slate-800">Tax Records:</span> Living area verification</li>
                    </ul>
                    <div className="border-t border-slate-100 my-2.5"></div>
                    <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">Rules Checked</div>
                    <ul className="space-y-1.5 text-[11px] text-slate-600">
                        <li><span className="font-bold text-slate-800">Lot Accuracy:</span> Listed vs GIS lot size (&gt;5%)</li>
                        <li><span className="font-bold text-slate-800">Slope Reality:</span> "Flat" claims vs terrain grade</li>
                        <li><span className="font-bold text-slate-800">Solar/Orientation:</span> Roof direction & energy potential</li>
                        <li><span className="font-bold text-slate-800">Permit Integrity:</span> Listing sqft vs tax record</li>
                    </ul>
                </div>
            )}

            <div className={`rounded-2xl border bg-gradient-to-br ${summaryColor} overflow-hidden shadow-sm`}>
                {/* Header */}
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${alertCount > 0 ? 'bg-red-100' : warnCount > 0 ? 'bg-amber-100' : 'bg-emerald-100'
                                }`}>
                                <i className={`fa-solid fa-shield-halved text-sm ${alertCount > 0 ? 'text-red-600' : warnCount > 0 ? 'text-amber-600' : 'text-emerald-700'
                                    }`} />
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Ground Truth
                                </div>
                                {apn && <div className="text-[10px] text-slate-400 font-mono mt-0.5">APN: {apn}</div>}
                            </div>
                        </div>

                        <button
                            onMouseEnter={handleHelpEnter}
                            onMouseLeave={handleHelpLeave}
                            className="w-8 h-8 rounded-full bg-white/40 hover:bg-white/80 border border-black/5 flex items-center justify-center transition-all group"
                        >
                            <i className="fa-solid fa-circle-question text-slate-400 group-hover:text-indigo-600 text-sm"></i>
                        </button>
                    </div>
                </div>

            </div>

            {/* Parcel Data — polygon, slope, area, tax sqft */}
            <div className="px-4 pb-2">
                <div className="grid grid-cols-1 gap-2">
                    {/* Polygon info */}
                    {(arcgisArea || polygonVertices) && (
                        <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/50">
                            <i className="fa-solid fa-draw-polygon text-indigo-400 text-xs" />
                            <div className="flex-1 min-w-0">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Parcel Polygon (ArcGIS)</div>
                                <div className="text-[12px] font-black text-slate-700 mt-0.5 flex items-center gap-3">
                                    {arcgisArea && (
                                        <span>
                                            {arcgisArea.toLocaleString()} sf
                                            <span className="text-[10px] font-bold text-slate-400 ml-1">
                                                ({(arcgisArea / 43560).toFixed(2)} ac)
                                            </span>
                                        </span>
                                    )}
                                    {polygonVertices && (
                                        <span className="text-[10px] font-bold text-indigo-400">
                                            {polygonVertices} vertices
                                        </span>
                                    )}
                                </div>
                                {countyName && (
                                    <div className="text-[10px] font-medium text-slate-400 mt-0.5">{countyName} County</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Slope info */}
                    {slopeDisplay && (
                        <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/50">
                            <i className="fa-solid fa-mountain text-indigo-400 text-xs" />
                            <div className="flex-1 min-w-0">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lot Slope (Google Elevation)</div>
                                <div className="text-[12px] font-black text-slate-700 mt-0.5 flex items-center gap-3">
                                    <span>{slopeDisplay.percent}%</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                        slopeDisplay.category === 'Heavy' || slopeDisplay.category === 'Steep'
                                        ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                    }`}>{slopeDisplay.category}</span>
                                    <span className="text-[10px] font-bold text-slate-400">↑ {slopeDisplay.uphillDir}</span>
                                    {elevationFt && <span className="text-[10px] text-slate-400">{elevationFt.toLocaleString()} ft AMSL</span>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Driveway grade */}
                    {drivewayDisplay && drivewayDisplay.category !== 'Flat' && (
                        <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/50">
                            <i className="fa-solid fa-car text-indigo-400 text-xs" />
                            <div className="flex-1 min-w-0">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Driveway / Approach Grade</div>
                                <div className="text-[12px] font-black text-slate-700 mt-0.5 flex items-center gap-3">
                                    <span>{drivewayDisplay.grade}%</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                        drivewayDisplay.category === 'Steep' ? 'bg-red-100 text-red-700' :
                                        drivewayDisplay.category === 'Moderate' ? 'bg-amber-100 text-amber-700' :
                                        'bg-emerald-100 text-emerald-700'
                                    }`}>{drivewayDisplay.category}</span>
                                    <span className="text-[10px] text-slate-400">toward {drivewayDisplay.dir}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* View potential */}
                    {viewDisplay && viewDisplay.potential !== 'None' && (
                        <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/50">
                            <i className="fa-solid fa-binoculars text-indigo-400 text-xs" />
                            <div className="flex-1 min-w-0">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">View Potential (Elevation Drop)</div>
                                <div className="text-[12px] font-black text-slate-700 mt-0.5 flex items-center gap-3">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                        viewDisplay.potential === 'High' ? 'bg-emerald-100 text-emerald-700' :
                                        viewDisplay.potential === 'Moderate' ? 'bg-blue-100 text-blue-700' :
                                        'bg-slate-100 text-slate-600'
                                    }`}>{viewDisplay.potential}</span>
                                    <span className="text-[10px] text-slate-500">{viewDisplay.dropFt > 0 ? '+' : ''}{viewDisplay.dropFt} ft drop toward {viewDisplay.dir}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tax sqft */}
                    {taxSqft ? (
                        <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/50">
                            <i className="fa-solid fa-ruler-combined text-indigo-400 text-xs" />
                            <div className="flex-1 min-w-0">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Living Area (Tax Record)</div>
                                <div className="text-[12px] font-black text-slate-700 mt-0.5">
                                    {taxSqft.toLocaleString()} sf
                                </div>
                                {taxSqftSource && (
                                    <div className="text-[9px] text-slate-400 font-medium mt-0.5 truncate" title={taxSqftSource}>
                                        {taxSqftSource}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50">
                            <i className="fa-solid fa-ruler-combined text-slate-300 text-xs" />
                            <div className="flex-1 min-w-0">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Living Area (Tax Record)</div>
                                <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                                    Run comp analysis to fetch tax records
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Rules Run — checklist of all validation rules */}
            {(() => {
                const rawLotDisplay = (propertyData as any).lotSize;
                const listedLot = (() => {
                    if (rawLotDisplay == null) return null;
                    if (typeof rawLotDisplay === 'number') return rawLotDisplay > 0 ? rawLotDisplay : null;
                    const s = String(rawLotDisplay);
                    const isAcres = /acre/i.test(s);
                    const num = parseFloat(s.replace(/,/g, '').replace(/[^0-9.]/g, ''));
                    if (isNaN(num) || num <= 0) return null;
                    if (isAcres || (num < 10 && !s.includes('sqft') && !s.includes('sq'))) return Math.round(num * 43560);
                    return Math.round(num);
                })();
                const listingSqft = propertyData.livingAreaValue || null;

                const rules = [
                    {
                        id: 'lot_size',
                        label: 'Lot Size vs County Parcel',
                        ran: !!(listedLot && listedLot > 0 && arcgisArea && arcgisArea > 0),
                        icon: 'fa-expand',
                    },
                    {
                        id: 'slope_reality',
                        label: 'Slope vs Description',
                        ran: !!slopeDisplay,
                        icon: 'fa-mountain',
                    },
                    {
                        id: 'orientation',
                        label: 'Orientation & Solar Check',
                        ran: !!slopeDisplay,
                        icon: 'fa-compass',
                    },
                    {
                        id: 'living_sqft',
                        label: 'Listing Sqft vs Tax Record',
                        ran: !!(listingSqft && listingSqft > 0 && taxSqft && taxSqft > 0),
                        icon: 'fa-ruler-combined',
                    },
                ];

                // For each rule, find its outcome from flags
                const getOutcome = (ruleId: string) => {
                    const matching = displayFlags.filter(f => f.check === ruleId || (ruleId === 'orientation' && (f.check === 'orientation' || f.check === 'solar_roi')));
                    if (matching.length === 0) return null;
                    if (matching.some(f => f.severity === 'alert')) return 'alert';
                    if (matching.some(f => f.severity === 'warning')) return 'warning';
                    return 'info';
                };

                return (
                    <div className="px-4 pb-2">
                        <div className="flex items-center justify-between mb-2 ml-1">
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Rules Evaluated</div>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-slate-600">{summaryIcon} {summaryText}</span>
                                {alertCount > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">{alertCount}!</span>}
                                {warnCount > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">{warnCount}!</span>}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                            {rules.map(r => {
                                const outcome = r.ran ? getOutcome(r.id) : null;
                                return (
                                    <div key={r.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] ${!r.ran ? 'bg-slate-50/60 border border-slate-100' :
                                        outcome === 'alert' ? 'bg-red-50/60 border border-red-200/60' :
                                            outcome === 'warning' ? 'bg-amber-50/60 border border-amber-200/60' :
                                                'bg-white/60 border border-emerald-100'
                                        }`}>
                                        <i className={`fa-solid ${r.icon} text-[10px] ${!r.ran ? 'text-slate-300' :
                                            outcome === 'alert' ? 'text-red-500' :
                                                outcome === 'warning' ? 'text-amber-500' :
                                                    'text-emerald-500'
                                            }`} />
                                        <span className={`font-semibold flex-1 ${!r.ran ? 'text-slate-400' : 'text-slate-600'
                                            }`}>{r.label}</span>
                                        {!r.ran ? (
                                            <span className="text-[9px] font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-100">SKIPPED</span>
                                        ) : outcome === 'alert' ? (
                                            <span className="text-[9px] font-bold text-red-600 px-1.5 py-0.5 rounded bg-red-100">ALERT</span>
                                        ) : outcome === 'warning' ? (
                                            <span className="text-[9px] font-bold text-amber-600 px-1.5 py-0.5 rounded bg-amber-100">WARNING</span>
                                        ) : (
                                            <span className="text-[9px] font-bold text-emerald-600 px-1.5 py-0.5 rounded bg-emerald-100">PASS</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* Flag Details — expanded findings (only alerts/warnings, info shown in Rules Evaluated) */}
            {displayFlags.filter(f => f.severity !== 'info').length > 0 && (
                <div className="px-4 pb-3 space-y-1.5">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Findings</div>
                    {displayFlags.filter(f => f.severity !== 'info').map((f, i) => (
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
            )}

            {/* Footer */}
            <div className="px-4 pb-3 pt-0">
                <div className="text-[9px] text-slate-400 flex items-center gap-3">
                    <span className="ml-auto">Source: {countyName || 'County'} ArcGIS + USGS LiDAR</span>
                </div>
            </div>
        </div>
    );
};

// ─── Inline Validation Engine (mirrors landUtility.ts but standalone) ──────

function runValidation(opts: {
    listedLotSqft?: number | null;
    arcgisAreaSqft?: number;
    slopePercent?: number;
    slopeCategory?: string;
    uphillDir?: string;
    drivewayGradePercent?: number;
    drivewayCategory?: string;
    viewPotential?: string;
    viewDropFt?: number;
    description?: string | null;
    listingSqft?: number;
    taxSqft?: number;
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

    // CHECK 2: Slope vs Description (only if slope data available)
    if (opts.slopePercent == null || !opts.slopeCategory || !opts.uphillDir) {
        // Skip slope-related checks — data unavailable
    } else {

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

    } // end slope-data guard

    // CHECK 3b: Steep driveway disclosure
    if (opts.drivewayGradePercent != null && opts.drivewayCategory) {
        const desc = (opts.description || '').toLowerCase();
        const claimsFlatDriveway = /\b(flat driveway|level driveway|easy access|level entry|flat access)\b/i.test(desc);
        if (opts.drivewayCategory === 'Steep') {
            flags.push({
                check: 'driveway_grade', severity: claimsFlatDriveway ? 'alert' : 'warning',
                listed: claimsFlatDriveway ? 'Description implies flat/easy driveway' : 'Not mentioned',
                measured: `${opts.drivewayGradePercent}% grade (${opts.drivewayCategory})`,
                delta: `${opts.drivewayGradePercent}%`,
                finding: `Approach grade is ${opts.drivewayGradePercent}% — classified Steep. Driveways above 20–25% often require municipal variance. Snow, ice, or heavy rain may make entry/exit difficult.`,
            });
        } else if (opts.drivewayCategory === 'Moderate') {
            flags.push({
                check: 'driveway_grade', severity: 'info',
                listed: 'N/A',
                measured: `${opts.drivewayGradePercent}% grade (Moderate)`,
                delta: `${opts.drivewayGradePercent}%`,
                finding: `Approach grade is ${opts.drivewayGradePercent}%, which is Moderate. Manageable for most vehicles; worth noting for buyers with mobility concerns.`,
            });
        }
    }

    // CHECK 3c: View claim vs elevation data
    if (opts.viewPotential != null && opts.viewDropFt != null) {
        const desc = (opts.description || '').toLowerCase();
        const claimsView = /\b(view|panoramic|vista|overlook|bay view|mountain view|city view|sweeping|scenic)\b/i.test(desc);
        if (claimsView && (opts.viewPotential === 'None' || opts.viewPotential === 'Limited')) {
            flags.push({
                check: 'view_verification', severity: 'warning',
                listed: 'Description claims views',
                measured: `${opts.viewPotential} view potential (${opts.viewDropFt} ft elevation drop at 200ft)`,
                delta: 'N/A',
                finding: `Listing promotes views but terrain drops only ${opts.viewDropFt} ft within 200ft — elevation-based views appear ${opts.viewPotential.toLowerCase()}. Views may be from upper floors or landscaping, not inherent terrain.`,
            });
        } else if (!claimsView && opts.viewPotential === 'High') {
            flags.push({
                check: 'view_verification', severity: 'info',
                listed: 'Not mentioned in description',
                measured: `High view potential (${opts.viewDropFt} ft drop at 200ft)`,
                delta: 'N/A',
                finding: `Terrain drops ${opts.viewDropFt} ft within 200ft — this property likely has significant views that the listing does not mention.`,
            });
        }
    }

    // CHECK 4: Living Sqft — listing vs tax records
    if (opts.listingSqft && opts.taxSqft && opts.listingSqft > 0 && opts.taxSqft > 0) {
        const sqftDiff = ((opts.listingSqft - opts.taxSqft) / opts.taxSqft) * 100;
        const absSqftDiff = Math.abs(sqftDiff);
        if (absSqftDiff > 10) {
            const direction = sqftDiff > 0 ? 'larger' : 'smaller';
            flags.push({
                check: 'living_sqft',
                severity: absSqftDiff > 20 ? 'alert' : 'warning',
                listed: `${opts.listingSqft.toLocaleString()} sqft (listing)`,
                measured: `${opts.taxSqft.toLocaleString()} sqft (tax record)`,
                delta: `${sqftDiff > 0 ? '+' : ''}${sqftDiff.toFixed(1)}%`,
                finding: `Listing sqft is ${absSqftDiff.toFixed(0)}% ${direction} than tax records (${Math.abs(opts.listingSqft - opts.taxSqft).toLocaleString()} sqft difference).${absSqftDiff > 20 ? ' Possible unpermitted addition or conversion.' : ' May indicate enclosed patio, garage conversion, or measurement discrepancy.'}`,
            });
        } else {
            flags.push({
                check: 'living_sqft', severity: 'info',
                listed: `${opts.listingSqft.toLocaleString()} sqft`,
                measured: `${opts.taxSqft.toLocaleString()} sqft (tax record)`,
                delta: `${sqftDiff > 0 ? '+' : ''}${sqftDiff.toFixed(1)}%`,
                finding: 'Living square footage matches tax records within 10%.',
            });
        }
    }

    return flags;
}

export default ParcelValidationCard;
