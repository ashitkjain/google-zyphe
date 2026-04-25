/**
 * LocationOverviewSectionPage
 * Editorial redesign of the Location Overview section.
 * Accent: indigo (#4f46e5) + mint (#10b981)
 */
import React, { useState } from 'react';
import { PropertyData } from '../../../types';
import { CensusDemographics } from '../../../services/api/environmental';
import { NeighborhoodAnalysis } from '../../../types/ai';
import { AffordabilityCard } from '../../analysis/custom-ai/components/AffordabilityCard';

interface Props {
    data: PropertyData;
    neighborhoodOverview: string | null;
    census: CensusDemographics | null;
    lifestyleInsights?: any;
    visualPoi?: NeighborhoodAnalysis['visual_poi'];
    mapLabels?: string[];
    cityNhEntryOverview?: any;
}

const serif = "'Instrument Serif', Georgia, serif";
const mono  = "'JetBrains Mono', ui-monospace, monospace";
const ACCENT = '#4f46e5';
const MINT   = '#10b981';

function SectionTitleBar({ num, kicker, title, italicWord, accent = ACCENT }: {
    num: string; kicker: string; title: string; italicWord?: string; accent?: string;
}) {
    const parts = italicWord && title.includes(italicWord) ? title.split(italicWord) : null;
    return (
        <div style={{ marginBottom: 22, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontFamily: mono, fontSize: 11, color: accent, padding: '2px 7px', borderRadius: 4, background: `${accent}1a`, fontWeight: 700 }}>{num}</span>
                <span style={{ width: 24, height: 1, background: accent, display: 'inline-block' }} />
                <span style={{ fontSize: 10, letterSpacing: '0.18em', fontWeight: 700, color: accent, textTransform: 'uppercase' as const }}>{kicker}</span>
            </div>
            <h2 style={{ fontFamily: serif, fontSize: 30, lineHeight: 1.05, margin: 0, fontWeight: 400, letterSpacing: '-0.02em', color: '#0f172a' }}>
                {parts ? <>{parts[0]}<em style={{ color: accent, fontStyle: 'italic' }}>{italicWord}</em>{parts[1]}</> : title}
            </h2>
        </div>
    );
}

function StatCard({ label, value, color = '#0f172a' }: { label: string; value: string; color?: string }) {
    return (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '12px 14px' }}>
            <div style={{ fontSize: 9.5, letterSpacing: '0.14em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: serif, fontSize: 22, color, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</div>
        </div>
    );
}

function Chip({ children, color = ACCENT }: { children: React.ReactNode; color?: string }) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', background: `${color}18`, color, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
            {children}
        </span>
    );
}

function Pill({ children }: { children: React.ReactNode }) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', background: '#f8fafc', color: '#64748b', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: '1px solid #e2e8f0' }}>
            {children}
        </span>
    );
}

const INTEREST_ITEMS = [
    {
        t: 'Outdoor & Recreation', i: '🏞', c: MINT,
        key: 'outdoor' as const,
        fallback: 'Pleasanton offers excellent outdoor access — Shadow Cliffs Regional Recreation Area, Iron Horse Regional Trail, and Pleasanton Ridge Regional Park are all nearby for hiking, biking, and picnicking.',
    },
    {
        t: 'Pet Friendly', i: '🐾', c: '#f59e0b',
        key: 'pets' as const,
        fallback: 'Multiple dog parks, pet-friendly trails in Pleasanton Ridge, and nearby veterinary services make this an excellent area for pet owners.',
    },
    {
        t: 'Food & Entertainment', i: '🍽', c: '#e11d48',
        key: 'food' as const,
        fallback: 'Downtown Pleasanton offers a vibrant dining scene with diverse restaurants and cafes. The weekly Farmers Market (Saturdays) and Firehouse Arts Center add to the community flavor.',
    },
];

const CATEGORIES = [
    { key: 'dining', label: 'Dining', icon: '⚑' },
    { key: 'shopping', label: 'Shopping', icon: '◯' },
    { key: 'parks', label: 'Parks', icon: '✿' },
    { key: 'medical', label: 'Medical', icon: '⚕' },
    { key: 'fitness', label: 'Fitness', icon: '⛷' },
];

const MAPS_API_KEY = (window as any).MAPS_API_KEY || ''; // Usually provided by the parent or env

export const LocationOverviewSectionPage: React.FC<Props> = ({
    data, neighborhoodOverview, census, lifestyleInsights, visualPoi, mapLabels, cityNhEntryOverview
}) => {
    const [activeCategory, setActiveCategory] = useState<string>('dining');
    const [viewMode, setViewMode] = useState<'places' | 'visual'>('places');
    
    const nid = data.neighborhood_identity;
    const gem = cityNhEntryOverview || nid?.gemini;
    const neighborhood = nid?.resolved_name || data.subdivision || data.city || 'the neighborhood';
    const city = data.city || 'Pleasanton';

    // Build nearby places from google_places or visualPoi
    const places = (data as any).google_places;
    const categoryPlaces: Array<{ name: string; rating?: number; reviews?: number; distance?: string; isAi?: boolean }> = [];
    
    if (viewMode === 'places') {
        const list = places?.[activeCategory] || [];
        categoryPlaces.push(...list.slice(0, 8).map((p: any) => ({
            name: p.name,
            rating: p.rating,
            reviews: p.userRatingCount,
            distance: p.distanceMeters ? (p.distanceMeters * 0.000621371).toFixed(1) + ' mi' : undefined
        })));
    } else {
        const aiList = visualPoi?.[activeCategory as keyof typeof visualPoi] as any[];
        if (aiList && Array.isArray(aiList)) {
            categoryPlaces.push(...aiList.slice(0, 8).map((name: string) => ({ 
                name,
                isAi: true 
            })));
        }
    }

    const hasPlaces = categoryPlaces.length > 0;
    const coordinates = data.coordinates;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Section 01 — Neighborhood + Affordability */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
                {/* Neighborhood card */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 22 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 10, background: ACCENT, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 16 }}>
                                <i className="fa-solid fa-house" />
                            </div>
                            <h3 style={{ fontFamily: serif, fontSize: 28, color: '#0f172a', margin: 0, fontWeight: 700 }}>{neighborhood}</h3>
                        </div>
                        {gem?.price_context?.tier && (
                            <Chip color={ACCENT}>{gem.price_context.tier}</Chip>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                        {gem?.price_context?.typical_range && (
                            <Pill><i className="fa-solid fa-dollar-sign" style={{ marginRight: 4, opacity: 0.6 }} />{gem.price_context.typical_range}</Pill>
                        )}
                        {gem?.character?.community_type && (
                            <Pill><i className="fa-solid fa-shield-halved" style={{ marginRight: 4, opacity: 0.6 }} />{gem.character.community_type}</Pill>
                        )}
                    </div>

                    {neighborhoodOverview ? (
                        <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: '0 0 20px', fontWeight: 400 }}>{neighborhoodOverview}</p>
                    ) : (
                        <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', margin: '0 0 20px' }}>
                            Neighborhood overview not yet available.
                        </p>
                    )}

                    {/* Metadata Row */}
                    <div style={{ display: 'flex', gap: 16, padding: '12px 0', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', marginBottom: 20 }}>
                        {gem?.character?.architectural_style && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <i className="fa-solid fa-building-columns" style={{ fontSize: 11, color: '#94a3b8' }} />
                                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{gem.character.architectural_style}</span>
                            </div>
                        )}
                        {gem?.character?.era_built && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <i className="fa-solid fa-calendar" style={{ fontSize: 11, color: '#94a3b8' }} />
                                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{gem.character.era_built}</span>
                            </div>
                        )}
                        {gem?.character?.typical_home_size && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <i className="fa-solid fa-ruler-combined" style={{ fontSize: 11, color: '#94a3b8' }} />
                                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{gem.character.typical_home_size}</span>
                            </div>
                        )}
                    </div>

                    {/* Detailed Fields */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {gem?.alternative_names?.length > 0 && (
                            <div>
                                <div style={{ fontSize: 10, fontBlack: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Also Known As</div>
                                <div style={{ fontSize: 14, color: '#334155', fontWeight: 500 }}>{gem.alternative_names.join(', ')}</div>
                            </div>
                        )}
                        {gem?.character?.typical_lot_size && (
                            <div>
                                <div style={{ fontSize: 10, fontBlack: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Typical Lot Size</div>
                                <div style={{ fontSize: 14, color: '#334155', fontWeight: 500 }}>{gem.character.typical_lot_size}</div>
                            </div>
                        )}
                        {gem?.price_context?.context && (
                            <div>
                                <div style={{ fontSize: 10, fontBlack: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Market Position</div>
                                <div style={{ fontSize: 14, color: '#334155', fontWeight: 500 }}>{gem.price_context.context}</div>
                            </div>
                        )}
                        {gem?.infrastructure_quality && (
                            <div>
                                <div style={{ fontSize: 10, fontBlack: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Infrastructure</div>
                                <div style={{ fontSize: 14, color: '#334155', fontWeight: 500 }}>{gem.infrastructure_quality}</div>
                            </div>
                        )}

                        {gem?.unique_features && gem.unique_features.length > 0 && (
                            <div>
                                <div style={{ fontSize: 10, fontBlack: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Stand-out Features</div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {gem.unique_features.map((feat: string, i: number) => (
                                        <div key={i} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #e2e8f0', color: ACCENT, fontSize: 12, fontWeight: 600 }}>{feat}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Social Sources */}
                    <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: 9, fontBlack: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Source: Real Estate / Google Maps</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, border: '1px solid #e2e8f0', fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                                <i className="fa-solid fa-user" /> Nextdoor
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, border: '1px solid #e2e8f0', fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                                <i className="fa-brands fa-reddit" style={{ color: '#ff4500' }} /> Reddit
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, border: '1px solid #e2e8f0', fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                                <i className="fa-brands fa-facebook" style={{ color: '#1877f2' }} /> Facebook
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right column — Affordability + Census */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {census && (
                        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 18 }}>
                            <div style={{ fontSize: 9.5, letterSpacing: '0.14em', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, marginBottom: 10 }}>Neighborhood Profile</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                                {census.medianHouseholdIncome && <StatCard label="Median Income" value={`$${(census.medianHouseholdIncome / 1000).toFixed(0)}K`} color={MINT} />}
                                {census.medianHomeValue && <StatCard label="Home Value" value={`$${(census.medianHomeValue / 1000).toFixed(0)}K`} color={ACCENT} />}
                                {census.totalPopulation && <StatCard label="Population" value={census.totalPopulation.toLocaleString()} />}
                                {census.ownerOccupiedPct != null && <StatCard label="Owner-Occ." value={`${census.ownerOccupiedPct}%`} />}
                            </div>
                            {census.ownerOccupiedPct != null && (
                                <>
                                    <div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 6 }}>
                                        Owner {census.ownerOccupiedPct}%
                                    </div>
                                    <div style={{ display: 'flex', gap: 2, height: 10, borderRadius: 999, overflow: 'hidden' }}>
                                        <div style={{ flex: census.ownerOccupiedPct, background: ACCENT }} />
                                        <div style={{ flex: 100 - census.ownerOccupiedPct, background: MINT }} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                                        <span>Owner {census.ownerOccupiedPct}%</span>
                                        <span>Renter {100 - census.ownerOccupiedPct}%</span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    {data.price && (
                        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 18 }}>
                            <div style={{ fontSize: 9.5, letterSpacing: '0.14em', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, marginBottom: 10 }}>At This Price</div>
                            <div style={{ fontFamily: serif, fontSize: 28, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 6 }}>
                                ${data.price ? (data.price / 1_000_000).toFixed(2) : '--'}M
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                                {data.pricePerSqFt ? `$${data.pricePerSqFt} / sqft · ` : ''}
                                {data.bedrooms}bd / {data.bathrooms}ba · {data.livingAreaValue?.toLocaleString()} sqft
                            </div>
                        </div>
                    )}

                    {/* MIT Affordability Card */}
                    <div className="w-full">
                        <AffordabilityCard
                            state={data.state}
                            city={data.city}
                            county={data.county}
                            countyFips={data.countyFIPS}
                            compact
                        />
                    </div>
                </div>
            </div>

            {/* Section 02 — Interests */}
            <div>
                <SectionTitleBar num="02" kicker="Interests" title="What is here for you" italicWord="you" accent={MINT} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                    {INTEREST_ITEMS.map(item => {
                        const text = lifestyleInsights?.[item.key] || item.fallback;
                        return (
                            <div key={item.t} style={{ background: `linear-gradient(180deg, ${item.c}08 0%, #fff 120px)`, borderRadius: 12, border: '1px solid #e2e8f0', padding: 18 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                    <div style={{ width: 34, height: 34, borderRadius: 8, background: `${item.c}18`, color: item.c, display: 'grid', placeItems: 'center', fontSize: 17 }}>{item.i}</div>
                                    <div style={{ fontFamily: serif, fontSize: 20, color: '#0f172a', letterSpacing: '-0.01em' }}>{item.t}</div>
                                </div>
                                <p style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.6, margin: 0, textWrap: 'pretty' as any }}>{text}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Section 03 — What's Nearby */}
            <div>
                <SectionTitleBar num="03" kicker="What's Nearby" title="Pick a category, find a spot" italicWord="spot" />
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                                {CATEGORIES.map(cat => {
                                    const isActive = activeCategory === cat.key;
                                    return (
                                        <button 
                                            key={cat.key}
                                            onClick={() => setActiveCategory(cat.key)}
                                            style={{ 
                                                background: isActive ? ACCENT : '#f8fafc', 
                                                color: isActive ? '#fff' : '#64748b', 
                                                padding: '4px 12px', 
                                                borderRadius: 999, 
                                                fontSize: 11, 
                                                fontWeight: 700,
                                                border: isActive ? `1px solid ${ACCENT}` : '1px solid #e2e8f0',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {cat.icon} {cat.label}
                                        </button>
                                    );
                                })}
                            </div>

                            <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 10 }}>
                                <button 
                                    onClick={() => setViewMode('places')}
                                    style={{ 
                                        padding: '4px 8px', 
                                        borderRadius: 7, 
                                        fontSize: 9, 
                                        fontWeight: 800, 
                                        border: 'none',
                                        background: viewMode === 'places' ? '#fff' : 'transparent',
                                        color: viewMode === 'places' ? ACCENT : '#94a3b8',
                                        cursor: 'pointer',
                                        boxShadow: viewMode === 'places' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                    }}
                                >GOOGLE</button>
                                <button 
                                    onClick={() => setViewMode('visual')}
                                    style={{ 
                                        padding: '4px 8px', 
                                        borderRadius: 7, 
                                        fontSize: 9, 
                                        fontWeight: 800, 
                                        border: 'none',
                                        background: viewMode === 'visual' ? '#fff' : 'transparent',
                                        color: viewMode === 'visual' ? ACCENT : '#94a3b8',
                                        cursor: 'pointer',
                                        boxShadow: viewMode === 'visual' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                    }}
                                >VISUAL</button>
                            </div>
                        </div>
                        {hasPlaces ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {categoryPlaces.map((p, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingBottom: 8, borderBottom: '1px dashed #e2e8f0' }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{p.name}</div>
                                            {p.rating && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <div style={{ fontSize: 10.5, color: '#94a3b8', letterSpacing: '0.06em' }}>★ {p.rating}{p.reviews ? ` · ${p.reviews} reviews` : ''}</div>
                                                </div>
                                            )}
                                            {p.isAi && (
                                                <div style={{ fontSize: 9, fontWeight: 800, color: MINT, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
                                                    ✨ AI Visual Discovery
                                                </div>
                                            )}
                                        </div>
                                        {p.distance && <span style={{ fontFamily: mono, fontSize: 11, color: ACCENT, fontWeight: 700 }}>{p.distance}</span>}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {activeCategory === 'dining' ? (
                                    [
                                        ['Downtown Pleasanton dining', '4.5 avg · Main St', '~1.2 mi'],
                                        ['Pleasanton Farmers Market', 'Sat 9a–1p · Angela St', '~0.5 mi'],
                                        ['Firehouse Arts Center', 'Live performances', '~1.0 mi'],
                                        ['Starbucks / Peet\'s Coffee', 'Multiple locations', '~0.3 mi'],
                                    ].map(([name, sub, dist], i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingBottom: 8, borderBottom: '1px dashed #e2e8f0' }}>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{name}</div>
                                                <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{sub}</div>
                                            </div>
                                            <span style={{ fontFamily: mono, fontSize: 11, color: ACCENT, fontWeight: 700 }}>{dist}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ py: 20, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                                        No {activeCategory} locations found nearby.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', minHeight: 400 }}>
                        {data.mapZoomOut ? (
                            <img 
                                src={data.mapZoomOut} 
                                alt="Neighborhood Map" 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 10, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                                Map · {city} · nearby pins
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
