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
