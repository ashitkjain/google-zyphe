import React, { useState } from 'react';
import { updateLead } from '../../../services/firebaseService';
import { Lead, UserProfile, LeadNote, FunnelStage } from '../../../types';
import { isTerminalStatus, getFunnelStageForStatus } from '../../../services/statusService';
import { DropResult } from '@hello-pangea/dnd';

const generateClientID = () => {
    return 'C-' + Math.random().toString(36).substring(2, 7).toUpperCase();
};

export const useLeadActions = (
    leads: Lead[],
    setLeads: React.Dispatch<React.SetStateAction<Lead[]>>,
    clients: UserProfile[],
    setClients: React.Dispatch<React.SetStateAction<UserProfile[]>>
) => {
    const [pendingNote, setPendingNote] = useState<{ leadId: string, color: string } | null>(null);

    const handleUpdateLead = async (leadId: string, updates: Partial<Lead>, collectionName: string = 'leads') => {
        const currentLead = leads.find(l => l.id === leadId);
        const currentClient = clients.find(c => c.uid === leadId);
        const isUserCollection = collectionName === 'users' || (!currentLead && currentClient);

        if (currentLead && !isUserCollection) {
            const now = new Date();

            if (updates.status && updates.status !== currentLead.status) {
                const newStage = getFunnelStageForStatus(updates.status, currentLead.leadType) as any;
                if (newStage !== currentLead.funnelStage) {
                    updates.funnelStage = newStage;
                }
            }

            if (updates.funnelStage && updates.funnelStage !== currentLead.funnelStage) {
                updates.stageLastChangedAt = now;
                const history = [...(currentLead.stageHistory || [])];
                const lastHistoryIndex = history.findIndex(h => !h.exitedAt);
                if (lastHistoryIndex !== -1) {
                    history[lastHistoryIndex] = { ...history[lastHistoryIndex], exitedAt: now };
                }
                history.push({
                    fromStage: currentLead.funnelStage,
                    toStage: updates.funnelStage,
                    enteredAt: now
                });
                updates.stageHistory = history as any;
            }

            if (updates.status === 'Archived' && currentLead.status !== 'Archived') {
                updates.archivedAt = now;
            } else if (currentLead.status === 'Archived' && updates.status && updates.status !== 'Archived') {
                updates.activatedAt = now;
            }

            if (isTerminalStatus(updates.status || '', currentLead.leadType) && !isTerminalStatus(currentLead.status, currentLead.leadType)) {
                updates.closedAt = now;
            }

            if (!updates.subjectProperty && currentLead.propertyAddress && !currentLead.subjectProperty) {
                updates.subjectProperty = currentLead.propertyAddress;
            }

            if (!currentLead.clientId && !updates.clientId) {
                updates.clientId = generateClientID();
            }
        }

        if (isUserCollection) {
            setClients(prev => prev.map(c => c.uid === leadId ? { ...c, ...updates } : c));
        } else {
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
        }

        const success = await updateLead(leadId, updates, collectionName);
        return success;
    };

    const handleDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (draggableId.startsWith('note-') && destination && destination.droppableId.startsWith('note-drop-')) {
            const leadId = destination.droppableId.replace('note-drop-', '');
            const baseNoteId = draggableId.split('-').slice(0, 2).join('-');
            const colorMap: any = {
                'note-yellow': 'bg-[#ffff88] text-slate-800 border-[#eeee77] shadow-[5px_5px_7px_rgba(33,33,33,.1)]',
                'note-blue': 'bg-[#7afaff] text-slate-800 border-[#69e9ee] shadow-[5px_5px_7px_rgba(33,33,33,.1)]',
                'note-red': 'bg-[#ff7e7e] text-white border-[#ee6d6d] shadow-[5px_5px_7px_rgba(33,33,33,.1)]',
                'note-green': 'bg-[#a7ffeb] text-slate-800 border-[#96eee0] shadow-[5px_5px_7px_rgba(33,33,33,.1)]',
            };
            setPendingNote({
                leadId,
                color: colorMap[baseNoteId] || 'bg-[#ffff88] text-slate-800 border-[#eeee77] shadow-[5px_5px_7px_rgba(33,33,33,.1)]'
            });
            return;
        }

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newStage = destination.droppableId as FunnelStage;
        const leadId = draggableId;
        const lead = leads.find(l => l.id === leadId);
        if (!lead) return;

        const additionalUpdates: any = {};
        if (['Offer', 'Contract'].includes(newStage) && !lead.subjectProperty && lead.propertyAddress) {
            additionalUpdates.subjectProperty = lead.propertyAddress;
        }

        const updates: any = { funnelStage: newStage, ...additionalUpdates };
        await handleUpdateLead(leadId, updates);
    };

    const handleAddNote = async (leadId: string, content: string, color: string, type: LeadNote['type'] = 'general') => {
        if (!content.trim()) return;
        const lead = leads.find(l => l.id === leadId);
        if (!lead) return;

        const newNote: LeadNote = {
            id: 'note-' + Date.now(),
            content: content,
            timestamp: new Date(),
            color: color,
            type: type
        };

        const updatedLeadNotes = [newNote, ...(lead.leadNotes || [])];
        const updatedNotesLog = [newNote, ...(lead.notesLog || [])];

        await handleUpdateLead(lead.id, {
            leadNotes: updatedLeadNotes,
            notesLog: updatedNotesLog,
            notes: content
        });
        return newNote.id;
    };

    const handleSaveLeadNote = async (content: string) => {
        if (!pendingNote) return;
        const ctx = pendingNote;
        setPendingNote(null); // Clear immediately to avoid "double note" flicker

        if (content.trim()) {
            await handleAddNote(ctx.leadId, content, ctx.color, 'sticky');
        }
    };

    const handleUpdateLeadNote = async (noteId: string, updates: Partial<LeadNote>) => {
        const lead = leads.find(l => (l.leadNotes || []).some(n => n.id === noteId) || (l.notesLog || []).some(n => n.id === noteId));
        if (!lead) return;
        const updatedLeadNotes = (lead.leadNotes || []).map(n => n.id === noteId ? { ...n, ...updates } : n);
        const updatedNotesLog = (lead.notesLog || []).map(n => n.id === noteId ? { ...n, ...updates } : n);
        await handleUpdateLead(lead.id, { leadNotes: updatedLeadNotes, notesLog: updatedNotesLog });
    };

    const handleDeleteLeadNote = async (noteId: string) => {
        const lead = leads.find(l => (l.leadNotes || []).some(n => n.id === noteId) || (l.notesLog || []).some(n => n.id === noteId));
        if (!lead) return;
        const updatedLeadNotes = (lead.leadNotes || []).filter(n => n.id !== noteId);
        const updatedNotesLog = (lead.notesLog || []).filter(n => n.id !== noteId);
        await handleUpdateLead(lead.id, { leadNotes: updatedLeadNotes, notesLog: updatedNotesLog });
    };

    return {
        handleUpdateLead,
        handleDragEnd,
        handleAddNote,
        handleSaveLeadNote,
        handleUpdateLeadNote,
        handleDeleteLeadNote,
        pendingNote,
        setPendingNote
    };
};
