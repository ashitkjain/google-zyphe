import React, { useState, useEffect } from 'react';
import { Lead, Transaction } from '../../types';
import { createTransaction, getTransactions, getTransactionByClientId, updateTransaction, addTask } from '../../services/firebaseService';
import GanttChart from './GanttChart';
import { ChecklistCategory } from '../../types/transaction';

// Initial categories for the checklist
const getInitialCategories = (): ChecklistCategory[] => [
    {
        id: 'c1',
        name: '1. Contract & Initial Review',
        icon: '📁',
        description: 'Tasks that happen right after contract ratification and before ordering anything.',
        tasks: [
            { id: 't1_1', name: 'Review and understand the sales/purchase contract.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
            { id: 't1_2', name: 'Review the property survey (if available).', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t1_1'] },
            { id: 't1_3', name: 'Review and prepare seller disclosure documents.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t1_1'] },
            { id: 't1_4', name: 'Submit earnest money deposit to escrow/title company.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t1_1'] }
        ]
    },
    {
        id: 'c2',
        name: '4. Title & Ownership',
        icon: '🔍',
        description: 'Tasks focused on confirming title and ownership.',
        tasks: [
            { id: 't2_1', name: 'Obtain a clear title to the property.', status: 'Pending', comments: '', durationDays: 20, dependsOn: ['t1_4'] },
            { id: 't2_2', name: 'Conduct title search and resolve title issues.', status: 'Pending', comments: '', durationDays: 15, dependsOn: ['t1_4'] }, // Overlaps with t2_1
            { id: 't2_3', name: 'Verify title insurance details.', status: 'Pending', comments: '', durationDays: 2, dependsOn: ['t2_1'] },
            { id: 't2_4', name: 'Verify chain of title (ownership history).', status: 'Pending', comments: '', durationDays: 3, dependsOn: ['t2_2'] },
        ]
    },
    {
        id: 'c3',
        name: '2. Financing & Appraisal',
        icon: '🏦',
        description: 'Tasks required for loan and valuation.',
        tasks: [
            { id: 't3_1', name: 'Coordinate with lender to ensure loan approval and funds disbursement.', status: 'Pending', comments: '', durationDays: 25, dependsOn: ['t1_1'] },
            { id: 't3_2', name: 'Order appraisal.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t3_1'] },
            { id: 't3_3', name: 'Appraisal inspection is completed by appraiser.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t3_2'] },
            { id: 't3_4', name: 'Review appraisal report and approvals.', status: 'Pending', comments: '', durationDays: 2, dependsOn: ['t3_3'] },
            { id: 't3_5', name: "Verify buyer's financial approval and lender docs.", status: 'Pending', comments: '', durationDays: 5, dependsOn: ['t3_4'] },
            { id: 't3_6', name: "Confirm buyer obtains homeowner's insurance.", status: 'Pending', comments: '', durationDays: 5, dependsOn: ['t3_5'] },
            { id: 't3_7', name: 'Buyer submits all final financial documents to lender (pay stubs, bank statements).', status: 'Pending', comments: '', durationDays: 3, dependsOn: ['t3_1'] }
        ]
    },
    {
        id: 'c4',
        name: '3. Inspections & Negotiations',
        icon: '🧪',
        description: 'Tasks that deal with property condition and repairs.',
        tasks: [
            { id: 't4_1', name: 'Schedule and conduct home inspection.', status: 'Pending', comments: '', durationDays: 5, dependsOn: ['t1_1'] },
            { id: 't4_2', name: 'Review inspection report; identify issues.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t4_1'] },
            { id: 't4_3', name: 'Negotiate repair requests / price adjustments.', status: 'Pending', comments: '', durationDays: 3, dependsOn: ['t4_2'] },
            { id: 't4_4', name: 'Ensure agreed repairs are completed.', status: 'Pending', comments: '', durationDays: 5, dependsOn: ['t4_3'] },
        ]
    },
    {
        id: 'c5',
        name: '5. Document Review & Compliance',
        icon: '📜',
        description: 'Tasks where paperwork and legal docs must be checked.',
        tasks: [
            { id: 't5_1', name: 'Prepare and review all closing documents (HUD-1, disclosures, settlement).', status: 'Pending', comments: '', durationDays: 3, dependsOn: ['t2_1', 't3_5'] },
            { id: 't5_2', name: 'Review closing costs and verify accuracy.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t5_1'] },
            { id: 't5_3', name: 'Review and sign all closing documents.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t5_2', 't5_5'] },
            { id: 't5_4', name: 'Review and approve final settlement statement.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t5_2'] },
            { id: 't5_5', name: 'Prepare deed, bill of sale, mortgage note, lien releases, title insurance docs.', status: 'Pending', comments: '', durationDays: 2, dependsOn: ['t2_3'] },
            { id: 't5_6', name: 'Verify HOA fees and property taxes are current.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t2_1'] },
            { id: 't5_7', name: 'Ensure mandatory 3-day review period for Closing Disclosure (CD) is enforced/tracked.', status: 'Pending', comments: '', durationDays: 3, dependsOn: ['t5_1'] }
        ]
    },
    {
        id: 'c6',
        name: '6. Final Coordination & Checks',
        icon: '📆',
        description: 'Tasks that happen shortly before closing date.',
        tasks: [
            { id: 't6_1', name: 'Schedule final walk-through inspection.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t4_4', 't5_7'] },
            { id: 't6_2', name: 'Confirm time and location of closing meeting.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t5_7'] },
            { id: 't6_3', name: 'Arrange funds for closing (wire, certified check).', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t5_4'] },
            { id: 't6_4', name: 'Arrange utilities transfer/disconnection.', status: 'Pending', comments: '', durationDays: 2, dependsOn: ['t6_2'] },
            { id: 't6_5', name: 'Notify post office & relevant parties of address change.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t6_2'] },
        ]
    },
    {
        id: 'c7',
        name: '7. Closing Day',
        icon: '🗝️',
        description: 'Tasks due on closing day itself.',
        tasks: [
            { id: 't7_1', name: 'Attend closing meeting with parties.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t6_1', 't6_2', 't6_3'] },
            { id: 't7_2', name: 'Sign all documents and verify signatures.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t7_1'] },
            { id: 't7_3', name: 'Disburse funds & record deed.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t7_2'] },
            { id: 't7_4', name: 'Obtain keys, garage openers, manuals.', status: 'Pending', comments: '', durationDays: 0, dependsOn: ['t7_3'] },
            { id: 't7_5', name: 'Lender confirms funds disbursement and wire transfer.', status: 'Pending', comments: '', durationDays: 0, dependsOn: ['t7_3'] }
        ]
    },
    {
        id: 'c8',
        name: '8. Post-Closing & Client Handoff',
        icon: '📦',
        description: 'Tasks after the deal is officially closed.',
        tasks: [
            { id: 't8_1', name: 'Provide buyer with warranties, manuals, local service info.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t7_4'] },
            { id: 't8_2', name: 'Update your internal records with new ownership.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t8_1'] },
            { id: 't8_3', name: 'Follow-up with lender, title, and client.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t8_2'] },
            { id: 't8_4', name: 'Referral / thank-you outreach.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t8_3'] },
        ]
    }
];

interface Props {
    lead: Lead;
    realtorId: string;
}

const TransactionTab: React.FC<Props> = ({ lead, realtorId }) => {
    const [transaction, setTransaction] = useState<Transaction | null>(null);
    const [loading, setLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [categories, setCategories] = useState<ChecklistCategory[]>(getInitialCategories());

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

            // Initialize categories from transaction if exists
            if (match && match.checklist && match.checklist.length > 0) {
                // Simple check if it matches the expected structure
                // Using 'any' cast to avoid strict type mismatch if ChecklistCategory vs CRMTask differs
                setCategories(match.checklist as any);
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

    const handleCreateTransaction = async () => {
        setIsCreating(true);
        try {
            const initialCats = getInitialCategories();
            const newTransaction: Transaction = {
                id: '', // Auto-generated by createTransaction
                realtorId,
                clientId: lead.id,
                type: lead.leadType === 'Buyer' ? 'BUY' : lead.leadType === 'Seller' ? 'SELL' : 'OTHER',
                status: 'DRAFT',
                property: {
                    address: lead.subjectProperty || lead.propertyAddress || 'New Property',
                    zpid: lead.zpid
                },
                purchase_price: 0,
                commission: '0%',
                apn: '',
                state: 'CA',
                checklist: [], // Will populate after task creation
                important_dates: {},
                created_at: new Date(),
                updated_at: new Date()
            };

            const createdTx = await createTransaction(newTransaction);
            if (!createdTx) throw new Error("Failed to create transaction record.");

            // Sequential Task Creation & Scheduling
            const oldIdToNewId: Record<string, string> = {};
            const taskEnds: Record<string, Date> = {};
            const baseDate = new Date();
            const finalChecklist: ChecklistCategory[] = [];

            for (const cat of initialCats) {
                const updatedTasks: any[] = [];
                for (const t of cat.tasks) {
                    // 1. Calculate scheduling (DueDate)
                    let maxDepEnd = new Date(baseDate);
                    if (t.dependsOn && t.dependsOn.length > 0) {
                        t.dependsOn.forEach(depId => {
                            if (taskEnds[depId] && taskEnds[depId] > maxDepEnd) {
                                maxDepEnd = new Date(taskEnds[depId]);
                            }
                        });
                    }

                    const dueDate = new Date(maxDepEnd);
                    dueDate.setDate(dueDate.getDate() + (t.durationDays || 0));
                    taskEnds[t.id] = dueDate;

                    // 2. Prepare CRMTask for separate 'tasks' collection
                    const newTaskObj: any = {
                        realtorId,
                        clientId: lead.id,
                        transaction_id: createdTx.id,
                        name: t.name,
                        comment: t.comments || '',
                        status: 'Pending',
                        priority: 'Normal',
                        startDate: maxDepEnd,
                        dueDate: dueDate,
                        createDate: new Date(),
                        dependsOn: t.dependsOn?.map(oid => oldIdToNewId[oid] || oid) || []
                    };

                    // 3. Persist individual CRMTask
                    const newId = await addTask(newTaskObj);
                    if (newId) {
                        oldIdToNewId[t.id] = newId;
                        updatedTasks.push({
                            ...t,
                            id: newId,
                            dependsOn: newTaskObj.dependsOn
                        });
                    } else {
                        updatedTasks.push(t); // Fallback
                    }
                }
                finalChecklist.push({ ...cat, tasks: updatedTasks });
            }

            // 4. Update the Transaction with the mapped checklist
            await updateTransaction(createdTx.id, { checklist: finalChecklist as any });

            setTransaction({ ...createdTx, checklist: finalChecklist as any });
            setCategories(finalChecklist);

        } catch (error) {
            console.error("Error creating transaction:", error);
        } finally {
            setIsCreating(false);
        }
    };

    // Handlers for Gantt Chart interactions with Persistence
    const updateCategoriesAndPersist = async (newCategories: ChecklistCategory[]) => {
        setCategories(newCategories);
        if (transaction) {
            try {
                // Save to Firebase
                await updateTransaction(transaction.id, { checklist: newCategories as any });
            } catch (err) {
                console.error("Failed to persist checklist:", err);
            }
        }
    };

    const handleUpdateTaskStatus = (catId: string, taskId: string, status: 'Pending' | 'Completed' | 'Rejected') => {
        const newCats = categories.map(cat => {
            if (cat.id !== catId) return cat;
            return {
                ...cat,
                tasks: cat.tasks.map(t => t.id === taskId ? { ...t, status } : t)
            };
        });
        updateCategoriesAndPersist(newCats);
    };

    const handleAddTaskComment = (catId: string, taskId: string, comment: string) => {
        const newCats = categories.map(cat => {
            if (cat.id !== catId) return cat;
            return {
                ...cat,
                tasks: cat.tasks.map(t => t.id === taskId ? { ...t, comments: comment } : t)
            };
        });
        updateCategoriesAndPersist(newCats);
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
                onTaskStatusChange={handleUpdateTaskStatus}
                onAddComment={handleAddTaskComment}
            />
        </div>
    );
};

export default TransactionTab;
