import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import firebaseFunctionsTest from 'firebase-functions-test';

const test = firebaseFunctionsTest();

describe('proxyStreetViewImage', () => {
    let myFunctions: any;

    beforeAll(async () => {
        // We use dynamic import because it's a JS file with CommonJS exports potentially
        // and to avoid issues with Firebase Admin initialization in a test environment
        myFunctions = await import('../index.js');
    });

    afterAll(() => {
        test.cleanup();
    });

    it('should fail if user is not authenticated', async () => {
        const data = { url: 'https://maps.googleapis.com/maps/api/streetview?location=40.7128,-74.0060&size=600x400&key=test' };
        const context = {}; // No auth

        const wrapped = test.wrap(myFunctions.proxyStreetViewImage);

        await expect(wrapped(data, context)).rejects.toThrow(/User must be logged in/);
    });

    it('should fail if URL is missing or invalid', async () => {
        const data = { url: 'https://malicious-site.com/image.jpg' };
        const context = { auth: { uid: 'test-user' } };

        const wrapped = test.wrap(myFunctions.proxyStreetViewImage);

        await expect(wrapped(data, context)).rejects.toThrow(/Invalid or missing image URL/);
    });
});
