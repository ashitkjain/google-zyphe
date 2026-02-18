import React, { useEffect, useState } from 'react';
import { UserProfile } from '../../types';
import { getAllUsers } from '../../services/firebaseService';
import { getAllUserActivity, UserActivityEvent } from '../../services/firebase/user_activity';

interface UserStats {
    uid: string;
    displayName: string;
    email: string;
    role: string;
    lastActive: Date | null;
    pageViews: number;
    loginCount: number;
    activityScore: number; // Simple metric: pageViews + (loginCount * 5)
}

const TeamStatsTab: React.FC = () => {
    const [users, setUsers] = useState<UserStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({
        totalUsers: 0,
        activeThisWeek: 0,
        totalPageViews: 0,
        topPerformer: 'None'
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [allUsers, allActivity] = await Promise.all([
                    getAllUsers(),
                    getAllUserActivity(500) // Get last 500 events for quick stats
                ]);

                // Map users to stats
                const userMap = new Map<string, UserStats>();

                // Initialize with user profiles
                allUsers.forEach(u => {
                    // Only include actual users, maybe filter out some if needed
                    userMap.set(u.uid, {
                        uid: u.uid,
                        displayName: u.displayName || 'Unknown User',
                        email: u.email || 'No Email',
                        role: u.role || 'client',
                        lastActive: null,
                        pageViews: 0,
                        loginCount: 0,
                        activityScore: 0
                    });
                });

                // Aggregate activity
                // Note: user_activity might contain users not in 'users' collection depending on sync
                // but we primarily care about registered users.
                // We also might want to scan ALL activity to get historical counts if possible,
                // but 'getAllUserActivity' is limited. For "summary stats", a limit is tricky.
                // ideally we'd have summary documents. For now, we calculate from the fetched batch.
                // If we want accurate "total page views ever", we need a different approach (e.g. user metadata).
                // "viewHistory" subcollection gives better page view counts per property.
                // Let's rely on the fetched activity buffer for "Recent Activity" and maybe use profile data if available.

                // For this MVP, we will use the fetched activity window.

                let totalPv = 0;
                const now = new Date();
                const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

                allActivity.forEach(event => {
                    const uid = event.user_id;
                    if (!uid) return;

                    if (!userMap.has(uid)) {
                        // Add 'ghost' users found in logs but not profile fetch?
                        // Maybe not for now to keep it clean.
                        return;
                    }

                    const stats = userMap.get(uid)!;

                    // Timestamp handling
                    let eventDate: Date;
                    if (event.timestamp?.toDate) {
                        eventDate = event.timestamp.toDate();
                    } else if (event.timestamp?.seconds) {
                        eventDate = new Date(event.timestamp.seconds * 1000);
                    } else {
                        eventDate = new Date(); // Fallback
                    }

                    if (!stats.lastActive || eventDate > stats.lastActive) {
                        stats.lastActive = eventDate;
                    }

                    if (event.event_type === 'page_view') {
                        stats.pageViews++;
                        totalPv++;
                    } else if (event.event_type === 'login') {
                        stats.loginCount++;
                    }
                });

                // Calculate derived stats
                const statsArray = Array.from(userMap.values());
                statsArray.forEach(s => {
                    s.activityScore = s.pageViews + (s.loginCount * 5);
                });

                // Sort by activity score
                statsArray.sort((a, b) => b.activityScore - a.activityScore);

                const activeUsers = statsArray.filter(u => u.lastActive && u.lastActive > oneWeekAgo).length;

                setUsers(statsArray);
                setSummary({
                    totalUsers: statsArray.length,
                    activeThisWeek: activeUsers,
                    totalPageViews: totalPv, // This is only within the fetch limit!
                    topPerformer: statsArray.length > 0 ? statsArray[0].displayName : 'None'
                });

            } catch (err) {
                console.error("Failed to load team stats", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900">Team Statistics</h1>
                <p className="text-slate-500 mt-2">Overview of user activity and platform usage.</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <SummaryCard
                    title="Total Users"
                    value={summary.totalUsers}
                    icon="fa-users"
                    color="bg-blue-500"
                />
                <SummaryCard
                    title="Active (7 Days)"
                    value={summary.activeThisWeek}
                    icon="fa-signal"
                    color="bg-green-500"
                />
                <SummaryCard
                    title="Recent Page Views"
                    value={summary.totalPageViews}
                    icon="fa-eye"
                    color="bg-indigo-500"
                    subtext="(In last batch)"
                />
                <SummaryCard
                    title="Top User"
                    value={summary.topPerformer}
                    icon="fa-trophy"
                    color="bg-amber-500"
                    isText
                />
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase font-bold text-slate-400">
                            <tr>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Recent Activity</th>
                                <th className="px-6 py-4 text-center">Logins</th>
                                <th className="px-6 py-4 text-center">Page Views</th>
                                <th className="px-6 py-4 text-center">Score</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {users.map((user) => (
                                <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                {user.displayName}
                                            </span>
                                            <span className="text-xs text-slate-400">{user.email}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge role={user.role} />
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.lastActive ? (
                                            <span className="text-slate-700 font-medium">
                                                {user.lastActive.toLocaleDateString()} <span className="text-slate-400 text-xs">at {user.lastActive.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 italic">No recent activity</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center font-mono text-slate-500">
                                        {user.loginCount}
                                    </td>
                                    <td className="px-6 py-4 text-center font-mono text-slate-500">
                                        {user.pageViews}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 min-w-[3rem]">
                                            {user.activityScore}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                        No users found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const SummaryCard: React.FC<{ title: string; value: string | number; icon: string; color: string; subtext?: string; isText?: boolean }> = ({ title, value, icon, color, subtext, isText }) => (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 flex items-center gap-5 hover:shadow-xl transition-shadow duration-300">
        <div className={`w-14 h-14 rounded-2xl ${color} shadow-lg shadow-indigo-500/20 flex items-center justify-center text-white text-xl flex-shrink-0`}>
            <i className={`fa-solid ${icon}`}></i>
        </div>
        <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
            <p className={`font-black text-slate-900 ${isText ? 'text-lg leading-tight' : 'text-3xl'}`}>
                {value}
            </p>
            {subtext && <p className="text-[10px] text-slate-400 font-medium mt-1">{subtext}</p>}
        </div>
    </div>
);

const Badge: React.FC<{ role: string }> = ({ role }) => {
    let color = 'bg-slate-100 text-slate-600';
    if (role === 'admin' || role === 'realtor') color = 'bg-rose-100 text-rose-700';
    if (role === 'buyer') color = 'bg-indigo-100 text-indigo-700';
    if (role === 'seller') color = 'bg-emerald-100 text-emerald-700';
    if (role === 'investor') color = 'bg-amber-100 text-amber-700';
    if (role === 'tester') color = 'bg-cyan-100 text-cyan-700';

    return (
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${color}`}>
            {role}
        </span>
    );
};

export default TeamStatsTab;
