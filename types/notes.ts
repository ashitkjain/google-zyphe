export interface LeadNote {
    id: string;
    content: string;
    timestamp: any;
    author?: string;
    color?: 'yellow' | 'blue' | 'red' | 'green' | string;
    isDone?: boolean;
    isUrgent?: boolean;
    isPinned?: boolean;
    // Spatial positioning (for Sticky Notes)
    x?: number;
    y?: number;
    rotation?: number;
    type?: 'sticky' | 'general' | 'call' | 'inquiry';
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


export interface ActivityNote {
    id: string;
    clientId: string;
    authorId: string;
    content: string;
    timestamp: any;
    type: 'Note' | 'Email' | 'Call' | 'SMS' | 'System';
}
