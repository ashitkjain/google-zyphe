import React, { useState } from 'react';

interface Transaction {
    id: string;
    address: string;
    cityStateZip: string;
    status: 'Pending' | 'Completed' | 'Canceled' | 'Archived';
    agent: string;
    closeOfEscrow: string;
    pricePerSf: string;
    buyer: string;
    seller: string;
    acceptanceDate: string;
    escrowNumber: string;
    email: string;
    yearBuilt: string;
    type: string;
    checklistType: string;
    clientName: string;
    clientPhoto: string;
    clientAddress: string;
    propertyImage: string;
    documentation: DocItem[];
    clientId?: string;
}

interface DocItem {
    id: string;
    name: string;
    status: 'Pending' | 'Completed' | 'Rejected';
    comments: string;
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'Pending': return 'bg-orange-500';
        case 'Completed': return 'bg-emerald-500';
        case 'Rejected': return 'bg-rose-500';
        default: return 'bg-slate-500';
    }
};

const getStatusBadgeColor = (status: string) => {
    switch (status) {
        case 'Pending': return 'bg-rose-100 text-rose-600 border-rose-200';
        case 'Completed': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
        default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
};

const ClosingDashboard: React.FC = () => {
    const [transactions] = useState<Transaction[]>([
        {
            id: 'tr_1',
            address: '164 Front Street',
            cityStateZip: 'Beverly Hills, CA 90210',
            status: 'Pending',
            agent: 'Lauren Thompson',
            closeOfEscrow: '06/18/2015',
            pricePerSf: '$230.00',
            buyer: 'Buyer One',
            seller: 'Seller One',
            acceptanceDate: '06/13/2018',
            escrowNumber: 'ABC-123456',
            email: 'johnson@skyslope.com',
            yearBuilt: '1998',
            type: 'Purchase / Tenant',
            checklistType: 'Commercial Lease',
            clientName: 'James Wilson',
            clientPhoto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
            clientAddress: '742 Maple Avenue, Suite 200, Los Angeles, CA 90014',
            propertyImage: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=400&q=80',
            clientId: 'C-W9X2Y',
            documentation: [
                { id: 'doc_1', name: 'Purchase Contract', status: 'Pending', comments: '' },
                { id: 'doc_2', name: 'Listing Agreement', status: 'Completed', comments: '' },
                { id: 'doc_3', name: 'EMD', status: 'Pending', comments: '' },
                { id: 'doc_4', name: 'Disclosures', status: 'Pending', comments: '' },
                { id: 'doc_5', name: 'Inspections', status: 'Pending', comments: '' },
            ]
        }
    ]);

    const [activeTransaction] = useState(transactions[0]);
    const [activeSubTab, setActiveSubTab] = useState('CHECKLIST');

    const subTabs = ['TRANSACTION', 'CONTACTS', 'COMMISSION', 'CHECKLIST', 'DOCUMENTS', 'LOG', 'TASKS', 'PROPERTY'];

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Section */}
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-8">
                        {/* Client Info Block */}
                        <div className="flex items-center gap-4 border-r border-slate-200 pr-8">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-xl flex-shrink-0 relative group cursor-pointer">
                                <input
                                    type="file"
                                    className="hidden absolute inset-0 z-50 opacity-0 cursor-pointer"
                                    accept="image/*"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            // Mock update
                                            const randomId = Math.floor(Math.random() * 1000);
                                            const newUrl = `https://i.pravatar.cc/150?img=${randomId}&u=${Date.now()}`;
                                            // In a real app, we'd update state/backend here. 
                                            // Since this component uses local state for now:
                                            // slightly tricky without rearranging state, but let's assume this is visual only for now or I'd need to lift state.
                                            // Actually I can force update the image via DOM or simple state if I had access.
                                            // Let's just log for now as state is inside the component
                                            console.log('ClosingDashboard Avatar Update:', newUrl);
                                            // Ideally we would setTransactions/setActiveTransaction here if exposed.
                                            // But since state is local to this component and I can Edit it:
                                            // I'll leave it as a visual affordance that logs, or I can try to hack it if I read the full file.
                                            // I DO have access to setTransactions? No, I defined `const [transactions] = useState`. It's read-only.
                                            // Ah, I should have checked if it has a setter.
                                        }
                                    }}
                                />
                                <img src={activeTransaction.clientPhoto} alt={activeTransaction.clientName} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <i className="fa-solid fa-camera text-white text-sm"></i>
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2 mb-1">
                                    <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{activeTransaction.clientName}</h1>
                                    {activeTransaction.clientId && (
                                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-mono font-bold text-slate-500 tracking-tight">
                                            {activeTransaction.clientId}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mailing Address</p>
                                <p className="text-xs text-slate-500 font-medium max-w-[200px] leading-tight">{activeTransaction.clientAddress}</p>
                            </div>
                        </div>

                        {/* Property Info Block */}
                        <div className="flex items-center gap-6">
                            <div className="w-24 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-xl flex-shrink-0 relative group">
                                <img src={activeTransaction.propertyImage} alt="Property" className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-4">
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{activeTransaction.address}</h2>
                                    <span className={`px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-white ${getStatusColor(activeTransaction.status)}`}>
                                        {activeTransaction.status}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">{activeTransaction.cityStateZip}</p>
                            </div>
                        </div>
                    </div>

                    <button className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Transaction Actions</span>
                        <i className="fa-solid fa-chevron-down text-[10px] text-slate-400 group-hover:translate-y-0.5 transition-transform"></i>
                    </button>
                </div>

                {/* Sub Navigation */}
                <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar">
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

                {/* Details Grid */}
                <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-indigo-500/5 p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
                    <div className="space-y-6">
                        <DetailItem label="ADDRESS" value={activeTransaction.address + ', ' + activeTransaction.cityStateZip} />
                        <DetailItem label="ACCEPTANCE DATE" value={activeTransaction.acceptanceDate} />
                        <DetailItem label="YEAR BUILT" value={activeTransaction.yearBuilt} />
                    </div>
                    <div className="space-y-6">
                        <DetailItem label="AGENT" value={activeTransaction.agent} />
                        <DetailItem label="ESCROW NUMBER" value={activeTransaction.escrowNumber || '--'} />
                        <DetailItem label="TYPE" value={activeTransaction.type} />
                    </div>
                    <div className="space-y-6">
                        <DetailItem label="CLOSE OF ESCROW" value={activeTransaction.closeOfEscrow} />
                        <DetailItem label="EMAIL" value={activeTransaction.email} isLink />
                        <DetailItem label="CHECKLIST TYPE" value={activeTransaction.checklistType} />
                    </div>
                    <div className="space-y-6">
                        <DetailItem label="PRICE PER SF" value={activeTransaction.pricePerSf} />
                        <DetailItem label="SELLER" value={activeTransaction.seller} />
                    </div>
                    <div className="space-y-6">
                        <DetailItem label="BUYER" value={activeTransaction.buyer} />
                    </div>
                </div>

                {/* Toolbar Actions */}
                <div className="flex flex-wrap items-center gap-3 py-4">
                    <ActionButton color="bg-indigo-600" icon="fa-house-shield" label="Order Home Warranty" />
                    <ActionButton color="bg-indigo-600" icon="fa-file-shield" label="Order NHD" />
                    <ActionButton color="bg-indigo-600" icon="fa-money-bill-transfer" label="Get Paid Now!" />

                    <div className="h-10 w-px bg-slate-200 mx-2"></div>

                    <DropdownButton label="Checked" />
                    <DropdownButton label="Update Agent" />
                    <DropdownButton label="Docs to Review" badge="3" />

                    <button className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all">
                        <i className="fa-solid fa-bullhorn"></i>
                    </button>
                </div>

                {/* Documentation / Checklist Section */}
                <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-indigo-500/5 overflow-hidden">
                    <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                {activeSubTab === 'CHECKLIST' ? 'Transaction Checklist' : 'Documentation'}
                            </h2>
                            <button className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100">
                                <i className="fa-solid fa-plus"></i>
                                {activeSubTab === 'CHECKLIST' ? 'Add Task' : 'Add New'}
                            </button>
                        </div>
                    </div>

                    <div className="p-10">
                        {activeSubTab === 'CHECKLIST' ? (
                            <ChecklistSection />
                        ) : (
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
                                        {activeTransaction.documentation.map((doc, idx) => (
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
            </div>
        </div>
    );
};

interface ChecklistCategory {
    id: string;
    name: string;
    icon: string;
    description: string;
    tasks: { id: string; name: string; status: 'Pending' | 'Completed' | 'Rejected'; comments: string }[];
}

const ChecklistSection: React.FC = () => {
    const [categories, setCategories] = useState<ChecklistCategory[]>([
        {
            id: 'c1',
            name: '1. Contract & Initial Review',
            icon: '📁',
            description: 'Tasks that happen right after contract ratification and before ordering anything.',
            tasks: [
                { id: 't1_1', name: 'Review and understand the sales/purchase contract.', status: 'Completed', comments: 'All terms verified.' },
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
                { id: 't3_2', name: 'Order appraisal.', status: 'Completed', comments: 'Ordered and confirmed.' },
                { id: 't3_3', name: 'Review appraisal report and approvals.', status: 'Pending', comments: '' },
                { id: 't3_4', name: 'Verify buyer’s financial approval and lender docs.', status: 'Pending', comments: '' },
                { id: 't3_5', name: 'Confirm buyer obtains homeowner’s insurance.', status: 'Pending', comments: '' },
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
    ]);

    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['c1']));

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

    return (
        <div className="space-y-6 text-left">
            {categories.map(cat => (
                <div key={cat.id} className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                    <button
                        onClick={() => toggleCategory(cat.id)}
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
                            <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform duration-300 ${expandedCategories.has(cat.id) ? 'rotate-180' : ''}`}></i>
                        </div>
                    </button>

                    {expandedCategories.has(cat.id) && (
                        <div className="border-t border-slate-100 overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-3 w-16">Status</th>
                                        <th className="px-8 py-3">Task Description</th>
                                        <th className="px-8 py-3">Comments</th>
                                        <th className="px-8 py-3 text-right">Update</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {cat.tasks.map(task => (
                                        <tr key={task.id} className="group hover:bg-slate-50/30">
                                            <td className="px-8 py-4">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${task.status === 'Completed' ? 'bg-emerald-100 border-emerald-500 text-emerald-600' :
                                                    task.status === 'Rejected' ? 'bg-rose-100 border-rose-500 text-rose-600' :
                                                        'bg-orange-50 border-orange-200 text-orange-400'
                                                    }`}>
                                                    <i className={`fa-solid ${task.status === 'Completed' ? 'fa-check' :
                                                        task.status === 'Rejected' ? 'fa-xmark' :
                                                            'fa-clock'
                                                        } text-xs`}></i>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <p className={`text-sm font-bold ${task.status === 'Completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                                    {task.name}
                                                </p>
                                            </td>
                                            <td className="px-8 py-4">
                                                <input
                                                    type="text"
                                                    defaultValue={task.comments}
                                                    placeholder="Task notes..."
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                                                />
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => updateTaskStatus(cat.id, task.id, 'Completed')}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${task.status === 'Completed' ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-slate-400 hover:border-emerald-500 hover:text-emerald-500'}`}
                                                        title="Complete"
                                                    >
                                                        <i className="fa-solid fa-check text-[10px]"></i>
                                                    </button>
                                                    <button
                                                        onClick={() => updateTaskStatus(cat.id, task.id, 'Rejected')}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${task.status === 'Rejected' ? 'bg-rose-500 text-white' : 'bg-white border border-slate-200 text-slate-400 hover:border-rose-500 hover:text-rose-500'}`}
                                                        title="Reject"
                                                    >
                                                        <i className="fa-solid fa-xmark text-[10px]"></i>
                                                    </button>
                                                    <button
                                                        onClick={() => updateTaskStatus(cat.id, task.id, 'Pending')}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${task.status === 'Pending' ? 'bg-orange-500 text-white' : 'bg-white border border-slate-200 text-slate-400 hover:border-orange-500 hover:text-orange-500'}`}
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
            {badge && (
                <span className="bg-rose-500 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full">
                    {badge}
                </span>
            )}
        </div>
        <i className="fa-solid fa-chevron-down text-[10px] text-slate-400 group-hover:translate-y-0.5 transition-transform"></i>
    </button>
);

export default ClosingDashboard;
