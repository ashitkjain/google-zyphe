import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    sendInviteEmail,
    logMessageEvent,
    saveReactivationMessage,
    getActionRequiredMessages
} from '../services/firebase/communications';
import * as firestore from 'firebase/firestore';

// Mock Firestore
vi.mock('firebase/firestore', () => {
    return {
        collection: vi.fn((db, path) => ({ path, type: 'collection' })),
        doc: vi.fn((db, path, id) => ({ path, id: id || 'mock-msg-id', type: 'doc' })),
        setDoc: vi.fn(() => Promise.resolve()),
        addDoc: vi.fn(() => Promise.resolve({ id: 'new-doc-id' })),
        getDocs: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        orderBy: vi.fn(),
        limit: vi.fn(),
        updateDoc: vi.fn(() => Promise.resolve()),
        serverTimestamp: vi.fn(() => 'mock-timestamp')
    };
});

vi.mock('../services/firebase/config', () => ({
    db: { type: 'db' },
    logFirestoreQuery: vi.fn()
}));

describe('Communications Service Unit Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('sendInviteEmail', () => {
        it('should queue an email in the mail collection', async () => {
            const result = await sendInviteEmail('test@example.com', 'Welcome', '<h1>Hello</h1>');
            expect(firestore.addDoc).toHaveBeenCalledWith(
                expect.objectContaining({ path: 'mail' }),
                expect.objectContaining({
                    to: 'test@example.com',
                    message: { subject: 'Welcome', html: '<h1>Hello</h1>' }
                })
            );
            expect(result.success).toBe(true);
        });
    });

    describe('saveReactivationMessage', () => {
        it('should save a pending outbound message', async () => {
            const mockData = {
                message_id: 'msg123',
                lead_id: 'lead456',
                realtorId: 'agent789',
                content: 'Test content',
                channel: 'sms'
            };

            const result = await saveReactivationMessage(mockData);

            expect(firestore.setDoc).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'msg123' }),
                expect.objectContaining({
                    content: 'Test content',
                    status: 'pending',
                    direction: 'outbound'
                }),
                { merge: true }
            );
            expect(result.success).toBe(true);
        });

        it('should save a received inbound message', async () => {
            const mockData = {
                message_id: 'msg_in',
                lead_id: 'lead456',
                realtorId: 'agent789',
                content: 'Reply from lead',
                isInbound: true
            };

            const result = await saveReactivationMessage(mockData);

            expect(firestore.setDoc).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'msg_in' }),
                expect.objectContaining({
                    status: 'received',
                    direction: 'inbound',
                    requires_action: true
                }),
                { merge: true }
            );
            expect(result.success).toBe(true);
        });
    });

    describe('getActionRequiredMessages', () => {
        it('should query messages for realtor that require action', async () => {
            vi.mocked(firestore.getDocs).mockResolvedValueOnce({
                docs: [{
                    id: 'msg_req',
                    data: () => ({
                        content: 'Need help',
                        receiverId: 'agent789',
                        requires_action: true,
                        timestamp: 'some-time'
                    })
                }]
            } as any);

            const result = await getActionRequiredMessages('agent789');

            expect(result.length).toBe(1);
            expect(result[0].id).toBe('msg_req');
            expect(result[0].isInbound).toBe(true);
        });
    });
});
