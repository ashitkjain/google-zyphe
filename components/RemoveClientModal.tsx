
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { getRealtorClients, removeClient } from '../services/firebaseService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    realtorId: string;
    onClientRemoved: () => void;
}

const RemoveClientModal: React.FC<Props> = ({ isOpen, onClose, realtorId, onClientRemoved }) => {
    const [clients, setClients] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [removing, setRemoving] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            getRealtorClients(realtorId)
                .then(setClients)
                .catch(err => console.error("Error fetching clients:", err))
                .finally(() => setLoading(false));
        }
    }, [isOpen, realtorId]);

    const handleRemove = async (client: UserProfile) => {
        if (!window.confirm(`Are you sure you want to remove ${client.displayName || 'this client'}? This action cannot be undone.`)) {
            return;
        }

        setRemoving(client.uid);
        try {
            const success = await removeClient(client.uid);
            if (success) {
                setClients(prev => prev.filter(c => c.uid !== client.uid));
                onClientRemoved();
            } else {
                alert("Failed to remove client. Please try again.");
            }
        } catch (err) {
            console.error(err);
            alert("An error occurred.");
        } finally {
            setRemoving(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col h-[600px]">
                <div className="p-8 pb-4 flex flex-col items-center text-center shrink-0">
                    <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-4 text-rose-600 shadow-sm">
                        <i className="fa-solid fa-user-minus text-2xl"></i>
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Remove Client</h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">
                        Permanently remove client access and data.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto px-8 pb-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                            <i className="fa-solid fa-circle-notch fa-spin text-2xl"></i>
                            <span className="text-xs font-bold uppercase tracking-widest">Loading Clients...</span>
                        </div>
                    ) : clients.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                            <i className="fa-solid fa-users-slash text-2xl opacity-50"></i>
                            <span className="text-xs font-bold uppercase tracking-widest">No Active Clients Found</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {clients.map(client => (
                                <div key={client.uid} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-rose-200 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm uppercase">
                                            {client.displayName ? client.displayName.substring(0, 2) : '??'}
                                        </div>
                                        <div>
                                            <div className="font-black text-slate-900 text-sm">{client.displayName || 'Unnamed Client'}</div>
                                            <div className="text-xs font-medium text-slate-500">{client.email}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRemove(client)}
                                        disabled={removing === client.uid}
                                        className="px-4 py-2 bg-white text-rose-500 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-all shadow-sm"
                                    >
                                        {removing === client.uid ? (
                                            <i className="fa-solid fa-circle-notch fa-spin"></i>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <i className="fa-solid fa-trash-can"></i>
                                                Remove
                                            </span>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-8 pt-4 border-t border-slate-100 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RemoveClientModal;
