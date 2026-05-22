import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase/config';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { ClientPortal, PortalProperty, ActivityLog } from '../../types/portal';
import { createClientPortal, updatePropertyStatus, logActivity } from '../../services/portalService';

interface ClientPortalModalProps {
    client: any;
    agentId: string;
    isOpen: boolean;
    onClose: () => void;
}

const ClientPortalModal: React.FC<ClientPortalModalProps> = ({ client, agentId, isOpen, onClose }) => {
    const [portal, setPortal] = useState<ClientPortal | null>(null);
    const [properties, setProperties] = useState<PortalProperty[]>([]);
    const [activity, setActivity] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [generating, setGenerating] = useState(false);
    const [welcomeMessage, setWelcomeMessage] = useState('Welcome to your custom property portal! Here you can favorite houses, leave comments, and communicate directly with me.');
    const [copied, setCopied] = useState(false);
    
    const [newZpid, setNewZpid] = useState('');
    const [newAddress, setNewAddress] = useState('');

    useEffect(() => {
        if (!isOpen || !client) return;

        setLoading(true);
        const email = client.email || client.primaryContact?.email || '';
        const q = query(
            collection(db, 'client_portals'), 
            where('clientEmail', '==', email),
            where('agentId', '==', agentId)
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            if (snapshot.empty) {
                setPortal(null);
                setProperties([]);
                setActivity([]);
                setLoading(false);
                return;
            }

            const pData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ClientPortal;
            setPortal(pData);

            // Subscribe to properties
            const propsQ = collection(db, `client_portals/${pData.id}/portal_properties`);
            const propsUnsub = onSnapshot(propsQ, (propsSnap) => {
                const propsData = propsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PortalProperty));
                setProperties(propsData);
            });

            // Fetch activity logs
            const actQ = query(
                collection(db, 'activity_logs'), 
                where('portalId', '==', pData.id)
            );
            const actUnsub = onSnapshot(actQ, (actSnap) => {
                const actData = actSnap.docs
                    .map(d => ({ id: d.id, ...d.data() } as ActivityLog))
                    .sort((a, b) => {
                        const tA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
                        const tB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
                        return tB - tA;
                    });
                setActivity(actData);
            });

            setLoading(false);

            return () => {
                propsUnsub();
                actUnsub();
            };
        });

        return () => unsubscribe();
    }, [isOpen, client, agentId]);

    const handleCreatePortal = async () => {
        if (!client) return;
        setGenerating(true);
        try {
            const email = client.email || client.primaryContact?.email || '';
            const name = `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.name || 'Client';
            
            await createClientPortal(agentId, name, email, welcomeMessage);
        } catch (e) {
            console.error(e);
            alert('Failed to generate client portal.');
        } finally {
            setGenerating(false);
        }
    };

    const handleCopyLink = () => {
        if (!portal) return;
        const link = `${window.location.origin}/portal/${portal.accessToken}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleAddProperty = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!portal || !newZpid || !newAddress) return;

        try {
            await updatePropertyStatus(portal.id, newZpid, newAddress, 'suggested_by_agent', 'agent');
            setNewZpid('');
            setNewAddress('');
        } catch (err) {
            console.error(err);
            alert('Failed to add property to portal.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 h-[75vh] flex flex-col">
                {/* Header */}
                <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
                            <i className="fa-solid fa-globe text-lg"></i>
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">Collaborative Client Connect</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Manage Paragon-style portal for {client ? `${client.firstName || ''} ${client.lastName || ''}` : 'client'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-10 h-10 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin"></div>
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Syncing workspace...</p>
                        </div>
                    </div>
                ) : !portal ? (
                    /* Initial Portal State: Create */
                    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar flex flex-col justify-between bg-slate-50/30">
                        <div className="space-y-6">
                            <div className="p-6 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl">
                                <h3 className="text-sm font-bold text-emerald-800 mb-1">Create a Shared Property Board</h3>
                                <p className="text-xs text-emerald-600 leading-relaxed">
                                    Generate a secure, private dashboard link for {client.firstName}. They'll be able to see properties you recommend, bucket them into **Favorites**, **Maybe**, or **Rejected**, and leave real-time feedback.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Welcome Message to Client</label>
                                <textarea
                                    rows={4}
                                    value={welcomeMessage}
                                    onChange={(e) => setWelcomeMessage(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none shadow-sm"
                                    placeholder="Write a greeting..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all"
                            >
                                Close
                            </button>
                            <button
                                onClick={handleCreatePortal}
                                disabled={generating}
                                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:shadow-xl transition-all flex items-center gap-2"
                            >
                                {generating ? (
                                    <>
                                        <i className="fa-solid fa-circle-notch animate-spin"></i> Generating...
                                    </>
                                ) : (
                                    <>Generate Shareable Portal</>
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Active Portal State */
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50/30">
                        {/* Left half: Link & Activity */}
                        <div className="flex-1 p-6 border-r border-slate-100 flex flex-col justify-between overflow-y-auto custom-scrollbar">
                            <div className="space-y-6">
                                <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Active Workspace Link</span>
                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-500 text-white uppercase">Live</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={`${window.location.origin}/portal/${portal.accessToken}`}
                                            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600 font-medium select-all shadow-inner focus:ring-0 outline-none"
                                        />
                                        <button
                                            onClick={handleCopyLink}
                                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 ${copied ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
                                            {copied ? 'Copied' : 'Copy'}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Client Activity Feed</h3>
                                    <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                                        {activity.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic">No activity yet. Share the link with {client.firstName} to begin!</p>
                                        ) : (
                                            activity.map((act) => (
                                                <div key={act.id} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm flex items-start gap-2.5">
                                                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                                        <i className={`fa-solid text-[9px] ${
                                                            act.action === 'portal_viewed' ? 'fa-eye text-sky-500' :
                                                            act.action === 'status_changed' ? 'fa-heart-circle-check text-rose-500' :
                                                            act.action === 'commented' ? 'fa-comment text-emerald-500' : 'fa-bolt text-slate-400'
                                                        }`}></i>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] text-slate-700 font-semibold leading-snug">{act.details}</p>
                                                        {act.zpid && (
                                                            <p className="text-[8px] text-slate-400 font-black uppercase tracking-wider mt-0.5">ZPID: {act.zpid}</p>
                                                        )}
                                                    </div>
                                                    <span className="text-[8px] text-slate-400 font-medium whitespace-nowrap shrink-0">
                                                        {act.timestamp ? new Date(act.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex justify-end">
                                <button
                                    onClick={onClose}
                                    className="px-5 py-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700"
                                >
                                    Close Window
                                </button>
                            </div>
                        </div>

                        {/* Right half: Curated/Suggested Properties */}
                        <div className="w-full md:w-80 p-6 bg-slate-50 border-t md:border-t-0 md:border-l border-slate-100 flex flex-col justify-between overflow-y-auto custom-scrollbar">
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Add a Property</h3>
                                    <form onSubmit={handleAddProperty} className="space-y-3">
                                        <input
                                            type="text"
                                            placeholder="Zillow ZPID (e.g. 20986754)"
                                            required
                                            value={newZpid}
                                            onChange={(e) => setNewZpid(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Property Address"
                                            required
                                            value={newAddress}
                                            onChange={(e) => setNewAddress(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm"
                                        />
                                        <button
                                            type="submit"
                                            className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                                        >
                                            <i className="fa-solid fa-plus text-[9px]"></i> Recommend Listing
                                        </button>
                                    </form>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Recommended ({properties.length})</h3>
                                    </div>
                                    <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                                        {properties.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic">No listings added yet. Start recommending above!</p>
                                        ) : (
                                            properties.map((p) => (
                                                <div key={p.zpid} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <h4 className="text-[11px] font-bold text-slate-800 truncate leading-snug">{p.address}</h4>
                                                        <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded mt-1 inline-block ${
                                                            p.status === 'favorite' ? 'bg-rose-50 text-rose-600' :
                                                            p.status === 'maybe' ? 'bg-amber-50 text-amber-600' :
                                                            p.status === 'rejected' ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-600'
                                                        }`}>
                                                            {p.status.replace(/_/g, ' ')}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientPortalModal;
