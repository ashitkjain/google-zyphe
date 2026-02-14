import React from 'react';
import { HubTab } from './HubHeader';
import ClientDetailsView from '../ClientDetailsView';
import LeadsList from '../../LeadsList';
import ClosingDashboard from '../ClosingDashboard';
import ReactivateTab from '../ReactivateTab';
import ReminderRulesManager from '../ReminderRulesManager';
import TaskBoard from '../TaskBoard';
import StatusSettings from '../StatusSettings';
import ProfileTab from '../ProfileTab';
import WhiteboardTab from '../WhiteboardTab';
import ZypheCalendar from '../ZypheCalendar';
import CreativeStudioWidget from '../reactivate/components/CreativeStudioWidget';
import KnowledgeCenterTab from '../KnowledgeCenterTab';
import LeadIngestionTab from '../LeadIngestionTab';
import PdfToCsvTab from '../PdfToCsvTab';
import SmsRegistrationTab from '../SmsRegistrationTab';
import BulkPrefetchTab from '../BulkPrefetchTab';
import CityDataTab from '../CityDataTab';
import DataHealthTab from '../DataHealthTab';
import StorageScannerTab from '../StorageScannerTab';
import IndustryResearchTab from '../IndustryResearchTab';
import ProductMarketFitTab from '../ProductMarketFitTab';
import PostCloseIntelligenceTab from '../PostCloseIntelligenceTab';
import TechnicalPapersTab from '../TechnicalPapersTab';
import CaseStudiesTab from '../CaseStudiesTab';
import VideoUploadTab from '../VideoUploadTab';
import TechnicalMediaTab from '../TechnicalMediaTab';
import ExecutiveSummaryTab from '../ExecutiveSummaryTab';
import UnitEconomicsTab from '../UnitEconomicsTab';
import PremiumMLSTab from '../PremiumMLSTab';
import AIValidationTab from '../AIValidationTab';
import { Lead, CRMTask, UserProfile, ReminderRule, CalendarEvent } from '../../../types';

interface HubContentProps {
    activeTab: HubTab;
    setActiveTab: (tab: HubTab) => void;
    realtorId: string;
    realtorName: string;
    exploreContent?: React.ReactNode;
    clients: UserProfile[];
    leads: Lead[];
    loadingClients: boolean;
    handleUpdateLead: (id: string, updates: Partial<Lead>, collection?: string) => Promise<boolean>;
    explicitlySelectedClientId?: string;
    setExplicitlySelectedClientId: (id: string | undefined) => void;
    isMobile: boolean;
    handleCreateLead: (initial?: Partial<Lead>) => void;
    pendingNote: any;
    setPendingNote: (note: any) => void;
    handleSaveLeadNote: (content: string) => Promise<void>;
    handleUpdateLeadNote: (id: string, updates: any) => Promise<void>;
    handleDeleteLeadNote: (id: string) => Promise<void>;
    handleDragEnd: (result: any) => Promise<void>;
    tasks: CRMTask[];
    calendarEvents: CalendarEvent[];
    refreshTasks: () => Promise<void>;
    reminderRules: ReminderRule[];
    setReminderRules: React.Dispatch<React.SetStateAction<ReminderRule[]>>;
    onUpdateReminderRule: (id: string, updates: any) => void;
    onSaveReminderRules: () => Promise<void>;
    realtorProfile: UserProfile | null;
    handleUpdateProfile: (updates: Partial<UserProfile>) => Promise<void>;
    onNavigate?: (view: any, path: string) => void;
    userRole?: string;
}

const HubContent: React.FC<HubContentProps> = ({
    activeTab, setActiveTab, realtorId, realtorName, exploreContent, clients, leads,
    loadingClients, handleUpdateLead, explicitlySelectedClientId, setExplicitlySelectedClientId,
    isMobile, handleCreateLead, pendingNote, setPendingNote, handleSaveLeadNote,
    handleUpdateLeadNote, handleDeleteLeadNote, handleDragEnd, tasks, calendarEvents,
    refreshTasks, reminderRules, setReminderRules, onUpdateReminderRule, onSaveReminderRules,
    realtorProfile, handleUpdateProfile, onNavigate, userRole
}) => {
    return (
        <div className="flex-1 flex flex-col">
            {activeTab === 'explore' && exploreContent && (
                <div className="bg-slate-50">{exploreContent}</div>
            )}

            {activeTab === 'clients' && (
                <ClientDetailsView
                    realtorId={realtorId}
                    clients={clients}
                    leads={leads}
                    loading={loadingClients}
                    onUpdateClient={handleUpdateLead}
                    initialSelectedId={explicitlySelectedClientId}
                    setActiveTab={setActiveTab}
                    refreshTasks={refreshTasks}
                />
            )}

            {activeTab === 'leads' && (
                <LeadsList
                    realtorId={realtorId}
                    leads={leads}
                    isMobile={isMobile}
                    onUpdateLead={(id, updates) => handleUpdateLead(id, updates)}
                    onCreateLead={handleCreateLead}
                    pendingNote={pendingNote}
                    setPendingNote={setPendingNote}
                    handleSaveNote={handleSaveLeadNote}
                    handleUpdateNote={handleUpdateLeadNote}
                    handleDeleteNote={handleDeleteLeadNote}
                    handleDragEnd={handleDragEnd}
                    tasks={tasks}
                    calendarEvents={calendarEvents}
                    onUpdateAvatar={async (leadId, file) => {
                        const newAvatarUrl = `https://i.pravatar.cc/150?u=${Date.now()}`;
                        await handleUpdateLead(leadId, { avatarUrl: newAvatarUrl });
                    }}
                    onTabChange={(tab: any) => {
                        if (tab === 'settings:properties') setActiveTab('settings');
                        else if (tab !== 'Buyer' && tab !== 'Buyer2' && tab !== 'Seller') setActiveTab(tab);
                    }}
                    onActivateLead={(leadOrId: any) => {
                        const id = typeof leadOrId === 'string' ? leadOrId : leadOrId.id;
                        setExplicitlySelectedClientId(id);
                        setActiveTab('clients');
                    }}
                />
            )}

            {activeTab === 'closing' && (
                <ClosingDashboard
                    leads={leads}
                    onUpdateLead={handleUpdateLead}
                    realtorId={realtorId}
                    onNavigateToClient={(id) => {
                        setExplicitlySelectedClientId(id);
                        setActiveTab('clients');
                    }}
                />
            )}

            {activeTab === 'reactivate' && (
                <ReactivateTab realtorId={realtorId} realtorName={realtorName} leads={leads} onUpdateLead={handleUpdateLead} />
            )}

            {activeTab === 'reminder_rules' && (
                <ReminderRulesManager rules={reminderRules} onUpdateRule={onUpdateReminderRule} onSaveRules={onSaveReminderRules} />
            )}

            {activeTab === 'tasks' && (
                <TaskBoard
                    realtorId={realtorId}
                    tasks={tasks}
                    leads={[
                        ...clients.map(c => ({ ...c, id: c.uid, fullName: c.displayName } as any)),
                        ...leads.map(l => ({ ...l, fullName: `${l.firstName} ${l.lastName}` } as any))
                    ]}
                    onTasksUpdated={refreshTasks}
                />
            )}

            {activeTab === 'settings' && <StatusSettings realtorId={realtorId} />}

            {activeTab === 'profile' && <ProfileTab profile={realtorProfile} onUpdateProfile={handleUpdateProfile} />}

            {activeTab === 'whiteboard' && <WhiteboardTab userId={realtorId} />}

            {activeTab === 'calendar' && <ZypheCalendar realtorId={realtorId} leads={leads} tasks={tasks} />}

            {activeTab === 'creative_studio' && (
                <div className="max-w-5xl mx-auto py-8"><CreativeStudioWidget /></div>
            )}

            {activeTab === 'knowledge_center' && <KnowledgeCenterTab onNavigate={onNavigate} />}

            {activeTab === 'lead_ingestion' && <LeadIngestionTab realtorId={realtorId} />}

            {activeTab === 'pdf_csv' && <PdfToCsvTab />}

            {activeTab === 'sms_registration' && <SmsRegistrationTab realtorId={realtorId} />}

            {activeTab === 'bulk_prefetch' && <BulkPrefetchTab />}

            {activeTab === 'city_data' && <CityDataTab onNavigate={onNavigate} />}

            {activeTab === 'data_health' && <DataHealthTab />}

            {activeTab === 'ai_validation' && <AIValidationTab onNavigate={onNavigate} />}

            {activeTab === 'storage_registry' && <StorageScannerTab onNavigate={onNavigate} />}

            {activeTab === 'executive_summary' && <ExecutiveSummaryTab setActiveTab={setActiveTab} onNavigate={onNavigate} />}

            {activeTab === 'industry_research' && <IndustryResearchTab />}

            {activeTab === 'product_market_fit' && <ProductMarketFitTab setActiveTab={setActiveTab} />}

            {activeTab === 'industry_case_studies' && <CaseStudiesTab />}

            {activeTab === 'unit_economics' && <UnitEconomicsTab />}

            {activeTab === 'post_close_intelligence' && <PostCloseIntelligenceTab />}

            {activeTab === 'premium_mls' && <PremiumMLSTab />}

            {(activeTab === 'technical_papers' || activeTab === 'technical_papers_recommender' || activeTab === 'technical_papers_context_graph') && (
                <TechnicalPapersTab
                    setActiveTab={setActiveTab}
                    onNavigate={onNavigate}
                    initialPaper={
                        activeTab === 'technical_papers_context_graph'
                            ? 'context_graph'
                            : 'recommender_system'
                    }
                />
            )}

            {activeTab === 'technical_media' && <TechnicalMediaTab />}

            {activeTab === 'video_upload' && <VideoUploadTab />}
        </div>
    );
};

export default HubContent;
