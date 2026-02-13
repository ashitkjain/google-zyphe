import React, { useState, useEffect, useRef } from 'react';
import { useHubData } from './client-hub/hub/useHubData';
import { useRealtorProfile } from './client-hub/hub/useRealtorProfile';
import { useLeadActions } from './client-hub/hub/useLeadActions';
import HubHeader, { HubTab } from './client-hub/hub/HubHeader';
import HubMobileMenu from './client-hub/hub/HubMobileMenu';
import HubContent from './client-hub/hub/HubContent';
import AddClientModal from './AddClientModal';
import RemoveClientModal from './RemoveClientModal';
import ClientEditModal from './client-hub/ClientEditModal';
import Footer from './Footer';

import {
    updateLead,
    updateReminderRule,
    deleteAllMockData,
    deleteUserAccount,
    syncBestPractices
} from '../services/firebaseService';
import { getInitialMockLeads, getInitialMockTasks, getInitialMockTemplates, getInitialMockTransactions } from '../services/mockDataService';
import { seedMockData, getRealtorClients } from '../services/firebaseService';
import { Lead, UserProfile } from '../types';
import { getDeviceType } from '../utils/deviceDetection';

interface Props {
    realtorId: string;
    realtorName: string;
    onSignOut: () => void;
    onBack: () => void;
    exploreContent?: React.ReactNode;
    initialTab?: HubTab;
    onNavigate?: (view: any, path: string) => void;
    onUpdateProfile?: (updates: Partial<UserProfile>) => void;
    userRole?: 'buyer' | 'seller' | 'realtor' | 'investor';
}

const ClientHub: React.FC<Props> = ({ realtorId, realtorName, onSignOut, onBack, exploreContent, initialTab, onNavigate, onUpdateProfile: onUpdateProfileProp, userRole }) => {
    const defaultTab = initialTab || (userRole === 'investor' ? 'executive_summary' : (exploreContent ? 'explore' : 'leads'));
    const [activeTab, setActiveTab] = useState<HubTab>(defaultTab);
    const [isMobile, setIsMobile] = useState(false);
    const [isNarrow, setIsNarrow] = useState(false);
    const [isToolsOpen, setIsToolsOpen] = useState(false);
    const [isInvestorOpen, setIsInvestorOpen] = useState(false);
    const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMobileToolsExpanded, setIsMobileToolsExpanded] = useState(false);
    const [isMobileInvestorExpanded, setIsMobileInvestorExpanded] = useState(false);
    const [isMobileSettingsExpanded, setIsMobileSettingsExpanded] = useState(false);
    const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
    const [isRemoveClientModalOpen, setIsRemoveClientModalOpen] = useState(false);
    const [isCreateLeadModalOpen, setIsCreateLeadModalOpen] = useState(false);
    const [newLeadSkeleton, setNewLeadSkeleton] = useState<any>(null);
    const [explicitlySelectedClientId, setExplicitlySelectedClientId] = useState<string | undefined>(undefined);
    const toolsRef = useRef<HTMLDivElement>(null);
    const investorRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Hooks
    const hubData = useHubData(realtorId, activeTab);
    const {
        leads, setLeads, refreshLeads,
        tasks, refreshTasks,
        reminderRules, setReminderRules,
        calendarEvents,
        clients, setClients, refreshClients,
        loadingClients
    } = hubData;

    const { realtorProfile, handleUpdateProfile } = useRealtorProfile(realtorId, realtorName, onUpdateProfileProp);

    const {
        handleUpdateLead, handleDragEnd, handleSaveLeadNote,
        handleUpdateLeadNote, handleDeleteLeadNote, pendingNote, setPendingNote
    } = useLeadActions(leads, setLeads, clients, setClients);

    useEffect(() => {
        if (initialTab) setActiveTab(initialTab);
    }, [initialTab]);

    useEffect(() => {
        setIsMobile(getDeviceType() === 'mobile');
        const handleResize = () => setIsNarrow(window.innerWidth < 1200);
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [activeTab]);

    const showHamburger = isMobile || isNarrow;

    const handleResetAllData = async () => {
        await deleteAllMockData(realtorId);
        await refreshLeads();
        await refreshTasks();
    };

    const handleSeedManualMockData = async () => {
        const initialLeads = getInitialMockLeads(realtorId);
        const initialTasks = getInitialMockTasks(realtorId);
        const initialTemplates = getInitialMockTemplates(realtorId);
        const initialTransactions = getInitialMockTransactions(realtorId);
        await seedMockData(realtorId, initialLeads, initialTasks, initialTemplates, initialTransactions);
        await refreshLeads();
        await refreshTasks();
    };

    const handleCreateLead = (initialUpdates?: Partial<Lead>) => {
        let type = initialUpdates?.leadType || 'Buyer';
        if ((type as string) === 'Buyer2') type = 'Seller';
        setNewLeadSkeleton({
            firstName: '', lastName: '', email: '', phone: '',
            status: 'New', funnelStage: 'Leads', engagementScore: 'Cold', source: 'Manual',
            ...initialUpdates, leadType: type
        });
        setIsCreateLeadModalOpen(true);
    };

    const earlyTabs: { id: HubTab; label: string; icon: string }[] = [
        { id: 'explore', label: 'Explore', icon: 'fa-globe' },
        { id: 'leads', label: 'Funnel', icon: 'fa-bullseye' },
        { id: 'closing', label: 'Closing', icon: 'fa-file-invoice-dollar' },
        { id: 'reactivate', label: 'Reactivate', icon: 'fa-bolt' },
        { id: 'clients', label: 'Clients', icon: 'fa-user-group' },
    ];

    const lateTabs: { id: HubTab; label: string; icon: string }[] = [
        { id: 'knowledge_center', label: 'Library', icon: 'fa-book-bookmark' },
    ];

    const toolTabs: { id: HubTab; label: string; icon: string }[] = [
        { id: 'tasks', label: 'Tasks', icon: 'fa-check-double' },
        { id: 'calendar', label: 'Calendar', icon: 'fa-calendar-days' },
        { id: 'lead_ingestion', label: 'Lead Ingestion', icon: 'fa-link' },
        { id: 'whiteboard', label: 'Whiteboard', icon: 'fa-pen-to-square' },
        { id: 'creative_studio', label: 'Creative Studio', icon: 'fa-paintbrush' },
        { id: 'settings', label: 'Data Fields', icon: 'fa-sliders' },
        { id: 'pdf_csv', label: 'PDF to CSV', icon: 'fa-file-csv' },
        { id: 'sms_registration', label: 'SMS Registration', icon: 'fa-comment-sms' },
    ];

    const adminTabs: { id: HubTab; label: string; icon: string }[] = [
        { id: 'city_data', label: 'City Ingestion', icon: 'fa-city' },
        { id: 'reminder_rules', label: 'Reminder Rules', icon: 'fa-bell-concierge' },
        { id: 'storage_registry', label: 'Bulk Prefetch', icon: 'fa-server' },
        { id: 'video_upload', label: 'Video Upload', icon: 'fa-video' },
    ];

    const investorTabs: { id: HubTab; label: string; icon: string }[] = [
        { id: 'executive_summary', label: 'Executive Summary', icon: 'fa-file-signature' },
        { id: 'industry_research', label: 'Industry Research', icon: 'fa-magnifying-glass-chart' },
        { id: 'product_market_fit', label: 'Product Market Fit', icon: 'fa-bullseye' },
        { id: 'premium_mls', label: 'Premium MLS', icon: 'fa-house-lock' },
        { id: 'industry_case_studies', label: 'Case Studies', icon: 'fa-book-open' },
        { id: 'unit_economics', label: 'Unit Economics', icon: 'fa-calculator' },
        { id: 'technical_papers', label: 'Technical Papers', icon: 'fa-file-invoice' },
    ];

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const isOutsideTools = toolsRef.current && !toolsRef.current.contains(e.target as Node);
            const isOutsideInvestor = investorRef.current && !investorRef.current.contains(e.target as Node);

            if (isOutsideTools && isOutsideInvestor) {
                setIsToolsOpen(false);
                setIsInvestorOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="fixed inset-0 z-[100] bg-[#F8FAFC] flex flex-col animate-in fade-in duration-500 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            <HubHeader
                realtorName={realtorName}
                realtorProfile={realtorProfile}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                showHamburger={showHamburger}
                isMobileMenuOpen={isMobileMenuOpen}
                setIsMobileMenuOpen={setIsMobileMenuOpen}
                isToolsOpen={isToolsOpen}
                setIsToolsOpen={setIsToolsOpen}
                isInvestorOpen={isInvestorOpen}
                setIsInvestorOpen={setIsInvestorOpen}
                isSettingsDropdownOpen={isSettingsDropdownOpen}
                setIsSettingsDropdownOpen={setIsSettingsDropdownOpen}
                onSignOut={onSignOut}
                onNavigate={onNavigate}
                setIsAddClientModalOpen={setIsAddClientModalOpen}
                setIsRemoveClientModalOpen={setIsRemoveClientModalOpen}
                earlyTabs={earlyTabs}
                lateTabs={lateTabs}
                toolTabs={toolTabs}
                adminTabs={adminTabs}
                investorTabs={userRole === 'investor' ? investorTabs : []}
                toolsRef={toolsRef}
                investorRef={investorRef}
                syncBestPractices={syncBestPractices}
                handleResetAllData={handleResetAllData}
                handleSeedManualMockData={handleSeedManualMockData}
                realtorId={realtorId}
                deleteUserAccount={deleteUserAccount}
            />

            <HubMobileMenu
                showHamburger={showHamburger}
                isMobileMenuOpen={isMobileMenuOpen}
                setIsMobileMenuOpen={setIsMobileMenuOpen}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onNavigate={onNavigate}
                earlyTabs={earlyTabs}
                lateTabs={lateTabs}
                toolTabs={toolTabs}
                adminTabs={adminTabs}
                investorTabs={userRole === 'investor' ? investorTabs : []}
                isMobileToolsExpanded={isMobileToolsExpanded}
                setIsMobileToolsExpanded={setIsMobileToolsExpanded}
                isMobileInvestorExpanded={isMobileInvestorExpanded}
                setIsMobileInvestorExpanded={setIsMobileInvestorExpanded}
                isMobileSettingsExpanded={isMobileSettingsExpanded}
                setIsMobileSettingsExpanded={setIsMobileSettingsExpanded}
                handleResetAllData={handleResetAllData}
                handleSeedManualMockData={handleSeedManualMockData}
                setIsAddClientModalOpen={setIsAddClientModalOpen}
                setIsRemoveClientModalOpen={setIsRemoveClientModalOpen}
                onSignOut={onSignOut}
                realtorId={realtorId}
                deleteUserAccount={deleteUserAccount}
            />

            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
                <div className="flex flex-col min-h-full">
                    <HubContent
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        realtorId={realtorId}
                        realtorName={realtorName}
                        exploreContent={exploreContent}
                        clients={clients}
                        leads={leads}
                        loadingClients={loadingClients}
                        handleUpdateLead={handleUpdateLead}
                        explicitlySelectedClientId={explicitlySelectedClientId}
                        setExplicitlySelectedClientId={setExplicitlySelectedClientId}
                        isMobile={isMobile}
                        handleCreateLead={handleCreateLead}
                        pendingNote={pendingNote}
                        setPendingNote={setPendingNote}
                        handleSaveLeadNote={handleSaveLeadNote}
                        handleUpdateLeadNote={handleUpdateLeadNote}
                        handleDeleteLeadNote={handleDeleteLeadNote}
                        handleDragEnd={handleDragEnd}
                        tasks={tasks}
                        calendarEvents={calendarEvents}
                        refreshTasks={refreshTasks}
                        reminderRules={reminderRules}
                        setReminderRules={setReminderRules}
                        onUpdateReminderRule={(id, updates) => {
                            setReminderRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
                        }}
                        onSaveReminderRules={hubData.saveReminderRules}
                        realtorProfile={realtorProfile}
                        handleUpdateProfile={handleUpdateProfile}
                        onNavigate={onNavigate}
                        userRole={userRole}
                    />

                    <Footer onNavigate={onNavigate} />

                    <style dangerouslySetInnerHTML={{
                        __html: `
                        @keyframes bounce-slow {
                            0%, 100% { transform: translateY(-5%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }
                            50% { transform: translateY(0); animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
                        }
                        .animate-bounce-slow { animation: bounce-slow 4s infinite; }
                        @keyframes urgent-flash {
                            0%, 100% { transform: scale(1); opacity: 1; }
                            50% { transform: scale(1.01); opacity: 0.9; background-color: rgba(255, 0, 0, 0.05); }
                        }
                        .animate-urgent-flash { animation: urgent-flash 1s infinite; }
                        ::-webkit-scrollbar { width: 10px; height: 12px; }
                        ::-webkit-scrollbar-track { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; }
                        ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 12px; border: 3px solid #f8fafc; }
                        ::-webkit-scrollbar-thumb:hover { background: #475569; }
                        * { scrollbar-width: thin; scrollbar-color: #94a3b8 #f8fafc; }
                    ` }} />
                </div>
            </div>

            <AddClientModal
                isOpen={isAddClientModalOpen}
                onClose={() => setIsAddClientModalOpen(false)}
                realtorName={realtorProfile?.displayName || 'Your Realtor'}
                realtorId={realtorId}
            />

            {isCreateLeadModalOpen && (
                <ClientEditModal
                    isOpen={isCreateLeadModalOpen}
                    onClose={() => setIsCreateLeadModalOpen(false)}
                    client={newLeadSkeleton}
                    onSave={async (updates) => {
                        const newId = `lead_${Date.now()}`;
                        await updateLead(newId, { ...updates, id: newId, realtorId, receivedAt: new Date(), lastUpdated: new Date() }, 'leads');
                        await refreshLeads();
                        setIsCreateLeadModalOpen(false);
                    }}
                />
            )}

            <RemoveClientModal
                isOpen={isRemoveClientModalOpen}
                onClose={() => setIsRemoveClientModalOpen(false)}
                realtorId={realtorId}
                onClientRemoved={() => { refreshClients(); }}
            />
        </div>
    );
};

export default ClientHub;
