import React, { useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Lead } from '../../types';
import { getFunnelStageForStatus, getStatusOptions } from '../../services/statusService';

interface LeadsKanbanBoardProps {
    leads: Lead[];
    onUpdateLead: (id: string, updates: Partial<Lead>) => void;
    realtorSettings: any;
    leadType: 'Buyer' | 'Seller';
}

const KANBAN_COLUMNS = [
    { id: 'leads', label: 'Leads', stages: ['Leads'] },
    { id: 'nurture', label: 'Nurture', stages: ['Nurture'] },
    { id: 'active-search', label: 'Active Search', stages: ['Active Search'] },
    { id: 'offer', label: 'Offer', stages: ['Offer'] },
    { id: 'closing', label: 'Closing', stages: ['Contract'] }
];

const LeadsKanbanBoard: React.FC<LeadsKanbanBoardProps> = ({
    leads,
    onUpdateLead,
    realtorSettings,
    leadType
}) => {

    const getColumnIdForLead = (lead: Lead) => {
        const stage = getFunnelStageForStatus(lead.status, lead.leadType, realtorSettings);
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

        // Sort by receivedAt desc
        Object.keys(cols).forEach(key => {
            cols[key].sort((a, b) => {
                const da = a.receivedAt?.toDate ? a.receivedAt.toDate() : new Date(a.receivedAt || 0);
                const db = b.receivedAt?.toDate ? b.receivedAt.toDate() : new Date(b.receivedAt || 0);
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
            // Reordering within same column - currently only sorting by date is supported so we might just ignore reorder or implement manual order later
            return;
        }

        // Determine new status
        // We pick the default status for the target column's MAIN stage
        const targetColDef = KANBAN_COLUMNS.find(c => c.id === targetColumnId);
        if (!targetColDef) return;

        const primaryStage = targetColDef.stages[0]; // e.g. 'Nurture'
        const options = getStatusOptions(leadType, realtorSettings);

        // Find default status for this stage
        const targetStatus = options.find((o: any) => o.funnelStage === primaryStage && o.isDefault);
        const fallbackStatus = options.find((o: any) => o.funnelStage === primaryStage);

        const newStatus = targetStatus?.label || fallbackStatus?.label;

        if (newStatus) {
            onUpdateLead(draggableId, { status: newStatus });
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
                                        {columns[column.id].map((lead, index) => (
                                            <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <KanbanCard
                                                        lead={lead}
                                                        provided={provided}
                                                        snapshot={snapshot}
                                                    />
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}
                </div>
            </DragDropContext>
        </div>
    );
};

const KanbanCard: React.FC<{ lead: Lead, provided: any, snapshot: any }> = ({ lead, provided, snapshot }) => {
    // Determine border color based on temperature/score
    let accentColor = 'border-l-indigo-500';
    if (lead.engagementScore === 'Hot') accentColor = 'border-l-orange-500';
    else if (lead.engagementScore === 'Warm') accentColor = 'border-l-amber-500';
    else if (lead.engagementScore === 'Cold') accentColor = 'border-l-sky-300';

    return (
        <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-all group border-l-4 ${accentColor} ${snapshot.isDragging ? 'shadow-2xl rotate-2 scale-105 z-50' : ''}`}
            style={provided.draggableProps.style}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-white shadow-sm flex-shrink-0">
                        {lead.clientPhotoUrl ? (
                            <img src={lead.clientPhotoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-xs font-black text-indigo-300">
                                {lead.firstName?.charAt(0)}{lead.lastName?.charAt(0)}
                            </span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="font-bold text-slate-800 text-sm truncate leading-tight">
                            {lead.firstName} {lead.lastName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                            {lead.status}
                        </div>
                    </div>
                </div>
                {lead.engagementScore === 'Hot' && <i className="fa-solid fa-fire text-orange-500 animate-pulse text-xs"></i>}
            </div>

            <div className="space-y-2">
                {/* Stats Row */}
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    {lead.price && (
                        <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                            <i className="fa-solid fa-dollar-sign text-[9px] text-emerald-500"></i>
                            <span className="font-bold text-slate-700">${(lead.price / 1000).toFixed(0)}k</span>
                        </div>
                    )}
                    {lead.timeframe && (
                        <div className="flex items-center gap-1">
                            <i className="fa-regular fa-clock text-[9px]"></i>
                            <span className="truncate max-w-[80px]">{lead.timeframe}</span>
                        </div>
                    )}
                </div>

                {/* Tags (limited) */}
                {lead.tags && lead.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                        {lead.tags.slice(0, 2).map((tag, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-bold rounded uppercase tracking-wider">
                                {tag}
                            </span>
                        ))}
                        {lead.tags.length > 2 && (
                            <span className="px-1.5 py-0.5 bg-slate-50 text-slate-400 text-[9px] font-bold rounded">+{lead.tags.length - 2}</span>
                        )}
                    </div>
                )}

                {/* Last Update Date */}
                <div className="pt-2 mt-2 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-300">
                    <div className="flex items-center gap-1">
                        <i className="fa-solid fa-calendar-check"></i>
                        <span>
                            {lead.receivedAt?.toDate ? lead.receivedAt.toDate().toLocaleDateString() : (lead.receivedAt ? new Date(lead.receivedAt).toLocaleDateString() : '--')}
                        </span>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <i className="fa-solid fa-phone hover:text-indigo-500 cursor-pointer"></i>
                        <i className="fa-solid fa-envelope hover:text-indigo-500 cursor-pointer"></i>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeadsKanbanBoard;
