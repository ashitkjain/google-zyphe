import { auth } from './config';

export interface BuyerSignals {
    buyerEmail: string;
    periodDays: number;
    lastActiveAt: string | null;
    propertiesViewed: number;
    mapMarkersClicked: number;
    tourRequests: number;
    infoRequests: number;
    savedSearchCount: number;
    usedMapView: boolean;
    usedStorySearch: boolean;
    citiesExplored: string[];
    tourRequestedAddresses: string[];
    priceRangeInterest: {
        min: number | null;
        max: number | null;
        avg: number | null;
    };
}

const FUNCTION_BASE_URL = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL ||
    'https://us-central1-zyphe-af0bf.cloudfunctions.net';

/**
 * Fetch buyer behavioral signals from PostHog via getBuyerSignals Cloud Function.
 * @param buyerEmail  The buyer's email address (PostHog person identifier)
 * @param days        Lookback window in days (default 30)
 */
export async function getBuyerSignals(
    buyerEmail: string,
    days: number = 30
): Promise<BuyerSignals | null> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const idToken = await user.getIdToken();

    const res = await fetch(`${FUNCTION_BASE_URL}/getBuyerSignals`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ buyerEmail, days }),
    });

    if (!res.ok) throw new Error(`getBuyerSignals failed: ${res.status}`);

    const data = await res.json();
    if (data.error && !data.signals) {
        console.warn('[BuyerSignals]', data.error);
        return null;
    }
    return data.signals as BuyerSignals;
}
