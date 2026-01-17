export interface StatusOption {
    label: string;
    description: string;
    isDefault?: boolean;
    funnelStage?: string;
    order?: number;
    visibility?: ('Buyer' | 'Seller')[];
}

export interface PropertyOption {
    id: string; // Maps to the key in Lead object, e.g. 'isPastClient'
    label: string;
    description: string;
    category: string; // Used for grouping in UI
    visibility?: ('Buyer' | 'Seller')[];
    order?: number;
}
