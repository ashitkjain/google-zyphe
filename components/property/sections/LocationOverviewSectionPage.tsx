/**
 * LocationOverviewSectionPage
 * Editorial redesign of the Location Overview section.
 * Accent: indigo (#4f46e5) + mint (#10b981)
 */
import React from 'react';
import { PropertyData } from '../../../types';
import { CensusDemographics } from '../../../services/api/environmental';
import { NeighborhoodAnalysis } from '../../../types/ai';

interface Props {
    data: PropertyData;
    neighborhoodOverview: string | null;
    census: CensusDemographics | null;
    lifestyleInsights?: any;
    visualPoi?: NeighborhoodAnalysis['visual_poi'];
    mapLabels?: string[];
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

export const LocationOverviewSectionPage: React.FC<Props> = ({
    data, neighborhoodOverview, census, lifestyleInsights, visualPoi, mapLabels,
}) => {
    const neighborhood = data.subdivision || data.city || 'the neighborhood';
    const city = data.city || 'Pleasanton';

    // Build nearby places from google_places or visualPoi
    const places = (data as any).google_places;
    const diningPlaces: Array<{ name: string; rating?: number; reviews?: number; distance?: string }> = [];
    if (places?.dining) diningPlaces.push(...places.dining.slice(0, 7));
    else if (visualPoi?.dining) diningPlaces.push(...(visualPoi.dining as any[]).slice(0, 7));

    const hasPlaces = diningPlaces.length > 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Section 01 — Neighborhood + Affordability */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
                {/* Neighborhood card */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 22 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: `${ACCENT}18`, color: ACCENT, display: 'grid', placeItems: 'center', fontSize: 13 }}>⚲</div>
                        <div style={{ fontFamily: serif, fontSize: 22, color: '#0f172a' }}>Neighborhood: {neighborhood}</div>
                    </div>
                    {neighborhoodOverview ? (
                        <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, margin: '0 0 14px', textWrap: 'pretty' as any }}>{neighborhoodOverview}</p>
                    ) : (
                        <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', margin: '0 0 14px' }}>
                            Neighborhood overview not yet available — run a neighborhood analysis to generate it.
                        </p>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 14 }}>
                        <Chip>Mid-Range</Chip>
                        <Chip color={MINT}>No HOA</Chip>
                        {data.yearBuilt && <Pill>Built {data.yearBuilt}</Pill>}
                        {data.homeType && <Pill>{data.homeType}</Pill>}
                        {data.lotSize && <Pill>{data.lotSize} lot</Pill>}
                    </div>
                    {census && (
                        <div style={{ paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                            <div style={{ fontSize: 9.5, letterSpacing: '0.14em', fontWeight: 700, color: ACCENT, textTransform: 'uppercase' as const, marginBottom: 8 }}>Stand-out Features</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                                <Chip>Central location</Chip>
                                <Chip>Top-rated schools nearby</Chip>
                                <Chip>Family-friendly</Chip>
                            </div>
                        </div>
                    )}
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
                                ${(data.price / 1_000_000).toFixed(2)}M
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                                {data.pricePerSqFt ? `$${data.pricePerSqFt} / sqft · ` : ''}
                                {data.bedrooms}bd / {data.bathrooms}ba · {data.livingAreaValue?.toLocaleString()} sqft
                            </div>
                        </div>
                    )}
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
                        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' as const }}>
                            <span style={{ background: ACCENT, color: '#fff', padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>⚑ Dining</span>
                            <Pill>◯ Shopping</Pill>
                            <Pill>✿ Parks</Pill>
                            <Pill>⚕ Medical</Pill>
                            <Pill>⛷ Fitness</Pill>
                        </div>
                        {hasPlaces ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {diningPlaces.map((p, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingBottom: 8, borderBottom: '1px dashed #e2e8f0' }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{p.name}</div>
                                            {p.rating && (
                                                <div style={{ fontSize: 10.5, color: '#94a3b8', letterSpacing: '0.06em' }}>★ {p.rating}{p.reviews ? ` · ${p.reviews} reviews` : ''}</div>
                                            )}
                                        </div>
                                        {p.distance && <span style={{ fontFamily: mono, fontSize: 11, color: ACCENT, fontWeight: 700 }}>{p.distance}</span>}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {[
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
                                ))}
                            </div>
                        )}
                    </div>
                    <div style={{ background: `repeating-linear-gradient(135deg, ${ACCENT}06 0 6px, transparent 6px 14px), #f8fafc`, borderRadius: 12, border: '1px dashed #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase' as const, minHeight: 400 }}>
                        Map · {city} · nearby pins
                    </div>
                </div>
            </div>
        </div>
    );
};
