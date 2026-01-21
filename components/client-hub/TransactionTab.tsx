import React, { useState, useEffect } from 'react';
import { Lead, Transaction, TransactionParty, TransactionType, TransactionStatus } from '../../types';
import { createTransaction, getTransactions, updateTransaction, getTransactionByClientId } from '../../services/firebaseService';
import { auth } from '../../services/firebaseService';

interface Props {
    lead: Lead;
    realtorId: string;
}

const TransactionTab: React.FC<Props> = ({ lead, realtorId }) => {
    const [transaction, setTransaction] = useState<Transaction | null>(null);
    const [loading, setLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const fetchTransaction = async () => {
        if (!realtorId || !lead?.id) return;
        setLoading(true);
        try {
            // 1. Precise Query by clientId (Optimized)
            let match = await getTransactionByClientId(lead.id, realtorId);

            // 2. Fallback: Search all realtor transactions if no ID link exists yet (Legacy/Fallback)
            if (!match) {
                const allTransactions = await getTransactions(realtorId);
                match = allTransactions.find(t =>
                    t.property?.address === (lead.subjectProperty || lead.propertyAddress)
                );
            }

            setTransaction(match || null);
        } catch (error) {
            console.error("Error fetching transaction:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransaction();
    }, [lead, realtorId]);

    const handleCreateTransaction = async () => {
        setIsCreating(true);
        try {
            const newTransaction: Transaction = {
                id: '', // Auto-gen
                realtorId,
                clientId: lead.id,
                type: lead.leadType === 'Buyer' ? 'BUY' : lead.leadType === 'Seller' ? 'SELL' : 'OTHER',
                status: 'DRAFT',
                property: {
                    address: lead.subjectProperty || lead.propertyAddress || 'New Property',
                    zpid: lead.zpid // Pass zpid if available
                }, // PropertyData
                apn: '',
                state: 'CA', // Default
                checklist: [],
                important_dates: {},
                created_at: new Date(),
                updated_at: new Date()
            };

            const created = await createTransaction(newTransaction);
            if (created) {
                setTransaction(created);
            }
        } catch (error) {
            console.error("Error creating transaction:", error);
        } finally {
            setIsCreating(false);
        }
    };

    if (loading) {
        return <div className="p-10 text-center text-slate-400">Loading transaction details...</div>;
    }

    if (!transaction) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-indigo-500/5">
                <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center mb-6">
                    <i className="fa-solid fa-file-signature text-3xl text-indigo-500"></i>
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">No Transaction Record</h3>
                <p className="text-slate-500 text-center max-w-sm mb-8">
                    Start a new transaction record for {lead.firstName} to track documents, dates, and signers.
                </p>
                <button
                    onClick={handleCreateTransaction}
                    disabled={isCreating}
                    className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-70"
                >
                    {isCreating ? 'Creating...' : 'Initialize Transaction'}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header / Status Card */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-md">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Transaction Details</h2>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">ID: {transaction.id?.substring(0, 8) || 'unknown'}...</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                Created {transaction.created_at?.toDate ? new Date(transaction.created_at.toDate()).toLocaleDateString() : (transaction.created_at ? new Date(transaction.created_at).toLocaleDateString() : 'Unknown Date')}
                            </span>
                        </div>
                    </div>
                    <div>
                        <span className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest border-2 ${transaction.status === 'CLOSED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            transaction.status === 'CANCELLED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                'bg-indigo-50 text-indigo-600 border-indigo-100'
                            }`}>
                            {transaction.status?.replace('_', ' ') || 'ACTIVE'}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Property Side */}
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                                <i className="fa-solid fa-house text-slate-400 text-xs"></i>
                            </div>
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Property Info</span>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Address</label>
                                <div className="font-bold text-slate-800">{transaction.property?.address || 'N/A'}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Purchase Price</label>
                                    <div className="font-bold text-slate-800">
                                        {transaction.purchase_price ? `$${transaction.purchase_price.toLocaleString()}` : '--'}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Commission</label>
                                    <div className="font-bold text-emerald-600">
                                        {transaction.commission || '--'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Dates Side */}
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                                <i className="fa-solid fa-calendar text-slate-400 text-xs"></i>
                            </div>
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Key Dates</span>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Acceptance</label>
                                    <div className="font-bold text-slate-800">
                                        {transaction.important_dates?.acceptance_date?.toDate ? new Date(transaction.important_dates.acceptance_date.toDate()).toLocaleDateString() : (transaction.important_dates?.acceptance_date ? new Date(transaction.important_dates.acceptance_date).toLocaleDateString() : '--')}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Close of Escrow</label>
                                    <div className="font-bold text-indigo-600">
                                        {transaction.close_of_escrow_date?.toDate ? new Date(transaction.close_of_escrow_date.toDate()).toLocaleDateString() : (transaction.close_of_escrow_date ? new Date(transaction.close_of_escrow_date).toLocaleDateString() : '--')}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Contingency Removal</label>
                                <div className="font-bold text-slate-800">
                                    {transaction.important_dates?.contingency_removal_date?.toDate ? new Date(transaction.important_dates.contingency_removal_date.toDate()).toLocaleDateString() : (transaction.important_dates?.contingency_removal_date ? new Date(transaction.important_dates.contingency_removal_date).toLocaleDateString() : '--')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Logic for Parties, Documents etc would go here */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Parties Preview */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-md">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">Parties</h3>
                        <button className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors">
                            <i className="fa-solid fa-plus text-xs"></i>
                        </button>
                    </div>
                    <div className="space-y-4">
                        <div className="p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold">
                                {lead.firstName.charAt(0)}
                            </div>
                            <div>
                                <div className="text-sm font-bold text-slate-800">{lead.firstName} {lead.lastName}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lead.leadType}</div>
                            </div>
                        </div>
                        {/* Placeholder for other parties */}
                        <div className="text-center py-4 text-xs text-slate-400 italic">No other parties added</div>
                    </div>
                </div>

                {/* Documents Preview */}
                <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-md">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">Recent Documents</h3>
                        <button className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors">
                            View All
                        </button>
                    </div>
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-3xl">
                        <i className="fa-solid fa-cloud-arrow-up text-3xl mb-3 text-slate-300"></i>
                        <span className="text-xs font-medium">No documents uploaded yet</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TransactionTab;
