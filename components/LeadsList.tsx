import React, { useState, useMemo } from 'react';
import { Lead, FunnelStage } from '../types';
import { LEAD_FIELD_CONFIG, LEAD_STAGE_LIFECYCLE_CONFIG } from '../types/lead';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { InternalProps, DisplayMode } from './leads/types';
import LeadGalleryItem from './leads/LeadGalleryItem';
import LeadsHeader from './leads/LeadsHeader';
import LeadsViewControls from './leads/LeadsViewControls';
import LeadsKanbanBoard from './leads/LeadsKanbanBoard';
import LeadsListView from './leads/LeadsListView';
import ClientDetailsView from './client-hub/ClientDetailsView';
import DailyPulseModal from './leads/DailyPulseModal';

const LeadsList: React.FC<InternalProps> = ({
    leads,
    realtorId,
    onUpdateLead,
    onCreateLead,
    onActivateLead,
    pendingNote,
    setPendingNote,
    handleSaveNote,
    handleUpdateNote,
    handleDeleteNote,
    handleDragEnd,
    onUpdateAvatar,
    onTabChange,
    isMobile,
    tasks = [],
    calendarEvents = []
}) => {
    // State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showDailyPulse, setShowDailyPulse] = useState(false);
    const [activeTab, setActiveTab] = useState<'Buyer' | 'Buyer2' | 'Seller'>('Buyer');
    const [buyerFunnelCategory, setBuyerFunnelCategory] = useState<FunnelStage | 'Closed & Archived'>('Leads');
    const [buyer2FunnelCategory, setBuyer2FunnelCategory] = useState<FunnelStage | 'Closed & Archived'>('Leads');
    const [sellerFunnelCategory, setSellerFunnelCategory] = useState<FunnelStage | 'Closed & Archived'>('Leads');
    const [currentDisplayMode, setCurrentDisplayMode] = useState<'gallery' | 'kanban' | 'list'>('kanban');

    // Filter/Sort State (passed to header)
    const [boardSettings, setBoardSettings] = useState({
        search: '',
        sort: 'newest' as 'newest' | 'oldest' | 'name' | 'temp',
        tempFilter: [] as string[]
    });

    const filteredLeads = useMemo(() => {
        let result = [...leads];

        // 1. Filter by Active Tab
        result = result.filter(lead => {
            if (activeTab === 'Buyer') return lead.leadType === 'Buyer';
            if (activeTab === 'Buyer2') return lead.leadType === 'Seller';
            if (activeTab === 'Seller') return lead.leadType === 'Seller';
            return true;
        });

        // 2. Search
        if (boardSettings.search) {
            const term = boardSettings.search.toLowerCase();
            result = result.filter(l =>
                (l.fullName || '').toLowerCase().includes(term) ||
                (l.email || '').toLowerCase().includes(term) ||
                (l.phone || '').toLowerCase().includes(term) ||
                (l.propertyAddress || '').toLowerCase().includes(term) ||
                (l.leadInfo?.inquiryProperty?.address || '').toLowerCase().includes(term)
            );
        }

        // 3. Temp Filter
        if (boardSettings.tempFilter.length > 0) {
            result = result.filter(l => boardSettings.tempFilter.includes(l.engagementScore || 'Cold'));
        }

        // 4. Sort
        result.sort((a, b) => {
            if (boardSettings.sort === 'newest') {
                const da = a.receivedAt?.toDate ? a.receivedAt.toDate() : new Date(a.receivedAt || 0);
                const db = b.receivedAt?.toDate ? b.receivedAt.toDate() : new Date(b.receivedAt || 0);
                return db.getTime() - da.getTime();
            }
            if (boardSettings.sort === 'oldest') {
                const da = a.receivedAt?.toDate ? a.receivedAt.toDate() : new Date(a.receivedAt || 0);
                const db = b.receivedAt?.toDate ? b.receivedAt.toDate() : new Date(b.receivedAt || 0);
                return da.getTime() - db.getTime();
            }
            if (boardSettings.sort === 'name') {
                return (a.fullName || '').localeCompare(b.fullName || '');
            }
            if (boardSettings.sort === 'temp') {
                const order: Record<string, number> = { 'Hot': 0, 'Warm': 1, 'Cold': 2, 'Stale': 3 };
                return (order[a.engagementScore || 'Cold'] || 99) - (order[b.engagementScore || 'Cold'] || 99);
            }
            return 0;
        });

        return result;
    }, [leads, activeTab, boardSettings]);

    const buyerLeads = useMemo(() => filteredLeads.filter(l => l.leadType === 'Buyer'), [filteredLeads]);
    const sellerLeads = useMemo(() => filteredLeads.filter(l => l.leadType === 'Seller'), [filteredLeads]);

    const handleSelectOne = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleBulkArchive = () => {
        selectedIds.forEach(id => {
            const lead = leads.find(l => l.id === id);
            if (lead) {
                onUpdateLead(id, { funnelStage: 'Archived' as FunnelStage });
            }
        });
        setSelectedIds(new Set());
    };

    const toggleDisplayMode = () => {
        setCurrentDisplayMode(currentDisplayMode === 'gallery' ? 'kanban' : 'gallery');
    };

    return (
        <div className="flex flex-col w-full bg-white text-sm font-sans min-w-0 h-full">
            {/* Header */}
            <LeadsHeader
                activeTab={activeTab}
                setActiveTab={(tab: any) => {
                    setActiveTab(tab);
                    onTabChange?.(tab);
                }}
                onCreateLead={onCreateLead}
                displayMode={currentDisplayMode}
                setDisplayMode={setCurrentDisplayMode}
                boardSettings={boardSettings}
                setBoardSettings={setBoardSettings}
                isMobile={isMobile}
                leads={leads}
                realtorId={realtorId}
                onOpenDailyPulse={() => setShowDailyPulse(true)}
            />

            <DailyPulseModal
                isOpen={showDailyPulse}
                onClose={() => setShowDailyPulse(false)}
                leads={leads}
                userId={realtorId}
                tasks={tasks}
                calendarEvents={calendarEvents}
            />

            {/* Kanban View */}
            {currentDisplayMode === 'kanban' && (
                <LeadsKanbanBoard
                    leads={activeTab === 'Buyer' ? buyerLeads : (activeTab === 'Buyer2' ? sellerLeads : sellerLeads)}
                    leadType={activeTab === 'Buyer2' ? 'Seller' : activeTab}
                    onUpdateLead={onUpdateLead}
                    selectedIds={selectedIds}
                    onSelectOne={handleSelectOne}
                    pendingNote={pendingNote}
                    setPendingNote={setPendingNote}
                    handleSaveNote={handleSaveNote}
                    handleUpdateNote={handleUpdateNote}
                    handleDeleteNote={handleDeleteNote}
                    onActivateLead={onActivateLead}
                    onUpdateAvatar={onUpdateAvatar}
                    boardSettings={boardSettings || { search: '', sort: 'newest', tempFilter: [] }}
                    realtorId={realtorId}
                />
            )}

            {/* Gallery View */}
            {currentDisplayMode === 'gallery' && (
                <DragDropContext onDragEnd={handleDragEnd}>
                    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50">
                        <div className="max-w-[1600px] mx-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                                {(activeTab === 'Buyer' ? buyerLeads : sellerLeads).map((lead, index) => (
                                    <LeadGalleryItem
                                        key={lead.id}
                                        lead={lead}
                                        index={index}
                                        selectedIds={selectedIds}
                                        handleSelectOne={handleSelectOne}
                                        onUpdateLead={onUpdateLead}
                                        onActivate={() => onActivateLead(lead)}
                                        onArchive={(id) => onUpdateLead(id, { funnelStage: 'Archived' })}
                                        activeTab={activeTab === 'Buyer' ? 'Buyer' : 'Seller'}
                                        onUpdateAvatar={onUpdateAvatar}
                                        stage={lead.funnelStage || 'Leads'}
                                        // Missing mandatory props for LeadGalleryItem
                                        editNoteId={null}
                                        setEditNoteId={() => { }}
                                        editContent=""
                                        setEditContent={() => { }}
                                        handleUpdateNote={handleUpdateNote}
                                        onDoneToggle={() => { }}
                                        onDeleteClick={() => { }}
                                        pendingNote={pendingNote}
                                        draftContent=""
                                        setDraftContent={() => { }}
                                        handleSaveNote={handleSaveNote}
                                        setPendingNote={setPendingNote}
                                        deleteCoords={null}
                                        deletingNoteId={null}
                                        celebratingNoteId={null}
                                        isFlyingUpId={null}
                                        visibleColumns={new Set(['name', 'contact', 'temp', 'status'])}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </DragDropContext>
            )}

            {/* List View */}
            {currentDisplayMode === 'list' && (
                <LeadsListView
                    leads={activeTab === 'Buyer' ? buyerLeads : sellerLeads}
                    onUpdateLead={onUpdateLead}
                    realtorId={realtorId}
                    activeTab={activeTab}
                />
            )}
        </div>
    );
};

export default LeadsList;
