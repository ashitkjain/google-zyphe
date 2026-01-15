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
    documentation: DocItem[];
}

interface DocItem {
    id: string;
    name: string;
    status: 'Pending' | 'Completed' | 'Rejected';
    comments: string;
}

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
            documentation: [
                { id: 'doc_1', name: 'Purchase Contract', status: 'Pending', comments: '' },
                { id: 'doc_2', name: 'Listing Agreement', status: 'Completed', comments: '' },
                { id: 'doc_3', name: 'EMD', status: 'Pending', comments: '' },
                { id: 'doc_4', name: 'Disclosures', status: 'Pending', comments: '' },
                { id: 'doc_5', name: 'Inspections', status: 'Pending', comments: '' },
            ]
        }
    ]);

    const [activeTransaction, setActiveTransaction] = useState(transactions[0]);
    const [activeSubTab, setActiveSubTab] = useState('CHECKLIST');

    const subTabs = ['TRANSACTION', 'CONTACTS', 'COMMISSION', 'CHECKLIST', 'DOCUMENTS', 'LOG', 'TASKS', 'PROPERTY'];

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

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Section */}
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-4">
                            <h1 className="text-4xl font-black text-slate-900 tracking-tight">{activeTransaction.address}</h1>
                            <span className={`px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-white ${getStatusColor(activeTransaction.status)}`}>
                                {activeTransaction.status}
                            </span>
                        </div>
                        <p className="text-lg text-slate-500 font-medium">{activeTransaction.cityStateZip}</p>
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

                {/* Documentation Section */}
                <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-indigo-500/5 overflow-hidden">
                    <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Documentation</h2>
                            <button className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100">
                                <i className="fa-solid fa-plus"></i>
                                Add New
                            </button>
                        </div>
                    </div>

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
                </div>
            </div>
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
