/**
 * Property Feature Taxonomy
 *
 * Single source of truth for all property feature tags.
 * Used by:
 *   - FeaturesWizard UI (chip display + user selection)
 *   - AI extraction (Gemini prompt engineering + response parsing)
 *   - Context graph generation (node/edge creation + scoring)
 *
 * Adding a tag here automatically surfaces it everywhere.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Top-level wizard zone this tag belongs to. */
export type TagZone =
    | 'architecture_entry'   // Zone 1: Architecture & Curb Appeal
    | 'culinary'             // Zone 2: Culinary Space
    | 'living_entertaining'  // Zone 3: Living & Entertainment
    | 'primary_sanctuary'    // Zone 4: Primary Sanctuary
    | 'shower_wellness'      // Zone 5: Shower & Wellness
    | 'outdoor_grounds';     // Zone 6: Outdoor Oasis & Grounds

/**
 * Semantic grouping within a zone.
 * Used by AI prompts to structure extraction and by the context graph
 * to create typed edges between property nodes.
 */
export type TagCategory =
    // ── Zone 1: Architecture & Curb Appeal
    | 'architecture_style'
    | 'entry_facade'
    | 'tech_garage'
    // ── Zone 2: Culinary Space
    | 'kitchen_layout'
    | 'kitchen_surfaces'
    | 'kitchen_appliances'
    // ── Zone 3: Living & Entertainment
    | 'living_features'
    | 'bonus_rooms'
    | 'indoor_views'
    // ── Zone 4: Primary Sanctuary
    | 'bedroom_layout'
    | 'closet_storage'
    | 'bedroom_amenities'
    // ── Zone 5: Shower & Wellness
    | 'bathroom_fixtures'
    | 'bathroom_finishes'
    | 'wellness_rooms'
    // ── Zone 6: Outdoor Oasis & Grounds
    | 'lot_vibe'
    | 'water_fire'
    | 'outdoor_entertaining'
    | 'utility_play'
    | 'outdoor_views';

export interface PropertyTag {
    /** Snake_case identifier — used as context graph node key and AI extraction key. */
    id: string;
    /** Human-readable label shown in the wizard and reports. */
    label: string;
    zone: TagZone;
    category: TagCategory;
    /**
     * Alternate terms Gemini may encounter in MLS listings, agent remarks, or
     * property descriptions. Used during AI extraction to normalize to this tag.
     */
    aliases?: string[];
}

// ─── Taxonomy ─────────────────────────────────────────────────────────────────

export const PROPERTY_TAXONOMY: PropertyTag[] = [
    // ── Zone 1: Architecture & Curb Appeal
    { id: 'victorian', label: 'Victorian', zone: 'architecture_entry', category: 'architecture_style', aliases: ['victorian style', 'victorian architecture', 'queen anne'] },
    { id: 'edwardian', label: 'Edwardian', zone: 'architecture_entry', category: 'architecture_style', aliases: ['edwardian style', 'edwardian architecture'] },
    { id: 'modern', label: 'Modern', zone: 'architecture_entry', category: 'architecture_style', aliases: ['contemporary', 'modern architecture', 'modernist'] },
    { id: 'historical_charm', label: 'Historical Charm', zone: 'architecture_entry', category: 'architecture_style', aliases: ['historic', 'historic home', 'historic character', 'charming older home'] },
    { id: 'custom_millwork', label: 'Custom Millwork / Moldings', zone: 'architecture_entry', category: 'architecture_style', aliases: ['custom woodwork', 'fine millwork', 'architectural woodwork', 'built-in millwork', 'crown molding', 'ornamental trim', 'decorative trim', 'plaster moldings', 'decorative moldings'] },
    
    { id: 'statement_door', label: 'Statement Door', zone: 'architecture_entry', category: 'entry_facade', aliases: ['grand entry door', 'oversized front door', 'custom front door', 'pivot door'] },
    { id: 'designer_hardware', label: 'Designer Hardware', zone: 'architecture_entry', category: 'entry_facade', aliases: ['premium hardware', 'luxury door hardware', 'designer fixtures'] },
    { id: 'welcoming_porch', label: 'Welcoming Porch', zone: 'architecture_entry', category: 'entry_facade', aliases: ['front porch', 'covered porch', 'wraparound porch', 'veranda'] },
    { id: 'dramatic_foyer', label: 'Dramatic Foyer', zone: 'architecture_entry', category: 'entry_facade', aliases: ['grand foyer', 'two-story foyer', 'impressive entry', 'soaring entry', 'double-height foyer'] },
    { id: 'high_ceilings_entry', label: 'High Ceilings', zone: 'architecture_entry', category: 'entry_facade', aliases: ['tall ceilings', 'vaulted entry', 'soaring ceilings', 'two-story entry'] },
    { id: 'entry_glass_views', label: 'Glass Sidelights & Transom', zone: 'architecture_entry', category: 'entry_facade', aliases: ['sidelights', 'glass sidelights', 'entry transom', 'glass entry doors', 'view-through entry', 'entry glass views'] },
    
    { id: 'garage_3_car', label: '3-Car Garage', zone: 'architecture_entry', category: 'tech_garage', aliases: ['three car garage', '3 car garage', 'triple garage', 'oversized garage'] },
    { id: 'ev_charging', label: 'EV Charging', zone: 'architecture_entry', category: 'tech_garage', aliases: ['electric vehicle charging', 'EV charger', 'Level 2 charger', 'Tesla charger', 'EVSE'] },
    { id: 'backup_battery', label: 'Backup Battery / Powerwall', zone: 'architecture_entry', category: 'tech_garage', aliases: ['Tesla Powerwall', 'home battery backup', 'energy storage', 'battery backup system', 'whole-home battery'] },
    { id: 'solar_panels', label: 'Solar (Owned)', zone: 'architecture_entry', category: 'tech_garage', aliases: ['owned solar', 'solar energy', 'solar power', 'photovoltaic panels', 'solar array', 'solar panels'] },
    { id: 'premium_lighting', label: 'Architectural / Smart Lighting', zone: 'architecture_entry', category: 'tech_garage', aliases: ['automated lighting', 'programmable lighting', 'Lutron lighting', 'smart exterior lights', 'smart lighting', 'landscape lighting', 'uplighting', 'path lighting', 'dramatic lighting', 'accent lighting', 'architectural lighting'] },
    { id: 'smart_irrigation', label: 'Smart Irrigation', zone: 'architecture_entry', category: 'tech_garage', aliases: ['automated irrigation', 'drip irrigation', 'smart sprinkler', 'Rachio', 'irrigation system'] },

    // ── Zone 2: Culinary Space
    { id: 'open_concept', label: 'Open-Concept', zone: 'culinary', category: 'kitchen_layout', aliases: ['open floor plan', 'open layout', 'great room', 'open plan living'] },
    { id: 'dirty_kitchen', label: 'Prep / Back Kitchen', zone: 'culinary', category: 'kitchen_layout', aliases: ['prep kitchen', 'butler kitchen', 'second kitchen', 'catering kitchen', 'back kitchen', 'dirty kitchen'] },
    { id: 'walk_in_pantry', label: 'Walk-in Pantry', zone: 'culinary', category: 'kitchen_layout', aliases: ['large pantry', 'butler pantry', 'pantry closet', 'storage pantry'] },
    { id: 'outdoor_dining_access', label: 'Outdoor Dining Access', zone: 'culinary', category: 'kitchen_layout', aliases: ['opens to patio', 'access to outdoor dining', 'sliding doors to terrace', 'french doors to garden'] },

    { id: 'waterfall_island', label: 'Waterfall Island', zone: 'culinary', category: 'kitchen_surfaces', aliases: ['waterfall countertop', 'waterfall edge island', 'cascading island', 'kitchen island waterfall'] },
    { id: 'quartz_surfaces', label: 'Quartz Surfaces', zone: 'culinary', category: 'kitchen_surfaces', aliases: ['quartz countertops', 'engineered stone counters', 'Caesarstone', 'Silestone'] },
    { id: 'natural_stone_surfaces', label: 'Natural Stone Surfaces', zone: 'culinary', category: 'kitchen_surfaces', aliases: ['quartzite countertops', 'marble countertops', 'granite countertops', 'stone counters', 'slab stone'] },
    { id: 'white_cabinetry', label: 'White Cabinetry', zone: 'culinary', category: 'kitchen_surfaces', aliases: ['white cabinets', 'painted white cabinets', 'shaker white cabinets', 'bright kitchen cabinets'] },
    { id: 'kitchen_skylights', label: 'Skylights', zone: 'culinary', category: 'kitchen_surfaces', aliases: ['kitchen skylight', 'roof windows', 'clerestory windows'] },
    { id: 'premium_kitchen_fixtures', label: 'Premium Kitchen Fixtures', zone: 'culinary', category: 'kitchen_surfaces', aliases: ['pot filler', 'designer faucet', 'Waterstone faucet', 'Rohl faucet', 'Brizo faucet', 'premium fixtures', 'high-end fixtures', 'luxury fixtures', 'designer hardware', 'high end fixtures'] },

    { id: 'premium_appliances', label: 'Premium Appliance Brand', zone: 'culinary', category: 'kitchen_appliances', aliases: [
        // Brand names — major luxury/professional kitchen appliance brands
        'sub-zero', 'sub zero', 'subzero',
        'wolf', 'wolf range', 'wolf cooktop', 'wolf oven',
        'miele', 'miele dishwasher', 'miele oven', 'miele cooktop', 'miele range',
        'thermador',
        'viking',
        'gaggenau',
        'bosch benchmark', 'bosch professional',
        'dacor',
        'jenn-air', 'jennair', 'jennair rise',
        'monogram', 'ge monogram',
        'fisher & paykel', 'fisher paykel',
        'la cornue', 'lacornue',
        'lacanche',
        'ilve',
        'kitchenaid pro', 'kitchenaid professional',
        'smeg',
        'cove dishwasher',
        'asko',
        // Generic descriptors
        'premium appliances', 'luxury appliances',
        'professional grade appliances', 'professional grade',
        'professional-grade appliances',
        'high-end appliances', 'high end appliances',
        "chef's appliances", 'chefs appliances',
        'commercial grade appliances',
    ] },
    { id: 'induction_cooktop', label: 'Induction Cooktop', zone: 'culinary', category: 'kitchen_appliances', aliases: ['induction range', 'electric induction', 'induction stove'] },
    { id: 'steam_oven', label: 'Steam Oven', zone: 'culinary', category: 'kitchen_appliances', aliases: ['combi steam oven', 'steam convection oven', 'Wolf steam oven', 'Miele steam oven'] },
    { id: 'built_in_coffee', label: 'Built-in Coffee Machine', zone: 'culinary', category: 'kitchen_appliances', aliases: ['built-in espresso', 'integrated coffee maker', 'Miele coffee system', 'Wolf coffee station'] },
    { id: 'smart_appliances', label: 'Smart Appliances', zone: 'culinary', category: 'kitchen_appliances', aliases: ['WiFi appliances', 'connected appliances', 'smart kitchen appliances'] },
    { id: 'integrated_wine_fridge', label: 'Integrated Wine Fridge', zone: 'culinary', category: 'kitchen_appliances', aliases: ['built-in wine cooler', 'wine refrigerator', 'wine cellar refrigerator', 'dual-zone wine fridge'] },

    // ── Zone 3: Living & Entertainment
    { id: 'vaulted_ceilings', label: 'Vaulted / Cathedral Ceilings', zone: 'living_entertaining', category: 'living_features', aliases: ['cathedral ceilings', 'vaulted ceiling', 'high vaulted ceiling', 'arched ceiling', 'beamed vaulted ceiling'] },
    { id: 'statement_fireplace', label: 'Statement Fireplace', zone: 'living_entertaining', category: 'living_features', aliases: ['gas fireplace', 'wood-burning fireplace', 'double-sided fireplace', 'fireplace surround', 'floor-to-ceiling fireplace'] },
    { id: 'built_in_audio', label: 'Built-in Audio', zone: 'living_entertaining', category: 'living_features', aliases: ['surround sound', 'in-ceiling speakers', 'whole-home audio', 'Sonos', 'integrated speakers'] },
    { id: 'smart_home', label: 'Smart Home Integration', zone: 'living_entertaining', category: 'living_features', aliases: ['home automation', 'Control4', 'Crestron', 'Lutron', 'smart home system', 'integrated technology'] },
    { id: 'natural_light', label: 'Abundant Natural Light', zone: 'living_entertaining', category: 'living_features', aliases: ['natural light', 'sun-drenched', 'bright interior', 'south-facing exposure', 'all-day light', 'sunlit rooms', 'light-filled'] },
    { id: 'floor_to_ceiling_windows', label: 'Floor-to-Ceiling Windows', zone: 'living_entertaining', category: 'living_features', aliases: ['full height windows', 'wall of glass', 'floor to ceiling glass', 'expansive windows'] },

    { id: 'home_theater', label: 'Home Theater', zone: 'living_entertaining', category: 'bonus_rooms', aliases: ['media room', 'screening room', 'movie room', 'home cinema', 'theater room'] },
    { id: 'wine_cellar', label: 'Wine Cellar', zone: 'living_entertaining', category: 'bonus_rooms', aliases: ['wine room', 'wine storage', 'temperature-controlled wine room', 'wine cave', 'wine vault'] },
    { id: 'home_office', label: 'Home Office / Study', zone: 'living_entertaining', category: 'bonus_rooms', aliases: ['dedicated office', 'study room', 'private office', 'work from home room', 'library'] },
    { id: 'laundry_room', label: 'Laundry Room', zone: 'living_entertaining', category: 'bonus_rooms', aliases: ['dedicated laundry room', 'laundry suite', 'utility room', 'laundry area', 'washer dryer room'] },
    { id: 'mudroom', label: 'Mudroom', zone: 'living_entertaining', category: 'bonus_rooms', aliases: ['mud room', 'drop zone', 'entry storage room', 'boot room', 'back entry room'] },
    { id: 'residential_elevator', label: 'Residential Elevator', zone: 'living_entertaining', category: 'bonus_rooms', aliases: ['home elevator', 'in-home elevator', 'private elevator', 'elevator lift', 'dumbwaiter'] },

    { id: 'panoramic_views', label: 'Panoramic Views', zone: 'living_entertaining', category: 'indoor_views', aliases: ['sweeping views', '180-degree views', 'unobstructed views', 'stunning views'] },
    { id: 'city_skyline_views', label: 'City Skyline Views (Interior)', zone: 'living_entertaining', category: 'indoor_views', aliases: ['city views from living room', 'skyline views indoors', 'downtown views', 'urban views'] },
    { id: 'garden_views', label: 'Garden Views', zone: 'living_entertaining', category: 'indoor_views', aliases: ['views of garden', 'backyard views', 'pool views', 'courtyard views', 'landscape views', 'private garden views', 'bedroom views to garden', 'garden views private'] },

    // ── Zone 4: Primary Sanctuary
    { id: 'main_floor_suite', label: 'Main-Floor Suite', zone: 'primary_sanctuary', category: 'bedroom_layout', aliases: ['first floor primary', 'ground floor master', 'main level bedroom suite', 'single-story primary', 'master on main'] },
    { id: 'king_size_suite', label: 'King-Size Suite', zone: 'primary_sanctuary', category: 'bedroom_layout', aliases: ['spacious primary', 'oversized master', 'large primary bedroom', 'grand master suite'] },
    { id: 'seating_area', label: 'Seating Area', zone: 'primary_sanctuary', category: 'bedroom_layout', aliases: ['sitting area', 'bedroom sitting room', 'reading nook', 'lounge area in bedroom'] },
    { id: 'fireplace_bedroom', label: 'Fireplace in Bedroom', zone: 'primary_sanctuary', category: 'bedroom_layout', aliases: ['bedroom fireplace', 'gas fireplace in master', 'primary suite fireplace'] },
    { id: 'oversized_windows', label: 'Oversized Windows', zone: 'primary_sanctuary', category: 'bedroom_layout', aliases: ['large bedroom windows', 'floor-to-ceiling bedroom windows', 'picture windows', 'expansive bedroom views'] },

    { id: 'boutique_walk_in_closet', label: 'Boutique Walk-in Closet', zone: 'primary_sanctuary', category: 'closet_storage', aliases: ['walk-in closet', 'custom closet', 'dressing room', 'large walk-in', 'dream closet', 'his-and-hers closets'] },
    { id: 'shoe_wall', label: 'Shoe Wall', zone: 'primary_sanctuary', category: 'closet_storage', aliases: ['shoe display', 'shoe storage wall', 'shoe rack wall', 'shoe closet'] },
    { id: 'jewelry_storage', label: 'Jewelry Storage', zone: 'primary_sanctuary', category: 'closet_storage', aliases: ['jewelry cabinet', 'built-in jewelry drawers', 'jewelry organizer'] },
    { id: 'built_in_organizers', label: 'Built-in Organizers', zone: 'primary_sanctuary', category: 'closet_storage', aliases: ['custom shelving', 'built-in drawers', 'closet system', 'California Closets', 'elfa system'] },
    { id: 'smart_storage', label: 'Smart Storage', zone: 'primary_sanctuary', category: 'closet_storage', aliases: ['automated storage', 'motorized closet', 'smart shelving'] },

    { id: 'morning_bar', label: 'Morning Bar', zone: 'primary_sanctuary', category: 'bedroom_amenities', aliases: ['coffee station in bedroom', 'wet bar in bedroom', 'beverage station', 'morning kitchen'] },
    { id: 'climate_control', label: 'Climate Control', zone: 'primary_sanctuary', category: 'bedroom_amenities', aliases: ['smart thermostat', 'Nest', 'zoned HVAC', 'individual climate control', 'radiant heating'] },
    { id: 'private_balcony', label: 'Private Balcony', zone: 'primary_sanctuary', category: 'bedroom_amenities', aliases: ['master balcony', 'primary suite balcony', 'juliet balcony', 'bedroom balcony'] },
    { id: 'terrace_access', label: 'Terrace Access', zone: 'primary_sanctuary', category: 'bedroom_amenities', aliases: ['private terrace', 'bedroom terrace', 'outdoor terrace from bedroom', 'master suite terrace'] },

    // ── Zone 5: Shower & Wellness
    { id: 'rain_shower', label: 'Rain Shower', zone: 'shower_wellness', category: 'bathroom_fixtures', aliases: ['rainfall shower', 'rain head shower', 'overhead shower', 'large format rain shower'] },
    { id: 'steam_shower', label: 'Steam Shower', zone: 'shower_wellness', category: 'bathroom_fixtures', aliases: ['steam room shower', 'spa steam shower', 'steam bath'] },
    { id: 'soaking_tub', label: 'Soaking Tub', zone: 'shower_wellness', category: 'bathroom_fixtures', aliases: ['freestanding tub', 'soaker tub', 'Japanese soaking tub', 'deep soak tub', 'clawfoot tub'] },
    { id: 'heated_floors', label: 'Heated Floors', zone: 'shower_wellness', category: 'bathroom_fixtures', aliases: ['radiant floor heating', 'underfloor heating', 'warm floors', 'in-floor heat'] },
    { id: 'dual_vanities', label: 'Dual Vanities', zone: 'shower_wellness', category: 'bathroom_fixtures', aliases: ['double vanity', 'his-and-hers vanity', 'two sinks', 'dual sinks'] },
    { id: 'towel_warmers', label: 'Towel Warmers', zone: 'shower_wellness', category: 'bathroom_fixtures', aliases: ['heated towel rack', 'towel warmer bar', 'towel radiator'] },
    { id: 'premium_bath_fixtures', label: 'Premium Bath Fixtures', zone: 'shower_wellness', category: 'bathroom_fixtures', aliases: ['Kohler fixtures', 'Hansgrohe faucets', 'Grohe', 'premium fixtures', 'luxury faucets', 'high-end fixtures', 'designer fixtures', 'designer hardware', 'high end fixtures'] },

    { id: 'natural_stone_bath', label: 'Natural Stone Finishes', zone: 'shower_wellness', category: 'bathroom_finishes', aliases: ['marble bathroom', 'travertine', 'limestone bathroom', 'stone tile bathroom', 'natural stone bath'] },
    { id: 'designer_tile', label: 'Designer Tile', zone: 'shower_wellness', category: 'bathroom_finishes', aliases: ['custom tile', 'handmade tile', 'Moroccan tile', 'statement tile', 'mosaic tile', 'zellige tile'] },
    { id: 'wellness_focused', label: 'Wellness-Focused', zone: 'shower_wellness', category: 'bathroom_finishes', aliases: ['spa bathroom', 'spa-like bath', 'hotel-inspired bath', 'luxury spa', 'resort bathroom'] },
    { id: 'backlit_mirrors', label: 'Backlit Mirrors', zone: 'shower_wellness', category: 'bathroom_finishes', aliases: ['lighted mirror', 'LED mirror', 'illuminated mirror', 'smart mirror'] },
    { id: 'led_vanity_lighting', label: 'LED Vanity Lighting', zone: 'shower_wellness', category: 'bathroom_finishes', aliases: ['vanity lighting', 'lighted vanity', 'daylight vanity', 'Hollywood mirrors'] },
    { id: 'makeup_station', label: 'Makeup Station', zone: 'shower_wellness', category: 'bathroom_finishes', aliases: ['vanity makeup area', 'dressing table', 'makeup vanity', 'beauty station'] },

    { id: 'sauna_cold_plunge', label: 'Sauna / Cold Plunge', zone: 'shower_wellness', category: 'wellness_rooms', aliases: ['sauna', 'cold plunge pool', 'ice bath', 'infrared sauna', 'dry sauna', 'contrast therapy'] },
    { id: 'home_gym', label: 'Home Gym / Wellness Studio', zone: 'shower_wellness', category: 'wellness_rooms', aliases: ['gym room', 'exercise room', 'fitness room', 'workout room', 'yoga studio', 'wellness room'] },

    // ── Zone 6: Outdoor Oasis & Grounds
    { id: 'lush_landscaping', label: 'Lush Landscaping', zone: 'outdoor_grounds', category: 'lot_vibe', aliases: ['designer landscaping', 'landscape design', 'curated landscaping', 'lush landscaping', 'established landscaping', 'mature plants', 'lush backyard', 'resort landscaping', 'tropical landscaping', 'professionally landscaped', 'mature landscaping'] },
    { id: 'mature_trees', label: 'Mature Trees', zone: 'outdoor_grounds', category: 'lot_vibe', aliases: ['established trees', 'old-growth trees', 'large trees', 'canopy trees', 'shade trees'] },
    { id: 'stone_hardscaping', label: 'Stone Hardscaping', zone: 'outdoor_grounds', category: 'lot_vibe', aliases: ['flagstone path', 'stone walkway', 'paved path', 'hardscape path', 'cobblestone path', 'stone pathways', 'paver patio', 'flagstone patio', 'travertine pavers', 'concrete pavers', 'bluestone', 'stone pavers'] },
    { id: 'resort_style', label: 'Resort-Style', zone: 'outdoor_grounds', category: 'lot_vibe', aliases: ['resort-like backyard', 'five-star backyard', 'hotel grounds', 'resort feel'] },
    { id: 'fully_secluded', label: 'Fully Secluded', zone: 'outdoor_grounds', category: 'lot_vibe', aliases: ['totally private', 'no rear neighbors', 'fully enclosed', 'very private yard', 'walled backyard', 'boxwood hedges', 'privacy screening', 'tall hedges', 'hedge row', 'privacy hedges'] },
    { id: 'low_maintenance', label: 'Low Maintenance', zone: 'outdoor_grounds', category: 'lot_vibe', aliases: ['drought tolerant', 'low-water landscaping', 'xeriscape', 'easy care yard', 'artificial turf'] },
    { id: 'gated_entrance', label: 'Gated Entrance', zone: 'outdoor_grounds', category: 'lot_vibe', aliases: ['gated driveway', 'electric gate', 'security gate', 'gated property', 'automatic gate'] },
    { id: 'motor_court', label: 'Motor Court', zone: 'outdoor_grounds', category: 'lot_vibe', aliases: ['motorcourt', 'circular driveway', 'courtyard driveway', 'porte-cochere'] },
    { id: 'level_flat_lot', label: 'Level / Flat Lot', zone: 'outdoor_grounds', category: 'lot_vibe', aliases: ['flat backyard', 'flat lot', 'level yard', 'usable flat land', 'no slope', 'flat usable yard'] },

    { id: 'pool', label: 'Pool', zone: 'outdoor_grounds', category: 'water_fire', aliases: ['swimming pool', 'in-ground pool', 'backyard pool', 'private pool', 'gunite pool', 'saltwater pool'] },
    { id: 'infinity_pool', label: 'Infinity Pool', zone: 'outdoor_grounds', category: 'water_fire', aliases: ['vanishing edge pool', 'negative edge pool', 'infinity-edge pool'] },
    { id: 'spa_hot_tub', label: 'Spa / Hot Tub', zone: 'outdoor_grounds', category: 'water_fire', aliases: ['hot tub', 'spa', 'jacuzzi', 'outdoor spa', 'in-ground spa'] },
    { id: 'water_features', label: 'Water Features / Fountains', zone: 'outdoor_grounds', category: 'water_fire', aliases: ['fountain', 'water fountain', 'garden fountain', 'koi pond', 'decorative pond', 'water feature', 'pool waterfall', 'water wall', 'fountain waterfall', 'cascading water feature', 'waterfall feature'] },
    { id: 'fire_pit', label: 'Fire Pit', zone: 'outdoor_grounds', category: 'water_fire', aliases: ['outdoor fire pit', 'gas fire pit', 'wood-burning fire pit', 'fire bowl'] },
    { id: 'outdoor_fireplace', label: 'Outdoor Fireplace', zone: 'outdoor_grounds', category: 'water_fire', aliases: ['exterior fireplace', 'stone fireplace', 'backyard fireplace', 'alfresco fireplace'] },

    { id: 'outdoor_kitchen', label: 'Outdoor Kitchen', zone: 'outdoor_grounds', category: 'outdoor_entertaining', aliases: ['built-in outdoor kitchen', 'alfresco kitchen', 'outdoor grill station', 'exterior kitchen', 'built-in BBQ', 'outdoor grill', 'barbecue area', 'grilling station', 'built-in grill', 'bbq station'] },
    { id: 'covered_patio', label: 'Covered Patio', zone: 'outdoor_grounds', category: 'outdoor_entertaining', aliases: ['covered terrace', 'shaded patio', 'loggia', 'outdoor covered area', 'covered outdoor space'] },
    { id: 'pergola', label: 'Pergola', zone: 'outdoor_grounds', category: 'outdoor_entertaining', aliases: ['arbor', 'shade pergola', 'vine-covered pergola', 'wood pergola', 'aluminum pergola'] },
    { id: 'gazebo', label: 'Gazebo / Cabana', zone: 'outdoor_grounds', category: 'outdoor_entertaining', aliases: ['pool cabana', 'outdoor cabana', 'poolside cabana', 'shade structure', 'cabana', 'outdoor gazebo', 'garden gazebo', 'octagonal gazebo', 'gazebo'] },
    { id: 'rooftop_deck', label: 'Rooftop Deck', zone: 'outdoor_grounds', category: 'outdoor_entertaining', aliases: ['roof deck', 'rooftop terrace', 'rooftop patio', 'roof garden'] },
    { id: 'retractable_glass_walls', label: 'Retractable Glass Walls', zone: 'outdoor_grounds', category: 'outdoor_entertaining', aliases: ['sliding glass walls', 'folding glass doors', 'NanaWall', 'accordion glass walls', 'bifold glass walls', 'folding glass walls', 'sliding glass wall', 'retractable wall', 'glass wall system', 'indoor outdoor living', 'seamless indoor outdoor', 'opens to outside', 'bifold doors to yard', 'indoor outdoor flow'] },
    { id: 'string_lighting', label: 'String Lighting', zone: 'outdoor_grounds', category: 'outdoor_entertaining', aliases: ['bistro lights', 'café lights', 'outdoor string lights', 'Edison bulb lights', 'market lights'] },
    { id: 'outdoor_speakers', label: 'Built-in Outdoor Speakers', zone: 'outdoor_grounds', category: 'outdoor_entertaining', aliases: ['outdoor audio', 'exterior speakers', 'landscape speakers', 'Sonos outdoor', 'in-ground speakers'] },
    { id: 'outdoor_tv_av', label: 'Outdoor TV / AV', zone: 'outdoor_grounds', category: 'outdoor_entertaining', aliases: ['outdoor television', 'weatherproof TV', 'outdoor entertainment system', 'patio TV'] },
    { id: 'multi_zone_layout', label: 'Multi-Area Outdoor Zones', zone: 'outdoor_grounds', category: 'outdoor_entertaining', aliases: ['outdoor entertaining zones', 'multi-area backyard', 'dining and lounge zones', 'outdoor room layout', 'multi-zone layout'] },

    { id: 'sport_court', label: 'Sport Court', zone: 'outdoor_grounds', category: 'utility_play', aliases: ['basketball court', 'tennis court', 'pickleball court', 'sport court', 'half-court basketball'] },
    { id: 'putting_green', label: 'Putting Green', zone: 'outdoor_grounds', category: 'utility_play', aliases: ['golf putting green', 'artificial putting green', 'practice green', 'chipping area'] },
    { id: 'kid_friendly_lawn', label: 'Kid-Friendly Lawn', zone: 'outdoor_grounds', category: 'utility_play', aliases: ['play area', 'kids play space', 'flat lawn', 'grass lawn for kids', 'play yard', 'well-maintained lawn', 'manicured grounds', 'lush lawn', 'carpet lawn', 'manicured lawn'] },
    { id: 'dog_friendly_lawn', label: 'Dog-Friendly Lawn', zone: 'outdoor_grounds', category: 'utility_play', aliases: ['pet friendly yard', 'dog run', 'fenced dog area', 'lawn for pets'] },
    { id: 'fenced_yard', label: 'Fenced / Secure Yard', zone: 'outdoor_grounds', category: 'utility_play', aliases: ['fenced backyard', 'fully fenced', 'secure yard', 'perimeter fence', 'privacy fence'] },
    { id: 'adu_guest_house', label: 'ADU / Guest House', zone: 'outdoor_grounds', category: 'utility_play', aliases: ['accessory dwelling unit', 'guest suite', 'in-law unit', 'casita', 'detached studio', 'granny flat', 'second unit'] },
    { id: 'side_yard_storage', label: 'Side-Yard Storage', zone: 'outdoor_grounds', category: 'utility_play', aliases: ['side yard', 'storage shed', 'equipment storage', 'pool equipment area', 'trash concealment', 'side access'] },

    { id: 'waterfront_views', label: 'Waterfront / Bay Views', zone: 'outdoor_grounds', category: 'outdoor_views', aliases: ['lakefront', 'bayfront', 'oceanfront', 'creek-side', 'pond-side', 'waterfront', 'bay views', 'ocean views', 'lake views', 'water views', 'reservoir views', 'estuary views'] },
    { id: 'open_space_access', label: 'Backs to Open Space', zone: 'outdoor_grounds', category: 'outdoor_views', aliases: ['backs to open space', 'greenbelt access', 'nature reserve', 'wooded lot', 'backs to trail', 'nature-connected', 'greenbelt views', 'open preserve views', 'pastoral views', 'meadow views', 'no rear neighbors', 'open space views'] },
    { id: 'hill_valley_views', label: 'Hill / Valley Views', zone: 'outdoor_grounds', category: 'outdoor_views', aliases: ['hillside views', 'rolling hills views', 'valley views', 'mountain views', 'ridge views', 'views of hills'] },
    { id: 'vineyard_views', label: 'Vineyard Views', zone: 'outdoor_grounds', category: 'outdoor_views', aliases: ['wine country views', 'vineyard backdrop', 'winery views', 'rolling vineyard views'] },
    { id: 'golf_course_views', label: 'Golf Course Views', zone: 'outdoor_grounds', category: 'outdoor_views', aliases: ['backs to golf course', 'fairway views', 'golf views', 'on the golf course'] },
    { id: 'sunset_views', label: 'Sunset / West-Facing Views', zone: 'outdoor_grounds', category: 'outdoor_views', aliases: ['western exposure', 'west-facing backyard', 'sunset backyard', 'afternoon sun views', 'golden hour views'] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** All tags for a specific wizard zone, in category order. */
export const tagsByZone = (zone: TagZone): PropertyTag[] =>
    PROPERTY_TAXONOMY.filter(t => t.zone === zone);

/** All tags for a specific category. */
export const tagsByCategory = (category: TagCategory): PropertyTag[] =>
    PROPERTY_TAXONOMY.filter(t => t.category === category);

/** Look up a tag by its id. */
export const tagById = (id: string): PropertyTag | undefined =>
    PROPERTY_TAXONOMY.find(t => t.id === id);

/**
 * Given a string extracted from a property description or AI response,
 * find the matching canonical tag by checking label and all aliases
 * (case-insensitive).
 */
export const resolveTagFromText = (text: string): PropertyTag | undefined => {
    const normalized = text.toLowerCase().trim();
    return PROPERTY_TAXONOMY.find(tag =>
        tag.label.toLowerCase() === normalized ||
        tag.aliases?.some(a => a.toLowerCase() === normalized)
    );
};

/**
 * Chip labels for a zone — convenience shorthand for the wizard UI.
 * Returns labels in category order (matching PROPERTY_TAXONOMY definition order).
 */
export const chipLabelsForZone = (zone: TagZone): string[] =>
    tagsByZone(zone).map(t => t.label);

// ─── Taxonomy Signal Resolution ──────────────────────────────────────────────
// Bridges the Context Graph (free-form AI tags) with PROPERTY_TAXONOMY
// (canonical buyer-facing tags). Used at read time to populate taxonomy_signals
// without re-running AI extraction.

/** A detected canonical tag, with evidence and provenance. */
export interface TaxonomySignal {
    tagId: string;
    label: string;
    zone: TagZone;
    category: TagCategory;
    confidence: 'high' | 'medium';
    evidence: string[];           // the original free-form tag text(s) that matched
    sourceFactorIds: number[];    // which context graph factors contributed
}

/**
 * Find the best taxonomy tag match for a free-form text string.
 * Returns null if no match. Exact label/alias hit = high confidence;
 * substring containment = medium (longest match wins to avoid false positives).
 */
const matchTaxonomyTag = (text: string): { tag: PropertyTag; confidence: 'high' | 'medium' } | null => {
    const normalized = text.toLowerCase().trim();
    if (normalized.length < 3) return null;

    // Exact label or alias match → high confidence
    const exact = PROPERTY_TAXONOMY.find(tag =>
        tag.label.toLowerCase() === normalized ||
        tag.aliases?.some(a => a.toLowerCase() === normalized)
    );
    if (exact) return { tag: exact, confidence: 'high' };

    // Substring containment — prefer the longest matching label/alias.
    // Min match length of 5 chars to avoid trivial overlap like "in" or "and".
    let best: { tag: PropertyTag; matchLen: number } | null = null;
    for (const tag of PROPERTY_TAXONOMY) {
        const candidates = [tag.label, ...(tag.aliases || [])];
        for (const c of candidates) {
            const cLower = c.toLowerCase();
            if (cLower.length < 5) continue;
            if (normalized.includes(cLower)) {
                if (!best || cLower.length > best.matchLen) {
                    best = { tag, matchLen: cLower.length };
                }
            }
        }
    }
    if (best) return { tag: best.tag, confidence: 'medium' };

    return null;
};

/**
 * Walk every tag in every factor and resolve detected taxonomy signals.
 * Aggregates evidence and source factors when multiple tags map to the same canonical ID.
 */
export const resolveTaxonomySignalsFromFactors = (
    factors: Array<{ id: number; tags?: string[] }>
): Record<string, TaxonomySignal> => {
    const signals: Record<string, TaxonomySignal> = {};

    for (const factor of factors) {
        if (!Array.isArray(factor.tags)) continue;

        for (const rawTag of factor.tags) {
            if (typeof rawTag !== 'string') continue;
            const match = matchTaxonomyTag(rawTag);
            if (!match) continue;

            const existing = signals[match.tag.id];
            if (existing) {
                if (!existing.evidence.includes(rawTag)) existing.evidence.push(rawTag);
                if (!existing.sourceFactorIds.includes(factor.id)) existing.sourceFactorIds.push(factor.id);
                // Upgrade to high if any matching tag was exact
                if (match.confidence === 'high') existing.confidence = 'high';
            } else {
                signals[match.tag.id] = {
                    tagId: match.tag.id,
                    label: match.tag.label,
                    zone: match.tag.zone,
                    category: match.tag.category,
                    confidence: match.confidence,
                    evidence: [rawTag],
                    sourceFactorIds: [factor.id],
                };
            }
        }
    }

    return signals;
};
