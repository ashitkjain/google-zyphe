import React, { useState, useEffect } from 'react';
import { Lead, Transaction } from '../../types';
import { createTransaction, getTransactions, getTransactionByClientId } from '../../services/firebaseService';
import GanttChart from './GanttChart';
import { ChecklistCategory } from '../../types/transaction';

interface Props {
    lead: Lead;
    realtorId: string;
    categories: ChecklistCategory[];
    onScrollToPhase: (phaseIndex: number) => void;
    onAddComment: (catId: string, taskId: string, comment: string) => void;
    onUpdateTaskStatus: (catId: string, taskId: string, status: 'Pending' | 'Completed' | 'Rejected') => void;
}

const TransactionTab: React.FC<Props> = ({ lead, realtorId, categories, onScrollToPhase, onAddComment, onUpdateTaskStatus }) => {
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
                purchase_price: 0,
                commission: '0%',
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
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Property Side */}
                <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/60">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-md bg-white border border-slate-200 flex items-center justify-center">
                            <i className="fa-solid fa-house text-slate-400 text-[9px]"></i>
                        </div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Property Info</span>
                    </div>
                    <div className="space-y-2">
                        <div>
                            <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Address</label>
                            <div className="text-xs font-bold text-slate-800 leading-tight">{transaction.property?.address || 'N/A'}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Price</label>
                                <div className="text-xs font-bold text-slate-800">
                                    {transaction.purchase_price ? `$${transaction.purchase_price.toLocaleString()}` : '--'}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Comm.</label>
                                <div className="text-xs font-bold text-emerald-600">
                                    {transaction.commission || '--'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dates Side */}
                <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/60">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-md bg-white border border-slate-200 flex items-center justify-center">
                            <i className="fa-solid fa-calendar-days text-slate-400 text-[9px]"></i>
                        </div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Key Dates</span>
                    </div>
                    <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Acceptance</label>
                                <div className="text-xs font-bold text-slate-800">
                                    {transaction.important_dates?.acceptance_date?.toDate ? new Date(transaction.important_dates.acceptance_date.toDate()).toLocaleDateString() : (transaction.important_dates?.acceptance_date ? new Date(transaction.important_dates.acceptance_date).toLocaleDateString() : '--')}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Closing</label>
                                <div className="text-xs font-bold text-indigo-600">
                                    {transaction.close_of_escrow_date?.toDate ? new Date(transaction.close_of_escrow_date.toDate()).toLocaleDateString() : (transaction.close_of_escrow_date ? new Date(transaction.close_of_escrow_date).toLocaleDateString() : '--')}
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Contingency removal</label>
                            <div className="text-xs font-bold text-slate-800">
                                {transaction.important_dates?.contingency_removal_date?.toDate ? new Date(transaction.important_dates.contingency_removal_date.toDate()).toLocaleDateString() : (transaction.important_dates?.contingency_removal_date ? new Date(transaction.important_dates.contingency_removal_date).toLocaleDateString() : '--')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <GanttChart
                categories={categories}
                onTaskStatusChange={onUpdateTaskStatus}
            />
        </div>
    );
};

export default TransactionTab;
