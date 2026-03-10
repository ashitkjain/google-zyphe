import { APP_CONFIG } from '../../config';
import { logAPICall, updateAPICall } from '../firebase/api_logs';
import { auth } from '../firebase/config';

const MAPS_API_KEY = APP_CONFIG.maps.key;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NearbyPlace {
    name: string;
    rating?: number;
    userRatingCount?: number;
    types?: string[];
    primaryTypeDisplayName?: string;
    priceLevel?: string;
    googleMapsUri?: string;
    distanceMeters?: number;
    isAiExtracted?: boolean;
    source?: 'google' | 'foursquare';
}

export interface NeighborhoodCategorySet {
    dining: NearbyPlace[];
    shopping: NearbyPlace[];
    parks: NearbyPlace[];
    transit: NearbyPlace[];
    fitness: NearbyPlace[];
    schools: NearbyPlace[];
    medical?: NearbyPlace[];
    community?: NearbyPlace[];
    others?: NearbyPlace[];
}

export interface NeighborhoodPlaces extends NeighborhoodCategorySet {
    walkable: NeighborhoodCategorySet;
    drivable: NeighborhoodCategorySet;
    fetchedAt: number;
    sources?: string[];
    isUnified?: boolean;
}

// ─── Internal Constants ───────────────────────────────────────────────────────

const PLACE_CATEGORY_QUERIES: {
    key: keyof Omit<NeighborhoodPlaces, 'fetchedAt'>;
    types: string[];
    radius: number;
}[] = [
        { key: 'dining', types: ['restaurant', 'cafe', 'bakery'], radius: 1500 },
        { key: 'shopping', types: ['shopping_mall', 'supermarket', 'grocery_store'], radius: 5000 },
        { key: 'parks', types: ['park', 'playground', 'hiking_area'], radius: 5000 },
        { key: 'transit', types: ['transit_station', 'parking', 'electric_vehicle_charging_station'], radius: 5000 },
        { key: 'fitness', types: ['gym'], radius: 5000 },
        { key: 'schools', types: ['school', 'primary_school'], radius: 3000 },
        { key: 'medical', types: ['hospital'], radius: 5000 },
        { key: 'community', types: ['library', 'police', 'fire_station', 'bank'], radius: 5000 },
        { key: 'others', types: ['stadium', 'night_club', 'liquor_store'], radius: 5000 },
    ];

const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

// ─── fetchNearbyPlaces ────────────────────────────────────────────────────────

export const fetchNearbyPlaces = async (
    lat: number,
    lng: number,
    zpid?: string,
    address?: string,
    existingData?: NeighborhoodPlaces | null,
    forceRefresh: boolean = false
): Promise<NeighborhoodPlaces | null> => {
    const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchNearby';
    const FIELD_MASK = 'places.displayName,places.types,places.rating,places.userRatingCount,places.priceLevel,places.googleMapsUri,places.primaryTypeDisplayName,places.location';

    const logId = await logAPICall({
        user_id: auth?.currentUser?.uid || 'unknown',
        zpid,
        address,
        api_name: 'Dual-Mode Google Places (Walk/Drive)',
        endpoint: 'searchNearby',
        params: { lat, lng },
        status: 'pending'
    });
    const start = Date.now();

    try {
        const [walkRes, driveRes] = await Promise.all([
            // 1. Walkable POIs: Primary focus on proximity
            fetch(PLACES_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': MAPS_API_KEY!,
                    'X-Goog-FieldMask': FIELD_MASK,
                },
                body: JSON.stringify({
                    includedTypes: [
                        'cafe', 'bakery', 'restaurant', 'park', 'playground',
                        'hiking_area', 'school', 'primary_school', 'library',
                        'gym', 'grocery_store', 'bank'
                    ],
                    maxResultCount: 20,
                    locationRestriction: {
                        circle: { center: { latitude: lat, longitude: lng }, radius: 1500.0 }
                    },
                    rankPreference: 'DISTANCE'
                })
            }).catch(() => null),

            // 2. Drivable POIs: Focus on major amenities and infrastructure
            fetch(PLACES_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': MAPS_API_KEY!,
                    'X-Goog-FieldMask': FIELD_MASK,
                },
                body: JSON.stringify({
                    includedTypes: [
                        'supermarket', 'shopping_mall', 'hospital', 'police',
                        'fire_station', 'transit_station', 'parking', 'electric_vehicle_charging_station',
                        'stadium', 'night_club', 'liquor_store'
                    ],
                    maxResultCount: 20,
                    locationRestriction: {
                        circle: { center: { latitude: lat, longitude: lng }, radius: 5000.0 }
                    }
                })
            }).catch(() => null)
        ]);

        const processPlaces = async (res: Response | null) => {
            if (!res || !res.ok) return [];
            const data = await res.json();
            return (data.places || []).map((p: any) => ({
                name: p.displayName?.text || 'Unknown',
                rating: p.rating,
                userRatingCount: p.userRatingCount,
                types: p.types || [],
                primaryTypeDisplayName: p.primaryTypeDisplayName?.text,
                priceLevel: p.priceLevel,
                googleMapsUri: p.googleMapsUri,
                source: 'google',
                location: p.location,
                distanceMeters: p.location ? calculateHaversineDistance(lat, lng, p.location.latitude, p.location.longitude) : undefined
            }));
        };

        const walkPlaces = await processPlaces(walkRes as Response);
        const drivePlacesRaw = await processPlaces(driveRes as Response);

        // Deduplicate: If it's in walk, remove from drive
        const walkNames = new Set(walkPlaces.map((p: NearbyPlace) => p.name.toLowerCase().trim()));
        const drivePlaces = drivePlacesRaw.filter((p: NearbyPlace) => !walkNames.has(p.name.toLowerCase().trim()));

        // Consolidate raw data for the bucketing logic (top-level union)
        const rawGooglePlaces: NearbyPlace[] = [...walkPlaces, ...drivePlaces];

        const createCategorySet = (places: NearbyPlace[]): NeighborhoodCategorySet => {
            const set: NeighborhoodCategorySet = {
                dining: [], shopping: [], parks: [], transit: [], fitness: [], schools: [],
                medical: [], community: [], others: []
            };

            const seenGlobal = new Set<string>(); // Prevent same place in multiple categories

            // Match specific categories first
            PLACE_CATEGORY_QUERIES.filter(q => q.key !== 'others').forEach(({ key, types, radius }) => {
                const bucket: NearbyPlace[] = [];
                places.forEach(p => {
                    const normalized = p.name.toLowerCase().trim();
                    if (seenGlobal.has(normalized)) return;

                    const isWithinRadius = (p.distanceMeters || 0) <= radius;
                    if (!isWithinRadius) return;

                    const pTypes = (p.types || []).map(t => t.toLowerCase());
                    const matchesGoogle = types.some(t => pTypes.includes(t.toLowerCase())) ||
                        (key === 'community' && pTypes.includes('establishment') && (p.name.toLowerCase().includes('church') || p.name.toLowerCase().includes('hall')));

                    if (matchesGoogle) {
                        seenGlobal.add(normalized);
                        bucket.push(p);
                    }
                });
                (set as any)[key] = bucket.slice(0, 15);
            });

            // Catch-all for 'others': anything not yet claimed by a specific category.
            // Use a local seen set to prevent duplicates within the others bucket itself.
            const othersRadius = PLACE_CATEGORY_QUERIES.find(q => q.key === 'others')?.radius || 5000;
            const othersBucket: NearbyPlace[] = [];
            const seenOthers = new Set<string>();
            places.forEach(p => {
                const normalized = p.name.toLowerCase().trim();
                if (seenGlobal.has(normalized)) return;
                if (seenOthers.has(normalized)) return;

                if ((p.distanceMeters || 0) <= othersRadius) {
                    seenGlobal.add(normalized);
                    seenOthers.add(normalized);
                    othersBucket.push(p);
                }
            });
            set.others = othersBucket.slice(0, 15);

            return set;
        };

        const walkableSet = createCategorySet(walkPlaces);
        const drivableSet = createCategorySet(drivePlaces);

        // Build a global set of all place names already claimed by any walkable bucket
        // so drivable.others doesn't re-surface them (catches name-variation escapes).
        const allWalkableNames = new Set<string>(
            (Object.values(walkableSet) as NearbyPlace[][])
                .flat()
                .map((p: NearbyPlace) => p.name.toLowerCase().trim())
        );
        drivableSet.others = (drivableSet.others || []).filter(
            p => !allWalkableNames.has(p.name.toLowerCase().trim())
        );

        const result: NeighborhoodPlaces = {
            ...createCategorySet(rawGooglePlaces),
            walkable: walkableSet,
            drivable: drivableSet,
            fetchedAt: Date.now(),
            sources: ['google'],
            isUnified: true
        };

        if (logId) {
            updateAPICall(logId, { status: 'completed', response_time_ms: Date.now() - start });
        }

        return result;
    } catch (e: any) {
        if (logId) {
            updateAPICall(logId, { status: 'failed', response_time_ms: Date.now() - start, error: e.message });
        }
        console.error('[Places API] Failed to fetch nearby places:', e);
        return null;
    }
};
