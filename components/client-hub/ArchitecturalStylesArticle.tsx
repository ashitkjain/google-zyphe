import React from 'react';

// ─── Slug sentinel ────────────────────────────────────────────────────────────
export const ARCH_STYLES_SLUG = 'residential-architectural-styles';
export const ARCH_STYLES_SENTINEL = '__ARCH_STYLES_STATIC__';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ArchStyle {
    name: string;
    image: string;
    material: string;
    roof: string;
    mainFeature: string;
    identifiers: string[];
    description: string;
}

interface ArchStyleGroup {
    id: string;
    label: string;
    color: string;
    icon: string;
    tagline: string;
    styles: ArchStyle[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const ARCH_STYLE_GROUPS: ArchStyleGroup[] = [
    {
        id: 'classical',
        label: 'Classical & Colonial',
        color: 'indigo',
        icon: 'fa-landmark',
        tagline: 'Symmetry, formal proportions, and European tradition',
        styles: [
            {
                name: 'Colonial',
                image: '/arch-styles/colonial.png',
                material: 'Wood or Brick',
                roof: 'Gabled (Side)',
                mainFeature: 'Perfect Symmetry',
                identifiers: [
                    'Centered front door with equal windows on each side',
                    'Typically two stories with steep gabled roof',
                    'Rectangular shape, formal proportion',
                    'Shutters and a classic entryway pediment',
                ],
                description:
                    'Colonial homes are the quintessential American style, defined by their perfect bilateral symmetry. A centered front door is flanked by an equal number of windows on either side. Most are two stories with a steep gabled roof.',
            },
            {
                name: 'Victorian',
                image: '/arch-styles/victorian.png',
                material: 'Painted Wood',
                roof: 'Steep / Complex',
                mainFeature: 'Ornate Trim & Turrets',
                identifiers: [
                    '"Gingerbread" decorative trim along gables and porches',
                    'Wraparound porch, steep multi-faceted roofline',
                    'A cylindrical tower or turret on one corner',
                    'Bold multi-color paint schemes ("Painted Ladies")',
                ],
                description:
                    "Victorian homes are known for being ornate and whimsical. You'll see 'gingerbread' trim, wraparound porches, steep roof pitches, and often a cylindrical tower or turret. They embrace asymmetry and decorative excess.",
            },
            {
                name: 'Greek Revival',
                image: '/arch-styles/greek-revival.png',
                material: 'White-painted Wood',
                roof: 'Low-pitched Gable',
                mainFeature: 'Temple-like Columns',
                identifiers: [
                    'Large white columns (pillars) across the full façade',
                    'Triangular pediment above the front porch',
                    'Low-pitched roof, wide frieze board',
                    'Symmetrical plan mimicking a Greek temple',
                ],
                description:
                    'Greek Revival homes mimic an ancient Greek temple. They are identifiable by their large white columns and a triangular pediment above the front porch entrance. Popular in the antebellum South.',
            },
        ],
    },
    {
        id: 'craftsman',
        label: 'Arts & Crafts / Human-Scale',
        color: 'amber',
        icon: 'fa-hammer',
        tagline: 'Hand-crafted details, natural materials, and cozy proportions',
        styles: [
            {
                name: 'Craftsman (Bungalow)',
                image: '/arch-styles/craftsman.png',
                material: 'Wood & Stone',
                roof: 'Low-slung Gable',
                mainFeature: 'Exposed Rafters & Eaves',
                identifiers: [
                    'Wide overhanging eaves with exposed wooden rafter tails (brackets)',
                    'Heavy tapered porch columns resting on stone or brick piers',
                    'Low-pitched gabled roof, often with dormers',
                    'Built-in cabinetry and natural wood interior detailing',
                ],
                description:
                    'Craftsman homes celebrate hand-crafted quality and natural materials. They feature low-slung gabled roofs with wide overhanging eaves, exposed wooden rafters (brackets), and heavy tapered porch columns.',
            },
            {
                name: 'Tudor',
                image: '/arch-styles/tudor.png',
                material: 'Brick & Stucco',
                roof: 'Steep Gable',
                mainFeature: 'Half-Timbering',
                identifiers: [
                    'Exposed dark wood beams set against light-colored stucco — "half-timbering"',
                    'Steeply pitched gable roofline, sometimes with multiple cross-gables',
                    'Tall, narrow windows, often with diamond-paned glass',
                    'Arched doorways with decorative stonework',
                ],
                description:
                    'Tudor homes are inspired by late medieval English architecture. They are easily recognized by half-timbering — exposed dark wood beams against light-colored stucco or brick. Steeply pitched rooflines and tall narrow windows complete the look.',
            },
            {
                name: 'Cape Cod',
                image: '/arch-styles/cape-cod.png',
                material: 'Wood Shingle / Clapboard',
                roof: 'Steep Symmetrical Gable',
                mainFeature: 'Dormer Windows',
                identifiers: [
                    '1.5 stories with "dormer" windows poking out of the roofline',
                    'Simple symmetrical façade, centered front door',
                    'Steep gabled roof, often with wood shingles',
                    'Minimal ornamentation, practical and compact design',
                ],
                description:
                    'Cape Cod is a quintessential American style — simple, symmetrical, and usually 1.5 stories. Dormer windows pop out of the steeply pitched roof to add light and usable headroom to the upper half-story.',
            },
        ],
    },
    {
        id: 'mediterranean',
        label: 'Mediterranean & Regional',
        color: 'orange',
        icon: 'fa-sun',
        tagline: 'Warm climates, indoor-outdoor living, and rich regional character',
        styles: [
            {
                name: 'Spanish Colonial / Mission',
                image: '/arch-styles/spanish-mission.png',
                material: 'Stucco',
                roof: 'Red Clay Tile',
                mainFeature: 'Arched Openings',
                identifiers: [
                    'Red barrel clay tile roof — the single most distinctive identifier',
                    'White or cream stucco exterior walls',
                    'Arched doorways and windows with wrought-iron accents',
                    'Heavy carved-wood doors, inner courtyard or fountain',
                ],
                description:
                    'Spanish Colonial homes are distinguishable by their red clay tile roofs, white stucco walls, and arched doorways. They often feature heavy carved-wood doors, wrought-iron accents, and interior courtyards that invite outdoor living.',
            },
            {
                name: 'French Provincial',
                image: '/arch-styles/french-provincial.png',
                material: 'Stone or Stucco with Stone Trim',
                roof: 'High Hipped Roof',
                mainFeature: 'Tall Arched Windows',
                identifiers: [
                    'High, steeply pitched "hipped" roof — sloping on all four sides',
                    'Tall, narrow arched windows that break through the roofline',
                    'Formal, symmetrical façade with refined detailing',
                    'Mansard-style upper story windows',
                ],
                description:
                    'French Provincial homes are characterized by high, steeply pitched hipped roofs and tall, arched windows that often break through the roofline itself. The overall effect is formal, refined, and château-inspired.',
            },
            {
                name: 'Pueblo Revival',
                image: '/arch-styles/pueblo-revival.png',
                material: 'Adobe / Earth-toned Stucco',
                roof: 'Flat Roof',
                mainFeature: 'Vigas & Rounded Walls',
                identifiers: [
                    'Rounded earth-colored walls with an organic, hand-sculpted look',
                    'Flat or slightly sloped roof with "vigas" — wooden beams poking through the exterior',
                    'Stepped rooflines, portal (covered porch), and kiva fireplaces',
                    'Indigenous Southwest palette: terracotta, sand, and adobe brown',
                ],
                description:
                    'Common in the Southwest, Pueblo Revival homes use rounded earth-colored walls, flat roofs, and vigas — wooden beams that stick through the exterior walls. The style celebrates indigenous Southwestern building traditions.',
            },
        ],
    },
    {
        id: 'modern',
        label: 'Modern & Mid-Century',
        color: 'slate',
        icon: 'fa-cube',
        tagline: 'Function-first, geometric forms, and new building materials',
        styles: [
            {
                name: 'Mid-Century Modern',
                image: '/arch-styles/midcentury-modern.png',
                material: 'Glass, Steel & Wood',
                roof: 'Flat or Butterfly',
                mainFeature: 'Floor-to-Ceiling Glass',
                identifiers: [
                    'Flat or "butterfly" roofline (sloping inward to center)',
                    'Floor-to-ceiling glass windows and walls — bringing the outside in',
                    'Open floor plans, post-and-beam construction',
                    'Integration with landscape; often uses natural wood and stone accents',
                ],
                description:
                    'Popularized from 1945–1965, Mid-Century Modern homes focus on connecting indoors to outdoors. They feature flat or butterfly roofs, walls of glass, open floor plans, and a strong horizontal emphasis.',
            },
            {
                name: 'Contemporary',
                image: '/arch-styles/contemporary.png',
                material: 'Steel, Concrete & Glass',
                roof: 'Asymmetrical / Flat',
                mainFeature: 'Industrial Materials',
                identifiers: [
                    'Asymmetrical shapes and bold geometric forms',
                    'Industrial elements: exposed steel, concrete, and large-format materials',
                    'Large, often irregularly placed windows',
                    'Sustainable features: solar panels, green roofs, passive design',
                ],
                description:
                    'Contemporary is a broad term for homes built today that use sustainable materials, asymmetrical shapes, and industrial elements like steel and concrete. Unlike "Modern," it is not a fixed period — it evolves continuously.',
            },
            {
                name: 'Modern Farmhouse',
                image: '/arch-styles/modern-farmhouse.png',
                material: 'Wood (Board & Batten)',
                roof: 'Gabled with Metal Accents',
                mainFeature: 'Board & Batten Siding',
                identifiers: [
                    'White vertical "board and batten" siding — the defining exterior cladding',
                    'Black window frames and black hardware accents',
                    'A large metal-roofed front porch with exposed beams',
                    'Clean gabled roofline blending rustic and contemporary details',
                ],
                description:
                    'Modern Farmhouse blends the traditional rural gable-roofed barn aesthetic with contemporary updates. Key indicators are white board-and-batten siding, black window frames, and a large covered porch — all with a clean, uncluttered feel.',
            },
        ],
    },
];

const COMPARISON_TABLE = [
    { style: 'Colonial', material: 'Wood or Brick', roof: 'Gabled (Side)', feature: 'Perfect Symmetry', color: 'indigo' },
    { style: 'Craftsman', material: 'Wood & Stone', roof: 'Low-slung Gable', feature: 'Exposed Rafters / Eaves', color: 'amber' },
    { style: 'Victorian', material: 'Painted Wood', roof: 'Steep / Complex', feature: 'Ornate Trim & Turrets', color: 'purple' },
    { style: 'Spanish', material: 'Stucco', roof: 'Red Clay Tile', feature: 'Arched Openings', color: 'orange' },
    { style: 'Tudor', material: 'Brick & Stucco', roof: 'Steep Gable', feature: 'Half-Timbering', color: 'green' },
    { style: 'Mid-Century', material: 'Glass, Steel & Wood', roof: 'Flat / Butterfly', feature: 'Floor-to-Ceiling Glass', color: 'slate' },
];

// ─── Color palette helper ─────────────────────────────────────────────────────
const COLOR_MAP: Record<string, { bg: string; badge: string; border: string; icon: string; text: string }> = {
    indigo: { bg: 'bg-indigo-50', badge: 'bg-indigo-600 text-white', border: 'border-indigo-100', icon: 'text-indigo-500', text: 'text-indigo-900' },
    amber: { bg: 'bg-amber-50', badge: 'bg-amber-500 text-white', border: 'border-amber-100', icon: 'text-amber-500', text: 'text-amber-900' },
    orange: { bg: 'bg-orange-50', badge: 'bg-orange-500 text-white', border: 'border-orange-100', icon: 'text-orange-500', text: 'text-orange-900' },
    slate: { bg: 'bg-slate-100', badge: 'bg-slate-700 text-white', border: 'border-slate-200', icon: 'text-slate-500', text: 'text-slate-900' },
};

const DOT_COLORS: Record<string, string> = {
    indigo: 'bg-indigo-500',
    amber: 'bg-amber-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    green: 'bg-emerald-500',
    slate: 'bg-slate-500',
};

// ─── Component ────────────────────────────────────────────────────────────────
const ArchitecturalStylesArticle: React.FC = () => (
    <div className="space-y-16">

        {/* Hero */}
        <div className="relative rounded-[2rem] overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 p-10 md:p-14 text-white">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500 via-transparent to-transparent pointer-events-none" />
            <div className="relative z-10 max-w-2xl">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white/70 mb-6">
                    <i className="fa-solid fa-building-columns text-indigo-400" />
                    Architecture Reference
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-white leading-tight tracking-tight mb-4">
                    Residential Architectural Styles
                </h1>
                <p className="text-slate-300 text-lg leading-relaxed font-medium">
                    Residential architecture is a visual language that tells the story of a region's history, climate,
                    and culture. While many modern homes are "eclectic," most fall into several distinct categories —
                    each with signature identifiers.
                </p>
            </div>
        </div>

        {/* Style Groups */}
        {ARCH_STYLE_GROUPS.map(group => {
            const c = COLOR_MAP[group.color] || COLOR_MAP.slate;
            return (
                <section key={group.id}>
                    {/* Group Header */}
                    <div className={`${c.bg} ${c.border} border rounded-[1.5rem] px-8 py-6 mb-8 flex items-center gap-4`}>
                        <div className={`w-12 h-12 rounded-2xl ${c.badge} flex items-center justify-center shadow-md`}>
                            <i className={`fa-solid ${group.icon} text-lg`} />
                        </div>
                        <div>
                            <h2 className={`text-xl font-black ${c.text} leading-tight`}>{group.label}</h2>
                            <p className="text-slate-500 text-sm font-medium mt-0.5">{group.tagline}</p>
                        </div>
                    </div>

                    {/* Style Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {group.styles.map(style => (
                            <div
                                key={style.name}
                                className="bg-white border border-slate-100 rounded-[1.75rem] overflow-hidden shadow-sm hover:shadow-lg hover:border-slate-200 transition-all duration-300 group"
                            >
                                {/* Illustration */}
                                <div className="bg-slate-50 border-b border-slate-100 flex items-center justify-center overflow-hidden h-52">
                                    <img
                                        src={style.image}
                                        alt={`${style.name} architectural style illustration`}
                                        className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105"
                                        loading="lazy"
                                    />
                                </div>

                                {/* Card Header */}
                                <div className="px-6 pt-4 pb-2">
                                    <div className={`text-[9px] font-black uppercase tracking-widest ${c.icon} mb-1`}>
                                        {group.label}
                                    </div>
                                    <h3 className="text-lg font-black text-slate-900 leading-tight group-hover:text-indigo-700 transition-colors">
                                        {style.name}
                                    </h3>
                                </div>

                                {/* Description */}
                                <div className="px-6 pb-4">
                                    <p className="text-slate-600 text-sm font-medium leading-relaxed">{style.description}</p>
                                </div>

                                {/* Stats */}
                                <div className="px-6 pb-4 grid grid-cols-1 gap-2">
                                    {[
                                        { icon: 'fa-bricks', label: 'Material', value: style.material },
                                        { icon: 'fa-house', label: 'Roof Type', value: style.roof },
                                        { icon: 'fa-star', label: 'Main Feature', value: style.mainFeature },
                                    ].map(stat => (
                                        <div key={stat.label} className="flex items-start gap-2 bg-slate-50 rounded-xl p-3">
                                            <i className={`fa-solid ${stat.icon} text-slate-400 text-xs mt-0.5`} />
                                            <div>
                                                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                    {stat.label}
                                                </div>
                                                <div className="text-xs font-bold text-slate-700">{stat.value}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Identifiers checklist */}
                                <div className="border-t border-slate-100 px-6 py-4">
                                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">
                                        How to Identify
                                    </div>
                                    <ul className="space-y-2">
                                        {style.identifiers.map((id, i) => (
                                            <li key={i} className="flex items-start gap-2.5">
                                                <div className={`w-4 h-4 rounded-full ${c.badge} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                                    <i className="fa-solid fa-check text-[7px]" />
                                                </div>
                                                <span className="text-slate-600 text-xs font-medium leading-relaxed">{id}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            );
        })}

        {/* Comparison Table */}
        <section>
            <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
                <div className="w-2.5 h-8 bg-indigo-500 rounded-full" />
                Quick Comparison: Key Identifiers
            </h2>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-900 text-white">
                            <th className="text-left px-6 py-4 font-black text-[11px] uppercase tracking-widest rounded-tl-2xl">Style</th>
                            <th className="text-left px-6 py-4 font-black text-[11px] uppercase tracking-widest">Primary Material</th>
                            <th className="text-left px-6 py-4 font-black text-[11px] uppercase tracking-widest">Roof Type</th>
                            <th className="text-left px-6 py-4 font-black text-[11px] uppercase tracking-widest rounded-tr-2xl">Signature Feature</th>
                        </tr>
                    </thead>
                    <tbody>
                        {COMPARISON_TABLE.map((row, i) => (
                            <tr
                                key={row.style}
                                className={`border-b border-slate-100 hover:bg-indigo-50/50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_COLORS[row.color]}`} />
                                        <span className="font-black text-slate-900">{row.style}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-600 font-medium">{row.material}</td>
                                <td className="px-6 py-4 text-slate-600 font-medium">{row.roof}</td>
                                <td className="px-6 py-4 font-bold text-slate-800">{row.feature}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>

        {/* Footer note */}
        <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800 mb-2">
                A Note on Eclectic Homes
            </h4>
            <p className="text-sm font-medium text-slate-500 leading-relaxed">
                Most homes built today — and many built in the past — are{' '}
                <strong className="text-slate-700">eclectic</strong>, meaning they borrow elements from multiple
                styles. A home may have a Colonial roofline with Craftsman porch columns and farmhouse siding. These
                hybrid homes don't fit neatly into one category, but you can still identify the{' '}
                <em>dominant influence</em> using the key identifiers above.
            </p>
        </div>
    </div>
);

export default ArchitecturalStylesArticle;
