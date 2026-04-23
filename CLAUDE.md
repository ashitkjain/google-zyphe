# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev           # Vite dev server on http://localhost:3000

# Build
npm run build         # Production build → dist/
npm run preview       # Preview production build

# Testing
npm run test:unit     # Vitest unit tests (jsdom environment)
npm run test:batch    # Integration tests against real Firebase (15-min timeout)
npm run test:e2e      # Playwright E2E tests (Chromium)
npm run test:e2e:ui   # Playwright with interactive UI

# Cloud Functions (from functions/ directory)
npm run lint          # ESLint for functions
npm run serve         # Firebase emulators
npm run deploy        # Deploy Cloud Functions

# Content generation (from scripts/)
npx tsx scripts/batch_generate_content.ts   # Generate 90 educational guides via Gemini
npx tsx scripts/seedGuides.ts               # Seed generated guides to Firestore
```

## Architecture Overview

**Stack:** React 19 + TypeScript SPA (Vite) → Firebase (Auth, Firestore, Storage, Hosting) + Google Cloud Functions (Node 22) + Gemini 2.5-flash AI core.

**AI Engine:** All Gemini orchestration lives in [services/geminiService.ts](services/geminiService.ts) (~1755 lines). It calls Gemini with structured JSON schema outputs, uses grounded search via the `googleSearch` tool, and caches results to Firestore. The primary model is `gemini-2.5-flash`.

**Analysis Pipeline:**
1. User searches property → RapidAPI (RealtyInUS) fetches listing data
2. `analyzePropertyImages()` → Gemini vision on listing photos → cached in Firestore
3. `analyzeNeighborhood()` / `analyzeCommunityPulse()` → map + context analysis → Firestore
4. `extractContextGraphFactors()` → precomputes 100+ factors ([utils/contextGraphPrecompute.ts](utils/contextGraphPrecompute.ts), 55KB) → stored for cross-cutting queries
5. `analyzeComprehensive()` → combines all sources → investment insights
6. All results cache in `properties/{zpid}/analysis/{type}` Firestore subcollections

**Firestore Layout:**
- `properties/{zpid}/analysis/{type}` — per-property analysis (normalized field names)
- `properties/{zpid}` — indexed on `(city, created_at)` and `(city, updated_at)`
- `app_config/` — central config (API keys, feature flags fetched at runtime)
- `guides/` — 90+ educational articles seeded from scripts
- `transactions/`, `communications/` — CRM/lead data

**Cloud Functions ([functions/index.js](functions/index.js), 48KB):** Webhook receivers for Zillow/Realtor/Facebook lead ingestion, Document AI PDF parsing, orientation detection batching (`orientationBatch.js`), and property batch processing (`propertyBatch.js`). Exposed at `/api/webhooks/*` via Firebase Hosting rewrites.

**Frontend Structure:**
- [App.tsx](App.tsx) (~1014 lines) — top-level state machine managing 20+ view modes, auth, property search
- [components/property/](components/property/) — 42 components for property details, maps, images, orientation
- [components/client-hub/](components/client-hub/) — dashboard, guides, cost calculator, leads CRM
- [services/firebase/](services/firebase/) — 31 files; [services/firebase/properties.ts](services/firebase/properties.ts) is the largest (~1988 lines)
- [types/](types/) — 17 TypeScript definition files; [types/lead.ts](types/lead.ts) and [types/property.ts](types/property.ts) are the primary domain types
- [prompts/property/](prompts/property/) — 30+ prompt template files, one per analysis type

**Config & Feature Flags:** [config.ts](config.ts) centralizes API keys (pulled from `import.meta.env.VITE_*`), `SUPPORTED_STATES` (currently `['CA']`), feature flags, and role-based tab access. App config also fetches from Firestore `app_config/` at runtime.

**External APIs (proxied in [vite.config.ts](vite.config.ts)):** RapidAPI (RealtyInUS property data), Google Maps/Street View, Radar (geolocation), Groq, Tomorrow.io (weather), RentCast (rentals), Foursquare Places, HowLoud (noise), Telnyx (communications), FEMA, USDM.

## Test Structure

- **Unit tests** (`*.test.ts`) — run in jsdom, mock Firebase, test component logic and utilities
- **Batch tests** (`*.batch.test.ts`) — run in Node, hit real Firestore, require `.env.local` with valid keys; 15-minute timeout
- **E2E tests** (`*.spec.ts`) — Playwright Chromium, full app interaction, HTML reports in `playwright-report/`

## Key Constraints

- Only California (`CA`) is supported; gating lives in `SUPPORTED_STATES` in [config.ts](config.ts)
- Gemini calls must use structured JSON schema outputs — see existing `analyzeX()` functions in [services/geminiService.ts](services/geminiService.ts) for the pattern
- Firestore field names are normalized (lowercase, underscores) — see [docs/schemaDefinitions.ts](docs/schemaDefinitions.ts)
- Vite proxies handle CORS for all external APIs in dev; do not call external APIs directly from frontend code without adding a proxy entry
- Scripts in [scripts/](scripts/) use `npx tsx` (no compilation step needed)
