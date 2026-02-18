import posthog from 'posthog-js';

/**
 * PostHog Analytics Service
 * 
 * Note: You need to provide your PostHog API Key and Host.
 * You can find these in your PostHog Project Settings.
 */

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || 'phc_tIO5TwDC0OBLRsQ4qhXM6I57dyw2smaNCuMMUuIZsKm';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

export const initPostHog = () => {
    if (typeof window === 'undefined' || !POSTHOG_KEY) return;

    posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: 'identified_only', // or 'always' if you want to track anonymous users as people
        capture_pageview: false, // We'll handle this manually for better control
        loaded: (ph) => {
            if (import.meta.env.DEV) ph.debug();
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
 * Reset PostHog user (logout)
 */
export const resetUser = () => {
    if (typeof window !== 'undefined') {
        posthog.reset();
    }
};

export default posthog;
