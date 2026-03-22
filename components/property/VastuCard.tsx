import React from 'react';
import { computeVastu, azimuthToLabel, VastuZoneWithAngle, dirLabel } from '../../utils/vastuAnalysis';

interface VastuCardProps {
    azimuth_degrees: number | null | undefined;
    final_orientation?: string | null;
    onRefresh?: () => void;
    refreshing?: boolean;
    /** compact=true → small inline badge (overview page). Default false → full card with compass dial + zone table. */
    compact?: boolean;
    // Tier 2: aerial site features
    pool_visible?: boolean | null;
    pool_direction?: string | null;
    garage_direction?: string | null;
    open_sky_direction?: string | null;
}

// ── SVG Compass Dial ─────────────────────────────────────────────────────────
const VastuCompass: React.FC<{ vastu: NonNullable<ReturnType<typeof computeVastu>> }> = ({ vastu }) => {
    const SIZE = 160;
    const CX = SIZE / 2;
    const CY = SIZE / 2;
    const R_OUTER = 72;
    const R_INNER = 38;
    const R_LABEL = 58;

    const sectors = vastu.allZones.map((zone) => {
        const startRad = ((zone.start - 90) * Math.PI) / 180;
        const endAngle  = zone.start > zone.end ? zone.end + 360 : zone.end;
        const endRad    = ((endAngle - 90) * Math.PI) / 180;

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
        const strokeW = zone.isEntrance ? 2 : 0.8;

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
                    fontSize={zone.isEntrance ? 9 : 7.5}
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
                strokeWidth={2.5}
                strokeLinecap="round"
            />
            <circle cx={CX} cy={CY} r={3} fill="#475569" />
            <text x={CX} y={8} textAnchor="middle" fontSize={8} fontWeight="900" fill="#64748b">N</text>
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
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    zone.relativePosition === 'Front' ? 'bg-indigo-100 text-indigo-700' :
                    zone.relativePosition === 'Back'  ? 'bg-slate-100 text-slate-500' :
                    'bg-slate-50 text-slate-400'
                }`}>{zone.relativePosition}</span>
            </td>
        </tr>
    );
};

// ── Shared: Tier 2 site features rows ────────────────────────────────────────
const SiteFeatureRows: React.FC<{
    pool_visible?: boolean | null;
    pool_direction?: string | null;
    garage_direction?: string | null;
    open_sky_direction?: string | null;
    compact?: boolean;
}> = ({ pool_visible, pool_direction, garage_direction, open_sky_direction, compact }) => {
    if (pool_visible == null && !garage_direction && !open_sky_direction) return null;

    // Same text in both modes — only size/padding differs
    const rowCls   = compact ? 'flex items-start gap-2 px-2.5 py-2' : 'flex items-start gap-3 px-3 py-2.5';
    const iconCls  = compact ? 'fa-solid text-[9px] w-3 mt-0.5'    : 'fa-solid text-xs w-4 mt-0.5';
    const textCls  = compact ? 'text-[10px] text-slate-600 flex-1 leading-snug' : 'text-[11px] text-slate-600 flex-1 leading-snug';
    const badgeCls = compact ? 'text-[11px] shrink-0' : 'text-[13px] shrink-0';

    return (
        <div className={compact
            ? 'rounded-lg border border-slate-100 divide-y divide-slate-50 mb-2 overflow-hidden'
            : 'rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-50'
        }>
            {pool_visible != null && (() => {
                const aus   = pool_direction && ['N', 'NE'].includes(pool_direction);
                const inaus = pool_direction && ['SW', 'S'].includes(pool_direction);
                const label = !pool_visible
                    ? 'No pool or water feature visible on the lot'
                    : aus   ? `Pool is on the ${dirLabel(pool_direction)} side — favorable placement`
                    : inaus ? `Pool is on the ${dirLabel(pool_direction)} side — less favorable placement`
                    :         `Pool is on the ${dirLabel(pool_direction)} side`;
                return (
                    <div className={rowCls}>
                        <i className={`fa-water text-blue-400 ${iconCls}`} />
                        <span className={textCls}>{label}</span>
                        <span className={badgeCls}>{!pool_visible ? '—' : aus ? '✅' : inaus ? '⚠️' : '◎'}</span>
                    </div>
                );
            })()}

            {garage_direction && (() => {
                const aus   = ['N', 'NW', 'W'].includes(garage_direction);
                const inaus = ['NE', 'SW'].includes(garage_direction);
                const label = aus   ? `Garage opens toward the ${dirLabel(garage_direction)} — good placement`
                            : inaus ? `Garage opens toward the ${dirLabel(garage_direction)} — avoid this direction if possible`
                            :         `Garage opens toward the ${dirLabel(garage_direction)}`;
                return (
                    <div className={rowCls}>
                        <i className={`fa-car-garage text-slate-400 ${iconCls}`} />
                        <span className={textCls}>{label}</span>
                        <span className={badgeCls}>{aus ? '✅' : inaus ? '⚠️' : '◎'}</span>
                    </div>
                );
            })()}

            {open_sky_direction && (() => {
                const aus   = ['N', 'NE', 'E'].includes(open_sky_direction);
                const inaus = ['SW', 'S'].includes(open_sky_direction);
                const label = aus   ? `Main outdoor space opens to the ${dirLabel(open_sky_direction)} — good for light and ventilation`
                            : inaus ? `Main outdoor space opens to the ${dirLabel(open_sky_direction)} — gets more afternoon heat`
                            :         `Main outdoor space opens to the ${dirLabel(open_sky_direction)}`;
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
    pool_visible, pool_direction, garage_direction, open_sky_direction
}) => {
    const vastu = computeVastu(azimuth_degrees);
    if (!vastu) return null;

    // ── Compact badge (overview page) ─────────────────────────────────────────
    if (compact) {
        return (
            <>
                <div className={`rounded-lg border mb-2 ${vastu.scoreBg}`}>
                    <div className="flex items-center justify-between px-2.5 py-1.5">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vastu</span>
                            <span className="text-[11px] font-black text-slate-700">{vastu.entranceZone.name}</span>
                            <span className="text-[10px] text-slate-400">{vastu.entranceZone.deity}</span>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${vastu.scoreBg} ${vastu.scoreColor}`}>
                            {vastu.scoreLabel}
                        </span>
                    </div>
                    <p className={`px-2.5 pb-2 text-[10px] leading-relaxed ${vastu.scoreColor} opacity-90`}>
                        {vastu.verdict}
                    </p>
                </div>
                <SiteFeatureRows
                    compact
                    pool_visible={pool_visible}
                    pool_direction={pool_direction}
                    garage_direction={garage_direction}
                    open_sky_direction={open_sky_direction}
                />
            </>
        );
    }

    // ── Full card (Exterior tab) ──────────────────────────────────────────────
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${
                vastu.auspiciousness === 'Auspicious'   ? 'bg-emerald-50 border-emerald-100' :
                vastu.auspiciousness === 'Inauspicious' ? 'bg-red-50 border-red-100' :
                'bg-amber-50 border-amber-100'
            }`}>
                <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Vastu Shastra</div>
                    <div className="text-sm font-black text-slate-800">
                        {final_orientation ?? azimuthToLabel(vastu.azimuth)} Facing
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
                    <p className="text-[11px] leading-relaxed text-slate-600">{vastu.verdict}</p>
                    {/* Zone + Azimuth inline */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
                        <div>
                            <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] mr-1">Zone</span>
                            <span className="font-black text-slate-700">{vastu.entranceZone.name}</span>
                            <span className="text-slate-400 ml-1">{vastu.entranceZone.deity}</span>
                        </div>
                        <div>
                            <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] mr-1">Az</span>
                            <span className="font-black text-slate-700">{Math.round(vastu.azimuth)}°</span>
                            <span className="text-slate-400 ml-1">{azimuthToLabel(vastu.azimuth)}</span>
                        </div>
                    </div>
                    {/* Back / sides compact row */}
                    <div className="flex gap-4 pt-1 border-t border-slate-100 text-[10px]">
                        {[
                            { label: 'Back',  az: vastu.backAzimuth },
                            { label: 'Right', az: vastu.rightAzimuth },
                            { label: 'Left',  az: vastu.leftAzimuth },
                        ].map(({ label, az }) => (
                            <div key={label}>
                                <span className="text-slate-400 mr-1">{label}</span>
                                <span className="font-black text-slate-600">{azimuthToLabel(az).split(' ')[0]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tier 2: Site Features */}
            {(pool_visible != null || garage_direction || open_sky_direction) && (
                <div className="px-3 pb-2">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Site Features (Aerial)</div>
                    <SiteFeatureRows
                        pool_visible={pool_visible}
                        pool_direction={pool_direction}
                        garage_direction={garage_direction}
                        open_sky_direction={open_sky_direction}
                    />
                    <div className="text-[9px] text-slate-400 mt-1">Detected from aerial satellite · directions are compass absolute</div>
                </div>
            )}

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
        </div>
    );
};

export default VastuCard;
