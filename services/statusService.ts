import { StatusOption } from '../types';
import { LEAD_STATUS_CONFIG } from '../types/lead';

export const getStatusOptions = (type: 'Buyer' | 'Seller' | string, settings?: any) => {
    // Read from global system configuration instead of user settings
    return LEAD_STATUS_CONFIG
        .filter(s => s.visibility?.includes(type as any))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

export const getStatusDefinitions = (type: 'Buyer' | 'Seller' | string, settings?: any) => {
    const options = getStatusOptions(type, settings);
    return Object.fromEntries(options.map((o: StatusOption) => [o.label, o.description]));
};

export const getFunnelStageForStatus = (status: string, leadType: 'Buyer' | 'Seller' | string, settings?: any) => {
    const options = getStatusOptions(leadType, settings);
    const option = options.find((o: StatusOption) => o.label === status);

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
