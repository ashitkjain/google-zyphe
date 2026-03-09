/**
 * Zyphe Firestore Schema Definitions
 *
 * Single source of truth for all Firestore collection schemas.
 * This file is rendered by PlatformHelpTab.tsx → Database Schema section.
 *
 * HOW TO UPDATE:
 *   1. When you add/rename/remove a Firestore field in services/firebase/*, update here too.
 *   2. Bump SCHEMA_LAST_UPDATED to today's date (YYYY-MM-DD).
 *   3. The help page will show the new date on next load/refresh.
 */

export const SCHEMA_LAST_UPDATED = '2026-03-09';

export type FieldSource =
    | 'zillow'
    | 'reso'
    | 'gemini'
    | 'arcgis'
    | 'google'
    | 'radar'
    | 'manual'
    | 'system'
    | 'firebase';

export interface SchemaField {
    name: string;
    type: string;
    source: FieldSource;
    description: string;
    usedBy?: string;
    children?: SchemaField[];
}

export interface CollectionSchema {
    name: string;
    icon: string;
    color: string;
    docId: string;
    description: string;
    fields: SchemaField[];
}

// ── Tier 1: Core Property Intelligence (keyed by zpid) ────────────────────────

export const propertyCollections: CollectionSchema[] = [
    {
        name: 'properties',
        icon: 'fa-house',
        color: 'bg-indigo-100 text-indigo-600',
        docId: '{zpid}',
        description: 'Master property document. Contains all listing data, parcel info, scores, and cached API responses.',
        fields: [
            { name: 'zpid', type: 'string', source: 'zillow', description: 'Zillow / MLS property ID. Used as the Firestore document ID.', usedBy: 'All collections, all lookups' },
            { name: 'address', type: 'string', source: 'radar', description: 'Normalised full address string written by Radar geocode layer.', usedBy: 'Gemini prompts, ArcGIS lookup, display' },
            { name: 'city / state / zip', type: 'string', source: 'radar', description: 'Address components split from Radar geocode response.' },
            { name: 'coordinates', type: '{ latitude, longitude }', source: 'radar', description: 'Lat/lng for the property.', usedBy: 'Solar, Air Quality, Pollen, Places APIs, map assets' },
            { name: 'listPrice', type: 'number', source: 'zillow', description: 'Canonical price. Normalised from price / list_price / ListPrice aliases on write.', usedBy: 'ARV delta, property card, smoke test' },
            { name: 'bedrooms', type: 'number', source: 'zillow', description: 'Bedroom count from MLS.', usedBy: 'Gemini prompts, smoke test' },
            { name: 'bathrooms', type: 'number', source: 'zillow', description: 'Bathroom count from MLS.', usedBy: 'Gemini prompts, smoke test' },
            { name: 'squareFootage', type: 'number', source: 'zillow', description: 'Canonical living area. Normalised from sqft / LivingArea / square_footage.', usedBy: 'ARV calc, parcel discrepancy, smoke test' },
            { name: 'lotSize', type: 'number', source: 'zillow', description: 'Lot size in sqft.', usedBy: 'Comp tier scoring, usable lot calc' },
            { name: 'yearBuilt', type: 'number', source: 'zillow', description: 'Year of construction.', usedBy: 'Gemini prompts, smoke test' },
            { name: 'homeType', type: 'string', source: 'zillow', description: '"SINGLE_FAMILY" | "TOWNHOUSE" | "CONDO" etc.' },
            { name: 'homeStatus', type: 'string', source: 'zillow', description: '"FOR_SALE" | "SOLD" | "PENDING". Used to guard the Off Market banner.', usedBy: 'ExploreTab deprecated banner' },
            { name: 'description', type: 'string', source: 'zillow', description: 'Full MLS listing text. Core input for Distressed AI analysis.', usedBy: 'Gemini prompts, Distressed Finder' },
            { name: 'images', type: 'string[]', source: 'firebase', description: 'Firebase Storage URLs of downloaded listing photos.', usedBy: 'Visual AI, property photo carousel' },
            { name: 'comps', type: 'object[]', source: 'zillow', description: 'Recently sold comparable properties from Zillow.', usedBy: 'Distressed Finder ARV worksheet' },
            { name: 'walkScore / transitScore / bikeScore', type: 'number', source: 'google', description: 'Walk Score API scores (0-100).', usedBy: 'ExploreTab scores card, smoke test' },
            { name: 'apn', type: 'string', source: 'arcgis', description: "Assessor's Parcel Number from county ArcGIS.", usedBy: 'ParcelValidationCard, smoke test' },
            { name: 'parcelPolygon', type: 'object[]', source: 'arcgis', description: 'GeoJSON polygon vertices [{lat, lng}]. Cached; ArcGIS skipped if already present.', usedBy: 'Map overlay, polygon area calc, smoke test' },
            { name: 'parcelArea', type: 'number', source: 'arcgis', description: 'Lot area in sqft with cos²(lat) geodetic correction for Web Mercator.', usedBy: 'ParcelValidationCard lot discrepancy flag' },
            { name: 'taxSqft', type: 'number', source: 'arcgis', description: 'Official assessed living area. 3-tier cascade: (1) cached, (2) ArcGIS buildingSqft, (3) Gemini Search.', usedBy: 'Phantom sqft detection (>10% flag), smoke test' },
            { name: 'taxSqftSource', type: 'string', source: 'system', description: 'Provenance label e.g. "ArcGIS Alameda County" or "Alameda County Assessor".', usedBy: 'ParcelValidationCard source label' },
            { name: 'taxSqftConfidence', type: 'string', source: 'gemini', description: '"high" | "medium" | "low" from Gemini taxRecordLookup response.' },
            {
                name: 'orientation_ai', type: 'object', source: 'gemini',
                description: 'AI-computed facing direction from satellite + street view.',
                usedBy: 'Exterior tab orientation card',
                children: [
                    { name: 'final_orientation', type: 'string', source: 'gemini', description: 'e.g. "South"' },
                    { name: 'azimuth_degrees', type: 'number', source: 'gemini', description: 'Precise compass bearing in degrees' },
                    { name: 'confidence', type: 'string', source: 'gemini', description: '"high" | "medium" | "low"' },
                    { name: 'feng_shui_vastu', type: 'string', source: 'gemini', description: 'Cultural orientation insight' },
                    { name: 'buyer_pro / buyer_con', type: 'string', source: 'gemini', description: 'Orientation pros and cons for buyer' },
                ]
            },
            { name: 'deprecated', type: 'boolean', source: 'system', description: 'Set by Refresh Active Listings sweep when property goes off market. Auto-cleared when homeStatus=FOR_SALE.', usedBy: 'ExploreTab Off Market banner' },
            { name: 'deprecatedAt', type: 'timestamp', source: 'system', description: 'When the deprecated flag was set. Cleared alongside deprecated field.' },
            { name: 'lastUpdated', type: 'timestamp', source: 'system', description: 'Firestore serverTimestamp on every savePropertyToCloud call.' },
            { name: 'alternate_ids', type: 'string[]', source: 'system', description: 'MLS IDs and other source identifiers for deduplication lookups.' },
        ]
    },
    {
        name: 'property_assets',
        icon: 'fa-images',
        color: 'bg-sky-100 text-sky-600',
        docId: '{zpid}',
        description: 'Firebase Storage URLs for all map tiles, street view, and satellite images. Kept separate to avoid bloating the main properties doc.',
        fields: [
            { name: 'mapZoomIn', type: 'string', source: 'firebase', description: 'Close-up Radar map tile URL.', usedBy: 'Neighbourhood Gemini prompt, ExploreTab map tab, smoke test' },
            { name: 'mapZoomOut', type: 'string', source: 'firebase', description: 'Wide-area Radar map tile URL.', usedBy: 'Neighbourhood analysis prompt, smoke test' },
            { name: 'streetView', type: 'string', source: 'firebase', description: 'Google Street View image URL.', usedBy: 'Street view AI analysis, Exterior tab, smoke test' },
            { name: 'satellite', type: 'string', source: 'firebase', description: 'Aerial satellite image URL.', usedBy: 'Satellite orientation AI, smoke test' },
            { name: 'lastUpdated', type: 'timestamp', source: 'system', description: 'Timestamp of last asset refresh.' },
        ]
    },
    {
        name: 'property_analyses_visual',
        icon: 'fa-brain',
        color: 'bg-violet-100 text-violet-600',
        docId: '{zpid}',
        description: 'All Gemini visual + neighbourhood AI output. Separate collection avoids the 1MB Firestore doc size limit.',
        fields: [
            {
                name: 'home_interior', type: 'object', source: 'gemini',
                description: 'Room-by-room interior condition analysis.',
                usedBy: 'Interior tab, Distressed Finder card, smoke test',
                children: [
                    { name: 'overall_description', type: 'string', source: 'gemini', description: 'Full paragraph summary of interior condition' },
                    { name: 'condition_score', type: 'number', source: 'gemini', description: '1-10 overall interior quality score' },
                    { name: 'room_details', type: 'object[]', source: 'gemini', description: 'Per-room analysis array' },
                ]
            },
            {
                name: 'exterior_and_neighborhood', type: 'object', source: 'gemini',
                description: 'Exterior condition and neighbourhood character from listing images.',
                usedBy: 'Exterior tab, smoke test',
                children: [
                    { name: 'architecture_style', type: 'string', source: 'gemini', description: 'e.g. "Craftsman bungalow"' },
                    { name: 'curb_appeal_score', type: 'number', source: 'gemini', description: '1-10 curb appeal score' },
                    { name: 'lot_appeal', type: 'string', source: 'gemini', description: 'Description of lot and landscaping' },
                ]
            },
            { name: 'room_highlights', type: 'object[]', source: 'gemini', description: 'Notable rooms with AI descriptions.', usedBy: 'Property page image carousel callouts' },
            { name: 'image_by_image_analysis', type: 'object[]', source: 'gemini', description: 'Per-image AI notes.', usedBy: 'Image gallery tooltips' },
            {
                name: 'neighborhood', type: 'object', source: 'gemini',
                description: 'Spatial/map AI analysis. Populated from map images + neighborhoodPlaces context.',
                usedBy: 'Explore tab Neighbourhood section, smoke test',
                children: [
                    { name: 'walkability_insights', type: 'string', source: 'gemini', description: 'AI walkability commentary' },
                    { name: 'transit_quality', type: 'string', source: 'gemini', description: 'Transit accessibility assessment' },
                    { name: 'poi_highlights', type: 'string', source: 'gemini', description: 'Nearby POI commentary derived from neighborhoodPlaces' },
                    { name: 'overall_score', type: 'number', source: 'gemini', description: '1-10 neighbourhood quality score' },
                ]
            },
            {
                name: 'street_view_analysis', type: 'object', source: 'gemini',
                description: 'AI analysis of street-level image. Auto-triggered on first Exterior tab visit.',
                usedBy: 'Exterior tab Street View card, smoke test',
                children: [
                    { name: 'curb_appeal', type: 'string', source: 'gemini', description: 'Curb appeal from street view perspective' },
                    { name: 'street_condition', type: 'string', source: 'gemini', description: 'Road and pavement quality' },
                    { name: 'safety_signals', type: 'string', source: 'gemini', description: 'Visual safety observations' },
                ]
            },
        ]
    },
    {
        name: 'property_analyses_comprehensive',
        icon: 'fa-file-lines',
        color: 'bg-emerald-100 text-emerald-600',
        docId: '{zpid}',
        description: 'Gemini narrative synthesis. Combines visual + market + investment context into a full written property report.',
        fields: [
            { name: 'executive_summary', type: 'string', source: 'gemini', description: '3-4 paragraph property narrative.', usedBy: 'Explore tab Investment Research section' },
            { name: 'investment_highlights', type: 'string[]', source: 'gemini', description: 'Bulleted upside points.' },
            { name: 'risk_factors', type: 'string[]', source: 'gemini', description: 'Bulleted risk points.' },
            {
                name: 'renovation_strategy', type: 'object', source: 'gemini',
                description: 'Itemised renovation plan with costs and ROI projections.',
                usedBy: 'Explore tab renovation card, Distressed Finder',
                children: [
                    { name: 'already_done', type: 'object[]', source: 'gemini', description: '{ item, category, estimated_value } — completed renovations from listing text' },
                    { name: 'suggested', type: 'object[]', source: 'gemini', description: '{ item, cost, value_add, roi_pct } — high-ROI recommendations' },
                    { name: 'total_estimated_cost', type: 'number', source: 'gemini', description: 'Sum of all suggested renovation costs' },
                ]
            },
        ]
    },
    {
        name: 'google_environmental_data',
        icon: 'fa-sun',
        color: 'bg-amber-100 text-amber-600',
        docId: '{zpid or address slug}',
        description: 'Solar, Air Quality, Pollen, and Noise API results. Cached indefinitely — environmental data changes slowly.',
        fields: [
            {
                name: 'solar', type: 'object', source: 'google',
                description: 'Google Solar API panel-level roof analysis.',
                usedBy: 'ExploreTab Solar card, Help > Solar Methodology, smoke test',
                children: [
                    { name: 'yearlyEnergyDcKwh', type: 'number', source: 'google', description: 'Total raw DC energy production per year in kWh' },
                    { name: 'usableRoofArea', type: 'number', source: 'google', description: 'Usable panel area in m²' },
                    { name: 'panelCount', type: 'number', source: 'google', description: 'Feasible 400W panel spots identified on the roof' },
                    { name: 'solarPotential', type: 'string', source: 'google', description: '"HIGH" | "MEDIUM" | "LOW"' },
                    { name: 'sunshineQuantiles', type: 'number[]', source: 'google', description: 'Percentile distribution of annual sunshine hours across roof panels' },
                ]
            },
            {
                name: 'airQuality', type: 'object', source: 'google',
                description: 'Google Air Quality API current readings.',
                usedBy: 'AirQualitySection component, smoke test',
                children: [
                    { name: 'aqi', type: 'number', source: 'google', description: 'Air Quality Index (0-500)' },
                    { name: 'category', type: 'string', source: 'google', description: '"Good" | "Moderate" | "Unhealthy" etc.' },
                    { name: 'dominantPollutant', type: 'string', source: 'google', description: 'e.g. "pm25"' },
                ]
            },
            {
                name: 'pollen', type: 'object', source: 'google',
                description: 'Google Pollen API + Gemini interpretation.',
                usedBy: 'ExploreTab Pollen card, smoke test',
                children: [
                    { name: 'grass / tree / weed', type: 'object', source: 'google', description: '{ count, risk } per pollen type' },
                    { name: 'pollenAiSummary', type: 'string', source: 'gemini', description: 'Gemini plain-language pollen commentary' },
                ]
            },
            { name: 'noise', type: 'object', source: 'google', description: '{ noiseScore (0-100), noiseDescription }.', usedBy: 'ExploreTab Noise card, smoke test' },
            {
                name: 'neighborhoodPlaces', type: 'object', source: 'google',
                description: 'Google Places Nearby Search results. 30-day TTL cache — skipped on load if fresh.',
                usedBy: 'neighborhoodAnalysis Gemini prompt, smoke test',
                children: [
                    { name: 'restaurants', type: 'NearbyPlace[]', source: 'google', description: 'Up to 5 nearby restaurants' },
                    { name: 'groceries', type: 'NearbyPlace[]', source: 'google', description: 'Up to 5 nearby grocery stores' },
                    { name: 'parks', type: 'NearbyPlace[]', source: 'google', description: 'Up to 5 nearby parks' },
                    { name: 'transit', type: 'NearbyPlace[]', source: 'google', description: 'Up to 5 nearby transit stops' },
                    { name: 'fitness', type: 'NearbyPlace[]', source: 'google', description: 'Up to 5 gyms / fitness centres' },
                    { name: 'schools', type: 'NearbyPlace[]', source: 'google', description: 'Up to 5 nearby schools' },
                    { name: 'cafes', type: 'NearbyPlace[]', source: 'google', description: 'Up to 5 nearby cafes' },
                    { name: 'fetchedAt', type: 'number', source: 'system', description: 'Unix ms timestamp — TTL anchor for 30-day cache guard' },
                ]
            },
            { name: 'cachedAt', type: 'timestamp', source: 'system', description: 'When this environmental data document was last populated.' },
            { name: 'lastUpdated', type: 'timestamp', source: 'system', description: 'Firestore serverTimestamp on every saveGoogleDataToCloud call.' }
        ]
    },
    {
        name: 'sold_or_unlisted_properties',
        icon: 'fa-house-circle-xmark',
        color: 'bg-rose-100 text-rose-600',
        docId: '{zpid}',
        description: 'Tombstone records for properties that went off market. Written by Refresh Active Listings sweep.',
        fields: [
            { name: 'address', type: 'string', source: 'system', description: 'Property address at time of deprecation.' },
            { name: 'zipCode', type: 'string', source: 'system', description: 'Zip code for grouping.' },
            { name: 'deprecatedAt', type: 'timestamp', source: 'system', description: 'When the sweep flagged this property as off market.', usedBy: 'CityDataTab sweep results' },
            { name: 'lastKnownPrice', type: 'number', source: 'zillow', description: 'List price at time of deprecation.' },
            { name: 'reason', type: 'string', source: 'system', description: '"NOT_FOUND_IN_LISTING" | "STATUS_CHANGED"' },
        ]
    },
];

// ── Tier 2: City & Market Intelligence (keyed by cityStateKey or zip) ─────────

export const cityCollections: CollectionSchema[] = [
    {
        name: 'city_zip_cache',
        icon: 'fa-map-pin',
        color: 'bg-slate-900 text-white',
        docId: '{cityStateKey} e.g. "oakland_ca"',
        description: 'Maps a city to all zip codes and their property ID lists. Top-level index for city-wide scans.',
        fields: [
            {
                name: 'zips (subcollection)', type: 'collection', source: 'system',
                description: 'Subcollection keyed by zip code string.',
                usedBy: 'CityDataTab listing fetch, smoke test',
                children: [
                    { name: 'zpids', type: 'string[]', source: 'system', description: 'All property IDs in this zip from the latest scan.' },
                    { name: 'fetchedAt', type: 'timestamp', source: 'system', description: 'When this zip was last scanned.' },
                    { name: 'listingCount', type: 'number', source: 'system', description: 'Total active listings found in this zip.' },
                ]
            },
        ]
    },
    {
        name: 'zip_listings_cache',
        icon: 'fa-list',
        color: 'bg-slate-100 text-slate-600',
        docId: '{zip}',
        description: 'Raw MLS/Zillow listing objects for a zip code from the most recent city scan.',
        fields: [
            { name: 'listings', type: 'object[]', source: 'zillow', description: 'Raw listing objects as returned by the Zillow/RESO scan.', usedBy: 'CityDataTab listing display, ingestion queue' },
            { name: 'fetchedAt', type: 'timestamp', source: 'system', description: 'Timestamp of the most recent scan for this zip.' },
        ]
    },
    {
        name: 'community_pulse',
        icon: 'fa-city',
        color: 'bg-teal-100 text-teal-600',
        docId: '{cityStateKey}',
        description: 'City-level urban pulse research. Currently disabled in the pipeline due to Gemini concurrency limits.',
        fields: [
            { name: 'status', type: 'string', source: 'system', description: '"completed" | "running" | "failed". Prevents duplicate concurrent runs.' },
            { name: 'overview', type: 'string', source: 'gemini', description: 'City character and lifestyle summary.', usedBy: 'Explore tab Community Pulse section' },
            { name: 'walkability / transit / demographics', type: 'object', source: 'gemini', description: 'Structured city-level data sub-objects.' },
            { name: 'lastRan', type: 'timestamp', source: 'system', description: 'When the pipeline last ran. Stale-check: >15min since lastRan = crashed, skip wait.' },
        ]
    },
    {
        name: 'general_market_intelligence',
        icon: 'fa-chart-line',
        color: 'bg-blue-100 text-blue-600',
        docId: '{cityStateKey}',
        description: 'City-level investment market analysis. Currently disabled in pipeline.',
        fields: [
            { name: 'status', type: 'string', source: 'system', description: '"completed" | "running" | "failed".' },
            { name: 'price_trends', type: 'object', source: 'gemini', description: 'Monthly median $/sqft trend data.' },
            { name: 'inventory_analysis', type: 'object', source: 'gemini', description: 'Supply and demand signals.' },
            { name: 'investment_outlook', type: 'string', source: 'gemini', description: 'Narrative market outlook paragraph.', usedBy: 'Explore tab Market Intelligence section' },
            { name: 'lastRan', type: 'timestamp', source: 'system', description: 'Stale-check anchor (>15min = crashed).' },
        ]
    },
    {
        name: 'deep_investment_research',
        icon: 'fa-magnifying-glass-chart',
        color: 'bg-purple-100 text-purple-600',
        docId: '{cityStateKey}',
        description: "Long-form deep research on a city's investment climate. Triggered manually via \"Run City Research\" in CityDataTab.",
        fields: [
            { name: 'status', type: 'string', source: 'system', description: '"completed" | "running" | "failed".' },
            { name: 'executive_brief', type: 'string', source: 'gemini', description: 'City investment summary paragraph.' },
            { name: 'opportunity_score', type: 'number', source: 'gemini', description: '0-100 investment opportunity score.', usedBy: 'Explore tab Investment Research > Deep Research' },
            { name: 'risk_factors', type: 'string[]', source: 'gemini', description: 'City-level risk bullet points.' },
            { name: 'neighborhood_breakdown', type: 'object[]', source: 'gemini', description: 'Per-neighbourhood investment analysis.' },
            { name: 'lastRan', type: 'timestamp', source: 'system', description: 'Research run timestamp.' },
        ]
    },
    {
        name: 'best_practices',
        icon: 'fa-book-open',
        color: 'bg-amber-100 text-amber-600',
        docId: 'auto-id',
        description: 'Admin-curated guide content shown in this help section.',
        fields: [
            { name: 'title', type: 'string', source: 'manual', description: 'Guide title.' },
            { name: 'content', type: 'string', source: 'manual', description: 'Markdown or HTML content body.', usedBy: 'PlatformHelpTab' },
            { name: 'category', type: 'string', source: 'manual', description: 'Help category grouping key.' },
            { name: 'createdAt', type: 'timestamp', source: 'system', description: 'Creation timestamp.' },
        ]
    },
];

// ── Tier 3: CRM & Transactions ─────────────────────────────────────────────────

export const crmCollections: CollectionSchema[] = [
    {
        name: 'leads',
        icon: 'fa-user',
        color: 'bg-indigo-100 text-indigo-600',
        docId: 'auto-id',
        description: 'Individual lead/contact records per realtor.',
        fields: [
            { name: 'realtorId', type: 'string', source: 'system', description: 'Owner realtor Firebase UID.' },
            { name: 'name / email / phone', type: 'string', source: 'manual', description: 'Contact details.' },
            { name: 'status', type: 'string', source: 'manual', description: '"active" | "inactive" | "closed"' },
            { name: 'source', type: 'string', source: 'manual', description: '"manual" | "import" | "referral"' },
            { name: 'isMock', type: 'boolean', source: 'system', description: 'true for seed/demo data — excluded from real queries.' },
        ]
    },
    {
        name: 'transactions',
        icon: 'fa-handshake',
        color: 'bg-emerald-100 text-emerald-600',
        docId: 'auto-id',
        description: 'Real estate transaction records with full lifecycle tracking.',
        fields: [
            { name: 'realtorId / owner_user_id', type: 'string', source: 'system', description: 'Owner UIDs for the transaction.' },
            { name: 'address', type: 'string', source: 'manual', description: 'Property address for this transaction.' },
            { name: 'status', type: 'string', source: 'manual', description: '"escrow" | "closed" | "active"' },
            { name: 'listPrice / closePrice', type: 'number', source: 'manual', description: 'Listing and final sale prices.' },
            { name: 'closeDate', type: 'timestamp', source: 'manual', description: 'Closing date.' },
            { name: 'participants', type: 'string[]', source: 'system', description: 'Firebase UIDs of all parties involved.' },
        ]
    },
    {
        name: 'transaction_documents',
        icon: 'fa-file',
        color: 'bg-sky-100 text-sky-600',
        docId: 'auto-id',
        description: 'Documents (PDFs, contracts) attached to a transaction.',
        fields: [
            { name: 'transaction_id', type: 'string', source: 'system', description: 'Parent transaction ID reference.' },
            { name: 'name', type: 'string', source: 'manual', description: 'Document display name.' },
            { name: 'url', type: 'string', source: 'firebase', description: 'Firebase Storage URL.' },
            { name: 'uploadedBy', type: 'string', source: 'system', description: 'UID of the uploader.' },
        ]
    },
    {
        name: 'transaction_parties',
        icon: 'fa-users',
        color: 'bg-teal-100 text-teal-600',
        docId: 'auto-id',
        description: 'Buyers, sellers, agents, and escrow officers linked to a transaction.',
        fields: [
            { name: 'transaction_id', type: 'string', source: 'system', description: 'Parent transaction ID reference.' },
            { name: 'role', type: 'string', source: 'manual', description: '"buyer" | "seller" | "agent" | "escrow"' },
            { name: 'name / email / phone', type: 'string', source: 'manual', description: 'Contact details for this party.' },
        ]
    },
    {
        name: 'users',
        icon: 'fa-user-gear',
        color: 'bg-slate-100 text-slate-600',
        docId: '{uid}',
        description: 'Realtor user profiles with subcollections for view history and favourites.',
        fields: [
            { name: 'email / displayName', type: 'string', source: 'firebase', description: 'Auth-synced user info.' },
            { name: 'role', type: 'string', source: 'manual', description: '"admin" | "auditor" | "realtor"', usedBy: 'Admin guards in OrientationAuditTab' },
            { name: 'connectivity', type: 'string', source: 'system', description: '"online" | "offline" presence state.' },
            {
                name: 'viewHistory (subcollection)', type: 'collection', source: 'system',
                description: 'Properties the user has viewed.',
                usedBy: 'Recently viewed carousel',
                children: [
                    { name: 'zpid', type: 'string', source: 'system', description: 'Viewed property ID' },
                    { name: 'viewedAt', type: 'timestamp', source: 'system', description: 'When the property was viewed' },
                ]
            },
            {
                name: 'favorites (subcollection)', type: 'collection', source: 'manual',
                description: 'Saved/favourited properties.',
                children: [
                    { name: 'zpid', type: 'string', source: 'manual', description: 'Saved property ID' },
                    { name: 'savedAt', type: 'timestamp', source: 'system', description: 'When the property was saved' },
                ]
            },
        ]
    },
    {
        name: 'reactivation_analysis_summary / market_context / lead_plans',
        icon: 'fa-rotate',
        color: 'bg-rose-100 text-rose-600',
        docId: 'auto-id',
        description: 'AI-generated lead reactivation analysis, market snapshots, and personalised re-engagement touchpoint plans.',
        fields: [
            { name: 'reactivation_analysis_summary', type: 'object', source: 'gemini', description: 'High-level summary of dormant leads and reactivation strategy per realtor.' },
            { name: 'market_context', type: 'object', source: 'gemini', description: 'City-level price and inventory snapshot used to inform reactivation messages.' },
            { name: 'lead_plans', type: 'object', source: 'gemini', description: 'Touchpoint plan per lead: { leadId, plan, touchpoints: [{day, channel, message}] }' },
        ]
    },
];

// ── Tier 4: Platform Operations ────────────────────────────────────────────────

export const opsCollections: CollectionSchema[] = [
    {
        name: 'llm_call_events',
        icon: 'fa-microchip',
        color: 'bg-violet-100 text-violet-600',
        docId: 'auto-id',
        description: 'Full audit log of every Gemini API call. Created before every executeGeminiRequest(). Updated with response, cost, and token counts on completion.',
        fields: [
            { name: 'user_id / zpid / address', type: 'string', source: 'system', description: 'Context identifiers for the call.' },
            { name: 'prompt_filename', type: 'string', source: 'system', description: 'e.g. "neighborhoodAnalysis.ts". Links log entry to source prompt file.', usedBy: 'CityDataTab LLM Cost Report, AI Audit' },
            { name: 'llm_name', type: 'string', source: 'system', description: 'e.g. "gemini-2.0-flash". Controls per-model cost calculation.' },
            { name: 'raw_payload', type: 'object', source: 'system', description: 'Dehydrated prompt — images replaced with Storage URLs to stay within 1MB doc limit.' },
            { name: 'raw_response', type: 'string', source: 'gemini', description: 'Full model text output.' },
            { name: 'status', type: 'string', source: 'system', description: '"pending" → "completed" | "failed"' },
            { name: 'request_sent_at / response_received_at', type: 'timestamp', source: 'system', description: 'Precision timing for latency tracking.' },
            { name: 'usage_metadata', type: 'object', source: 'gemini', description: '{ promptTokenCount, candidatesTokenCount, totalTokenCount }' },
            { name: 'estimated_cost', type: 'number', source: 'system', description: 'USD cost based on model pricing table × token counts.' },
            { name: 'safety_ratings / finish_reason', type: 'object / string', source: 'gemini', description: 'Raw Gemini response safety metadata.' },
            { name: 'error', type: 'string', source: 'system', description: 'Stack trace written on failure.' },
        ]
    },
    {
        name: 'api_call_events',
        icon: 'fa-plug',
        color: 'bg-amber-100 text-amber-600',
        docId: 'auto-id',
        description: 'Audit log for all external REST API calls — Google Solar, Air Quality, Pollen, Places, Walk Score, ArcGIS.',
        fields: [
            { name: 'user_id / zpid / address', type: 'string', source: 'system', description: 'Context identifiers for the call.' },
            { name: 'api_name', type: 'string', source: 'system', description: 'e.g. "Google Places", "Walk Score"', usedBy: 'CityDataTab API Cost Report' },
            { name: 'endpoint', type: 'string', source: 'system', description: 'e.g. "searchNearby", "solar/v1:findClosestBuildingInsights"' },
            { name: 'params', type: 'object', source: 'system', description: 'Request parameters (lat/lng, radius, etc.)' },
            { name: 'status', type: 'string', source: 'system', description: '"pending" → "completed" | "failed"' },
            { name: 'response_time_ms', type: 'number', source: 'system', description: 'API round-trip latency in milliseconds.' },
            { name: 'error', type: 'string', source: 'system', description: 'Error message written on failure.' },
        ]
    },
    {
        name: 'audit_events',
        icon: 'fa-clipboard-check',
        color: 'bg-rose-100 text-rose-600',
        docId: 'auto-id',
        description: 'Orientation audit trail — manual overrides and approvals by auditors in OrientationAuditTab.',
        fields: [
            { name: 'zpid', type: 'string', source: 'system', description: 'Property being audited.' },
            { name: 'auditorId', type: 'string', source: 'system', description: 'UID of the auditor who took action.' },
            { name: 'action', type: 'string', source: 'system', description: '"override_orientation" | "approve" | "flag"' },
            { name: 'previousValue / newValue', type: 'any', source: 'system', description: 'Before/after values for the changed field.' },
            { name: 'occurredAt', type: 'timestamp', source: 'system', description: 'Action timestamp.' },
        ]
    },
    {
        name: 'user_activity',
        icon: 'fa-wave-square',
        color: 'bg-sky-100 text-sky-600',
        docId: 'auto-id',
        description: 'Detailed user behaviour event stream. Enriches PostHog analytics with server-side context.',
        fields: [
            { name: 'user_id', type: 'string', source: 'system', description: 'Firebase UID.' },
            { name: 'event_type', type: 'string', source: 'system', description: '"page_view" | "tab_change" | "action"', usedBy: 'PostHog enrichment, admin analytics' },
            { name: 'context', type: 'object', source: 'system', description: '{ page, subTab, zpid, … } — rich context for event attribution.' },
            { name: 'occurred_at', type: 'timestamp', source: 'system', description: 'Event timestamp.' },
        ]
    },
    {
        name: 'message_events / journey_events / internal_messages',
        icon: 'fa-envelope',
        color: 'bg-emerald-100 text-emerald-600',
        docId: 'auto-id',
        description: 'SMS/email messaging infrastructure. Populated by Firebase Email Trigger + SendGrid + Twilio webhooks.',
        fields: [
            { name: 'message_events', type: 'object', source: 'system', description: 'Outbound SMS delivery receipts from Twilio webhooks.' },
            { name: 'journey_events', type: 'object', source: 'system', description: 'Lead journey milestones (first contact, showing booked, offer submitted, etc.)' },
            { name: 'internal_messages', type: 'object', source: 'manual', description: 'In-app realtor↔client messaging threads.' },
        ]
    },
];
