import React, { useState, useEffect, useMemo } from 'react';
import { getUserActivity, UserActivityEvent } from '../../services/firebaseService';

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
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');

    useEffect(() => {
        const load = async () => {
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
        load();
    }, [userId]);

    const filteredActivity = useMemo(() => {
        if (filter === 'all') return activity;
        return activity.filter(e => e.event_type === filter);
    }, [activity, filter]);

    // Compute stats
    const stats = useMemo(() => {
        const logins = activity.filter(e => e.event_type === 'login').length;
        const pageViews = activity.filter(e => e.event_type === 'page_view').length;
        const uniquePages = new Set(activity.filter(e => e.event_type === 'page_view').map(e => e.page)).size;
        const propertiesViewed = new Set(activity.filter(e => e.zpid).map(e => e.zpid)).size;
        return { logins, pageViews, uniquePages, propertiesViewed };
    }, [activity]);

    // Group by date for timeline
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

    const filters: { id: FilterType; label: string; icon: string }[] = [
        { id: 'all', label: 'All', icon: 'fa-layer-group' },
        { id: 'login', label: 'Logins', icon: 'fa-right-to-bracket' },
        { id: 'page_view', label: 'Pages', icon: 'fa-eye' },
        { id: 'logout', label: 'Sign Outs', icon: 'fa-right-from-bracket' },
    ];

    return (
        <div className="bg-slate-50 min-h-screen">
            {/* Hero Header */}
            <div className="relative bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23fff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', backgroundSize: '30px 30px' }}
                ></div>

                <div className="max-w-6xl mx-auto px-8 py-12 relative z-10">
                    <div className="flex items-center gap-6 mb-8">
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

                    {/* Stats Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Sessions', value: stats.logins, icon: 'fa-right-to-bracket', gradient: 'from-emerald-500/20 to-emerald-500/5' },
                            { label: 'Page Views', value: stats.pageViews, icon: 'fa-eye', gradient: 'from-indigo-500/20 to-indigo-500/5' },
                            { label: 'Unique Pages', value: stats.uniquePages, icon: 'fa-compass', gradient: 'from-violet-500/20 to-violet-500/5' },
                            { label: 'Properties', value: stats.propertiesViewed, icon: 'fa-house', gradient: 'from-amber-500/20 to-amber-500/5' },
                        ].map((stat) => (
                            <div key={stat.label} className={`bg-gradient-to-br ${stat.gradient} backdrop-blur-md rounded-2xl p-5 border border-white/10`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                                        <i className={`fa-solid ${stat.icon} text-white/80 text-sm`}></i>
                                    </div>
                                    <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">{stat.label}</span>
                                </div>
                                <div className="text-3xl font-black text-white tracking-tight">{stat.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="max-w-6xl mx-auto px-8 py-6">
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                    {filters.map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${filter === f.id
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                : 'bg-white text-slate-400 hover:text-slate-600 border border-slate-100 hover:border-slate-200'
                                }`}
                        >
                            <i className={`fa-solid ${f.icon} text-[10px]`}></i>
                            {f.label}
                            {f.id === 'all' && <span className="ml-1 opacity-60">({activity.length})</span>}
                        </button>
                    ))}
                </div>

                {/* Timeline */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4 animate-pulse">
                            <i className="fa-solid fa-spinner fa-spin text-indigo-400 text-xl"></i>
                        </div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading your activity...</p>
                    </div>
                ) : filteredActivity.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                            <i className="fa-solid fa-ghost text-slate-300 text-3xl"></i>
                        </div>
                        <h3 className="text-lg font-black text-slate-800 mb-2">No Activity Yet</h3>
                        <p className="text-xs text-slate-400 font-bold max-w-xs text-center">
                            Your login sessions, page views, and property explorations will appear here as a timeline.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {groupedByDate.map((group) => (
                            <div key={group.date}>
                                {/* Date Header */}
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg">
                                        <i className="fa-solid fa-calendar-day text-white text-xs"></i>
                                    </div>
                                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">{group.date}</h2>
                                    <div className="flex-1 h-px bg-slate-200"></div>
                                    <span className="text-[10px] font-bold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100">
                                        {group.events.length} event{group.events.length !== 1 ? 's' : ''}
                                    </span>
                                </div>

                                {/* Events */}
                                <div className="relative ml-5 pl-8 border-l-2 border-slate-200 space-y-1">
                                    {group.events.map((event, i) => {
                                        const cfg = EVENT_ICONS[event.event_type] || EVENT_ICONS['page_view'];
                                        const pageLabel = event.page ? (PAGE_LABELS[event.page] || event.page) : '';
                                        const hasProperty = event.address || event.zpid;

                                        return (
                                            <div
                                                key={event.id || i}
                                                className="relative group"
                                            >
                                                {/* Dot on timeline */}
                                                <div className={`absolute -left-[calc(2rem+5px)] w-3 h-3 rounded-full border-2 border-white shadow-sm ${event.event_type === 'login' ? 'bg-emerald-400' :
                                                    event.event_type === 'logout' ? 'bg-slate-400' :
                                                        event.event_type === 'session_timeout' ? 'bg-amber-400' :
                                                            'bg-indigo-400'
                                                    }`}></div>

                                                <div className="bg-white rounded-2xl p-4 border border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all group-hover:translate-x-1">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                                                            <i className={`fa-solid ${cfg.icon} ${cfg.color} text-sm`}></i>
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-xs font-black text-slate-800">{cfg.label}</span>
                                                                {pageLabel && (
                                                                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-bold">
                                                                        {pageLabel}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {hasProperty && (
                                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                                    {event.address && (
                                                                        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                                                                            <i className="fa-solid fa-location-dot text-[9px] text-slate-300"></i>
                                                                            {event.address}
                                                                        </span>
                                                                    )}
                                                                    {event.zpid && (
                                                                        <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 font-mono">
                                                                            ZPID: {event.zpid}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="text-right flex-shrink-0">
                                                            <div className="text-[10px] font-bold text-slate-400" title={formatFullDate(event.timestamp)}>
                                                                {formatTimestamp(event.timestamp)}
                                                            </div>
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
        </div>
    );
};

export default MyZypheTab;
