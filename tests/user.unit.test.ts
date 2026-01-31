import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    saveUserProfile,
    getUserProfile,
    trackUserPropertyView,
    toggleFavorite
} from '../services/firebase/user';
import * as firestore from 'firebase/firestore';

// Mock Firestore
vi.mock('firebase/firestore', () => {
    return {
        collection: vi.fn((db, path) => ({ path, type: 'collection' })),
        doc: vi.fn((db, path, id, ...rest) => {
            // Handle subcollections if present in arguments
            const fullPath = rest.length > 0 ? `${path}/${id}/${rest.join('/')}` : `${path}/${id}`;
            return { path: fullPath, id: rest.length > 0 ? rest[rest.length - 1] : id, type: 'doc' };
        }),
        setDoc: vi.fn(() => Promise.resolve()),
        getDoc: vi.fn(),
        getDocs: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        orderBy: vi.fn(),
        limit: vi.fn(),
        deleteDoc: vi.fn(() => Promise.resolve()),
        increment: vi.fn((n) => `increment(${n})`),
        serverTimestamp: vi.fn(() => 'mock-timestamp')
    };
});

vi.mock('../services/firebase/config', () => ({
    db: { type: 'db' },
    auth: { currentUser: { uid: 'user123' } },
    sanitizeForFirestore: vi.fn((x) => x),
    logFirestoreQuery: vi.fn(),
    handleFirestoreError: vi.fn()
}));

describe('User Service Unit Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('saveUserProfile', () => {
        it('should save a user profile when no duplicates exist', async () => {
            // Mock phone check
            vi.mocked(firestore.getDocs).mockResolvedValueOnce({ empty: true } as any);
            // Mock email check
            vi.mocked(firestore.getDocs).mockResolvedValueOnce({ empty: true } as any);

            const profile = { name: 'Alice', phoneNumber: '1234567890', email: 'alice@example.com' };
            const result = await saveUserProfile('uid123', profile);

            expect(firestore.setDoc).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'uid123' }),
                expect.objectContaining({ name: 'Alice', uid: 'uid123' }),
                { merge: true }
            );
            expect(result).toBe(true);
        });

        it('should throw error if phone number is already in use by another user', async () => {
            vi.mocked(firestore.getDocs).mockResolvedValueOnce({
                empty: false,
                docs: [{ id: 'other-uid' }]
            } as any);

            const profile = { phoneNumber: '1234567890' };
            await expect(saveUserProfile('my-uid', profile)).rejects.toThrow('already in use');
        });
    });

    describe('getUserProfile', () => {
        it('should return profile data if it exists', async () => {
            vi.mocked(firestore.getDoc).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ name: 'Alice' })
            } as any);

            const result = await getUserProfile('uid123');
            expect(result?.name).toBe('Alice');
        });

        it('should return null if profile does not exist', async () => {
            vi.mocked(firestore.getDoc).mockResolvedValueOnce({
                exists: () => false
            } as any);

            const result = await getUserProfile('uid123');
            expect(result).toBeNull();
        });
    });

    describe('trackUserPropertyView', () => {
        it('should log a property view', async () => {
            const property = { zpid: 'z123', address: '123 Main' } as any;
            await trackUserPropertyView('uid123', property);

            expect(firestore.setDoc).toHaveBeenCalledWith(
                expect.objectContaining({ path: 'users/uid123/viewHistory/z123' }),
                expect.objectContaining({ zpid: 'z123', viewCount: 'increment(1)' }),
                { merge: true }
            );
        });
    });

    describe('toggleFavorite', () => {
        it('should remove favorite if it already exists', async () => {
            vi.mocked(firestore.getDoc).mockResolvedValueOnce({
                exists: () => true
            } as any);

            const property = { zpid: 'z123' } as any;
            const result = await toggleFavorite('uid123', property);

            expect(firestore.deleteDoc).toHaveBeenCalled();
            expect(result.favorited).toBe(false);
        });

        it('should add favorite if it does not exist', async () => {
            vi.mocked(firestore.getDoc).mockResolvedValueOnce({
                exists: () => false
            } as any);

            const property = { zpid: 'z123', address: '123 Main' } as any;
            const result = await toggleFavorite('uid123', property);

            expect(firestore.setDoc).toHaveBeenCalled();
            expect(result.favorited).toBe(true);
        });
    });
});
