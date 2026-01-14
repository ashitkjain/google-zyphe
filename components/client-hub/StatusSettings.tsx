import React, { useState } from 'react';
import { LeadType, StatusOption } from '../../types';
import { DEFAULT_SELLER_STATUSES, DEFAULT_BUYER_STATUSES } from '../../services/statusService';

interface StatusSettingsProps {
    realtorId: string;
    onUpdateStatuses: (buyerStatuses: StatusOption[], sellerStatuses: StatusOption[]) => void;
    initialBuyerStatuses?: StatusOption[];
    initialSellerStatuses?: StatusOption[];
}

const StatusSettings: React.FC<StatusSettingsProps> = ({
    realtorId,
    onUpdateStatuses,
    initialBuyerStatuses,
    initialSellerStatuses
}) => {
    const [buyerStatuses, setBuyerStatuses] = useState<StatusOption[]>(initialBuyerStatuses || DEFAULT_BUYER_STATUSES);
    const [sellerStatuses, setSellerStatuses] = useState<StatusOption[]>(initialSellerStatuses || DEFAULT_SELLER_STATUSES);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleAddStatus = (type: LeadType) => {
        const newStatus: StatusOption = { label: '', description: '', isDefault: false };
        if (type === 'Buyer') {
            setBuyerStatuses([...buyerStatuses, newStatus]);
        } else {
            setSellerStatuses([...sellerStatuses, newStatus]);
        }
    };

    const handleUpdateStatus = (type: LeadType, index: number, updates: Partial<StatusOption>) => {
        if (type === 'Buyer') {
            const updated = [...buyerStatuses];
            updated[index] = { ...updated[index], ...updates };
            setBuyerStatuses(updated);
        } else {
            const updated = [...sellerStatuses];
            updated[index] = { ...updated[index], ...updates };
            setSellerStatuses(updated);
        }
    };

    const handleRemoveStatus = (type: LeadType, index: number) => {
        if (type === 'Buyer') {
            setBuyerStatuses(buyerStatuses.filter((_, i) => i !== index));
        } else {
            setSellerStatuses(sellerStatuses.filter((_, i) => i !== index));
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onUpdateStatuses(buyerStatuses, sellerStatuses);
        } finally {
            setIsSaving(false);
        }
    };

    const renderTable = (title: string, type: LeadType, statuses: StatusOption[]) => {
        const filtered = statuses.filter(s =>
            s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.description.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-8">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                    <h3 className="text-xl font-black text-slate-900">{title}</h3>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search status..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none w-64 transition-all"
                        />
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]"></i>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <th className="px-6 py-4">Lead Status</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4 w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.map((status, index) => (
                                <tr key={index} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <input
                                            type="text"
                                            value={status.label}
                                            onChange={(e) => handleUpdateStatus(type, index, { label: e.target.value })}
                                            placeholder="Status Label"
                                            className="w-full bg-transparent font-bold text-slate-900 focus:outline-none focus:text-indigo-600 px-0 py-1"
                                            disabled={status.isDefault && false} // Allowing edit even if default as per image
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <input
                                            type="text"
                                            value={status.description}
                                            onChange={(e) => handleUpdateStatus(type, index, { description: e.target.value })}
                                            placeholder="Status Description"
                                            className="w-full bg-transparent text-slate-500 text-sm focus:outline-none focus:text-slate-900 px-0 py-1"
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {!status.isDefault && (
                                            <button
                                                onClick={() => handleRemoveStatus(type, index)}
                                                className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-rose-500 transition-all"
                                            >
                                                <i className="fa-solid fa-trash-can text-xs"></i>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            <tr
                                onClick={() => handleAddStatus(type)}
                                className="cursor-pointer hover:bg-indigo-50/30 transition-colors"
                            >
                                <td colSpan={3} className="px-6 py-4 text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-[10px]">
                                            <i className="fa-solid fa-plus"></i>
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-wider">Add Custom Status</span>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Status Management</h2>
                        <p className="text-slate-500 font-medium">Configure lead lifecycles and workflow stages</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50"
                    >
                        {isSaving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>}
                        {isSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>

                {renderTable('Seller Lead Statuses', 'Seller', sellerStatuses)}
                {renderTable('Buyer Lead Statuses', 'Buyer', buyerStatuses)}

                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-circle-info"></i>
                    </div>
                    <div>
                        <h4 className="font-bold text-amber-900 text-sm mb-1">Status Impact</h4>
                        <p className="text-amber-700 text-xs leading-relaxed font-medium">
                            Changing status labels will update all existing leads instantly. Custom statuses will appear in the "Lead Status" dropdown across the Client Hub and Pipeline boards.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatusSettings;
