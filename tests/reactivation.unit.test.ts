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
        doc: vi.fn((db, path, id) => ({ path, id: id || 'mock-summary-id', type: 'doc' })),
        setDoc: vi.fn(() => Promise.resolve()),
        addDoc: vi.fn(() => Promise.resolve({ id: 'new-doc-id' })),
        getDocs: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        orderBy: vi.fn(),
        limit: vi.fn(),
        serverTimestamp: vi.fn(() => 'mock-timestamp')
    };
});

vi.mock('../services/firebase/config', () => ({
    db: { type: 'db' }
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
            expect(firestore.addDoc).toHaveBeenCalledTimes(2); // 1 market context + 1 lead plan
            expect(result).toBe('mock-summary-id');
        });
    });

    describe('getExistingReactivationAnalysis', () => {
        it('should return null if no summary found', async () => {
            vi.mocked(firestore.getDocs).mockResolvedValueOnce({ empty: true } as any);

            const result = await getExistingReactivationAnalysis('doc789', 'user123');
            expect(result).toBeNull();
        });

        it('should return combined data if summary and related records exist', async () => {
            // 1. Mock Summary response
            vi.mocked(firestore.getDocs).mockResolvedValueOnce({
                empty: false,
                docs: [{
                    id: 'summary123',
                    data: () => ({
                        summary: 'Test Summary',
                        global_settings: { focus: 'growth' },
                        leads_documents: 'doc789',
                        userId: 'user123'
                    })
                }]
            } as any);

            // 2. Mock Market Context response
            vi.mocked(firestore.getDocs).mockResolvedValueOnce({
                docs: [{
                    data: () => ({
                        market_name: 'Denver',
                        rates_trend: 'stable'
                    })
                }]
            } as any);

            // 3. Mock Lead Plans response
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
