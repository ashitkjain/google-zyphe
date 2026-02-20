import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, Timestamp, limit } from "firebase/firestore";
import { db, auth, sanitizeForFirestore, logFirestoreQuery } from "./config";
import { trackEvent as trackPH, identifyUser as identifyPH, resetUser as resetPH } from "../analytics/posthog";
import { identifyUser as identifyClarity } from "../analytics/clarity";

/**
 * Tracks user activity events (login, page_view, logout, etc.)
 * in the `user_activity` Firestore collection.
 */

export interface UserActivityEvent {
    id?: string;
    user_id: string;
    email: string;
    display_name: string;
    role: string;
    event_type: 'login' | 'page_view' | 'logout' | 'session_timeout';
    page?: string;           // For page_view events, e.g. 'dashboard', 'guides', 'explore'
    address?: string;        // Property address being viewed (if any)
    zpid?: string;           // Zillow property ID (if any)
    metadata?: Record<string, any>;
    timestamp?: any;
}

/**
 * Log a user activity event to the `user_activity` collection.
 * Fire-and-forget — errors are caught and logged silently so they never
 * block the user's workflow.
 */
export const logUserActivity = async (
    event: Omit<UserActivityEvent, 'id' | 'timestamp'>
): Promise<string | null> => {
    if (!db) return null;

    try {
        const docData = sanitizeForFirestore({
            ...event,
            timestamp: serverTimestamp(),
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        });

        logFirestoreQuery('addDoc', 'user_activity', { event_type: event.event_type, user_id: event.user_id });
        const docRef = await addDoc(collection(db, "user_activity"), docData);
        return docRef.id;
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            console.warn("[UserActivity] Permission denied. Update Firestore rules for 'user_activity'.");
        } else {
            console.error("[UserActivity] Error logging event:", error);
        }
        return null;
    }
};

// Human-readable labels for page keys — mirrors PAGE_LABELS in MyZypheTab
const PAGE_LABELS: Record<string, string> = {
    explore: 'Explore', main: 'Home', leads: 'Funnel', closing: 'Closing',
    reactivate: 'Reactivate', clients: 'Clients', tasks: 'Tasks', calendar: 'Calendar',
    whiteboard: 'Whiteboard', creative_studio: 'Creative Studio', settings: 'Data Fields',
    profile: 'Profile', knowledge_center: 'Library', best_practices: 'Best Practices',
    guides: 'Guides', city_data: 'City Ingestion', data_health: 'Data Health',
    ai_validation: 'AI Validation', lead_ingestion: 'Lead Ingestion', pdf_csv: 'PDF to CSV',
    sms_registration: 'SMS Registration', storage_registry: 'Bulk Prefetch',
    bulk_prefetch: 'Bulk Prefetch', industry_research: 'Industry Research',
    product_market_fit: 'Product Market Fit', post_close_intelligence: 'Post-Close',
    technical_papers: 'Technical Papers', video_upload: 'Video Upload',
    technical_media: 'Technical Media', executive_summary: 'Executive Summary',
    industry_case_studies: 'Case Studies', unit_economics: 'Unit Economics',
    premium_mls: 'Premium MLS', reminder_rules: 'Reminder Rules',
    my_zyphe: 'My Zyphe', context_graph_builder: 'Context Graph',
};

/**
 * Track a login event. Call when a user explicitly authenticates.
 */
export const trackLogin = (user: { uid: string; email: string; displayName: string; role: string }) => {
    // Identify user in PostHog & Clarity so all subsequent events are attributed correctly
    identifyPH(user.uid, {
        email: user.email,
        name: user.displayName,
        role: user.role,
    });
    identifyClarity(user.uid);

    trackPH('Login', {
        user_name: user.displayName,
        user_email: user.email,
        user_role: user.role,
        login_method: 'email',
        timestamp_utc: new Date().toISOString(),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    });

    return logUserActivity({
        user_id: user.uid,
        email: user.email,
        display_name: user.displayName,
        role: user.role,
        event_type: 'login',
    });
};

/**
 * Track a page view event. Call when the user navigates to a new view/tab.
 */
export const trackPageView = (
    user: { uid: string; email: string; displayName: string; role: string },
    page: string,
    property?: { address?: string; zpid?: string }
) => {
    const pageLabel = PAGE_LABELS[page] || page;
    const hasProperty = !!(property?.address || property?.zpid);

    trackPH('Page_View', {
        // Page context
        page_key: page,
        page_label: pageLabel,
        // Property context (when viewing a specific property)
        has_property: hasProperty,
        property_address: property?.address || null,
        property_zpid: property?.zpid || null,
        // User context
        user_name: user.displayName,
        user_email: user.email,
        user_role: user.role,
    });

    return logUserActivity({
        user_id: user.uid,
        email: user.email,
        display_name: user.displayName,
        role: user.role,
        event_type: 'page_view',
        page,
        address: property?.address || undefined,
        zpid: property?.zpid || undefined,
    });
};

/**
 * Track a logout event. Call when the user signs out (manually or via timeout).
 */
export const trackLogout = (
    user: { uid: string; email: string; displayName: string; role: string },
    reason: 'manual' | 'session_timeout' = 'manual'
) => {
    trackPH('Logout', {
        reason,
        logout_type: reason === 'session_timeout' ? 'Inactivity Timeout' : 'Manual Sign-Out',
        user_name: user.displayName,
        user_email: user.email,
        user_role: user.role,
        timestamp_utc: new Date().toISOString(),
    });
    resetPH();

    return logUserActivity({
        user_id: user.uid,
        email: user.email,
        display_name: user.displayName,
        role: user.role,
        event_type: reason === 'session_timeout' ? 'session_timeout' : 'logout',
    });
};

/**
 * Retrieve activity events for a specific user within a time range.
 */
export const getUserActivity = async (
    userId: string,
    startTime?: number,
    endTime?: number,
    maxItems: number = 100
): Promise<UserActivityEvent[]> => {
    if (!db) return [];
    try {
        let q;
        if (startTime && endTime) {
            q = query(
                collection(db, "user_activity"),
                where("user_id", "==", userId),
                where("timestamp", ">=", Timestamp.fromMillis(startTime)),
                where("timestamp", "<=", Timestamp.fromMillis(endTime)),
                orderBy("timestamp", "desc"),
                limit(maxItems)
            );
        } else {
            q = query(
                collection(db, "user_activity"),
                where("user_id", "==", userId),
                orderBy("timestamp", "desc"),
                limit(maxItems)
            );
        }

        logFirestoreQuery('getDocs', 'user_activity', { userId, startTime, endTime });
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<UserActivityEvent, 'id'>) }));
    } catch (error: any) {
        if (error.code === 'failed-precondition') {
            console.warn("[UserActivity] Missing composite index. Check the console for a creation link.");
        } else if (error.code === 'permission-denied') {
            console.warn("[UserActivity] Permission denied when reading activity logs.");
        } else {
            console.error("[UserActivity] Error fetching activity:", error);
        }
        return [];
    }
};

/**
 * Retrieve activity events for ALL users.
 */
export const getAllUserActivity = async (
    maxItems: number = 200
): Promise<UserActivityEvent[]> => {
    if (!db) return [];
    try {
        const q = query(
            collection(db, "user_activity"),
            orderBy("timestamp", "desc"),
            limit(maxItems)
        );

        logFirestoreQuery('getDocs', 'user_activity', { limit: maxItems });
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<UserActivityEvent, 'id'>) }));
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            console.warn("[UserActivity] Permission denied when reading global activity logs.");
        } else {
            console.error("[UserActivity] Error fetching global activity:", error);
        }
        return [];
    }
};
