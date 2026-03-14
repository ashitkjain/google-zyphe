import React from 'react';
import type { HistoricalDisasterData, DisasterEvent, SeismicZone, FloodZone } from '../../services/api/disasters';

interface Props {
    data: HistoricalDisasterData;
    compact?: boolean;
}

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
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight">Seismic Risk</span>
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
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Seismic Zone</div>
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
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight">
                        {zone.insuranceRequired ? 'Insurance Required' : 'Flood Zone'}
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
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Flood Zone</div>
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

const HistoricalDisasterSection: React.FC<Props> = ({ data, compact }) => {
    const allEvents = [
        ...data.earthquakes,
        ...data.femaDeclarations,
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const eqSplit = splitByTimeWindow(data.earthquakes);
    const femaSplit = splitByTimeWindow(data.femaDeclarations);
    const currentYear = new Date().getFullYear();

    if (compact) {
        return (
            <div className="bg-white border-x border-b border-gray-100 px-8 py-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-black text-gray-400 uppercase tracking-widest">
                    <div className="flex items-center">
                        <i className="fa-solid fa-shield-halved mr-2"></i>
                        Hazard Zones &amp; Disaster History
                    </div>
                </div>

                {/* Zone classifications — primary */}
                <div className="grid grid-cols-2 gap-3">
                    {data.seismicZone && <SeismicZoneCard zone={data.seismicZone} mini />}
                    {data.floodZone && <FloodZoneCard zone={data.floodZone} mini />}
                </div>

                {/* Event counts — secondary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard icon="fa-house-crack" value={eqSplit.ytd.length} label="Quakes YTD" color="amber" />
                    <StatCard icon="fa-house-crack" value={eqSplit.prev.length} label={`Quakes ${currentYear - 2}–${currentYear - 1}`} color="amber" />
                    <StatCard icon="fa-landmark" value={femaSplit.ytd.length} label="FEMA YTD" color="blue" />
                    <StatCard icon="fa-landmark" value={femaSplit.prev.length} label={`FEMA ${currentYear - 2}–${currentYear - 1}`} color="blue" />
                </div>
                {data.femaDeclarations.length > 0 && (
                    <TypeCountBadges events={data.femaDeclarations} />
                )}
            </div>
        );
    }

    // ── Full expanded view ──
    return (
        <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-10">
            <div className="space-y-4">
                <div className="text-2xl font-black text-indigo-600 uppercase tracking-[0.3em]">
                    HAZARD ZONES &amp; DISASTER HISTORY
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
                        <SummaryCard icon="fa-house-crack" value={eqSplit.ytd.length} label="Earthquakes" color="amber" />
                        <SummaryCard icon="fa-landmark" value={femaSplit.ytd.length} label="FEMA" color="blue" />
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
                        <SummaryCard icon="fa-house-crack" value={eqSplit.prev.length} label="Earthquakes" color="amber" />
                        <SummaryCard icon="fa-landmark" value={femaSplit.prev.length} label="FEMA" color="blue" />
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
                                    <div className={`absolute -left-[1.625rem] top-2 w-3 h-3 rounded-full border-2 border-white shadow-sm ${cfg.color.replace('text-', 'bg-').replace('-600', '-400')}`}></div>
                                    <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                        <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${cfg.bg} ${cfg.color} shadow-sm`}>
                                            <i className={`fa-solid ${cfg.icon} text-xs`}></i>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[13px] font-black text-gray-800">{event.title}</span>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                                                    {event.source.toUpperCase()}
                                                </span>
                                            </div>
                                            <p className="text-[12px] text-gray-500 font-medium mt-0.5">{event.description}</p>
                                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                <span className="text-[10px] font-bold text-gray-400">
                                                    <i className="fa-regular fa-calendar mr-1"></i>{dateLabel}
                                                </span>
                                                {event.distanceMi != null && (
                                                    <span className="text-[10px] font-bold text-gray-400">
                                                        <i className="fa-solid fa-location-dot mr-1"></i>{event.distanceMi} mi
                                                    </span>
                                                )}
                                                {event.magnitude != null && (
                                                    <span className="text-[10px] font-bold text-amber-600">
                                                        <i className="fa-solid fa-bolt mr-1"></i>M{event.magnitude.toFixed(1)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {event.url && (
                                            <a href={event.url} target="_blank" rel="noopener noreferrer"
                                                className="text-[10px] font-black text-indigo-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 mt-1">
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
const StatCard: React.FC<{ icon: string; value: number; label: string; color: string }> = ({ icon, value, label, color }) => {
    const c = color === 'amber' ? { text: 'text-amber-600', bg: 'bg-amber-50' } : { text: 'text-blue-600', bg: 'bg-blue-50' };
    return (
        <div className={`flex items-center gap-3 p-2.5 rounded-xl border border-gray-50 ${c.bg}/50`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-white shadow-sm ${c.text}`}>
                <i className={`fa-solid ${icon} text-xs`}></i>
            </div>
            <div className="flex flex-col min-w-0">
                <span className={`text-sm font-black leading-none ${c.text}`}>{value}</span>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight truncate">{label}</span>
            </div>
        </div>
    );
};

const SummaryCard: React.FC<{ icon: string; value: number; label: string; color: string }> = ({ icon, value, label, color }) => {
    const c = color === 'amber' ? { text: 'text-amber-600', bg: 'bg-amber-50' } : { text: 'text-blue-600', bg: 'bg-blue-50' };
    return (
        <div className={`p-4 rounded-2xl border border-gray-100 ${c.bg}/30`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-white shadow-sm mb-2 ${c.text}`}>
                <i className={`fa-solid ${icon}`}></i>
            </div>
            <div className={`text-xl font-black ${c.text} leading-none mb-1`}>{value}</div>
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-tight">{label}</div>
        </div>
    );
};

export default HistoricalDisasterSection;
