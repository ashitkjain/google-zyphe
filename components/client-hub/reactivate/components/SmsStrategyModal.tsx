import React, { useState } from 'react';
import { Lead } from '../../../../types';

interface SmsStrategy {
    id: string;
    title: string;
    description: string;
    bodyTemplate: (lead: Lead, agentName: string) => string;
}

const STRATEGIES: SmsStrategy[] = [
    {
        id: 'quick_check_in',
        title: 'Quick Check-in',
        description: 'Casual, low-pressure text to gauge interest.',
        bodyTemplate: (lead, agentName) => `Hi ${lead.firstName || 'there'}, just checking in on your home search. Are you still actively looking or taking a break? - ${agentName}`
    },
    {
        id: 'market_alert',
        title: 'New Listing Alert',
        description: 'Create curiosity about a specific property.',
        bodyTemplate: (lead, agentName) => `Hi ${lead.firstName || 'there'}, saw a new listing in ${lead.searchCriteria?.locations?.split(',')[0] || 'your area'} that matches your criteria perfectly. Want me to send the link? - ${agentName}`
    },
    {
        id: 'value_update',
        title: 'Market Shift Update',
        description: 'Highlight recent market changes.',
        bodyTemplate: (lead, agentName) => `Hi ${lead.firstName || 'there'}, noticed some interesting price shifts in ${lead.searchCriteria?.locations?.split(',')[0] || 'your target area'} recently. Curious how this affects your buying power? - ${agentName}`
    },
    {
        id: 'coffee_chat',
        title: 'Coffee Catch-up',
        description: 'Personal invitation to reconnect.',
        bodyTemplate: (lead, agentName) => `Hi ${lead.firstName || 'there'}, I'll be in ${lead.searchCriteria?.locations?.split(',')[0] || 'your neighborhood'} this Thursday. Free for a quick coffee to catch up? - ${agentName}`
    }
];

interface SmsStrategyModalProps {
    lead: Lead;
    agentName?: string;
    onClose: () => void;
    onSend: (strategyId: string, content: string) => void;
}

const SmsStrategyModal: React.FC<SmsStrategyModalProps> = ({ lead, agentName = 'Your Realtor', onClose, onSend }) => {
    const [selectedStrategyId, setSelectedStrategyId] = useState<string>(STRATEGIES[0].id);
    const [isSending, setIsSending] = useState(false);

    const selectedStrategy = STRATEGIES.find(s => s.id === selectedStrategyId) || STRATEGIES[0];
    const messageContent = selectedStrategy.bodyTemplate(lead, agentName);

    const handleSend = () => {
        setIsSending(true);
        // Simulate network delay
        setTimeout(() => {
            onSend(selectedStrategyId, messageContent);
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
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Select SMS Strategy</h2>
                        <p className="text-slate-500 text-sm font-medium">Choose a text message template for {lead.fullName || 'this lead'}</p>
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
                                        ? 'bg-white border-blue-500 shadow-lg shadow-blue-100 scale-[1.02]'
                                        : 'bg-white border-transparent hover:border-slate-200 hover:shadow-md'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className={`font-bold text-sm ${selectedStrategyId === strategy.id ? 'text-blue-900' : 'text-slate-700'}`}>
                                        {strategy.title}
                                    </h3>
                                    {selectedStrategyId === strategy.id && (
                                        <i className="fa-solid fa-circle-check text-blue-500"></i>
                                    )}
                                </div>
                                <p className={`text-xs ${selectedStrategyId === strategy.id ? 'text-blue-600/80' : 'text-slate-400'}`}>
                                    {strategy.description}
                                </p>
                            </button>
                        ))}
                    </div>

                    {/* Main Content: Preview */}
                    <div className="w-2/3 bg-white flex flex-col">
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar flex items-center justify-center bg-slate-50">
                            {/* Phone Preview Mockup */}
                            <div className="w-[300px] bg-white rounded-[2.5rem] border-[8px] border-slate-900 shadow-2xl overflow-hidden relative">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-slate-900 rounded-b-xl z-10"></div>
                                <div className="h-[500px] bg-slate-50 flex flex-col relative">
                                    {/* Chat Header */}
                                    <div className="h-16 bg-slate-100 border-b border-slate-200 flex items-end pb-3 px-4 justify-center">
                                        <span className="text-xs font-bold text-slate-500">{lead.fullName || 'Lead'}</span>
                                    </div>

                                    {/* Chat Area */}
                                    <div className="flex-1 p-4 space-y-4 overflow-y-auto flex flex-col justify-end pb-8">
                                        <div className="self-end max-w-[85%] bg-blue-500 text-white rounded-2xl rounded-tr-none px-4 py-3 text-sm shadow-md">
                                            {messageContent}
                                        </div>
                                        <div className="text-[10px] text-slate-400 text-center font-medium">Delivered just now</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Action */}
                        <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-4">
                            <button
                                onClick={onClose}
                                className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={isSending}
                                className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-black shadow-lg shadow-blue-200 transition-all flex items-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isSending ? (
                                    <>
                                        <i className="fa-solid fa-spinner animate-spin"></i>
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-paper-plane"></i>
                                        Send Message
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

export default SmsStrategyModal;
