import { PropertyData } from './property';
import { CRMTask } from './tasks';

export type TransactionType = 'BUY' | 'SELL' | 'LEASE' | 'OTHER';

export type TransactionStatus =
    | 'DRAFT'
    | 'ACTIVE'
    | 'PENDING_SIGNATURES'
    | 'UNDER_CONTRACT'
    | 'CLOSED'
    | 'CANCELLED';

export interface Transaction {
    id: string; // UUID
    owner_user_id: string; // FK -> User
    type: TransactionType;
    status: TransactionStatus;
    property: PropertyData; // Address or simple string property identifier
    apn: string;
    state: string;
    mls_number?: string;
    purchase_price?: number;
    close_of_escrow_date?: Date | any; // allow for Timestamp from Firebase
    commission?: string;
    important_dates: {
        acceptance_date?: Date | any;
        contingency_removal_date?: Date | any;
        [key: string]: any;
    };
    checklist: CRMTask[];
    created_at: Date | any;
    updated_at: Date | any;
    closed_at?: Date | any;
}

export type TransactionRole =
    | 'BUYER'
    | 'SELLER'
    | 'AGENT'
    | 'CO_AGENT'
    | 'ESCROW'
    | 'TITLE'
    | 'LENDER'
    | 'TC' // Transaction Coordinator
    | 'OTHER';

export interface TransactionParty {
    id: string;
    transaction_id: string; // FK -> Transaction
    role: TransactionRole;
    display_name: string;
    email: string;
    phone?: string;
    address?: string;
    signing_required: boolean;
    signer_order?: number;
    created_at: Date | any;
}

export type DocumentType = 'RPA' | 'TDS' | 'AVID' | 'SPQ' | 'ADDENDUM' | 'OTHER';
export type DocumentCategory = 'CONTRACT' | 'DISCLOSURE' | 'INSPECTION' | 'ESCROW' | 'MARKETING' | 'OTHER';
export type DocumentStatus = 'DRAFT' | 'SENT_FOR_SIGNATURE' | 'SIGNED' | 'VOIDED';

export interface Document {
    id: string;
    transaction_id: string; // FK -> Transaction
    doc_type: DocumentType | string;
    title: string; // human name
    category: DocumentCategory;
    current_version_id: string; // FK -> DocumentVersion
    status: DocumentStatus;
    tags: string[];
    created_by_user_id: string;
    created_at: Date | any;
    updated_at: Date | any;
}

export type DocumentSource = 'UPLOAD' | 'MERGE' | 'ESIGN_FINAL' | 'OCR_CONVERT' | 'OTHER';

export interface DocumentVersion {
    id: string;
    document_id: string; // FK -> Document
    version_number: number;
    storage_uri: string; // S3/GCS key
    filename_original: string;
    content_type: string; // application/pdf
    size_bytes: number;
    sha256?: string; // integrity check
    created_by_user_id: string;
    created_at: Date | any;
    source: DocumentSource;
    notes?: string;
}

export type SignatureProvider = 'DOCUSIGN' | 'DROPBOX_SIGN' | 'OTHER';

export type EnvelopeStatus =
    | 'DRAFT'
    | 'SENT'
    | 'DELIVERED'
    | 'VIEWED'
    | 'SIGNED'
    | 'COMPLETED'
    | 'DECLINED'
    | 'VOIDED'
    | 'EXPIRED';

export interface EnvelopeRecipient {
    name: string;
    email: string;
    role: string;
    order?: number;
}

export interface SignatureEnvelope {
    id: string;
    transaction_id: string; // FK -> Transaction
    provider: SignatureProvider;
    provider_envelope_id: string;
    status: EnvelopeStatus;
    subject: string;
    message: string;
    created_by_user_id: string;
    sent_at?: Date | any;
    completed_at?: Date | any;
    voided_at?: Date | any;
    document_version_ids: string[]; // List of version IDs included
    recipients: EnvelopeRecipient[]; // List of recipients
    final_signed_version_id?: string; // FK -> DocumentVersion
    created_at: Date | any;
    updated_at: Date | any;
}

export type SignatureEventType =
    | 'SENT'
    | 'DELIVERED'
    | 'VIEWED'
    | 'SIGNED'
    | 'DECLINED'
    | 'COMPLETED'
    | 'VOIDED'
    | 'OTHER';

export interface SignatureEvent {
    id: string;
    signature_envelope_id: string; // FK -> SignatureEnvelope
    event_type: SignatureEventType;
    occurred_at: Date | any; // provider timestamp
    received_at: Date | any; // your timestamp
    actor_email?: string;
    payload: any; // JSON raw provider webhook payload
    idempotency_key: string; // provider event id to dedupe
}

export type AuditActorType = 'USER' | 'SYSTEM' | 'EXTERNAL_RECIPIENT';

export type AuditAction =
    | 'TRANSACTION_CREATED'
    | 'PARTY_ADDED'
    | 'DOCUMENT_UPLOADED'
    | 'DOCUMENT_VERSION_CREATED'
    | 'ENVELOPE_SENT'
    | 'ENVELOPE_COMPLETED'
    | 'TASK_COMPLETED'
    | 'DOCUMENT_DOWNLOADED'
    | string; // Allow extensible actions

export type AuditEntityType =
    | 'Transaction'
    | 'Document'
    | 'DocumentVersion'
    | 'Task'
    | 'SignatureEnvelope'
    | 'SignatureEvent'
    | string;

export interface AuditEvent {
    id: string;
    transaction_id?: string; // FK -> Transaction, nullable if global
    actor_user_id?: string; // nullable for external events
    actor_type: AuditActorType;
    action: AuditAction;
    entity_type: AuditEntityType;
    entity_id: string;
    ip_address?: string;
    user_agent?: string;
    occurred_at: Date | any;
    diff?: {
        before?: any;
        after?: any;
        summary?: string;
    };
}
