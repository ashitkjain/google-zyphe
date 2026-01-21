import React, { useState, useMemo } from 'react';
import { Lead, Transaction } from '../../types';
import TransactionTab from './TransactionTab';
import PartiesTab from './PartiesTab';
import TransactionWizard from './TransactionWizard';
import { ChecklistCategory } from '../../types/transaction';
import TransactionTimeline from './TransactionTimeline';

interface ClosingDashboardProps {
    leads: Lead[];
    onUpdateLead?: (leadId: string, updates: Partial<Lead>) => void;
    realtorId: string;
}

interface DocItem {
    id: string;
    name: string;
    status: 'Pending' | 'Completed' | 'Rejected';
    comments: string;
}

const getStatusBadgeColor = (status: string) => {
    switch (status) {
        case 'Pending': return 'bg-rose-100 text-rose-600 border-rose-200';
        case 'Completed': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
        default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
};

// Default documentation checklist for a transaction
const getDefaultDocumentation = (): DocItem[] => [
    { id: 'doc_1', name: 'Purchase Contract', status: 'Pending', comments: '' },
    { id: 'doc_2', name: 'Listing Agreement', status: 'Pending', comments: '' },
    { id: 'doc_3', name: 'EMD', status: 'Pending', comments: '' },
    { id: 'doc_4', name: 'Disclosures', status: 'Pending', comments: '' },
    { id: 'doc_5', name: 'Inspections', status: 'Pending', comments: '' },
];

// Initial categories for the checklist
const getInitialCategories = (): ChecklistCategory[] => [
    {
        id: 'c1',
        name: '1. Contract & Initial Review',
        icon: '📁',
        description: 'Tasks that happen right after contract ratification and before ordering anything.',
        tasks: [
            { id: 't1_1', name: 'Review and understand the sales/purchase contract.', status: 'Pending', comments: '' },
            { id: 't1_2', name: 'Review the property survey (if available).', status: 'Pending', comments: '' },
            { id: 't1_3', name: 'Review and prepare seller disclosure documents.', status: 'Pending', comments: '' },
        ]
    },
    {
        id: 'c2',
        name: '2. Title & Ownership',
        icon: '🔍',
        description: 'Tasks focused on confirming title and ownership.',
        tasks: [
            { id: 't2_1', name: 'Obtain a clear title to the property.', status: 'Pending', comments: '' },
            { id: 't2_2', name: 'Conduct title search and resolve title issues.', status: 'Pending', comments: '' },
            { id: 't2_3', name: 'Verify title insurance details.', status: 'Pending', comments: '' },
            { id: 't2_4', name: 'Verify chain of title (ownership history).', status: 'Pending', comments: '' },
        ]
    },
    {
        id: 'c3',
        name: '3. Financing & Appraisal',
        icon: '🏦',
        description: 'Tasks required for loan and valuation.',
        tasks: [
            { id: 't3_1', name: 'Coordinate with lender to ensure loan approval and funds disbursement.', status: 'Pending', comments: '' },
            { id: 't3_2', name: 'Order appraisal.', status: 'Pending', comments: '' },
            { id: 't3_3', name: 'Review appraisal report and approvals.', status: 'Pending', comments: '' },
            { id: 't3_4', name: "Verify buyer's financial approval and lender docs.", status: 'Pending', comments: '' },
            { id: 't3_5', name: "Confirm buyer obtains homeowner's insurance.", status: 'Pending', comments: '' },
        ]
    },
    {
        id: 'c4',
        name: '4. Inspections & Negotiations',
        icon: '🧪',
        description: 'Tasks that deal with property condition and repairs.',
        tasks: [
            { id: 't4_1', name: 'Schedule and conduct home inspection.', status: 'Pending', comments: '' },
            { id: 't4_2', name: 'Review inspection report; identify issues.', status: 'Pending', comments: '' },
            { id: 't4_3', name: 'Negotiate repair requests / price adjustments.', status: 'Pending', comments: '' },
            { id: 't4_4', name: 'Ensure agreed repairs are completed.', status: 'Pending', comments: '' },
        ]
    },
    {
        id: 'c5',
        name: '5. Document Review & Compliance',
        icon: '📜',
        description: 'Tasks where paperwork and legal docs must be checked.',
        tasks: [
            { id: 't5_1', name: 'Prepare and review all closing documents (HUD-1, disclosures, settlement).', status: 'Pending', comments: '' },
            { id: 't5_2', name: 'Review closing costs and verify accuracy.', status: 'Pending', comments: '' },
            { id: 't5_3', name: 'Review and sign all closing documents.', status: 'Pending', comments: '' },
            { id: 't5_4', name: 'Review and approve final settlement statement.', status: 'Pending', comments: '' },
            { id: 't5_5', name: 'Prepare deed, bill of sale, mortgage note, lien releases, title insurance docs.', status: 'Pending', comments: '' },
            { id: 't5_6', name: 'Verify HOA fees and property taxes are current.', status: 'Pending', comments: '' },
        ]
    },
    {
        id: 'c6',
        name: '6. Final Coordination & Checks',
        icon: '📆',
        description: 'Tasks that happen shortly before closing date.',
        tasks: [
            { id: 't6_1', name: 'Schedule final walk-through inspection.', status: 'Pending', comments: '' },
            { id: 't6_2', name: 'Confirm time and location of closing meeting.', status: 'Pending', comments: '' },
            { id: 't6_3', name: 'Arrange funds for closing (wire, certified check).', status: 'Pending', comments: '' },
            { id: 't6_4', name: 'Arrange utilities transfer/disconnection.', status: 'Pending', comments: '' },
            { id: 't6_5', name: 'Notify post office & relevant parties of address change.', status: 'Pending', comments: '' },
        ]
    },
    {
        id: 'c7',
        name: '7. Closing Day',
        icon: '🗝️',
        description: 'Tasks due on closing day itself.',
        tasks: [
            { id: 't7_1', name: 'Attend closing meeting with parties.', status: 'Pending', comments: '' },
            { id: 't7_2', name: 'Sign all documents and verify signatures.', status: 'Pending', comments: '' },
            { id: 't7_3', name: 'Disburse funds & record deed.', status: 'Pending', comments: '' },
            { id: 't7_4', name: 'Obtain keys, garage openers, manuals.', status: 'Pending', comments: '' },
        ]
    },
    {
        id: 'c8',
        name: '8. Post-Closing & Client Handoff',
        icon: '📦',
        description: 'Tasks after the deal is officially closed.',
        tasks: [
            { id: 't8_1', name: 'Provide buyer with warranties, manuals, local service info.', status: 'Pending', comments: '' },
            { id: 't8_2', name: 'Update your internal records with new ownership.', status: 'Pending', comments: '' },
            { id: 't8_3', name: 'Follow-up with lender, title, and client.', status: 'Pending', comments: '' },
            { id: 't8_4', name: 'Referral / thank-you outreach.', status: 'Pending', comments: '' },
        ]
    }
];

const ClosingDashboard: React.FC<ClosingDashboardProps> = ({ leads, onUpdateLead, realtorId }) => {
    const [showWizard, setShowWizard] = useState(false);
    // Filter leads that are in closing stage (funnelStage === 'Contract' or status === 'In Contract')
    const closingLeads = useMemo(() => {
        return leads.filter(lead =>
            lead.funnelStage === 'Contract' ||
            lead.status === 'In Contract'
        );
    }, [leads]);

    const [activeLeadId, setActiveLeadId] = useState<string | null>(
        closingLeads.length > 0 ? closingLeads[0].id : null
    );

    // Update activeLeadId when closingLeads changes
    React.useEffect(() => {
        if (closingLeads.length > 0) {
            if (!activeLeadId || !closingLeads.find(l => l.id === activeLeadId)) {
                setActiveLeadId(closingLeads[0].id);
            }
        } else {
            setActiveLeadId(null);
        }
    }, [closingLeads, activeLeadId]);

    const activeLead = closingLeads.find(l => l.id === activeLeadId) || null;

    const [activeSubTab, setActiveSubTab] = useState('CHECKLIST');

    const subTabs = ['TRANSACTION', 'PARTIES', 'CHECKLIST', 'DOCUMENTS', 'LOG', 'TASKS', 'PROPERTY'];

    // Checklist categories state - shared between Timeline and ChecklistSection
    const [categories, setCategories] = useState<ChecklistCategory[]>(getInitialCategories());

    // Manual phase override state - allows agent to manually control the timeline
    const [manualPhaseOverride, setManualPhaseOverride] = useState<number | null>(null);

    // Expanded categories state for the checklist
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['c1']));

    // Scroll to a specific phase/category in the checklist
    const handleScrollToPhase = (phaseIndex: number) => {
        setActiveSubTab('CHECKLIST');
        const categoryId = `c${phaseIndex + 1}`;
        setExpandedCategories(prev => new Set([...prev, categoryId]));
        // Scroll to the category element after a brief delay to allow render
        setTimeout(() => {
            const element = document.getElementById(`category-${categoryId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    };

    const toggleCategory = (id: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const updateTaskStatus = (catId: string, taskId: string, status: 'Pending' | 'Completed' | 'Rejected') => {
        setCategories(prev => prev.map(cat => {
            if (cat.id !== catId) return cat;
            return {
                ...cat,
                tasks: cat.tasks.map(t => t.id === taskId ? { ...t, status } : t)
            };
        }));
    };

    const addTaskComment = (catId: string, taskId: string, comment: string) => {
        setCategories(prev => prev.map(cat => {
            if (cat.id !== catId) return cat;
            return {
                ...cat,
                tasks: cat.tasks.map(t => t.id === taskId ? { ...t, comments: comment } : t)
            };
        }));
    };

    const updateTaskEmoji = (catId: string, taskId: string, emoji: string) => {
        setCategories(prev => prev.map(cat => {
            if (cat.id !== catId) return cat;
            return {
                ...cat,
                tasks: cat.tasks.map(t => t.id === taskId ? { ...t, emoji } : t)
            };
        }));
    };

    // Empty state when no clients in closing
    if (closingLeads.length === 0) {
        return (
            <div className="flex-1 overflow-y-auto bg-slate-50 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
                    <div className="w-32 h-32 rounded-full bg-slate-100 flex items-center justify-center mb-8 border border-slate-200">
                        <i className="fa-solid fa-file-invoice-dollar text-5xl text-slate-300"></i>
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4">No Clients In Closing</h2>
                    <p className="text-slate-500 text-lg max-w-md mb-8">
                        When clients move to the "In Contract" status, they will appear here for transaction management.
                    </p>
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                        <i className="fa-solid fa-lightbulb text-amber-400"></i>
                        <span>Move a client to "In Contract" status in the Funnel tab to get started</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Client Tabs */}
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {closingLeads.map(lead => (
                        <button
                            key={lead.id}
                            onClick={() => setActiveLeadId(lead.id)}
                            className={`flex items-center gap-3 px-5 py-3 rounded-2xl border-2 transition-all flex-shrink-0 group ${activeLeadId === lead.id
                                ? 'bg-white border-indigo-500 shadow-lg shadow-indigo-500/10'
                                : 'bg-white/50 border-slate-200 hover:border-slate-300 hover:bg-white'
                                }`}
                        >
                            <div className="w-10 h-10 rounded-xl overflow-hidden border border-white shadow-sm flex-shrink-0">
                                {lead.avatarUrl ? (
                                    <img src={lead.avatarUrl} alt={lead.firstName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                                        {lead.firstName?.charAt(0) || ''}{lead.lastName?.charAt(0) || ''}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col items-start">
                                <span className={`font-bold text-sm tracking-tight ${activeLeadId === lead.id ? 'text-slate-900' : 'text-slate-600'}`}>
                                    {lead.firstName} {lead.lastName}
                                </span>
                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                    {lead.leadType}
                                </span>
                            </div>
                            {activeLeadId === lead.id && (
                                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse ml-1"></div>
                            )}
                        </button>
                    ))}
                </div>

                {activeLead && (
                    <>
                        {/* Sub Navigation */}
                        <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar mb-8">
                            {subTabs.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveSubTab(tab)}
                                    className={`px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${activeSubTab === tab ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {tab}
                                    {activeSubTab === tab && (
                                        <div className="absolute bottom-0 left-6 right-6 h-1 bg-indigo-600 rounded-t-full shadow-[0_-2px_8px_rgba(79,70,229,0.3)]"></div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Header Section */}

                        {/* Documentation / Checklist Section */}
                        <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-indigo-500/5 overflow-hidden">
                            {activeSubTab !== 'TRANSACTION' && activeSubTab !== 'CHECKLIST' && (
                                <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <div className="flex items-center gap-4">
                                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                            {activeSubTab === 'CHECKLIST' ? 'Transaction Checklist' :
                                                activeSubTab === 'PARTIES' ? 'Transaction Parties' :
                                                    activeSubTab === 'TRANSACTION' ? 'Transaction Record' :
                                                        'Documentation'}
                                        </h2>
                                    </div>
                                </div>
                            )}

                            <div className={activeSubTab === 'TRANSACTION' ? 'p-6' : 'p-10'}>
                                {activeSubTab === 'TRANSACTION' && (
                                    <TransactionTab
                                        lead={activeLead}
                                        realtorId={realtorId}
                                        categories={categories}
                                        onScrollToPhase={handleScrollToPhase}
                                        onAddComment={addTaskComment}
                                    />
                                )}

                                {activeSubTab === 'PARTIES' && (
                                    <PartiesTab lead={activeLead} realtorId={realtorId} />
                                )}

                                {activeSubTab === 'CHECKLIST' && (
                                    <ChecklistSection
                                        categories={categories}
                                        expandedCategories={expandedCategories}
                                        onToggleCategory={toggleCategory}
                                        onUpdateTaskStatus={updateTaskStatus}
                                        onUpdateTaskEmoji={updateTaskEmoji}
                                        onUpdateTaskComment={addTaskComment}
                                    />
                                )}

                                {activeSubTab !== 'CHECKLIST' && activeSubTab !== 'TRANSACTION' && activeSubTab !== 'PARTIES' && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                                                <tr>
                                                    <th className="px-10 py-5 w-20">#</th>
                                                    <th className="px-10 py-5">Documentation</th>
                                                    <th className="px-10 py-5">Status</th>
                                                    <th className="px-10 py-5 text-center">Docs</th>
                                                    <th className="px-10 py-5">Comments</th>
                                                    <th className="px-10 py-5 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {getDefaultDocumentation().map((doc, idx) => (
                                                    <tr key={doc.id} className="group hover:bg-slate-50/50 transition-all">
                                                        <td className="px-10 py-6 text-sm font-black text-slate-300">{idx + 1}.</td>
                                                        <td className="px-10 py-6 text-sm font-bold text-slate-800">{doc.name}</td>
                                                        <td className="px-10 py-6">
                                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusBadgeColor(doc.status)}`}>
                                                                {doc.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-10 py-6 text-center">
                                                            <button className="text-slate-400 hover:text-indigo-600 transition-all p-2 rounded-xl hover:bg-indigo-50">
                                                                <i className="fa-solid fa-paperclip text-lg"></i>
                                                            </button>
                                                        </td>
                                                        <td className="px-10 py-6">
                                                            <input
                                                                type="text"
                                                                placeholder="Add a comment..."
                                                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                                            />
                                                        </td>
                                                        <td className="px-10 py-6 text-right">
                                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                                <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-600/20">Save</button>
                                                                <button className="px-4 py-2 bg-white border border-slate-200 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50">Cancel</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {showWizard && (
                <TransactionWizard
                    leads={leads}
                    realtorId={realtorId}
                    onClose={() => setShowWizard(false)}
                    onComplete={(tx) => {
                        setShowWizard(false);
                        // In a real app we might redirect or refresh
                        alert(`Transaction ${tx.id} created successfully!`);
                    }}
                />
            )}
        </div>
    );
};


interface ChecklistSectionProps {
    categories: ChecklistCategory[];
    expandedCategories: Set<string>;
    onToggleCategory: (id: string) => void;
    onUpdateTaskStatus: (catId: string, taskId: string, status: 'Pending' | 'Completed' | 'Rejected') => void;
    onUpdateTaskEmoji?: (catId: string, taskId: string, emoji: string) => void;
    onUpdateTaskComment?: (catId: string, taskId: string, comment: string) => void;
}

const commonEmojis = ['✅', '🚧', '❗', '📍', '🏠', '🔑', '📝', '📞', '💰', '📅', '🎉'];

const ChecklistSection: React.FC<ChecklistSectionProps> = ({
    categories,
    expandedCategories,
    onToggleCategory,
    onUpdateTaskStatus,
    onUpdateTaskEmoji,
    onUpdateTaskComment
}) => {
    return (
        <div className="space-y-6 text-left">
            {categories.map(cat => (
                <div
                    key={cat.id}
                    id={`category-${cat.id}`}
                    className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm scroll-mt-4"
                >
                    <button
                        onClick={() => onToggleCategory(cat.id)}
                        className={`w-full px-8 py-6 flex items-center justify-between transition-all ${expandedCategories.has(cat.id) ? 'bg-indigo-50/30' : 'bg-white hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-4 text-left">
                            <span className="text-2xl">{cat.icon}</span>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">{cat.name}</h3>
                                <p className="text-xs font-medium text-slate-500 mt-0.5">{cat.description}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end mr-4">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress</span>
                                <span className="text-sm font-black text-indigo-600">
                                    {cat.tasks.filter(t => t.status === 'Completed').length}/{cat.tasks.length}
                                </span>
                            </div>
                            {/* Completion badge */}
                            {cat.tasks.length > 0 && cat.tasks.every(t => t.status === 'Completed') && (
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-200">
                                    ✓ Complete
                                </span>
                            )}
                            <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform duration-300 ${expandedCategories.has(cat.id) ? 'rotate-180' : ''}`}></i>
                        </div>
                    </button>

                    {expandedCategories.has(cat.id) && (
                        <div className="border-t border-slate-100 overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-3 w-16 text-center">Icon</th>
                                        <th className="px-8 py-3 w-16">Status</th>
                                        <th className="px-8 py-3">Task Description</th>
                                        <th className="px-8 py-3">Comments</th>
                                        <th className="px-8 py-3 text-right">Update</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {cat.tasks.map(task => (
                                        <tr key={task.id} className="group hover:bg-slate-50/30">
                                            <td className="px-8 py-6">
                                                <div className="relative flex justify-center group/emoji">
                                                    <button className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-lg hover:border-indigo-500 transition-all">
                                                        {task.emoji || '+'}
                                                    </button>
                                                    {/* Simple emoji picker on hover */}
                                                    <div className="absolute top-0 left-full ml-2 z-20 hidden group-hover/emoji:flex items-center gap-1 bg-white p-2 rounded-xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-left-2">
                                                        {commonEmojis.map(emoji => (
                                                            <button
                                                                key={emoji}
                                                                onClick={() => onUpdateTaskEmoji?.(cat.id, task.id, emoji)}
                                                                className="w-8 h-8 rounded-lg hover:bg-indigo-50 flex items-center justify-center transition-colors"
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                        <button
                                                            onClick={() => onUpdateTaskEmoji?.(cat.id, task.id, '')}
                                                            className="w-8 h-8 rounded-lg hover:bg-rose-50 flex items-center justify-center text-rose-500 transition-colors"
                                                        >
                                                            <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 mx-auto ${task.status === 'Completed' ? 'bg-emerald-100 border-emerald-500 text-emerald-600' :
                                                    task.status === 'Rejected' ? 'bg-rose-100 border-rose-500 text-rose-600' :
                                                        'bg-orange-50 border-orange-200 text-orange-400'
                                                    }`}>
                                                    <i className={`fa-solid ${task.status === 'Completed' ? 'fa-check' :
                                                        task.status === 'Rejected' ? 'fa-xmark' :
                                                            'fa-clock'
                                                        } text-xs`}></i>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col gap-1">
                                                    <p className={`text-sm font-bold ${task.status === 'Completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                                        {task.name}
                                                    </p>
                                                    {task.comments && (
                                                        <div className="relative group/taskcomment">
                                                            <div className="flex items-center gap-1.5 text-indigo-500 animate-in fade-in slide-in-from-left-1 duration-300 cursor-help">
                                                                <i className="fa-solid fa-comment-dots text-[10px]"></i>
                                                                <span className="text-[10px] font-black uppercase tracking-widest">Commented</span>
                                                            </div>

                                                            {/* Hover Overlay for Task Comment */}
                                                            <div className="absolute bottom-full left-0 mb-3 w-72 bg-slate-900 text-white rounded-2xl shadow-2xl p-4 hidden group-hover/taskcomment:block animate-in fade-in slide-in-from-bottom-2 duration-200 z-[60]">
                                                                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700/50">
                                                                    <i className="fa-solid fa-quote-left text-indigo-400 text-xs"></i>
                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Task Note</span>
                                                                </div>
                                                                <p className="text-xs font-medium leading-relaxed text-slate-200">
                                                                    {task.comments}
                                                                </p>
                                                                <div className="absolute -bottom-1.5 left-6 w-3 h-3 bg-slate-900 rotate-45"></div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <input
                                                    type="text"
                                                    value={task.comments}
                                                    onChange={(e) => onUpdateTaskComment?.(cat.id, task.id, e.target.value)}
                                                    placeholder="Task notes..."
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-slate-700 hover:bg-white"
                                                />
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => onUpdateTaskStatus(cat.id, task.id, 'Completed')}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${task.status === 'Completed' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-white border border-slate-200 text-slate-400 hover:border-emerald-500 hover:text-emerald-500'}`}
                                                        title="Complete"
                                                    >
                                                        <i className="fa-solid fa-check text-[10px]"></i>
                                                    </button>
                                                    <button
                                                        onClick={() => onUpdateTaskStatus(cat.id, task.id, 'Rejected')}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${task.status === 'Rejected' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' : 'bg-white border border-slate-200 text-slate-400 hover:border-rose-500 hover:text-rose-500'}`}
                                                        title="Reject"
                                                    >
                                                        <i className="fa-solid fa-xmark text-[10px]"></i>
                                                    </button>
                                                    <button
                                                        onClick={() => onUpdateTaskStatus(cat.id, task.id, 'Pending')}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${task.status === 'Pending' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'bg-white border border-slate-200 text-slate-400 hover:border-orange-500 hover:text-orange-500'}`}
                                                        title="Set Pending"
                                                    >
                                                        <i className="fa-solid fa-clock text-[10px]"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const DetailItem: React.FC<{ label: string; value: string; isLink?: boolean }> = ({ label, value, isLink }) => (
    <div className="flex flex-col gap-1.5 min-w-0">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
        <span className={`text-[13px] font-bold tracking-tight truncate ${isLink ? 'text-indigo-600 hover:underline cursor-pointer' : 'text-slate-800'}`}>
            {value}
        </span>
    </div>
);

const ActionButton: React.FC<{ color: string; icon: string; label: string }> = ({ color, icon, label }) => (
    <button className={`flex items-center gap-3 px-6 py-3 ${color} text-white rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all group`}>
        <i className={`fa-solid ${icon} text-sm group-hover:scale-110 transition-transform`}></i>
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
);

const DropdownButton: React.FC<{ label: string; badge?: string }> = ({ label, badge }) => (
    <button className="flex items-center gap-4 px-6 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all group">
        <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{label}</span>
            {badge && badge !== '0' && (
                <span className="bg-rose-500 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full">
                    {badge}
                </span>
            )}
        </div>
        <i className="fa-solid fa-chevron-down text-[10px] text-slate-400 group-hover:translate-y-0.5 transition-transform"></i>
    </button>
);

export default ClosingDashboard;
