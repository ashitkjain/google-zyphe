import { FunnelStage, LeadHealth } from './enums';
import { StatusOption, PropertyOption } from './shared';
import { KYCData } from './kyc';

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    role: 'buyer' | 'seller' | 'realtor';
    address?: string;
    realtorId?: string;
    phoneNumber?: string;
    assignedTo?: string; // For team scaling
    smsConsent?: boolean;
    smsConsentTimestamp?: any;
    funnelStage?: FunnelStage;
    health?: LeadHealth;
    conversionDate?: any; // Date they moved from Lead to Client
    minPrice?: number;
    maxPrice?: number;
    isMock?: boolean;
    createdAt?: any;
    kyc?: KYCData;
    settings?: {
        leadStatuses?: StatusOption[];
        leadProperties?: PropertyOption[];
        columnSettings?: Record<string, string[]>;
    };
    stickyNotes?: any[]; // Simplified for UserProfile to avoid circular imports if any
    realtorNotes?: any[];
}
