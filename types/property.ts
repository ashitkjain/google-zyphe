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
import { AIAnalysisResult, CustomAIAnalysisResult, ComprehensiveAnalysisResult } from './ai';

export interface PropertyData {
    zpid?: string;
    address: string;
    city?: string;
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
