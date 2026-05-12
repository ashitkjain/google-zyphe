import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTransaction, syncTransactionToCalendar, deleteTransaction } from '../services/firebase/transactions';
import * as firestore from 'firebase/firestore';

// Mock Firestore
const mockBatch = {
    set: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
    delete: vi.fn()
};

vi.mock('firebase/firestore', () => {
    return {
        collection: vi.fn((...args) => ({ path: args[args.length - 1], type: 'collection' })),
        doc: vi.fn((...args) => {
            const segs = args.slice(1);
            return { path: segs.length >= 2 ? segs[segs.length - 2] : segs[0], id: segs[segs.length - 1] || 'mock-id', type: 'doc' };
        }),
        setDoc: vi.fn(() => Promise.resolve()),
        getDocs: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        writeBatch: vi.fn(() => mockBatch),
        serverTimestamp: vi.fn(() => 'mock-timestamp')
    };
});

vi.mock('../services/firebase/config', () => ({
    db: { type: 'db' },
    auth: { currentUser: { uid: 'realtor123' } },
    sanitizeForFirestore: vi.fn((x) => x),
    logFirestoreQuery: vi.fn(),
    handleFirestoreError: vi.fn()
}));

vi.mock('../services/firebase/parties', () => ({
    seedPartiesForTransaction: vi.fn()
}));

vi.mock('../services/firebase/documents', () => ({
    seedDocumentsForTransaction: vi.fn()
}));

vi.mock('../services/firebase/audit', () => ({
    logAuditEvent: vi.fn()
}));

describe('Calendar Sync Unit Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockBatch.set.mockClear();
        mockBatch.commit.mockClear();
        mockBatch.delete.mockClear();
    });

    describe('syncTransactionToCalendar', () => {
        it('should sync milestones to calendar', () => {
            const transaction = {
                id: 'tx123',
                realtorId: 'agent1',
                property: { address: '123 Main St' },
                important_dates: { acceptance_date: '2023-01-01' },
                close_of_escrow_date: '2023-02-01'
            } as any;

            syncTransactionToCalendar(mockBatch as any, transaction, []);

            expect(mockBatch.set).toHaveBeenCalledWith(
                expect.objectContaining({ path: 'calendar_events', id: 'milestone_tx123_Acceptance' }),
                expect.objectContaining({ title: 'Acceptance: 123 Main St', start: '2023-01-01' }),
                { merge: true }
            );
            expect(mockBatch.set).toHaveBeenCalledWith(
                expect.objectContaining({ path: 'calendar_events', id: 'milestone_tx123_Close_of_Escrow' }),
                expect.objectContaining({ title: 'Close of Escrow: 123 Main St', start: '2023-02-01' }),
                { merge: true }
            );
        });

        it('should sync key tasks to calendar', () => {
            const transaction = {
                id: 'tx123',
                realtorId: 'agent1',
                property: { address: '123 Main St' }
            } as any;

            const checklist = [
                {
                    tasks: [
                        { id: 't1', name: 'Home Inspection', dueDate: '2023-01-05' },
                        { id: 't2', name: 'Regular Task', dueDate: '2023-01-06' }
                    ]
                }
            ] as any;

            syncTransactionToCalendar(mockBatch as any, transaction, checklist);

            expect(mockBatch.set).toHaveBeenCalledWith(
                expect.objectContaining({ path: 'calendar_events', id: 'task_t1' }),
                expect.objectContaining({ title: 'TASK: Home Inspection', start: '2023-01-05' }),
                { merge: true }
            );
            expect(mockBatch.set).not.toHaveBeenCalledWith(
                expect.objectContaining({ id: 'task_t2' }),
                expect.any(Object),
                expect.any(Object)
            );
        });
    });

    describe('createTransaction integration', () => {
        it('should trigger calendar sync during transaction creation', async () => {
            const transaction = {
                realtorId: 'agent1',
                important_dates: { acceptance_date: '2023-01-01' }
            } as any;

            await createTransaction(transaction);

            expect(mockBatch.set).toHaveBeenCalledWith(
                expect.objectContaining({ path: 'calendar_events', id: expect.stringContaining('milestone_') }),
                expect.any(Object),
                { merge: true }
            );
        });
    });

    describe('deleteTransaction integration', () => {
        it('should delete associated calendar events', async () => {
            vi.mocked(firestore.getDocs).mockResolvedValueOnce({
                forEach: (cb: any) => cb({ ref: 'task-ref' })
            } as any); // Tasks
            vi.mocked(firestore.getDocs).mockResolvedValueOnce({
                forEach: (cb: any) => cb({ ref: 'calendar-ref' })
            } as any); // Calendar events

            await deleteTransaction('tx123');

            expect(mockBatch.delete).toHaveBeenCalledWith('calendar-ref');
            expect(mockBatch.delete).toHaveBeenCalledWith('task-ref');
        });
    });
});
