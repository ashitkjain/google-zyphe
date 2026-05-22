// Content script: extracts property image URLs, zpid, and Firebase auth token from the page

const MIN_IMAGE_DIMENSION = 150;

function getImageSize(img) {
  return {
    width: img.naturalWidth || img.width || img.getBoundingClientRect().width,
    height: img.naturalHeight || img.height || img.getBoundingClientRect().height,
  };
}

function isPropertyPhotoUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  const photoCdns = [
    'zillowstatic.com', 'photos.zillowstatic.com',
    'ssl.cdn-redfin.com', 'ssl.redfin.com',
    'ap.rdcpix.com', 'rdcpix.com', 'nad.realtor.com',
    'photos.homes.com', 'static.homes.com',
    'trulia-cdn.com',
    'zimg.paragon.ice.com',
    'cloudfront.net', 'amazonaws.com',
    'imgix.net', 'firebasestorage.googleapis.com',
  ];
  const excludePatterns = [
    'logo', 'icon', 'favicon', 'avatar', 'profile', 'badge',
    'sprite', 'button', 'arrow', 'chevron', 'spinner', 'loader',
    '.svg', 'placeholder',
  ];
  if (excludePatterns.some((p) => lower.includes(p))) return false;
  if (photoCdns.some((cdn) => lower.includes(cdn))) return true;
  return lower.match(/\.(jpg|jpeg|png|webp)(\?|$)/i) !== null;
}

function extractPropertyImages() {
  const seen = new Set();
  const results = [];

  document.querySelectorAll('img').forEach((img) => {
    const src = img.src || img.currentSrc;
    if (!src || seen.has(src)) return;
    const { width, height } = getImageSize(img);
    if (width < MIN_IMAGE_DIMENSION && height < MIN_IMAGE_DIMENSION) return;
    if (!isPropertyPhotoUrl(src)) return;
    seen.add(src);
    results.push({ url: src, width, height, alt: img.alt || '' });
  });

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

  const carouselSelectors = [
    '[class*="photo"]', '[class*="image"]', '[class*="carousel"]',
    '[class*="gallery"]', '[class*="slide"]', '[class*="hero"]',
    '[class*="listing"]', '[data-testid*="photo"]',
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

// ── zpid extraction ────────────────────────────────────────────────────────
function extractZpid() {
  // 1. URL search params: ?zpid=12345 or ?propertyId=12345
  const params = new URLSearchParams(window.location.search);
  for (const key of ['zpid', 'propertyId', 'property_id', 'id']) {
    const val = params.get(key);
    if (val && /^\d+$/.test(val)) return val;
  }

  // 2. URL hash: #zpid=12345
  const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
  for (const key of ['zpid', 'propertyId']) {
    const val = hashParams.get(key);
    if (val && /^\d+$/.test(val)) return val;
  }

  // 3. URL path segments: /property/12345 or /12345
  const pathMatch = window.location.pathname.match(/\/(\d{7,12})(\/|$)/);
  if (pathMatch) return pathMatch[1];

  // 4. DOM: data-zpid attribute or text containing "zpid"
  const zpidEl = document.querySelector('[data-zpid]');
  if (zpidEl) return zpidEl.getAttribute('data-zpid');

  // 5. Scan meta tags / structured data
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const s of scripts) {
    try {
      const data = JSON.parse(s.textContent);
      if (data.zpid) return String(data.zpid);
    } catch {}
  }

  // 6. localStorage — zyphe stores recently viewed property
  for (const key of Object.keys(localStorage)) {
    if (key.toLowerCase().includes('currentproperty') || key.toLowerCase().includes('selectedproperty')) {
      try {
        const val = JSON.parse(localStorage[key]);
        if (val?.zpid) return String(val.zpid);
      } catch {}
    }
  }

  return null;
}

// ── Property metadata extraction ──────────────────────────────────────────
function extractPropertyMetadata() {
  const text = (sel) => document.querySelector(sel)?.textContent?.trim() || null;
  const attr = (sel, a) => document.querySelector(sel)?.getAttribute(a) || null;

  // Generic scrape — works for zyphe.ai's rendered DOM
  const bodyText = document.body.innerText;

  // Address: look for common patterns in the page
  const addressEl =
    document.querySelector('[class*="address"]') ||
    document.querySelector('[data-testid*="address"]') ||
    document.querySelector('h1');
  const address = addressEl?.textContent?.trim() || null;

  // Price
  const priceMatch = bodyText.match(/\$[\d,]+(?:\s*[kKmM])?(?:\s*\/\s*mo)?/);
  const price = priceMatch ? priceMatch[0] : null;

  // Beds / baths / sqft — typical "3 bd · 2 ba · 1,200 sqft" pattern
  const bedsMatch = bodyText.match(/(\d+)\s*(?:bd|bed|bedroom)/i);
  const bathsMatch = bodyText.match(/(\d+(?:\.\d)?)\s*(?:ba|bath|bathroom)/i);
  const sqftMatch = bodyText.match(/([\d,]+)\s*(?:sq\.?\s*ft|sqft)/i);
  const yearMatch = bodyText.match(/(?:built|year built)[:\s]+(\d{4})/i);

  // Structured data (JSON-LD)
  let structured = null;
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try {
      const d = JSON.parse(s.textContent);
      if (d['@type'] === 'RealEstateListing' || d.address || d.price) structured = d;
    } catch {}
  });

  return {
    address: structured?.address?.streetAddress || address,
    city: structured?.address?.addressLocality || null,
    state: structured?.address?.addressRegion || null,
    price: structured?.offers?.price || price,
    beds: bedsMatch ? Number(bedsMatch[1]) : null,
    baths: bathsMatch ? Number(bathsMatch[1]) : null,
    sqft: sqftMatch ? sqftMatch[1].replace(',', '') : null,
    year_built: yearMatch ? Number(yearMatch[1]) : null,
    url: window.location.href,
  };
}

// ── Firebase auth token from IndexedDB ────────────────────────────────────
// Content scripts share the page's origin, so they can read the same IndexedDB
// that Firebase Auth writes to.
function getFirebaseToken() {
  return new Promise((resolve) => {
    // Firebase v9+ uses 'firebaseLocalStorageDb' / 'firebaseLocalStorage'
    const dbNames = ['firebaseLocalStorageDb', 'firebase-heartbeat-database'];
    let resolved = false;

    function tryDb(name) {
      try {
        const req = indexedDB.open(name);
        req.onsuccess = (e) => {
          if (resolved) return;
          const db = e.target.result;
          const storeNames = Array.from(db.objectStoreNames);
          const storeName = storeNames.find(s => s.includes('firebaseLocalStorage') || s.includes('storage'));
          if (!storeName) { db.close(); return; }
          try {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const getAllReq = store.getAll();
            getAllReq.onsuccess = () => {
              db.close();
              const items = getAllReq.result || [];
              const authItem = items.find(
                (item) => item?.fbase_key?.includes('authUser') || item?.key?.includes('authUser')
              );
              const tokenData = authItem?.value || authItem;
              const token = tokenData?.stsTokenManager?.accessToken;
              if (token && !resolved) {
                resolved = true;
                resolve({ token, uid: tokenData.uid, email: tokenData.email });
              }
            };
            getAllReq.onerror = () => db.close();
          } catch { db.close(); }
        };
        req.onerror = () => {};
      } catch {}
    }

    dbNames.forEach(tryDb);

    // Fallback: check localStorage (older Firebase SDK versions)
    setTimeout(() => {
      if (resolved) return;
      const lsKey = Object.keys(localStorage).find(k => k.startsWith('firebase:authUser:'));
      if (lsKey) {
        try {
          const data = JSON.parse(localStorage[lsKey]);
          const token = data?.stsTokenManager?.accessToken;
          if (token) { resolved = true; resolve({ token, uid: data.uid, email: data.email }); return; }
        } catch {}
      }
      resolve(null);
    }, 300);
  });
}

// ── Message handlers ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_IMAGES') {
    const images = extractPropertyImages();
    const zpid = extractZpid();
    const property = extractPropertyMetadata();
    sendResponse({ images, zpid, property });
  }

  if (message.type === 'GET_AUTH') {
    getFirebaseToken().then((auth) => sendResponse({ auth }));
    return true; // async
  }

  return true;
});

// MutationObserver for SPA navigation
let extractionTimeout = null;
const observer = new MutationObserver(() => {
  clearTimeout(extractionTimeout);
  extractionTimeout = setTimeout(() => {
    const images = extractPropertyImages();
    if (images.length > 0) {
      const zpid = extractZpid();
      const property = extractPropertyMetadata();
      chrome.runtime.sendMessage({ type: 'IMAGES_UPDATED', images, zpid, property }).catch(() => {});
    }
  }, 800);
});

observer.observe(document.body, { childList: true, subtree: true });

chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' }).catch(() => {});

// Announce extension ID to the zyphe.ai web app so it can send
// DOWNLOAD_PROPERTY_PHOTOS messages via chrome.runtime.sendMessage(extensionId, ...).
window.postMessage({ type: 'ZYPHE_EXTENSION_READY', extensionId: chrome.runtime.id }, '*');
