export const availableBuyerColumns = [
    { id: 'status', label: 'Lead Status' },
    { id: 'fullName', label: 'Full Name' },
    { id: 'primaryContact', label: 'Contact Info' }, // Needs object handling in UI
    { id: 'engagementScore', label: 'Engagement' },
    { id: 'lastUpdated', label: 'Last Updated' },
    { id: 'financialVitals', label: 'Buying Power' }, // Object
    { id: 'searchCriteria', label: 'Criteria' }, // Object
    { id: 'leadSource', label: 'Source' }, // Object
    { id: 'receivedAt', label: 'Date Created' },
    { id: 'motivation', label: 'Motivation' },
    { id: 'targetTimeline', label: 'Timeline' },
    { id: 'personaProfile', label: 'Persona' },
    { id: 'funnelStage', label: 'Pipeline Stage' },
    { id: 'leadStatus', label: 'Lead Stage Status' },
    { id: 'nurtureStatus', label: 'Nurture Stage Status' },
    { id: 'activeSearchStatus', label: 'Search Stage Status' },
    { id: 'offerStatus', label: 'Offer Stage Status' },
    { id: 'closingStatus', label: 'Closing Stage Status' },
    { id: 'nurtureLog', label: 'Log' }
];

export const availableSellerColumns = [
    { id: 'status', label: 'Lead Status' },
    { id: 'fullName', label: 'Full Name' },
    { id: 'primaryContact', label: 'Contact Info' },
    { id: 'listingStatus', label: 'Listing Status' }, // Object
    { id: 'targetTimeline', label: 'Timeline' },
    { id: 'motivation', label: 'Reason for Selling' },
    { id: 'leadSource', label: 'Source' },
    { id: 'receivedAt', label: 'Date Created' },
    { id: 'funnelStage', label: 'Pipeline Stage' },
    { id: 'leadStatus', label: 'Lead Stage Status' },
    { id: 'nurtureStatus', label: 'Nurture Stage Status' },
    { id: 'activeSearchStatus', label: 'Search Stage Status' },
    { id: 'offerStatus', label: 'Offer Stage Status' },
    { id: 'closingStatus', label: 'Closing Stage Status' },
    { id: 'personaProfile', label: 'Persona' }
];

export const defaultBuyerVisible = ['status', 'fullName', 'primaryContact', 'engagementScore', 'targetTimeline', 'motivation', 'leadSource', 'receivedAt'];
export const defaultSellerVisible = ['status', 'fullName', 'primaryContact', 'listingStatus', 'targetTimeline', 'motivation', 'leadSource', 'receivedAt'];

type FunnelStage = 'Leads' | 'Nurture' | 'Active Search' | 'Offer' | 'Contract' | 'Closed';
type ViewMode = 'list' | 'gallery';

// Updated to use new schema keys
export const stageDefaultColumns: Record<
    'Buyer' | 'Seller',
    Record<FunnelStage, Record<ViewMode, string[]>>
> = {
    Buyer: {
        'Leads': {
            list: ['status', 'fullName', 'primaryContact', 'leadSource', 'receivedAt', 'engagementScore', 'lastUpdated'],
            gallery: ['status', 'fullName', 'primaryContact', 'engagementScore', 'leadSource']
        },
        'Nurture': {
            list: ['status', 'fullName', 'targetTimeline', 'motivation', 'personaProfile', 'nurtureLog'],
            gallery: ['status', 'fullName', 'targetTimeline', 'motivation']
        },
        'Active Search': {
            list: ['status', 'fullName', 'searchCriteria', 'financialVitals', 'tourFeedback'],
            gallery: ['status', 'fullName', 'searchCriteria', 'financialVitals']
        },
        'Offer': {
            list: ['status', 'fullName', 'activeOffer', 'transactionTeam'],
            gallery: ['status', 'fullName', 'activeOffer']
        },
        'Contract': {
            list: ['status', 'fullName', 'criticalDates', 'closingStatus', 'transactionTeam'],
            gallery: ['status', 'fullName', 'health', 'closingStatus']
        },
        'Closed': {
            list: ['status', 'fullName', 'receivedAt', 'leadSource'],
            gallery: ['status', 'fullName', 'receivedAt']
        }
    },
    Seller: {
        'Leads': {
            list: ['status', 'fullName', 'primaryContact', 'leadSource', 'receivedAt', 'engagementScore'],
            gallery: ['status', 'fullName', 'primaryContact', 'engagementScore']
        },
        'Nurture': {
            list: ['status', 'fullName', 'targetTimeline', 'motivation', 'personaProfile'],
            gallery: ['status', 'fullName', 'targetTimeline', 'listingStatus']
        },
        'Active Search': {
            list: ['status', 'fullName', 'listingStatus', 'lastUpdated'],
            gallery: ['status', 'fullName', 'listingStatus']
        },
        'Offer': {
            list: ['status', 'fullName', 'activeOffer'],
            gallery: ['status', 'fullName', 'activeOffer']
        },
        'Contract': {
            list: ['status', 'fullName', 'criticalDates', 'closingStatus'],
            gallery: ['status', 'fullName', 'closingStatus']
        },
        'Closed': {
            list: ['status', 'fullName', 'receivedAt', 'leadSource'],
            gallery: ['status', 'fullName', 'leadSource']
        }
    }
};
