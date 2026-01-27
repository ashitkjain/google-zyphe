import { FunnelStage, LeadHealth } from './enums';
import { StatusOption, PropertyOption } from './shared';

export interface RealtorNode {
    photoURL?: string;
    bio?: string;
    licenseNumber?: string;
    brokerage?: string;
    yearsExperience?: number;
    specialties?: string[];
    languages?: string[];
    awards?: string[];
    website?: string;
    socialLinks?: {
        linkedin?: string;
        facebook?: string;
        instagram?: string;
        twitter?: string;
    };
    serviceAreas?: string[];
}

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
    settings?: {
        // leadStatuses?: StatusOption[]; // Deprecated: Moved to LEAD_STATUS_CONFIG in lead.ts
        // leadProperties?: PropertyOption[]; // Deprecated: Pulls from LEAD_FIELD_CONFIG
        // columnSettings?: Record<string, string[]>; // Deprecated: Currently unused
    };
    stickyNotes?: any[]; // Simplified for UserProfile to avoid circular imports if any
    realtorNotes?: any[];
    // Professional Realtor Data
    realtor?: RealtorNode;
}

