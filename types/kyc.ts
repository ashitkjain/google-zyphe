import { PropertyComp, PriceHistoryItem, ResoFacts, School } from './property';
import { ActivityEvent } from './notes';

export interface ShortlistedProperty {
    id: string;
    address: string;
    price: number;
    isHot?: boolean;
}

export interface DocumentChecklistItem {
    id: string;
    name: string;
    status: 'Signed' | 'Pending' | 'Missing';
}

export interface KYCData {
    // 1. Client Profiles & Preferences
    lenderName?: string;
    birthdays?: string; // Flexible format for now
    homeAnniversary?: string;
    familyPetsDetails?: string;

    // 2. Lead Management
    leadScore?: number;
    nurtureDetail?: 'Cold' | 'Warm' | 'Hot';
    slaMinutesTarget?: number;

    // 3. Transaction Pipeline
    inspectionDeadline?: any;
    appraisalDeadline?: any;
    loanCommitmentDeadline?: any;
    documentChecklist?: DocumentChecklistItem[];

    // 4. Manual Agent Entries
    shortlist?: ShortlistedProperty[];
    activityFeed?: ActivityEvent[];
}
