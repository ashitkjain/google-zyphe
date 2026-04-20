import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, orderBy, getDocs, collectionGroup, doc, getDoc, setDoc, serverTimestamp, addDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../services/firebaseService';
import { runSatellitaryAnalysis, runOrientationViaBatch, forceRefreshAerialSatelliteUrl, forceRefreshAllImagesAndAnalyze, getOrCacheAerialSatelliteUrl, deleteOrientationVersionsForProperty, forceRefreshStreetViewUrl, backfillStreetViewHeadingDeg, extractOrientationFromDescription } from '../../services/satellitaryService';
import { isTargetForOrientationAnalysis } from '../../utils/propertyPolicies';
import { getLatestOrientationVersions, saveManualGroundTruth, fetchFirestoreGroundTruths } from '../../services/firebase/orientation_history';
import { saveOrientationAssessment, OrientationAssessmentValue } from '../../services/firebase/ai_assessment';
import { normalizePropertyFields } from '../../services/firebase/properties';
import { ALL_GROUND_TRUTH, AZIMUTH_FOR_ORIENTATION } from '../../services/orientation_ground_truth_data';

// ─── Local Types ──────────────────────────────────────────────────────────────

interface OrientationRow {
    zpid: string;
    address: string;
    city: string;
    homeType?: string;    // Raw Firestore value e.g. 'SINGLE_FAMILY', 'TOWNHOUSE'
    propertyType: string; // Display label (underscores replaced with spaces)
    previousOrientation?: string;
    mapZoomIn?: string;           // Radar close-up road map
    mapZoomOut?: string;          // Radar wider-area road map
    satelliteImageUrl?: string;   // Google satellite 2× (for orientation analysis)
    streetView?: string;
    orientationAI?: {
        final_orientation: string;
        azimuth_degrees: number | null;
        confidence: 'high' | 'medium' | 'low';
        property_layout_type?: string;
        image_quality?: 'clear' | 'acceptable' | 'blurry';
        aerial_only_mode: boolean;
        feng_shui_vastu?: string | null;
        privacy_insight?: string;
        lot_coverage_hardscape?: number | null;
        lot_coverage_pervious?: number | null;
        buyer_pro?: string;
        buyer_con?: string;
        pool_direction?: string | null;
        garage_direction?: string | null;
        open_sky_direction?: string | null;
        explanation?: string | null;
        is_under_construction?: boolean;
    } | null;
    finalOrientation?: string | null;
    description?: string | null;     // Listing description for description-first optimization
    radarOrientation?: string | null;
    coordinates?: { latitude: number; longitude: number };
    orientationAssessment: OrientationAssessmentValue[];  // multi-select
    assessedAt?: any;        // Firestore Timestamp of last orientation_assessment save
    calculatedAt?: any;      // Firestore Timestamp of last AI orientation calculation
    zip?: string;            // Zip code — needed to build the orientation history path
    /** The very first orientation ever recorded for this property (v1 baseline). */
    firstOrientation?: string;
    /** True when the current AI orientation direction differs from the first-ever recorded version. */
    changedFromFirst: boolean;
    firstAnalyzedAt?: any;    // dateMined of the very first orientation run (proxy for first download)
    isNewProperty?: boolean;  // true when first analyzed ≤5 days ago AND has only one history version
    status: 'idle' | 'running' | 'refreshing' | 'done' | 'error';
    error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────



const getRelativeTime = (date: any): { relative: string; full: string } => {
    if (!date) return { relative: '—', full: '' };
    const d = date instanceof Date ? date : (date?.toDate?.() ?? new Date(date));
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);

    let relative = '';
    if (diffMins < 1) relative = 'just now';
    else if (diffMins < 60) relative = `${diffMins}m ago`;
    else if (diffHrs < 24) relative = `${diffHrs}h ago`;
    else if (diffDays < 7) relative = `${diffDays}d ago`;
    else relative = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const full = d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return { relative, full };
};
const CONF_COLOR: Record<string, string> = {
    high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-rose-50 text-rose-700 border-rose-200',
};

function DirBadge({ label, azimuth, color }: { label: string; azimuth?: number | null; color: string }) {
    return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] font-black uppercase tracking-wider ${color}`}>
            {label}
            {azimuth != null && <span className="opacity-60 font-mono">{azimuth}°</span>}
        </div>
    );
}

function ProgressBar({ label, progress }: { label: string; progress: { done: number; total: number } }) {
    return (
        <div className="bg-white rounded-2xl border border-indigo-100 p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">{label}</span>
                <span className="text-[11px] font-mono text-slate-500">{progress.done} / {progress.total}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-700 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const OrientationAuditTab: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = false }) => {
    const [rows, setRows] = useState<OrientationRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCity, setActiveCity] = useState<string | null>(null);
    const [batchRunning, setBatchRunning] = useState(false);
    const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
    const [redownloadRunning, setRedownloadRunning] = useState(false);
    const [redownloadProgress, setRedownloadProgress] = useState<{ done: number; total: number } | null>(null);
    const [backfillRunning, setBackfillRunning] = useState(false);
    const [backfillProgress, setBackfillProgress] = useState<{ done: number; total: number; found: number } | null>(null);
    const [importGTRunning, setImportGTRunning] = useState(false);
    const [importGTProgress, setImportGTProgress] = useState<{ done: number; total: number } | null>(null);
    const [showMissingOnly, setShowMissingOnly] = useState(false);
    const [showOrientationDiffOnly, setShowOrientationDiffOnly] = useState(false);
    const [showChangedFromFirstOnly, setShowChangedFromFirstOnly] = useState(false);
    const [caseFilter, setCaseFilter] = useState<string>('all');
    const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('all');
    const [gtMatchFilter, setGtMatchFilter] = useState<'all' | 'match' | 'mismatch' | 'unclear'>('all');
    const [explanationPopup, setExplanationPopup] = useState<{ address: string; text: string; fromDescription: boolean; frontStreet?: string | null; satelliteUrl?: string | null; streetViewUrl?: string | null; orientation?: string | null; azimuth?: number | null; streetBearing?: number | null } | null>(null);
    const [firestoreGtByZpid, setFirestoreGtByZpid] = useState<Record<string, { expected_orientation: string; gt_source: string }>>({});
    const [editingGtZpid, setEditingGtZpid] = useState<string | null>(null);
    const [savingGtZpid, setSavingGtZpid] = useState<string | null>(null);

    // ── Fetch all properties + visual analyses ────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [propSnap, visualSnap, assessmentSnap, firestoreGts] = await Promise.all([
                getDocs(query(collection(db, 'properties'), orderBy('address', 'asc'))),
                getDocs(collection(db, 'property_analyses_visual')),
                getDocs(collection(db, 'ai_assessment')),
                fetchFirestoreGroundTruths(),
            ]);
            setFirestoreGtByZpid(firestoreGts);

            const visualOrientationMap: Record<string, string> = {};
            visualSnap.docs.forEach(d => {
                const va = d.data() as any;
                const fo = va?.neighborhood?.orientation?.final_orientation;
                if (fo) visualOrientationMap[d.id] = fo;
            });

            const ALLOWED_CITIES = new Set(['Pleasanton', 'Dublin', 'pleasanton', 'dublin']);

            const activeDocs = propSnap.docs.filter(d => {
                const data = d.data() as any;
                const city = (data.city || '').trim();
                // Exclude deprecated properties
                if (data.deprecated === true || data.deprecated === 'true') return false;
                // Only include Pleasanton and Dublin
                return ALLOWED_CITIES.has(city);
            });

            const zpids = activeDocs.map(d => d.id);
            const historyMap = await getLatestOrientationVersions();

            const orientationAssessmentMap: Record<string, OrientationAssessmentValue[]> = {};
            const assessedAtMap: Record<string, any> = {};
            assessmentSnap.docs.forEach(d => {
                const data = d.data() as any;
                const raw = data?.orientation_assessment;
                if (data?.orientation_assessed_at) assessedAtMap[d.id] = data.orientation_assessed_at;
                if (!raw) return;
                if (Array.isArray(raw)) {
                    orientationAssessmentMap[d.id] = raw as OrientationAssessmentValue[];
                } else if (typeof raw === 'string') {
                    orientationAssessmentMap[d.id] = [raw as OrientationAssessmentValue];
                }
            });

            const built: OrientationRow[] = activeDocs.map(d => {
                const p = normalizePropertyFields(d.data() as any);
                const history = historyMap[d.id];
                const aiOrientation = p.orientation_ai?.final_orientation || null;
                const radarOrientation = visualOrientationMap[d.id] || null;

                // Determine "Previous" value:
                // If history.latest matches current AI (likely just calculated), use history.previous
                // Otherwise use history.latest as the baseline.
                let prevRecord = history?.latest;
                if (aiOrientation && prevRecord && normalizeDir(prevRecord.details.orientation) === normalizeDir(aiOrientation)) {
                    prevRecord = history?.previous;
                }

                // Pre-compute the v1 change flag: compare the LATEST history entry
                // vs the FIRST history entry. `aiOrientation` is always written in sync with
                // `history.latest`, so aiOrient vs firstHist is always the same value —
                // the real check is whether the direction changed across all recorded versions.
                const firstHistoryOrientation = history?.first?.details?.orientation || null;
                const latestHistoryOrientation = history?.latest?.details?.orientation || null;
                const latestDirNorm = latestHistoryOrientation
                    ? latestHistoryOrientation.split(' ')[0].split('(')[0].trim().toLowerCase()
                    : '';
                const firstDirNorm = firstHistoryOrientation
                    ? firstHistoryOrientation.split(' ')[0].split('(')[0].trim().toLowerCase()
                    : '';
                // Need at least 2 history versions AND a direction change to flag as changed
                const changedFromFirst = !!(
                    latestHistoryOrientation &&
                    firstHistoryOrientation &&
                    latestHistoryOrientation !== firstHistoryOrientation &&
                    latestDirNorm && firstDirNorm &&
                    latestDirNorm !== firstDirNorm
                );

                return {
                    zpid: d.id,
                    address: p.address,
                    city: p.city,
                    homeType: p.homeType,
                    propertyType: (p.homeType || 'Unknown').replace(/_/g, ' '),
                    previousOrientation: prevRecord
                        ? `${prevRecord.details.orientation} (v${prevRecord.version})`
                        : undefined,
                    firstOrientation: firstHistoryOrientation,
                    changedFromFirst,
                    mapZoomIn: p.mapZoomIn,
                    mapZoomOut: p.mapZoomOut,
                    satelliteImageUrl: (p.satelliteImageUrl && p.satelliteImageUrl.includes('firebasestorage'))
                        ? p.satelliteImageUrl : undefined,
                    streetView: p.streetView || p.streetViewAnalysis?.imageUrl,
                    description: p.description,
                    orientationAI: p.orientation_ai ? {
                        ...p.orientation_ai,
                        property_layout_type: p.orientation_ai.property_layout_type || p.orientation_ai.layout,
                        explanation: p.orientation_ai.explanation ?? null,
                        is_under_construction: p.orientation_ai.is_under_construction,
                    } : null,
                    finalOrientation: aiOrientation || radarOrientation,
                    radarOrientation: radarOrientation,
                    coordinates: p.coordinates,
                    orientationAssessment: orientationAssessmentMap[d.id] ?? [],
                    assessedAt: assessedAtMap[d.id] ?? null,
                    calculatedAt: p.orientation_calculated_at ?? null,
                    firstAnalyzedAt: history?.first?.dateMined ?? null,
                    isNewProperty: (() => {
                        const first = history?.first?.dateMined;
                        if (!first) return false;
                        const hasMultipleVersions = !!history?.previous;
                        if (hasMultipleVersions) return false;
                        const d = new Date(first);
                        return (Date.now() - d.getTime()) / 86400000 <= 5;
                    })(),
                    zip: history?.latest?.zip || p.zipCode,
                    status: 'idle' as const,
                };
            });

            setRows(built);

            if (!activeCity && built.length > 0) {
                const cityCounts: Record<string, number> = {};
                built.forEach(r => { cityCounts[r.city] = (cityCounts[r.city] || 0) + 1; });
                const sorted = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);
                setActiveCity(sorted[0]?.[0] || null);
            }
        } catch (e) {
            console.error('[OrientationAudit] Failed to fetch properties:', e);
        } finally {
            setLoading(false);
        }
    }, [activeCity]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const normalizeDir = (s: string) => {
        if (!s) return '';
        // Extract "North" from "North (~0°)" or "NORTH (v1)"
        return s.split(' ')[0].split('(')[0].trim().toLowerCase();
    };

    // ── Single-row refresh (targeted — does NOT reload all rows) ─────────────
    // Used after runForRow / forceRefreshForRow so we avoid a full fetchData.
    const refreshRow = useCallback(async (zpid: string) => {
        try {
            const [propSnap, visualSnap, assessmentSnap, historyMap] = await Promise.all([
                getDoc(doc(db, 'properties', zpid)),
                getDoc(doc(db, 'property_analyses_visual', zpid)),
                getDoc(doc(db, 'ai_assessment', zpid)),
                getLatestOrientationVersions(),
            ]);

            if (!propSnap.exists()) return;
            const p = normalizePropertyFields(propSnap.data() as any);
            const history = historyMap[zpid];
            const aiOrientation = p.orientation_ai?.final_orientation || null;
            const radarOrientation = (visualSnap.data() as any)?.neighborhood?.orientation?.final_orientation || null;

            // Rebuild previous/changedFromFirst exactly as fetchData does
            let prevRecord = history?.latest;
            if (aiOrientation && prevRecord && normalizeDir(prevRecord.details.orientation) === normalizeDir(aiOrientation)) {
                prevRecord = history?.previous;
            }
            const firstHist = history?.first?.details?.orientation || null;
            const latestHist = history?.latest?.details?.orientation || null;
            const normFn = (s: string) => s.split(' ')[0].split('(')[0].trim().toLowerCase();
            const changedFromFirst = !!(
                latestHist && firstHist &&
                latestHist !== firstHist &&
                normFn(latestHist) && normFn(firstHist) &&
                normFn(latestHist) !== normFn(firstHist)
            );

            // Rebuild orientationAssessment from ai_assessment doc
            const assessData = assessmentSnap.data() as any;
            let orientationAssessment: OrientationAssessmentValue[] = [];
            const rawAssess = assessData?.orientation_assessment;
            if (Array.isArray(rawAssess)) orientationAssessment = rawAssess;
            else if (typeof rawAssess === 'string') orientationAssessment = [rawAssess as OrientationAssessmentValue];

            setRows(prev => prev.map(r => r.zpid !== zpid ? r : {
                ...r,
                previousOrientation: prevRecord ? `${prevRecord.details.orientation} (v${prevRecord.version})` : undefined,
                firstOrientation: firstHist,
                changedFromFirst,
                orientationAI: p.orientation_ai ? {
                    ...p.orientation_ai,
                    property_layout_type: p.orientation_ai.property_layout_type || p.orientation_ai.layout,
                    explanation: p.orientation_ai.explanation ?? null,
                    is_under_construction: p.orientation_ai.is_under_construction,
                } : null,
                finalOrientation: aiOrientation || radarOrientation,
                radarOrientation: radarOrientation,
                orientationAssessment,
                assessedAt: assessData?.orientation_assessed_at ?? r.assessedAt,
                calculatedAt: p.orientation_calculated_at ?? r.calculatedAt,
                zip: history?.latest?.zip || p.zipCode || r.zip,
                satelliteImageUrl: (p.satelliteImageUrl && p.satelliteImageUrl.includes('firebasestorage'))
                    ? p.satelliteImageUrl : r.satelliteImageUrl,
                streetView: p.streetView || p.streetViewAnalysis?.imageUrl || r.streetView,
                status: 'idle',
            }));
        } catch (e) {
            console.error(`[OrientationAudit] refreshRow failed for ${zpid}:`, e);
        }
    }, [normalizeDir]);

    const [purgeRunning, setPurgeRunning] = useState(false);
    const handlePurgeNonTargets = async () => {
        if (!isAdmin) return;
        const nonTargets = rows.filter(r => !isTargetForOrientationAnalysis(r).target && (r.orientationAI || r.finalOrientation));
        if (nonTargets.length === 0) {
            alert('No properties to purge.');
            return;
        }
        if (!confirm(`${nonTargets.length} ${nonTargets.length === 1 ? 'property' : 'properties'} will have no orientation data after this purge.\n\nProceed?`)) return;

        setPurgeRunning(true);
        try {
            let deleted = 0;
            let failed = 0;
            for (const row of nonTargets) {
                const result = await deleteOrientationVersionsForProperty(row.zpid, row.city, row.zip);
                if (result.deleted) deleted++;
                else failed++;
            }
            await fetchData();
            const failNote = failed > 0 ? ` (${failed} failed)` : '';
            alert(`Purge complete — ${deleted} of ${nonTargets.length} properties cleared.${failNote}`);
        } finally {
            setPurgeRunning(false);
        }
    };

    const cities = useMemo(() => {
        const m: Record<string, number> = {};
        rows.forEach(r => {
            if (isTargetForOrientationAnalysis(r).target) {
                m[r.city] = (m[r.city] || 0) + 1;
            }
        });
        return Object.entries(m)
            .filter(([, c]) => c >= 5)
            .sort((a, b) => b[1] - a[1])
            .map(([name, total]) => ({ name, total }));
    }, [rows]);

    const allCases = useMemo(() => {
        const cases = new Set<string>();
        rows.forEach(r => {
            if (isTargetForOrientationAnalysis(r).target && r.orientationAI?.property_layout_type) {
                cases.add(r.orientationAI.property_layout_type);
            }
        });
        return Array.from(cases).sort();
    }, [rows]);

    const allPropertyTypes = useMemo(() => {
        const types = new Set<string>();
        rows.forEach(r => {
            if (isTargetForOrientationAnalysis(r).target && r.propertyType) {
                types.add(r.propertyType);
            }
        });
        return Array.from(types).sort();
    }, [rows]);

    // Build address-normalised ground truth lookup: zpid → GroundTruthRow
    // Must be declared before filteredRows which references it.
    // Firestore manual overrides (firestoreGtByZpid) take precedence over local static data.
    const groundTruthByZpid = useMemo(() => {
        const norm = (s: string) => s.toLowerCase().replace(/[,.\s]+/g, ' ').trim();
        const addrMap = new Map<string, { expected_orientation: string | null; remark: string; tester_notes: string }>();
        Object.values(ALL_GROUND_TRUTH).forEach(dataset =>
            dataset.forEach(r => addrMap.set(norm(r.address), r))
        );
        const result = new Map<string, { expected_orientation: string | null; remark: string; tester_notes: string; gt_source?: string }>();
        rows.forEach(r => {
            if (!r.zpid) return;
            // Firestore manual GT takes priority over static local data
            const fsGt = firestoreGtByZpid[r.zpid];
            if (fsGt?.expected_orientation) {
                result.set(r.zpid, { expected_orientation: fsGt.expected_orientation, remark: 'Good', tester_notes: '', gt_source: fsGt.gt_source });
                return;
            }
            const gt = addrMap.get(norm(r.address ?? ''));
            if (gt) result.set(r.zpid, gt);
        });
        return result;
    }, [rows, firestoreGtByZpid]);

    const filteredRows = useMemo(() => {
        // Enforce targeting: only show properties that are targets for analysis
        let rs = rows.filter(r => isTargetForOrientationAnalysis(r).target);
        if (activeCity) rs = rs.filter(r => r.city === activeCity);
        if (showMissingOnly) {
            rs = rs.filter(r => r.orientationAssessment.length === 0);
        }
        if (showOrientationDiffOnly) {
            rs = rs.filter(r => {
                if (!r.orientationAI) return false;
                const current = normalizeDir(r.orientationAI.final_orientation);

                // Only count as "changed" if it differs from an existing baseline
                // (Radar or History). If there's no baseline, it's considered "new", not "changed".

                if (r.radarOrientation && normalizeDir(r.radarOrientation) !== current) return true;
                if (r.previousOrientation && normalizeDir(r.previousOrientation) !== current) return true;

                return false;
            });
        }
        if (showChangedFromFirstOnly) {
            rs = rs.filter(r => r.changedFromFirst);
        }
        if (caseFilter !== 'all') {
            rs = rs.filter(r => r.orientationAI?.property_layout_type === caseFilter);
        }
        if (propertyTypeFilter !== 'all') {
            rs = rs.filter(r => r.propertyType === propertyTypeFilter);
        }
        if (gtMatchFilter !== 'all') {
            const xDir = (s: string) => s.split(/[\s(]/)[0].toLowerCase().trim();
            rs = rs.filter(r => {
                // Description-extracted orientation is authoritative — always a match,
                // regardless of GT label, layout type, or any other logic.
                if (extractOrientationFromDescription(r.description)) return gtMatchFilter === 'match';

                const gt = groundTruthByZpid.get(r.zpid);
                if (!gt || !gt.expected_orientation) return false;
                if (!r.orientationAI) return false;
                const aiDir = xDir(r.orientationAI.final_orientation ?? '');
                const isUnderConstruction = !!r.orientationAI?.is_under_construction;
                const isUnclearRow = aiDir === 'unclear' || isUnderConstruction;
                if (gtMatchFilter === 'unclear') return isUnclearRow;
                if (isUnclearRow) return false;
                const match = aiDir === xDir(gt.expected_orientation);
                return gtMatchFilter === 'match' ? match : !match;
            });
        }
        // Always float NEW properties to the top, sorted newest-first within that group.
        // Remaining rows stay in their natural (address-alphabetical) order.
        return rs.slice().sort((a, b) => {
            const aNew = a.isNewProperty ? 1 : 0;
            const bNew = b.isNewProperty ? 1 : 0;
            if (aNew !== bNew) return bNew - aNew; // NEW first
            if (aNew && bNew) {
                // Within the NEW group: most recently analyzed first
                const aTime = a.firstAnalyzedAt ? new Date(a.firstAnalyzedAt?.toDate?.() ?? a.firstAnalyzedAt).getTime() : 0;
                const bTime = b.firstAnalyzedAt ? new Date(b.firstAnalyzedAt?.toDate?.() ?? b.firstAnalyzedAt).getTime() : 0;
                return bTime - aTime;
            }
            return 0; // preserve existing address order for non-new rows
        });
    }, [rows, activeCity, showMissingOnly, showOrientationDiffOnly, showChangedFromFirstOnly, caseFilter, propertyTypeFilter, gtMatchFilter, groundTruthByZpid]);


    const missedProperties = useMemo(() => {
        const now = Date.now();
        const twoHoursAgo = now - (2 * 60 * 60 * 1000);

        return filteredRows.filter(r => {
            // Only count as missed if it IS a target for analysis
            if (!isTargetForOrientationAnalysis(r).target) return false;
            if (!r.coordinates) return false;

            // Only count as missed if it was NEVER calculated OR calculated > 2 hours ago (broken retry)
            const calcAt = r.calculatedAt;
            if (!calcAt) return true;

            // If it has errors, count it as missed so we can retry
            if (r.status === 'error') return true;

            const date = (calcAt as any)?.toDate?.() || (calcAt instanceof Date ? calcAt : new Date(calcAt));
            return date.getTime() < twoHoursAgo;
        });
    }, [filteredRows]);

    const assessmentCounts = useMemo(() => {
        const counts: Record<OrientationAssessmentValue, number> = {
            radar_map: 0, satellite: 0, none: 0, all: 0, geocode: 0,
        };
        for (const row of filteredRows) {
            for (const v of row.orientationAssessment) {
                counts[v] = (counts[v] ?? 0) + 1;
            }
        }
        return counts;
    }, [filteredRows]);

    const assessedCount = useMemo(() =>
        filteredRows.filter(r => r.orientationAssessment.length > 0).length,
        [filteredRows]
    );

    // GT match/mismatch counts for the currently-filtered rows
    const gtStats = useMemo(() => {
        const extractDir = (s: string) => s.split(/[\s(]/)[0].toLowerCase().trim();
        let match = 0, mismatch = 0, unclear = 0, noGt = 0;
        filteredRows.forEach(row => {
            // Description-extracted orientation is authoritative — always a match,
            // regardless of GT label, layout type, or any other logic.
            if (extractOrientationFromDescription(row.description)) { match++; return; }

            const gt = groundTruthByZpid.get(row.zpid);
            if (!gt || !gt.expected_orientation) { noGt++; return; }
            if (!row.orientationAI) { noGt++; return; }
            const aiDir = extractDir(row.orientationAI.final_orientation ?? '');
            const isUnderConstruction = !!row.orientationAI?.is_under_construction;
            if (aiDir === 'unclear' || isUnderConstruction) { unclear++; return; }
            const gtDir = extractDir(gt.expected_orientation);
            if (aiDir && aiDir === gtDir) match++;
            else mismatch++;
        });
        const total = match + mismatch; // unclear excluded from accuracy %
        return { match, mismatch, unclear, noGt, total };
    }, [filteredRows, groundTruthByZpid]);

    const runForRow = async (zpid: string, skipFetch = false) => {
        const row = rows.find(r => r.zpid === zpid);
        if (!row) return;

        const { target, reason } = isTargetForOrientationAnalysis(row);
        if (!target) {
            setRows(prev => prev.map(r => r.zpid === zpid
                ? { ...r, status: 'error', error: reason } : r));
            return;
        }

        if (!row.coordinates) {
            setRows(prev => prev.map(r => r.zpid === zpid
                ? { ...r, status: 'error', error: 'No coordinates' } : r));
            return;
        }
        setRows(prev => prev.map(r => r.zpid === zpid ? { ...r, status: 'running', error: undefined } : r));
        try {
            // Route through the Cloud Function — single source of truth for all analysis logic.
            const result = await runOrientationViaBatch(zpid);
            if (!result) throw new Error('Batch analysis timed out or failed');

            setRows(prev => prev.map(r => r.zpid === zpid ? {
                ...r,
                status: 'done',
                calculatedAt: new Date(),
                finalOrientation: result.final_orientation,
                orientationAI: {
                    final_orientation: result.final_orientation,
                    azimuth_degrees: result.azimuth_degrees,
                    confidence: result.confidence,
                    property_layout_type: result.property_layout_type,
                    image_quality: result.image_quality,
                    aerial_only_mode: result.aerial_only_mode,
                    feng_shui_vastu: result.feng_shui_vastu,
                    privacy_insight: result.privacy_insight,
                    lot_coverage_hardscape: result.lot_coverage_hardscape,
                    lot_coverage_pervious: result.lot_coverage_pervious,
                    buyer_pro: result.buyer_pro,
                    buyer_con: result.buyer_con,
                    explanation: result.explanation ?? null,
                    is_under_construction: result.is_under_construction,
                },
                // Keep existing aerial/sv URLs — CF doesn't return them, they come from property doc
                mapZoomIn: r.mapZoomIn,
                streetView: r.streetView,
            } : r));

        } catch (e: any) {
            setRows(prev => prev.map(r => r.zpid === zpid
                ? { ...r, status: 'error', error: e.message || 'Unknown error' } : r));
        }
    };

    const forceRefreshForRow = async (zpid: string, skipFetch = false) => {
        const row = rows.find(r => r.zpid === zpid);
        if (!row) return;

        const { target, reason } = isTargetForOrientationAnalysis(row);
        if (!target) {
            setRows(prev => prev.map(r => r.zpid === zpid
                ? { ...r, status: 'error', error: reason } : r));
            return;
        }

        if (!row.coordinates) {
            setRows(prev => prev.map(r => r.zpid === zpid
                ? { ...r, status: 'error', error: 'No coordinates' } : r));
            return;
        }
        setRows(prev => prev.map(r => r.zpid === zpid
            ? { ...r, status: 'refreshing', error: undefined } : r));
        try {
            const result = await forceRefreshAllImagesAndAnalyze(
                zpid,
                row.coordinates.latitude,
                row.coordinates.longitude,
                auth?.currentUser?.uid || 'unknown',
                row.address,
                row.description,      // ← enables description-first optimization
                row.homeType,         // ← enables aerial-only townhouse UNCLEAR shortcut
            );
            setRows(prev => prev.map(r => r.zpid === zpid ? {
                ...r,
                status: 'done',
                satelliteImageUrl: result.freshAerialUrl || r.satelliteImageUrl,
                streetView: result.freshStreetViewUrl || r.streetView,
                // Update the displayed orientation immediately — do NOT leave it stale
                finalOrientation: result.final_orientation,
                calculatedAt: new Date(),   // mark as freshly analyzed so missedProperties doesn't re-queue it
                orientationAI: {
                    final_orientation: result.final_orientation,
                    azimuth_degrees: result.azimuth_degrees,
                    confidence: result.confidence,
                    property_layout_type: result.property_layout_type,
                    image_quality: result.image_quality,
                    aerial_only_mode: result.aerial_only_mode,
                    feng_shui_vastu: result.feng_shui_vastu,
                    privacy_insight: result.privacy_insight,
                    lot_coverage_hardscape: result.lot_coverage_hardscape,
                    lot_coverage_pervious: result.lot_coverage_pervious,
                    buyer_pro: result.buyer_pro,
                    buyer_con: result.buyer_con,
                    explanation: result.explanation ?? null,
                    is_under_construction: result.is_under_construction,
                },
            } : r));

            // Re-fetch consistency check
            if (!skipFetch) {
                setTimeout(() => refreshRow(zpid), 500);
            }

        } catch (e: any) {
            setRows(prev => prev.map(r => r.zpid === zpid
                ? { ...r, status: 'error', error: e.message || 'Refresh failed' } : r));
        }
    };

    const handleBatchRun = async () => {
        const targets = filteredRows.filter(r => {
            if (!r.coordinates || r.status === 'running') return false;
            return isTargetForOrientationAnalysis(r).target;
        });
        if (targets.length === 0) return;
        if (!confirm(`Run orientation analysis for ${targets.length} propert${targets.length === 1 ? 'y' : 'ies'} via Cloud Function?`)) return;

        setBatchRunning(true);
        setBatchProgress({ done: 0, total: targets.length });

        // Create a batch job document — the Cloud Function picks it up and runs server-side.
        // Tab-independent: the browser can be closed and the CF continues processing.
        try {
            const jobRef = await addDoc(collection(db, 'orientation_batch_jobs'), {
                zpids:     targets.map(t => t.zpid),
                status:    'queued',
                total:     targets.length,
                done:      0,
                failed:    0,
                userId:    auth?.currentUser?.uid ?? 'unknown',
                createdAt: serverTimestamp(),
            });

            // Subscribe to real-time progress from the Cloud Function.
            const unsubscribe = onSnapshot(jobRef, (snap) => {
                const d = snap.data();
                if (!d) return;
                setBatchProgress({ done: d.done ?? 0, total: targets.length });
                if (d.status === 'completed' || d.status === 'failed') {
                    unsubscribe();
                    setBatchRunning(false);
                    setBatchProgress(null);
                    // Re-sync UI with Firestore results written by the Cloud Function.
                    setTimeout(() => fetchData(), 1500);
                }
            });
        } catch (err) {
            console.error('[Batch] Failed to create batch job:', err);
            setBatchRunning(false);
            setBatchProgress(null);
        }
    };

    const handleCalculateMissed = async () => {
        const now = Date.now();
        const twoHoursAgo = now - (2 * 60 * 60 * 1000);

        const targets = missedProperties.filter(r => r.status !== 'running');

        if (targets.length === 0) {
            alert('No missed properties found in the last 2 hours.');
            return;
        }

        setBatchRunning(true);
        setBatchProgress({ done: 0, total: targets.length });

        // Create a batch job document — the Cloud Function picks it up and runs server-side.
        // Tab-independent: the browser can be closed and the CF continues processing.
        try {
            const jobRef = await addDoc(collection(db, 'orientation_batch_jobs'), {
                zpids:     targets.map(t => t.zpid),
                status:    'queued',
                total:     targets.length,
                done:      0,
                failed:    0,
                userId:    auth?.currentUser?.uid ?? 'unknown',
                createdAt: serverTimestamp(),
            });

            // Subscribe to real-time progress from the Cloud Function.
            const unsubscribe = onSnapshot(jobRef, (snap) => {
                const d = snap.data();
                if (!d) return;
                setBatchProgress({ done: d.done ?? 0, total: targets.length });
                if (d.status === 'completed' || d.status === 'failed') {
                    unsubscribe();
                    setBatchRunning(false);
                    setBatchProgress(null);
                    // Re-sync UI with Firestore results written by the Cloud Function.
                    setTimeout(() => fetchData(), 1500);
                }
            });
        } catch (err) {
            console.error('[Batch] Failed to create batch job:', err);
            setBatchRunning(false);
            setBatchProgress(null);
        }
    };

    const handleRecalculateMismatches = async () => {
        const extractDir = (s: string) => s.split(/[\s(]/)[0].toLowerCase().trim();
        const targets = filteredRows.filter(r => {
            if (!r.coordinates || r.status === 'running') return false;
            const gt = groundTruthByZpid.get(r.zpid);
            if (!gt || !gt.expected_orientation) return false;
            if (!r.orientationAI) return false;
            const aiDir = extractDir(r.orientationAI.final_orientation ?? '');
            if (aiDir === 'unclear') return false;                       // unclear → skip
            if (r.orientationAI?.is_under_construction) return false;    // under construction → skip (counts as unclear)
            const gtDir = extractDir(gt.expected_orientation);
            return aiDir !== gtDir;
        });
        if (targets.length === 0) {
            alert('No mismatch properties found in the current view.');
            return;
        }
        if (!confirm(`Re-run orientation analysis for ${targets.length} mismatch propert${targets.length === 1 ? 'y' : 'ies'}?`)) return;

        setBatchRunning(true);
        setBatchProgress({ done: 0, total: targets.length });

        // Create a batch job document — the Cloud Function picks it up and runs server-side.
        // Tab-independent: the browser can be closed and the CF continues processing.
        try {
            const jobRef = await addDoc(collection(db, 'orientation_batch_jobs'), {
                zpids:     targets.map(t => t.zpid),
                status:    'queued',
                total:     targets.length,
                done:      0,
                failed:    0,
                userId:    auth?.currentUser?.uid ?? 'unknown',
                createdAt: serverTimestamp(),
            });

            // Subscribe to real-time progress from the Cloud Function.
            const unsubscribe = onSnapshot(jobRef, (snap) => {
                const d = snap.data();
                if (!d) return;
                setBatchProgress({ done: d.done ?? 0, total: targets.length });
                if (d.status === 'completed' || d.status === 'failed') {
                    unsubscribe();
                    setBatchRunning(false);
                    setBatchProgress(null);
                    // Re-sync UI with Firestore results written by the Cloud Function.
                    setTimeout(() => fetchData(), 1500);
                }
            });
        } catch (err) {
            console.error('[Batch] Failed to create batch job:', err);
            setBatchRunning(false);
            setBatchProgress(null);
        }
    };

    const handleRedownloadSatellites = async () => {
        const targets = filteredRows.filter(r => r.coordinates);
        if (targets.length === 0) return;
        setRedownloadRunning(true);
        setRedownloadProgress({ done: 0, total: targets.length });
        const CONCURRENCY = 10;
        for (let i = 0; i < targets.length; i += CONCURRENCY) {
            const batch = targets.slice(i, i + CONCURRENCY);
            await Promise.allSettled(
                batch.map(async row => {
                    try {
                        const url = await forceRefreshAerialSatelliteUrl(
                            row.zpid,
                            row.coordinates!.latitude,
                            row.coordinates!.longitude
                        );
                        setRows(prev => prev.map(r =>
                            r.zpid === row.zpid ? { ...r, satelliteImageUrl: url } : r
                        ));
                    } catch (e) {
                        console.warn(`[OrientationAudit] Re-download failed for ${row.zpid}:`, e);
                    }
                })
            );
            setRedownloadProgress({ done: Math.min(i + CONCURRENCY, targets.length), total: targets.length });
        }
        setRedownloadRunning(false);
        setRedownloadProgress(null);
    };

    const handleBackfillHeadings = async () => {
        if (!isAdmin) return;
        // Properties for the active city with a cached Firebase street view URL
        const targets = rows.filter(r => {
            if (activeCity && r.city !== activeCity) return false;
            if (!isTargetForOrientationAnalysis(r).target) return false;
            if (!r.coordinates) return false;
            return !!(r.streetView?.includes('firebasestorage'));
        });

        if (targets.length === 0) {
            alert('No properties with cached street view URLs found for this city.');
            return;
        }

        if (!confirm(
            `Backfill street view headings for ${targets.length} ${activeCity ?? ''} properties?\n\n` +
            `This calls the Maps Street View Metadata API for each property and stores the camera heading in Firestore.` +
            ` No images are re-downloaded.\n\nProceed?`
        )) return;

        setBackfillRunning(true);
        setBackfillProgress({ done: 0, total: targets.length, found: 0 });

        const CONCURRENCY = 8;
        let found = 0;
        for (let i = 0; i < targets.length; i += CONCURRENCY) {
            const batch = targets.slice(i, i + CONCURRENCY);
            const results = await Promise.allSettled(
                batch.map(row => backfillStreetViewHeadingDeg(
                    row.zpid,
                    row.coordinates!.latitude,
                    row.coordinates!.longitude
                ))
            );
            results.forEach(r => { if (r.status === 'fulfilled' && r.value != null) found++; });
            setBackfillProgress({ done: Math.min(i + CONCURRENCY, targets.length), total: targets.length, found });
        }

        setBackfillRunning(false);
        setBackfillProgress(null);
        alert(`✅ Backfill complete — ${found}/${targets.length} headings written.\n${targets.length - found} had no Street View coverage.`);
    };

    const handleImportGroundTruth = async () => {
        if (!isAdmin) return;
        const cityKey = (activeCity ?? 'pleasanton').toLowerCase();
        const dataset = ALL_GROUND_TRUTH[cityKey];
        if (!dataset) { alert(`No ground truth data for city "${cityKey}".`); return; }

        const actionable = dataset.filter(r => r.expected_orientation != null || r.remark !== '');
        if (!confirm(
            `Import ${actionable.length} ground-truth rows for ${activeCity ?? 'this city'} into Firestore?\n\n` +
            `Collection: orientation_ground_truth\nSchema per doc:\n  • address\n  • expected_orientation\n  • test_results[] — remark, ai_assessed_orientation, notes, tester, date\n\nExisting test_results arrays will be preserved.`
        )) return;

        // Build normalised address → zpid map from rows already in state
        const norm = (s: string) => s.toLowerCase().replace(/[,.\s]+/g, ' ').trim();
        const addrToZpid = new Map<string, string>();
        rows.forEach(r => { if (r.zpid) addrToZpid.set(norm(r.address ?? ''), r.zpid); });

        setImportGTRunning(true);
        setImportGTProgress({ done: 0, total: actionable.length });

        let matched = 0, unmatched = 0;
        const unmatchedAddrs: string[] = [];
        const now = new Date().toISOString();

        try {
            for (let i = 0; i < actionable.length; i++) {
                const row = actionable[i];
                const zpid = addrToZpid.get(norm(row.address));
                if (!zpid) {
                    unmatched++;
                    unmatchedAddrs.push(row.address.split(',')[0]);
                } else {
                    const manualResult = {
                        remark:                  row.remark,
                        ai_assessed_orientation: null,
                        notes:                   row.tester_notes,
                        tester:                  'manual' as const,
                        date:                    now,
                    };
                    await setDoc(doc(db, 'orientation_ground_truth', zpid), {
                        zpid,
                        city:                 row.city,
                        address:              row.address,
                        expected_orientation: row.expected_orientation,
                        expected_azimuth_deg: row.expected_orientation
                            ? (AZIMUTH_FOR_ORIENTATION[row.expected_orientation] ?? null)
                            : null,
                        test_results: [manualResult],
                    }, { merge: false });
                    matched++;
                }
                setImportGTProgress({ done: i + 1, total: actionable.length });
            }
            const unmatchedMsg = unmatched > 0 ? `\n\nUnmatched (${unmatched}): ${unmatchedAddrs.join(', ')}` : '';
            alert(`✅ Import complete — ${matched}/${actionable.length} written.${unmatchedMsg}`);
        } catch (err: any) {
            console.error('Import ground truth failed:', err);
            alert(`❌ Import failed after ${matched} writes.\n\nError: ${err?.message ?? String(err)}\n\nCheck Firestore rules — orientation_ground_truth may need write access.`);
        } finally {
            setImportGTRunning(false);
            setImportGTProgress(null);
        }
    };

    return (
        <>
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-slate-900">Orientation Audit</h2>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        Estimated orientation based on AI satellite analysis, geocoding, and cached data — results are indicative, not definitive
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {isAdmin && (
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-40"
                            title="Refresh data"
                        >
                            <i className={`fa-solid fa-arrows-rotate text-xs ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    )}
                    <button
                        onClick={() => setShowMissingOnly(!showMissingOnly)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-sm border ${showMissingOnly
                            ? 'bg-rose-50 border-rose-200 text-rose-700'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                        title="Toggle: show only properties needing assessment"
                    >
                        <i className={`fa-solid ${showMissingOnly ? 'fa-filter-circle-xmark' : 'fa-filter'} text-xs`} />
                        {showMissingOnly ? 'Missing Assessment' : 'Filter Missing'}
                    </button>

                    <button
                        onClick={() => setShowOrientationDiffOnly(!showOrientationDiffOnly)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-sm border ${showOrientationDiffOnly
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                        title="Toggle: show properties where current AI orientation differs from history"
                    >
                        <i className={`fa-solid fa-code-compare text-xs`} />
                        {showOrientationDiffOnly ? 'Orientation Changed' : 'Filter Changed'}
                    </button>

                    {/* ── Changed from V1 filter (matches pink-highlighted rows) ── */}
                    {(() => {
                        const v1ChangedCount = (activeCity ? rows.filter(r => r.city === activeCity) : rows)
                            .filter(r => r.changedFromFirst).length;
                        return (
                            <button
                                onClick={() => setShowChangedFromFirstOnly(!showChangedFromFirstOnly)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-sm border ${showChangedFromFirstOnly
                                    ? 'bg-pink-50 border-pink-300 text-pink-700'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-pink-50 hover:border-pink-200 hover:text-pink-600'
                                    }`}
                                title="Show only properties where orientation changed from the first-ever recorded version (v1 baseline)"
                            >
                                <i className="fa-solid fa-arrow-rotate-left text-xs" />
                                {showChangedFromFirstOnly ? `Showing V1 Changed (${v1ChangedCount})` : `V1 Changed (${v1ChangedCount})`}
                            </button>
                        );
                    })()}

                    {/* ── GT result filter ── */}
                    <div className="flex items-center gap-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        {(['all', 'match', 'mismatch', 'unclear'] as const).map((v, i) => {
                            const active = gtMatchFilter === v;
                            const colors = {
                                all:      active ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50',
                                match:    active ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700',
                                mismatch: active ? 'bg-rose-500 text-white'    : 'text-slate-500 hover:bg-rose-50 hover:text-rose-700',
                                unclear:  active ? 'bg-amber-400 text-white'   : 'text-slate-500 hover:bg-amber-50 hover:text-amber-700',
                            }[v];
                            const label = { all: 'GT: All', match: '✓ Match', mismatch: '✗ Mismatch', unclear: '? Unclear' }[v];
                            const title = { all: 'Show all properties', match: 'GT match only', mismatch: 'GT mismatch only', unclear: 'GT unclear only' }[v];
                            return (
                                <button
                                    key={v}
                                    onClick={() => setGtMatchFilter(v)}
                                    title={title}
                                    className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${colors} ${i > 0 ? 'border-l border-slate-100' : ''}`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Case:</span>
                        <select
                            value={caseFilter}
                            onChange={(e) => setCaseFilter(e.target.value)}
                            className="bg-transparent text-[11px] font-black text-slate-700 uppercase tracking-tight focus:outline-none cursor-pointer"
                        >
                            <option value="all">All Cases</option>
                            {allCases.map(c => (
                                <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Type:</span>
                        <select
                            value={propertyTypeFilter}
                            onChange={(e) => setPropertyTypeFilter(e.target.value)}
                            className="bg-transparent text-[11px] font-black text-slate-700 uppercase tracking-tight focus:outline-none cursor-pointer"
                        >
                            <option value="all">All Types</option>
                            {allPropertyTypes.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>

                    {isAdmin && (
                        <button
                            onClick={handleRedownloadSatellites}
                            disabled={redownloadRunning || batchRunning || loading || filteredRows.filter(r => r.coordinates).length === 0}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                            title="Force re-download all satellite images for this city (ignores cache)"
                        >
                            {redownloadRunning ? (
                                <>
                                    <i className="fa-solid fa-spinner animate-spin text-xs" />
                                    {redownloadProgress ? `${redownloadProgress.done}/${redownloadProgress.total}` : 'Downloading…'}
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-satellite text-xs" />
                                    Refresh city images
                                </>
                            )}
                        </button>
                    )}

                    {isAdmin && (
                        <>
                            <button
                                onClick={handleBatchRun}
                                disabled={batchRunning || redownloadRunning || loading || filteredRows.length === 0}
                                className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-slate-800 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg hover:scale-[1.03] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                {batchRunning ? (
                                    <>
                                        <i className="fa-solid fa-spinner animate-spin text-xs" />
                                        {batchProgress ? `${batchProgress.done}/${batchProgress.total}` : 'Running…'}
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-satellite-dish text-xs" />
                                        Calculate All ({filteredRows.filter(r => r.coordinates).length})
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleCalculateMissed}
                                disabled={batchRunning || redownloadRunning || loading || filteredRows.length === 0}
                                className="flex items-center gap-2.5 px-5 py-2.5 bg-white border-2 border-slate-800 text-slate-800 rounded-xl font-black text-[11px] uppercase tracking-widest shadow hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Recalculate only for properties not updated in the last 2 hours"
                            >
                                <i className="fa-solid fa-clock-rotate-left text-xs" />
                                Resume / Fix Missed {missedProperties.length > 0 && `(${missedProperties.length})`}
                            </button>

                            {/* Re-run only GT mismatch properties */}
                            <button
                                onClick={handleRecalculateMismatches}
                                disabled={batchRunning || redownloadRunning || loading || gtStats.mismatch === 0}
                                className="flex items-center gap-2.5 px-5 py-2.5 bg-rose-50 border-2 border-rose-400 text-rose-600 rounded-xl font-black text-[11px] uppercase tracking-widest shadow hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Re-run orientation analysis only for properties whose AI result doesn't match tester ground truth"
                            >
                                <i className="fa-solid fa-arrows-rotate text-xs" />
                                Fix Mismatches {gtStats.mismatch > 0 && `(${gtStats.mismatch})`}
                            </button>

                        {/* Backfill street view headings — metadata only, no image re-download */}
                            <button
                                onClick={handleBackfillHeadings}
                                disabled={batchRunning || redownloadRunning || backfillRunning || loading}
                                className="flex items-center gap-2 px-4 py-2.5 bg-teal-50 border border-teal-200 text-teal-700 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-teal-600 hover:text-white hover:border-teal-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                                title="Populate streetViewHeadingDeg for all cached street view properties — enables wrong-road cache fallback"
                            >
                                {backfillRunning ? (
                                    <>
                                        <i className="fa-solid fa-spinner animate-spin text-xs" />
                                        {backfillProgress
                                            ? `${backfillProgress.done}/${backfillProgress.total} (✓${backfillProgress.found})`
                                            : 'Backfilling…'}
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-compass text-xs" />
                                        Backfill SV Headings
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handlePurgeNonTargets}
                                disabled={purgeRunning || loading}
                                className="flex items-center gap-2.5 px-5 py-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all disabled:opacity-40"
                            >
                                {purgeRunning ? (
                                    <i className="fa-solid fa-spinner animate-spin" />
                                ) : (
                                    <i className="fa-solid fa-trash-can" />
                                )}
                                Purge Non-Targets
                            </button>

                            {/* Import tester ground truth into orientation_ground_truth collection */}
                            <button
                                onClick={handleImportGroundTruth}
                                disabled={importGTRunning || batchRunning || loading}
                                className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 border border-violet-200 text-violet-700 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-violet-600 hover:text-white hover:border-violet-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                                title="Write tester-verified orientations to orientation_ground_truth Firestore collection"
                            >
                                {importGTRunning ? (
                                    <>
                                        <i className="fa-solid fa-spinner animate-spin text-xs" />
                                        {importGTProgress ? `${importGTProgress.done}/${importGTProgress.total}` : 'Importing…'}
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-database text-xs" />
                                        Import Ground Truth
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {cities.map(c => (
                    <button
                        key={c.name}
                        onClick={() => setActiveCity(c.name)}
                        className={`px-5 py-2.5 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all border flex-shrink-0
                            ${activeCity === c.name
                                ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                    >
                        {c.name}
                        <span className={`ml-2 text-[9px] ${activeCity === c.name ? 'text-slate-400' : 'text-slate-300'}`}>
                            {c.total}
                        </span>
                    </button>
                ))}
            </div>

            {batchProgress && (
                <ProgressBar label="Calculating satellite orientations…" progress={batchProgress} />
            )}

            {redownloadProgress && (
                <ProgressBar label="Re-downloading satellite images…" progress={redownloadProgress} />
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32">
                    <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading properties…</p>
                </div>
            ) : (
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">Assessment counts</span>
                            {([
                                { v: 'radar_map' as OrientationAssessmentValue, label: 'Radar Map', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
                                { v: 'satellite' as OrientationAssessmentValue, label: 'Satellite', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400' },
                                { v: 'geocode' as OrientationAssessmentValue, label: 'Geocode', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-400' },
                                { v: 'none' as OrientationAssessmentValue, label: 'None', bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-400' },
                                { v: 'all' as OrientationAssessmentValue, label: 'All', bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-400' },
                            ]).map(({ v, label, bg, text, border, dot }) => {
                                const count = assessmentCounts[v];
                                const pct = filteredRows.length > 0 ? Math.round((count / filteredRows.length) * 100) : 0;
                                return (
                                    <div
                                        key={v}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${bg} ${border} transition-all`}
                                    >
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                                        <span className={`text-[9px] font-black uppercase tracking-wide ${text}`}>{label}</span>
                                        <span className={`text-[11px] font-black ${text}`}>{count}</span>
                                        <span className={`text-[8px] font-semibold opacity-60 ${text}`}>{pct}%</span>
                                    </div>
                                );
                            })}
                            {/* GT match / mismatch / unclear pills */}
                            {(gtStats.total > 0 || gtStats.unclear > 0 || gtStats.noGt > 0) && (
                                <>
                                    <span className="text-slate-200">|</span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">GT</span>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-emerald-50 border-emerald-200">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                                        <span className="text-[9px] font-black uppercase tracking-wide text-emerald-700">Match</span>
                                        <span className="text-[11px] font-black text-emerald-700">{gtStats.match}</span>
                                        {gtStats.total > 0 && (
                                            <span className="text-[8px] font-semibold opacity-60 text-emerald-700">
                                                {Math.round((gtStats.match / gtStats.total) * 100)}%
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-rose-50 border-rose-200">
                                        <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0" />
                                        <span className="text-[9px] font-black uppercase tracking-wide text-rose-600">Mismatch</span>
                                        <span className="text-[11px] font-black text-rose-600">{gtStats.mismatch}</span>
                                        {gtStats.total > 0 && (
                                            <span className="text-[8px] font-semibold opacity-60 text-rose-600">
                                                {Math.round((gtStats.mismatch / gtStats.total) * 100)}%
                                            </span>
                                        )}
                                    </div>
                                    {gtStats.unclear > 0 && (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-amber-50 border-amber-200">
                                            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                                            <span className="text-[9px] font-black uppercase tracking-wide text-amber-700">Unclear</span>
                                            <span className="text-[11px] font-black text-amber-700">{gtStats.unclear}</span>
                                        </div>
                                    )}
                                    {gtStats.noGt > 0 && (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-indigo-50 border-indigo-200">
                                            <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                                            <span className="text-[9px] font-black uppercase tracking-wide text-indigo-700">New</span>
                                            <span className="text-[11px] font-black text-indigo-700">{gtStats.noGt}</span>
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="ml-auto flex items-center gap-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <span>
                                    <span className="text-slate-600">{assessedCount}</span> / {filteredRows.length} assessed
                                </span>
                                <span className="text-slate-200">|</span>
                                <span>
                                    <span className="text-slate-600">{(Object.values(assessmentCounts) as number[]).reduce((a, b) => a + b, 0)}</span> total assessments
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[1200px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-10">#</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[140px]">Property</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[100px]">Type</th>

                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center min-w-[100px]">Satellite</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center min-w-[100px]">Street View</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[110px]">Case</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[120px]">Latest AI</th>
                                    <th className="p-5 text-[10px] font-black text-violet-400 uppercase tracking-widest min-w-[110px]">GT Expected</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[200px]">Explanation</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[100px]">Prev AI</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[100px]">Calculated</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[100px]">Audited</th>
                                    {isAdmin && <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right min-w-[100px]">Action</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={12} className="py-24 text-center">
                                            <i className="fa-solid fa-folder-open text-4xl text-slate-100 mb-3 block" />
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No properties in this city</p>
                                        </td>
                                    </tr>
                                ) : filteredRows.map((row, idx) => {
                                    return (
                                        <tr
                                            key={row.zpid}
                                            className={`group transition-colors ${(row.status === 'running' || row.status === 'refreshing') ? 'animate-pulse' : ''
                                                } ${row.changedFromFirst
                                                    ? 'bg-pink-50/60 border-b border-slate-100 border-l-2 border-l-pink-400'
                                                    : 'bg-white border-b border-slate-100 hover:bg-slate-50/40'
                                                }`}
                                        >
                                            <td className="p-5 text-center w-10">
                                                <span className="text-[11px] font-black text-slate-300 font-mono">{idx + 1}</span>
                                            </td>
                                            <td className="p-5">
                                                <a
                                                    href={`/?zpid=${row.zpid}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[11px] font-black text-indigo-700 hover:text-indigo-500 hover:underline leading-tight line-clamp-2 transition-colors"
                                                    title="Open in Explore"
                                                >
                                                    {row.address}
                                                </a>
                                                <div className="text-[9px] font-mono text-slate-400 mt-0.5">{row.zpid}</div>
                                                {row.status === 'error' && (
                                                    <div className="text-[9px] text-rose-500 font-bold mt-1 truncate max-w-[120px]">{row.error}</div>
                                                )}
                                                {row.status === 'done' && (
                                                    <div className="text-[9px] text-emerald-600 font-black mt-1">✓ Updated</div>
                                                )}
                                                {row.status === 'refreshing' && (
                                                    <div className="text-[9px] text-indigo-500 font-black mt-1">↻ Refreshing…</div>
                                                )}
                                                {row.isNewProperty && (() => {
                                                    const lu = row.firstAnalyzedAt;
                                                    if (!lu) return null;
                                                    const d = lu?.toDate?.() ?? (lu instanceof Date ? lu : new Date(lu));
                                                    const daysAgo = (Date.now() - d.getTime()) / 86400000;
                                                    const label = daysAgo < 1
                                                        ? `${Math.floor(daysAgo * 24)}h ago`
                                                        : `${Math.floor(daysAgo)}d ago`;
                                                    return (
                                                        <span
                                                            title={`First analyzed ${label}`}
                                                            className="inline-flex items-center gap-0.5 mt-1.5 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest"
                                                        >
                                                            ✦ NEW
                                                        </span>
                                                    );
                                                })()}
                                            </td>

                                            <td className="p-5">
                                                <div className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{row.propertyType}</div>
                                            </td>



                                            {/* Satellite */}
                                            <td className="p-5 text-center">
                                                <MapThumb url={row.satelliteImageUrl} label="Satellite" orientations={{
                                                    ...row,
                                                    selectedAssessment: row.orientationAssessment,
                                                    onSelectAssessment: (v) => {
                                                        const next = row.orientationAssessment.includes(v)
                                                            ? row.orientationAssessment.filter(x => x !== v)
                                                            : [...row.orientationAssessment, v];
                                                        setRows(prev => prev.map(r => r.zpid === row.zpid ? { ...r, orientationAssessment: next } : r));
                                                        saveOrientationAssessment(row.zpid, next).catch(console.error);
                                                    },
                                                }} onRefreshUrl={(newUrl) => {
                                                    setRows(prev => prev.map(r => r.zpid === row.zpid ? { ...r, satelliteImageUrl: newUrl } : r));
                                                }} />
                                            </td>

                                            {/* Street view */}
                                            <td className="p-5 text-center">
                                                <MapThumb url={row.streetView} label="Street View" orientations={{
                                                    ...row,
                                                    selectedAssessment: row.orientationAssessment,
                                                    onSelectAssessment: (v) => {
                                                        const next = row.orientationAssessment.includes(v)
                                                            ? row.orientationAssessment.filter(x => x !== v)
                                                            : [...row.orientationAssessment, v];
                                                        setRows(prev => prev.map(r => r.zpid === row.zpid ? { ...r, orientationAssessment: next } : r));
                                                        saveOrientationAssessment(row.zpid, next).catch(console.error);
                                                    },
                                                }} onRefreshUrl={(newUrl) => {
                                                    setRows(prev => prev.map(r => r.zpid === row.zpid ? { ...r, streetView: newUrl } : r));
                                                }} />
                                            </td>

                                            {/* Orientation Case */}
                                            <td className="p-5">
                                                {row.orientationAI?.property_layout_type ? (
                                                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-indigo-100 bg-indigo-50/50 text-indigo-600 text-[10px] font-black uppercase tracking-tight">
                                                        {row.orientationAI.property_layout_type.replace(/_/g, ' ')}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-200 font-bold">—</span>
                                                )}
                                            </td>



                                            {/* AI orientation */}
                                            <td className="p-5">
                                                {row.orientationAI ? (
                                                    <div className="space-y-1.5">
                                                        {row.orientationAI.final_orientation === 'UNDER_CONSTRUCTION' || row.orientationAI.is_under_construction ? (
                                                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl border text-[10px] font-black bg-amber-50 text-amber-600 border-amber-200">
                                                                <i className="fa-solid fa-person-digging text-[8px]" />
                                                                Under Construction
                                                            </div>
                                                        ) : row.orientationAI.image_quality === 'blurry' ? (
                                                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl border text-[10px] font-black bg-slate-100 text-slate-400 border-slate-200">
                                                                <i className="fa-solid fa-eye-slash text-[8px]" />
                                                                Unclear Image
                                                            </div>
                                                        ) : (
                                                            <DirBadge
                                                                label={`~${row.orientationAI.final_orientation}`}
                                                                azimuth={row.orientationAI.azimuth_degrees}
                                                                color="bg-indigo-50 text-indigo-700 border-indigo-200"
                                                            />
                                                        )}
                                                        <div className="flex items-center gap-1 flex-wrap">
                                                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${CONF_COLOR[row.orientationAI.confidence]}`}>
                                                                {row.orientationAI.confidence}
                                                            </div>
                                                            {row.orientationAI.image_quality && row.orientationAI.image_quality !== 'clear' && (
                                                                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${row.orientationAI.image_quality === 'blurry'
                                                                    ? 'bg-slate-100 text-slate-400 border-slate-200'
                                                                    : 'bg-amber-50 text-amber-600 border-amber-200'
                                                                    }`}>
                                                                    {row.orientationAI.image_quality}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {row.orientationAI.aerial_only_mode && (
                                                            <div className="text-[9px] text-amber-600 font-black">aerial only</div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-300 font-bold">—</span>
                                                )}
                                            </td>

                                            {/* GT Expected — tester-verified ground truth */}
                                            <td className="p-5">
                                                {(() => {
                                                    const gt = groundTruthByZpid.get(row.zpid);
                                                    const aiOrientation = row.orientationAI?.final_orientation ?? '';
                                                    const extractDir = (s: string) => s.split(/[\s(]/)[0].toLowerCase().trim();
                                                    const aiDir = extractDir(aiOrientation);
                                                    const fromDescription = !!extractOrientationFromDescription(row.description);
                                                    const isUnclear = !fromDescription && (aiDir === 'unclear' || !!row.orientationAI?.is_under_construction);
                                                    const matches = gt?.expected_orientation ? (fromDescription || (!isUnclear && aiDir === extractDir(gt.expected_orientation))) : false;
                                                    const isGood = gt?.remark === 'Good';
                                                    const isManual = gt?.gt_source === 'manual';
                                                    const isEditing = editingGtZpid === row.zpid;
                                                    const isSaving = savingGtZpid === row.zpid;
                                                    const DIRECTIONS = ['North','Northeast','East','Southeast','South','Southwest','West','Northwest','UNCLEAR'];

                                                    const handleSaveGt = async (newDir: string) => {
                                                        setSavingGtZpid(row.zpid);
                                                        setEditingGtZpid(null);
                                                        try {
                                                            await saveManualGroundTruth({
                                                                zpid: row.zpid,
                                                                city: row.city,
                                                                zip: row.zip ?? '',
                                                                address: row.address,
                                                                orientation: newDir,
                                                            });
                                                            setFirestoreGtByZpid(prev => ({ ...prev, [row.zpid]: { expected_orientation: newDir, gt_source: 'manual' } }));
                                                        } catch { /* error logged in service */ }
                                                        finally { setSavingGtZpid(null); }
                                                    };

                                                    if (isEditing) {
                                                        return (
                                                            <div className="flex flex-col gap-1">
                                                                <select
                                                                    autoFocus
                                                                    className="text-[10px] font-bold border border-indigo-300 rounded-lg px-1.5 py-1 bg-white text-slate-700 cursor-pointer"
                                                                    defaultValue={gt?.expected_orientation ?? ''}
                                                                    onChange={e => { if (e.target.value) handleSaveGt(e.target.value); }}
                                                                    onBlur={() => setEditingGtZpid(null)}
                                                                >
                                                                    <option value="">— pick direction —</option>
                                                                    {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                                                </select>
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div className="space-y-1 group">
                                                            {gt?.expected_orientation ? (
                                                                <>
                                                                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-xl border text-[10px] font-black ${
                                                                        isGood ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'
                                                                    }`}>
                                                                        <i className={`fa-solid ${isGood ? 'fa-circle-check' : 'fa-circle-xmark'} text-[8px]`} />
                                                                        {gt.expected_orientation}
                                                                        {isManual && <i className="fa-solid fa-pen-to-square text-[7px] opacity-50" title="manually set" />}
                                                                    </div>
                                                                    {row.orientationAI && (
                                                                        <div className={`text-[9px] font-black ${
                                                                            isUnclear ? 'text-amber-500' : matches ? 'text-emerald-600' : 'text-rose-500'
                                                                        }`}>
                                                                            {isUnclear ? '? unclear' : matches ? '✓ match' : '✗ mismatch'}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-300 font-bold">—</span>
                                                            )}
                                                            <button
                                                                onClick={() => setEditingGtZpid(row.zpid)}
                                                                disabled={isSaving}
                                                                className="hidden group-hover:flex items-center gap-1 text-[9px] text-indigo-500 font-bold hover:text-indigo-700 transition-colors"
                                                                title="Edit expected orientation"
                                                            >
                                                                {isSaving ? <i className="fa-solid fa-spinner fa-spin text-[8px]" /> : <i className="fa-solid fa-pencil text-[8px]" />}
                                                                {isSaving ? 'saving…' : 'edit GT'}
                                                            </button>
                                                        </div>
                                                    );
                                                })()}
                                            </td>

                                            {/* Explanation */}
                                            <td className="p-5">
                                                {(() => {
                                                    const explanation = row.orientationAI?.explanation;
                                                    const privacyInsight = row.orientationAI?.privacy_insight;
                                                    
                                                    // Detection logic for "From description"
                                                    const isFromDescription = 
                                                        explanation?.startsWith('Orientation extracted') || 
                                                        privacyInsight?.startsWith('Not assessed — orientation sourced');
                                                        
                                                    let displayText = "";
                                                    let isLegacyGemini = false;

                                                    if (isFromDescription) {
                                                        displayText = "Orientation extracted from description";
                                                    } else if (explanation) {
                                                        displayText = explanation;
                                                    } else if (row.orientationAI) {
                                                        displayText = "AI reasoning not captured (Legacy)";
                                                        isLegacyGemini = true;
                                                    } else {
                                                        displayText = "—";
                                                    }
                                                    
                                                    if (displayText === "—") return <span className="text-[10px] text-slate-200 font-bold">—</span>;

                                                    const words = displayText.split(' ');
                                                    const preview = words.slice(0, 10).join(' ') + (words.length > 10 ? '…' : '');
                                                    const fullText = explanation || privacyInsight || (isLegacyGemini ? 'This record was created before the explanation field was persisted.' : displayText);

                                                    return (
                                                        <button
                                                            onClick={() => setExplanationPopup({ address: row.address, text: fullText, fromDescription: !!isFromDescription, frontStreet: (row.orientationAI as any)?.front_street_name ?? null, satelliteUrl: row.satelliteImageUrl ?? null, streetViewUrl: row.streetView ?? null, orientation: row.orientationAI?.final_orientation ?? null, azimuth: row.orientationAI?.azimuth_degrees ?? null, streetBearing: (row.orientationAI as any)?.street_bearing_deg ?? (row.orientationAI as any)?._debug?.streetBearing ?? null })}
                                                            className={`text-[10px] leading-snug text-left hover:underline underline-offset-2 ${
                                                                isFromDescription ? 'text-violet-600 font-black' : (isLegacyGemini ? 'text-slate-400 italic' : 'text-slate-600')
                                                            }`}
                                                        >
                                                            {isFromDescription && <i className="fa-solid fa-align-left text-[8px] mr-1" />}
                                                            {preview}
                                                        </button>
                                                    );
                                                })()}
                                            </td>

                                            {/* Last Result History — shows first baseline + prev version */}
                                            <td className="p-5">
                                                <div className="space-y-1">
                                                    {/* v1 baseline badge — only shown when it differs from current */}
                                                    {row.changedFromFirst && (
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[8px] font-black text-pink-500 uppercase tracking-widest whitespace-nowrap">v1 was</span>
                                                            <div className="inline-flex items-center px-2 py-0.5 bg-pink-100 border border-pink-300 text-pink-700 text-[10px] font-black uppercase rounded-lg">
                                                                {row.firstOrientation}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {/* Previous version (penultimate) */}
                                                    {row.previousOrientation ? (
                                                        <div className="inline-flex items-center px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-400 text-[10px] font-black uppercase rounded-lg">
                                                            {row.previousOrientation}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] font-black text-slate-200 italic">No history</span>
                                                    )}
                                                </div>
                                            </td>



                                            {/* Calculated At */}
                                            <td className="p-5">
                                                <div className="flex items-center gap-2">
                                                    {(() => {
                                                        const { relative, full } = getRelativeTime(row.calculatedAt);
                                                        return relative === '—' ? (
                                                            <span className="text-[10px] text-slate-200 font-bold">—</span>
                                                        ) : (
                                                            <span title={full} className="text-[10px] font-semibold text-emerald-600 cursor-default whitespace-nowrap">
                                                                {relative}
                                                            </span>
                                                        );
                                                    })()}

                                                    {isAdmin && row.coordinates && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                runForRow(row.zpid);
                                                            }}
                                                            disabled={row.status === 'running' || row.status === 'refreshing' || batchRunning}
                                                            className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all disabled:opacity-30"
                                                            title="Rerun orientation analysis"
                                                        >
                                                            <i className={`fa-solid fa-rotate text-[10px] ${(row.status === 'running') ? 'animate-spin' : ''}`} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Last Assessed */}
                                            <td className="p-5">
                                                {(() => {
                                                    const { relative, full } = getRelativeTime(row.assessedAt);
                                                    return relative === '—' ? (
                                                        <span className="text-[10px] text-slate-200 font-bold">—</span>
                                                    ) : (
                                                        <span title={full} className="text-[10px] font-semibold text-slate-500 cursor-default whitespace-nowrap">
                                                            {relative}
                                                        </span>
                                                    );
                                                })()}
                                            </td>

                                            {/* Action — admin only */}
                                            {isAdmin && (
                                                <td className="p-5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {/* Force-refresh: delete images → re-download → re-analyze */}
                                                        <button
                                                            onClick={() => forceRefreshForRow(row.zpid)}
                                                            disabled={row.status === 'running' || row.status === 'refreshing' || batchRunning || !row.coordinates}
                                                            title={!row.coordinates ? 'No coordinates available' : 'Force-refresh: delete cached images, re-download, and re-run orientation analysis'}
                                                            className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                        >
                                                            {row.status === 'refreshing'
                                                                ? <i className="fa-solid fa-spinner animate-spin text-xs" />
                                                                : <i className="fa-solid fa-arrows-rotate text-xs" />}
                                                        </button>
                                                        {/* Run analysis only (uses existing cached images) */}
                                                        <button
                                                            onClick={() => runForRow(row.zpid)}
                                                            disabled={row.status === 'running' || row.status === 'refreshing' || batchRunning || !row.coordinates}
                                                            title={!row.coordinates ? 'No coordinates available' : 'Run orientation analysis (uses existing cached images)'}
                                                            className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                        >
                                                            {row.status === 'running'
                                                                ? <i className="fa-solid fa-spinner animate-spin text-xs" />
                                                                : <i className="fa-solid fa-rotate text-xs" />}
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>

            {/* ── Explanation popup modal ─────────────────────────────────── */}
            {explanationPopup && (
                <div
                    className="fixed inset-0 z-[300] flex items-center justify-center p-4"
                    onClick={() => setExplanationPopup(null)}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />

                    {/* Panel */}
                    <div
                        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className={`px-5 py-4 flex items-start justify-between gap-3 border-b border-slate-100 ${explanationPopup.fromDescription ? 'bg-violet-50' : 'bg-slate-50'}`}>
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                                    {explanationPopup.fromDescription ? (
                                        <span className="text-violet-600"><i className="fa-solid fa-align-left mr-1" />From Listing Description</span>
                                    ) : (
                                        <span><i className="fa-solid fa-brain mr-1 text-indigo-400" />AI Reasoning</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="text-[13px] font-black text-slate-800 leading-snug">{explanationPopup.address}</div>
                                    {explanationPopup.orientation && explanationPopup.orientation !== 'UNCLEAR' && (
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-wide shadow-sm">
                                            <i className="fa-solid fa-compass text-[9px]" />
                                            {explanationPopup.orientation}
                                            {explanationPopup.azimuth != null && (
                                                <span className="opacity-70 font-semibold text-[10px]">~{Math.round(explanationPopup.azimuth)}°</span>
                                            )}
                                        </div>
                                    )}
                                    {explanationPopup.orientation === 'UNCLEAR' && (
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-100 text-amber-700 border border-amber-200 text-[11px] font-black uppercase tracking-wide">
                                            <i className="fa-solid fa-circle-question text-[9px]" />
                                            UNCLEAR
                                        </div>
                                    )}
                                </div>
                                {explanationPopup.frontStreet && (
                                    <div className="mt-1">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                            <i className="fa-solid fa-road text-[8px]" />
                                            Via {explanationPopup.frontStreet}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setExplanationPopup(null)}
                                className="shrink-0 w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm"
                            >
                                <i className="fa-solid fa-xmark text-slate-400 text-xs" />
                            </button>
                        </div>

                        {/* Images */}
                        {(explanationPopup.satelliteUrl || explanationPopup.streetViewUrl) && (
                            <div className="grid grid-cols-2 gap-0 border-b border-slate-100">
                                {explanationPopup.satelliteUrl ? (
                                    <div className="relative">
                                        <img
                                            src={explanationPopup.satelliteUrl}
                                            alt="Satellite"
                                            className="w-full h-44 object-cover"
                                        />
                                        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-slate-900/70 text-white text-[9px] font-black uppercase tracking-widest rounded-md">Satellite</span>
                                    </div>
                                ) : (
                                    <div className="h-44 bg-slate-50 flex items-center justify-center">
                                        <span className="text-[9px] text-slate-300 font-bold">No satellite</span>
                                    </div>
                                )}
                                {explanationPopup.streetViewUrl ? (
                                    <div className="relative border-l border-slate-100">
                                        <img
                                            src={explanationPopup.streetViewUrl}
                                            alt="Street View"
                                            className="w-full h-44 object-cover"
                                        />
                                        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-slate-900/70 text-white text-[9px] font-black uppercase tracking-widest rounded-md">Street View</span>
                                    </div>
                                ) : (
                                    <div className="h-44 bg-slate-50 flex items-center justify-center border-l border-slate-100">
                                        <span className="text-[9px] text-slate-300 font-bold">No street view</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Body */}
                        <div className="px-5 py-4 max-h-[40vh] overflow-y-auto">
                            {explanationPopup.streetBearing != null && (
                                <div className="mb-3 flex items-center gap-2 flex-wrap">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">GPS Bearing Hint</span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                                        <i className="fa-solid fa-location-arrow text-[8px]" />
                                        ~{Math.round(explanationPopup.streetBearing)}° street axis
                                    </span>
                                    <span className="text-[9px] text-slate-400">
                                        → told Gemini front faces ~{Math.round((explanationPopup.streetBearing + 90) % 360)}° or ~{Math.round((explanationPopup.streetBearing + 270) % 360)}°
                                    </span>
                                </div>
                            )}
                            {explanationPopup.streetBearing == null && !explanationPopup.fromDescription && (
                                <div className="mb-3">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold border border-amber-200">
                                        <i className="fa-solid fa-triangle-exclamation text-[8px]" />
                                        No GPS bearing hint — Gemini used aerial only
                                    </span>
                                </div>
                            )}
                            <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {explanationPopup.text}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// ─── Orientation summary types shared with MapThumb ─────────────────────────

interface OrientationSummary {
    zpid?: string;
    coordinates?: { latitude: number; longitude: number };
    finalOrientation?: string | null;
    orientationAI?: {
        final_orientation: string;
        azimuth_degrees: number | null;
        confidence: 'high' | 'medium' | 'low';
        property_layout_type?: string;
        image_quality?: 'clear' | 'acceptable' | 'blurry';
        aerial_only_mode: boolean;
        feng_shui_vastu?: string | null;
        privacy_insight?: string;
        lot_coverage_hardscape?: number | null;
        lot_coverage_pervious?: number | null;
        buyer_pro?: string;
        buyer_con?: string;
    } | null;
    selectedAssessment?: OrientationAssessmentValue[];  // multi-select array
    onSelectAssessment?: (v: OrientationAssessmentValue) => void;
}

// ─── Image thumbnail with full-screen modal ───────────────────────────────────

function MapThumb({ url, label, orientations, onRefreshUrl }: {
    url?: string;
    label: string;
    orientations?: OrientationSummary;
    onRefreshUrl?: (newUrl: string) => void;
}) {
    const [open, setOpen] = useState(false);
    if (!url) return (
        <div className="w-16 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-200 mx-auto">
            <i className="fa-solid fa-image text-xs" />
        </div>
    );
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="w-16 h-12 rounded-lg overflow-hidden border border-slate-100 shadow-sm hover:shadow-md hover:scale-105 transition-all mx-auto block relative group"
                title={`View ${label}`}
            >
                <img
                    src={url}
                    alt={label}
                    className="w-full h-full object-cover"
                    onError={async (e) => {
                        const target = e.target as HTMLImageElement;
                        console.warn(`[MapThumb] 404/Error on thumbnail: ${label} for ${orientations?.zpid}`);
                        // 1. Show placeholder
                        target.src = 'https://placehold.co/100x100/1e293b/FFFFFF?text=404';

                        // 2. Proactive recovery: if we have coordinates and zpid, try to re-fetch/re-cache URL
                        if (orientations?.zpid && (orientations as any).coordinates && !(target as any)._retried) {
                            if (label !== 'Satellite' && label !== 'Street View') return;
                            (target as any)._retried = true;
                            try {
                                const freshUrl = label === 'Satellite'
                                    ? await getOrCacheAerialSatelliteUrl(
                                        orientations.zpid,
                                        (orientations as any).coordinates.latitude,
                                        (orientations as any).coordinates.longitude
                                    )
                                    : await forceRefreshStreetViewUrl(
                                        orientations.zpid,
                                        (orientations as any).coordinates.latitude,
                                        (orientations as any).coordinates.longitude
                                    );
                                if (freshUrl) {
                                    target.src = freshUrl;
                                    if (onRefreshUrl) onRefreshUrl(freshUrl);
                                }
                            } catch (err) {
                                console.warn(`[MapThumb] Auto-recovery failed for ${label}:`, err);
                            }
                        }
                    }}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <i className="fa-solid fa-expand text-[10px] text-white" />
                </div>
            </button>
            {open && (
                <div
                    className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="relative w-full max-w-2xl flex flex-col gap-4"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Image */}
                        <div>
                            <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">{label}</div>
                            <img
                                src={url}
                                alt={label}
                                className="w-full rounded-2xl shadow-2xl"
                                onError={(e) => {
                                    // Handle broken storage links by attempting to clear them or showing error state
                                    console.warn(`[MapThumb] Image failed to load: ${url}`);
                                    (e.target as HTMLImageElement).src = 'https://placehold.co/640x640/1e293b/FFFFFF?text=Image+Unavailable';
                                }}
                            />
                        </div>

                        {/* Orientation panel */}
                        {orientations && (
                            <div className="grid grid-cols-2 gap-3">

                                {/* Radar Map */}
                                {(() => {
                                    const isSelected = (orientations.selectedAssessment ?? []).includes('radar_map');
                                    const hasData = !!orientations.finalOrientation;
                                    return (
                                        <button
                                            onClick={() => hasData && orientations.onSelectAssessment?.('radar_map')}
                                            disabled={!hasData || !orientations.onSelectAssessment}
                                            title={hasData ? 'Set assessment to Radar Map' : 'No radar map orientation available'}
                                            className={`text-left rounded-2xl p-4 border transition-all ${isSelected
                                                ? 'bg-white/20 border-white ring-2 ring-white shadow-lg scale-[1.02]'
                                                : hasData && orientations.onSelectAssessment
                                                    ? 'bg-white/10 border-white/10 hover:bg-white/15 hover:border-white/30 cursor-pointer'
                                                    : 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-[9px] font-black text-white/50 uppercase tracking-widest">Radar Map</div>
                                                {isSelected && <i className="fa-solid fa-check text-[10px] text-white" />}
                                            </div>
                                            {orientations.finalOrientation ? (
                                                <div className="text-sm font-black text-white">{orientations.finalOrientation}</div>
                                            ) : (
                                                <div className="text-[11px] text-white/30 font-bold">—</div>
                                            )}
                                        </button>
                                    );
                                })()}

                                {/* Satellite */}
                                {(() => {
                                    const isSelected = (orientations.selectedAssessment ?? []).includes('satellite');
                                    const hasData = !!orientations.orientationAI;
                                    return (
                                        <button
                                            onClick={() => hasData && orientations.onSelectAssessment?.('satellite')}
                                            disabled={!hasData || !orientations.onSelectAssessment}
                                            title={hasData ? 'Set assessment to Satellite' : 'No satellite orientation available'}
                                            className={`text-left rounded-2xl p-4 border transition-all ${isSelected
                                                ? 'bg-indigo-400/40 border-indigo-300 ring-2 ring-indigo-300 shadow-lg scale-[1.02]'
                                                : hasData && orientations.onSelectAssessment
                                                    ? 'bg-indigo-500/20 border-indigo-400/20 hover:bg-indigo-500/30 hover:border-indigo-300/40 cursor-pointer'
                                                    : 'bg-indigo-500/10 border-indigo-400/10 opacity-50 cursor-not-allowed'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">Satellite</div>
                                                {isSelected && <i className="fa-solid fa-check text-[10px] text-indigo-200" />}
                                            </div>
                                            {orientations.orientationAI ? (
                                                <>
                                                    {orientations.orientationAI.image_quality === 'blurry' ? (
                                                        <div className="text-[11px] text-slate-300 font-bold flex items-center gap-1.5">
                                                            <i className="fa-solid fa-eye-slash text-[10px]" />
                                                            Unclear image
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="text-[10px] text-indigo-300 font-semibold mb-0.5">likely faces</div>
                                                            <div className="text-sm font-black text-white leading-tight">
                                                                {orientations.orientationAI.final_orientation}
                                                            </div>
                                                            {orientations.orientationAI.azimuth_degrees != null && (
                                                                <div className="text-[10px] text-indigo-300 font-mono mt-0.5">
                                                                    ~{orientations.orientationAI.azimuth_degrees}°
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${orientations.orientationAI.confidence === 'high' ? 'bg-emerald-400/30 text-emerald-300'
                                                            : orientations.orientationAI.confidence === 'medium' ? 'bg-amber-400/30 text-amber-300'
                                                                : 'bg-rose-400/30 text-rose-300'
                                                            }`}>
                                                            {orientations.orientationAI.confidence}
                                                        </span>
                                                        {orientations.orientationAI.image_quality && orientations.orientationAI.image_quality !== 'clear' && (
                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${orientations.orientationAI.image_quality === 'blurry'
                                                                ? 'bg-slate-400/20 text-slate-300'
                                                                : 'bg-amber-400/20 text-amber-300'
                                                                }`}>
                                                                {orientations.orientationAI.image_quality}
                                                            </span>
                                                        )}
                                                        {orientations.orientationAI.aerial_only_mode && (
                                                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300">
                                                                aerial only
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* Privacy & Overlook */}
                                                    {orientations.orientationAI.privacy_insight && orientations.orientationAI.image_quality !== 'blurry' && (
                                                        <div className="mt-2 pt-2 border-t border-white/10">
                                                            <div className="flex items-center gap-1 mb-1">
                                                                <i className="fa-solid fa-eye text-[8px] text-sky-300" />
                                                                <span className="text-[8px] font-black text-sky-300 uppercase tracking-wide">Privacy</span>
                                                            </div>
                                                            <p className="text-[10px] text-white/70 leading-relaxed">{orientations.orientationAI.privacy_insight}</p>
                                                        </div>
                                                    )}
                                                    {/* Lot Coverage */}
                                                    {orientations.orientationAI.lot_coverage_hardscape != null && orientations.orientationAI.image_quality !== 'blurry' && (
                                                        <div className="mt-2 pt-2 border-t border-white/10">
                                                            <div className="flex items-center gap-1 mb-1">
                                                                <i className="fa-solid fa-layer-group text-[8px] text-emerald-300" />
                                                                <span className="text-[8px] font-black text-emerald-300 uppercase tracking-wide">Lot Coverage</span>
                                                            </div>
                                                            <div className="flex gap-2 mt-0.5">
                                                                <span className="text-[10px] font-black text-white/80">
                                                                    {orientations.orientationAI.lot_coverage_hardscape}% Hardscape
                                                                </span>
                                                                <span className="text-[10px] text-white/30">/</span>
                                                                <span className="text-[10px] font-black text-emerald-300">
                                                                    {orientations.orientationAI.lot_coverage_pervious}% Pervious
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {/* Buyer Pro / Con */}
                                                    {(orientations.orientationAI.buyer_pro || orientations.orientationAI.buyer_con) && orientations.orientationAI.image_quality !== 'blurry' && (
                                                        <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                                                            {orientations.orientationAI.buyer_pro && (
                                                                <div className="flex items-start gap-1.5">
                                                                    <i className="fa-solid fa-circle-check text-[8px] text-emerald-400 mt-0.5 shrink-0" />
                                                                    <p className="text-[10px] text-emerald-300 leading-relaxed">{orientations.orientationAI.buyer_pro}</p>
                                                                </div>
                                                            )}
                                                            {orientations.orientationAI.buyer_con && (
                                                                <div className="flex items-start gap-1.5">
                                                                    <i className="fa-solid fa-circle-xmark text-[8px] text-rose-400 mt-0.5 shrink-0" />
                                                                    <p className="text-[10px] text-rose-300 leading-relaxed">{orientations.orientationAI.buyer_con}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {/* Feng Shui / Vastu */}
                                                    {orientations.orientationAI.feng_shui_vastu && orientations.orientationAI.image_quality !== 'blurry' && (
                                                        <div className="mt-2 pt-2 border-t border-white/10">
                                                            <div className="flex items-center gap-1 mb-1">
                                                                <i className="fa-solid fa-yin-yang text-[8px] text-violet-300" />
                                                                <span className="text-[8px] font-black text-violet-300 uppercase tracking-wide">Feng Shui / Vastu</span>
                                                            </div>
                                                            <p className="text-[10px] text-white/70 leading-relaxed">{orientations.orientationAI.feng_shui_vastu}</p>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="text-[11px] text-white/30 font-bold">—</div>
                                            )}
                                        </button>
                                    );
                                })()}


                                {/* None / All row */}
                                {orientations.onSelectAssessment && (
                                    <div className="col-span-2 flex gap-2 mt-1">
                                        {(['none', 'all'] as OrientationAssessmentValue[]).map(v => {
                                            const isSelected = (orientations.selectedAssessment ?? []).includes(v);
                                            return (
                                                <button
                                                    key={v}
                                                    onClick={() => orientations.onSelectAssessment!(v)}
                                                    className={`flex-1 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all ${isSelected
                                                        ? v === 'none'
                                                            ? 'bg-rose-400/40 border-rose-300 ring-2 ring-rose-300 text-rose-100'
                                                            : 'bg-violet-400/40 border-violet-300 ring-2 ring-violet-300 text-violet-100'
                                                        : v === 'none'
                                                            ? 'bg-rose-500/20 border-rose-400/20 text-rose-300 hover:bg-rose-500/30'
                                                            : 'bg-violet-500/20 border-violet-400/20 text-violet-300 hover:bg-violet-500/30'
                                                        }`}
                                                >
                                                    {isSelected && <i className="fa-solid fa-check mr-1.5 text-[8px]" />}
                                                    {v.charAt(0).toUpperCase() + v.slice(1)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                            </div>
                        )}

                        {/* Close button */}
                        <button
                            onClick={() => setOpen(false)}
                            className="absolute top-0 right-0 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
                        >
                            <i className="fa-solid fa-xmark text-xs" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

// \u2500\u2500\u2500 Assessment dropdown ─────────────────────────────────────────────────────────

const ASSESSMENT_OPTIONS: { value: OrientationAssessmentValue; label: string }[] = [
    { value: 'radar_map', label: 'Radar Map' },
    { value: 'satellite', label: 'Satellite' },
    { value: 'geocode', label: 'Geocode' },
    { value: 'none', label: 'None' },
    { value: 'all', label: 'All' },
];

const ASSESSMENT_CHIP_COLOR: Record<OrientationAssessmentValue, string> = {
    radar_map: 'bg-amber-100  text-amber-700  border-amber-200',
    satellite: 'bg-blue-100   text-blue-700   border-blue-200',
    geocode: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    none: 'bg-rose-100   text-rose-700   border-rose-200',
    all: 'bg-violet-100 text-violet-700 border-violet-200',
};

function AssessmentDropdown({
    value,
    onChange,
}: {
    value: OrientationAssessmentValue[];
    onChange: (next: OrientationAssessmentValue[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    // Close on outside click
    React.useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const toggle = (v: OrientationAssessmentValue) => {
        const next = value.includes(v) ? value.filter(x => x !== v) : [...value, v];
        onChange(next);
    };

    return (
        <div ref={ref} className="relative w-full min-w-[140px]">
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full text-left px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-200 min-h-[34px]"
            >
                {value.length === 0 ? (
                    <span className="text-[10px] font-bold text-slate-400">— select —</span>
                ) : (
                    <div className="flex flex-wrap gap-1">
                        {value.map(v => (
                            <span
                                key={v}
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wide border ${ASSESSMENT_CHIP_COLOR[v]}`}
                            >
                                {ASSESSMENT_OPTIONS.find(o => o.value === v)?.label}
                                <span
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggle(v); } }}
                                    onClick={e => { e.stopPropagation(); toggle(v); }}
                                    className="ml-0.5 text-[7px] opacity-60 hover:opacity-100 cursor-pointer"
                                >×</span>
                            </span>
                        ))}
                    </div>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                    {ASSESSMENT_OPTIONS.map(o => {
                        const checked = value.includes(o.value);
                        // Extract individual Tailwind classes from the chip-color string
                        const parts = ASSESSMENT_CHIP_COLOR[o.value].trim().split(/\s+/).filter(Boolean);
                        // parts = ['bg-*', 'text-*', 'border-*']
                        const bgCls = parts[0] ?? '';   // e.g. bg-blue-100
                        const textCls = parts[1] ?? '';   // e.g. text-blue-700
                        const borderCls = parts[2] ?? '';  // e.g. border-blue-200
                        return (
                            <button
                                key={o.value}
                                type="button"
                                onClick={() => toggle(o.value)}
                                className={`flex items-center gap-2.5 w-full px-3 py-2 text-left text-[10px] font-black uppercase tracking-wide transition-all border-l-2 ${checked
                                    ? `${bgCls} ${borderCls}`
                                    : `bg-white border-transparent hover:${bgCls} hover:border-l-2 hover:${borderCls}`
                                    }`}
                            >
                                {/* Checkbox */}
                                <span className={`w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? `${bgCls} ${borderCls}` : `border-slate-200 bg-white`
                                    }`}>
                                    {checked && <i className={`fa-solid fa-check text-[7px] ${textCls}`} />}
                                </span>
                                {/* Coloured dot */}
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${bgCls} border ${borderCls}`} />
                                {/* Label — always in its colour */}
                                <span className={textCls}>{o.label}</span>
                            </button>
                        );
                    })}
                    {/* Clear all */}
                    {value.length > 0 && (
                        <div className="border-t border-slate-100 px-3 py-1.5">
                            <button
                                type="button"
                                onClick={() => onChange([])}
                                className="text-[9px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-wide transition-colors"
                            >
                                × Clear all
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default OrientationAuditTab;
