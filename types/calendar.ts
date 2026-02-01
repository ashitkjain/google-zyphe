export interface CalendarEvent {
    id: string;
    realtorId: string;
    title: string;
    start: any; // Date or Firestore Timestamp
    end: any;   // Date or Firestore Timestamp
    type: 'appointment' | 'open-house' | 'task';
    priority?: 'Urgent' | 'High' | 'Normal' | 'Low';
    client?: string;
    clientId?: string;
    transactionId?: string;
    description?: string;
    isMock?: boolean;
}
