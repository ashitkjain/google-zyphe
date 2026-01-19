import React from 'react';
import { Lead, PipelineNote } from '../../types';
import { Droppable } from '@hello-pangea/dnd';
import { getStatusOptions } from '../../services/statusService';

const TypedDroppable = Droppable as any;

interface LeadGalleryItemProps {
    lead: Lead;
    index: number;


    selectedIds: Set<string>;
    handleSelectOne: (id: string) => void;
    notes: PipelineNote[];
    editNoteId: string | null;
    setEditNoteId: (id: string | null) => void;
    editContent: string;
    setEditContent: (content: string) => void;
    handleUpdateNote: (id: string, updates: any) => void;
    onDoneToggle: (e: any, note: any) => void;
    onDeleteClick: (e: any, id: string) => void;
    pendingNote: any;
    draftContent: string;
    setDraftContent: (content: string) => void;
    handleSaveNote: (content: string) => void;
    setPendingNote: (note: any) => void;
    deleteCoords: any;
    deletingNoteId: string | null;
    celebratingNoteId: string | null;
    isFlyingUpId: string | null;
    onArchive: (id: string) => void;
    onActivate: (id: string) => void;
    visibleColumns: Set<string>;
    activeTab: 'Buyer' | 'Seller';
    onUpdateAvatar: (leadId: string, file: File) => void;
    stage: string;
    onUpdateLead: (id: string, updates: Partial<Lead>) => void;
    realtorSettings: any;
}

const LeadGalleryItem: React.FC<LeadGalleryItemProps> = ({
    lead, index, selectedIds, handleSelectOne,
    editNoteId, setEditNoteId, editContent, setEditContent, handleUpdateNote,
    onDoneToggle, onDeleteClick, pendingNote, draftContent, setDraftContent,
    handleSaveNote, setPendingNote, deleteCoords, deletingNoteId, celebratingNoteId, isFlyingUpId,
    onArchive, onActivate, visibleColumns, activeTab, onUpdateAvatar, stage, onUpdateLead, realtorSettings
}) => {
    const [editingCell, setEditingCell] = React.useState<string | null>(null);
    const [editValue, setEditValue] = React.useState<string>('');
    // ... helper functions ...
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const [now, setNow] = React.useState(new Date());

    React.useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 10000); // Update every 10s for smooth transition
        return () => clearInterval(interval);
    }, []);

    const receivedDate = lead.leadInfo?.createdDate ? new Date(lead.leadInfo.createdDate) : (lead.receivedAt?.toDate ? lead.receivedAt.toDate() : (lead.receivedAt ? new Date(lead.receivedAt) : null));
    const minsSinceReceived = receivedDate ? (now.getTime() - receivedDate.getTime()) / 60000 : 0;

    React.useEffect(() => {
        if (stage === 'Leads' && lead.initialContactIn30Mins === undefined && minsSinceReceived >= 30) {
            onUpdateLead(lead.id, { initialContactIn30Mins: false });
        }
    }, [minsSinceReceived, stage, lead.initialContactIn30Mins, lead.id, onUpdateLead]);

    const handleContacted = (e: React.MouseEvent) => {
        e.stopPropagation();
        onUpdateLead(lead.id, {
            status: 'Attempted to Contact',
            initialContactIn30Mins: true
        });
    };

    const isLeadsStage = stage === 'Leads';
    const showUrgencyEffect = isLeadsStage && lead.initialContactIn30Mins === undefined;
    const isFlashing = showUrgencyEffect && minsSinceReceived < 15;

    let rednessAlpha = 0;
    if (showUrgencyEffect && minsSinceReceived >= 15) {
        rednessAlpha = Math.min(1, (minsSinceReceived - 15) / 15);
    }

    const handleAvatarClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onUpdateAvatar(lead.id, e.target.files[0]);
        }
    };
    const getVisibleColumns = () => visibleColumns || new Set<string>();

    // ... renderValue and COLUMN_METADATA ...
    const renderValue = (field: string) => {
        let val = (lead as any)[field];
        if (field === 'receivedAt' && lead.stageLastChangedAt) {
            val = lead.stageLastChangedAt;
        }

        if (field === 'receivedAt' || field === 'lastTouch' || field === 'leaseEndDate' || field === 'lastUpdated' || field === 'staleWarningDate') {
            const date = val?.toDate ? val.toDate() : (val ? new Date(val) : null);
            if (!date) return '--';
            if (field === 'receivedAt') {
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
            }
            return date.toLocaleDateString();
        }
        if (field === 'isAlsoSelling' || field === 'isAlsoBuying' || field === 'preQualified' || field === 'homeValueNeeded') {
            return (
                <div
                    className="w-8 h-6 bg-no-repeat bg-contain"
                    style={{
                        backgroundImage: 'url(/assets/checkmark-cross.png)',
                        backgroundPosition: val === true ? '0% center' : '100% center',
                        backgroundSize: '200% 100%',
                        mixBlendMode: 'multiply'
                    }}
                ></div>
            );
        }
        if (field === 'status') {
            return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">{val || 'New'}</span>;
        }
        if (field === 'engagementScore') {
            const score = val as string;
            if (score === 'Hot') return <i className="fa-solid fa-fire text-orange-500 text-sm" title="Hot"></i>;
            if (score === 'Warm') return <i className="fa-solid fa-mug-hot text-amber-500 text-sm" title="Warm"></i>;
            if (score === 'Cold') return <i className="fa-solid fa-snowflake text-sky-300 text-sm" title="Cold"></i>;
            if (score === 'Stale') return <i className="fa-solid fa-ghost text-slate-300 text-sm" title="Stale"></i>;

            return '--';
        }

        if (field === 'leadInfo' && val) {
            const parts = [];
            if (val.createdDate) {
                const d = val.createdDate.toDate ? val.createdDate.toDate() : new Date(val.createdDate);
                parts.push(`Created: ${d.toLocaleDateString()}`);
            }
            if (val.origin) parts.push(`Source: ${val.origin}`);
            return parts.join(', ') || '--';
        }

        // Complex Object Rendering
        if (field === 'financialVitals' && val) {
            const parts = [];
            if (val.budgetMax) parts.push(`$${(val.budgetMax / 1000).toFixed(0)}k`);
            if (val.isAllCash) parts.push('Cash');
            if (val.preApprovalStatus) parts.push('Pre-Approved');
            return parts.join(', ') || '--';
        }
        if (field === 'searchCriteria' && val) {
            const parts = [];
            if (val.locations?.length) parts.push(`${val.locations.length} locs`);
            if (val.mustHaves?.length) parts.push(`${val.mustHaves.length} must-haves`);
            return parts.join(', ') || '--';
        }
        if (field === 'activeOffer' && val) {
            return val.price ? `$${(val.price / 1000).toFixed(0)}k (${new Date(val.offerDate).toLocaleDateString()})` : '--';
        }
        if (field === 'criticalDates' && val) {
            return val.closingDate ? `Closing: ${new Date(val.closingDate).toLocaleDateString()}` : '--';
        }
        if (field === 'listingStatus' && val) {
            return val.estimatedValue ? `$${(val.estimatedValue / 1000).toFixed(0)}k Est.` : '--';
        }
        if (field === 'transactionTeam' && val) {
            const team = [];
            if (val.lenderPOC) team.push('Lender');
            if (val.escrowOfficer) team.push('Escrow');
            return team.join(', ') || '--';
        }

        if (typeof val === 'boolean') return val ? 'Yes' : 'No';
        if (field === 'price') {
            const priceVal = val || lead.price;
            return priceVal ? `$${(priceVal / 1000).toFixed(0)}k` : '--';
        }
        if (Array.isArray(val)) return val.join(', ') || '--';
        if (typeof val === 'object' && val !== null) return JSON.stringify(val); // Fallback for other objects
        return val || '--';
    };

    const COLUMN_METADATA: Record<string, { label: string, icon: string, color?: string }> = {
        status: { label: 'Lead Status', icon: 'fa-signal', color: 'text-indigo-600' },
        engagementScore: { label: 'Lead Temperature', icon: 'fa-temperature-half', color: 'text-orange-500' },
        staleWarningDate: { label: 'Follow-up Deadline', icon: 'fa-clock', color: 'text-red-500' },
        smsConsent: { label: 'SMS Consent', icon: 'fa-comments', color: 'text-blue-500' },
        isAlsoSelling: { label: 'Also Selling?', icon: 'fa-house-user' },
        isAlsoBuying: { label: 'Also Buying?', icon: 'fa-cart-shopping' },
        preQualified: { label: 'Pre-qualified?', icon: 'fa-certificate', color: 'text-emerald-600' },
        preferredNeighborhood: { label: 'Neighborhood', icon: 'fa-map-location-dot', color: 'text-indigo-600' },

        source: { label: 'Source', icon: 'fa-globe', color: 'text-slate-400' },
        leadInfo: { label: 'Lead Info', icon: 'fa-info-circle', color: 'text-slate-500' },
        message: { label: 'Message', icon: 'fa-comment' },
        timeframe: { label: 'Timeframe', icon: 'fa-hourglass-half' },
        leaseEndDate: { label: 'Lease End Date', icon: 'fa-file-signature' },
        tags: { label: 'Tags', icon: 'fa-tags' },
        funnelStage: { label: 'Pipeline Stage', icon: 'fa-filter' },
        notes: { label: 'Notes', icon: 'fa-clipboard-list' },
        homeValueNeeded: { label: 'Home Value Needed?', icon: 'fa-calculator' },
        isMostImportantReq: { label: 'Priority', icon: 'fa-star' },
        sellWhen: { label: 'Sell When?', icon: 'fa-calendar-days' },
        occupancyStatus: { label: 'Occupancy Status', icon: 'fa-key' },
        reasonForSelling: { label: 'Reason for Selling', icon: 'fa-info-circle' },
        existingAgentName: { label: 'Existing Agent?', icon: 'fa-user-tie' },
        callCount: { label: 'Call Tracker', icon: 'fa-phone-volume' },
        lastUpdated: { label: 'Last Updated On', icon: 'fa-pen-to-square' },

        // New Fields
        motivation: { label: 'Motivation', icon: 'fa-lightbulb' },
        targetTimeline: { label: 'Timeline', icon: 'fa-clock' },
        personaProfile: { label: 'Persona', icon: 'fa-id-card' },

        // Complex Objects
        financialVitals: { label: 'Buying Power', icon: 'fa-wallet' },
        searchCriteria: { label: 'Criteria', icon: 'fa-magnifying-glass' },
        listingStatus: { label: 'Listing Info', icon: 'fa-home' },
        activeOffer: { label: 'Active Offer', icon: 'fa-file-contract' },
        transactionTeam: { label: 'Team', icon: 'fa-users' },
        criticalDates: { label: 'Key Dates', icon: 'fa-calendar-check' },

        // Specific Status Fields
        leadStatus: { label: 'Lead Status', icon: 'fa-tasks' },
        nurtureStatus: { label: 'Nurture Status', icon: 'fa-tasks' },
        activeSearchStatus: { label: 'Search Status', icon: 'fa-tasks' },
        offerStatus: { label: 'Offer Status', icon: 'fa-tasks' },
        closingStatus: { label: 'Closing Status', icon: 'fa-tasks' }
    };

    const startEditing = (e: React.MouseEvent, field: string, value: any) => {
        e.stopPropagation();
        setEditingCell(field);
        setEditValue(value || '');
    };

    const saveEditing = (e: React.MouseEvent, field: string) => {
        e.stopPropagation();
        onUpdateLead(lead.id, { [field]: editValue });
        setEditingCell(null);
        setEditValue('');
    };

    const cancelEditing = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingCell(null);
        setEditValue('');
    };

    const renderEditableValue = (field: string) => {
        const isEditing = editingCell === field;
        const value = (lead as any)[field];

        if (isEditing) {
            if (field === 'status' || field === 'engagementScore') {
                const options = field === 'status'
                    ? getStatusOptions(lead.leadType, realtorSettings).map((o: any) => o.label)
                    : ['Cold', 'Warm', 'Hot', 'Stale'];

                return (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <select
                            autoFocus
                            className="bg-white border border-indigo-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full font-medium"
                            defaultValue={value}
                            onChange={(e) => {
                                onUpdateLead(lead.id, { [field]: e.target.value });
                                setEditingCell(null);
                            }}
                            onBlur={() => setEditingCell(null)}
                        >
                            {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                );
            }

            if (typeof value === 'boolean' || field === 'smsConsent') {
                return (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <select
                            autoFocus
                            className="bg-white border border-indigo-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full font-medium"
                            defaultValue={value ? 'Yes' : 'No'}
                            onChange={(e) => {
                                onUpdateLead(lead.id, { [field]: e.target.value === 'Yes' });
                                setEditingCell(null);
                            }}
                            onBlur={() => setEditingCell(null)}
                        >
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                        </select>
                    </div>
                );
            }

            return (
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <input
                        autoFocus
                        type="text"
                        className="bg-white border border-indigo-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full font-medium"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditing(e as any, field);
                            if (e.key === 'Escape') cancelEditing(e as any);
                        }}
                    />
                    <button onClick={(e) => saveEditing(e, field)} className="text-emerald-500 hover:text-emerald-700 bg-emerald-50 p-0.5 rounded flex-shrink-0 text-[10px]"><i className="fa-solid fa-check"></i></button>
                    <button onClick={cancelEditing} className="text-red-400 hover:text-red-600 bg-red-50 p-0.5 rounded flex-shrink-0 text-[10px]"><i className="fa-solid fa-xmark"></i></button>
                </div>
            );
        }

        if (field === 'receivedAt' || field === 'lastUpdated' || field === 'lastTouch' || field === 'staleWarningDate') {
            return (
                <div className="flex items-center gap-1 w-full min-h-[1.2rem]">
                    <span className="font-medium break-words text-slate-500">
                        {renderValue(field)}
                    </span>
                    <i className="fa-solid fa-lock text-[8px] text-slate-200 ml-auto" title="Read-only"></i>
                </div>
            );
        }

        return (
            <div className="group/editable flex items-center justify-between gap-1 w-full min-h-[1.2rem]">
                <span className="font-medium break-words cursor-pointer hover:text-indigo-600 transition-colors" onClick={(e) => startEditing(e, field, value)}>
                    {renderValue(field)}
                </span>
                <button
                    onClick={(e) => startEditing(e, field, value)}
                    className="opacity-0 group-hover/editable:opacity-100 hover:text-indigo-500 transition-opacity p-0.5"
                >
                    <i className="fa-solid fa-pencil text-slate-300 text-[9px]"></i>
                </button>
            </div>
        );
    };

    // Combine explicit required fields with user-selected columns
    const gridFields = Array.from(new Set([
        ...Array.from(getVisibleColumns()),
        'leadInfo',
        'smsConsent',
        'status',
        'staleWarningDate'
    ]));

    return (
        <div
            className={`p-4 rounded-[2rem] border transition-all border-l-4 group relative cursor-pointer flex flex-col ${selectedIds.has(lead.id)
                ? (lead.leadType === 'Seller'
                    ? 'ring-4 ring-emerald-500/50 border-emerald-200 bg-emerald-50/30 shadow-2xl scale-[1.02] z-10'
                    : 'ring-4 ring-indigo-500/50 border-indigo-200 bg-indigo-50/30 shadow-2xl scale-[1.02] z-10')
                : 'border-slate-200/60 shadow-sm hover:shadow-xl hover:scale-[1.01]'
                } ${isFlashing ? 'animate-urgent-flash' : ''} ${rednessAlpha >= 1 ? 'bg-red-50 border-red-200' : 'bg-white'}`}
            style={{
                borderLeftColor: lead.leadType === 'Seller' ? '#10b981' : '#6366f1',
                backgroundColor: rednessAlpha > 0 && rednessAlpha < 1 ? `rgba(255, 0, 0, ${rednessAlpha * 0.1})` : undefined
            }}
            onClick={(e) => { handleSelectOne(lead.id); }}

        >
            {/* Selection Badge */}
            {selectedIds.has(lead.id) && (
                <div className={`absolute -top-2 -right-2 w-8 h-8 ${lead.leadType === 'Seller' ? 'bg-emerald-600' : 'bg-indigo-600'} text-white rounded-full flex items-center justify-center shadow-lg animate-in zoom-in duration-200 z-30 ring-4 ring-white`}>
                    <i className="fa-solid fa-check text-sm"></i>
                </div>
            )}
            <TypedDroppable droppableId={lead.id} type="POSTIT_PALETTE">
                {(noteProvided: any, noteSnapshot: any) => (
                    <div
                        ref={noteProvided.innerRef}
                        {...noteProvided.droppableProps}
                        className={`flex-1 flex flex-col min-h-[130px] ${noteSnapshot.isDraggingOver ? 'bg-indigo-50/20' : ''}`}
                    >
                        {/* Top Right Actions code is unchanged and below... */}
                        {/* skipping to grid for brevity in replacement search */}

                        <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
                            {/* Contacted Status Leaves */}
                            {lead.initialContactIn30Mins === true && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onUpdateLead(lead.id, { initialContactIn30Mins: false });
                                    }}
                                    className="flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter shadow-sm border border-emerald-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-colors cursor-pointer"
                                    title="Manually mark as missed"
                                >
                                    <i className="fa-solid fa-leaf text-[8px]"></i>
                                    got it
                                </button>
                            )}
                            {lead.initialContactIn30Mins === false && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onUpdateLead(lead.id, { initialContactIn30Mins: true });
                                    }}
                                    className="flex items-center gap-1 bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter shadow-sm border border-rose-100 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-100 transition-colors cursor-pointer"
                                    title="Manually mark as contacted"
                                >
                                    <i className="fa-solid fa-leaf text-[8px]"></i>
                                    missed
                                </button>
                            )}

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const scores = ['Cold', 'Warm', 'Hot', 'Stale'];
                                        const currentIndex = scores.indexOf(lead.engagementScore || 'Cold');
                                        const nextScore = scores[(currentIndex + 1) % scores.length];
                                        onUpdateLead(lead.id, { engagementScore: nextScore as any });
                                    }}
                                    className={`relative transition-all duration-300 ease-out flex items-center justify-center mr-2 cursor-pointer hover:scale-110 active:scale-95 ${lead.engagementScore === 'Hot' ? 'w-12 h-12 -mt-6 -mr-4 drop-shadow-[0_8px_8px_rgba(255,100,0,0.5)] z-50 animate-flame' : 'w-7 h-7'}`}
                                    title={`Current Temperature: ${lead.engagementScore || 'Cold'}. Click to cycle.`}
                                >
                                    {(!lead.engagementScore || lead.engagementScore === 'Cold') && <i className="fa-solid fa-snowflake text-sky-300 text-xl filter drop-shadow-sm"></i>}
                                    {lead.engagementScore === 'Warm' && <i className="fa-solid fa-mug-hot text-amber-500 text-xl filter drop-shadow-sm"></i>}
                                    {lead.engagementScore === 'Stale' && <img src="/assets/stale-icon.png" alt="Stale" className="w-6 h-6 object-contain opacity-60 grayscale filter drop-shadow-sm" />}
                                    {lead.engagementScore === 'Hot' && (
                                        <>
                                            <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-sm">
                                                <path d="M50 95C30 95 15 75 15 50C15 35 25 20 45 5C45 15 50 25 55 35C65 25 75 35 85 50C85 75 70 95 50 95Z" fill="#ff4d00" />
                                                <path d="M50 90C35 90 25 75 25 55C25 45 30 35 45 25C45 35 50 45 55 50C62 40 70 45 75 55C75 75 65 90 50 90Z" fill="#ff9900" />
                                                <path d="M50 85C42 85 35 75 35 60C35 50 40 45 45 40C48 50 50 55 55 60C58 55 62 55 65 60C65 75 58 85 50 85Z" fill="#ffcc00" />
                                            </svg>
                                            <div className="absolute inset-x-0 bottom-0 top-1/2 bg-orange-500/30 blur-xl rounded-full -z-10 animate-pulse"></div>
                                        </>
                                    )}
                                </button>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onArchive(lead.id); }}
                                        className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 flex items-center justify-center transition-all shadow-sm"
                                        title="Archive"
                                    >
                                        <i className="fa-solid fa-box-archive text-[10px]"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 mb-4">
                            {/* Profile Picture / Avatar (Bigger) */}
                            <div
                                className="w-14 h-14 rounded-2xl bg-slate-50 flex-shrink-0 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center relative group/avatar cursor-pointer"
                                onClick={handleAvatarClick}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                                {lead.clientPhotoUrl ? (
                                    <img src={lead.clientPhotoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-indigo-400/60 font-black text-sm uppercase">
                                        {lead.firstName?.charAt(0) || ''}{lead.lastName?.charAt(0) || ''}
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                                    <i className="fa-solid fa-camera text-white text-xs drop-shadow-md"></i>
                                </div>
                            </div>

                            <div className="flex flex-col flex-1 min-w-0 pt-0.5">
                                <div className="font-bold text-black text-sm group-hover:text-indigo-600 transition-colors tracking-tight truncate leading-tight mb-0.5" >
                                    {lead.fullName || (lead.firstName || lead.lastName ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim() : 'Unknown Client')}
                                </div>

                                {isLeadsStage && lead.initialContactIn30Mins === undefined && (
                                    <button
                                        onClick={handleContacted}
                                        className="mt-1 flex items-center justify-center gap-1.5 px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 active:scale-95 self-start"
                                    >
                                        <i className="fa-solid fa-paper-plane text-[8px]"></i>
                                        Contacted
                                    </button>
                                )}

                                {getVisibleColumns().has('phone') && (
                                    <div className="flex flex-col gap-0.5 text-[12px] text-slate-400 font-bold whitespace-nowrap overflow-hidden">
                                        {lead.email && (
                                            <div className="flex items-center gap-1.5 pr-2 min-w-0 pb-1">
                                                <i className="fa-solid fa-envelope opacity-30 text-[8px] flex-shrink-0"></i>
                                                <span className="truncate">{lead.email}</span>
                                                {(lead.preferredContactMethod || '').toLowerCase() === 'email' && (
                                                    <span className="text-[9px] text-indigo-400 font-medium italic whitespace-nowrap flex-shrink-0">
                                                        - preferred
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {lead.phone && (
                                            <div className="flex items-center gap-1.5 pr-2 min-w-0">
                                                <i className="fa-solid fa-phone opacity-30 text-[8px] flex-shrink-0"></i>
                                                <span className="truncate">{lead.phone}</span>
                                                {['text', 'call', 'sms'].includes((lead.preferredContactMethod || '').toLowerCase()) && (
                                                    <span className="text-[9px] text-indigo-400 font-medium italic whitespace-nowrap flex-shrink-0">
                                                        - preferred {(lead.preferredContactMethod || '').toLowerCase() === 'call' ? 'call' : 'text'}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-4">
                            {gridFields
                                .filter(colId => !['phone', 'email', 'firstName', 'lastName', 'message', 'notes'].includes(colId as string))
                                .filter(colId => {
                                    const val = (lead as any)[colId as string];
                                    if (colId === 'engagementScore' || colId === 'staleWarningDate' || colId === 'smsConsent') return true; // Always show even if empty for these important fields
                                    if (val === null || val === undefined || val === '' || val === false) return false;
                                    if (Array.isArray(val) && val.length === 0) return false;
                                    return true;
                                })
                                .map((colId: any) => {
                                    const meta = COLUMN_METADATA[colId as string];
                                    if (!meta) return null;

                                    if (colId === 'status') {
                                        return (
                                            <div key={colId as string} className="grid grid-cols-[auto_1fr] gap-x-1.5 text-[14px] font-bold text-black leading-tight min-w-0 items-center">
                                                {renderEditableValue(colId as string)}
                                            </div>
                                        );
                                    }

                                    const displayLabel = meta.label
                                        .replace(/[^a-zA-Z0-9\s]/g, '')
                                        .split(' ')
                                        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                                        .join(' ') + (meta.label.includes('?') ? '?' : '');

                                    return (
                                        <div key={colId as string} className="grid grid-cols-[auto_1fr] gap-x-1.5 text-[14px] font-bold text-black leading-tight min-w-0 items-start">
                                            <span className="whitespace-nowrap">{displayLabel}:</span>
                                            {renderEditableValue(colId as string)}
                                        </div>
                                    );
                                })}
                        </div>


                        {/* User Message */}
                        {lead.message && getVisibleColumns().has('message') && (
                            <div className="mt-2 bg-indigo-50/30 p-3 rounded-2xl border border-indigo-100/50 flex flex-col gap-1.5 relative overflow-hidden group/msg">
                                <div className="text-[14px] font-medium text-black tracking-widest flex items-center gap-1.5 opacity-60">
                                    <i className="fa-solid fa-comment-dots text-[8px] opacity-30"></i>
                                    Inquiry Message
                                </div>
                                <div className="text-[14px] text-indigo-600 font-bold leading-[1.3] italic">
                                    "{lead.message}"
                                </div>
                            </div>
                        )}

                        {/* Last Call Note */}
                        {lead.callNotes && lead.callNotes.length > 0 && (() => {
                            const lastCallNote = [...lead.callNotes].sort((a, b) => b.callNumber - a.callNumber)[0];
                            return (
                                <div className="mt-2 bg-gradient-to-r from-indigo-50 to-slate-50 p-3 rounded-2xl border border-indigo-100/50 flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                        <span className="text-[10px] font-black text-indigo-600">#{lastCallNote.callNumber}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <i className="fa-solid fa-phone text-indigo-400 text-[8px]"></i>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Call Note</span>
                                            <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${lastCallNote.outcome === 'Connected' ? 'bg-emerald-100 text-emerald-600' :
                                                lastCallNote.outcome === 'Voicemail' ? 'bg-amber-100 text-amber-600' :
                                                    lastCallNote.outcome === 'No Answer' ? 'bg-slate-100 text-slate-500' :
                                                        lastCallNote.outcome === 'Busy' ? 'bg-orange-100 text-orange-600' :
                                                            'bg-rose-100 text-rose-600'
                                                }`}>
                                                {lastCallNote.outcome || 'Connected'}
                                            </span>
                                        </div>
                                        <p className="text-[12px] text-slate-700 font-medium line-clamp-2">{lastCallNote.note}</p>
                                    </div>
                                </div>
                            );
                        })()}
                        {getVisibleColumns().has('notes') && (
                            <div
                                className="flex flex-wrap gap-3 mt-4 relative min-h-[40px] flex-1 rounded-xl transition-colors"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {(lead.notesLog || []).filter(n => !n.isDone).map((note, i) => (
                                    <div
                                        key={note.id}
                                        onClick={() => { if (!editNoteId) { setEditNoteId(note.id); setEditContent(note.content); } }}
                                        className={`p-2.5 pt-4 w-24 h-24 rounded-sm border-t border-black/5 text-[12px] font-bold post-it-font whitespace-normal shadow-lg transition-all hover:scale-110 hover:z-10 group/note flex flex-col relative cursor-pointer post-it-container ${note.color || 'bg-[#ffff88] text-slate-800 border-[#eeee77] shadow-[5px_5px_7px_rgba(33,33,33,.1)]'} ${i % 2 === 0 ? 'rotate-2' : '-rotate-2'} hover:rotate-0 ${note.isDone ? 'line-through opacity-50' : ''} ${celebratingNoteId === note.id ? 'animate-shake' : ''} ${note.isUrgent ? 'urgent-glow' : ''} ${(deletingNoteId === note.id || isFlyingUpId === note.id) ? 'opacity-0 pointer-events-none' : ''}`}
                                        style={{
                                            '--rotation': i % 2 === 0 ? '2deg' : '-2deg'
                                        } as React.CSSProperties}
                                    >
                                        {editNoteId === note.id ? (
                                            <textarea
                                                autoFocus
                                                className="w-full h-full bg-transparent border-none outline-none resize-none post-it-edit"
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                onBlur={() => {
                                                    if (editContent.trim() && editContent !== note.content) {
                                                        handleUpdateNote(note.id, { content: editContent });
                                                    }
                                                    setEditNoteId(null);
                                                }}
                                            />
                                        ) : (
                                            <>
                                                <div className="text-[7px] opacity-40 mb-1 font-sans leading-none uppercase tracking-tighter">
                                                    {new Date(note.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <div className="text-slate-800 line-clamp-4 leading-tight">{note.content}</div>
                                                <div className="absolute top-1 right-1 opacity-0 group-hover/note:opacity-100 transition-opacity flex gap-1 bg-white/20 rounded-full px-1 backdrop-blur-sm">
                                                    <button
                                                        onClick={(e) => onDoneToggle(e, note)}
                                                        className="text-slate-600 hover:text-emerald-600 transition-colors p-0.5"
                                                        title="Complete"
                                                    >
                                                        <i className="fa-solid fa-check text-[10px]"></i>
                                                    </button>
                                                    <button
                                                        onClick={(e) => onDeleteClick(e, note.id)}
                                                        className="text-slate-600 hover:text-red-500 transition-colors p-0.5"
                                                        title="Delete"
                                                    >
                                                        <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}

                                {/* Pending Note (Draft) */}
                                {pendingNote && pendingNote.leadId === lead.id && (
                                    <div className={`p-2.5 pt-4 w-24 h-24 rounded-sm border-t border-black/5 text-[9px] font-bold post-it-font whitespace-normal shadow-xl transition-all rotate-3 scale-105 z-20 flex flex-col relative post-it-container ${pendingNote.color}`}>
                                        <textarea
                                            autoFocus
                                            className="w-full h-full bg-transparent border-none outline-none resize-none post-it-draft"
                                            placeholder="Write note..."
                                            value={draftContent}
                                            onChange={(e) => setDraftContent(e.target.value)}
                                            onBlur={() => {
                                                if (draftContent.trim()) {
                                                    handleSaveNote(draftContent);
                                                } else {
                                                    setPendingNote(null);
                                                }
                                                setDraftContent('');
                                            }}
                                        />
                                    </div>
                                )}
                                {<div style={{ display: 'none' }}>{noteProvided.placeholder}</div>}
                            </div>
                        )}
                    </div>
                )}
            </TypedDroppable>
        </div >
    );
};

export default LeadGalleryItem;
