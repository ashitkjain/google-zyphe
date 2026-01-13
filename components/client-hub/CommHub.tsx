import React, { RefObject } from 'react';
import { CommMessage, UserProfile, CommTemplate } from '../../types';

interface CommHubProps {
    messages: CommMessage[];
    newMessage: string;
    setNewMessage: (msg: string) => void;
    activeChannel: 'SMS' | 'Email';
    setActiveChannel: (channel: 'SMS' | 'Email') => void;
    scrollRef: RefObject<HTMLDivElement>;
    selectedClient: UserProfile | null;
    realtorId: string;
    handleSendMessage: () => void;
    handleGrantConsent: () => void;
    templates: CommTemplate[];
}

const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const CommHub: React.FC<CommHubProps> = ({
    messages,
    newMessage,
    setNewMessage,
    activeChannel,
    setActiveChannel,
    scrollRef,
    selectedClient,
    realtorId,
    handleSendMessage,
    handleGrantConsent,
    templates
}) => {
    return (
        <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
            <div className="p-10 bg-white border-b border-slate-200/60 flex items-center justify-between shadow-sm relative z-20">
                <div className="flex items-center gap-6">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Connect</h2>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveChannel('SMS')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeChannel === 'SMS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                        >
                            SMS
                        </button>
                        <button
                            onClick={() => setActiveChannel('Email')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeChannel === 'Email' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                        >
                            Email
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex -space-x-2">
                        {['Call Logs', 'Recordings', 'Templates'].map((btn, i) => (
                            <button key={i} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm">{btn}</button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Combined Timeline & Chat */}
                <div className="flex-1 flex flex-col h-full border-r border-slate-200/60">
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-8 scroll-smooth">
                        {/* Timeline Mixins */}
                        {/* SMS Consent Banner */}
                        {activeChannel === 'SMS' && !selectedClient?.smsConsent && (
                            <div className="flex justify-center mb-8">
                                <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 max-w-xl shadow-xl shadow-amber-500/5 flex items-center gap-8 animate-in zoom-in duration-500">
                                    <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                                        <i className="fa-solid fa-shield-halved text-2xl"></i>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest mb-1">SMS Consent Required</h4>
                                        <p className="text-xs font-bold text-amber-700 leading-relaxed">
                                            Federal regulations require explicit consent before sending SMS. Would you like to record {selectedClient?.displayName}'s consent for recording and messaging?
                                        </p>
                                        <div className="flex gap-3 mt-4">
                                            <button
                                                onClick={handleGrantConsent}
                                                className="px-6 py-2 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20"
                                            >
                                                Record Consent
                                            </button>
                                            <button className="px-6 py-2 bg-white border border-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-50 transition-all">
                                                Learn More
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Merged View: Timeline Events + Messages */}
                        {messages.map((msg, i) => (
                            <div key={msg.id} className={`flex ${msg.senderId === realtorId ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                                <div className={`max-w-[70%] group relative`}>
                                    <div className={`p-6 rounded-[2rem] shadow-xl ${msg.senderId === realtorId
                                        ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-200'
                                        : 'bg-white text-slate-900 border border-slate-100 rounded-tl-none shadow-slate-200'
                                        }`}>
                                        <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                                        <div className={`text-[8px] font-black uppercase tracking-widest mt-2 flex items-center gap-2 ${msg.senderId === realtorId ? 'text-indigo-200' : 'text-slate-400'}`}>
                                            {formatDate(msg.timestamp)} • {msg.channel}
                                            {msg.senderId === realtorId && <i className={`fa-solid fa-check-double ${msg.status === 'read' ? 'text-emerald-400' : ''}`}></i>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Auto-Logged Activity Item */}
                        <div className="flex items-center gap-6 px-10 py-6 bg-indigo-50 rounded-[2.5rem] border border-indigo-100 border-dashed relative">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-500 shadow-sm shrink-0">
                                <i className="fa-solid fa-bolt"></i>
                            </div>
                            <div className="flex-1">
                                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">System Audit • Auto-Logged</div>
                                <p className="text-xs font-bold text-indigo-900">Sarah viewed 123 Maple St (4th time). Suggesting follow-up via SMS.</p>
                            </div>
                            <button className="text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:underline">View Properties</button>
                        </div>
                    </div>

                    {/* Message Input Area */}
                    <div className="p-8 bg-white border-t border-slate-200/60">
                        <div className="flex items-center gap-4 mb-4">
                            <select className="bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all">
                                <option>Quick Templates</option>
                                {templates.map(t => <option key={t.id}>{t.name}</option>)}
                            </select>
                            <button className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-all">
                                <i className="fa-solid fa-paperclip"></i> Attach Discovery
                            </button>
                        </div>
                        <div className="relative flex items-center gap-4">
                            <div className="flex-1 relative">
                                <textarea
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder={`Type your ${activeChannel} message...`}
                                    className="w-full pl-6 pr-12 py-4 bg-slate-50 border border-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-[2rem] outline-none text-sm font-medium transition-all shadow-inner resize-none min-h-[60px]"
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                />
                                <button className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-200 text-slate-400 hover:bg-indigo-600 hover:text-white transition-all">
                                    <i className="fa-solid fa-microphone text-xs"></i>
                                </button>
                            </div>
                            <button
                                onClick={handleSendMessage}
                                className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95"
                            >
                                <i className="fa-solid fa-paper-plane text-lg"></i>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar: Contextual Info */}
                <div className="w-80 bg-[#F8FAFC] p-8 space-y-8 hidden xl:block">
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contact Insights</h3>
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500">Last Call</span>
                                <span className="text-xs font-black text-slate-900">Yesterday</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500">Wait Time</span>
                                <span className="text-xs font-black text-emerald-500">4 mins</span>
                            </div>
                            <div className="h-px bg-slate-100"></div>
                            <div className="flex flex-col gap-2">
                                <span className="text-[9px] font-black uppercase text-slate-400">Common Snippets</span>
                                <div className="flex flex-wrap gap-2">
                                    {['Schedule Showing', 'Pricing Info', 'Neighborhood'].map(s => (
                                        <button key={s} className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[8px] font-black uppercase text-slate-500 hover:border-indigo-500 transition-all">{s}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Call Summary AI</h3>
                        <div className="bg-indigo-900 p-6 rounded-[2rem] shadow-xl text-white">
                            <p className="text-[10px] font-medium leading-relaxed opacity-80">
                                "Client mentioned they are pre-approved but want to see the backyard personally before making an offer on any property."
                            </p>
                            <div className="mt-4 flex items-center gap-2">
                                <i className="fa-solid fa-robot text-amber-500 text-[10px]"></i>
                                <span className="text-[8px] font-black uppercase tracking-widest text-indigo-300">Extracted from Call #402</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommHub;
