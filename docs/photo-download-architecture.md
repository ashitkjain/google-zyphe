# Photo Download Service — Architecture & Design

**Status:** Implemented  
**Last updated:** 2026-05-11

---

## Problem Statement

Property photos on Zillow, Realtor.com, Redfin, and Homes.com are loaded from different CDNs and expire or rotate on the source sites' schedules. The original approach called a single RapidAPI endpoint (`/images?zpid=...`) which returned Zillow CDN URLs. This created two failure modes:

1. **Single point of failure** — if RapidAPI is down or rate-limited, photos are unavailable.
2. **URL rot** — Zillow CDN URLs expire; the identity-based healing in `assetService.ts` helps but depends on RapidAPI staying consistent.

The goal is a centralized service that randomizes across multiple real estate sites so that no single source is a single point of failure, and photos are always sourced from a live, full-resolution URL.

---

## Architecture Overview

```
Web App (zyphe.ai)
│
├── fetchPropertyImages(zpid, address)          [services/api/property.ts]
│   │
│   ├── 1. RESO (if user has MLS keys)         → exit on success
│   ├── 2. fetchPhotosViaExtension()            → exit on ≥5 photos
│   │       │
│   │       └── chrome.runtime.sendMessage(extensionId, DOWNLOAD_PROPERTY_PHOTOS, siteUrls)
│   │               │
│   │               └── Chrome Extension Background Worker
│   │                   │
│   │                   ├── Zillow  → scrapeListingPage()     (1-step, direct zpid URL)
│   │                   ├── Redfin  → scrapeViaSearch()       (2-step: search → listing)
│   │                   ├── Realtor → scrapeViaSearch()       (2-step: search → listing)
│   │                   ├── Homes   → scrapeViaSearch()       (2-step: search → listing)
│   │                   └── Trulia  → scrapeViaSearch()       (2-step: search → listing)
│   │
│   └── 3. RapidAPI (/images?zpid=...)          → final fallback
│
└── securePropertyAssets(zpid, address, ...)   [services/assetService.ts]
    └── calls fetchPropertyImages() internally
        └── uploads to Firebase Storage (properties/{zpid}/gallery/img_N.jpg)
```

### Extension ID Discovery

The extension announces itself to the web app via `postMessage` on every page load. The content script (which runs on `zyphe.ai` and `localhost`) posts:

```
content.js → window.postMessage({ type: 'ZYPHE_EXTENSION_READY', extensionId }) → App.tsx
```

`photoDownloadService.ts` listens for this message (`initExtensionBridge()`) and caches the ID. No Firestore write, no hardcoded ID in env vars.

### Source Ordering

Zillow is always tried first because it has a **direct, deterministic URL** from the zpid alone. The other four sites require the formatted address and use a 2-step search → listing navigation. Sites 2–5 are shuffled randomly on each call so no single secondary source gets preferential hammering.

```
Order = [zillow, shuffle([realtor, redfin, homes, trulia])]
```

The service stops and returns as soon as any source yields **≥ 5 photos**.

---

## Two-Step Tab Navigation (Option A)

For every non-Zillow source:

```
1. chrome.tabs.create({ url: searchUrl, active: false })
   └── wait for status: 'complete' + 2500ms render delay
   └── executeScript: findFirstListingUrl(source)
       └── scan all <a href> for site-specific listing URL pattern
       └── return first match (or null)

2. chrome.tabs.update(tabId, { url: listingUrl })
   └── wait for status: 'complete' + 3000ms gallery render delay
   └── executeScript: extractFullResPhotos(source)
       └── collect <img>, CSS backgrounds, lazy-load attributes
       └── upgradeUrl(url, source) → full-resolution
   └── chrome.tabs.remove(tabId)
```

Tabs open in the background (`active: false`) — the user never sees them.

### Listing URL Detection

Rather than fragile CSS class selectors, listing URLs are found by matching `href` against known URL patterns. This is resilient to class renames across site redesigns:

| Site        | Pattern matched in `href`          |
|-------------|-----------------------------------|
| Realtor.com | `/realestateandhomes-detail/`      |
| Redfin      | `/home/\d+`                        |
| Homes.com   | `/property/`                       |
| Trulia      | `/p/`                              |

### Photo Resolution Upgrade

Once photos are found on a listing page, URLs are upgraded to the maximum available resolution using known CDN conventions:

| Site        | CDN domain               | Upgrade rule |
|-------------|--------------------------|--------------|
| Zillow      | `photos.zillowstatic.com`| Replace size suffix `_c/_b/_e/_m` → `_f`; replace `scaled_within_NxM` → `uncropped_scaled_within_1536_1152` |
| Realtor.com | `ap.rdcpix.com`          | Replace `img_m-N` or `imgs-N` → `img_o-N` (`o` = original) |
| Redfin      | `ssl.cdn-redfin.com`     | Replace `genMid.` / `genThumb.` → `genFullScreen.` |
| Homes.com   | `photos.homes.com`       | Replace `_s.jpg` / `_m.jpg` → `_l.jpg` |
| Trulia      | `zillowstatic.com`       | Same as Zillow (Trulia is Zillow-owned) |

---

## Options Considered

### Option A — 2-Step Tab Navigation ✅ (chosen)

Open a background tab to the search results page, find the listing link via `href` pattern, navigate to the listing page, scrape full-res photos.

**Pros:**
- Full-resolution photos from every site
- No undocumented API calls — mimics normal user browser behavior
- Robust to CDN token schemes (cookies are present in the tab context)
- Legally defensible: the *hiQ v. LinkedIn* line (9th Cir., confirmed 2022) held that scraping publicly accessible pages with one's own browser does not violate CFAA
- Chrome's anti-bot detection sees a real browser with full cookies and headers

**Cons:**
- Slow: ~15–25 seconds per source (two page loads + render delays)
- Requires maintaining listing-URL regex patterns if sites change their URL structure
- Tabs are opened per request (mitigated: we stop at first success, so usually only 1–2 tabs)

### Option B — Direct Internal API Calls ❌ (rejected)

Call each site's undocumented internal autocomplete / photo API directly from the extension background worker (no tabs).

**Pros:**
- Fast (~3–5 seconds)
- No tabs opened

**Cons:**
- Background worker requests lack session cookies → blocked by bot detection (Cloudflare, DataDome)
- Undocumented APIs break without notice (Redfin has broken theirs 3+ times historically)
- Legally riskier: calling APIs not intended for public consumption adds CFAA ambiguity beyond simple public-page scraping
- Rate limits apply per-IP; at agent-tool scale, users' IPs get flagged
- Realtor.com / NAR photos are often MLS-licensed; server-to-API access is harder to defend as personal use

### Option C — Hybrid (A + B) ❌ (rejected for now)

Try Option B first; fall back to Option A if the API returns nothing.

**Reasoning for rejection:** Adds complexity for marginal speed gain. Option A is already fast enough when run in parallel with other pipeline steps. Option B's API reliability risk means Option A will fire frequently anyway. Revisit if Option A's 20s latency becomes a user complaint.

### Option D — Third-Party Multi-Source Photo API

Use a paid API (ATTOM Data, Bridge Interactive, CoreLogic) that aggregates photos from multiple sources given an APN or address.

**Reasoning for rejection:** High cost ($$$), requires separate procurement. Good future option if the extension approach becomes unmaintainable. RESO (already integrated) is the clean version of this for MLS members.

---

## Failure Modes & Fallbacks

| Failure | Behavior |
|---------|----------|
| Extension not installed | `isExtensionAvailable()` → false; falls through to RapidAPI |
| Extension installed, sidepanel never opened | Content script still runs; `postMessage` fires; extension is available |
| Site returns 0 photos from search page | Try next source in shuffled order |
| All extension sources return < 5 photos | Fall through to RapidAPI |
| Tab open times out (20s) | `waitForTabLoad` resolves anyway; script execution attempted |
| `executeScript` fails (CSP, navigation race) | Returns empty array; moves to next source |
| Listing URL pattern doesn't match (site redesign) | Step 1 returns null; skip source |
| `externally_connectable` message fails | `chrome.runtime.lastError` caught; resolve with empty |
| RapidAPI rate limit (429) | Existing exponential backoff (1s, 2s, 4s) |

---

## Legal Considerations

- **ToS**: All real estate sites prohibit automated scraping in their ToS. This is a civil matter, not criminal.
- **CFAA**: *Van Buren v. United States* (2021) narrowed "exceeds authorized access" to mean areas that are off-limits, not ToS violations. *hiQ v. LinkedIn* (9th Cir. 2022) confirmed scraping public pages with one's own browser does not violate CFAA.
- **MLS / NAR licensing**: Photos are ultimately MLS-sourced. RESO integration (already in place) is the licensed path for MLS members. The extension scraping is for the agent's own research use.
- **Scale matters**: Single agent using the tool personally → minimal enforcement risk. SaaS at scale → worth revisiting with a lawyer. This tool is currently scoped to individual agent use.
- **Recommendation**: Do not add any server-side proxy for tab-based scraping. Keep it strictly client-side (extension on the agent's browser).

---

## Performance Characteristics

| Scenario | Latency |
|----------|---------|
| Zillow direct (zpid, extension available) | ~8–12s (1 tab, 3s render wait) |
| Realtor/Redfin/Homes via search (extension available) | ~18–28s (2 tabs, 5.5s render waits) |
| RapidAPI fallback | ~1–3s |
| Extension not installed (RapidAPI only) | ~1–3s |

The photo download runs inside `securePropertyAssets`, which is part of the pipeline's "Cloud Storage" step and runs in parallel with other analysis calls. The 20s worst-case is acceptable in this context.

---

## Known Limitations & Future Work

1. **Selector drift**: If Realtor.com, Redfin, etc. change their listing URL structure (e.g., Redfin moved from `/home/ID` to `/listing/ID`), the regex patterns in `findFirstListingUrl` need updating. Add a monitoring alert if extension photo counts drop to zero.

2. **Search result relevance**: The 2-step approach takes the *first* listing link found. If the search returns a different property (nearby address, similar street name), we get wrong photos. Mitigation: validate that at least 3 photos are found before accepting, and consider address-matching validation in the injected script.

3. **Render time heuristics**: The 2500ms / 3000ms delays are empirical. Heavy JS frameworks (Redfin's React app) sometimes take longer. Consider adding a `MutationObserver` readiness check instead of a fixed delay.

4. **Trulia coverage**: Trulia is Zillow-owned and often shows the same Zillow CDN photos. If Zillow already succeeds, Trulia is redundant. Could skip Trulia when Zillow succeeds (currently handled by "stop at first success").

5. **Parallel source attempts**: Currently sequential. Could parallelize all sources and return the first to complete with ≥5 photos, reducing worst-case latency. Trade-off: more tabs opened simultaneously.
