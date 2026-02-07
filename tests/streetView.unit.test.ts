import { describe, it, expect, vi, beforeEach } from 'vitest';
import { urlToBase64 } from '../services/geminiService';
import * as firebaseFunctions from 'firebase/functions';

// Mock Firebase Functions
vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn()
}));

// Mock Firebase Config
vi.mock('../services/firebase/config', () => ({
    functions: { domain: 'mock-functions' },
    auth: { currentUser: { uid: 'test-user' } }
}));

describe('urlToBase64 Integration with Proxy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock global fetch
        global.fetch = vi.fn();
    });

    it('should use proxyStreetViewImage for Google Maps URLs', async () => {
        const googleMapsUrl = 'https://maps.googleapis.com/maps/api/streetview?location=40.7128,-74.0060&key=test';
        const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        const mockMimeType = 'image/png';

        // Mock the httpsCallable return value
        const mockCallable = vi.fn().mockResolvedValue({
            data: { base64: mockBase64, mimeType: mockMimeType }
        });
        (firebaseFunctions.httpsCallable as any).mockReturnValue(mockCallable);

        const result = await urlToBase64(googleMapsUrl);

        // Assertions
        expect(firebaseFunctions.httpsCallable).toHaveBeenCalledWith(expect.anything(), 'proxyStreetViewImage');
        expect(mockCallable).toHaveBeenCalledWith({ url: googleMapsUrl });
        expect(result.data).toBe(mockBase64);
        expect(result.mimeType).toBe(mockMimeType);
        expect(global.fetch).not.toHaveBeenCalled(); // Should NOT call fetch directly
    });

    it('should fallback to proxy if direct fetch returns 403', async () => {
        const normalUrl = 'https://example.com/image.jpg';
        const mockBase64 = 'fallback-base64';

        // 1. Mock fetch to return 403
        (global.fetch as any).mockResolvedValue({
            ok: false,
            status: 403,
            statusText: 'Forbidden'
        });

        // 2. Mock the httpsCallable for fallback
        const mockCallable = vi.fn().mockResolvedValue({
            data: { base64: mockBase64, mimeType: 'image/jpeg' }
        });
        (firebaseFunctions.httpsCallable as any).mockReturnValue(mockCallable);

        const result = await urlToBase64(normalUrl);

        // Assertions
        expect(global.fetch).toHaveBeenCalled();
        expect(firebaseFunctions.httpsCallable).toHaveBeenCalledWith(expect.anything(), 'proxyStreetViewImage');
        expect(result.data).toBe(mockBase64);
    });

    it('should use standard fetch for normal URLs', async () => {
        const normalUrl = 'https://example.com/image.jpg';
        const mockBlob = new Blob(['test-image'], { type: 'image/jpeg' });

        // Mock fetch success
        (global.fetch as any).mockResolvedValue({
            ok: true,
            blob: vi.fn().mockResolvedValue(mockBlob)
        });

        // Mock FileReader (this is a bit tricky in happy-dom, but let's assume it works or mock it)
        // Actually, JSDOM/FileReader is usually available in vitest environment: jsdom/happy-dom

        // For the sake of this test, we just want to verify fetch was called and proxy was NOT
        try {
            await urlToBase64(normalUrl);
        } catch (e) {
            // FileReader might fail in terminal environment without full browser polyfills 
            // but we care about the logic flow here.
        }

        expect(global.fetch).toHaveBeenCalledWith(normalUrl, expect.anything());
        expect(firebaseFunctions.httpsCallable).not.toHaveBeenCalled();
    });
});
