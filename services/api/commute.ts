import { PropertyData } from '../../types';

export interface CommuteDestinationResult {
    name: string;
    description: string;
    timeMin: number | null;
    distanceMi: number | null;
    routeInfo: string | null;
    color: string;
}

export const fetchCommuteDestinations = async (
    property: PropertyData,
    userId: string = "unknown"
): Promise<CommuteDestinationResult[] | null> => {
    if (!property.city || !property.state || !property.coordinates) {
        return null;
    }

    try {
        const { functions } = await import('../firebase/config');
        const { httpsCallable } = await import('firebase/functions');
        
        if (!functions) return null;

        const getCommute = httpsCallable(functions, 'getCommuteDestinations');
        const result = await getCommute({
            city: property.city,
            state: property.state,
            lat: property.coordinates.latitude,
            lng: property.coordinates.longitude
        });

        return result.data as CommuteDestinationResult[];

    } catch (e) {
        console.error('[Commute Service] Failed to fetch commute destinations', e);
        return null;
    }
};
