export interface LeadNote {
    id: string;
    content: string;
    timestamp: any;
    author?: string;
    color?: string;
    isDone?: boolean;
    isUrgent?: boolean;
}

export interface ActivityEvent {
    id: string;
    address: string; // Or "Phone Call", "Office Meeting"
    timestamp: any;
    viewCount?: number;
    type: 'Property View' | 'Meeting' | 'Call' | 'Other';
}

export interface CallNote {
    callNumber: number; // Which call this note is for (1st, 2nd, 3rd, etc.)
    note: string;
    timestamp: any;
    duration?: number; // Call duration in seconds
    outcome?: 'Connected' | 'Voicemail' | 'No Answer' | 'Busy' | 'Text' | 'Email' | 'Other';
}

export interface PipelineNote {
    id: string;
    leadId: string;
    realtorId: string;
    content: string;
    color: string;
    timestamp: any;
    isDone?: boolean;
    isUrgent?: boolean;
}

export interface ActivityNote {
    id: string;
    clientId: string;
    authorId: string;
    content: string;
    timestamp: any;
    type: 'Note' | 'Email' | 'Call' | 'SMS' | 'System';
}
