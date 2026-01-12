
import React, { useState, useEffect } from 'react';
import { getRealtorClients, getClientActivity } from '../services/firebaseService';
import { UserProfile } from '../types';
import Logo from './Logo';

interface Props {
    realtorId: string;
    onBack: () => void;
}

const ClientDashboard: React.FC<Props> = ({ realtorId, onBack }) => {
    const [clients, setClients] = useState<UserProfile[]>([]);
    const [selectedClient, setSelectedClient] = useState<UserProfile | null>(null);
    const [clientActivity, setClientActivity] = useState<{ favorites: any[], views: any[] }>({ favorites: [], views: [] });
    const [loadingClients, setLoadingClients] = useState(true);
    const [loadingActivity, setLoadingActivity] = useState(false);

    useEffect(() => {
        const fetchClients = async () => {
            setLoadingClients(true);
            const data = await getRealtorClients(realtorId);
            setClients(data);
            if (data.length > 0) {
                setSelectedClient(data[0]);
            }
            setLoadingClients(false);
        };
        fetchClients();
    }, [realtorId]);

    useEffect(() => {
        const fetchActivity = async () => {
            if (!selectedClient) return;
            setLoadingActivity(true);
            const data = await getClientActivity(selectedClient.uid);
            setClientActivity(data);
            setLoadingActivity(false);
        };
        fetchActivity();
    }, [selectedClient]);

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'Just now';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-50 flex animate-in fade-in duration-500">
            {/* Sidebar */}
            <div className="w-80 bg-white border-r border-slate-200 flex flex-col h-full shadow-sm">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <Logo size={80} onClick={onBack} className="cursor-pointer" />
                    <button
                        onClick={onBack}
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-all border border-slate-100"
                    >
                        <i className="fa-solid fa-arrow-left"></i>
                    </button>
                </div>

                <div className="p-4 bg-indigo-900 text-white">
                    <div className="flex items-center gap-2 px-3 py-1 bg-amber-500 rounded-full text-slate-900 text-[8px] font-black uppercase w-fit mb-2">
                        <i className="fa-solid fa-crown text-[10px]"></i>
                        <span>Realtor Console</span>
                    </div>
                    <h1 className="text-sm font-black uppercase tracking-widest px-1">Client Dashboard</h1>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                    <div className="px-2 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-user-group"></i>
                        Registered Clients ({clients.length})
                    </div>

                    {loadingClients ? (
                        <div className="p-8 text-center text-slate-300">
                            <i className="fa-solid fa-circle-notch fa-spin text-2xl"></i>
                        </div>
                    ) : clients.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            <p className="text-xs font-medium">No clients registered yet.</p>
                            <p className="text-[10px] mt-1 opacity-60">Invite clients to see them here.</p>
                        </div>
                    ) : (
                        clients.map((client) => (
                            <button
                                key={client.uid}
                                onClick={() => setSelectedClient(client)}
                                className={`w-full text-left px-4 py-3 rounded-2xl transition-all group ${selectedClient?.uid === client.uid
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                                        : 'hover:bg-slate-50 text-slate-600'
                                    }`}
                            >
                                <div className="font-bold text-sm truncate">{client.displayName}</div>
                                <div className={`text-[10px] uppercase font-black tracking-widest mt-0.5 opacity-60 ${selectedClient?.uid === client.uid ? 'text-white' : 'text-slate-400'}`}>
                                    {client.role}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {selectedClient ? (
                    <>
                        <div className="p-8 bg-white border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedClient.displayName}</h2>
                                    <p className="text-slate-500 font-medium text-sm mt-1">{selectedClient.email}</p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="text-center px-6 py-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                                        <div className="text-2xl font-black text-indigo-600">{clientActivity.favorites.length}</div>
                                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Favorites</div>
                                    </div>
                                    <div className="text-center px-6 py-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                                        <div className="text-2xl font-black text-indigo-600">
                                            {clientActivity.views.reduce((acc, curr) => acc + (curr.viewCount || 1), 0)}
                                        </div>
                                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Total Views</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 no-scrollbar">
                            {/* Viewed Properties */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900 flex items-center gap-2">
                                        <i className="fa-solid fa-clock-rotate-left text-indigo-500"></i>
                                        View History
                                    </h3>
                                    <span className="text-[10px] font-bold text-slate-400">{clientActivity.views.length} Properties</span>
                                </div>

                                {loadingActivity ? (
                                    <div className="flex items-center justify-center p-20">
                                        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-slate-200"></i>
                                    </div>
                                ) : clientActivity.views.length === 0 ? (
                                    <div className="bg-white rounded-[2rem] p-12 border border-slate-100 text-center shadow-sm">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                                            <i className="fa-solid fa-eye text-2xl"></i>
                                        </div>
                                        <p className="text-slate-500 font-medium text-sm">No properties viewed yet.</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        {clientActivity.views.map((view, i) => (
                                            <div key={i} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-slate-900 text-sm truncate">{view.address}</h4>
                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                            {formatDate(view.timestamp)}
                                                        </span>
                                                        <span className="opacity-10 text-slate-900">•</span>
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">
                                                            {view.viewCount || 1} Views
                                                        </span>
                                                    </div>
                                                </div>
                                                <i className="fa-solid fa-chevron-right text-slate-200 group-hover:text-indigo-600 transition-colors"></i>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Favorited Properties */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900 flex items-center gap-2">
                                        <i className="fa-solid fa-heart text-rose-500"></i>
                                        Favorites
                                    </h3>
                                    <span className="text-[10px] font-bold text-slate-400">{clientActivity.favorites.length} Saved</span>
                                </div>

                                {loadingActivity ? (
                                    <div className="flex items-center justify-center p-20">
                                        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-slate-200"></i>
                                    </div>
                                ) : clientActivity.favorites.length === 0 ? (
                                    <div className="bg-white rounded-[2rem] p-12 border border-slate-100 text-center shadow-sm">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                                            <i className="fa-solid fa-heart text-2xl"></i>
                                        </div>
                                        <p className="text-slate-500 font-medium text-sm">No favorites saved yet.</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        {clientActivity.favorites.map((fav, i) => (
                                            <div key={i} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-slate-900 text-sm truncate">{fav.address}</h4>
                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                            Added {formatDate(fav.timestamp)}
                                                        </span>
                                                        {fav.price && (
                                                            <>
                                                                <span className="opacity-10 text-slate-900">•</span>
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                                                                    ${fav.price.toLocaleString()}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <i className="fa-solid fa-chevron-right text-slate-200 group-hover:text-rose-500 transition-colors"></i>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
                        <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-xl shadow-slate-200 mb-8 border-4 border-slate-100">
                            <i className="fa-solid fa-user-group text-4xl text-slate-200"></i>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Select a client</h2>
                        <p className="text-slate-500 font-medium text-center max-w-sm mt-2">
                            Choose a client from the sidebar to view their search activity and favorited properties.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientDashboard;
