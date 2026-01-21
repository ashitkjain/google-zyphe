import React, { useState, useEffect } from 'react';
import { TransactionParty, Lead, TransactionRole } from '../../types';
import { getTransactionParties, addTransactionParty, updateTransactionParty, deleteTransactionParty, getTransactionByClientId, seedPartiesForTransaction } from '../../services/firebaseService';

interface PartiesTabProps {
    lead: Lead;
    realtorId: string;
}

const ROLES: TransactionRole[] = ['BUYER', 'SELLER', 'AGENT', 'CO_AGENT', 'ESCROW', 'TITLE', 'LENDER', 'TC', 'OTHER'];

const PartiesTab: React.FC<PartiesTabProps> = ({ lead, realtorId }) => {
    const [parties, setParties] = useState<TransactionParty[]>([]);
    const [loading, setLoading] = useState(true);
    const [transactionId, setTransactionId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<TransactionParty>>({});
    const [isAdding, setIsAdding] = useState(false);

    const MOCK_PARTIES: TransactionParty[] = [
        {
            id: 'mock_1',
            transaction_id: 'tx_123',
            role: 'BUYER',
            display_name: 'John Doe',
            email: 'john@example.com',
            phone: '555-0101',
            address: '123 Buyer St, New York, NY',
            signing_required: true,
            signer_order: 1,
            created_at: new Date()
        },
        {
            id: 'mock_2',
            transaction_id: 'tx_123',
            role: 'SELLER',
            display_name: 'Jane Smith',
            email: 'jane@example.com',
            phone: '555-0102',
            address: '456 Seller Ave, Los Angeles, CA',
            signing_required: true,
            signer_order: 1,
            created_at: new Date()
        },
        {
            id: 'mock_3',
            transaction_id: 'tx_123',
            role: 'LENDER',
            display_name: 'Bob Banker',
            email: 'bob@bank.com',
            phone: '555-0103',
            address: '789 Finance Blvd, Chicago, IL',
            signing_required: false,
            created_at: new Date()
        }
    ];

    useEffect(() => {
        const fetchTransactionAndParties = async () => {
            setLoading(true);
            try {
                const tx = await getTransactionByClientId(lead.clientId || '', realtorId);
                if (tx) {
                    setTransactionId(tx.id);
                    const partiesData = await getTransactionParties(tx.id);
                    setParties(partiesData.length > 0 ? partiesData : MOCK_PARTIES);
                } else {
                    // Fallback to mock data if no transaction exists
                    setTransactionId('mock_tx_id');
                    setParties(MOCK_PARTIES);
                }
            } catch (error) {
                console.error("Error fetching parties:", error);
                setParties(MOCK_PARTIES); // Fallback on error
            } finally {
                setLoading(false);
            }
        };

        if (lead.clientId) {
            fetchTransactionAndParties();
        } else {
            // Demo mode if no clientId
            setParties(MOCK_PARTIES);
            setLoading(false);
            setTransactionId('mock_tx_id');
        }
    }, [lead.clientId, realtorId]);

    const handleEdit = (party: TransactionParty) => {
        setEditingId(party.id);
        setEditForm(party);
    };

    const handleSave = async (id: string) => {
        if (!transactionId) return;
        try {
            await updateTransactionParty(transactionId, id, editForm);
            setParties(parties.map(p => p.id === id ? { ...p, ...editForm } as TransactionParty : p));
            setEditingId(null);
        } catch (error) {
            console.error("Error updating party:", error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!transactionId || !window.confirm("Are you sure you want to remove this party?")) return;
        try {
            await deleteTransactionParty(transactionId, id);
            setParties(parties.filter(p => p.id !== id));
        } catch (error) {
            console.error("Error deleting party:", error);
        }
    };

    const handleAdd = async () => {
        if (!transactionId) return;
        const newParty: Partial<TransactionParty> = {
            display_name: 'New Party',
            role: 'OTHER',
            email: '',
            signing_required: false,
            ...editForm
        };
        try {
            const added = await addTransactionParty(transactionId, newParty);
            if (added) {
                setParties([...parties, added]);
                setIsAdding(false);
                setEditForm({});
            }
        } catch (error) {
            console.error("Error adding party:", error);
        }
    };

    const handleSeedData = async () => {
        if (!transactionId || transactionId === 'mock_tx_id') return;
        setLoading(true);
        await seedPartiesForTransaction(transactionId);
        // Refresh
        const partiesData = await getTransactionParties(transactionId);
        setParties(partiesData);
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!transactionId) {
        return (
            <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <i className="fa-solid fa-file-circle-exclamation text-4xl text-slate-300 mb-4"></i>
                <h3 className="text-lg font-bold text-slate-600">No Transaction Record</h3>
                <p className="text-slate-400 max-w-xs mx-auto mt-2">Create a transaction record first to manage parties.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    {/* Only show seed button if we have a real transaction but no/few parties (or just useful for demo) */}
                    {transactionId && transactionId !== 'mock_tx_id' && (
                        <button
                            onClick={handleSeedData}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-200"
                            title="Upload mock data to firebase"
                        >
                            <i className="fa-solid fa-cloud-upload"></i>
                            Seed Data
                        </button>
                    )}
                    <button
                        onClick={() => { setIsAdding(true); setEditForm({ role: 'OTHER', signing_required: false }); }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100"
                    >
                        <i className="fa-solid fa-plus"></i>
                        Add Party
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Email</th>
                            <th className="px-6 py-4">Phone</th>
                            <th className="px-6 py-4">Address</th>
                            <th className="px-6 py-4 text-center">Order</th>
                            <th className="px-6 py-4 text-center">Signer?</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {isAdding && (
                            <tr className="bg-indigo-50/30">
                                <td className="px-6 py-4">
                                    <input
                                        type="text"
                                        placeholder="Name"
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        value={editForm.display_name || ''}
                                        onChange={e => setEditForm({ ...editForm, display_name: e.target.value })}
                                        autoFocus
                                    />
                                </td>
                                <td className="px-6 py-4">
                                    <select
                                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        value={editForm.role || 'OTHER'}
                                        onChange={e => setEditForm({ ...editForm, role: e.target.value as TransactionRole })}
                                    >
                                        {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                                    </select>
                                </td>
                                <td className="px-6 py-4">
                                    <input
                                        type="email"
                                        placeholder="Email"
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        value={editForm.email || ''}
                                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                    />
                                </td>
                                <td className="px-6 py-4">
                                    <input
                                        type="tel"
                                        placeholder="Phone"
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        value={editForm.phone || ''}
                                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                    />
                                </td>
                                <td className="px-6 py-4">
                                    <input
                                        type="text"
                                        placeholder="Address"
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        value={editForm.address || ''}
                                        onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                                    />
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <input
                                        type="number"
                                        placeholder="#"
                                        className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        value={editForm.signer_order || ''}
                                        onChange={e => setEditForm({ ...editForm, signer_order: parseInt(e.target.value) || undefined })}
                                    />
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={editForm.signing_required || false}
                                        onChange={e => setEditForm({ ...editForm, signing_required: e.target.checked })}
                                    />
                                </td>
                                <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                    <button onClick={handleAdd} className="text-emerald-500 hover:text-emerald-600 font-bold text-xs uppercase">Add</button>
                                    <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-500 font-bold text-xs uppercase">Cancel</button>
                                </td>
                            </tr>
                        )}
                        {parties.map(party => (
                            <tr key={party.id} className="group hover:bg-slate-50/50 transition-all">
                                {editingId === party.id ? (
                                    <>
                                        <td className="px-6 py-4">
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                value={editForm.display_name || ''}
                                                onChange={e => setEditForm({ ...editForm, display_name: e.target.value })}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <select
                                                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                value={editForm.role || ''}
                                                onChange={e => setEditForm({ ...editForm, role: e.target.value as TransactionRole })}
                                            >
                                                {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-6 py-4">
                                            <input
                                                type="email"
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                value={editForm.email || ''}
                                                onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <input
                                                type="tel"
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                value={editForm.phone || ''}
                                                onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                value={editForm.address || ''}
                                                onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <input
                                                type="number"
                                                className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                value={editForm.signer_order || ''}
                                                onChange={e => setEditForm({ ...editForm, signer_order: parseInt(e.target.value) || undefined })}
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={editForm.signing_required || false}
                                                onChange={e => setEditForm({ ...editForm, signing_required: e.target.checked })}
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2 text-sm">
                                            <button onClick={() => handleSave(party.id)} className="text-indigo-600 hover:text-indigo-700 font-bold text-xs uppercase">Save</button>
                                            <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-500 font-bold text-xs uppercase">Cancel</button>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-800">{party.display_name}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                                {party.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{party.email}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{party.phone || '--'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600 max-w-[150px] truncate" title={party.address}>{party.address || '--'}</td>
                                        <td className="px-6 py-4 text-center text-sm font-bold text-slate-400">{party.signer_order || '--'}</td>
                                        <td className="px-6 py-4 text-center">
                                            {party.signing_required ?
                                                <i className="fa-solid fa-check-circle text-emerald-500"></i> :
                                                <i className="fa-solid fa-circle text-slate-100"></i>
                                            }
                                        </td>
                                        <td className="px-6 py-4 text-right flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(party)} className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors">
                                                <i className="fa-solid fa-pen text-[10px]"></i>
                                            </button>
                                            <button onClick={() => handleDelete(party.id)} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100 transition-colors">
                                                <i className="fa-solid fa-trash text-[10px]"></i>
                                            </button>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PartiesTab;
