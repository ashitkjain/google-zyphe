import React, { useState, useEffect, useMemo } from 'react';
import { getUserActivity, UserActivityEvent } from '../../services/firebaseService';
import { getAllUserNotes, deleteStickyNote } from '../../services/firebase/stickyNotes';
import { UserPropertyComment } from '../../types/stickyNotes';
import MessagesTab from './MessagesTab';

interface MyZypheTabProps {
    userId: string;
    displayName: string;
    email: string;
    role: string;
}

const EVENT_ICONS: Record<string, { icon: string; color: string; bg: string; label: string }> = {
    login: { icon: 'fa-right-to-bracket', color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Signed In' },
    logout: { icon: 'fa-right-from-bracket', color: 'text-slate-500', bg: 'bg-slate-50', label: 'Signed Out' },
    session_timeout: { icon: 'fa-clock', color: 'text-amber-600', bg: 'bg-amber-50', label: 'Session Timed Out' },
    page_view: { icon: 'fa-eye', color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Viewed' },
};

const PAGE_LABELS: Record<string, string> = {
    explore: 'Explore',
    main: 'Home',
    leads: 'Funnel',
    closing: 'Closing',
    reactivate: 'Reactivate',
    clients: 'Clients',
    tasks: 'Tasks',
    calendar: 'Calendar',
    whiteboard: 'Whiteboard',
    creative_studio: 'Creative Studio',
    settings: 'Data Fields',
    profile: 'Profile',
    knowledge_center: 'Library',
    best_practices: 'Best Practices',
    guides: 'Guides',
    city_data: 'City Ingestion',
    data_health: 'Data Health',
    ai_validation: 'AI Validation',
    lead_ingestion: 'Lead Ingestion',
    pdf_csv: 'PDF to CSV',
    sms_registration: 'SMS Registration',
    storage_registry: 'Bulk Prefetch',
    bulk_prefetch: 'Bulk Prefetch',
    industry_research: 'Industry Research',
    product_market_fit: 'Product Market Fit',
    post_close_intelligence: 'Post-Close',
    technical_papers: 'Technical Papers',
    technical_papers_recommender: 'Recommender',
    technical_papers_context_graph: 'Context Graph',
    video_upload: 'Video Upload',
    technical_media: 'Technical Media',
    executive_summary: 'Executive Summary',
    industry_case_studies: 'Case Studies',
    unit_economics: 'Unit Economics',
    premium_mls: 'Premium MLS',
    reminder_rules: 'Reminder Rules',
    context_graph_builder: 'Context Graph',
    my_zyphe: 'My Zyphe',
};

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

type FilterType = 'all' | 'login' | 'page_view' | 'logout' | 'session_timeout';

const MyZypheTab: React.FC<MyZypheTabProps> = ({ userId, displayName, email, role }) => {
    const [activity, setActivity] = useState<UserActivityEvent[]>([]);
    const [notes, setNotes] = useState<UserPropertyComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [notesLoading, setNotesLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const [activeTab, setActiveTab] = useState<'activity' | 'notes' | 'messages'>('activity');

    const loadData = async () => {
        setLoading(true);
        try {
            const events = await getUserActivity(userId, undefined, undefined, 200);
            setActivity(events);
        } catch (err) {
            console.error('[MyZyphe] Failed to load activity:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadNotes = async () => {
        setNotesLoading(true);
        try {
            const fetchedNotes = await getAllUserNotes(userId);
            setNotes(fetchedNotes);
        } catch (err) {
            console.error('[MyZyphe] Failed to load notes:', err);
        } finally {
            setNotesLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        loadNotes();
    }, [userId]);

    const handleDeleteNote = async (id: string) => {
        if (!window.confirm('Delete this sticky note permanently?')) return;
        const success = await deleteStickyNote(id);
        if (success) {
            setNotes(prev => prev.filter(n => n.id !== id));
        }
    };

    const filteredActivity = useMemo(() => {
        if (filter === 'all') return activity;
        return activity.filter(e => e.event_type === filter);
    }, [activity, filter]);

    const stats = useMemo(() => {
        const logins = activity.filter(e => e.event_type === 'login').length;
        const pageViews = activity.filter(e => e.event_type === 'page_view').length;
        const uniquePages = new Set(activity.filter(e => e.event_type === 'page_view').map(e => e.page)).size;
        const propertiesViewed = new Set(activity.filter(e => e.zpid).map(e => e.zpid)).size;
        return { logins, pageViews, uniquePages, propertiesViewed, notesCount: notes.length };
    }, [activity, notes]);

    const groupedByDate = useMemo(() => {
        const groups: { date: string; events: UserActivityEvent[] }[] = [];
        let currentDate = '';
        for (const event of filteredActivity) {
            const ts = event.timestamp;
            if (!ts) continue;
            const date = (ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts));
            const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            if (dateStr !== currentDate) {
                currentDate = dateStr;
                groups.push({ date: dateStr, events: [] });
            }
            groups[groups.length - 1].events.push(event);
        }
        return groups;
    }, [filteredActivity]);

    return (
        <div className="bg-slate-50 min-h-screen">
            {/* Hero Header */}
            <div className="relative bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23fff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', backgroundSize: '30px 30px' }}
                ></div>

                <div className="max-w-6xl mx-auto px-8 py-12 relative z-10">
                    <div className="flex items-center justify-between mb-8">
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
                        <div className="hidden md:flex bg-white/5 backdrop-blur-sm p-1 rounded-2xl border border-white/10">
                            <button
                                onClick={() => setActiveTab('activity')}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'activity' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40 hover:text-white/70'}`}
                            >
                                <i className="fa-solid fa-clock-rotate-left"></i> Activity
                            </button>
                            <button
                                onClick={() => setActiveTab('notes')}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'notes' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40 hover:text-white/70'}`}
                            >
                                <i className="fa-solid fa-note-sticky"></i> My Notes
                                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[8px] ${activeTab === 'notes' ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/40'}`}>
                                    {stats.notesCount}
                                </span>
                            </button>
                            {(role === 'admin' || role === 'tester') && (
                                <button
                                    onClick={() => setActiveTab('messages')}
                                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'messages' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40 hover:text-white/70'}`}
                                >
                                    <i className="fa-solid fa-comments"></i> Messages
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                            { label: 'Sessions', value: stats.logins, icon: 'fa-right-to-bracket', color: 'text-emerald-400' },
                            { label: 'Views', value: stats.pageViews, icon: 'fa-eye', color: 'text-indigo-400' },
                            { label: 'Unique', value: stats.uniquePages, icon: 'fa-compass', color: 'text-violet-400' },
                            { label: 'Props', value: stats.propertiesViewed, icon: 'fa-house', color: 'text-amber-400' },
                            { label: 'Notes', value: stats.notesCount, icon: 'fa-note-sticky', color: 'text-rose-400' },
                        ].map((stat) => (
                            <div key={stat.label} className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                                        <i className={`fa-solid ${stat.icon} ${stat.color} text-sm`}></i>
                                    </div>
                                    <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">{stat.label}</span>
                                </div>
                                <div className="text-3xl font-black text-white tracking-tight">{stat.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Messages tab — full-height chat, no max-width wrapper */}
            {activeTab === 'messages' && (
                <div className="flex flex-col" style={{ height: 'calc(100vh - 260px)' }}>
                    <MessagesTab userId={userId} displayName={displayName} role={role} />
                </div>
            )}

            {/* Content Area */}
            <div className="max-w-6xl mx-auto px-8 py-8">
                {activeTab === 'activity' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Filter Bar */}
                        <div className="flex items-center gap-2 mb-8 overflow-x-auto no-scrollbar pb-2">
                            {([
                                { id: 'all', label: 'All Events', icon: 'fa-layer-group' },
                                { id: 'login', label: 'Logins', icon: 'fa-right-to-bracket' },
                                { id: 'page_view', label: 'Page Views', icon: 'fa-eye' },
                            ] as { id: FilterType; label: string; icon: string }[]).map((f) => (
                                <button
                                    key={f.id}
                                    onClick={() => setFilter(f.id)}
                                    className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap shadow-sm border ${filter === f.id
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-200 shadow-xl'
                                        : 'bg-white text-slate-500 hover:text-slate-800 border-slate-200'
                                        }`}
                                >
                                    <i className={`fa-solid ${f.icon}`}></i>
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center mb-6 animate-pulse">
                                    <i className="fa-solid fa-spinner fa-spin text-indigo-500 text-2xl"></i>
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compiling activities...</p>
                            </div>
                        ) : filteredActivity.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                                <i className="fa-solid fa-wind text-slate-100 text-7xl mb-6"></i>
                                <h3 className="text-xl font-black text-slate-800 mb-2">The timeline is clear.</h3>
                                <p className="text-sm text-slate-400 font-medium max-w-xs text-center">Your future explorations will document your journey here.</p>
                            </div>
                        ) : (
                            <div className="space-y-12">
                                {groupedByDate.map((group) => (
                                    <div key={group.date}>
                                        <div className="flex items-center gap-6 mb-8 group">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-900 border-4 border-white shadow-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <i className="fa-solid fa-calendar-check text-white text-sm"></i>
                                            </div>
                                            <div className="flex flex-col">
                                                <h2 className="text-base font-black text-slate-800 tracking-tight">{group.date}</h2>
                                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">
                                                    {group.events.length} Interaction{group.events.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <div className="flex-1 h-px bg-slate-200"></div>
                                        </div>

                                        <div className="relative ml-6 pl-10 border-l-2 border-slate-200/60 pb-8 space-y-4">
                                            {group.events.map((event, i) => {
                                                const cfg = EVENT_ICONS[event.event_type] || EVENT_ICONS['page_view'];
                                                const pageLabel = event.page ? (PAGE_LABELS[event.page] || event.page) : '';

                                                return (
                                                    <div key={event.id || i} className="relative group">
                                                        <div className={`absolute -left-[calc(2.5rem+7px)] w-3.5 h-3.5 rounded-full border-4 border-slate-50 shadow-md ${event.event_type === 'login' ? 'bg-emerald-400' :
                                                            event.event_type === 'logout' ? 'bg-slate-400' :
                                                                'bg-indigo-400'
                                                            }`}></div>

                                                        <div className="bg-white rounded-2xl p-5 border border-slate-100 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50 transition-all group-hover:translate-x-2">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-12 h-12 rounded-2xl ${cfg.bg} flex items-center justify-center flex-shrink-0 shadow-inner`}>
                                                                    <i className={`fa-solid ${cfg.icon} ${cfg.color} text-lg`}></i>
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                                                                        <span className="text-sm font-black text-slate-900">{cfg.label}</span>
                                                                        {pageLabel && (
                                                                            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[9px] font-black uppercase tracking-widest border border-indigo-100/50">
                                                                                {pageLabel}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {event.address && (
                                                                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                                                                            <i className="fa-solid fa-location-dot text-indigo-400"></i>
                                                                            {event.address}
                                                                            {event.zpid && <span className="opacity-40 font-mono ml-2">#{event.zpid}</span>}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-tighter mb-0.5">{formatFullDate(event.timestamp).split(',')[0]}</p>
                                                                    <p className="text-xs font-black text-slate-800 tabular-nums">{formatTimestamp(event.timestamp)}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : activeTab === 'messages' ? null : (
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
                                                            <span className="text-xs font-black text-slate-900 uppercase tracking-tight">
                                                                {PAGE_LABELS[note.tab] || note.tab}
                                                            </span>
                                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                                                                <i className="fa-solid fa-house text-indigo-300"></i>
                                                                ZPID: {note.zpid}
                                                            </div>
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
                                                        <button
                                                            onClick={() => handleDeleteNote(note.id)}
                                                            className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                                                            title="Delete Note"
                                                        >
                                                            <i className="fa-solid fa-trash-can text-sm"></i>
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
                )}
            </div>
        </div>
    );
};

export default MyZypheTab;
