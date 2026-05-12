// Page-context functions injected by background.js via chrome.scripting.executeScript.
// Keeping them in a separate module makes them unit-testable without a browser.
// background.js imports these and passes them as `func` to executeScript.
// NOTE: These functions must be self-contained — no closure variables from
// this module will be available when they run inside the target tab.

/**
 * Finds the first listing detail URL in a real estate search results page.
 * Uses href pattern matching instead of CSS selectors for resilience to redesigns.
 * @param {string} source - 'realtor' | 'redfin' | 'homes' | 'trulia'
 * @returns {string|null} Absolute listing URL or null if not found
 */
export function findFirstListingUrl(source) {
  const PATTERNS = {
    realtor: /\/realestateandhomes-detail\//,
    redfin: /\/home\/\d+/,
    homes: /\/property\//,
    trulia: /\/p\//,
  };
  const pattern = PATTERNS[source];
  if (!pattern) return null;

  const link = Array.from(document.querySelectorAll('a[href]'))
    .find((a) => pattern.test(a.href));
  return link ? link.href : null;
}

/**
 * Extracts full-resolution property photos from a listing detail page.
 * Scans <img> tags, CSS background-images, and lazy-load attributes.
 * Upgrades CDN URLs to maximum available resolution per site.
 * @param {string} source - 'zillow' | 'realtor' | 'redfin' | 'homes' | 'trulia'
 * @returns {string[]} Deduplicated, resolution-sorted array of photo URLs
 */
export function extractFullResPhotos(source) {
  const MIN_DIM = 200;
  const SOURCE_CDNS = {
    zillow: ['zillowstatic.com', 'photos.zillowstatic.com'],
    realtor: ['rdcpix.com', 'ap.rdcpix.com', 'nad.realtor.com'],
    redfin: ['ssl.cdn-redfin.com', 'ssl.redfin.com'],
    homes: ['homes.com/photos', 'photos.homes.com', 'static.homes.com'],
    trulia: ['zillowstatic.com', 'trulia-cdn.com'],
  };
  const EXCLUDE = [
    'logo', 'icon', 'favicon', 'avatar', 'badge', 'sprite',
    'button', 'arrow', 'chevron', 'spinner', '.svg', 'placeholder',
    'streetview', 'map-tile', 'map_tile',
  ];

  const allowedCdns = SOURCE_CDNS[source] || Object.values(SOURCE_CDNS).flat();

  function isPhoto(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    if (EXCLUDE.some((p) => lower.includes(p))) return false;
    return allowedCdns.some((cdn) => lower.includes(cdn));
  }

  function upgradeUrl(url) {
    if (source === 'zillow' || source === 'trulia') {
      return url
        .replace(/_(c|b|d|e|m|s)\.(jpg|jpeg|webp)/i, '_f.$2')
        .replace(/scaled_within_\d+_\d+/, 'uncropped_scaled_within_1536_1152');
    }
    if (source === 'realtor') {
      // img_m-3.jpg, img_s-3.jpg, imgs-3.jpg → img_o-3.jpg  (o = original)
      return url.replace(/img[_-]?([smd])-(\d+)/i, 'img_o-$2');
    }
    if (source === 'redfin') {
      // genThumb. / genMid. / genSmall. → genFullScreen.
      return url.replace(/gen(Thumb|Mid|Small)\./i, 'genFullScreen.');
    }
    return url;
  }

  const seen = new Set();
  const photos = [];

  document.querySelectorAll('img').forEach((img) => {
    const src = img.currentSrc || img.src;
    if (!src || seen.has(src) || !isPhoto(src)) return;
    const w = img.naturalWidth || img.width || img.getBoundingClientRect().width;
    const h = img.naturalHeight || img.height || img.getBoundingClientRect().height;
    if (w < MIN_DIM && h < MIN_DIM) return;
    seen.add(src);
    photos.push({ url: src, area: w * h });
  });

  document.querySelectorAll('[style]').forEach((el) => {
    const match = el.getAttribute('style')
      ?.match(/background-image\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/i);
    if (!match) return;
    const url = match[1];
    if (seen.has(url) || !isPhoto(url)) return;
    const rect = el.getBoundingClientRect();
    // Skip size check when no layout is available (e.g., server-side / headless without CSS engine)
    if ((rect.width > 0 || rect.height > 0) && rect.width < MIN_DIM && rect.height < MIN_DIM) return;
    seen.add(url);
    photos.push({ url, area: rect.width * rect.height });
  });

  ['data-src', 'data-lazy-src', 'data-original'].forEach((attr) => {
    document.querySelectorAll(`[${attr}]`).forEach((el) => {
      const url = el.getAttribute(attr);
      if (!url || seen.has(url) || !isPhoto(url)) return;
      seen.add(url);
      photos.push({ url, area: 0 });
    });
  });

  return photos
    .filter((p) => p.url.startsWith('http'))
    .sort((a, b) => b.area - a.area)
    .map((p) => upgradeUrl(p.url));
}
