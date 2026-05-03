# Property Load Optimization Plan

Continuation of the property-load optimization work. Items #1–#4 below are
**done**; items #5–#12 are queued for the next session. The original
investigation is in chat history (2026-05-02). All file references use
`path:line` so navigation stays sharp.

## Done (this session)

| # | Change | Files |
|---|---|---|
| 1 | HowLoud removed from page-load path; `needsZypheNoise` TTL bug fixed; `_enrichFaults` added to heal pipeline; load-time SV gate relaxed; RapidAPI `/images` no longer called at load (reads `properties/{zpid}/analysis/assets` instead) | `services/api/propertyDataFull.ts`, `functions/shared/propertyUtils.js`, `functions/diagEnv.js` |
| 2 | Parcel + satellite blocks deleted from page-load path (already in heal pipeline as `_enrichParcelData`, `_enrichSatelliteImage`) | `services/api/propertyDataFull.ts` |
| 3 | ExploreTab cache reads kicked off in parallel with `fetchPropertyDataFull`; both consumers go through `prefetchExploreCache` (deduped) | `services/exploreCachePrefetch.ts` (new), `services/api/propertyDataFull.ts`, `components/property/hooks/useExploreTabData.ts` |
| 4 | Property doc save skipped when `mainDocDirty` is false; `loadAddressIndex` and `useSearchTrie` memoized at module level (kills duplicate `[AddressIndex] Loaded`) | `services/api/propertyDataFull.ts`, `services/firebase/properties.ts`, `hooks/useSearchTrie.ts` |

## To Do (next session)

### 5. Stop persisting `__pipeline_timings`
- **Where:** `services/api/propertyDataFull.ts` — `_mark('COMPLETE')` block. The
  `_timings` array is attached to `mappedData` for in-page diagnostics, then
  `savePropertyToCloud(mappedData, ...)` may serialize it back to Firestore.
- **Fix:** delete `(mappedData as any).__pipeline_timings` from the in-memory
  object before any save call (or move it onto a side channel like
  `(window as any).__lastPipelineTimings`).
- **Impact:** removes a noisy field from every property doc; small Firestore
  cost win.

### 6. Move orientation ground-truth fetch into the parallel block
- **Where:** `services/api/propertyDataFull.ts:586-597`
  (`getPropertyGroundTruth(zpid)` runs sequentially after `COMPLETE`).
- **Fix:** add it to the `Promise.all` that fetches scores/images/places at
  line ~141. (Note: prefetchExploreCache also fetches ground truth — if we go
  this route, drop one of the two callers to avoid a duplicate read.)
- **Impact:** removes a serial Firestore round-trip (~80–200ms).

### 7. Pre-warm the first 1–2 gallery images
- **Where:** the component that renders the gallery on the property page.
  Asset URLs come back from `getPropertyAssetsFromCloud` as
  `https://firebasestorage.googleapis.com/...`.
- **Fix:** emit `<link rel="preload" as="image" href="...">` in the page head
  (or via `<img loading="eager" fetchpriority="high">`) for `images[0]` and
  `images[1]` as soon as the assets doc resolves, before React renders the
  carousel.
- **Impact:** perceived load — first photo visible 300–700ms sooner.

### 8. Drop `cache: 'no-store'` from `fetchPropertyImages`
- **Where:** `services/api/property.ts:146`.
- **Fix:** delete the `cache: 'no-store'` option. RapidAPI responses are
  cacheable by HTTP semantics; the flag forces a network round-trip on every
  invocation (still happens in the heal/batch path, even after item #1).
- **Impact:** ~100–400ms per heal/batch image fetch.

### 9. `logAPICall` inline-await is a hidden serial dependency
- **Where:** `services/api/propertyDataFull.ts:359-367`,
  `services/api/property.ts:130-137`, and similar — every external fetch is
  preceded by `const logId = await logAPICall(...)`, which writes a Firestore
  doc *before* the actual external request starts.
- **Fix options:**
  - (a) Make `logAPICall` fire-and-forget that returns a synthetic id; do the
    update via the same id. Cost: an `updateDoc` on a doc that may not yet
    exist — use `setDoc(..., { merge: true })` instead of `updateDoc`.
  - (b) Batch all log writes through a `requestIdleCallback` flush queue.
- **Impact:** 50–150ms saved before *each* external API call; on a load with
  6+ parallel fetches this can shave ~300ms off the wall clock.

### 10. Single-shot config / API-key load
- **Where:** `config.ts` runtime fetch (image 1 in chat showed 9 separate
  `getDoc` calls just to read keys).
- **Fix:** consolidate all keys into one document (`app_config/api_keys`),
  read once at app boot, store in module state. Add a `Promise<Config>`
  singleton so first read primes everyone.
- **Impact:** ~9 Firestore reads → 1; ~200–500ms off cold start.

### 11. TTL audit symmetry
- **Where:** `services/api/propertyDataFull.ts:215-217` — `needsSolar`,
  `needsAirQual`, `needsPollen` still compare against `cachedEnvData.lastUpdated`
  (the doc-wide stamp), the same flaw we fixed for `needsZypheNoise`. One
  rewrite of the doc resets all three TTLs; conversely, if the doc isn't
  rewritten for 60 days, all three refetch even when their underlying data is
  fresh.
- **Fix:** either (a) give each its own per-field timestamp, or (b) accept
  the doc-wide stamp and remove per-field `fetchedAt` checks for consistency
  (broadband/drought/etc. use per-field stamps).
- **Impact:** consistency + prevents future silent refetch storms.

### 12. Smoke-test "zero-fetch" assertion
- **Where:** `services/smokeTest.ts` plus a new top-level counter.
- **Fix:** expose `window.__loadFetchCount` (incremented inside
  `fetchPropertyDataFull` whenever a `needsX` is true). Smoke runner reloads
  a healed property and asserts the counter is 0 after `COMPLETE`.
- **Impact:** regression guard. The bugs we just fixed snuck in because
  nothing tested "warm property → zero external calls."

## Quick reference: load-time invariants we just established

A clean (smoke-healed) property load should now perform:

- **1** Firestore read: `properties/{zpid}` (cache HIT)
- **3** parallel Firestore reads at top of pipeline: scores/places, env doc, assets doc
- **8** parallel Firestore reads via `prefetchExploreCache` (visual / investment / deep research / community pulse / interior / ground truth / env / fema)
- **0** external API calls
- **0** Gemini calls
- **0** Firestore writes (envPayload, property doc, assets — all skipped via dirty flags)

Anything more on a healed property is a regression — that's what item #12 is
designed to catch.
