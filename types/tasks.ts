export interface CRMTask {
    id: string;
    clientId?: string;
    realtorId: string;
    title: string;
    description?: string;
    dueDate: any;
    status: 'Pending' | 'Completed';
    priority: 'Low' | 'Normal' | 'High' | 'Urgent';
    type: 'Call' | 'Email' | 'Showing' | 'Follow-up' | 'Closing';
    isMock?: boolean;
}

export type ReminderRuleCategory = 'lead' | 'buyer' | 'seller' | 'relationship';
export type ReminderRuleUrgency = 'high' | 'medium' | 'low';
export type ReminderRuleOperator = '>' | '<' | '=' | '>=' | '<=' | 'exists' | 'not_exists' | 'contains';

export interface ReminderRule {
    id: string;
    name: string;

    // Human-readable display (shown in UI)
    trigger: string;
    condition: string;

    // Executable mappings (for backend processing)
    triggerField?: string; // e.g., 'leads.receivedAt', 'leads.offerAcceptedAt'
    conditionField?: string; // e.g., 'leads.lastTouch', 'leads.tourBookedAt'
    operator?: ReminderRuleOperator; // e.g., '>', '<', '=', 'exists'
    value?: string | number; // e.g., '5 minutes', '24 hours', 2
    comparisonField?: string; // For comparing two fields, e.g., 'NOW()' or 'leads.updatedAt'

    urgency: ReminderRuleUrgency;
    category: ReminderRuleCategory;
    suggested_action: string;
    suggested_message: string;
    enabled: boolean;
    realtorId: string;
    isExecutable?: boolean;
}
