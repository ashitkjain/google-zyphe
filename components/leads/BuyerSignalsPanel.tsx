import React, { useState, useEffect, useCallback } from 'react';
import { getBuyerSignals, BuyerSignals } from '../../services/firebase/buyerSignals';

interface BuyerSignalsPanelProps {
    /** The buyer's email address used to look up PostHog events */
    buyerEmail: string;
    /** Optional: show inline (no outer border/card wrapping) */
    inline?: boolean;
    /** Days lookback window — default 30 */
    days?: number;
}

const fmt = (n: number | null) => {
    if (n == null) return '—';
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
    return `$${n}`;
};

const timeAgo = (iso: string | null) => {
    if (!iso) return 'Never';
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
};

const Pill: React.FC<{ icon: string; label: string; value: string | number; color?: string }> = ({ icon, label, value, color = 'indigo' }) => (
    <div className={`flex items-center gap-2 bg-${color}-50 border border-${color}-100 rounded-xl px-3 py-2`}>
        <i className={`fa-solid ${icon} text-${color}-400 text-[11px]`}></i>
        <div>
            <div className={`text-[14px] font-black text-${color}-700`}>{value}</div>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
        </div>
    </div>
);

const BuyerSignalsPanel: React.FC<BuyerSignalsPanelProps> = ({ buyerEmail, inline = false, days = 30 }) => {
    const [signals, setSignals] = useState<BuyerSignals | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    const load = useCallback(async () => {
        if (!buyerEmail) return;
        setLoading(true);
        setError(null);
        try {
            const result = await getBuyerSignals(buyerEmail, days);
            setSignals(result);
        } catch (e: any) {
            setError(e.message || 'Failed to load signals');
        } finally {
            setLoading(false);
            setLoaded(true);
        }
    }, [buyerEmail, days]);

    useEffect(() => { load(); }, [load]);

    const wrapper = inline
        ? 'space-y-3'
        : 'bg-white border border-slate-100 rounded-2xl shadow-sm p-4 space-y-3';

    if (loading) {
        return (
            <div className={wrapper}>
                <div className="flex items-center gap-2 text-slate-400">
                    <i className="fa-solid fa-spinner animate-spin text-xs"></i>
                    <span className="text-[11px] font-bold">Loading buyer signals…</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={wrapper}>
                <div className="flex items-center gap-2 text-rose-400">
                    <i className="fa-solid fa-triangle-exclamation text-xs"></i>
                    <span className="text-[11px] font-bold">Could not load signals: {error}</span>
                    <button onClick={load} className="ml-auto text-[9px] font-black text-indigo-500 hover:underline">Retry</button>
                </div>
            </div>
        );
    }

    if (loaded && (!signals || signals.propertiesViewed === 0 && signals.tourRequests === 0)) {
        return (
            <div className={wrapper}>
                <div className="flex items-center gap-2 text-slate-300">
                    <i className="fa-solid fa-chart-simple text-xs"></i>
                    <span className="text-[11px] font-bold">No activity recorded yet (last {days} days)</span>
                </div>
            </div>
        );
    }

    if (!signals) return null;

    return (
        <div className={wrapper}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center">
                        <i className="fa-solid fa-chart-simple text-violet-500 text-[10px]"></i>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Buyer Activity <span className="text-slate-300 font-bold normal-case">· last {days}d</span>
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-400">
                        Last active: <span className="text-slate-600">{timeAgo(signals.lastActiveAt)}</span>
                    </span>
                    <button
                        onClick={load}
                        className="w-5 h-5 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-colors"
                        title="Refresh"
                    >
                        <i className="fa-solid fa-rotate-right text-slate-400 text-[8px]"></i>
                    </button>
                </div>
            </div>

            {/* Stat pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Pill icon="fa-eye" label="Props Viewed" value={signals.propertiesViewed} color="indigo" />
                <Pill icon="fa-calendar-check" label="Tour Requests" value={signals.tourRequests} color="emerald" />
                <Pill icon="fa-envelope" label="Info Requests" value={signals.infoRequests} color="violet" />
                <Pill icon="fa-bell" label="Saved Searches" value={signals.savedSearchCount} color="amber" />
            </div>

            {/* Feature flags */}
            <div className="flex flex-wrap gap-2">
                {signals.usedMapView && (
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-sky-50 text-sky-600 border border-sky-100 flex items-center gap-1">
                        <i className="fa-solid fa-map text-[8px]"></i> Used Map View
                    </span>
                )}
                {signals.usedStorySearch && (
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-violet-50 text-violet-600 border border-violet-100 flex items-center gap-1">
                        <i className="fa-solid fa-wand-magic-sparkles text-[8px]"></i> Used AI Story Search
                    </span>
                )}
            </div>

            {/* Price range */}
            {(signals.priceRangeInterest.min || signals.priceRangeInterest.max) && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 flex items-center gap-3">
                    <i className="fa-solid fa-house-circle-check text-emerald-400 text-sm"></i>
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Price range interest</div>
                        <div className="text-sm font-black text-emerald-700">
                            {fmt(signals.priceRangeInterest.min)} — {fmt(signals.priceRangeInterest.max)}
                            {signals.priceRangeInterest.avg && (
                                <span className="text-emerald-500 font-bold text-[11px] ml-2">avg {fmt(signals.priceRangeInterest.avg)}</span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Cities explored */}
            {signals.citiesExplored.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mr-1">Cities:</span>
                    {signals.citiesExplored.map(c => (
                        <span key={c} className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-black border border-indigo-100">
                            {c}
                        </span>
                    ))}
                </div>
            )}

            {/* Tour requested properties */}
            {signals.tourRequestedAddresses.length > 0 && (
                <div className="space-y-1">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                        <i className="fa-solid fa-calendar-check text-emerald-400 mr-1"></i>
                        Tour Requests
                    </div>
                    {signals.tourRequestedAddresses.map((addr, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px] font-bold text-slate-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5">
                            <i className="fa-solid fa-house text-emerald-400 text-[9px]"></i>
                            {addr}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BuyerSignalsPanel;
