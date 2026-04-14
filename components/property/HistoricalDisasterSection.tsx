import React from 'react';
import type { HistoricalDisasterData, DisasterEvent, SeismicZone, FloodZone } from '../../services/api/disasters';
import type { DroughtData } from '../../services/api/drought';

interface Props {
    data: HistoricalDisasterData;
    drought?: DroughtData | null;
    compact?: boolean;
    onRefresh?: () => void;
    refreshing?: boolean;
}

// ── Info Tooltip (matches ParcelValidationCard style) ──
const InfoTooltip: React.FC<{ items: { label: string; desc: string }[]; title?: string }> = ({ items, title }) => {
    const [show, setShow] = React.useState(false);
    const timerRef = React.useRef<ReturnType<typeof setTimeout>>();

    const enter = () => { clearTimeout(timerRef.current); setShow(true); };
    const leave = () => { timerRef.current = setTimeout(() => setShow(false), 100); };

    return (
        <div className="relative inline-block ml-1.5">
            <button
                onMouseEnter={enter}
                onMouseLeave={leave}
                className="w-5 h-5 rounded-full bg-white/40 hover:bg-white/80 border border-black/5 flex items-center justify-center transition-all group"
            >
                <i className="fa-solid fa-circle-question text-slate-300 group-hover:text-indigo-600 text-[10px]"></i>
            </button>
            {show && (
                <div
                    onMouseEnter={enter}
                    onMouseLeave={leave}
                    className="absolute right-0 top-full mt-2 z-[100] w-64 bg-white/98 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 normal-case tracking-normal"
                >
                    {title && (
                        <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">{title}</div>
                    )}
                    <ul className="space-y-1.5 text-[11px] text-slate-600">
                        {items.map((item, i) => (
                            <li key={i}><span className="font-bold text-slate-800">{item.label}:</span> {item.desc}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

const TYPE_CONFIG: Record<DisasterEvent['type'], { icon: string; color: string; bg: string; label: string }> = {
    earthquake: { icon: 'fa-house-crack', color: 'text-amber-600', bg: 'bg-amber-50', label: 'Earthquake' },
    flood: { icon: 'fa-water', color: 'text-blue-600', bg: 'bg-blue-50', label: 'Flood' },
    fire: { icon: 'fa-fire', color: 'text-rose-600', bg: 'bg-rose-50', label: 'Wildfire' },
    hurricane: { icon: 'fa-hurricane', color: 'text-violet-600', bg: 'bg-violet-50', label: 'Hurricane' },
    tornado: { icon: 'fa-tornado', color: 'text-slate-600', bg: 'bg-slate-100', label: 'Tornado' },
    severe_storm: { icon: 'fa-cloud-bolt', color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Severe Storm' },
    other: { icon: 'fa-triangle-exclamation', color: 'text-gray-600', bg: 'bg-gray-50', label: 'Other' },
};

const SEISMIC_COLORS: Record<string, { text: string; bg: string; border: string }> = {
    low: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    moderate: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    high: { text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
    very_high: { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
};

const FLOOD_COLORS: Record<string, { text: string; bg: string; border: string }> = {
    minimal: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    moderate: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    high: { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
};

/** Split events into YTD vs rest */
function splitByTimeWindow(events: DisasterEvent[]): { ytd: DisasterEvent[]; prev: DisasterEvent[] } {
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const ytd: DisasterEvent[] = [];
    const prev: DisasterEvent[] = [];
    for (const e of events) {
        (new Date(e.date) >= yearStart ? ytd : prev).push(e);
    }
    return { ytd, prev };
}

/** Group events by type with counts */
function countByType(events: DisasterEvent[]): { type: DisasterEvent['type']; count: number }[] {
    const map: Record<string, number> = {};
    for (const e of events) { map[e.type] = (map[e.type] || 0) + 1; }
    return Object.entries(map)
        .map(([type, count]) => ({ type: type as DisasterEvent['type'], count }))
        .sort((a, b) => b.count - a.count);
}

const TypeCountBadges: React.FC<{ events: DisasterEvent[] }> = ({ events }) => {
    const counts = countByType(events);
    if (counts.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-1.5">
            {counts.map(({ type, count }) => {
                const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.other;
                return (
                    <span key={type} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black ${cfg.bg} ${cfg.color}`}>
                        <i className={`fa-solid ${cfg.icon} text-[9px]`}></i>
                        {cfg.label}: {count}
                    </span>
                );
            })}
        </div>
    );
};

// ── Seismic Zone Card ──
const SeismicZoneCard: React.FC<{ zone: SeismicZone; mini?: boolean }> = ({ zone, mini }) => {
    const c = SEISMIC_COLORS[zone.riskLevel] || SEISMIC_COLORS.low;
    const riskLabels: Record<string, string> = { low: 'Low Risk', moderate: 'Moderate', high: 'High Risk', very_high: 'Very High' };

    if (mini) {
        return (
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${c.border} ${c.bg}/50`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-white shadow-sm ${c.text}`}>
                    <i className="fa-solid fa-mountain-sun text-sm"></i>
                </div>
                <div className="flex flex-col min-w-0">
                    <span className={`text-base font-black leading-none ${c.text}`}>Zone {zone.designCategory}</span>
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight flex items-center">
                        Seismic Risk
                        <InfoTooltip title="Seismic Risk" items={[
                            { label: 'Category A', desc: 'Minimal risk' },
                            { label: 'Category B', desc: 'Low to moderate' },
                            { label: 'Category C', desc: 'Moderate to high' },
                            { label: 'Category D/E', desc: 'Very high — earthquake insurance recommended' },
                        ]} />
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className={`p-5 rounded-2xl border ${c.border} ${c.bg}/30 space-y-3`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-white shadow-sm ${c.text}`}>
                        <i className="fa-solid fa-mountain-sun text-lg"></i>
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center">
                            Seismic Zone
                            <InfoTooltip title="Seismic Design" items={[
                                { label: 'Source', desc: 'USGS ASCE 7-22 building code' },
                                { label: 'PGA', desc: 'Peak Ground Acceleration — how hard the ground shakes' },
                                { label: 'Ss / S1', desc: 'Spectral response — determines structural design requirements' },
                                { label: 'Category D/E', desc: 'Stricter building codes and earthquake insurance recommended' },
                            ]} />
                        </div>
                        <div className={`text-xl font-black ${c.text} tracking-tight`}>Category {zone.designCategory}</div>
                    </div>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${c.bg} ${c.text} border ${c.border}`}>
                    {riskLabels[zone.riskLevel]}
                </span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="p-2 bg-white rounded-lg border border-gray-100">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider">PGA</div>
                    <div className="text-sm font-black text-gray-800">{zone.pga}g</div>
                </div>
                <div className="p-2 bg-white rounded-lg border border-gray-100">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Ss (0.2s)</div>
                    <div className="text-sm font-black text-gray-800">{zone.ss}g</div>
                </div>
                <div className="p-2 bg-white rounded-lg border border-gray-100">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider">S1 (1.0s)</div>
                    <div className="text-sm font-black text-gray-800">{zone.s1}g</div>
                </div>
            </div>
        </div>
    );
};

// ── Flood Zone Card ──
const FloodZoneCard: React.FC<{ zone: FloodZone; mini?: boolean }> = ({ zone, mini }) => {
    const c = FLOOD_COLORS[zone.riskLevel] || FLOOD_COLORS.minimal;
    const riskLabels: Record<string, string> = { minimal: 'Minimal Risk', moderate: 'Moderate', high: 'High Risk' };

    if (mini) {
        return (
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${c.border} ${c.bg}/50`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-white shadow-sm ${c.text}`}>
                    <i className="fa-solid fa-water text-sm"></i>
                </div>
                <div className="flex flex-col min-w-0">
                    <span className={`text-base font-black leading-none ${c.text}`}>Zone {zone.zone}</span>
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight flex items-center">
                        {zone.insuranceRequired ? 'Insurance Required' : 'Flood Zone'}
                        <InfoTooltip title="Flood Zone" items={[
                            { label: 'Zone X', desc: 'Minimal risk — no insurance required' },
                            { label: 'Zone A/AE', desc: 'High risk — flood insurance mandatory' },
                            { label: 'Zone V/VE', desc: 'Coastal high risk — strictest requirements' },
                        ]} />
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className={`p-5 rounded-2xl border ${c.border} ${c.bg}/30 space-y-3`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-white shadow-sm ${c.text}`}>
                        <i className="fa-solid fa-water text-lg"></i>
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center">
                            Flood Zone
                            <InfoTooltip title="FEMA Flood Zone" items={[
                                { label: 'Source', desc: 'FEMA National Flood Hazard Layer' },
                                { label: 'Zone X', desc: 'Minimal flood risk, no insurance required' },
                                { label: 'Zone A/AE', desc: '1% annual flood chance — insurance required for federally backed mortgages' },
                                { label: 'Zone V/VE', desc: 'Coastal high risk with wave action' },
                            ]} />
                        </div>
                        <div className={`text-xl font-black ${c.text} tracking-tight`}>Zone {zone.zone}</div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${c.bg} ${c.text} border ${c.border}`}>
                        {riskLabels[zone.riskLevel]}
                    </span>
                    {zone.insuranceRequired && (
                        <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider">
                            <i className="fa-solid fa-shield-exclamation mr-1"></i>Flood insurance required
                        </span>
                    )}
                </div>
            </div>
            {zone.zoneSubtype && (
                <div className="text-[11px] font-medium text-gray-500 bg-white rounded-lg border border-gray-100 px-3 py-2">
                    <i className="fa-solid fa-info-circle mr-1.5 text-gray-400"></i>{zone.zoneSubtype}
                </div>
            )}
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const HistoricalDisasterSection: React.FC<Props> = ({ data, drought, compact, onRefresh, refreshing }) => {
    const allEvents = [
        ...data.earthquakes,
        ...data.femaDeclarations,
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const eqSplit = splitByTimeWindow(data.earthquakes);
    const femaSplit = splitByTimeWindow(data.femaDeclarations);
    const currentYear = new Date().getFullYear();

    if (compact) {
        return (
            <div className="bg-white border-x border-b border-gray-100 px-6 py-3 overflow-visible">
                <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center">
                            <i className="fa-solid fa-shield-halved text-rose-600 text-[11px]"></i>
                        </div>
                        <span className="text-[16px] font-black text-slate-700 tracking-tight">Hazards</span>
                        <InfoTooltip title="Data Sources" items={[
                            { label: 'Seismic Zone', desc: 'USGS Design Maps (ASCE 7-22)' },
                            { label: 'Flood Zone', desc: 'FEMA National Flood Hazard Layer' },
                            { label: 'Earthquakes', desc: 'USGS — M3.0+ within 5 miles, last 2 years' },
                            { label: 'FEMA Events', desc: 'Federal disaster declarations by county' },
                        ]} />
                    </div>
                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            disabled={refreshing}
                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${refreshing ? 'text-indigo-400 animate-spin' : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
                            title="Refresh"
                        >
                            <i className="fa-solid fa-arrows-rotate text-[9px]"></i>
                        </button>
                    )}
                </div>

                {/* Inline zone badges + event counts in one row */}
                <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5">
                    {/* Zone classifications as inline badges */}
                    {data.seismicZone && (() => {
                        const c = SEISMIC_COLORS[data.seismicZone.riskLevel] || SEISMIC_COLORS.low;
                        const zoneDescs: Record<string, string> = {
                            'A': 'Minimal seismic risk',
                            'B': 'Low to moderate seismic risk',
                            'C': 'Moderate to high seismic risk',
                            'D': 'High seismic risk — stricter building codes apply',
                            'E': 'Very high seismic risk — earthquake insurance recommended',
                            'F': 'Site-specific ground failure risk',
                        };
                        const desc = zoneDescs[data.seismicZone.designCategory] || '';
                        return (
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <i className={`fa-solid fa-mountain-sun text-[9px] ${c.text}`}></i>
                                    <span className="text-[11px] font-bold text-gray-500">Seismic</span>
                                    <span className={`text-[11px] font-black ${c.text} ${c.bg} px-1.5 py-0.5 rounded-md border ${c.border}`}>Zone {data.seismicZone.designCategory}</span>
                                </div>
                                {desc && (
                                    <p className="text-[10px] text-gray-400 font-medium ml-[22px] mt-0.5 leading-snug">{desc}</p>
                                )}
                            </div>
                        );
                    })()}
                    {data.floodZone && (() => {
                        const c = FLOOD_COLORS[data.floodZone.riskLevel] || FLOOD_COLORS.minimal;
                        return (
                            <div className="flex items-center gap-1.5">
                                <i className={`fa-solid fa-water text-[9px] ${c.text}`}></i>
                                <span className="text-[11px] font-bold text-gray-500">Flood</span>
                                <span className={`text-[11px] font-black ${c.text} ${c.bg} px-1.5 py-0.5 rounded-md border ${c.border}`}>Zone {data.floodZone.zone}</span>
                                {data.floodZone.insuranceRequired && <span className="text-[8px] font-black text-rose-500 uppercase">Ins. Req</span>}
                            </div>
                        );
                    })()}
                    {drought && (() => {
                        const droughtColors: Record<string, { text: string; icon: string }> = {
                            'None': { text: 'text-emerald-700', icon: 'text-emerald-500' },
                            'Abnormally Dry': { text: 'text-yellow-700', icon: 'text-yellow-500' },
                            'Moderate': { text: 'text-amber-700', icon: 'text-amber-500' },
                            'Severe': { text: 'text-orange-700', icon: 'text-orange-500' },
                            'Extreme': { text: 'text-red-700', icon: 'text-red-500' },
                            'Exceptional': { text: 'text-red-800', icon: 'text-red-600' },
                        };
                        const dc = droughtColors[drought.severity] || droughtColors['None'];
                        return (
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <i className={`fa-solid fa-sun-plant-wilt text-[9px] ${dc.icon}`}></i>
                                    <span className="text-[11px] font-bold text-gray-500">Drought</span>
                                    <span className={`text-[11px] font-black ${dc.text}`}>{drought.severity}</span>
                                </div>
                                <p className="text-[10px] text-gray-400 font-medium ml-[22px] mt-0.5 leading-snug">
                                    {drought.countyName}, {drought.state} — {drought.none.toFixed(0)}% no drought, {(100 - drought.none).toFixed(0)}% affected
                                </p>
                            </div>
                        );
                    })()}

                    {/* Divider */}
                    <div className="h-4 w-px bg-slate-200"></div>

                    {/* Event counts inline */}
                    <div className="flex items-center gap-1.5">
                        <i className="fa-solid fa-house-crack text-amber-500 text-[9px]"></i>
                        <span className="text-[11px] font-bold text-gray-500">Quakes</span>
                        <span className="text-[11px] font-black text-gray-800">{eqSplit.ytd.length}</span>
                        <span className="text-[9px] text-gray-400">YTD</span>
                        <span className="text-[11px] font-black text-gray-800">{eqSplit.prev.length}</span>
                        <span className="text-[9px] text-gray-400">prev</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <i className="fa-solid fa-landmark text-blue-500 text-[9px]"></i>
                        <span className="text-[11px] font-bold text-gray-500">FEMA</span>
                        <span className="text-[11px] font-black text-gray-800">{femaSplit.ytd.length}</span>
                        <span className="text-[9px] text-gray-400">YTD</span>
                        <span className="text-[11px] font-black text-gray-800">{femaSplit.prev.length}</span>
                        <span className="text-[9px] text-gray-400">prev</span>
                    </div>
                </div>

                {data.femaDeclarations.length > 0 && (
                    <div className="mt-1.5">
                        <TypeCountBadges events={data.femaDeclarations} />
                    </div>
                )}
            </div>
        );
    }

    // ── Full expanded view ──
    return (
        <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-10">
            <div className="space-y-4">
                <div className="text-2xl font-black text-indigo-600 uppercase tracking-[0.3em] flex items-center gap-2">
                    HAZARD ZONES &amp; DISASTER HISTORY
                    <InfoTooltip title="Data Sources" items={[
                        { label: 'Seismic Zone', desc: 'USGS Design Maps (ASCE 7-22)' },
                        { label: 'Flood Zone', desc: 'FEMA National Flood Hazard Layer' },
                        { label: 'Earthquakes', desc: 'USGS — M3.0+ within 5 miles, last 2 years' },
                        { label: 'FEMA Events', desc: 'Federal disaster declarations by county' },
                    ]} />
                </div>
                <p className="text-gray-500 font-sans font-normal text-[13px] leading-[1.625]">
                    Seismic and flood zone classifications with recent earthquake and FEMA disaster event history.
                </p>
            </div>

            {/* Zone Classifications */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {data.seismicZone && <SeismicZoneCard zone={data.seismicZone} />}
                {data.floodZone && <FloodZoneCard zone={data.floodZone} />}
            </div>

            {/* Event History */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* YTD */}
                <div className="p-5 rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-gray-50/50 space-y-4">
                    <div className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-2">
                        <i className="fa-solid fa-calendar-day text-indigo-400"></i>
                        Year to Date ({currentYear})
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <SummaryCard icon="fa-house-crack" value={eqSplit.ytd.length} label="Earthquakes" color="amber"
                            helpTitle="Earthquakes" helpItems={[
                                { label: 'Source', desc: 'USGS real-time earthquake feed' },
                                { label: 'Radius', desc: '5 miles from property' },
                                { label: 'Minimum', desc: 'M3.0+ (felt earthquakes only)' },
                            ]} />
                        <SummaryCard icon="fa-landmark" value={femaSplit.ytd.length} label="FEMA" color="blue"
                            helpTitle="FEMA Disasters" helpItems={[
                                { label: 'Source', desc: 'FEMA OpenFEMA API' },
                                { label: 'Scope', desc: 'Federal declarations for this county' },
                                { label: 'Types', desc: 'Floods, fires, hurricanes, storms, etc.' },
                            ]} />
                    </div>
                    {femaSplit.ytd.length > 0 && <TypeCountBadges events={femaSplit.ytd} />}
                </div>

                {/* Previous */}
                <div className="p-5 rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-gray-50/50 space-y-4">
                    <div className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                        <i className="fa-solid fa-clock-rotate-left text-slate-400"></i>
                        Previous ({currentYear - 2}–{currentYear - 1})
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <SummaryCard icon="fa-house-crack" value={eqSplit.prev.length} label="Earthquakes" color="amber"
                            helpTitle="Earthquakes" helpItems={[
                                { label: 'Source', desc: 'USGS real-time earthquake feed' },
                                { label: 'Radius', desc: '5 miles from property' },
                                { label: 'Minimum', desc: 'M3.0+ (felt earthquakes only)' },
                            ]} />
                        <SummaryCard icon="fa-landmark" value={femaSplit.prev.length} label="FEMA" color="blue"
                            helpTitle="FEMA Disasters" helpItems={[
                                { label: 'Source', desc: 'FEMA OpenFEMA API' },
                                { label: 'Scope', desc: 'Federal declarations for this county' },
                                { label: 'Types', desc: 'Floods, fires, hurricanes, storms, etc.' },
                            ]} />
                    </div>
                    {femaSplit.prev.length > 0 && <TypeCountBadges events={femaSplit.prev} />}
                </div>
            </div>

            {/* Timeline */}
            {allEvents.length > 0 ? (
                <div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-timeline text-indigo-400"></i>
                        Recent Events
                    </div>
                    <div className="relative pl-6 border-l-2 border-gray-100 space-y-3 max-h-[350px] overflow-y-auto pr-2">
                        {allEvents.slice(0, 15).map((event, idx) => {
                            const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.other;
                            const eventDate = event.date !== 'Unknown' ? new Date(event.date) : null;
                            const dateLabel = eventDate
                                ? eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : '?';
                            return (
                                <div key={event.id || idx} className="relative group">
                                    <div className={`absolute -left-[1.625rem] top-2.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${cfg.color.replace('text-', 'bg-').replace('-600', '-400')}`}></div>
                                    <div className="flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-gray-50 transition-colors">
                                        <div className={`w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center ${cfg.bg} ${cfg.color}`}>
                                            <i className={`fa-solid ${cfg.icon} text-[10px]`}></i>
                                        </div>
                                        <span className="text-[12px] font-bold text-gray-700 truncate flex-1 min-w-0">
                                            {event.distanceMi != null
                                                ? `${event.distanceMi} mi from property`
                                                : event.description}
                                        </span>
                                        <span className="text-[10px] font-bold text-gray-400 flex-shrink-0">
                                            <i className="fa-regular fa-calendar mr-1"></i>{dateLabel}
                                        </span>
                                        {event.magnitude != null && (
                                            <span className="text-[10px] font-bold text-amber-600 flex-shrink-0">
                                                <i className="fa-solid fa-bolt mr-0.5"></i>M{event.magnitude.toFixed(1)}
                                            </span>
                                        )}
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                                            {event.source.toUpperCase()}
                                        </span>
                                        {event.url && (
                                            <a href={event.url} target="_blank" rel="noopener noreferrer"
                                                className="text-[10px] text-indigo-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0">
                                                <i className="fa-solid fa-arrow-up-right-from-square"></i>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                        <i className="fa-solid fa-shield-check text-xl text-emerald-400"></i>
                    </div>
                    <div>
                        <p className="text-slate-800 font-black text-base tracking-tight">No Recent Disaster Events</p>
                        <p className="text-slate-400 text-sm mt-1 max-w-sm">
                            No earthquakes or FEMA-declared disasters recorded near this property in the last 2 years.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Sub-components ──
const StatCard: React.FC<{ icon: string; value: number; label: string; color: string; helpTitle?: string; helpItems?: { label: string; desc: string }[] }> = ({ icon, value, label, color, helpTitle, helpItems }) => {
    const c = color === 'amber' ? { text: 'text-amber-600', bg: 'bg-amber-50' } : { text: 'text-blue-600', bg: 'bg-blue-50' };
    return (
        <div className={`flex items-center gap-3 p-2.5 rounded-xl border border-gray-50 ${c.bg}/50`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-white shadow-sm ${c.text}`}>
                <i className={`fa-solid ${icon} text-xs`}></i>
            </div>
            <div className="flex flex-col min-w-0">
                <span className={`text-sm font-black leading-none ${c.text}`}>{value}</span>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight truncate flex items-center">
                    {label}
                    {helpItems && <InfoTooltip title={helpTitle} items={helpItems} />}
                </span>
            </div>
        </div>
    );
};

const SummaryCard: React.FC<{ icon: string; value: number; label: string; color: string; helpTitle?: string; helpItems?: { label: string; desc: string }[] }> = ({ icon, value, label, color, helpTitle, helpItems }) => {
    const c = color === 'amber' ? { text: 'text-amber-600', bg: 'bg-amber-50' } : { text: 'text-blue-600', bg: 'bg-blue-50' };
    return (
        <div className={`p-4 rounded-2xl border border-gray-100 ${c.bg}/30`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-white shadow-sm mb-2 ${c.text}`}>
                <i className={`fa-solid ${icon}`}></i>
            </div>
            <div className={`text-xl font-black ${c.text} leading-none mb-1`}>{value}</div>
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-tight flex items-center">
                {label}
                {helpItems && <InfoTooltip title={helpTitle} items={helpItems} />}
            </div>
        </div>
    );
};

export default HistoricalDisasterSection;
