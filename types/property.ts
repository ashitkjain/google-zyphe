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
    numberOfUnitsInCommunity?: number | null;
    stories?: number | null;
    parkingFeatures?: string[];
    interiorFeatures?: string[];
    propertyCondition?: string;
    electric?: string[];
}


// Circular imports managed by index.ts or separate files. Importing AI types if needed, but PropertyData uses AI.
// PropertyData is large, let's keep it here.
import { CustomAIAnalysisResult, ComprehensiveAnalysisResult, StreetViewAnalysisResult } from './ai';
import type { HistoricalDisasterData } from '../services/api/disasters';
import type { BroadbandData } from '../services/api/broadband';
import type { DroughtData } from '../services/api/drought';
import type { CensusDemographics } from '../services/api/environmental';

export interface PropertyData {
    zpid?: string;
    feed_property_id?: string; // The ID provided by the search/list feed (which may differ from canonical ZPID)
    alternate_ids?: string[]; // Array of known aliases for this property ID
    address: string;
    city?: string;
    state?: string;
    zipCode?: string;
    subdivision?: string;              // e.g. "Dublin Ranch"
    county?: string;                   // e.g. "Alameda County"
    countyFIPS?: string;               // e.g. "06001"
    pageViewCount?: number | null;     // Zillow listing page views
    favoriteCount?: number | null;     // Zillow favorites / saves
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

    // Extra climate detail from First Street Foundation (via RapidAPI)
    // Numeric risk scores live in the flat fields above ({type}RiskScore).
    // This object carries supplementary data only.
    climateRiskDetail?: {
        flood?: {
            label?: string;                              // e.g. "MINIMAL"
            femaZone?: string;                           // e.g. "X_UNSHADED"
            insuranceRec?: string;                       // e.g. "NOT_CRITICAL"
            insuranceSeparatePolicy?: string;             // e.g. "NOT_REQUIRED"
            historicCount?: number;
            probability?: { probability: number; relativeYear: number }[];
            sourceUrl?: string;
        };
        fire?: {
            label?: string;
            insuranceRec?: string;
            insuranceSeparatePolicy?: string;
            historicCount?: number;
            probability?: { probability: number; relativeYear: number }[];
            sourceUrl?: string;
        };
        wind?: {
            label?: string;
            insuranceRec?: string;
            insuranceSeparatePolicy?: string;
            historicCount?: number;
            probability?: { probability: number; relativeYear: number }[];
            sourceUrl?: string;
        };
        heat?: {
            label?: string;
            percentile98Temp?: number;                   // e.g. 97°F
            hotDays?: { dayCount: number; relativeYear: number }[];
            sourceUrl?: string;
        };
        air?: {
            label?: string;
            badAirDays?: { dayCount: number; relativeYear: number }[];
            sourceUrl?: string;
        };
    } | null;
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
    mapZoomIn?: string;          // Radar static map, zoom=20 — close-up neighbourhood for AI analysis
    mapZoomOut?: string;         // Radar static map, zoom=15 — wider area context for AI analysis
    satelliteImageUrl?: string;  // Google Maps Static satellite, zoom=20 scale=2 — for orientation AI
    listedDate?: string | number;
    comps?: PropertyComp[];
    priceHistory?: PriceHistoryItem[];
    // AI fields for cloud caching
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
        financialAnalysis?: {
            monthlyBill?: number;
            remainingLifetimeCostBill?: number;
            costOfElectricityWithoutSolar?: number;
            cashPurchase?: {
                outOfPocketCost?: number;
                upfrontCost?: number;
                rebateValue?: number;
                paybackYears?: number;
                savings?: {
                    savingsYear1?: number;
                    savingsYear20?: number;
                    savingsLifetime?: number;
                    presentValueOfSavingsYear20?: number;
                };
            };
            lease?: {
                leasesAllowed?: boolean;
                annualLeasingCost?: number;
                savings?: {
                    savingsYear1?: number;
                    savingsYear20?: number;
                    savingsLifetime?: number;
                };
            };
            financed?: {
                annualLoanPayment?: number;
                loanInterestRate?: number;
                savings?: {
                    savingsYear1?: number;
                    savingsYear20?: number;
                    savingsLifetime?: number;
                };
            };
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
    google_places?: import('../services/apiService').NeighborhoodPlaces;

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
    listingSubType?: Record<string, boolean> | null; // e.g. { is_bankOwned: true, is_foreclosure: true }
    streetView?: string;
    orientation_ai?: {
        final_orientation: string;
        azimuth_degrees?: number | null;
        confidence?: 'high' | 'medium' | 'low';
        aerial_only_mode?: boolean;
        aerial_url?: string;
        street_view_url?: string;
        image_quality?: 'clear' | 'acceptable' | 'blurry';
        feng_shui_vastu?: string | null;
        privacy_insight?: string;
        lot_coverage_hardscape?: number | null;
        lot_coverage_pervious?: number | null;
        buyer_pro?: string;
        buyer_con?: string;
        orientation_highlights?: string;
    } | null;

    deprecated?: boolean;         // true = property is no longer active in the market
    deprecatedAt?: any;           // serverTimestamp of when it was marked deprecated
    parcelPolygon?: [number, number][] | { lon: number, lat: number }[];
    parcelApn?: string;
    parcelAreaSqft?: number;
    historical_disasters?: HistoricalDisasterData | null;
    broadband?: BroadbandData | null;
    drought?: DroughtData | null;
    census_demographics?: CensusDemographics | null;
    affordability_analysis?: {
        score: number;
        signals: any;
    } | null;
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
    mapZoomIn?: string;          // Radar close-up road map (Firebase Storage)
    mapZoomOut?: string;         // Radar wider-area road map (Firebase Storage)
    streetView?: string;         // Google Street View (Firebase Storage)
    satelliteImageUrl?: string;  // Google Maps satellite 2× (Firebase Storage)
    lastVerified: any; // serverTimestamp
}
