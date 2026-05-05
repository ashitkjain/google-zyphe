/**
 * Provider-agnostic interface for property data ingestion.
 *
 * Both RapidAPI (existing) and RealEstateAPI implement this shape so
 * CityDataTab can swap sources without touching its own logic.
 */

// Shape returned by searchByZip — matches what CityDataTab's mapPage() already produces
export interface NormalizedListing {
    zpid: string;
    property_id: string;
    location: {
        address: {
            line: string;
            city: string;
            state_code: string;
            postal_code: string;
        };
    };
    list_price: number;
    primary_photo: { href: string } | null;
    homeType: string | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    livingArea?: number | null;
    daysOnMarket?: number | null;
    listedDate?: string | null;
    coordinates?: { latitude: number; longitude: number };
    source: 'rapidapi' | 'realestateapi';
    // pass-through for anything CityDataTab reads off the raw listing
    [key: string]: any;
}

// Shape returned by getPropertyDetail — maps to PropertyData
export interface NormalizedPropertySpec {
    zpid: string;
    address: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    price?: number;
    bedrooms?: number | null;
    bathrooms?: number | null;
    livingAreaValue?: number | null;
    lotSize?: string;
    homeType?: string;
    homeStatus?: string;
    coordinates?: { latitude: number; longitude: number };
    mapZoomIn?: string;
    mapZoomOut?: string;
    yearBuilt?: number | null;
    stories?: number | null;
    garageSpaces?: number | null;
    pool?: boolean;
    monthlyHoaFee?: number | null;
    timeOnZillow?: number | null;
    listedDate?: string | null;
    images?: string[];
    resoFacts?: Record<string, any>;
    source: 'rapidapi' | 'realestateapi';
    [key: string]: any;
}

export interface PropertyDataProvider {
    readonly name: 'rapidapi' | 'realestateapi';
    /**
     * Search active MLS listings for a zip code.
     * Must return listings that pass isSupportedPropertyType (homeType mapped to our schema).
     */
    searchByZip(
        zip: string,
        fallbackCity?: string,
        fallbackState?: string,
    ): Promise<NormalizedListing[]>;
    /**
     * Fetch full property details by the provider's own ID.
     */
    getPropertyDetail(id: string): Promise<NormalizedPropertySpec | null>;
}

// ── HomeType mapping helpers ────────────────────────────────────────────────

/** Maps RealEstateAPI propertyType codes to our canonical homeType values. */
export function mapRealEstateApiPropertyType(raw: string | null | undefined): string | null {
    if (!raw) return null;
    switch (raw.toUpperCase()) {
        case 'SFR':         return 'SINGLE_FAMILY';
        case 'CONDO':       return 'CONDO';
        case 'TOWNHOUSE':   return 'TOWNHOUSE';
        case 'MF':
        case 'MULTI_FAMILY':
        case 'MFH2TO4':
        case 'MFH5PLUS':    return 'MULTI_FAMILY';
        case 'LAND':        return 'LAND';
        default:            return null;
    }
}

/** Maps RealEstateAPI mlsStatus to our canonical homeStatus values. */
export function mapRealEstateApiMlsStatus(status: string | null | undefined): string {
    if (!status) return 'FOR_SALE';
    switch (status.toUpperCase()) {
        case 'ACTIVE':
        case 'ACTIVE UNDER CONTRACT': return 'FOR_SALE';
        case 'PENDING':               return 'PENDING';
        case 'SOLD':
        case 'CLOSED':                return 'RECENTLY_SOLD';
        default:                      return 'FOR_SALE';
    }
}
