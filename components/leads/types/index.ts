import { Lead, PipelineNote, UserProfile, FunnelStage } from '../../../types';
import { DropResult } from '@hello-pangea/dnd';

export interface InternalProps {
    leads: Lead[];
    onUpdateLead: (id: string, updates: Partial<Lead>) => void;
    onViewLead: (lead: Lead) => void;
    onCreateLead: (initialUpdates?: Partial<Lead>) => void;
    onActivateLead: (lead: Lead) => void;
    notes: PipelineNote[];
    pendingNote: { leadId: string, color: string } | null;
    setPendingNote: (note: { leadId: string, color: string } | null) => void;
    handleSaveNote: (content: string) => void;
    handleUpdateNote: (noteId: string, updates: Partial<PipelineNote>) => void;
    handleDeleteNote: (noteId: string) => void;
    handleDragEnd: (result: DropResult) => void;
    realtorSettings?: UserProfile['settings'];
    onUpdateAvatar: (leadId: string, file: File) => void;
    onUpdateSettings: (settings: Partial<UserProfile['settings']>) => void;
    onTabChange?: (tab: any) => void;
}

export type ViewMode = 'past6Months' | 'older';
export type DisplayMode = 'list' | 'gallery' | 'kanban';
