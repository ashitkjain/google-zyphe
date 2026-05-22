import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../services/firebase/config';
import { collection, query, where, getDocs, doc, onSnapshot, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ClientPortal, PortalProperty, PropertyComment } from '../../types/portal';
import { getPortalByToken, updatePropertyStatus, addPropertyComment, subscribeToComments, logActivity } from '../../services/portalService';
import Logo from '../shared/Logo';

interface ClientPortalViewProps {
    token: string;
}

const ClientPortalView: React.FC<ClientPortalViewProps> = ({ token }) => {
    const [portal, setPortal] = useState<ClientPortal | null>(null);
    const [properties, setProperties] = useState<PortalProperty[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Active property for comments/detail drawer
    const [selectedProperty, setSelectedProperty] = useState<PortalProperty | null>(null);
    const [comments, setComments] = useState<PropertyComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [postingComment, setPostingComment] = useState(false);
    const commentEndRef = useRef<HTMLDivElement>(null);

    // Fetch portal metadata & subscribe to properties
    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        const fetchPortal = async () => {
            try {
                const pData = await getPortalByToken(token);
                if (!pData) {
                    if (isMounted) {
                        setError('This property board link has expired or is invalid. Please contact your realtor.');
                        setLoading(false);
                    }
                    return;
                }

                if (isMounted) {
                    setPortal(pData);
                    // Fire-and-forget — never let activity logging crash the portal view
                    logActivity(pData.id, pData.agentId, 'portal_viewed', `${pData.clientName} opened the portal`, undefined)
                        .catch(e => console.warn('[ClientPortalView] logActivity failed (non-blocking):', e));
                }

                // Real-time listener for properties
                const propsQ = collection(db, `client_portals/${pData.id}/portal_properties`);
                const unsubscribeProps = onSnapshot(propsQ, (snap) => {
                    const propsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as PortalProperty));
                    if (isMounted) {
                        setProperties(propsData);
                        setLoading(false);
                    }
                });

                return () => {
                    unsubscribeProps();
                };
            } catch (err: any) {
                console.error('[ClientPortalView] fetchPortal error:', err?.code, err?.message, err);
                if (isMounted) {
                    setError(`Unable to load your custom property board. Error: ${err?.code || err?.message || 'unknown'}`);
                    setLoading(false);
                }
            }
        };

        fetchPortal();

        return () => {
            isMounted = false;
        };
    }, [token]);

    // Real-time listener for selected property comments
    useEffect(() => {
        if (!portal || !selectedProperty) {
            setComments([]);
            return;
        }

        const unsubscribe = subscribeToComments(portal.id, selectedProperty.zpid, (newComments) => {
            setComments(newComments);
            // Scroll to bottom
            setTimeout(() => {
                commentEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });

        return () => unsubscribe();
    }, [portal, selectedProperty]);

    const handleStatusChange = async (property: PortalProperty, status: PortalProperty['status']) => {
        if (!portal) return;
        try {
            await updatePropertyStatus(portal.id, property.zpid, property.address, status, 'client');
        } catch (err) {
            console.error(err);
            alert('Failed to update property status.');
        }
    };

    const handlePostComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!portal || !selectedProperty || !newComment.trim()) return;

        setPostingComment(true);
        try {
            await addPropertyComment(
                portal.id,
                selectedProperty.zpid,
                'client',
                portal.clientName,
                newComment
            );
            setNewComment('');
        } catch (err) {
            console.error(err);
            alert('Failed to send comment.');
        } finally {
            setPostingComment(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 min-h-screen">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <Logo size={64} className="opacity-80" />
                    <div className="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Assembling Property Board...</p>
                </div>
            </div>
        );
    }

    if (error || !portal) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 min-h-screen px-4 text-center">
                <div className="max-w-md p-8 bg-white border border-slate-200 rounded-3xl shadow-xl space-y-6">
                    <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto">
                        <i className="fa-solid fa-triangle-exclamation text-2xl animate-bounce"></i>
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Board Not Found</h2>
                    <p className="text-slate-500 font-medium text-sm leading-relaxed">
                        {error || 'This property board link has expired or is invalid.'}
                    </p>
                    <div className="pt-2">
                        <a href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-95">
                            Go to Homepage
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    // Filter properties by status buckets
    const favorited = properties.filter(p => p.status === 'favorite');
    const maybe = properties.filter(p => p.status === 'maybe');
    const suggested = properties.filter(p => p.status === 'suggested_by_agent');
    const rejected = properties.filter(p => p.status === 'rejected');

    return (
        <div className="flex-1 flex flex-col bg-[#f8fafc] min-h-screen relative overflow-hidden">
            {/* Top decorative glass ball */}
            <div className="absolute top-0 right-0 w-[40vw] h-[40vw] bg-gradient-to-br from-indigo-200/40 to-emerald-200/30 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>

            {/* Navigation Header */}
            <header className="sticky top-0 z-[40] bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-6 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Logo size={36} />
                    <div className="h-5 w-px bg-slate-200"></div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.25em]">Client Connect</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-[8px] font-black uppercase text-indigo-500 tracking-widest">Shared Board</span>
                        {portal.clientName !== 'Public Viewer' && (
                            <span className="text-xs font-bold text-slate-700">{portal.clientName}</span>
                        )}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-md">
                        {portal.clientName === 'Public Viewer' ? <i className="fa-solid fa-user text-[10px]"></i> : portal.clientName.charAt(0)}
                    </div>
                </div>
            </header>

            {/* Welcome banner */}
            <section className="max-w-7xl mx-auto w-full px-6 pt-8 pb-4">
                <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-[2rem] p-8 md:p-10 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center gap-8 border border-white/10">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.25),transparent)]"></div>
                    <div className="relative flex-1 space-y-3">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full backdrop-blur-sm border border-white/5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300">Workspace Active</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-none">
                            {portal.clientName === 'Public Viewer' ? 'Welcome!' : `Welcome, ${portal.clientName}!`}
                        </h1>
                        <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
                            {portal.welcomeMessage}
                        </p>
                    </div>
                    <div className="relative shrink-0 w-full md:w-auto p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                                <i className="fa-solid fa-briefcase text-indigo-300 text-lg"></i>
                            </div>
                            <div>
                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Realtor Workspace</div>
                                <div className="text-xs font-bold text-white mt-0.5">Real-time Bidirectional Synced</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Main Content: Drag-n-drop or Bucket style views */}
            <main className="max-w-7xl mx-auto w-full px-6 pb-16 flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* suggested bucket */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Suggested ({suggested.length})</h3>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {suggested.length === 0 ? (
                            <div className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
                                <p className="text-xs text-slate-400 italic">No new suggestions. Check back later!</p>
                            </div>
                        ) : (
                            suggested.map((p) => <PropertyCard key={p.zpid} property={p} onStatusChange={handleStatusChange} onOpenComments={setSelectedProperty} portalToken={token} />)
                        )}
                    </div>
                </div>

                {/* favorite bucket */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Favorites ({favorited.length})</h3>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {favorited.length === 0 ? (
                            <div className="p-8 text-center bg-white border border-slate-100 rounded-2xl shadow-sm">
                                <p className="text-xs text-slate-400 italic">Click the heart to save your favorites!</p>
                            </div>
                        ) : (
                            favorited.map((p) => <PropertyCard key={p.zpid} property={p} onStatusChange={handleStatusChange} onOpenComments={setSelectedProperty} portalToken={token} />)
                        )}
                    </div>
                </div>

                {/* maybe bucket */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Interested / Maybe ({maybe.length})</h3>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {maybe.length === 0 ? (
                            <div className="p-8 text-center bg-white border border-slate-100 rounded-2xl shadow-sm">
                                <p className="text-xs text-slate-400 italic">Click the star for listings you're considering.</p>
                            </div>
                        ) : (
                            maybe.map((p) => <PropertyCard key={p.zpid} property={p} onStatusChange={handleStatusChange} onOpenComments={setSelectedProperty} portalToken={token} />)
                        )}
                    </div>
                </div>

                {/* rejected bucket */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Archived ({rejected.length})</h3>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {rejected.length === 0 ? (
                            <div className="p-8 text-center bg-slate-100/50 rounded-2xl border border-slate-200/50">
                                <p className="text-xs text-slate-400 italic">No archived listings.</p>
                            </div>
                        ) : (
                            rejected.map((p) => <PropertyCard key={p.zpid} property={p} onStatusChange={handleStatusChange} onOpenComments={setSelectedProperty} portalToken={token} />)
                        )}
                    </div>
                </div>
            </main>

            {/* Real-time Comments Overlay Drawer */}
            {selectedProperty && (
                <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
                        {/* Drawer Header */}
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 truncate max-w-[280px]">{selectedProperty.address}</h3>
                                <p className="text-[8px] font-black uppercase text-indigo-500 tracking-wider mt-0.5">Real-time Realtor Chat</p>
                            </div>
                            <button
                                onClick={() => setSelectedProperty(null)}
                                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center shadow-sm"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        {/* Comments List */}
                        <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-4 bg-slate-50/50">
                            {comments.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                                    <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-400">
                                        <i className="fa-solid fa-comments text-lg"></i>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-800">No comments yet</h4>
                                        <p className="text-[10px] text-slate-400 max-w-[200px] mt-1 leading-snug">Ask your realtor about this home's layout, price, or potential!</p>
                                    </div>
                                </div>
                            ) : (
                                comments.map((c) => {
                                    const isMe = c.authorRole === 'client';
                                    return (
                                        <div key={c.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                            <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider mb-1">{c.authorName}</span>
                                            <div className={`p-3.5 rounded-2xl max-w-[85%] text-xs font-medium leading-relaxed shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'}`}>
                                                {c.text}
                                            </div>
                                            <span className="text-[8px] text-slate-400 mt-1">
                                                {c.timestamp ? new Date(c.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={commentEndRef} />
                        </div>

                        {/* Comment Input */}
                        <form onSubmit={handlePostComment} className="p-4 border-t border-slate-100 bg-white flex gap-2">
                            <input
                                type="text"
                                placeholder="Type a message to your realtor..."
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                            <button
                                type="submit"
                                disabled={postingComment || !newComment.trim()}
                                className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white flex items-center justify-center shadow-md active:scale-95 transition-all"
                            >
                                <i className="fa-solid fa-paper-plane text-xs"></i>
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

interface PropertyCardProps {
    property: PortalProperty;
    onStatusChange: (property: PortalProperty, status: PortalProperty['status']) => void;
    onOpenComments: (property: PortalProperty) => void;
    portalToken?: string;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property, onStatusChange, onOpenComments, portalToken }) => {
    const { status } = property;
    const listingHref = portalToken
        ? `/?zpid=${property.zpid}&portalToken=${portalToken}`
        : (property.listingUrl || `https://www.zillow.com/homes/${property.zpid}_zpid/`);

    const formatPrice = (p?: number) =>
        p ? `$${p >= 1_000_000 ? (p / 1_000_000).toFixed(1) + 'M' : (p / 1000).toFixed(0) + 'K'}` : null;

    return (
        <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 relative group flex flex-col">

            {/* ── Clickable hero image ── */}
            <a
                href={listingHref}
                target="_blank"
                rel="noopener noreferrer"
                className="relative aspect-video w-full block overflow-hidden bg-slate-100 cursor-pointer"
                title="View listing"
            >
                {property.thumbnailUrl ? (
                    <img
                        src={property.thumbnailUrl}
                        alt={property.address}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <i className="fa-solid fa-house text-4xl text-slate-300"></i>
                    </div>
                )}

                {/* Gradient overlay with address */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent flex flex-col justify-end p-3">
                    <h4 className="text-white text-xs font-bold truncate leading-tight">{property.address}</h4>
                    {/* Price + stats row */}
                    <div className="flex items-center gap-2 mt-1">
                        {formatPrice(property.price) && (
                            <span className="text-emerald-300 font-black text-[11px]">{formatPrice(property.price)}</span>
                        )}
                        {property.beds && <span className="text-white/70 text-[9px]">{property.beds} bd</span>}
                        {property.baths && <span className="text-white/70 text-[9px]">{property.baths} ba</span>}
                    </div>
                </div>

                {/* View listing pill — appears on hover */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <span className="flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[9px] font-black text-slate-700 shadow-sm">
                        <i className="fa-solid fa-arrow-up-right-from-square text-[8px]"></i>
                        View
                    </span>
                </div>
            </a>

            {/* ── Actions row ── */}
            <div className="px-3 py-3 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => onStatusChange(property, 'favorite')}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${status === 'favorite' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-50 text-slate-400 hover:text-rose-500'}`}
                        title="Favorite"
                    >
                        <i className="fa-solid fa-heart text-xs"></i>
                    </button>
                    <button
                        onClick={() => onStatusChange(property, 'maybe')}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${status === 'maybe' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-50 text-slate-400 hover:text-amber-500'}`}
                        title="Interested / Maybe"
                    >
                        <i className="fa-solid fa-star text-xs"></i>
                    </button>
                    <button
                        onClick={() => onStatusChange(property, 'rejected')}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${status === 'rejected' ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
                        title="Not for Me / Archive"
                    >
                        <i className="fa-solid fa-box-archive text-xs"></i>
                    </button>
                </div>

                <button
                    onClick={() => onOpenComments(property)}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                >
                    <i className="fa-solid fa-comments text-[9px]"></i>
                    Discuss
                </button>
            </div>
        </div>
    );
};

export default ClientPortalView;
