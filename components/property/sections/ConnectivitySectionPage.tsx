/**
 * ConnectivitySectionPage
 * Editorial redesign of the Connectivity section.
 * Accent: electric blue (#0ea5e9)
 */
import React from 'react';
import { PropertyData } from '../../../types';

interface Props {
    data: PropertyData;
}

const serif = "'Instrument Serif', Georgia, serif";
const mono  = "'JetBrains Mono', ui-monospace, monospace";
const ACCENT     = '#0ea5e9';
const ACCENT_BG  = '#e0f2fe';
const ACCENT_INK = '#0369a1';

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

function ScoreLine({ icon, label, score, hint, color }: { icon: string; label: string; score: number; hint: string; color: string }) {
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{icon} {label}</div>
                <div style={{ fontFamily: serif, fontSize: 20, color, lineHeight: 1 }}>{score}<span style={{ fontSize: 11, color: '#94a3b8' }}>/100</span></div>
            </div>
            <div style={{ background: '#f1f5f9', height: 6, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 999 }} />
            </div>
            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>{hint}</div>
        </div>
    );
}

function ISPRow({ name, technology, speed, color }: { name: string; technology: string; speed: string; color: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
            <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ width: 4, height: 4 + i * 2, background: color, borderRadius: 1 }} />
                ))}
            </div>
            <div style={{ fontWeight: 600, color: '#0f172a', flex: 1 }}>{name}</div>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8', background: '#f8fafc', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' as const }}>{technology}</span>
            <span style={{ fontFamily: mono, fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>{speed}</span>
        </div>
    );
}

function CellDots({ level, color }: { level: number; color: string }) {
    return (
        <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: 999, background: i <= level ? color : '#e2e8f0' }} />
            ))}
        </div>
    );
}

function MiniStat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 2 }}>{label}</div>
            <div style={{ fontFamily: serif, fontSize: 22, color: '#0f172a', fontWeight: 400, lineHeight: 1 }}>{value}</div>
        </div>
    );
}

export const ConnectivitySectionPage: React.FC<Props> = ({ data }) => {
    const broadband = (data as any).broadband;
    const evChargers = (data as any).evChargers;

    const walkScore     = data.walkScore    ?? 0;
    const transitScore  = data.transitScore ?? 0;
    const bikeScore     = data.bikeScore    ?? 0;
    const walkDesc      = data.walkScoreDesc    || 'Walk Score';
    const transitDesc   = data.transitScoreDesc || 'Transit Score';
    const bikeDesc      = data.bikeScoreDesc    || 'Bike Score';

    const providers = broadband?.internetProviders || [];
    const cellCoverage = broadband?.cellCoverage || [];
    const hasFiber = broadband?.hasFiber;
    const has5G    = broadband?.has5G;
    const topDownload = broadband?.topDownloadMbps;

    const signalToLevel = (sig: string) => {
        if (sig === 'Good' || sig === 'Excellent') return 4;
        if (sig === 'Fair') return 3;
        return 2;
    };

    const evStations = evChargers?.stations || [];
    const totalPorts  = evChargers?.totalPorts || evStations.reduce((a: number, s: any) => a + (s.portCount || 0), 0);
    const closestMi   = evChargers?.closestDistanceMi || (evStations[0]?.distanceMi?.toFixed(1));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Daily Living & Commute 3-col */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${ACCENT}18`, color: ACCENT, display: 'grid', placeItems: 'center', fontSize: 14 }}>⚲</div>
                    <div style={{ fontFamily: serif, fontSize: 22, color: '#0f172a' }}>Daily Living &amp; Connectivity</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 14 }}>
                    {/* Getting Around */}
                    <div style={{ background: `linear-gradient(180deg, ${ACCENT_BG}50 0%, #fff 100%)`, borderRadius: 12, border: '1px solid #e2e8f0', padding: 18 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <div style={{ fontFamily: serif, fontSize: 18, color: '#0f172a' }}>🏃 Getting Around</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {(data.walkScore != null) && <ScoreLine icon="⚑" label="Walk" score={walkScore} hint={walkDesc} color={ACCENT} />}
                            {(data.transitScore != null) && <ScoreLine icon="⎌" label="Transit" score={transitScore} hint={transitDesc} color="#f59e0b" />}
                            {(data.bikeScore != null) && <ScoreLine icon="⛷" label="Bike" score={bikeScore} hint={bikeDesc} color="#16a34a" />}
                            {(data.walkScore == null && data.transitScore == null && data.bikeScore == null) && (
                                <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Walk/transit scores not available for this property.</div>
                            )}
                        </div>
                        <div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase' as const, marginTop: 14 }}>Walk Score</div>
                    </div>

                    {/* Internet & Cell */}
                    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 18 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <div style={{ fontFamily: serif, fontSize: 18, color: '#0f172a' }}>📶 Connectivity</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                            {hasFiber && <span style={{ display: 'inline-flex', alignItems: 'center', background: '#dcfce7', color: '#166534', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>✓ FIBER</span>}
                            {has5G   && <span style={{ display: 'inline-flex', alignItems: 'center', background: `${ACCENT}18`, color: ACCENT_INK, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>5G</span>}
                            {topDownload && <span style={{ display: 'inline-flex', alignItems: 'center', background: '#f8fafc', color: '#64748b', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: '1px solid #e2e8f0' }}>Up to {topDownload} Mbps</span>}
                        </div>
                        {providers.length > 0 ? (
                            <>
                                <div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 10 }}>Internet Providers</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                                    {providers.slice(0, 5).map((p: any, i: number) => (
                                        <ISPRow key={i} name={p.name} technology={p.technology}
                                            speed={`${p.maxDownloadMbps} Mbps`}
                                            color={p.technology === 'Fiber' ? '#16a34a' : ACCENT} />
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginBottom: 14 }}>ISP data not available — check local availability.</div>
                        )}
                        {cellCoverage.length > 0 && (
                            <>
                                <div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 10, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>Cell Coverage</div>
                                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cellCoverage.length, 3)}, 1fr)`, gap: 8, fontSize: 11 }}>
                                    {cellCoverage.slice(0, 3).map((c: any, i: number) => (
                                        <div key={i} style={{ textAlign: 'center' }}>
                                            <div style={{ color: '#0f172a', fontWeight: 700, fontSize: 11 }}>{c.network}</div>
                                            <div style={{ color: '#94a3b8', fontSize: 10.5, marginBottom: 4 }}>{c.signalLevel}</div>
                                            <CellDots level={signalToLevel(c.signalLevel)} color={ACCENT} />
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* EV Charging */}
                    <div style={{ background: `linear-gradient(180deg, ${ACCENT_BG}50 0%, #fff 100%)`, borderRadius: 12, border: '1px solid #e2e8f0', padding: 18 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <div style={{ fontFamily: serif, fontSize: 18, color: '#0f172a' }}>⚡ EV Charging</div>
                        </div>
                        {evStations.length > 0 || evChargers ? (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                                    <MiniStat label="Stations" value={String(evStations.length || '—')} />
                                    <MiniStat label="Closest" value={closestMi ? `${closestMi} mi` : '—'} />
                                    <MiniStat label="Ports" value={totalPorts ? String(totalPorts) : '—'} />
                                </div>
                                {evStations.slice(0, 3).map((s: any, i: number) => (
                                    <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: i < 2 ? '1px dashed #e2e8f0' : 'none' }}>
                                        <div style={{ fontSize: 11.5, fontWeight: 600, color: '#0f172a' }}>{s.name || 'EV Station'}</div>
                                        <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{s.distanceMi?.toFixed(1)} mi · {s.portCount} ports</div>
                                    </div>
                                ))}
                            </>
                        ) : (
                            <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>EV charger data not available for this area.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Section 02 — Commute Destinations */}
            <div>
                <SectionTitleBar num="02" kicker="Commute" title="Plan your daily drive" italicWord="drive" />
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 22 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                        {[
                            { dest: 'Downtown SF', t: '~48', c: ACCENT, ex: 'BART + walk ~1h 05m via 580/BART' },
                            { dest: 'Livermore / LLNL', t: '~18', c: '#16a34a', ex: '~12 mi via I-580 W' },
                            { dest: 'SJC Airport', t: '~38', c: '#d97706', ex: 'via I-680 S' },
                            { dest: 'San Jose / SV', t: '~35', c: '#6366f1', ex: 'via 680 S to 101/280' },
                        ].map(d => (
                            <div key={d.dest} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 14, borderColor: `${d.c}25` }}>
                                <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 4 }}>{d.dest}</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                    <span style={{ fontFamily: serif, fontSize: 32, color: d.c, fontWeight: 400, lineHeight: 1 }}>{d.t}</span>
                                    <span style={{ fontSize: 11, color: '#94a3b8' }}>min</span>
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{d.ex}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' as const, marginTop: 10 }}>◉ Estimated drive times via Google Maps · peak hours vary</div>
                </div>
            </div>
        </div>
    );
};
