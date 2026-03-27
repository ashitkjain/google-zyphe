import React, { useState, useEffect } from 'react';
import { saveSearch, getSavedSearches, deleteSavedSearch, SavedSearch } from '../../services/firebase/idx';
import { trackSearchSaved } from '../../services/analytics/idxTracking';

// ── Types ──────────────────────────────────────────────────────────────────────

interface SaveSearchModalProps {
    city: string;
    filters: {
        minPrice?: string;
        maxPrice?: string;
        beds?: string;
        baths?: string;
        homeType?: string;
        stories?: string;
        minSchoolRating?: string;
        neighborhood?: string;
        minSqft?: string;
        maxSqft?: string;
        minYear?: string;
        maxYear?: string;
        garage?: string;
        maxHoa?: string;
        maxDom?: string;
    };
    resultCount: number;
    realtorId: string;
    onClose: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) => `$${(n / 1000).toFixed(0)}K`;

const buildFilterSummary = (city: string, filters: SaveSearchModalProps['filters']): string => {
    const parts: string[] = [city];
    if (filters.minPrice || filters.maxPrice) {
        parts.push(`${filters.minPrice ? `$${Number(filters.minPrice).toLocaleString()}` : 'Any'} – ${filters.maxPrice ? `$${Number(filters.maxPrice).toLocaleString()}` : 'Any'}`);
    }
    if (filters.beds) parts.push(`${filters.beds}+ bd`);
    if (filters.baths) parts.push(`${filters.baths}+ ba`);
    if (filters.homeType) parts.push(filters.homeType.replace('_', ' '));
    if (filters.minSchoolRating) parts.push(`Schools ${filters.minSchoolRating}+`);
    return parts.join(' · ');
};

// ── Save Search Modal ──────────────────────────────────────────────────────────

export const SaveSearchModal: React.FC<SaveSearchModalProps> = ({
    city, filters, resultCount, realtorId, onClose
}) => {
    const [name, setName] = useState(`${city} Search`);
    const [alertFrequency, setAlertFrequency] = useState<SavedSearch['alertFrequency']>('daily');
    const [notifyEmail, setNotifyEmail] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    const filterSummary = buildFilterSummary(city, filters);

    const activeFilterCount = Object.values(filters).filter(v => v && v !== '').length;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) { setError('Please give this search a name.'); return; }
        setError('');
        setSaving(true);

        try {
            const result = await saveSearch(realtorId, {
                name: name.trim(),
                city,
                filters,
                alertFrequency,
                notifyEmail: notifyEmail.trim().toLowerCase() || undefined,
                resultCount,
            });

            if (result.success) {
                trackSearchSaved({
                    city,
                    searchName: name.trim(),
                    alertFrequency,
                    filterCount: activeFilterCount,
                    resultCount,
                });
                setSaved(true);
            } else {
                setError('Failed to save search. Please try again.');
            }
        } catch {
            setError('Failed to save search. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 overflow-hidden">
                {/* Header */}
                <div className="px-8 pt-8 pb-6 bg-gradient-to-br from-violet-600 to-indigo-700">
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                    >
                        <i className="fa-solid fa-xmark text-sm"></i>
                    </button>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
                            <i className="fa-solid fa-bell text-white text-lg"></i>
                        </div>
                        <div>
                            <div className="text-white/70 text-[10px] font-black uppercase tracking-widest">Save This Search</div>
                            <div className="text-white font-black text-base">Get New Listing Alerts</div>
                        </div>
                    </div>
                    <div className="bg-white/15 rounded-xl px-4 py-3">
                        <div className="text-white text-xs font-bold leading-snug">{filterSummary}</div>
                        <div className="text-white/70 text-[10px] font-medium mt-0.5">
                            {resultCount} current matches · {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
                        </div>
                    </div>
                </div>

                {/* Success */}
                {saved ? (
                    <div className="px-8 py-10 text-center">
                        <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-4">
                            <i className="fa-solid fa-bell text-violet-500 text-3xl"></i>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">Search Saved!</h3>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">
                            You'll be notified when new listings match your criteria.
                        </p>
                        <button onClick={onClose} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-black transition-colors">
                            Done
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="px-8 py-6 space-y-4">
                        {/* Name */}
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Search Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Pleasanton Family Homes"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300 transition-all"
                            />
                        </div>

                        {/* Alert Frequency */}
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Alert Me</label>
                            <div className="grid grid-cols-4 gap-1.5">
                                {(['instant', 'daily', 'weekly', 'none'] as const).map(f => (
                                    <button
                                        key={f}
                                        type="button"
                                        onClick={() => setAlertFrequency(f)}
                                        className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${alertFrequency === f
                                            ? 'bg-violet-600 text-white shadow-sm'
                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                        }`}
                                    >
                                        {f === 'instant' ? '⚡ Now' : f === 'daily' ? '📅 Daily' : f === 'weekly' ? '📆 Weekly' : '🔕 Off'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Notify Email (only if not 'none') */}
                        {alertFrequency !== 'none' && (
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                                    Notify Email <span className="font-medium text-slate-400">(optional)</span>
                                </label>
                                <input
                                    type="email"
                                    value={notifyEmail}
                                    onChange={e => setNotifyEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300 transition-all"
                                />
                            </div>
                        )}

                        {error && (
                            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-2">
                                <i className="fa-solid fa-circle-exclamation text-rose-500 text-sm"></i>
                                <p className="text-xs font-bold text-rose-700">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <><i className="fa-solid fa-spinner animate-spin"></i> Saving...</>
                            ) : (
                                <><i className="fa-solid fa-bell"></i> Save Search & Enable Alerts</>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

// ── Saved Searches Manager Panel ───────────────────────────────────────────────

interface SavedSearchesPanelProps {
    realtorId: string;
    onClose: () => void;
    onApply: (search: SavedSearch) => void;
}

export const SavedSearchesPanel: React.FC<SavedSearchesPanelProps> = ({ realtorId, onClose, onApply }) => {
    const [searches, setSearches] = useState<SavedSearch[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        getSavedSearches(realtorId).then(s => { setSearches(s); setLoading(false); });
    }, [realtorId]);

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        await deleteSavedSearch(realtorId, id);
        setSearches(s => s.filter(x => x.id !== id));
        setDeletingId(null);
    };

    const freqLabel = (f: SavedSearch['alertFrequency']) => {
        const map = { instant: '⚡ Instant', daily: '📅 Daily', weekly: '📆 Weekly', none: '🔕 Off' };
        return map[f] || f;
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center">
                            <i className="fa-solid fa-bell text-violet-600"></i>
                        </div>
                        <div>
                            <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Manage</div>
                            <div className="text-sm font-black text-slate-900">Saved Searches</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
                        <i className="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <i className="fa-solid fa-spinner animate-spin text-violet-400 text-2xl"></i>
                        </div>
                    ) : searches.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                                <i className="fa-solid fa-bell-slash text-slate-400 text-xl"></i>
                            </div>
                            <p className="text-sm font-bold text-slate-500">No saved searches yet</p>
                            <p className="text-xs text-slate-400 mt-1">Save a search to get alerts for new listings</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {searches.map(search => (
                                <div key={search.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 group">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-black text-slate-900 mb-0.5">{search.name}</div>
                                            <div className="text-[10px] font-bold text-slate-500 line-clamp-1">
                                                {buildFilterSummary(search.city, search.filters)}
                                            </div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[9px] font-black bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                    {freqLabel(search.alertFrequency)}
                                                </span>
                                                {search.resultCount != null && (
                                                    <span className="text-[9px] font-bold text-slate-400">
                                                        {search.resultCount} match{search.resultCount !== 1 ? 'es' : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => { onApply(search); onClose(); }}
                                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-colors"
                                            >
                                                Apply
                                            </button>
                                            <button
                                                onClick={() => search.id && handleDelete(search.id)}
                                                disabled={deletingId === search.id}
                                                className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center text-slate-400 transition-colors disabled:opacity-50"
                                            >
                                                {deletingId === search.id
                                                    ? <i className="fa-solid fa-spinner animate-spin text-[9px]"></i>
                                                    : <i className="fa-solid fa-trash text-[9px]"></i>}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SaveSearchModal;
