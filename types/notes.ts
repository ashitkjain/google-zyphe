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


export interface CallNote {
    callNumber: number; // Which call this note is for (1st, 2nd, 3rd, etc.)
    note: string;
    timestamp: any;
    duration?: number; // Call duration in seconds
    outcome?: 'Connected' | 'Voicemail' | 'No Answer' | 'Busy' | 'Text' | 'Email' | 'Other';
}


