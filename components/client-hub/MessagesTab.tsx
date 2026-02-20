import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    sendInternalMessage,
    getMyMessages,
    deleteMessage,
    deleteThread,
    InternalMessage,
} from '../../services/firebase/internalMessages';
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
    return (
        date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) +
        ', ' +
        date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );
};

/** Returns a stable root-thread id for a message. */
const getThreadId = (msg: InternalMessage): string =>
    msg.threadId ?? msg.replyToId ?? msg.id;

/** Group messages into threads (array of arrays), sorted newest-thread-first. */
function groupIntoThreads(messages: InternalMessage[]): InternalMessage[][] {
    const map = new Map<string, InternalMessage[]>();
    for (const msg of messages) {
        const tid = getThreadId(msg);
        if (!map.has(tid)) map.set(tid, []);
        map.get(tid)!.push(msg);
    }
    const threads = Array.from(map.values()).map((t) =>
        [...t].sort((a, b) => {
            const ta = a.timestamp?.seconds ?? 0;
            const tb = b.timestamp?.seconds ?? 0;
            return ta - tb;
        })
    );
    threads.sort((a, b) => {
        const ta = a[a.length - 1]?.timestamp?.seconds ?? 0;
        const tb = b[b.length - 1]?.timestamp?.seconds ?? 0;
        return tb - ta;
    });
    return threads;
}

/* ─── Avatar ─── */
const Avatar: React.FC<{ name: string; isOwn: boolean; size?: string }> = ({
    name,
    isOwn,
    size = 'w-8 h-8',
}) => (
    <div
        className={`${size} rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 ${isOwn
            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
            : 'bg-slate-200 text-slate-600'
            }`}
    >
        {(name || '?').charAt(0).toUpperCase()}
    </div>
);

/* ─── QuotedMessage ─── */
const QuotedMessage: React.FC<{ msg: InternalMessage }> = ({ msg }) => (
    <div className="ml-2 mb-1 px-3 py-2 border-l-2 border-indigo-300 bg-indigo-50 rounded-r-lg text-[11px] text-slate-500 leading-snug max-w-full">
        <span className="font-bold text-indigo-600 mr-1">{msg.replyToSenderName}:</span>
        <span className="line-clamp-2">{msg.replyToContent}</span>
    </div>
);

/* ─── Confirmation Modal ─── */
interface ConfirmModalProps {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}
const ConfirmModal: React.FC<ConfirmModalProps> = ({
    title,
    message,
    confirmLabel = 'Delete',
    danger = true,
    onConfirm,
    onCancel,
}) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={onCancel}
        />
        {/* Card */}
        <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 w-full max-w-sm mx-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-trash-can text-rose-500 text-sm" />
                </div>
                <h3 className="text-sm font-black text-slate-800">{title}</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{message}</p>
            <div className="flex gap-3 justify-end pt-1">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all ${danger
                        ? 'bg-rose-500 hover:bg-rose-600 shadow-md shadow-rose-200'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                >
                    {confirmLabel}
                </button>
            </div>
        </div>
    </div>
);

/* ─── Main Component ─── */
const MessagesTab: React.FC<MessagesTabProps> = ({ userId, displayName, role }) => {
    const [messages, setMessages] = useState<InternalMessage[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [text, setText] = useState('');
    const [propertyRef, setPropertyRef] = useState('');
    const [sending, setSending] = useState(false);
    const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
    const [fetchLimit, setFetchLimit] = useState(40);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /** The message being replied to */
    const [replyTo, setReplyTo] = useState<InternalMessage | null>(null);

    /** Threads expanded/collapsed */
    const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

    /** Delete confirmation state */
    type DeleteTarget =
        | { kind: 'message'; msg: InternalMessage }
        | { kind: 'thread'; threadId: string; msgIds: string[] };
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
    const [deleting, setDeleting] = useState(false);

    const bottomRef = useRef<HTMLDivElement>(null);
    const composeRef = useRef<HTMLInputElement>(null);

    /* ── Load users ── */
    useEffect(() => {
        getAllUsers().then((all) => {
            const eligible = all.filter(
                (u: UserProfile) =>
                    u.uid !== userId && (u.role === 'admin' || u.role === 'auditor')
            );
            setUsers(eligible);
            setLoadingUsers(false);
        });
    }, [userId]);

    /* ── Fetch messages ── */
    const fetchMessages = async (lim?: number) => {
        const l = lim ?? fetchLimit;
        setLoading(true);
        const msgs = await getMyMessages(userId, l);
        setMessages(msgs);
        setHasMore(msgs.length === l);
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

    /* ── Auto-expand newest thread ── */
    useEffect(() => {
        if (messages.length > 0) {
            const filtered = messages.filter((m) =>
                activeTab === 'inbox' ? m.senderId !== userId : m.senderId === userId
            );
            if (filtered.length > 0) {
                const newest = filtered[0];
                const tid = getThreadId(newest);
                setExpandedThreads((prev) => {
                    const next = new Set(prev);
                    next.add(tid);
                    return next;
                });
            }
        }
    }, [messages, activeTab]);

    /* ── Focus compose on reply ── */
    useEffect(() => {
        if (replyTo) composeRef.current?.focus();
    }, [replyTo]);

    /* ── Helpers ── */
    const toggleRecipient = (uid: string) =>
        setSelectedIds((prev) =>
            prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
        );

    const toggleThread = (tid: string) =>
        setExpandedThreads((prev) => {
            const next = new Set(prev);
            next.has(tid) ? next.delete(tid) : next.add(tid);
            return next;
        });

    const handleReply = (msg: InternalMessage) => {
        setReplyTo(msg);
        const others = msg.participants?.filter((p) => p !== userId) ?? [];
        setSelectedIds(others.length > 0 ? others : msg.recipientIds.filter((r) => r !== userId));
        if (msg.senderId !== userId) setSelectedIds([msg.senderId]);
        const tid = getThreadId(msg);
        setExpandedThreads((prev) => { const n = new Set(prev); n.add(tid); return n; });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const clearReply = () => setReplyTo(null);

    const handleSend = async () => {
        const trimmed = text.trim();
        if (!trimmed || sending || selectedIds.length === 0) return;
        setSending(true);
        setError(null);
        try {
            const property = propertyRef.trim() ? { address: propertyRef.trim() } : undefined;
            const result = await sendInternalMessage(
                userId, displayName, role, selectedIds, trimmed, property,
                replyTo
                    ? { id: replyTo.id, content: replyTo.content, senderName: replyTo.senderName, threadId: replyTo.threadId }
                    : undefined
            );
            if (!result.success) throw new Error(result.error || 'Failed to send');
            setText('');
            setPropertyRef('');
            setReplyTo(null);
            await fetchMessages(fetchLimit);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSending(false);
        }
    };

    /* ── Delete handlers ── */
    const confirmDelete = (target: DeleteTarget) => setDeleteTarget(target);
    const cancelDelete = () => { if (!deleting) setDeleteTarget(null); };

    const executeDelete = async () => {
        if (!deleteTarget || deleting) return;
        setDeleting(true);
        try {
            let result: { success: boolean; error?: string };
            if (deleteTarget.kind === 'message') {
                result = await deleteMessage(deleteTarget.msg.id);
            } else {
                result = await deleteThread(deleteTarget.threadId, deleteTarget.msgIds);
            }
            if (!result.success) throw new Error(result.error || 'Delete failed');
            setDeleteTarget(null);
            // Optimistic local removal while we refresh
            if (deleteTarget.kind === 'message') {
                setMessages((prev) => prev.filter((m) => m.id !== deleteTarget.msg.id));
            } else {
                const ids = new Set(deleteTarget.msgIds);
                setMessages((prev) => prev.filter((m) => !ids.has(m.id)));
            }
            // Also full refresh so counts / hasMore stay accurate
            await fetchMessages(fetchLimit);
        } catch (e: any) {
            setError(e.message);
            setDeleteTarget(null);
        } finally {
            setDeleting(false);
        }
    };

    /* ── Derived ── */
    const threads = useMemo(() => {
        const filtered = messages.filter((m) =>
            activeTab === 'inbox' ? m.senderId !== userId : m.senderId === userId
        );
        return groupIntoThreads(filtered);
    }, [messages, activeTab, userId]);

    /* ── Render ── */
    return (
        <>
            {/* ── Delete Confirmation Modal ── */}
            {deleteTarget && (
                <ConfirmModal
                    title={deleteTarget.kind === 'thread' ? 'Delete entire conversation?' : 'Delete this message?'}
                    message={
                        deleteTarget.kind === 'thread'
                            ? `This will permanently delete all ${deleteTarget.msgIds.length} message${deleteTarget.msgIds.length !== 1 ? 's' : ''} in this conversation. This cannot be undone.`
                            : 'This will permanently remove this message. This cannot be undone.'
                    }
                    confirmLabel={deleting ? 'Deleting…' : 'Delete'}
                    onConfirm={executeDelete}
                    onCancel={cancelDelete}
                />
            )}

            <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">

                {/* ── Recipient picker ── */}
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
                                        <span
                                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${selected ? 'bg-white/20' : 'bg-slate-200'
                                                }`}
                                        >
                                            {(u.displayName || u.email || '?').charAt(0).toUpperCase()}
                                        </span>
                                        {u.displayName || u.email}
                                        {u.role && (
                                            <span className="text-[9px] uppercase font-black opacity-70">
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

                {/* ── Compose ── */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
                    {/* Reply-to banner */}
                    {replyTo && (
                        <div className="flex items-start gap-3 px-4 py-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                            <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">
                                    Replying to {replyTo.senderName}
                                </p>
                                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                    {replyTo.content}
                                </p>
                            </div>
                            <button
                                onClick={clearReply}
                                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-indigo-300 hover:text-indigo-600 hover:bg-indigo-100 transition-all"
                                title="Cancel reply"
                            >
                                <i className="fa-solid fa-xmark text-xs" />
                            </button>
                        </div>
                    )}

                    <input
                        type="text"
                        value={propertyRef}
                        onChange={(e) => setPropertyRef(e.target.value)}
                        placeholder="Property reference (optional)"
                        className="text-xs text-slate-600 placeholder-slate-300 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                    />
                    <div className="flex gap-3">
                        <input
                            ref={composeRef}
                            type="text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder={replyTo ? `Reply to ${replyTo.senderName}…` : 'Write a message…'}
                            className="flex-1 text-sm text-slate-800 placeholder-slate-300 border border-slate-200 rounded-2xl px-5 py-3 outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!text.trim() || sending || selectedIds.length === 0}
                            className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-300 text-white text-xs font-black uppercase tracking-widest transition-all"
                        >
                            {sending ? (
                                <i className="fa-solid fa-spinner fa-spin" />
                            ) : replyTo ? (
                                <><i className="fa-solid fa-reply mr-1.5" />Reply</>
                            ) : (
                                'Send'
                            )}
                        </button>
                    </div>
                    {error && (
                        <p className="text-xs text-rose-500 font-bold">
                            <i className="fa-solid fa-triangle-exclamation mr-1" />
                            {error}
                        </p>
                    )}
                </div>

                {/* ── Inbox / Sent tabs ── */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    {/* Tab bar */}
                    <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3">
                        <div className="flex p-1 bg-slate-100 rounded-xl">
                            <button
                                onClick={() => setActiveTab('inbox')}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'inbox'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                <i className="fa-solid fa-inbox mr-1.5" />Inbox
                            </button>
                            <button
                                onClick={() => setActiveTab('sent')}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'sent'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                <i className="fa-solid fa-paper-plane mr-1.5" />Sent
                            </button>
                        </div>
                        <button
                            onClick={() => fetchMessages()}
                            disabled={loading}
                            title="Refresh"
                            className="ml-auto w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all disabled:opacity-40"
                        >
                            <i className={`fa-solid fa-rotate-right text-xs ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {/* Thread list */}
                    <div className="divide-y divide-slate-50 max-h-[60vh] overflow-y-auto">
                        {loading ? (
                            <div className="py-14 text-center text-slate-400 text-sm">
                                <i className="fa-solid fa-spinner fa-spin mr-2" />Loading…
                            </div>
                        ) : threads.length === 0 ? (
                            <div className="py-14 text-center text-slate-400 text-sm">
                                {activeTab === 'inbox' ? 'No received messages yet.' : 'No sent messages yet.'}
                            </div>
                        ) : (
                            threads.map((thread) => {
                                const root = thread[0];
                                const last = thread[thread.length - 1];
                                const tid = getThreadId(root);
                                const isExpanded = expandedThreads.has(tid);
                                const replyCount = thread.length - 1;
                                const threadMsgIds = thread.map((m) => m.id);

                                const participantNames = Array.from(
                                    new Set(thread.map((m) => m.senderName))
                                ).join(', ');

                                return (
                                    <div key={tid} className="group/thread">
                                        {/* Thread header */}
                                        <div className="flex items-center">
                                            <button
                                                onClick={() => toggleThread(tid)}
                                                className="flex-1 px-6 py-4 flex items-center gap-3 hover:bg-slate-50/60 transition-all text-left min-w-0"
                                            >
                                                {/* Avatar + count badge */}
                                                <div className="relative flex-shrink-0 w-10 h-9">
                                                    <Avatar
                                                        name={root.senderName}
                                                        isOwn={root.senderId === userId}
                                                        size="w-8 h-8"
                                                    />
                                                    {replyCount > 0 && (
                                                        <div className="absolute -bottom-0.5 -right-1 w-5 h-5 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[9px] font-black text-indigo-600">
                                                            {thread.length > 9 ? '9+' : thread.length}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="text-xs font-black text-slate-800 truncate">
                                                            {participantNames}
                                                        </span>
                                                        <span className="text-[9px] text-slate-400 font-medium ml-auto flex-shrink-0">
                                                            {formatTime(last.timestamp)}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 truncate leading-snug">
                                                        {last.content}
                                                    </p>
                                                    {root.propertyAddress && (
                                                        <p className="text-[9px] text-indigo-400 font-bold mt-0.5 truncate">
                                                            <i className="fa-solid fa-location-dot mr-0.5" />
                                                            {root.propertyAddress}
                                                        </p>
                                                    )}
                                                </div>

                                                <i
                                                    className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[10px] text-slate-300 flex-shrink-0 transition-transform`}
                                                />
                                            </button>

                                            {/* Delete whole thread button — visible on hover */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    confirmDelete({ kind: 'thread', threadId: tid, msgIds: threadMsgIds });
                                                }}
                                                title="Delete conversation"
                                                className="flex-shrink-0 mr-4 w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover/thread:opacity-100 transition-all"
                                            >
                                                <i className="fa-regular fa-trash-can text-xs" />
                                            </button>
                                        </div>

                                        {/* Expanded messages */}
                                        {isExpanded && (
                                            <div className="border-t border-slate-50 bg-slate-50/30">
                                                {thread.map((msg, idx) => {
                                                    const isOwn = msg.senderId === userId;
                                                    const toLabel = isOwn
                                                        ? msg.recipientIds
                                                            .map((id) => users.find((u) => u.uid === id)?.displayName || id)
                                                            .join(', ')
                                                        : null;

                                                    return (
                                                        <div
                                                            key={msg.id}
                                                            className={`px-6 py-4 flex gap-3 group/msg ${isOwn ? 'bg-indigo-50/30' : ''
                                                                } ${idx < thread.length - 1 ? 'border-b border-slate-100' : ''}`}
                                                        >
                                                            {/* Avatar + connector */}
                                                            <div className="flex flex-col items-center gap-1">
                                                                <Avatar name={msg.senderName} isOwn={isOwn} size="w-8 h-8" />
                                                                {idx < thread.length - 1 && (
                                                                    <div className="flex-1 w-px bg-slate-200 min-h-[12px]" />
                                                                )}
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                {/* Sender row */}
                                                                <div className="flex items-baseline gap-2 flex-wrap mb-1">
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

                                                                {/* Quoted reply context */}
                                                                {msg.replyToId && msg.replyToContent && (
                                                                    <QuotedMessage msg={msg} />
                                                                )}

                                                                {/* Message body */}
                                                                <p className="text-sm text-slate-700 leading-relaxed">
                                                                    {msg.content}
                                                                </p>

                                                                {/* Property tag */}
                                                                {msg.propertyAddress && (
                                                                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-indigo-500 font-bold">
                                                                        <i className="fa-solid fa-location-dot" />
                                                                        {msg.propertyAddress}
                                                                    </div>
                                                                )}

                                                                {/* Action buttons row */}
                                                                <div className="mt-2 flex items-center gap-3">
                                                                    <button
                                                                        onClick={() => handleReply(msg)}
                                                                        className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                                                                    >
                                                                        <i className="fa-solid fa-reply text-[9px]" />
                                                                        Reply
                                                                    </button>

                                                                    <button
                                                                        onClick={() =>
                                                                            confirmDelete({ kind: 'message', msg })
                                                                        }
                                                                        title="Delete message"
                                                                        className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover/msg:opacity-100"
                                                                    >
                                                                        <i className="fa-regular fa-trash-can text-[9px]" />
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Load more */}
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
        </>
    );
};

export default MessagesTab;
