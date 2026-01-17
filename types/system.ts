export interface LogEntry {
    timestamp: string;
    service: string;
    type: 'request' | 'response' | 'error' | 'info';
    content: any;
}
