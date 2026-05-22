import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { createClientPortal, updatePropertyStatus, fetchPortalPropertyMeta } from '../../services/portalService';
import { Lead } from '../../types';
import { ClientPortal } from '../../types/portal';

interface AddToPortalModalProps {
    isOpen: boolean;
    onClose: () => void;
    realtorId: string;
    zpid: string;
    address: string;
}

type ModalTab = 'client' | 'public';

const AddToPortalModal: React.FC<AddToPortalModalProps> = ({ isOpen, onClose, realtorId, zpid, address }) => {
    const [activeTab, setActiveTab] = useState<ModalTab>('client');

    // ── Client tab state ──
    const [leads, setLeads] = useState<Lead[]>([]);
    const [portals, setPortals] = useState<ClientPortal[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [successClient, setSuccessClient] = useState<string | null>(null);
    const [successLink, setSuccessLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // ── Public link tab state ──
    const [publicLabel, setPublicLabel] = useState('');
    const [publicCreating, setPublicCreating] = useState(false);
    const [publicLink, setPublicLink] = useState<string | null>(null);
    const [publicCopied, setPublicCopied] = useState(false);
    const [publicError, setPublicError] = useState<string | null>(null);

    // ── Reset on open ──
    useEffect(() => {
        if (isOpen) {
            setActiveTab('client');
            setSuccessClient(null);
            setSuccessLink(null);
            setCopied(false);
            setPublicLabel('');
            setPublicLink(null);
            setPublicCopied(false);
            setPublicError(null);
        }
    }, [isOpen]);

    // ── Fetch CRM leads + clients + portals ──
    useEffect(() => {
        if (!isOpen) return;
        if (!realtorId) { setLoading(false); return; }
        if (!db) { setLoading(false); return; }

        setLoading(true);
        let unsubscribed = false;

        let unsubLeads = () => {};
        try {
            unsubLeads = onSnapshot(collection(db, 'realtors', realtorId, 'leads'),
                snap => {
                    if (unsubscribed) return;
                    const data = snap.docs.map(d => ({ id: d.id, collectionName: 'leads', ...d.data() } as Lead));
                    setLeads(prev => {
                        const others = prev.filter(l => l.collectionName !== 'leads');
                        const map = new Map([...others, ...data].map(l => [l.id, l]));
                        return Array.from(map.values());
                    });
                },
                err => console.error('[AddToPortalModal] leads error:', err)
            );
        } catch (e) { console.error(e); }

        let unsubClients = () => {};
        try {
            unsubClients = onSnapshot(collection(db, 'realtors', realtorId, 'clients'),
                snap => {
                    if (unsubscribed) return;
                    const data = snap.docs.map(d => ({ id: d.id, collectionName: 'clients', ...d.data() } as Lead));
                    setLeads(prev => {
                        const others = prev.filter(l => l.collectionName !== 'clients');
                        const map = new Map([...others, ...data].map(l => [l.id, l]));
                        return Array.from(map.values());
                    });
                },
                err => console.error('[AddToPortalModal] clients error:', err)
            );
        } catch (e) { console.error(e); }

        let unsubPortals = () => {};
        try {
            unsubPortals = onSnapshot(
                query(collection(db, 'client_portals'), where('agentId', '==', realtorId)),
                snap => {
                    if (unsubscribed) return;
                    setPortals(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClientPortal)));
                    setLoading(false);
                },
                err => { console.error('[AddToPortalModal] portals error:', err); if (!unsubscribed) setLoading(false); }
            );
        } catch (e) { console.error(e); setLoading(false); }

        return () => { unsubscribed = true; unsubLeads(); unsubClients(); unsubPortals(); };
    }, [isOpen, realtorId]);

    // ── Client recommendation ──
    const handleRecommend = async (lead: Lead) => {
        const name = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.name || 'Client';
        const email = lead.email || '';
        if (!email) { alert('This client does not have an email address.'); return; }

        setProcessingId(lead.id);
        try {
            let portal = portals.find(p => p.clientEmail?.toLowerCase() === email.toLowerCase() && !p.isPublic);
            let portalId = portal?.id;
            let portalToken = portal?.accessToken;

            if (!portalId) {
                const res = await createClientPortal(
                    realtorId, name, email,
                    `Welcome to your custom property portal! Here you can favorite houses, leave comments, and communicate directly with me.`
                );
                portalId = res.id;
                portalToken = res.accessToken;
            }

            // Fetch thumbnail + stats from Firestore, non-blocking
            const meta = await fetchPortalPropertyMeta(zpid).catch(() => null);
            await updatePropertyStatus(portalId, zpid, address, 'suggested_by_agent', 'agent', undefined, meta || undefined);
            setSuccessClient(name);
            if (portalToken) setSuccessLink(`${window.location.origin}/portal/${portalToken}`);
        } catch (err) {
            console.error(err);
            alert('Failed to recommend property to client portal.');
        } finally {
            setProcessingId(null);
        }
    };

    // ── Public link generation ──
    const handleCreatePublicLink = async () => {
        setPublicError(null);
        setPublicCreating(true);
        try {
            const label = publicLabel.trim() || 'Public Viewer';
            // Pass isPublic directly into the portal document via extraFields
            const res = await createClientPortal(
                realtorId, label, '',
                `Shared property portal — ${label}`,
                [],
                { isPublic: true, publicLabel: label }
            );
            // Seed the current property into the portal
            // Fetch thumbnail + stats from Firestore, non-blocking
            const meta = await fetchPortalPropertyMeta(zpid).catch(() => null);
            await updatePropertyStatus(res.id, zpid, address, 'suggested_by_agent', 'agent', undefined, meta || undefined);
            setPublicLink(`${window.location.origin}/portal/${res.accessToken}`);
        } catch (err: any) {
            console.error('[AddToPortalModal] Public link creation failed:', err);
            setPublicError(err?.message || 'Failed to create public link. Check the console for details.');
        } finally {
            setPublicCreating(false);
        }
    };

    const copy = (text: string, setCopiedFn: (v: boolean) => void) => {
        navigator.clipboard.writeText(text);
        setCopiedFn(true);
        setTimeout(() => setCopiedFn(false), 2000);
    };

    if (!isOpen) return null;

    const isSuccess = !!successClient || !!publicLink;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
                            <i className="fa-solid fa-share-nodes text-base"></i>
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-slate-900 tracking-tight">Share Listing</h2>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Collaborative Client Connect</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                {/* Success screen — client recommendation */}
                {successClient && (
                    <div className="p-8 text-center space-y-6 bg-slate-50/30">
                        <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 mx-auto shadow-inner">
                            <i className="fa-solid fa-check text-2xl"></i>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">Sent to {successClient}!</h3>
                            <p className="text-xs text-slate-500">This property has been added to their collaborative board.</p>
                        </div>
                        {successLink && <LinkBox link={successLink} copied={copied} onCopy={() => copy(successLink, setCopied)} />}
                        <div className="pt-4 border-t border-slate-100 flex justify-end">
                            <button onClick={() => { setSuccessClient(null); setSuccessLink(null); onClose(); }}
                                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95">
                                Done
                            </button>
                        </div>
                    </div>
                )}

                {/* Success screen — public link */}
                {publicLink && !successClient && (
                    <div className="p-8 text-center space-y-6 bg-slate-50/30">
                        <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 mx-auto shadow-inner">
                            <i className="fa-solid fa-link text-2xl"></i>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">Public Link Ready!</h3>
                            <p className="text-xs text-slate-500">Anyone with this link can view the listing board — no login required.</p>
                        </div>
                        <LinkBox link={publicLink} copied={publicCopied} onCopy={() => copy(publicLink, setPublicCopied)} />
                        <div className="pt-4 border-t border-slate-100 flex gap-3 justify-end">
                            <button onClick={() => setPublicLink(null)}
                                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest transition-all">
                                Create Another
                            </button>
                            <button onClick={() => { setPublicLink(null); onClose(); }}
                                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95">
                                Done
                            </button>
                        </div>
                    </div>
                )}

                {/* Main content (hidden during success screens) */}
                {!successClient && !publicLink && (
                    <>
                        {/* Tab switcher */}
                        <div className="px-6 pt-5 pb-0 flex gap-1 border-b border-slate-100">
                            {([['client', 'fa-user', 'Send to Client'], ['public', 'fa-globe', 'Public Link']] as const).map(([tab, icon, label]) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as ModalTab)}
                                    className={`flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-t-xl transition-all border-b-2 ${
                                        activeTab === tab
                                            ? 'border-emerald-500 text-emerald-700 bg-emerald-50/60'
                                            : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <i className={`fa-solid ${icon} text-[10px]`}></i>
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* ── SEND TO CLIENT tab ── */}
                        {activeTab === 'client' && (
                            <div className="p-6 bg-slate-50/30">
                                {loading ? (
                                    <div className="py-12 flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 border-[3px] border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin"></div>
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Fetching client list...</p>
                                    </div>
                                ) : leads.length === 0 ? (
                                    <div className="py-8 text-center space-y-2">
                                        <i className="fa-solid fa-users text-slate-300 text-3xl"></i>
                                        <p className="text-xs text-slate-400 italic">No clients or leads found in your CRM.</p>
                                        <p className="text-[10px] text-slate-400">Add a client in your CRM Dashboard first, or use the <strong>Public Link</strong> tab to share with anyone.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl">
                                            <h4 className="text-[11px] font-bold text-emerald-800">Direct Portal Connection</h4>
                                            <p className="text-[10px] text-emerald-600 mt-0.5 leading-relaxed">
                                                Select a buyer below. Zyphe will auto-generate their portal if they don't have one yet.
                                            </p>
                                        </div>
                                        <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
                                            {leads.map(lead => {
                                                const email = lead.email || '';
                                                const hasPortal = portals.some(p => p.clientEmail?.toLowerCase() === email.toLowerCase() && !p.isPublic);
                                                const isProcessing = processingId === lead.id;
                                                const name = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.name || 'Client';
                                                return (
                                                    <div key={lead.id} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm flex items-center justify-between gap-4 hover:border-slate-200 transition-all">
                                                        <div className="min-w-0">
                                                            <h4 className="text-xs font-bold text-slate-800 truncate">{name}</h4>
                                                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{email || '—'}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {hasPortal && (
                                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-50 text-emerald-600 uppercase border border-emerald-100">Portal Active</span>
                                                            )}
                                                            <button
                                                                onClick={() => handleRecommend(lead)}
                                                                disabled={isProcessing}
                                                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                                                                    hasPortal
                                                                        ? 'bg-slate-800 hover:bg-slate-900 text-white shadow-sm'
                                                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                                                                }`}
                                                            >
                                                                {isProcessing
                                                                    ? <i className="fa-solid fa-spinner animate-spin"></i>
                                                                    : <i className="fa-solid fa-plus"></i>
                                                                }
                                                                {hasPortal ? 'Recommend' : 'Connect & Send'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
                                    <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest transition-all">
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── PUBLIC LINK tab ── */}
                        {activeTab === 'public' && (
                            <div className="p-6 bg-slate-50/30 space-y-5">
                                {/* Explanation banner */}
                                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex gap-3">
                                    <i className="fa-solid fa-globe text-indigo-400 mt-0.5 shrink-0"></i>
                                    <div>
                                        <h4 className="text-[11px] font-bold text-indigo-800">Public Share Link</h4>
                                        <p className="text-[10px] text-indigo-600 mt-0.5 leading-relaxed">
                                            Generate a secure link anyone can open — no account required. Great for open houses, social media posts, or sending to an unregistered prospect.
                                        </p>
                                    </div>
                                </div>

                                {/* Optional label */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        Link Label <span className="text-slate-300 font-normal normal-case">(optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Open House Guests, Instagram Post…"
                                        value={publicLabel}
                                        onChange={e => setPublicLabel(e.target.value)}
                                        maxLength={60}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                                    />
                                </div>

                                {/* Property preview */}
                                <div className="p-3 bg-white border border-slate-100 rounded-xl flex items-center gap-3 shadow-sm">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                        <i className="fa-solid fa-house text-slate-400 text-xs"></i>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Property</p>
                                        <p className="text-xs font-bold text-slate-800 truncate">{address}</p>
                                    </div>
                                </div>

                                {/* Inline error display */}
                                {publicError && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 mt-1">
                                        <i className="fa-solid fa-triangle-exclamation text-red-400 text-xs mt-0.5 shrink-0"></i>
                                        <p className="text-[10px] text-red-600 leading-relaxed font-medium">{publicError}</p>
                                    </div>
                                )}

                                <div className="pt-2 border-t border-slate-100 flex justify-between items-center gap-3">
                                    <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest transition-all">
                                        Close
                                    </button>
                                    <button
                                        onClick={handleCreatePublicLink}
                                        disabled={publicCreating}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-200 active:scale-95"
                                    >
                                        {publicCreating
                                            ? <><i className="fa-solid fa-spinner animate-spin"></i> Creating…</>
                                            : <><i className="fa-solid fa-link"></i> Generate Public Link</>
                                        }
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// ── Shared link display component ──
const LinkBox: React.FC<{ link: string; copied: boolean; onCopy: () => void }> = ({ link, copied, onCopy }) => (
    <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm text-left space-y-2 max-w-md mx-auto">
        <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Shareable Link</span>
        <div className="flex gap-2">
            <input
                type="text"
                readOnly
                value={link}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 font-semibold select-all outline-none"
            />
            <button
                onClick={onCopy}
                className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1 ${
                    copied ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
                <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
                {copied ? 'Copied!' : 'Copy'}
            </button>
        </div>
    </div>
);

export default AddToPortalModal;
