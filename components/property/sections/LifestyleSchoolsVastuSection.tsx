import React from 'react';
import { PropertyData } from '../../../types';
import { computeVastu, dirLabel } from '../../../utils/vastuAnalysis';
import { isTargetForOrientationAnalysis, isOrientationClear } from '../../../utils/propertyPolicies';
import { VASTU_REMEDIES } from '../VastuCard';

// ── Persona config ────────────────────────────────────────────────────────────

const PERSONAS = [
    {
        id: 'working_professionals',
        label: 'Working Professionals',
        accent: '#4f46e5',
        softBg: 'rgba(79,70,229,0.07)',
        chipActive: { border: '#4f46e5', shadow: 'rgba(79,70,229,0.15)' },
    },
    {
        id: 'families_with_kids',
        label: 'Families with Kids',
        accent: '#16a34a',
        softBg: 'rgba(22,163,74,0.07)',
        chipActive: { border: '#16a34a', shadow: 'rgba(22,163,74,0.15)' },
    },
    {
        id: 'seniors',
        label: 'Seniors',
        accent: '#d97706',
        softBg: 'rgba(217,119,6,0.07)',
        chipActive: { border: '#d97706', shadow: 'rgba(217,119,6,0.15)' },
    },
];

const VERDICT_BADGE: Record<string, string> = {
    'Excellent Fit': 'bg-emerald-100 text-emerald-700',
    'Good Fit': 'bg-indigo-100 text-indigo-700',
    'Moderate Fit': 'bg-amber-100 text-amber-700',
    'Poor Fit': 'bg-orange-100 text-orange-700',
    'Not Recommended': 'bg-rose-100 text-rose-700',
};

// ── School level config ───────────────────────────────────────────────────────

const SCHOOL_LEVEL: Record<string, { label: string; accent: string; soft: string; ring: string; ink: string }> = {
    elementary: { label: 'Elementary', accent: '#16a34a', soft: '#ecfdf5', ring: '#bbf7d0', ink: '#166534' },
    middle:     { label: 'Middle',     accent: '#d97706', soft: '#fffbeb', ring: '#fde68a', ink: '#92400e' },
    high:       { label: 'High School', accent: '#4f46e5', soft: '#eef2ff', ring: '#c7d2fe', ink: '#3730a3' },
};

function getSchoolLevelKey(level: string): keyof typeof SCHOOL_LEVEL {
    const l = (level || '').toLowerCase();
    if (l.includes('elementary') || l.includes('primary')) return 'elementary';
    if (l.includes('middle')) return 'middle';
    return 'high';
}

// ── Sub-components ────────────────────────────────────────────────────────────

const serif = "'Instrument Serif', Georgia, 'Times New Roman', serif";

function SectionHeader({ kicker, title, sub, accent }: {
    kicker: string;
    title: React.ReactNode;
    sub: string;
    accent: string;
}) {
    return (
        <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ width: 24, height: 1, background: accent, display: 'inline-block' }} />
                <span style={{ fontSize: 10, letterSpacing: '0.18em', fontWeight: 700, color: accent, textTransform: 'uppercase' }}>
                    {kicker}
                </span>
            </div>
            <h2 style={{ fontFamily: serif, fontSize: 36, lineHeight: 1.05, margin: '0 0 8px', fontWeight: 400, letterSpacing: '-0.02em', color: '#0f172a' }}>
                {title}
            </h2>
            <p className="text-[14px] text-slate-500 leading-relaxed max-w-2xl">{sub}</p>
        </div>
    );
}

function ScoreRing({ score, color, size = 58 }: { score: string | number; color: string; size?: number }) {
    const raw = String(score ?? '8');
    const numStr = raw.includes('/') ? raw.split('/')[0] : raw;
    const num = parseFloat(numStr) || 0;
    const pct = num / 10;
    const r = size / 2 - 5;
    const c = 2 * Math.PI * r;
    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="4" />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
                    strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                <span style={{ fontFamily: serif, fontSize: size * 0.34, color, letterSpacing: '-0.02em', fontWeight: 400 }}>{num}</span>
                <span style={{ fontSize: size * 0.15, color: '#94a3b8', fontWeight: 600, marginTop: 1 }}>/ 10</span>
            </div>
        </div>
    );
}

function CompassSvgLight({ front, size = 170 }: { front: string; size?: number }) {
    const cx = size / 2, cy = size / 2;
    const rOuter = size / 2 - 3;
    const rMid = rOuter * 0.68;
    const rInner = rOuter * 0.34;
    const dirs = [
        { label: 'N', angle: -90 }, { label: 'NE', angle: -45 },
        { label: 'E', angle: 0 }, { label: 'SE', angle: 45 },
        { label: 'S', angle: 90 }, { label: 'SW', angle: 135 },
        { label: 'W', angle: 180 }, { label: 'NW', angle: -135 },
    ];
    const frontDir = dirs.find(d => d.label === front);
    const fa = frontDir ? frontDir.angle : 0;
    const a1 = ((fa - 22.5) * Math.PI) / 180;
    const a2 = ((fa + 22.5) * Math.PI) / 180;
    const wp = `M ${cx + rInner * Math.cos(a1)} ${cy + rInner * Math.sin(a1)}
      L ${cx + rOuter * Math.cos(a1)} ${cy + rOuter * Math.sin(a1)}
      A ${rOuter} ${rOuter} 0 0 1 ${cx + rOuter * Math.cos(a2)} ${cy + rOuter * Math.sin(a2)}
      L ${cx + rInner * Math.cos(a2)} ${cy + rInner * Math.sin(a2)}
      A ${rInner} ${rInner} 0 0 0 ${cx + rInner * Math.cos(a1)} ${cy + rInner * Math.sin(a1)} Z`;
    const frontRad = (fa * Math.PI) / 180;
    const nx = cx + (rMid - 6) * Math.cos(frontRad);
    const ny = cy + (rMid - 6) * Math.sin(frontRad);
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={cx} cy={cy} r={rOuter} fill="#fff" stroke="#e2e8f0" strokeWidth="1.2" />
            <path d={wp} fill="#fff7ed" stroke="#f59e0b" strokeWidth="1" opacity="0.9" />
            <circle cx={cx} cy={cy} r={rMid} fill="#fff" stroke="#e2e8f0" strokeWidth="1" />
            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
                const a = ((i * 45 + 22.5) * Math.PI) / 180;
                return <line key={i} x1={cx + rMid * Math.cos(a)} y1={cy + rMid * Math.sin(a)}
                    x2={cx + rOuter * Math.cos(a)} y2={cy + rOuter * Math.sin(a)} stroke="#e2e8f0" strokeWidth="1" />;
            })}
            {dirs.map(d => {
                const rad = (d.angle * Math.PI) / 180;
                const lr = (rMid + rOuter) / 2;
                const isFront = d.label === front;
                return (
                    <text key={d.label}
                        x={cx + lr * Math.cos(rad)} y={cy + lr * Math.sin(rad)}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize={d.label.length > 1 ? 9 : 10.5}
                        fontWeight={isFront ? 700 : 600}
                        fill={isFront ? '#f59e0b' : d.label === 'N' ? '#475569' : '#94a3b8'}
                        fontFamily="ui-sans-serif,system-ui">{d.label}</text>
                );
            })}
            {[{ l: 'N', a: -90 }, { l: 'E', a: 0 }, { l: 'S', a: 90 }, { l: 'W', a: 180 }].map(d => {
                const rad = (d.a * Math.PI) / 180;
                const lr = (rInner + rMid) / 2;
                return (
                    <text key={'i' + d.l}
                        x={cx + lr * Math.cos(rad)} y={cy + lr * Math.sin(rad)}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize="8.5" fontWeight="600" fill="#cbd5e1"
                        fontFamily="ui-sans-serif,system-ui">{d.l}</text>
                );
            })}
            <circle cx={cx} cy={cy} r={rInner} fill="#fff" stroke="#e2e8f0" strokeWidth="1" />
            <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx={cx} cy={cy} r="3.5" fill="#334155" />
            <text x={cx + ((rInner + rOuter) / 2) * Math.cos(frontRad)}
                y={cy + ((rInner + rOuter) / 2) * Math.sin(frontRad)}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="10" fontWeight="700" fill="#f59e0b"
                fontFamily="ui-sans-serif,system-ui">{front}</text>
        </svg>
    );
}

function SchoolCard({ school, featured, onDetails }: { school: any; featured?: boolean; onDetails: () => void }) {
    const levelKey = getSchoolLevelKey(school.level || '');
    const L = SCHOOL_LEVEL[levelKey];
    const score = school.rating ?? '8';
    const sections: Array<{ label: string; body: string }> = [];
    if (school.test_scores || school.overall_assessment)
        sections.push({ label: 'Academic Performance', body: school.test_scores || school.overall_assessment });
    if (school.extracurriculars)
        sections.push({ label: 'Strengths & Activities', body: school.extracurriculars });
    if (school.ap_ib_programs && !['n/a', 'na'].includes(school.ap_ib_programs?.toLowerCase()))
        sections.push({ label: 'AP & IB Programs', body: school.ap_ib_programs });
    if (school.college_readiness && !['n/a', 'na'].includes(school.college_readiness?.toLowerCase()))
        sections.push({ label: 'College Readiness', body: school.college_readiness });

    const pad = featured ? 22 : 18;
    const nameSize = featured ? 22 : 18;
    const ringSize = featured ? 66 : 56;

    return (
        <div style={{
            background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
            <div style={{ height: 4, background: L.accent }} />
            <div style={{ padding: pad, display: 'flex', flexDirection: 'column', gap: featured ? 14 : 12, flex: 1 }}>
                {/* Level chip */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '3px 9px', borderRadius: 999,
                        background: L.soft, color: L.ink,
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const,
                    }}>
                        <span style={{ width: 6, height: 6, borderRadius: 999, background: L.accent, display: 'inline-block' }} />
                        {L.label}
                    </span>
                </div>

                {/* Name + score ring */}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontFamily: serif, fontSize: nameSize, lineHeight: 1.1, fontWeight: 400, color: '#0f172a', letterSpacing: '-0.015em', marginBottom: 6 }}>
                            {school.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, letterSpacing: '0.1em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' as const, flexWrap: 'wrap' as const }}>
                            {school.type && <span>{school.type}</span>}
                            {school.enrollment && <><span style={{ opacity: 0.5 }}>·</span><span>{school.enrollment} students</span></>}
                            {school.grades_served && <><span style={{ opacity: 0.5 }}>·</span><span>Grades {school.grades_served}</span></>}
                            {school.student_teacher_ratio && <><span style={{ opacity: 0.5 }}>·</span><span>{school.student_teacher_ratio} ratio</span></>}
                        </div>
                    </div>
                    <ScoreRing score={score} color={L.accent} size={ringSize} />
                </div>

                {/* Sections */}
                {sections.map((sec, i) => (
                    <div key={i} style={{ paddingLeft: 12, borderLeft: `2px solid ${L.ring}` }}>
                        <div style={{ fontSize: 10, letterSpacing: '0.14em', color: L.ink, fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 4 }}>
                            {sec.label}
                        </div>
                        <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.55 }}>{sec.body}</div>
                    </div>
                ))}

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 'auto', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                        <i className="fa-solid fa-location-dot" style={{ color: L.accent, fontSize: 11 }} />
                        <span>{school.distanceMiles?.toFixed(1) ?? '0.4'} mi</span>
                        <span style={{ color: '#94a3b8', fontWeight: 400 }}>· ~{Math.round((school.distanceMiles ?? 0.4) * 20)} min walk</span>
                    </div>
                    <button
                        onClick={onDetails}
                        style={{
                            background: L.soft, color: L.ink, border: 'none',
                            padding: '7px 14px', borderRadius: 8, fontSize: 11,
                            fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                        }}>
                        Details →
                    </button>
                </div>
            </div>
        </div>
    );
}

function VastuEditorialBlock({ azimuth, dir, isGT }: { azimuth: number; dir: string; isGT: boolean }) {
    const config = VASTU_REMEDIES[dir];
    if (!config) return null;
    const dirFullLabel = dirLabel(dir);

    const isInaus = ['SW', 'S'].includes(dir);
    const isAus = ['N', 'NE', 'E'].includes(dir);
    const warningColor = isInaus ? '#ef4444' : isAus ? '#16a34a' : '#d97706';
    const warningBg = isInaus ? '#fef2f2' : isAus ? '#f0fdf4' : '#fffbeb';

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 20 }}>
            {/* Left: light card */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Warning badge */}
                <div>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontSize: 10, letterSpacing: '0.14em', fontWeight: 700,
                        color: warningColor, background: warningBg,
                        padding: '4px 10px', borderRadius: 999, textTransform: 'uppercase' as const,
                    }}>
                        <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 8 }} />
                        {dirFullLabel} Facing Front
                        {isGT && <i className="fa-solid fa-circle-check" style={{ fontSize: 8, marginLeft: 2 }} title="Verified orientation" />}
                    </span>
                </div>

                {/* Heading */}
                <h3 style={{ fontFamily: serif, fontSize: 24, lineHeight: 1.1, margin: 0, letterSpacing: '-0.015em', fontWeight: 400, color: '#0f172a' }}>
                    {config.heading.split('—')[0].trim()} —&nbsp;
                    <em style={{ fontStyle: 'italic', color: '#b45309' }}>
                        {config.heading.split('—')[1]?.trim() || ''}
                    </em>
                </h3>

                {/* Statement */}
                <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
                    {config.statement}
                </p>

                {/* Compass + metric cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'center' }}>
                    <CompassSvgLight front={dir} size={170} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px' }}>
                            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 4 }}>Risk Score</div>
                            <div style={{ fontFamily: serif, fontSize: 18, color: warningColor, letterSpacing: '-0.01em' }}>{config.riskLabel}</div>
                        </div>
                        <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px' }}>
                            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 4 }}>Energy Flow</div>
                            <div style={{ fontFamily: serif, fontSize: 18, color: '#0f172a', letterSpacing: '-0.01em' }}>{config.elementLabel}</div>
                        </div>
                    </div>
                </div>

                {/* Door tones */}
                <div>
                    <div style={{ fontSize: 10, letterSpacing: '0.12em', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, marginBottom: 10 }}>
                        Recommended Door Tones
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                        {config.doorColors.map(t => (
                            <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div className={`w-9 h-9 rounded-lg shrink-0 shadow-sm ${t.twBg}`} />
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.name}</div>
                                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ fontSize: 12, color: '#b91c1c', background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>
                        <i className="fa-solid fa-ban" style={{ marginRight: 6 }} /> Avoid: {config.avoidColors}
                    </div>
                </div>
            </div>

            {/* Right: dark recommendations panel */}
            <div style={{
                background: 'linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)',
                borderRadius: 18, padding: 22, position: 'relative', overflow: 'hidden',
                display: 'flex', flexDirection: 'column', gap: 0,
            }}>
                <div style={{
                    position: 'absolute', top: -50, right: -50, width: 160, height: 160,
                    background: 'radial-gradient(circle, rgba(220,158,80,0.15) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />

                <div style={{ fontSize: 10, letterSpacing: '0.16em', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase' as const, marginBottom: 16, position: 'relative' }}>
                    Recommendations
                </div>

                {/* Remedies */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, position: 'relative' }}>
                    {config.remedies.map((r, i) => {
                        const urgencyColor = r.urgency === 'critical' ? '#ef4444'
                            : r.urgency === 'moderate' ? '#f59e0b'
                            : r.urgency === 'tip' ? '#4ade80'
                            : '#f59e0b';
                        const urgencyBg = r.urgency === 'critical' ? 'rgba(239,68,68,0.2)'
                            : r.urgency === 'moderate' ? 'rgba(245,158,11,0.2)'
                            : r.urgency === 'tip' ? 'rgba(74,222,128,0.2)'
                            : 'rgba(245,158,11,0.2)';
                        return (
                            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                <div style={{
                                    width: 28, height: 28, borderRadius: 8,
                                    background: urgencyBg, color: urgencyColor,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <i className={`fa-solid ${r.icon}`} style={{ fontSize: 11 }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3, flexWrap: 'wrap' as const }}>
                                        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#f8fafc' }}>{r.title}</span>
                                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: urgencyColor }}>
                                            • {r.urgency.toUpperCase()}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: 11, color: 'rgba(248,250,252,0.65)', lineHeight: 1.5, margin: 0 }}>{r.text}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div style={{ borderTop: '1px solid rgba(245,158,11,0.18)', paddingTop: 16, position: 'relative' }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.14em', fontWeight: 700, color: '#4ade80', textTransform: 'uppercase' as const, marginBottom: 8 }}>
                        Strategic Positive
                    </div>
                    <ul style={{ margin: '0 0 16px', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {config.dos.map((d, i) => (
                            <li key={i} style={{ display: 'flex', gap: 8, fontSize: 11.5, color: 'rgba(248,250,252,0.82)', lineHeight: 1.5 }}>
                                <span style={{ color: '#4ade80', flexShrink: 0 }}>•</span>
                                <span>{d}</span>
                            </li>
                        ))}
                    </ul>

                    <div style={{ fontSize: 10, letterSpacing: '0.14em', fontWeight: 700, color: '#f87171', textTransform: 'uppercase' as const, marginBottom: 8 }}>
                        High Avoidance
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {config.donts.map((d, i) => (
                            <li key={i} style={{ display: 'flex', gap: 8, fontSize: 11.5, color: 'rgba(248,250,252,0.82)', lineHeight: 1.5 }}>
                                <span style={{ color: '#f87171', flexShrink: 0 }}>•</span>
                                <span>{d}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}

// ── School modal ──────────────────────────────────────────────────────────────

function SchoolModal({ school, onClose }: { school: any; onClose: () => void }) {
    if (!school) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={onClose}>
            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px]" />
            <div className="relative max-w-2xl w-full bg-white rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col border border-slate-200/50"
                style={{ maxHeight: '92vh' }}
                onClick={e => e.stopPropagation()}>
                <div className="px-8 pt-8 pb-4 bg-white border-b border-slate-100 relative shrink-0">
                    <button onClick={onClose}
                        className="absolute top-6 right-6 w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all">
                        <i className="fa-solid fa-xmark text-sm" />
                    </button>
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">Other Details</h3>
                    <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mt-1">{school.name}</p>
                </div>
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                                <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-3">
                                    <i className="fa-solid fa-thumbs-up" /> Parent Loves
                                </div>
                                <p className="text-[13px] text-emerald-900 leading-relaxed font-medium">
                                    {school.parent_sentiment_positive || 'Parents appreciate the dedicated staff and supportive learning environment.'}
                                </p>
                            </div>
                            <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100/50">
                                <div className="flex items-center gap-1.5 text-[11px] font-black text-rose-600 uppercase tracking-widest mb-3">
                                    <i className="fa-solid fa-triangle-exclamation" /> Parent Concerns
                                </div>
                                <p className="text-[13px] text-rose-900 leading-relaxed font-medium">
                                    {school.parent_sentiment_concerns || 'No significant concerns reported in recent verified reviews.'}
                                </p>
                            </div>
                        </div>
                        {school.recent_news && (
                            <div className="space-y-2">
                                <div className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em]">Recent News & Updates</div>
                                <p className="text-[13px] text-slate-600 leading-relaxed font-medium">{school.recent_news}</p>
                            </div>
                        )}
                        {school.demographics_summary && (
                            <div className="space-y-2">
                                <div className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em]">Demographics</div>
                                <p className="text-[13px] text-slate-600 leading-relaxed font-medium">{school.demographics_summary}</p>
                            </div>
                        )}
                        {school.sources?.length > 0 && (
                            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-2">
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Sources:</span>
                                {school.sources.map((s: any, idx: number) => (
                                    <a key={idx} href={s.url} target="_blank" rel="noopener noreferrer"
                                        className="text-[10px] font-medium text-blue-500 hover:text-blue-600 underline transition-colors">
                                        {s.title || s.label || 'Official Source'}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

interface LifestyleSchoolsVastuSectionProps {
    data: PropertyData;
    lifestyleFit: any;
    lifestyleInsights: any;
    lifestyleLoading: boolean;
    lifestyleFitTab: string;
    setLifestyleFitTab: (v: string) => void;
    handleGenerateLifestyle: () => void;
    schoolsIntelligence: any;
    selectedSchool: number;
    setSelectedSchool: React.Dispatch<React.SetStateAction<number>>;
    isSchoolModalOpen: boolean;
    setIsSchoolModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    orientationGroundTruth?: { expected_orientation: string; expected_azimuth_deg: number | null; gt_source: string } | null;
    renderPalette?: () => React.ReactNode;
}

export const LifestyleSchoolsVastuSection: React.FC<LifestyleSchoolsVastuSectionProps> = ({
    data,
    lifestyleFit,
    lifestyleLoading,
    lifestyleFitTab,
    setLifestyleFitTab,
    schoolsIntelligence,
    selectedSchool,
    setSelectedSchool,
    isSchoolModalOpen,
    setIsSchoolModalOpen,
    orientationGroundTruth,
    renderPalette,
}) => {
    const activePersona = PERSONAS.find(p => p.id === lifestyleFitTab) || PERSONAS[0];
    const fitData = lifestyleFit?.[lifestyleFitTab];

    // ── Schools data ────────────────────────────────────────────────────────
    const schools = schoolsIntelligence?.schools || [];
    const highSchool = schools.find((s: any) => s.level?.toLowerCase().includes('high'));
    const middleSchool = schools.find((s: any) => s.level?.toLowerCase().includes('middle'));
    const elementarySchool = schools.find((s: any) =>
        s.level?.toLowerCase().includes('elementary') || s.level?.toLowerCase().includes('primary'));
    const hasSchools = schools.length > 0;

    // ── Orientation data ─────────────────────────────────────────────────────
    const sat = (data as any).orientation_ai;
    const gt = orientationGroundTruth;
    const displayAzimuth = gt ? gt.expected_azimuth_deg : sat?.azimuth_degrees;
    const displayOrientation = gt ? gt.expected_orientation : sat?.final_orientation;
    const isGT = !!gt;
    const vastu = computeVastu(displayAzimuth);
    const showOrientation = !!sat && isTargetForOrientationAnalysis(data).target && isOrientationClear(sat)
        && vastu && displayOrientation !== 'UNCLEAR';

    return (
        <div className="flex flex-col gap-12 w-full">
            {/* ── Editorial hero header ─────────────────────────────────────── */}
            <div style={{
                background: `linear-gradient(180deg, ${activePersona.softBg} 0%, transparent 100%)`,
                borderRadius: 24, border: '1px solid #e2e8f0', padding: '16px 24px 18px',
                transition: 'background 0.4s ease',
            }}>
                {/* Label row + palette */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: '#94a3b8', fontWeight: 600 }}>
                        Compatibility & Education&nbsp;·&nbsp;Lifestyle, Schools & Vastu
                    </div>
                    {renderPalette && renderPalette()}
                </div>

                <h1 style={{ fontFamily: serif, fontSize: 36, lineHeight: 1.05, margin: '0 0 6px', fontWeight: 400, letterSpacing: '-0.02em', color: '#0f172a' }}>
                    Will this home fit{' '}
                    <em style={{ fontStyle: 'italic', color: activePersona.accent }}>your</em>
                    {' '}life?
                </h1>

                <p style={{ fontSize: 13, color: '#64748b', maxWidth: 680, lineHeight: 1.5, marginBottom: 14 }}>
                    Personalized fit analysis cross-referenced with neighborhood lifestyle, educational intelligence, and property orientation.
                </p>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                    {PERSONAS.map(p => {
                        const isActive = p.id === lifestyleFitTab;
                        const verdict = lifestyleFit?.[p.id]?.verdict;
                        const badgeCls = verdict ? (VERDICT_BADGE[verdict] || 'bg-slate-100 text-slate-500') : 'bg-slate-100 text-slate-400';
                        return (
                            <button key={p.id} onClick={() => setLifestyleFitTab(p.id)}
                                style={{
                                    padding: '10px 16px', borderRadius: 12, cursor: 'pointer',
                                    background: isActive ? '#fff' : 'transparent',
                                    border: isActive ? `1px solid ${p.accent}` : '1px solid #e2e8f0',
                                    boxShadow: isActive ? `0 0 0 3px ${p.chipActive.shadow}` : 'none',
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    transition: 'all 0.2s ease',
                                }}>
                                <span style={{ width: 8, height: 8, borderRadius: 999, background: p.accent, display: 'inline-block' }} />
                                <span style={{ fontSize: 13, fontWeight: 500, color: isActive ? '#1e293b' : '#64748b' }}>{p.label}</span>
                                {verdict && (
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeCls}`}>
                                        {verdict}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Section 01: Lifestyle Fit ─────────────────────────────────── */}
            <div>
                <SectionHeader
                    kicker="Section 01 · Compatibility"
                    title={<>Lifestyle <em style={{ fontStyle: 'italic', color: activePersona.accent }}>fit</em></>}
                    sub={`How this home reads for ${activePersona.label.toLowerCase()} — strengths, tradeoffs, and a concierge tip.`}
                    accent={activePersona.accent}
                />

                {lifestyleLoading ? (
                    <div className="space-y-4">
                        <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="h-32 bg-slate-50 rounded-xl animate-pulse" />
                            <div className="h-32 bg-slate-50 rounded-xl animate-pulse" />
                        </div>
                    </div>
                ) : fitData ? (
                    <div className="flex flex-col gap-4">
                        {/* Narrative */}
                        {fitData.summary && (
                            <div style={{ background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 22px' }}>
                                <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.65 }}>{fitData.summary}</p>
                            </div>
                        )}

                        {/* Pros / Cons */}
                        {(fitData.strengths?.length > 0 || fitData.concerns?.length > 0) && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                {fitData.strengths?.length > 0 && (
                                    <div style={{ background: '#f0fdf4', borderRadius: 14, padding: '18px 20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: '#166534', textTransform: 'uppercase' as const }}>
                                            <span style={{ width: 14, height: 14, borderRadius: 999, background: '#16a34a', display: 'grid', placeItems: 'center' as const, color: 'white', fontSize: 9, fontWeight: 700 }}>✓</span>
                                            Pros
                                        </div>
                                        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            {fitData.strengths.map((s: string, i: number) => (
                                                <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: '#166534', lineHeight: 1.5 }}>
                                                    <span style={{ flexShrink: 0, marginTop: 7, width: 5, height: 5, borderRadius: 999, background: '#16a34a', display: 'inline-block' }} />
                                                    <span>{s}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {fitData.concerns?.length > 0 && (
                                    <div style={{ background: '#fffbeb', borderRadius: 14, padding: '18px 20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' as const }}>
                                            <span style={{ width: 14, height: 14, borderRadius: 999, background: '#d97706', display: 'grid', placeItems: 'center' as const, color: 'white', fontSize: 9, fontWeight: 700 }}>!</span>
                                            Cons
                                        </div>
                                        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            {fitData.concerns.map((c: string, i: number) => (
                                                <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>
                                                    <span style={{ flexShrink: 0, marginTop: 7, width: 5, height: 5, borderRadius: 999, background: '#d97706', display: 'inline-block' }} />
                                                    <span>{c}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tip */}
                        {fitData.tip && (
                            <div style={{
                                background: '#eef2ff', borderRadius: 12, padding: '14px 18px',
                                display: 'flex', gap: 12, alignItems: 'flex-start',
                                border: '1px solid rgba(79,70,229,0.15)',
                            }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#4f46e5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                                    <i className="fa-solid fa-lightbulb" />
                                </div>
                                <p style={{ fontSize: 13, color: '#3730a3', lineHeight: 1.55, margin: 0 }}>{fitData.tip}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <i className={`fa-solid fa-people-arrows text-3xl text-slate-200 mb-3`} />
                        <p className="text-[13px] font-bold text-slate-400">No lifestyle analysis available for {activePersona.label.toLowerCase()}</p>
                    </div>
                )}
            </div>

            {/* ── Section 02: Schools ───────────────────────────────────────── */}
            {hasSchools && (
                <div>
                    <SectionHeader
                        kicker="Section 02 · Education"
                        title={<>Schools <em style={{ fontStyle: 'italic', color: '#4f46e5' }}>nearby</em></>}
                        sub="Assigned public schools within walking distance, with latest CAASPP proficiency data."
                        accent="#4f46e5"
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 14, alignItems: 'start' }}>
                        {/* Featured left: high school */}
                        <div>
                            {highSchool ? (
                                <SchoolCard school={highSchool} featured
                                    onDetails={() => { setSelectedSchool(schools.indexOf(highSchool)); setIsSchoolModalOpen(true); }} />
                            ) : elementarySchool ? (
                                <SchoolCard school={elementarySchool} featured
                                    onDetails={() => { setSelectedSchool(schools.indexOf(elementarySchool)); setIsSchoolModalOpen(true); }} />
                            ) : null}
                        </div>
                        {/* Stacked right: middle + elementary */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {middleSchool && (
                                <SchoolCard school={middleSchool}
                                    onDetails={() => { setSelectedSchool(schools.indexOf(middleSchool)); setIsSchoolModalOpen(true); }} />
                            )}
                            {elementarySchool && highSchool && (
                                <SchoolCard school={elementarySchool}
                                    onDetails={() => { setSelectedSchool(schools.indexOf(elementarySchool)); setIsSchoolModalOpen(true); }} />
                            )}
                            {/* If there are additional schools beyond the 3, show them too */}
                            {schools.filter((s: any) => s !== highSchool && s !== middleSchool && s !== elementarySchool).map((s: any, i: number) => (
                                <React.Fragment key={i}>
                                    <SchoolCard school={s}
                                        onDetails={() => { setSelectedSchool(schools.indexOf(s)); setIsSchoolModalOpen(true); }} />
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Section 03: Orientation & Vastu ──────────────────────────── */}
            {showOrientation && vastu && (
                <div>
                    <SectionHeader
                        kicker="Section 03 · Energy"
                        title={<>Orientation <em style={{ fontStyle: 'italic', color: '#b45309' }}>&amp; Vastu</em></>}
                        sub="How the home faces, what it means in classical Vastu, and the remedies to rebalance it."
                        accent="#b45309"
                    />
                    <VastuEditorialBlock
                        azimuth={displayAzimuth}
                        dir={vastu.entranceZone.dir}
                        isGT={isGT}
                    />
                    {!isGT && (
                        <p className="text-[10px] text-slate-400 italic mt-3 flex items-start gap-1.5">
                            <i className="fa-solid fa-circle-info mt-0.5" />
                            Orientation and Vastu patterns are AI-inferred from aerial imagery and parcel data. Please verify on-site for absolute accuracy.
                        </p>
                    )}
                </div>
            )}

            {/* School detail modal */}
            {isSchoolModalOpen && schools[selectedSchool] && (
                <SchoolModal school={schools[selectedSchool]} onClose={() => setIsSchoolModalOpen(false)} />
            )}
        </div>
    );
};
