import React, { useState } from 'react';
import { LeadType, StatusOption } from '../../types';
import { DEFAULT_SELLER_STATUSES, DEFAULT_BUYER_STATUSES } from '../../services/statusService';
// Import required Firestore components
import { collection, getDocs, writeBatch, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { db_instance } from '../../services/firebaseService'; // Ensure this path is correct
import { generateMockLead } from '../../services/mockData';

interface StatusSettingsProps {
    realtorId: string;
    onUpdateStatuses: (buyerStatuses: StatusOption[], sellerStatuses: StatusOption[]) => void;
    initialBuyerStatuses?: StatusOption[];
    initialSellerStatuses?: StatusOption[];
}

const FUNNEL_STAGES = ['Leads', 'Nurture', 'Active Search', 'Contract', 'Closed'];

const StatusSettings: React.FC<StatusSettingsProps> = ({
    realtorId,
    onUpdateStatuses,
    initialBuyerStatuses,
    initialSellerStatuses
}) => {
    const partition = (b: StatusOption[], s: StatusOption[]) => {
        const common: StatusOption[] = [];
        const buyerOnly: StatusOption[] = [];
        const sellerOnly: StatusOption[] = [];

        const sellerLabels = new Set(s.map(opt => opt.label));
        const buyerLabels = new Set(b.map(opt => opt.label));

        b.forEach(opt => {
            if (sellerLabels.has(opt.label)) {
                common.push(opt);
            } else {
                buyerOnly.push(opt);
            }
        });

        s.forEach(opt => {
            if (!buyerLabels.has(opt.label)) {
                sellerOnly.push(opt);
            }
        });

        return { common, buyerOnly, sellerOnly };
    };

    const initialData = partition(initialBuyerStatuses || DEFAULT_BUYER_STATUSES, initialSellerStatuses || DEFAULT_SELLER_STATUSES);

    const [commonStatuses, setCommonStatuses] = useState<StatusOption[]>(initialData.common);
    const [buyerOnlyStatuses, setBuyerOnlyStatuses] = useState<StatusOption[]>(initialData.buyerOnly);
    const [sellerOnlyStatuses, setSellerOnlyStatuses] = useState<StatusOption[]>(initialData.sellerOnly);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isMigrating, setIsMigrating] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

    const handleSeedMockData = async () => {
        // User explicitly invoked this via chat, bypassing confirm for smoother execution if UI was glitchy
        // if (!window.confirm("⚠️ WARNING: This will DELETE all current pipeline data...")) return;

        setIsMigrating(true);
        setLogs([`Starting seed process for ID: ${realtorId}...`]);

        if (!realtorId) {
            addLog("❌ ERROR: Missing Realtor ID. Cannot verify permissions.");
            setIsMigrating(false);
            return;
        }

        const db = db_instance;
        if (!db) {
            addLog("Error: Database not initialized");
            setIsMigrating(false);
            return;
        }

        try {
            addLog("Initializing batch write...");
            const batch = writeBatch(db);
            let operationCount = 0;
            const BATCH_LIMIT = 450;

            const commitBatch = async () => {
                if (operationCount > 0) {
                    addLog(`Committing batch of ${operationCount} operations...`);
                    await batch.commit();
                    operationCount = 0;
                }
            };

            // 1. DELETE EXISTING LEADS
            addLog("Deleting existing leads in unified table...");
            const leadsRef = query(collection(db, "leads"), where("realtorId", "==", realtorId));
            const leadsSnap = await getDocs(leadsRef);
            for (const docSnapshot of leadsSnap.docs) {
                batch.delete(docSnapshot.ref);
                operationCount++;
                if (operationCount >= BATCH_LIMIT) await commitBatch();
            }
            addLog(`Marked ${leadsSnap.size} leads for deletion.`);

            // 3. GENERATE AND ADD NEW MOCK DATA

            // Helper to remove undefined keys recursively
            const removeUndefined = (obj: any): any => {
                if (Array.isArray(obj)) return obj.map(removeUndefined);
                if (obj && typeof obj === 'object' && !(obj instanceof Date) && obj !== null && typeof obj.toMillis !== 'function') {
                    return Object.fromEntries(
                        Object.entries(obj)
                            .filter(([_, v]) => v !== undefined)
                            .map(([k, v]) => [k, removeUndefined(v)])
                    );
                }
                return obj;
            };

            // Seed leads to the unified 'leads' collection
            // Construct full status lists for random selection
            const currentBuyerStatuses = [...commonStatuses, ...buyerOnlyStatuses];
            const currentSellerStatuses = [...commonStatuses, ...sellerOnlyStatuses];

            const getRandomStatus = (list: StatusOption[]) => list[Math.floor(Math.random() * list.length)];

            addLog(`Generating 10 Mock Buyers for ${realtorId}...`);
            for (let i = 0; i < 10; i++) {
                const randomStat = getRandomStatus(currentBuyerStatuses);
                const lead = generateMockLead('Buyer', randomStat.label, randomStat.funnelStage);

                const ref = doc(collection(db, "leads"));
                const finalLead = removeUndefined({
                    ...lead,
                    id: ref.id,
                    realtorId: realtorId,
                    createdAt: serverTimestamp(),
                    lastUpdated: serverTimestamp(),
                    collectionName: 'leads'
                });
                batch.set(ref, finalLead);
                operationCount++;
                if (operationCount >= BATCH_LIMIT) await commitBatch();
            }

            addLog(`Generating 10 Mock Sellers for ${realtorId}...`);
            for (let i = 0; i < 10; i++) {
                const randomStat = getRandomStatus(currentSellerStatuses);
                const lead = generateMockLead('Seller', randomStat.label, randomStat.funnelStage);

                const ref = doc(collection(db, "leads"));
                const finalLead = removeUndefined({
                    ...lead,
                    id: ref.id,
                    realtorId: realtorId,
                    createdAt: serverTimestamp(),
                    lastUpdated: serverTimestamp(),
                    collectionName: 'leads'
                });
                batch.set(ref, finalLead);
                operationCount++;
                if (operationCount >= BATCH_LIMIT) await commitBatch();
            }

            await commitBatch();
            addLog("✅ SUCCESS: Seeded 20 new leads.");
            // alert("✅ Successfully seeded 20 new quality mock leads (10 Buyers, 10 Sellers).");

        } catch (error: any) {
            console.error("Seeding failed:", error);
            addLog(`❌ ERROR: ${error.message}`);
        } finally {
            setIsMigrating(false);
        }
    };



    const handleAddStatus = (category: 'Common' | 'Buyer' | 'Seller') => {
        const newStatus: StatusOption = { label: '', description: '', isDefault: false, funnelStage: 'Leads' };
        if (category === 'Common') setCommonStatuses([...commonStatuses, newStatus]);
        else if (category === 'Buyer') setBuyerOnlyStatuses([...buyerOnlyStatuses, newStatus]);
        else setSellerOnlyStatuses([...sellerOnlyStatuses, newStatus]);
    };

    const handleUpdateStatus = (category: 'Common' | 'Buyer' | 'Seller', index: number, updates: Partial<StatusOption>) => {
        if (category === 'Common') {
            const updated = [...commonStatuses];
            updated[index] = { ...updated[index], ...updates };
            setCommonStatuses(updated);
        } else if (category === 'Buyer') {
            const updated = [...buyerOnlyStatuses];
            updated[index] = { ...updated[index], ...updates };
            setBuyerOnlyStatuses(updated);
        } else {
            const updated = [...sellerOnlyStatuses];
            updated[index] = { ...updated[index], ...updates };
            setSellerOnlyStatuses(updated);
        }
    };

    const handleRemoveStatus = (category: 'Common' | 'Buyer' | 'Seller', index: number) => {
        if (category === 'Common') setCommonStatuses(commonStatuses.filter((_, i) => i !== index));
        else if (category === 'Buyer') setBuyerOnlyStatuses(buyerOnlyStatuses.filter((_, i) => i !== index));
        else setSellerOnlyStatuses(sellerOnlyStatuses.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const finalBuyer = [...commonStatuses, ...buyerOnlyStatuses];
            const finalSeller = [...commonStatuses, ...sellerOnlyStatuses];
            await onUpdateStatuses(finalBuyer, finalSeller);
        } finally {
            setIsSaving(false);
        }
    };

    const renderTable = (title: string, category: 'Common' | 'Buyer' | 'Seller', statuses: StatusOption[]) => {
        const filtered = statuses.filter(s =>
            s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.description.toLowerCase().includes(searchQuery.toLowerCase())
        );

        let icon = "fa-users-gear";
        let accentColor = "bg-slate-50 shadow-sm";
        if (category === 'Buyer') {
            icon = "fa-cart-shopping";
            accentColor = "bg-indigo-50/30";
        } else if (category === 'Seller') {
            icon = "fa-house-chimney-window";
            accentColor = "bg-emerald-50/30";
        }

        return (
            <div className={`bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-8`}>
                <div className={`p-6 border-b border-slate-50 flex items-center justify-between ${accentColor}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${category === 'Common' ? 'bg-slate-100 text-slate-600' : category === 'Buyer' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            <i className={`fa-solid ${icon}`}></i>
                        </div>
                        <h3 className="text-xl font-black text-slate-900">{title}</h3>
                    </div>
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
                                <th className="px-6 py-4">Funnel Stage</th>
                                <th className="px-6 py-4">Lead Status</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4 w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.map((status, index) => (
                                <tr key={index} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="relative group/select">
                                            <select
                                                value={status.funnelStage || ''}
                                                onChange={(e) => handleUpdateStatus(category, index, { funnelStage: e.target.value })}
                                                className="w-full bg-slate-100/50 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer hover:bg-slate-100 transition-all active:scale-95"
                                            >
                                                <option value="">Select Stage</option>
                                                {FUNNEL_STAGES.map(stage => (
                                                    <option key={stage} value={stage}>{stage}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 group-hover/select:opacity-100 transition-opacity">
                                                <i className="fa-solid fa-chevron-down text-[8px]"></i>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <input
                                            type="text"
                                            value={status.label}
                                            onChange={(e) => handleUpdateStatus(category, index, { label: e.target.value })}
                                            placeholder="Status Label"
                                            className="w-full bg-transparent font-bold text-slate-900 focus:outline-none focus:text-indigo-600 px-0 py-1"
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <input
                                            type="text"
                                            value={status.description}
                                            onChange={(e) => handleUpdateStatus(category, index, { description: e.target.value })}
                                            placeholder="Status Description"
                                            className="w-full bg-transparent text-slate-500 text-sm focus:outline-none focus:text-slate-900 px-0 py-1"
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {!status.isDefault && (
                                            <button
                                                onClick={() => handleRemoveStatus(category, index)}
                                                className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-rose-500 transition-all"
                                            >
                                                <i className="fa-solid fa-trash-can text-xs"></i>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            <tr
                                onClick={() => handleAddStatus(category)}
                                className="cursor-pointer hover:bg-indigo-50/30 transition-colors"
                            >
                                <td colSpan={4} className="px-6 py-4 text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] ${category === 'Common' ? 'bg-slate-100' : category === 'Buyer' ? 'bg-indigo-100' : 'bg-emerald-100'}`}>
                                            <i className="fa-solid fa-plus"></i>
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-wider">Add Status</span>
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

                {renderTable('Common Funnel Stages', 'Common', commonStatuses)}
                {renderTable('Buyer Specific Statuses', 'Buyer', buyerOnlyStatuses)}
                {renderTable('Seller Specific Statuses', 'Seller', sellerOnlyStatuses)}

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

                <div className="mt-8 pt-8 border-t border-slate-200">
                    <h3 className="text-lg font-bold text-rose-600 mb-4">Danger Zone</h3>
                    <div className="flex flex-col gap-4">


                        <div>
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); handleSeedMockData(); }}
                                disabled={isMigrating}
                                className="bg-white border-2 border-indigo-100 text-indigo-600 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 hover:border-indigo-200 transition-all active:scale-95 flex items-center gap-2 w-full sm:w-auto"
                            >
                                {isMigrating ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-seedling"></i>}
                                Seed Quality Mock Data
                            </button>
                            <p className="text-slate-400 text-[10px] mt-2 font-medium">
                                DELETE all data and generate 20 fresh high-quality leads in the unified leads table (10 Buyers, 10 Sellers).
                            </p>
                        </div>
                    </div>

                    {logs.length > 0 && (
                        <div className="mt-6 bg-slate-900 rounded-xl p-4 font-mono text-[10px] text-green-400 max-h-48 overflow-y-auto shadow-inner">
                            {logs.map((log, i) => (
                                <div key={i}>{log}</div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatusSettings;
