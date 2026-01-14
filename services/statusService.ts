import { StatusOption } from '../types';

export const DEFAULT_SELLER_STATUSES: StatusOption[] = [
    { label: 'Qualified', description: 'Meets our seller criteria', isDefault: true },
    { label: 'Meeting Fixed', description: 'Property inspection and discussion with the seller', isDefault: true },
    { label: 'Listing Agreement Sent', description: 'Seller needs to e-sign the agreement', isDefault: true },
    { label: 'Listing Agreement Signed', description: "Seller's property will be visible under Homes for Sale and a deal will be created.", isDefault: true },
    { label: 'Does Not Qualify', description: 'Does not meet our seller criteria', isDefault: true },
    { label: 'Did Not Agree To Terms', description: 'Seller is not happy with our terms of engagement; usually our commission', isDefault: true },
    { label: 'Not Selling Anymore', description: 'Seller has put the sale on hold or cancelled it', isDefault: true },
    { label: 'Found A Buyer', description: 'Seller has found a buyer elsewhere or through another agent', isDefault: true },
    { label: 'Not Interested', description: 'Seller is simply not interested; no reason specified', isDefault: true },
];

export const DEFAULT_BUYER_STATUSES: StatusOption[] = [
    { label: 'Qualified', description: 'Meets our buyer criteria', isDefault: true },
    { label: 'Meeting Fixed', description: 'Discussion with the buyer', isDefault: true },
    { label: 'Buyer Broker Agreement Sent', description: 'Buyer needs to e-sign the agreement', isDefault: true },
    { label: 'Buyer Broker Agreement Signed', description: "Buyer's requirement will be visible under Buyer Requirements and a deal will be created.", isDefault: true },
    { label: 'Does Not Qualify', description: 'Does not meet our buyer criteria', isDefault: true },
    { label: 'Did Not Agree To Terms', description: 'Buyer is not happy with our terms of engagement', isDefault: true },
    { label: 'Not Buying Anymore', description: 'Buyer has put the requirement on hold or cancelled it', isDefault: true },
    { label: 'Found A Home', description: 'Buyer has found a home elsewhere or through another agent', isDefault: true },
    { label: 'Not Interested', description: 'Buyer is simply not interested; no reason specified', isDefault: true },
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

export const isNewLeadStatus = (status: string, leadType: 'Buyer' | 'Seller' | string, settings?: any) => {
    const options = getStatusOptions(leadType, settings);
    // Usually the first few statuses are considered "New" or "Inquiry"
    // By default, we'll take the first 3 if they match industry standards
    const newStatuses = options.slice(0, 3).map((o: any) => o.label);
    return newStatuses.includes(status);
};

export const isTerminalStatus = (status: string, leadType: 'Buyer' | 'Seller' | string, settings?: any) => {
    // Typically the last few statuses are terminal
    // We can also check for keywords like 'Closed', 'Won', 'Lost', 'Found'
    const s = status.toLowerCase();
    return s.includes('closed') || s.includes('lost') || s.includes('found');
};
