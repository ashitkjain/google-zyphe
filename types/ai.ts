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

export interface PropertySpecificInvestmentResult {
    str_performance: {
        occupancy_rate: string;
        adr: string;
        annual_revenue_projection: string;
    };
    ltr_analysis: {
        monthly_rent: string;
        vacancy_rate: string;
        comparison_summary: string;
    };
}

export interface GeneralMarketIntelligenceResult {
    market_dynamics: {
        historical_appreciation: string;
        projected_growth: string;
        days_on_market: string;
    };
    competitor_gaps: {
        friction_points: string[];
        praised_amenities: string[];
        recommendations: string;
    };
    regulatory_and_growth: {
        laws_and_zoning: string;
        upcoming_developments: string;
        summary: string;
    };
    demand_drivers: Array<{
        event: string;
        date: string;
        impact: string;
    }>;
    web_sources: Array<{
        title: string;
        url: string;
    }>;
}

// Removed InvestmentResearchResult aggregation to avoid redundancy

export interface StreetViewAnalysisResult {
    curbAppealScore: number;
    architecturalStyle: string;
    neighborhoodVibe: string;
    visualClutter: boolean;
    gardenDescription: string;
    safetyAssessment: string;
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
    image_by_image_analysis?: Array<{
        image_id: string;
        analysis: string;
    }>;
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
    property_investment?: PropertySpecificInvestmentResult;
    general_market_intelligence?: GeneralMarketIntelligenceResult;
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
    summary: {
        total_leads: number;
        markets_detected: number;
        high_priority: number;
        recommended_daily_volume: number;
        primary_strategy: string;
    };
    global_settings: {
        default_channel: string;
        send_window: string;
        timezone: string;
        opt_out_text: string;
    };
    market_context: Array<{
        market_name: string;
        rates_trend: 'rising' | 'flat' | 'declining' | string;
        inventory_trend: 'rising' | 'flat' | 'declining' | string;
        avg_days_on_market: 'short' | 'normal' | 'long' | string;
        buyer_leverage_notes: string;
        confidence: 'high' | 'medium' | 'low' | string;
    }>;
    lead_plans: Array<{
        lead_id: string;
        lead_name: string;
        market: string;
        priority_score: number;
        staleness_reason: 'rates' | 'inventory' | 'timing' | 'life_event' | 'unknown' | string;
        recommended_channel: 'sms' | 'email' | 'call' | 'direct_mail' | string;
        tone: 'low_pressure' | 'friendly' | 'professional' | string;
        first_touch: {
            send_after_days: number;
            message: string;
            sent_at?: any;
            reply_received?: boolean;
        };
        sequence: {
            enabled: boolean;
            steps: Array<{
                day_offset: number;
                channel: 'sms' | 'email' | 'call' | 'direct_mail' | string;
                message: string;
                sent_at?: any;
                reply_received?: boolean;
            }>;
        };
    }>;
}
export interface LLMCallEvent {
    id?: string;
    user_id: string;
    zpid?: string;
    prompt_filename: string;
    llm_name: string;
    raw_payload: any;
    raw_response: any;
    status: 'pending' | 'completed' | 'failed';
    error?: string;
    estimated_cost?: number;
    usage_metadata?: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
    };
    safety_ratings?: any;
    finish_reason?: string;
    citation_metadata?: any;
    request_sent_at?: any;
    response_received_at?: any;
    timestamp: any; // serverTimestamp or Date
}

export interface ReactivationAnalysisSummary {
    id: string;
    summary: {
        total_leads: number;
        markets_detected: number;
        high_priority: number;
        recommended_daily_volume: number;
        primary_strategy: string;
    };
    global_settings: {
        default_channel: string;
        send_window: string;
        timezone: string;
        opt_out_text: string;
    };
    created_date: any; // serverTimestamp
    leads_documents: string; // reference to leads_documents
    llm_call_events: string; // reference to llm_call_events row
    userId: string;
    clientId: string;
}

export interface MarketContextRecord {
    id?: string;
    reactivation_analysis_summary_id: string;
    userId: string;
    market_name: string;
    rates_trend: 'rising' | 'flat' | 'declining' | string;
    inventory_trend: 'rising' | 'flat' | 'declining' | string;
    avg_days_on_market: 'short' | 'normal' | 'long' | string;
    buyer_leverage_notes: string;
    confidence: 'high' | 'medium' | 'low' | string;
    created_at: any; // serverTimestamp
}

export interface LeadPlanRecord {
    id?: string;
    reactivation_analysis_summary_id: string;
    userId: string;
    lead_id: string;
    lead_name: string;
    market: string;
    priority_score: number;
    staleness_reason: 'rates' | 'inventory' | 'timing' | 'life_event' | 'unknown' | string;
    recommended_channel: 'sms' | 'email' | 'call' | 'direct_mail' | string;
    tone: 'low_pressure' | 'friendly' | 'professional' | string;
    first_touch: {
        send_after_days: number;
        message: string;
        sent_at?: any;
        reply_received?: boolean;
    };
    sequence: {
        enabled: boolean;
        steps: Array<{
            day_offset: number;
            channel: 'sms' | 'email' | 'call' | 'direct_mail' | string;
            message: string;
            sent_at?: any;
            reply_received?: boolean;
        }>;
    };
    reactivation_status?: 'suggested' | 'pursuing' | 'responded' | 'archived' | 'not_pursuing';
    statusUpdatedOn?: any;
}
export interface AIUsage {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
    cost: number;
    model: string;
}

export interface AIResponseWithUsage<T> {
    data: T;
    usage: AIUsage;
}

export interface DailyPulseResult {
    activePipelineValue: number;
    dailyFive: Array<{
        name: string;
        reason: string;
        phone: string;
        type: 'Buyer' | 'Seller';
    }>;
    todayTasks: Array<{ name: string; priority: string }>;
    upcomingTasks: Array<{ name: string; dueDate: string }>;
    todayMeetings: Array<{ title: string; time: string; client: string }>;
    redFlags: Array<{
        name: string;
        hook: string;
    }>;
    proTip: string;
    summary: {
        activePursuits: number;
        neglectedLeads: number;
    };
}
