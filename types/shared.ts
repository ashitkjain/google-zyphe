export interface StatusOption {
    label: string;
    description: string;
    isDefault?: boolean;
    funnelStage?: string;
    order?: number;
    visibility?: ('Buyer' | 'Seller')[];
    funnelVisibility?: string[];
    type?: 'string' | 'integer' | 'boolean' | 'enum';
    options?: string[];
    isLocked?: boolean;
}

export interface NestedFieldDefinition {
    name: string;
    label?: string;
    type: string;
    description?: string;
    funnelVisibility?: string[];
    options?: string[];
}

export interface PropertyOption {
    id: string; // Maps to the key in Lead object, e.g. 'isPastClient'
    label: string;
    description?: string;
    category: string; // Used for grouping in UI
    visibility?: ('Buyer' | 'Seller')[];
    funnelVisibility?: string[];
    order?: number;
    type?: 'string' | 'integer' | 'boolean' | 'enum' | 'object' | 'list';
    options?: string[]; // For enums
    fields?: (string | NestedFieldDefinition)[]; // For objects/lists
    isLocked?: boolean;
}
