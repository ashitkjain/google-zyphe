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
        id: 'nine_word',
        title: 'The "9-Word" Strategy',
        description: 'Best for: The highest response rate on very old leads.',
        subject: '{{Lead Name}}?',
        bodyTemplate: (lead, agentName) => `Hi ${lead.firstName || 'there'},

Are you still looking for a home in ${lead.searchCriteria?.locations?.split(',')[0] || 'this area'}?

— ${agentName.split(' ')[0]}`
    },
    {
        id: 'pattern_interrupt',
        title: 'The Pattern Interrupt',
        description: 'Best for: Breaking the "salesperson" image.',
        subject: 'thinking of you',
        bodyTemplate: (lead, agentName) => `Hi ${lead.firstName || 'there'},

I just saw a listing in ${lead.searchCriteria?.locations?.split(',')[0] || 'your target neighborhood'} and it immediately reminded me of our conversation.

Are you still in the market, or did you find something already?

Best,
${agentName.split(' ')[0]}`
    },
    {
        id: 'value_over_pitch',
        title: 'The Value-Over-Pitch',
        description: 'Best for: Offering specific data without asking for a commitment.',
        subject: '{{location}} market report',
        bodyTemplate: (lead, agentName) => `Hi ${lead.firstName || 'there'},

Most people think prices in ${lead.searchCriteria?.locations?.split(',')[0] || 'the city'} are still rising, but the latest data actually shows a slight dip this month.

I thought you might want to see the new numbers since we last talked. Should I send the PDF over?

— ${agentName.split(' ')[0]}`
    },
    {
        id: 'low_pressure',
        title: 'The Low-Pressure Follow-up',
        description: 'Best for: Acknowledging the silence without making the lead feel guilty.',
        subject: 'checking in / no pressure',
        bodyTemplate: (lead, agentName) => `Hi ${lead.firstName || 'there'},

I know life gets incredibly busy, so I wanted to reach out one last time to see if I can still be a resource for your home search.

If you've moved in a different direction, just let me know and I'll take you off my list!

Cheers,
${agentName.split(' ')[0]}`
    },
    {
        id: 'off_market',
        title: 'The "Off-Market" Hook',
        description: 'Best for: High-intent buyers who are frustrated by low inventory.',
        subject: 'off-market in {{location}}?',
        bodyTemplate: (lead, agentName) => `Hi ${lead.firstName || 'there'},

I have a couple of "coming soon" properties in ${lead.searchCriteria?.locations?.split(',')[0] || 'your area'} that aren't on Zillow or the MLS yet.

Would you like the addresses, or are you no longer looking in that area?

— ${agentName.split(' ')[0]}`
    }
];

interface EmailStrategyModalProps {
    lead: Lead;
    agentName?: string;
    onClose: () => void;
    onSend: (strategyId: string, content: string, subject: string) => void;
}

const EmailStrategyModal: React.FC<EmailStrategyModalProps> = ({ lead, agentName = 'Your Realtor', onClose, onSend }) => {
    const [selectedStrategyId, setSelectedStrategyId] = useState<string>(STRATEGIES[0].id);
    const [isSending, setIsSending] = useState(false);
    const [editableSubject, setEditableSubject] = useState('');
    const [editableBody, setEditableBody] = useState('');

    // Update editable content when strategy changes
    React.useEffect(() => {
        const selectedStrategy = STRATEGIES.find(s => s.id === selectedStrategyId) || STRATEGIES[0];
        let subject = selectedStrategy.subject;
        subject = subject.replace('{{location}}', lead.searchCriteria?.locations?.split(',')[0] || 'your area');
        subject = subject.replace('{{Lead Name}}', lead.firstName || 'there');

        setEditableSubject(subject);
        setEditableBody(selectedStrategy.bodyTemplate(lead, agentName));
    }, [selectedStrategyId, lead, agentName]);

    const handleSend = () => {
        setIsSending(true);
        // Simulate network delay
        setTimeout(() => {
            onSend(selectedStrategyId, editableBody, editableSubject);
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

                    {/* Main Content: Edit */}
                    <div className="w-2/3 bg-white flex flex-col">
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="max-w-2xl mx-auto space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Subject Line</label>
                                    <input
                                        type="text"
                                        value={editableSubject}
                                        onChange={(e) => setEditableSubject(e.target.value)}
                                        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Message Body</label>
                                    <textarea
                                        value={editableBody}
                                        onChange={(e) => setEditableBody(e.target.value)}
                                        className="w-full p-6 bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[300px] text-slate-600 leading-relaxed text-sm font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                                    />
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
