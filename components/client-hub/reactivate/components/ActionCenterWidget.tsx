import React, { useState, useEffect } from 'react';
import {
    getActionRequiredMessages,
    completeMessageAction,
    getReactivationMessages
} from '../../../../services/firebase/communications';
import { getAllUserLeadPlans, updateLeadPlanStatus } from '../../../../services/firebase/reactivation';
import { serverTimestamp } from 'firebase/firestore';

export interface ActionItem {
    id: string;
    type: 'reply' | 'task' | 'error';
    leadName: string;
    leadId: string;
    planId?: string;
    content: string;
    timestamp: Date;
    priority: 'high' | 'medium' | 'low';
    sentiment?: 'positive' | 'negative' | 'neutral' | 'question';
}

interface ActionCenterWidgetProps {
    onOpenLead: (leadId: string) => void;
    realtorId: string;
}

const ActionCenterWidget: React.FC<ActionCenterWidgetProps> = ({ onOpenLead, realtorId }) => {
    const [actionItems, setActionItems] = useState<ActionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClick = () => setOpenMenuId(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    useEffect(() => {
        const fetchActionItems = async () => {
            setLoading(true);
            try {
                console.log('🔍 Fetching action items for realtorId:', realtorId);

                // 1. Fetch Inbound replies
                const inboundMessages = await getActionRequiredMessages(realtorId);

                // 2. Fetch Lead Plans and all sent messages to detect follow-ups
                const [plans, allMessages] = await Promise.all([
                    getAllUserLeadPlans(realtorId),
                    getReactivationMessages(realtorId, undefined, 500) // Get more for history
                ]);

                // 3. Transform database messages to ActionItem format
                const replyItems: ActionItem[] = inboundMessages.map((msg: any) => {
                    const plan = plans.find(p => p.lead_id === msg.lead_id);
                    return {
                        id: msg.id,
                        type: 'reply' as const,
                        leadName: msg.lead_name || plan?.lead_name || 'Unknown Lead',
                        leadId: msg.lead_id,
                        planId: plan?.id,
                        content: msg.content,
                        timestamp: msg.sent_at?.toDate ? msg.sent_at.toDate() : new Date(msg.sent_at),
                        priority: determinePriority(msg.sent_at),
                        sentiment: msg.sentiment || 'neutral'
                    };
                });

                // 4. Detect Overdue Follow-ups
                const followUpItems: ActionItem[] = [];
                const now = new Date();

                plans.forEach(plan => {
                    // Only detect follow-ups for leads actively being pursued
                    if (plan.reactivation_status !== 'pursuing' && plan.reactivation_status !== undefined) {
                        return;
                    }

                    const leadMsgs = allMessages.filter((m: any) => m.lead_id === plan.lead_id);
                    const outboundMsgs = leadMsgs.filter((m: any) => !m.isInbound);

                    // Smallest 'sent_at' is usually Day 1
                    const day1Msg = outboundMsgs.reduce((oldest: any, curr: any) => {
                        const timeCurr = curr.sent_at?.toDate ? curr.sent_at.toDate().getTime() : new Date(curr.sent_at).getTime();
                        const timeOldest = oldest ? (oldest.sent_at?.toDate ? oldest.sent_at.toDate().getTime() : new Date(oldest.sent_at).getTime()) : Infinity;
                        return timeCurr < timeOldest ? curr : oldest;
                    }, null);

                    if (!day1Msg) {
                        // Day 1 not sent. Is it due? (Optional logic, usually manual first)
                        // For now, let's only do subsequent follow-ups to avoid noise
                    } else {
                        const day1SentDate = day1Msg.sent_at?.toDate ? day1Msg.sent_at.toDate() : new Date(day1Msg.sent_at);

                        plan.sequence.steps.forEach((step, idx) => {
                            const dueDate = new Date(day1SentDate);
                            dueDate.setDate(dueDate.getDate() + step.day_offset);

                            if (now > dueDate) {
                                // Due. Has it been sent?
                                // We check if there's an outbound message roughly at day_offset
                                // A simpler check: how many outbound messages do we have?
                                // If we have 1 (Day 1) and this is the first step (idx 0), then it's due.
                                if (outboundMsgs.length <= idx + 1) {
                                    followUpItems.push({
                                        id: `followup-${plan.lead_id}-${step.day_offset}`,
                                        type: 'task' as const,
                                        leadName: plan.lead_name,
                                        leadId: plan.lead_id,
                                        planId: plan.id,
                                        content: `Recommended Day ${step.day_offset} Follow-up: "${step.message}"`,
                                        timestamp: dueDate,
                                        priority: (now.getTime() - dueDate.getTime()) > (1000 * 60 * 60 * 24) ? 'high' : 'medium'
                                    });
                                }
                            }
                        });
                    }
                });

                // Combine and sort by timestamp
                const combined = [...replyItems, ...followUpItems].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

                setActionItems(combined);
            } catch (error) {
                console.error('❌ Failed to fetch action items:', error);
            } finally {
                setLoading(false);
            }
        };

        if (realtorId) {
            fetchActionItems();
        }
    }, [realtorId]);

    const determinePriority = (sentAt: any): 'high' | 'medium' | 'low' => {
        const timestamp = sentAt?.toDate ? sentAt.toDate() : new Date(sentAt);
        const hoursSince = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);

        if (hoursSince < 2) return 'high';
        if (hoursSince < 24) return 'medium';
        return 'low';
    };

    const handleDismiss = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();

        // If it's a message reply, mark it as completed
        if (!id.startsWith('followup-')) {
            await completeMessageAction(id, serverTimestamp());
        }

        // Remove from local state
        setActionItems(prev => prev.filter(item => item.id !== id));
        setOpenMenuId(null);
    };

    const handleArchive = async (item: ActionItem, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!item.planId) {
            alert("No plan ID found for this lead.");
            return;
        }

        if (confirm(`Are you sure you want to archive the reactivation plan for ${item.leadName}? This will stop all future follow-up reminders.`)) {
            await updateLeadPlanStatus(item.planId, 'archived');

            // Remove all items for this lead from the widget
            setActionItems(prev => prev.filter(i => i.leadId !== item.leadId));
            setOpenMenuId(null);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-xl shadow-indigo-500/5 mb-8">
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            </div>
        );
    }

    if (actionItems.length === 0) return null;

    return (
        <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-xl shadow-indigo-500/5 mb-8 animate-in slide-in-from-top-4 duration-700">
            <div className="bg-gradient-to-r from-rose-50 to-white px-8 py-4 border-b border-rose-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div
                        className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 animate-pulse"
                        title="Action Required: New Replies or Overdue Tasks"
                    >
                        <i className="fa-solid fa-bell text-sm"></i>
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-800">Action Required</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{actionItems.length} Leads Waiting for Response</p>
                    </div>
                </div>
            </div>

            <div className="divide-y divide-slate-50">
                {actionItems.map(item => (
                    <div
                        key={item.id}
                        onClick={() => onOpenLead(item.leadId)}
                        className="p-6 hover:bg-slate-50 transition-colors cursor-pointer group flex items-start gap-4"
                    >
                        {/* Status Indicator */}
                        <div
                            className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${item.priority === 'high' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-amber-500'}`}
                            title={`Priority: ${item.priority.toUpperCase()}`}
                        ></div>

                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="font-black text-slate-700 text-sm">{item.leadName}</span>
                                        {item.type === 'reply' ? (
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${item.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-700' :
                                                item.sentiment === 'question' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                {item.sentiment}
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700">
                                                Follow-up Due
                                            </span>
                                        )}
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {item.timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' })} • {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    <p className="text-sm font-medium text-slate-600 italic leading-relaxed">
                                        {item.type === 'reply' ? `"${item.content}"` : item.content}
                                    </p>
                                </div>

                                <div className="relative flex-shrink-0">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenMenuId(openMenuId === item.id ? null : item.id);
                                        }}
                                        className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-colors"
                                        title="Show available actions"
                                    >
                                        <i className="fa-solid fa-ellipsis-vertical"></i>
                                    </button>

                                    {openMenuId === item.id && (
                                        <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-[100] animate-in fade-in zoom-in-95 duration-200">
                                            {item.type === 'reply' && (
                                                <button
                                                    onClick={() => {
                                                        onOpenLead(item.leadId);
                                                        setOpenMenuId(null);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                                                >
                                                    <i className="fa-solid fa-reply text-indigo-500 w-4"></i>
                                                    Reply Now
                                                </button>
                                            )}

                                            <button
                                                onClick={() => {
                                                    onOpenLead(item.leadId);
                                                    setOpenMenuId(null);
                                                }}
                                                className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                                            >
                                                <i className="fa-solid fa-paper-plane text-indigo-500 w-4"></i>
                                                Send Follow-up
                                            </button>

                                            <button
                                                onClick={(e) => handleDismiss(item.id, e)}
                                                className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                                            >
                                                <i className="fa-solid fa-check text-emerald-500 w-4"></i>
                                                Dismiss
                                            </button>

                                            <div className="my-1 border-t border-slate-50"></div>

                                            <button
                                                onClick={(e) => handleArchive(item, e)}
                                                className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors"
                                            >
                                                <i className="fa-solid fa-box-archive w-4"></i>
                                                Archive Plan
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ActionCenterWidget;
