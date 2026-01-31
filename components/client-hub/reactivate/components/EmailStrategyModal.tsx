import React, { useState } from 'react';
import { Lead } from '../../../../types';

interface EmailStrategy {
    id: string;
    title: string;
    description: string;
    subject: string;
    bodyTemplate: (lead: Lead, agentName: string) => string;
}

const STRATEGIES: EmailStrategy[] = [
    {
        id: 'market_update',
        title: 'Market Pulse Update',
        description: 'Position yourself as an expert with latest neighborhood stats.',
        subject: 'Real Estate Update for {{location}}',
        bodyTemplate: (lead, agentName) => `Hi ${lead.firstName || 'there'},

I was reviewing market activity in ${lead.searchCriteria?.locations?.split(',')[0] || 'your area'} and noticed some interesting trends that might impact your plans.

Home values have shifted slightly this month. Are you still thinking about making a move in 2026?

Best,
${agentName}`
    },
    {
        id: 'just_sold',
        title: 'Just Sold in Your Area',
        description: 'Showcase success to reignite interest.',
        subject: 'Just sold nearby!',
        bodyTemplate: (lead, agentName) => `Hi ${lead.firstName || 'there'},

A property just sold near ${lead.searchCriteria?.locations?.split(',')[0] || 'you'} for a great price. Inventory is moving fast.

If you've been on the fence, now might be the right time to revisit your search.

Cheers,
${agentName}`
    },
    {
        id: 'vip_buyer',
        title: 'VIP Off-Market Opportunity',
        description: 'Create exclusivity and urgency.',
        subject: 'Off-market opportunity?',
        bodyTemplate: (lead, agentName) => `Hi ${lead.firstName || 'there'},

I have access to a property coming up in ${lead.searchCriteria?.locations?.split(',')[0] || 'your target area'} that isn't on the MLS yet.

Wanted to give you a heads up before it goes public. Interested in taking a look?

Best,
${agentName}`
    },
    {
        id: 'check_in',
        title: 'Simple Check-in',
        description: 'Low pressure friendly follow-up.',
        subject: 'Thinking of you',
        bodyTemplate: (lead, agentName) => `Hi ${lead.firstName || 'there'},

It's been a while! Just wanted to check in and see how things are going with your home search.

Still looking, or have you put things on pause?

Best,
${agentName}`
    }
];

interface EmailStrategyModalProps {
    lead: Lead;
    agentName?: string;
    onClose: () => void;
    onSend: (strategyId: string, content: string) => void;
}

const EmailStrategyModal: React.FC<EmailStrategyModalProps> = ({ lead, agentName = 'Your Realtor', onClose, onSend }) => {
    const [selectedStrategyId, setSelectedStrategyId] = useState<string>(STRATEGIES[0].id);
    const [isSending, setIsSending] = useState(false);

    const selectedStrategy = STRATEGIES.find(s => s.id === selectedStrategyId) || STRATEGIES[0];
    const emailContent = selectedStrategy.bodyTemplate(lead, agentName);
    const emailSubject = selectedStrategy.subject.replace('{{location}}', lead.searchCriteria?.locations?.split(',')[0] || 'your area');

    const handleSend = () => {
        setIsSending(true);
        // Simulate network delay
        setTimeout(() => {
            onSend(selectedStrategyId, emailContent);
            setIsSending(false);
            onClose();
        }, 800);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Select Email Strategy</h2>
                        <p className="text-slate-500 text-sm font-medium">Choose the best approach to re-engage {lead.fullName || 'this lead'}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all"
                    >
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar: Strategies */}
                    <div className="w-1/3 border-r border-slate-100 overflow-y-auto bg-slate-50/50 p-6 space-y-4">
                        {STRATEGIES.map(strategy => (
                            <button
                                key={strategy.id}
                                onClick={() => setSelectedStrategyId(strategy.id)}
                                className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-300 group ${selectedStrategyId === strategy.id
                                        ? 'bg-white border-indigo-600 shadow-lg shadow-indigo-100 scale-[1.02]'
                                        : 'bg-white border-transparent hover:border-slate-200 hover:shadow-md'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className={`font-bold text-sm ${selectedStrategyId === strategy.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                                        {strategy.title}
                                    </h3>
                                    {selectedStrategyId === strategy.id && (
                                        <i className="fa-solid fa-circle-check text-indigo-600"></i>
                                    )}
                                </div>
                                <p className={`text-xs ${selectedStrategyId === strategy.id ? 'text-indigo-600/80' : 'text-slate-400'}`}>
                                    {strategy.description}
                                </p>
                            </button>
                        ))}
                    </div>

                    {/* Main Content: Preview */}
                    <div className="w-2/3 bg-white flex flex-col">
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="max-w-2xl mx-auto space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Subject Line</label>
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 font-medium text-sm">
                                        {emailSubject}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Message Preview</label>
                                    <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[300px] text-slate-600 leading-relaxed text-sm whitespace-pre-wrap font-sans">
                                        {emailContent}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Action */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-4">
                            <button
                                onClick={onClose}
                                className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={isSending}
                                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isSending ? (
                                    <>
                                        <i className="fa-solid fa-spinner animate-spin"></i>
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-paper-plane"></i>
                                        Send Email
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmailStrategyModal;
