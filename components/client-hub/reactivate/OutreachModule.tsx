import React, { useState } from 'react';
import { Lead } from '../../../types';
import { logMessageEvent, saveReactivationMessage } from '../../../services/firebase/communications';
import { Strategy, getTimeSince, STRATEGIES } from './shared';

interface OutreachModuleProps {
    realtorId: string;
    leads: Lead[];
    selectedCandidateId: string | null;
    initialChannel?: 'email' | 'call' | 'sms' | 'whatsapp' | 'mail';
    onClearSelection: () => void;
    onGoToIntelligence: () => void;
    onUpdateLead?: (leadId: string, updates: Partial<Lead>) => void;
}

const OutreachGenerator: React.FC<{ lead: Lead; onBack: () => void; realtorId: string; initialChannel?: string; onUpdateLead?: (leadId: string, updates: Partial<Lead>) => void }> = ({ lead, onBack, realtorId, initialChannel = 'email', onUpdateLead }) => {
    // Filter strategies based on channel
    const availableStrategies = STRATEGIES.filter(s => s.type === initialChannel);

    // Default to the first strategy of the selected type, or fall back safely
    const [selectedStrategyId, setSelectedStrategyId] = useState<string>(availableStrategies[0]?.id || STRATEGIES[0].id);
    const [isSending, setIsSending] = useState(false);

    // Ensure active strategy matches the filtered list if possible
    const activeStrategy = STRATEGIES.find(s => s.id === selectedStrategyId) || availableStrategies[0] || STRATEGIES[0];

    // Re-select if channel changes (effect-like behavior via render logic)
    if (activeStrategy.type !== initialChannel && availableStrategies.length > 0) {
        // This is a direct render update pattern, might cause loop if not careful, better to use useEffect or key remounting
        // But since component remounts when `initialChannel` changes in parent, we can trust the useState initializer if we add a key in parent.
        // For safety, let's just count on the parent remounting this component or key changing.
        // We will add a key to OutreachGenerator in OutreachModule.
    }

    const generatedContent = activeStrategy.generate(lead.firstName);

    const handleSend = async () => {
        setIsSending(true);
        try {
            // Mock delay to simulate network request
            await new Promise(resolve => setTimeout(resolve, 800));

            const eventId = crypto.randomUUID();
            const messageId = crypto.randomUUID();

            await logMessageEvent({
                event_id: eventId,
                lead_id: lead.id,
                agent_id: realtorId,
                message_id: messageId,
                channel: activeStrategy.type as any,
                event_type: 'sent',
                provider: 'other',
                timestamp: new Date(),
                isInbound: false,
                source: 'human',
                raw_payload: {
                    content: generatedContent,
                    strategy_title: activeStrategy.title,
                    subject: activeStrategy.subject,
                    reactivation: true
                }
            });

            // 2. Save to dedicated reactivation_messages table
            await saveReactivationMessage({
                message_id: messageId,
                lead_id: lead.id,
                realtorId: realtorId,
                channel: activeStrategy.type,
                content: generatedContent,
                sent_at: new Date(),
                reply_received: false,
                sentiment: 'neutral_positive'
            });

            // Also update lead's health and record the activity in their notes log
            if (onUpdateLead) {
                const now = new Date();
                const newNote = {
                    id: crypto.randomUUID(),
                    content: `Sent reactivation ${activeStrategy.type}: "${activeStrategy.title}"`,
                    timestamp: now,
                    author: 'AI Agent',
                    color: 'bg-indigo-50 text-indigo-700 border-indigo-100'
                };

                onUpdateLead(lead.id, {
                    health: 'Active',
                    lastActiveAt: now,
                    notesLog: [...(lead.notesLog || []), newNote]
                });
            }

            const actionVerb = activeStrategy.type === 'call' ? 'Logged call' : 'Sent message';
            // Auto redirect back to list
            onBack();
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to log action. Please try again.');
        } finally {
            setIsSending(false);
        }
    };

    const getActionLabel = (type: string) => {
        switch (type) {
            case 'call': return 'Log Call';
            case 'mail': return 'Log Mail Sent';
            case 'sms': return 'Send SMS';
            case 'whatsapp': return 'Send WhatsApp';
            default: return 'Send Email';
        }
    };

    const getPreviewLabel = (type: string) => {
        switch (type) {
            case 'call': return 'Call Script';
            case 'mail': return 'Direct Mail Content';
            case 'sms': return 'SMS Draft';
            case 'whatsapp': return 'WhatsApp Draft';
            default: return 'Email Draft';
        }
    };

    return (
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm relative overflow-hidden">
            {/* Header / Back Action */}
            <div className="flex items-center justify-between mb-8 pb-8 border-b border-slate-100">
                <div className="flex items-center gap-6">
                    <button
                        onClick={onBack}
                        className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-md transition-all group"
                        title="Back to candidates"
                    >
                        <i className="fa-solid fa-arrow-left text-sm group-hover:-translate-x-0.5 transition-transform"></i>
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-slate-500 font-bold text-lg shadow-inner">
                            {lead.avatarUrl ? <img src={lead.avatarUrl} alt="" className="w-full h-full object-cover" /> : <span>{lead.firstName?.charAt(0)}</span>}
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 leading-tight">{lead.firstName} {lead.lastName}</h2>
                            <p className="text-xs text-slate-500 font-medium">Archived • Last Active: {getTimeSince(lead.lastActiveAt || lead.receivedAt)}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Generating {initialChannel} Sequence</span>
                    </div>
                    <button
                        onClick={onBack}
                        className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"
                        title="Close"
                    >
                        <i className="fa-solid fa-xmark text-xl"></i>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-[1fr_1.5fr] gap-8">
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 sticky top-0 bg-white pb-2 flex justify-between items-center">
                        <span>Select {initialChannel === 'sms' ? 'SMS' : initialChannel === 'call' ? 'Call' : initialChannel === 'mail' ? 'Mail' : 'Email'} Strategy</span>
                        <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500">{availableStrategies.length} options</span>
                    </h3>
                    {availableStrategies.map((strategy) => (
                        <div
                            key={strategy.id}
                            onClick={() => setSelectedStrategyId(strategy.id)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedStrategyId === strategy.id ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100' : 'bg-white border-slate-200 hover:border-indigo-300'}`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className={`font-bold text-sm ${selectedStrategyId === strategy.id ? 'text-indigo-700' : 'text-slate-700'}`}>{strategy.title}</span>
                                {selectedStrategyId === strategy.id && <i className="fa-solid fa-check-circle text-indigo-600"></i>}
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">{strategy.description}</p>
                        </div>
                    ))}
                    {availableStrategies.length === 0 && (
                        <div className="text-slate-400 text-sm italic p-4 text-center">No strategies found for this channel.</div>
                    )}
                </div>
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 flex flex-col">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Preview: {getPreviewLabel(activeStrategy.type)}</h3>

                    {activeStrategy.subject && (
                        <div className="mb-3">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Subject</div>
                            <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-800">
                                {activeStrategy.subject}
                            </div>
                        </div>
                    )}

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-sm text-slate-600 leading-relaxed mb-4 flex-1 whitespace-pre-wrap font-medium">
                        {generatedContent}
                    </div>

                    <div className="flex gap-3 mt-auto">
                        <button
                            onClick={handleSend}
                            disabled={isSending}
                            className={`flex-1 ${isSending ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-200 flex justify-center items-center`}
                        >
                            {isSending ? (
                                <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Processing...</>
                            ) : (
                                <><i className="fa-solid fa-paper-plane mr-2"></i> {getActionLabel(activeStrategy.type)}</>
                            )}
                        </button>
                        <button className="flex-1 bg-white border border-slate-200 text-slate-700 py-4 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">
                            <i className="fa-solid fa-pen-to-square mr-2"></i> Edit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const OutreachModule: React.FC<OutreachModuleProps> = ({ realtorId, leads, selectedCandidateId, initialChannel, onClearSelection, onGoToIntelligence, onUpdateLead }) => {
    const selectedLead = leads.find(l => l.id === selectedCandidateId);

    return (
        <>
            {selectedCandidateId && selectedLead ? (
                <OutreachGenerator
                    key={`${selectedCandidateId}-${initialChannel}`} // Force remount on change
                    lead={selectedLead}
                    onBack={onClearSelection}
                    realtorId={realtorId}
                    initialChannel={initialChannel}
                    onUpdateLead={onUpdateLead}
                />
            ) : (
                <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm text-center py-20">
                    <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6 text-purple-500">
                        <i className="fa-solid fa-wand-magic-sparkles text-3xl"></i>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">Select a Candidate</h3>
                    <p className="text-slate-500 max-w-sm mx-auto mb-8">Go to Intelligence tab and select a lead to generate a personalized revival sequence.</p>
                    <button className="bg-slate-900 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-slate-800 transition-all text-xs font-black uppercase tracking-widest" onClick={onGoToIntelligence}>
                        Go to Intelligence
                    </button>
                </div>
            )}
        </>
    );
};

export default OutreachModule;
