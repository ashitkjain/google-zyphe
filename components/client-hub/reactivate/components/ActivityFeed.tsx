import React, { useMemo } from 'react';
import { Lead } from '../../../../types';
import { LeadPlanRecord } from '../../../../types/ai';

interface ActivityFeedProps {
    messages: any[];
    leads: Lead[];
    plans: LeadPlanRecord[];
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ messages, leads, plans }) => {

    const feedItems = useMemo(() => {
        const items = [...messages].map(m => ({ ...m, itemType: 'message' }));
        const now = new Date();

        // Detect follow-up due per lead
        plans.forEach(plan => {
            const leadMsgs = messages.filter(m => m.lead_id === plan.lead_id);
            const outboundMsgs = leadMsgs.filter(m => !m.isInbound);

            if (outboundMsgs.length > 0) {
                // Find Day 1
                const day1Msg = outboundMsgs.reduce((oldest: any, curr: any) => {
                    const timeCurr = curr.sent_at?.toDate ? curr.sent_at.toDate().getTime() : new Date(curr.sent_at).getTime();
                    const timeOldest = oldest ? (oldest.sent_at?.toDate ? oldest.sent_at.toDate().getTime() : new Date(oldest.sent_at).getTime()) : Infinity;
                    return timeCurr < timeOldest ? curr : oldest;
                }, null);

                const day1SentDate = day1Msg.sent_at?.toDate ? day1Msg.sent_at.toDate() : new Date(day1Msg.sent_at);

                plan.sequence.steps.forEach((step, idx) => {
                    const dueDate = new Date(day1SentDate);
                    dueDate.setDate(dueDate.getDate() + step.day_offset);

                    // If it was due in the past and we haven't sent subsequent messages for it
                    if (now > dueDate && outboundMsgs.length <= idx + 1) {
                        items.push({
                            id: `feed-followup-${plan.lead_id}-${step.day_offset}`,
                            itemType: 'recommendation',
                            lead_id: plan.lead_id,
                            channel: step.channel,
                            content: step.message,
                            sent_at: dueDate,
                            day_offset: step.day_offset
                        } as any);
                    }
                });
            }
        });

        return items.sort((a, b) => {
            const timeA = (a.sent_at?.toDate ? a.sent_at.toDate() : new Date(a.sent_at)).getTime();
            const timeB = (b.sent_at?.toDate ? b.sent_at.toDate() : new Date(b.sent_at)).getTime();
            return timeB - timeA;
        });
    }, [messages, plans]);

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

    if (feedItems.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-400 text-sm font-medium">No recent activity.</p>
            </div>
        );
    }

    return (
        <div className="relative pl-6 border-l border-slate-200 space-y-8 py-2">
            {feedItems.map((item, idx) => {
                const lead = leads.find(l => l.id === item.lead_id);
                const isReply = item.reply_received;
                const isRecommendation = item.itemType === 'recommendation';

                return (
                    <div key={item.id || idx} className="relative group">
                        {/* Status Dot on Line */}
                        <div className={`absolute -left-[29px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 
                            ${isRecommendation ? 'bg-indigo-400 animate-pulse' : (isReply ? 'bg-emerald-500' : 'bg-slate-400')}
                        `}></div>

                        <div className="flex flex-col gap-1 items-start">
                            <div className="flex items-center gap-2 w-full">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded
                                    ${isRecommendation ? 'bg-indigo-600 text-white' : (isReply ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-50 text-slate-600')}
                                `}>
                                    {isRecommendation ? `Recommended Day ${item.day_offset}` : (isReply ? 'Reply Received' : `Sent via ${item.channel}`)}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">
                                    {formatTime(item.sent_at)}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-bold text-slate-800">
                                    {lead ? `${lead.firstName} ${lead.lastName}` : 'Unknown Lead'}
                                </span>
                                {!isRecommendation && isReply && item.sentiment && (
                                    <div className={`w-2 h-2 rounded-full ${item.sentiment.includes('positive') ? 'bg-blue-400' : 'bg-amber-400'}`}></div>
                                )}
                                {isRecommendation && (
                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter">Follow-up Opportunity</span>
                                )}
                            </div>

                            <div className={`mt-2 p-4 rounded-2xl text-sm leading-relaxed border relative max-w-2xl
                                ${isRecommendation
                                    ? 'bg-indigo-50/30 border-indigo-100 border-dashed text-slate-600'
                                    : (isReply
                                        ? 'bg-emerald-50/50 border-emerald-100 text-slate-700 font-medium'
                                        : 'bg-white border-slate-100 text-slate-500 italic')
                                }
                            `}>
                                {isReply && (
                                    <div className="absolute -left-1.5 top-4 w-3 h-3 bg-emerald-50 border-l border-b border-emerald-100 transform rotate-45"></div>
                                )}
                                {isRecommendation && (
                                    <div className="absolute -left-1.5 top-4 w-3 h-3 bg-indigo-50/30 border-l border-b border-indigo-100 transform rotate-45"></div>
                                )}
                                "{item.content}"
                            </div>

                            {/* Actions */}
                            {isReply && (
                                <button className="mt-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1 transition-all opacity-0 group-hover:opacity-100">
                                    <i className="fa-solid fa-reply"></i> Reply to {lead?.firstName}
                                </button>
                            )}
                            {isRecommendation && (
                                <button className="mt-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1 transition-all">
                                    <i className="fa-solid fa-paper-plane"></i> Send Recommended Message
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
