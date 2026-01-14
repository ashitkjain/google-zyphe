import React, { useState, useEffect } from 'react';
import { UserProfile, Lead } from '../../types';

interface ClientNetworkProps {
    clients: UserProfile[];
    manualContacts: Lead[];
    selectedClient: UserProfile | Lead | null;
    setSelectedClient: (client: UserProfile | Lead | null) => void;
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
    clientActivity,
    loadingClients,
    loadingActivity
}) => {
    const [networkTab, setNetworkTab] = useState<'on-zyphe' | 'off-zyphe'>('on-zyphe');

    const displayList = networkTab === 'on-zyphe' ? clients : manualContacts;

    // Auto-select first item when switching tabs
    useEffect(() => {
        if (displayList.length > 0) {
            setSelectedClient(displayList[0]);
        } else {
            setSelectedClient(null);
        }
    }, [networkTab, clients, manualContacts]);

    // Type Helper
    const isUser = (c: UserProfile | Lead | null): c is UserProfile => !!c && 'uid' in c;
    const getId = (c: UserProfile | Lead | null) => {
        if (!c) return '';
        return isUser(c) ? c.uid : (c as Lead).id;
    };
    const getName = (c: UserProfile | Lead | null) => {
        if (!c) return '';
        return isUser(c) ? c.displayName : (c as Lead).name;
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

    // Mock Data for Leads to match User consistency
    const getLeadStats = (lead: Lead) => {
        const idNum = parseInt(lead.id.replace(/\D/g, '') || '0') || 7;
        return {
            favorites: lead.propertyAddress ? 1 : (idNum % 3),
            hits: (idNum % 12) + 2
        };
    };

    const getLeadViews = (lead: Lead) => {
        const idNum = parseInt(lead.id.replace(/\D/g, '') || '0') || 7;
        const views = [];
        if (lead.propertyAddress) {
            views.push({
                address: lead.propertyAddress,
                timestamp: lead.receivedAt,
                viewCount: (idNum % 5) + 1
            });
        }
        views.push({
            address: `${lead.source} Discovery Event`,
            timestamp: lead.receivedAt,
            viewCount: 1
        });
        return views;
    };

    const getLeadFavorites = (lead: Lead) => {
        if (lead.propertyAddress) {
            return [{
                address: lead.propertyAddress,
                price: lead.price || lead.minPrice || 0
            }];
        }
        return [];
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
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-2xl outline-none text-xs font-semibold transition-all shadow-inner"
                        />
                        <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-indigo-500"></i>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
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
                                        <div className="font-bold text-sm truncate leading-tight">{getName(client)}</div>
                                        <div className={`text-[9px] uppercase font-black tracking-widest mt-1 ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>
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
                                        <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200">
                                            {getRole(selectedClient)}
                                        </span>
                                        {!isUser(selectedClient) && (
                                            <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                Manual Lead
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 mt-2">
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
                                        {isUser(selectedClient)
                                            ? clientActivity.favorites.length
                                            : getLeadStats(selectedClient as Lead).favorites}
                                    </span>
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Favorites</span>
                                </button>
                                <button className="px-6 py-4 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center transition-all hover:border-indigo-500 group shadow-sm">
                                    <span className="text-2xl font-black text-indigo-600 group-hover:scale-110 transition-transform">
                                        {isUser(selectedClient)
                                            ? clientActivity.views.reduce((acc, curr) => acc + (curr.viewCount || 1), 0)
                                            : getLeadStats(selectedClient as Lead).hits}
                                    </span>
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Total Hits</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 no-scrollbar">
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
                                                {getName(selectedClient)} is actively engaged via <strong>{(selectedClient as Lead).source}</strong>. Analysis of their inquiry suggests a strong preference for <strong>{(selectedClient as Lead).leadType}</strong> opportunities.
                                                {(selectedClient as Lead).minPrice ? ` Targeting a price point of $${((selectedClient as Lead).minPrice! / 1000).toFixed(0)}k - $${((selectedClient as Lead).maxPrice! / 1000).toFixed(0)}k.` : ' Currently analyzing their search patterns for local listings.'}
                                                {(selectedClient as Lead).propertyAddress ? ` Critical interest detected in ${(selectedClient as Lead).propertyAddress}.` : ''}
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

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                {/* Engagement Stream */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900 flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                            Live Activity Feed
                                        </h3>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            {isUser(selectedClient) ? clientActivity.views.length : getLeadViews(selectedClient as Lead).length} Events
                                        </span>
                                    </div>

                                    {(isUser(selectedClient) ? clientActivity.views : getLeadViews(selectedClient as Lead)).length === 0 ? (
                                        <div className="bg-white rounded-[2rem] p-16 text-center shadow-sm border border-slate-100">
                                            <p className="text-slate-400 font-medium">No activity recorded yet.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {(isUser(selectedClient) ? clientActivity.views : getLeadViews(selectedClient as Lead)).map((view, i) => (
                                                <div key={i} className="bg-white p-7 rounded-[2.5rem] border border-slate-200/60 shadow-sm hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1 transition-all flex items-center justify-between group">
                                                    <div className="flex items-center gap-6 flex-1 min-w-0">
                                                        <div className="w-14 h-14 rounded-3xl bg-slate-50 flex items-center justify-center text-indigo-600 font-black shrink-0 border border-slate-100 text-xl">
                                                            {view.viewCount || 1}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className="font-bold text-slate-900 text-base truncate">{view.address}</h4>
                                                            <div className="flex items-center gap-3 mt-1.5">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{formatDate(view.timestamp)}</span>
                                                                <span className="opacity-10 text-slate-900">•</span>
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 font-bold">
                                                                    {isUser(selectedClient) ? 'Repeat View' : 'Discovery Event'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all transform translate-x-4 group-hover:translate-x-0 shadow-sm">
                                                        <i className="fa-solid fa-chevron-right text-xs"></i>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Top Interests */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900 flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                            Property Shortlist
                                        </h3>
                                        <button className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:underline">Export Portfolio</button>
                                    </div>

                                    {(isUser(selectedClient) ? clientActivity.favorites : getLeadFavorites(selectedClient as Lead)).length === 0 ? (
                                        <div className="bg-white rounded-[2rem] p-16 text-center shadow-sm border border-slate-100">
                                            <p className="text-slate-400 font-medium">No archived favorites.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-5">
                                            {(isUser(selectedClient) ? clientActivity.favorites : getLeadFavorites(selectedClient as Lead)).map((fav, i) => (
                                                <div key={i} className="bg-white p-7 rounded-[2.5rem] border border-slate-200/60 shadow-sm hover:shadow-xl transition-all flex items-center gap-7 group">
                                                    <div className="w-24 h-24 rounded-[1.5rem] bg-indigo-50 shrink-0 overflow-hidden relative border border-slate-100">
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                                                        <i className="fa-solid fa-house-circle-check text-indigo-200 text-2xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></i>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-slate-900 text-base truncate">{fav.address}</h4>
                                                        <div className="flex items-center gap-4 mt-2">
                                                            <span className="text-xl font-black text-emerald-600">${fav.price?.toLocaleString() || '---'}</span>
                                                            <span className="px-3 py-1 bg-rose-50 text-rose-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-rose-100 shadow-sm">Hot</span>
                                                        </div>
                                                    </div>
                                                    <button className="w-14 h-14 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-lg shadow-indigo-100">
                                                        <i className="fa-solid fa-up-right-from-square text-xs"></i>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
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
        </div>
    );
};

export default ClientNetwork;
