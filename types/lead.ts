import { CommChannel, ConnectionType, FunnelStage, LeadHealth, LeadSource, LeadStatus, LeadType } from './enums';
import { CallNote, LeadNote } from './notes';
import { KYCData } from './kyc';

export interface Lead {
    id: string;
    // 1. Contact Information
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    email: string;
    phone: string;
    homeAddress?: string;
    preferredContactMethod?: 'Call' | 'Text' | 'Email';

    // 2. Readiness & Context
    message?: string;
    preApprovalStatus?: boolean;
    timeframe?: string;
    hasHomeToSell?: boolean;
    tourRequestDate?: any;
    tourRequestTime?: string;

    // Lead Context from UI requirements (Buyer & Seller)
    isAlsoBuying?: boolean;
    isAlsoSelling?: boolean;
    gender?: string;
    existingAgentName?: string;
    reasonForSelling?: string;
    homeValueNeeded?: boolean;
    mostImportantToSeller?: string;
    sellWhen?: string;
    occupancyStatus?: string;
    expectedPrice?: number;

    // Buyer specific context
    dealStage?: string;
    leaseEndDate?: any;
    preQualified?: boolean;
    budgetRange?: string;
    preferredNeighborhood?: string;
    dealStatus?: 'Won' | 'Lost' | string;
    isAllCash?: boolean;

    // 3. Property Details (Subject Property)
    propertyAddress?: string;
    zpid?: string;
    price?: number;
    minPrice?: number;
    propertyType?: string;
    bedrooms?: number;
    bathrooms?: number;
    sqft?: number;
    maxPrice?: number;
    callCount?: number;
    callNotes?: CallNote[]; // Notes for specific calls (sparse - not all calls need notes)

    daysOnZillow?: number;
    mlsNumber?: string;
    subjectProperty?: string; // The actual property being transacted (initially populated from propertyAddress)
    offerCount?: number; // Number of offers made (for buyers) or received (for sellers)

    // 4. System Metadata & Source
    source: LeadSource; // e.g. Zillow, Trulia, etc.
    leadType: LeadType;
    connectionType: ConnectionType;
    status: LeadStatus;
    receivedAt: any;
    lastTouch?: any;
    slaUrgency: 'low' | 'medium' | 'high';
    assignedTo?: string;
    channel?: 'Email' | 'API' | 'Manual' | 'CRM' | 'Others';
    lastUpdated?: any;
    tags?: string[];
    notes?: string;
    stageLastChangedAt?: any;
    initialContactIn30Mins?: boolean;
    notesLog?: LeadNote[];
    smsConsent?: boolean;
    smsConsentTimestamp?: any;
    funnelStage: FunnelStage;
    health: LeadHealth;
    isMock?: boolean;
    archivedAt?: any;
    activatedAt?: any;
    closedAt?: any;
    collectionName?: string;
    kyc?: KYCData;
    clientId?: string;
    isHot?: boolean;

    // 5. Additional Status & Persona Flags
    isPastClient?: boolean;
    isEngaged?: boolean;
    isEvaluatingAgent?: boolean;
    isCloseToDeciding?: boolean;
    isCloseToOffer?: boolean;
    isReferredByFriendFamily?: boolean;
    isReferredByPastClient?: boolean;
    isFirstTimeBuyer?: boolean;
    isFirstTimeSeller?: boolean;
    isInvestor?: boolean;
}
