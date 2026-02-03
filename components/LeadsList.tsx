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
    isMobile
}) => {
    // State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'Buyer' | 'Buyer2' | 'Seller'>('Buyer');
    const [buyerFunnelCategory, setBuyerFunnelCategory] = useState<FunnelStage | 'Closed & Archived'>('Leads');
    const [buyer2FunnelCategory, setBuyer2FunnelCategory] = useState<FunnelStage | 'Closed & Archived'>('Leads');
    const [sellerFunnelCategory, setSellerFunnelCategory] = useState<FunnelStage | 'Closed & Archived'>('Leads');
    const [currentDisplayMode, setCurrentDisplayMode] = useState<DisplayMode>(isMobile ? 'gallery' : 'kanban');
    const [selectedLeadForOverlay, setSelectedLeadForOverlay] = useState<Lead | null>(null);

    // Sync display mode with mobile status
    React.useEffect(() => {
        if (isMobile) {
            setCurrentDisplayMode('gallery');
        }
    }, [isMobile]);
    const [boardSettings, setBoardSettings] = useState({
        search: '',
        sort: 'newest' as 'newest' | 'oldest' | 'name' | 'temp',
        tempFilter: [] as string[]
    });

    // Filter leads by type
    const buyerLeads = useMemo(() => leads.filter(l => l.leadType === 'Buyer'), [leads]);
    const sellerLeads = useMemo(() => leads.filter(l => l.leadType === 'Seller'), [leads]);

    // Base filtering for leads (Search + Temperature)
    const getFilteredLeads = (baseLeads: Lead[]) => {
        return baseLeads.filter(lead => {
            // Global Search
            if (boardSettings.search) {
                const s = boardSettings.search.toLowerCase();
                const matchesSearch = (lead.fullName || '').toLowerCase().includes(s) ||
                    (lead.email || lead.primaryContact?.email || '').toLowerCase().includes(s) ||
                    (lead.propertyAddress || lead.leadInfo?.inquiryProperty?.address || '').toLowerCase().includes(s);
                if (!matchesSearch) return false;
            }

            // Temperature Filter
            if (boardSettings.tempFilter.length > 0) {
                if (!boardSettings.tempFilter.includes(lead.engagementScore || 'Cold')) return false;
            }

            return true;
        });
    };

    // Filter by funnel stage + base filters
    const filteredBuyerLeads = useMemo(() => {
        const base = getFilteredLeads(buyerLeads);
        if (buyerFunnelCategory === 'Closed & Archived') {
            return base.filter(l => l.funnelStage === 'Closed' || l.funnelStage === 'Archived');
        }
        return base.filter(l => l.funnelStage === buyerFunnelCategory);
    }, [buyerLeads, buyerFunnelCategory, boardSettings]);

    const filteredBuyer2Leads = useMemo(() => {
        const base = getFilteredLeads(sellerLeads);
        if (buyer2FunnelCategory === 'Closed & Archived') {
            return base.filter(l => l.funnelStage === 'Closed' || l.funnelStage === 'Archived');
        }
        return base.filter(l => l.funnelStage === buyer2FunnelCategory);
    }, [sellerLeads, buyer2FunnelCategory, boardSettings]);

    const filteredSellerLeads = useMemo(() => {
        const base = getFilteredLeads(sellerLeads);
        if (sellerFunnelCategory === 'Closed & Archived') {
            return base.filter(l => l.funnelStage === 'Closed' || l.funnelStage === 'Archived');
        }
        return base.filter(l => l.funnelStage === sellerFunnelCategory);
    }, [sellerLeads, sellerFunnelCategory, boardSettings]);

    // Global Sorting Logic
    const sortLeads = (baseLeads: Lead[]) => {
        return [...baseLeads].sort((a, b) => {
            if (boardSettings.sort === 'name') {
                return (a.fullName || '').localeCompare(b.fullName || '');
            }
            if (boardSettings.sort === 'temp') {
                const order = { 'Hot': 0, 'Warm': 1, 'Cold': 2, 'Stale': 3 };
                return (order[a.engagementScore || 'Cold'] || 99) - (order[b.engagementScore || 'Cold'] || 99);
            }

            const getDateVal = (lead: Lead) => {
                const dateVal = lead.lastUpdated || lead.receivedAt || 0;
                return (dateVal as any)?.toDate ? (dateVal as any).toDate() : new Date(dateVal);
            };

            const da = getDateVal(a);
            const db = getDateVal(b);

            if (boardSettings.sort === 'oldest') {
                return da.getTime() - db.getTime();
            }
            // default to newest
            return db.getTime() - da.getTime();
        });
    };

    // Sorting applied to filtered lists
    const sortedBuyerLeads = useMemo(() => sortLeads(filteredBuyerLeads), [filteredBuyerLeads, boardSettings.sort]);
    const sortedBuyer2Leads = useMemo(() => sortLeads(filteredBuyer2Leads), [filteredBuyer2Leads, boardSettings.sort]);
    const sortedSellerLeads = useMemo(() => sortLeads(filteredSellerLeads), [filteredSellerLeads, boardSettings.sort]);

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
                isMobile={isMobile}
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
                    onUpdateAvatar={onUpdateAvatar}
                    realtorId={realtorId}
                    boardSettings={boardSettings}
                />
            )}

            {/* List View */}
            {currentDisplayMode === 'list' && (
                <LeadsListView
                    leads={activeTab === 'Buyer' ? sortedBuyerLeads : (activeTab === 'Buyer2' ? sortedBuyer2Leads : sortedSellerLeads)}
                    onUpdateLead={onUpdateLead}
                    realtorId={realtorId}
                    activeTab={activeTab === 'Buyer2' ? 'Seller' : activeTab}
                />
            )}

            {/* Gallery View */}
            {currentDisplayMode === 'gallery' && (
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
                                                onActivate={() => setSelectedLeadForOverlay(lead)}
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
                                                onActivate={() => setSelectedLeadForOverlay(lead)}
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

            {/* Client Details Overlay */}
            {selectedLeadForOverlay && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 pt-[80px] pb-4 px-4 overflow-hidden">
                    <div className="bg-white w-[1000px] h-full max-h-full rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative">
                        <button
                            onClick={() => setSelectedLeadForOverlay(null)}
                            className="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-700 transition-colors"
                        >
                            <i className="fa-solid fa-times"></i>
                        </button>
                        <ClientDetailsView
                            realtorId={realtorId}
                            clients={[{
                                ...selectedLeadForOverlay,
                                uid: selectedLeadForOverlay.id,
                                displayName: selectedLeadForOverlay.fullName || `${selectedLeadForOverlay.firstName || ''} ${selectedLeadForOverlay.lastName || ''}`.trim(),
                                email: selectedLeadForOverlay.email || selectedLeadForOverlay.primaryContact?.email || ''
                            } as any]}
                            leads={[selectedLeadForOverlay]}
                            onUpdateClient={async (id, updates) => {
                                onUpdateLead(id, updates);
                                return true;
                            }}
                            initialSelectedId={selectedLeadForOverlay.id}
                            hideClientList={true}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeadsList;
