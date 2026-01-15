import { StatusOption } from '../types';

export const DEFAULT_SELLER_STATUSES: StatusOption[] = [
    { label: 'New', description: 'Fresh inquiry from lead source', isDefault: true, funnelStage: 'Leads' },
    { label: 'Qualified', description: 'Meets our seller criteria', isDefault: true, funnelStage: 'Leads' },
    { label: 'Meeting Fixed', description: 'Property inspection and discussion with the seller', isDefault: true, funnelStage: 'Nurture' },
    { label: 'Broker Agreement Sent', description: 'Listing agreement sent to seller', isDefault: true, funnelStage: 'Nurture' },
    { label: 'Broker Agreement Signed', description: 'Listing agreement signed', isDefault: true, funnelStage: 'Active Search' },
    { label: 'Showing', description: 'Property is being shown to potential buyers', isDefault: true, funnelStage: 'Active Search' },
    { label: 'In Contract', description: 'Property is under contract', isDefault: true, funnelStage: 'Contract' },
    { label: 'Closed-Won', description: 'Deal closed successfully', isDefault: true, funnelStage: 'Closed' },
    { label: 'Closed-Lost', description: 'Deal was lost', isDefault: true, funnelStage: 'Closed' },

    { label: 'Does Not Qualify', description: 'Does not meet our seller criteria', isDefault: true, funnelStage: 'Closed' },
    { label: 'Did Not Agree To Terms', description: 'Seller is not happy with our terms of engagement', isDefault: true, funnelStage: 'Closed' },
    { label: 'Not Selling Anymore', description: 'Seller has put the sale on hold or cancelled it', isDefault: true, funnelStage: 'Closed' },
    { label: 'Found A Buyer', description: 'Seller has found a buyer elsewhere or through another agent', isDefault: true, funnelStage: 'Closed' },
    { label: 'Not Interested', description: 'Seller is simply not interested', isDefault: true, funnelStage: 'Closed' },
];

export const DEFAULT_BUYER_STATUSES: StatusOption[] = [
    { label: 'New', description: 'Fresh inquiry from lead source', isDefault: true, funnelStage: 'Leads' },
    { label: 'Qualified', description: 'Meets our buyer criteria', isDefault: true, funnelStage: 'Leads' },
    { label: 'Meeting Fixed', description: 'Discussion with the buyer', isDefault: true, funnelStage: 'Nurture' },
    { label: 'Broker Agreement Sent', description: 'Buyer needs to e-sign the agreement', isDefault: true, funnelStage: 'Nurture' },
    { label: 'Broker Agreement Signed', description: 'Buyer has signed the agreement', isDefault: true, funnelStage: 'Active Search' },
    { label: 'Actively Searching', description: 'Currently looking for properties', isDefault: true, funnelStage: 'Active Search' },
    { label: 'In Contract', description: 'Offer accepted, property in escrow', isDefault: true, funnelStage: 'Contract' },
    { label: 'Closed-Won', description: 'Successfully purchased a home', isDefault: true, funnelStage: 'Closed' },
    { label: 'Closed-Lost', description: 'Process ended without a purchase', isDefault: true, funnelStage: 'Closed' },

    { label: 'Does Not Qualify', description: 'Does not meet our buyer criteria', isDefault: true, funnelStage: 'Closed' },
    { label: 'Did Not Agree To Terms', description: 'Buyer is not happy with our terms of engagement', isDefault: true, funnelStage: 'Closed' },
    { label: 'Not Buying Anymore', description: 'Buyer has put the requirement on hold or cancelled it', isDefault: true, funnelStage: 'Closed' },
    { label: 'Found A Home', description: 'Buyer has found a home elsewhere or through another agent', isDefault: true, funnelStage: 'Closed' },
    { label: 'Not Interested', description: 'Buyer is simply not interested', isDefault: true, funnelStage: 'Closed' },
];

export const getStatusOptions = (type: 'Buyer' | 'Seller' | string, settings?: any) => {
    if (type === 'Seller') {
        return settings?.leadStatuses?.seller || DEFAULT_SELLER_STATUSES;
    }
    return settings?.leadStatuses?.buyer || DEFAULT_BUYER_STATUSES;
};

export const getStatusDefinitions = (type: 'Buyer' | 'Seller' | string, settings?: any) => {
    const options = getStatusOptions(type, settings);
    return Object.fromEntries(options.map((o: StatusOption) => [o.label, o.description]));
};

export const getFunnelStageForStatus = (status: string, leadType: 'Buyer' | 'Seller' | string, settings?: any) => {
    const options = getStatusOptions(leadType, settings);
    const option = options.find((o: StatusOption) => o.label === status);
    return option?.funnelStage || 'Leads'; // Default to Leads if not found
};

export const isNewLeadStatus = (status: string, leadType: 'Buyer' | 'Seller' | string, settings?: any) => {
    const stage = getFunnelStageForStatus(status, leadType, settings);
    return stage === 'Leads';
};

export const isTerminalStatus = (status: string, leadType: 'Buyer' | 'Seller' | string, settings?: any) => {
    const stage = getFunnelStageForStatus(status, leadType, settings);
    return stage === 'Closed';
};
