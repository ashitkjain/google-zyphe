/**
 * Unit tests for the page-context injected functions.
 * Run with: node --experimental-vm-modules node_modules/.bin/jest pageExtractors.test.js
 * (or add to vitest if you wire up the extension src to the root test runner)
 *
 * These tests use jsdom via a manual document setup since the extension
 * has its own test runner separate from the main app's vitest.
 */

import { findFirstListingUrl, extractFullResPhotos } from './pageExtractors.js';

function setupDom(html) {
    // Mutate the existing Jest jsdom document instead of replacing global.document,
    // since ESM modules capture the document reference at module load time.
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/is);
    document.body.innerHTML = bodyMatch ? bodyMatch[1] : html;
}

// ── findFirstListingUrl ────────────────────────────────────────────────────

describe('findFirstListingUrl', () => {
    it('finds Realtor.com listing link', () => {
        setupDom(`
            <html><body>
                <a href="https://www.realtor.com/realestateandhomes-detail/123-Main-St_SF_CA_94102_M1234-5678">Listing</a>
            </body></html>
        `);
        const url = findFirstListingUrl('realtor');
        expect(url).toContain('/realestateandhomes-detail/');
    });

    it('finds Redfin listing link', () => {
        setupDom(`
            <html><body>
                <a href="https://www.redfin.com/CA/San-Francisco/123-Main-St/home/12345678">Listing</a>
            </body></html>
        `);
        const url = findFirstListingUrl('redfin');
        expect(url).toContain('/home/12345678');
    });

    it('finds Homes.com listing link', () => {
        setupDom(`
            <html><body>
                <a href="https://www.homes.com/property/123-main-st-san-francisco-ca/">Listing</a>
            </body></html>
        `);
        const url = findFirstListingUrl('homes');
        expect(url).toContain('/property/');
    });

    it('finds Trulia listing link', () => {
        setupDom(`
            <html><body>
                <a href="https://www.trulia.com/p/ca/san-francisco/123-main-st-san-francisco-ca-94102--2080528614">Listing</a>
            </body></html>
        `);
        const url = findFirstListingUrl('trulia');
        expect(url).toContain('/p/');
    });

    it('returns null when no matching link exists', () => {
        setupDom('<html><body><a href="https://www.redfin.com/news/article">Not a listing</a></body></html>');
        expect(findFirstListingUrl('redfin')).toBeNull();
    });

    it('ignores links that only partially match', () => {
        setupDom('<html><body><a href="https://www.realtor.com/news/trends">Not a listing</a></body></html>');
        expect(findFirstListingUrl('realtor')).toBeNull();
    });

    it('returns first match when multiple listings are present', () => {
        setupDom(`
            <html><body>
                <a href="https://www.redfin.com/CA/SF/123-Main/home/11111">First</a>
                <a href="https://www.redfin.com/CA/SF/456-Oak/home/22222">Second</a>
            </body></html>
        `);
        const url = findFirstListingUrl('redfin');
        expect(url).toContain('11111');
    });
});

// ── CDN URL upgrade patterns ───────────────────────────────────────────────

describe('extractFullResPhotos — URL upgrades', () => {
    function photoPage(source, imgUrl) {
        setupDom(`
            <html><body>
                <img src="${imgUrl}" width="800" height="600" />
            </body></html>
        `);
        return extractFullResPhotos(source);
    }

    // Zillow
    it('upgrades Zillow _m.jpg to _f.jpg', () => {
        const photos = photoPage('zillow', 'https://photos.zillowstatic.com/fp/abc123_m.jpg');
        expect(photos[0]).toContain('_f.jpg');
        expect(photos[0]).not.toContain('_m.jpg');
    });

    it('upgrades Zillow _c.webp to _f.webp', () => {
        const photos = photoPage('zillow', 'https://photos.zillowstatic.com/fp/abc123_c.webp');
        expect(photos[0]).toContain('_f.webp');
    });

    it('upgrades Zillow scaled_within size to uncropped', () => {
        const photos = photoPage('zillow',
            'https://photos.zillowstatic.com/fp/abc_scaled_within_800_600.jpg');
        expect(photos[0]).toContain('uncropped_scaled_within_1536_1152');
        expect(photos[0]).not.toContain('scaled_within_800_600');
    });

    it('does not modify already-full-res Zillow URL', () => {
        const url = 'https://photos.zillowstatic.com/fp/abc123_f.jpg';
        const photos = photoPage('zillow', url);
        expect(photos[0]).toBe(url);
    });

    // Realtor.com
    it('upgrades Realtor img_m-3.jpg to img_o-3.jpg', () => {
        const photos = photoPage('realtor', 'https://ap.rdcpix.com/hash123/img_m-3.jpg');
        expect(photos[0]).toContain('img_o-3.jpg');
        expect(photos[0]).not.toContain('img_m-3');
    });

    it('upgrades Realtor imgs-0.jpg to img_o-0.jpg', () => {
        const photos = photoPage('realtor', 'https://ap.rdcpix.com/hash123/imgs-0.jpg');
        expect(photos[0]).toContain('img_o-0.jpg');
    });

    it('upgrades Realtor img_d-5.jpg to img_o-5.jpg', () => {
        const photos = photoPage('realtor', 'https://ap.rdcpix.com/hash123/img_d-5.jpg');
        expect(photos[0]).toContain('img_o-5.jpg');
    });

    // Redfin
    it('upgrades Redfin genMid to genFullScreen', () => {
        const photos = photoPage('redfin',
            'https://ssl.cdn-redfin.com/photo/203/bigphoto/123/genMid.abc123_0.jpg');
        expect(photos[0]).toContain('genFullScreen');
        expect(photos[0]).not.toContain('genMid');
    });

    it('upgrades Redfin genThumb to genFullScreen', () => {
        const photos = photoPage('redfin',
            'https://ssl.cdn-redfin.com/photo/203/thumb/123/genThumb.abc123_0.jpg');
        expect(photos[0]).toContain('genFullScreen');
    });

    it('upgrades Redfin genSmall to genFullScreen', () => {
        const photos = photoPage('redfin',
            'https://ssl.cdn-redfin.com/photo/203/small/123/genSmall.abc123_0.jpg');
        expect(photos[0]).toContain('genFullScreen');
    });

    it('does not modify already-full-res Redfin URL', () => {
        const url = 'https://ssl.cdn-redfin.com/photo/203/bigphoto/123/genFullScreen.abc123_0.jpg';
        const photos = photoPage('redfin', url);
        expect(photos[0]).toBe(url);
    });

    // RealEstateAPI
    it('keeps RealEstateAPI imagecdn.realty.dev image URL unmodified', () => {
        const url = 'https://imagecdn.realty.dev/mls_photos/CRMLS/41132638/1.jpg';
        const photos = photoPage('realestateapi', url);
        expect(photos[0]).toBe(url);
    });
});

// ── Photo filtering ────────────────────────────────────────────────────────

describe('extractFullResPhotos — filtering', () => {
    it('excludes small images below MIN_DIM threshold', () => {
        setupDom(`
            <html><body>
                <img src="https://photos.zillowstatic.com/fp/tiny_m.jpg" width="50" height="50" />
            </body></html>
        `);
        expect(extractFullResPhotos('zillow')).toEqual([]);
    });

    it('excludes logo images by URL pattern', () => {
        setupDom(`
            <html><body>
                <img src="https://photos.zillowstatic.com/fp/zillow-logo.jpg" width="800" height="600" />
            </body></html>
        `);
        expect(extractFullResPhotos('zillow')).toEqual([]);
    });

    it('excludes icon images by URL pattern', () => {
        setupDom(`
            <html><body>
                <img src="https://photos.zillowstatic.com/fp/heart-icon.jpg" width="800" height="600" />
            </body></html>
        `);
        expect(extractFullResPhotos('zillow')).toEqual([]);
    });

    it('excludes photos from wrong CDN for the source', () => {
        // Redfin source should not accept rdcpix.com (Realtor CDN)
        setupDom(`
            <html><body>
                <img src="https://ap.rdcpix.com/hash/img_m-0.jpg" width="800" height="600" />
            </body></html>
        `);
        expect(extractFullResPhotos('redfin')).toEqual([]);
    });

    it('collects photos from CSS background-image', () => {
        setupDom(`
            <html><body>
                <div style="background-image: url('https://ssl.cdn-redfin.com/photo/203/bigphoto/abc/genMid.xyz_0.jpg'); width: 800px; height: 600px;"></div>
            </body></html>
        `);
        const photos = extractFullResPhotos('redfin');
        expect(photos.length).toBe(1);
        expect(photos[0]).toContain('genFullScreen');
    });

    it('collects photos from data-src lazy load attribute', () => {
        setupDom(`
            <html><body>
                <img data-src="https://photos.zillowstatic.com/fp/lazy_m.jpg" />
            </body></html>
        `);
        const photos = extractFullResPhotos('zillow');
        expect(photos.length).toBe(1);
        expect(photos[0]).toContain('_f.jpg');
    });

    it('deduplicates identical URLs', () => {
        setupDom(`
            <html><body>
                <img src="https://photos.zillowstatic.com/fp/abc_m.jpg" width="800" height="600" />
                <img src="https://photos.zillowstatic.com/fp/abc_m.jpg" width="800" height="600" />
            </body></html>
        `);
        expect(extractFullResPhotos('zillow').length).toBe(1);
    });

    it('sorts by resolution descending', () => {
        setupDom(`
            <html><body>
                <img src="https://photos.zillowstatic.com/fp/small_m.jpg" width="400" height="300" />
                <img src="https://photos.zillowstatic.com/fp/large_m.jpg" width="1200" height="900" />
            </body></html>
        `);
        const photos = extractFullResPhotos('zillow');
        expect(photos[0]).toContain('large');
        expect(photos[1]).toContain('small');
    });
});
