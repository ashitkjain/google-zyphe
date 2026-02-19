import React, { useState, useEffect, useRef } from 'react';
import { sendInternalMessage, subscribeToMyMessages, InternalMessage } from '../../services/firebase/internalMessages';
import { getAllUsers } from '../../services/firebase/user';
import { UserProfile } from '../../types';

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
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [text, setText] = useState('');
    const [propertyRef, setPropertyRef] = useState('');
    const [sending, setSending] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Load all users for recipient picker
    useEffect(() => {
        getAllUsers().then((all) => {
            // exclude self
            setUsers(all.filter((u: UserProfile) => u.uid !== userId));
            setLoadingUsers(false);
        });
    }, [userId]);

    // Subscribe to messages I'm part of
    useEffect(() => {
        return subscribeToMyMessages(userId, setMessages);
    }, [userId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const toggleRecipient = (uid: string) => {
        setSelectedIds((prev) =>
            prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
        );
    };

    const handleSend = async () => {
        const trimmed = text.trim();
        if (!trimmed || sending || selectedIds.length === 0) return;
        setSending(true);
        setError(null);
        try {
            const property = propertyRef.trim() ? { address: propertyRef.trim() } : undefined;
            const result = await sendInternalMessage(userId, displayName, role, selectedIds, trimmed, property);
            if (!result.success) throw new Error(result.error || 'Failed to send');
            setText('');
            setPropertyRef('');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">

            {/* ── Recipient picker ──────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                    Send to
                </p>
                {loadingUsers ? (
                    <p className="text-xs text-slate-400">Loading users…</p>
                ) : users.length === 0 ? (
                    <p className="text-xs text-slate-400">No other users found.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {users.map((u) => {
                            const selected = selectedIds.includes(u.uid);
                            return (
                                <button
                                    key={u.uid}
                                    onClick={() => toggleRecipient(u.uid)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${selected
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                                        }`}
                                >
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${selected ? 'bg-white/20' : 'bg-slate-200'}`}>
                                        {(u.displayName || u.email || '?').charAt(0).toUpperCase()}
                                    </span>
                                    {u.displayName || u.email}
                                    {u.role && (
                                        <span className={`text-[9px] uppercase font-black opacity-70`}>
                                            · {u.role}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
                {selectedIds.length === 0 && !loadingUsers && (
                    <p className="text-[10px] text-amber-500 font-bold mt-3">
                        <i className="fa-solid fa-circle-exclamation mr-1" />
                        Select at least one recipient before sending.
                    </p>
                )}
            </div>

            {/* ── Compose ───────────────────────────────────────── */}
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
                        disabled={!text.trim() || sending || selectedIds.length === 0}
                        className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-300 text-white text-xs font-black uppercase tracking-widest transition-all"
                    >
                        {sending ? <i className="fa-solid fa-spinner fa-spin" /> : 'Send'}
                    </button>
                </div>
                {error && <p className="text-xs text-rose-500 font-bold"><i className="fa-solid fa-triangle-exclamation mr-1" />{error}</p>}
            </div>

            {/* ── Inbox (messages I'm part of) ──────────────────── */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3">
                    <i className="fa-solid fa-inbox text-indigo-400" />
                    <span className="text-sm font-black text-slate-700 uppercase tracking-widest">Inbox</span>
                    <span className="ml-auto text-[9px] font-black text-slate-300 uppercase tracking-widest">
                        Only messages sent to or from you
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Live" />
                </div>

                <div className="divide-y divide-slate-50 max-h-[50vh] overflow-y-auto">
                    {messages.length === 0 ? (
                        <div className="py-14 text-center text-slate-400 text-sm">No messages yet.</div>
                    ) : (
                        [...messages].reverse().map((msg) => {
                            const isOwn = msg.senderId === userId;
                            // Build "To: …" label for sent messages
                            const toLabel = isOwn
                                ? msg.recipientIds
                                    .map((id) => users.find((u) => u.uid === id)?.displayName || id)
                                    .join(', ')
                                : null;

                            return (
                                <div key={msg.id} className={`px-6 py-4 flex gap-4 ${isOwn ? 'bg-indigo-50/40' : ''}`}>
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${isOwn ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                        {(msg.senderName || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                                            <span className="text-xs font-black text-slate-800">
                                                {isOwn ? 'You' : msg.senderName}
                                            </span>
                                            {toLabel && (
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    → {toLabel}
                                                </span>
                                            )}
                                            <span className="text-[9px] text-slate-400 font-medium ml-auto">
                                                {formatTime(msg.timestamp)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 leading-relaxed">{msg.content}</p>
                                        {msg.propertyAddress && (
                                            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-indigo-500 font-bold">
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
        </div>
    );
};

export default MessagesTab;
