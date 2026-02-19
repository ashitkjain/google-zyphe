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

const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-violet-100 text-violet-700 border-violet-200',
    tester: 'bg-amber-100  text-amber-700  border-amber-200',
    realtor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

const ROLE_BUBBLE_OWN = 'bg-indigo-600 text-white';
const ROLE_BUBBLE_OTHER = 'bg-white border border-slate-200 text-slate-800';

const formatTime = (ts: any): string => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ' ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const MessagesTab: React.FC<MessagesTabProps> = ({ userId, displayName, role }) => {
    const [messages, setMessages] = useState<InternalMessage[]>([]);
    const [text, setText] = useState('');
    const [propertyRef, setPropertyRef] = useState('');   // free-text property address/zpid
    const [showPropInput, setShowPropInput] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsub = subscribeToInternalMessages(150, setMessages);
        return () => unsub();
    }, []);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        const trimmed = text.trim();
        if (!trimmed || sending) return;
        setSending(true);
        setError(null);
        try {
            const property = propertyRef.trim()
                ? { zpid: '', address: propertyRef.trim() }
                : undefined;
            const result = await sendInternalMessage(userId, displayName, role, trimmed, property);
            if (!result.success) throw new Error(result.error || 'Failed to send');
            setText('');
            setPropertyRef('');
            setShowPropInput(false);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Group messages by date
    const grouped: { date: string; items: InternalMessage[] }[] = [];
    messages.forEach((msg) => {
        const ts = msg.timestamp;
        if (!ts) return;
        const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
        const dStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        if (!grouped.length || grouped[grouped.length - 1].date !== dStr) {
            grouped.push({ date: dStr, items: [] });
        }
        grouped[grouped.length - 1].items.push(msg);
    });

    return (
        <div className="flex flex-col h-full bg-slate-50" style={{ minHeight: 0 }}>
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-900 px-8 py-6 flex items-center gap-5 flex-shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                    <i className="fa-solid fa-comments text-indigo-300 text-lg" />
                </div>
                <div>
                    <h2 className="text-white font-black text-lg tracking-tight">Team Messages</h2>
                    <p className="text-indigo-300/60 text-[10px] font-bold uppercase tracking-widest">
                        Testers &amp; Admins · Internal only
                    </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50" />
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Live</span>
                </div>
            </div>

            {/* ── Message list ───────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8" style={{ minHeight: 0 }}>
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center mb-5">
                            <i className="fa-solid fa-paper-plane text-indigo-200 text-3xl" />
                        </div>
                        <h3 className="text-lg font-black text-slate-700 mb-1">No messages yet</h3>
                        <p className="text-sm text-slate-400 max-w-xs">
                            Start the conversation below. Messages are visible to all testers and admins.
                        </p>
                    </div>
                )}

                {grouped.map(({ date, items }) => (
                    <div key={date}>
                        {/* Date divider */}
                        <div className="flex items-center gap-4 mb-5">
                            <div className="flex-1 h-px bg-slate-200" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap px-2">
                                {date}
                            </span>
                            <div className="flex-1 h-px bg-slate-200" />
                        </div>

                        <div className="space-y-3">
                            {items.map((msg) => {
                                const isOwn = msg.senderId === userId;
                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
                                    >
                                        {/* Avatar */}
                                        <div
                                            className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 text-xs font-black shadow-md ${isOwn
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-slate-200 text-slate-600'
                                                }`}
                                        >
                                            {(msg.senderName || '?').charAt(0).toUpperCase()}
                                        </div>

                                        <div className={`max-w-[72%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                                            {/* Sender + role badge */}
                                            <div className={`flex items-center gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                                                <span className="text-[10px] font-black text-slate-600">
                                                    {isOwn ? 'You' : msg.senderName}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${ROLE_COLORS[msg.senderRole] || ROLE_COLORS.realtor
                                                    }`}>
                                                    {msg.senderRole}
                                                </span>
                                            </div>

                                            {/* Bubble */}
                                            <div
                                                className={`rounded-[1.25rem] px-5 py-3.5 shadow-sm text-sm leading-relaxed ${isOwn ? ROLE_BUBBLE_OWN : ROLE_BUBBLE_OTHER
                                                    } ${isOwn ? 'rounded-tr-md' : 'rounded-tl-md'}`}
                                            >
                                                {msg.content}

                                                {/* Property reference chip */}
                                                {msg.propertyAddress && (
                                                    <div className={`mt-2.5 flex items-center gap-2 pt-2.5 border-t ${isOwn ? 'border-white/20' : 'border-slate-100'
                                                        }`}>
                                                        <i className={`fa-solid fa-location-dot text-[10px] ${isOwn ? 'text-indigo-200' : 'text-indigo-400'}`} />
                                                        <span className={`text-[10px] font-bold ${isOwn ? 'text-indigo-200' : 'text-indigo-500'}`}>
                                                            {msg.propertyAddress}
                                                        </span>
                                                        {msg.propertyZpid && (
                                                            <span className={`text-[9px] font-mono opacity-50 ${isOwn ? 'text-white' : 'text-slate-500'}`}>
                                                                #{msg.propertyZpid}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Timestamp */}
                                            <span className="text-[9px] text-slate-400 font-medium px-1">
                                                {formatTime(msg.timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* ── Compose area ───────────────────────────────────────── */}
            <div className="border-t border-slate-200 bg-white px-6 py-4 flex-shrink-0">
                {/* Property reference row */}
                {showPropInput && (
                    <div className="mb-3 flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-200">
                        <i className="fa-solid fa-house text-indigo-400 text-xs" />
                        <input
                            type="text"
                            value={propertyRef}
                            onChange={(e) => setPropertyRef(e.target.value)}
                            placeholder="Property address or ZPID (optional)"
                            className="flex-1 text-xs font-medium text-slate-700 placeholder-slate-300 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
                        />
                        <button
                            onClick={() => { setShowPropInput(false); setPropertyRef(''); }}
                            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all"
                        >
                            <i className="fa-solid fa-xmark text-xs" />
                        </button>
                    </div>
                )}

                {error && (
                    <p className="text-xs text-rose-500 font-bold mb-2">
                        <i className="fa-solid fa-triangle-exclamation mr-1" />
                        {error}
                    </p>
                )}

                <div className="flex items-end gap-3">
                    {/* Property attach button */}
                    <button
                        onClick={() => setShowPropInput((v) => !v)}
                        title="Attach property reference"
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${showPropInput || propertyRef
                                ? 'bg-indigo-100 text-indigo-600 border border-indigo-200'
                                : 'bg-slate-100 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50'
                            }`}
                    >
                        <i className="fa-solid fa-house text-sm" />
                    </button>

                    {/* Text area */}
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                        rows={1}
                        className="flex-1 resize-none text-sm text-slate-800 placeholder-slate-300 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all leading-relaxed"
                        style={{ maxHeight: 140, overflowY: 'auto' }}
                    />

                    {/* Send button */}
                    <button
                        onClick={handleSend}
                        disabled={!text.trim() || sending}
                        className="w-11 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white flex items-center justify-center transition-all flex-shrink-0 shadow-lg shadow-indigo-500/30 disabled:shadow-none"
                    >
                        {sending
                            ? <i className="fa-solid fa-spinner fa-spin text-sm" />
                            : <i className="fa-solid fa-paper-plane text-sm" />
                        }
                    </button>
                </div>

                <p className="text-[9px] text-slate-300 text-center mt-2.5 font-medium uppercase tracking-widest">
                    Visible to all testers &amp; admins · Not sent to clients
                </p>
            </div>
        </div>
    );
};

export default MessagesTab;
