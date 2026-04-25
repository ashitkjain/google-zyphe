/**
 * IndoorSectionPage
 * Editorial redesign of the Interior / Indoor section.
 * Accent: teal (#0d9488)
 */
import React from 'react';
import { PropertyData } from '../../../types';
import { CustomAIAnalysisResult } from '../../../types/ai';

interface Props {
    data: PropertyData;
    customAnalysis?: CustomAIAnalysisResult | null;
    currentInteriorSummary?: any;
    designStyle?: any;
}

const serif = "'Instrument Serif', Georgia, serif";
const mono  = "'JetBrains Mono', ui-monospace, monospace";
const ACCENT     = '#0d9488';
const ACCENT_BG  = '#ccfbf1';
const ACCENT_INK = '#115e59';

// ── Primitives ────────────────────────────────────────────────────────────────

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

function ScoreRing({ value, color = ACCENT, size = 70 }: { value: number; color?: string; size?: number }) {
    const r = size / 2 - 5;
    const c = 2 * Math.PI * r;
    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5"
                    strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                <span style={{ fontFamily: serif, fontSize: size * 0.3, color, letterSpacing: '-0.02em', fontWeight: 400 }}>{value}</span>
            </div>
        </div>
    );
}

function DialCard({ label, value, hint, color }: { label: string; value: number; hint: string; color: string }) {
    return (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
            <ScoreRing value={value} color={color} />
            <div>
                <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.45 }}>{hint}</div>
            </div>
        </div>
    );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
    return (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
            <div style={{ fontFamily: serif, fontSize: 22, color: '#0f172a', fontWeight: 400, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' as const }}>{label}</div>
        </div>
    );
}

// ── Context graph derivations (mirrors Factor 21 / 28 / 30 / 16 logic) ───────

function deriveHeroTags(rf: any): string[] {
    const tags: string[] = [];
    const raw = rf?.interiorFeatures;
    if (raw) {
        const feat = parseMulti(raw).toLowerCase();
        if (feat.includes('hardwood'))                                          tags.push('Hardwood floors');
        if (feat.includes('granite') || feat.includes('quartz') || feat.includes('marble')) tags.push('Stone counters');
        if (feat.includes('crown') || feat.includes('molding'))                tags.push('Crown molding');
        if (feat.includes('skylight'))                                         tags.push('Skylight');
        if (feat.includes('fireplace'))                                        tags.push('Fireplace');
        if (feat.includes('smart') || feat.includes('wired'))                  tags.push('Smart home');
        if (feat.includes('open') || feat.includes('great room'))              tags.push('Open concept');
    }
    // Flooring type if not already covered by interiorFeatures
    if (rf?.flooring && !tags.some(t => t.toLowerCase().includes('hardwood'))) {
        const first = parseMulti(rf.flooring).split(',')[0].trim();
        if (first) tags.push(first);
    }
    return [...new Set(tags)].slice(0, 4);
}

function deriveConditionTag(rf: any): string {
    const raw = rf?.propertyCondition;
    if (!raw) return '';
    const v = String(raw).toLowerCase();
    if (v.includes('new') || v.includes('excellent') || v.includes('updated') || v.includes('remodel')) return 'Move-in ready';
    if (v.includes('good') || v.includes('well') || v.includes('maintain'))  return 'Well maintained';
    if (v.includes('fair') || v.includes('average'))                          return 'Average condition';
    if (v.includes('fixer') || v.includes('tlc') || v.includes('needs') || v.includes('dated')) return 'Needs refreshing';
    return String(raw).split(',')[0].trim();
}

function deriveSpatialTag(rf: any): string {
    const feat = parseMulti(rf?.interiorFeatures).toLowerCase();
    if (feat.includes('open') || feat.includes('great room'))                  return 'Open concept';
    const stories = rf?.stories;
    if (stories === 1)  return 'Single-story flow';
    if (stories === 2)  return 'Two-story layout';
    if (stories != null) return `${stories}-story layout`;
    return '';
}

function deriveFinishScore(rf: any): number | null {
    if (!rf) return null;
    const hasInteriorData = rf.interiorFeatures || rf.propertyCondition || rf.flooring;
    if (!hasInteriorData) return null;
    let score = 60;
    const feat = parseMulti(rf.interiorFeatures).toLowerCase();
    if (feat.includes('granite') || feat.includes('quartz') || feat.includes('marble')) score += 12;
    if (feat.includes('hardwood'))                  score += 8;
    if (feat.includes('crown') || feat.includes('molding')) score += 8;
    if (feat.includes('skylight'))                  score += 5;
    if (feat.includes('smart') || feat.includes('wired')) score += 5;
    const cond = String(rf.propertyCondition || '').toLowerCase();
    if (cond.includes('new') || cond.includes('remodel') || cond.includes('updated') || cond.includes('excellent')) score += 10;
    else if (cond.includes('fixer') || cond.includes('dated') || cond.includes('tlc')) score -= 15;
    else if (cond.includes('fair') || cond.includes('average')) score -= 5;
    return Math.min(98, Math.max(30, score));
}

function parseMulti(raw?: any): string {
    if (!raw) return '';
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'number') return String(raw);
    if (Array.isArray(raw)) {
        return raw.map(item => {
            if (!item) return '';
            if (typeof item === 'string') return item;
            if (typeof item === 'object') {
                // Room objects from API: prefer roomType, then description, then first string value
                const o = item as Record<string, any>;
                return o.roomType || o.description || o.name ||
                    Object.values(o).find(v => typeof v === 'string') || '';
            }
            return String(item);
        }).filter(Boolean).join(', ');
    }
    if (typeof raw === 'object') {
        // Single room or unknown object — extract roomType or first string field
        const o = raw as Record<string, any>;
        return o.roomType || o.description || o.name ||
            Object.values(o).find(v => typeof v === 'string') || JSON.stringify(raw);
    }
    return String(raw);
}

// ── Main component ────────────────────────────────────────────────────────────

export const IndoorSectionPage: React.FC<Props> = ({ data, customAnalysis, currentInteriorSummary, designStyle }) => {
    const interior    = customAnalysis?.home_interior;
    const roomHighlights = customAnalysis?.room_highlights || [];
    const rf          = data.resoFacts;

    // ── Derived values ────────────────────────────────────────────────────────

    const styleTag   = interior?.design_style?.style || designStyle?.style || 'Transitional';
    const overallP1  = interior?.overall_description
        || currentInteriorSummary?.interior_summary
        || 'Interior analysis pending — run property analysis to generate AI-powered insights.';
    const overallP2  = currentInteriorSummary?.vibe || '';
    const roomsSummary = currentInteriorSummary?.rooms_summary || '';
    const objectiveTags: string[] = currentInteriorSummary?.objective_tags || [];

    // Image-analysis scores (from prompt)
    const atmoScores    = interior?.atmosphere_scores;
    const facetTags     = interior?.facet_tags;
    const heroHeadline  = interior?.hero_headline || '';

    // Context-graph derived values (from resoFacts — always available)
    const heroTags      = deriveHeroTags(rf);
    const conditionTag  = deriveConditionTag(rf);
    const spatialTag    = deriveSpatialTag(rf);
    const finishScore   = deriveFinishScore(rf);

    // Show dials when image-analysis scores (brightness/warmth/openness) are available
    const hasAtmoScores = atmoScores?.brightness != null && atmoScores?.warmth != null && atmoScores?.openness != null;

    // Material palette — from AI when available
    const materialPalette: Array<{ name: string; hex: string; location: string }> =
        interior?.material_palette || [];

    const hasInterior    = !!interior;
    const hasRooms       = roomHighlights.length > 0;
    const hasMlsInterior = !!(rf?.flooring || rf?.appliances || rf?.heating || rf?.cooling ||
        rf?.interiorFeatures?.length || rf?.fireplaceFeatures || rf?.rooms || rf?.roomTypes);

    // Section counter
    let sn = 1;
    const nextSec = () => String(sn++).padStart(2, '0');

    // ── Facets ────────────────────────────────────────────────────────────────

    const facets = [
        {
            icon: '◈', title: 'Design Philosophy',
            tag: styleTag,
            body: interior?.design_style?.reasoning
                || designStyle?.reasoning
                || 'Run an interior analysis to see design classification.',
        },
        {
            icon: '◆', title: 'Colors & Materials',
            tag: facetTags?.colors_tag || (interior ? '' : '—'),
            body: interior?.color_and_materials || 'Colors and material palette analysis not yet available.',
        },
        {
            icon: '☀', title: 'Lighting Environment',
            tag: facetTags?.lighting_tag || (interior ? '' : '—'),
            body: interior?.lighting || 'Lighting analysis not yet available.',
        },
        {
            icon: '◇', title: 'Spatial Architecture',
            tag: spatialTag || (interior ? '' : '—'),
            body: interior?.spatial_flow || 'Spatial flow analysis not yet available.',
        },
        {
            icon: '⎈', title: 'Staging & Furnishings',
            tag: facetTags?.staging_tag || (interior ? '' : '—'),
            body: interior?.staging_and_furnishings || 'Staging analysis not yet available.',
        },
        {
            icon: '✓', title: 'Condition & Finish',
            tag: conditionTag || (interior ? '' : '—'),
            body: interior?.condition_and_finish || 'Condition analysis not yet available.',
        },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* ── At-a-glance stats strip ── */}
            {(data.bedrooms != null || data.bathrooms != null || data.livingAreaValue || data.yearBuilt) && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
                    {data.bedrooms   != null && <StatPill label="Bedrooms"    value={data.bedrooms} />}
                    {data.bathrooms  != null && <StatPill label="Bathrooms"   value={data.bathrooms} />}
                    {data.livingAreaValue    && <StatPill label="Living Sqft" value={data.livingAreaValue.toLocaleString()} />}
                    {data.yearBuilt          && <StatPill label="Year Built"  value={data.yearBuilt} />}
                </div>
            )}

            {/* ── Hero atmosphere strip ── */}
            <div style={{
                background: `linear-gradient(180deg, ${ACCENT_BG}60 0%, #fff 160px)`,
                borderRadius: 16, border: `1px solid ${ACCENT}30`, padding: 24,
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start',
            }}>
                <div>
                    {/* Dynamic hero tags */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' as const }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', background: `${ACCENT}18`, color: ACCENT_INK, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>◈ {styleTag}</span>
                        {heroTags.map(tag => (
                            <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', background: '#f8fafc', color: '#64748b', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: '1px solid #e2e8f0' }}>{tag}</span>
                        ))}
                    </div>

                    {/* Headline — dynamic when available */}
                    {heroHeadline ? (
                        <h2 style={{ fontFamily: serif, fontSize: 30, lineHeight: 1.1, margin: '0 0 14px', fontWeight: 400, letterSpacing: '-0.02em', color: '#0f172a' }}>
                            {heroHeadline}
                        </h2>
                    ) : (
                        <h2 style={{ fontFamily: serif, fontSize: 30, lineHeight: 1.1, margin: '0 0 14px', fontWeight: 400, letterSpacing: '-0.02em', color: '#0f172a' }}>
                            Interior &amp; <em style={{ color: ACCENT, fontStyle: 'italic' }}>atmosphere</em>
                        </h2>
                    )}

                    <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.65, margin: '0 0 10px', textWrap: 'pretty' as any }}>{overallP1}</p>
                    {overallP2 && <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.65, margin: '0 0 10px', textWrap: 'pretty' as any }}>{overallP2}</p>}
                    {roomsSummary && <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, margin: 0, textWrap: 'pretty' as any }}>{roomsSummary}</p>}

                    {/* Objective tags as chips */}
                    {objectiveTags.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginTop: 14 }}>
                            {objectiveTags.map(tag => (
                                <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', background: `${ACCENT}10`, color: ACCENT_INK, padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, border: `1px solid ${ACCENT}25` }}>
                                    {tag.replace(/-/g, ' ')}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Photo grid - Mosaic of top 5 photos */}
                {(() => {
                    const topPhotoData = customAnalysis?.image_quality_analysis?.top_photos || [];
                    let topImages = topPhotoData
                        .map(p => data.images?.[p.image_index])
                        .filter(Boolean);

                    // Fallback to first 5 images if AI top_photos missing or incomplete
                    if (topImages.length < 5) {
                        const existingSet = new Set(topImages);
                        const fallbacks = (data.images || []).filter(img => !existingSet.has(img));
                        topImages = [...topImages, ...fallbacks].slice(0, 5);
                    }

                    const hasImages = topImages.length > 0;
                    const items = hasImages ? topImages : Array.from({ length: 5 });

                    return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                            {items.map((img, i) => {
                                // First image is a hero spanning both columns
                                const isHero = i === 0;
                                return (
                                    <div key={i} style={{ 
                                        borderRadius: 10, 
                                        overflow: 'hidden', 
                                        height: isHero ? 180 : 120, 
                                        position: 'relative',
                                        gridColumn: isHero ? '1 / span 2' : 'auto',
                                        background: !img ? `repeating-linear-gradient(135deg, ${ACCENT}0a 0 6px, transparent 6px 14px), #f8fafc` : 'none',
                                        border: !img ? '1px dashed #e2e8f0' : 'none',
                                        display: !img ? 'flex' : 'block',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {img ? (
                                            <>
                                                <img src={img as string} alt={`Top Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                {/* Badge for AI Top Photos */}
                                                {i < topPhotoData.length && (
                                                    <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', color: '#fff', padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                                        {topPhotoData[i].label || 'AI Choice'}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <span style={{ fontSize: 10, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Photo {i + 1}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </div>

            {/* ── Atmosphere Dials ── */}
            {hasInterior && (hasAtmoScores || finishScore != null) && (
                <div>
                    <SectionTitleBar num={nextSec()} kicker="Atmosphere Dials" title="How it feels inside" italicWord="feels" />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                        {hasAtmoScores && <>
                            <DialCard label="Brightness"    value={atmoScores!.brightness} hint={interior?.lighting?.split('.')[0] || 'Natural light quality'}    color={ACCENT} />
                            <DialCard label="Warmth"        value={atmoScores!.warmth}     hint={interior?.color_and_materials?.split('.')[0] || 'Palette warmth'} color="#d97706" />
                            <DialCard label="Openness"      value={atmoScores!.openness}   hint={interior?.spatial_flow?.split('.')[0] || 'Layout & flow'}         color="#0ea5e9" />
                        </>}
                        {finishScore != null && (
                            <DialCard label="Finish Quality" value={finishScore} hint={interior?.condition_and_finish?.split('.')[0] || conditionTag || 'Build quality'} color="#16a34a" />
                        )}
                    </div>
                </div>
            )}

            {/* ── Interior Facets ── */}
            <div>
                <SectionTitleBar num={nextSec()} kicker="Interior Facets" title="Six dimensions of the interior" italicWord="dimensions" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                    {facets.map((f, i) => (
                        <div key={f.title} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 18, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
                            <div style={{ position: 'absolute', top: 14, right: 16, fontFamily: mono, fontSize: 10, color: '#cbd5e1', fontWeight: 700 }}>0{i + 1}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ACCENT}18`, color: ACCENT, display: 'grid', placeItems: 'center', fontSize: 15 }}>{f.icon}</div>
                                <div style={{ fontFamily: serif, fontSize: 20, color: '#0f172a', lineHeight: 1.15, letterSpacing: '-0.01em' }}>{f.title}</div>
                            </div>
                            {f.tag && f.tag !== '—' && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', background: `${ACCENT}18`, color: ACCENT_INK, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, alignSelf: 'flex-start' }}>{f.tag}</span>
                            )}
                            <p style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.6, margin: 0, textWrap: 'pretty' as any }}>{f.body}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Room Highlights ── */}
            {hasRooms && (
                <div>
                    <SectionTitleBar num={nextSec()} kicker="Room by Room" title={`${roomHighlights.length} spaces explored`} italicWord="spaces" />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                        {roomHighlights.map((room, i) => (
                            <div key={i} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                    <div style={{ fontFamily: serif, fontSize: 18, color: '#0f172a', lineHeight: 1.2, letterSpacing: '-0.01em' }}>{room.room_name}</div>
                                    {room.floor && (
                                        <span style={{ fontFamily: mono, fontSize: 9.5, color: '#94a3b8', fontWeight: 700, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '2px 7px', borderRadius: 4, flexShrink: 0, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>{room.floor}</span>
                                    )}
                                </div>
                                <p style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.6, margin: 0, textWrap: 'pretty' as any }}>{room.description}</p>
                                {room.potential_improvements && (
                                    <div style={{ paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                                        <div style={{ fontSize: 9.5, letterSpacing: '0.12em', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, marginBottom: 4 }}>Potential</div>
                                        <p style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>{room.potential_improvements}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Material Palette ── */}
            {materialPalette.length > 0 && (
                <div>
                    <SectionTitleBar num={nextSec()} kicker="Material Palette" title="What the home is made of" italicWord="made" />
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 24, display: 'grid', gridTemplateColumns: `repeat(${Math.min(materialPalette.length, 6)}, 1fr)`, gap: 18 }}>
                        {materialPalette.map(m => (
                            <div key={m.name} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ height: 70, borderRadius: 10, background: m.hex, border: '1px solid rgba(0,0,0,0.08)', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.05)' }} />
                                <div>
                                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>{m.name}</div>
                                    <div style={{ fontSize: 10, letterSpacing: '0.1em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' as const }}>{m.location}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── MLS Interior Specs ── */}
            {hasMlsInterior && (
                <div>
                    <SectionTitleBar num={nextSec()} kicker="MLS Interior Facts" title="What the listing says" italicWord="listing" />
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 22 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                            {rf?.flooring         && <SpecRow label="Flooring"           value={parseMulti(rf.flooring)} />}
                            {rf?.appliances       && <SpecRow label="Appliances"         value={parseMulti(rf.appliances)} />}
                            {rf?.heating          && <SpecRow label="Heating"            value={parseMulti(rf.heating)} />}
                            {rf?.cooling          && <SpecRow label="Cooling"            value={parseMulti(rf.cooling)} />}
                            {rf?.fireplaceFeatures && <SpecRow label="Fireplace"         value={parseMulti(rf.fireplaceFeatures)} />}
                            {(rf?.rooms || rf?.roomTypes) && <SpecRow label="Rooms"      value={parseMulti(rf.rooms || rf.roomTypes)} />}
                            {rf?.interiorFeatures  && <SpecRow label="Interior Features" value={parseMulti(rf.interiorFeatures)} />}
                            {rf?.laundryFeatures  && <SpecRow label="Laundry"            value={parseMulti(rf.laundryFeatures)} />}
                            {rf?.windowFeatures   && <SpecRow label="Windows"            value={parseMulti(rf.windowFeatures)} />}
                            {rf?.securityFeatures && <SpecRow label="Security"           value={parseMulti(rf.securityFeatures)} />}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

function SpecRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div style={{ fontSize: 9.5, letterSpacing: '0.12em', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 12.5, color: '#0f172a', fontWeight: 500, lineHeight: 1.4 }}>{value}</div>
        </div>
    );
}
