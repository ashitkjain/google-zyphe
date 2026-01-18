import React, { useState, useMemo } from 'react';
import { StatusOption, PropertyOption } from '../../types';
import { DEFAULT_STATUSES } from '../../services/statusService';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { collection, getDocs, writeBatch, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { db_instance } from '../../services/firebaseService';
import { generateMockLead } from '../../services/mockData';
import { LEAD_FIELD_CONFIG as DEFAULT_PROPERTIES } from '../../types/lead';

const TypedDroppable = Droppable as any;
const TypedDraggable = Draggable as any;

interface StatusSettingsProps {
    realtorId: string;
    onUpdateStatuses: (statuses: StatusOption[]) => void;
    onUpdateProperties: (properties: PropertyOption[]) => void;
    initialStatuses?: StatusOption[];
    initialProperties?: PropertyOption[];
    initialClientProperties?: PropertyOption[];
    onUpdateClientProperties?: (properties: PropertyOption[]) => void;
    onResetData?: () => void;
    defaultTab?: 'statuses' | 'properties';
}

interface ManagedStatus extends StatusOption {
    applicableTo?: 'Both' | 'Buyer' | 'Seller';
}

interface ManagedProperty extends PropertyOption {
    applicableTo?: 'Both' | 'Buyer' | 'Seller';
}

const FUNNEL_STAGES = ['Leads', 'Nurture', 'Active Search', 'Offer', 'Contract', 'Closed', 'Archived'];

const PROPERTY_CATEGORIES = ['Contact Information', 'Intent & Readiness', 'Persona & Context', 'Activity', 'Timings', 'Client Communication', 'Property Details', 'Referral & Source', 'System Metadata'];

const FunnelVisibilitySelect: React.FC<{
    selected: string[];
    onChange: (next: string[]) => void;
    disabled?: boolean;
}> = ({ selected, onChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const options = ['All', ...FUNNEL_STAGES, 'None'];

    const toggleOption = (option: string) => {
        if (option === 'All') {
            onChange(['All']);
        } else if (option === 'None') {
            onChange(['None']);
        } else {
            let next = selected.filter(s => s !== 'All' && s !== 'None');
            if (next.includes(option)) {
                next = next.filter(s => s !== option);
            } else {
                next.push(option);
            }
            if (next.length === 0) next = ['None'];
            if (next.length === FUNNEL_STAGES.length) next = ['All'];
            onChange(next);
        }
    };

    const displayText = selected.includes('All')
        ? 'All'
        : selected.includes('None')
            ? 'None'
            : selected.length > 1
                ? 'Multiple'
                : (selected[0] || 'None');

    return (
        <div className="relative">
            <button
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full text-left px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:border-indigo-300 transition-all flex items-center justify-between min-w-[100px] ${disabled ? 'opacity-70 cursor-not-allowed bg-slate-25/50' : ''}`}
            >
                <span className="truncate max-w-[80px]">{displayText}</span>
                {disabled ? (
                    <i className="fa-solid fa-lock text-[8px] text-slate-300"></i>
                ) : (
                    <i className={`fa-solid fa-chevron-down transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
                )}
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-[101] py-2 max-h-60 overflow-y-auto">
                        {options.map(opt => {
                            const isSelected = selected.includes(opt);
                            return (
                                <button
                                    key={opt}
                                    onClick={() => toggleOption(opt)}
                                    className={`w-full text-left px-4 py-2 text-[10px] font-bold flex items-center gap-3 hover:bg-slate-50 transition-colors ${isSelected ? 'text-indigo-600' : 'text-slate-600'}`}
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>
                                        {isSelected && <i className="fa-solid fa-check text-[8px]"></i>}
                                    </div>
                                    {opt}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};

const StatusSettings: React.FC<StatusSettingsProps> = ({
    realtorId,
    onUpdateStatuses,
    onUpdateProperties,
    initialStatuses,
    initialProperties,
    onResetData,
    defaultTab,
}) => {
    const [activeTab, setActiveTab] = useState<'statuses' | 'properties'>(defaultTab || 'properties');

    // --- Status Logic ---
    const initialStatusData = useMemo(() => {
        const source = Array.isArray(initialStatuses) ? initialStatuses : DEFAULT_STATUSES;
        return source.map(s => ({
            ...s,
            applicableTo: (s.visibility?.length === 2) ? 'Both' : (s.visibility?.[0] || 'Both'),
            funnelVisibility: s.funnelVisibility || ['All']
        })) as ManagedStatus[];
    }, [initialStatuses]);

    const [allStatuses, setAllStatuses] = useState<ManagedStatus[]>(initialStatusData);

    // --- Property Logic ---
    // Initialize properties with category synchronization
    // If a property exists in the Default Config, we FORCE its category to match the new config.
    // This allows us to re-organize categories in the code and have it reflect for users without resetting details.
    // --- Property Logic ---
    // Initialize properties with category synchronization directly in useState initializer
    const [allProperties, setAllProperties] = useState<ManagedProperty[]>(() => {
        if (!initialProperties || initialProperties.length === 0) {
            return (DEFAULT_PROPERTIES as unknown as PropertyOption[]).map(p => ({
                ...p,
                applicableTo: (p.visibility?.length === 2) ? 'Both' : (p.visibility?.[0] || 'Both'),
                funnelVisibility: p.funnelVisibility || ['All'],
                isLocked: p.isLocked || false
            })) as ManagedProperty[];
        } else {
            const syncedProperties = initialProperties.map(p => {
                const defaultConfig = DEFAULT_PROPERTIES.find(dp => dp.id === p.id) as any;
                if (defaultConfig) {
                    return {
                        ...p,
                        category: defaultConfig.category, // FORCE update category
                        label: defaultConfig.label,       // FORCE update label
                        description: defaultConfig.description, // FORCE update description
                        type: defaultConfig.type || p.type,     // SYNC type
                        options: defaultConfig.options || p.options, // SYNC options
                        isLocked: defaultConfig.isLocked || false, // SYNC locked status
                        funnelVisibility: defaultConfig.isLocked
                            ? (defaultConfig.funnelVisibility || ['All'])
                            : ((p.funnelVisibility && p.funnelVisibility.length > 0 && !(p.funnelVisibility.length === 1 && p.funnelVisibility[0] === 'All' && defaultConfig.funnelVisibility && defaultConfig.funnelVisibility.length > 0 && !defaultConfig.funnelVisibility.includes('All')))
                                ? p.funnelVisibility
                                : (defaultConfig.funnelVisibility || ['All']))
                    };
                }
                return p;
            });
            return syncedProperties.map(p => ({
                ...p,
                applicableTo: (p.visibility?.length === 2) ? 'Both' : (p.visibility?.[0] || 'Both'),
                funnelVisibility: p.isLocked ? (p.funnelVisibility || ['All']) : (p.funnelVisibility || ['All']), // This is already handled in the mapping above
                isLocked: p.isLocked || false
            })) as ManagedProperty[];
        }
    });


    const [searchQuery, setSearchQuery] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set([...FUNNEL_STAGES, ...PROPERTY_CATEGORIES]));

    const [isSaving, setIsSaving] = useState(false);
    const [isMigrating, setIsMigrating] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    const db = db_instance;

    const addLog = (msg: string) => setLogs(prev => [msg, ...prev]);

    const toggleGroup = (group: string) => {
        const next = new Set(expandedGroups);
        if (next.has(group)) next.delete(group);
        else next.add(group);
        setExpandedGroups(next);
    };

    // Generic Update Handler
    const handleUpdateItem = (index: number, updates: Partial<ManagedStatus | ManagedProperty>, type: 'status' | 'property') => {
        let setter;
        if (type === 'status') setter = setAllStatuses;
        else setter = setAllProperties;

        setter(prev => {
            const next = [...prev] as any[];

            if (updates.applicableTo) {
                if (updates.applicableTo === 'Both') updates.visibility = ['Buyer', 'Seller'];
                else if (updates.applicableTo === 'Buyer') updates.visibility = ['Buyer'];
                else if (updates.applicableTo === 'Seller') updates.visibility = ['Seller'];
            }

            next[index] = { ...next[index], ...updates };
            return next;
        });
    };

    const handleAddItem = (group: string, type: 'status' | 'property') => {
        if (type === 'status') {
            const newStatus: ManagedStatus = {
                label: 'New Status',
                description: 'Description...',
                funnelStage: group,
                isDefault: false,
                visibility: ['Buyer', 'Seller'],
                funnelVisibility: ['All'],
                applicableTo: 'Both',
                order: allStatuses.length,
                type: 'string'
            };
            const groupItems = allStatuses.filter(s => (s.funnelStage || 'Leads') === group);
            const lastIndex = groupItems.length > 0 ? allStatuses.indexOf(groupItems[groupItems.length - 1]) : -1;
            const next = [...allStatuses];
            if (lastIndex !== -1) next.splice(lastIndex + 1, 0, newStatus);
            else next.push(newStatus);
            setAllStatuses(next);
        } else {
            const newProp: ManagedProperty = {
                id: `custom_prop_${Date.now()}`,
                label: 'New Property',
                description: 'Description...',
                category: group,
                visibility: ['Buyer', 'Seller'],
                funnelVisibility: ['All'],
                applicableTo: 'Both',
                order: allProperties.length,
                type: 'string'
            };
            const groupItems = allProperties.filter(p => (p.category || 'General') === group);
            const lastIndex = groupItems.length > 0 ? allProperties.indexOf(groupItems[groupItems.length - 1]) : -1;
            const next = [...allProperties];
            if (lastIndex !== -1) next.splice(lastIndex + 1, 0, newProp);
            else next.push(newProp);
            setAllProperties(next);
        }

        if (!expandedGroups.has(group)) toggleGroup(group);
    };

    const handleRemoveItem = (index: number, type: 'status' | 'property') => {
        if (type === 'status') setAllStatuses(prev => prev.filter((_, i) => i !== index));
        else setAllProperties(prev => prev.filter((_, i) => i !== index));
    };

    const onDragEnd = async (result: DropResult) => {
        if (!result.destination) return;

        const type = activeTab === 'statuses' ? 'status' : 'property';
        const sourceGroup = result.source.droppableId;
        const destGroup = result.destination.droppableId;
        const draggableId = result.draggableId;

        // Status Logic
        if (type === 'status') {
            // Fallback to searching by index if ID construction is tricky or unstable
        }

        // Simplified Drag Logic that works for both (assuming list reconstruction)
        // ... Implementing separate handlers for clarity ...
        if (type === 'status') {
            // Re-implementing logic from original file
            // Need to find the item. The id helps.
            const itemIndexStr = result.draggableId.split('::')[1];
            const itemIndex = parseInt(itemIndexStr);
            const draggedItem = allStatuses[itemIndex];
            if (!draggedItem) return;

            let newItems = [...allStatuses];
            newItems.splice(itemIndex, 1); // remove from old position

            if (destGroup !== sourceGroup) draggedItem.funnelStage = destGroup;

            // Re-insert
            // We need to find the correct insertion index within the global list based on the visual group order
            const globalList: ManagedStatus[] = [];
            FUNNEL_STAGES.forEach(stage => {
                const itemsInStage = newItems.filter(s => (s.funnelStage || 'Nurture') === stage);
                if (stage === destGroup) {
                    itemsInStage.splice(result.destination!.index, 0, draggedItem);
                }
                globalList.push(...itemsInStage);
            });
            setAllStatuses(globalList.map((s, i) => ({ ...s, order: i })));

        } else {
            const itemIndexStr = result.draggableId.split('::')[1];
            const itemIndex = parseInt(itemIndexStr);
            const draggedItem = allProperties[itemIndex];
            if (!draggedItem) return;

            let newItems = [...allProperties];
            newItems.splice(itemIndex, 1);

            if (destGroup !== sourceGroup) draggedItem.category = destGroup;

            const globalList: ManagedProperty[] = [];
            PROPERTY_CATEGORIES.forEach(cat => {
                const itemsInCat = newItems.filter(p => (p.category || 'General') === cat);
                if (cat === destGroup) {
                    itemsInCat.splice(result.destination!.index, 0, draggedItem);
                }
                globalList.push(...itemsInCat);
            });
            setAllProperties(globalList.map((p, i) => ({ ...p, order: i })));
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (activeTab === 'statuses') await onUpdateStatuses(allStatuses);
            else if (activeTab === 'properties') await onUpdateProperties(allProperties);
            // Flash success? handled by parent or just button state
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetDefaults = async () => {
        if (!confirm('Reset current tab to defaults? This cannot be undone.')) return;
        setIsSaving(true);
        try {
            if (activeTab === 'statuses') {
                const defaults = DEFAULT_STATUSES.map(s => ({ ...s, applicableTo: (s.visibility?.length === 2) ? 'Both' : (s.visibility?.[0] || 'Both') })) as ManagedStatus[];
                setAllStatuses(defaults);
                await onUpdateStatuses(defaults);
            } else {
                const defaults = (DEFAULT_PROPERTIES as unknown as PropertyOption[]).map(p => ({ ...p, applicableTo: (p.visibility?.length === 2) ? 'Both' : (p.visibility?.[0] || 'Both') })) as ManagedProperty[];
                setAllProperties(defaults);
                await onUpdateProperties(defaults);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const renderFunnelPipeline = () => {
        return (
            <div className="relative pb-20">
                {/* Background Road SVG - Winding Path */}
                <div className="absolute top-0 bottom-0 right-0 w-1/3 pointer-events-none hidden lg:block overflow-hidden opacity-90">
                    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 800">
                        {/* Winding Road Path centered on right side */}
                        <path
                            d="M 50 0 C 50 50, 80 50, 80 100 C 80 150, 20 150, 20 200 C 20 250, 90 250, 90 300 C 90 350, 30 350, 30 400 C 30 450, 80 450, 80 500 C 80 550, 40 550, 40 600 C 40 650, 70 650, 70 700 L 70 800"
                            fill="none"
                            stroke="#374151"
                            strokeWidth="40"
                            strokeLinecap="round"
                        />
                        {/* Dashed Center Line */}
                        <path
                            d="M 50 0 C 50 50, 80 50, 80 100 C 80 150, 20 150, 20 200 C 20 250, 90 250, 90 300 C 90 350, 30 350, 30 400 C 30 450, 80 450, 80 500 C 80 550, 40 550, 40 600 C 40 650, 70 650, 70 700 L 70 800"
                            fill="none"
                            stroke="#F3F4F6"
                            strokeWidth="2"
                            strokeDasharray="10,15"
                            strokeLinecap="round"
                        />
                    </svg>
                </div>

                <div className="flex flex-col gap-2 relative z-10">
                    {FUNNEL_STAGES.map((stage, stageIdx) => {
                        const groupItems = allStatuses.filter(s => (s.funnelStage || 'Nurture') === stage);
                        // Filter logic for sorting within stage if needed

                        // Icon mapping based on stage
                        const getStageIcon = () => {
                            switch (stage) {
                                case 'Leads': return 'fa-magnifying-glass';
                                case 'Nurture': return 'fa-clock';
                                case 'Active Search': return 'fa-map-location-dot';
                                case 'Offer': return 'fa-sack-dollar';
                                case 'Contract': return 'fa-file-signature';
                                case 'Closed': return 'fa-house-chimney';
                                default: return 'fa-box-archive';
                            }
                        };

                        // Theme Colors for alternating delight (using slate/dark for the road look)
                        const isEven = stageIdx % 2 === 0;

                        return (
                            <div key={stage} className="flex gap-4 relative min-h-[160px]">
                                {/* Content Area (Left Side) */}
                                <div className="w-full lg:w-2/3 pr-4 md:pr-12 py-4">
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                        {/* Signpost Header */}
                                        <div className="bg-slate-100 border-b border-slate-200 p-3 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md">
                                                <i className={`fa-solid ${getStageIcon()}`}></i>
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-700 uppercase tracking-widest text-xs translate-y-0.5">{stage}</h3>
                                            </div>
                                            <div className="ml-auto">
                                                <button onClick={() => toggleGroup(stage)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                                                    <i className={`fa-solid fa-chevron-down transition-transform ${expandedGroups.has(stage) ? 'rotate-180' : ''}`}></i>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Dark List Container (Road Map Style) */}
                                        {expandedGroups.has(stage) && (
                                            <div className="bg-slate-800 p-1 space-y-1">
                                                {/* Header Row for Context */}
                                                <div className="flex px-3 py-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider opacity-60">
                                                    <span className="w-[30%]">Status Name</span>
                                                    <span className="flex-1">Description</span>
                                                    <span className="w-[100px] text-center">Persona</span>
                                                    <span className="w-6"></span>
                                                </div>

                                                <TypedDroppable droppableId={stage} isDropDisabled={!!searchQuery}>
                                                    {(provided: any) => (
                                                        <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                                                            {groupItems.map((status, index) => {
                                                                const originalIndex = allStatuses.indexOf(status);
                                                                return (
                                                                    <TypedDraggable
                                                                        key={`status-${originalIndex}`}
                                                                        draggableId={`status::${originalIndex}`}
                                                                        index={index}
                                                                        isDragDisabled={!!searchQuery}
                                                                    >
                                                                        {(provided: any, snapshot: any) => (
                                                                            <div
                                                                                ref={provided.innerRef}
                                                                                {...provided.draggableProps}
                                                                                className={`relative flex items-center gap-3 px-3 py-2 rounded-md border border-transparent transition-all group/row ${snapshot.isDragging ? 'bg-slate-700 shadow-xl border-indigo-500/50 z-50' : 'bg-slate-700/50 hover:bg-slate-700 hover:border-slate-600'}`}
                                                                            >
                                                                                {/* Drag Handle */}
                                                                                <div {...provided.dragHandleProps} className="text-slate-500 hover:text-indigo-400 cursor-grab active:cursor-grabbing">
                                                                                    <i className="fa-solid fa-grip-lines text-xs"></i>
                                                                                </div>

                                                                                {/* Status Name */}
                                                                                <div className="w-[30%]">
                                                                                    <input
                                                                                        type="text"
                                                                                        value={status.label}
                                                                                        onChange={(e) => handleUpdateItem(originalIndex, { label: e.target.value }, 'status')}
                                                                                        className="w-full bg-transparent text-xs font-bold text-white placeholder:text-slate-500 border-none p-0 focus:ring-0"
                                                                                        placeholder="Name"
                                                                                    />
                                                                                </div>

                                                                                {/* Description */}
                                                                                <div className="flex-1">
                                                                                    <input
                                                                                        type="text"
                                                                                        value={status.description}
                                                                                        onChange={(e) => handleUpdateItem(originalIndex, { description: e.target.value }, 'status')}
                                                                                        className="w-full bg-transparent text-[11px] text-slate-300 placeholder:text-slate-600 border-none p-0 focus:ring-0"
                                                                                        placeholder="Description..."
                                                                                    />
                                                                                </div>

                                                                                {/* Persona Toggles */}
                                                                                <div className="flex items-center gap-1 w-[100px] justify-center">
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            const newVis = status.visibility?.includes('Buyer') ? status.visibility.filter(v => v !== 'Buyer') : [...(status.visibility || []), 'Buyer'];
                                                                                            handleUpdateItem(originalIndex, { visibility: newVis as any }, 'status');
                                                                                        }}
                                                                                        className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold transition-all border ${status.visibility?.includes('Buyer') ? 'bg-sky-500 border-sky-600 text-white' : 'bg-transparent border-slate-600 text-slate-500 hover:border-slate-400'}`}
                                                                                        title="Buyer"
                                                                                    >
                                                                                        B
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            const newVis = status.visibility?.includes('Seller') ? status.visibility.filter(v => v !== 'Seller') : [...(status.visibility || []), 'Seller'];
                                                                                            handleUpdateItem(originalIndex, { visibility: newVis as any }, 'status');
                                                                                        }}
                                                                                        className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold transition-all border ${status.visibility?.includes('Seller') ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-transparent border-slate-600 text-slate-500 hover:border-slate-400'}`}
                                                                                        title="Seller"
                                                                                    >
                                                                                        S
                                                                                    </button>
                                                                                </div>

                                                                                {/* Delete */}
                                                                                <div className="w-6 flex justify-end">
                                                                                    {!status.isDefault && (
                                                                                        <button
                                                                                            onClick={() => handleRemoveItem(originalIndex, 'status')}
                                                                                            className="text-slate-600 hover:text-rose-400 transition-colors"
                                                                                        >
                                                                                            <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </TypedDraggable>
                                                                );
                                                            })}
                                                            {provided.placeholder}

                                                            {/* Add Button */}
                                                            <button
                                                                onClick={() => handleAddItem(stage, 'status')}
                                                                className="w-full py-2 border border-dashed border-slate-600 rounded-md text-[10px] font-bold text-slate-500 hover:text-indigo-300 hover:border-indigo-400 hover:bg-slate-700/50 transition-all uppercase tracking-wider"
                                                            >
                                                                + Add Status to {stage}
                                                            </button>
                                                        </div>
                                                    )}
                                                </TypedDroppable>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Illustrator Area (Right Side - Desktop Only) */}
                                <div className="hidden lg:flex w-1/3 relative items-center justify-center">
                                    {/* Icon placed on Road */}
                                    {/* This simple absolute positioning approximates the winding road placement */}
                                    <div className={`absolute ${isEven ? 'right-[20%]' : 'right-[60%]'} w-16 h-16 bg-white rounded-full border-4 border-slate-200 shadow-xl flex items-center justify-center text-2xl text-slate-600 z-20`}>
                                        <i className={`fa-solid ${getStageIcon()}`}></i>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderTable = (groups: string[], type: 'status' | 'property') => {
        const isStatus = type === 'status';
        let items: any[] = [];
        if (type === 'status') items = allStatuses;
        else items = allProperties;

        return (
            <div className="space-y-6">
                {groups.map((group) => {
                    const groupItems = items.filter(item => {
                        const groupMatch = isStatus ? ((item as ManagedStatus).funnelStage || 'Nurture') === group : ((item as ManagedProperty).category || 'General') === group;
                        if (!groupMatch) return false;
                        if (searchQuery) {
                            return item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                item.description.toLowerCase().includes(searchQuery.toLowerCase());
                        }
                        return true;
                    });

                    // Filter logic needs to be aware of the original index for stable IDs
                    const groupItemsWithIndex = groupItems.map(item => ({ item, originalIndex: items.indexOf(item) }));

                    if (searchQuery && groupItems.length === 0) return null;
                    const isExpanded = expandedGroups.has(group);

                    return (
                        <div key={group} className={`bg-white rounded-2xl border transition-all duration-300 ${isExpanded ? 'border-indigo-100 shadow-sm' : 'border-slate-100'}`}>
                            <div onClick={() => toggleGroup(group)} className={`flex items-center justify-between py-2.5 px-4 cursor-pointer select-none transition-colors ${isExpanded ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] transition-colors ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                        <i className={`fa-solid ${isExpanded ? 'fa-folder-open' : 'fa-folder'}`}></i>
                                    </div>
                                    <div>
                                        <h3 className={`text-[10px] font-black uppercase tracking-[0.1em] ${isExpanded ? 'text-indigo-900' : 'text-slate-500'}`}>{group}</h3>
                                        <p className="text-[9px] text-slate-400 font-medium leading-none mt-0.5">{groupItems.length} {isStatus ? 'Statuses' : 'Fields'}</p>
                                    </div>
                                </div>
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${isExpanded ? 'bg-indigo-100 text-indigo-600 rotate-180' : 'text-slate-300'}`}>
                                    <i className="fa-solid fa-chevron-down text-[8px]"></i>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="border-t border-indigo-50/50">
                                    <TypedDroppable droppableId={group} isDropDisabled={!!searchQuery}>
                                        {(provided: any) => (
                                            <table className="w-full text-left" {...provided.droppableProps} ref={provided.innerRef}>
                                                <thead className="bg-slate-50 border-b border-slate-100">
                                                    <tr>
                                                        <th className="w-10 py-2"></th>
                                                        <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[240px]">Name</th>
                                                        {type !== 'status' && <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[110px]">Visibility</th>}
                                                        {type !== 'status' && <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[140px]">Field Type</th>}
                                                        <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</th>
                                                        <th className="w-8 py-2"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {groupItemsWithIndex.map(({ item, originalIndex }, index) => (
                                                        <TypedDraggable
                                                            key={`${type}-${originalIndex}`}
                                                            draggableId={`${type}::${originalIndex}`}
                                                            index={index}
                                                            isDragDisabled={!!searchQuery}
                                                        >
                                                            {(provided: any, snapshot: any) => (
                                                                <tr ref={provided.innerRef} {...provided.draggableProps} className={`group hover:bg-slate-50/80 transition-colors ${snapshot.isDragging ? 'bg-white shadow-xl z-50 ring-2 ring-indigo-500/20 rounded-lg' : ''}`}>
                                                                    {!searchQuery && (
                                                                        <td className="px-4 py-2 w-10 align-top">
                                                                            <div {...provided.dragHandleProps} className="text-slate-300 hover:text-indigo-400 cursor-grab active:cursor-grabbing transition-colors flex justify-center pt-2">
                                                                                <i className="fa-solid fa-grip-vertical text-[10px]"></i>
                                                                            </div>
                                                                        </td>
                                                                    )}
                                                                    <td className="px-4 py-2 w-[240px] align-middle">
                                                                        <div className="flex items-center gap-2.5 group/field">
                                                                            <div className="relative group/select flex-shrink-0">
                                                                                {item.applicableTo !== 'Both' ? (
                                                                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black transition-all cursor-pointer shadow-sm border ${item.applicableTo === 'Buyer' ? 'bg-sky-500 text-white border-sky-600' : 'bg-emerald-500 text-white border-emerald-600'} ${item.isLocked ? 'cursor-not-allowed' : ''}`}>
                                                                                        {item.isLocked ? <i className="fa-solid fa-lock text-[6px]"></i> : (item.applicableTo === 'Buyer' ? 'B' : 'S')}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-slate-300 transition-opacity cursor-pointer border border-dashed border-slate-200 ${item.isLocked ? 'opacity-100 bg-slate-50 border-slate-300' : 'opacity-0 group-hover/field:opacity-100'}`}>
                                                                                        <i className={`fa-solid ${item.isLocked ? 'fa-lock text-[6px]' : 'fa-plus text-[8px]'}`}></i>
                                                                                    </div>
                                                                                )}
                                                                                <select
                                                                                    value={item.applicableTo}
                                                                                    onChange={(e) => handleUpdateItem(originalIndex, { applicableTo: e.target.value as any }, type)}
                                                                                    className={`absolute inset-0 w-full h-full opacity-0 ${item.isLocked ? 'cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
                                                                                    disabled={item.isLocked}
                                                                                >
                                                                                    <option value="Both">Common (All Tabs)</option>
                                                                                    <option value="Buyer">Buyer Only</option>
                                                                                    <option value="Seller">Seller Only</option>
                                                                                </select>
                                                                            </div>
                                                                            <input
                                                                                type="text"
                                                                                value={item.label}
                                                                                onChange={(e) => handleUpdateItem(originalIndex, { label: e.target.value }, type)}
                                                                                className="flex-1 min-w-0 bg-transparent font-semibold text-slate-900 text-sm leading-snug focus:outline-none focus:text-indigo-700 placeholder:text-slate-300 px-0 py-0.5 border-b border-transparent focus:border-indigo-100 transition-all font-sans"
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                    {type !== 'status' && (
                                                                        <td className="px-4 py-2 w-[110px] align-top">
                                                                            <FunnelVisibilitySelect
                                                                                selected={item.funnelVisibility || ['All']}
                                                                                onChange={(next) => handleUpdateItem(originalIndex, { funnelVisibility: next }, type)}
                                                                                disabled={(item as any).isLocked}
                                                                            />
                                                                        </td>
                                                                    )}
                                                                    {type !== 'status' && (
                                                                        <td className="px-4 py-2 w-[140px] align-top">
                                                                            <div className="flex flex-col gap-1.5 pt-1">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${item.type === 'boolean' ? 'bg-amber-50 text-amber-700 border border-amber-100' : item.type === 'integer' ? 'bg-purple-50 text-purple-700 border border-purple-100' : item.type === 'enum' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-slate-50 text-slate-600 border border-slate-100'}`}>
                                                                                        {item.type || 'string'}
                                                                                    </div>
                                                                                    <i className="fa-solid fa-lock text-[8px] text-slate-300"></i>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    )}
                                                                    <td className="px-4 py-2 align-top">
                                                                        <div className="flex flex-col">
                                                                            <textarea
                                                                                value={item.description}
                                                                                onChange={(e) => handleUpdateItem(originalIndex, { description: e.target.value }, type)}
                                                                                className="w-full bg-transparent text-slate-600 text-sm leading-snug font-medium focus:outline-none focus:text-slate-900 px-0 py-0.5 font-sans resize-none overflow-hidden min-h-[1.5rem]"
                                                                                rows={1}
                                                                                onInput={(e) => {
                                                                                    const target = e.target as HTMLTextAreaElement;
                                                                                    target.style.height = 'auto';
                                                                                    target.style.height = target.scrollHeight + 'px';
                                                                                }}
                                                                                ref={(el) => {
                                                                                    if (el) {
                                                                                        el.style.height = 'auto';
                                                                                        el.style.height = el.scrollHeight + 'px';
                                                                                    }
                                                                                }}
                                                                            />
                                                                            {item.type === 'enum' && (
                                                                                <div className="flex flex-wrap gap-1 mt-2">
                                                                                    {item.options?.map((opt: string) => (
                                                                                        <span key={opt} className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[9px] font-bold text-slate-500 shadow-sm">
                                                                                            {opt}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-2 w-8 text-right align-top">
                                                                        {!((item as any).isDefault || false) && (
                                                                            <button onClick={() => handleRemoveItem(originalIndex, type)} className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-all flex items-center justify-center pt-2">
                                                                                <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </TypedDraggable>
                                                    ))}
                                                    {provided.placeholder}
                                                </tbody>
                                            </table>
                                        )}
                                    </TypedDroppable>
                                    {!searchQuery && (
                                        <div className="p-2 border-t border-slate-50">
                                            <button onClick={() => handleAddItem(group, type)} className="w-full py-2 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all">
                                                <i className="fa-solid fa-plus"></i>
                                                Add Item to {group}
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
                <div className="w-full max-w-5xl mx-auto pb-24">
                    {/* Header Controls */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Data Fields</h2>
                            <p className="text-xs text-slate-500 font-medium mt-1">Configure your data model ({activeTab === 'statuses' ? allStatuses.length : allProperties.length} items)</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Tabs */}
                            <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm mr-4">
                                <button onClick={() => setActiveTab('properties')} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'properties' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                                    Leads Fields
                                </button>
                                <button onClick={() => setActiveTab('statuses')} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'statuses' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                                    Funnel Stages Fields
                                </button>
                            </div>

                            <button type="button" onClick={handleResetDefaults} disabled={isSaving} className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition-colors">
                                Reset Tab Defaults
                            </button>
                            <button onClick={handleSave} disabled={isSaving} className={`px-6 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all ${isSaving ? 'bg-slate-400 text-white cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-xl active:scale-95'} flex items-center gap-2`}>
                                {isSaving ? <><i className="fa-solid fa-spinner fa-spin"></i><span>Saving...</span></> : <><i className="fa-solid fa-floppy-disk"></i><span>Save</span></>}
                            </button>
                        </div>
                    </div>

                    {activeTab === 'statuses' && renderTable(FUNNEL_STAGES, 'status')}
                    {activeTab === 'properties' && renderTable(PROPERTY_CATEGORIES, 'property')}

                    {/* Legend Section */}
                    <div className="mt-12">
                        {/* Elegant Persona Legend */}
                        <div className="max-w-sm bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Persona Legend</h4>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-md bg-sky-500 flex items-center justify-center text-[10px] font-black text-white shadow-sm">B</div>
                                    <span className="text-xs font-bold text-slate-600">Buyer Only</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center text-[10px] font-black text-white shadow-sm">S</div>
                                    <span className="text-xs font-bold text-slate-600">Seller Only</span>
                                </div>
                                <div className="pt-2 border-t border-slate-50 italic">
                                    <span className="text-[10px] text-slate-400 font-medium">Fields without icons are visible to both personas.</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Developer Tools */}
                    <div className="mt-12 pt-8 border-t border-slate-200">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Developer Tools</h3>
                        <div className="flex flex-col gap-4">
                            {onResetData && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); onResetData(); }}
                                    className="text-rose-500 hover:text-rose-700 text-xs font-bold flex items-center gap-2 transition-all hover:translate-x-1"
                                >
                                    <i className="fa-solid fa-trash-can"></i>
                                    Reset & Seed Mock Database
                                </button>
                            )}
                            <div className="text-[10px] text-slate-400 font-medium italic">
                                Note: Resetting mock data will delete all existing leads and reload the default demonstration data.
                            </div>
                        </div>
                    </div>
                </div>
            </DragDropContext>
        </div>
    );
};

export default StatusSettings;
