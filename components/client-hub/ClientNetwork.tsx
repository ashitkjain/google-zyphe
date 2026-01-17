import React, { useState, useEffect } from 'react';
import { UserProfile, Lead, ShortlistedProperty, ActivityEvent } from '../../types';
import { LEAD_FIELD_CONFIG } from '../../types/lead';

interface ClientNetworkProps {
    clients: UserProfile[];
    manualContacts: Lead[];
    selectedClient: UserProfile | Lead | null;
    setSelectedClient: (client: UserProfile | Lead | null) => void;
    onUpdateKYC: (updates: any) => void;
    clientActivity: { favorites: any[], views: any[] };
    loadingClients: boolean;
    loadingActivity: boolean;
}

const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const ClientNetwork: React.FC<ClientNetworkProps> = ({
    clients,
    manualContacts,
    selectedClient,
    setSelectedClient,
    onUpdateKYC,
    clientActivity,
    loadingClients,
    loadingActivity
}) => {
    const [networkTab, setNetworkTab] = useState<'on-zyphe' | 'off-zyphe'>('on-zyphe');
    const [searchTerm, setSearchTerm] = useState('');

    // Manual Entry States
    const [activeForm, setActiveForm] = useState<'property' | 'activity' | null>(null);
    const [editingProperty, setEditingProperty] = useState<ShortlistedProperty | null>(null);
    const [editingActivity, setEditingActivity] = useState<ActivityEvent | null>(null);

    // Type Helper
    const isUser = (c: UserProfile | Lead | null): c is UserProfile => !!c && 'uid' in c;
    const getId = (c: UserProfile | Lead | null) => {
        if (!c) return '';
        return isUser(c) ? c.uid : (c as Lead).id;
    };
    const getName = (c: UserProfile | Lead | null) => {
        if (!c) return '';
        if (isUser(c)) return c.displayName;
        const l = c as Lead;
        return `${l.firstName} ${l.lastName}`.trim();
    };
    const getRole = (c: UserProfile | Lead | null) => {
        if (!c) return '';
        return isUser(c) ? c.role : ((c as Lead).leadType || 'Lead');
    };
    const getEmail = (c: UserProfile | Lead | null) => c?.email || '';
    const getPhone = (c: UserProfile | Lead | null) => {
        if (!c) return '';
        return isUser(c) ? c.phoneNumber : (c as Lead).phone;
    };

    const displayList = (networkTab === 'on-zyphe' ? clients : manualContacts).filter(client => {
        // Stage Filter for Off Zyphe
        if (!isUser(client)) {
            const lead = client as Lead;
            const validStages = ['Nurture', 'Active Search', 'Offer', 'Contract', 'Closed'];
            if (!validStages.includes(lead.funnelStage)) return false;
        }

        if (!searchTerm) return true;
        const name = (isUser(client) ? client.displayName : `${(client as Lead).firstName} ${(client as Lead).lastName}`).toLowerCase();
        const email = (client.email || '').toLowerCase();
        const term = searchTerm.toLowerCase();
        return name.includes(term) || email.includes(term);
    });

    // Auto-select logic when list changes
    useEffect(() => {
        const currentlySelectedId = getId(selectedClient);
        const stillInList = currentlySelectedId && displayList.some(c => getId(c) === currentlySelectedId);

        if (!stillInList) {
            if (displayList.length > 0) {
                setSelectedClient(displayList[0]);
            } else {
                setSelectedClient(null);
            }
        }
    }, [displayList]);

    // Mock Data for Leads to match User consistency
    const getViews = (client: UserProfile | Lead | null) => {
        if (!client) return [];

        // Priority 1: Manual entries
        if (client.kyc?.activityFeed && client.kyc.activityFeed.length > 0) {
            return client.kyc.activityFeed;
        }

        // Priority 2: Automated/Mock entries
        if (isUser(client)) {
            return clientActivity.views.map(v => ({
                id: v.zpid || `view_${v.timestamp}`,
                address: v.address,
                timestamp: v.timestamp,
                viewCount: v.viewCount,
                type: 'Property View' as const
            }));
        } else {
            const lead = client as Lead;
            const idNum = parseInt(lead.id.replace(/\D/g, '') || '0') || 7;
            const views = [];
            if (lead.propertyAddress) {
                views.push({
                    id: 'mock_1',
                    address: lead.propertyAddress,
                    timestamp: lead.receivedAt,
                    viewCount: (idNum % 5) + 1,
                    type: 'Property View' as const
                });
            }
            views.push({
                id: 'mock_2',
                address: `${lead.source} Discovery Event`,
                timestamp: lead.receivedAt,
                viewCount: 1,
                type: 'Other' as const
            });
            return views;
        }
    };

    const getFavorites = (client: UserProfile | Lead | null) => {
        if (!client) return [];

        // Priority 1: Manual entries
        if (client.kyc?.shortlist && client.kyc.shortlist.length > 0) {
            return client.kyc.shortlist;
        }

        // Priority 2: Automated/Mock entries
        if (isUser(client)) {
            return clientActivity.favorites.map(f => ({
                id: f.zpid || `fav_${f.timestamp}`,
                address: f.address,
                price: f.price,
                isHot: true
            }));
        } else {
            const lead = client as Lead;
            if (lead.propertyAddress) {
                return [{
                    id: 'mock_fav',
                    address: lead.propertyAddress,
                    price: lead.price || lead.minPrice || 0,
                    isHot: true
                }];
            }
        }
        return [];
    };

    const handleSaveProperty = (prop: Partial<ShortlistedProperty>) => {
        if (!selectedClient) return;
        const currentShortlist = selectedClient.kyc?.shortlist || [];
        let newList;

        if (editingProperty) {
            newList = currentShortlist.map(p => p.id === editingProperty.id ? { ...p, ...prop } : p);
        } else {
            newList = [...currentShortlist, { ...prop, id: `prop_${Date.now()}` } as ShortlistedProperty];
        }

        onUpdateKYC({ kyc: { ...selectedClient.kyc, shortlist: newList } });
        setActiveForm(null);
        setEditingProperty(null);
    };

    const handleDeleteProperty = (id: string) => {
        if (!selectedClient) return;
        const newList = (selectedClient.kyc?.shortlist || []).filter(p => p.id !== id);
        onUpdateKYC({ kyc: { ...selectedClient.kyc, shortlist: newList } });
        setActiveForm(null);
        setEditingProperty(null);
    };

    const handleSaveActivity = (event: Partial<ActivityEvent>) => {
        if (!selectedClient) return;
        const currentFeed = selectedClient.kyc?.activityFeed || [];
        let newList;

        if (editingActivity) {
            newList = currentFeed.map(a => a.id === editingActivity.id ? { ...a, ...event } : a);
        } else {
            newList = [...currentFeed, { ...event, id: `act_${Date.now()}`, timestamp: new Date() } as ActivityEvent];
        }

        onUpdateKYC({ kyc: { ...selectedClient.kyc, activityFeed: newList } });
        setActiveForm(null);
        setEditingActivity(null);
    };

    const handleDeleteActivity = (id: string) => {
        if (!selectedClient) return;
        const newList = (selectedClient.kyc?.activityFeed || []).filter(a => a.id !== id);
        onUpdateKYC({ kyc: { ...selectedClient.kyc, activityFeed: newList } });
        setActiveForm(null);
        setEditingActivity(null);
    };

    return (
        <div className="flex flex-1 h-full overflow-hidden w-full">
            {/* Sidebar Section */}
            <div className="w-96 bg-white border-r border-slate-200 flex flex-col h-full shadow-2xl relative z-40 shrink-0">
                <div className="p-8 border-b border-slate-100 space-y-6">
                    <div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <i className="fa-solid fa-users text-indigo-500"></i>
                            Your Network
                        </h3>
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button
                                onClick={() => setNetworkTab('on-zyphe')}
                                className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${networkTab === 'on-zyphe' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                On Zyphe
                            </button>
                            <button
                                onClick={() => setNetworkTab('off-zyphe')}
                                className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${networkTab === 'off-zyphe' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Off Zyphe
                            </button>
                        </div>
                    </div>

                    <div className="relative group">
                        <input
                            type="text"
                            placeholder="Search network..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-2xl outline-none text-xs font-semibold transition-all shadow-inner"
                        />
                        <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-indigo-500"></i>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loadingClients && networkTab === 'on-zyphe' ? (
                        <div className="p-12 text-center text-slate-200">
                            <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
                        </div>
                    ) : displayList.length === 0 ? (
                        <div className="p-8 text-center">
                            <p className="text-xs text-slate-400 font-medium">No contacts found.</p>
                        </div>
                    ) : displayList.map((client) => {
                        const id = getId(client);
                        const isSelected = getId(selectedClient) === id;

                        return (
                            <button
                                key={id}
                                onClick={() => setSelectedClient(client)}
                                className={`w-full text-left p-5 rounded-[2rem] transition-all relative group ${isSelected
                                    ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-200 translate-x-1'
                                    : 'hover:bg-slate-50 text-slate-600 hover:translate-x-1'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${isSelected ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                                        {getName(client)?.[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-900 text-sm truncate leading-tight mb-0.5">{getName(client)}</div>
                                        <div className={`text-[12px] uppercase font-black tracking-widest ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>
                                            {getRole(client)} • {isUser(client) ? 'Active' : (client as Lead).status}
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <div className="w-2 h-2 rounded-full bg-white animate-pulse shadow-lg shadow-white/50"></div>
                                    )}
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F8FAFC] min-w-0">
                {selectedClient ? (
                    <>
                        {/* Detail Header */}
                        <div className="p-10 bg-white border-b border-slate-200/60 shadow-sm relative z-10 flex items-center justify-between">
                            <div className="flex items-center gap-8">
                                <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center text-3xl font-black text-indigo-600 shadow-xl shadow-indigo-100 border border-indigo-100/50">
                                    {getName(selectedClient)?.[0]}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">{getName(selectedClient)}</h2>
                                        <button
                                            onClick={() => (window as any).dispatchKYCEvent?.(selectedClient)}
                                            className="group px-8 py-2.5 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] transition-all border border-indigo-100/50 shadow-sm flex items-center gap-3"
                                        >
                                            <div className="relative flex items-center justify-center w-6 h-6">
                                                <i className="fa-solid fa-file-lines text-indigo-400 group-hover:scale-110 transition-transform"></i>
                                                <i className="fa-solid fa-paperclip absolute -top-1.5 -right-1.5 text-[10px] text-indigo-600/60 -rotate-12 group-hover:rotate-0 transition-transform"></i>
                                            </div>
                                            KYC FORM
                                        </button>
                                        <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200">
                                            {getRole(selectedClient)}
                                        </span>
                                        {!isUser(selectedClient) && (
                                            <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[9px] font-black uppercase tracking-widest">
                                                Manual Lead
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 mt-3">
                                        <span className="text-slate-500 font-medium text-sm flex items-center gap-2">
                                            <i className="fa-solid fa-envelope text-indigo-400"></i> {getEmail(selectedClient)}
                                        </span>
                                        <span className="text-slate-200">|</span>
                                        <span className="text-slate-500 font-medium text-sm flex items-center gap-2">
                                            <i className="fa-solid fa-phone text-indigo-400"></i> {getPhone(selectedClient) || 'No phone'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button className="px-6 py-4 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center transition-all hover:border-indigo-500 group shadow-sm">
                                    <span className="text-2xl font-black text-indigo-600 group-hover:scale-110 transition-transform">
                                        {getFavorites(selectedClient).length}
                                    </span>
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Favorites</span>
                                </button>
                                <button className="px-6 py-4 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center transition-all hover:border-indigo-500 group shadow-sm">
                                    <span className="text-2xl font-black text-indigo-600 group-hover:scale-110 transition-transform">
                                        {getViews(selectedClient).reduce((acc: number, curr: any) => acc + (curr.viewCount || 1), 0)}
                                    </span>
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Total Hits</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 lg:p-6 xl:p-10">
                            {/* Premium AI Persona Section */}
                            <div className="bg-indigo-900 rounded-[3rem] p-10 mb-10 text-white relative overflow-hidden shadow-2xl">
                                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                                <div className="relative z-10 flex items-center justify-between">
                                    <div className="space-y-5 max-w-2xl">
                                        <div className="flex items-center gap-3">
                                            <div className="px-3 py-1 bg-amber-500 text-slate-900 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20">
                                                AI Intelligence Active
                                            </div>
                                            <h3 className="text-2xl font-black tracking-tight">
                                                {isUser(selectedClient) ? 'Modern Luxury Seeker' : 'High-Intent Prospect'}
                                            </h3>
                                        </div>
                                        {isUser(selectedClient) ? (
                                            <p className="text-indigo-100 text-lg leading-relaxed font-medium">
                                                Based on {selectedClient.displayName}'s behavior, they are focusing on <span className="font-bold text-white">expansive open floor plans</span> and <span className="font-bold text-white">smart home ecosystems</span>. They typically view properties in the <span className="font-bold text-amber-400">$800k-$1.2M range</span>.
                                            </p>
                                        ) : (
                                            <p className="text-indigo-100 text-lg leading-relaxed font-medium">
                                                <strong>{getName(selectedClient)}</strong> is a <strong>{(selectedClient as Lead).leadType}</strong> currently in the <strong>{(selectedClient as Lead).funnelStage}</strong> stage.
                                                {(selectedClient as Lead).isHot && <span className="text-amber-400 font-bold"> This is a Hot Lead.</span>}
                                                {(selectedClient as Lead).isWarm && <span className="text-amber-200 font-bold"> This is a Warm Lead.</span>}
                                                {' '}
                                                Targeting <strong>{(selectedClient as Lead).inquiryProperty?.minPrice ? `$${((selectedClient as Lead).inquiryProperty?.minPrice! / 1000).toFixed(0)}k` : 'market price'}</strong>
                                                {' - '}
                                                <strong>{(selectedClient as Lead).inquiryProperty?.maxPrice ? `$${((selectedClient as Lead).inquiryProperty?.maxPrice! / 1000).toFixed(0)}k` : 'any range'}</strong>.
                                                {((selectedClient as Lead).offers?.length || 0) > 0 ? ` Has made ${(selectedClient as Lead).offers?.length} offer(s) so far.` : ' No offers made yet.'}
                                                {(selectedClient as Lead).timeframe ? ` Looking to close by: ${(selectedClient as Lead).timeframe}.` : ''}
                                                {(selectedClient as Lead).generalInfo ? ` Note: ${(selectedClient as Lead).generalInfo}` : ''}
                                            </p>
                                        )}
                                        <div className="flex gap-3 pt-2">
                                            {isUser(selectedClient) ? (
                                                ['Modern Design', 'Eco-Home', 'High Walkscore'].map((tag, i) => (
                                                    <span key={i} className="px-5 py-2.5 bg-white/10 rounded-2xl text-[11px] font-black uppercase border border-white/10">{tag}</span>
                                                ))
                                            ) : (
                                                <>
                                                    <span className="px-5 py-2.5 bg-white/10 rounded-2xl text-[11px] font-black uppercase border border-white/10">Channel: {(selectedClient as Lead).source}</span>
                                                    <span className="px-5 py-2.5 bg-white/10 rounded-2xl text-[11px] font-black uppercase border border-white/10">Stage: {(selectedClient as Lead).funnelStage}</span>
                                                    <span className="px-5 py-2.5 bg-white/10 rounded-2xl text-[11px] font-black uppercase border border-white/10">Health: {(selectedClient as Lead).health}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-6xl font-black text-amber-500 tracking-tighter">
                                            {isUser(selectedClient) ? '88%' : (selectedClient as Lead).health === 'Active' ? '92%' : '76%'}
                                        </div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mt-2">Conversion Sc.</div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8 w-full min-w-0">
                                {/* Top Interests (Property Shortlist) */}
                                <div className="space-y-6 min-w-0 flex flex-col">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900 flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                            Property Shortlist
                                        </h3>
                                        <div className="flex items-center gap-4">
                                            <button className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:underline">Export</button>
                                            <button
                                                onClick={() => setActiveForm('property')}
                                                className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100/50"
                                            >
                                                <i className="fa-solid fa-plus text-[10px]"></i>
                                            </button>
                                        </div>
                                    </div>

                                    {getFavorites(selectedClient).length === 0 ? (
                                        <div className="bg-white rounded-[2rem] p-16 text-center shadow-sm border border-slate-100">
                                            <p className="text-slate-400 font-medium">No archived favorites.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-5">
                                            {getFavorites(selectedClient).map((fav, i) => (
                                                <div
                                                    key={i}
                                                    onDoubleClick={() => {
                                                        setEditingProperty(fav);
                                                        setActiveForm('property');
                                                    }}
                                                    className="bg-white p-4 lg:p-6 rounded-[2rem] lg:rounded-[2.5rem] border border-slate-200/60 shadow-sm hover:shadow-xl transition-all flex items-center gap-4 lg:gap-6 group cursor-pointer relative min-w-0"
                                                >
                                                    <div className="w-16 h-16 lg:w-20 lg:h-20 xl:w-24 xl:h-24 rounded-[1.2rem] lg:rounded-[1.5rem] bg-indigo-50 shrink-0 overflow-hidden relative border border-slate-100">
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                                                        <i className="fa-solid fa-house-circle-check text-indigo-200 text-xl lg:text-2xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></i>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-slate-900 text-sm lg:text-base truncate">{fav.address}</h4>
                                                        <div className="flex items-center gap-2 lg:gap-4 mt-1 lg:mt-2 flex-wrap">
                                                            <span className="text-xl lg:text-2xl font-black text-emerald-600">${fav.price?.toLocaleString() || '---'}</span>
                                                            {fav.isHot && <span className="px-2 py-0.5 bg-rose-50 text-rose-500 rounded-lg text-[10px] lg:text-[12px] font-black uppercase tracking-widest border border-rose-100">Hot</span>}
                                                        </div>
                                                    </div>
                                                    <button className="w-10 h-10 lg:w-12 lg:h-12 xl:w-14 xl:h-14 rounded-2xl lg:rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shrink-0">
                                                        <i className="fa-solid fa-up-right-from-square text-[10px]"></i>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Engagement Stream (Live Activity Feed) */}
                                <div className="space-y-6 min-w-0 flex flex-col">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900 flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                            Live Activity Feed
                                        </h3>
                                        <div className="flex items-center gap-4">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                {getViews(selectedClient).length} Events
                                            </span>
                                            <button
                                                onClick={() => setActiveForm('activity')}
                                                className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100/50"
                                            >
                                                <i className="fa-solid fa-plus text-[10px]"></i>
                                            </button>
                                        </div>
                                    </div>

                                    {getViews(selectedClient).length === 0 ? (
                                        <div className="bg-white rounded-[2rem] p-16 text-center shadow-sm border border-slate-100">
                                            <p className="text-slate-400 font-medium">No activity recorded yet.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {getViews(selectedClient).map((view, i) => (
                                                <div
                                                    key={i}
                                                    onDoubleClick={() => {
                                                        setEditingActivity(view);
                                                        setActiveForm('activity');
                                                    }}
                                                    className="bg-white p-4 lg:p-6 rounded-[2rem] lg:rounded-[2.5rem] border border-slate-200/60 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-between group cursor-pointer min-w-0"
                                                >
                                                    <div className="flex items-center gap-4 lg:gap-6 flex-1 min-w-0">
                                                        <div className="w-10 h-10 lg:w-12 lg:h-12 xl:w-14 xl:h-14 rounded-xl lg:rounded-2xl xl:rounded-3xl bg-slate-50 flex items-center justify-center text-indigo-600 font-black shrink-0 border border-slate-100 text-sm lg:text-base xl:text-xl">
                                                            {view.viewCount || 1}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className="font-bold text-slate-900 text-sm lg:text-base truncate">{view.address}</h4>
                                                            <div className="flex items-center gap-2 lg:gap-3 mt-1 lg:mt-1.5 flex-wrap">
                                                                <span className="text-[10px] lg:text-[12px] font-black uppercase tracking-widest text-slate-400">{formatDate(view.timestamp)}</span>
                                                                <span className="opacity-10 text-slate-900">•</span>
                                                                <span className="text-[10px] lg:text-[12px] font-black uppercase tracking-widest text-indigo-500 font-bold">
                                                                    {view.type || 'Engagement'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button className="w-8 h-8 lg:w-10 lg:h-10 xl:w-11 xl:h-11 rounded-xl lg:rounded-2xl bg-indigo-50 text-indigo-600 opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shrink-0">
                                                        <i className="fa-solid fa-chevron-right text-[10px]"></i>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* KYC Intelligence Hub - Comprehensive View */}
                            {selectedClient.kyc && (
                                <div className="mt-12 space-y-8">
                                    <div className="flex items-center justify-between px-2">
                                        {/* KYC Header removed */}
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
                                        {/* 1. Profiles & Preferences */}
                                        <div className="bg-white p-8 rounded-[3rem] border border-slate-200/60 shadow-sm space-y-6 flex flex-col">
                                            <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 pb-3">
                                                <i className="fa-solid fa-user-gear"></i> Profiles & Preferences
                                            </h4>

                                            <div className="space-y-4 flex-1">
                                                {/* Target Criteria */}
                                                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-50">
                                                    <div>
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Budget</div>
                                                        <div className="text-[14px] font-black text-slate-900">
                                                            ${(selectedClient as any).minPrice?.toLocaleString() || '0'} - ${(selectedClient as any).maxPrice?.toLocaleString() || '---'}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Specs</div>
                                                        <div className="text-[14px] font-black text-slate-900">
                                                            {(selectedClient as any).bedrooms || '0'}+ Beds | {(selectedClient as any).bathrooms || '0'}+ Baths
                                                        </div>
                                                    </div>
                                                </div>
                                                {(selectedClient.kyc.dealBreakers?.length || 0) > 0 && (
                                                    <div className="space-y-2">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deal-Breakers</div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {selectedClient.kyc.dealBreakers?.map((db, i) => (
                                                                <span key={i} className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold border border-rose-100/50">{db}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {(selectedClient.kyc.neighborhoodTargets?.length || 0) > 0 && (
                                                    <div className="space-y-2">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Neighborhoods</div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {selectedClient.kyc.neighborhoodTargets?.map((nh, i) => (
                                                                <span key={i} className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold border border-indigo-100/50">{nh}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {selectedClient.kyc.schoolDistricts && (
                                                    <div className="space-y-1">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">School Districts</div>
                                                        <div className="text-[14px] font-bold text-slate-700">{selectedClient.kyc.schoolDistricts}</div>
                                                    </div>
                                                )}

                                                {(selectedClient.kyc.birthdays || selectedClient.kyc.homeAnniversary) && (
                                                    <div className="pt-4 border-t border-slate-50 grid grid-cols-2 gap-4">
                                                        {selectedClient.kyc.birthdays && (
                                                            <div>
                                                                <div className="text-[8px] font-black text-slate-400 uppercase">Birthdays</div>
                                                                <div className="text-[10px] font-bold text-slate-800">{selectedClient.kyc.birthdays}</div>
                                                            </div>
                                                        )}
                                                        {selectedClient.kyc.homeAnniversary && (
                                                            <div>
                                                                <div className="text-[8px] font-black text-slate-400 uppercase">Anniversary</div>
                                                                <div className="text-[10px] font-bold text-slate-800">{selectedClient.kyc.homeAnniversary}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {selectedClient.kyc.familyPetsDetails && (
                                                    <div className="pt-2">
                                                        <div className="text-[8px] font-black text-slate-400 uppercase">Family & Pets</div>
                                                        <div className="text-[10px] font-medium text-slate-600 italic mt-1 leading-relaxed">
                                                            {selectedClient.kyc.familyPetsDetails}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 2. Management & Financials */}
                                        <div className="bg-white p-8 rounded-[3rem] border border-slate-200/60 shadow-sm space-y-6 flex flex-col">
                                            <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 pb-3">
                                                <i className="fa-solid fa-gauge-high"></i> Management & Readiness
                                            </h4>

                                            <div className="space-y-5 flex-1">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Lead Score</div>
                                                        <div className="text-xl font-black text-indigo-600">{selectedClient.kyc.leadScore || 85}%</div>
                                                    </div>
                                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Nurture Stage</div>
                                                        <div className={`text-[12px] font-black uppercase ${selectedClient.kyc.nurtureDetail === 'Hot' ? 'text-orange-600' : 'text-indigo-600'}`}>
                                                            {selectedClient.kyc.nurtureDetail || 'Warm'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purchase Type</div>
                                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${selectedClient.kyc.isAllCash ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-600'}`}>
                                                            {selectedClient.kyc.isAllCash ? 'All Cash' : 'Financed'}
                                                        </span>
                                                    </div>
                                                    {selectedClient.kyc.lenderName && (
                                                        <div>
                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lender Details</div>
                                                            <div className="text-[14px] font-bold text-slate-700 mt-0.5">{selectedClient.kyc.lenderName}</div>
                                                            {selectedClient.kyc.lenderContact && (
                                                                <div className="text-[12px] text-slate-500 font-medium italic mt-0.5">{selectedClient.kyc.lenderContact}</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {selectedClient.kyc.communicationPreferenceNotes && (
                                                    <div className="pt-4 border-t border-slate-50">
                                                        <div className="text-[8px] font-black text-slate-400 uppercase">Comms Preferences</div>
                                                        <p className="text-[10px] font-medium text-slate-600 mt-2 leading-relaxed bg-indigo-50/30 p-3 rounded-xl border border-indigo-100/50">
                                                            "{selectedClient.kyc.communicationPreferenceNotes}"
                                                        </p>
                                                    </div>
                                                )}

                                                {selectedClient.kyc.slaMinutesTarget && (
                                                    <div className="flex items-center gap-2 pt-2">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SLA TARGET: {selectedClient.kyc.slaMinutesTarget} MINS</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 3. Transaction Timeline */}
                                        <div className="bg-white p-8 rounded-[3rem] border border-slate-200/60 shadow-sm space-y-6 flex flex-col">
                                            <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 pb-3">
                                                <i className="fa-solid fa-map-location-dot"></i> Transaction Pipeline
                                            </h4>

                                            <div className="space-y-6 flex-1">
                                                <div className="space-y-2">
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Roadmap Stage</div>
                                                    <div className="text-[14px] font-black text-indigo-600 uppercase tracking-tight">{selectedClient.kyc.transactionStage || 'Listing Prep'}</div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-3">
                                                    {selectedClient.kyc.inspectionDeadline && (
                                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Inspection</span>
                                                            <span className="text-[14px] font-bold text-slate-800">{selectedClient.kyc.inspectionDeadline}</span>
                                                        </div>
                                                    )}
                                                    {selectedClient.kyc.appraisalDeadline && (
                                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Appraisal</span>
                                                            <span className="text-[14px] font-bold text-slate-800">{selectedClient.kyc.appraisalDeadline}</span>
                                                        </div>
                                                    )}
                                                    {selectedClient.kyc.loanCommitmentDeadline && (
                                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Loan Commit</span>
                                                            <span className="text-[14px] font-bold text-slate-800">{selectedClient.kyc.loanCommitmentDeadline}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="pt-4 border-t border-slate-50 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Checklist</div>
                                                        <div className="text-[12px] font-black text-indigo-600">
                                                            {selectedClient.kyc.documentChecklist?.filter(i => i.status === 'Signed').length || 0} / {selectedClient.kyc.documentChecklist?.length || 0}
                                                        </div>
                                                    </div>
                                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                                                            style={{ width: `${(selectedClient.kyc.documentChecklist?.filter(i => i.status === 'Signed').length || 0) / (selectedClient.kyc.documentChecklist?.length || 1) * 100}%` }}
                                                        ></div>
                                                    </div>
                                                    <div className="grid gap-1.5 max-h-[120px] overflow-y-auto pt-2">
                                                        {selectedClient.kyc.documentChecklist?.map((item, idx) => (
                                                            <div key={idx} className="flex items-center gap-2 text-[12px]">
                                                                <i className={`fa-solid ${item.status === 'Signed' ? 'fa-circle-check text-emerald-500' : item.status === 'Pending' ? 'fa-circle-dot text-amber-500' : 'fa-circle-xmark text-slate-300'}`}></i>
                                                                <span className={item.status === 'Signed' ? 'text-slate-400 line-through' : 'text-slate-600 font-bold'}>{item.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Detailed Lead View for Off Zyphe Clients */}
                            {!isUser(selectedClient) && !selectedClient.kyc && (
                                <div className="mt-12 space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {[
                                            'Intent & Readiness',
                                            'Persona & Context',
                                            'Activity',
                                            'Property Details',
                                            'Timings',
                                            'Contact Information',
                                            'Referral & Source',
                                            'System Metadata'
                                        ].map(category => {
                                            const fields = LEAD_FIELD_CONFIG.filter(f => f.category === category);
                                            const lead = selectedClient as any;
                                            const hasData = fields.some(f => lead[f.id] !== undefined && lead[f.id] !== null && lead[f.id] !== '' && (Array.isArray(lead[f.id]) ? lead[f.id].length > 0 : true));

                                            if (!hasData) return null;

                                            return (
                                                <div key={category} className="bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm space-y-4">
                                                    <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest border-b border-slate-50 pb-3 mb-2">{category}</h4>
                                                    <div className="space-y-4">
                                                        {fields.map(field => {
                                                            const value = lead[field.id];
                                                            if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return null;

                                                            return (
                                                                <div key={field.id} className="group">
                                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{field.label}</div>
                                                                    <div className="text-sm font-semibold text-slate-700 break-words">
                                                                        {typeof value === 'boolean' ? (
                                                                            value ? <span className="text-emerald-600"><i className="fa-solid fa-check"></i> Yes</span> : 'No'
                                                                        ) : Array.isArray(value) ? (
                                                                            // Simple list rendering for arrays like tags, complex objects need specific handling or JSON dump
                                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                                {value.map((v: any, i: number) => (
                                                                                    <span key={i} className="px-2 py-0.5 bg-slate-100 rounded text-xs">
                                                                                        {typeof v === 'object' ? (v.name || v.address || v.id || JSON.stringify(v)) : v}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        ) : typeof value === 'object' ? (
                                                                            <pre className="text-xs text-slate-500 whitespace-pre-wrap font-sans">{JSON.stringify(value, null, 2)}</pre>
                                                                        ) : (
                                                                            value
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50">
                        <div className="w-56 h-56 bg-white rounded-[4rem] shadow-2xl shadow-indigo-100 flex items-center justify-center mb-10 border border-slate-100 animate-bounce-slow">
                            <i className="fa-solid fa-user-astronaut text-7xl text-indigo-50"></i>
                        </div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tight">Select a Prospect</h2>
                        <p className="text-slate-500 font-medium text-center max-w-sm mt-5 text-lg leading-relaxed">
                            Pick a contact from the interactive sidebar to load their behavioral profile and AI market intelligence.
                        </p>
                    </div>
                )}
            </div>

            {/* Manual Forms Overlays */}
            {activeForm === 'property' && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">{editingProperty ? 'Edit Property' : 'Add to Shortlist'}</h3>
                            <button onClick={() => { setActiveForm(null); setEditingProperty(null); }} className="text-slate-400 hover:text-slate-600 border border-slate-200 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-slate-100">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Property Address</label>
                                <input
                                    type="text"
                                    defaultValue={editingProperty?.address || ''}
                                    id="prop_address"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="e.g. 123 Beverly Hills Dr"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Listing Price</label>
                                <input
                                    type="number"
                                    defaultValue={editingProperty?.price || ''}
                                    id="prop_price"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="2500000"
                                />
                            </div>
                            <div className="flex items-center gap-3 py-2">
                                <input type="checkbox" defaultChecked={editingProperty?.isHot} id="prop_hot" className="w-4 h-4 rounded text-indigo-600" />
                                <label className="text-xs font-bold text-slate-700">Mark as 'Hot' Asset</label>
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                            {editingProperty ? (
                                <button
                                    onClick={() => handleDeleteProperty(editingProperty.id)}
                                    className="px-6 py-3 rounded-xl bg-white border border-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center gap-2"
                                >
                                    <i className="fa-solid fa-minus text-[8px]"></i> Delete Item
                                </button>
                            ) : <div className="text-[10px] font-medium text-slate-400 italic">Creating new entry...</div>}
                            <button
                                onClick={() => {
                                    const address = (document.getElementById('prop_address') as HTMLInputElement).value;
                                    const price = parseInt((document.getElementById('prop_price') as HTMLInputElement).value) || 0;
                                    const isHot = (document.getElementById('prop_hot') as HTMLInputElement).checked;
                                    handleSaveProperty({ address, price, isHot });
                                }}
                                className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
                            >
                                Save Selection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeForm === 'activity' && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">{editingActivity ? 'Edit Activity' : 'Log Manual Event'}</h3>
                            <button onClick={() => { setActiveForm(null); setEditingActivity(null); }} className="text-slate-400 hover:text-slate-600 border border-slate-200 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-slate-100">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Event Description / Address</label>
                                <input
                                    type="text"
                                    defaultValue={editingActivity?.address || ''}
                                    id="act_address"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="e.g. Phone Call: Listing Details"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Event Type</label>
                                    <select
                                        id="act_type"
                                        defaultValue={editingActivity?.type || 'Meeting'}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none"
                                    >
                                        <option value="Meeting">Office Meeting</option>
                                        <option value="Call">Phone Call</option>
                                        <option value="Property View">Property Tour</option>
                                        <option value="Other">Other Engagement</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Intensity / Hits</label>
                                    <input
                                        type="number"
                                        defaultValue={editingActivity?.viewCount || 1}
                                        id="act_count"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                            {editingActivity ? (
                                <button
                                    onClick={() => handleDeleteActivity(editingActivity.id)}
                                    className="px-6 py-3 rounded-xl bg-white border border-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center gap-2"
                                >
                                    <i className="fa-solid fa-minus text-[8px]"></i> Delete Item
                                </button>
                            ) : <div className="text-[10px] font-medium text-slate-400 italic">Creating new log...</div>}
                            <button
                                onClick={() => {
                                    const address = (document.getElementById('act_address') as HTMLInputElement).value;
                                    const type = (document.getElementById('act_type') as HTMLSelectElement).value as any;
                                    const viewCount = parseInt((document.getElementById('act_count') as HTMLInputElement).value) || 1;
                                    handleSaveActivity({ address, type, viewCount });
                                }}
                                className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
                            >
                                Log Activity
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default ClientNetwork;
