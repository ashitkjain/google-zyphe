export interface ClientPortal {
    id: string;
    agentId: string;
    clientName: string;
    clientEmail: string;
    accessToken: string;
    status: 'active' | 'inactive';
    createdAt: any; // Firestore Timestamp
    updatedAt: any; // Firestore Timestamp
    messageFromAgent?: string;
    isPublic?: boolean;       // true = anyone with the link can view
    publicLabel?: string;     // optional display name for the public link
}

export type PropertyStatus = 'favorite' | 'maybe' | 'rejected' | 'suggested_by_agent' | 'unviewed';

export interface PortalProperty {
    id: string; // usually the zpid
    portalId: string;
    zpid: string;
    address: string;
    status: PropertyStatus;
    addedBy: 'agent' | 'client';
    updatedAt: any; // Firestore Timestamp
    thumbnailUrl?: string;   // first secured image URL from Firebase Storage
    listingUrl?: string;     // link to Zillow or internal listing
    price?: number;
    beds?: number;
    baths?: number;
}

export interface PropertyComment {
    id: string;
    portalId: string;
    zpid: string;
    authorRole: 'agent' | 'client';
    authorName: string;
    text: string;
    timestamp: any; // Firestore Timestamp
}

export interface ActivityLog {
    id: string;
    portalId: string;
    agentId: string;
    action: 'viewed_property' | 'status_changed' | 'commented' | 'portal_viewed';
    details: string;
    zpid?: string;
    timestamp: any; // Firestore Timestamp
}
