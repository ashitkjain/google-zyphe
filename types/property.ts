export interface PropertyComp {
    zpid: string;
    address: string;
    price?: number | null;
    listPrice?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    livingAreaValue?: number | null;
    yearBuilt?: number | null;
    distance?: number | null;
    daysOnMarket?: number | null;
    status?: string;
    images?: string[];
    homeType?: string;
    lastSoldPrice?: number | null;
    lastSoldDate?: string;
    lotSize?: string;
    lotAreaValue?: number | null;
    lotAreaUnit?: string;
    garageSpaces?: number | null;
    pricePerSqFt?: number | null;
    description?: string;
    hoaFees?: number | null;
}

export interface PriceHistoryItem {
    date: string;
    price: number | null;
    event: string;
}

export interface RadarGeocodeResponse {
    coordinates: {
        latitude: number;
        longitude: number;
    };
    formattedAddress: string;
    components: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
    mapZoomIn?: string;
    mapZoomOut?: string;
}

export interface School {
    name: string;
    level: string;
    rating: string | number;
    distance: string;
}

export interface ResoFacts {
    flooring?: string;
    foundationDetails?: string;
    rooms?: string;
    roomTypes?: string;
    feesAndDues?: string;
    exteriorFeatures?: string;
    architecturalStyle?: string;
    garageParkingCapacity?: number | string;
    lotFeatures?: string;
    roofType?: string;
    daysOnZillow?: number;
    zoningDescription?: string;
    constructionMaterials?: string;
    fireplaceFeatures?: string;
    appliances?: string;
    fencing?: string;
    cooling?: string;
    laundryFeatures?: string;
    heating?: string;
    mlsid?: string;
    utilities?: string;
    sewer?: string;
    waterSource?: string;
    basement?: string;
    securityFeatures?: string;
    windowFeatures?: string;
    roomFeatures?: string;
}


// Circular imports managed by index.ts or separate files. Importing AI types if needed, but PropertyData uses AI.
// PropertyData is large, let's keep it here.
import { AIAnalysisResult, CustomAIAnalysisResult, ComprehensiveAnalysisResult, StreetViewAnalysisResult } from './ai';

export interface PropertyData {
    zpid?: string;
    feed_property_id?: string; // The ID provided by the search/list feed (which may differ from canonical ZPID)
    alternate_ids?: string[]; // Array of known aliases for this property ID
    address: string;
    city?: string;
    state?: string;
    zipCode?: string;
    homeStatus?: string;
    homeType?: string;
    livingAreaValue?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    yearBuilt?: number | null;
    lotSize?: string;
    description?: string;
    price?: number | null;
    zestimate?: number | null;
    rentZestimate?: number | null;
    propertyTaxRate?: number | null;
    annualHomeownersInsurance?: number | null;
    windRiskScore?: number | null;
    floodRiskScore?: number | null;
    fireRiskScore?: number | null;
    heatRiskScore?: number | null;
    walkScore?: number | null;
    walkScoreDesc?: string;
    transitScore?: number | null;
    transitScoreDesc?: string;
    bikeScore?: number | null;
    bikeScoreDesc?: string;
    noiseScore?: number | null;           // HowLoud overall SoundScore: 50 (loud) – 100 (quiet)
    noiseScoreDesc?: string;               // e.g. "Calm", "Active"
    noiseTrafficScore?: number | null;     // Traffic noise contribution (0–100)
    noiseTrafficDesc?: string;             // e.g. "Calm", "Active"
    noiseLocalScore?: number | null;       // Local noise contribution (0–100)
    noiseLocalDesc?: string;
    noiseAirportScore?: number | null;     // Airport noise contribution (0–100)
    noiseAirportDesc?: string;
    crimeScore?: number | null;       // Numeric crime safety score
    crimeGrade?: string;              // Letter grade A+ – F
    schools?: School[];
    nearbyHomes?: any[];
    homeInsights?: any;
    timeOnZillow?: number | null;
    resoFacts?: ResoFacts;
    images?: string[];
    coordinates?: {
        latitude: number;
        longitude: number;
    };
    mapZoomIn?: string;
    mapZoomOut?: string;
    listedDate?: string | number;
    comps?: PropertyComp[];
    priceHistory?: PriceHistoryItem[];
    // AI fields for cloud caching
    analysis?: AIAnalysisResult;
    visual_analysis?: CustomAIAnalysisResult;
    comprehensive_analysis?: ComprehensiveAnalysisResult;
    solarData?: {
        maxSunshineHoursPerYear?: number;
        carbonOffsetFactorKgPerMwh?: number;
        panelCapacityWatts?: number;
        estimatedSolarProduction?: {
            estimatedPanels: number;
            systemCapacityKw: number;
            annualKwh: number;
            carbonOffsetTons: number;
        };
        wholeRoofStats?: {
            areaMeters2?: number;
            sunshineQuantiles?: number[];
            groundAreaMeters2?: number;
        };
    };
    airQuality?: {
        aqi: number;
        category: string;
        dominantPollutant: string;
        recommendations?: {
            general: string;
            sensitiveGroups: string;
        };
        pollutants?: {
            name: string;
            fullName: string;
            concentration: number;
            unit: string;
        }[];
    };
    streetViewAnalysis?: StreetViewAnalysisResult;
    pollen?: {
        score: number;
        category: string;
        description: string;
        dominantPollenType: string;
        analysis?: import('./ai').PollenAnalysisResult;
        raw_data?: any;
    };
    hoa?: {
        name?: string;
        fee?: string;                 // e.g. "$295 monthly"
        phone?: string;
        amenities?: string[];         // e.g. ["Pool", "Gated", "Playground"]
        feeIncludes?: string[];       // e.g. ["Common Area Maint", "Security"]
    };
    attribution?: {
        listingAgentName?: string;
        listingAgentNumber?: string;
        brokerageName?: string;
        mlsName?: string;
        mlsId?: string;
    };
}

export interface PropertyDetails {
    // Identity
    address?: string; // Full formatted address
    zpid?: string;
    mlsNumber?: string;

    // Core Attributes
    propertyType?: string; // SFH, Condo, Etc.
    bedrooms?: number;
    bathrooms?: number;
    sqft?: number;
    yearBuilt?: number;
    lotSize?: string;

    // Financials
    price?: number; // List price or purchase price
    minPrice?: number; // For preferences
    maxPrice?: number; // For preferences

    // Additional Context
    daysOnMarket?: number;
    description?: string;
    images?: string[];

    // Preferences (Specific to search usage)
    preferredNeighborhood?: string;
    preferredZipCodes?: string[];
}

export interface Tour {
    id: string; // Unique ID for the tour
    propertyAddress: string;
    date: string; // ISO Date String
    time?: string; // "14:00" etc
    comment?: string;
    status?: 'Scheduled' | 'Completed' | 'Cancelled' | 'No Show';
}
export interface PropertyAssets {
    zpid: string;
    images: string[];
    mapZoomIn?: string;
    mapZoomOut?: string;
    streetView?: string;
    lastVerified: any; // serverTimestamp
}
