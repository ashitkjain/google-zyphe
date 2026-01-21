export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'SKIPPED' | 'Pending' | 'Completed' | 'Rejected';
export type TaskSource = 'TEMPLATE' | 'MANUAL' | 'AUTO_FROM_CONTRACT' | 'OTHER';

export interface CRMTask {
    id: string;
    clientId?: string;
    realtorId: string; // assigned_to_user_id (usually the executing agent)
    transaction_id?: string; // FK -> Transaction
    name: string;
    comment?: string;
    dueDate: any; // due_date
    startDate: any; // start_date
    status: TaskStatus;
    priority: 'Low' | 'Normal' | 'High' | 'Urgent';
    completed_at?: Date | any;
    related_document_id?: string; // FK -> Document
    source?: TaskSource;
    created_at?: Date | any;
    createDate?: Date | any;
    updated_at?: Date | any;
    dependsOn?: string[];
    durationDays?: number;
    categoryId?: string;
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
