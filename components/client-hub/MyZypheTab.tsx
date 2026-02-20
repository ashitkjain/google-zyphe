import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getUserActivity, UserActivityEvent } from '../../services/firebaseService';
import { getAllUsers } from '../../services/firebase/user';
import { getAllUserNotes, deleteStickyNote } from '../../services/firebase/stickyNotes';
import { UserPropertyComment } from '../../types/stickyNotes';
import MessagesTab from './MessagesTab';
import { UserProfile } from '../../types/user';

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



const MyZypheTab: React.FC<MyZypheTabProps> = ({ userId, displayName, email, role }) => {
    const [activity, setActivity] = useState<UserActivityEvent[]>([]);
    const [notes, setNotes] = useState<UserPropertyComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [notesLoading, setNotesLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<'activity' | 'notes' | 'messages' | 'all_users'>('activity');

    // Admin-only: users list + per-user activity cache
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [adminUsersLoading, setAdminUsersLoading] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    // cache: uid → fetched events (undefined = not yet loaded)
    const userActivityCache = useRef<Record<string, UserActivityEvent[]>>({});
    const [selectedUserEvents, setSelectedUserEvents] = useState<UserActivityEvent[]>([]);
    const [selectedUserLoading, setSelectedUserLoading] = useState(false);

    // Personal activity + notes
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

    // Load user list when admin opens the tab
    useEffect(() => {
        if (role !== 'admin') return;
        const loadUsers = async () => {
            setAdminUsersLoading(true);
            try {
                const users = await getAllUsers();
                const sorted = [...users].sort((a, b) =>
                    (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '')
                );
                setAllUsers(sorted);
                // Auto-select admin's own entry first, else first user
                const firstUid = sorted.find(u => u.uid === userId)?.uid ?? sorted[0]?.uid ?? null;
                setSelectedUserId(firstUid);
            } catch (err) {
                console.error('[MyZyphe] Failed to load users:', err);
            } finally {
                setAdminUsersLoading(false);
            }
        };
        loadUsers();
    }, [role]);

    // Fetch selected user's activity on demand, using the cache
    useEffect(() => {
        if (!selectedUserId) return;
        if (userActivityCache.current[selectedUserId]) {
            setSelectedUserEvents(userActivityCache.current[selectedUserId]);
            return;
        }
        const fetchUserActivity = async () => {
            setSelectedUserLoading(true);
            try {
                const events = await getUserActivity(selectedUserId, undefined, undefined, 200);
                userActivityCache.current[selectedUserId] = events;
                setSelectedUserEvents(events);
            } catch (err) {
                console.error('[MyZyphe] Failed to load user activity:', err);
                setSelectedUserEvents([]);
            } finally {
                setSelectedUserLoading(false);
            }
        };
        fetchUserActivity();
    }, [selectedUserId]);

    const handleDeleteNote = async (id: string) => {
        if (!window.confirm('Delete this sticky note permanently?')) return;
        const success = await deleteStickyNote(id);
        if (success) {
            setNotes(prev => prev.filter(n => n.id !== id));
        }
    };


    const stats = useMemo(() => {
        const logins = activity.filter(e => e.event_type === 'login').length;
        const pageViews = activity.filter(e => e.event_type === 'page_view').length;
        const uniquePages = new Set(activity.filter(e => e.event_type === 'page_view').map(e => e.page)).size;
        const propertiesViewed = new Set(activity.filter(e => e.zpid).map(e => e.zpid)).size;
        return { logins, pageViews, uniquePages, propertiesViewed, notesCount: notes.length };
    }, [activity, notes]);

    type DaySummaryEntry = {
        date: string;
        dateRaw: Date;
        logins: number;
        pageCounts: Record<string, number>;
        propCounts: Map<string, { address: string; count: number }>;
    };

    const daySummary = useMemo((): DaySummaryEntry[] => {
        const map = new Map<string, {
            date: string;
            dateRaw: Date;
            logins: number;
            pageCounts: Record<string, number>;          // page key → view count
            propCounts: Map<string, { address: string; count: number }>; // zpid → {address, count}
        }>();

        for (const event of activity) {
            const ts = event.timestamp;
            if (!ts) continue;
            const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
            const key = d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
            const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

            if (!map.has(key)) {
                map.set(key, { date: label, dateRaw: d, logins: 0, pageCounts: {}, propCounts: new Map<string, { address: string; count: number }>() });
            }
            const entry = map.get(key)!;
            if (event.event_type === 'login') {
                entry.logins++;
            } else if (event.event_type === 'page_view') {
                const pageKey = event.page || 'unknown';
                entry.pageCounts[pageKey] = (entry.pageCounts[pageKey] || 0) + 1;
                if (event.zpid) {
                    const existing = entry.propCounts.get(event.zpid);
                    entry.propCounts.set(event.zpid, {
                        address: event.address || event.zpid,
                        count: (existing?.count || 0) + 1
                    });
                }
            }
        }

        return Array.from(map.values()).sort((a, b) => b.dateRaw.getTime() - a.dateRaw.getTime());
    }, [activity]);

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
                            {(role === 'admin' || role === 'auditor') && (
                                <button
                                    onClick={() => setActiveTab('messages')}
                                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'messages' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40 hover:text-white/70'}`}
                                >
                                    <i className="fa-solid fa-comments"></i> Messages
                                </button>
                            )}
                            {role === 'admin' && (
                                <button
                                    onClick={() => setActiveTab('all_users')}
                                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'all_users' ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30' : 'text-white/40 hover:text-white/70'}`}
                                >
                                    <i className="fa-solid fa-users"></i> All Users
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
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center mb-6 animate-pulse">
                                    <i className="fa-solid fa-spinner fa-spin text-indigo-500 text-2xl"></i>
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compiling activities...</p>
                            </div>
                        ) : daySummary.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                                <i className="fa-solid fa-wind text-slate-100 text-7xl mb-6"></i>
                                <h3 className="text-xl font-black text-slate-800 mb-2">The timeline is clear.</h3>
                                <p className="text-sm text-slate-400 font-medium max-w-xs text-center">Your future explorations will document your journey here.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {daySummary.map((day) => {
                                    const pageRows: [string, number][] = (Object.entries(day.pageCounts) as [string, number][]).sort((a, b) => b[1] - a[1]);
                                    const propRows: { address: string; count: number }[] = (Array.from(day.propCounts.values()) as { address: string; count: number }[]).sort((a, b) => b.count - a.count);
                                    const totalViews: number = pageRows.reduce((s, [, c]) => s + c, 0);
                                    return (
                                        <div key={day.date} className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all overflow-hidden">
                                            {/* Day header — single compact row */}
                                            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 bg-slate-50/60">
                                                <i className="fa-solid fa-calendar-day text-slate-400 text-[11px]"></i>
                                                <span className="text-[11px] font-black text-slate-700 tracking-tight flex-1">{day.date}</span>
                                                {day.logins > 0 && (
                                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest">
                                                        <i className="fa-solid fa-right-to-bracket mr-1"></i>{day.logins} sign-in{day.logins !== 1 ? 's' : ''}
                                                    </span>
                                                )}
                                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-600 text-[9px] font-black uppercase tracking-widest">
                                                    {totalViews} view{totalViews !== 1 ? 's' : ''}
                                                </span>
                                            </div>

                                            {/* Two-column breakdown */}
                                            <div className="grid grid-cols-2 divide-x divide-slate-50">
                                                {/* Left: page breakdown */}
                                                <div className="px-3 py-2">
                                                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Tabs visited</p>
                                                    {pageRows.length === 0 ? (
                                                        <p className="text-[10px] text-slate-300 italic">—</p>
                                                    ) : (
                                                        <table className="w-full">
                                                            <tbody>
                                                                {pageRows.map(([page, count]) => (
                                                                    <tr key={page} className="group">
                                                                        <td className="py-0.5 pr-2">
                                                                            <span className="text-[10px] font-semibold text-slate-600 group-hover:text-indigo-600 transition-colors">
                                                                                {PAGE_LABELS[page] || page}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-0.5 text-right">
                                                                            <span className="text-[10px] font-black text-indigo-500 tabular-nums">{count}×</span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>

                                                {/* Right: property breakdown */}
                                                <div className="px-3 py-2">
                                                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Properties explored</p>
                                                    {propRows.length === 0 ? (
                                                        <p className="text-[10px] text-slate-300 italic">None</p>
                                                    ) : (
                                                        <table className="w-full">
                                                            <tbody>
                                                                {propRows.map((prop) => (
                                                                    <tr key={prop.address} className="group">
                                                                        <td className="py-0.5 pr-2 max-w-0 w-full">
                                                                            <span className="text-[10px] font-semibold text-slate-600 group-hover:text-amber-600 transition-colors truncate block">
                                                                                {prop.address}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-0.5 text-right">
                                                                            <span className="text-[10px] font-black text-amber-500 tabular-nums">{prop.count}×</span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                ) : activeTab === 'all_users' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {adminUsersLoading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="w-20 h-20 rounded-3xl bg-violet-50 flex items-center justify-center mb-6 animate-pulse">
                                    <i className="fa-solid fa-users text-violet-400 text-2xl"></i>
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading all user activity...</p>
                            </div>
                        ) : (
                            <div>
                                {/* User sub-tabs */}
                                <div className="flex gap-1.5 flex-wrap mb-6">
                                    {allUsers.map((u) => {
                                        const userEventCount = userActivityCache.current[u.uid]?.length ?? null;
                                        const isSelected = selectedUserId === u.uid;
                                        return (
                                            <button
                                                key={u.uid}
                                                onClick={() => setSelectedUserId(u.uid)}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${isSelected
                                                    ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-200'
                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600'
                                                    }`}
                                            >
                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black ${isSelected ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                                                    {(u.displayName || u.email || '?')[0].toUpperCase()}
                                                </span>
                                                <span className="truncate max-w-[120px]">{u.displayName || u.email}</span>
                                                <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                    {userEventCount !== null ? userEventCount : '…'}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Selected user's activity breakdown */}
                                {(() => {
                                    const userEvents = selectedUserEvents;
                                    const selectedUser = allUsers.find(u => u.uid === selectedUserId);

                                    // Build daySummary for selected user
                                    type AdminDayEntry = {
                                        date: string; dateRaw: Date; logins: number;
                                        pageCounts: Record<string, number>;
                                        propCounts: Map<string, { address: string; count: number }>;
                                    };
                                    const dayMap = new Map<string, AdminDayEntry>();
                                    for (const event of userEvents) {
                                        const ts = event.timestamp;
                                        if (!ts) continue;
                                        const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
                                        const key = d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
                                        const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                                        if (!dayMap.has(key)) {
                                            dayMap.set(key, { date: label, dateRaw: d, logins: 0, pageCounts: {}, propCounts: new Map<string, { address: string; count: number }>() });
                                        }
                                        const entry = dayMap.get(key)!;
                                        if (event.event_type === 'login') {
                                            entry.logins++;
                                        } else if (event.event_type === 'page_view') {
                                            const pk = event.page || 'unknown';
                                            entry.pageCounts[pk] = (entry.pageCounts[pk] || 0) + 1;
                                            if (event.zpid) {
                                                const ex = entry.propCounts.get(event.zpid);
                                                entry.propCounts.set(event.zpid, { address: event.address || event.zpid, count: (ex?.count || 0) + 1 });
                                            }
                                        }
                                    }
                                    const userDays: AdminDayEntry[] = Array.from(dayMap.values()).sort((a, b) => b.dateRaw.getTime() - a.dateRaw.getTime());

                                    if (selectedUserLoading) {
                                        return (
                                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                                <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mb-4 animate-pulse">
                                                    <i className="fa-solid fa-spinner fa-spin text-violet-400 text-xl"></i>
                                                </div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading activity...</p>
                                            </div>
                                        );
                                    }

                                    if (!selectedUser || userDays.length === 0) {
                                        return (
                                            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                                <i className="fa-solid fa-wind text-slate-100 text-5xl mb-4"></i>
                                                <p className="text-sm font-black text-slate-400">No activity recorded for this user.</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div>
                                            <div className="flex items-center gap-3 mb-4 px-1">
                                                <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 font-black text-sm">
                                                    {(selectedUser.displayName || selectedUser.email || '?')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-800">{selectedUser.displayName || selectedUser.email}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{selectedUser.role} · {selectedUser.email}</p>
                                                </div>
                                                <div className="ml-auto flex gap-3 text-right">
                                                    <div className="px-3 py-1.5 rounded-xl bg-violet-50 border border-violet-100 text-violet-700 text-[9px] font-black uppercase tracking-widest">
                                                        {userEvents.filter(e => e.event_type === 'login').length} sign-ins
                                                    </div>
                                                    <div className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-[9px] font-black uppercase tracking-widest">
                                                        {userEvents.filter(e => e.event_type === 'page_view').length} page views
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                {userDays.map((day) => {
                                                    const pageRows: [string, number][] = (Object.entries(day.pageCounts) as [string, number][]).sort((a, b) => b[1] - a[1]);
                                                    const propRows: { address: string; count: number }[] = (Array.from(day.propCounts.values()) as { address: string; count: number }[]).sort((a, b) => b.count - a.count);
                                                    const totalViews: number = pageRows.reduce((s, [, c]) => s + c, 0);
                                                    return (
                                                        <div key={day.date} className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-violet-100 transition-all overflow-hidden">
                                                            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 bg-slate-50/60">
                                                                <i className="fa-solid fa-calendar-day text-slate-400 text-[11px]"></i>
                                                                <span className="text-[11px] font-black text-slate-700 tracking-tight flex-1">{day.date}</span>
                                                                {day.logins > 0 && (
                                                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest">
                                                                        <i className="fa-solid fa-right-to-bracket mr-1"></i>{day.logins} sign-in{day.logins !== 1 ? 's' : ''}
                                                                    </span>
                                                                )}
                                                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-600 text-[9px] font-black uppercase tracking-widest">
                                                                    {totalViews} view{totalViews !== 1 ? 's' : ''}
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-2 divide-x divide-slate-50">
                                                                <div className="px-3 py-2">
                                                                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Tabs visited</p>
                                                                    {pageRows.length === 0 ? (
                                                                        <p className="text-[10px] text-slate-300 italic">—</p>
                                                                    ) : (
                                                                        <table className="w-full"><tbody>
                                                                            {pageRows.map(([page, count]) => (
                                                                                <tr key={page} className="group">
                                                                                    <td className="py-0.5 pr-2"><span className="text-[10px] font-semibold text-slate-600 group-hover:text-indigo-600 transition-colors">{PAGE_LABELS[page] || page}</span></td>
                                                                                    <td className="py-0.5 text-right"><span className="text-[10px] font-black text-indigo-500 tabular-nums">{count}×</span></td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody></table>
                                                                    )}
                                                                </div>
                                                                <div className="px-3 py-2">
                                                                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Properties explored</p>
                                                                    {propRows.length === 0 ? (
                                                                        <p className="text-[10px] text-slate-300 italic">None</p>
                                                                    ) : (
                                                                        <table className="w-full"><tbody>
                                                                            {propRows.map((prop) => (
                                                                                <tr key={prop.address} className="group">
                                                                                    <td className="py-0.5 pr-2 max-w-0 w-full"><span className="text-[10px] font-semibold text-slate-600 group-hover:text-amber-600 transition-colors truncate block">{prop.address}</span></td>
                                                                                    <td className="py-0.5 text-right"><span className="text-[10px] font-black text-amber-500 tabular-nums">{prop.count}×</span></td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody></table>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
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
