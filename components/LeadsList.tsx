import React, { useState, useMemo } from 'react';
import { Lead, FunnelStage } from '../types';
import { LEAD_FIELD_CONFIG, LEAD_STAGE_LIFECYCLE_CONFIG } from '../types/lead';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { InternalProps, DisplayMode } from './leads/types';
import LeadGalleryItem from './leads/LeadGalleryItem';
import LeadsHeader from './leads/LeadsHeader';
import LeadsViewControls from './leads/LeadsViewControls';
import LeadsKanbanBoard from './leads/LeadsKanbanBoard';
import { getDeviceType } from '../utils/deviceDetection';

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
    onTabChange
}) => {
    // State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'Buyer' | 'Buyer2' | 'Seller'>('Buyer');
    const [buyerFunnelCategory, setBuyerFunnelCategory] = useState<FunnelStage | 'Closed & Archived'>('Leads');
    const [buyer2FunnelCategory, setBuyer2FunnelCategory] = useState<FunnelStage | 'Closed & Archived'>('Leads');
    const [sellerFunnelCategory, setSellerFunnelCategory] = useState<FunnelStage | 'Closed & Archived'>('Leads');
    const [currentDisplayMode, setCurrentDisplayMode] = useState<DisplayMode>('kanban');

    // Auto-switch to grid on mobile
    React.useEffect(() => {
        if (getDeviceType() === 'mobile') {
            setCurrentDisplayMode('grid');
        }
    }, []);

    const [boardSettings, setBoardSettings] = useState({
        search: '',
        sort: 'newest' as 'newest' | 'oldest' | 'name' | 'temp',
        tempFilter: [] as string[]
    });

    // Filter leads by type
    const buyerLeads = useMemo(() => leads.filter(l => l.leadType === 'Buyer'), [leads]);
    const sellerLeads = useMemo(() => leads.filter(l => l.leadType === 'Seller'), [leads]);

    // Filter by funnel stage
    const filteredBuyerLeads = useMemo(() => {
        if (buyerFunnelCategory === 'Closed & Archived') {
            return buyerLeads.filter(l => l.funnelStage === 'Closed' || l.funnelStage === 'Archived');
        }
        return buyerLeads.filter(l => l.funnelStage === buyerFunnelCategory);
    }, [buyerLeads, buyerFunnelCategory]);

    const filteredBuyer2Leads = useMemo(() => {
        if (buyer2FunnelCategory === 'Closed & Archived') {
            return sellerLeads.filter(l => l.funnelStage === 'Closed' || l.funnelStage === 'Archived');
        }
        return sellerLeads.filter(l => l.funnelStage === buyer2FunnelCategory);
    }, [sellerLeads, buyer2FunnelCategory]);

    const filteredSellerLeads = useMemo(() => {
        if (sellerFunnelCategory === 'Closed & Archived') {
            return sellerLeads.filter(l => l.funnelStage === 'Closed' || l.funnelStage === 'Archived');
        }
        return sellerLeads.filter(l => l.funnelStage === sellerFunnelCategory);
    }, [sellerLeads, sellerFunnelCategory]);

    // Sorting
    const sortedBuyerLeads = useMemo(() => {
        return [...filteredBuyerLeads].sort((a, b) => {
            const aVal = a.lastUpdated?.toDate ? a.lastUpdated.toDate().getTime() : new Date(a.lastUpdated || 0).getTime();
            const bVal = b.lastUpdated?.toDate ? b.lastUpdated.toDate().getTime() : new Date(b.lastUpdated || 0).getTime();
            return bVal - aVal;
        });
    }, [filteredBuyerLeads]);

    const sortedBuyer2Leads = useMemo(() => {
        return [...filteredBuyer2Leads].sort((a, b) => {
            const aVal = a.lastUpdated?.toDate ? a.lastUpdated.toDate().getTime() : new Date(a.lastUpdated || 0).getTime();
            const bVal = b.lastUpdated?.toDate ? b.lastUpdated.toDate().getTime() : new Date(b.lastUpdated || 0).getTime();
            return bVal - aVal;
        });
    }, [filteredBuyer2Leads]);

    const sortedSellerLeads = useMemo(() => {
        return [...filteredSellerLeads].sort((a, b) => {
            const aVal = a.lastUpdated?.toDate ? a.lastUpdated.toDate().getTime() : new Date(a.lastUpdated || 0).getTime();
            const bVal = b.lastUpdated?.toDate ? b.lastUpdated.toDate().getTime() : new Date(b.lastUpdated || 0).getTime();
            return bVal - aVal;
        });
    }, [filteredSellerLeads]);

    // Handlers

    const handleSelectOne = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
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

    // Time stats (simplified)
    const timeStats = {
        Buyer: {
            'Past 6 Months': buyerLeads.length,
            'Older': 0
        },
        Buyer2: {
            'Past 6 Months': sellerLeads.length,
            'Older': 0
        },
        Seller: {
            'Past 6 Months': sellerLeads.length,
            'Older': 0
        }
    };

    const dateRanges = {
        labels: ['Past 6 Months', 'Older']
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
            />

            {/* Kanban View */}
            {currentDisplayMode === 'kanban' ? (
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
                    onUpdateAvatar={onUpdateAvatar}
                    realtorId={realtorId}
                    boardSettings={boardSettings}
                />
            ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                    {/* Content Area */}
                    <div className="flex-1 bg-white mb-0 space-y-4 py-4 overflow-y-auto custom-scrollbar h-full">
                        {/* Buyer Section */}
                        {activeTab === 'Buyer' && (
                            <section className="px-4 animate-in fade-in slide-in-from-left-4 duration-300">
                                <LeadsViewControls
                                    activeTab="Buyer"
                                    activeFunnelCategory={buyerFunnelCategory}
                                    onFunnelCategoryChange={setBuyerFunnelCategory}
                                    selectedCount={selectedIds.size}
                                    onArchive={handleBulkArchive}
                                    showFilters={false}
                                    setShowFilters={() => { }}
                                    displayMode={currentDisplayMode}
                                    setDisplayMode={toggleDisplayMode}
                                    onTabChange={onTabChange}
                                />

                                {sortedBuyerLeads.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-24">
                                        {sortedBuyerLeads.map((lead, index) => (
                                            <LeadGalleryItem
                                                onUpdateAvatar={onUpdateAvatar}
                                                key={lead.id}
                                                lead={lead}
                                                stage={buyerFunnelCategory}
                                                index={index}
                                                selectedIds={selectedIds}
                                                handleSelectOne={handleSelectOne}
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
                                                onUpdateLeadFromGallery={onUpdateLead}
                                                onUpdateLeadStatus={onUpdateLead}
                                                visibleColumns={new Set()}
                                                onUpdateLead={onUpdateLead}
                                                onArchive={() => onUpdateLead(lead.id, { funnelStage: 'Archived' })}
                                                onActivate={onActivateLead}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-slate-400">
                                        No buyer leads in this stage
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Buyer2 Section */}
                        {activeTab === 'Buyer2' && (
                            <section className="px-4 animate-in fade-in slide-in-from-left-4 duration-300">
                                <LeadsViewControls
                                    activeTab="Seller"
                                    activeFunnelCategory={buyer2FunnelCategory}
                                    onFunnelCategoryChange={setBuyer2FunnelCategory}
                                    selectedCount={selectedIds.size}
                                    onArchive={handleBulkArchive}
                                    showFilters={false}
                                    setShowFilters={() => { }}
                                    displayMode={currentDisplayMode}
                                    setDisplayMode={toggleDisplayMode}
                                    onTabChange={onTabChange}
                                />

                                {sortedBuyer2Leads.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-24">
                                        {sortedBuyer2Leads.map((lead, index) => (
                                            <LeadGalleryItem
                                                onUpdateAvatar={onUpdateAvatar}
                                                key={lead.id}
                                                lead={lead}
                                                stage={buyer2FunnelCategory}
                                                index={index}
                                                selectedIds={selectedIds}
                                                handleSelectOne={handleSelectOne}
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
                                                onUpdateLeadFromGallery={onUpdateLead}
                                                onUpdateLeadStatus={onUpdateLead}
                                                visibleColumns={new Set()}
                                                onUpdateLead={onUpdateLead}
                                                onArchive={() => onUpdateLead(lead.id, { funnelStage: 'Archived' })}
                                                onActivate={onActivateLead}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-slate-400">
                                        No seller leads in this stage
                                    </div>
                                )}
                            </section>
                        )}


                    </div>
                </DragDropContext>
            )}
        </div>
    );
};

export default LeadsList;
