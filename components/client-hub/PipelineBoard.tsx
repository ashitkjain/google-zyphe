import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Lead, FunnelStage } from '../../types';

const TypedDraggable = Draggable as any;
const TypedDroppable = Droppable as any;

interface PipelineBoardProps {
    activeTab: 'buying' | 'selling';
    leads: Lead[];
    setEditingLead: (lead: Lead) => void;
    handleDragEnd: (result: DropResult) => void;
    handleCreateLead: (initialUpdates?: Partial<Lead>) => void;
}

const PipelineBoard: React.FC<PipelineBoardProps> = ({
    activeTab,
    leads,
    setEditingLead,
    handleDragEnd,
    handleCreateLead,
}) => {
    const columns = [
        { stage: 'Nurture', label: 'Nurture', color: '#f59e0b', icon: 'fa-leaf' },
        { stage: 'Active', label: activeTab === 'buying' ? 'Active Search' : 'Showing', color: '#6366f1', icon: 'fa-house-fire' },
        { stage: 'Offer', label: 'Offer', color: '#f43f5e', icon: 'fa-file-invoice-dollar' },
        { stage: 'UnderContract', label: 'Contract', color: '#10b981', icon: 'fa-handshake' },
        { stage: 'Closed', label: 'Closed', color: '#94a3b8', icon: 'fa-flag-checkered' },
    ];

    return (
        <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
            <div className="p-10 bg-white border-b border-slate-200/60 flex items-center justify-between shadow-sm relative z-20">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                    {activeTab === 'buying' ? 'Buyer Pipeline' : 'Seller Pipeline'}
                </h2>
                <div className="flex items-center gap-3">
                    <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${activeTab === 'buying' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
                        {activeTab === 'buying' ? 'Buyers' : 'Sellers'}
                    </span>
                </div>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex-1 overflow-x-auto p-10 flex gap-8 whitespace-nowrap scrollbar-thin scrollbar-thumb-indigo-100">
                    {columns.map((col) => (
                        <div key={col.stage} className="min-w-[320px] max-w-[320px] flex flex-col gap-6">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
                                    <div className={`w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: col.color }}></div>
                                    <i className={`fa-solid ${col.icon} text-slate-300 mr-1`}></i>
                                    {col.label}
                                </h3>
                                <span className="text-[10px] font-bold text-slate-300">
                                    {leads.filter(l => l.funnelStage === col.stage && l.collectionName === (activeTab === 'buying' ? 'buyers' : 'sellers')).length}
                                </span>
                            </div>

                            <TypedDroppable droppableId={col.stage} type="LEAD">
                                {(provided: any, snapshot: any) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className={`flex-1 flex flex-col gap-4 rounded-[2.5rem] p-2 transition-colors ${snapshot.isDraggingOver ? 'bg-indigo-50/50 outline-2 outline-dashed outline-indigo-200' : ''}`}
                                        style={{ minHeight: '100px' }}
                                    >
                                        {leads
                                            .filter(l => l.funnelStage === col.stage && l.collectionName === (activeTab === 'buying' ? 'buyers' : 'sellers'))
                                            .map((lead, index) => (
                                                <TypedDraggable key={lead.id} draggableId={lead.id} index={index}>
                                                    {(provided: any, snapshot: any) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={`bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-xl transition-all border-l-4 group ${snapshot.isDragging ? 'shadow-2xl scale-105 rotate-2 z-50 ring-4 ring-indigo-500/20' : ''}`}
                                                            style={{
                                                                ...provided.draggableProps.style,
                                                                borderLeftColor: col.color
                                                            }}
                                                            onClick={() => setEditingLead(lead)}
                                                        >
                                                            <div className="flex justify-between items-start mb-3">
                                                                <div className="font-bold text-slate-900 text-sm">{lead.name}</div>
                                                                {lead.slaUrgency === 'high' && (
                                                                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="High Urgency"></div>
                                                                )}
                                                            </div>

                                                            {lead.propertyAddress && activeTab !== 'buying' && (
                                                                <div className="text-[10px] text-slate-500 font-medium mb-1 truncate flex items-center gap-1.5 gray-400">
                                                                    <i className="fa-solid fa-location-dot opacity-30 text-[8px]"></i>
                                                                    {lead.propertyAddress}
                                                                </div>
                                                            )}

                                                            <div className="flex flex-col gap-1 mb-3">
                                                                {lead.email && (
                                                                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 truncate">
                                                                        <i className="fa-solid fa-envelope opacity-30 text-[8px]"></i>
                                                                        {lead.email}
                                                                    </div>
                                                                )}
                                                                {lead.phone && (
                                                                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 truncate">
                                                                        <i className="fa-solid fa-phone opacity-30 text-[8px]"></i>
                                                                        {lead.phone}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center justify-between mt-auto">
                                                                <div className="flex -space-x-1.5">
                                                                    <div className="w-6 h-6 rounded-full bg-slate-50 border border-white text-[8px] flex items-center justify-center font-black text-slate-400 shadow-sm group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                                        {lead.name[0]}
                                                                    </div>
                                                                    {lead.health === 'Active' && (
                                                                        <div className="w-6 h-6 rounded-full bg-emerald-50 border border-white flex items-center justify-center shadow-sm">
                                                                            <i className="fa-solid fa-bolt text-emerald-500 text-[8px]"></i>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    {activeTab === 'buying' ? (
                                                                        (lead.minPrice || lead.maxPrice) && (
                                                                            <div className="text-[10px] font-black text-slate-900">
                                                                                {lead.minPrice ? `$${(lead.minPrice / 1000).toFixed(0)}k` : '?'} - {lead.maxPrice ? `$${(lead.maxPrice / 1000).toFixed(0)}k` : '?'}
                                                                            </div>
                                                                        )
                                                                    ) : (
                                                                        lead.price && (
                                                                            <div className="text-[10px] font-black text-slate-900">${(lead.price / 1000).toFixed(0)}k</div>
                                                                        )
                                                                    )}
                                                                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-300 group-hover:text-indigo-400 transition-colors">
                                                                        <i className="fa-solid fa-chevron-right text-[7px]"></i>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </TypedDraggable>
                                            ))}
                                        {provided.placeholder}
                                        <button
                                            onClick={() => handleCreateLead({ funnelStage: col.stage as FunnelStage, leadType: activeTab === 'buying' ? 'Buyer' : 'Seller', status: 'Active' })}
                                            className="w-full py-4 border-2 border-dashed border-slate-200 rounded-[2rem] text-[10px] font-black uppercase tracking-widest text-slate-300 hover:border-indigo-300 hover:text-indigo-500 hover:bg-slate-50 transition-all group/btn mt-2"
                                        >
                                            <i className="fa-solid fa-plus mr-2 group-hover/btn:scale-110 transition-transform"></i>
                                            Add {activeTab === 'buying' ? 'Buyer' : 'Seller'}
                                        </button>
                                    </div>
                                )}
                            </TypedDroppable>
                        </div>
                    ))}
                </div>
            </DragDropContext>
        </div>
    );
};

export default PipelineBoard;
