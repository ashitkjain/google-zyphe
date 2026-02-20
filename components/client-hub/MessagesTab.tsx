import React, { useState, useEffect, useRef } from 'react';
import { sendInternalMessage, getMyMessages, InternalMessage } from '../../services/firebase/internalMessages';
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
    const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
    const [fetchLimit, setFetchLimit] = useState(20);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Load recipient list once
    useEffect(() => {
        getAllUsers().then((all) => {
            const eligible = all.filter((u: UserProfile) =>
                u.uid !== userId &&
                (u.role === 'admin' || u.role === 'tester')
            );
            setUsers(eligible);
            setLoadingUsers(false);
        });
    }, [userId]);

    // Fetch messages once on mount
    const fetchMessages = async (limit?: number) => {
        const l = limit ?? fetchLimit;
        setLoading(true);
        const msgs = await getMyMessages(userId, l);
        setMessages(msgs);
        setHasMore(msgs.length === l); // exactly l results → more may exist
        setLoading(false);
    };

    const loadMore = () => {
        const next = fetchLimit + 20;
        setFetchLimit(next);
        fetchMessages(next);
    };

    useEffect(() => {
        fetchMessages();
    }, [userId]);

    // Scroll to bottom when messages load
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
            // Refresh inbox after sending
            await fetchMessages(fetchLimit);
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

            {/* ── Inbox / Sent tabs ─────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3">
                    {/* Tab switcher */}
                    <div className="flex p-1 bg-slate-100 rounded-xl">
                        <button
                            onClick={() => setActiveTab('inbox')}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'inbox' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <i className="fa-solid fa-inbox mr-1.5" />Inbox
                        </button>
                        <button
                            onClick={() => setActiveTab('sent')}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'sent' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <i className="fa-solid fa-paper-plane mr-1.5" />Sent
                        </button>
                    </div>
                    <button
                        onClick={fetchMessages}
                        disabled={loading}
                        title="Refresh"
                        className="ml-auto w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all disabled:opacity-40"
                    >
                        <i className={`fa-solid fa-rotate-right text-xs ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <div className="divide-y divide-slate-50 max-h-[50vh] overflow-y-auto">
                    {loading ? (
                        <div className="py-14 text-center text-slate-400 text-sm">
                            <i className="fa-solid fa-spinner fa-spin mr-2" />Loading…
                        </div>
                    ) : (() => {
                        const filtered = messages.filter((m) =>
                            activeTab === 'inbox' ? m.senderId !== userId : m.senderId === userId
                        );
                        return filtered.length === 0 ? (
                            <div className="py-14 text-center text-slate-400 text-sm">
                                {activeTab === 'inbox' ? 'No received messages yet.' : 'No sent messages yet.'}
                            </div>
                        ) : (
                            filtered.map((msg) => {
                                const isOwn = msg.senderId === userId;
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
                        );
                    })()
                    }
                    <div ref={bottomRef} />
                </div>
                {/* Load more — outside the scroll container so it always sits at the bottom */}
                {hasMore && !loading && (
                    <div className="px-6 py-4 border-t border-slate-100 text-center">
                        <button
                            onClick={loadMore}
                            className="text-xs font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-700 transition-all"
                        >
                            <i className="fa-solid fa-chevron-down mr-1.5" />Load older messages
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessagesTab;
