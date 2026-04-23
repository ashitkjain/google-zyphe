import React from 'react';
import { computeVastu, azimuthToLabel, VastuZoneWithAngle, dirLabel } from '../../utils/vastuAnalysis';

// ── Vastu Remedies & Recommendations Data ────────────────────────────────────
// Sources: plusvalueindia.com, livspace.com, vastushastraguru.com, appliedvastu.com,
//          ultratechcement.com, neoastro.com, jkcement.com, outlookindia.com

type RemedyUrgency = 'critical' | 'moderate' | 'standard' | 'tip';

interface RemedyItem {
    icon: string;
    iconBg: string;   // Tailwind bg class for icon box
    title: string;
    text: string;
    urgency: RemedyUrgency;
}

interface VastuRemedyConfig {
    heading: string;
    statement: string;
    riskLabel: string;
    elementLabel: string;
    doorColors: Array<{ name: string; desc: string; twBg: string }>;
    avoidColors: string;
    remedies: RemedyItem[];
    dos: string[];
    donts: string[];
}

const VASTU_REMEDIES: Record<string, VastuRemedyConfig> = {
    SW: {
        heading: 'Nairutya Dosha — Structural Remediation Required',
        statement: 'The primary entrance opens to the Southwest (Nairutya), governed by Rahu and the earth element. Classical Vastu Shastra designates this the most challenging entrance direction — the Demon Corner — which creates downward energy pressure on household stability, finances, and the health of senior family members. Systematic structural remedies are essential to transform this dense earth energy into a stabilizing, grounding force for all occupants.',
        riskLabel: 'High / Caution',
        elementLabel: 'Earth · Grounding',
        doorColors: [
            { name: 'Deep Earth Brown', desc: 'Rooting Energy',    twBg: 'bg-amber-800' },
            { name: 'Mustard Gold',     desc: 'Prosperity Flow',   twBg: 'bg-yellow-600' },
            { name: 'Premium Beige',    desc: 'Neutral Stability', twBg: 'bg-amber-100 border border-amber-300' },
            { name: 'Warm Off-white',   desc: 'Clarity & Space',   twBg: 'bg-slate-100 border border-slate-300' },
        ],
        avoidColors: 'bright/light colors, black',
        remedies: [
            { icon: 'fa-triangle-exclamation', iconBg: 'bg-red-500',    title: 'Place Copper Vastu Pyramids',  text: 'On both sides and on top of the entrance door frame — triple placement is the primary remedy for Nairutya dosha.', urgency: 'critical' },
            { icon: 'fa-circle-dot',           iconBg: 'bg-purple-600', title: 'Install Siddha Rahu Yantra',   text: 'Above the entrance door facing outward — Rahu governs the southwest and this Yantra appeases its influence.', urgency: 'critical' },
            { icon: 'fa-om',                   iconBg: 'bg-indigo-500', title: 'Sacred Symbols on Door',       text: 'Paint Om (ॐ), Swastik, and Trishul using kumkum or paint on the door and above the frame.', urgency: 'moderate' },
            { icon: 'fa-person-praying',        iconBg: 'bg-orange-500', title: 'Hanuman Idol Near Entrance',   text: 'Place on the left side near entrance — Hanuman with gada provides powerful protective energy.', urgency: 'moderate' },
            { icon: 'fa-door-open',            iconBg: 'bg-amber-700',  title: 'Heavy Solid Wood Door',        text: 'The entrance door should be the heaviest door in the house to ground the southwest earth energy.', urgency: 'standard' },
            { icon: 'fa-minus',                iconBg: 'bg-stone-500',  title: 'Raised Threshold',             text: 'Add a marble or wood threshold (dhwaja) to block negative energy and prevent wealth loss.', urgency: 'standard' },
        ],
        dos: [
            'Keep the northeast corner fully open, bright, and clutter-free — the most important counterbalance to a southwest entrance',
            'Use warm yellow lighting; keep the entrance well-lit at all times',
            'Maintain immaculate cleanliness — remedies are significantly weakened in a dirty environment',
        ],
        donts: [
            'Never place a mirror opposite or facing the main entrance door',
            'Avoid hollow-core or lightweight doors',
            'Do not leave the northeast corner heavy, dark, or cluttered',
            'Avoid water features or fountains near the entrance',
        ],
    },
    S: {
        heading: "South Gate — Mars Energy Requires Management",
        statement: "The primary entrance opens to the South (Yama), governed by Mars and the fire element. Vastu Shastra considers south-facing homes energy-intensive environments — unmitigated Martian influence intensifies conflict potential, litigation exposure, and financial volatility within the household. When properly remedied with Panchmukhi Hanuman and fire-balancing elements, this orientation converts intense Mars energy into sustained professional ambition and physical vitality.",
        riskLabel: "High / Intense",
        elementLabel: "Fire · Mars",
        doorColors: [
            { name: 'Deep Brown',   desc: 'Grounding Mars Energy', twBg: 'bg-amber-800' },
            { name: 'Maroon',       desc: 'Fire Stability',        twBg: 'bg-rose-900' },
            { name: 'Earthy Red',   desc: 'Warmth & Protection',   twBg: 'bg-red-700' },
            { name: 'Warm Beige',   desc: 'Soft Balance',          twBg: 'bg-amber-100 border border-amber-300' },
        ],
        avoidColors: 'black, very dark colors',
        remedies: [
            { icon: 'fa-circle-dot',     iconBg: 'bg-orange-500', title: 'Panchmukhi Hanuman Yantra', text: 'Install above entrance facing outward — 5-faced Hanuman is the primary remedy for south-facing homes governed by Mars.', urgency: 'critical' },
            { icon: 'fa-om',             iconBg: 'bg-indigo-500', title: 'Sacred Door Symbols',       text: 'Display Om, Swastik, or "Shubh Labh" prominently on the entrance door.', urgency: 'moderate' },
            { icon: 'fa-person-praying', iconBg: 'bg-amber-500',  title: 'Ganesha at Entrance',       text: 'Place a Ganesha image near the entrance to remove obstacles and balance Mars energy.', urgency: 'moderate' },
            { icon: 'fa-seedling',       iconBg: 'bg-green-600',  title: 'Tulsi Plant',               text: 'Plant Tulsi (holy basil) near the entrance — sacred protection plant in Vastu Shastra.', urgency: 'standard' },
            { icon: 'fa-lightbulb',      iconBg: 'bg-red-500',    title: 'Warm Red Lighting',         text: 'Use warm red or reddish-yellow lighting near entrance to balance the Mars/fire element.', urgency: 'standard' },
        ],
        dos: [
            'Use a red doormat at the entrance threshold to absorb and balance fire energy',
            'Keep entrance well-lit with warm, earthy tones; maintain Yantra in a clean, visible condition',
            'A south entrance, when properly remedied, can bring energy, success, and stability',
        ],
        donts: [
            'Never place a mirror opposite or facing the main entrance',
            'Avoid black or very dark door colors which amplify the negative Mars energy',
            'Do not neglect the Hanuman Yantra placement — it is the primary neutralizer',
        ],
    },
    SE: {
        heading: "Agneya Entry — Fire Excess Correction Needed",
        statement: "The primary entrance opens to the Southeast (Agneya), the zone of Agni and Venus. While Venus's creative influence supports artistic prosperity, the dominant fire element at this entrance amplifies domestic tensions, impulsive financial decisions, and recurring relationship friction. Copper and metal-element structural corrections are the classical Vastu prescription to neutralize excess Agni and restore balanced, creative energy flow through the home.",
        riskLabel: "Moderate / Volatile",
        elementLabel: "Fire · Venus",
        doorColors: [
            { name: 'Deep Brown',   desc: 'Fire Absorption',   twBg: 'bg-amber-800' },
            { name: 'Burnt Orange', desc: 'Agni Balance',      twBg: 'bg-orange-500' },
            { name: 'Silver',       desc: 'Metal Neutralizer', twBg: 'bg-slate-300 border border-slate-400' },
            { name: 'Warm Beige',   desc: 'Soft Ground',       twBg: 'bg-amber-100 border border-amber-300' },
        ],
        avoidColors: 'black, dark blue',
        remedies: [
            { icon: 'fa-circle-dot',   iconBg: 'bg-amber-500',  title: 'Siddha Shukra Yantra',    text: 'Install energized Yantra near entrance — Venus governs SE and this balances the excess Agni/fire energy.', urgency: 'critical' },
            { icon: 'fa-layer-group',  iconBg: 'bg-orange-500', title: 'Copper Threshold Strip',  text: 'Insert copper pyramid strips or wire at the door threshold to ground the excess fire element.', urgency: 'moderate' },
            { icon: 'fa-droplet',      iconBg: 'bg-blue-500',   title: 'Sea Salt Bowl',           text: 'Place a bowl of sea salt near the entrance — absorbs negativity; replace the salt weekly.', urgency: 'standard' },
            { icon: 'fa-wind',         iconBg: 'bg-slate-500',  title: 'Camphor Crystals',        text: 'Keep camphor near the entrance; refresh every 2–3 weeks to purify air and energy.', urgency: 'standard' },
            { icon: 'fa-align-justify',iconBg: 'bg-amber-700',  title: 'Absorbing Curtains',      text: 'Hang dark red or brown curtains at entrance to absorb the excess Agni energy flowing in.', urgency: 'standard' },
        ],
        dos: [
            'Use brown, orange, or silver tones for the door and entrance surroundings',
            'Keep the entrance threshold clean and maintain the metal/copper strip remedy consistently',
            'Display Swastik or Om above the door to counteract the fire imbalance',
        ],
        donts: [
            'Avoid black or dark blue on the door or entrance area',
            'Do not skip the metal threshold remedy — structural corrective for southeast dosha',
            'Avoid heat elements (bright red lights, fire features) which amplify the Agni imbalance',
        ],
    },
    NW: {
        heading: "Vayavya Zone — Wind Element Stabilization",
        statement: "The primary entrance opens to the Northwest (Vayavya), governed by Vayu — the wind lord — and the moon. Northwest homes channel significant air-element energy, bringing social opportunity, travel, and business networking into occupants' lives. Without active stabilization, this directional energy generates frequent relocation, transient relationships, and household instability. White-toned doors and metal wind elements anchor the Vayu energy into productive, expansive outcomes.",
        riskLabel: "Moderate / Mobile",
        elementLabel: "Air · Moon",
        doorColors: [
            { name: 'Pure White',   desc: 'Clarity & Air',   twBg: 'bg-white border border-slate-300' },
            { name: 'Off-white',    desc: 'Soft Air Flow',   twBg: 'bg-slate-50 border border-slate-300' },
            { name: 'Cream',        desc: 'Warm Openness',   twBg: 'bg-amber-50 border border-amber-200' },
            { name: 'Light Grey',   desc: 'Air Balance',     twBg: 'bg-slate-200' },
        ],
        avoidColors: 'dark or heavy colors',
        remedies: [
            { icon: 'fa-om',      iconBg: 'bg-indigo-500', title: 'Auspicious Door Symbols', text: 'Display Swastik, Om, and Trishul near entrance to generate positive Vayu/air energy.', urgency: 'standard' },
            { icon: 'fa-lightbulb',iconBg: 'bg-yellow-500',title: 'Bright Soft Lighting',    text: 'Ensure warm, bright lighting at entrance — reflects light and balances the air element.', urgency: 'standard' },
            { icon: 'fa-leaf',    iconBg: 'bg-green-500',  title: 'Air-Element Plants',      text: 'Place hanging plants or flowing foliage near entrance to strengthen the Vayavya energy.', urgency: 'standard' },
            { icon: 'fa-bell',    iconBg: 'bg-slate-500',  title: 'Metal Wind Chimes',       text: 'Install metal wind chimes at entrance to harness and channel the Vayu air element flow.', urgency: 'standard' },
        ],
        dos: [
            'Keep entrance clean, bright, and clutter-free; ensure smooth, noise-free door operation',
            'Use white, cream, or light grey throughout the entrance area — aligns with air element',
        ],
        donts: [
            'Avoid dark or heavy colors that suppress the air element and block energy flow',
            'Do not block natural air circulation around the entrance',
            'Avoid placing heavy furniture or storage near the entrance',
        ],
    },
    W: {
        heading: "Varuna's Domain — Saturn-Aligned Stability",
        statement: "The primary entrance opens to the West (Paschim), governed by Varuna — lord of cosmic order — and Saturn. Western entrances are considered moderately favorable in Vastu Shastra, particularly for professionals in trade, commerce, and administration. Saturn's disciplined energy rewards consistent effort and patience, though it can introduce delays and obstacles when the entrance lacks proper metal-element alignment and threshold corrections.",
        riskLabel: "Moderate / Stable",
        elementLabel: "Metal · Saturn",
        doorColors: [
            { name: 'White',    desc: 'Metal Purity',    twBg: 'bg-white border border-slate-300' },
            { name: 'Grey',     desc: 'Balanced Air',    twBg: 'bg-slate-400' },
            { name: 'Cream',    desc: 'Soft Metal',      twBg: 'bg-amber-50 border border-amber-200' },
            { name: 'Silver',   desc: 'Western Element', twBg: 'bg-slate-300 border border-slate-400' },
        ],
        avoidColors: 'very dark or very bright colors',
        remedies: [
            { icon: 'fa-tag',   iconBg: 'bg-slate-600',  title: 'Metal Nameplate',            text: 'Install brass, copper, or silver nameplate to strengthen the western metal element.', urgency: 'standard' },
            { icon: 'fa-bell',  iconBg: 'bg-slate-500',  title: 'Metallic Doorbell or Chime', text: 'Add a metal doorbell or wind chime at entrance to enhance metal element energy.', urgency: 'standard' },
            { icon: 'fa-minus', iconBg: 'bg-stone-500',  title: 'Direction-Specific Metal Strip', text: 'Iron strip if entrance is in NW section; brass strip if SW section — corrects the dosha.', urgency: 'standard' },
            { icon: 'fa-om',    iconBg: 'bg-indigo-500', title: 'Auspicious Symbols',         text: 'Display Swastik, Om, and Trishul on or near the door.', urgency: 'standard' },
        ],
        dos: [
            'Keep entrance attractive, clean, and well-maintained; door should open smoothly and silently',
            'Use white, grey, or cream colors — align with the metal/air elements of the west',
        ],
        donts: [
            'Avoid placing the entrance in the southwest corner of the west wall',
            'Do not neglect the threshold metal strip — specific corrective for west-facing homes',
            'Avoid clutter or obstruction directly in front of the door',
        ],
    },
    N: {
        heading: "Kubera's Gateway — Premier Prosperity Orientation",
        statement: "The primary entrance opens to the North (Soma), the zone of Kubera — the lord of wealth — making this the most financially favorable entrance direction in Vastu Shastra. Northern orientation channels positive magnetic energy and Kubera's abundance directly into the home, consistently supporting career advancement, business prosperity, and stable family relationships. Keeping this entrance clean, bright, and completely unobstructed amplifies its full material and spiritual benefit.",
        riskLabel: "Low / Clear",
        elementLabel: "Water · Kubera",
        doorColors: [
            { name: 'White',       desc: "Kuber's Clarity",  twBg: 'bg-white border border-slate-300' },
            { name: 'Light Blue',  desc: 'Wealth Flow',      twBg: 'bg-blue-100' },
            { name: 'Silver',      desc: 'Metal Prosperity', twBg: 'bg-slate-300 border border-slate-400' },
            { name: 'Soft Green',  desc: 'Growth Energy',    twBg: 'bg-green-100' },
            { name: 'Cream',       desc: 'Warm Abundance',   twBg: 'bg-amber-50 border border-amber-200' },
        ],
        avoidColors: 'dark colors, black',
        remedies: [
            { icon: 'fa-om',       iconBg: 'bg-indigo-500',  title: 'Auspicious Door Symbols', text: 'Display Swastik, Om, or Trishul above the door to amplify the favorable north energy.', urgency: 'tip' },
            { icon: 'fa-bell',     iconBg: 'bg-blue-500',    title: 'Metal Wind Chimes',       text: 'Hang metal chimes or bell at entrance to attract positive Kuber/wealth vibrations from the north.', urgency: 'tip' },
            { icon: 'fa-seedling', iconBg: 'bg-green-500',   title: 'Prosperity Plants',       text: "Place a money plant or jade plant near entrance — north is Kuber's direction for wealth.", urgency: 'tip' },
            { icon: 'fa-tag',      iconBg: 'bg-slate-600',   title: 'Clear Nameplate',         text: 'Install an attractive nameplate to strengthen identity and amplify the north prosperity energy.', urgency: 'tip' },
            { icon: 'fa-lightbulb',iconBg: 'bg-yellow-500',  title: 'Evening Entry Lighting',  text: 'Keep entrance well-lit at night; warm white or soft yellow prevents stagnant energy.', urgency: 'tip' },
        ],
        dos: [
            "Keep entrance clean, well-lit, and welcoming — north is Kuber's direction; cleanliness multiplies prosperity",
            'Maintain a free, unobstructed path to the door; remove any poles or trees in front',
        ],
        donts: [
            'Never place a mirror opposite or directly facing the main entrance',
            'Avoid dark colors, especially black — they suppress the beneficial north energy',
            'Do not place poles, large trees, or obstructions directly in front of the door',
        ],
    },
    NE: {
        heading: "Ishan Mukhi — The Sacred Divine Gateway",
        statement: "The primary entrance opens to the Northeast (Ishan), the most sacred and auspicious direction in Vastu Shastra — governed by Jupiter (Guru) and Shiva at the junction of northern prosperity and eastern solar energy. This entrance channels divine wisdom, material abundance, and spiritual growth simultaneously. Morning sunlight flows through this gateway each day, continuously activating the most powerful and complete positive energy available in classical Vastu science.",
        riskLabel: "Very Low / Ideal",
        elementLabel: "Space · Jupiter",
        doorColors: [
            { name: 'Cream',      desc: 'Ishan Light',    twBg: 'bg-amber-50 border border-amber-200' },
            { name: 'Yellow',     desc: 'Solar Prosperity', twBg: 'bg-yellow-200' },
            { name: 'Off-white',  desc: 'Pure Energy',    twBg: 'bg-slate-50 border border-slate-300' },
            { name: 'Pale Blue',  desc: 'Sacred Flow',    twBg: 'bg-sky-100' },
            { name: 'Soft Green', desc: 'Ishan Growth',   twBg: 'bg-green-100' },
        ],
        avoidColors: 'heavy or dark colors',
        remedies: [
            { icon: 'fa-circle-dot',    iconBg: 'bg-amber-500',  title: 'Vastu Dosh Nivaran Yantra', text: 'Place in northeast corner — morning sunlight activates it for maximum benefit.', urgency: 'tip' },
            { icon: 'fa-person-praying',iconBg: 'bg-orange-500', title: 'Ganesha in Ishan Corner',    text: 'Northeast is the ideal location for worship, obstacle removal, and spiritual protection.', urgency: 'tip' },
            { icon: 'fa-sun',           iconBg: 'bg-yellow-500', title: 'Maximize Morning Sunlight',  text: 'Allow maximum natural sunlight through the entrance — northeast solar energy is sacred in Vastu.', urgency: 'tip' },
            { icon: 'fa-om',            iconBg: 'bg-indigo-500', title: 'Sacred Symbols at Entry',    text: 'Keep Swastik and Om at entrance to further amplify the most auspicious of all directions.', urgency: 'tip' },
        ],
        dos: [
            'Keep the northeast area fully open, bright, and clutter-free — the Ishan corner is the most sacred in Vastu',
            'Allow maximum natural morning sunlight; this activates positive energy for the entire home',
        ],
        donts: [
            'Never place heavy furniture, storage, toilets, or equipment in the northeast zone',
            'Do not block natural light or air flow at this entrance',
            'Avoid clutter or dark corners anywhere in the northeast quadrant',
        ],
    },
    E: {
        heading: "Indra's Solar Gateway — Health & Growth Orientation",
        statement: "The primary entrance opens to the East (Purva), the zone of Indra — lord of prosperity and the rising sun. East-facing homes receive sacred morning solar energy that Vastu Shastra associates with health, vitality, and divine blessing. This orientation is particularly favorable for educators, healthcare practitioners, and families prioritizing children's wellbeing and development. Auspiciousness is highest when the door falls in the central or northern section (Pada 4–5) of the east wall.",
        riskLabel: "Low / Favorable",
        elementLabel: "Solar · Indra",
        doorColors: [
            { name: 'Soft Green',   desc: 'Solar Growth',     twBg: 'bg-green-100' },
            { name: 'Soft Yellow',  desc: 'Morning Energy',   twBg: 'bg-yellow-100' },
            { name: 'Cream',        desc: 'Warm Light',       twBg: 'bg-amber-50 border border-amber-200' },
            { name: 'Natural Wood', desc: 'Earth Connection', twBg: 'bg-amber-600' },
        ],
        avoidColors: 'dark or heavy colors',
        remedies: [
            { icon: 'fa-om',       iconBg: 'bg-indigo-500', title: 'Swastika Above Door',      text: "Channel the beneficial solar energy from Indra's direction, the home of the rising sun.", urgency: 'tip' },
            { icon: 'fa-triangle-exclamation', iconBg: 'bg-amber-500', title: 'Vastu Pyramid at Door', text: 'Place above the door frame to maintain and enhance the east-facing energy balance.', urgency: 'tip' },
            { icon: 'fa-bell',     iconBg: 'bg-green-500',  title: 'Metal Wind Chimes',        text: 'Hang at entrance to enhance positive vibrations and energy flow from the east.', urgency: 'tip' },
            { icon: 'fa-seedling', iconBg: 'bg-green-600',  title: 'Flowering Plants',         text: 'Add green foliage near entrance — symbolizes growth and vitality of the eastern solar energy.', urgency: 'tip' },
            { icon: 'fa-tag',      iconBg: 'bg-slate-600',  title: 'Clear Entry Path',         text: 'Keep a well-designed nameplate; remove any poles, trees, or obstructions from the direct path.', urgency: 'tip' },
        ],
        dos: [
            'Place entrance door in the center or northern half of the east wall (5th pada) for best results',
            'Keep entrance clean, unobstructed, and well-lit; maintain healthy green plants nearby',
        ],
        donts: [
            'Avoid placing the door in the southern half of the east wall (less favorable pada position)',
            'Do not place poles, large trees, or any obstructions directly in front of the door',
            "Avoid having the entrance face another home's main door directly across a narrow path",
        ],
    },
};

interface VastuCardProps {
    azimuth_degrees: number | null | undefined;
    final_orientation?: string | null;
    onRefresh?: () => void;
    refreshing?: boolean;
    /** compact=true → small inline badge (overview page). Default false → full card with compass dial + zone table. */
    compact?: boolean;
    open_sky_direction?: string | null;
    isGT?: boolean;
}

// ── Vastu Remedies Section ────────────────────────────────────────────────────
const URGENCY_CONFIG: Record<RemedyUrgency, { label: string; dot: string }> = {
    critical: { label: 'CRITICAL', dot: 'bg-red-400'    },
    moderate: { label: 'MODERATE', dot: 'bg-orange-400' },
    standard: { label: 'STANDARD', dot: 'bg-blue-400'   },
    tip:      { label: 'TIP',      dot: 'bg-emerald-400' },
};

const VastuRemediesSection: React.FC<{
    dir: string;
    auspiciousness: string;
    vastu: NonNullable<ReturnType<typeof computeVastu>>;
    isGT?: boolean;
}> = ({ dir, auspiciousness, vastu, isGT }) => {
    const config = VASTU_REMEDIES[dir];
    if (!config) return null;

    const isInaus = auspiciousness === 'Inauspicious';
    const isAus   = auspiciousness === 'Auspicious';

    const accentBg      = isInaus ? 'bg-red-500'   : isAus ? 'bg-emerald-500' : 'bg-amber-500';
    const accentBadgeBg = isInaus ? 'bg-red-50 border-red-100 text-red-600'
                        : isAus   ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                  : 'bg-amber-50 border-amber-100 text-amber-600';
    const riskTextCls = isInaus ? 'text-red-600' : isAus ? 'text-emerald-600' : 'text-amber-600';
    const remediesLabel = isInaus ? 'PRIORITY REMEDIES' : isAus ? 'ENHANCEMENT TIPS' : 'RECOMMENDATIONS';

    return (
        <div className="px-3 pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-[5fr_4fr] gap-3 items-start">

                {/* ── LEFT COLUMN: two stacked boxes ── */}
                <div className="flex flex-col gap-3">

                    {/* Box 1: Vastu Overview */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                        {/* Direction badge */}
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest mb-3 ${accentBadgeBg}`}>
                            <i className="fa-solid fa-triangle-exclamation text-[8px]" />
                            {dirLabel(dir)} Facing Front
                            {isGT && <i className="fa-solid fa-circle-check text-[8px]" title="Verified orientation" />}
                        </div>

                        {/* Professional heading */}
                        <h3 className="text-[17px] font-black text-slate-900 leading-tight tracking-tight mb-2">
                            {config.heading}
                        </h3>

                        {/* Statement */}
                        <p className="text-[12px] text-slate-500 leading-relaxed font-medium mb-4">
                            {config.statement}
                        </p>

                        {/* Compass + Metric boxes */}
                        <div className="flex items-center gap-3">
                            <div className="shrink-0 bg-slate-50 rounded-full p-1 border border-slate-100">
                                <VastuCompass vastu={vastu} size={88} />
                            </div>
                            <div className="flex flex-col gap-2 flex-1">
                                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Risk Score</div>
                                    <div className={`text-[14px] font-black leading-tight ${riskTextCls}`}>{config.riskLabel}</div>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Energy Flow</div>
                                    <div className="text-[14px] font-black text-slate-700 leading-tight">{config.elementLabel}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Box 2: Door Colors */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                            Recommended Door Tones
                        </div>
                        <div className="space-y-2.5">
                            {config.doorColors.map(c => (
                                <div key={c.name} className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl shrink-0 shadow-sm ${c.twBg}`} />
                                    <div>
                                        <div className="text-[13px] font-bold text-slate-800 leading-tight">{c.name}</div>
                                        <div className="text-[11px] text-slate-400 font-medium mt-0.5">{c.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 flex items-center gap-2 px-2.5 py-2 rounded-lg bg-red-50 border border-red-100">
                            <i className="fa-solid fa-ban text-red-400 text-[10px] shrink-0" />
                            <span className="text-[11px] font-medium text-red-600">Avoid: {config.avoidColors}</span>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT COLUMN: dark structural audit box ── */}
                <div className="bg-[#1a1f35] rounded-2xl p-4 flex flex-col gap-4">
                    {/* Remedies */}
                    <div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3">
                            {remediesLabel}
                        </div>
                        <div className="space-y-3">
                            {config.remedies.map((r, i) => {
                                const u = URGENCY_CONFIG[r.urgency];
                                return (
                                    <div key={i} className="flex items-start gap-2.5">
                                        <div className={`w-7 h-7 rounded-lg ${r.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                                            <i className={`fa-solid ${r.icon} text-white text-[10px]`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                                <span className="text-[12px] font-bold text-white leading-tight">{r.title}</span>
                                                <div className="flex items-center gap-1">
                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${u.dot}`} />
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{u.label}</span>
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-slate-400 leading-relaxed">{r.text}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-slate-700/60" />

                    {/* Strategic Positive */}
                    <div>
                        <div className="flex items-center gap-1.5 mb-2.5">
                            <span className={`w-2 h-2 rounded-full ${accentBg}`} />
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Strategic Positive</span>
                        </div>
                        <ul className="space-y-2">
                            {config.dos.map((d, i) => (
                                <li key={i} className="flex items-start gap-2">
                                    <span className="text-emerald-400 text-[11px] mt-0.5 shrink-0">•</span>
                                    <span className="text-[11px] text-slate-300 leading-relaxed">{d}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* High Avoidance */}
                    <div>
                        <div className="flex items-center gap-1.5 mb-2.5">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-red-400">High Avoidance</span>
                        </div>
                        <ul className="space-y-2">
                            {config.donts.map((d, i) => (
                                <li key={i} className="flex items-start gap-2">
                                    <span className="text-red-400 text-[11px] mt-0.5 shrink-0">•</span>
                                    <span className="text-[11px] text-slate-300 leading-relaxed">{d}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── SVG Compass Dial ─────────────────────────────────────────────────────────
const VastuCompass: React.FC<{ vastu: NonNullable<ReturnType<typeof computeVastu>>; size?: number }> = ({ vastu, size = 160 }) => {
    const SIZE = size;
    const CX = SIZE / 2;
    const CY = SIZE / 2;
    const R_OUTER = (SIZE / 160) * 72;
    const R_INNER = (SIZE / 160) * 38;
    const R_LABEL = (SIZE / 160) * 58;

    const sectors = vastu.allZones.map((zone) => {
        const startRad = ((zone.start - 90) * Math.PI) / 180;
        const endAngle = zone.start > zone.end ? zone.end + 360 : zone.end;
        const endRad = ((endAngle - 90) * Math.PI) / 180;

        const x1 = CX + R_OUTER * Math.cos(startRad);
        const y1 = CY + R_OUTER * Math.sin(startRad);
        const x2 = CX + R_OUTER * Math.cos(endRad);
        const y2 = CY + R_OUTER * Math.sin(endRad);
        const xi1 = CX + R_INNER * Math.cos(startRad);
        const yi1 = CY + R_INNER * Math.sin(startRad);
        const xi2 = CX + R_INNER * Math.cos(endRad);
        const yi2 = CY + R_INNER * Math.sin(endRad);

        const fill = zone.isEntrance
            ? (vastu.auspiciousness === 'Auspicious' ? '#d1fae5' : vastu.auspiciousness === 'Inauspicious' ? '#fee2e2' : '#fef3c7')
            : '#f8fafc';
        const stroke = zone.isEntrance
            ? (vastu.auspiciousness === 'Auspicious' ? '#10b981' : vastu.auspiciousness === 'Inauspicious' ? '#ef4444' : '#f59e0b')
            : '#e2e8f0';
        const strokeW = zone.isEntrance ? (SIZE / 160) * 2 : (SIZE / 160) * 0.8;

        const midRad = ((zone.midAngle - 90) * Math.PI) / 180;
        const lx = CX + R_LABEL * Math.cos(midRad);
        const ly = CY + R_LABEL * Math.sin(midRad);

        return (
            <g key={zone.dir}>
                <path
                    d={`M ${xi1} ${yi1} L ${x1} ${y1} A ${R_OUTER} ${R_OUTER} 0 0 1 ${x2} ${y2} L ${xi2} ${yi2} A ${R_INNER} ${R_INNER} 0 0 0 ${xi1} ${yi1} Z`}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeW}
                />
                <text
                    x={lx} y={ly}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={(SIZE / 160) * (zone.isEntrance ? 9 : 7.5)}
                    fontWeight={zone.isEntrance ? '900' : '600'}
                    fill={zone.isEntrance
                        ? (vastu.auspiciousness === 'Auspicious' ? '#065f46' : vastu.auspiciousness === 'Inauspicious' ? '#991b1b' : '#92400e')
                        : '#94a3b8'
                    }
                >
                    {zone.dir}
                </text>
            </g>
        );
    });

    const needleRad = ((vastu.azimuth - 90) * Math.PI) / 180;
    const needleTipX = CX + (R_INNER - 4) * Math.cos(needleRad);
    const needleTipY = CY + (R_INNER - 4) * Math.sin(needleRad);

    return (
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <circle cx={CX} cy={CY} r={R_OUTER} fill="none" stroke="#e2e8f0" strokeWidth={1} />
            <circle cx={CX} cy={CY} r={R_INNER} fill="#f8fafc" stroke="#e2e8f0" strokeWidth={1} />
            {sectors}
            <line
                x1={CX} y1={CY}
                x2={needleTipX} y2={needleTipY}
                stroke={vastu.auspiciousness === 'Auspicious' ? '#10b981' : vastu.auspiciousness === 'Inauspicious' ? '#ef4444' : '#f59e0b'}
                strokeWidth={(SIZE / 160) * 2.5}
                strokeLinecap="round"
            />
            <circle cx={CX} cy={CY} r={(SIZE / 160) * 3} fill="#475569" />
            <text x={CX} y={(SIZE / 160) * 8} textAnchor="middle" fontSize={(SIZE / 160) * 8} fontWeight="900" fill="#64748b">N</text>
        </svg>
    );
};

// ── Zone table row ────────────────────────────────────────────────────────────
const ZoneRow: React.FC<{ zone: VastuZoneWithAngle; isEntrance: boolean; auspiciousness: string }> = ({ zone, isEntrance, auspiciousness }) => {
    const highlight = isEntrance
        ? (auspiciousness === 'Auspicious' ? 'bg-emerald-50/70 border-emerald-200' : auspiciousness === 'Inauspicious' ? 'bg-red-50/70 border-red-200' : 'bg-amber-50/70 border-amber-200')
        : 'bg-white border-slate-100';

    return (
        <tr className={`border ${highlight} text-[11px]`}>
            <td className={`px-2 py-1.5 font-black ${isEntrance ? 'text-slate-800' : 'text-slate-500'} w-10`}>
                {zone.dir}
                {isEntrance && <span className="ml-1 text-[9px] font-bold text-indigo-500">← door</span>}
            </td>
            <td className="px-2 py-1.5 text-slate-500 font-medium">{zone.name}</td>
            <td className="px-2 py-1.5 text-slate-400 hidden sm:table-cell">{zone.ideal_rooms}</td>
            <td className="px-2 py-1.5 text-right">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${zone.relativePosition === 'Front' ? 'bg-indigo-100 text-indigo-700' :
                        zone.relativePosition === 'Back' ? 'bg-slate-100 text-slate-500' :
                            'bg-slate-50 text-slate-400'
                    }`}>{zone.relativePosition}</span>
            </td>
        </tr>
    );
};

// ── Shared: Tier 2 site features rows ────────────────────────────────────────
const SiteFeatureRows: React.FC<{
    open_sky_direction?: string | null;
    compact?: boolean;
}> = ({ open_sky_direction, compact }) => {
    if (!open_sky_direction) return null;

    // Same text in both modes — only size/padding differs
    const rowCls = compact ? 'flex items-start gap-2 px-2.5 py-2.5' : 'flex items-start gap-3 px-3 py-3';
    const iconCls = compact ? 'fa-solid text-[10px] w-3 mt-1' : 'fa-solid text-[13px] w-4 mt-1';
    const textCls = compact ? 'text-[12px] text-slate-600 flex-1 leading-relaxed font-medium' : 'text-[13px] text-slate-600 flex-1 leading-relaxed font-medium';
    const badgeCls = compact ? 'text-[14px] shrink-0' : 'text-[16px] shrink-0';

    return (
        <div className={compact
            ? 'rounded-lg border border-slate-100 divide-y divide-slate-50 mb-2 overflow-hidden'
            : 'rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-50'
        }>
            {open_sky_direction && (() => {
                const aus = ['N', 'NE', 'E'].includes(open_sky_direction);
                const inaus = ['SW', 'S'].includes(open_sky_direction);
                const label = aus ? `Main outdoor space opens to the ${dirLabel(open_sky_direction)} — good for light and ventilation`
                    : inaus ? `Main outdoor space opens to the ${dirLabel(open_sky_direction)} — gets more afternoon heat`
                        : `Main outdoor space opens to the ${dirLabel(open_sky_direction)}`;
                return (
                    <div className={rowCls}>
                        <i className={`fa-sun text-amber-300 ${iconCls}`} />
                        <span className={textCls}>{label}</span>
                        <span className={badgeCls}>{aus ? '✅' : inaus ? '⚠️' : '◎'}</span>
                    </div>
                );
            })()}
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────────
export const VastuCard: React.FC<VastuCardProps> = ({
    azimuth_degrees, final_orientation, onRefresh, refreshing, compact = false,
    open_sky_direction, isGT
}) => {
    const vastu = computeVastu(azimuth_degrees);
    if (!vastu) return null;

    // ── Compact (overview page) ───────────────────────────────────────────────
    if (compact) {
        return (
            <div className="flex flex-col gap-2">
                <SiteFeatureRows compact open_sky_direction={open_sky_direction} />
                <VastuRemediesSection dir={vastu.entranceZone.dir} auspiciousness={vastu.auspiciousness} vastu={vastu} isGT={isGT} />
                {!isGT && (
                    <div className="flex items-start gap-1.5 px-1 pb-1">
                        <i className="fa-solid fa-circle-info text-[10px] text-slate-300 mt-0.5" />
                        <p className="text-[10px] font-medium text-slate-400 leading-normal italic">
                            Orientation and Vastu patterns are AI-inferred from aerial imagery and parcel data. Please verify on-site for absolute accuracy.
                        </p>
                    </div>
                )}
            </div>
        );
    }

    // ── Full card (Exterior tab) ──────────────────────────────────────────────
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 ${vastu.auspiciousness === 'Auspicious' ? 'bg-emerald-50 border-emerald-100' :
                    vastu.auspiciousness === 'Inauspicious' ? 'bg-red-50 border-red-100' :
                        'bg-amber-50 border-amber-100'
                }`}>
                <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Vastu Shastra</div>
                    <div className="text-base font-black text-slate-800 flex items-center gap-2">
                        {(final_orientation ?? dirLabel(vastu.entranceZone.dir)).replace(/\s*\(~?\d+°\)/g, '').trim()} Facing
                        {isGT && (
                            <i className="fa-solid fa-circle-check text-emerald-500 text-[14px]" title="Verified Orientation" />
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            disabled={refreshing}
                            title="Re-analyze orientation"
                            className="p-1.5 rounded-lg hover:bg-white/60 transition-colors disabled:opacity-50"
                        >
                            <i className={`fa-solid fa-rotate-right text-slate-400 text-xs ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                    )}
                    <span className={`text-[11px] font-black px-2.5 py-1 rounded-xl border ${vastu.scoreBg} ${vastu.scoreColor}`}>
                        {vastu.scoreLabel}
                    </span>
                </div>
            </div>

            {/* Body: compass + verdict */}
            <div className="flex items-start gap-3 px-3 pt-3 pb-2">
                <div className="shrink-0">
                    <VastuCompass vastu={vastu} />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-[13px] leading-relaxed text-slate-600 font-medium">{vastu.verdict}</p>
                    {/* Zone + Azimuth inline */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
                        <div>
                            <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] mr-1">Zone</span>
                            <span className="font-black text-slate-700">{vastu.entranceZone.name}</span>
                            <span className="text-slate-400 ml-1">{vastu.entranceZone.deity}</span>
                        </div>
                    </div>
                    {/* Back / sides compact row */}
                    <div className="flex gap-4 pt-1 border-t border-slate-100 text-[10px]">
                        {[
                            { label: 'Back', az: vastu.backAzimuth },
                            { label: 'Right', az: vastu.rightAzimuth },
                            { label: 'Left', az: vastu.leftAzimuth },
                        ].map(({ label, az }) => (
                            <div key={label}>
                                <span className="text-slate-400 mr-1">{label}</span>
                                <span className="font-black text-slate-600">{azimuthToLabel(az).split(' ')[0]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tier 2: Site Features (open sky only) */}
            {open_sky_direction && (
                <div className="px-3 pb-2">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Site Features (Aerial)</div>
                    <SiteFeatureRows
                        open_sky_direction={open_sky_direction}
                    />
                    <div className="text-[9px] text-slate-400 mt-1">Detected from aerial satellite · directions are compass absolute</div>
                </div>
            )}

            {/* Remedies & Recommendations */}
            <VastuRemediesSection dir={vastu.entranceZone.dir} auspiciousness={vastu.auspiciousness} vastu={vastu} />

            {/* Zone table */}
            <div className="px-3 pb-3">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">All 8 Vastu Zones</div>
                <div className="rounded-lg border border-slate-100 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <th className="px-2 py-1 text-left">Dir</th>
                                <th className="px-2 py-1 text-left">Zone</th>
                                <th className="px-2 py-1 text-left hidden sm:table-cell">Best For</th>
                                <th className="px-2 py-1 text-right">Position</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {vastu.allZones.map(zone => (
                                <ZoneRow
                                    key={zone.dir}
                                    zone={zone}
                                    isEntrance={zone.isEntrance}
                                    auspiciousness={vastu.auspiciousness}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {!isGT && (
                <div className="flex items-start gap-1.5 px-4 pb-4">
                    <i className="fa-solid fa-circle-info text-[10px] text-slate-300 mt-0.5" />
                    <p className="text-[10px] font-medium text-slate-400 leading-normal italic">
                        Orientation and Vastu patterns are AI-inferred from aerial imagery and parcel data. Please verify on-site for absolute accuracy.
                    </p>
                </div>
            )}
        </div>
    );
};

export default VastuCard;

// ── Standalone zone table (used in lifestyle-vastu section) ──────────────────
export const VastuZonesTable: React.FC<{ azimuth_degrees: number | null | undefined }> = ({ azimuth_degrees }) => {
    const vastu = computeVastu(azimuth_degrees ?? null);
    if (!vastu) return null;

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">All 8 Vastu Zones</div>
            <div className="rounded-lg border border-slate-100 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="px-2 py-1 text-left">Dir</th>
                            <th className="px-2 py-1 text-left">Zone</th>
                            <th className="px-2 py-1 text-left hidden sm:table-cell">Best For</th>
                            <th className="px-2 py-1 text-right">Position</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {vastu.allZones.map(zone => (
                            <ZoneRow
                                key={zone.dir}
                                zone={zone}
                                isEntrance={zone.isEntrance}
                                auspiciousness={vastu.auspiciousness}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-[9px] text-slate-400 italic mt-2 leading-normal">
                Vastu zones are computed from the primary entrance azimuth. Entrance row highlighted based on Vastu auspiciousness rating.
            </p>
        </div>
    );
};
