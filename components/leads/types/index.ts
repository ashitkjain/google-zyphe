import { Lead, LeadNote, UserProfile, FunnelStage } from '../../../types';
import { DropResult } from '@hello-pangea/dnd';

export interface InternalProps {
    leads: Lead[];
    realtorId: string;
    onUpdateLead: (id: string, updates: Partial<Lead>) => void;
    onViewLead: (lead: Lead) => void;
    onCreateLead: (initialUpdates?: Partial<Lead>) => void;
    onActivateLead: (lead: Lead) => void;
    pendingNote: { leadId: string, color: string } | null;
    setPendingNote: (note: { leadId: string, color: string } | null) => void;
    handleSaveNote: (content: string) => void;
    handleUpdateNote: (noteId: string, updates: Partial<LeadNote>) => void;
    handleDeleteNote: (noteId: string) => void;
    handleDragEnd: (result: DropResult) => void;
    onUpdateAvatar: (leadId: string, file: File) => void;
    onTabChange?: (tab: any) => void;
    isMobile?: boolean;
}

export type ViewMode = 'past6Months' | 'older';
export type DisplayMode = 'gallery' | 'kanban';
