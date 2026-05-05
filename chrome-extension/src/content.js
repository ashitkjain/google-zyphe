// Content script: extracts property image URLs from the page

const MIN_IMAGE_DIMENSION = 150; // px — filter out icons/thumbnails

/**
 * Extract the natural size of an img element (falls back to rendered size).
 */
function getImageSize(img) {
  return {
    width: img.naturalWidth || img.width || img.getBoundingClientRect().width,
    height: img.naturalHeight || img.height || img.getBoundingClientRect().height,
  };
}

/**
 * Decide whether a URL looks like a property photo (not a logo/icon/avatar).
 */
function isPropertyPhotoUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();

  // Known real estate photo CDNs
  const photoCdns = [
    'zillowstatic.com',
    'photos.zillowstatic.com',
    'ssl.cdn-redfin.com',
    'ap.rdcpix.com',
    'rdcpix.com',
    'cloudfront.net',
    'amazonaws.com',
    'googleapis.com',
    'imgix.net',
    'firebasestorage.googleapis.com',
  ];

  // Exclude obvious non-photo paths
  const excludePatterns = [
    'logo', 'icon', 'favicon', 'avatar', 'profile', 'badge',
    'sprite', 'button', 'arrow', 'chevron', 'spinner', 'loader',
    '.svg', 'placeholder',
  ];

  if (excludePatterns.some((p) => lower.includes(p))) return false;

  if (photoCdns.some((cdn) => lower.includes(cdn))) return true;

  // Generic: large images are likely property photos
  return lower.match(/\.(jpg|jpeg|png|webp)(\?|$)/i) !== null;
}

/**
 * Collect all candidate property image URLs from the DOM.
 */
function extractPropertyImages() {
  const seen = new Set();
  const results = [];

  // 1. <img> tags
  document.querySelectorAll('img').forEach((img) => {
    const src = img.src || img.currentSrc;
    if (!src || seen.has(src)) return;

    const { width, height } = getImageSize(img);
    if (width < MIN_IMAGE_DIMENSION && height < MIN_IMAGE_DIMENSION) return;
    if (!isPropertyPhotoUrl(src)) return;

    seen.add(src);
    results.push({ url: src, width, height, alt: img.alt || '' });
  });

  // 2. Inline background-image styles (carousel divs etc.)
  document.querySelectorAll('[style]').forEach((el) => {
    const style = el.getAttribute('style') || '';
    const match = style.match(/background-image\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/i);
    if (!match) return;
    const url = match[1];
    if (seen.has(url) || !isPropertyPhotoUrl(url)) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < MIN_IMAGE_DIMENSION && rect.height < MIN_IMAGE_DIMENSION) return;
    seen.add(url);
    results.push({ url, width: rect.width, height: rect.height, alt: '' });
  });

  // 3. Computed background-image on elements with class hints
  const carouselSelectors = [
    '[class*="photo"]',
    '[class*="image"]',
    '[class*="carousel"]',
    '[class*="gallery"]',
    '[class*="slide"]',
    '[class*="hero"]',
    '[class*="listing"]',
    '[data-testid*="photo"]',
  ];
  document.querySelectorAll(carouselSelectors.join(',')).forEach((el) => {
    const computed = window.getComputedStyle(el).backgroundImage;
    if (!computed || computed === 'none') return;
    const match = computed.match(/url\(['"]?([^'")\s]+)['"]?\)/i);
    if (!match) return;
    const url = match[1];
    if (seen.has(url) || !isPropertyPhotoUrl(url)) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < MIN_IMAGE_DIMENSION && rect.height < MIN_IMAGE_DIMENSION) return;
    seen.add(url);
    results.push({ url, width: rect.width, height: rect.height, alt: '' });
  });

  return results;
}

// Listen for requests from the side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_IMAGES') {
    const images = extractPropertyImages();
    sendResponse({ images });
  }
  return true;
});

// Also watch for React-rendered images (SPA navigation / lazy loads)
let extractionTimeout = null;
const observer = new MutationObserver(() => {
  clearTimeout(extractionTimeout);
  extractionTimeout = setTimeout(() => {
    const images = extractPropertyImages();
    if (images.length > 0) {
      chrome.runtime.sendMessage({ type: 'IMAGES_UPDATED', images }).catch(() => {});
    }
  }, 800);
});

observer.observe(document.body, { childList: true, subtree: true });

// Signal that the content script is ready
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' }).catch(() => {});
