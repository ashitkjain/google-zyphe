export interface AIAnalysisResult {
    buyerAnalysis: string;
    sellerStrategy: string;
    realtorPitch: string;
    marketOutlook: string;
}

export interface NeighborhoodAnalysis {
    overview: string;
    neighborhood_features: {
        street_layout_and_traffic: string;
        sidewalks_and_pedestrian_infra: string;
        proximity_to_greenery_and_water: string;
        neighborhood_density: string;
        walkability_indicators: string;
        topography: string;
        development_patterns: string;
        nearby_amenities: string;
        transportation_access: string;
        general: string;
    }
}

export interface CommunityPulseSection {
    summary: string;
    points: string[];
    sources: string[];
}

export interface CommunityPulseResult {
    what_residents_like: CommunityPulseSection;
    common_complaints: CommunityPulseSection;
    safety_and_concerns: CommunityPulseSection;
    schools_family_friendliness: CommunityPulseSection;
    lifestyle_convenience: CommunityPulseSection;
    investment_insights: CommunityPulseSection;
}

export interface ImageQualityPoint {
    text: string;
    image_indices: number[];
}

export interface ImageQualityCategory {
    rating: string;
    observations: ImageQualityPoint[];
    issues: ImageQualityPoint[];
}

export interface ImageQualityAnalysisResult {
    overall_score: {
        score: number;
        summary: string;
    };
    top_photos: Array<{
        image_index: number;
        label: string;
        justification: string;
    }>;
    lighting_and_color: ImageQualityCategory;
    staging_and_clutter: ImageQualityCategory;
    composition: ImageQualityCategory;
    delete_list: {
        count: number;
        reasons: string[];
        image_indices: number[];
        description: string;
    };
    action_plan: {
        priority_actions: string[];
        editing_suggestions: string[];
        reshoot_suggestions: string[];
    };
}

export interface InvestmentResearchResult {
    market_performance: {
        occupancy_rate: string;
        adr: string;
        summary: string;
    };
    competitor_gaps: {
        friction_points: string[];
        praised_amenities: string[];
        standout_recommendations: string;
    };
    regulatory_updates: {
        laws_and_zoning: string;
        permit_caps: string;
        summary: string;
    };
    demand_drivers: Array<{
        event: string;
        date: string;
        pricing_impact: string;
    }>;
    revenue_projection_2026: Array<{
        period: string;
        projected_revenue: string;
        occupancy_estimate: string;
    }>;
    web_sources: Array<{
        title: string;
        url: string;
    }>;
}

export interface BiddingStrategyResult {
    property_specifics: {
        days_on_market: string;
        listing_history: string[] | string;
        price_changes: string;
    };
    zip_code_benchmarks: {
        median_days_on_market: string;
    };
    inventory_pressure: {
        months_of_supply: string;
        market_category: 'Strong Seller' | 'Balanced' | 'Buyer-Friendly' | string;
        pressure_analysis: string;
    };
    offer_velocity: {
        velocity_status: string;
        recent_offer_trends: string;
    };
    negotiation_strategy: {
        leverage_analysis: string;
        suggested_offer_tactics: string[];
        calculated_discount_strategy: string;
    };
}

export interface CustomAIAnalysisResult {
    report_title: string;
    home_interior: {
        overall_description: string;
        design_style: {
            style: string;
            reasoning: string;
        };
        color_and_materials: string;
        lighting: string;
        spatial_flow: string;
        staging_and_furnishings: string;
        condition_and_finish: string;
    };
    room_highlights: Array<{
        room_name: string;
        floor: string;
        description: string;
        potential_improvements: string;
    }>;
    exterior_and_neighborhood: {
        exterior_and_lot_appeal: {
            architecture_style: string;
            curb_appeal: string;
            backyard_and_patio: string;
        };
        views_privacy_orientation: {
            views: string;
            orientation: string;
            privacy: string;
        };
    };
    neighborhood?: NeighborhoodAnalysis;
    community_pulse?: CommunityPulseResult;
    image_quality_analysis?: ImageQualityAnalysisResult;
    investment_research?: InvestmentResearchResult;
    bidding_strategy?: BiddingStrategyResult;
}

export interface ComprehensiveAnalysisResult {
    summary: string;
    detailed_analysis: {
        location_neighborhood: string;
        outdoors_view_quality: string;
        visual_appeal_condition: string;
        privacy_layout: string;
        climate_resilience: string;
        additional_considerations: string;
    };
    risks_considerations: string;
}

export interface LeadReactivationResult {
    market_baseline: {
        rate_environment: string;
        inventory_outlook: string;
    };
    segments: Array<{
        segment_name: string;
        reasons_for_stale: string;
        optimal_hook: string;
        cadence: {
            day_1_sms: string;
            day_4_email: string;
        };
    }>;
}
