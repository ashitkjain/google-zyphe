import { FunnelStage } from './enums';
import { CRMTask } from './tasks';

export interface JourneyEvent {
    id: string;
    clientId: string;
    fromStage: FunnelStage;
    toStage: FunnelStage;
    timestamp: any;
    reason?: string;
    realtorId: string;
}

export interface Transaction {
    id: string;
    clientId: string;
    address: string;
    price: number;
    status: 'Pre-Listing' | 'Active' | 'Under Contract' | 'Closed' | 'Cancelled';
    commission?: number;
    closeDate?: any;
    checklist: CRMTask[];
}
