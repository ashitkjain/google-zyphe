/**
 * Playwright E2E tests for the photo download service.
 *
 * Strategy: intercept requests to real estate sites via context.route() and
 * serve mock HTML pages so the extension's background tab navigation runs
 * against predictable content — no real network calls, no flaky external sites.
 *
 * Pre-requisite: build the extension first  →  cd chrome-extension && npm run build
 * Run:  npm run test:e2e -- tests/photoDownload.spec.ts
 */

import { test as base, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';

// ── Fixtures ───────────────────────────────────────────────────────────────

const test = base.extend<{ context: BrowserContext; extensionId: string }>({
    context: async ({}, use) => {
        const pathToExtension = path.join(process.cwd(), 'chrome-extension/dist');
        const context = await chromium.launchPersistentContext('', {
            headless: false,
            args: [
                `--disable-extensions-except=${pathToExtension}`,
                `--load-extension=${pathToExtension}`,
            ],
        });
        await use(context);
        await context.close();
    },
    extensionId: async ({ context }, use) => {
        let [background] = context.serviceWorkers();
        if (!background) background = await context.waitForEvent('serviceworker');
        await use(background.url().split('/')[2]);
    },
});

// ── Mock HTML factories ────────────────────────────────────────────────────

const ZILLOW_PHOTO_URLS = Array.from({ length: 8 }, (_, i) =>
    `https://photos.zillowstatic.com/fp/photo${i}_m.jpg`
);

const REDFIN_LISTING_URL = 'https://www.redfin.com/CA/San-Francisco/123-Main-St/home/99999999';
const REDFIN_PHOTO_URLS = Array.from({ length: 8 }, (_, i) =>
    `https://ssl.cdn-redfin.com/photo/203/bigphoto/abc/genMid.xyz_${i}.jpg`
);

const REALTOR_LISTING_URL =
    'https://www.realtor.com/realestateandhomes-detail/123-Main-St_SF_CA_94102_M1234-5678';
const REALTOR_PHOTO_URLS = Array.from({ length: 8 }, (_, i) =>
    `https://ap.rdcpix.com/hash123/img_m-${i}.jpg`
);

function zillowListingHtml(): string {
    return `<html><body>
        ${ZILLOW_PHOTO_URLS.map(url =>
            `<img src="${url}" width="1000" height="750" />`
        ).join('\n')}
    </body></html>`;
}

function redfinSearchHtml(): string {
    return `<html><body>
        <a href="${REDFIN_LISTING_URL}">Top result</a>
    </body></html>`;
}

function redfinListingHtml(): string {
    return `<html><body>
        ${REDFIN_PHOTO_URLS.map(url =>
            `<img src="${url}" width="1000" height="750" />`
        ).join('\n')}
    </body></html>`;
}

function realtorSearchHtml(): string {
    return `<html><body>
        <a href="${REALTOR_LISTING_URL}">Top result</a>
    </body></html>`;
}

function realtorListingHtml(): string {
    return `<html><body>
        ${REALTOR_PHOTO_URLS.map(url =>
            `<img src="${url}" width="1000" height="750" />`
        ).join('\n')}
    </body></html>`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Registers route handlers on BOTH the context (for requests Playwright intercepts
 * at the CDP level) AND via context.on('page') for any new pages created by the
 * extension service worker. The latter ensures the routes are applied even when
 * the initial navigation of an extension-created tab races with Playwright's
 * CDP attach timing.
 */
async function setupRoutes(
    context: BrowserContext,
    routes: Array<{ pattern: string | RegExp; html: string }>
) {
    // Context-level routes (cover pages created before and after this call)
    for (const { pattern, html } of routes) {
        await context.route(pattern, route =>
            route.fulfill({ contentType: 'text/html', body: html })
        );
    }

    // Also attach on every newly-created page so the routes are set up
    // before the first navigation request fires on that page.
    context.on('page', async (page: Page) => {
        for (const { pattern, html } of routes) {
            await page.route(pattern, route =>
                route.fulfill({ contentType: 'text/html', body: html })
            ).catch(() => {/* page may already be closed */});
        }
    });
}

async function sendDownloadMessage(
    page: Page,
    extensionId: string,
    siteUrls: Record<string, string>
): Promise<{ photos: string[]; source: string | null }> {
    return page.evaluate(
        async ({ extId, urls }: { extId: string; urls: Record<string, string> }) => {
            return new Promise((resolve) => {
                const timeout = setTimeout(() => resolve({ photos: [], source: null }), 60000);
                (window as any).chrome.runtime.sendMessage(
                    extId,
                    { type: 'DOWNLOAD_PROPERTY_PHOTOS', siteUrls: urls },
                    (response: any) => {
                        clearTimeout(timeout);
                        resolve(response || { photos: [], source: null });
                    }
                );
            });
        },
        { extId: extensionId, urls: siteUrls }
    );
}

// ── Tests ──────────────────────────────────────────────────────────────────

test('downloads full-res photos from Zillow direct listing URL', async ({ context, extensionId }) => {
    await setupRoutes(context, [
        { pattern: 'https://www.zillow.com/**', html: zillowListingHtml() },
    ]);

    const page = await context.newPage();
    await page.goto('http://localhost:3000');

    const result = await sendDownloadMessage(page, extensionId, {
        zillow: 'https://www.zillow.com/homedetails/12345678_zpid/',
    });

    expect(result.source).toBe('zillow');
    expect(result.photos.length).toBeGreaterThanOrEqual(5);
    // All photos should be upgraded to _f resolution
    result.photos.forEach(url => {
        expect(url).toContain('_f.jpg');
        expect(url).not.toMatch(/_(c|b|d|e|m|s)\.jpg/);
    });
});

test('falls through to Redfin when Zillow returns < 5 photos', async ({ context, extensionId }) => {
    await setupRoutes(context, [
        {
            pattern: 'https://www.zillow.com/**',
            html: `<html><body>
                <img src="https://photos.zillowstatic.com/fp/a_m.jpg" width="800" height="600" />
                <img src="https://photos.zillowstatic.com/fp/b_m.jpg" width="800" height="600" />
            </body></html>`,
        },
        { pattern: /https:\/\/www\.redfin\.com\/search/, html: redfinSearchHtml() },
        { pattern: REDFIN_LISTING_URL, html: redfinListingHtml() },
    ]);

    const page = await context.newPage();
    await page.goto('http://localhost:3000');

    const result = await sendDownloadMessage(page, extensionId, {
        zillow: 'https://www.zillow.com/homedetails/12345678_zpid/',
        redfin: 'https://www.redfin.com/search?q=123+Main+St+San+Francisco+CA',
    });

    expect(result.source).toBe('redfin');
    expect(result.photos.length).toBeGreaterThanOrEqual(5);
    // Redfin photos should be upgraded to genFullScreen
    result.photos.forEach(url => {
        expect(url).toContain('genFullScreen');
        expect(url).not.toContain('genMid');
    });
});

test('2-step Realtor.com navigation: search → listing → full-res photos', async ({ context, extensionId }) => {
    await setupRoutes(context, [
        { pattern: 'https://www.realtor.com/realestateandhomes-search/**', html: realtorSearchHtml() },
        { pattern: `${REALTOR_LISTING_URL}**`, html: realtorListingHtml() },
    ]);

    const page = await context.newPage();
    await page.goto('http://localhost:3000');

    const result = await sendDownloadMessage(page, extensionId, {
        realtor: 'https://www.realtor.com/realestateandhomes-search/?q=123+Main+St+SF',
    });

    expect(result.source).toBe('realtor');
    expect(result.photos.length).toBeGreaterThanOrEqual(5);
    // Realtor photos should be upgraded to img_o (original)
    result.photos.forEach(url => {
        expect(url).toContain('img_o-');
        expect(url).not.toContain('img_m-');
    });
});

test('returns empty when search page has no listing link', async ({ context, extensionId }) => {
    await setupRoutes(context, [
        {
            pattern: /https:\/\/www\.redfin\.com\/search/,
            html: '<html><body><p>No results found</p></body></html>',
        },
    ]);

    const page = await context.newPage();
    await page.goto('http://localhost:3000');

    const result = await sendDownloadMessage(page, extensionId, {
        redfin: 'https://www.redfin.com/search?q=nonexistent+address',
    });

    expect(result.photos).toEqual([]);
    expect(result.source).toBeNull();
});

test('extension bridge: ZYPHE_EXTENSION_READY postMessage fires on localhost', async ({ context, extensionId }) => {
    const page = await context.newPage();

    // Set up the message listener via addInitScript so it runs BEFORE the content
    // script fires its postMessage — otherwise we'd miss the event.
    // NOTE: addInitScript runs in the browser; plain JS only, no TypeScript syntax.
    await page.addInitScript(() => {
        window.__extensionReadyPromise = new Promise((resolve) => {
            const timer = setTimeout(() => resolve(null), 5000);
            window.addEventListener('message', (e) => {
                if (e.data && e.data.type === 'ZYPHE_EXTENSION_READY') {
                    clearTimeout(timer);
                    resolve(e.data.extensionId);
                }
            });
        });
    });

    await page.goto('http://localhost:3000');

    // The content script fired ZYPHE_EXTENSION_READY on page load;
    // the initScript listener captured it before any page JS ran.
    const receivedId = await page.evaluate(() => (window as any).__extensionReadyPromise);

    expect(receivedId).not.toBeNull();
    expect(receivedId).toBe(extensionId);
});
