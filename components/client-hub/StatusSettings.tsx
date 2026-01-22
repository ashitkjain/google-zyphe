import React, { useState, useMemo } from 'react';
import { StatusOption, PropertyOption } from '../../types';
import { DEFAULT_STATUSES } from '../../services/statusService';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { collection, getDocs, writeBatch, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { db_instance } from '../../services/firebaseService';
import { generateMockLead } from '../../services/mockData';
import { LEAD_FIELD_CONFIG as DEFAULT_PROPERTIES, LEAD_STAGE_LIFECYCLE_CONFIG } from '../../types/lead';

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
    resetLogs?: string[];
    isResetting?: boolean;
    defaultTab?: 'statuses' | 'properties';
}

interface ManagedStatus extends StatusOption {
    applicableTo?: 'Both' | 'Buyer' | 'Seller';
}

interface ManagedProperty extends PropertyOption {
    applicableTo?: 'Both' | 'Buyer' | 'Seller';
}

const FUNNEL_STAGES = ['Leads', 'Nurture', 'Active Search', 'Offer', 'Closing', 'Closed', 'Archived'];

const PROPERTY_CATEGORIES = [
    'Leads',
    'Nurture',
    'Active Search',
    'Offer',
    'Closing',
    'General' // For lifecycle fields
];



const StatusSettings: React.FC<StatusSettingsProps> = ({
    realtorId,
    onUpdateStatuses,
    onUpdateProperties,
    initialStatuses,
    initialProperties,
    onResetData,
    resetLogs = [],
    isResetting = false,
    defaultTab,
}) => {
    // Forced to 'properties' as we removed the tab switcher
    const [activeTab, setActiveTab] = useState<'statuses' | 'properties'>('properties');

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
    const [activeCategory, setActiveCategory] = useState<string>('Leads');

    // --- Property Logic ---
    // Initialize properties with category synchronization
    // If a property exists in the Default Config, we FORCE its category to match the new config.
    // This allows us to re-organize categories in the code and have it reflect for users without resetting details.
    // --- Property Logic ---
    // Initialize properties with category synchronization directly in useState initializer
    const [allProperties, setAllProperties] = useState<ManagedProperty[]>(() => {
        if (!initialProperties || initialProperties.length === 0) {
            const allConfigs = [...DEFAULT_PROPERTIES, ...LEAD_STAGE_LIFECYCLE_CONFIG];
            return (allConfigs as unknown as PropertyOption[]).map(p => ({
                ...p,
                applicableTo: (p.visibility?.length === 2) ? 'Both' : (p.visibility?.[0] || 'Both'),
                funnelVisibility: p.funnelVisibility || ['All'],
                isLocked: p.isLocked || false
            })) as ManagedProperty[];
        } else {
            const allConfigs = [...DEFAULT_PROPERTIES, ...LEAD_STAGE_LIFECYCLE_CONFIG];

            // 1. Sync existing properties with new config definitions
            const syncedProperties = initialProperties.map(p => {
                const defaultConfig = allConfigs.find(dp => dp.id === p.id) as any;
                if (defaultConfig) {
                    return {
                        ...p,
                        category: defaultConfig.category, // FORCE update category
                        label: defaultConfig.label,       // FORCE update label
                        description: defaultConfig.description, // FORCE update description
                        type: defaultConfig.type || p.type,     // SYNC type
                        options: defaultConfig.options || p.options, // SYNC options
                        fields: defaultConfig.fields || p.fields, // SYNC fields (sub-structure)
                        isLocked: defaultConfig.isLocked || false, // SYNC locked status
                        visibility: defaultConfig.visibility || p.visibility, // SYNC visibility
                        funnelVisibility: defaultConfig.isLocked
                            ? (defaultConfig.funnelVisibility || ['All'])
                            : ((p.funnelVisibility && p.funnelVisibility.length > 0 && !(p.funnelVisibility.length === 1 && p.funnelVisibility[0] === 'All' && defaultConfig.funnelVisibility && defaultConfig.funnelVisibility.length > 0 && !defaultConfig.funnelVisibility.includes('All')))
                                ? p.funnelVisibility
                                : (defaultConfig.funnelVisibility || ['All']))
                    };
                }
                return p;
            });

            // 2. Add any NEW properties from config that are missing in initialProperties
            const existingIds = new Set(initialProperties.map(p => p.id));
            const missingProperties = (allConfigs as unknown as PropertyOption[])
                .filter(dp => !existingIds.has(dp.id))
                .map(dp => ({
                    ...dp,
                    applicableTo: (dp.visibility?.length === 2) ? 'Both' : (dp.visibility?.[0] || 'Both'),
                    funnelVisibility: dp.funnelVisibility || ['All'],
                    isLocked: dp.isLocked || false,
                    order: syncedProperties.length // Append at end, will be re-ordered if needed or user can re-order
                }));

            // Combine and map final structure, filtering out hidden system fields
            const HIDDEN_FIELD_IDS = ['id', 'isMock', 'collectionName', 'clientId', 'leadStatus', 'nurtureStatus', 'activeSearchStatus', 'offerStatus', 'closingStatus'];
            return [...syncedProperties, ...missingProperties]
                .filter(p => !HIDDEN_FIELD_IDS.includes(p.id))
                .map(p => ({
                    ...p,
                    applicableTo: (p.visibility?.length === 2) ? 'Both' : (p.visibility?.[0] || 'Both'),
                    funnelVisibility: p.isLocked ? (p.funnelVisibility || ['All']) : (p.funnelVisibility || ['All']),
                    isLocked: p.isLocked || false
                })) as ManagedProperty[];
        }

    });


    const [searchQuery, setSearchQuery] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set([...FUNNEL_STAGES, ...PROPERTY_CATEGORIES]));
    const [expandedFields, setExpandedFields] = useState<Set<string>>(() => {
        const expanded = new Set<string>();
        allProperties.forEach((p, idx) => {
            if (p.type === 'object' || p.type === 'list') {
                expanded.add(p.id || `field-${idx}`);
            }
        });
        return expanded;
    });

    const [isSaving, setIsSaving] = useState(false);
    const [isMigrating, setIsMigrating] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [showResetDefaultsConfirm, setShowResetDefaultsConfirm] = useState(false);

    const db = db_instance;

    const addLog = (msg: string) => setLogs(prev => [msg, ...prev]);

    const toggleGroup = (group: string) => {
        const next = new Set(expandedGroups);
        if (next.has(group)) next.delete(group);
        else next.add(group);
        setExpandedGroups(next);
    };

    const toggleField = (fieldId: string) => {
        const next = new Set(expandedFields);
        if (next.has(fieldId)) next.delete(fieldId);
        else next.add(fieldId);
        setExpandedFields(next);
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

    const handleUpdateSubField = (parentIndex: number, subIndex: number, nestedUpdates: any) => {
        const parentProperty = allProperties[parentIndex];
        const nextFields = [...(parentProperty.fields || [])];
        const currentField = typeof nextFields[subIndex] === 'string' ? { name: nextFields[subIndex] } : nextFields[subIndex];
        nextFields[subIndex] = { ...currentField, ...nestedUpdates };
        handleUpdateItem(parentIndex, { fields: nextFields }, 'property');
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
        setShowResetDefaultsConfirm(false);
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

                                                <div className="space-y-1">
                                                    {groupItems.map((status, index) => {
                                                        const originalIndex = allStatuses.indexOf(status);
                                                        return (
                                                            <div
                                                                key={`status-${originalIndex}`}
                                                                className={`relative flex items-center gap-3 px-3 py-2 rounded-md border border-transparent transition-all group/row bg-slate-700/50 hover:bg-slate-700 hover:border-slate-600`}
                                                            >
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
                                                        );
                                                    })}

                                                    {/* Add Button */}
                                                    <button
                                                        onClick={() => handleAddItem(stage, 'status')}
                                                        className="w-full py-2 border border-dashed border-slate-600 rounded-md text-[10px] font-bold text-slate-500 hover:text-indigo-300 hover:border-indigo-400 hover:bg-slate-700/50 transition-all uppercase tracking-wider"
                                                    >
                                                        + Add Status to {stage}
                                                    </button>
                                                </div>
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


                    return (
                        <div key={group} className="bg-white rounded-2xl border transition-all duration-300 border-indigo-100 shadow-sm">
                            <div className="flex items-center justify-between py-2.5 px-4 bg-indigo-50/30">
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] transition-colors bg-indigo-100 text-indigo-600">
                                        <i className="fa-solid fa-folder"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.1em] text-indigo-900">{group}</h3>
                                        <p className="text-[9px] text-slate-400 font-medium leading-none mt-0.5">{groupItems.length} {isStatus ? 'Statuses' : 'Fields'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-indigo-50/50">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[240px]">Name</th>
                                            {type !== 'status' && <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[140px]">Field Type</th>}
                                            <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {groupItemsWithIndex.map(({ item, originalIndex }, index) => {
                                            const isObject = item.type === 'object' || item.type === 'list';
                                            const isFieldExpanded = expandedFields.has(item.id || `field-${index}`);

                                            return (
                                                <React.Fragment key={`${type}-${originalIndex}-fragment`}>
                                                    <tr className={`group hover:bg-slate-50/80 transition-colors`}>
                                                        <td className="px-4 py-2 w-[240px] align-middle">
                                                            <div className="flex items-center gap-2.5 group/field">
                                                                {isObject && (
                                                                    <button onClick={() => toggleField(item.id || `field-${index}`)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                                                                        <i className={`fa-solid fa-chevron-right text-[10px] transition-transform ${isFieldExpanded ? 'rotate-90' : ''}`}></i>
                                                                    </button>
                                                                )}
                                                                <div className="flex-1 min-w-0 font-semibold text-slate-900 text-sm leading-snug px-0 py-0.5 font-sans">
                                                                    {item.label}
                                                                </div>
                                                                {item.visibility && item.visibility.length === 1 && item.visibility.includes('Buyer') && (
                                                                    <div className="w-5 h-5 rounded bg-sky-500 flex items-center justify-center text-[8px] font-black text-white shadow-sm" title="Buyer Only">B</div>
                                                                )}
                                                                {item.visibility && item.visibility.length === 1 && item.visibility.includes('Seller') && (
                                                                    <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center text-[8px] font-black text-white shadow-sm" title="Seller Only">S</div>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {type !== 'status' && (
                                                            <td className="px-4 py-2 w-[140px] align-top">
                                                                <div className="flex flex-col gap-1.5 pt-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${item.type === 'boolean' ? 'bg-amber-50 text-amber-700 border border-amber-100' : item.type === 'integer' ? 'bg-purple-50 text-purple-700 border border-purple-100' : item.type === 'enum' ? 'bg-blue-50 text-blue-700 border border-blue-100' : (item.type === 'object' || item.type === 'list') ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'bg-slate-50 text-slate-600 border border-slate-100'}`}>
                                                                            {item.type || 'string'}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        )}
                                                        <td className="px-4 py-2 align-top">
                                                            <div className="flex flex-col">
                                                                <div className="w-full text-slate-600 text-sm leading-snug font-medium px-0 py-0.5 font-sans">
                                                                    {item.description}
                                                                </div>
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

                                                    </tr>
                                                    {isObject && isFieldExpanded && (
                                                        <tr className="bg-slate-50/50">
                                                            <td colSpan={6} className="p-0 border-b border-slate-100">
                                                                <div className="w-full relative">
                                                                    {/* Indentation line on the left to visually group */}
                                                                    <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-indigo-100"></div>

                                                                    <table className="w-full">
                                                                        <tbody>
                                                                            {item.fields && item.fields.length > 0 ? (
                                                                                item.fields.map((field: any, idx: number) => {
                                                                                    const isObj = typeof field === 'object';
                                                                                    const name = isObj ? field.name : field;
                                                                                    const label = isObj ? (field.label || field.name) : field;
                                                                                    const type = isObj ? field.type : 'string';
                                                                                    const desc = isObj ? field.description : '';

                                                                                    return (
                                                                                        <tr key={`${originalIndex}-sub-${idx}`} className="hover:bg-indigo-50/20 transition-colors">
                                                                                            {/* 2. Indented Name */}
                                                                                            <td className="w-[240px] px-4 py-2 align-top">
                                                                                                <div className="flex items-center gap-2 pl-6">
                                                                                                    <div className="w-4 h-4 border-l-2 border-b-2 border-indigo-200 rounded-bl-md -mt-3.5"></div>
                                                                                                    <div className="flex flex-col">
                                                                                                        <span className="text-xs font-bold text-slate-700">{label}</span>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </td>

                                                                                            {/* 4. Type */}
                                                                                            <td className="w-[140px] px-4 py-2 align-top">
                                                                                                <div className="flex gap-2">
                                                                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${type === 'date' || type === 'timestamp' ? 'bg-orange-50 text-orange-700 border-orange-100' : type === 'currency' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : type === 'enum' ? 'bg-blue-50 text-blue-700 border-blue-100' : type?.startsWith('list') ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                                                                        {type}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </td>

                                                                                            {/* 5. Description */}
                                                                                            <td className="px-4 py-2 align-top">
                                                                                                <p className="text-xs text-slate-500 font-medium leading-relaxed">{desc || 'No description provided.'}</p>
                                                                                                {type === 'enum' && field.options && (
                                                                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                                                                        {field.options.map((opt: string) => (
                                                                                                            <span key={opt} className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[9px] font-bold text-slate-500 shadow-sm">
                                                                                                                {opt}
                                                                                                            </span>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                )}
                                                                                            </td>

                                                                                            {/* 6. Action Spacer */}
                                                                                            <td className="w-1"></td>
                                                                                        </tr>
                                                                                    );
                                                                                })
                                                                            ) : (
                                                                                <tr>

                                                                                    <td colSpan={4} className="px-10 py-3 text-xs text-slate-400 italic">
                                                                                        Complex defined structure (no breakdown available).
                                                                                    </td>
                                                                                    <td className="w-1"></td>
                                                                                </tr>
                                                                            )}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>

                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-2">
            <div className="w-full max-w-5xl mx-auto pb-24">
                {/* Header Controls */}
                <div className="flex items-center justify-between mb-2">
                    <div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Tabs */}
                        {/* Tabs Removed - only showing Leads Fields now */}
                    </div>
                </div>

                {/* Category Tabs */}
                <div className="flex p-1 bg-slate-100 rounded-xl mb-4 overflow-x-auto no-scrollbar border border-slate-200">
                    {PROPERTY_CATEGORIES.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`flex-1 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeCategory === cat
                                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {renderTable([activeCategory], 'property')}

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
                            <div className="flex items-center gap-6">
                                <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); onResetData(); }}
                                    className="text-rose-500 hover:text-rose-700 text-xs font-bold flex items-center gap-2 transition-all hover:translate-x-1"
                                >
                                    <i className="fa-solid fa-trash-can"></i>
                                    Reset & Seed Mock Database
                                </button>

                                <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); setShowResetDefaultsConfirm(true); }}
                                    className="text-amber-500 hover:text-amber-700 text-xs font-bold flex items-center gap-2 transition-all hover:translate-x-1"
                                >
                                    <i className="fa-solid fa-rotate-left"></i>
                                    Restore Current Tab Defaults
                                </button>
                            </div>
                        )}

                        {resetLogs.length > 0 && (
                            <div className="mt-4 bg-slate-950 rounded-2xl border border-white/5 overflow-hidden shadow-2xl flex flex-col">
                                <div className="bg-slate-900 px-6 py-3 border-b border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Protocol Output</span>
                                    </div>
                                    {isResetting && <i className="fa-solid fa-spinner fa-spin text-indigo-400 text-xs"></i>}
                                </div>
                                <div className="p-6 h-64 overflow-y-auto font-mono text-[10px] leading-relaxed flex flex-col gap-2 scrollbar-thin">
                                    {resetLogs.map((log, i) => (
                                        <div key={i} className="flex gap-4 group">
                                            <span className="text-slate-700 flex-shrink-0">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                                            <span className={
                                                log.includes('[Error]') ? 'text-rose-400 font-bold' :
                                                    log.includes('[Cleanup]') ? 'text-amber-400/80' :
                                                        log.includes('[Seed]') ? 'text-emerald-400/80' :
                                                            log.includes('[System]') ? 'text-indigo-400 font-bold' :
                                                                'text-slate-400'
                                            }>
                                                {log}
                                            </span>
                                        </div>
                                    ))}
                                    {isResetting && (
                                        <div className="text-white/20 italic animate-pulse">Executing Firestore batch queries...</div>
                                    )}
                                    <div id="logs-end"></div>
                                </div>
                            </div>
                        )}

                        <div className="text-[10px] text-slate-400 font-medium italic mt-2">
                            Note: Resetting mock data will delete all existing leads and reload the default demonstration data.
                        </div>
                    </div>
                </div>
                {/* Reset Defaults Confirmation Modal */}
                {showResetDefaultsConfirm && (
                    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-300">
                            <div className="p-10 text-center">
                                <div className="w-20 h-20 rounded-3xl bg-amber-50 flex items-center justify-center mb-8 mx-auto">
                                    <i className="fa-solid fa-rotate-left text-3xl text-amber-500"></i>
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Restore Defaults</h3>
                                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                    This will restore all <span className="font-bold text-slate-700">{activeTab}</span> to their original system defaults. <span className="text-amber-600 font-bold">Your customizations will be lost.</span>
                                </p>
                            </div>
                            <div className="p-8 bg-slate-50 flex flex-col gap-3">
                                <button
                                    onClick={handleResetDefaults}
                                    className="w-full py-4 bg-amber-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-amber-600 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all"
                                >
                                    Restore Defaults
                                </button>
                                <button
                                    onClick={() => setShowResetDefaultsConfirm(false)}
                                    className="w-full py-4 bg-white text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:text-slate-600 hover:bg-slate-100 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatusSettings;
