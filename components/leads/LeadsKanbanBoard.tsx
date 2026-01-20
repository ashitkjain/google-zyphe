import React, { useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Lead, LEAD_FIELD_CONFIG, LEAD_STAGE_LIFECYCLE_CONFIG } from '../../types';
import { getFunnelStageForStatus, getStatusOptions } from '../../services/statusService';

interface LeadsKanbanBoardProps {
    leads: Lead[];
    onUpdateLead: (id: string, updates: Partial<Lead>) => void;
    realtorSettings: any;
    leadType: 'Buyer' | 'Seller';
}

const KANBAN_COLUMNS = [
    { id: 'leads', label: 'Leads', stages: ['Leads'], color: 'indigo' },
    { id: 'nurture', label: 'Nurture', stages: ['Nurture'], color: 'amber' },
    { id: 'active-search', label: 'Active Search', stages: ['Active Search'], color: 'sky' },
    { id: 'offer', label: 'Offer', stages: ['Offer'], color: 'purple' },
    { id: 'closing', label: 'Closing', stages: ['Contract'], color: 'emerald' }
];

const LeadsKanbanBoard: React.FC<LeadsKanbanBoardProps> = ({
    leads,
    onUpdateLead,
    realtorSettings,
    leadType
}) => {
    const [pendingMove, setPendingMove] = useState<{ lead: Lead, targetStage: string, options: any[] } | null>(null);

    const getColumnIdForLead = (lead: Lead) => {
        let stage = getFunnelStageForStatus(lead.status, lead.leadType, realtorSettings);

        // Fallback: If status mapping falls back to 'Leads' (default) but the lead has a specific funnelStage, trust the explicit stage.
        if (stage === 'Leads' && lead.funnelStage && lead.funnelStage !== 'Leads') {
            stage = lead.funnelStage;
        }

        if (stage === 'Leads') return 'leads';
        if (stage === 'Nurture') return 'nurture';
        if (stage === 'Active Search') return 'active-search';
        if (stage === 'Offer') return 'offer';
        if (stage === 'Contract') return 'closing';
        return null; // Closed/Archived or unmapped
    };

    const columns = useMemo(() => {
        const cols: Record<string, Lead[]> = {
            leads: [],
            nurture: [],
            'active-search': [],
            offer: [],
            closing: []
        };

        leads.forEach(lead => {
            const colId = getColumnIdForLead(lead);
            if (colId && cols[colId]) {
                cols[colId].push(lead);
            }
        });

        // Sort by createdDate desc (using leadInfo.createdDate or falling back to a safe default)
        Object.keys(cols).forEach(key => {
            cols[key].sort((a, b) => {
                const getDate = (lead: Lead) => {
                    const dateVal = lead.receivedAt;
                    return dateVal?.toDate ? dateVal.toDate() : new Date(dateVal || 0);
                };
                const da = getDate(a);
                const db = getDate(b);
                return db.getTime() - da.getTime();
            });
        });

        return cols;
    }, [leads, leadType, realtorSettings]);

    const handleDragEnd = (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const targetColumnId = destination.droppableId;
        const sourceColumnId = source.droppableId;

        if (targetColumnId === sourceColumnId) {
            return;
        }

        const lead = leads.find(l => l.id === draggableId);
        if (!lead) return;

        // Determine new status
        const targetColDef = KANBAN_COLUMNS.find(c => c.id === targetColumnId);
        if (!targetColDef) return;

        const primaryStage = targetColDef.stages[0];
        const allOptions = getStatusOptions(leadType, realtorSettings);
        const stageOptions = allOptions.filter((o: any) => o.funnelStage === primaryStage);

        if (stageOptions.length >= 1) {
            // Always prompt the user for consistency, even if only one option exists
            setPendingMove({
                lead,
                targetStage: primaryStage,
                options: stageOptions
            });
        } else {
            // Fallback for stages with no specific statuses defined in settings 
            // We still prompt with a fallback if any option for that stage exists in the full list
            const fallbackStatus = allOptions.find((o: any) => o.funnelStage === primaryStage);
            if (fallbackStatus) {
                setPendingMove({
                    lead,
                    targetStage: primaryStage,
                    options: [fallbackStatus]
                });
            }
        }
    };

    const handleConfirmMove = (status: string) => {
        if (pendingMove) {
            onUpdateLead(pendingMove.lead.id, { status });
            setPendingMove(null);
        }
    };

    return (
        <div className="h-full overflow-x-auto overflow-y-hidden bg-slate-50 p-4">
            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex gap-4 h-full min-w-max">
                    {KANBAN_COLUMNS.map(column => (
                        <div key={column.id} className="w-80 flex flex-col h-full rounded-2xl bg-slate-100/50 border border-slate-200">
                            {/* Column Header */}
                            <div className={`p-4 border-b border-white bg-white/50 rounded-t-2xl backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between
                                ${column.id === 'leads' ? 'border-t-4 border-t-indigo-400' : ''}
                                ${column.id === 'nurture' ? 'border-t-4 border-t-amber-400' : ''}
                                ${column.id === 'active-search' ? 'border-t-4 border-t-sky-400' : ''}
                                ${column.id === 'offer' ? 'border-t-4 border-t-purple-400' : ''}
                                ${column.id === 'closing' ? 'border-t-4 border-t-emerald-400' : ''}
                            `}>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-slate-700">{column.label}</h3>
                                    <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">
                                        {columns[column.id].length}
                                    </span>
                                </div>
                                <div className="flex gap-1">
                                    <button className="text-slate-400 hover:text-slate-600 p-1">
                                        <i className="fa-solid fa-ellipsis"></i>
                                    </button>
                                </div>
                            </div>

                            {/* Droppable Area */}
                            <Droppable droppableId={column.id}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`flex-1 overflow-y-auto p-3 space-y-3 transition-colors ${snapshot.isDraggingOver ? 'bg-indigo-50/30' : ''}`}
                                    >
                                        {columns[column.id].map((lead, index) => {
                                            const DraggableAny = Draggable as any;
                                            return (
                                                <DraggableAny key={lead.id} draggableId={lead.id} index={index}>
                                                    {(provided: any, snapshot: any) => (
                                                        <KanbanCard
                                                            lead={lead}
                                                            provided={provided}
                                                            snapshot={snapshot}
                                                            realtorSettings={realtorSettings}
                                                            onUpdateLead={onUpdateLead}
                                                        />
                                                    )}
                                                </DraggableAny>
                                            );
                                        })}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}
                </div>
            </DragDropContext>

            {/* Status Selection Modal */}
            {pendingMove && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8">
                            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
                                <i className="fa-solid fa-route text-2xl text-indigo-600"></i>
                            </div>

                            <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">
                                Select {pendingMove.targetStage} Status
                            </h2>
                            <p className="text-slate-500 text-sm mb-8">
                                Please specify the current status for <strong>{pendingMove.lead.fullName || 'this client'}</strong> in the {pendingMove.targetStage} stage.
                            </p>

                            <div className="space-y-3">
                                {pendingMove.options.map((option) => (
                                    <button
                                        key={option.label}
                                        onClick={() => handleConfirmMove(option.label)}
                                        className="w-full text-left p-4 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all group flex items-center justify-between"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700 group-hover:text-indigo-700">{option.label}</span>
                                            {option.description && (
                                                <span className="text-xs text-slate-400 group-hover:text-indigo-400">{option.description}</span>
                                            )}
                                        </div>
                                        <i className="fa-solid fa-chevron-right text-slate-300 group-hover:translate-x-1 group-hover:text-indigo-400 transition-all"></i>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setPendingMove(null)}
                                className="px-6 py-2.5 rounded-xl font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-all uppercase text-[10px] tracking-widest"
                            >
                                Cancel Move
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const KanbanCard: React.FC<{ lead: Lead, provided: any, snapshot: any, realtorSettings: any, onUpdateLead: (id: string, updates: Partial<Lead>) => void }> = ({ lead, provided, snapshot, realtorSettings, onUpdateLead }) => {
    // Determine border color based on temperature/score
    let accentColor = 'border-l-indigo-500';
    if (lead.engagementScore === 'Hot') accentColor = 'border-l-orange-500';
    else if (lead.engagementScore === 'Warm') accentColor = 'border-l-amber-500';
    else if (lead.engagementScore === 'Cold') accentColor = 'border-l-sky-300';

    // Helper to safely access contact info
    const email = lead.email || lead.primaryContact?.email;
    const phone = lead.phone || lead.primaryContact?.phone;
    const preferredMethod = lead.preferredContactMethod || lead.primaryContact?.preferredMethod || 'Email';
    const photoUrl = lead.clientPhotoUrl || lead.primaryContact?.clientPhotoUrl;

    // Helper for formatting follow up date
    const followUpDate = lead.staleWarningDate ? (typeof (lead.staleWarningDate as any).toDate === 'function' ? (lead.staleWarningDate as any).toDate() : (lead.staleWarningDate instanceof Date ? lead.staleWarningDate : new Date(lead.staleWarningDate))) : null;
    const isOverdue = followUpDate && followUpDate < new Date();

    const getPreferredMethodIcon = (method?: string) => {
        switch (method?.toLowerCase()) {
            case 'phone': return 'fa-phone';
            case 'sms': return 'fa-comment-sms';
            case 'whatsapp': return 'fa-whatsapp';
            case 'email': default: return 'fa-envelope';
        }
    };

    // Determine relevant status based on stage
    const currentFunnelStage = getFunnelStageForStatus(lead.status, lead.leadType, realtorSettings);
    let displayStatusLabel = 'Status';
    let displayStatusValue = lead.status;



    return (
        <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`bg-white p-3 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-all group border-l-4 relative ${accentColor} ${snapshot.isDragging ? 'shadow-2xl rotate-2 scale-105 z-50' : ''}`}
            style={provided.draggableProps.style}
        >
            {/* Top Right Temperature Badge */}
            <div className="absolute top-3 right-3 filter drop-shadow-sm flex items-center justify-center">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        const scores = ['Cold', 'Warm', 'Hot', 'Stale'];
                        const currentIndex = scores.indexOf(lead.engagementScore || 'Cold');
                        const nextScore = scores[(currentIndex + 1) % scores.length];
                        onUpdateLead(lead.id, { engagementScore: nextScore as any });
                    }}
                    className={`relative transition-all duration-300 ease-out flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 ${lead.engagementScore === 'Hot' ? 'w-10 h-10 -mt-2 -mr-2 drop-shadow-[0_4px_4px_rgba(255,100,0,0.3)] z-50 animate-flame' : 'w-6 h-6'}`}
                    title={`Current Temperature: ${lead.engagementScore || 'Cold'}. Click to cycle.`}
                >
                    {(!lead.engagementScore || lead.engagementScore === 'Cold') && <i className="fa-solid fa-snowflake text-sky-300 text-lg filter drop-shadow-sm"></i>}
                    {lead.engagementScore === 'Warm' && <i className="fa-solid fa-mug-hot text-amber-500 text-lg filter drop-shadow-sm"></i>}
                    {lead.engagementScore === 'Stale' && <img src="/assets/stale-icon.png" alt="Stale" className="w-5 h-5 object-contain opacity-60 grayscale filter drop-shadow-sm" />}
                    {lead.engagementScore === 'Hot' && (
                        <>
                            <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-sm">
                                <path d="M50 95C30 95 15 75 15 50C15 35 25 20 45 5C45 15 50 25 55 35C65 25 75 35 85 50C85 75 70 95 50 95Z" fill="#ff4d00" />
                                <path d="M50 90C35 90 25 75 25 55C25 45 30 35 45 25C45 35 50 45 55 50C62 40 70 45 75 55C75 75 65 90 50 90Z" fill="#ff9900" />
                                <path d="M50 85C42 85 35 75 35 60C35 50 40 45 45 40C48 50 50 55 55 60C58 55 62 55 65 60C65 75 58 85 50 85Z" fill="#ffcc00" />
                            </svg>
                            <div className="absolute inset-x-0 bottom-0 top-1/2 bg-orange-500/20 blur-lg rounded-full -z-10 animate-pulse"></div>
                        </>
                    )}
                </button>
            </div>

            {/* Header: Photo + Info (Name, Email, Phone) */}
            <div className="flex items-start gap-3 mb-3 pr-10"> {/* pr-10 to avoid overlap with badge */}
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-white shadow-sm flex-shrink-0 mt-0.5">
                    {photoUrl ? (
                        <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-xs font-black text-indigo-300">
                            {lead.firstName?.charAt(0)}{lead.lastName?.charAt(0)}
                        </span>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1">
                        {email && (
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 truncate" title={email}>
                                <i className="fa-regular fa-envelope text-slate-300 w-2.5"></i>
                                <span className="truncate">{email}</span>
                                {preferredMethod === 'Email' && <i className="fa-solid fa-star text-[6px] text-amber-400" title="Preferred"></i>}
                            </div>
                        )}
                        {phone && (
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 truncate" title={phone}>
                                <i className="fa-solid fa-phone text-slate-300 w-2.5 text-[8px]"></i>
                                <span className="truncate">{phone}</span>
                                {(preferredMethod === 'Phone' || preferredMethod === 'SMS') && <i className="fa-solid fa-star text-[6px] text-amber-400" title="Preferred"></i>}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                {/* Fixed Fields Section: Message, Property, Motivation */}
                <div className="flex flex-col gap-2.5 py-3 border-y border-slate-50">
                    {/* Customer Message */}
                    {(lead.message || lead.leadInfo?.customerMessage) && (
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <i className="fa-solid fa-quote-left text-[8px] text-indigo-300"></i>
                                Customer Message
                            </span>
                            <p className="text-[11px] text-slate-600 line-clamp-2 italic leading-relaxed pl-3 border-l border-slate-100">
                                "{lead.message || lead.leadInfo?.customerMessage}"
                            </p>
                        </div>
                    )}

                    {/* Inquiry Property */}
                    {(lead.propertyAddress || lead.leadInfo?.inquiryProperty?.address || (lead as any).subjectProperty) && (
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <i className="fa-solid fa-house text-[8px] text-indigo-300"></i>
                                Inquiry Property
                            </span>
                            <span className="text-[11px] font-bold text-slate-700 truncate pl-3">
                                {lead.propertyAddress || lead.leadInfo?.inquiryProperty?.address || (lead as any).subjectProperty}
                            </span>
                        </div>
                    )}

                    {/* Motivation */}
                    {lead.motivation && (
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <i className="fa-solid fa-bullseye text-[8px] text-indigo-300"></i>
                                Motivation
                            </span>
                            <span className="text-[11px] font-bold text-slate-700 line-clamp-1 pl-3">
                                {lead.motivation}
                            </span>
                        </div>
                    )}
                </div>
                {/* Footer: Follow Up & Status */}
                <div className="pt-2 mt-2 border-t border-slate-50 flex items-center justify-between text-[10px]">
                    <div className="flex flex-col gap-0.5">
                        <div className={`flex items-center gap-1.5 font-medium ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`} title="Follow-up Deadline">
                            <i className={`fa-solid fa-bell ${isOverdue ? 'animate-pulse' : ''}`}></i>
                            <span className="whitespace-nowrap">
                                {followUpDate ? `Follow up: ${followUpDate.toLocaleDateString()}` : 'No deadline'}
                            </span>
                        </div>
                        {(() => {
                            const currentStageEntry = lead.stageHistory?.find(
                                entry => entry.toStage === currentFunnelStage && !entry.exitedAt
                            );
                            const startDate = currentStageEntry?.enteredAt || lead.stageLastChangedAt || lead.createdDate || lead.receivedAt;
                            if (startDate) {
                                const start = typeof startDate.toDate === 'function' ? startDate.toDate() : new Date(startDate);
                                const diff = Math.max(0, new Date().getTime() - start.getTime());
                                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                return (
                                    <div className="text-slate-400 font-medium flex items-center gap-1.5 opacity-80 pl-4">
                                        <i className="fa-solid fa-hourglass-start text-[8px]"></i>
                                        <span>
                                            {days} day{days === 1 ? '' : 's'} in stage
                                        </span>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </div>

                    <div className="flex items-center gap-1" title={displayStatusLabel}>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                            {displayStatusValue}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeadsKanbanBoard;
