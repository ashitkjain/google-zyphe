/**
 * IDX Behavioral Tracking
 *
 * All buyer IDX events go through this module.
 * PostHog is already initialized in App.tsx — these just fire .capture() calls.
 * PostHog is disabled on localhost (see posthog.ts), so all calls are safe to make universally.
 */

import { trackEvent } from './posthog';

// ─── Property Browsing ────────────────────────────────────────────────────────

export const trackPropertyViewed = (params: {
    zpid?: string;
    address: string;
    city: string;
    listPrice?: number;
    bedrooms?: number;
    bathrooms?: number;
    livingArea?: number;
    homeType?: string;
    neighborhood?: string;
    viewSource: 'gallery' | 'map' | 'table' | 'zypheai';
    buyerUid?: string;
}) => {
    trackEvent('idx_property_viewed', {
        zpid: params.zpid,
        address: params.address,
        city: params.city,
        list_price: params.listPrice,
        bedrooms: params.bedrooms,
        bathrooms: params.bathrooms,
        living_area: params.livingArea,
        home_type: params.homeType,
        neighborhood: params.neighborhood,
        view_source: params.viewSource,
        buyer_uid: params.buyerUid,
    });
};

export const trackMapMarkerClicked = (params: {
    zpid?: string;
    address: string;
    city: string;
    listPrice?: number;
}) => {
    trackEvent('idx_map_marker_clicked', {
        zpid: params.zpid,
        address: params.address,
        city: params.city,
        list_price: params.listPrice,
    });
};

export const trackCityBrowsed = (params: {
    city: string;
    resultCount: number;
}) => {
    trackEvent('idx_city_browsed', {
        city: params.city,
        result_count: params.resultCount,
    });
};

// ─── Filters ──────────────────────────────────────────────────────────────────

export const trackFilterApplied = (params: {
    city: string;
    filterType: string;
    filterValue: string | number;
    resultCount: number;
}) => {
    trackEvent('idx_filter_applied', {
        city: params.city,
        filter_type: params.filterType,
        filter_value: params.filterValue,
        result_count: params.resultCount,
    });
};

// ─── AI Story Search ──────────────────────────────────────────────────────────

export const trackStorySearchRun = (params: {
    city: string;
    resultCount: number;
    topMatchScore?: number;
    extractedPriceMin?: number;
    extractedPriceMax?: number;
    extractedBeds?: number;
    extractedBaths?: number;
}) => {
    trackEvent('idx_story_search_run', {
        city: params.city,
        result_count: params.resultCount,
        top_match_score: params.topMatchScore,
        price_min: params.extractedPriceMin,
        price_max: params.extractedPriceMax,
        beds: params.extractedBeds,
        baths: params.extractedBaths,
    });
};

// ─── Lead Capture ─────────────────────────────────────────────────────────────

export const trackTourRequested = (params: {
    zpid?: string;
    address: string;
    city: string;
    listPrice?: number;
    buyerName?: string;
    buyerEmail?: string;
    tourDate?: string;
}) => {
    trackEvent('idx_tour_requested', {
        zpid: params.zpid,
        address: params.address,
        city: params.city,
        list_price: params.listPrice,
        buyer_name: params.buyerName,
        buyer_email: params.buyerEmail,
        tour_date: params.tourDate,
    });
};

export const trackInfoRequested = (params: {
    zpid?: string;
    address: string;
    city: string;
    listPrice?: number;
    buyerEmail?: string;
}) => {
    trackEvent('idx_info_requested', {
        zpid: params.zpid,
        address: params.address,
        city: params.city,
        list_price: params.listPrice,
        buyer_email: params.buyerEmail,
    });
};

// ─── Saved Searches ───────────────────────────────────────────────────────────

export const trackSearchSaved = (params: {
    city: string;
    searchName: string;
    alertFrequency: string;
    filterCount: number;
    resultCount: number;
}) => {
    trackEvent('idx_search_saved', {
        city: params.city,
        search_name: params.searchName,
        alert_frequency: params.alertFrequency,
        filter_count: params.filterCount,
        result_count: params.resultCount,
    });
};

// ─── View Mode ────────────────────────────────────────────────────────────────

export const trackViewModeChanged = (params: {
    city: string;
    fromMode: string;
    toMode: string;
    resultCount: number;
}) => {
    trackEvent('idx_view_mode_changed', {
        city: params.city,
        from_mode: params.fromMode,
        to_mode: params.toMode,
        result_count: params.resultCount,
    });
};
