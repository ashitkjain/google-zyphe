import { CommChannel } from './enums';

export interface CommMessage {
    id: string;
    threadId: string;
    senderId: string;   // Maps to User.uid or Realtor.uid
    receiverId: string; // Maps to User.uid or Realtor.uid
    content: string;
    timestamp: any;
    channel: CommChannel;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    providerId?: string; // e.g. Telnyx Message ID
    recordingUrl?: string; // For call logs/voicemail drops
    attachments?: string[];
    clientId?: string;   // Direct mapping to the consumer
    realtorId?: string;  // Direct mapping to the agent
}

export interface CommThread {
    id: string;
    clientId: string;
    realtorId: string;
    lastMessage?: string;
    lastTimestamp?: any;
    channel: CommChannel;
    unreadCount: number;
}

export interface CommTemplate {
    id: string;
    name: string;
    content: string;
    channel: CommChannel;
    category: 'Follow-up' | 'Introduction' | 'Viewing' | 'Closing';
    isMock?: boolean;
}

export interface MessageEvent {
    event_id: string;      // uuid
    lead_id: string;
    agent_id: string;
    message_id: string;
    channel: 'sms' | 'email' | 'call' | 'mail' | 'whatsapp';
    event_type: 'sent' | 'delivered' | 'failed' | 'reply' | 'opt_out';
    provider: 'twilio' | 'sendgrid' | 'other';
    provider_id?: string;
    timestamp: any;
    isInbound: boolean;    // true if client -> agent
    source: 'system' | 'human' | 'automated';
    raw_payload?: Record<string, any>; // jsonb
}

/**
 * View Model for Reactivation Visualizer & Reports.
 * Mapped from 'messages' collection in communications service.
 */
export interface ReactivationMessage {
    message_id: string;
    lead_id: string;
    lead_name?: string;
    realtorId: string;
    channel: string;
    content: string;
    sent_at: any;
    reply_received: boolean;
    sentiment: string;

    // Conversation threading fields
    isInbound: boolean;           // true = from lead, false/null = from agent
    thread_id?: string;           // Groups messages in a conversation
    parent_message_id?: string;   // References the message being replied to
    requires_action: boolean;     // true if agent needs to respond
    action_completed_at?: any;    // When agent responded
}
