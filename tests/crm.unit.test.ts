import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateFunnelStage } from '../services/firebase/crm';
import * as firestore from 'firebase/firestore';
import * as transactions from '../services/firebase/transactions';

// Mock Firestore
vi.mock('firebase/firestore', () => {
    return {
        collection: vi.fn((...args) => ({ path: args[args.length - 1], type: 'collection' })),
        doc: vi.fn((...args) => {
            const segs = args.slice(1);
            return { path: segs.length >= 2 ? segs[segs.length - 2] : segs[0], id: segs[segs.length - 1], type: 'doc' };
        }),
        setDoc: vi.fn(() => Promise.resolve()),
        addDoc: vi.fn(() => Promise.resolve({ id: 'new-event-id' })),
        getDoc: vi.fn(),
        getDocs: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        orderBy: vi.fn(),
        limit: vi.fn(),
        serverTimestamp: vi.fn(() => 'mock-timestamp'),
        updateDoc: vi.fn(() => Promise.resolve()),
        deleteDoc: vi.fn(() => Promise.resolve()),
        writeBatch: vi.fn(() => ({
            set: vi.fn(),
            commit: vi.fn(() => Promise.resolve()),
            delete: vi.fn()
        }))
    };
});

// Mock Dependencies
vi.mock('../services/firebase/config', () => ({
    db: { type: 'db' },
    auth: { currentUser: { uid: 'realtor123' } },
    handleFirestoreError: vi.fn(),
    logFirestoreQuery: vi.fn()
}));

vi.mock('../services/firebase/transactions', () => ({
    createTransaction: vi.fn(() => Promise.resolve()),
    getTransactionByClientId: vi.fn(),
    deleteTransaction: vi.fn(() => Promise.resolve())
}));

vi.mock('../services/transactionService', () => ({
    getInitialCategories: vi.fn(() => [])
}));

vi.mock('../services/firebase/audit', () => ({
    logAuditEvent: vi.fn()
}));

describe('CRM Service Unit Tests - Funnel Stages', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('updateFunnelStage', () => {
        it('should update stage and record history', async () => {
            const mockDocData = {
                funnelStage: 'Inquiry',
                stageHistory: [
                    { fromStage: null, toStage: 'Inquiry', enteredAt: new Date(Date.now() - 10000) }
                ]
            };

            vi.mocked(firestore.getDoc).mockResolvedValueOnce({
                exists: () => true,
                data: () => mockDocData
            } as any);

            const result = await updateFunnelStage('client123', 'Offer');

            expect(firestore.setDoc).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'client123' }),
                expect.objectContaining({
                    funnelStage: 'Offer',
                    stageHistory: expect.arrayContaining([
                        expect.objectContaining({ fromStage: 'Inquiry', toStage: 'Offer' })
                    ])
                }),
                { merge: true }
            );
            expect(firestore.addDoc).toHaveBeenCalledWith(
                expect.objectContaining({ path: 'journey_events' }),
                expect.objectContaining({ clientId: 'client123', fromStage: 'Inquiry', toStage: 'Offer' })
            );
            expect(result).toBe(true);
        });

        it('should auto-create transaction when moving to Contract', async () => {
            vi.mocked(firestore.getDoc).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ funnelStage: 'Offer', realtorId: 'realtor123' })
            } as any);

            // Mock no existing transaction
            vi.mocked(transactions.getTransactionByClientId).mockResolvedValueOnce(null);

            await updateFunnelStage('client123', 'Contract');

            expect(transactions.createTransaction).toHaveBeenCalled();
        });

        it('should auto-delete transaction when rolling back from Contract', async () => {
            vi.mocked(firestore.getDoc).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ funnelStage: 'Contract', realtorId: 'realtor123' })
            } as any);

            // Mock existing transaction
            vi.mocked(transactions.getTransactionByClientId).mockResolvedValueOnce({ id: 'tx123' } as any);

            await updateFunnelStage('client123', 'Active Search');

            expect(transactions.deleteTransaction).toHaveBeenCalledWith('tx123');
        });

        it('should return false if document does not exist', async () => {
            vi.mocked(firestore.getDoc).mockResolvedValueOnce({
                exists: () => false
            } as any);

            const result = await updateFunnelStage('missing', 'Offer');
            expect(result).toBe(false);
        });
    });
});
