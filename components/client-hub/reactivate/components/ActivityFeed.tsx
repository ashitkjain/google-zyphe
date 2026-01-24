import React, { useMemo } from 'react';
import { Lead } from '../../../../types';

interface ActivityFeedProps {
    messages: any[];
    leads: Lead[];
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ messages, leads }) => {

    // Sort messages by time (newest first)
    const sortedMessages = useMemo(() => {
        return [...messages].sort((a, b) => {
            const timeA = a.sent_at?.seconds || 0;
            const timeB = b.sent_at?.seconds || 0;
            return timeB - timeA;
        });
    }, [messages]);

    const formatTime = (ts: any) => {
        if (!ts) return '';
        const date = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts.seconds ? ts.seconds * 1000 : ts));
        if (isNaN(date.getTime())) return '';

        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    if (sortedMessages.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-400 text-sm font-medium">No recent activity.</p>
            </div>
        );
    }

    return (
        <div className="relative pl-6 border-l border-slate-200 space-y-8 py-2">
            {sortedMessages.map((msg, idx) => {
                const lead = leads.find(l => l.id === msg.lead_id);
                const isReply = msg.reply_received;

                return (
                    <div key={msg.id || idx} className="relative group">
                        {/* Status Dot on Line */}
                        <div className={`absolute -left-[29px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 
                            ${isReply ? 'bg-emerald-500' : 'bg-indigo-500'}
                        `}></div>

                        <div className="flex flex-col gap-1 items-start">
                            <div className="flex items-center gap-2 w-full">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded
                                    ${isReply ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-indigo-600'}
                                `}>
                                    {isReply ? 'Reply Received' : `Sent via ${msg.channel}`}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">
                                    {formatTime(msg.sent_at)}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-bold text-slate-800">
                                    {lead ? `${lead.firstName} ${lead.lastName}` : 'Unknown Lead'}
                                </span>
                                {isReply && msg.sentiment && (
                                    <div className={`w-2 h-2 rounded-full ${msg.sentiment.includes('positive') ? 'bg-blue-400' : 'bg-amber-400'}`}></div>
                                )}
                            </div>

                            <div className={`mt-2 p-4 rounded-2xl text-sm leading-relaxed border relative max-w-2xl
                                ${isReply
                                    ? 'bg-emerald-50/50 border-emerald-100 text-slate-700 font-medium'
                                    : 'bg-white border-slate-100 text-slate-500 italic'
                                }
                            `}>
                                {isReply && (
                                    <div className="absolute -left-1.5 top-4 w-3 h-3 bg-emerald-50 border-l border-b border-emerald-100 transform rotate-45"></div>
                                )}
                                "{msg.content}"
                            </div>

                            {/* Reply Action (Mock) */}
                            {isReply && (
                                <button className="mt-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1 transition-all opacity-0 group-hover:opacity-100">
                                    <i className="fa-solid fa-reply"></i> Reply to {lead?.firstName}
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ActivityFeed;
