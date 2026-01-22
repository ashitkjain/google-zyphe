import React, { useState, useMemo } from 'react';
import { Lead, Transaction } from '../../types';
import TransactionTab from './TransactionTab';
import PartiesTab from './PartiesTab';
import DocumentsTab from './DocumentsTab';
import TransactionWizard from './TransactionWizard';
import { ChecklistCategory } from '../../types/transaction';
import TransactionTimeline from './TransactionTimeline';

interface ClosingDashboardProps {
    leads: Lead[];
    onUpdateLead?: (leadId: string, updates: Partial<Lead>) => void;
    realtorId: string;
    onNavigateToClient?: (clientId: string) => void;
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
    { id: 'doc_1', name: 'Purchase Agreement (RPA)', status: 'Completed', comments: 'Signed by all parties' },
    { id: 'doc_2', name: 'Agency Disclosure (AD)', status: 'Completed', comments: '' },
    { id: 'doc_3', name: 'Transfer Disclosure Statement (TDS)', status: 'Pending', comments: 'Waiting on seller signature' },
    { id: 'doc_4', name: 'Seller Property Questionnaire (SPQ)', status: 'Pending', comments: '' },
    { id: 'doc_5', name: 'Preliminary Title Report', status: 'Completed', comments: 'Clear title confirmed' },
    { id: 'doc_6', name: 'Home Inspection Report', status: 'Completed', comments: 'Received, no major issues' },
    { id: 'doc_7', name: 'Natural Hazard Disclosure (NHD)', status: 'Pending', comments: '' },
    { id: 'doc_8', name: 'Lead-Based Paint Disclosure', status: 'Pending', comments: '' },
    { id: 'doc_9', name: 'HOA Documents', status: 'Pending', comments: 'Requested from management co.' },
    { id: 'doc_10', name: 'Termite Inspection', status: 'Rejected', comments: 'Needs re-inspection for Section 1 items' },
];

// Initial categories for the checklist


const ClosingDashboard: React.FC<ClosingDashboardProps> = ({ leads, onUpdateLead, realtorId, onNavigateToClient }) => {
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

    const [activeSubTab, setActiveSubTab] = useState('TRANSACTION');

    const subTabs = ['TRANSACTION', 'PARTIES', 'DOCUMENTS', 'LOG', 'TASKS', 'PROPERTY'];



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
                        <div
                            key={lead.id}
                            onClick={() => setActiveLeadId(lead.id)}
                            className={`flex items-center gap-3 px-5 py-3 rounded-2xl border-2 transition-all flex-shrink-0 group cursor-pointer ${activeLeadId === lead.id
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
                            <div className="flex flex-col items-start relative z-10">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onNavigateToClient?.(lead.id);
                                    }}
                                    className={`font-bold text-sm tracking-tight text-left hover:text-indigo-600 hover:underline transition-colors ${activeLeadId === lead.id ? 'text-slate-900' : 'text-slate-600'}`}
                                    title="View Client Details"
                                >
                                    {lead.firstName} {lead.lastName} <i className="fa-solid fa-arrow-up-right-from-square text-[10px] ml-1 opacity-50"></i>
                                </button>
                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                    {lead.leadType}
                                </span>
                            </div>
                            {activeLeadId === lead.id && (
                                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse ml-1"></div>
                            )}
                        </div>
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
                            {activeSubTab !== 'TRANSACTION' && activeSubTab !== 'CHECKLIST' && activeSubTab !== 'PARTIES' && activeSubTab !== 'DOCUMENTS' && (
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
                                    />
                                )}

                                {activeSubTab === 'PARTIES' && (
                                    <PartiesTab lead={activeLead} realtorId={realtorId} />
                                )}



                                {activeSubTab !== 'CHECKLIST' && activeSubTab !== 'TRANSACTION' && activeSubTab !== 'PARTIES' && (
                                    <DocumentsTab lead={activeLead} realtorId={realtorId} />
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {
                showWizard && (
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
                )
            }
        </div >
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
                                                    {task.comment && (
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
                                                                    {task.comment}
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
                                                    value={task.comment}
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
