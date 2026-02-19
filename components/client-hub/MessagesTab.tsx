import React, { useState, useEffect, useRef } from 'react';
import {
    sendInternalMessage,
    subscribeToInternalMessages,
    InternalMessage,
} from '../../services/firebase/internalMessages';

interface MessagesTabProps {
    userId: string;
    displayName: string;
    role: string;
}

const formatTime = (ts: any): string => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) +
        ', ' + date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const MessagesTab: React.FC<MessagesTabProps> = ({ userId, displayName, role }) => {
    const [messages, setMessages] = useState<InternalMessage[]>([]);
    const [text, setText] = useState('');
    const [propertyRef, setPropertyRef] = useState('');
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        return subscribeToInternalMessages(150, setMessages);
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        const trimmed = text.trim();
        if (!trimmed || sending) return;
        setSending(true);
        const property = propertyRef.trim() ? { zpid: '', address: propertyRef.trim() } : undefined;
        await sendInternalMessage(userId, displayName, role, trimmed, property);
        setText('');
        setPropertyRef('');
        setSending(false);
    };

    return (
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">
            {/* Message list */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3">
                    <i className="fa-solid fa-comments text-indigo-400" />
                    <span className="text-sm font-black text-slate-700 uppercase tracking-widest">Team Messages</span>
                    <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Live" />
                </div>

                <div className="divide-y divide-slate-50 max-h-[60vh] overflow-y-auto">
                    {messages.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 text-sm">No messages yet. Say something!</div>
                    ) : (
                        messages.map((msg) => {
                            const isOwn = msg.senderId === userId;
                            return (
                                <div key={msg.id} className={`px-6 py-4 flex gap-4 ${isOwn ? 'bg-indigo-50/40' : ''}`}>
                                    {/* Avatar */}
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${isOwn ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                        {(msg.senderName || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2 mb-1">
                                            <span className="text-xs font-black text-slate-800">{isOwn ? 'You' : msg.senderName}</span>
                                            <span className="text-[9px] text-slate-400 font-medium">{formatTime(msg.timestamp)}</span>
                                        </div>
                                        <p className="text-sm text-slate-600 leading-relaxed">{msg.content}</p>
                                        {msg.propertyAddress && (
                                            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-indigo-500 font-bold">
                                                <i className="fa-solid fa-location-dot" />
                                                {msg.propertyAddress}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={bottomRef} />
                </div>
            </div>

            {/* Compose */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
                <input
                    type="text"
                    value={propertyRef}
                    onChange={(e) => setPropertyRef(e.target.value)}
                    placeholder="Property reference (optional)"
                    className="text-xs text-slate-600 placeholder-slate-300 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                />
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Write a message…"
                        className="flex-1 text-sm text-slate-800 placeholder-slate-300 border border-slate-200 rounded-2xl px-5 py-3 outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!text.trim() || sending}
                        className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-300 text-white text-xs font-black uppercase tracking-widest transition-all"
                    >
                        {sending ? <i className="fa-solid fa-spinner fa-spin" /> : 'Send'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MessagesTab;
