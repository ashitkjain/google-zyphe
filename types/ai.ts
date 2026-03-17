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
        topography: string;
        development_patterns: string;
        nearby_amenities: string;
        general: string;
    },
    visual_poi?: {
        dining?: string[];
        shopping?: string[];
        parks?: string[];
        transit?: string[];
        fitness?: string[];
        schools?: string[];
        medical?: string[];
        community?: string[];
        others?: string[];
    },
    map_labels?: string[];
    orientation?: {
        street_direction: string;
        home_position_relative_to_street: string;
        final_orientation: string;
        orientation_explanation: string;
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
    status?: 'running' | 'completed' | 'failed' | string;
    lastRan?: any;
    lastUpdated?: any;
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

export interface ChartPoint {
    label: string;
    value: number;
    value2?: number;
}

export interface DeepInvestmentResearchResult {
    content: string;
    structured_report?: {
        macroeconomic_indicators: {
            summary: string;
            details: string[];
            visual_hint?: string;
            chart_data?: {
                title: string;
                metric1: string;
                metric2?: string;
                points: ChartPoint[];
            };
        };
        market_dynamics: {
            summary: string;
            details: string[];
            visual_hint?: string;
            chart_data?: {
                title: string;
                metric1: string;
                metric2?: string;
                points: ChartPoint[];
            };
        };
        local_risks: {
            summary: string;
            risk_factors: string[];
            visual_hint?: string;
        };
        investment_outlook: {
            short_term: string;
            long_term: string;
        };
        pro_forma: {
            purchase_price: number;
            gross_rent: number;
            expenses: {
                property_tax: number;
                insurance: number;
                maintenance: number;
                management: number;
                vacancy: number;
            };
            noi: number;
            cap_rate: number;
        };
        value_add_strategies: Array<{
            name: string;
            description: string;
            est_cost: string;
            est_incremental_rent: string;
        }>;
        school_intelligence: {
            summary: string;
            rating_vs_performance_gap: string;
            proficiency_metrics: string[];
        };
        comparative_analysis: Array<{
            market: string;
            median_price: string;
            inventory_age: string;
            school_quality: string;
            primary_draw: string;
        }>;
        citations?: Array<{
            id: string;
            name: string;
            url?: string;
        }>;
    };
    status?: 'running' | 'completed' | 'failed' | string;
    lastRan?: any;
    lastUpdated?: any;
}

export interface DeepResearchInsights {
    executive_summary: string;
    median_price_range: string;
    ppsf_benchmark: string;
    months_of_supply: string;
    dom_range: string;
    risk_tags: string[];
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
    status?: 'running' | 'completed' | 'failed' | string;
    lastRan?: any;
    lastUpdated?: any;
}

export interface ExtractedFactor {
    id: number;
    name: string;
    value: string;
    confidence: 'high' | 'medium' | 'low';
    tags: string[];
}

export interface ContextGraphExtractionResult {
    address: string;
    extractedAt: string;
    factors: ExtractedFactor[];
    summary: {
        topStrengths: string[];
        topConcerns: string[];
        buyerProfile: string;
    };
}

// Removed InvestmentResearchResult aggregation to avoid redundancy

export interface StreetViewAnalysisResult {
    curbAppealScore: number;
    neighborhoodVibe: string;
    visualClutter: boolean;
    gardenDescription: string;
    safetyAssessment: string;
    privacyRating: string;
    maintenanceRisks: string[];
    solarObstructions: string;
    parkingLogistics: string;
    familySafety: string;
    utilityAesthetic: string;
    isImageryAvailable: boolean;
    neighborCondition: string;
    imageUrl?: string;
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
            privacy: string;
        };
        neighborhood_street_insights?: string;
    };
    neighborhood?: NeighborhoodAnalysis;
    community_pulse?: CommunityPulseResult;
    image_quality_analysis?: ImageQualityAnalysisResult;
    property_investment?: PropertySpecificInvestmentResult;
    general_market_intelligence?: GeneralMarketIntelligenceResult;
    deep_investment_research?: DeepInvestmentResearchResult;

    context_graph?: ContextGraphExtractionResult;
}

export interface ComprehensiveAnalysisResult {
    summary: string;
    detailed_analysis: {
        visual_appeal_condition: string;
        privacy_layout: string;
        outdoors_view_quality: string;
        location_neighborhood: string;
        community_pulse: string;
        additional_considerations: string;
        climate_resilience: string;
    };
    strategic_insights: string;
    risks_considerations: string;
    interior_summary?: {
        interior_summary: string;
        rooms_summary: string;
        vibe: string;
        objective_tags: string[];
    };
    lifestyle_insights?: {
        outdoor: string;
        family: string;
        senior: string;
        pets: string;
        food: string;
        professionals: string;
    };
    schools_summary?: string;
}


export interface PollenAnalysisResult {
    primary_triggers: string[];
    seasonality_window: string;
    breathe_easy_summary: string;
    maintenance_tip: string;
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
    address?: string;
    prompt_filename: string;
    llm_name: string;
    raw_payload: any;
    raw_response: any;
    image_urls?: string[];
    status: 'pending' | 'completed' | 'failed';
    error?: string;
    estimated_cost?: number;
    usage_metadata?: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
        cachedContentTokenCount?: number;
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
    sources?: {url: string; title: string}[] | null;
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
