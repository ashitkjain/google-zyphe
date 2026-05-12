import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    saveReactivationAnalysis,
    getExistingReactivationAnalysis,
    updateLeadPlanStatus
} from '../services/firebase/reactivation';
import * as firestore from 'firebase/firestore';

// Mock Firestore
vi.mock('firebase/firestore', () => {
    return {
        collection: vi.fn((db, path) => ({ path, type: 'collection' })),
        doc: vi.fn((...args) => {
            const segs = args.slice(1);
            return { path: segs.length >= 2 ? segs[segs.length - 2] : segs[0], id: segs[segs.length - 1] || 'mock-id', type: 'doc' };
        }),
        setDoc: vi.fn(() => Promise.resolve()),
        addDoc: vi.fn(() => Promise.resolve({ id: 'new-doc-id' })),
        getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
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
    auth: { currentUser: { uid: 'test-user-id' } },
}));

describe('Reactivation Service Unit Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('saveReactivationAnalysis', () => {
        it('should save summary, market context, and lead plans', async () => {
            const mockAnalysis = {
                summary: 'Test Summary',
                global_settings: { focus: 'growth' },
                market_context: [
                    {
                        market_name: 'Denver',
                        rates_trend: 'stable',
                        inventory_trend: 'low',
                        avg_days_on_market: '30',
                        buyer_leverage_notes: 'low',
                        confidence: 'high'
                    }
                ],
                lead_plans: [
                    {
                        lead_id: 'lead1',
                        lead_name: 'John Doe',
                        market: 'Denver',
                        priority_score: 90,
                        staleness_reason: 'no contact',
                        recommended_channel: 'SMS',
                        tone: 'friendly',
                        first_touch: 'Hi John',
                        sequence: { steps: [] }
                    }
                ]
            };

            const result = await saveReactivationAnalysis(
                'user123',
                'client456',
                'doc789',
                'event000',
                mockAnalysis as any
            );

            expect(firestore.setDoc).toHaveBeenCalled();
            expect(firestore.addDoc).toHaveBeenCalledTimes(3); // 1 market context + 2 per lead plan (legacy + nested)
            expect(result).toBe('current_summary');
        });
    });

    describe('getExistingReactivationAnalysis', () => {
        it('should return null if no summary found', async () => {
            // getDoc returns { exists: () => false } by default — function returns null without calling getDocs
            const result = await getExistingReactivationAnalysis('doc789', 'user123');
            expect(result).toBeNull();
        });

        it('should return combined data if summary and related records exist', async () => {
            // 1. Mock getDoc for the nested summary
            vi.mocked(firestore.getDoc).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({
                    summary: 'Test Summary',
                    global_settings: { focus: 'growth' },
                    leads_documents: 'doc789',
                    userId: 'user123'
                })
            } as any);

            // 2. Mock Market Context response (getDocs)
            vi.mocked(firestore.getDocs).mockResolvedValueOnce({
                docs: [{
                    data: () => ({
                        market_name: 'Denver',
                        rates_trend: 'stable'
                    })
                }]
            } as any);

            // 3. Mock Lead Plans response (getDocs)
            vi.mocked(firestore.getDocs).mockResolvedValueOnce({
                docs: [{
                    id: 'plan456',
                    data: () => ({
                        lead_id: 'lead1',
                        lead_name: 'John Doe',
                        priority_score: 90
                    })
                }]
            } as any);

            const result = await getExistingReactivationAnalysis('doc789', 'user123');

            expect(result).not.toBeNull();
            expect(result?.summary).toBe('Test Summary');
            expect(result?.market_context.length).toBe(1);
            expect(result?.lead_plans.length).toBe(1);
            expect(result?.lead_plans[0].lead_name).toBe('John Doe');
        });
    });

    describe('updateLeadPlanStatus', () => {
        it('should update the status of a lead plan', async () => {
            const result = await updateLeadPlanStatus('plan123', 'pursuing');

            expect(firestore.setDoc).toHaveBeenCalledWith(
                expect.objectContaining({ path: 'lead_plans', id: 'plan123' }),
                expect.objectContaining({ reactivation_status: 'pursuing' }),
                { merge: true }
            );
            expect(result).toBe(true);
        });
    });
});
