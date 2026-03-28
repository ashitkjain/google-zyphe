import React, { useState, useEffect } from 'react';
import { getAllUserNotes, deleteStickyNote, updateStickyNote } from '../../services/firebase/stickyNotes';
import { getPropertyFromCloud } from '../../services/firebase/properties';
import { UserPropertyComment } from '../../types/stickyNotes';
import MessagesTab from './MessagesTab';

const PAGE_LABELS: Record<string, string> = {
    explore: 'Explore', leads: 'Funnel', clients: 'Clients', closing: 'Closing',
    reactivate: 'Reactivate', tasks: 'Tasks', calendar: 'Calendar',
    whiteboard: 'Whiteboard', creative_studio: 'Creative Studio', settings: 'Data Fields',
    profile: 'Profile', knowledge_center: 'Library', best_practices: 'Best Practices',
    guides: 'Guides', city_data: 'City Ingestion', data_health: 'Data Health',
    ai_validation: 'AI Validation', lead_ingestion: 'Lead Ingestion', pdf_csv: 'PDF to CSV',
    sms_registration: 'SMS Registration', storage_registry: 'Bulk Prefetch',
    bulk_prefetch: 'Bulk Prefetch', industry_research: 'Industry Research',
    product_market_fit: 'Product Market Fit', post_close_intelligence: 'Post-Close',
    technical_papers: 'Technical Papers', video_upload: 'Video Upload',
    technical_media: 'Technical Media', executive_summary: 'Executive Summary',
    industry_case_studies: 'Case Studies', unit_economics: 'Unit Economics',
    premium_mls: 'Premium MLS', reminder_rules: 'Reminder Rules',
    my_zyphe: 'My Zyphe', context_graph_builder: 'Context Graph',
    sold_listings: 'Sold Listings', agent_manager: 'Agent Manager',
    cost_dashboard: 'Cost Dashboard',
    // Explore sub-tabs (analysis)
    interior: 'Interior', rooms: 'Rooms', exterior_and_neighborhood: 'Exterior',
    neighborhood: 'Neighborhood', schools: 'Schools', pulse: 'Community Pulse',
    city_neighborhoods: 'City Neighborhoods', deep_research: 'Investment Research',
    investment: 'Property Economics', image_analysis: 'Image Analysis',
    quality: 'Picture Quality Audit', context_graph: 'Context Graph',
};

interface MyZypheTabProps {
    userId: string;
    displayName: string;
    email: string;
    role: string;
    favorites?: any[];
    cloudHistory?: any[];
}

const NOTE_COLORS: Record<string, string> = {
    yellow: 'bg-[#ffff88] border-[#eeee77] text-slate-800',
    blue: 'bg-[#7afaff] border-[#69e9ee] text-slate-800',
    rose: 'bg-[#ff7e7e] border-[#ee6d6d] text-white',
    emerald: 'bg-[#a7ffeb] border-[#96eee0] text-slate-800',
};

const formatTimestamp = (ts: any): string => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
};

const formatFullDate = (ts: any): string => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
    return date.toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
    });
};

const MyZypheTab: React.FC<MyZypheTabProps> = ({ userId, displayName, email, role, favorites = [], cloudHistory = [] }) => {
    const [notes, setNotes] = useState<UserPropertyComment[]>([]);
    const [notesLoading, setNotesLoading] = useState(true);
    const [addressCache, setAddressCache] = useState<Record<string, string>>({});

    const [activeTab, setActiveTab] = useState<'notes' | 'messages' | 'favorites' | 'history'>('notes');

    const loadNotes = async () => {
        setNotesLoading(true);
        try {
            const fetchedNotes = await getAllUserNotes(userId);
            setNotes(fetchedNotes);

            // Resolve addresses for all unique zpids
            const uniqueZpids = [...new Set(fetchedNotes.map(n => n.zpid))];
            const resolved: Record<string, string> = {};
            for (const zpid of uniqueZpids) {
                // Check favorites/history first
                const fav = favorites.find(f => String(f.zpid) === String(zpid));
                if (fav?.address || fav?.streetAddress) {
                    resolved[zpid] = fav.address || fav.streetAddress;
                    continue;
                }
                const hist = cloudHistory.find(h => String(h.zpid) === String(zpid));
                if (hist?.address) {
                    resolved[zpid] = hist.address;
                    continue;
                }
                // Fallback: look up from Firestore
                try {
                    const propData = await getPropertyFromCloud(zpid);
                    if (propData?.address) {
                        resolved[zpid] = propData.address;
                    }
                } catch { /* ignore */ }
            }
            setAddressCache(resolved);
        } catch (err) {
            console.error('[MyZyphe] Failed to load notes:', err);
        } finally {
            setNotesLoading(false);
        }
    };

    useEffect(() => {
        loadNotes();
    }, [userId]);

    const handleDeleteNote = async (id: string) => {
        if (!window.confirm('Delete this sticky note permanently?')) return;
        const success = await deleteStickyNote(id, userId);
        if (success) {
            setNotes(prev => prev.filter(n => n.id !== id));
        }
    };

    const handleUpdateNote = async (id: string, newComment: string) => {
        const success = await updateStickyNote(id, { userId, comment: newComment });
        if (success) {
            setNotes(prev => prev.map(n => n.id === id ? { ...n, comment: newComment } : n));
        }
        return success;
    };

    const [editingNote, setEditingNote] = useState<UserPropertyComment | null>(null);

    const findAddress = (zpid: string) => {
        if (addressCache[zpid]) return addressCache[zpid];
        const fav = favorites.find(f => String(f.zpid) === String(zpid));
        if (fav) return fav.address || fav.streetAddress;
        const hist = cloudHistory.find(h => String(h.zpid) === String(zpid));
        if (hist) return hist.address;
        return null;
    };

    return (
        <div className="bg-slate-50 min-h-screen">
            {/* Hero Header */}
            <div className="relative bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23fff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', backgroundSize: '30px 30px' }}
                ></div>

                <div className="max-w-6xl mx-auto px-8 py-12 relative z-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className="w-20 h-20 rounded-[1.5rem] bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-2xl">
                                <i className="fa-solid fa-chart-line text-3xl"></i>
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-white tracking-tight mb-1">My Zyphe</h1>
                                <p className="text-indigo-200/60 text-xs font-bold uppercase tracking-widest">
                                    {displayName} · {email}
                                </p>
                            </div>
                        </div>
                        <div className="flex bg-white/5 backdrop-blur-sm p-1 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => setActiveTab('notes')}
                                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'notes' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40 hover:text-white/70'}`}
                            >
                                <i className="fa-solid fa-note-sticky"></i> Notes
                                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[8px] ${activeTab === 'notes' ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/40'}`}>
                                    {notes.length}
                                </span>
                            </button>
                            <button
                                onClick={() => setActiveTab('favorites')}
                                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'favorites' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40 hover:text-white/70'}`}
                            >
                                <i className="fa-solid fa-heart"></i> Favorites
                                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[8px] ${activeTab === 'favorites' ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/40'}`}>
                                    {favorites.length}
                                </span>
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40 hover:text-white/70'}`}
                            >
                                <i className="fa-solid fa-clock-rotate-left"></i> History
                                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[8px] ${activeTab === 'history' ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/40'}`}>
                                    {cloudHistory.length}
                                </span>
                            </button>
                            {(role === 'admin' || role === 'auditor') && (
                                <button
                                    onClick={() => setActiveTab('messages')}
                                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'messages' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40 hover:text-white/70'}`}
                                >
                                    <i className="fa-solid fa-comments"></i> Messages
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="max-w-6xl mx-auto px-8 py-8">
                {activeTab === 'messages' && (role === 'admin' || role === 'auditor') ? (
                    <div className="flex flex-col" style={{ height: 'calc(100vh - 260px)' }}>
                        <MessagesTab userId={userId} displayName={displayName} role={role} />
                    </div>
                ) : activeTab === 'favorites' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {favorites.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                                <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6">
                                    <i className="fa-solid fa-heart text-rose-200 text-4xl"></i>
                                </div>
                                <h3 className="text-xl font-black text-slate-800 mb-2">Heart some properties.</h3>
                                <p className="text-sm text-slate-400 font-medium max-w-xs text-center">Your favorite homes will appear here for quick comparisons.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                                <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/30">
                                    <h3 className="text-lg font-black text-slate-800 tracking-tight">Saved Favorites</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Properties you've shortlisted</p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50">
                                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Property</th>
                                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Price / Details</th>
                                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {favorites.map((fav) => (
                                                <tr key={fav.zpid} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-10 py-6">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{fav.address || fav.streetAddress || 'Unnamed Property'}</span>
                                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                                                                <i className="fa-solid fa-house text-indigo-300"></i>
                                                                ZPID: {fav.zpid}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-bold text-slate-700">${fav.price?.toLocaleString() || fav.unformattedPrice?.toLocaleString()}</span>
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                                                {fav.bedrooms}B / {fav.bathrooms}B · {fav.livingArea} sqft
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-10 py-6 text-right">
                                                        <button className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                                                            View Report
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                ) : activeTab === 'history' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {cloudHistory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                    <i className="fa-solid fa-eye text-slate-200 text-4xl"></i>
                                </div>
                                <h3 className="text-xl font-black text-slate-800 mb-2">Start Exploring.</h3>
                                <p className="text-sm text-slate-400 font-medium max-w-xs text-center">Your recently viewed properties will track here automatically.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                                <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/30">
                                    <h3 className="text-lg font-black text-slate-800 tracking-tight">Recent Activity</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Browsing history across sessions</p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50">
                                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Property</th>
                                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Last Viewed</th>
                                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {cloudHistory.map((item, idx) => (
                                                <tr key={`${item.zpid}_${idx}`} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-10 py-6">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{item.address || 'Unnamed Property'}</span>
                                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                                                                <i className="fa-solid fa-house text-indigo-300"></i>
                                                                ZPID: {item.zpid}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-6 font-medium text-slate-700">
                                                        {formatFullDate(item.timestamp)}
                                                    </td>
                                                    <td className="px-10 py-6 text-right">
                                                        <button className="px-4 py-2 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                                                            Revisit
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {notesLoading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="w-20 h-20 rounded-3xl bg-amber-50 flex items-center justify-center mb-6 animate-pulse">
                                    <i className="fa-solid fa-pen-nib text-amber-500 text-2xl"></i>
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Retrieving your sticky notes...</p>
                            </div>
                        ) : notes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                    <i className="fa-solid fa-sticky-note text-slate-200 text-4xl"></i>
                                </div>
                                <h3 className="text-xl font-black text-slate-800 mb-2">No notes left behind.</h3>
                                <p className="text-sm text-slate-400 font-medium max-w-xs text-center">Your analysis post-its will be summarized here for quick access.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                                <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-black text-slate-800 tracking-tight">Active Sticky Notes</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consolidated across all property reports</p>
                                    </div>
                                    <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 text-indigo-600 text-[10px] font-black uppercase tracking-widest shadow-sm">
                                        Total: {notes.length}
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50">
                                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Page / Tab</th>
                                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Date Left</th>
                                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Comment</th>
                                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Style</th>
                                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {notes.map((note) => (
                                                <tr key={note.id} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-10 py-6">
                                                        <div className="flex flex-col gap-1">
                                                            <a
                                                                href={`/explore?q=${encodeURIComponent(findAddress(note.zpid) || note.zpid)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors tracking-tight group/addr"
                                                            >
                                                                <i className="fa-solid fa-location-dot text-[9px] text-indigo-400"></i>
                                                                {findAddress(note.zpid) || `ZPID ${note.zpid}`}
                                                                <i className="fa-solid fa-arrow-up-right-from-square text-[8px] opacity-0 group-hover/addr:opacity-100 transition-opacity text-indigo-300"></i>
                                                            </a>
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-3.5">
                                                                {PAGE_LABELS[note.tab] || note.tab}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-bold text-slate-700">{formatFullDate(note.createdAt).split(',')[1]}</span>
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter opacity-60">
                                                                {formatTimestamp(note.createdAt)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-6 max-w-xs">
                                                        <p className="text-xs font-medium text-slate-600 line-clamp-2 leading-relaxed italic">
                                                            "{note.comment}"
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-6">
                                                        <div className={`w-8 h-8 rounded-lg shadow-sm border border-black/5 ${NOTE_COLORS[note.color] || NOTE_COLORS.yellow} relative flex items-center justify-center`}>
                                                            <i className="fa-solid fa-thumbtack text-[10px] -rotate-45 opacity-20"></i>
                                                        </div>
                                                    </td>
                                                    <td className="px-10 py-6 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => setEditingNote(note)}
                                                                className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center border border-slate-100 shadow-sm"
                                                                title="Edit Note"
                                                            >
                                                                <i className="fa-solid fa-pen-to-square text-xs"></i>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteNote(note.id)}
                                                                className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all flex items-center justify-center border border-slate-100 shadow-sm"
                                                                title="Delete Note"
                                                            >
                                                                <i className="fa-solid fa-trash-can text-xs"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {editingNote && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                            <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Edit Sticky Note</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{findAddress(editingNote.zpid)}</p>
                                </div>
                                <button onClick={() => setEditingNote(null)} className="w-10 h-10 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-400 transition-colors">
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                            <div className="p-8">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Comment Content</label>
                                <textarea
                                    autoFocus
                                    className="w-full h-32 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                                    value={editingNote.comment}
                                    onChange={(e) => setEditingNote({ ...editingNote, comment: e.target.value })}
                                />
                                <div className="flex items-center justify-end gap-3 mt-8">
                                    <button
                                        onClick={() => setEditingNote(null)}
                                        className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const success = await handleUpdateNote(editingNote.id, editingNote.comment);
                                            if (success) setEditingNote(null);
                                        }}
                                        className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all transform hover:scale-105"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyZypheTab;
