/**
 * Public barrel export for all API service modules.
 *
 * All existing consumers that import from `../services/apiService` or
 * `../../services/apiService` should continue to work unchanged — just
 * update their import path to point here, or keep `apiService.ts` as a
 * thin re-export shim (see below).
 */

// Utilities (formatAddress is the only publicly-used one)
export { formatAddress } from './utils';

// Geocoding
export { normalizeAddress } from './geocoding';

// Places / POI types & fetcher
export type { NearbyPlace, NeighborhoodCategorySet, NeighborhoodPlaces } from './places';
export { fetchNearbyPlaces } from './places';

// Environmental data
export { fetchSolarData, fetchAirQuality, fetchPollenData, fetchNoiseScore } from './environmental';

// Historical disaster data (USGS Earthquake + FEMA)
export type { DisasterEvent, SeismicZone, FloodZone, HistoricalDisasterData } from './disasters';
export { fetchHistoricalDisasters, fetchEarthquakeHistory, fetchFemaDisasterHistory } from './disasters';

// Property data (scores, comps, images, specs)
export { fetchScores, fetchPropertyImages, fetchPropertySpecs } from './property';

// Full property pipeline
export { fetchPropertyDataFull, fetchPropertyData } from './propertyDataFull';
