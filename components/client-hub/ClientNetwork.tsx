import React from 'react';
import { UserProfile } from '../../types';

interface ClientNetworkProps {
    clients: UserProfile[];
    selectedClient: UserProfile | null;
    setSelectedClient: (client: UserProfile | null) => void;
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
    selectedClient,
    setSelectedClient,
    clientActivity,
    loadingClients,
    loadingActivity
}) => {
    return (
        <>
            {/* Clients Sidebar */}
            <div className="w-85 bg-white border-r border-slate-200 flex flex-col h-full shadow-2xl relative z-40">
                <div className="p-8 border-b border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <i className="fa-solid fa-users text-indigo-500"></i>
                            Your Network
                        </h3>
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-500">{clients.length}</span>
                    </div>
                    <div className="relative group">
                        <input
                            type="text"
                            placeholder="Search by name, email, or area..."
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-2xl outline-none text-xs font-semibold transition-all shadow-inner"
                        />
                        <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-indigo-500"></i>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loadingClients ? (
                        <div className="p-12 text-center text-slate-200">
                            <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
                        </div>
                    ) : clients.map((client) => (
                        <button
                            key={client.uid}
                            onClick={() => setSelectedClient(client)}
                            className={`w-full text-left p-5 rounded-[2rem] transition-all relative group ${selectedClient?.uid === client.uid
                                ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-200 translate-x-1'
                                : 'hover:bg-slate-50 text-slate-600 hover:translate-x-1'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${selectedClient?.uid === client.uid ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                                    {client.displayName?.[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm truncate leading-tight">{client.displayName}</div>
                                    <div className={`text-[9px] uppercase font-black tracking-widest mt-1 ${selectedClient?.uid === client.uid ? 'text-white/60' : 'text-slate-400'}`}>
                                        {client.role} • Active Today
                                    </div>
                                </div>
                                {selectedClient?.uid === client.uid && (
                                    <div className="w-2 h-2 rounded-full bg-white animate-pulse shadow-lg shadow-white/50"></div>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Clients Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F8FAFC]">
                {selectedClient ? (
                    <>
                        <div className="p-10 bg-white border-b border-slate-200/60 shadow-sm relative z-10 flex items-center justify-between">
                            <div className="flex items-center gap-8">
                                <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center text-3xl font-black text-indigo-600 shadow-xl shadow-indigo-100 border border-indigo-100/50">
                                    {selectedClient.displayName?.[0]}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedClient.displayName}</h2>
                                        <span className="px-3 py-1 bg-indigo-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200">
                                            {selectedClient.role}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 mt-2">
                                        <span className="text-slate-500 font-medium text-sm flex items-center gap-2">
                                            <i className="fa-solid fa-envelope text-indigo-400"></i> {selectedClient.email}
                                        </span>
                                        <span className="text-slate-200">|</span>
                                        <span className="text-slate-500 font-medium text-sm flex items-center gap-2">
                                            <i className="fa-solid fa-phone text-indigo-400"></i> {selectedClient.phoneNumber || 'No phone'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button className="px-6 py-4 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center transition-all hover:border-indigo-500 group shadow-sm">
                                    <span className="text-2xl font-black text-indigo-600 group-hover:scale-110 transition-transform">{clientActivity.favorites.length}</span>
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Favorites</span>
                                </button>
                                <button className="px-6 py-4 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center transition-all hover:border-indigo-500 group shadow-sm">
                                    <span className="text-2xl font-black text-indigo-600 group-hover:scale-110 transition-transform">
                                        {clientActivity.views.reduce((acc, curr) => acc + (curr.viewCount || 1), 0)}
                                    </span>
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Total Hits</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10">
                            {/* Client DNA Section */}
                            <div className="bg-indigo-900 rounded-[3rem] p-8 mb-10 text-white relative overflow-hidden shadow-2xl">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                                <div className="relative z-10 flex items-center justify-between">
                                    <div className="space-y-4 max-w-2xl">
                                        <div className="flex items-center gap-3">
                                            <div className="px-3 py-1 bg-amber-500 text-slate-900 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20">AI Persona Insight</div>
                                            <h3 className="text-xl font-black tracking-tight">Modern Luxury Seeker</h3>
                                        </div>
                                        <p className="text-indigo-100 text-sm leading-relaxed font-medium">
                                            Based on {selectedClient.displayName}'s recent behavior, they are focusing on properties with <span className="font-bold text-white">open floor plans</span> and <span className="font-bold text-white">smart home integration</span>. They typically view properties in the <span className="font-bold text-amber-400">$800k-$1.2M range</span>, specifically in the northwest suburbs.
                                        </p>
                                        <div className="flex gap-3">
                                            {['Modern Kitchen', 'Backyard Deck', 'School Score > 8'].map((tag, i) => (
                                                <span key={i} className="px-4 py-2 bg-white/10 rounded-xl text-[10px] font-bold border border-white/10">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-5xl font-black text-amber-500 tracking-tighter">88%</div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mt-1">Intent Score</div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                {/* Interactive Timeline of Interest */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900 flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                            Engagement Stream
                                        </h3>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{clientActivity.views.length} Data Points</span>
                                    </div>

                                    {loadingActivity ? (
                                        <div className="flex items-center justify-center p-20"><i className="fa-solid fa-circle-notch fa-spin text-4xl text-slate-200"></i></div>
                                    ) : clientActivity.views.length === 0 ? (
                                        <div className="bg-white rounded-[2rem] p-16 text-center shadow-sm border border-slate-100">
                                            <p className="text-slate-400 font-medium">No activity recorded yet.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {clientActivity.views.map((view, i) => (
                                                <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1 transition-all flex items-center justify-between group">
                                                    <div className="flex items-center gap-5 flex-1 min-w-0">
                                                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-indigo-500 font-black shrink-0 border border-slate-100">
                                                            {view.viewCount || 1}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className="font-bold text-slate-900 text-sm truncate">{view.address}</h4>
                                                            <div className="flex items-center gap-3 mt-1">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{formatDate(view.timestamp)}</span>
                                                                <span className="opacity-10 text-slate-900">•</span>
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 font-bold">Repeat View</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all transform translate-x-4 group-hover:translate-x-0">
                                                        <i className="fa-solid fa-chevron-right text-xs"></i>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* High-Value Favorites */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900 flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                                            Top Interests
                                        </h3>
                                        <button className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:underline">Download List</button>
                                    </div>

                                    {clientActivity.favorites.length === 0 ? (
                                        <div className="bg-white rounded-[2rem] p-16 text-center shadow-sm border border-slate-100">
                                            <p className="text-slate-400 font-medium">No properties favorited yet.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-4">
                                            {clientActivity.favorites.map((fav, i) => (
                                                <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm hover:shadow-xl transition-all flex items-center gap-6 group">
                                                    <div className="w-20 h-20 rounded-2xl bg-slate-100 shrink-0 overflow-hidden relative border border-slate-200">
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                                                        <i className="fa-solid fa-camera text-slate-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></i>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-slate-900 text-sm truncate">{fav.address}</h4>
                                                        <div className="flex items-center gap-3 mt-1.5">
                                                            <span className="text-lg font-black text-emerald-600">${fav.price?.toLocaleString() || '---'}</span>
                                                            <span className="px-2 py-0.5 bg-rose-50 text-rose-500 rounded text-[9px] font-black uppercase tracking-widest border border-rose-100">Saved</span>
                                                        </div>
                                                    </div>
                                                    <button className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                                                        <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
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
                        <div className="w-48 h-48 bg-white rounded-[3rem] shadow-2xl shadow-indigo-100 flex items-center justify-center mb-10 border border-slate-100 animate-bounce-slow">
                            <i className="fa-solid fa-users text-6xl text-slate-100"></i>
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Access Your Network</h2>
                        <p className="text-slate-500 font-medium text-center max-w-sm mt-4 text-base leading-relaxed">
                            Select a partner or client from the sidebar to visualize their property journey and AI insights.
                        </p>
                    </div>
                )}
            </div>
        </>
    );
};

export default ClientNetwork;
