import React, { useState } from 'react';
import { Lead } from '../../../../types';

interface WhatsAppStrategy {
    id: string;
    title: string;
    description: string;
    bodyTemplate: (lead: Lead, agentName: string) => string;
}

const STRATEGIES: WhatsAppStrategy[] = [
    {
        id: 'thinking_of_you',
        title: 'The "Thinking of You" (Hyper-Personal)',
        description: 'Reference their specific past interest briefly.',
        bodyTemplate: (lead, agentName) => `Hey ${lead.firstName || 'there'}, it's ${agentName.split(' ')[0]}. I just saw a listing in ${lead.searchCriteria?.locations?.split(',')[0] || 'your area'} that reminded me of our search last year. Are you still interested in that area? Stop to opt out.`
    },
    {
        id: 'market_shocker',
        title: 'The "Market Shocker" (Value-Add)',
        description: 'Mention a specific change to pique curiosity.',
        bodyTemplate: (lead, agentName) => `Hi ${lead.firstName || 'there'}, ${agentName.split(' ')[0]} here. Interest rates just dipped slightly for ${lead.searchCriteria?.locations?.split(',')[0] || 'your area'} buyers today. Want me to send over a quick market update? Stop to opt out.`
    },
    {
        id: 'quick_cleanup',
        title: 'The "Quick Clean-up" (Low Pressure)',
        description: 'Polite way to ask if they are still in market.',
        bodyTemplate: (lead, agentName) => `Quick check-in ${lead.firstName || ''}—are you still looking for a home or have your plans changed? Just want to make sure I'm not over-emailing you! Stop to opt out.`
    }
];

interface WhatsAppStrategyModalProps {
    lead: Lead;
    agentName?: string;
    onClose: () => void;
}

const WhatsAppStrategyModal: React.FC<WhatsAppStrategyModalProps> = ({ lead, agentName = 'Your Realtor', onClose }) => {
    const [selectedStrategyId, setSelectedStrategyId] = useState<string>(STRATEGIES[0].id);

    const selectedStrategy = STRATEGIES.find(s => s.id === selectedStrategyId) || STRATEGIES[0];
    const messageContent = selectedStrategy.bodyTemplate(lead, agentName);

    const handleSend = () => {
        // Open WhatsApp Web/App
        const url = `https://wa.me/?text=${encodeURIComponent(messageContent)}`;
        window.open(url, '_blank');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Select WhatsApp Strategy</h2>
                        <p className="text-slate-500 text-sm font-medium">Choose a message template for {lead.fullName || 'this lead'}</p>
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
                                    ? 'bg-white border-green-500 shadow-lg shadow-green-100 scale-[1.02]'
                                    : 'bg-white border-transparent hover:border-slate-200 hover:shadow-md'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className={`font-bold text-sm ${selectedStrategyId === strategy.id ? 'text-green-900' : 'text-slate-700'}`}>
                                        {strategy.title}
                                    </h3>
                                    {selectedStrategyId === strategy.id && (
                                        <i className="fa-solid fa-circle-check text-green-500"></i>
                                    )}
                                </div>
                                <p className={`text-xs ${selectedStrategyId === strategy.id ? 'text-green-600/80' : 'text-slate-400'}`}>
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
                                <div className="h-[500px] bg-[#e5ddd5] flex flex-col relative"> {/* WhatsApp background color */}
                                    {/* Chat Header */}
                                    <div className="h-16 bg-[#008069] flex items-center px-4 justify-between shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold">
                                                {lead.firstName?.[0] || 'L'}
                                            </div>
                                            <span className="text-sm font-bold text-white">{lead.fullName || 'Lead'}</span>
                                        </div>
                                    </div>

                                    {/* Chat Area */}
                                    <div className="flex-1 p-4 space-y-4 overflow-y-auto flex flex-col justify-end pb-8">
                                        <div className="self-end max-w-[85%] bg-[#d9fdd3] text-slate-800 rounded-lg px-3 py-2 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
                                            {messageContent}
                                            <div className="text-[10px] text-slate-400 text-right mt-1 w-full flex justify-end items-center gap-1">
                                                10:30 AM
                                                <i className="fa-solid fa-check-double text-blue-500"></i>
                                            </div>
                                        </div>
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
                                className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-black shadow-lg shadow-green-200 transition-all flex items-center gap-2 text-sm"
                            >
                                <i className="fa-brands fa-whatsapp"></i>
                                Open in WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppStrategyModal;
