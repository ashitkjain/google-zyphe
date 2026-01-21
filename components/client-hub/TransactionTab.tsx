import React, { useState, useEffect } from 'react';
import { Lead, Transaction, CRMTask, TaskStatus } from '../../types';
import { createTransaction, getTransactions, getTransactionByClientId, updateTransaction, getTasksByTransactionId, addTasksBatch, updateTask } from '../../services/firebaseService';
import GanttChart, { CategoryWithTasks } from './GanttChart';
import { ChecklistCategory } from '../../types/transaction';

// Checklist Definitions (Static Metadata)
const CHECKLIST_DEFS: ChecklistCategory[] = [
    {
        id: 'c1',
        name: '1. Contract & Initial Review',
        icon: '📁',
        description: 'Tasks that happen right after contract ratification and before ordering anything.'
    },
    {
        id: 'c2',
        name: '4. Title & Ownership',
        icon: '🔍',
        description: 'Tasks focused on confirming title and ownership.'
    },
    {
        id: 'c3',
        name: '2. Financing & Appraisal',
        icon: '🏦',
        description: 'Tasks required for loan and valuation.'
    },
    {
        id: 'c4',
        name: '3. Inspections & Negotiations',
        icon: '🧪',
        description: 'Tasks that deal with property condition and repairs.'
    },
    {
        id: 'c5',
        name: '5. Document Review & Compliance',
        icon: '📜',
        description: 'Tasks where paperwork and legal docs must be checked.'
    },
    {
        id: 'c6',
        name: '6. Final Coordination & Checks',
        icon: '📆',
        description: 'Tasks that happen shortly before closing date.'
    },
    {
        id: 'c7',
        name: '7. Closing Day',
        icon: '🗝️',
        description: 'Tasks due on closing day itself.'
    },
    {
        id: 'c8',
        name: '8. Post-Closing & Client Handoff',
        icon: '📦',
        description: 'Tasks after the deal is officially closed.'
    }
];

// Helper to generate initial task list for a new transaction
const getInitialTasksTemplate = (transactionId: string): Partial<CRMTask>[] => {
    const tasks: Partial<CRMTask>[] = [];
    const common = { transaction_id: transactionId, priority: 'Normal' as const, dueDate: null, realtorId: '' };

    // C1
    tasks.push(
        { ...common, categoryId: 'c1', title: 'Review and understand the sales/purchase contract.', name: 'Review and understand the sales/purchase contract.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
        { ...common, categoryId: 'c1', title: 'Review the property survey (if available).', name: 'Review the property survey (if available).', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] }, // depend on prev logic handled elsewhere or ignored for simplicity in template
        { ...common, categoryId: 'c1', title: 'Review and prepare seller disclosure documents.', name: 'Review and prepare seller disclosure documents.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
        { ...common, categoryId: 'c1', title: 'Submit earnest money deposit to escrow/title company.', name: 'Submit earnest money deposit to escrow/title company.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] }
    );

    // C2
    tasks.push(
        { ...common, categoryId: 'c2', title: 'Obtain a clear title to the property.', name: 'Obtain a clear title to the property.', status: 'Pending', comments: '', durationDays: 20, dependsOn: [] },
        { ...common, categoryId: 'c2', title: 'Conduct title search and resolve title issues.', name: 'Conduct title search and resolve title issues.', status: 'Pending', comments: '', durationDays: 15, dependsOn: [] },
        { ...common, categoryId: 'c2', title: 'Verify title insurance details.', name: 'Verify title insurance details.', status: 'Pending', comments: '', durationDays: 2, dependsOn: [] },
        { ...common, categoryId: 'c2', title: 'Verify chain of title (ownership history).', name: 'Verify chain of title (ownership history).', status: 'Pending', comments: '', durationDays: 3, dependsOn: [] }
    );

    // C3
    tasks.push(
        { ...common, categoryId: 'c3', title: 'Coordinate with lender to ensure loan approval and funds disbursement.', name: 'Coordinate with lender to ensure loan approval and funds disbursement.', status: 'Pending', comments: '', durationDays: 25, dependsOn: [] },
        { ...common, categoryId: 'c3', title: 'Order appraisal.', name: 'Order appraisal.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
        { ...common, categoryId: 'c3', title: 'Appraisal inspection is completed by appraiser.', name: 'Appraisal inspection is completed by appraiser.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
        { ...common, categoryId: 'c3', title: 'Review appraisal report and approvals.', name: 'Review appraisal report and approvals.', status: 'Pending', comments: '', durationDays: 2, dependsOn: [] },
        { ...common, categoryId: 'c3', title: "Verify buyer's financial approval and lender docs.", name: "Verify buyer's financial approval and lender docs.", status: 'Pending', comments: '', durationDays: 5, dependsOn: [] },
        { ...common, categoryId: 'c3', title: "Confirm buyer obtains homeowner's insurance.", name: "Confirm buyer obtains homeowner's insurance.", status: 'Pending', comments: '', durationDays: 5, dependsOn: [] },
        { ...common, categoryId: 'c3', title: 'Buyer submits all final financial documents to lender.', name: 'Buyer submits all final financial documents to lender.', status: 'Pending', comments: '', durationDays: 3, dependsOn: [] }
    );

    // C4
    tasks.push(
        { ...common, categoryId: 'c4', title: 'Schedule and conduct home inspection.', name: 'Schedule and conduct home inspection.', status: 'Pending', comments: '', durationDays: 5, dependsOn: [] },
        { ...common, categoryId: 'c4', title: 'Review inspection report; identify issues.', name: 'Review inspection report; identify issues.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
        { ...common, categoryId: 'c4', title: 'Negotiate repair requests / price adjustments.', name: 'Negotiate repair requests / price adjustments.', status: 'Pending', comments: '', durationDays: 3, dependsOn: [] },
        { ...common, categoryId: 'c4', title: 'Ensure agreed repairs are completed.', name: 'Ensure agreed repairs are completed.', status: 'Pending', comments: '', durationDays: 5, dependsOn: [] }
    );

    // C5
    tasks.push(
        { ...common, categoryId: 'c5', title: 'Prepare and review all closing documents.', name: 'Prepare and review all closing documents.', status: 'Pending', comments: '', durationDays: 3, dependsOn: [] },
        { ...common, categoryId: 'c5', title: 'Review closing costs and verify accuracy.', name: 'Review closing costs and verify accuracy.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
        { ...common, categoryId: 'c5', title: 'Review and sign all closing documents.', name: 'Review and sign all closing documents.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
        { ...common, categoryId: 'c5', title: 'Review and approve final settlement statement.', name: 'Review and approve final settlement statement.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
        { ...common, categoryId: 'c5', title: 'Prepare deed, bill of sale, mortgage note.', name: 'Prepare deed, bill of sale, mortgage note.', status: 'Pending', comments: '', durationDays: 2, dependsOn: [] },
        { ...common, categoryId: 'c5', title: 'Verify HOA fees and property taxes are current.', name: 'Verify HOA fees and property taxes are current.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
        { ...common, categoryId: 'c5', title: 'Ensure mandatory 3-day review period for CD.', name: 'Ensure mandatory 3-day review period for CD.', status: 'Pending', comments: '', durationDays: 3, dependsOn: [] }
    );

    // C6
    tasks.push(
        { ...common, categoryId: 'c6', title: 'Schedule final walk-through inspection.', name: 'Schedule final walk-through inspection.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
        { ...common, categoryId: 'c6', title: 'Confirm time and location of closing meeting.', name: 'Confirm time and location of closing meeting.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
        { ...common, categoryId: 'c6', title: 'Arrange funds for closing.', name: 'Arrange funds for closing.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
        { ...common, categoryId: 'c6', title: 'Arrange utilities transfer/disconnection.', name: 'Arrange utilities transfer/disconnection.', status: 'Pending', comments: '', durationDays: 2, dependsOn: [] },
        { ...common, categoryId: 'c6', title: 'Notify post office of address change.', name: 'Notify post office of address change.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] }
    );

    // C7
    tasks.push(
        { ...common, categoryId: 'c7', title: 'Attend closing meeting with parties.', name: 'Attend closing meeting with parties.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
        { ...common, categoryId: 'c7', title: 'Sign all documents and verify signatures.', name: 'Sign all documents and verify signatures.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
        { ...common, categoryId: 'c7', title: 'Disburse funds & record deed.', name: 'Disburse funds & record deed.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
        { ...common, categoryId: 'c7', title: 'Obtain keys, garage openers, manuals.', name: 'Obtain keys, garage openers, manuals.', status: 'Pending', comments: '', durationDays: 0, dependsOn: [] },
        { ...common, categoryId: 'c7', title: 'Lender confirms funds disbursement.', name: 'Lender confirms funds disbursement.', status: 'Pending', comments: '', durationDays: 0, dependsOn: [] }
    );

    // C8
    tasks.push(
        { ...common, categoryId: 'c8', title: 'Provide buyer with warranties/manuals.', name: 'Provide buyer with warranties/manuals.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
        { ...common, categoryId: 'c8', title: 'Update internal records.', name: 'Update internal records.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
        { ...common, categoryId: 'c8', title: 'Follow-up with lender/client.', name: 'Follow-up with lender/client.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
        { ...common, categoryId: 'c8', title: 'Referral / thank-you outreach.', name: 'Referral / thank-you outreach.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] }
    );

    return tasks;
};

interface Props {
    lead: Lead;
    realtorId: string;
}

const TransactionTab: React.FC<Props> = ({ lead, realtorId }) => {
    const [transaction, setTransaction] = useState<Transaction | null>(null);
    const [loading, setLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [tasks, setTasks] = useState<CRMTask[]>([]);

    const fetchTransaction = async () => {
        if (!realtorId || !lead?.id) return;
        setLoading(true);
        try {
            // 1. Precise Query
            let match = await getTransactionByClientId(lead.id, realtorId);

            // 2. Fallback
            if (!match) {
                const allTransactions = await getTransactions(realtorId);
                match = allTransactions.find(t =>
                    t.property?.address === (lead.subjectProperty || lead.propertyAddress)
                );
            }

            setTransaction(match || null);

            // Fetch Tasks if transaction exists
            if (match) {
                const fetchedTasks = await getTasksByTransactionId(match.id);
                setTasks(fetchedTasks);
            } else {
                setTasks([]);
            }
        } catch (error) {
            console.error("Error fetching transaction:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransaction();
    }, [lead, realtorId]);

    // Construct derived info for Gantt (merging categories + tasks)
    const derivedCategories: CategoryWithTasks[] = React.useMemo(() => {
        return CHECKLIST_DEFS.map(cat => ({
            ...cat,
            tasks: tasks.filter(t => t.categoryId === cat.id)
        }));
    }, [tasks]);

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
                checklist: [] as any, // Checklist is now managed separately via Tasks table
                important_dates: {},
                created_at: new Date(),
                updated_at: new Date()
            };

            const created = await createTransaction(newTransaction);
            if (created) {
                setTransaction(created);

                // Create Initial Tasks
                const initialTasks = getInitialTasksTemplate(created.id);
                await addTasksBatch(initialTasks);

                // Refresh tasks from DB to get generated IDs
                const fetchedTasks = await getTasksByTransactionId(created.id);
                setTasks(fetchedTasks);
            }
        } catch (error) {
            console.error("Error creating transaction:", error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleUpdateTaskStatus = async (catId: string, taskId: string, status: 'Pending' | 'Completed' | 'Rejected') => {
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: status as TaskStatus } : t));

        try {
            await updateTask(taskId, { status: status as TaskStatus });
        } catch (err) {
            console.error("Failed to update task status:", err);
            // Revert or fetch could happen here
        }
    };

    const handleAddTaskComment = async (catId: string, taskId: string, comment: string) => {
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, comments: comment } : t));

        try {
            await updateTask(taskId, { comments: comment });
        } catch (err) {
            console.error("Failed to update task comment:", err);
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
                categories={derivedCategories}
                onTaskStatusChange={handleUpdateTaskStatus}
                onAddComment={handleAddTaskComment}
            />
        </div>
    );
};

export default TransactionTab;
