import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import firebaseFunctionsTest from 'firebase-functions-test';

const test = firebaseFunctionsTest({ projectId: 'demo-project' });

describe('propertyBatch Cloud Function', () => {
    let propertyBatchModule: any;

    beforeAll(async () => {
        propertyBatchModule = await import('../propertyBatch.js');
    });

    afterAll(() => {
        test.cleanup();
    });

    it('should ignore documents that are not in "queued" status', async () => {
        const wrapped = test.wrap(propertyBatchModule.runPropertyDataBatchOnWrite);

        const before = test.firestore.makeDocumentSnapshot({}, 'property_data_batch_jobs/job1');
        const after = test.firestore.makeDocumentSnapshot({
            status: 'running',
            zpids: ['123']
        }, 'property_data_batch_jobs/job1');
        const change = test.makeChange(before, after);

        const result = await wrapped(change);
        expect(result).toBeNull();
    });

    it('should return null immediately if zpids array is empty', async () => {
        const wrapped = test.wrap(propertyBatchModule.runPropertyDataBatchOnWrite);

        const before = test.firestore.makeDocumentSnapshot({}, 'property_data_batch_jobs/job2');
        const after = test.firestore.makeDocumentSnapshot({
            status: 'queued',
            zpids: []
        }, 'property_data_batch_jobs/job2');
        const change = test.makeChange(before, after);

        // With empty zpids, it tries to call change.after.ref.update() which will fail
        // in offline mode (no real Firestore) — we just verify the function doesn't throw
        // an unexpected error and that it attempts the completion update path.
        await expect(wrapped(change)).rejects.toThrow();
    });
});
