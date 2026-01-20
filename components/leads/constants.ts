export const availableBuyerColumns = [
    { id: 'status', label: 'Lead Status' },
    { id: 'fullName', label: 'Full Name' },
    { id: 'primaryContact', label: 'Contact Info' }, // Needs object handling in UI
    { id: 'engagementScore', label: 'Engagement' },
    { id: 'lastUpdated', label: 'Last Updated' },
    { id: 'financialVitals', label: 'Buying Power' }, // Object
    { id: 'searchCriteria', label: 'Criteria' }, // Object
    { id: 'leadSource', label: 'Source' }, // Object
    { id: 'leadInfo', label: 'Lead Info' },
    { id: 'motivation', label: 'Motivation' },
    { id: 'targetTimeline', label: 'Timeline' },
    { id: 'personaProfile', label: 'Persona' },
    { id: 'funnelStage', label: 'Pipeline Stage' },

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
    { id: 'leadInfo', label: 'Lead Info' },
    { id: 'funnelStage', label: 'Pipeline Stage' },

    { id: 'personaProfile', label: 'Persona' }
];

export const defaultBuyerVisible = ['status', 'fullName', 'primaryContact', 'engagementScore', 'targetTimeline', 'motivation', 'leadSource', 'leadInfo'];
export const defaultSellerVisible = ['status', 'fullName', 'primaryContact', 'listingStatus', 'targetTimeline', 'motivation', 'leadSource', 'leadInfo'];
