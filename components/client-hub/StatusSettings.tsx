import React, { useState, useMemo } from 'react';
import { StatusOption } from '../../types';
import { DEFAULT_STATUSES } from '../../services/statusService';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { collection, getDocs, writeBatch, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { db_instance } from '../../services/firebaseService';
import { generateMockLead } from '../../services/mockData';

const TypedDroppable = Droppable as any;
const TypedDraggable = Draggable as any;

interface StatusSettingsProps {
    realtorId: string;
    onUpdateStatuses: (statuses: StatusOption[]) => void;
    initialStatuses?: StatusOption[];
}

interface ManagedStatus extends StatusOption {
    applicableTo?: 'Both' | 'Buyer' | 'Seller';
}

const FUNNEL_STAGES = ['Leads', 'Nurture', 'Active Search', 'Offer', 'Contract', 'Closed', 'Archived'];

const StatusSettings: React.FC<StatusSettingsProps> = ({
    realtorId,
    onUpdateStatuses,
    initialStatuses
}) => {

    const initialData = useMemo(() => {
        return (initialStatuses || DEFAULT_STATUSES).map(s => ({
            ...s,
            applicableTo: (s.visibility?.length === 2) ? 'Both' : (s.visibility?.[0] || 'Both')
        })) as ManagedStatus[];
    }, [initialStatuses]);

    const [allStatuses, setAllStatuses] = useState<ManagedStatus[]>(initialData);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(FUNNEL_STAGES));
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedData, setLastSavedData] = useState<ManagedStatus[]>(initialData);
    const [isMigrating, setIsMigrating] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    const hasUnsavedChanges = JSON.stringify(allStatuses) !== JSON.stringify(lastSavedData);
    const db = db_instance;

    const addLog = (msg: string) => setLogs(prev => [msg, ...prev]);

    const toggleStage = (stage: string) => {
        const next = new Set(expandedStages);
        if (next.has(stage)) next.delete(stage);
        else next.add(stage);
        setExpandedStages(next);
    };

    const handleUpdateStatus = (index: number, updates: Partial<ManagedStatus>) => {
        setAllStatuses(prev => {
            const next = [...prev];

            if (updates.applicableTo) {
                if (updates.applicableTo === 'Both') updates.visibility = ['Buyer', 'Seller'];
                else if (updates.applicableTo === 'Buyer') updates.visibility = ['Buyer'];
                else if (updates.applicableTo === 'Seller') updates.visibility = ['Seller'];
            }

            next[index] = { ...next[index], ...updates };
            return next;
        });
    };

    const handleAddStatus = (stage: string) => {
        const newStatus: ManagedStatus = {
            label: 'New Status',
            description: 'Description...',
            funnelStage: stage,
            isDefault: false,
            visibility: ['Buyer', 'Seller'],
            applicableTo: 'Both',
            order: allStatuses.length
        };

        const stageItems = allStatuses.filter(s => (s.funnelStage || 'Leads') === stage);
        const lastIndex = allStatuses.indexOf(stageItems[stageItems.length - 1]);

        const next = [...allStatuses];
        if (lastIndex !== -1) {
            next.splice(lastIndex + 1, 0, newStatus);
        } else {
            next.push(newStatus);
        }
        setAllStatuses(next);
        if (!expandedStages.has(stage)) toggleStage(stage);
    };

    const handleRemoveStatus = (index: number) => {
        if (!allStatuses[index].isDefault) {
            setAllStatuses(prev => prev.filter((_, i) => i !== index));
        }
    };

    const onDragEnd = async (result: DropResult) => {
        if (!result.destination) return;

        const draggedStatusIE = result.draggableId;
        const draggedStatus = allStatuses.find(s => `status-${s.label}-${allStatuses.indexOf(s)}` === draggedStatusIE);
        if (!draggedStatus) return;

        const sourceStage = result.source.droppableId;
        const destStage = result.destination.droppableId;

        let newAllStatuses = Array.from(allStatuses);
        newAllStatuses = newAllStatuses.filter(s => s !== draggedStatus);

        if (destStage !== sourceStage) {
            draggedStatus.funnelStage = destStage;
        }

        const finalGlobalList: ManagedStatus[] = [];
        FUNNEL_STAGES.forEach(stage => {
            const statusesInThisStage = newAllStatuses.filter(s => (s.funnelStage || 'Nurture') === stage);

            if (stage === destStage) {
                statusesInThisStage.splice(result.destination!.index, 0, draggedStatus);
            }
            finalGlobalList.push(...statusesInThisStage);
        });

        const orderedFinalList = finalGlobalList.map((s, i) => ({ ...s, order: i }));
        setAllStatuses(orderedFinalList);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onUpdateStatuses(allStatuses);
            setLastSavedData([...allStatuses]);
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetDefaults = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (window.confirm('Reset to defaults and save? This will overwrite existing data.')) {
            setIsSaving(true);
            try {
                const defaults = DEFAULT_STATUSES.map(s => ({
                    ...s,
                    applicableTo: (s.visibility?.length === 2) ? 'Both' : (s.visibility?.[0] || 'Both')
                })) as ManagedStatus[];

                setAllStatuses(defaults);
                setSearchQuery('');
                setExpandedStages(new Set(FUNNEL_STAGES));

                console.log("Saving defaults...");
                await onUpdateStatuses(defaults);
                setLastSavedData(defaults);

                alert("Defaults successfully restored and saved.");
            } catch (error) {
                console.error("Failed to save defaults:", error);
                alert("Error saving defaults. Please try again.");
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleSeedMockData = async () => {
        if (!confirm("Overwrite all existing leads with generic mock data?")) return;
        setIsMigrating(true);
        setLogs([]);
        try {
            addLog("Deleting existing leads...");
            const leadsQ = query(collection(db, "leads"), where("realtorId", "==", realtorId));
            const snap = await getDocs(leadsQ);
            const batch = writeBatch(db);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            addLog("Existing leads deleted.");

            const buyerStatuses = allStatuses.filter(s => s.visibility?.includes('Buyer'));
            const sellerStatuses = allStatuses.filter(s => s.visibility?.includes('Seller'));

            const getRandom = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];

            const newBatch = writeBatch(db);
            let opCount = 0;

            for (let i = 0; i < 10; i++) {
                const s = getRandom(buyerStatuses);
                const lead = generateMockLead('Buyer', s.label, s.funnelStage);
                const ref = doc(collection(db, "leads"));
                newBatch.set(ref, { ...lead, id: ref.id, realtorId, createdAt: serverTimestamp(), collectionName: 'leads' });
                opCount++;
            }
            for (let i = 0; i < 10; i++) {
                const s = getRandom(sellerStatuses);
                const lead = generateMockLead('Seller', s.label, s.funnelStage);
                const ref = doc(collection(db, "leads"));
                newBatch.set(ref, { ...lead, id: ref.id, realtorId, createdAt: serverTimestamp(), collectionName: 'leads' });
                opCount++;
            }

            await newBatch.commit();
            addLog(`Success: Created ${opCount} leads.`);
        } catch (e: any) {
            addLog(`Error: ${e.message}`);
        } finally {
            setIsMigrating(false);
        }
    };

    const renderStageGroups = () => {
        const isFiltering = searchQuery.length > 0;

        return (
            <div className="space-y-6">
                {FUNNEL_STAGES.map((stage) => {
                    const stageStatuses = allStatuses.filter(s => {
                        const matchesStage = (s.funnelStage || 'Nurture') === stage;
                        if (!matchesStage) return false;
                        if (isFiltering) {
                            return s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                s.description.toLowerCase().includes(searchQuery.toLowerCase());
                        }
                        return true;
                    });

                    const isExpanded = expandedStages.has(stage);
                    if (isFiltering && stageStatuses.length === 0) return null;

                    return (
                        <div key={stage} className={`bg-white rounded-2xl border transition-all duration-300 ${isExpanded ? 'border-indigo-100 shadow-sm' : 'border-slate-100'}`}>
                            {/* Header */}
                            <div
                                onClick={() => toggleStage(stage)}
                                className={`flex items-center justify-between p-4 cursor-pointer select-none transition-colors ${isExpanded ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-colors ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                        <i className={`fa-solid ${isExpanded ? 'fa-folder-open' : 'fa-folder'}`}></i>
                                    </div>
                                    <div>
                                        <h3 className={`text-xs font-black uppercase tracking-widest ${isExpanded ? 'text-indigo-900' : 'text-slate-500'}`}>{stage}</h3>
                                        <p className="text-[10px] text-slate-400 font-medium">{stageStatuses.length} Statuses</p>
                                    </div>
                                </div>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isExpanded ? 'bg-indigo-100 text-indigo-600 rotate-180' : 'text-slate-300'}`}>
                                    <i className="fa-solid fa-chevron-down text-[10px]"></i>
                                </div>
                            </div>

                            {/* Content */}
                            {isExpanded && (
                                <div className="border-t border-indigo-50/50">
                                    <TypedDroppable droppableId={stage} isDropDisabled={isFiltering}>
                                        {(provided: any) => (
                                            <table
                                                className="w-full text-left"
                                                {...provided.droppableProps}
                                                ref={provided.innerRef}
                                            >
                                                <thead className="bg-slate-50 border-b border-slate-100">
                                                    <tr>
                                                        <th className="w-10 py-2"></th>
                                                        <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-1/3">Status Name</th>
                                                        <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</th>
                                                        <th className="w-12 py-2"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {stageStatuses.map((status, index) => {
                                                        const actualIndex = allStatuses.indexOf(status);
                                                        return (
                                                            <TypedDraggable
                                                                key={`${status.label}-${actualIndex}`}
                                                                draggableId={`status-${status.label}-${actualIndex}`}
                                                                index={index}
                                                                isDragDisabled={isFiltering}
                                                            >
                                                                {(provided: any, snapshot: any) => (
                                                                    <tr
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        className={`group hover:bg-slate-50/80 transition-colors ${snapshot.isDragging ? 'bg-white shadow-xl z-50 ring-2 ring-indigo-500/20 rounded-lg' : ''}`}
                                                                    >
                                                                        {!isFiltering && (
                                                                            <td className="px-4 py-2 w-10 align-top">
                                                                                <div {...provided.dragHandleProps} className="text-slate-300 hover:text-indigo-400 cursor-grab active:cursor-grabbing transition-colors flex justify-center pt-2">
                                                                                    <i className="fa-solid fa-grip-vertical text-[10px]"></i>
                                                                                </div>
                                                                            </td>
                                                                        )}

                                                                        <td className="px-4 py-2 w-1/3 align-middle">
                                                                            <div className="flex items-center gap-3">
                                                                                <input
                                                                                    type="text"
                                                                                    value={status.label}
                                                                                    onChange={(e) => handleUpdateStatus(actualIndex, { label: e.target.value })}
                                                                                    placeholder="Status Label"
                                                                                    className="flex-1 min-w-0 bg-transparent font-semibold text-slate-900 text-sm leading-snug focus:outline-none focus:text-indigo-700 placeholder:text-slate-300 px-0 py-0.5 border-b border-transparent focus:border-indigo-100 transition-all font-sans"
                                                                                />

                                                                                {/* Scope / Visibility (Now Inline) */}
                                                                                <div className="relative group/select flex-shrink-0">
                                                                                    {status.applicableTo !== 'Both' ? (
                                                                                        <div className={`
                                                                                            text-[8px] font-black uppercase tracking-widest py-0.5 px-1.5 rounded flex items-center gap-1.5 transition-all cursor-pointer
                                                                                            ${status.applicableTo === 'Buyer' ? 'bg-sky-50 text-sky-600 border border-sky-100 group-hover/select:border-sky-300' : 'bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover/select:border-emerald-300'}
                                                                                        `}>
                                                                                            <div className={`w-1.5 h-1.5 rounded-full ${status.applicableTo === 'Buyer' ? 'bg-sky-400' : 'bg-emerald-400'}`}></div>
                                                                                            <span>
                                                                                                {status.applicableTo === 'Buyer' ? 'Buyer Only' : 'Seller Only'}
                                                                                            </span>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="flex items-center gap-2 cursor-pointer group-hover/select:opacity-100 opacity-0 transition-opacity">
                                                                                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider group-hover/select:text-indigo-400">Common</span>
                                                                                            <i className="fa-solid fa-sliders text-slate-300 text-[10px] group-hover/select:text-indigo-400"></i>
                                                                                        </div>
                                                                                    )}
                                                                                    <select
                                                                                        value={status.applicableTo}
                                                                                        onChange={(e) => handleUpdateStatus(actualIndex, { applicableTo: e.target.value as any })}
                                                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                                        title="Change Scope"
                                                                                    >
                                                                                        <option value="Both">Common (All Tabs)</option>
                                                                                        <option value="Buyer">Buyer Only</option>
                                                                                        <option value="Seller">Seller Only</option>
                                                                                    </select>
                                                                                </div>
                                                                            </div>
                                                                        </td>

                                                                        <td className="px-4 py-2 align-top">
                                                                            <input
                                                                                value={status.description}
                                                                                onChange={(e) => handleUpdateStatus(actualIndex, { description: e.target.value })}
                                                                                placeholder="Description"
                                                                                className="w-full bg-transparent text-slate-600 text-sm leading-snug font-medium focus:outline-none focus:text-slate-900 px-0 py-0.5 font-sans"
                                                                            />
                                                                        </td>
                                                                        <td className="px-4 py-2 w-12 text-right align-top">
                                                                            {!status.isDefault && (
                                                                                <button
                                                                                    onClick={() => handleRemoveStatus(actualIndex)}
                                                                                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-all flex items-center justify-center pt-2"
                                                                                >
                                                                                    <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                                                </button>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </TypedDraggable>
                                                        );
                                                    })}
                                                    {provided.placeholder}
                                                </tbody>
                                            </table>
                                        )}
                                    </TypedDroppable>

                                    {/* Add Button */}
                                    {!isFiltering && (
                                        <div className="p-2 border-t border-slate-50">
                                            <button
                                                onClick={() => handleAddStatus(stage)}
                                                className="w-full py-2 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all"
                                            >
                                                <i className="fa-solid fa-plus"></i>
                                                Add Status to {stage}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-4 md:p-8">
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="w-full max-w-5xl mx-auto">
                    {/* Header Controls */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Status Management</h2>
                            <p className="text-xs text-slate-500 font-medium mt-1">Configure pipeline stages and visibility</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                <input
                                    type="text"
                                    placeholder="Filter statuses..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64 transition-all"
                                />
                            </div>
                            <div className="h-6 w-px bg-slate-200 mx-2"></div>
                            <button
                                type="button"
                                onClick={handleResetDefaults}
                                disabled={isSaving}
                                className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition-colors"
                            >
                                Reset Defaults
                            </button>
                            <div className="flex flex-col items-end">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className={`px-6 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all ${isSaving
                                        ? 'bg-slate-400 text-white cursor-not-allowed'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-xl active:scale-95'
                                        } flex items-center gap-2`}
                                >
                                    {isSaving ? (
                                        <>
                                            <i className="fa-solid fa-spinner fa-spin"></i>
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-floppy-disk"></i>
                                            <span>Save</span>
                                        </>
                                    )}
                                </button>
                                {hasUnsavedChanges && (
                                    <span className="text-slate-900 font-bold text-[10px] tracking-wide animate-pulse flex items-center bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm mt-1.5">
                                        <i className="fa-solid fa-circle-exclamation mr-1.5 text-amber-500"></i>
                                        Changes not saved
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {renderStageGroups()}

                    {/* Info Card */}
                    <div className="mt-8 bg-blue-50 border border-blue-100 rounded-2xl p-6 flex items-start gap-4">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                            <i className="fa-solid fa-circle-info text-sm"></i>
                        </div>
                        <div>
                            <h4 className="font-bold text-blue-900 text-xs uppercase tracking-wide mb-1">Status Visibility</h4>
                            <p className="text-blue-700 text-xs leading-relaxed">
                                Statuses set to "Common" appear in both Buyer and Seller tabs. "Buyer Only" or "Seller Only" restricts them to their respective views.
                                Drag and drop statuses to reorder them within the global sequence.
                            </p>
                        </div>
                    </div>

                    {/* Developer Tools */}
                    <div className="mt-12 pt-8 border-t border-slate-200">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Developer Tools</h3>
                        <div className="">
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); handleSeedMockData(); }}
                                disabled={isMigrating}
                                className="text-rose-500 hover:text-rose-700 text-xs font-bold flex items-center gap-2 transition-colors opacity-60 hover:opacity-100"
                            >
                                <i className="fa-solid fa-database"></i>
                                {isMigrating ? 'Resetting Database...' : 'Reset & Seed Mock Database'}
                            </button>
                            {logs.length > 0 && (
                                <div className="mt-4 bg-slate-900 rounded-lg p-3 font-mono text-[10px] text-emerald-400 max-h-32 overflow-y-auto">
                                    {logs.map((log, i) => <div key={i}>{log}</div>)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DragDropContext>
        </div>
    );
};

export default StatusSettings;
