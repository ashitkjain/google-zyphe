# Batch Pipeline Map

## Recommended Run Order

```
1. Property Data Batch    ← coordinates, listing data, env APIs, parcel, satellite
2. Asset Secure Batch     ← gallery images to Storage
3. Orientation Batch      ← street view to Storage + orientation AI + street insights
4. Full Intel Batch       ← all Gemini AI analysis (uses gallery + maps from above)
5. Narrative Batch        ← comprehensive text synthesis (uses visual output from above)
```

Dependencies are strict: Intel Batch needs gallery images (step 2) and street view (step 3). Narrative Batch needs visual analysis (step 4).

---

## Batch Functions

### 1. Property Data Batch
**Trigger:** `property_data_batch_jobs/{jobId}` · **Concurrency:** 2 · **Timeout:** 9 min

| Step | API | Output Location | Healing? |
|---|---|---|---|
| Listing specs | RapidAPI `/property` | `properties/{zpid}` (root doc) | Always re-fetches |
| Geocoding | Radar `/geocode/forward` | `properties/{zpid}.coordinates` | Always re-fetches |
| Tax sqft lookup | Gemini + Google Search | `properties/{zpid}.taxSqft` | Skips if taxSqft > 0 |
| Solar potential | Google Solar API | `env/thirdparty_data.solarData` | On every env refresh |
| Air quality | Google AQ API | `env/thirdparty_data.airQuality` | On every env refresh |
| Pollen forecast + AI analysis | Google Pollen API + Gemini | `env/thirdparty_data.pollen{score, analysis}` | On every env refresh |
| Noise score | OSM Overpass simulation | `env/thirdparty_data.zypheNoiseScore` | On every env refresh |
| Walk/Transit/Bike scores | WalkScore via RapidAPI | `properties/{zpid}.walkScore` etc | If missing |
| Parcel polygon + APN + area | ArcGIS county service | `properties/{zpid}.parcelPolygon` etc | If missing |
| Satellite image | Google Maps Static API → Storage | `properties/{zpid}.satelliteImageUrl` | If missing |
| Map zoom images | Radar Static API → Storage | `properties/{zpid}.mapZoomIn/Out` | If missing or not in Storage |
| Historical disasters | USGS + USGS Seismic | `env/thirdparty_data.historical_disasters` | If missing |
| Nearby places (POI) | Google Places API | `env/thirdparty_data.google_places` | If missing |
| Broadband coverage | BroadbandMap.com API | `env/thirdparty_data.broadband` | If missing |
| Drought monitor | FCC Census + USDM API | `env/thirdparty_data.drought` | If missing |
| EV chargers | NREL API | `env/thirdparty_data.evChargers` | If missing |
| Neighborhood identity | Gemini + ArcGIS Surveyor + City Plan | `properties/{zpid}.neighborhood_identity` | If resolved_name missing |

**Env doc TTL:** 30 days (`lastUpdated`). All supplemental fields (disasters, places, broadband, drought, EV) are fetch-once — only run if missing.

---

### 2. Asset Secure Batch
**Trigger:** `asset_secure_batch_jobs/{jobId}` · **Concurrency:** 1 (sequential) · **Timeout:** 9 min

| Step | API | Output Location | Healing? |
|---|---|---|---|
| Gallery images | RapidAPI `/images` → Storage | `analysis/assets.images[]` | Skips already-cached by originalUrl |

> Does NOT download street view, maps, or satellite — those are owned by Property Data Batch and Orientation Batch.

---

### 3. Orientation Batch
**Trigger:** `orientation_batch_jobs/{jobId}` · **Concurrency:** 20 · **Timeout:** 9 min

| Step | API | Output Location | Healing? |
|---|---|---|---|
| Street bearing | Google Maps Geocoding | (used for heading calc only) | Always |
| Aerial image | Google Maps Static → Storage | `properties/{zpid}.satelliteImageUrl` | If URL dead/expired |
| Street view image | Google Maps StreetView → Storage | `properties/{zpid}.streetView` | If URL dead/expired or missing |
| Roadmap image | Radar Static | (temp — sent to Gemini, not stored) | Always |
| Orientation AI | Gemini (aerial + SV + roadmap) | `properties/{zpid}.orientation_ai` | If version != v30 or stale |
| Street insights AI | Gemini (SV image only) | `analysis/visual.exterior_and_neighborhood.neighborhood_street_insights` | If missing (uses pre-loaded SV buffer — no re-download) |

**Image re-download note:** Aerial and street view are checked for liveness (HEAD request) before re-downloading. Street insights reuses the already-downloaded SV buffer from orientation pass — zero extra image fetches.

---

### 4. Full Intel Batch
**Trigger:** `full_intel_batch_jobs/{jobId}` · **Concurrency:** 5 · **Timeout:** 9 min

| Step | Inputs | Output Location | TTL / Healing? |
|---|---|---|---|
| Env healing | Google APIs (via `_enrichEnvironmentalData`) | `env/thirdparty_data` | If `lastUpdated` > 30 days |
| Street insights healing | SV from `propData.streetView` or `assets.streetView` | `analysis/visual.exterior_and_neighborhood.neighborhood_street_insights` | If missing AND visual pass didn't handle it (no re-download) |
| Visual AI pass | Gemini (gallery + maps from `analysis/assets`) | `analysis/visual` | If missing, incomplete, or stale (30d) |
| Lifestyle Insights | Gemini (property data) | `analysis/lifestyle_insights` | If missing or stale |
| Lifestyle Fit | Gemini (property data + visual) | `analysis/lifestyle_fit` | If missing or stale |
| Orientation pass | Gemini (aerial + SV — delegates to orientationBatch) | `properties/{zpid}.orientation_ai` | If not v30 or stale |
| Pollen AI healing | Gemini (pollen summary from env doc) | `env/thirdparty_data.pollen.analysis` | If pollen data exists but analysis missing |
| Context Graph | Gemini (property + visual + comprehensive) | `analysis/context_graph` | If missing or stale |
| Investment Research | Gemini (property data) | `analysis/investment` | If missing or stale |

**Image re-download note:** Visual pass downloads each image once. Street insights healing only runs when visual pass was skipped OR had no street view in `analysis/assets` — never downloads an image twice in the same run.

---

### 5. Narrative Batch
**Trigger:** `narrative_batch_jobs/{jobId}` · **Concurrency:** 10 · **Timeout:** 9 min

| Step | Inputs | Output Location | Healing? |
|---|---|---|---|
| Comprehensive analysis | Gemini (property data + visual) | `analysis/comprehensive` | Always re-runs (no TTL check — run intentionally) |

---

## Firestore Schema

### `properties/{zpid}` — Root Document
```
Core listing (RapidAPI):
  address, coordinates, city, state, zipCode
  homeType, bedrooms, bathrooms, livingAreaValue, yearBuilt
  price, listPrice, zestimate, description, images[]
  schools[], priceHistory[]
  floodRiskScore, fireRiskScore, heatRiskScore, windRiskScore   ← First Street via RapidAPI
  resoFacts{flooring, rooms, appliances, cooling, heating, ...}
  attribution{listingAgentName, brokerageName, mlsId, ...}

Parcel (ArcGIS):
  parcelPolygon, parcelApn, parcelAreaSqft, parcelCounty
  taxSqft, taxSqftSource     ← ArcGIS (Contra Costa) or Gemini grounded search
  taxSqftConfidence

Scores (WalkScore):
  walkScore, transitScore, bikeScore

Map assets (Google Maps/Radar → Storage):
  satelliteImageUrl          ← Storage URL
  mapZoomIn, mapZoomOut      ← Storage URLs
  streetView                 ← Storage URL (set by Orientation Batch)
  streetViewHeadingDeg

Orientation AI (Gemini):
  orientation_ai{final_orientation, azimuth_degrees, confidence, batch_version, ...}
  orientation_calculated_at

Neighborhood (Gemini + ArcGIS):
  neighborhood_identity{resolved_name, gemini{}, city_plan{}, surveyor_tract{}}
```

### `properties/{zpid}/environmental/thirdparty_data` — Env Document
```
lastUpdated                                 ← TTL anchor (30d)

solarData{maxSunshineHoursPerYear, panelCapacityWatts, maxArrayPanelsCount, carbonOffsetFactorKgPerMwh}
airQuality{aqi, category, dominantPollutant}
pollen{
  score, category, dominantPollenType       ← Google Pollen API
  analysis{                                 ← Gemini AI (run inline when pollen fetched)
    primary_triggers[], seasonality_window,
    breathe_easy_summary, maintenance_tip
  }
}
zypheNoiseScore, noiseCharacterization, primaryNoiseSource, noiseSimulationFetchedAt

historical_disasters{                       ← fetch-once (if missing)
  earthquakes[], seismicZone{designCategory, riskLevel, pga}, fetchedAt
}
google_places{cafes[], restaurants[], parks[], ...}  ← fetch-once
broadband{...}                              ← fetch-once
drought{...}                                ← fetch-once
evChargers{...}                             ← fetch-once

streetViewAnalysis (legacy — replaced by analysis/visual.neighborhood_street_insights)
```

### `properties/{zpid}/analysis/assets`
```
images[]           ← Storage URLs (gallery photos, from Asset Secure Batch)
imageMetadata{}    ← {[url]: {originalUrl}} for dedup
streetView         ← Storage URL (may be set by Property Batch map healing)
mapZoomIn          ← Storage URL
mapZoomOut         ← Storage URL
satelliteImageUrl  ← Storage URL
lastUpdated
```

> **Note:** `properties/{zpid}.streetView` (root doc) is the authoritative street view URL, set by Orientation Batch. `analysis/assets.streetView` may also be populated by Property Batch map healing. Intel Batch visual pass reads from `analysis/assets.streetView`.

### `properties/{zpid}/analysis/visual`
```
home_interior{
  overall_description     ← long-form interior narrative
  interior_summary        ← 2-3 sentence summary
  rooms_summary
  vibe
  design_style{style, ...}
  condition_and_finish
  room_highlights[]
  objective_tags[]
}
exterior_and_neighborhood{
  exterior_and_lot_appeal{architecture_style, curb_appeal, backyard_and_patio}
  views_privacy_orientation{privacy, views, ...}
  neighborhood_street_insights   ← set by Orientation Batch (inline, no extra download)
                                    or Intel Batch healing (if missing)
}
image_by_image_analysis[]
lastUpdated, version
```

### `properties/{zpid}/analysis/comprehensive`
```
summary             ← 500-1000 char narrative
risks_considerations
lastUpdated
```

### `properties/{zpid}/analysis/lifestyle_insights`
### `properties/{zpid}/analysis/lifestyle_fit`
### `properties/{zpid}/analysis/context_graph`
### `properties/{zpid}/analysis/investment`

---

## Image Download Map (Who Downloads What)

| Image | Downloaded By | Stored At | Re-used By |
|---|---|---|---|
| Gallery photos | Asset Secure Batch (RapidAPI) | `Storage: properties/{zpid}/gallery/img_*.jpg` | Intel Batch visual pass |
| Satellite/aerial | Property Data Batch (Google Maps Static) | `Storage: properties/{zpid}/maps/satellite.jpg` | Intel Batch visual pass, Orientation Batch (health check) |
| Map zoom-in | Property Data Batch (Radar) | `Storage: properties/{zpid}/maps/zoom_in.png` | Intel Batch visual pass |
| Map zoom-out | Property Data Batch (Radar) | `Storage: properties/{zpid}/maps/location_context.png` | Intel Batch visual pass |
| Street view | Orientation Batch (Google Maps StreetView) | `Storage: properties/{zpid}/maps/street_view.jpg` | Intel Batch visual pass, `_enrichStreetInsights` |

**Rule:** No batch downloads an image another batch already downloaded. Orientation Batch re-uses its street view buffer for street insights (no second fetch). Intel Batch healing for street insights only fires when the visual pass didn't process the street view.

---

## Smoke Test Check → Batch Owner

| Smoke Test Check | Severity | Fixed By |
|---|---|---|
| Property Type Support | error | — (listing quality, not fixable) |
| Core Listing (beds/baths/sqft/price) | error | Property Data Batch |
| Description | error | Property Data Batch |
| Coordinates | error | Property Data Batch |
| Walk/Transit/Bike Score | warn | Property Data Batch |
| Property Images | error | Asset Secure Batch |
| Map Zoom-In/Out (Storage) | error | Property Data Batch |
| Street View (Storage) | error | Orientation Batch |
| Satellite Image (Storage) | error | Property Data Batch |
| Parcel Polygon / APN / Area | warn | Property Data Batch |
| Tax Record Sqft | warn | Property Data Batch (ArcGIS or Gemini) |
| Solar API | warn | Property Data Batch |
| Air Quality API | warn | Property Data Batch |
| Pollen API | warn | Property Data Batch |
| Pollen AI Analysis | warn | Property Data Batch (inline) |
| Noise Score | warn | Property Data Batch |
| Nearby Places (POI) | warn | Property Data Batch |
| Seismic Zone / Earthquake History | warn | Property Data Batch |
| AI Visual — Interior | error | Full Intel Batch |
| AI Visual — Exterior | error | Full Intel Batch |
| AI Neighborhood/Spatial | error | Orientation Batch (primary), Full Intel Batch (healing) |
| Front Orientation AI | warn | Orientation Batch (or Full Intel Batch delegates) |
| Street View AI | warn | (legacy env field — `neighborhood_street_insights` replaces this) |
| Narrative Summary | error | Narrative Batch |
| Risks & Considerations | error | Narrative Batch |
| Interior Summary / Rooms / Vibe / Tags | error/warn | Full Intel Batch |
| AI Context Graph | warn | Full Intel Batch |
| Community Pulse | warn | City-level batch (separate) |
| MIT Living Wage | warn | City-level batch (separate) |
