export const availableBuyerColumns = [
    { id: 'status', label: 'Lead Status' },
    { id: 'phone', label: 'Contact Info' },
    { id: 'callCount', label: 'Call Tracker' },
    { id: 'lastUpdated', label: 'Last Updated On' },
    { id: 'isAlsoSelling', label: 'Also Selling?' },
    { id: 'preQualified', label: 'Pre-qualified?' },
    { id: 'budgetRange', label: 'Budget Range' },
    { id: 'preferredNeighborhood', label: 'Preferred Neighborhood' },
    { id: 'source', label: 'Source' },
    { id: 'receivedAt', label: 'Date Created' },
    { id: 'lastTouch', label: 'Last Follow Up' },
    { id: 'message', label: 'Message' },
    { id: 'timeframe', label: 'Timeframe' },
    { id: 'leaseEndDate', label: 'Lease End Date' },
    { id: 'propertyAddress', label: 'Inquired Property' },
    { id: 'tags', label: 'Tags' },
    { id: 'funnelStage', label: 'Pipeline Stage' },
    { id: 'notes', label: 'Call Notes' }
];

export const availableSellerColumns = [
    { id: 'status', label: 'Lead Status' },
    { id: 'phone', label: 'Contact Info' },
    { id: 'isAlsoBuying', label: 'Also Buying?' },
    { id: 'homeValueNeeded', label: 'Home Value Needed?' },
    { id: 'mostImportantToSeller', label: 'Most Important to Seller' },
    { id: 'sellWhen', label: 'Sell When?' },
    { id: 'propertyType', label: 'Property Type' },
    { id: 'occupancyStatus', label: 'Occupancy Status' },
    { id: 'expectedPrice', label: 'Expected Price' },
    { id: 'propertyAddress', label: 'Property Address' },
    { id: 'reasonForSelling', label: 'Reason for Selling' },
    { id: 'existingAgentName', label: 'Existing Agent?' },
    { id: 'source', label: 'Source' },
    { id: 'receivedAt', label: 'Date Created' },
    { id: 'lastTouch', label: 'Last Follow Up' },
    { id: 'message', label: 'Message' },
    { id: 'tags', label: 'Tags' },
    { id: 'funnelStage', label: 'Pipeline Stage' },
    { id: 'notes', label: 'Agent Notes' }
];

export const defaultBuyerVisible = ['status', 'phone', 'callCount', 'lastUpdated', 'isAlsoSelling', 'preQualified', 'budgetRange', 'preferredNeighborhood', 'source', 'receivedAt', 'notes'];
export const defaultSellerVisible = ['status', 'phone', 'isAlsoBuying', 'homeValueNeeded', 'mostImportantToSeller', 'sellWhen', 'propertyType', 'occupancyStatus', 'expectedPrice', 'propertyAddress', 'source', 'receivedAt'];

type FunnelStage = 'Leads' | 'Nurture' | 'Active Search' | 'Offer' | 'Contract' | 'Closed';
type ViewMode = 'list' | 'gallery';

export const stageDefaultColumns: Record<
    'Buyer' | 'Seller',
    Record<FunnelStage, Record<ViewMode, string[]>>
> = {
    Buyer: {
        'Leads': {
            list: ['status', 'phone', 'callCount', 'source', 'receivedAt', 'lastUpdated', 'isAlsoSelling', 'preQualified', 'message', 'propertyAddress', 'timeframe', 'notes'],
            gallery: ['status', 'phone', 'callCount', 'source', 'receivedAt', 'lastUpdated', 'isAlsoSelling', 'preQualified', 'message', 'propertyAddress', 'timeframe', 'notes', 'budgetRange', 'preferredNeighborhood']
        },
        'Nurture': {
            list: ['status', 'phone', 'receivedAt', 'lastTouch', 'timeframe', 'notes'],
            gallery: ['status', 'phone', 'receivedAt', 'lastTouch', 'timeframe', 'notes', 'budgetRange']
        },
        'Active Search': {
            list: ['status', 'phone', 'receivedAt', 'propertyAddress', 'budgetRange', 'lastTouch', 'notes'],
            gallery: ['status', 'phone', 'receivedAt', 'propertyAddress', 'budgetRange', 'lastTouch', 'notes', 'preferredNeighborhood']
        },
        'Offer': {
            list: ['status', 'phone', 'receivedAt', 'propertyAddress', 'budgetRange', 'notes'],
            gallery: ['status', 'phone', 'receivedAt', 'propertyAddress', 'budgetRange', 'notes', 'timeframe']
        },
        'Contract': {
            list: ['status', 'phone', 'receivedAt', 'propertyAddress', 'leaseEndDate', 'notes'],
            gallery: ['status', 'phone', 'receivedAt', 'propertyAddress', 'leaseEndDate', 'notes', 'tags']
        },
        'Closed': {
            list: ['status', 'phone', 'receivedAt', 'propertyAddress', 'source'],
            gallery: ['status', 'phone', 'receivedAt', 'propertyAddress', 'source', 'tags']
        }
    },
    Seller: {
        'Leads': {
            list: ['status', 'phone', 'source', 'receivedAt', 'lastUpdated', 'message', 'propertyAddress', 'timeframe'],
            gallery: ['status', 'phone', 'source', 'receivedAt', 'lastUpdated', 'message', 'propertyAddress', 'timeframe', 'homeValueNeeded']
        },
        'Nurture': {
            list: ['status', 'phone', 'receivedAt', 'lastTouch', 'sellWhen', 'propertyAddress'],
            gallery: ['status', 'phone', 'receivedAt', 'lastTouch', 'sellWhen', 'propertyAddress', 'reasonForSelling']
        },
        'Active Search': {
            list: ['status', 'phone', 'receivedAt', 'expectedPrice', 'propertyAddress', 'propertyType'],
            gallery: ['status', 'phone', 'receivedAt', 'expectedPrice', 'propertyAddress', 'propertyType', 'occupancyStatus']
        },
        'Offer': {
            list: ['status', 'phone', 'receivedAt', 'expectedPrice', 'propertyAddress', 'mostImportantToSeller'],
            gallery: ['status', 'phone', 'receivedAt', 'expectedPrice', 'propertyAddress', 'mostImportantToSeller', 'tags']
        },
        'Contract': {
            list: ['status', 'phone', 'receivedAt', 'propertyAddress', 'expectedPrice', 'notes'],
            gallery: ['status', 'phone', 'receivedAt', 'propertyAddress', 'expectedPrice', 'notes', 'tags']
        },
        'Closed': {
            list: ['status', 'phone', 'receivedAt', 'propertyAddress', 'source'],
            gallery: ['status', 'phone', 'receivedAt', 'propertyAddress', 'source', 'tags']
        }
    }
};
