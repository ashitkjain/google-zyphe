/**
 * Context Graph Decision Factors
 * 
 * Master list of 88 decision factors that power the buyer context graph.
 * Each factor maps to a graph node label and specifies the exact data source
 * from the chatbot context JSON.
 * 
 * These factors are used to:
 * 1. Generate the taxonomy via Gemini Deep Research
 * 2. Auto-tag properties with relevant nodes
 * 3. Drive search / recommendation matching for buyers
 */

// ── Node Label Types (categories of graph nodes) ──────────

export type GraphNodeLabel =
    | 'PriceTier'
    | 'FinancialFactor'
    | 'RiskProfile'
    | 'MarketMomentum'
    | 'InvestmentStrategy'
    | 'MarketTrend'
    | 'PropertyType'
    | 'StructuralTrait'
    | 'SizeTier'
    | 'Layout'
    | 'RoomFeature'
    | 'Vintage'
    | 'Condition'
    | 'DesignAesthetic'
    | 'VisualFeature'
    | 'OutdoorFeature'
    | 'LotProfile'
    | 'Nuisance'
    | 'School'
    | 'TransitProfile'
    | 'CommunityVibe'
    | 'ClimateRisk'
    | 'EcoWellness'
    | 'Orientation'
    | 'HealthRisk'
    | 'TerrainProfile'
    | 'StreetProfile'
    | 'LayoutFlexibility'
    | 'FunctionalLogistics'
    | 'HomeSystem'
    | 'SafetyInfrastructure'
    | 'DigitalPerception'
    | 'ImprovementOpportunity'
    | 'PropertyConstraint'
    | 'EconomicDriver'
    | 'MarketCatalyst'
    | 'GeoRisk'
    | 'ConnectivityProfile'
    | 'LifestyleFitScore'
    | 'NeighborhoodVibe'
    | 'AmenityDensity';

// ── Decision Factor Definition ────────────────────────────

export interface DecisionFactor {
    id: number;
    name: string;
    nodeLabel: GraphNodeLabel;
    dataSource: string;
    computation?: string;  // If the value needs to be computed/inferred
}

// ── Master Factor List ────────────────────────────────────

export const CONTEXT_GRAPH_FACTORS: DecisionFactor[] = [

    // ═══════════════════════════════════════════════════════
    // FINANCIAL & MARKET (1–10)
    // ═══════════════════════════════════════════════════════

    {
        id: 1,
        name: 'Price Bracket',
        nodeLabel: 'PriceTier',
        dataSource: 'property.price',
        computation: 'Bucket into "Entry", "Mid", "Luxury" based on local market percentiles',
    },
    {
        id: 2,
        name: 'HOA Friction',
        nodeLabel: 'FinancialFactor',
        dataSource: 'property.resoFacts.feesAndDues',
        computation: 'Highlight high fees or strict rules',
    },
    {
        id: 3,
        name: 'Insurance Risk',
        nodeLabel: 'RiskProfile',
        dataSource: 'property.annualHomeownersInsurance + property.fireRiskScore',
        computation: 'Flags FAIR Plan necessity (CA high-fire-risk insurability)',
    },
    {
        id: 4,
        name: 'True Carrying Cost',
        nodeLabel: 'FinancialFactor',
        dataSource: 'property.price + property.propertyTaxRate + property.resoFacts.feesAndDues + property.annualHomeownersInsurance',
        computation: 'Computed: Mortgage + Taxes + HOA + Insurance (monthly)',
    },
    {
        id: 5,
        name: 'Seller Motivation',
        nodeLabel: 'MarketMomentum',
        dataSource: 'property.priceHistory + property.timeOnZillow',
        computation: 'Recent price drops & extended days on market signal motivation',
    },
    {
        id: 6,
        name: 'ADU / House-Hacking Potential',
        nodeLabel: 'InvestmentStrategy',
        dataSource: 'deep_investment_research.structured_report.value_add_strategies',
    },
    {
        id: 7,
        name: 'Short-Term Rental Legality',
        nodeLabel: 'InvestmentStrategy',
        dataSource: 'deep_investment_research.structured_report.competitor_gaps.friction_points',
    },
    {
        id: 8,
        name: 'Long-Term Rental Yield',
        nodeLabel: 'InvestmentStrategy',
        dataSource: 'property.rentZestimate + property.price',
        computation: 'Computed: (rentZestimate × 12) / price — gross rental yield %',
    },
    {
        id: 9,
        name: 'Historical Appreciation',
        nodeLabel: 'MarketTrend',
        dataSource: 'deep_investment_research.macroeconomic_indicators + deep_investment_research.market_dynamics',
        computation: 'YoY/5yr appreciation trend from deep research; fallback to general_market_intelligence.market_dynamics.historical_appreciation',
    },
    {
        id: 10,
        name: 'Bidding War Probability',
        nodeLabel: 'MarketMomentum',
        dataSource: 'deep_investment_research.market_dynamics + property.timeOnZillow',
        computation: 'Derived from DOM, months of supply, and inventory data in deep research',
    },

    // ═══════════════════════════════════════════════════════
    // STRUCTURAL & SIZE (11–20)
    // ═══════════════════════════════════════════════════════

    {
        id: 11,
        name: 'Property Typology',
        nodeLabel: 'PropertyType',
        dataSource: 'property.homeType',
        computation: 'Single-Family, Condo, Townhouse, Multi-Family, etc.',
    },
    {
        id: 12,
        name: 'Bedroom Count',
        nodeLabel: 'StructuralTrait',
        dataSource: 'property.bedrooms',
    },
    {
        id: 13,
        name: 'Bathroom Count',
        nodeLabel: 'StructuralTrait',
        dataSource: 'property.bathrooms',
        computation: 'Buyers look for guest half-baths; ratio to bedrooms matters',
    },
    {
        id: 14,
        name: 'Usable Square Footage',
        nodeLabel: 'SizeTier',
        dataSource: 'property.livingAreaValue + property.taxSqft',
        computation: 'Cross-references listing sqft against county tax records; flags >10% discrepancies as potential unpermitted additions',
    },
    {
        id: 15,
        name: 'Lot Size',
        nodeLabel: 'SizeTier',
        dataSource: 'property.lotSize + property.parcelAreaSqft (ArcGIS)',
        computation: 'Listing lot size enriched with ArcGIS county parcel measurement; flags >5% discrepancies',
    },
    {
        id: 16,
        name: 'Single-Story Flow',
        nodeLabel: 'Layout',
        dataSource: 'visual_analysis.room_highlights + property.resoFacts',
        computation: 'Inferred from room floor assignments and reso facts',
    },
    {
        id: 17,
        name: 'Dedicated Home Office',
        nodeLabel: 'RoomFeature',
        dataSource: 'property.resoFacts.roomTypes + visual_analysis',
        computation: 'Look for Den/Office/Library in roomTypes & AI room descriptions',
    },
    {
        id: 18,
        name: 'Garage & Parking Capacity',
        nodeLabel: 'StructuralTrait',
        dataSource: 'property.resoFacts.garageParkingCapacity',
    },
    {
        id: 19,
        name: 'Foundation Type',
        nodeLabel: 'StructuralTrait',
        dataSource: 'property.resoFacts.foundationDetails',
        computation: 'Basement vs. Slab — affects usable space and cost',
    },
    {
        id: 20,
        name: 'Construction Era',
        nodeLabel: 'Vintage',
        dataSource: 'property.yearBuilt',
        computation: 'Bucket into "Pre-War", "Mid-Century", "80s-90s", "2000s", "New Build"',
    },

    // ═══════════════════════════════════════════════════════
    // INTERIOR DESIGN & VISUAL (21–30)
    // ═══════════════════════════════════════════════════════

    {
        id: 21,
        name: 'Move-In Readiness',
        nodeLabel: 'Condition',
        dataSource: 'visual_analysis.home_interior.condition_and_finish',
        computation: '"Turn-key" vs "Needs TLC" based on AI condition assessment',
    },
    {
        id: 22,
        name: 'Fixer-Upper / TLC',
        nodeLabel: 'Condition',
        dataSource: 'visual_analysis.home_interior.condition_and_finish',
        computation: 'AI extraction of "Needs cosmetic updates", "dated finishes", etc.',
    },
    {
        id: 23,
        name: 'Architectural Style',
        nodeLabel: 'DesignAesthetic',
        dataSource: 'visual_analysis.home_interior.design_style',
        computation: 'e.g., "Mediterranean", "Craftsman", "Contemporary", "Farmhouse"',
    },
    {
        id: 24,
        name: 'Natural Light / Brightness',
        nodeLabel: 'DesignAesthetic',
        dataSource: 'visual_analysis.home_interior.lighting',
        computation: '"Sun-drenched", "Dark interior", "Skylight-enhanced"',
    },
    {
        id: 25,
        name: 'Open-Concept Flow',
        nodeLabel: 'Layout',
        dataSource: 'visual_analysis.home_interior.spatial_flow',
    },
    {
        id: 26,
        name: 'Kitchen Profile',
        nodeLabel: 'VisualFeature',
        dataSource: 'visual_analysis.home_interior.color_and_materials + room_highlights',
        computation: 'Extract materials: "Wood cabinets", "Quartz counters" + vibe: "Chef\'s kitchen"',
    },
    {
        id: 27,
        name: 'Bathroom Profile',
        nodeLabel: 'VisualFeature',
        dataSource: 'visual_analysis.home_interior.color_and_materials + room_highlights',
        computation: 'Extract materials: "Wood vanities", "Tile floors" + luxury: "Soaking tub"',
    },
    {
        id: 28,
        name: 'Flooring Material',
        nodeLabel: 'VisualFeature',
        dataSource: 'property.resoFacts.flooring',
        computation: 'Aversion to carpet is high; hardwood is premium',
    },
    {
        id: 29,
        name: 'Ceiling Volume',
        nodeLabel: 'VisualFeature',
        dataSource: 'visual_analysis.room_highlights',
        computation: 'AI descriptions: "Vaulted ceilings", "Soaring double-height"',
    },
    {
        id: 30,
        name: 'Interior Finishes',
        nodeLabel: 'DesignAesthetic',
        dataSource: 'visual_analysis.home_interior',
        computation: 'Walls ("Neutral paint"), Trim ("Crown molding"), Windows ("Shutters")',
    },

    // ═══════════════════════════════════════════════════════
    // OUTDOOR & LOT (31–40)
    // ═══════════════════════════════════════════════════════

    {
        id: 31,
        name: 'Fenced Yard (Pets/Kids)',
        nodeLabel: 'OutdoorFeature',
        dataSource: 'property.resoFacts.fencing + visual_analysis.exterior_and_neighborhood.exterior_and_lot_appeal.backyard_and_patio',
    },
    {
        id: 32,
        name: 'Outdoor Entertaining',
        nodeLabel: 'OutdoorFeature',
        dataSource: 'visual_analysis.exterior_and_neighborhood.exterior_and_lot_appeal.backyard_and_patio',
        computation: '"Pergola", "Pavered patio", "Outdoor kitchen", "Fire pit"',
    },
    {
        id: 33,
        name: 'Private Pool / Spa',
        nodeLabel: 'OutdoorFeature',
        dataSource: 'visual_analysis + property.description',
        computation: 'AI imagery analysis & MLS listing description',
    },
    {
        id: 34,
        name: 'Neighbor Privacy',
        nodeLabel: 'LotProfile',
        dataSource: 'streetViewAnalysis.privacyRating',
    },
    {
        id: 35,
        name: 'Curb Appeal Score',
        nodeLabel: 'LotProfile',
        dataSource: 'streetViewAnalysis.curbAppealScore',
        computation: '>= 8 is "High Curb Appeal"',
    },
    {
        id: 36,
        name: 'View Quality',
        nodeLabel: 'LotProfile',
        dataSource: 'visual_analysis.exterior_and_neighborhood.views_privacy_orientation.views',
        computation: '"Rolling hills", "Golf course", "Mountain view", "City skyline"',
    },
    {
        id: 37,
        name: 'Street Typology',
        nodeLabel: 'LotProfile',
        dataSource: 'visual_analysis.neighborhood.final_orientation',
        computation: '"Cul-de-sac", "Corner lot", "Through street", "Court"',
    },
    {
        id: 38,
        name: 'Visual Clutter / Wires',
        nodeLabel: 'Nuisance',
        dataSource: 'streetViewAnalysis.visualClutter + streetViewAnalysis.utilityAesthetic',
    },
    {
        id: 39,
        name: 'Usable Lawn Space',
        nodeLabel: 'OutdoorFeature',
        dataSource: 'streetViewAnalysis.gardenDescription',
        computation: '"Room for kids to play", "Flat usable backyard"',
    },
    {
        id: 40,
        name: 'Low-Maintenance Yard',
        nodeLabel: 'LotProfile',
        dataSource: 'property.resoFacts.exteriorFeatures + visual_analysis',
        computation: '"Drought-tolerant", "Artificial turf", "Minimal landscaping"',
    },

    // ═══════════════════════════════════════════════════════
    // LOCATION & COMMUNITY (41–45)
    // ═══════════════════════════════════════════════════════

    {
        id: 41,
        name: 'School District Quality',
        nodeLabel: 'School',
        dataSource: 'property.schools',
        computation: 'GreatSchools Rating >= 8 is "Top-Rated District"',
    },
    {
        id: 42,
        name: 'School Matriculation Power',
        nodeLabel: 'School',
        dataSource: 'deep_investment_research.structured_report.school_intelligence',
        computation: 'Real university placement rates, feeder school reputation',
    },
    {
        id: 43,
        name: 'Walkability (15-Min City)',
        nodeLabel: 'TransitProfile',
        dataSource: 'property.walkScore + property.walkScoreDesc',
    },
    {
        id: 44,
        name: 'Proximity to Greenery',
        nodeLabel: 'CommunityVibe',
        dataSource: 'visual_analysis.neighborhood.neighborhood_features.proximity_to_greenery_and_water',
    },
    {
        id: 45,
        name: 'Family Safety / Sidewalks',
        nodeLabel: 'CommunityVibe',
        dataSource: 'streetViewAnalysis.familySafety',
        computation: '"Continuous sidewalks", "Well-lit streets", "Low traffic"',
    },

    // ═══════════════════════════════════════════════════════
    // ENVIRONMENTAL & SUSTAINABILITY (46–50)
    // ═══════════════════════════════════════════════════════

    {
        id: 46,
        name: 'Wildfire Risk',
        nodeLabel: 'ClimateRisk',
        dataSource: 'property.fireRiskScore',
    },
    {
        id: 47,
        name: 'Flood Risk',
        nodeLabel: 'ClimateRisk',
        dataSource: 'property.floodRiskScore',
    },
    {
        id: 48,
        name: 'Solar Yield Potential',
        nodeLabel: 'EcoWellness',
        dataSource: 'property.solarData.estimatedSolarProduction.annualKwh',
        computation: '> 15,000 kWh is "High Solar Yield"',
    },
    {
        id: 49,
        name: 'Allergen / Pollen Safety',
        nodeLabel: 'EcoWellness',
        dataSource: 'property.pollen.dominantPollenType + property.pollen.score',
    },
    {
        id: 50,
        name: 'HVAC Quality / Air Filtration',
        nodeLabel: 'EcoWellness',
        dataSource: 'property.resoFacts.heating + property.resoFacts.cooling',
        computation: 'Central Air vs Window Units; presence of filtration systems',
    },

    // ═══════════════════════════════════════════════════════
    // ADVANCED INTELLIGENCE (51–70)
    // ═══════════════════════════════════════════════════════

    {
        id: 51,
        name: 'Home Orientation / Facing',
        nodeLabel: 'Orientation',
        dataSource: 'property.orientation_ai.final_orientation + property.orientation_ai.feng_shui_vastu',
        computation: 'Satellite AI analysis determines facing direction; cross-referenced with Feng Shui/Vastu favorability (North/East = favorable)',
    },
    {
        id: 52,
        name: 'Specific Allergen Triggers',
        nodeLabel: 'HealthRisk',
        dataSource: 'property.pollen.analysis.primary_triggers',
        computation: 'e.g., "Juniper" vs "Oak" — matches buyers with specific allergies away from problem zones',
    },
    {
        id: 53,
        name: 'Micro-Particulate Load',
        nodeLabel: 'EcoWellness',
        dataSource: 'property.airQuality.pollutants',
        computation: 'Filter by pm25 or o3 concentrations for buyers with asthma or respiratory concerns',
    },
    {
        id: 54,
        name: 'Topography & Elevation',
        nodeLabel: 'TerrainProfile',
        dataSource: 'property.parcelValidation.slopePercent + property.parcelValidation.slopeCategory + property.parcelValidation.uphillDir',
        computation: 'Measured via USGS 3DEP 8-point elevation scout; slope classified as Flat (<5%), Moderate (6-15%), Steep (16-30%), Heavy (>30%); includes backyard facing direction',
    },
    {
        id: 55,
        name: 'Carbon Offset Potential',
        nodeLabel: 'EcoWellness',
        dataSource: 'property.solarData.estimatedSolarProduction.carbonOffsetTons',
        computation: 'Appeals to ESG/Eco-conscious buyers comparing the "greenness" of different homes',
    },
    {
        id: 56,
        name: 'Utility Aesthetic / Wires',
        nodeLabel: 'Nuisance',
        dataSource: 'streetViewAnalysis.utilityAesthetic',
        computation: 'Differentiates "Underground utilities" from unsightly "Overhead power lines"',
    },
    {
        id: 57,
        name: 'Street Parking Logistics',
        nodeLabel: 'FunctionalLogistics',
        dataSource: 'streetViewAnalysis.parkingLogistics',
        computation: 'e.g., "Ample street parking" vs "Driveway only" — critical for multi-car families or entertainers',
    },
    {
        id: 58,
        name: 'Sidewalk Continuity & Safety',
        nodeLabel: 'CommunityVibe',
        dataSource: 'streetViewAnalysis.familySafety',
        computation: 'e.g., "Continuous sidewalks" — essential for strollers, dog owners, or retirees',
    },
    {
        id: 59,
        name: 'Street Layout & Traffic',
        nodeLabel: 'Nuisance',
        dataSource: 'visual_analysis.neighborhood_features.street_layout_and_traffic',
        computation: 'Differentiates a quiet "Cul-de-sac" from a busy "Arterial" road',
    },
    {
        id: 60,
        name: 'Neighborhood Visual Clutter',
        nodeLabel: 'StreetProfile',
        dataSource: 'streetViewAnalysis.visualClutter',
        computation: 'Boolean indicating messy neighboring yards or chaotic streetscapes',
    },
    {
        id: 61,
        name: 'Multi-Gen / ADU Readiness',
        nodeLabel: 'LayoutFlexibility',
        dataSource: 'property.description + property.resoFacts.roomTypes',
        computation: 'Tags like "downstairs bedroom/full bath", "Basement Full", or "separate entrance"',
    },
    {
        id: 62,
        name: 'Laundry Logistics',
        nodeLabel: 'FunctionalLogistics',
        dataSource: 'property.resoFacts.laundryFeatures',
        computation: 'Differentiates "Inside/Laundry Room" vs "In Garage" — cold garage laundry is a dealbreaker',
    },
    {
        id: 63,
        name: 'Water & Air Quality Systems',
        nodeLabel: 'HomeSystem',
        dataSource: 'property.resoFacts.appliances + property.resoFacts.heating',
        computation: 'Extracts "Water Softener", "Water Filter System", or "Zoned HVAC"',
    },
    {
        id: 64,
        name: 'Life Safety & Security Infra',
        nodeLabel: 'SafetyInfrastructure',
        dataSource: 'property.resoFacts.securityFeatures',
        computation: '"Fire Sprinkler System" or "Double Strapped Water Heater" — mitigates CA FAIR plan insurance costs',
    },
    {
        id: 65,
        name: 'Digital Presentation Quality',
        nodeLabel: 'DigitalPerception',
        dataSource: 'image_quality_analysis.overall_score + image_quality_analysis.staging_and_clutter',
        computation: 'Find "Ugly Ducklings": properties with high structural value but terrible online photos',
    },
    {
        id: 66,
        name: 'AI-Suggested Sweat Equity',
        nodeLabel: 'ImprovementOpportunity',
        dataSource: 'visual_analysis.room_highlights[].potential_improvements',
        computation: 'AI suggesting "Add a kitchen island", "Add pergola" — perfect for flippers',
    },
    {
        id: 67,
        name: 'Solar Obstruction Friction',
        nodeLabel: 'PropertyConstraint',
        dataSource: 'streetViewAnalysis.solarObstructions',
        computation: 'e.g., "Large tree potentially obstructs" — kills ROI of adding solar panels',
    },
    {
        id: 68,
        name: 'Proximity to "Sticky" Job Hubs',
        nodeLabel: 'EconomicDriver',
        dataSource: 'deep_investment_research.macroeconomic_indicators',
        computation: 'Links properties to specific corporate HQs like Workday or Roche for tenant stability; fallback to general_market_intelligence.demand_drivers',
    },
    {
        id: 69,
        name: 'Future Megaprojects',
        nodeLabel: 'MarketCatalyst',
        dataSource: 'deep_investment_research.investment_outlook + deep_investment_research.local_risks',
        computation: 'Flags homes near massive value-adds like "IKEA Opening 2026" or "Valley Link Transit Project"; fallback to general_market_intelligence.upcoming_developments',
    },
    {
        id: 70,
        name: 'Severe Geo-Risks',
        nodeLabel: 'GeoRisk',
        dataSource: 'deep_investment_research.local_risks',
        computation: 'Soil types prone to liquefaction or proximity to dam inundation zones — hidden tail-risk',
    },

    // ═══════════════════════════════════════════════════════
    // COMMUNITY & MARKET INTELLIGENCE (71–75)
    // ═══════════════════════════════════════════════════════

    {
        id: 71,
        name: 'Development Maturity',
        nodeLabel: 'CommunityVibe',
        dataSource: 'visual_analysis.neighborhood.neighborhood_features.development_patterns',
        computation: '"New Build Area" vs "Established" — affects infrastructure and cohesion',
    },
    {
        id: 72,
        name: 'Resident Complaint Profile',
        nodeLabel: 'CommunityVibe',
        dataSource: 'community_pulse.common_complaints',
        computation: 'Top recurring complaints (e.g., "HOA strictness", "Traffic")',
    },
    {
        id: 73,
        name: 'Resident Satisfaction Drivers',
        nodeLabel: 'CommunityVibe',
        dataSource: 'community_pulse.what_residents_like',
        computation: 'Top things residents love (e.g., "Walkability", "Schools")',
    },
    {
        id: 74,
        name: 'Perceived Neighborhood Safety',
        nodeLabel: 'CommunityVibe',
        dataSource: 'community_pulse.safety_and_concerns',
        computation: 'Resident sentiment: "Very Safe" vs "Mixed" vs "Concerns"',
    },
    {
        id: 75,
        name: 'Market Velocity (DOM)',
        nodeLabel: 'MarketMomentum',
        dataSource: 'deep_investment_research.market_dynamics',
        computation: 'City-level median DOM from deep research market_dynamics section: "Fast" (<14), "Moderate" (14-30), "Slow" (>30); fallback to general_market_intelligence.market_dynamics.days_on_market',
    },

    // ═══════════════════════════════════════════════════════
    // INFRASTRUCTURE & ENVIRONMENT (76–79)
    // ═══════════════════════════════════════════════════════

    {
        id: 76,
        name: 'Internet & Connectivity',
        nodeLabel: 'ConnectivityProfile',
        dataSource: 'property.broadband.hasFiber + property.broadband.topDownloadMbps + property.broadband.has5G + property.broadband.providerCount',
        computation: 'Tiers: Gigabit (≥1Gbps), Fast (≥300Mbps), Moderate (≥100Mbps), Basic (<100Mbps). Flags Fiber and 5G availability.',
    },
    {
        id: 77,
        name: 'Noise Profile (Measured)',
        nodeLabel: 'Nuisance',
        dataSource: 'property.noiseScore + property.noiseTrafficScore + property.noiseAirportScore + property.noiseLocalScore',
        computation: 'Measured by HowLoud SoundScore: Very Quiet (≥90), Calm (≥80), Moderate (≥70), Active (≥60), Loud (<60). Breaks down traffic, airport, and local noise contributions.',
    },
    {
        id: 78,
        name: 'Water & Drought Risk',
        nodeLabel: 'ClimateRisk',
        dataSource: 'property.drought.severity + property.drought.severityLevel + property.drought.none',
        computation: 'From US Drought Monitor: None, Abnormally Dry (D0), Moderate (D1), Severe (D2), Extreme (D3), Exceptional (D4). Reports % of county area affected.',
    },
    {
        id: 79,
        name: 'Disaster History',
        nodeLabel: 'GeoRisk',
        dataSource: 'property.historical_disasters.events',
        computation: 'Counts FEMA-declared disasters (wildfire, flood, earthquake, etc.) affecting the county. Summarizes by type.',
    },

    // ═══════════════════════════════════════════════════════
    // LIFESTYLE FIT (80–82)
    // ═══════════════════════════════════════════════════════

    {
        id: 80,
        name: 'Professional Lifestyle Fit',
        nodeLabel: 'LifestyleFitScore',
        dataSource: 'lifestyle_fit.working_professionals (Firestore cache)',
        computation: 'AI verdict (Excellent/Good/Moderate/Poor/Not Recommended) based on: home office, commute access, modern kitchen, low-maintenance yard, smart features, Wi-Fi layout, noise for calls',
    },
    {
        id: 81,
        name: 'Family Lifestyle Fit',
        nodeLabel: 'LifestyleFitScore',
        dataSource: 'lifestyle_fit.families_with_kids (Firestore cache)',
        computation: 'AI verdict based on: bedroom count/layout, yard safety, school ratings, cul-de-sac/low traffic, storage, pool safety, fencing, room for growth',
    },
    {
        id: 82,
        name: 'Senior Lifestyle Fit',
        nodeLabel: 'LifestyleFitScore',
        dataSource: 'lifestyle_fit.seniors (Firestore cache)',
        computation: 'AI verdict based on: single-story/elevator, step-free entry, wide doorways, walk-in shower, flat terrain, medical proximity, walkable errands, HOA exterior maintenance',
    },

    // ═══════════════════════════════════════════════════════
    // NEIGHBORHOOD & AMENITIES (83–88)
    // ═══════════════════════════════════════════════════════

    {
        id: 83,
        name: 'Micro-Neighborhood Identity',
        nodeLabel: 'NeighborhoodVibe',
        dataSource: 'neighborhood_identity.neighborhood_name + neighborhood_identity.price_context + neighborhood_identity.character (Firestore cache)',
        computation: 'Social/micro-level neighborhood name that locals use (e.g. "Birdland", "Vintage Hills") + price tier + community type (Gated/HOA/Open)',
    },
    {
        id: 84,
        name: 'Walkable Amenity Score',
        nodeLabel: 'AmenityDensity',
        dataSource: 'property.neighborhoodPlaces.walkable (Google Places API, 1.5km radius)',
        computation: 'Count of walkable POIs: dining, parks, shops, fitness, schools, community. High (≥10), Moderate (5-9), Low (<5)',
    },
    {
        id: 85,
        name: 'Medical Proximity',
        nodeLabel: 'AmenityDensity',
        dataSource: 'property.neighborhoodPlaces.drivable.medical (Google Places API, 5km radius)',
        computation: 'Number of hospitals within 5km and distance to closest. Critical for seniors and families with young children.',
    },
    {
        id: 86,
        name: 'EV Infrastructure',
        nodeLabel: 'AmenityDensity',
        dataSource: 'property.neighborhoodPlaces.transit (electric_vehicle_charging_station type)',
        computation: 'Number of EV charging stations nearby and distance to closest. Replaces AI-guessed EV Readiness (#56 checks MLS text for 240V).',
    },
    {
        id: 87,
        name: 'Pet Friendliness',
        nodeLabel: 'CommunityVibe',
        dataSource: 'neighborhoodPlaces.parks + property.resoFacts.fencing + lifestyle_insights.pets',
        computation: 'Combines real dog park/off-leash area count with property fencing and vet clinic proximity. High if fenced + 2+ parks.',
    },
    {
        id: 88,
        name: 'Dining & Entertainment Scene',
        nodeLabel: 'AmenityDensity',
        dataSource: 'neighborhoodPlaces.walkable.dining (Google Places API, 1.5km radius)',
        computation: 'Walkable restaurant count + average rating + variety. "Vibrant" if 5+ walkable with avg ≥4.0★. "Sparse" if car required.',
    },
];


// ── Utilities ─────────────────────────────────────────────

/** Get all unique node labels used in the factor list */
export const getNodeLabels = (): GraphNodeLabel[] => {
    return Array.from(new Set(CONTEXT_GRAPH_FACTORS.map(f => f.nodeLabel)));
};

/** Group factors by their node label category */
export const getFactorsByLabel = (): Record<GraphNodeLabel, DecisionFactor[]> => {
    const grouped = {} as Record<GraphNodeLabel, DecisionFactor[]>;
    for (const factor of CONTEXT_GRAPH_FACTORS) {
        if (!grouped[factor.nodeLabel]) grouped[factor.nodeLabel] = [];
        grouped[factor.nodeLabel].push(factor);
    }
    return grouped;
};

/** Get factors that require computation (not direct field reads) */
export const getComputedFactors = (): DecisionFactor[] => {
    return CONTEXT_GRAPH_FACTORS.filter(f => f.computation);
};

/** Get factors that are direct field reads (no computation) */
export const getDirectFactors = (): DecisionFactor[] => {
    return CONTEXT_GRAPH_FACTORS.filter(f => !f.computation);
};
