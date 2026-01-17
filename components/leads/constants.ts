export const availableBuyerColumns = [
    { id: 'status', label: 'Lead Status' },
    { id: 'phone', label: 'Contact Info' },
    { id: 'callCount', label: 'Call Tracker' },
    { id: 'lastUpdated', label: 'Last Updated On' },
    { id: 'isAlsoSelling', label: 'Also Selling?' },
    { id: 'preQualified', label: 'Pre-qualified?' },
    { id: 'preferredNeighborhood', label: 'Preferred Neighborhood' },
    { id: 'source', label: 'Source' },
    { id: 'receivedAt', label: 'Date Created' },
    { id: 'message', label: 'Message' },
    { id: 'timeframe', label: 'Timeframe' },
    { id: 'leaseEndDate', label: 'Lease End Date' },
    { id: 'tags', label: 'Tags' },
    { id: 'funnelStage', label: 'Pipeline Stage' },
    { id: 'notes', label: 'Call Notes' }
];

export const availableSellerColumns = [
    { id: 'status', label: 'Lead Status' },
    { id: 'phone', label: 'Contact Info' },
    { id: 'isAlsoBuying', label: 'Also Buying?' },
    { id: 'homeValueNeeded', label: 'Home Value Needed?' },
    { id: 'sellWhen', label: 'Sell When?' },
    { id: 'occupancyStatus', label: 'Occupancy Status' },
    { id: 'reasonForSelling', label: 'Reason for Selling' },
    { id: 'existingAgentName', label: 'Existing Agent?' },
    { id: 'source', label: 'Source' },
    { id: 'receivedAt', label: 'Date Created' },
    { id: 'message', label: 'Message' },
    { id: 'tags', label: 'Tags' },
    { id: 'funnelStage', label: 'Pipeline Stage' },
    { id: 'notes', label: 'Agent Notes' }
];

export const defaultBuyerVisible = ['status', 'phone', 'callCount', 'lastUpdated', 'isAlsoSelling', 'preQualified', 'preferredNeighborhood', 'source', 'receivedAt', 'message', 'timeframe', 'notes'];
export const defaultSellerVisible = ['status', 'phone', 'isAlsoBuying', 'homeValueNeeded', 'sellWhen', 'occupancyStatus', 'message', 'timeframe', 'source', 'receivedAt'];

type FunnelStage = 'Leads' | 'Nurture' | 'Active Search' | 'Offer' | 'Contract' | 'Closed';
type ViewMode = 'list' | 'gallery';

export const stageDefaultColumns: Record<
    'Buyer' | 'Seller',
    Record<FunnelStage, Record<ViewMode, string[]>>
> = {
    Buyer: {
        'Leads': {
            list: ['status', 'phone', 'callCount', 'source', 'receivedAt', 'message', 'timeframe', 'lastUpdated', 'isAlsoSelling', 'preQualified', 'notes'],
            gallery: ['status', 'phone', 'callCount', 'source', 'receivedAt', 'message', 'timeframe', 'lastUpdated', 'isAlsoSelling', 'preQualified', 'notes', 'preferredNeighborhood']
        },
        'Nurture': {
            list: ['status', 'phone', 'receivedAt', 'timeframe', 'notes'],
            gallery: ['status', 'phone', 'receivedAt', 'timeframe', 'notes']
        },
        'Active Search': {
            list: ['status', 'phone', 'receivedAt', 'notes'],
            gallery: ['status', 'phone', 'receivedAt', 'notes', 'preferredNeighborhood']
        },
        'Offer': {
            list: ['status', 'phone', 'receivedAt', 'notes'],
            gallery: ['status', 'phone', 'receivedAt', 'notes', 'timeframe']
        },
        'Contract': {
            list: ['status', 'phone', 'receivedAt', 'leaseEndDate', 'notes'],
            gallery: ['status', 'phone', 'receivedAt', 'leaseEndDate', 'notes', 'tags']
        },
        'Closed': {
            list: ['status', 'phone', 'receivedAt', 'source'],
            gallery: ['status', 'phone', 'receivedAt', 'source', 'tags']
        }
    },
    Seller: {
        'Leads': {
            list: ['status', 'phone', 'source', 'receivedAt', 'message', 'timeframe', 'lastUpdated'],
            gallery: ['status', 'phone', 'source', 'receivedAt', 'message', 'timeframe', 'lastUpdated', 'homeValueNeeded']
        },
        'Nurture': {
            list: ['status', 'phone', 'receivedAt', 'sellWhen'],
            gallery: ['status', 'phone', 'receivedAt', 'sellWhen', 'reasonForSelling']
        },
        'Active Search': {
            list: ['status', 'phone', 'receivedAt'],
            gallery: ['status', 'phone', 'receivedAt', 'occupancyStatus']
        },
        'Offer': {
            list: ['status', 'phone', 'receivedAt'],
            gallery: ['status', 'phone', 'receivedAt', 'tags']
        },
        'Contract': {
            list: ['status', 'phone', 'receivedAt', 'notes'],
            gallery: ['status', 'phone', 'receivedAt', 'notes', 'tags']
        },
        'Closed': {
            list: ['status', 'phone', 'receivedAt', 'source'],
            gallery: ['status', 'phone', 'receivedAt', 'source', 'tags']
        }
    }
};
