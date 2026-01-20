export interface CalendarEvent {
    id: string;
    realtorId: string;
    title: string;
    start: any; // Date or Firestore Timestamp
    end: any;   // Date or Firestore Timestamp
    type: 'appointment' | 'open-house' | 'task';
    client?: string;
    clientId?: string;
    description?: string;
    isMock?: boolean;
}
