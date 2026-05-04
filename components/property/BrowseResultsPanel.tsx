/**
 * BrowseResultsPanel
 *
 * Results area for Browse by City:
 *   Step Timings · AI Matching Loading State · AI Match Results
 *   Gallery View · Table View · Map View · AI Verdict View · Pagination
 */
import React from 'react';
import PropertyCard from './PropertyCard';
import PropertyMapView from './PropertyMapView';
import {
  ScoreRing, FitBar, FitRadar, scoreColor, scoreGrade,
  deriveRadarData, fmtPrice, RADAR_AXES,
} from './StoryResultsShared';
import { CityPropertySummary } from '../../services/firebase/properties';
import { getDaysOnMarket } from '../../utils/property.ts';

const getNeighborhoodName = (neighborhood: any): string | null => {
    if (!neighborhood) return null;
    if (typeof neighborhood === 'string') return neighborhood;
    if (typeof neighborhood === 'object') {
        return neighborhood.name || neighborhood.neighborhood_name || neighborhood.social || neighborhood.legal_subdivision || null;
    }
    return null;
};

type ViewMode = 'zypheai' | 'gallery' | 'table' | 'map' | 'verdict';

interface BrowseResultsPanelProps {
    buyerTimings: Record<string, number> | null;
    buyerSearching: boolean;
    buyerResults: Array<{ zpid: string; score: number; explanation: string, matchWriteup?: string; pros?: string[]; cons?: string[]; personaNote?: string; factors?: string[] }> | null;
    buyerExtracted: any;
    buyerStory?: string;
    buyerError: string | null;
    showTimings: boolean;
    activePath: 'browse' | 'story' | 'search';
    pageItems: CityPropertySummary[];
    displayList: CityPropertySummary[];
    totalPages: number;
    page: number;
    setPage: React.Dispatch<React.SetStateAction<number>>;
    selectedCity: string;
    viewMode: ViewMode;
    matchMap: Record<string, { score: number; rank: number; explanation?: string; matchWriteup?: string; pros?: string[]; cons?: string[]; personaNote?: string; factors?: string[] }>;
    cityGraphs: Map<string, any>;
    hoveredZpid: string | null;
    setHoveredZpid: (zpid: string | null) => void;
    fmt: (n?: number) => string;
    expandFactor: (f: string) => string;
    toggleSort: (field: string) => void;
    sortIcon: (field: string) => string;
    setBuyerResults: (v: any) => void;
    setBuyerExtracted: (v: any) => void;
    setSliderIdx: (v: number) => void;
    setViewModeLocal: (v: ViewMode) => void;
    setShowBuyerSearch: (v: boolean) => void;
    onPropertyClick: (address: string) => void;
    onLeadCapture?: (type: 'tour' | 'info', address: string, zpid?: string, price?: number) => void;
}

// ── Gallery: Podium card (top 3) — exact match to design ─────────────────────

function PodiumCard({ prop, match, rank, onOpen, onTour }: {
  prop: CityPropertySummary;
  match: { score: number; rank: number; matchWriteup?: string; pros?: string[]; cons?: string[]; personaNote?: string; factors?: string[] };
  rank: 1 | 2 | 3;
  onOpen: () => void;
  onTour: () => void;
}) {
  const c = scoreColor(match.score);
  const radar = deriveRadarData(prop, match.score);
  const img = (prop as any).imgSrc || prop.images?.[0] || '';
  const ranks = {
    1: { medal: '①', medalBg: 'linear-gradient(135deg, #FCD34D, #F59E0B)', label: 'Best Match' },
    2: { medal: '②', medalBg: 'linear-gradient(135deg, #E5E7EB, #9CA3AF)', label: 'Runner Up' },
    3: { medal: '③', medalBg: 'linear-gradient(135deg, #FBA17A, #C2410C)', label: 'Honorable Mention' },
  }[rank];

  // Use structured pros array; fall back to regex extraction from matchWriteup
  const bullets = (match.pros && match.pros.length > 0)
    ? match.pros.slice(0, 3)
    : (match.matchWriteup?.match(/✅\s*([^✅❌👤\n]+?)(?=[✅❌👤]|\.(?:\s|$)|\n|$)/g) || [])
        .slice(0, 3).map(s => s.replace('✅', '').trim().replace(/\.$/, ''));

  const verdictText = match.matchWriteup
    ? match.matchWriteup.replace(/[✅❌👤]/g, '').replace(/\s+/g, ' ').trim()
    : '';

  return (
    <div style={{
      background: '#fff', border: `2px solid ${c.ring}60`, borderRadius: 18,
      overflow: 'hidden', position: 'relative',
      boxShadow: rank === 1 ? '0 12px 40px rgba(16,185,129,0.18), 0 0 0 1px rgba(16,185,129,0.2)' : '0 6px 20px rgba(15,10,31,0.06)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Photo */}
      <div style={{ height: rank === 1 ? 220 : 180, background: img ? undefined : '#c9a878', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        {img && <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />}
        {/* Medal badge (rounded square, not circle) */}
        <div style={{
          position: 'absolute', top: 14, left: 14,
          background: ranks.medalBg, color: '#fff',
          width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center',
          fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 22, fontWeight: 700,
          boxShadow: '0 4px 14px rgba(0,0,0,0.25)', border: '2px solid #fff',
        }}>{ranks.medal}</div>
        {/* Label pill */}
        <div style={{
          position: 'absolute', top: 16, left: 64,
          background: 'rgba(255,255,255,0.95)', color: '#111827',
          padding: '4px 10px', borderRadius: 999,
          fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
        }}>{ranks.label}</div>
        {/* Score ring (size 64, strokeWidth 6) */}
        <div style={{
          position: 'absolute', top: 12, right: 14,
          background: '#fff', borderRadius: 999, padding: 6,
          boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
        }}>
          <ScoreRing score={match.score} size={64} strokeWidth={6} />
        </div>
        {/* Heart save */}
        <div style={{
          position: 'absolute', bottom: 14, right: 14,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.95)', display: 'grid', placeItems: 'center',
          fontSize: 16, color: '#DC2626', cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>♡</div>
        {/* Address overlay */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7))',
          padding: '40px 18px 14px', color: '#fff',
        }}>
          {getNeighborhoodName(prop.neighborhood) && <div style={{ fontSize: 9.5, letterSpacing: '0.18em', fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', marginBottom: 4 }}>{getNeighborhoodName(prop.neighborhood)}</div>}
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{prop.address}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        {/* Price + stats */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 26, color: '#059669', fontWeight: 600, letterSpacing: '-0.02em' }}>
            {fmtPrice(prop.listPrice)}
          </div>
          <div style={{ display: 'flex', gap: 6, fontSize: 11, color: '#6B7280', fontWeight: 600 }}>
            {prop.bedrooms && <span>{prop.bedrooms}bd</span>}
            {prop.bedrooms && <span>·</span>}
            {prop.bathrooms && <span>{prop.bathrooms}ba</span>}
            {prop.bathrooms && prop.livingArea && <span>·</span>}
            {prop.livingArea && <span>{prop.livingArea.toLocaleString()}sf</span>}
          </div>
        </div>

        {/* Radar (130px, labeled) + axis breakdown */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <FitRadar data={radar} size={130} showLabels={true} color={c.ring} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {RADAR_AXES.slice(0, 5).map(axis => {
              const v = radar[axis.key];
              return (
                <div key={axis.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9.5, color: axis.color, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', minWidth: 50 }}>{axis.label}</span>
                  <div style={{ flex: 1, height: 5, borderRadius: 3, background: axis.color + '15', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: v + '%', background: axis.color, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: '#6B7280', fontWeight: 700, minWidth: 22, textAlign: 'right' }}>{v}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Verdict — score-colored bg, rounded-square icon */}
        {verdictText && (
          <div style={{ background: c.bg, border: `1px solid ${c.ring}40`, borderRadius: 10, padding: 12, display: 'flex', gap: 10 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8, background: c.ring, color: '#fff',
              display: 'grid', placeItems: 'center', fontSize: 13, flexShrink: 0,
            }}>✦</div>
            <div>
              <div style={{ fontSize: 9.5, letterSpacing: '0.16em', fontWeight: 700, color: c.fg, textTransform: 'uppercase', marginBottom: 4 }}>AI Verdict</div>
              <div style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.5, fontStyle: 'italic' }}>{verdictText}</div>
            </div>
          </div>
        )}

        {/* Why-it-fits bullets (✅ markers from matchWriteup) */}
        {bullets.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {bullets.map((w, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11.5, color: '#6B7280', lineHeight: 1.5 }}>
                <span style={{ color: c.ring, fontWeight: 700, marginTop: 1, flexShrink: 0 }}>✓</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
          <button onClick={onOpen} style={{
            flex: 1, background: '#1a1330', color: '#fff', border: 'none', borderRadius: 999,
            padding: '10px 14px', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
          }}>View deep dive →</button>
          <button onClick={onTour} style={{
            background: '#fff', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 999,
            padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
          }}>Tour</button>
        </div>
      </div>
    </div>
  );
}

// ── Gallery: regular card ────────────────────────────────────────────────────

function GalleryCard({ prop, match, onOpen, onTour }: {
  prop: CityPropertySummary;
  match?: { score: number; rank: number; matchWriteup?: string; pros?: string[]; cons?: string[]; personaNote?: string; factors?: string[] };
  onOpen: () => void;
  onTour: () => void;
}) {
  const img = (prop as any).imgSrc || prop.images?.[0] || '';
  const dom = prop.daysOnZillow ?? getDaysOnMarket(prop.listedDate, prop.daysOnZillow) ?? null;
  const c = match ? scoreColor(match.score) : null;
  const radar = match ? deriveRadarData(prop, match.score) : null;
  const hasMatch = !!match;

  return (
    <div className="relative group" style={{
      background: '#fff',
      border: `1px solid ${hasMatch && c ? c.ring + '50' : '#E5E7EB'}`,
      borderRadius: 14, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      boxShadow: hasMatch ? `0 2px 8px ${c!.ring}18` : '0 1px 3px rgba(15,10,31,0.04)',
      transition: 'box-shadow 0.15s, border-color 0.15s',
    }}>
      {/* Photo — aspect-[2/1] to match original PropertyCard */}
      <div
        className="cursor-pointer"
        onClick={onOpen}
        style={{ aspectRatio: '2/1', position: 'relative', background: '#F3F4F6', flexShrink: 0, overflow: 'hidden' }}
      >
        {img ? (
          <img src={img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
            <i className="fa-solid fa-house" style={{ fontSize: 28, color: '#D1D5DB' }} />
          </div>
        )}
        {/* Score ring badge — only when AI match */}
        {match && c && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: '#fff', padding: '3px 9px 3px 3px', borderRadius: 999,
            display: 'flex', alignItems: 'center', gap: 5,
            boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
          }}>
            <ScoreRing score={match.score} size={24} strokeWidth={2.5} />
            <span style={{ fontSize: 9.5, fontWeight: 800, color: c.fg, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Fit</span>
          </div>
        )}
        {/* DOM badge */}
        {dom !== null && (
          <div style={{
            position: 'absolute', bottom: 8, left: 8,
            background: 'rgba(255,255,255,0.94)', padding: '2px 8px', borderRadius: 999,
            fontSize: 9.5, fontWeight: 700, color: '#6B7280', letterSpacing: '0.04em',
          }}>{dom === 0 ? 'New' : `${dom}d`}</div>
        )}
        {/* Hover CTA overlay — browse mode only (no AI match) */}
        {!hasMatch && (
          <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1.5" style={{ pointerEvents: 'none' }}>
            <button style={{ pointerEvents: 'auto' }} onClick={e => { e.stopPropagation(); onOpen(); }}
              className="flex-1 py-2 bg-indigo-600/95 backdrop-blur-sm text-white rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-colors shadow-lg flex items-center justify-center gap-1">
              <i className="fa-solid fa-magnifying-glass-chart text-[8px]"></i> Deep Dive
            </button>
            <button style={{ pointerEvents: 'auto' }} onClick={e => { e.stopPropagation(); onTour(); }}
              className="flex-1 py-2 bg-emerald-600/95 backdrop-blur-sm text-white rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-colors shadow-lg flex items-center justify-center gap-1">
              <i className="fa-solid fa-calendar-check text-[8px]"></i> Tour
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }} onClick={onOpen} className="cursor-pointer">
        {/* Address + price */}
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111827', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
            {prop.address}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
            <span style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 18, color: '#059669', fontWeight: 600, letterSpacing: '-0.02em' }}>
              {fmtPrice(prop.listPrice)}
            </span>
            <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>
              {[prop.bedrooms && `${prop.bedrooms}bd`, prop.bathrooms && `${prop.bathrooms}ba`, prop.livingArea && `${prop.livingArea.toLocaleString()}sf`].filter(Boolean).join(' · ')}
            </span>
          </div>
          {getNeighborhoodName(prop.neighborhood) && (
            <div style={{ display: 'inline-block', marginTop: 4, fontSize: 9.5, fontWeight: 700, color: '#4F46E5', background: '#EEF2FF', padding: '2px 7px', borderRadius: 999, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {getNeighborhoodName(prop.neighborhood)}
            </div>
          )}
        </div>

        {/* Mini radar + bars — only when AI match active */}
        {match && c && radar && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 8, borderTop: '1px solid #F9FAFB' }}>
            <FitRadar data={radar} size={66} color={c.ring} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {RADAR_AXES.slice(0, 4).map(axis => (
                <div key={axis.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 8, color: axis.color, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 38 }}>{axis.label}</span>
                  <div style={{ flex: 1, height: 3, borderRadius: 2, background: axis.color + '15', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: radar[axis.key] + '%', background: axis.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verdict snippet — only when AI match */}
        {match?.matchWriteup && c && (
          <div style={{
            fontSize: 10.5, color: '#6B7280', lineHeight: 1.5, background: c.bg + '55',
            padding: '6px 8px', borderRadius: 6, fontStyle: 'italic',
            borderLeft: `2px solid ${c.ring}`,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{match.matchWriteup.replace(/[✅❌👤]/g, '').replace(/\s+/g, ' ').trim()}</div>
        )}

        {/* Always-visible CTAs — only when AI match (browse mode uses hover overlay above) */}
        {hasMatch && (
          <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
            <button onClick={e => { e.stopPropagation(); onOpen(); }} style={{
              flex: 1, background: '#1a1330', color: '#fff', border: 'none', borderRadius: 999,
              padding: '7px 10px', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
            }}>Deep dive →</button>
            <button onClick={e => { e.stopPropagation(); onTour(); }} style={{
              background: '#fff', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 999,
              padding: '7px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
            }}>Tour</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Table: mini radar ────────────────────────────────────────────────────────

function MiniRadarSvg({ data, size = 34, color = '#10B981' }: { data: Record<string, number>; size?: number; color?: string }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 2;
  const pts = RADAR_AXES.map((axis, i) => {
    const angle = (Math.PI * 2 * i) / RADAR_AXES.length - Math.PI / 2;
    const v = ((data[axis.key] || 0) / 100) * r;
    return [cx + Math.cos(angle) * v, cy + Math.sin(angle) * v];
  });
  return (
    <svg width={size} height={size} style={{ display: 'block', flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E7EB" strokeWidth="0.5" />
      <polygon points={pts.map(p => p.join(',')).join(' ')} fill={color + '35'} stroke={color} strokeWidth="1" />
    </svg>
  );
}

// ── AI Verdict view sub-components ────────────────────────────────────────────

function VerdictHero({ topProp, matchCount, strongFitCount, onViewTop }: {
  topProp: CityPropertySummary;
  matchCount: number;
  strongFitCount: number;
  onViewTop: () => void;
}) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1330 0%, #2d1b54 50%, #4338CA 100%)',
      borderRadius: 16, padding: '26px 28px', color: '#fff',
      marginBottom: 18, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 300, height: 300, background: 'radial-gradient(circle, rgba(167,139,250,0.28), transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, position: 'relative' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 15, flexShrink: 0,
          background: 'linear-gradient(135deg, #a78bfa, #4f46e5)',
          display: 'grid', placeItems: 'center', fontSize: 24, color: '#fff',
          boxShadow: '0 8px 20px rgba(167,139,250,0.35)',
        }}>✦</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9.5, letterSpacing: '0.22em', fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', marginBottom: 5 }}>
            The verdict · synthesized from your story
          </div>
          <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 26, fontWeight: 500, letterSpacing: '-0.015em', lineHeight: 1.3, marginBottom: 12 }}>
            I read <em style={{ color: '#a78bfa' }}>{matchCount}</em> listings.{' '}
            <em style={{ color: '#FCD34D' }}>{strongFitCount}</em> deserve your weekend.
          </div>
          <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.65, maxWidth: 680 }}>
            Your top match is <strong style={{ color: '#fff' }}>{topProp.address}</strong>. Based on your requirements,
            it scores the highest across beds, baths, price, and neighborhood fit.
            Review each result below and filter by what matters most.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button onClick={onViewTop} style={{
              background: '#fff', color: '#4338CA', border: 'none', borderRadius: 999,
              padding: '8px 16px', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
            }}>View top match →</button>
            <button style={{
              background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 999,
              padding: '8px 16px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
            }}>Why not the others?</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerdictNarrativeCard({ prop, match, rank, onOpen, onTour }: {
  prop: CityPropertySummary;
  match: { score: number; rank: number; matchWriteup?: string; pros?: string[]; cons?: string[]; personaNote?: string; factors?: string[] };
  rank: number;
  onOpen: () => void;
  onTour: () => void;
}) {
  const c = scoreColor(match.score);
  const isAnswer = rank === 1;
  const img = (prop as any).imgSrc || prop.images?.[0] || '';
  const radar = deriveRadarData(prop, match.score);

  // Prefer structured arrays; fall back to regex extraction from matchWriteup
  const pros = (match.pros && match.pros.length > 0)
    ? match.pros.slice(0, 4)
    : (match.matchWriteup?.match(/✅\s*([^✅❌👤\n\.]+)/g) || []).slice(0, 3).map(s => s.replace('✅', '').trim());
  const cons = (match.cons && match.cons.length > 0)
    ? match.cons.slice(0, 3)
    : (match.matchWriteup?.match(/❌\s*([^✅❌👤\n\.]+)/g) || []).slice(0, 2).map(s => s.replace('❌', '').trim());

  const rankLabel = isAnswer ? 'The answer' : rank === 2 ? 'A serious contender' : 'A smart compromise';

  return (
    <div style={{
      background: '#fff',
      border: isAnswer ? `2px solid ${c.ring}` : '1px solid #E5E7EB',
      borderRadius: 16, overflow: 'hidden', marginBottom: 16,
      boxShadow: isAnswer ? `0 12px 32px ${c.ring}22` : '0 1px 3px rgba(15,10,31,0.04)',
    }}>
      {/* Header band */}
      <div style={{
        padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 12,
        background: isAnswer ? `linear-gradient(135deg, ${c.bg}, ${c.bg}55)` : '#FAFAF9',
        borderBottom: `1px solid ${isAnswer ? c.ring + '30' : '#E5E7EB'}`,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center',
          background: isAnswer ? 'linear-gradient(135deg, #FCD34D, #F59E0B)' : 'linear-gradient(135deg, #a78bfa, #4f46e5)',
          color: '#fff', fontSize: 16, fontWeight: 800,
          boxShadow: `0 4px 10px ${isAnswer ? 'rgba(245,158,11,0.3)' : 'rgba(79,70,229,0.25)'}`,
        }}>{isAnswer ? '★' : `#${rank}`}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.2em', fontWeight: 800, color: c.fg, textTransform: 'uppercase', marginBottom: 2 }}>
            {rankLabel} · Fit {match.score}/100
          </div>
          <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 19, color: '#111827', fontWeight: 500, letterSpacing: '-0.01em' }}>
            {prop.address}
          </div>
        </div>
        <ScoreRing score={match.score} size={46} strokeWidth={4} />
      </div>

      {/* Body: photo + prose */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr' }}>
        {/* Left: photo + facts */}
        <div style={{ padding: 16, borderRight: '1px solid #F3F4F6' }}>
          <div style={{ height: 170, borderRadius: 10, background: '#F3F4F6', marginBottom: 10, overflow: 'hidden', position: 'relative' }}>
            {img && <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />}
          </div>
          {getNeighborhoodName(prop.neighborhood) && <div style={{ fontSize: 9, letterSpacing: '0.16em', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 3 }}>{getNeighborhoodName(prop.neighborhood)}</div>}
          <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 22, color: '#059669', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 3 }}>
            {fmtPrice(prop.listPrice)}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginBottom: 12 }}>
            {[prop.bedrooms && `${prop.bedrooms}bd`, prop.bathrooms && `${prop.bathrooms}ba`, prop.livingArea && `${prop.livingArea.toLocaleString()}sf`].filter(Boolean).join(' · ')}
            {prop.daysOnZillow !== undefined && ` · ${prop.daysOnZillow}d`}
          </div>
          <FitRadar data={radar} size={200} showLabels={true} color={c.ring} />
        </div>

        {/* Right: AI prose */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {pros.length > 0 && (
            <div>
              <div style={{
                display: 'inline-block', fontSize: 9, letterSpacing: '0.18em', fontWeight: 800,
                color: '#059669', textTransform: 'uppercase', marginBottom: 6,
                padding: '2px 8px', borderRadius: 4, background: '#D1FAE5',
              }}>✓ Why it works</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {pros.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 7, fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>
                    <span style={{ color: '#10B981', fontWeight: 700, marginTop: 2, flexShrink: 0 }}>✓</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {cons.length > 0 && (
            <div>
              <div style={{
                display: 'inline-block', fontSize: 9, letterSpacing: '0.18em', fontWeight: 800,
                color: '#DC2626', textTransform: 'uppercase', marginBottom: 6,
                padding: '2px 8px', borderRadius: 4, background: '#FEE2E2',
              }}>◦ Where it falls short</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {cons.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 7, fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>
                    <span style={{ color: '#EF4444', fontWeight: 700, marginTop: 2, flexShrink: 0 }}>◦</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {match.personaNote && (
            <div style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              background: '#F5F3FF', borderRadius: 8, padding: '10px 14px',
              border: '1px solid #DDD6FE',
            }}>
              <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>👤</span>
              <div style={{ fontSize: 12.5, color: '#4C1D95', lineHeight: 1.55, fontStyle: 'italic' }}>
                {match.personaNote}
              </div>
            </div>
          )}
          {match.matchWriteup && (
            <div>
              <div style={{
                display: 'inline-block', fontSize: 9, letterSpacing: '0.18em', fontWeight: 800,
                color: '#4F46E5', textTransform: 'uppercase', marginBottom: 6,
                padding: '2px 8px', borderRadius: 4, background: '#EEF2FF',
              }}>✦ Full analysis</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.65, fontStyle: 'italic' }}>
                {match.matchWriteup.replace(/[✅❌👤]/g, '').replace(/\s+/g, ' ').trim()}
              </div>
            </div>
          )}

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #F3F4F6' }}>
            <button onClick={onOpen} style={{
              background: '#1a1330', color: '#fff', border: 'none', borderRadius: 999,
              padding: '9px 16px', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
            }}>View deep dive →</button>
            <button onClick={onTour} style={{
              background: '#fff', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 999,
              padding: '9px 16px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
            }}>Schedule tour</button>
            <button style={{
              background: '#fff', color: '#4F46E5', border: '1px solid #C7D2FE', borderRadius: 999,
              padding: '9px 16px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
            }}>Ask follow-up ✦</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerdictCompactCard({ prop, match, onOpen }: {
  prop: CityPropertySummary;
  match: { score: number; rank: number; matchWriteup?: string };
  onOpen: () => void;
}) {
  const c = scoreColor(match.score);
  const img = (prop as any).imgSrc || prop.images?.[0] || '';
  return (
    <div style={{
      background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
      padding: 12, display: 'flex', gap: 12, alignItems: 'center',
    }}>
      <div style={{ width: 66, height: 66, borderRadius: 9, background: '#F3F4F6', flexShrink: 0, overflow: 'hidden' }}>
        {img && <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10.5, fontWeight: 800, color: c.fg,
            padding: '2px 7px', background: c.bg, borderRadius: 4,
          }}>{match.score}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prop.address}</span>
          <span style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 14.5, color: '#059669', fontWeight: 600, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {fmtPrice(prop.listPrice)}
          </span>
        </div>
        {match.matchWriteup && (
          <div style={{ fontSize: 11.5, color: '#9CA3AF', lineHeight: 1.5, fontStyle: 'italic',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            <span style={{ color: c.ring, fontWeight: 700, marginRight: 4 }}>✦</span>
            {match.matchWriteup.replace(/[✅❌👤]/g, '').replace(/\s+/g, ' ').trim()}
          </div>
        )}
      </div>
      <button onClick={onOpen} style={{
        background: 'transparent', color: '#9CA3AF', border: '1px solid #E5E7EB',
        borderRadius: 999, padding: '7px 12px', fontSize: 10, fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0,
      }}>View →</button>
    </div>
  );
}

function VerdictDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0 14px' }}>
      <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
      <span style={{ fontSize: 9.5, letterSpacing: '0.24em', fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
    </div>
  );
}

// ── Tag color/icon helpers ────────────────────────────────────────────────────

const TAG_DEFS = [
  { fg: '#059669', bg: '#D1FAE5', border: '#059669', icon: '✎' },  // schools/education
  { fg: '#4F46E5', bg: '#EEF0FF', border: '#4F46E5', icon: '▤' },  // office/work
  { fg: '#16A34A', bg: '#DCFCE7', border: '#16A34A', icon: '❀' },  // yard/outdoor
  { fg: '#DB2777', bg: '#FCE7F3', border: '#DB2777', icon: '➟' },  // walk/park
  { fg: '#D97706', bg: '#FEF3C7', border: '#D97706', icon: '▣' },  // kitchen/open
  { fg: '#0891B2', bg: '#CFFAFE', border: '#0891B2', icon: '☼' },  // east/light
  { fg: '#7C3AED', bg: '#F3E8FF', border: '#7C3AED', icon: '¢' },  // HOA/cost
  { fg: '#DC2626', bg: '#FEE2E2', border: '#DC2626', icon: '✖' },  // no-remodel/avoid
  { fg: '#9333EA', bg: '#F3E8FF', border: '#9333EA', icon: '⌂' },  // in-law/suite
  { fg: '#0284C7', bg: '#E0F2FE', border: '#0284C7', icon: '⛈' }, // flood/safety
];

function tagStyle(text: string, idx: number) {
  const t = text.toLowerCase();
  if (t.includes('school') || t.includes('education')) return TAG_DEFS[0];
  if (t.includes('office') || t.includes('work')) return TAG_DEFS[1];
  if (t.includes('yard') || t.includes('backyard') || t.includes('outdoor') || t.includes('garden')) return TAG_DEFS[2];
  if (t.includes('walk') || t.includes('park')) return TAG_DEFS[3];
  if (t.includes('kitchen') || t.includes('open layout') || t.includes('open floor')) return TAG_DEFS[4];
  if (t.includes('east') || t.includes('light') || t.includes('facing')) return TAG_DEFS[5];
  if (t.includes('hoa') || t.includes('cost') || t.includes('fee')) return TAG_DEFS[6];
  if (t.includes('remodel') || t.includes('renovation') || t.includes('flood') || t.includes('no ')) return TAG_DEFS[7];
  if (t.includes('in-law') || t.includes('suite') || t.includes('adu')) return TAG_DEFS[8];
  return TAG_DEFS[idx % TAG_DEFS.length];
}

// ── Story Summary Strip (design-faithful) ─────────────────────────────────────

function BuyerStoryStrip({ buyerStory, extracted, matchCount }: {
  buyerStory?: string;
  extracted: any;
  matchCount: number;
}) {
  const displayText = buyerStory || extracted?.searchSummary || '';
  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1330 0%, #2d1b5e 60%, #4338CA 100%)',
      color: '#fff', borderRadius: 16, padding: '20px 26px', marginBottom: 18,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -80, right: -60, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.3), transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'linear-gradient(135deg, #a78bfa, #6366f1)', color: '#fff',
          display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
        }}>✦</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 10, letterSpacing: '0.2em', fontWeight: 700, textTransform: 'uppercase', color: '#a78bfa' }}>Your story</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>•</span>
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
              {matchCount} AI-matched results
            </span>
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.88)', lineHeight: 1.55, fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: 'italic' }}>
            {displayText ? `"${displayText}"` : 'AI story search active'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button style={{
            background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 999,
            padding: '7px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>✎ Edit story</button>
          <button style={{
            background: '#fff', color: '#4338CA', border: 'none', borderRadius: 999,
            padding: '7px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>↗ Share with partner</button>
          <button style={{
            background: 'rgba(255,255,255,0.08)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 8,
            padding: '7px 10px', fontSize: 13, cursor: 'pointer',
          }}>·</button>
        </div>
      </div>
    </div>
  );
}

// ── Story Tag Chips (separate row below strip) ─────────────────────────────────

function StoryTagChips({ extracted }: { extracted: any }) {
  const mustHaves: string[] = extracted?.mustHaves || [];
  const niceToHaves: string[] = extracted?.niceToHaves || [];
  if (mustHaves.length === 0 && niceToHaves.length === 0) return null;

  const allTags = [
    ...mustHaves.map((label, i) => ({ label, active: true, ...tagStyle(label, i) })),
    ...niceToHaves.map((label, i) => ({ label, active: false, ...tagStyle(label, mustHaves.length + i) })),
  ];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap',
      padding: '14px 18px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14,
    }}>
      {/* Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 14, borderRight: '1px solid #E5E7EB', flexShrink: 0 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.16em', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>From your story</span>
        <span style={{ fontSize: 10, color: '#4F46E5', fontWeight: 700 }}>{mustHaves.length}/{allTags.length}</span>
      </div>
      {/* Tags */}
      {allTags.map((t, i) => (
        <button key={i} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: t.active ? t.bg : '#fff',
          color: t.active ? t.fg : '#9CA3AF',
          border: '1px solid ' + (t.active ? t.border + '40' : '#E5E7EB'),
          padding: '5px 11px', borderRadius: 999, cursor: 'pointer',
          fontSize: 11.5, fontWeight: 700, letterSpacing: '0.02em',
          opacity: t.active ? 1 : 0.6,
          textDecoration: t.active ? 'none' : 'line-through',
        }}>
          <span style={{ fontSize: 11 }}>{t.icon}</span> {t.label}
        </button>
      ))}
      <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginLeft: 'auto' }}>+ Add tag</span>
    </div>
  );
}

// ── Results Filter Bar ────────────────────────────────────────────────────────

function ResultsFilterBar({ extracted, matchCount }: { extracted: any; matchCount: number }) {
  const priceLabel = extracted?.priceMin && extracted?.priceMax
    ? `$${Math.round(extracted.priceMin / 1000)}K–$${Math.round(extracted.priceMax / 1000)}K`
    : 'Any';
  const bedsLabel = extracted?.beds ? `${extracted.beds}+ bd` : 'Any';
  const typeLabel = extracted?.homeType ? extracted.homeType.replace(/_/g, ' ') : 'Any';
  const schoolsLabel = extracted?.minSchoolRating ? `${extracted.minSchoolRating}+` : 'Any';

  const filters = [
    { l: 'Sort by', v: 'Best fit', accent: true },
    { l: 'Price', v: priceLabel },
    { l: 'Beds/Baths', v: bedsLabel },
    { l: 'Type', v: typeLabel },
    { l: 'Stories', v: extracted?.stories ? String(extracted.stories) : 'Any' },
    { l: 'Schools', v: schoolsLabel },
    { l: 'Vastu', v: 'Any' },
    { l: 'Neighborhood', v: 'Any' },
  ];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
      padding: '12px 16px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, paddingRight: 14, borderRight: '1px solid #E5E7EB' }}>
        <span style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 22, fontWeight: 600, color: '#111827', letterSpacing: '-0.01em' }}>{matchCount}</span>
        <span style={{ fontSize: 9.5, letterSpacing: '0.18em', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>matches</span>
      </div>
      {filters.map(f => (
        <div key={f.l} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: 8.5, letterSpacing: '0.18em', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', lineHeight: 1.2 }}>{f.l}</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: (f as any).accent ? '#4F46E5' : '#374151', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            {(f as any).accent && <span style={{ fontSize: 11 }}>✦</span>}{f.v} <span style={{ fontSize: 9, color: '#D1D5DB' }}>▾</span>
          </span>
        </div>
      ))}
      <button style={{
        marginLeft: 'auto', background: 'transparent', border: '1px solid #E5E7EB', borderRadius: 8,
        padding: '7px 12px', fontSize: 11, color: '#6B7280', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em',
      }}>⋮ Other</button>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export const BrowseResultsPanel: React.FC<BrowseResultsPanelProps> = ({
    buyerTimings,
    buyerSearching,
    buyerResults,
    buyerExtracted,
    buyerStory,
    buyerError,
    showTimings,
    activePath,
    pageItems,
    displayList,
    totalPages,
    page,
    setPage,
    selectedCity,
    viewMode,
    matchMap,
    cityGraphs,
    hoveredZpid,
    setHoveredZpid,
    fmt,
    expandFactor,
    toggleSort,
    sortIcon,
    setBuyerResults,
    setBuyerExtracted,
    setSliderIdx,
    setViewModeLocal,
    setShowBuyerSearch,
    onPropertyClick,
    onLeadCapture,
}) => {
  // Sorted by score (for AI verdict)
  const aiSorted = buyerResults
    ? [...displayList].sort((a, b) => {
        const sa = matchMap[String(a.zpid)]?.score ?? 0;
        const sb = matchMap[String(b.zpid)]?.score ?? 0;
        return sb - sa;
      })
    : [];

  const hasMatch = (zpid: string) => !!matchMap[String(zpid)];

  return (
    <>
      {/* ── STEP TIMINGS ── */}
      {buyerTimings && (
        <div className="flex flex-wrap items-center gap-2 text-[10px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
          <span className="font-black text-slate-500 uppercase tracking-wider mr-1">
            <i className="fa-solid fa-stopwatch text-teal-500 mr-1"></i>Performance:
          </span>
          {buyerTimings.map((t, i) => (
            <span key={i} className={`font-bold px-2 py-0.5 rounded-md border ${t.step === 'TOTAL'
              ? t.ms < 5000 ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-black'
                : t.ms < 8000 ? 'bg-amber-100 text-amber-800 border-amber-300 font-black'
                : 'bg-rose-100 text-rose-800 border-rose-300 font-black'
              : 'bg-white text-slate-700 border-slate-200'}`} title={t.detail || ''}>
              {t.step}: {t.ms < 1000 ? `${t.ms}ms` : `${(t.ms / 1000).toFixed(1)}s`}
            </span>
          ))}
        </div>
      )}

      {/* ── AI MATCHING LOADING STATE ── */}
      {buyerSearching && (
        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in-95 duration-500">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-3xl animate-pulse scale-150"></div>
            <div className="relative flex items-center justify-center">
              <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin duration-[2s]"></div>
              <div className="absolute inset-0 flex items-center justify-center translate-y-[-2px]">
                <i className="fa-solid fa-sparkles text-indigo-500 text-3xl animate-pulse"></i>
              </div>
            </div>
          </div>
          <div className="text-center max-w-md px-6">
            <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight mb-2 uppercase">
              {!buyerExtracted ? "AI is Extracting Requirements..." : "AI is Scoring & Matching Homes..."}
            </h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              {!buyerExtracted
                ? "Analyzing your narrative to identify key filters, architectural preferences, and neighborhood priorities."
                : "Comparing your specific requirements against the entire local inventory to find the perfect home."}
            </p>
          </div>
          {buyerExtracted && (
            <div className="mt-12 w-full max-w-3xl opacity-60 pointer-events-none scale-[0.98] transition-all">
              <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest text-center mb-3">Extracted Requirements: Stage 1 Complete</div>
              <div className="bg-white border-2 border-dashed border-indigo-100 rounded-3xl p-6 shadow-sm">
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                  {buyerExtracted.priceMin > 0 && <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-black rounded-lg text-xs">💰 {fmt(buyerExtracted.priceMin)}–{fmt(buyerExtracted.priceMax)}</span>}
                  {buyerExtracted.beds && <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-black rounded-lg text-xs">🛏 {buyerExtracted.beds}+ beds</span>}
                  {buyerExtracted.baths && <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-black rounded-lg text-xs">🚿 {buyerExtracted.baths}+ baths</span>}
                  {buyerExtracted.homeType && <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-black rounded-lg text-xs">🏠 {buyerExtracted.homeType.replace(/_/g, ' ')}</span>}
                  {buyerExtracted.stories && <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-black rounded-lg text-xs">🏗 {buyerExtracted.stories} story</span>}
                  {buyerExtracted.minSchoolRating && <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-black rounded-lg text-xs">🎓 Schools {buyerExtracted.minSchoolRating}+</span>}
                </div>
                <div className="space-y-3">
                  {buyerExtracted.mustHaves?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {buyerExtracted.mustHaves.map((mh: string, i: number) => (
                        <span key={i} className="text-[10px] bg-rose-50 text-rose-600 font-bold px-2 py-0.5 rounded border border-rose-100">✔ {mh}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="mt-12 w-48 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full bg-indigo-600 transition-all duration-700 ${buyerExtracted ? 'w-3/4' : 'w-1/4 animate-pulse'}`}></div>
          </div>
        </div>
      )}

      {/* ── AI MATCH RESULTS LIST (zypheai) ── */}
      {viewMode === 'zypheai' && buyerResults && buyerResults.length > 0 && !buyerSearching && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl px-5 py-3 flex items-center gap-3">
            <i className="fa-solid fa-trophy text-amber-300"></i>
            <span className="text-sm font-black text-white">AI Match Results</span>
            <span className="text-[10px] font-bold text-indigo-200 ml-1">{displayList.length} matches</span>
            <button
              onClick={() => { setBuyerResults(null); setBuyerExtracted(null); setSliderIdx(0); setViewModeLocal('gallery'); setShowBuyerSearch(false); }}
              className="ml-auto text-[10px] font-bold text-indigo-200 hover:text-white transition-colors flex items-center gap-1"
            >
              <i className="fa-solid fa-xmark"></i> Clear & Show All
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto space-y-3 pr-1" style={{ scrollbarWidth: 'thin' }}>
            {displayList.map((prop, idx) => {
              const match = matchMap[String(prop.zpid)];
              if (!match) return null;
              const img = (prop as any).imgSrc || prop.images?.[0] || '';
              return (
                <div key={match.zpid} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all overflow-hidden">
                  <div className="flex flex-col sm:flex-row">
                    {img && (
                      <div className="sm:w-56 h-40 sm:h-auto flex-shrink-0 bg-cover bg-center cursor-pointer relative"
                        style={{ backgroundImage: `url(${img})`, minHeight: 160 }}
                        onClick={() => window.open(`/explore?q=${encodeURIComponent((match as any).address || prop.address)}`, '_blank')}>
                        <span className={`absolute top-2 left-2 text-[10px] font-black px-2 py-1 rounded-lg shadow-md ${idx === 0 ? 'bg-amber-400 text-white' : idx < 3 ? 'bg-indigo-600 text-white' : 'bg-white/95 text-slate-600 border border-slate-200'}`}>
                          #{idx + 1}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <button onClick={() => window.open(`/explore?q=${encodeURIComponent((match as any).address || prop.address)}`, '_blank')}
                            className="text-sm font-black text-slate-800 hover:text-indigo-600 transition-colors text-left">
                            {prop.address}
                          </button>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {prop.listPrice && <span className="text-sm font-black text-emerald-600">{fmt(prop.listPrice)}</span>}
                            {prop.bedrooms && <span className="text-[11px] text-slate-500 font-bold">{prop.bedrooms} bd</span>}
                            {prop.bathrooms && <span className="text-[11px] text-slate-500 font-bold">{prop.bathrooms} ba</span>}
                            {prop.livingArea && <span className="text-[11px] text-slate-500 font-bold">{prop.livingArea.toLocaleString()} sqft</span>}
                          </div>
                        </div>
                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center ${match.score >= 80 ? 'bg-emerald-50 border border-emerald-200' : match.score >= 60 ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-slate-200'}`}>
                          <span className={`text-lg font-black ${match.score >= 80 ? 'text-emerald-600' : match.score >= 60 ? 'text-amber-600' : 'text-slate-400'}`}>{match.score}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {match.matchWriteup && (
                          <div className="flex flex-wrap gap-1.5 pb-1">
                            {(match.matchWriteup.match(/✅\s*([^✅❌👤\.]+)/g) || []).map((tag, tIdx) => (
                              <span key={tIdx} className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                                {tag.replace('✅', '').trim()}
                              </span>
                            ))}
                            {(match.matchWriteup.match(/❌\s*([^✅❌👤\.]+)/g) || []).map((tag, tIdx) => (
                              <span key={tIdx} className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100">
                                {tag.replace('❌', '').trim()}
                              </span>
                            ))}
                          </div>
                        )}
                        {match.matchWriteup && <p className="text-[11.5px] text-slate-700 leading-relaxed italic">{match.matchWriteup}</p>}
                        {match.factors && match.factors.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2 mb-1">
                            {match.factors.map((f, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-amber-50/50 border border-amber-100/50 text-[9px] font-bold text-amber-700/80">
                                <i className="fa-solid fa-sparkles text-[7px] mr-1 opacity-50"></i>{expandFactor(f)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── GALLERY VIEW ── */}
      {viewMode === 'gallery' && (
        <div className="animate-in fade-in duration-300">
          {/* Story strip + tags + filter bar (when AI results active) */}
          {buyerResults && buyerExtracted && (
            <>
              <BuyerStoryStrip buyerStory={buyerStory} extracted={buyerExtracted} matchCount={buyerResults.length} />
              <StoryTagChips extracted={buyerExtracted} />
              <ResultsFilterBar extracted={buyerExtracted} matchCount={buyerResults.length} />
            </>
          )}

          {/* Podium: top N (1–3) when AI results active */}
          {buyerResults && aiSorted.length >= 1 && (() => {
            const podiumItems = aiSorted.slice(0, 3).filter(p => !!matchMap[String(p.zpid)]);
            const cols = podiumItems.length === 1 ? '1fr' : podiumItems.length === 2 ? '1.1fr 1fr' : '1.15fr 1fr 1fr';
            const topN = Math.min(podiumItems.length, 3);
            return (
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11,
                    color: '#059669', padding: '2px 7px', borderRadius: 4, background: '#D1FAE5', fontWeight: 700,
                  }}>★</span>
                  <span style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 26, color: '#111827', letterSpacing: '-0.01em', fontWeight: 500 }}>
                    Top {topN} {topN === 1 ? 'match' : 'matches'} for <em style={{ fontStyle: 'italic', color: '#059669' }}>your story</em>
                  </span>
                  <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>· of {buyerResults.length} — re-ranked when you edit</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 16, alignItems: 'stretch' }}>
                  {podiumItems.map((prop, i) => {
                    const match = matchMap[String(prop.zpid)];
                    return (
                      <PodiumCard
                        key={prop.zpid}
                        prop={prop}
                        match={match}
                        rank={(i + 1) as 1 | 2 | 3}
                        onOpen={() => onPropertyClick(prop.address)}
                        onTour={() => onLeadCapture?.('tour', prop.address, prop.zpid, prop.listPrice)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* More matches section header */}
          {buyerResults && aiSorted.length > 3 && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
              <span style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11,
                color: '#4F46E5', padding: '2px 7px', borderRadius: 4, background: '#EEF0FF', fontWeight: 700,
              }}>•</span>
              <span style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 22, color: '#111827', letterSpacing: '-0.01em', fontWeight: 500 }}>More matches</span>
              <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>· sorted by fit</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {buyerResults
              // AI story mode: GalleryCard with score ring, radar, verdict
              ? aiSorted.slice(3).map(prop => {
                  const match = matchMap[String(prop.zpid)];
                  return (
                    <GalleryCard
                      key={prop.zpid}
                      prop={prop}
                      match={match}
                      onOpen={() => onPropertyClick(prop.address)}
                      onTour={() => onLeadCapture?.('tour', prop.address, prop.zpid, prop.listPrice)}
                    />
                  );
                })
              // Browse mode: original PropertyCard (unchanged look/feel)
              : pageItems.map(prop => {
                  const match = matchMap[String(prop.zpid)];
                  return (
                    <PropertyCard
                      key={prop.zpid}
                      property={prop as any}
                      match={match}
                      factors={cityGraphs.get(String(prop.zpid))?.factors}
                      onClick={() => onPropertyClick(prop.address)}
                      onTourClick={e => { e.stopPropagation(); onLeadCapture?.('tour', prop.address, prop.zpid, prop.listPrice); }}
                      onInfoClick={e => { e.stopPropagation(); onLeadCapture?.('info', prop.address, prop.zpid, prop.listPrice); }}
                    />
                  );
                })
            }
          </div>
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {viewMode === 'table' && (
        <div className="animate-in fade-in duration-300">
          {buyerResults && buyerExtracted && (
            <BuyerStoryStrip buyerStory={buyerStory} extracted={buyerExtracted} matchCount={buyerResults.length} />
          )}

          {/* Bulk actions */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '9px 13px',
            background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, marginBottom: 12, fontSize: 11.5,
          }}>
            <input type="checkbox" style={{ width: 14, height: 14 }} />
            <span style={{ color: '#6B7280', fontWeight: 600 }}>Select all {displayList.length}</span>
            <span style={{ color: '#D1D5DB' }}>|</span>
            <button style={{ background: 'none', border: 'none', color: '#4F46E5', fontWeight: 700, cursor: 'pointer', fontSize: 11.5, padding: 0 }}>Compare selected</button>
            <button style={{ background: 'none', border: 'none', color: '#4F46E5', fontWeight: 700, cursor: 'pointer', fontSize: 11.5, padding: 0 }}>Export CSV</button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.04em' }}>
              Showing {pageItems.length} of {displayList.length}{buyerResults ? ' · sorted by Fit ↓' : ''}
            </span>
          </div>

          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'auto', boxShadow: '0 1px 3px rgba(15,10,31,0.04)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, -apple-system, sans-serif' }}>
              <thead>
                <tr>
                  {/* Listing (sticky) */}
                  <th style={{
                    padding: '11px 14px', textAlign: 'left', position: 'sticky', left: 0,
                    background: '#FAFAF9', borderBottom: '2px solid #E5E7EB',
                    fontSize: 9.5, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase',
                    color: '#6B7280', whiteSpace: 'nowrap', minWidth: 260, zIndex: 2,
                    cursor: 'pointer',
                  }} onClick={() => toggleSort('address')}>
                    Listing <span style={{ marginLeft: 3, fontSize: 9, opacity: 0.5 }}>{sortIcon('address')}</span>
                  </th>
                  {/* Fit (only when AI results) */}
                  {buyerResults && (
                    <th style={{
                      padding: '11px 14px', textAlign: 'left', background: '#FAFAF9', borderBottom: '2px solid #E5E7EB',
                      fontSize: 9.5, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#4F46E5',
                      whiteSpace: 'nowrap', minWidth: 120,
                    }}>Fit ↓</th>
                  )}
                  {/* Match shape (radar) — only when AI results */}
                  {buyerResults && (
                    <th style={{
                      padding: '11px 14px', background: '#FAFAF9', borderBottom: '2px solid #E5E7EB',
                      fontSize: 9.5, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6B7280',
                      whiteSpace: 'nowrap', minWidth: 120,
                    }}>Match Shape</th>
                  )}
                  <th style={{ padding: '11px 14px', textAlign: 'right', background: '#FAFAF9', borderBottom: '2px solid #E5E7EB', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6B7280', whiteSpace: 'nowrap', minWidth: 100, cursor: 'pointer' }} onClick={() => toggleSort('listPrice')}>
                    Price <span style={{ marginLeft: 3, fontSize: 9, opacity: 0.5 }}>{sortIcon('listPrice')}</span>
                  </th>
                  <th style={{ padding: '11px 14px', textAlign: 'center', background: '#FAFAF9', borderBottom: '2px solid #E5E7EB', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6B7280', whiteSpace: 'nowrap', minWidth: 70, cursor: 'pointer' }} onClick={() => toggleSort('bedrooms')}>
                    Bd/Ba <span style={{ marginLeft: 3, fontSize: 9, opacity: 0.5 }}>{sortIcon('bedrooms')}</span>
                  </th>
                  <th style={{ padding: '11px 14px', textAlign: 'right', background: '#FAFAF9', borderBottom: '2px solid #E5E7EB', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6B7280', whiteSpace: 'nowrap', minWidth: 80, cursor: 'pointer' }} onClick={() => toggleSort('livingArea')}>
                    SqFt <span style={{ marginLeft: 3, fontSize: 9, opacity: 0.5 }}>{sortIcon('livingArea')}</span>
                  </th>
                  <th style={{ padding: '11px 14px', textAlign: 'center', background: '#FAFAF9', borderBottom: '2px solid #E5E7EB', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6B7280', whiteSpace: 'nowrap', minWidth: 65 }}>DOM</th>
                  {/* AI Verdict column (when results) */}
                  {buyerResults && (
                    <th style={{ padding: '11px 14px', background: '#FAFAF9', borderBottom: '2px solid #E5E7EB', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6B7280', whiteSpace: 'nowrap', minWidth: 300 }}>AI Verdict</th>
                  )}
                  {!buyerResults && (
                    <th style={{ padding: '11px 14px', background: '#FAFAF9', borderBottom: '2px solid #E5E7EB', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6B7280', cursor: 'pointer' }} onClick={() => toggleSort('neighborhood')}>
                      Neighborhood <span style={{ marginLeft: 3, fontSize: 9, opacity: 0.5 }}>{sortIcon('neighborhood')}</span>
                    </th>
                  )}
                  <th style={{ padding: '11px 14px', textAlign: 'center', background: '#FAFAF9', borderBottom: '2px solid #E5E7EB', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6B7280', minWidth: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((prop, i) => {
                  const match = matchMap[String(prop.zpid)];
                  const c = match ? scoreColor(match.score) : null;
                  const radar = match ? deriveRadarData(prop, match.score) : null;
                  const isTop = match && match.score >= 90;
                  const dom = prop.daysOnZillow ?? getDaysOnMarket(prop.listedDate, prop.daysOnZillow) ?? null;
                  const rowBg = isTop ? 'linear-gradient(90deg, rgba(16,185,129,0.04), transparent 35%)' : i % 2 === 0 ? '#fff' : '#FAFAF9';
                  return (
                    <tr key={prop.zpid} style={{ borderBottom: '1px solid #F3F4F6', background: rowBg }}
                      onMouseEnter={() => match && setHoveredZpid(prop.zpid)}
                      onMouseLeave={() => setHoveredZpid(null)}>
                      {/* Sticky: rank + photo + address */}
                      <td style={{ padding: '9px 14px', position: 'sticky', left: 0, background: isTop ? '#F0FDF4' : i % 2 === 0 ? '#fff' : '#FAFAF9', borderRight: '1px solid #F3F4F6', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{
                            width: 21, height: 21, borderRadius: 5, display: 'grid', placeItems: 'center',
                            background: isTop ? c!.ring : '#E5E7EB', color: isTop ? '#fff' : '#9CA3AF',
                            fontSize: 10.5, fontWeight: 800, fontFamily: "'JetBrains Mono', ui-monospace, monospace", flexShrink: 0,
                          }}>{match?.rank ?? i + 1}</div>
                          <div style={{ width: 40, height: 40, borderRadius: 7, background: '#F3F4F6', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                            {((prop as any).imgSrc || prop.images?.[0]) && <img src={(prop as any).imgSrc || prop.images![0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />}
                            {isTop && <div style={{ position: 'absolute', top: -3, right: -3, width: 13, height: 13, borderRadius: 99, background: '#FCD34D', border: '2px solid #fff', display: 'grid', placeItems: 'center', fontSize: 7, fontWeight: 800 }}>★</div>}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <button onClick={() => onPropertyClick(prop.address)} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>
                              {prop.address}
                            </button>
                            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginTop: 1 }}>
                              {getNeighborhoodName(prop.neighborhood) || prop.zipcode} · {prop.city || selectedCity}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Fit score */}
                      {buyerResults && (
                        <td style={{ padding: '9px 14px' }}>
                          {match && c ? <FitBar score={match.score} /> : <span style={{ fontSize: 11, color: '#D1D5DB' }}>—</span>}
                        </td>
                      )}

                      {/* Match shape (mini radar) */}
                      {buyerResults && (
                        <td style={{ padding: '9px 14px' }}>
                          {match && c && radar ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <MiniRadarSvg data={radar} color={c.ring} />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 1.5, fontSize: 9 }}>
                                <span style={{ color: '#059669', fontWeight: 700 }}>SCH {radar.schools}</span>
                                <span style={{ color: '#2563EB', fontWeight: 700 }}>COM {radar.commute}</span>
                                <span style={{ color: '#DB2777', fontWeight: 700 }}>WLK {radar.walk}</span>
                              </div>
                            </div>
                          ) : <span style={{ fontSize: 11, color: '#D1D5DB' }}>—</span>}
                        </td>
                      )}

                      {/* Price */}
                      <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                        <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 14.5, color: '#059669', fontWeight: 600, letterSpacing: '-0.02em' }}>{fmtPrice(prop.listPrice)}</div>
                        {prop.listPrice && prop.livingArea && (
                          <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9.5, color: '#9CA3AF', fontWeight: 600, marginTop: 1 }}>
                            ${Math.round(prop.listPrice / prop.livingArea)}/sf
                          </div>
                        )}
                      </td>

                      {/* Bd/Ba */}
                      <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, color: '#374151', fontWeight: 700 }}>
                          {prop.bedrooms ?? '—'}/{prop.bathrooms ?? '—'}
                        </span>
                      </td>

                      {/* SqFt */}
                      <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, color: '#374151', fontWeight: 700 }}>
                          {prop.livingArea ? prop.livingArea.toLocaleString() : '—'}
                        </span>
                      </td>

                      {/* DOM */}
                      <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                        {dom !== null ? (
                          <span style={{
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10.5, fontWeight: 700,
                            padding: '3px 7px', borderRadius: 99,
                            background: dom > 30 ? '#FEF3C7' : '#F3F4F6',
                            color: dom > 30 ? '#D97706' : '#6B7280',
                          }}>{dom === 0 ? 'New' : `${dom}d`}</span>
                        ) : <span style={{ color: '#D1D5DB', fontSize: 11 }}>—</span>}
                      </td>

                      {/* AI Verdict (when match) */}
                      {buyerResults && (
                        <td style={{ padding: '9px 14px', maxWidth: 300, position: 'relative' }}>
                          {match && c ? (
                            <div style={{
                              display: 'flex', gap: 7, alignItems: 'flex-start',
                              padding: '5px 9px', borderRadius: 6, background: c.bg + '55',
                              borderLeft: `2px solid ${c.ring}`,
                            }}>
                              <span style={{ color: c.ring, fontSize: 11, marginTop: 1, fontWeight: 700, flexShrink: 0 }}>✦</span>
                              <span style={{
                                fontSize: 10.5, color: '#6B7280', lineHeight: 1.5, fontStyle: 'italic',
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                              }}>
                                {match.matchWriteup?.replace(/[✅❌👤]/g, '').replace(/\s+/g, ' ').trim()}
                              </span>
                            </div>
                          ) : <span style={{ fontSize: 11, color: '#D1D5DB' }}>—</span>}
                          {/* Hover tooltip */}
                          {match && hoveredZpid === prop.zpid && match.matchWriteup && (
                            <div style={{
                              position: 'absolute', left: 0, top: '100%', zIndex: 30, width: 380,
                              background: '#fff', border: '1px solid #C7D2FE', borderRadius: 12,
                              boxShadow: '0 8px 24px rgba(15,10,31,0.15)', padding: 12,
                            }}>
                              <p style={{ fontSize: 11.5, color: '#374151', lineHeight: 1.55 }}>{match.matchWriteup}</p>
                            </div>
                          )}
                        </td>
                      )}

                      {/* Neighborhood (no AI results) */}
                      {!buyerResults && (
                        <td style={{ padding: '9px 14px', fontSize: 12, color: '#059669', fontWeight: 600 }}>
                          {getNeighborhoodName(prop.neighborhood) || '—'}
                        </td>
                      )}

                      {/* Actions */}
                      <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button title="Tour" onClick={() => onLeadCapture?.('tour', prop.address, prop.zpid, prop.listPrice)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#9CA3AF' }}>📅</button>
                          <button title="Open" onClick={() => onPropertyClick(prop.address)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #1a1330', background: '#1a1330', cursor: 'pointer', fontSize: 12, color: '#fff' }}>→</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer summary when AI results */}
          {buyerResults && (
            <div style={{
              marginTop: 12, padding: '11px 16px',
              background: 'linear-gradient(135deg, rgba(79,70,229,0.05), rgba(16,185,129,0.05))',
              border: '1px solid rgba(79,70,229,0.12)', borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 20, fontSize: 11,
            }}>
              {(() => {
                const allScores = displayList.map(p => matchMap[String(p.zpid)]?.score ?? 0).filter(Boolean);
                const top90 = allScores.filter(s => s >= 90).length;
                const median = allScores.length ? allScores.sort((a, b) => a - b)[Math.floor(allScores.length / 2)] : 0;
                const stale = displayList.filter(p => (p.daysOnZillow ?? 0) > 30).length;
                return (
                  <>
                    <span style={{ color: '#6B7280', fontWeight: 600 }}><span style={{ color: '#111827', fontWeight: 800, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{top90}</span> meet 90+ Fit</span>
                    <span style={{ color: '#6B7280', fontWeight: 600 }}>Median fit: <span style={{ color: '#111827', fontWeight: 800, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{median}</span></span>
                    <span style={{ color: '#6B7280', fontWeight: 600 }}>Stale (DOM &gt; 30): <span style={{ color: '#D97706', fontWeight: 800, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{stale}</span></span>
                    <div style={{ flex: 1 }} />
                    <button onClick={() => setViewModeLocal('verdict')} style={{
                      background: '#1a1330', color: '#fff', border: 'none', borderRadius: 999,
                      padding: '7px 14px', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
                    }}>View AI verdict →</button>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── MAP VIEW ── */}
      {viewMode === 'map' && (
        <div className="flex w-full rounded-2xl border border-slate-200 shadow-sm animate-in fade-in duration-300" style={{ minHeight: 520 }}>
          {/* Map — left half */}
          <div style={{ flex: '0 0 60%', width: '60%', minWidth: 0, position: 'relative' }}>
            <PropertyMapView
              properties={displayList}
              onPropertyClick={(addr) => onPropertyClick(addr)}
              selectedCity={selectedCity}
              matchMap={buyerResults ? Object.fromEntries(
                buyerResults.map((r, i) => [r.zpid, { score: r.score, rank: i + 1, highlight: r.matchWriteup?.split('.')[0] }])
              ) : undefined}
              containerClassName="w-full h-full relative bg-white"
            />
          </div>

          {/* Gallery panel — right half */}
          <div className="flex flex-col bg-slate-50 border-l border-slate-200" style={{ flex: '0 0 40%', width: '40%', height: 'calc(100dvh - 310px)', minHeight: 480, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
              padding: '11px 14px', borderBottom: '1px solid #E5E7EB', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff',
            }}>
              <span style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 15, color: '#111827', fontWeight: 600 }}>
                {buyerResults ? 'Ranked by fit' : `${displayList.length} homes`}
              </span>
              <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{displayList.length} results</span>
            </div>

            {/* 2-column card grid */}
            <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 8 }}>
                {(buyerResults ? aiSorted : displayList).map((prop, i) => {
                  const match = matchMap[String(prop.zpid)];
                  const c = match ? scoreColor(match.score) : null;
                  const img = (prop as any).imgSrc || prop.images?.[0] || '';
                  const dom = prop.daysOnZillow ?? getDaysOnMarket(prop.listedDate, prop.daysOnZillow) ?? null;
                  return (
                    <div
                      key={prop.zpid}
                      onClick={() => onPropertyClick(prop.address)}
                      style={{
                        borderRadius: 10, background: '#fff', border: '1px solid #E5E7EB',
                        overflow: 'hidden', cursor: 'pointer',
                        transition: 'box-shadow 0.15s, border-color 0.15s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(15,10,31,0.12)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#C7D2FE'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#E5E7EB'; }}
                    >
                      {/* Image */}
                      <div style={{ position: 'relative', width: '100%', paddingTop: '65%', background: '#F3F4F6', overflow: 'hidden' }}>
                        {img
                          ? <img src={img} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                          : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><i className="fa-regular fa-image" style={{ fontSize: 20, color: '#D1D5DB' }} /></div>
                        }
                        {/* DOM badge */}
                        {dom !== null && (
                          <div style={{
                            position: 'absolute', top: 6, left: 6,
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, fontWeight: 800,
                            padding: '2px 6px', borderRadius: 99,
                            background: dom > 30 ? '#FEF3C7' : '#fff',
                            color: dom > 30 ? '#D97706' : '#374151',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                          }}>{dom === 0 ? 'New' : `${dom}d`}</div>
                        )}
                        {/* AI score badge */}
                        {match && c && (
                          <div style={{
                            position: 'absolute', top: 6, right: 6,
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, fontWeight: 800,
                            padding: '2px 6px', borderRadius: 99, background: c.ring, color: '#fff',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                          }}>#{i + 1} · {match.score}</div>
                        )}
                      </div>

                      {/* Card body */}
                      <div style={{ padding: '8px 9px' }}>
                        {/* Price */}
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 2 }}>
                          <span style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 14, color: '#059669', fontWeight: 600, letterSpacing: '-0.01em' }}>
                            {fmtPrice(prop.listPrice)}
                          </span>
                          {prop.listPrice && prop.livingArea && (
                            <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 8.5, color: '#9CA3AF', fontWeight: 600 }}>
                              ${Math.round(prop.listPrice / prop.livingArea)}/sf
                            </span>
                          )}
                        </div>

                        {/* Beds · baths · sqft */}
                        <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9.5, color: '#374151', fontWeight: 700, marginBottom: 3 }}>
                          {[
                            prop.bedrooms && `${prop.bedrooms} bd`,
                            prop.bathrooms && `${prop.bathrooms} ba`,
                            prop.livingArea && `${prop.livingArea.toLocaleString()} sf`,
                          ].filter(Boolean).join(' · ')}
                        </div>

                        {/* Address */}
                        <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                          {prop.address}
                        </div>

                        {/* Neighborhood */}
                        {getNeighborhoodName(prop.neighborhood) && (
                          <div style={{ display: 'inline-block', fontSize: 8.5, color: '#059669', fontWeight: 700, background: '#F0FDF4', padding: '1px 5px', borderRadius: 4 }}>
                            {getNeighborhoodName(prop.neighborhood)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── AI VERDICT VIEW ── */}

      {viewMode === 'verdict' && buyerResults && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-400" style={{ paddingBottom: 80 }}>
          {/* Hero */}
          {aiSorted.length > 0 && (() => {
            const topProp = aiSorted[0];
            const strongFitCount = aiSorted.filter(p => (matchMap[String(p.zpid)]?.score ?? 0) >= 80).length;
            return (
              <VerdictHero
                topProp={topProp}
                matchCount={buyerResults.length}
                strongFitCount={strongFitCount}
                onViewTop={() => onPropertyClick(topProp.address)}
              />
            );
          })()}

          {/* Top 3 narrative cards */}
          {aiSorted.slice(0, Math.min(3, aiSorted.length)).map((prop, i) => {
            const match = matchMap[String(prop.zpid)];
            if (!match) return null;
            return (
              <VerdictNarrativeCard
                key={prop.zpid}
                prop={prop}
                match={match}
                rank={i + 1}
                onOpen={() => onPropertyClick(prop.address)}
                onTour={() => onLeadCapture?.('tour', prop.address, prop.zpid, prop.listPrice)}
              />
            );
          })}

          {/* Middle compact cards (rank 4–8) */}
          {aiSorted.length > 3 && (
            <>
              <VerdictDivider label={`Worth a look · ${Math.min(5, aiSorted.length - 3)} more`} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {aiSorted.slice(3, 8).map(prop => {
                  const match = matchMap[String(prop.zpid)];
                  if (!match) return null;
                  return (
                    <VerdictCompactCard
                      key={prop.zpid}
                      prop={prop}
                      match={match}
                      onOpen={() => onPropertyClick(prop.address)}
                    />
                  );
                })}
              </div>
            </>
          )}

          {/* Ruled out / lower score */}
          {aiSorted.length > 8 && (
            <>
              <VerdictDivider label={`Considered but lower fit · ${aiSorted.length - 8} properties`} />
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {aiSorted.slice(8).map(prop => {
                  const match = matchMap[String(prop.zpid)];
                  if (!match) return null;
                  const c = scoreColor(match.score);
                  return (
                    <div key={prop.zpid} style={{ display: 'flex', gap: 12, alignItems: 'center', paddingBottom: 8, borderBottom: '1px dashed #F3F4F6' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, fontWeight: 800, color: c.fg, padding: '2px 7px', background: c.bg, borderRadius: 4, minWidth: 28, textAlign: 'center' }}>{match.score}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#111827', minWidth: 160 }}>{prop.address}</span>
                      <span style={{ fontSize: 11.5, color: '#9CA3AF', fontStyle: 'italic', flex: 1 }}>
                        {match.matchWriteup?.replace(/[✅❌👤]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100)}…
                      </span>
                      <button onClick={() => onPropertyClick(prop.address)} style={{ background: 'transparent', color: '#9CA3AF', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                        Show anyway →
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Refine prompt */}
          <div style={{
            marginTop: 22, padding: '18px 20px',
            background: 'linear-gradient(135deg, #1a1330, #2d1b54)', borderRadius: 14, color: '#fff',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: 'linear-gradient(135deg, #a78bfa, #4f46e5)', display: 'grid', placeItems: 'center', fontSize: 16, flexShrink: 0 }}>✦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9.5, letterSpacing: '0.2em', fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', marginBottom: 2 }}>Did I get it right?</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.88)', lineHeight: 1.5 }}>
                Tell me what to weight differently — I'll re-rank in seconds.
              </div>
            </div>
            <button style={{
              background: '#fff', color: '#4338CA', border: 'none', borderRadius: 999,
              padding: '9px 16px', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
            }}>Refine story →</button>
          </div>
        </div>
      )}

      {/* Verdict fallback when no AI results */}
      {viewMode === 'verdict' && !buyerResults && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
          <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 22, color: '#374151', marginBottom: 8 }}>Run a story search first</div>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>Switch to Story mode and describe what you're looking for. The AI verdict synthesizes your results into a ranked narrative.</div>
        </div>
      )}

      {/* ── PAGINATION ── */}
      {totalPages > 1 && displayList.length > 0 && !buyerResults && viewMode !== 'zypheai' && viewMode !== 'map' && viewMode !== 'verdict' && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis');
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === 'ellipsis' ? (
                <span key={`e${i}`} className="text-xs text-slate-300 px-1">…</span>
              ) : (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${page === p ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'}`}>
                  {p}
                </button>
              )
            )}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      )}
    </>
  );
};
