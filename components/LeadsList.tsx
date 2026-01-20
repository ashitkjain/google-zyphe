import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Lead, PipelineNote, UserProfile, FunnelStage } from '../types';
import { LEAD_FIELD_CONFIG, LEAD_STAGE_LIFECYCLE_CONFIG } from '../types/lead';
import { PropertyOption } from '../types/shared';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { getStatusOptions, getStatusDefinitions, isNewLeadStatus, getFunnelStageForStatus } from '../services/statusService';
import { InternalProps, ViewMode, DisplayMode } from './leads/types';
import LeadGalleryItem from './leads/LeadGalleryItem';
import LeadsHeader from './leads/LeadsHeader';
import LeadsViewControls from './leads/LeadsViewControls';
import { noteTypes } from './leads/PostItPalette';
import { defaultBuyerVisible, defaultSellerVisible } from './leads/constants';
import LeadsKanbanBoard from './leads/LeadsKanbanBoard';


const LeadsList: React.FC<InternalProps> = ({
    leads,
    onUpdateLead,

    onCreateLead,
    onActivateLead,
    notes,
    pendingNote,
    setPendingNote,
    handleSaveNote,
    handleUpdateNote,
    handleDeleteNote,
    handleDragEnd,
    realtorSettings,
    onUpdateAvatar,
    onUpdateSettings,
    onTabChange
}) => {
    const formatLeadAge = (dateInput: any) => {
        if (!dateInput) return '--';
        const date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
        const now = new Date();
        const diffMs = Math.max(0, now.getTime() - date.getTime());
        const d = Math.floor(diffMs / 86400000);
        const h = Math.floor((diffMs % 86400000) / 3600000);
        const m = Math.floor((diffMs % 3600000) / 60000);

        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        if (m > 0) parts.push(`${m}m`);
        if (parts.length === 0) return 'Just now';

        return parts.join(' ');
    };

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sortField, setSortField] = useState<keyof Lead>('lastUpdated');

    const STATUS_OPTIONS = useMemo(() => {
        // Since LeadsList shows all leads, we might need to show a combined list of statuses
        // or handle it per lead. For the main filter and bulk actions, we'll use a unique set.
        const buyerOpts = getStatusOptions('Buyer', realtorSettings).map((o: any) => o.label);
        const sellerOpts = getStatusOptions('Seller', realtorSettings).map((o: any) => o.label);
        return Array.from(new Set([...buyerOpts, ...sellerOpts]));
    }, [realtorSettings]);

    const getStatusDefinitionsForLead = (lead: Lead) => {
        return getStatusDefinitions(lead.leadType, realtorSettings);
    };
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const [showFilters, setShowFilters] = useState(false);
    const [showStatusInfo, setShowStatusInfo] = useState(false);
    const [columnFilters, setColumnFilters] = useState({
        name: '',
        phone: '',
        email: '',
        status: '',
        source: '',
    });
    const [activeTab, setActiveTab] = useState<'Buyer' | 'Seller'>('Buyer');



    const [buyerFunnelCategory, setBuyerFunnelCategory] = useState<FunnelStage | 'Closed & Archived'>('Leads');
    const [sellerFunnelCategory, setSellerFunnelCategory] = useState<FunnelStage | 'Closed & Archived'>('Leads');

    const computeVisibleColumns = (type: 'Buyer' | 'Seller', stage: FunnelStage | 'Closed & Archived') => {
        // Use user settings if available, otherwise defaults
        // We cast to PropertyOption[] because strict typing might miss some runtime properties or optional mismatch
        const properties = (realtorSettings?.leadProperties || [...LEAD_FIELD_CONFIG, ...LEAD_STAGE_LIFECYCLE_CONFIG]) as PropertyOption[];

        const valid = properties.filter(p => {
            // Check Persona Visibility
            const isVisibleForPersona = !p.visibility || p.visibility.includes(type);

            // Check Funnel Visibility
            const stages = p.funnelVisibility || ['All'];
            const isVisibleForStage = stages.includes('All') ||
                (stage === 'Closed & Archived' ? (stages.includes('Closed') || stages.includes('Archived')) : stages.includes(stage as FunnelStage));

            return isVisibleForPersona && isVisibleForStage;
        });

        // Sort by order if available (user defined order), otherwise keep existing order
        const sorted = valid.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

        // Limit to 10 fields and return IDs
        return new Set(sorted.map(p => p.id));
    };

    const getVisibleColumns = (type: 'Buyer' | 'Seller') => {
        const stage = type === 'Buyer' ? buyerFunnelCategory : sellerFunnelCategory;
        const effectiveStage = stage === 'Closed & Archived' ? 'Closed' : stage;
        return computeVisibleColumns(type, effectiveStage as FunnelStage);
    };
    const MANUAL_BUYER_COLS = new Set(['fullName', 'status', 'phone', 'email', 'callCount', 'lastUpdated', 'isAlsoSelling', 'preQualified', 'preferredNeighborhood', 'source', 'leadInfo', 'message', 'timeframe', 'leaseEndDate', 'tags', 'notes', 'funnelStage', 'firstName', 'lastName', 'clientPhotoUrl', 'avatarUrl']);
    const MANUAL_SELLER_COLS = new Set(['fullName', 'status', 'phone', 'email', 'isAlsoBuying', 'homeValueNeeded', 'sellWhen', 'occupancyStatus', 'source', 'leadInfo', 'reasonForSelling', 'existingAgentName', 'message', 'tags', 'notes', 'funnelStage', 'firstName', 'lastName', 'clientPhotoUrl', 'avatarUrl']);

    // NEW: Dynamic sorting based on prioritization settings
    useEffect(() => {
        const type = activeTab;
        const stage = type === 'Buyer' ? buyerFunnelCategory : sellerFunnelCategory;
        const properties = (realtorSettings?.leadProperties || [...LEAD_FIELD_CONFIG, ...LEAD_STAGE_LIFECYCLE_CONFIG]) as PropertyOption[];

        const valid = properties.filter(p => {
            const isVisibleForPersona = !p.visibility || p.visibility.includes(type);
            const stages = p.funnelVisibility || ['All'];
            const isVisibleForStage = stages.includes('All') || stages.includes(stage);
            return isVisibleForPersona && isVisibleForStage;
        });

        // Find highest priority field (lowest order)
        const sorted = valid.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

        if (sorted.length > 0) {
            const topField = sorted[0].id as keyof Lead;
            setSortField(topField);

            // Smart default direction
            const isDate = ['receivedAt', 'lastUpdated', 'leaseEndDate', 'stageLastChangedAt'].includes(topField);
            setSortDirection(isDate ? 'desc' : 'asc');
        }
    }, [activeTab, buyerFunnelCategory, sellerFunnelCategory, realtorSettings]); // Run whenever context changes

    const [buyerViewMode, setBuyerViewMode] = useState<'past6Months' | 'older'>('past6Months');
    const [sellerViewMode, setSellerViewMode] = useState<'past6Months' | 'older'>('past6Months');

    // Display Mode Mapping (Default: Past 6 Months -> Gallery, Older -> List)
    const [viewMode, setViewMode] = useState<'past6Months' | 'older'>('past6Months'); // Legacy

    const [globalDisplayMode, setGlobalDisplayMode] = useState<DisplayMode>('kanban');

    const currentDisplayMode = globalDisplayMode;

    const toggleDisplayMode = (mode: 'list' | 'gallery') => {
        setGlobalDisplayMode(mode);
    };

    // Clear selection on view change
    useEffect(() => {
        setSelectedIds(new Set());
    }, [activeTab, buyerViewMode, sellerViewMode, buyerFunnelCategory, sellerFunnelCategory]);

    // Inline Editing State
    const [editingCell, setEditingCell] = useState<{ id: string, field: keyof Lead } | null>(null);
    const [editValue, setEditValue] = useState<string>('');

    // Post-it Logic State
    const [draftContent, setDraftContent] = useState('');
    const [editNoteId, setEditNoteId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
    const [deleteCoords, setDeleteCoords] = useState<{ top: number, left: number } | null>(null);
    const [celebratingNoteId, setCelebratingNoteId] = useState<string | null>(null);
    const [isFlyingUpId, setIsFlyingUpId] = useState<string | null>(null);

    // Memos to find the note data for the animation clones
    const animatingNoteData = useMemo(() => {
        const id = deletingNoteId || isFlyingUpId;
        if (!id) return null;
        // Search in global notes first
        let note = (notes || []).find(n => n.id === id);
        if (note) return note;
        // Fallback: search in leads' notesLog
        for (const l of leads) {
            const found = (l.notesLog || []).find(n => n.id === id);
            if (found) return found;
        }
        return null;
    }, [deletingNoteId, isFlyingUpId, notes, leads]);

    const onDoneToggle = (e: React.MouseEvent, note: PipelineNote) => {
        e.stopPropagation();
        if (note.isDone) {
            handleUpdateNote(note.id, { isDone: false, timestamp: new Date() });
            return;
        }

        const rect = (e.currentTarget.closest('.post-it-container') as HTMLElement).getBoundingClientRect();
        setDeleteCoords({ top: rect.top, left: rect.left });
        setCelebratingNoteId(note.id);

        setTimeout(() => {
            setCelebratingNoteId(null);
            setIsFlyingUpId(note.id);
            setTimeout(() => {
                handleUpdateNote(note.id, { isDone: true, timestamp: new Date() });
                setIsFlyingUpId(null);
                setDeleteCoords(null);
            }, 800);
        }, 500);
    };

    const onDeleteClick = (e: React.MouseEvent, noteId: string) => {
        e.stopPropagation();
        const rect = (e.currentTarget.closest('.post-it-container') as HTMLElement).getBoundingClientRect();
        setDeleteCoords({ top: rect.top, left: rect.left });
        setDeletingNoteId(noteId);
        setTimeout(() => {
            handleDeleteNote(noteId);
            setDeletingNoteId(null);
            setDeleteCoords(null);
        }, 800);
    };

    // Global click listener to "Complete" edits when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.post-it-container') && !target.closest('.note-palette-item')) {
                const activeEl = document.activeElement;
                if (activeEl instanceof HTMLTextAreaElement &&
                    (activeEl.classList.contains('post-it-edit') || activeEl.classList.contains('post-it-draft'))) {
                    activeEl.blur();
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const startEditing = (e: React.MouseEvent, id: string, field: keyof Lead, value: any) => {
        e.stopPropagation(); // Prevent row click
        setEditingCell({ id, field });
        setEditValue(value || '');
    };

    const saveEditing = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (editingCell) {
            onUpdateLead(editingCell.id, { [editingCell.field]: editValue });
            setEditingCell(null);
            setEditValue('');
        }
    };

    const [confirmModal, setConfirmModal] = useState<{ show: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

    const handleBulkArchive = () => {
        if (selectedIds.size === 0) return;

        const executeArchive = () => {
            selectedIds.forEach(id => {
                onUpdateLead(id, { status: 'Archived' });
            });
            setSelectedIds(new Set());
            setConfirmModal(null);
        };

        if (selectedIds.size === 1) {
            executeArchive();
            return;
        }

        setConfirmModal({
            show: true,
            title: 'Confirm Bulk Archive',
            message: `Are you sure you want to archive ${selectedIds.size} selected leads?`,
            onConfirm: executeArchive
        });
    };

    const cancelEditing = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingCell(null);
        setEditValue('');
    };

    const renderCell = (lead: Lead, field: keyof Lead, type: 'text' | 'select' = 'text', options: string[] = []) => {
        const isEditing = editingCell?.id === lead.id && editingCell?.field === field;
        const value = lead[field] as string;

        if (isEditing) {
            return (
                <div className="flex items-center gap-1 min-w-[120px]" onClick={e => e.stopPropagation()}>
                    {type === 'select' ? (
                        <select
                            autoFocus
                            className="bg-white border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
                            defaultValue={value}
                            onChange={(e) => {
                                const newValue = e.target.value;
                                onUpdateLead(lead.id, { [field]: newValue });
                                setEditingCell(null);
                            }}
                            onClick={e => e.stopPropagation()}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    e.stopPropagation();
                                    setEditingCell(null);
                                }
                            }}
                        >
                            {options.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    ) : (
                        <>
                            <input
                                autoFocus
                                type="text"
                                className="bg-white border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEditing(e as any);
                                    if (e.key === 'Escape') cancelEditing(e as any);
                                }}
                            />
                            <button onClick={saveEditing} className="text-emerald-500 hover:text-emerald-700 bg-emerald-50 p-1 rounded flex-shrink-0"><i className="fa-solid fa-check"></i></button>
                            <button onClick={cancelEditing} className="text-red-400 hover:text-red-600 bg-red-50 p-1 rounded flex-shrink-0"><i className="fa-solid fa-xmark"></i></button>
                        </>
                    )}
                </div>
            );
        }

        if (field === 'daysInStage') {
            const currentStage = lead.funnelStage || (lead.leadType === 'Seller' ? sellerFunnelCategory : buyerFunnelCategory);
            const currentStageEntry = lead.stageHistory?.find(
                entry => entry.toStage === currentStage && !entry.exitedAt
            );
            const startDate = currentStageEntry?.enteredAt || lead.stageLastChangedAt || lead.leadInfo?.createdDate || lead.receivedAt;
            if (startDate) {
                const start = typeof startDate.toDate === 'function' ? startDate.toDate() : new Date(startDate);
                const diff = Math.max(0, new Date().getTime() - start.getTime());
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                return `${days} days`;
            }
            return '--';
        }

        const fieldConfig = [...LEAD_FIELD_CONFIG, ...LEAD_STAGE_LIFECYCLE_CONFIG].find(c => c.id === field);
        const currentStage = lead.funnelStage || (lead.leadType === 'Seller' ? sellerFunnelCategory : buyerFunnelCategory);

        const isStageVisible = (stages: readonly string[] | string[] | undefined) => {
            if (!stages || stages.includes('All')) return true;
            const effectiveStage = currentStage === 'Closed & Archived' ? 'Closed' : currentStage;
            return stages.includes(effectiveStage as any);
        };

        if (fieldConfig?.type === 'object' && lead[field as keyof Lead]) {
            const data = lead[field as keyof Lead] as any;
            const visibleFields = ((fieldConfig as any).fields || [])
                .filter((f: any) => typeof f === 'object' && isStageVisible(f.funnelVisibility))
                .map((f: any) => {
                    const val = data[f.name];
                    if (val === undefined || val === null || val === '') return null;
                    if (typeof val === 'object' && val.note) return val.note;
                    if (f.type === 'currency') return `$${(val / 1000).toFixed(0)}k`;
                    if (f.type === 'date' || f.type === 'timestamp') {
                        const d = val?.toDate ? val.toDate() : new Date(val);
                        return d.toLocaleDateString();
                    }
                    return val.toString();
                })
                .filter(Boolean);

            return visibleFields.join(', ') || '--';
        }

        if (fieldConfig?.type === 'list' && lead[field as keyof Lead]) {
            const list = lead[field as keyof Lead] as any[];
            if (!list.length) return '--';

            // Special handling for common list types or generic fallback
            if (field === 'stageHistory' || field === 'nurtureLog') {
                const last = list[list.length - 1];
                const prefix = field === 'stageHistory' ? 'Last' : 'Latest';
                const separator = field === 'stageHistory' ? ' -> ' : ', ';

                const visibleParts = (fieldConfig.fields || [])
                    .filter((f: any) => typeof f === 'object' && isStageVisible(f.funnelVisibility))
                    .map((f: any) => {
                        const val = last[f.name];
                        if (val === undefined || val === null || val === '') return null;
                        if (f.type === 'timestamp' || f.type === 'date') {
                            const d = val?.toDate ? val.toDate() : new Date(val);
                            return d.toLocaleDateString();
                        }
                        return val.toString();
                    })
                    .filter(Boolean);
                return `${prefix}: ${visibleParts.join(separator)}`;
            }

            return `${list.length} entries`;
        }

        return (
            <div className="group/cell flex items-center justify-between gap-2 w-full h-full min-h-[20px]">
                <div
                    className="truncate cursor-text"
                    onClick={(e) => {
                        startEditing(e, lead.id, field, value);
                    }}
                >
                    {(() => {
                        if (field === 'status') {
                            const status = lead[field] as string;
                            const isNew = status === 'New';
                            const isArchived = status === 'Archived';
                            return (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isNew ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' :
                                    isArchived ? 'bg-slate-100 text-slate-500 border border-slate-200' :
                                        'bg-indigo-100 text-indigo-600 border border-indigo-200'
                                    }`}>
                                    {status || 'New'}
                                </span>
                            );
                        }
                        if (typeof lead[field] === 'boolean') return lead[field] ? 'Yes' : 'No';
                        if (Array.isArray(lead[field])) return (lead[field] as any[]).length + ' entries';
                        if (typeof lead[field] === 'object' && lead[field] !== null) {
                            if ((lead[field] as any).toDate) return (lead[field] as any).toDate().toLocaleDateString();
                            return JSON.stringify(lead[field]);
                        }
                        return value || <span className="text-slate-300 italic">--</span>;
                    })()}
                </div>
                <button
                    onClick={(e) => startEditing(e, lead.id, field, value)}
                    className="opacity-0 group-hover/cell:opacity-100 hover:text-indigo-500 transition-opacity p-1"
                >
                    <i className="fa-solid fa-pencil text-slate-300 text-[10px]"></i>
                </button>
            </div>
        );
    };

    const dateRanges = useMemo(() => {
        const now = new Date();
        const startOf6Months = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());

        return {
            startOf6Months,
            labels: {
                past6Months: `Past 6 Months`,
                older: `Older than 6 Months`
            }
        };
    }, []);

    const timeStats = useMemo(() => {
        const { startOf6Months } = dateRanges;
        const validLeads = leads.filter(l =>
            isNewLeadStatus(l.status, l.leadType, realtorSettings)
        );

        const getStatsForType = (type: 'Buyer' | 'Seller') => {
            const category = type === 'Buyer' ? buyerFunnelCategory : sellerFunnelCategory;
            const typed = leads.filter(l => {
                const stage = getFunnelStageForStatus(l.status, l.leadType, realtorSettings);
                if (category === 'Closed & Archived') {
                    return l.leadType === type && (stage === 'Closed' || stage === 'Archived');
                }
                return l.leadType === type && stage === category;
            });
            return {
                past6Months: typed.filter(l => {
                    const d = l.receivedAt?.toDate ? l.receivedAt.toDate() : new Date(l.receivedAt);
                    return d >= startOf6Months;
                }).length,
                older: typed.filter(l => {
                    const d = l.receivedAt?.toDate ? l.receivedAt.toDate() : new Date(l.receivedAt);
                    return d < startOf6Months;
                }).length
            };
        };

        return {
            Buyer: getStatsForType('Buyer'),
            Seller: getStatsForType('Seller')
        };
    }, [leads, dateRanges, realtorSettings, buyerFunnelCategory, sellerFunnelCategory]);

    const filteredBuyerLeads = useMemo(() => {
        const { startOf6Months } = dateRanges;

        let result = leads.filter(l => {
            if (l.leadType !== 'Buyer' && l.leadType !== 'Rental' && l.leadType !== 'Mortgage') return false;

            let stage = getFunnelStageForStatus(l.status, l.leadType, realtorSettings);

            // Fallback: If status mapping falls back to 'Leads' (default) but the lead has a specific funnelStage (common in mock data or desynced settings), trust the explicit stage.
            if (stage === 'Leads' && l.funnelStage && l.funnelStage !== 'Leads') {
                stage = l.funnelStage;
            }

            if (buyerFunnelCategory === 'Closed & Archived') {
                if (stage !== 'Closed' && stage !== 'Archived') return false;
            } else {
                if (stage !== buyerFunnelCategory) return false;
            }

            // KANBAN EXCEPTION: If in Kanban mode, we want ALL stages visible (so we can drag between columns)
            // But we still respect the viewMode (Past 6 months vs Older) and Type filters.
            const isKanban = globalDisplayMode === 'kanban';
            if (!isKanban) {
                if (buyerFunnelCategory === 'Closed & Archived') {
                    if (stage !== 'Closed' && stage !== 'Archived') return false;
                } else if (stage !== buyerFunnelCategory) return false;
            }

            const d = l.receivedAt?.toDate ? l.receivedAt.toDate() : new Date(l.receivedAt);

            if (buyerFunnelCategory === 'Leads') {
                if (buyerViewMode === 'past6Months') return d >= startOf6Months;
                if (buyerViewMode === 'older') return d < startOf6Months;
            }
            return true;
        });


        if (columnFilters.name) result = result.filter(l => `${l.firstName} ${l.lastName}`.toLowerCase().includes(columnFilters.name.toLowerCase()));
        if (columnFilters.phone) result = result.filter(l => l.phone.toLowerCase().includes(columnFilters.phone.toLowerCase()));
        if (columnFilters.email) result = result.filter(l => l.email.toLowerCase().includes(columnFilters.email.toLowerCase()));
        if (columnFilters.status) result = result.filter(l => l.status === columnFilters.status);
        if (columnFilters.source) result = result.filter(l => l.source === columnFilters.source);

        return result.sort((a, b) => {
            let aVal = a[sortField] as any;
            let bVal = b[sortField] as any;

            // Normalize Date/Timestamp fields for reliable comparison
            const isDateField = ['receivedAt', 'lastUpdated', 'leaseEndDate'].includes(sortField as string);
            if (isDateField) {
                const getVal = (v: any, lead: Lead) => {
                    let dateVal = v;
                    if (sortField === 'receivedAt' && lead.stageLastChangedAt) {
                        dateVal = lead.stageLastChangedAt;
                    }
                    return dateVal?.toDate ? dateVal.toDate().getTime() : (dateVal ? new Date(dateVal).getTime() : 0);
                };
                aVal = getVal(aVal, a);
                bVal = getVal(bVal, b);
            } else if (sortField === 'firstName') {
                aVal = `${a.firstName} ${a.lastName}`.toLowerCase();
                bVal = `${b.firstName} ${b.lastName}`.toLowerCase();
            }

            if (aVal === bVal) return 0;
            if (aVal === undefined || aVal === null || aVal === 0) return 1;
            if (bVal === undefined || bVal === null || bVal === 0) return -1;

            const comparison = aVal > bVal ? 1 : -1;
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [leads, buyerViewMode, buyerFunnelCategory, columnFilters, sortField, sortDirection, realtorSettings, globalDisplayMode]);

    const filteredSellerLeads = useMemo(() => {
        const { startOf6Months } = dateRanges;

        let result = leads.filter(l => {
            if (l.leadType !== 'Seller') return false;

            let stage = getFunnelStageForStatus(l.status, l.leadType, realtorSettings);

            // Fallback for mock data or desynced settings
            if (stage === 'Leads' && l.funnelStage && l.funnelStage !== 'Leads') {
                stage = l.funnelStage;
            }

            // KANBAN EXCEPTION
            // KANBAN EXCEPTION
            const isKanban = globalDisplayMode === 'kanban';
            if (!isKanban) {
                if (sellerFunnelCategory === 'Closed & Archived') {
                    if (stage !== 'Closed' && stage !== 'Archived') return false;
                } else if (stage !== sellerFunnelCategory) return false;
            }

            const d = l.receivedAt?.toDate ? l.receivedAt.toDate() : new Date(l.receivedAt);

            if (sellerFunnelCategory === 'Leads') {
                if (sellerViewMode === 'past6Months') return d >= startOf6Months;
                if (sellerViewMode === 'older') return d < startOf6Months;
            }
            return true;
        });

        if (columnFilters.name) result = result.filter(l => `${l.firstName} ${l.lastName}`.toLowerCase().includes(columnFilters.name.toLowerCase()));
        if (columnFilters.phone) result = result.filter(l => l.phone.toLowerCase().includes(columnFilters.phone.toLowerCase()));
        if (columnFilters.email) result = result.filter(l => l.email.toLowerCase().includes(columnFilters.email.toLowerCase()));
        if (columnFilters.status) result = result.filter(l => l.status === columnFilters.status);
        if (columnFilters.source) result = result.filter(l => l.source === columnFilters.source);

        return result.sort((a, b) => {
            let aVal = a[sortField] as any;
            let bVal = b[sortField] as any;

            // Normalize Date/Timestamp fields for reliable comparison
            const isDateField = ['receivedAt', 'lastUpdated', 'leaseEndDate'].includes(sortField as string);

            if (sortField === 'leadInfo') {
                const getVal = (lead: Lead) => {
                    const d = lead.leadInfo?.createdDate || lead.receivedAt;
                    return d?.toDate ? d.toDate().getTime() : (d ? new Date(d).getTime() : 0);
                };
                aVal = getVal(a);
                bVal = getVal(b);
            } else if (isDateField) {
                const getVal = (v: any, lead: Lead) => {
                    let dateVal = v;
                    if (sortField === 'receivedAt' && lead.stageLastChangedAt) {
                        dateVal = lead.stageLastChangedAt;
                    }
                    return dateVal?.toDate ? dateVal.toDate().getTime() : (dateVal ? new Date(dateVal).getTime() : 0);
                };
                aVal = getVal(aVal, a);
                bVal = getVal(bVal, b);
            } else if (sortField === 'firstName') {
                aVal = `${a.firstName} ${a.lastName}`.toLowerCase();
                bVal = `${b.firstName} ${b.lastName}`.toLowerCase();
            }

            if (aVal === bVal) return 0;
            if (aVal === undefined || aVal === null || aVal === 0) return 1;
            if (bVal === undefined || bVal === null || bVal === 0) return -1;

            const comparison = aVal > bVal ? 1 : -1;
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [leads, sellerViewMode, sellerFunnelCategory, columnFilters, sortField, sortDirection, realtorSettings, globalDisplayMode]);

    const filteredLeads = useMemo(() => [...filteredBuyerLeads, ...filteredSellerLeads], [filteredBuyerLeads, filteredSellerLeads]);

    const handleSelectAll = (leadsToSelect: Lead[], isChecked: boolean) => {
        const newSet = new Set(selectedIds);
        if (isChecked) {
            leadsToSelect.forEach(l => newSet.add(l.id));
        } else {
            leadsToSelect.forEach(l => newSet.delete(l.id));
        }
        setSelectedIds(newSet);
    };

    const handleSelectOne = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleSort = (field: keyof Lead) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-white text-sm font-sans overflow-hidden min-w-0">
            {/* DEBUG BANNER - TEMPORARY */}
            <div className="bg-red-100 border-b border-red-200 p-2 text-xs font-mono text-red-800 flex flex-wrap gap-4 items-center z-50">
                <span><strong>Total:</strong> {leads.length}</span>
                <span><strong>Tab:</strong> {activeTab}</span>
                <span><strong>Cat:</strong> {activeTab === 'Buyer' ? buyerFunnelCategory : sellerFunnelCategory}</span>
                <span><strong>Filtered:</strong> {activeTab === 'Buyer' ? filteredBuyerLeads.length : filteredSellerLeads.length}</span>
                <span><strong>L1 Status:</strong> {leads.length > 0 ? `${leads[0].firstName}:${leads[0].status}->${getFunnelStageForStatus(leads[0].status, leads[0].leadType, realtorSettings)}` : 'N/A'}</span>
                <span><strong>L1 FunnelStage:</strong> {leads.length > 0 ? `${leads[0].funnelStage}` : 'N/A'}</span>
                <span><strong>L1 Date:</strong> {leads.length > 0 ? `${leads[0].receivedAt?.toDate ? leads[0].receivedAt.toDate().toLocaleDateString() : new Date(leads[0].receivedAt).toLocaleDateString()}` : 'N/A'}</span>
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap');
                .post-it-font {
                    font-family: 'Architects Daughter', cursive;
                    line-height: 1.2;
                }
                @keyframes fly-to-trash {
                    0% { transform: scale(1) rotate(0deg); opacity: 1; top: var(--start-top); left: var(--start-left); }
                    30% { transform: scale(1.1) rotate(15deg); opacity: 1; }
                    100% { transform: scale(0.1) rotate(360deg); opacity: 0; top: 100vh; left: 50vw; }
                }
                .animate-fly-away {
                    position: fixed !important; z-index: 9999 !important; pointer-events: none;
                    animation: fly-to-trash 0.8s cubic-bezier(0.55, 0.055, 0.675, 0.19) forwards;
                }
                @keyframes fly-up-high {
                    0% { transform: scale(1) rotate(0deg); opacity: 1; top: var(--start-top); left: var(--start-left); }
                    100% { transform: scale(0.5) rotate(-15deg); opacity: 0; top: -200px; left: var(--start-left); }
                }
                .animate-fly-up {
                    position: fixed !important; z-index: 9999 !important; pointer-events: none;
                    animation: fly-up-high 0.8s cubic-bezier(0.55, 0.055, 0.675, 0.19) forwards;
                }
                @keyframes shake-only {
                    0%, 100% { transform: rotate(0deg); }
                    20% { transform: rotate(-2deg); }
                    40% { transform: rotate(2deg); }
                    60% { transform: rotate(-2deg); }
                    80% { transform: rotate(2deg); }
                }
                .animate-shake { animation: shake-only 0.5s ease-in-out; }
                .urgent-glow {
                    box-shadow: 0 0 10px rgba(255, 69, 0, 0.4) !important;
                    border: 1px solid rgba(255, 69, 0, 0.3) !important;
                }
            `}} />

            <LeadsHeader
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onCreateLead={onCreateLead}
                displayMode={globalDisplayMode}
                setDisplayMode={setGlobalDisplayMode}
            />

            {globalDisplayMode === 'kanban' ? (
                <div className="flex-1 overflow-hidden bg-slate-50 p-4">
                    <LeadsKanbanBoard
                        leads={filteredLeads}
                        onUpdateLead={onUpdateLead}
                        realtorSettings={realtorSettings}
                        leadType={activeTab}
                    />
                </div>
            ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white mb-0 space-y-4 py-4">
                        {/* Buyer Section */}
                        {activeTab === 'Buyer' && (
                            <section className="px-4 animate-in fade-in slide-in-from-left-4 duration-300">
                                <LeadsViewControls
                                    activeTab="Buyer"
                                    activeFunnelCategory={buyerFunnelCategory}
                                    onFunnelCategoryChange={setBuyerFunnelCategory}
                                    viewMode={buyerViewMode}
                                    onViewModeChange={setBuyerViewMode}
                                    timeStats={timeStats.Buyer}
                                    dateRangeLabels={dateRanges.labels}
                                    selectedCount={selectedIds.size}
                                    onArchive={handleBulkArchive}
                                    showFilters={showFilters}
                                    setShowFilters={setShowFilters}
                                    displayMode={currentDisplayMode}
                                    setDisplayMode={toggleDisplayMode}
                                    onTabChange={onTabChange}
                                />
                                {
                                    showFilters && (
                                        <div className="mt-[-1rem] mb-4 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-5 gap-2 flex-shrink-0 w-full animate-in slide-in-from-top-2">
                                            <input
                                                type="text"
                                                placeholder="Filter Name..."
                                                className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                                                value={columnFilters.name}
                                                onChange={(e) => setColumnFilters({ ...columnFilters, name: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Filter Phone..."
                                                className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                                                value={columnFilters.phone}
                                                onChange={(e) => setColumnFilters({ ...columnFilters, phone: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Filter Email..."
                                                className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                                                value={columnFilters.email}
                                                onChange={(e) => setColumnFilters({ ...columnFilters, email: e.target.value })}
                                            />
                                            <select
                                                className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                                                value={columnFilters.status}
                                                onChange={(e) => setColumnFilters({ ...columnFilters, status: e.target.value })}
                                            >
                                                <option value="">All Statuses</option>
                                                {STATUS_OPTIONS.map(s => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )
                                }

                                {filteredBuyerLeads.length > 0 ? (
                                    currentDisplayMode === 'list' ? (
                                        <div className="overflow-x-auto w-full pb-6">
                                            <table className="w-full text-left border-collapse min-w-full">
                                                <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-semibold text-slate-500">
                                                    <tr>
                                                        <th className="w-12 px-2 py-3 border-b border-slate-200/60 bg-slate-50 text-center">#</th>
                                                        <th className="w-10 px-2 py-3 border-b border-slate-200/60 bg-slate-50">
                                                            <input type="checkbox" onChange={(e) => handleSelectAll(filteredBuyerLeads, e.target.checked)} checked={filteredBuyerLeads.length > 0 && filteredBuyerLeads.every(l => selectedIds.has(l.id))} className="rounded border-slate-300" />
                                                        </th>
                                                        <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Profile Picture</th>
                                                        <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('firstName')}>
                                                            Full Name {sortField === 'firstName' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                        </th>
                                                        {getVisibleColumns('Buyer').has('funnelStage') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Funnel Stage</th>}
                                                        {getVisibleColumns('Buyer').has('status') && (
                                                            <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>
                                                                Lead Status {sortField === 'status' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                            </th>
                                                        )}

                                                        {getVisibleColumns('Buyer').has('phone') && (
                                                            <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('phone')}>
                                                                Contact Info {sortField === 'phone' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                            </th>
                                                        )}
                                                        {getVisibleColumns('Buyer').has('callCount') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 text-center">Call Tracker</th>}
                                                        {getVisibleColumns('Buyer').has('lastUpdated') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Last Updated On</th>}
                                                        {getVisibleColumns('Buyer').has('isAlsoSelling') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 text-center">Also Selling?</th>}
                                                        {getVisibleColumns('Buyer').has('preQualified') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 text-center">Pre-qualified?</th>}
                                                        {getVisibleColumns('Buyer').has('preferredNeighborhood') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Preferred Neighborhood</th>}
                                                        {getVisibleColumns('Buyer').has('source') && (
                                                            <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('source')}>
                                                                Source {sortField === 'source' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                            </th>
                                                        )}
                                                        {getVisibleColumns('Buyer').has('leadInfo') && (
                                                            <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('leadInfo')}>
                                                                Lead Info {sortField === 'leadInfo' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                            </th>
                                                        )}
                                                        {getVisibleColumns('Buyer').has('message') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Message</th>}
                                                        {getVisibleColumns('Buyer').has('timeframe') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Timeframe</th>}
                                                        {getVisibleColumns('Buyer').has('leaseEndDate') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Lease End Date</th>}
                                                        {getVisibleColumns('Buyer').has('tags') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Tags</th>}

                                                        {getVisibleColumns('Buyer').has('notes') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Call Notes</th>}

                                                        {/* Dynamic Columns */}
                                                        {Array.from(getVisibleColumns('Buyer') as Set<string>).filter((id: string) => !MANUAL_BUYER_COLS.has(id)).map((colId: string) => {
                                                            const allConfigs = [...LEAD_FIELD_CONFIG, ...LEAD_STAGE_LIFECYCLE_CONFIG];
                                                            const fieldConfig = allConfigs.find(c => c.id === colId);
                                                            return (
                                                                <th key={colId} className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort(colId as any)}>
                                                                    {fieldConfig?.label || colId} {sortField === colId && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                                </th>
                                                            );
                                                        })}

                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {filteredBuyerLeads.map((lead, index) => (
                                                        <tr key={lead.id} className="group text-slate-700 text-sm transition-colors hover:bg-slate-50/80">
                                                            <td className="px-2 py-2 border-b border-slate-100 text-center text-slate-400 font-bold opacity-50">{index + 1}</td>
                                                            <td className="px-2 py-2 border-b border-slate-100">
                                                                <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => handleSelectOne(lead.id)} className="rounded border-slate-300" />
                                                            </td>
                                                            <td className="px-2 py-2 border-b border-slate-100">
                                                                <div className="w-8 h-8 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shadow-sm">
                                                                    {lead.clientPhotoUrl ? (
                                                                        <img src={lead.clientPhotoUrl} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <i className="fa-solid fa-user text-slate-300 text-[10px]"></i>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-2 border-b border-slate-100 font-bold text-slate-900">
                                                                {lead.firstName} {lead.lastName}
                                                            </td>
                                                            {getVisibleColumns('Buyer').has('funnelStage') && <td className="px-2 py-2 border-b border-slate-100 font-medium text-xs text-indigo-500 uppercase tracking-tighter">{lead.funnelStage || '--'}</td>}
                                                            {getVisibleColumns('Buyer').has('status') && (
                                                                <td className="px-2 py-2 border-b border-slate-100">
                                                                    {renderCell(lead, 'status', 'select', getStatusOptions(lead.leadType, realtorSettings).map((o: any) => o.label))}
                                                                </td>
                                                            )}

                                                            {getVisibleColumns('Buyer').has('phone') && (
                                                                <td className="px-2 py-2 border-b border-slate-100">
                                                                    <div className="flex flex-col">
                                                                        <div className="text-xs font-semibold text-slate-700 leading-tight mb-0.5 flex items-center gap-2">
                                                                            <span>{renderCell(lead, 'phone')}</span>
                                                                            {['text', 'call', 'sms'].includes((lead.preferredContactMethod || '').toLowerCase()) && (
                                                                                <span className="text-[9px] text-slate-400 font-medium italic whitespace-nowrap flex-shrink-0">
                                                                                    preferred - {(lead.preferredContactMethod || '').toLowerCase() === 'call' ? 'call' : 'text'}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-[10px] text-blue-600 font-medium leading-tight flex items-center gap-2">
                                                                            <span className="truncate">{renderCell(lead, 'email')}</span>
                                                                            {(lead.preferredContactMethod || '').toLowerCase() === 'email' && (
                                                                                <span className="text-[9px] text-slate-400 font-medium italic whitespace-nowrap flex-shrink-0">
                                                                                    preferred
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            )}
                                                            {getVisibleColumns('Buyer').has('callCount') && (
                                                                <td className="px-2 py-2 border-b border-slate-100 text-center">
                                                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-full text-xs font-bold border border-slate-200">
                                                                        {lead.callCount || 0}
                                                                    </span>
                                                                </td>
                                                            )}
                                                            {getVisibleColumns('Buyer').has('lastUpdated') && (
                                                                <td className="px-2 py-2 border-b border-slate-100 text-xs text-slate-500 font-medium whitespace-nowrap">
                                                                    {lead.lastUpdated ? (lead.lastUpdated?.toDate ? lead.lastUpdated.toDate().toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date(lead.lastUpdated).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })) : '--'}
                                                                </td>
                                                            )}
                                                            {getVisibleColumns('Buyer').has('isAlsoSelling') && (
                                                                <td className="px-2 py-2 border-b border-slate-100 text-center">
                                                                    <div
                                                                        className="flex justify-center cursor-pointer"
                                                                        onClick={(e) => startEditing(e, lead.id, 'isAlsoSelling', lead.isAlsoSelling ? 'Yes' : 'No')}
                                                                    >
                                                                        {editingCell?.id === lead.id && editingCell?.field === 'isAlsoSelling' ? (
                                                                            <div onClick={e => e.stopPropagation()}>
                                                                                <select
                                                                                    autoFocus
                                                                                    className="bg-white border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-20"
                                                                                    defaultValue={lead.isAlsoSelling ? 'Yes' : 'No'}
                                                                                    onChange={(e) => {
                                                                                        const val = e.target.value === 'Yes';
                                                                                        onUpdateLead(lead.id, { isAlsoSelling: val });
                                                                                        setEditingCell(null);
                                                                                    }}
                                                                                    onBlur={() => setEditingCell(null)}
                                                                                    onClick={e => e.stopPropagation()}
                                                                                >
                                                                                    <option value="Yes">Yes</option>
                                                                                    <option value="No">No</option>
                                                                                </select>
                                                                            </div>
                                                                        ) : (
                                                                            lead.isAlsoSelling === true ? (
                                                                                <div className="w-8 h-6 bg-no-repeat bg-contain" style={{ backgroundImage: 'url(/assets/checkmark-cross.png)', backgroundPosition: '0% center', backgroundSize: '200% 100%', mixBlendMode: 'multiply' }}></div>
                                                                            ) : (
                                                                                <div className="w-8 h-6 bg-no-repeat bg-contain" style={{ backgroundImage: 'url(/assets/checkmark-cross.png)', backgroundPosition: '100% center', backgroundSize: '200% 100%', mixBlendMode: 'multiply' }}></div>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            )}
                                                            {getVisibleColumns('Buyer').has('preQualified') && (
                                                                <td className="px-2 py-2 border-b border-slate-100 text-center font-semibold">
                                                                    <div
                                                                        className="flex justify-center cursor-pointer"
                                                                        onClick={(e) => startEditing(e, lead.id, 'preQualified', lead.preQualified ? 'Yes' : 'No')}
                                                                    >
                                                                        {editingCell?.id === lead.id && editingCell?.field === 'preQualified' ? (
                                                                            <div onClick={e => e.stopPropagation()}>
                                                                                <select
                                                                                    autoFocus
                                                                                    className="bg-white border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-20"
                                                                                    defaultValue={lead.preQualified ? 'Yes' : 'No'}
                                                                                    onChange={(e) => {
                                                                                        const val = e.target.value === 'Yes';
                                                                                        onUpdateLead(lead.id, { preQualified: val });
                                                                                        setEditingCell(null);
                                                                                    }}
                                                                                    onBlur={() => setEditingCell(null)}
                                                                                    onClick={e => e.stopPropagation()}
                                                                                >
                                                                                    <option value="Yes">Yes</option>
                                                                                    <option value="No">No</option>
                                                                                </select>
                                                                            </div>
                                                                        ) : (
                                                                            lead.preQualified === true ? (
                                                                                <div className="w-8 h-6 bg-no-repeat bg-contain" style={{ backgroundImage: 'url(/assets/checkmark-cross.png)', backgroundPosition: '0% center', backgroundSize: '200% 100%', mixBlendMode: 'multiply' }}></div>
                                                                            ) : (
                                                                                <div className="w-8 h-6 bg-no-repeat bg-contain" style={{ backgroundImage: 'url(/assets/checkmark-cross.png)', backgroundPosition: '100% center', backgroundSize: '200% 100%', mixBlendMode: 'multiply' }}></div>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            )}
                                                            {getVisibleColumns('Buyer').has('preferredNeighborhood') && <td className="px-2 py-2 border-b border-slate-100 font-medium underline text-indigo-600/80 decoration-indigo-200 underline-offset-4">{renderCell(lead, 'preferredNeighborhood' as any)}</td>}
                                                            {getVisibleColumns('Buyer').has('source') && <td className="px-2 py-2 border-b border-slate-100 text-xs font-semibold text-indigo-500">{lead.source}</td>}
                                                            {getVisibleColumns('Buyer').has('leadInfo') && (
                                                                <td className="px-2 py-2 border-b border-slate-100 text-xs text-slate-900 font-medium">
                                                                    <div>{lead.leadInfo?.createdDate ? (lead.leadInfo.createdDate.toDate ? lead.leadInfo.createdDate.toDate().toLocaleDateString() : new Date(lead.leadInfo.createdDate).toLocaleDateString()) : '--'}</div>
                                                                    <div className="text-[10px] text-slate-400">{lead.leadInfo?.origin || lead.source || '--'}</div>
                                                                </td>
                                                            )}
                                                            {getVisibleColumns('Buyer').has('message') && (
                                                                <td className="px-2 py-2 border-b border-slate-100 text-xs text-slate-600 max-w-[200px] whitespace-normal" title={lead.message}>
                                                                    {lead.message || '--'}
                                                                </td>
                                                            )}
                                                            {getVisibleColumns('Buyer').has('timeframe') && <td className="px-2 py-2 border-b border-slate-100 font-medium text-xs">{lead.timeframe || '--'}</td>}
                                                            {getVisibleColumns('Buyer').has('leaseEndDate') && (
                                                                <td className="px-2 py-2 border-b border-slate-100 text-[10px] text-slate-500 font-medium">
                                                                    {lead.leaseEndDate ? (lead.leaseEndDate?.toDate ? lead.leaseEndDate.toDate().toLocaleDateString() : new Date(lead.leaseEndDate).toLocaleDateString()) : '--'}
                                                                </td>
                                                            )}
                                                            {getVisibleColumns('Buyer').has('tags') && (
                                                                <td className="px-2 py-2 border-b border-slate-100">
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {lead.tags?.map((tag, i) => (
                                                                            <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-medium border border-slate-200">{tag}</span>
                                                                        ))}
                                                                        {(!lead.tags || lead.tags.length === 0) && <span className="text-xs text-slate-300">--</span>}
                                                                    </div>
                                                                </td>
                                                            )}
                                                            {getVisibleColumns('Buyer').has('notes') && (
                                                                <td className="px-2 py-2 border-b border-slate-100 min-w-[200px] max-w-[300px]">
                                                                    <div className="flex flex-col gap-2 max-h-[100px] overflow-y-auto custom-scrollbar">
                                                                        {/* Last Call Note */}
                                                                        {lead.callNotes && lead.callNotes.length > 0 && (() => {
                                                                            const lastCallNote = [...lead.callNotes].sort((a, b) => b.callNumber - a.callNumber)[0];
                                                                            return (
                                                                                <div className="flex items-start gap-2 bg-indigo-50 rounded-lg p-1.5 border border-indigo-100">
                                                                                    <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                                                                        <span className="text-[8px] font-black text-indigo-600">#{lastCallNote.callNumber}</span>
                                                                                    </div>
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <div className="flex items-center gap-1 mb-0.5">
                                                                                            <span className={`px-1 py-0 rounded text-[7px] font-bold uppercase ${lastCallNote.outcome === 'Connected' ? 'bg-emerald-100 text-emerald-600' :
                                                                                                lastCallNote.outcome === 'Voicemail' ? 'bg-amber-100 text-amber-600' :
                                                                                                    'bg-slate-100 text-slate-500'
                                                                                                }`}>
                                                                                                {lastCallNote.outcome || 'Connected'}
                                                                                            </span>
                                                                                        </div>
                                                                                        <p className="text-[10px] text-slate-700 line-clamp-2">{lastCallNote.note}</p>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                        {/* Comments */}
                                                                        {(lead.notesLog || []).length > 0 ? (
                                                                            lead.notesLog!.slice(-2).reverse().map((note, i) => (
                                                                                <div key={note.id || i} className="text-[11px] leading-tight text-slate-600">
                                                                                    <span className="opacity-50 text-[10px] mr-1">
                                                                                        {note.timestamp?.toDate ? note.timestamp.toDate().toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date(note.timestamp).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                                    </span>
                                                                                    {note.content}
                                                                                </div>
                                                                            ))
                                                                        ) : (
                                                                            !lead.callNotes?.length && <span className="text-xs text-slate-300">--</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            )}

                                                            {/* Dynamic Cells */}
                                                            {Array.from(getVisibleColumns('Buyer') as Set<string>).filter((id: string) => !MANUAL_BUYER_COLS.has(id)).map((colId: string) => (
                                                                <td key={colId} className="px-2 py-2 border-b border-slate-100 text-xs text-slate-600">
                                                                    {renderCell(lead, colId as any)}
                                                                </td>
                                                            ))}

                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-24">
                                            {filteredBuyerLeads.map((lead, index) => (
                                                <LeadGalleryItem
                                                    onUpdateAvatar={onUpdateAvatar}
                                                    key={lead.id}
                                                    lead={lead}
                                                    stage={buyerFunnelCategory}
                                                    index={index}
                                                    selectedIds={selectedIds}
                                                    handleSelectOne={handleSelectOne}
                                                    notes={notes}
                                                    editNoteId={editNoteId}
                                                    setEditNoteId={setEditNoteId}
                                                    editContent={editContent}
                                                    setEditContent={setEditContent}
                                                    handleUpdateNote={handleUpdateNote}
                                                    onDoneToggle={onDoneToggle}
                                                    onDeleteClick={onDeleteClick}
                                                    pendingNote={pendingNote}
                                                    draftContent={draftContent}
                                                    setDraftContent={setDraftContent}
                                                    handleSaveNote={handleSaveNote}
                                                    setPendingNote={setPendingNote}
                                                    deleteCoords={deleteCoords}
                                                    deletingNoteId={deletingNoteId}
                                                    celebratingNoteId={celebratingNoteId}
                                                    isFlyingUpId={isFlyingUpId}
                                                    onArchive={(id) => onUpdateLead(id, { status: 'Archived' })}
                                                    onActivate={(id) => onUpdateLead(id, { status: 'New' })}
                                                    visibleColumns={getVisibleColumns('Buyer')}
                                                    activeTab="Buyer"
                                                    onUpdateLead={onUpdateLead}
                                                    realtorSettings={realtorSettings}
                                                />
                                            ))}
                                        </div>
                                    )
                                ) : (
                                    <div className="py-12 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-[2rem]">
                                        No buyers found in funnel for this period.
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Seller Section */}
                        {activeTab === 'Seller' && (
                            <section className="px-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <LeadsViewControls
                                    activeTab="Seller"
                                    activeFunnelCategory={sellerFunnelCategory}
                                    onFunnelCategoryChange={setSellerFunnelCategory}
                                    viewMode={sellerViewMode}
                                    onViewModeChange={setSellerViewMode}
                                    timeStats={timeStats.Seller}
                                    dateRangeLabels={dateRanges.labels}
                                    selectedCount={selectedIds.size}
                                    onArchive={handleBulkArchive}
                                    showFilters={showFilters}
                                    setShowFilters={setShowFilters}
                                    displayMode={currentDisplayMode}
                                    setDisplayMode={toggleDisplayMode}
                                    onTabChange={onTabChange}
                                />
                                {
                                    showFilters && (
                                        <div className="mt-[-1rem] mb-4 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-5 gap-2 flex-shrink-0 w-full animate-in slide-in-from-top-2">
                                            <input
                                                type="text"
                                                placeholder="Filter Name..."
                                                className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                                                value={columnFilters.name}
                                                onChange={(e) => setColumnFilters({ ...columnFilters, name: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Filter Phone..."
                                                className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                                                value={columnFilters.phone}
                                                onChange={(e) => setColumnFilters({ ...columnFilters, phone: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Filter Email..."
                                                className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                                                value={columnFilters.email}
                                                onChange={(e) => setColumnFilters({ ...columnFilters, email: e.target.value })}
                                            />
                                            <select
                                                className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                                                value={columnFilters.status}
                                                onChange={(e) => setColumnFilters({ ...columnFilters, status: e.target.value })}
                                            >
                                                <option value="">All Statuses</option>
                                                {STATUS_OPTIONS.map(s => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )
                                }
                                {filteredSellerLeads.length > 0 ? (
                                    currentDisplayMode === 'list' ? (
                                        <div className="overflow-x-auto w-full pb-6">
                                            <table className="w-full text-left border-collapse min-w-full">
                                                <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-semibold text-slate-500">
                                                    <tr>
                                                        <th className="w-12 px-2 py-3 border-b border-slate-200/60 bg-slate-50 text-center">#</th>
                                                        <th className="w-10 px-2 py-3 border-b border-slate-200/60 bg-slate-50">
                                                            <input type="checkbox" onChange={(e) => handleSelectAll(filteredSellerLeads, e.target.checked)} checked={filteredSellerLeads.length > 0 && filteredSellerLeads.every(l => selectedIds.has(l.id))} className="rounded border-slate-300" />
                                                        </th>
                                                        <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Profile Picture</th>
                                                        <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('firstName')}>
                                                            Full Name {sortField === 'firstName' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                        </th>
                                                        {getVisibleColumns('Seller').has('funnelStage') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Funnel Stage</th>}
                                                        {getVisibleColumns('Seller').has('status') && (
                                                            <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>
                                                                Lead Status {sortField === 'status' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                            </th>
                                                        )}
                                                        {getVisibleColumns('Seller').has('phone') && (
                                                            <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('phone')}>
                                                                Contact Info {sortField === 'phone' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                            </th>
                                                        )}
                                                        {getVisibleColumns('Seller').has('isAlsoBuying') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 text-center">Also Buying?</th>}
                                                        {getVisibleColumns('Seller').has('homeValueNeeded') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 text-center">Home Value Needed?</th>}
                                                        {getVisibleColumns('Seller').has('sellWhen') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Sell When?</th>}
                                                        {getVisibleColumns('Seller').has('occupancyStatus') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Occupancy Status</th>}
                                                        {getVisibleColumns('Seller').has('source') && (
                                                            <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('source')}>
                                                                Source {sortField === 'source' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                            </th>
                                                        )}
                                                        {getVisibleColumns('Seller').has('leadInfo') && (
                                                            <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('leadInfo')}>
                                                                Lead Info {sortField === 'leadInfo' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                            </th>
                                                        )}
                                                        {getVisibleColumns('Seller').has('reasonForSelling') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Reason for Selling</th>}
                                                        {getVisibleColumns('Seller').has('existingAgentName') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Existing Agent?</th>}
                                                        {getVisibleColumns('Seller').has('message') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Message</th>}
                                                        {getVisibleColumns('Seller').has('tags') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Tags</th>}

                                                        {getVisibleColumns('Seller').has('notes') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Comments / Notes</th>}

                                                        {/* Dynamic Columns */}
                                                        {Array.from(getVisibleColumns('Seller') as Set<string>).filter((id: string) => !MANUAL_SELLER_COLS.has(id)).map((colId: string) => {
                                                            const allConfigs = [...LEAD_FIELD_CONFIG, ...LEAD_STAGE_LIFECYCLE_CONFIG];
                                                            const fieldConfig = allConfigs.find(c => c.id === colId);
                                                            return (
                                                                <th key={colId} className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort(colId as any)}>
                                                                    {fieldConfig?.label || colId} {sortField === colId && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                                </th>
                                                            );
                                                        })}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {filteredSellerLeads.map((lead, index) => (
                                                        <tr key={lead.id} className="group text-slate-700 text-sm transition-colors hover:bg-slate-50/80">
                                                            <td className="px-2 py-2 border-b border-slate-100 text-center text-slate-400 font-bold opacity-50">{index + 1}</td>
                                                            <td className="px-2 py-2 border-b border-slate-100">
                                                                <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => handleSelectOne(lead.id)} className="rounded border-slate-300" />
                                                            </td>
                                                            <td className="px-2 py-2 border-b border-slate-100">
                                                                <div className="w-8 h-8 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shadow-sm">
                                                                    {lead.avatarUrl ? (
                                                                        <img src={lead.avatarUrl} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <i className="fa-solid fa-user text-slate-300 text-[10px]"></i>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-2 border-b border-slate-100 font-bold text-slate-900">
                                                                {lead.firstName} {lead.lastName}
                                                            </td>
                                                            {getVisibleColumns('Seller').has('funnelStage') && <td className="px-2 py-2 border-b border-slate-100 font-medium text-xs text-emerald-500 uppercase tracking-tighter">{lead.funnelStage || '--'}</td>}
                                                            {getVisibleColumns('Seller').has('status') && (
                                                                <td className="px-2 py-2 border-b border-slate-100">
                                                                    {renderCell(lead, 'status', 'select', getStatusOptions(lead.leadType, realtorSettings).map((o: any) => o.label))}
                                                                </td>
                                                            )}
                                                            {getVisibleColumns('Seller').has('phone') && (
                                                                <td className="px-2 py-2 border-b border-slate-100">
                                                                    <div className="flex flex-col">
                                                                        <div className="text-xs font-semibold text-slate-700 leading-tight mb-0.5 flex items-center gap-2">
                                                                            <span>{renderCell(lead, 'phone')}</span>
                                                                            {['text', 'call', 'sms'].includes((lead.preferredContactMethod || '').toLowerCase()) && (
                                                                                <span className="text-[9px] text-slate-400 font-medium italic whitespace-nowrap flex-shrink-0">
                                                                                    preferred - {(lead.preferredContactMethod || '').toLowerCase() === 'call' ? 'call' : 'text'}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-[10px] text-blue-600 font-medium leading-tight flex items-center gap-2">
                                                                            <span className="truncate">{renderCell(lead, 'email')}</span>
                                                                            {(lead.preferredContactMethod || '').toLowerCase() === 'email' && (
                                                                                <span className="text-[9px] text-slate-400 font-medium italic whitespace-nowrap flex-shrink-0">
                                                                                    preferred
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            )}
                                                            {getVisibleColumns('Seller').has('isAlsoBuying') && (
                                                                <td className="px-2 py-2 border-b border-slate-100 text-center">
                                                                    <div
                                                                        className="flex justify-center cursor-pointer"
                                                                        onClick={(e) => startEditing(e, lead.id, 'isAlsoBuying', lead.isAlsoBuying ? 'Yes' : 'No')}
                                                                    >
                                                                        {editingCell?.id === lead.id && editingCell?.field === 'isAlsoBuying' ? (
                                                                            <div onClick={e => e.stopPropagation()}>
                                                                                <select
                                                                                    autoFocus
                                                                                    className="bg-white border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-20"
                                                                                    defaultValue={lead.isAlsoBuying ? 'Yes' : 'No'}
                                                                                    onChange={(e) => {
                                                                                        const val = e.target.value === 'Yes';
                                                                                        onUpdateLead(lead.id, { isAlsoBuying: val });
                                                                                        setEditingCell(null);
                                                                                    }}
                                                                                    onBlur={() => setEditingCell(null)}
                                                                                    onClick={e => e.stopPropagation()}
                                                                                >
                                                                                    <option value="Yes">Yes</option>
                                                                                    <option value="No">No</option>
                                                                                </select>
                                                                            </div>
                                                                        ) : (
                                                                            lead.isAlsoBuying === true ? (
                                                                                <div className="w-8 h-6 bg-no-repeat bg-contain" style={{ backgroundImage: 'url(/assets/checkmark-cross.png)', backgroundPosition: '0% center', backgroundSize: '200% 100%', mixBlendMode: 'multiply' }}></div>
                                                                            ) : (
                                                                                <div className="w-8 h-6 bg-no-repeat bg-contain" style={{ backgroundImage: 'url(/assets/checkmark-cross.png)', backgroundPosition: '100% center', backgroundSize: '200% 100%', mixBlendMode: 'multiply' }}></div>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            )}
                                                            {getVisibleColumns('Seller').has('homeValueNeeded') && (
                                                                <td className="px-2 py-2 border-b border-slate-100 text-center font-semibold">
                                                                    <div
                                                                        className="flex justify-center cursor-pointer"
                                                                        onClick={(e) => startEditing(e, lead.id, 'homeValueNeeded', lead.homeValueNeeded ? 'Yes' : 'No')}
                                                                    >
                                                                        {editingCell?.id === lead.id && editingCell?.field === 'homeValueNeeded' ? (
                                                                            <div onClick={e => e.stopPropagation()}>
                                                                                <select
                                                                                    autoFocus
                                                                                    className="bg-white border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-20"
                                                                                    defaultValue={lead.homeValueNeeded ? 'Yes' : 'No'}
                                                                                    onChange={(e) => {
                                                                                        const val = e.target.value === 'Yes';
                                                                                        onUpdateLead(lead.id, { homeValueNeeded: val });
                                                                                        setEditingCell(null);
                                                                                    }}
                                                                                    onBlur={() => setEditingCell(null)}
                                                                                    onClick={e => e.stopPropagation()}
                                                                                >
                                                                                    <option value="Yes">Yes</option>
                                                                                    <option value="No">No</option>
                                                                                </select>
                                                                            </div>
                                                                        ) : (
                                                                            lead.homeValueNeeded === true ? (
                                                                                <div className="w-8 h-6 bg-no-repeat bg-contain" style={{ backgroundImage: 'url(/assets/checkmark-cross.png)', backgroundPosition: '0% center', backgroundSize: '200% 100%', mixBlendMode: 'multiply' }}></div>
                                                                            ) : (
                                                                                <div className="w-8 h-6 bg-no-repeat bg-contain" style={{ backgroundImage: 'url(/assets/checkmark-cross.png)', backgroundPosition: '100% center', backgroundSize: '200% 100%', mixBlendMode: 'multiply' }}></div>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            )}
                                                            {getVisibleColumns('Seller').has('sellWhen') && <td className="px-2 py-2 border-b border-slate-100 font-medium whitespace-nowrap">{renderCell(lead, 'sellWhen' as any)}</td>}
                                                            {getVisibleColumns('Seller').has('occupancyStatus') && <td className="px-2 py-2 border-b border-slate-100 font-medium">{renderCell(lead, 'occupancyStatus' as any)}</td>}
                                                            {getVisibleColumns('Seller').has('source') && <td className="px-2 py-2 border-b border-slate-100 text-xs font-semibold text-indigo-500">{lead.source}</td>}
                                                            {getVisibleColumns('Seller').has('leadInfo') && (
                                                                <td className="px-2 py-2 border-b border-slate-100 text-xs text-slate-900 font-medium">
                                                                    <div>{lead.leadInfo?.createdDate ? (lead.leadInfo.createdDate.toDate ? lead.leadInfo.createdDate.toDate().toLocaleDateString() : new Date(lead.leadInfo.createdDate).toLocaleDateString()) : '--'}</div>
                                                                    <div className="text-[10px] text-slate-400">{lead.leadInfo?.origin || lead.source || '--'}</div>
                                                                </td>
                                                            )}
                                                            {getVisibleColumns('Seller').has('reasonForSelling') && <td className="px-2 py-2 border-b border-slate-100 font-medium text-xs">{lead.reasonForSelling || '--'}</td>}
                                                            {getVisibleColumns('Seller').has('existingAgentName') && <td className="px-2 py-2 border-b border-slate-100 font-medium text-xs">{lead.existingAgentName || '--'}</td>}
                                                            {getVisibleColumns('Seller').has('message') && (
                                                                <td className="px-2 py-2 border-b border-slate-100 text-xs text-slate-600 max-w-[200px] whitespace-normal" title={lead.message}>
                                                                    {lead.message || '--'}
                                                                </td>
                                                            )}
                                                            {getVisibleColumns('Seller').has('tags') && (
                                                                <td className="px-2 py-2 border-b border-slate-100">
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {lead.tags?.map((tag, i) => (
                                                                            <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-medium border border-slate-200">{tag}</span>
                                                                        ))}
                                                                        {(!lead.tags || lead.tags.length === 0) && <span className="text-xs text-slate-300">--</span>}
                                                                    </div>
                                                                </td>
                                                            )}
                                                            {getVisibleColumns('Seller').has('funnelStage') && <td className="px-2 py-2 border-b border-slate-100 font-medium text-xs">{lead.funnelStage || '--'}</td>}
                                                            {getVisibleColumns('Seller').has('notes') && (
                                                                <td className="px-2 py-2 border-b border-slate-100 min-w-[200px] max-w-[300px]">
                                                                    <div className="flex flex-col gap-2 max-h-[100px] overflow-y-auto custom-scrollbar">
                                                                        {/* Last Call Note */}
                                                                        {lead.callNotes && lead.callNotes.length > 0 && (() => {
                                                                            const lastCallNote = [...lead.callNotes].sort((a, b) => b.callNumber - a.callNumber)[0];
                                                                            return (
                                                                                <div className="flex items-start gap-2 bg-emerald-50 rounded-lg p-1.5 border border-emerald-100">
                                                                                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                                                                        <span className="text-[8px] font-black text-emerald-600">#{lastCallNote.callNumber}</span>
                                                                                    </div>
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <div className="flex items-center gap-1 mb-0.5">
                                                                                            <span className={`px-1 py-0 rounded text-[7px] font-bold uppercase ${lastCallNote.outcome === 'Connected' ? 'bg-emerald-100 text-emerald-600' :
                                                                                                lastCallNote.outcome === 'Voicemail' ? 'bg-amber-100 text-amber-600' :
                                                                                                    'bg-slate-100 text-slate-500'
                                                                                                }`}>
                                                                                                {lastCallNote.outcome || 'Connected'}
                                                                                            </span>
                                                                                        </div>
                                                                                        <p className="text-[10px] text-slate-700 line-clamp-2">{lastCallNote.note}</p>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                        {/* Comments */}
                                                                        {(lead.notesLog || []).length > 0 ? (
                                                                            lead.notesLog!.slice(-2).reverse().map((note, i) => (
                                                                                <div key={note.id || i} className="text-[11px] leading-tight text-slate-600">
                                                                                    <span className="opacity-50 text-[10px] mr-1">
                                                                                        {note.timestamp?.toDate ? note.timestamp.toDate().toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date(note.timestamp).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                                    </span>
                                                                                    {note.content}
                                                                                </div>
                                                                            ))
                                                                        ) : (
                                                                            !lead.callNotes?.length && <span className="text-xs text-slate-300">--</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            )}

                                                            {/* Dynamic Cells */}
                                                            {Array.from(getVisibleColumns('Seller') as Set<string>).filter((id: string) => !MANUAL_SELLER_COLS.has(id)).map((colId: string) => (
                                                                <td key={colId} className="px-2 py-2 border-b border-slate-100 text-xs text-slate-600">
                                                                    {renderCell(lead, colId as any)}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-24">
                                            {filteredSellerLeads.map((lead, index) => (
                                                <LeadGalleryItem
                                                    onUpdateAvatar={onUpdateAvatar}
                                                    key={lead.id}
                                                    lead={lead}
                                                    stage={sellerFunnelCategory}
                                                    index={index + filteredBuyerLeads.length}
                                                    selectedIds={selectedIds}
                                                    handleSelectOne={handleSelectOne}
                                                    notes={notes}
                                                    editNoteId={editNoteId}
                                                    setEditNoteId={setEditNoteId}
                                                    editContent={editContent}
                                                    setEditContent={setEditContent}
                                                    handleUpdateNote={handleUpdateNote}
                                                    onDoneToggle={onDoneToggle}
                                                    onDeleteClick={onDeleteClick}
                                                    pendingNote={pendingNote}
                                                    draftContent={draftContent}
                                                    setDraftContent={setDraftContent}
                                                    handleSaveNote={handleSaveNote}
                                                    setPendingNote={setPendingNote}
                                                    deleteCoords={deleteCoords}
                                                    deletingNoteId={deletingNoteId}
                                                    celebratingNoteId={celebratingNoteId}
                                                    isFlyingUpId={isFlyingUpId}
                                                    onArchive={(id) => onUpdateLead(id, { status: 'Archived' })}
                                                    onActivate={(id) => onUpdateLead(id, { status: 'New' })}
                                                    visibleColumns={getVisibleColumns('Seller')}
                                                    activeTab="Seller"
                                                    onUpdateLead={onUpdateLead}
                                                    realtorSettings={realtorSettings}
                                                />
                                            ))}
                                        </div>
                                    )
                                ) : (
                                    <div className="py-12 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-[2rem]">
                                        No sellers found in funnel for this period.
                                    </div>
                                )}
                            </section>
                        )}

                    </div>

                    {/* Trash Bin for Fly-away Animation & Flying Clones */}
                    {deletingNoteId && (
                        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[10000] flex flex-col items-center gap-2 pointer-events-none">
                            <div className="w-16 h-16 bg-rose-500 rounded-full flex items-center justify-center text-white shadow-2xl bin-active">
                                <i className="fa-solid fa-trash-can text-2xl"></i>
                            </div>
                            <span className="text-rose-600 font-bold text-xs uppercase tracking-widest bg-white px-3 py-1 rounded-full shadow-sm">Discarding...</span>
                        </div>
                    )}

                    {/* The Floating Animation Clone */}
                    {(deletingNoteId || isFlyingUpId) && animatingNoteData && deleteCoords && (
                        <div
                            className={`p-2.5 pt-4 w-24 h-24 rounded-sm border-t border-black/5 text-[12px] font-bold post-it-font whitespace-normal shadow-2xl flex flex-col fixed z-[10001] pointer-events-none ${animatingNoteData.color || 'bg-[#ffff88] text-slate-800 border-[#eeee77] shadow-[5px_5px_7px_rgba(33,33,33,.1)]'} ${deletingNoteId ? 'animate-fly-away' : 'animate-fly-up'}`}
                            style={{
                                '--start-top': `${deleteCoords.top}px`,
                                '--start-left': `${deleteCoords.left}px`,
                                '--rotation': '0deg' // We'll just use 0deg for the clone to keep it simple or we could pass rotation
                            } as React.CSSProperties}
                        >
                            <div className="text-[7px] opacity-40 mb-1 font-sans leading-none uppercase tracking-tighter">
                                {new Date(animatingNoteData.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-slate-800 line-clamp-4 leading-tight">{animatingNoteData.content}</div>
                        </div>
                    )}
                </DragDropContext>
            )}

            {/* Custom Confirmation Modal */}
            {
                confirmModal && confirmModal.show && (
                    <div className="fixed inset-0 z-[1000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
                        <div className="bg-white max-w-sm w-full rounded-[2rem] shadow-2xl p-8 animate-in zoom-in duration-200">
                            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mb-6 border border-amber-100 mx-auto">
                                <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 text-center mb-2">{confirmModal.title}</h3>
                            <p className="text-sm text-slate-500 text-center font-medium leading-relaxed mb-8">{confirmModal.message}</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmModal(null)}
                                    className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    id="confirm-bulk-action"
                                    onClick={confirmModal.onConfirm}
                                    className="flex-1 px-6 py-4 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default LeadsList;
