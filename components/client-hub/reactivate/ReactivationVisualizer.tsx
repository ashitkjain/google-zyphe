import React, { useState, useEffect } from 'react';
import { LeadReactivationResult } from '../../../types/ai';
import { logMessageEvent } from '../../../services/firebase/communications';
import { serverTimestamp } from 'firebase/firestore';

interface ReactivationVisualizerProps {
    result: LeadReactivationResult;
    onReset?: () => void;
    showReset?: boolean;
    title?: string;
    agentId: string;
}

const ReactivationVisualizer: React.FC<ReactivationVisualizerProps> = ({
    result,
    onReset,
    showReset = true,
    title,
    agentId
}) => {
    const [selectedMarketName, setSelectedMarketName] = useState<string | null>(null);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState<string>('');
    const [editingChannel, setEditingChannel] = useState<string>('');
    const [localPlans, setLocalPlans] = useState(result.lead_plans);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [sendingKeys, setSendingKeys] = useState<Set<string>>(new Set());
    const [sentKeys, setSentKeys] = useState<Set<string>>(new Set());

    const CHANNELS = ['sms', 'email', 'call', 'direct_mail'];

    useEffect(() => {
        setLocalPlans(result.lead_plans);
    }, [result.lead_plans]);

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

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Lead Action Plans */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h3 className="text-xl font-black text-slate-900">Lead Action Plans</h3>
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

                <div className="grid grid-cols-1 gap-6">
                    {localPlans.map((plan, idx) => (
                        <div key={idx} className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-500 group border-l-4" style={{ borderLeftColor: plan.priority_score > 0.8 ? '#4f46e5' : plan.priority_score > 0.5 ? '#3b82f6' : '#94a3b8' }}>
                            <div className="p-8">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                    {/* Lead Info */}
                                    <div className="lg:col-span-3 space-y-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center font-bold text-xs">
                                                    #{idx + 1}
                                                </div>
                                                <span className="text-xs font-black uppercase tracking-widest text-slate-400">{plan.market}</span>
                                            </div>
                                            <h4 className="text-lg font-black text-slate-900 truncate">{plan.lead_name}</h4>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${plan.recommended_channel === 'sms' ? 'bg-emerald-50 text-emerald-600' :
                                                plan.recommended_channel === 'email' ? 'bg-blue-50 text-blue-600' :
                                                    plan.recommended_channel === 'call' ? 'bg-orange-50 text-orange-600' :
                                                        'bg-purple-50 text-purple-600'
                                                }`}>
                                                {plan.recommended_channel.replace('_', ' ')}
                                            </div>
                                            <div className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                {plan.tone.replace('_', ' ')}
                                            </div>
                                            <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                {(plan.priority_score * 100).toFixed(0)}% Priority
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drift Cause</label>
                                            <div className="text-sm font-bold text-slate-600 capitalize">{plan.staleness_reason}</div>
                                        </div>

                                        {/* Market Insight for this Lead */}
                                        {result.market_context.find(m => m.market_name === plan.market) && (
                                            <div className="pt-4 mt-4 border-t border-slate-50 space-y-3">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Market Intelligence</div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100/50">
                                                        <div className="text-[8px] font-black uppercase text-slate-400 mb-0.5">Rates</div>
                                                        <div className="text-[10px] font-bold text-slate-700 capitalize">
                                                            {result.market_context.find(m => m.market_name === plan.market)?.rates_trend}
                                                        </div>
                                                    </div>
                                                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100/50">
                                                        <div className="text-[8px] font-black uppercase text-slate-400 mb-0.5">Supply</div>
                                                        <div className="text-[10px] font-bold text-slate-700 capitalize">
                                                            {result.market_context.find(m => m.market_name === plan.market)?.inventory_trend}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-medium leading-tight line-clamp-2 italic">
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
                                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black z-10 shadow-lg shadow-indigo-200">
                                                    1
                                                </div>
                                                <div className="flex-1 bg-slate-50 p-6 rounded-2xl border border-slate-100 relative group-hover:bg-white group-hover:border-indigo-100 transition-colors max-h-[400px] overflow-y-auto custom-scrollbar">
                                                    <div className="flex justify-between items-center mb-3 sticky top-0 bg-inherit z-10">
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Day {plan.first_touch.send_after_days}: Immediate Hook</div>
                                                            {editingKey === `${idx}-first` && (
                                                                <select
                                                                    value={editingChannel}
                                                                    onChange={(e) => setEditingChannel(e.target.value)}
                                                                    className="text-[10px] font-black uppercase tracking-wider bg-white border border-slate-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                                >
                                                                    {CHANNELS.map(c => (
                                                                        <option key={c} value={c}>{c.replace('_', ' ')}</option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-3">
                                                            {!editingKey && (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleSend(idx, 'first', plan.first_touch.message, plan.recommended_channel, plan.lead_id)}
                                                                        className={`transition-all duration-300 ${sentKeys.has(`${idx}-first`) ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-600'}`}
                                                                        title="Send now"
                                                                        disabled={sendingKeys.has(`${idx}-first`)}
                                                                    >
                                                                        {sendingKeys.has(`${idx}-first`) ? (
                                                                            <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                                                                        ) : (
                                                                            <i className={`fa-solid ${sentKeys.has(`${idx}-first`) ? 'fa-square-check' : 'fa-paper-plane'} text-xs`}></i>
                                                                        )}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleCopy(plan.first_touch.message, `copy-${idx}-first`)}
                                                                        className={`transition-all duration-300 ${copiedKey === `copy-${idx}-first` ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-600'}`}
                                                                        title="Copy to clipboard"
                                                                    >
                                                                        <i className={`fa-solid ${copiedKey === `copy-${idx}-first` ? 'fa-check' : 'fa-copy'} text-xs`}></i>
                                                                    </button>
                                                                </>
                                                            )}
                                                            {editingKey === `${idx}-first` ? (
                                                                <div className="flex gap-3">
                                                                    <button
                                                                        onClick={handleCancel}
                                                                        className="text-slate-300 hover:text-rose-500 transition-colors"
                                                                        title="Cancel editing"
                                                                    >
                                                                        <i className="fa-solid fa-xmark text-xs"></i>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleSave(idx, 'first')}
                                                                        className="text-emerald-500 hover:text-emerald-600 transition-colors"
                                                                        title="Save changes"
                                                                    >
                                                                        <i className="fa-solid fa-floppy-disk text-xs"></i>
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => startEditing(idx, 'first', plan.first_touch.message, plan.recommended_channel)}
                                                                    className="text-slate-300 hover:text-indigo-600 transition-colors"
                                                                    title="Edit message"
                                                                >
                                                                    <i className="fa-solid fa-pen text-xs"></i>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {editingKey === `${idx}-first` ? (
                                                        <textarea
                                                            value={editingValue}
                                                            onChange={(e) => setEditingValue(e.target.value)}
                                                            className="w-full bg-white border border-indigo-100 rounded-xl p-4 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[100px] resize-none"
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <p className="text-sm text-slate-700 font-medium leading-relaxed">"{plan.first_touch.message}"</p>
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
                                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 border-2 border-white flex items-center justify-center text-xs font-black z-10 shadow-sm">
                                                    {sIdx + 2}
                                                </div>
                                                <div className="flex-1 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 relative group-hover:bg-white group-hover:border-indigo-100/50 transition-colors max-h-[300px] overflow-y-auto custom-scrollbar">
                                                    <div className="flex justify-between items-center mb-3 sticky top-0 bg-inherit z-10">
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Day {step.day_offset}: Follow-up via {step.channel}</div>
                                                            {editingKey === `${idx}-${sIdx}` && (
                                                                <select
                                                                    value={editingChannel}
                                                                    onChange={(e) => setEditingChannel(e.target.value)}
                                                                    className="text-[10px] font-black uppercase tracking-wider bg-white border border-slate-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                                >
                                                                    {CHANNELS.map(c => (
                                                                        <option key={c} value={c}>{c.replace('_', ' ')}</option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-3">
                                                            {!editingKey && (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleSend(idx, sIdx, step.message, step.channel, plan.lead_id)}
                                                                        className={`transition-all duration-300 ${sentKeys.has(`${idx}-${sIdx}`) ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-600'}`}
                                                                        title="Send now"
                                                                        disabled={sendingKeys.has(`${idx}-${sIdx}`)}
                                                                    >
                                                                        {sendingKeys.has(`${idx}-${sIdx}`) ? (
                                                                            <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                                                                        ) : (
                                                                            <i className={`fa-solid ${sentKeys.has(`${idx}-${sIdx}`) ? 'fa-square-check' : 'fa-paper-plane'} text-xs`}></i>
                                                                        )}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleCopy(step.message, `copy-${idx}-${sIdx}`)}
                                                                        className={`transition-all duration-300 ${copiedKey === `copy-${idx}-${sIdx}` ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-600'}`}
                                                                        title="Copy to clipboard"
                                                                    >
                                                                        <i className={`fa-solid ${copiedKey === `copy-${idx}-${sIdx}` ? 'fa-check' : 'fa-copy'} text-xs`}></i>
                                                                    </button>
                                                                </>
                                                            )}
                                                            {editingKey === `${idx}-${sIdx}` ? (
                                                                <div className="flex gap-3">
                                                                    <button
                                                                        onClick={handleCancel}
                                                                        className="text-slate-300 hover:text-rose-500 transition-colors"
                                                                        title="Cancel editing"
                                                                    >
                                                                        <i className="fa-solid fa-xmark text-xs"></i>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleSave(idx, sIdx)}
                                                                        className="text-emerald-500 hover:text-emerald-600 transition-colors"
                                                                        title="Save changes"
                                                                    >
                                                                        <i className="fa-solid fa-floppy-disk text-xs"></i>
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => startEditing(idx, sIdx, step.message, step.channel)}
                                                                    className="text-slate-300 hover:text-indigo-600 transition-colors"
                                                                    title="Edit message"
                                                                >
                                                                    <i className="fa-solid fa-pen text-xs"></i>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {editingKey === `${idx}-${sIdx}` ? (
                                                        <textarea
                                                            value={editingValue}
                                                            onChange={(e) => setEditingValue(e.target.value)}
                                                            className="w-full bg-white border border-indigo-100 rounded-xl p-4 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[100px] resize-none"
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <p className="text-sm text-slate-600 font-medium leading-relaxed italic">"{step.message}"</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ReactivationVisualizer;
