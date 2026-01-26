import React, { useState, useEffect } from 'react';
import { LeadReactivationResult } from '../../../types/ai';
import { ReactivationMessage } from '../../../types';
import { logMessageEvent, saveReactivationMessage, createThreadId, getReactivationMessages } from '../../../services/firebase/communications';
import { updateLeadPlanStatus, updateLeadPlanStep } from '../../../services/firebase/reactivation';
import { serverTimestamp } from 'firebase/firestore';

interface ReactivationVisualizerProps {
    result: LeadReactivationResult;
    onReset?: () => void;
    showReset?: boolean;
    title?: string;
    agentId: string;
    onOpenLeadDetails?: (leadId: string) => void;
    highlightedLeadId?: string | null;
}

const ReactivationVisualizer: React.FC<ReactivationVisualizerProps> = ({
    result,
    onReset,
    showReset = true,
    title,
    agentId,
    onOpenLeadDetails,
    highlightedLeadId
}) => {
    const [selectedMarketName, setSelectedMarketName] = useState<string | null>(null);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState<string>('');
    const [editingChannel, setEditingChannel] = useState<string>('');
    const [localPlans, setLocalPlans] = useState(result.lead_plans);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [sendingKeys, setSendingKeys] = useState<Set<string>>(new Set());
    const [sentKeys, setSentKeys] = useState<Set<string>>(new Set());
    const [permanentlySentKeys, setPermanentlySentKeys] = useState<Set<string>>(new Set());
    const [threadIds, setThreadIds] = useState<Record<string, string>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCityTab, setActiveCityTab] = useState('All');
    const [viewingHistoryLeadId, setViewingHistoryLeadId] = useState<string | null>(null);
    const [historyMessages, setHistoryMessages] = useState<ReactivationMessage[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const CHANNELS = ['sms', 'email', 'call', 'direct_mail'];

    useEffect(() => {
        setLocalPlans(result.lead_plans);
    }, [result.lead_plans]);

    useEffect(() => {
        if (highlightedLeadId) {
            // Ensure the lead is visible by showing all cities and clearing search
            setActiveCityTab('All');
            setSearchQuery('');

            // Give a tiny delay for React to ensure the element exists after state changes
            setTimeout(() => {
                const element = document.getElementById(`plan-card-${highlightedLeadId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    element.classList.add('ring-4', 'ring-indigo-500', 'ring-opacity-50', 'bg-indigo-50/10');
                    setTimeout(() => {
                        element.classList.remove('ring-4', 'ring-indigo-500', 'ring-opacity-50', 'bg-indigo-50/10');
                    }, 3000);
                }
            }, 150);
        }
    }, [highlightedLeadId]);

    useEffect(() => {
        if (result && result.market_context.length > 0 && !selectedMarketName) {
            setSelectedMarketName(result.market_context[0].market_name);
        }
    }, [result, selectedMarketName]);

    const handleCopy = async (text: string, key: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const startEditing = (planIdx: number, stepIdx: number | 'first', currentMessage: string, currentChannel: string) => {
        const key = stepIdx === 'first' ? `${planIdx}-first` : `${planIdx}-${stepIdx}`;
        setEditingKey(key);
        setEditingValue(currentMessage);
        setEditingChannel(currentChannel);
    };

    const handleSave = (planIdx: number, stepIdx: number | 'first') => {
        const updated = [...localPlans];
        if (stepIdx === 'first') {
            updated[planIdx] = {
                ...updated[planIdx],
                recommended_channel: editingChannel as any,
                first_touch: { ...updated[planIdx].first_touch, message: editingValue }
            };
        } else if (typeof stepIdx === 'number') {
            const steps = [...updated[planIdx].sequence.steps];
            steps[stepIdx] = { ...steps[stepIdx], message: editingValue, channel: editingChannel as any };
            updated[planIdx] = {
                ...updated[planIdx],
                sequence: { ...updated[planIdx].sequence, steps }
            };
        }
        setLocalPlans(updated);
        setEditingKey(null);
    };

    const handleCancel = () => {
        setEditingKey(null);
        setEditingValue('');
        setEditingChannel('');
    };

    const handleViewHistory = async (leadId: string) => {
        setViewingHistoryLeadId(leadId);
        setHistoryLoading(true);
        try {
            const msgs = await getReactivationMessages(agentId, leadId);
            // Sort by sent_at ascending for the chat view
            const sorted = [...msgs].sort((a, b) => {
                const timeA = a.sent_at?.toDate ? a.sent_at.toDate().getTime() : new Date(a.sent_at).getTime();
                const timeB = b.sent_at?.toDate ? b.sent_at.toDate().getTime() : new Date(b.sent_at).getTime();
                return timeA - timeB;
            });
            setHistoryMessages(sorted as any);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleMockReply = async (planIdx: number, stepIdx: number | 'first', leadId: string) => {
        const currentPlan = localPlans[planIdx] as any;
        if (!currentPlan?.id) return;

        try {
            // Update DB
            await updateLeadPlanStatus(currentPlan.id, 'responded');
            await updateLeadPlanStep(currentPlan.id, stepIdx, { reply_received: true });

            // Log mock inbound message
            const message_id = crypto.randomUUID();
            let thread_id = threadIds[leadId];
            if (!thread_id) {
                thread_id = createThreadId(leadId, agentId);
                setThreadIds(prev => ({ ...prev, [leadId]: thread_id }));
            }

            await saveReactivationMessage({
                message_id,
                lead_id: leadId,
                lead_name: currentPlan.lead_name,
                realtorId: agentId,
                channel: 'sms', // Defaulting to SMS for mock reply
                content: "This sounds interesting! Tell me more.",
                sent_at: serverTimestamp(),
                reply_received: false,
                sentiment: 'positive',
                isInbound: true,
                thread_id,
                requires_action: true
            });

            // Update local state
            const updated = [...localPlans];
            const now = new Date();

            if (stepIdx === 'first') {
                updated[planIdx] = {
                    ...updated[planIdx],
                    reactivation_status: 'responded',
                    statusUpdatedOn: now,
                    first_touch: { ...updated[planIdx].first_touch, reply_received: true }
                } as any;
            } else {
                const steps = [...updated[planIdx].sequence.steps];
                const numericStepIdx = typeof stepIdx === 'number' ? stepIdx : parseInt(stepIdx);
                if (!isNaN(numericStepIdx)) {
                    steps[numericStepIdx] = { ...steps[numericStepIdx], reply_received: true };
                    updated[planIdx] = {
                        ...updated[planIdx],
                        reactivation_status: 'responded',
                        statusUpdatedOn: now,
                        sequence: { ...updated[planIdx].sequence, steps }
                    } as any;
                }
            }
            setLocalPlans(updated);

        } catch (err) {
            console.error('Error in handleMockReply:', err);
        }
    };

    const handleSend = async (planIdx: number, stepIdx: number | 'first', message: string, channel: string, leadId: string) => {
        const key = stepIdx === 'first' ? `${planIdx}-first` : `${planIdx}-${stepIdx}`;

        setSendingKeys(prev => new Set(prev).add(key));

        try {
            const event_id = crypto.randomUUID();
            const message_id = crypto.randomUUID();

            const event: any = {
                event_id,
                lead_id: leadId,
                agent_id: agentId,
                message_id,
                channel: channel === 'direct_mail' ? 'mail' : channel as any,
                event_type: 'sent',
                provider: 'other',
                timestamp: serverTimestamp(),
                isInbound: false,
                source: 'automated',
                raw_payload: { message: message }
            };

            const response = await logMessageEvent(event);

            if (response.success) {
                // Get or create thread ID for this lead
                let thread_id = threadIds[leadId];
                if (!thread_id) {
                    thread_id = createThreadId(leadId, agentId);
                    setThreadIds(prev => ({ ...prev, [leadId]: thread_id }));
                }

                // Also save to reactivation_messages collection for Message Trail
                await saveReactivationMessage({
                    message_id,
                    lead_id: leadId,
                    realtorId: agentId,
                    channel: channel === 'direct_mail' ? 'mail' : channel,
                    content: message,
                    sent_at: serverTimestamp(),
                    reply_received: false,
                    sentiment: 'neutral',
                    // Conversation threading fields
                    isInbound: false,  // Agent sending to lead
                    thread_id,
                    parent_message_id: undefined,  // First message in sequence
                    requires_action: false  // Outbound messages don't require action
                });

                // Add to permanently sent keys
                setPermanentlySentKeys(prev => new Set(prev).add(key));

                // Update plan status and timestamp
                const currentPlan = localPlans[planIdx] as any;
                if (currentPlan?.id) {
                    const newStatus = (!currentPlan.reactivation_status || currentPlan.reactivation_status === 'suggested')
                        ? 'pursuing'
                        : currentPlan.reactivation_status;

                    await updateLeadPlanStatus(currentPlan.id, newStatus);
                    await updateLeadPlanStep(currentPlan.id, stepIdx, {
                        sent_at: serverTimestamp(),
                        reply_received: false
                    });

                    // Update local state to reflect new status and update time
                    const updated = [...localPlans];
                    const now = new Date();
                    const stepUpdates = { sent_at: now, reply_received: false };

                    if (stepIdx === 'first') {
                        updated[planIdx] = {
                            ...updated[planIdx],
                            reactivation_status: newStatus,
                            statusUpdatedOn: now,
                            first_touch: { ...updated[planIdx].first_touch, ...stepUpdates }
                        } as any;
                    } else {
                        const steps = [...updated[planIdx].sequence.steps];
                        const numericStepIdx = typeof stepIdx === 'number' ? stepIdx : parseInt(stepIdx);
                        if (!isNaN(numericStepIdx)) {
                            steps[numericStepIdx] = { ...steps[numericStepIdx], ...stepUpdates };
                            updated[planIdx] = {
                                ...updated[planIdx],
                                reactivation_status: newStatus,
                                statusUpdatedOn: now,
                                sequence: { ...updated[planIdx].sequence, steps }
                            } as any;
                        }
                    }
                    setLocalPlans(updated);
                }

                // Show temporary success indicator
                setSentKeys(prev => new Set(prev).add(key));
                setTimeout(() => {
                    setSentKeys(prev => {
                        const next = new Set(prev);
                        next.delete(key);
                        return next;
                    });
                }, 3000);
            } else {
                alert(`Failed to log message: ${response.error}`);
            }
        } catch (err) {
            console.error('Error in handleSend:', err);
            alert('Failed to send message event.');
        } finally {
            setSendingKeys(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }
    };

    const getCityFromMarket = (market: string) => {
        if (!market) return 'Unknown';
        return market.split(' - ')[0].trim();
    };

    const filteredPlans = localPlans.filter(plan => {
        const matchesSearch = plan.lead_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            plan.market?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            plan.staleness_reason?.toLowerCase().includes(searchQuery.toLowerCase());

        const planCity = getCityFromMarket(plan.market);
        const matchesCity = activeCityTab === 'All' || planCity === activeCityTab;

        return matchesSearch && matchesCity;
    });

    const allCities = Array.from(new Set(localPlans.map(p => getCityFromMarket(p.market)))).sort();
    const visibleCities = allCities.slice(0, 4);
    const hiddenCities = allCities.slice(4);
    const isHiddenCitySelected = hiddenCities.includes(activeCityTab);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Action Plans */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h3 className="text-xl font-black text-slate-900">Action Plans</h3>

                        <div className="flex items-center gap-3 px-4 py-2 bg-slate-50/80 rounded-2xl border border-slate-100 min-w-[300px] focus-within:bg-white focus-within:border-indigo-200 transition-all ml-4">
                            <i className="fa-solid fa-magnifying-glass text-slate-300 text-xs"></i>
                            <input
                                type="text"
                                placeholder="Filter action plans..."
                                className="bg-transparent border-none outline-none w-full text-slate-700 placeholder:text-slate-400 font-bold text-xs"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {showReset && onReset && (
                            <button
                                onClick={onReset}
                                className="px-4 py-1.5 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-white hover:text-indigo-600 hover:border-indigo-100 transition-all active:scale-95 shadow-sm"
                            >
                                <i className="fa-solid fa-rotate-left mr-2"></i>
                                New Analysis
                            </button>
                        )}
                    </div>
                </div>

                {/* City Tabs */}
                <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-2 p-1.5 bg-slate-100/50 rounded-2xl w-fit">
                        {/* All Tab */}
                        <button
                            onClick={() => setActiveCityTab('All')}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeCityTab === 'All' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            All
                            <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[8px] ${activeCityTab === 'All' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                                {localPlans.length}
                            </span>
                        </button>

                        {/* Visible Cities */}
                        {visibleCities.map(c => (
                            <button
                                key={c}
                                onClick={() => setActiveCityTab(c)}
                                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeCityTab === c ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {c}
                                <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[8px] ${activeCityTab === c ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                                    {localPlans.filter(p => getCityFromMarket(p.market) === c).length}
                                </span>
                            </button>
                        ))}

                        {/* Others Dropdown */}
                        {hiddenCities.length > 0 && (
                            <div className="relative group/others flex items-center">
                                <div className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all ${isHiddenCitySelected ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-200/50 text-slate-500 hover:bg-slate-200'} cursor-pointer relative`}>
                                    <select
                                        value={isHiddenCitySelected ? activeCityTab : ''}
                                        onChange={(e) => {
                                            if (e.target.value) setActiveCityTab(e.target.value);
                                        }}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    >
                                        <option value="" disabled>Select City...</option>
                                        {hiddenCities.map(c => (
                                            <option key={c} value={c} className="text-slate-700 font-bold uppercase">{c} ({localPlans.filter(p => getCityFromMarket(p.market) === c).length})</option>
                                        ))}
                                    </select>

                                    <span className="text-[10px] font-black uppercase tracking-widest pointer-events-none">
                                        {isHiddenCitySelected ? activeCityTab : 'More Cities'}
                                    </span>

                                    <span className={`px-1.5 py-0.5 rounded-md text-[8px] pointer-events-none ${isHiddenCitySelected ? 'bg-white/20 text-white' : 'bg-slate-300 text-slate-600'}`}>
                                        {hiddenCities.reduce((acc, c) => acc + localPlans.filter(p => getCityFromMarket(p.market) === c).length, 0)}
                                    </span>

                                    <i className={`fa-solid fa-caret-down text-[10px] ml-1 pointer-events-none transition-transform group-hover/others:rotate-180 ${isHiddenCitySelected ? 'text-white' : 'text-slate-400'}`}></i>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                        <span>Showing {filteredPlans.length} Reactivation Paths for {activeCityTab}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {filteredPlans.map((plan, idx) => {
                            // Find the original index in localPlans for editing/sending
                            const originalIdx = localPlans.indexOf(plan);
                            return (
                                <div
                                    key={originalIdx}
                                    id={`plan-card-${plan.lead_id}`}
                                    className={`bg-white rounded-[2rem] border border-slate-200 overflow-hidden hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-700 group border-l-4 ${highlightedLeadId === plan.lead_id ? 'ring-4 ring-indigo-500 ring-opacity-50' : ''}`}
                                    style={{ borderLeftColor: plan.priority_score > 0.8 ? '#4f46e5' : plan.priority_score > 0.5 ? '#3b82f6' : '#94a3b8' }}
                                >
                                    <div className="p-8">
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                            {/* Lead Info */}
                                            <div className="lg:col-span-3 space-y-4">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center font-bold text-xs" title="Lead Position in List">
                                                            #{idx + 1}
                                                        </div>
                                                        <span className="text-xs font-black uppercase tracking-widest text-slate-400" title="Primary Market">{plan.market}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="text-lg font-black text-slate-900 truncate" title="Lead Name">{plan.lead_name}</h4>

                                                        <div className="flex items-center gap-1.5 ml-auto">
                                                            {/* Status Badge */}
                                                            <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${(plan as any).reactivation_status === 'pursuing' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                                (plan as any).reactivation_status === 'responded' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                                    (plan as any).reactivation_status === 'not_pursuing' || (plan as any).reactivation_status === 'archived' ? 'bg-slate-50 text-slate-500 border-slate-200 opacity-60' :
                                                                        'bg-amber-50 text-amber-700 border-amber-200'
                                                                }`}
                                                                title={`Current Reactivation Status: ${((plan as any).reactivation_status || 'Suggested').toUpperCase()}`}
                                                            >
                                                                {(plan as any).reactivation_status || 'Suggested'}
                                                            </div>

                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onOpenLeadDetails?.(plan.lead_id);
                                                                }}
                                                                className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-90"
                                                                title="View Full Lead Profile"
                                                            >
                                                                <i className="fa-solid fa-circle-info text-[11px] font-black"></i>
                                                            </button>

                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleViewHistory(plan.lead_id);
                                                                }}
                                                                className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-90"
                                                                title="View Message Trail"
                                                            >
                                                                <i className="fa-solid fa-comments text-[10px] font-black"></i>
                                                            </button>

                                                            {/* Ignore/Not Pursuing Action */}
                                                            {(!plan.reactivation_status || plan.reactivation_status === 'suggested') && (
                                                                <button
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        if (confirm(`Are you sure you want to ignore ${plan.lead_name}?`)) {
                                                                            const planId = (plan as any).id;
                                                                            if (planId) {
                                                                                await updateLeadPlanStatus(planId, 'not_pursuing');
                                                                                const updated = [...localPlans];
                                                                                updated[originalIdx] = {
                                                                                    ...updated[originalIdx],
                                                                                    reactivation_status: 'not_pursuing',
                                                                                    statusUpdatedOn: new Date()
                                                                                } as any;
                                                                                setLocalPlans(updated);
                                                                            }
                                                                        }
                                                                    }}
                                                                    className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all shadow-sm active:scale-90"
                                                                    title="Mark as Not Pursuing"
                                                                >
                                                                    <i className="fa-solid fa-ban text-[10px]"></i>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${plan.recommended_channel === 'sms' ? 'bg-emerald-50 text-emerald-600' :
                                                        plan.recommended_channel === 'email' ? 'bg-blue-50 text-blue-600' :
                                                            plan.recommended_channel === 'call' ? 'bg-orange-50 text-orange-600' :
                                                                'bg-purple-50 text-purple-600'
                                                        }`} title="AI Recommended Outreach Channel">
                                                        {plan.recommended_channel?.replace('_', ' ') || 'N/A'}
                                                    </div>
                                                    <div className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-wider" title="AI Suggested Communication Tone">
                                                        {plan.tone?.replace('_', ' ') || 'N/A'}
                                                    </div>
                                                    <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-wider" title="Lead Potential Score (Higher is better)">
                                                        {(plan.priority_score * 100).toFixed(0)}% Priority
                                                    </div>
                                                </div>

                                                <div className="space-y-1" title="Reason for Lead Inactivity">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drift Cause</label>
                                                    <div className="text-sm font-bold text-slate-600 capitalize">{plan.staleness_reason}</div>
                                                </div>

                                                {/* Market Insight for this Lead */}
                                                {result.market_context.find(m => m.market_name === plan.market) && (
                                                    <div className="pt-4 mt-4 border-t border-slate-50 space-y-3">
                                                        <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500" title="Key Market Indicators for this Lead">Market Intelligence</div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100/50" title="Local Interest Rate Trends">
                                                                <div className="text-[8px] font-black uppercase text-slate-400 mb-0.5">Rates</div>
                                                                <div className="text-[10px] font-bold text-slate-700 capitalize">
                                                                    {result.market_context.find(m => m.market_name === plan.market)?.rates_trend}
                                                                </div>
                                                            </div>
                                                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100/50" title="Local Housing Inventory Trends">
                                                                <div className="text-[8px] font-black uppercase text-slate-400 mb-0.5">Supply</div>
                                                                <div className="text-[10px] font-bold text-slate-700 capitalize">
                                                                    {result.market_context.find(m => m.market_name === plan.market)?.inventory_trend}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 font-medium leading-tight line-clamp-2 italic" title="AI Analyst Notes on Buyer Leverage">
                                                            "{result.market_context.find(m => m.market_name === plan.market)?.buyer_leverage_notes}"
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Outreach Timeline */}
                                            <div className="lg:col-span-9 space-y-6">
                                                {/* First Touch */}
                                                <div className="relative">
                                                    <div className="absolute left-4 top-8 bottom-0 w-0.5 border-l-2 border-dashed border-slate-100"></div>
                                                    <div className="flex gap-6">
                                                        <div
                                                            className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black z-10 shadow-lg shadow-indigo-200"
                                                            title="Step 1: Initial Outreach"
                                                        >
                                                            1
                                                        </div>
                                                        <div className="flex-1 bg-slate-50 p-6 rounded-2xl border border-slate-100 relative group-hover:bg-white group-hover:border-indigo-100 transition-colors max-h-[400px] overflow-y-auto custom-scrollbar">
                                                            <div className="flex justify-between items-center mb-3 sticky top-0 bg-inherit z-10">
                                                                <div className="flex items-center gap-3" title="Message Goal & Timing">
                                                                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Day {plan.first_touch?.send_after_days || 1}: Immediate Hook</div>
                                                                    {editingKey === `${originalIdx}-first` && (
                                                                        <select
                                                                            value={editingChannel}
                                                                            onChange={(e) => setEditingChannel(e.target.value)}
                                                                            className="text-[10px] font-black uppercase tracking-wider bg-white border border-slate-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                                        >
                                                                            {CHANNELS.map(c => (
                                                                                <option key={c} value={c}>{c?.replace('_', ' ') || 'N/A'}</option>
                                                                            ))}
                                                                        </select>
                                                                    )}
                                                                </div>
                                                                <div className="flex gap-3">
                                                                    {!editingKey && (
                                                                        <>
                                                                            <button
                                                                                onClick={() => handleSend(originalIdx, 'first', plan.first_touch?.message || '', plan.recommended_channel, plan.lead_id)}
                                                                                className={`transition-all duration-300 ${(plan.first_touch?.sent_at || permanentlySentKeys.has(`${originalIdx}-first`)) ? 'text-emerald-500 cursor-not-allowed' :
                                                                                    'text-slate-300 hover:text-indigo-600'
                                                                                    }`}
                                                                                title={(plan.first_touch?.sent_at || permanentlySentKeys.has(`${originalIdx}-first`)) ? 'Message already sent' : 'Send now'}
                                                                                disabled={sendingKeys.has(`${originalIdx}-first`) || !!plan.first_touch?.sent_at || permanentlySentKeys.has(`${originalIdx}-first`)}
                                                                            >
                                                                                {sendingKeys.has(`${originalIdx}-first`) ? (
                                                                                    <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                                                                                ) : (
                                                                                    <i className={`fa-solid ${(plan.first_touch?.sent_at || permanentlySentKeys.has(`${originalIdx}-first`) || sentKeys.has(`${originalIdx}-first`)) ? 'fa-square-check' : 'fa-paper-plane'} text-xs`}></i>
                                                                                )}
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleCopy(plan.first_touch?.message || '', `copy-${originalIdx}-first`)}
                                                                                className={`transition-all duration-300 ${copiedKey === `copy-${originalIdx}-first` ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-600'}`}
                                                                                title="Copy to clipboard"
                                                                            >
                                                                                <i className={`fa-solid ${copiedKey === `copy-${originalIdx}-first` ? 'fa-check' : 'fa-copy'} text-xs`}></i>
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    {editingKey === `${originalIdx}-first` ? (
                                                                        <div className="flex gap-3">
                                                                            <button
                                                                                onClick={handleCancel}
                                                                                className="text-slate-300 hover:text-rose-500 transition-colors"
                                                                                title="Cancel editing"
                                                                            >
                                                                                <i className="fa-solid fa-xmark text-xs"></i>
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleSave(originalIdx, 'first')}
                                                                                className="text-emerald-500 hover:text-emerald-600 transition-colors"
                                                                                title="Save changes"
                                                                            >
                                                                                <i className="fa-solid fa-floppy-disk text-xs"></i>
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => startEditing(originalIdx, 'first', plan.first_touch?.message || '', plan.recommended_channel)}
                                                                            className="text-slate-300 hover:text-indigo-600 transition-colors"
                                                                            title="Edit message"
                                                                        >
                                                                            <i className="fa-solid fa-pen text-xs"></i>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {editingKey === `${originalIdx}-first` ? (
                                                                <textarea
                                                                    value={editingValue}
                                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                                    className="w-full bg-white border border-indigo-100 rounded-xl p-4 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[100px] resize-none"
                                                                    autoFocus
                                                                />
                                                            ) : (
                                                                <p className="text-sm text-slate-700 font-medium leading-relaxed">"{plan.first_touch?.message || ''}"</p>
                                                            )}

                                                            {(plan.first_touch?.sent_at || permanentlySentKeys.has(`${originalIdx}-first`)) && (
                                                                <div className="mt-3 pt-3 border-t border-slate-100/50 flex items-center justify-between">
                                                                    <div className="flex items-center gap-2" title="Delivery Status">
                                                                        <i className="fa-solid fa-clock text-[10px] text-slate-300"></i>
                                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                                            Sent {plan.first_touch?.sent_at ? (plan.first_touch.sent_at.toDate ? plan.first_touch.sent_at.toDate().toLocaleDateString() : new Date(plan.first_touch.sent_at).toLocaleDateString()) : 'Today'}
                                                                        </span>
                                                                    </div>
                                                                    {plan.first_touch?.reply_received ? (
                                                                        <div className="flex items-center gap-2 text-emerald-500">
                                                                            <i className="fa-solid fa-reply text-[10px]"></i>
                                                                            <span className="text-[10px] font-black uppercase tracking-widest">Reply Received</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2 text-slate-300">
                                                                            <i className="fa-solid fa-hourglass-start text-[10px]"></i>
                                                                            <span className="text-[10px] font-black uppercase tracking-widest">Waiting for reply</span>
                                                                            <button
                                                                                onClick={() => handleMockReply(originalIdx, 'first', plan.lead_id)}
                                                                                className="ml-2 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[8px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100"
                                                                                title="Simulate a reply from this lead (Testing Only)"
                                                                            >
                                                                                Simulate Reply
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Sequence Steps */}
                                                {plan.sequence.enabled && plan.sequence.steps.map((step, sIdx) => (
                                                    <div key={sIdx} className="flex gap-6 relative">
                                                        {sIdx < plan.sequence.steps.length - 1 && (
                                                            <div className="absolute left-4 top-8 bottom-0 w-0.5 border-l-2 border-dashed border-slate-100"></div>
                                                        )}
                                                        <div
                                                            className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 border-2 border-white flex items-center justify-center text-xs font-black z-10 shadow-sm"
                                                            title={`Step ${sIdx + 2}: Follow-up Outreach`}
                                                        >
                                                            {sIdx + 2}
                                                        </div>
                                                        <div className="flex-1 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 relative group-hover:bg-white group-hover:border-indigo-100/50 transition-colors max-h-[300px] overflow-y-auto custom-scrollbar">
                                                            <div className="flex justify-between items-center mb-3 sticky top-0 bg-inherit z-10">
                                                                <div className="flex items-center gap-3" title="Message Goal & Timing">
                                                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Day {step.day_offset}: Follow-up via {step.channel || 'N/A'}</div>
                                                                    {editingKey === `${originalIdx}-${sIdx}` && (
                                                                        <select
                                                                            value={editingChannel}
                                                                            onChange={(e) => setEditingChannel(e.target.value)}
                                                                            className="text-[10px] font-black uppercase tracking-wider bg-white border border-slate-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                                        >
                                                                            {CHANNELS.map(c => (
                                                                                <option key={c} value={c}>{c?.replace('_', ' ') || 'N/A'}</option>
                                                                            ))}
                                                                        </select>
                                                                    )}
                                                                </div>
                                                                <div className="flex gap-3">
                                                                    {!editingKey && (
                                                                        <>
                                                                            <button
                                                                                onClick={() => handleSend(originalIdx, sIdx, step.message, step.channel, plan.lead_id)}
                                                                                className={`transition-all duration-300 ${(step.sent_at || permanentlySentKeys.has(`${originalIdx}-${sIdx}`)) ? 'text-emerald-500 cursor-not-allowed' :
                                                                                    !(sIdx === 0 ? (plan.first_touch?.sent_at || permanentlySentKeys.has(`${originalIdx}-first`)) : (plan.sequence.steps[sIdx - 1]?.sent_at || permanentlySentKeys.has(`${originalIdx}-${sIdx - 1}`))) ? 'text-slate-200 cursor-not-allowed' :
                                                                                        'text-slate-300 hover:text-indigo-600'
                                                                                    }`}
                                                                                title={
                                                                                    (step.sent_at || permanentlySentKeys.has(`${originalIdx}-${sIdx}`)) ? 'Message already sent' :
                                                                                        !(sIdx === 0 ? (plan.first_touch?.sent_at || permanentlySentKeys.has(`${originalIdx}-first`)) : (plan.sequence.steps[sIdx - 1]?.sent_at || permanentlySentKeys.has(`${originalIdx}-${sIdx - 1}`))) ? 'Send previous message first' :
                                                                                            'Send now'
                                                                                }
                                                                                disabled={
                                                                                    sendingKeys.has(`${originalIdx}-${sIdx}`) ||
                                                                                    !!step.sent_at ||
                                                                                    permanentlySentKeys.has(`${originalIdx}-${sIdx}`) ||
                                                                                    !(sIdx === 0 ? (plan.first_touch?.sent_at || permanentlySentKeys.has(`${originalIdx}-first`)) : (plan.sequence.steps[sIdx - 1]?.sent_at || permanentlySentKeys.has(`${originalIdx}-${sIdx - 1}`)))
                                                                                }
                                                                            >
                                                                                {sendingKeys.has(`${originalIdx}-${sIdx}`) ? (
                                                                                    <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                                                                                ) : (
                                                                                    <i className={`fa-solid ${(step.sent_at || permanentlySentKeys.has(`${originalIdx}-${sIdx}`) || sentKeys.has(`${originalIdx}-${sIdx}`)) ? 'fa-square-check' : 'fa-paper-plane'} text-xs`}></i>
                                                                                )}
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleCopy(step.message, `copy-${originalIdx}-${sIdx}`)}
                                                                                className={`transition-all duration-300 ${copiedKey === `copy-${originalIdx}-${sIdx}` ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-600'}`}
                                                                                title="Copy to clipboard"
                                                                            >
                                                                                <i className={`fa-solid ${copiedKey === `copy-${originalIdx}-${sIdx}` ? 'fa-check' : 'fa-copy'} text-xs`}></i>
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    {editingKey === `${originalIdx}-${sIdx}` ? (
                                                                        <div className="flex gap-3">
                                                                            <button
                                                                                onClick={handleCancel}
                                                                                className="text-slate-300 hover:text-rose-500 transition-colors"
                                                                                title="Cancel editing"
                                                                            >
                                                                                <i className="fa-solid fa-xmark text-xs"></i>
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleSave(originalIdx, sIdx)}
                                                                                className="text-emerald-500 hover:text-emerald-600 transition-colors"
                                                                                title="Save changes"
                                                                            >
                                                                                <i className="fa-solid fa-floppy-disk text-xs"></i>
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => startEditing(originalIdx, sIdx, step.message, step.channel)}
                                                                            className="text-slate-300 hover:text-indigo-600 transition-colors"
                                                                            title="Edit message"
                                                                        >
                                                                            <i className="fa-solid fa-pen text-xs"></i>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {editingKey === `${originalIdx}-${sIdx}` ? (
                                                                <textarea
                                                                    value={editingValue}
                                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                                    className="w-full bg-white border border-indigo-100 rounded-xl p-4 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[100px] resize-none"
                                                                    autoFocus
                                                                />
                                                            ) : (
                                                                <p className="text-sm text-slate-600 font-medium leading-relaxed italic">"{step.message}"</p>
                                                            )}

                                                            {step.sent_at && (
                                                                <div className="mt-3 pt-3 border-t border-slate-100/50 flex items-center justify-between">
                                                                    <div className="flex items-center gap-2" title="Delivery Status">
                                                                        <i className="fa-solid fa-clock text-[10px] text-slate-300"></i>
                                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                                            Sent {step.sent_at.toDate ? step.sent_at.toDate().toLocaleDateString() : new Date(step.sent_at).toLocaleDateString()}
                                                                        </span>
                                                                    </div>
                                                                    {step.reply_received ? (
                                                                        <div className="flex items-center gap-2 text-emerald-500">
                                                                            <i className="fa-solid fa-reply text-[10px]"></i>
                                                                            <span className="text-[10px] font-black uppercase tracking-widest">Reply Received</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2 text-slate-300">
                                                                            <i className="fa-solid fa-hourglass-start text-[10px]"></i>
                                                                            <span className="text-[10px] font-black uppercase tracking-widest">Waiting for reply</span>
                                                                            <button
                                                                                onClick={() => handleMockReply(originalIdx, sIdx, plan.lead_id)}
                                                                                className="ml-2 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[8px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100"
                                                                                title="Simulate a reply from this lead (Testing Only)"
                                                                            >
                                                                                Simulate Reply
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Conversation History Modal */}
            {viewingHistoryLeadId && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setViewingHistoryLeadId(null)}></div>
                    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300 border border-slate-100">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                    <i className="fa-solid fa-comments text-xl"></i>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800">Message Trail</h3>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-1">
                                        {localPlans.find(p => p.lead_id === viewingHistoryLeadId)?.lead_name}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setViewingHistoryLeadId(null)}
                                className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors"
                                title="Close Message Trail History"
                            >
                                <i className="fa-solid fa-xmark text-xl"></i>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-8 h-[500px] overflow-y-auto bg-slate-50/30 space-y-6 custom-scrollbar">
                            {historyLoading ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                                    <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                                    <span className="text-[10px] font-black uppercase tracking-widest">Retrieving history...</span>
                                </div>
                            ) : historyMessages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                                    <i className="fa-solid fa-comment-slash text-4xl opacity-20"></i>
                                    <p className="text-[10px] font-black uppercase tracking-widest">No previous messages found</p>
                                </div>
                            ) : (
                                historyMessages.map((msg, i) => {
                                    const date = msg.sent_at?.toDate ? msg.sent_at.toDate() : new Date(msg.sent_at);
                                    return (
                                        <div key={i} className={`flex ${msg.isInbound ? 'justify-start' : 'justify-end'}`}>
                                            <div className={`max-w-[80%] space-y-2`}>
                                                <div className={`p-4 rounded-2xl text-sm font-medium shadow-sm border ${msg.isInbound
                                                    ? 'bg-white text-slate-700 border-slate-100 rounded-tl-none'
                                                    : 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none'
                                                    }`}>
                                                    {msg.content}
                                                </div>
                                                <div className={`text-[9px] font-black uppercase tracking-widest text-slate-400 px-1 flex items-center gap-2 ${msg.isInbound ? 'justify-start' : 'justify-end'}`}>
                                                    <span>{date.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                                    <span className="opacity-30">•</span>
                                                    <span>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    <span className="opacity-30">•</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <i className={`fa-solid ${msg.channel === 'sms' ? 'fa-message text-emerald-500' :
                                                            msg.channel === 'email' ? 'fa-envelope text-blue-500' :
                                                                msg.channel === 'call' ? 'fa-phone text-orange-500' :
                                                                    'fa-paper-plane text-slate-400'
                                                            } text-[8px]`}></i>
                                                        <span>Via {msg.channel === 'mail' ? 'Direct Mail' : msg.channel?.toUpperCase() || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-5 border-t border-slate-50 bg-white flex justify-end">
                            <button
                                onClick={() => setViewingHistoryLeadId(null)}
                                className="px-8 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
                            >
                                Close Trail
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReactivationVisualizer;
