import { Timestamp } from 'firebase/firestore';

export type StickyNoteColor = 'yellow' | 'blue' | 'rose' | 'emerald' | 'violet' | 'amber';

export interface UserPropertyComment {
    id: string;
    comment: string;
    userId: string;
    zpid: string;
    tab: string;
    color: StickyNoteColor;
    location: {
        x: number;
        y: number;
    };
    createdAt: Timestamp | any;
    lastUpdated: Timestamp | any;
}
