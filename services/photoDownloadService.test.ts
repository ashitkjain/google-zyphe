import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initExtensionBridge, isExtensionAvailable, fetchPhotosViaExtension, PHOTO_SITES, _resetExtensionBridgeForTesting } from './photoDownloadService';

// ── URL builder tests ──────────────────────────────────────────────────────

describe('PHOTO_SITES URL builders', () => {
    it('Zillow builds direct zpid URL', () => {
        const zillow = PHOTO_SITES.find(s => s.id === 'zillow')!;
        expect(zillow.buildUrl('12345678')).toBe('https://www.zillow.com/homedetails/12345678_zpid/');
    });

    it('Zillow returns null when zpid is empty', () => {
        const zillow = PHOTO_SITES.find(s => s.id === 'zillow')!;
        expect(zillow.buildUrl('')).toBeNull();
    });

    it('Realtor builds search URL from address', () => {
        const realtor = PHOTO_SITES.find(s => s.id === 'realtor')!;
        const url = realtor.buildUrl('', '123 Main St, San Francisco, CA 94102');
        expect(url).toBe('https://www.realtor.com/realestateandhomes-search/?q=123%20Main%20St%2C%20San%20Francisco%2C%20CA%2094102');
    });

    it('Realtor returns null when address is missing', () => {
        const realtor = PHOTO_SITES.find(s => s.id === 'realtor')!;
        expect(realtor.buildUrl('12345678', undefined)).toBeNull();
    });

    it('Redfin builds search URL from address', () => {
        const redfin = PHOTO_SITES.find(s => s.id === 'redfin')!;
        const url = redfin.buildUrl('', '123 Main St, San Francisco, CA');
        expect(url).toContain('https://www.redfin.com/search?q=');
        expect(url).toContain('123%20Main%20St');
    });

    it('Homes.com builds search URL from address', () => {
        const homes = PHOTO_SITES.find(s => s.id === 'homes')!;
        const url = homes.buildUrl('', '123 Main St, San Francisco, CA');
        expect(url).toContain('https://www.homes.com/search/?term=');
    });

    it('Trulia builds search URL from address', () => {
        const trulia = PHOTO_SITES.find(s => s.id === 'trulia')!;
        const url = trulia.buildUrl('', '123 Main St San Francisco CA');
        expect(url).toContain('trulia.com');
        expect(url).toContain('123');
    });
});

// ── Source ordering tests ──────────────────────────────────────────────────

describe('fetchPhotosViaExtension site ordering', () => {
    let capturedMessage: any;

    beforeEach(() => {
        // Simulate extension being registered
        (globalThis as any).window = {
            addEventListener: vi.fn((event, handler) => {
                if (event === 'message') {
                    // Trigger ZYPHE_EXTENSION_READY immediately
                    handler({ data: { type: 'ZYPHE_EXTENSION_READY', extensionId: 'fake-ext-id' } });
                }
            }),
            chrome: {
                runtime: {
                    sendMessage: vi.fn((extId, msg, cb) => {
                        capturedMessage = msg;
                        cb({ photos: [], source: null });
                    }),
                    lastError: null,
                },
            },
        };
        initExtensionBridge();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('always puts zillow first in siteUrls', async () => {
        await fetchPhotosViaExtension('12345678', '123 Main St, San Francisco, CA');
        const keys = Object.keys(capturedMessage.siteUrls);
        expect(keys[0]).toBe('zillow');
    });

    it('includes all 5 sites when address is provided', async () => {
        await fetchPhotosViaExtension('12345678', '123 Main St, San Francisco, CA');
        const keys = Object.keys(capturedMessage.siteUrls);
        expect(keys).toContain('zillow');
        expect(keys).toContain('realtor');
        expect(keys).toContain('redfin');
        expect(keys).toContain('homes');
        expect(keys).toContain('trulia');
    });

    it('includes only zillow when address is omitted', async () => {
        await fetchPhotosViaExtension('12345678');
        const keys = Object.keys(capturedMessage.siteUrls);
        expect(keys).toEqual(['zillow']);
    });

    it('returns empty when extension is unavailable', async () => {
        (globalThis as any).window = { addEventListener: vi.fn(), chrome: undefined };
        initExtensionBridge();
        const result = await fetchPhotosViaExtension('12345678', '123 Main St');
        expect(result.photos).toEqual([]);
        expect(result.source).toBeNull();
    });
});

// ── Extension bridge tests ─────────────────────────────────────────────────

describe('initExtensionBridge', () => {
    beforeEach(() => {
        _resetExtensionBridgeForTesting();
    });

    it('isExtensionAvailable returns false before bridge init', () => {
        (globalThis as any).window = { addEventListener: vi.fn(), chrome: undefined };
        expect(isExtensionAvailable()).toBe(false);
    });

    it('isExtensionAvailable returns true after ZYPHE_EXTENSION_READY message', () => {
        let handler: any;
        (globalThis as any).window = {
            addEventListener: vi.fn((_, h) => { handler = h; }),
            chrome: { runtime: { sendMessage: vi.fn() } },
        };
        initExtensionBridge();
        handler({ data: { type: 'ZYPHE_EXTENSION_READY', extensionId: 'abc123' } });
        expect(isExtensionAvailable()).toBe(true);
    });

    it('ignores unrelated postMessages', () => {
        let handler: any;
        (globalThis as any).window = {
            addEventListener: vi.fn((_, h) => { handler = h; }),
            chrome: { runtime: { sendMessage: vi.fn() } },
        };
        initExtensionBridge();
        handler({ data: { type: 'SOME_OTHER_EVENT', extensionId: 'abc123' } });
        expect(isExtensionAvailable()).toBe(false);
    });
});
