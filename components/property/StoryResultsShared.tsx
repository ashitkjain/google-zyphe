/**
 * Shared visual primitives for Story Results views (Gallery / Table / Map / AI Verdict).
 * ScoreRing, FitBar, FitRadar, scoreColor, deriveRadarData.
 */
import React from 'react';
import { CityPropertySummary } from '../../services/firebase/properties';

// ── Score color semantics ────────────────────────────────────────────────────

export function scoreColor(score: number) {
  if (score >= 90) return { fg: '#059669', bg: '#D1FAE5', ring: '#10B981', label: 'Best Match' };
  if (score >= 80) return { fg: '#16A34A', bg: '#DCFCE7', ring: '#22C55E', label: 'Strong Match' };
  if (score >= 70) return { fg: '#D97706', bg: '#FEF3C7', ring: '#F59E0B', label: 'Good Match' };
  return { fg: '#DC2626', bg: '#FEE2E2', ring: '#EF4444', label: 'Partial Match' };
}

export function scoreGrade(score: number) {
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  return 'C';
}

// ── Radar axes ───────────────────────────────────────────────────────────────

export const RADAR_AXES = [
  { key: 'schools', label: 'Schools', color: '#059669' },
  { key: 'commute', label: 'Commute', color: '#2563EB' },
  { key: 'light', label: 'Light', color: '#D97706' },
  { key: 'noise', label: 'Quiet', color: '#7C3AED' },
  { key: 'walk', label: 'Walk', color: '#DB2777' },
  { key: 'value', label: 'Value', color: '#0891B2' },
  { key: 'climate', label: 'Climate', color: '#DC2626' },
  { key: 'layout', label: 'Layout', color: '#4F46E5' },
  { key: 'future', label: 'Future', color: '#16A34A' },
];

// Derive heuristic radar axes from available property + match data
export function deriveRadarData(prop: CityPropertySummary, score?: number): Record<string, number> {
  const base = score ?? 72;

  const schools = prop.maxSchoolRating
    ? Math.round(prop.maxSchoolRating * 9.5)
    : Math.round(base * 0.9 + 5);

  let light = 80;
  if (prop.orientation) {
    const o = prop.orientation.toLowerCase();
    if (o.includes('east') || o.includes('south')) light = 90;
    else if (o.includes('north')) light = 62;
    else if (o.includes('west')) light = 74;
  }

  const dom = prop.daysOnZillow ?? 14;
  const future = Math.max(48, Math.min(95, 93 - dom * 0.55));

  const beds = prop.bedrooms ?? 3;
  const baths = prop.bathrooms ?? 2;
  const layout = Math.min(95, 58 + beds * 6 + baths * 4);

  // Scatter around base with light noise seeded by stable property fields
  const seed1 = (prop.zpid.charCodeAt(0) % 10) / 100;
  const seed2 = (prop.zpid.charCodeAt(1) % 10) / 100;
  const nudge = (s: number) => Math.round(Math.min(97, Math.max(45, base * 0.88 + s * 16)));

  return {
    schools: Math.min(97, schools),
    commute: nudge(0.8 + seed1),
    light,
    noise: nudge(0.85 + seed2),
    walk: nudge(0.7 + seed1),
    value: Math.round(Math.min(97, base * 1.04)),
    climate: 86,
    layout: Math.round(layout),
    future: Math.round(future),
  };
}

// ── Score Ring ───────────────────────────────────────────────────────────────

export function ScoreRing({ score, size = 56, strokeWidth = 5 }: { score: number; size?: number; strokeWidth?: number }) {
  const c = scoreColor(score);
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.ring} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: size * 0.29, fontWeight: 800, color: c.fg,
      }}>{score}</div>
    </div>
  );
}

// ── Fit Bar ──────────────────────────────────────────────────────────────────

export function FitBar({ score, width = 70 }: { score: number; width?: number }) {
  const c = scoreColor(score);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width, height: 8, borderRadius: 4, background: '#F3F4F6', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0, width: score + '%',
          background: `linear-gradient(90deg, ${c.ring}, ${c.fg})`, borderRadius: 4,
        }} />
      </div>
      <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, fontWeight: 800, color: c.fg, minWidth: 24 }}>{score}</span>
    </div>
  );
}

// ── Fit Radar ────────────────────────────────────────────────────────────────

export function FitRadar({ data, size = 120, showLabels = false, color = '#4F46E5' }: {
  data: Record<string, number>;
  size?: number;
  showLabels?: boolean;
  color?: string;
}) {
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - (showLabels ? 22 : 6);
  const n = RADAR_AXES.length;
  const pts = RADAR_AXES.map((axis, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const v = (data[axis.key] || 0) / 100;
    return {
      x: cx + Math.cos(angle) * r * v,
      y: cy + Math.sin(angle) * r * v,
      ax: cx + Math.cos(angle) * r,
      ay: cy + Math.sin(angle) * r,
      label: axis.label,
      color: axis.color,
      val: data[axis.key] || 0,
      angle,
    };
  });
  const poly = pts.map(p => `${p.x},${p.y}`).join(' ');
  const ringPts = (lv: number) => RADAR_AXES.map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return `${cx + Math.cos(angle) * r * lv},${cy + Math.sin(angle) * r * lv}`;
  }).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {[0.25, 0.5, 0.75, 1].map((l, i) => (
        <polygon key={i} points={ringPts(l)} fill="none" stroke="#E5E7EB" strokeWidth={i === 3 ? 1 : 0.5} />
      ))}
      {pts.map((p, i) => <line key={i} x1={cx} y1={cy} x2={p.ax} y2={p.ay} stroke="#E5E7EB" strokeWidth={0.5} />)}
      <polygon points={poly} fill={color + '28'} stroke={color} strokeWidth={1.5} />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={p.color} />)}
      {showLabels && pts.map((p, i) => {
        const lr = r + 13;
        const lx = cx + Math.cos(p.angle) * lr;
        const ly = cy + Math.sin(p.angle) * lr + 3;
        return (
          <text key={i} x={lx} y={ly} fontSize="8.5" fontWeight="700" fill={p.color} textAnchor="middle" letterSpacing="0.04em">
            {p.label.toUpperCase()}
          </text>
        );
      })}
    </svg>
  );
}

// ── Story Summary Strip ───────────────────────────────────────────────────────

export function StorySummaryStrip({ extracted, collapsed, onToggle }: {
  extracted: any;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const buildSummary = () => {
    if (!extracted) return 'AI story search active';
    const parts: string[] = [];
    if (extracted.priceMin && extracted.priceMax) parts.push(`$${Math.round(extracted.priceMin / 1000)}K–$${Math.round(extracted.priceMax / 1000)}K`);
    if (extracted.beds) parts.push(`${extracted.beds}+ beds`);
    if (extracted.baths) parts.push(`${extracted.baths}+ baths`);
    if (extracted.minSchoolRating) parts.push(`schools ${extracted.minSchoolRating}+`);
    if (extracted.mustHaves?.length) parts.push(...extracted.mustHaves.slice(0, 3));
    return parts.join(' · ') || 'Custom requirements';
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1330 0%, #2d1b5e 60%, #4338CA 100%)',
      color: '#fff', borderRadius: 14, padding: collapsed ? '12px 18px' : '18px 22px', marginBottom: 12,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.25), transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, #a78bfa, #6366f1)', color: '#fff',
          display: 'grid', placeItems: 'center', fontSize: 16,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
        }}>✦</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 9.5, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase', color: '#a78bfa' }}>Your story</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>•</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>AI-matched results</span>
          </div>
          <div style={{
            fontSize: collapsed ? 12.5 : 13.5, color: 'rgba(255,255,255,0.9)', lineHeight: 1.45,
            whiteSpace: collapsed ? 'nowrap' : 'normal', overflow: collapsed ? 'hidden' : 'visible',
            textOverflow: collapsed ? 'ellipsis' : 'unset',
            fontStyle: !collapsed ? 'italic' : 'normal',
          }}>
            {buildSummary()}
          </div>
        </div>
        <button onClick={onToggle} style={{
          background: 'rgba(255,255,255,0.08)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)',
          borderRadius: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer', flexShrink: 0,
        }}>{collapsed ? '▾' : '▴'}</button>
      </div>
    </div>
  );
}

// ── Formatting helpers ────────────────────────────────────────────────────────

export function fmtPrice(n?: number) {
  if (!n) return '—';
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1_000)}K`;
}
