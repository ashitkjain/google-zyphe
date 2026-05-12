import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getReminderRules,
    updateReminderRule,
    seedReminderRules
} from '../services/firebase/reminders';
import * as firestore from 'firebase/firestore';

// Mock Firestore
const mockBatch = {
    set: vi.fn(),
    commit: vi.fn(() => Promise.resolve())
};

vi.mock('firebase/firestore', () => {
    return {
        collection: vi.fn((db, path) => ({ path, type: 'collection' })),
        doc: vi.fn((...args) => {
            const segs = args.slice(1);
            return { path: segs.length >= 2 ? segs[segs.length - 2] : segs[0], id: segs[segs.length - 1] || 'mock-id', type: 'doc' };
        }),
        setDoc: vi.fn(() => Promise.resolve()),
        getDoc: vi.fn(),
        getDocs: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        updateDoc: vi.fn(() => Promise.resolve()),
        addDoc: vi.fn(() => Promise.resolve({ id: 'new-doc-id' })),
        writeBatch: vi.fn(() => mockBatch),
        serverTimestamp: vi.fn(() => 'mock-timestamp')
    };
});

vi.mock('../services/firebase/config', () => ({
    db: { type: 'db' },
    auth: { currentUser: { uid: 'test-user-id' } },
    sanitizeForFirestore: vi.fn((x: any) => x),
    logFirestoreQuery: vi.fn(),
    handleFirestoreError: vi.fn()
}));

describe('Reminders Service Unit Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockBatch.set.mockClear();
        mockBatch.commit.mockClear();
    });

    describe('getReminderRules', () => {
        it('should fetch rules for a specific realtor', async () => {
            vi.mocked(firestore.getDocs).mockResolvedValueOnce({
                docs: [{
                    id: 'rule1',
                    data: () => ({ name: 'Test Rule', realtorId: 'agent123' })
                }]
            } as any);

            const result = await getReminderRules('agent123');

            expect(result.length).toBe(1);
            expect(result[0].name).toBe('Test Rule');
            expect(firestore.query).toHaveBeenCalled();
        });
    });

    describe('updateReminderRule', () => {
        it('should update an existing rule with merge', async () => {
            const updates = { enabled: false };
            const result = await updateReminderRule('rule1', updates);

            expect(firestore.setDoc).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'rule1' }),
                expect.objectContaining({ enabled: false, updatedAt: 'mock-timestamp' }),
                { merge: true }
            );
            expect(result).toBe(true);
        });
    });

    describe('seedReminderRules', () => {
        it('should use a batch to save multiple rules', async () => {
            const rules = [
                { id: 'r1', name: 'Rule 1' },
                { id: 'r2', name: 'Rule 2' }
            ] as any;

            const result = await seedReminderRules('agent123', rules);

            expect(firestore.writeBatch).toHaveBeenCalled();
            expect(mockBatch.set).toHaveBeenCalledTimes(2);
            expect(mockBatch.commit).toHaveBeenCalled();
            expect(result).toBe(true);
        });
    });
});
