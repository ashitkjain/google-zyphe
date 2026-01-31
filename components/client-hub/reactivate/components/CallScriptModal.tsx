import React, { useState, useEffect } from 'react';
import { Lead } from '../../../../types';

interface CallScript {
    id: string;
    title: string;
    goal: string;
    scriptTemplate: (lead: Lead, agentName: string) => string;
}

const SCRIPTS: CallScript[] = [
    {
        id: 'nine_word_call',
        title: 'The "9-Word" Call',
        goal: 'To get a "Yes/No" as quickly as possible without wasting their time.',
        scriptTemplate: (lead, agentName) => `Hi ${lead.firstName || 'there'}, this is ${agentName}. I was just cleaning up my desk and saw your note about looking for a home in ${lead.searchCriteria?.locations?.split(',')[0] || 'your area'}. Are you still looking for a place there, or have you already found something?

[If 'Still Looking']: Great! I've seen some interesting shifts in ${lead.searchCriteria?.locations?.split(',')[0] || 'the market'} this week. Are you free for a 2-minute update tomorrow morning?`
    },
    {
        id: 'did_i_miss_you',
        title: 'The "Did I Miss You?"',
        goal: 'To remove the guilt of them not responding to your previous emails/texts.',
        scriptTemplate: (lead, agentName) => `Hey ${lead.firstName || 'there'}, it's ${agentName}. I've sent a couple of emails recently and hadn't heard back—I figured you either found a place or you're just incredibly busy. I wanted to call and see if I should keep sending you updates or if I should take you off the list?`
    },
    {
        id: 'market_insider',
        title: 'The "Market Insider"',
        goal: 'To provide a piece of "insider" information they can\'t get from Zillow.',
        scriptTemplate: (lead, agentName) => `Hi ${lead.firstName || 'there'}, it's ${agentName}. I know it's been a while, but I'm calling because ${lead.searchCriteria?.locations?.split(',')[0] || 'a specific neighborhood'} just had a price drop on a property that looks exactly like what you were looking for last year. I didn't want you to miss it—do you want me to text you the link?`
    },
    {
        id: 'off_market_hook',
        title: 'The "Off-Market" Hook',
        goal: 'To create "Fear Of Missing Out" (FOMO) by mentioning something exclusive.',
        scriptTemplate: (lead, agentName) => `Hi ${lead.firstName || 'there'}, this is ${agentName}. I'm actually at a property in ${lead.searchCriteria?.locations?.split(',')[0] || 'your target neighborhood'} right now that isn't on the market yet. The sellers are thinking of listing next month, but I remembered you liked this street. Would you be interested in a 'first look' before it hits the MLS?`
    },
    {
        id: 'feedback_approach',
        title: 'The "Feedback" Approach',
        goal: 'To restart the conversation by asking for their expertise/opinion.',
        scriptTemplate: (lead, agentName) => `Hey ${lead.firstName || 'there'}, ${agentName} here. I'm helping another family search in ${lead.searchCriteria?.locations?.split(',')[0] || 'town'} right now, and I remembered we looked at properties together. I'm curious—what was the main thing that held you back from that area last year? Your feedback would really help me out.`
    }
];

interface CallScriptModalProps {
    lead: Lead;
    agentName?: string;
    onClose: () => void;
    onLogCall: (scriptId: string, notes: string) => void;
}

const CallScriptModal: React.FC<CallScriptModalProps> = ({ lead, agentName = 'Your Realtor', onClose, onLogCall }) => {
    const [selectedScriptId, setSelectedScriptId] = useState<string>(SCRIPTS[0].id);
    const [isLogging, setIsLogging] = useState(false);
    const [callNotes, setCallNotes] = useState('');

    const selectedScript = SCRIPTS.find(s => s.id === selectedScriptId) || SCRIPTS[0];

    // We treat the script display as read-only/copyable for calls, unlike editable emails
    // But we update it when selection changes
    const [currentScriptText, setCurrentScriptText] = useState('');

    useEffect(() => {
        // Use first name for "this is [Name]" if available, or full name if preferred.
        // The prompt examples used "[Realtor Name]". Let's stick to the convention we established: First Name.
        const firstName = agentName.split(' ')[0];
        setCurrentScriptText(selectedScript.scriptTemplate(lead, firstName));
    }, [selectedScriptId, lead, agentName, selectedScript]);

    const handleLog = () => {
        setIsLogging(true);
        // Simulate network delay
        setTimeout(() => {
            onLogCall(selectedScriptId, callNotes || 'Call logged with script: ' + selectedScript.title);
            setIsLogging(false);
            onClose();
        }, 800);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-5xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Call Scripts & Logger</h2>
                        <p className="text-slate-500 text-sm font-medium">Select a script to guide your conversation with {lead.fullName || 'this lead'}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all"
                    >
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar: Scripts */}
                    <div className="w-1/3 border-r border-slate-100 overflow-y-auto bg-slate-50/50 p-6 space-y-4">
                        {SCRIPTS.map(script => (
                            <button
                                key={script.id}
                                onClick={() => setSelectedScriptId(script.id)}
                                className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-300 group ${selectedScriptId === script.id
                                        ? 'bg-white border-emerald-500 shadow-lg shadow-emerald-100 scale-[1.02]'
                                        : 'bg-white border-transparent hover:border-slate-200 hover:shadow-md'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className={`font-bold text-sm ${selectedScriptId === script.id ? 'text-emerald-900' : 'text-slate-700'}`}>
                                        {script.title}
                                    </h3>
                                    {selectedScriptId === script.id && (
                                        <i className="fa-solid fa-circle-check text-emerald-500"></i>
                                    )}
                                </div>
                                <p className={`text-xs ${selectedScriptId === script.id ? 'text-emerald-600/80' : 'text-slate-400'}`}>
                                    {script.goal}
                                </p>
                            </button>
                        ))}
                    </div>

                    {/* Main Content: Script & Notes */}
                    <div className="w-2/3 bg-white flex flex-col">
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="max-w-3xl mx-auto space-y-8">
                                {/* The Script Box */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">
                                            <i className="fa-solid fa-microphone-lines mr-2"></i>
                                            Script
                                        </label>
                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                                            Read this aloud
                                        </span>
                                    </div>
                                    <div className="p-6 bg-slate-900 text-slate-50 rounded-2xl shadow-inner border border-slate-800 text-lg leading-relaxed font-medium whitespace-pre-wrap">
                                        {currentScriptText}
                                    </div>
                                </div>

                                {/* Call Notes */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">
                                        <i className="fa-solid fa-note-sticky mr-2"></i>
                                        Call Outcome / Notes
                                    </label>
                                    <textarea
                                        value={callNotes}
                                        onChange={(e) => setCallNotes(e.target.value)}
                                        placeholder="Type notes here while you talk... (e.g. 'Interested in seeing 123 Main St', 'Callback tomorrow', 'Not interested')"
                                        className="w-full p-6 bg-yellow-50/50 rounded-2xl border border-yellow-100 text-slate-700 leading-relaxed text-sm font-sans focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all resize-none min-h-[150px] placeholder:text-slate-400"
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
                                onClick={handleLog}
                                disabled={isLogging}
                                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black shadow-lg shadow-emerald-200 transition-all flex items-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isLogging ? (
                                    <>
                                        <i className="fa-solid fa-spinner animate-spin"></i>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-check"></i>
                                        Log Call
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

export default CallScriptModal;
