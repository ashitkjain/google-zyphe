import { StatusOption } from '../types';
// Updated status definitions with Cold/Warm/Long Term

export const DEFAULT_STATUSES: StatusOption[] = [
    // Leads
    { label: 'New', description: 'Fresh inquiry from lead source', isDefault: true, funnelStage: 'Leads', order: 0, visibility: ['Buyer', 'Seller'] },
    { label: 'Qualified', description: 'Meets our criteria', isDefault: true, funnelStage: 'Leads', order: 1, visibility: ['Buyer', 'Seller'] },
    { label: 'Attempted to Contact', description: 'Attempted to contact the client', isDefault: false, funnelStage: 'Leads', order: 2, visibility: ['Buyer', 'Seller'] },

    // Nurture
    { label: 'Meeting Fixed', description: 'Discussion/consultation scheduled', isDefault: true, funnelStage: 'Nurture', order: 6, visibility: ['Buyer', 'Seller'] },
    { label: 'Broker Agreement Sent', description: 'Service agreement sent to client', isDefault: true, funnelStage: 'Nurture', order: 7, visibility: ['Buyer', 'Seller'] },

    // Active Search (Buyer) / Active (Seller)
    { label: 'Broker Agreement Signed', description: 'Service agreement signed', isDefault: true, funnelStage: 'Active Search', order: 8, visibility: ['Buyer', 'Seller'] },
    { label: 'Actively Searching', description: 'Currently looking for properties', isDefault: true, funnelStage: 'Active Search', order: 9, visibility: ['Buyer'] },
    { label: 'Showing', description: 'Property is being shown to potential buyers', isDefault: true, funnelStage: 'Active Search', order: 9, visibility: ['Seller'] },

    // Offer
    { label: 'Offer', description: 'Offer in progress', isDefault: true, funnelStage: 'Offer', order: 10, visibility: ['Buyer', 'Seller'] },

    // Contract
    { label: 'In Contract', description: 'Property under contract/in escrow', isDefault: true, funnelStage: 'Contract', order: 11, visibility: ['Buyer', 'Seller'] },

    // Closed
    { label: 'Closed-Won', description: 'Deal closed successfully', isDefault: true, funnelStage: 'Closed', order: 12, visibility: ['Buyer', 'Seller'] },
    { label: 'Closed-Lost', description: 'Deal was lost/process ended', isDefault: true, funnelStage: 'Closed', order: 13, visibility: ['Buyer', 'Seller'] },

    // Closed (Lost Reasons)
    { label: 'Does Not Qualify', description: 'Does not meet criteria', isDefault: true, funnelStage: 'Closed', order: 14, visibility: ['Buyer', 'Seller'] },
    { label: 'Did Not Agree To Terms', description: 'Client not happy with terms', isDefault: true, funnelStage: 'Closed', order: 15, visibility: ['Buyer', 'Seller'] },
    { label: 'Not Buying Anymore', description: 'Buyer has put requirement on hold', isDefault: true, funnelStage: 'Closed', order: 16, visibility: ['Buyer'] },
    { label: 'Not Selling Anymore', description: 'Seller has put sale on hold', isDefault: true, funnelStage: 'Closed', order: 16, visibility: ['Seller'] },
    { label: 'Found A Home', description: 'Found home elsewhere', isDefault: true, funnelStage: 'Closed', order: 17, visibility: ['Buyer'] },
    { label: 'Found A Buyer', description: 'Found buyer elsewhere', isDefault: true, funnelStage: 'Closed', order: 17, visibility: ['Seller'] },
    { label: 'Not Interested', description: 'Client not interested', isDefault: true, funnelStage: 'Closed', order: 18, visibility: ['Buyer', 'Seller'] },

    // Archived
    { label: 'Archived', description: 'Lead archived for record keeping', isDefault: true, funnelStage: 'Archived', order: 19, visibility: ['Buyer', 'Seller'] },
];

export const getStatusOptions = (type: 'Buyer' | 'Seller' | string, settings?: any) => {
    // New Logic: Source is a single array (settings.leadStatuses or DEFAULT_STATUSES)
    // We filter this array based on visibility.
    // Ensure we have an array to work with (handles legacy object structure case gracefully by falling back to defaults)
    const allStatuses: StatusOption[] = Array.isArray(settings?.leadStatuses)
        ? settings.leadStatuses
        : DEFAULT_STATUSES;

    return allStatuses
        .filter(s => s.visibility?.includes(type as any))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

export const getStatusDefinitions = (type: 'Buyer' | 'Seller' | string, settings?: any) => {
    const options = getStatusOptions(type, settings);
    return Object.fromEntries(options.map((o: StatusOption) => [o.label, o.description]));
};

export const getFunnelStageForStatus = (status: string, leadType: 'Buyer' | 'Seller' | string, settings?: any) => {
    const options = getStatusOptions(leadType, settings);
    let option = options.find((o: StatusOption) => o.label === status);

    // Legacy fallback handled by checking DEFAULT_STATUSES generically
    if (!option) {
        option = DEFAULT_STATUSES.find(o => o.label === status && o.visibility?.includes(leadType as any));
    }

    return option?.funnelStage || 'Leads';
};

export const isNewLeadStatus = (status: string, leadType: 'Buyer' | 'Seller' | string, settings?: any) => {
    const stage = getFunnelStageForStatus(status, leadType, settings);
    return stage === 'Leads';
};

export const isTerminalStatus = (status: string, leadType: 'Buyer' | 'Seller' | string, settings?: any) => {
    const stage = getFunnelStageForStatus(status, leadType, settings);
    return stage === 'Closed';
};
