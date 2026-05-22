// Open the side panel when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Allow the side panel on zyphe.ai and localhost
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({
    enabled: true,
  });
});

// Relay messages between content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'IMAGES_FOUND') {
    chrome.runtime.sendMessage(message).catch(() => {});
  }
  sendResponse({ ok: true });
  return true;
});

// ── External message handler (requests from zyphe.ai web app) ─────────────
// Requires "externally_connectable" in manifest and the web app to call
// chrome.runtime.sendMessage(extensionId, { type: 'DOWNLOAD_PROPERTY_PHOTOS', siteUrls })
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type !== 'DOWNLOAD_PROPERTY_PHOTOS') return true;

  downloadPhotosFromSources(message.siteUrls)
    .then((result) => sendResponse(result))
    .catch((err) => sendResponse({ photos: [], source: null, error: err.message }));

  return true; // keep channel open for async response
});

// ── Photo download orchestration ───────────────────────────────────────────

async function downloadPhotosFromSources(siteUrls) {
  // siteUrls is already ordered: Zillow first, others shuffled by the caller
  for (const [source, url] of Object.entries(siteUrls)) {
    if (!url) continue;
    try {
      console.log(`[PhotoDownload] Trying ${source}: ${url}`);
      const photos = await scrapePhotosFromSource(source, url);
      if (photos.length >= 5) {
        console.log(`[PhotoDownload] ${source}: ${photos.length} photos`);
        return { photos, source };
      }
      console.log(`[PhotoDownload] ${source}: only ${photos.length} photos, trying next`);
    } catch (e) {
      console.warn(`[PhotoDownload] ${source} failed:`, e.message);
    }
  }
  return { photos: [], source: null };
}

function scrapePhotosFromSource(source, url) {
  // Zillow: direct listing URL, single step
  if (source === 'zillow') return scrapeListingPage(url, source);
  // Paragon: results page → find card by address text → listing detail page
  if (source === 'paragon') return scrapeViaParagon(url, source);
  // Others: search results → listing detail page
  return scrapeViaSearch(url, source);
}

async function scrapeListingPage(url, source) {
  const tabId = await openBackgroundTab(url);
  try {
    await waitForTabLoad(tabId);
    await delay(3000); // wait for gallery JS to render
    return await injectExtractPhotos(tabId, source);
  } finally {
    chrome.tabs.remove(tabId).catch(() => {});
  }
}

async function scrapeViaSearch(searchUrl, source) {
  const tabId = await openBackgroundTab(searchUrl);
  try {
    await waitForTabLoad(tabId);
    await delay(2500); // wait for search results to render

    const listingUrl = await injectFindListingUrl(tabId, source);
    if (!listingUrl) {
      console.warn(`[PhotoDownload] ${source}: no listing URL found in search results`);
      return [];
    }

    await chrome.tabs.update(tabId, { url: listingUrl });
    await waitForTabLoad(tabId);
    await delay(3000); // wait for listing gallery to render

    return await injectExtractPhotos(tabId, source);
  } finally {
    chrome.tabs.remove(tabId).catch(() => {});
  }
}

async function scrapeViaParagon(rawUrl, source) {
  // Address is passed via ?search= param — strip it before navigating so
  // Paragon doesn't reject the URL, but keep it for DOM text matching.
  const parsed = new URL(rawUrl);
  const address = parsed.searchParams.get('search') || '';
  parsed.searchParams.delete('search');
  const resultsUrl = parsed.toString();

  const tabId = await openBackgroundTab(resultsUrl);
  try {
    await waitForTabLoad(tabId);
    await delay(4000); // Paragon is a heavy JS app

    const listingUrl = await injectFindParagonListing(tabId, address);
    if (!listingUrl) {
      console.warn(`[PhotoDownload] paragon: no listing card found for "${address}"`);
      return [];
    }

    console.log(`[PhotoDownload] paragon: navigating to listing ${listingUrl}`);
    await chrome.tabs.update(tabId, { url: listingUrl });
    await waitForTabLoad(tabId);
    await delay(4000); // wait for photo gallery to render

    return await injectExtractPhotos(tabId, source);
  } finally {
    chrome.tabs.remove(tabId).catch(() => {});
  }
}

// ── Tab utilities ──────────────────────────────────────────────────────────

async function openBackgroundTab(url) {
  const tabId = await new Promise((resolve, reject) => {
    chrome.tabs.create({ url: 'about:blank', active: false }, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(tab.id);
      }
    });
  });
  // Brief pause lets Playwright (and other CDP clients) attach route interception
  // before the real navigation request fires.
  await delay(150);
  await chrome.tabs.update(tabId, { url });
  return tabId;
}

function waitForTabLoad(tabId, timeout = 20000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeout);

    function listener(id, changeInfo) {
      if (id !== tabId || changeInfo.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve();
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Script injection wrappers ──────────────────────────────────────────────

async function injectFindListingUrl(tabId, source) {
  const results = await chrome.scripting
    .executeScript({ target: { tabId }, func: findFirstListingUrl, args: [source] })
    .catch(() => null);
  return results?.[0]?.result || null;
}

async function injectFindParagonListing(tabId, address) {
  const results = await chrome.scripting
    .executeScript({ target: { tabId }, func: findParagonListingUrl, args: [address] })
    .catch(() => null);
  return results?.[0]?.result || null;
}

async function injectExtractPhotos(tabId, source) {
  const results = await chrome.scripting
    .executeScript({ target: { tabId }, func: extractFullResPhotos, args: [source] })
    .catch(() => null);
  return results?.[0]?.result || [];
}

// ── Injected page functions ────────────────────────────────────────────────
// Defined in pageExtractors.js — webpack inlines them here at build time.
// chrome.scripting.executeScript serializes each via .toString(); they are
// self-contained and safe to inject into any tab context.
import { findFirstListingUrl, findParagonListingUrl, extractFullResPhotos } from './pageExtractors.js';
