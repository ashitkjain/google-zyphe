import React, { useMemo, useState } from 'react';
import SunCalc from 'suncalc';

interface Props {
    lat: number;
    lng: number;
    orientation?: string; // e.g. "South", "East", from orientation_ai
}

// Key dates for solstices & equinoxes (2025 — SunCalc works for any year)
const DATES = [
    { label: 'Winter Solstice', month: 11, day: 21, icon: 'fa-snowflake', color: 'blue' },
    { label: 'Spring Equinox', month: 2, day: 20, icon: 'fa-seedling', color: 'emerald' },
    { label: 'Summer Solstice', month: 5, day: 21, icon: 'fa-sun', color: 'amber' },
    { label: 'Fall Equinox', month: 8, day: 22, icon: 'fa-leaf', color: 'orange' },
];

function computeSunData(lat: number, lng: number, month: number, day: number) {
    const date = new Date(2025, month, day, 12, 0, 0);
    const times = SunCalc.getTimes(date, lat, lng);
    const noonPos = SunCalc.getPosition(date, lat, lng);

    // Sun altitude at solar noon (degrees)
    const noonAltDeg = noonPos.altitude * (180 / Math.PI);

    // Compute sunrise & sunset azimuth for direction context
    const sunrisePos = SunCalc.getPosition(times.sunrise, lat, lng);
    const sunsetPos = SunCalc.getPosition(times.sunset, lat, lng);
    const sunriseAz = ((sunrisePos.azimuth * 180 / Math.PI) + 180) % 360;
    const sunsetAz = ((sunsetPos.azimuth * 180 / Math.PI) + 180) % 360;

    // Daylight hours
    const daylightMs = times.sunset.getTime() - times.sunrise.getTime();
    const daylightHrs = daylightMs / (1000 * 60 * 60);

    // Golden hour window
    const goldenEnd = times.goldenHourEnd;
    const goldenStart = times.goldenHour;

    // Shadow multiplier at noon (ratio of shadow length to object height)
    // shadow = height / tan(altitude)
    const shadowMultiplier = noonAltDeg > 0 ? 1 / Math.tan(noonAltDeg * Math.PI / 180) : Infinity;

    // Hourly altitude data for the mini sun-path chart
    const hourlyAlt: { hour: number; alt: number }[] = [];
    for (let h = 5; h <= 21; h++) {
        const t = new Date(2025, month, day, h, 0, 0);
        const pos = SunCalc.getPosition(t, lat, lng);
        hourlyAlt.push({ hour: h, alt: Math.max(0, pos.altitude * 180 / Math.PI) });
    }

    return {
        sunrise: times.sunrise,
        sunset: times.sunset,
        noonAltDeg,
        daylightHrs,
        shadowMultiplier,
        sunriseAz,
        sunsetAz,
        goldenEnd,
        goldenStart,
        hourlyAlt,
    };
}

function formatTime(d: Date) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function azToDirection(az: number) {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(az / 22.5) % 16];
}

function generateInsight(
    winter: ReturnType<typeof computeSunData>,
    summer: ReturnType<typeof computeSunData>,
    orientation?: string,
): string {
    const winterDaylight = winter.daylightHrs.toFixed(1);
    const summerDaylight = summer.daylightHrs.toFixed(1);
    const diff = (summer.daylightHrs - winter.daylightHrs).toFixed(1);

    let orientationNote = '';
    if (orientation) {
        const dir = orientation.toUpperCase();
        if (dir.includes('SOUTH')) {
            orientationNote = ' The south-facing front gets maximum direct sunlight year-round — ideal for warmth in winter and solar panels.';
        } else if (dir.includes('NORTH')) {
            orientationNote = ' The north-facing front stays cooler with diffused light — great for reducing AC load in summer.';
        } else if (dir.includes('EAST')) {
            orientationNote = ' The east-facing front gets bright morning sun, perfect for breakfast rooms and a gentle wake-up.';
        } else if (dir.includes('WEST')) {
            orientationNote = ' The west-facing front gets intense afternoon sun — stunning sunsets, but consider window treatments for heat.';
        }
    }

    if (winter.noonAltDeg < 25) {
        return `This latitude swings ${diff} hrs of daylight between seasons (${winterDaylight}h winter → ${summerDaylight}h summer). In winter, the sun stays low (${winter.noonAltDeg.toFixed(0)}° at noon), casting long shadows — nearby trees or fences may shade the yard.${orientationNote}`;
    }
    return `Daylight ranges from ${winterDaylight}h in winter to ${summerDaylight}h in summer (${diff}h swing). The winter noon sun hits ${winter.noonAltDeg.toFixed(0)}°, keeping most patios well-lit even in the short days.${orientationNote}`;
}

const SeasonalSunCard: React.FC<Props> = ({ lat, lng, orientation }) => {
    const [selectedIdx, setSelectedIdx] = useState(2); // Start on Summer Solstice

    const allData = useMemo(() => DATES.map(d => computeSunData(lat, lng, d.month, d.day)), [lat, lng]);
    const current = allData[selectedIdx];
    const currentDate = DATES[selectedIdx];

    const insight = useMemo(
        () => generateInsight(allData[0], allData[2], orientation),
        [allData, orientation]
    );

    const maxAlt = Math.max(...current.hourlyAlt.map(h => h.alt), 1);

    return (
        <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
            <div className="p-4">
                {/* Header */}
                <div className="flex items-center gap-2 mb-3 px-1">
                    <i className="fa-solid fa-sun text-amber-500 text-[13px]" />
                    <span className="text-[12px] font-black text-slate-800 uppercase tracking-widest">Seasonal Sun Path</span>
                </div>

                {/* Season selector pills */}
                <div className="flex gap-1 mb-3">
                    {DATES.map((d, i) => {
                        const isActive = i === selectedIdx;
                        const bgMap: Record<string, string> = {
                            blue: isActive ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-200',
                            emerald: isActive ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-200',
                            amber: isActive ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-200',
                            orange: isActive ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-slate-500 border-slate-200 hover:border-orange-200',
                        };
                        return (
                            <button
                                key={i}
                                onClick={() => setSelectedIdx(i)}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${bgMap[d.color]}`}
                            >
                                <i className={`fa-solid ${d.icon} text-[8px]`}></i>
                                {d.label.split(' ')[0]}
                            </button>
                        );
                    })}
                </div>

                {/* Mini sun arc chart */}
                <div className="bg-white rounded-lg border border-slate-100 p-2.5 mb-3">
                    <div className="relative h-16">
                        {/* Y-axis label */}
                        <div className="absolute left-0 top-0 text-[8px] font-bold text-slate-300 uppercase">{maxAlt.toFixed(0)}°</div>
                        <div className="absolute left-0 bottom-0 text-[8px] font-bold text-slate-300">0°</div>
                        {/* Chart area */}
                        <svg className="w-full h-full" viewBox="0 0 170 60" preserveAspectRatio="none">
                            {/* Gradient fill under curve */}
                            <defs>
                                <linearGradient id={`sunGrad-${selectedIdx}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={currentDate.color === 'amber' ? '#f59e0b' : currentDate.color === 'blue' ? '#3b82f6' : currentDate.color === 'emerald' ? '#10b981' : '#f97316'} stopOpacity="0.3" />
                                    <stop offset="100%" stopColor={currentDate.color === 'amber' ? '#f59e0b' : currentDate.color === 'blue' ? '#3b82f6' : currentDate.color === 'emerald' ? '#10b981' : '#f97316'} stopOpacity="0.02" />
                                </linearGradient>
                            </defs>
                            {/* Fill area */}
                            <path
                                d={`M ${current.hourlyAlt.map((h, i) => `${(i / (current.hourlyAlt.length - 1)) * 170},${60 - (h.alt / maxAlt) * 55}`).join(' L ')} L 170,60 L 0,60 Z`}
                                fill={`url(#sunGrad-${selectedIdx})`}
                            />
                            {/* Line */}
                            <polyline
                                points={current.hourlyAlt.map((h, i) => `${(i / (current.hourlyAlt.length - 1)) * 170},${60 - (h.alt / maxAlt) * 55}`).join(' ')}
                                fill="none"
                                stroke={currentDate.color === 'amber' ? '#f59e0b' : currentDate.color === 'blue' ? '#3b82f6' : currentDate.color === 'emerald' ? '#10b981' : '#f97316'}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            {/* Peak dot */}
                            {(() => {
                                const peakIdx = current.hourlyAlt.reduce((pi, h, i, arr) => h.alt > arr[pi].alt ? i : pi, 0);
                                const x = (peakIdx / (current.hourlyAlt.length - 1)) * 170;
                                const y = 60 - (current.hourlyAlt[peakIdx].alt / maxAlt) * 55;
                                return <circle cx={x} cy={y} r="3.5" fill={currentDate.color === 'amber' ? '#f59e0b' : currentDate.color === 'blue' ? '#3b82f6' : currentDate.color === 'emerald' ? '#10b981' : '#f97316'} stroke="white" strokeWidth="2" />;
                            })()}
                        </svg>
                    </div>
                    {/* Time axis labels */}
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 mt-1 px-1">
                        <span>5am</span>
                        <span>9am</span>
                        <span>1pm</span>
                        <span>5pm</span>
                        <span>9pm</span>
                    </div>
                </div>

                {/* Key stats grid */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                        <i className="fa-solid fa-sunrise text-[12px] text-amber-500"></i>
                        <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sunrise</div>
                            <div className="text-[16px] font-black text-slate-800 leading-tight">
                                {formatTime(current.sunrise)}
                                <span className="text-[10px] font-bold text-slate-400 ml-1.5">{azToDirection(current.sunriseAz)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                        <i className="fa-solid fa-sunset text-[12px] text-orange-500"></i>
                        <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sunset</div>
                            <div className="text-[16px] font-black text-slate-800 leading-tight">
                                {formatTime(current.sunset)}
                                <span className="text-[10px] font-bold text-slate-400 ml-1.5">{azToDirection(current.sunsetAz)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                        <i className="fa-solid fa-clock text-[12px] text-blue-500"></i>
                        <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Daylight</div>
                            <div className="text-[16px] font-black text-blue-600 leading-tight">{current.daylightHrs.toFixed(1)} hrs</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                        <i className="fa-solid fa-arrows-up-to-line text-[12px] text-indigo-500"></i>
                        <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Noon Alt.</div>
                            <div className="text-[16px] font-black text-indigo-600 leading-tight">{current.noonAltDeg.toFixed(1)}°</div>
                        </div>
                    </div>
                </div>


                {/* Insight */}
                <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100/50">
                    <div className="flex items-start gap-2.5">
                        <i className="fa-solid fa-lightbulb text-indigo-400 text-[12px] mt-0.5 flex-shrink-0"></i>
                        <p className="text-[12px] text-slate-600 leading-relaxed italic">
                            "{insight}"
                        </p>
                    </div>
                </div>
            </div>
            <div className="text-[9px] text-slate-400 font-bold uppercase text-right px-4 pb-2 tracking-widest">SunCalc Data Engine</div>
        </div>
    );
};

export default SeasonalSunCard;
