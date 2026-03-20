import posthog from 'posthog-js';

/**
 * PostHog Analytics Service
 * 
 * Note: You need to provide your PostHog API Key and Host.
 * You can find these in your PostHog Project Settings.
 */

const POSTHOG_KEY = (import.meta as any).env?.VITE_POSTHOG_KEY || 'phc_tIO5TwDC0OBLRsQ4qhXM6I57dyw2smaNCuMMUuIZsKm';
const POSTHOG_HOST = (import.meta as any).env?.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

export const initPostHog = () => {
    if (typeof window === 'undefined' || !POSTHOG_KEY) return;

    posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: 'always',      // capture events from ALL users, not just identified ones
        capture_pageview: false,        // we track page views manually for full control
        capture_pageleave: true,        // useful for session duration

        // --- Click & interaction tracking ---
        autocapture: true,              // capture ALL clicks, form submits, input changes automatically
        capture_performance: true,      // capture page load / network performance metrics

        // --- Session recording ---
        session_recording: {
            maskAllText: false,         // show button labels in recordings (readable UI)
            maskAllInputs: true,        // always mask input field values (passwords etc.)
            recordCrossOriginIframes: false,
        },

        loaded: (ph) => {
            ph.startSessionRecording();  // start recording for every session
            if ((import.meta as any).env?.DEV) ph.debug();
        }
    });
};

/**
 * Log a custom event to PostHog
 * @param event Event name
 * @param properties Optional metadata for the event
 */
export const trackEvent = (event: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined') {
        posthog.capture(event, properties);
    }
};

/**
 * Identify a user in PostHog
 * @param userId Unique user ID
 * @param properties Optional user properties
 */
export const identifyUser = (userId: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined') {
        posthog.identify(userId, properties);
    }
};

/**
 * Set the current page context as a super property.
 * All subsequent PostHog events (including autocapture clicks) will
 * automatically include `current_page` and `current_page_key`.
 * Call this every time the user navigates to a new sub-tab.
 */
export const setCurrentPage = (pageKey: string, pageLabel: string) => {
    if (typeof window !== 'undefined') {
        posthog.register({
            current_page_key: pageKey,
            current_page_label: pageLabel,
        });
        if ((import.meta as any).env?.DEV) {
            console.log(`[PostHog] setCurrentPage → key="${pageKey}" label="${pageLabel}"`);
        }
    }
};

/**
 * Reset PostHog user (logout)
 */
export const resetUser = () => {
    if (typeof window !== 'undefined') {
        posthog.reset();
    }
};

export default posthog;
