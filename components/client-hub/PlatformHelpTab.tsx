import React, { useState, useCallback } from 'react';
import {
    SCHEMA_LAST_UPDATED,
    FieldSource,
    SchemaField,
    CollectionSchema,
    propertyCollections,
    cityCollections,
    crmCollections,
    opsCollections,
} from '../../docs/schemaDefinitions';

// ── Schema rendering components ───────────────────────────────────────────────

const SOURCE_COLORS: Record<FieldSource, string> = {
    zillow: 'bg-blue-50 border-blue-200 text-blue-700',
    reso: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    gemini: 'bg-violet-50 border-violet-200 text-violet-700',
    arcgis: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    google: 'bg-amber-50 border-amber-200 text-amber-700',
    radar: 'bg-sky-50 border-sky-200 text-sky-700',
    manual: 'bg-slate-50 border-slate-200 text-slate-600',
    system: 'bg-rose-50 border-rose-200 text-rose-700',
    firebase: 'bg-orange-50 border-orange-200 text-orange-700',
};
const SOURCE_LABELS: Record<FieldSource, string> = {
    zillow: 'Zillow', reso: 'RESO MLS', gemini: 'Gemini AI', arcgis: 'ArcGIS',
    google: 'Google API', radar: 'Radar API', manual: 'Manual', system: 'System', firebase: 'Firebase',
};

const TypeBadge: React.FC<{ type: string }> = ({ type }) => (
    <span className="font-mono text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md">{type}</span>
);

const SourceBadge: React.FC<{ source: FieldSource }> = ({ source }) => (
    <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${SOURCE_COLORS[source]}`}>
        {SOURCE_LABELS[source]}
    </span>
);

const SchemaFieldRow: React.FC<{ field: SchemaField; depth?: number; isLast?: boolean }> = ({ field, depth = 0, isLast = false }) => {
    const [open, setOpen] = useState(false);
    const hasChildren = field.children && field.children.length > 0;
    return (
        <div>
            <div
                className={`flex items-start gap-3 py-2 px-3 rounded-xl hover:bg-slate-50 transition-colors group ${hasChildren ? 'cursor-pointer' : ''}`}
                style={{ paddingLeft: `${12 + depth * 20}px` }}
                onClick={() => hasChildren && setOpen(o => !o)}
            >
                <span className="font-mono text-slate-300 text-[11px] select-none shrink-0 mt-0.5">
                    {isLast ? '└──' : '├──'}
                </span>
                <span className={`font-mono text-[11px] font-bold shrink-0 ${hasChildren ? 'text-slate-800' : 'text-indigo-700'}`}>
                    {field.name}
                </span>
                <TypeBadge type={field.type} />
                {hasChildren && (
                    <i className={`fa-solid fa-chevron-${open ? 'down' : 'right'} text-[8px] text-slate-300 mt-1 shrink-0`}></i>
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-slate-500 leading-relaxed">{field.description}</p>
                    {field.usedBy && (
                        <p className="text-[10px] text-slate-400 mt-0.5"><span className="font-bold">Used by:</span> {field.usedBy}</p>
                    )}
                </div>
                <SourceBadge source={field.source} />
            </div>
            {hasChildren && open && (
                <div className="animate-in fade-in duration-150">
                    {field.children!.map((child, i) => (
                        <SchemaFieldRow key={child.name} field={child} depth={depth + 1} isLast={i === field.children!.length - 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

const CollectionBlock: React.FC<{ col: CollectionSchema }> = ({ col }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="bg-white rounded-[1.5rem] border border-slate-200 overflow-hidden shadow-sm">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors text-left"
            >
                <div className={`w-9 h-9 rounded-xl ${col.color} flex items-center justify-center shrink-0`}>
                    <i className={`fa-solid ${col.icon} text-sm`}></i>
                </div>
                <div className="flex-1 min-w-0">
                    <span className="font-mono text-sm font-black text-slate-900">{col.name}</span>
                    <span className="text-[10px] text-slate-400 ml-3">doc id: <span className="font-mono text-slate-500">{col.docId}</span></span>
                    <p className="text-[11px] text-slate-500 mt-0.5">{col.description}</p>
                </div>
                <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} text-slate-300 text-[10px] shrink-0`}></i>
            </button>
            {open && (
                <div className="border-t border-slate-100 px-3 py-3 space-y-0.5 animate-in fade-in duration-200">
                    <div className="px-3 py-1">
                        <span className="font-mono text-[10px] text-slate-400">
                            {col.name}/<span className="text-slate-300">{'{'}doc{'}'}</span>/
                        </span>
                    </div>
                    {col.fields.map((f, i) => (
                        <SchemaFieldRow key={f.name} field={f} isLast={i === col.fields.length - 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

/** Header block shown at top of every schema tier topic. */
const SchemaPageHeader: React.FC<{
    icon: string;
    iconBg: string;
    title: string;
    subtitle: string;
    onRefresh: () => void;
    refreshing: boolean;
}> = ({ icon, iconBg, title, subtitle, onRefresh, refreshing }) => (
    <div className="flex items-start gap-4 mb-8">
        <div className={`w-16 h-16 rounded-[2rem] ${iconBg} flex items-center justify-center text-3xl shadow-xl shrink-0`}>
            <i className={`fa-solid ${icon}`}></i>
        </div>
        <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-black text-slate-900 mb-0.5">{title}</h1>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">{subtitle}</p>
        </div>
        {/* Refresh control */}
        <div className="flex flex-col items-end gap-1 shrink-0">
            <button
                id="schema-refresh-btn"
                onClick={onRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 transition-all text-[11px] font-bold disabled:opacity-50"
                title="Refresh schema view"
            >
                <i className={`fa-solid fa-rotate-right text-[10px] ${refreshing ? 'animate-spin' : ''}`}></i>
                {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <span className="text-[9px] text-slate-400 font-mono">
                Last updated: <span className="text-slate-600 font-bold">{SCHEMA_LAST_UPDATED}</span>
                <span className="ml-1 text-slate-300">· docs/schemaDefinitions.ts</span>
            </span>
        </div>
    </div>
);

/** Source-badge legend row */
const SourceLegend: React.FC = () => (
    <div className="flex flex-wrap gap-2 mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 self-center mr-2">Sources:</span>
        {(Object.keys(SOURCE_LABELS) as FieldSource[]).map(s => <SourceBadge key={s} source={s} />)}
    </div>
);


interface HelpTopic {
    id: string;
    title: string;
    icon: string;
    content: React.ReactNode;
}

interface HelpCategory {
    id: string;
    title: string;
    icon: string;
    topics: HelpTopic[];
}

const PlatformHelpTab: React.FC = () => {
    const [activeCategoryId, setActiveCategoryId] = useState('messaging');
    const [activeTopicId, setActiveTopicId] = useState('sms_registration');
    const [schemaRefreshKey, setSchemaRefreshKey] = useState(0);
    const [schemaRefreshing, setSchemaRefreshing] = useState(false);

    const handleSchemaRefresh = useCallback(() => {
        setSchemaRefreshing(true);
        setTimeout(() => {
            setSchemaRefreshKey(k => k + 1);
            setSchemaRefreshing(false);
        }, 400);
    }, []);

    const categories: HelpCategory[] = [
        {
            id: 'getting_started',
            title: 'Getting Started',
            icon: 'fa-flag-checkered',
            topics: [
                { id: 'onboarding', title: 'Account Onboarding', icon: 'fa-user-plus', content: <div className="prose prose-slate"><h2>Account Onboarding</h2><p>Welcome to Zyphe! This guide will help you set up your professional profile and sync your first set of leads.</p></div> }
            ]
        },
        {
            id: 'messaging',
            title: 'Messaging & SMS',
            icon: 'fa-comment-dots',
            topics: [
                {
                    id: 'sms_registration',
                    title: 'SMS Registration (10DLC)',
                    icon: 'fa-comment-sms',
                    content: (
                        <div className="prose prose-slate max-w-none">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-16 h-16 rounded-[2rem] bg-indigo-600 text-white flex items-center justify-center text-3xl shadow-xl shadow-indigo-100">
                                    <i className="fa-solid fa-comment-sms"></i>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 mb-1">SMS Registration Guide</h1>
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">A2P 10DLC Compliance</p>
                                </div>
                            </div>

                            <section className="bg-indigo-50/50 rounded-[2.5rem] p-10 border border-indigo-100 mb-12">
                                <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-3">
                                    <i className="fa-solid fa-shield-halved text-indigo-500"></i>
                                    Why is registration required?
                                </h2>
                                <p className="text-slate-600 font-medium leading-relaxed">
                                    US mobile carriers (Verizon, AT&T, T-Mobile) now require all businesses to register their messaging traffic.
                                    By registering your business brand, you ensure that your messages are not flagged as spam and reach your clients instantly.
                                    This process is known as <strong>10DLC (10-Digit Long Code) Registration</strong>.
                                </p>
                            </section>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                                <div className="space-y-6">
                                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">1</div>
                                        Brand Identity
                                    </h3>
                                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                        You'll need to provide your <strong>Legal Business Name</strong> and <strong>Tax ID (EIN)</strong>.
                                        This verifies that you are a legitimate business entity. If you act as an individual, you can register as a sole proprietor using your SSN.
                                    </p>
                                </div>
                                <div className="space-y-6">
                                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">2</div>
                                        Campaign Usage
                                    </h3>
                                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                        Select how you plan to use SMS. For most realtors, the <strong>"Agents & Franchises"</strong> use case is appropriate.
                                        You will need to provide sample messages like viewing confirmations or inspection updates.
                                    </p>
                                </div>
                            </div>

                            <section className="bg-slate-900 rounded-[2.5rem] p-10 text-white mb-12 shadow-2xl overflow-hidden relative group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl"></div>
                                <h3 className="text-xl font-black mb-6 relative z-10">The Approval Process</h3>
                                <div className="space-y-6 relative z-10">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                            <i className="fa-solid fa-paper-plane text-indigo-400"></i>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm mb-1">Instant Submission</div>
                                            <div className="text-slate-400 text-xs leading-relaxed">Your application is sent immediately once you complete the wizard in <strong>Realtor Tools</strong>.</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                            <i className="fa-solid fa-clock text-indigo-400"></i>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm mb-1">Carrier Review (3-7 Days)</div>
                                            <div className="text-slate-400 text-xs leading-relaxed">Mobile networks manually review your samples to ensure compliance with anti-spam rules.</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                            <i className="fa-solid fa-check-circle text-emerald-400"></i>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm mb-1">Active Status</div>
                                            <div className="text-slate-400 text-xs leading-relaxed">Once approved, your messages will have the highest possible delivery priority.</div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <div className="bg-amber-50 rounded-3xl p-8 border border-amber-100 flex items-start gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl shadow-lg shrink-0">
                                    <i className="fa-solid fa-lightbulb"></i>
                                </div>
                                <div>
                                    <h4 className="text-amber-900 font-black text-lg mb-2">Pro Tip</h4>
                                    <p className="text-amber-800 text-sm font-medium leading-relaxed">
                                        Ensure your website URL is valid and clearly mentions your business name.
                                        Carriers will check your website to verify that you have proper "Opt-in" language for clients.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'data_intelligence',
            title: 'Data & Intelligence',
            icon: 'fa-microchip',
            topics: [
                {
                    id: 'solar_estimation',
                    title: 'Solar Production Methodology',
                    icon: 'fa-solar-panel',
                    content: (
                        <div className="prose prose-slate max-w-none">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-16 h-16 rounded-[2rem] bg-indigo-600 text-white flex items-center justify-center text-3xl shadow-xl shadow-indigo-100">
                                    <i className="fa-solid fa-solar-panel"></i>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 mb-1">Solar Estimation Methodology</h1>
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Technical Attribution Guide</p>
                                </div>
                            </div>

                            <section className="bg-slate-50 rounded-[2.5rem] p-10 border border-slate-100 mb-12">
                                <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-3">
                                    <i className="fa-solid fa-satellite text-indigo-500 text-sm"></i>
                                    How it works
                                </h2>
                                <p className="text-slate-600 font-medium leading-relaxed">
                                    Zyphe leverages the <strong>Google Solar API</strong> to analyze high-resolution satellite imagery down to the individual panel level.
                                    Unlike traditional estimates that use simple roof area, our engine analyzes the specific <strong>yearly energy production potential</strong> of every potential panel location on your roof, accounting for tilt, orientation, and complex shading (trees, chimneys, neighbors).
                                </p>
                            </section>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                                <div className="bg-indigo-50/30 p-6 rounded-3xl border border-indigo-100/50">
                                    <div className="text-indigo-600 font-black text-[10px] uppercase tracking-widest mb-2">Panel-Level Resolution</div>
                                    <div className="text-2xl font-black text-indigo-900 mb-1">High</div>
                                    <div className="text-slate-500 text-[11px] font-medium">Production is calculated per-panel using sub-meter sun shadow data.</div>
                                </div>
                                <div className="bg-indigo-50/30 p-6 rounded-3xl border border-indigo-100/50">
                                    <div className="text-indigo-600 font-black text-[10px] uppercase tracking-widest mb-2">Standard Efficiency</div>
                                    <div className="text-2xl font-black text-indigo-900 mb-1">85%</div>
                                    <div className="text-slate-500 text-[11px] font-medium">Combined DC to AC conversion and standard wiring loss factor.</div>
                                </div>
                                <div className="bg-indigo-50/30 p-6 rounded-3xl border border-indigo-100/50">
                                    <div className="text-indigo-600 font-black text-[10px] uppercase tracking-widest mb-2">Panel Capacity</div>
                                    <div className="text-2xl font-black text-indigo-900 mb-1">400W</div>
                                    <div className="text-slate-500 text-[11px] font-medium">Baseline capacity for a standard 1.7m² residential solar panel.</div>
                                </div>
                            </div>

                            <h3 className="text-xl font-black text-slate-800 mb-8 border-l-4 border-indigo-600 pl-6">Step-by-Step Walkthrough</h3>
                            <div className="space-y-12 mb-12">
                                <section>
                                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-8 flex items-center gap-4">
                                        <i className="fa-solid fa-circle-exclamation text-amber-500 text-sm"></i>
                                        <p className="text-amber-900 text-[10px] font-bold leading-relaxed mb-0 uppercase tracking-tight">
                                            Illustrative Example: The following calculations use data from a sample property to demonstrate the methodology.
                                        </p>
                                    </div>
                                    <p className="text-slate-600 font-medium leading-relaxed mb-6">
                                        To estimate the annual energy production for a property, we combine the roof's physical data with the solar irradiance values from high-resolution satellite analysis.
                                        Based on a standard 15% to 20% system efficiency, here is the breakdown:
                                    </p>

                                    <div className="space-y-8">
                                        <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                            <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                                                <span className="text-indigo-600">1.</span> Identify Panel Locations
                                            </h4>
                                            <p className="text-slate-500 text-sm leading-relaxed mb-4">
                                                The API identifies every feasible 1.7m² spot on the roof. It excludes areas blocked by fire codes, vents, or excessive shade.
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                    <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Roof Area</div>
                                                    <div className="text-lg font-black text-slate-800">~290 m²</div>
                                                </div>
                                                <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-100">
                                                    <div className="text-[10px] font-black text-white/60 uppercase mb-1">Usable Panel Spots</div>
                                                    <div className="text-lg font-black text-white">103 Panels</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                            <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                                                <span className="text-indigo-600">2.</span> Calculate Solar Capacity (kW)
                                            </h4>
                                            <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                                A standard solar panel (approx. 1.7 m²) produces about 400W (0.4 kW).
                                            </p>
                                            <div className="space-y-4">
                                                <div className="flex flex-col md:flex-row md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 italic font-medium text-slate-700">
                                                    <div className="flex-1">
                                                        Total Panels ≈ 176 m² / 1.7 m² per panel ≈ <span className="text-indigo-600 font-black">103 panels</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col md:flex-row md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 italic font-medium text-slate-700">
                                                    <div className="flex-1">
                                                        System Capacity ≈ 103 × 0.4 kW ≈ <span className="text-indigo-600 font-black">41.2 kW</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                            <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                                                <span className="text-indigo-600">3.</span> Annual Energy Production (kWh)
                                            </h4>
                                            <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                                We sum the <code>yearlyEnergyDcKwh</code> of each individual panel and apply a 0.85 efficiency factor to account for DC-to-AC conversion losses.
                                            </p>
                                            <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm overflow-x-auto">
                                                <div className="font-black text-indigo-900 text-sm mb-4 uppercase tracking-widest text-center opacity-40">The Formula</div>
                                                <div className="text-center text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                                                    Σ (Individual Panel DC kWh) × 0.85
                                                </div>
                                                <div className="h-px bg-slate-100 my-4"></div>
                                                <div className="text-center text-2xl font-black text-indigo-600">
                                                    72,941 DC kWh × 0.85 ≈ <span className="text-indigo-950">62,000 kWh/year</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <section className="bg-emerald-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden mb-12">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full translate-x-1/4 -translate-y-1/4 blur-3xl"></div>
                                <h3 className="text-xl font-black mb-6 relative z-10">Impact Summary</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-sm">
                                                <i className="fa-solid fa-leaf"></i>
                                            </div>
                                            <div className="font-bold text-lg">Carbon Saved</div>
                                        </div>
                                        <p className="text-emerald-100 text-xs leading-relaxed">
                                            Producing 62 MWh per year would offset approximately <span className="text-white font-black italic">26,593 kg of CO₂</span> annually.
                                        </p>
                                    </div>
                                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-sm">
                                                <i className="fa-solid fa-magnifying-glass-chart"></i>
                                            </div>
                                            <div className="font-bold text-lg">Roof Insights</div>
                                        </div>
                                        <p className="text-indigo-100 text-xs leading-relaxed">
                                            A wide gap between sunshine quantiles suggests significant shading or varied orientations (e.g., North vs South facing slopes).
                                        </p>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )
                },
                {
                    id: 'context_graph',
                    title: 'Context Graph',
                    icon: 'fa-diagram-project',
                    content: (
                        <div className="prose prose-slate max-w-none">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-16 h-16 rounded-[2rem] bg-violet-600 text-white flex items-center justify-center text-3xl shadow-xl shadow-violet-100">
                                    <i className="fa-solid fa-diagram-project"></i>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 mb-1">Context Graph</h1>
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">75 Decision Factors · Hybrid Extraction</p>
                                </div>
                            </div>

                            <section className="bg-violet-50/50 rounded-[2.5rem] p-10 border border-violet-100 mb-12">
                                <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-3">
                                    <i className="fa-solid fa-brain text-violet-500 text-sm"></i>
                                    What is the Context Graph?
                                </h2>
                                <p className="text-slate-600 font-medium leading-relaxed mb-0">
                                    The Context Graph is a structured representation of <strong>75 buyer-relevant decision factors</strong> extracted from every property. It combines data from <strong>12+ APIs</strong>, <strong>AI-driven analysis</strong>, and <strong>computed heuristics</strong> into a standardized format that powers property comparison, search tags, and recommendation engines.
                                </p>
                            </section>

                            {/* Architecture */}
                            <section className="bg-slate-900 rounded-[2.5rem] p-10 text-white mb-12 shadow-2xl overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl"></div>
                                <h3 className="text-xl font-black mb-6 relative z-10">Hybrid Extraction Architecture</h3>
                                <div className="space-y-6 relative z-10">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                            <i className="fa-solid fa-microchip text-emerald-400"></i>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm mb-1">22 Pre-Computed Factors <span className="text-emerald-400 text-[10px] font-mono ml-2">zero AI tokens</span></div>
                                            <div className="text-slate-400 text-xs leading-relaxed">Extracted deterministically from structured property data — MLS fields, API responses, and computed formulas. These are guaranteed accurate and free.</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                            <i className="fa-solid fa-wand-magic-sparkles text-violet-400"></i>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm mb-1">53 AI-Extracted Factors <span className="text-violet-400 text-[10px] font-mono ml-2">Gemini 2.0 Flash</span></div>
                                            <div className="text-slate-400 text-xs leading-relaxed">Inferred by Gemini from visual analysis, descriptions, deep research, and community data. The AI prompt explicitly skips pre-computed IDs to avoid redundant work.</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                            <i className="fa-solid fa-code-merge text-amber-400"></i>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm mb-1">Merge & Override</div>
                                            <div className="text-slate-400 text-xs leading-relaxed">Pre-computed factors always take precedence over AI output. The merged result is sorted by factor ID for consistent ordering.</div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Factor Categories */}
                            <h3 className="text-xl font-black text-slate-800 mb-8 border-l-4 border-violet-600 pl-6">All 75 Decision Factors</h3>

                            {/* Financial & Market */}
                            <div className="mb-8">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                                        <i className="fa-solid fa-dollar-sign text-emerald-600 text-sm"></i>
                                    </div>
                                    <h4 className="text-lg font-black text-slate-800">Financial & Market (1–10)</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {[
                                        { id: 1, name: 'Price Bracket', source: 'MLS price / Zestimate', method: 'Pre-computed', how: 'Classified as Entry (<$800K), Mid ($800K–$1.5M), or Luxury (>$1.5M)' },
                                        { id: 2, name: 'HOA Friction', source: 'RESO feesAndDues', method: 'Pre-computed', how: 'Extracts monthly amount and flags High (>$500) vs Low' },
                                        { id: 3, name: 'Insurance Risk', source: 'Climate risk scores', method: 'AI', how: 'Flags if fireRiskScore ≥ 7 or high-risk zone mentioned' },
                                        { id: 4, name: 'True Carrying Cost', source: 'Price + tax + HOA + insurance', method: 'Pre-computed', how: 'Monthly mortgage (7%, 30yr) + taxes/12 + HOA + insurance/12' },
                                        { id: 5, name: 'Seller Motivation', source: 'Price history + DOM', method: 'Pre-computed', how: 'High if price cuts detected OR daysOnMarket > 90' },
                                        { id: 6, name: 'ADU / House-Hacking', source: 'Description + deep research', method: 'AI', how: 'Scans for "guest house", "basement", "ADU", "cottage"' },
                                        { id: 7, name: 'STR Viability', source: 'Investment analysis', method: 'Pre-computed', how: 'Combines zoning legality + occupancy rate + ADR' },
                                        { id: 8, name: 'Long-Term Rental Yield', source: 'Rent Zestimate + price', method: 'Pre-computed', how: '(rentZestimate × 12) / price as gross yield %' },
                                        { id: 9, name: 'Historical Appreciation', source: 'Deep research + market data', method: 'AI', how: 'YoY and 5-year price growth trends from macro indicators' },
                                        { id: 10, name: 'Listing Urgency', source: 'Description + price history', method: 'Pre-computed', how: 'Flags "Hot Home", "Multiple Offers", or back-on-market' },
                                    ].map(f => (
                                        <div key={f.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className={`w-6 h-6 rounded-lg ${f.method === 'Pre-computed' ? 'bg-emerald-100 text-emerald-600' : 'bg-violet-100 text-violet-600'} flex items-center justify-center text-[10px] font-black shrink-0`}>{f.id}</div>
                                            <div className="min-w-0">
                                                <div className="text-[12px] font-black text-slate-700 leading-tight">{f.name}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">{f.how}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${f.method === 'Pre-computed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-violet-50 text-violet-600 border border-violet-200'}`}>{f.method}</span>
                                                    <span className="text-[9px] text-slate-400">{f.source}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Structural & Size */}
                            <div className="mb-8">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                                        <i className="fa-solid fa-ruler-combined text-blue-600 text-sm"></i>
                                    </div>
                                    <h4 className="text-lg font-black text-slate-800">Structural & Size (11–20)</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {[
                                        { id: 11, name: 'Property Typology', source: 'homeType', method: 'Pre-computed', how: 'Maps Zillow type to Single Family, Condo, Townhouse, etc.' },
                                        { id: 12, name: 'Bedroom Count', source: 'bedrooms', method: 'Pre-computed', how: 'Direct extraction with BR tag' },
                                        { id: 13, name: 'Bathroom Ratio', source: 'bathrooms', method: 'Pre-computed', how: 'Splits into full + half bath count' },
                                        { id: 14, name: 'Usable Square Footage', source: 'livingAreaValue', method: 'Pre-computed', how: 'Classified as Compact (<1,500), Mid-Size, Spacious, or Estate' },
                                        { id: 15, name: 'Lot Size', source: 'lotSize', method: 'Pre-computed', how: 'Direct lot size string' },
                                        { id: 16, name: 'Single-Story Living', source: 'RESO + room highlights', method: 'AI', how: 'Checks for stairs, multi-floor room labels, or "Single Story"' },
                                        { id: 17, name: 'Dedicated Home Office', source: 'Room types + description', method: 'AI', how: 'Scans for Den, Office, Library, Study mentions' },
                                        { id: 18, name: 'Garage & Parking', source: 'RESO garageParkingCapacity', method: 'Pre-computed', how: 'Extracts numeric car count' },
                                        { id: 19, name: 'Foundation & Storage', source: 'RESO facts', method: 'AI', how: 'Identifies Basement, Crawl Space, or Slab' },
                                        { id: 20, name: 'Construction Era', source: 'yearBuilt', method: 'Pre-computed', how: 'Pre-War (<1945), Mid-Century, 80s-90s, 2000s, New Build (>2015)' },
                                    ].map(f => (
                                        <div key={f.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className={`w-6 h-6 rounded-lg ${f.method === 'Pre-computed' ? 'bg-emerald-100 text-emerald-600' : 'bg-violet-100 text-violet-600'} flex items-center justify-center text-[10px] font-black shrink-0`}>{f.id}</div>
                                            <div className="min-w-0">
                                                <div className="text-[12px] font-black text-slate-700 leading-tight">{f.name}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">{f.how}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${f.method === 'Pre-computed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-violet-50 text-violet-600 border border-violet-200'}`}>{f.method}</span>
                                                    <span className="text-[9px] text-slate-400">{f.source}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Interior Design & Visual */}
                            <div className="mb-8">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                                        <i className="fa-solid fa-paint-roller text-amber-600 text-sm"></i>
                                    </div>
                                    <h4 className="text-lg font-black text-slate-800">Interior Design & Visual (21–30)</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {[
                                        { id: 21, name: 'Move-In Readiness', how: 'Turn-key if renovated/new, Mint if well-maintained, Needs Work if fixer' },
                                        { id: 22, name: 'Renovation Upside', how: 'High if condition is cosmetic-only but structural era is good' },
                                        { id: 23, name: 'Architectural Style', how: 'Mediterranean, Craftsman, Modern — from visual AI or listing data' },
                                        { id: 24, name: 'Natural Light', how: 'Inferred from lighting description, skylights, large windows, south-facing' },
                                        { id: 25, name: 'Open-Concept Flow', how: 'Checks for "Open concept" or "Vaulted" in interior analysis' },
                                        { id: 26, name: 'Kitchen Profile', how: 'Caliber (Chef\'s / Standard) + materials (Quartz, Gas range, etc.)' },
                                        { id: 27, name: 'Bathroom Profile', how: 'Luxury level (Spa-like) + finishes (Tile, Soaking tub, etc.)' },
                                        { id: 28, name: 'Flooring Material', how: 'Direct from RESO flooring field (Hardwood, Tile, Carpet)' },
                                        { id: 29, name: 'Ceiling Volume', how: '"High/Vaulted" if mentioned in description or spatial flow analysis' },
                                        { id: 30, name: 'Interior Finishes', how: 'Wall colors, trim (crown molding), window treatments' },
                                    ].map(f => (
                                        <div key={f.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className={`w-6 h-6 rounded-lg ${f.id === 28 ? 'bg-emerald-100 text-emerald-600' : 'bg-violet-100 text-violet-600'} flex items-center justify-center text-[10px] font-black shrink-0`}>{f.id}</div>
                                            <div className="min-w-0">
                                                <div className="text-[12px] font-black text-slate-700 leading-tight">{f.name}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">{f.how}</div>
                                                <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${f.id === 28 ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-violet-50 text-violet-600 border border-violet-200'}`}>{f.id === 28 ? 'Pre-computed' : 'AI'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Outdoor & Lot */}
                            <div className="mb-8">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                                        <i className="fa-solid fa-tree text-green-600 text-sm"></i>
                                    </div>
                                    <h4 className="text-lg font-black text-slate-800">Outdoor & Lot (31–40)</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {[
                                        { id: 31, name: 'Fenced Yard', how: 'Checks RESO fencing field or backyard analysis' },
                                        { id: 32, name: 'Outdoor Entertainment', how: 'Pool, Spa, Patio, Deck, Outdoor Kitchen from exterior analysis' },
                                        { id: 33, name: 'Privacy Level', how: 'From Street View privacy rating or visual analysis' },
                                        { id: 34, name: 'Curb Appeal', how: 'From Street View curb appeal score (1-10)' },
                                        { id: 35, name: 'Topography', how: 'Flat vs Hillside from neighborhood analysis or description' },
                                        { id: 36, name: 'View Quality', how: 'Hills, City Lights, Water, or None' },
                                        { id: 37, name: 'Street Noise / Traffic', how: 'Quiet (cul-de-sac), Moderate (through), High (arterial)' },
                                        { id: 38, name: 'Visual Clutter', how: 'Overhead wires, messy neighbors from Street View analysis' },
                                        { id: 39, name: 'Usable Yard Space', how: '"Large Level Yard" vs "Steep" vs "Compact"' },
                                        { id: 40, name: 'Xeriscape / Low Maintenance', how: 'Drought-tolerant or synthetic turf mentioned' },
                                    ].map(f => (
                                        <div key={f.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="w-6 h-6 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center text-[10px] font-black shrink-0">{f.id}</div>
                                            <div className="min-w-0">
                                                <div className="text-[12px] font-black text-slate-700 leading-tight">{f.name}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">{f.how}</div>
                                                <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200">AI</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Location & Community */}
                            <div className="mb-8">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center">
                                        <i className="fa-solid fa-location-dot text-rose-600 text-sm"></i>
                                    </div>
                                    <h4 className="text-lg font-black text-slate-800">Location & Community (41–45)</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {[
                                        { id: 41, name: 'School Quality (Max)', method: 'Pre-computed', how: 'Highest rating from schools array (e.g., 9/10)' },
                                        { id: 42, name: 'Commute Convenience', method: 'AI', how: 'Proximity to highways or transit hubs from neighborhood' },
                                        { id: 43, name: 'Walkability', method: 'Pre-computed', how: 'Direct from Walk Score — "Walkable" if > 70' },
                                        { id: 44, name: 'Greenery Proximity', method: 'AI', how: '"Park adjacent" or "Near trails" from neighborhood' },
                                        { id: 45, name: 'Sidewalk Continuity', method: 'AI', how: 'From Street View family safety or pedestrian infra' },
                                    ].map(f => (
                                        <div key={f.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className={`w-6 h-6 rounded-lg ${f.method === 'Pre-computed' ? 'bg-emerald-100 text-emerald-600' : 'bg-violet-100 text-violet-600'} flex items-center justify-center text-[10px] font-black shrink-0`}>{f.id}</div>
                                            <div className="min-w-0">
                                                <div className="text-[12px] font-black text-slate-700 leading-tight">{f.name}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">{f.how}</div>
                                                <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${f.method === 'Pre-computed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-violet-50 text-violet-600 border border-violet-200'}`}>{f.method}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Advanced Intelligence */}
                            <div className="mb-8">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                                        <i className="fa-solid fa-flask text-indigo-600 text-sm"></i>
                                    </div>
                                    <h4 className="text-lg font-black text-slate-800">Advanced Intelligence (51–70)</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {[
                                        { id: 51, name: 'Vastu / Feng Shui', method: 'Pre-computed', how: 'Home orientation (N/S/E/W) from satellite analysis' },
                                        { id: 52, name: 'Asthma / Respiratory', method: 'Pre-computed', how: 'AQI index + category from Google Air Quality API' },
                                        { id: 53, name: 'Pollen Sensitivity', method: 'AI', how: 'Triggers like Oak, Grass from Google Pollen API analysis' },
                                        { id: 54, name: 'Family-Friendly', method: 'AI', how: 'Composite: Cul-de-sac + Sidewalks + Backyard + Good Schools' },
                                        { id: 55, name: 'Renewable Potential', method: 'Pre-computed', how: 'Solar kWh/yr from Google Solar API — High/Med/Low tier' },
                                        { id: 56, name: 'EV Readiness', method: 'AI', how: 'Looks for 240V, Level 2, or EV charger mentions' },
                                        { id: 57, name: 'Work-From-Home Score', method: 'AI', how: 'Dedicated office + Fiber/high-speed internet mentions' },
                                        { id: 58, name: 'Multi-Gen Utility', method: 'AI', how: 'Downstairs bed/bath or separate entry for in-laws' },
                                        { id: 59, name: 'Laundry Logistics', method: 'Pre-computed', how: 'Indoor/Separate Room vs Garage from RESO laundryFeatures' },
                                        { id: 60, name: 'Water / Air Systems', method: 'AI', how: 'Softeners, RO filters, or zoned HVAC mentioned' },
                                        { id: 61, name: 'Security Infra', method: 'AI', how: 'Gated, security system, or cameras from listing' },
                                        { id: 62, name: 'Digital Presentation', method: 'AI', how: 'Quality of staging and photos — "Hidden Gems" detection' },
                                        { id: 63, name: 'Solar ROI Obstructors', method: 'AI', how: 'Large trees or neighbors blocking roof sunshine' },
                                        { id: 64, name: 'Job Hub Connectivity', method: 'AI', how: 'Proximity to major corporate campuses (Google, Apple)' },
                                        { id: 65, name: 'Upcoming Dev Impact', method: 'AI', how: 'New construction, transit projects from deep research' },
                                        { id: 66, name: 'Soil / Geo Consistency', method: 'AI', how: 'Soil type or liquefaction risk from deep research' },
                                        { id: 67, name: 'Luxury Finish Level', method: 'AI', how: 'Crown molding, wide plank floors, designer fixtures' },
                                        { id: 68, name: 'Backyard Potential', method: 'AI', how: 'Room for ADU or pool if not already present' },
                                        { id: 69, name: 'Streetscape Aesthetic', method: 'AI', how: 'Underground vs overhead utilities from Street View' },
                                        { id: 70, name: 'Market Momentum', method: 'AI', how: 'Appreciating, cooling, or flat from deep research signals' },
                                    ].map(f => (
                                        <div key={f.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className={`w-6 h-6 rounded-lg ${f.method === 'Pre-computed' ? 'bg-emerald-100 text-emerald-600' : 'bg-violet-100 text-violet-600'} flex items-center justify-center text-[10px] font-black shrink-0`}>{f.id}</div>
                                            <div className="min-w-0">
                                                <div className="text-[12px] font-black text-slate-700 leading-tight">{f.name}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">{f.how}</div>
                                                <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${f.method === 'Pre-computed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-violet-50 text-violet-600 border border-violet-200'}`}>{f.method}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Community & Market Intelligence */}
                            <div className="mb-8">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center">
                                        <i className="fa-solid fa-users text-teal-600 text-sm"></i>
                                    </div>
                                    <h4 className="text-lg font-black text-slate-800">Community & Market Intelligence (71–75)</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {[
                                        { id: 71, name: 'Development Maturity', method: 'AI', how: 'Classifies as New Build, Established, Transitional, or Gentrifying' },
                                        { id: 72, name: 'Resident Complaints', method: 'AI', how: 'Top 1-2 recurring complaints from community pulse data' },
                                        { id: 73, name: 'Satisfaction Drivers', method: 'AI', how: 'Top 1-2 things residents love from community pulse data' },
                                        { id: 74, name: 'Perceived Safety', method: 'AI', how: 'Resident-reported safety sentiment — Very Safe to Concerns' },
                                        { id: 75, name: 'Market Velocity (DOM)', method: 'Pre-computed', how: 'Median DOM classified as Fast (<14d), Moderate (14-30), Slow (>30)' },
                                    ].map(f => (
                                        <div key={f.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className={`w-6 h-6 rounded-lg ${f.method === 'Pre-computed' ? 'bg-emerald-100 text-emerald-600' : 'bg-violet-100 text-violet-600'} flex items-center justify-center text-[10px] font-black shrink-0`}>{f.id}</div>
                                            <div className="min-w-0">
                                                <div className="text-[12px] font-black text-slate-700 leading-tight">{f.name}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">{f.how}</div>
                                                <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${f.method === 'Pre-computed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-violet-50 text-violet-600 border border-violet-200'}`}>{f.method}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Data Sources */}
                            <h3 className="text-xl font-black text-slate-800 mb-8 border-l-4 border-violet-600 pl-6">Data Sources</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
                                {[
                                    { icon: 'fa-house', label: 'Zillow / MLS', desc: 'Price, beds, baths, sqft, lot, year, description, schools, Walk Score', color: 'bg-blue-50 border-blue-100 text-blue-600' },
                                    { icon: 'fa-solar-panel', label: 'Google Solar API', desc: 'Panel-level production, sunshine hours, roof area, financial analysis', color: 'bg-yellow-50 border-yellow-100 text-yellow-600' },
                                    { icon: 'fa-wind', label: 'Google Air Quality', desc: 'AQI, pollutant concentrations, health recommendations', color: 'bg-emerald-50 border-emerald-100 text-emerald-600' },
                                    { icon: 'fa-seedling', label: 'Google Pollen API', desc: 'Pollen types, severity, seasonal triggers', color: 'bg-green-50 border-green-100 text-green-600' },
                                    { icon: 'fa-volume-low', label: 'HowLoud SoundScore', desc: 'Traffic, local, and airport noise scores', color: 'bg-sky-50 border-sky-100 text-sky-600' },
                                    { icon: 'fa-street-view', label: 'Google Street View', desc: 'Curb appeal, privacy, safety, visual clutter, streetscape', color: 'bg-orange-50 border-orange-100 text-orange-600' },
                                    { icon: 'fa-camera', label: 'Visual AI Analysis', desc: 'Interior design, room-by-room quality, condition assessment', color: 'bg-violet-50 border-violet-100 text-violet-600' },
                                    { icon: 'fa-users', label: 'Community Pulse', desc: 'Resident sentiment, safety, complaints, lifestyle satisfaction', color: 'bg-rose-50 border-rose-100 text-rose-600' },
                                    { icon: 'fa-chart-line', label: 'Deep Investment Research', desc: 'Macro indicators, market dynamics, zoning, risk factors', color: 'bg-indigo-50 border-indigo-100 text-indigo-600' },
                                    { icon: 'fa-map', label: 'Google Places API', desc: 'Nearby POIs: dining, shopping, parks, transit, fitness, schools', color: 'bg-amber-50 border-amber-100 text-amber-600' },
                                    { icon: 'fa-compass', label: 'Satellite Orientation', desc: 'Building facing direction for Vastu / Feng Shui', color: 'bg-teal-50 border-teal-100 text-teal-600' },
                                    { icon: 'fa-fire', label: 'Climate Risk Data', desc: 'Wind, flood, fire, and heat risk scores (0-10)', color: 'bg-red-50 border-red-100 text-red-600' },
                                ].map((s, i) => (
                                    <div key={i} className={`p-4 rounded-2xl border ${s.color}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <i className={`fa-solid ${s.icon} text-[12px]`}></i>
                                            <span className="text-[12px] font-black">{s.label}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 leading-relaxed mb-0">{s.desc}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Output Format */}
                            <section className="bg-emerald-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden mb-12">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full translate-x-1/4 -translate-y-1/4 blur-3xl"></div>
                                <h3 className="text-xl font-black mb-6 relative z-10">Output Format</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-sm">
                                                <i className="fa-solid fa-tags"></i>
                                            </div>
                                            <div className="font-bold text-lg">Tags</div>
                                        </div>
                                        <p className="text-emerald-100 text-xs leading-relaxed">
                                            Each factor produces <span className="text-white font-black">1–3 short labels</span> like "Chef's Kitchen", "Turn-key", "High Solar Yield" — used as search facets and comparison dimensions.
                                        </p>
                                    </div>
                                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-sm">
                                                <i className="fa-solid fa-gauge-high"></i>
                                            </div>
                                            <div className="font-bold text-lg">Confidence</div>
                                        </div>
                                        <p className="text-indigo-100 text-xs leading-relaxed">
                                            Every factor carries a confidence level: <span className="text-white font-black">High</span> (directly from data), <span className="text-white font-black">Medium</span> (inferred), or <span className="text-white font-black">Low</span> (insufficient data).
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <div className="bg-amber-50 rounded-3xl p-8 border border-amber-100 flex items-start gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl shadow-lg shrink-0">
                                    <i className="fa-solid fa-lightbulb"></i>
                                </div>
                                <div>
                                    <h4 className="text-amber-900 font-black text-lg mb-2">Future: Graph Search</h4>
                                    <p className="text-amber-800 text-sm font-medium leading-relaxed">
                                        The Context Graph taxonomy is designed for eventual <strong>natural-language property search</strong> — e.g., "Show me turn-key homes with chef's kitchens near top-rated schools with low climate risk." The tag system enables faceted filtering across all 75 dimensions.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'land_utility',
                    title: 'Land & Slope Analysis',
                    icon: 'fa-mountain',
                    content: (
                        <div className="prose prose-slate max-w-none">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-16 h-16 rounded-[2rem] bg-teal-600 text-white flex items-center justify-center text-3xl shadow-xl shadow-teal-100">
                                    <i className="fa-solid fa-mountain"></i>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 mb-1">Land & Slope Analysis</h1>
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Measured Slope · Usable Lot Calculation · Parcel Validation</p>
                                </div>
                            </div>

                            <section className="bg-teal-50/50 rounded-[2.5rem] p-10 border border-teal-100 mb-12">
                                <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-3">
                                    <i className="fa-solid fa-ruler-combined text-teal-500 text-sm"></i>
                                    What We Calculate
                                </h2>
                                <p className="text-slate-600 font-medium leading-relaxed">
                                    For <strong>Single Family</strong> properties, Zyphe calculates the <strong>usable lot area</strong> by subtracting setback requirements, slope penalties, and zoning restrictions from the gross parcel area. This helps investors understand how much of the lot is actually buildable for ADUs, extensions, or landscaping.
                                </p>
                            </section>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <div className="text-teal-600 font-black text-[10px] uppercase tracking-widest mb-2">ArcGIS Parcels</div>
                                    <div className="text-xl font-black text-slate-800 mb-2">County Data</div>
                                    <p className="text-slate-500 text-[11px] leading-relaxed">We query county ArcGIS endpoints (Alameda, Santa Clara, Contra Costa) to get official parcel boundaries, APN, and area — then apply cos²(lat) geodetic correction for Web Mercator distortion.</p>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <div className="text-teal-600 font-black text-[10px] uppercase tracking-widest mb-2">USGS Elevation</div>
                                    <div className="text-xl font-black text-slate-800 mb-2">Slope %</div>
                                    <p className="text-slate-500 text-[11px] leading-relaxed">Elevation data from USGS 3DEP (1-meter resolution) is sampled at multiple points to calculate slope grade. Slopes above 6% receive usable-area penalties.</p>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <div className="text-teal-600 font-black text-[10px] uppercase tracking-widest mb-2">Setback Rules</div>
                                    <div className="text-xl font-black text-slate-800 mb-2">State Reqs</div>
                                    <p className="text-slate-500 text-[11px] leading-relaxed">State-required setbacks (front, side, rear property lines) are automatically subtracted from the gross lot area. Setback distances vary by state regulations.</p>
                                </div>
                            </div>

                            {/* Measured Slope Methodology */}
                            <section className="bg-indigo-50/50 rounded-[2.5rem] p-10 border border-indigo-100 mb-12">
                                <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
                                    <i className="fa-solid fa-chart-line text-indigo-500 text-sm"></i>
                                    How Slope Is Measured
                                </h2>
                                <p className="text-slate-600 font-medium leading-relaxed mb-6">
                                    Slope is <strong>not AI-estimated</strong> — it is calculated deterministically from real USGS topographic data using the <strong>National Map Elevation Point Query Service</strong> (EPQS), which provides surveyed elevation at ~1m resolution from the 3D Elevation Program.
                                </p>
                                <div className="space-y-4">
                                    <div className="flex gap-4 items-start">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center text-xs font-black shrink-0">1</div>
                                        <div>
                                            <div className="font-black text-slate-800 text-sm mb-1">8-Point Elevation Scout</div>
                                            <p className="text-slate-500 text-[12px] leading-relaxed">We sample elevation at 8 cardinal/intercardinal points (N, NE, E, SE, S, SW, W, NW) placed <strong>100 feet</strong> from the property pin. Each point uses the USGS EPQS API with cos(lat) longitude correction for geodetic accuracy.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 items-start">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center text-xs font-black shrink-0">2</div>
                                        <div>
                                            <div className="font-black text-slate-800 text-sm mb-1">Pin Elevation Query</div>
                                            <p className="text-slate-500 text-[12px] leading-relaxed">The property's exact elevation is queried separately from USGS EPQS.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 items-start">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center text-xs font-black shrink-0">3</div>
                                        <div>
                                            <div className="font-black text-slate-800 text-sm mb-1">Steepest Direction & Delta</div>
                                            <p className="text-slate-500 text-[12px] leading-relaxed">The highest elevation among the 8 scouts is identified as the <strong>uphill direction</strong>. The elevation delta is: <code className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[11px] font-bold">Δ = |highest_scout_elevation − pin_elevation|</code></p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 items-start">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center text-xs font-black shrink-0">4</div>
                                        <div>
                                            <div className="font-black text-slate-800 text-sm mb-1">Slope Percentage</div>
                                            <p className="text-slate-500 text-[12px] leading-relaxed">Slope is calculated as: <code className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[11px] font-bold">slope% = (Δ ÷ depth) × 100</code> where depth is the lot depth (from polygon or 150ft fallback). The opposite of the uphill direction indicates the <strong>backyard facing direction</strong>.</p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Slope Categories */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                                <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 text-center">
                                    <div className="text-3xl font-black text-emerald-600 mb-1">&lt; 5%</div>
                                    <div className="text-[11px] font-black text-emerald-700 uppercase tracking-widest mb-1">Flat</div>
                                    <div className="text-[10px] text-emerald-600 font-semibold">0% slope deduction</div>
                                </div>
                                <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 text-center">
                                    <div className="text-3xl font-black text-amber-600 mb-1">6–15%</div>
                                    <div className="text-[11px] font-black text-amber-700 uppercase tracking-widest mb-1">Moderate</div>
                                    <div className="text-[10px] text-amber-600 font-semibold">10% slope deduction</div>
                                </div>
                                <div className="bg-orange-50 p-5 rounded-2xl border border-orange-100 text-center">
                                    <div className="text-3xl font-black text-orange-600 mb-1">16–30%</div>
                                    <div className="text-[11px] font-black text-orange-700 uppercase tracking-widest mb-1">Steep</div>
                                    <div className="text-[10px] text-orange-600 font-semibold">60% slope deduction</div>
                                </div>
                                <div className="bg-rose-50 p-5 rounded-2xl border border-rose-100 text-center">
                                    <div className="text-3xl font-black text-rose-600 mb-1">&gt; 30%</div>
                                    <div className="text-[11px] font-black text-rose-700 uppercase tracking-widest mb-1">Heavy</div>
                                    <div className="text-[10px] text-rose-600 font-semibold">85% slope deduction</div>
                                </div>
                            </div>

                            {/* Usable Lot Formula */}
                            <section className="bg-slate-900 rounded-[2.5rem] p-10 mb-12">
                                <h2 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                                    <i className="fa-solid fa-calculator text-teal-400 text-sm"></i>
                                    Usable Lot Formula
                                </h2>
                                <div className="space-y-3 text-sm font-mono">
                                    <div className="flex items-center gap-3">
                                        <span className="text-slate-400 w-4 text-right">1.</span>
                                        <span className="text-slate-300">Setback = <span className="text-teal-400">lot ≤ 12k sf → 25%</span> · <span className="text-amber-400">lot &gt; 12k sf → 3000 + (excess × 1%)</span></span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-slate-400 w-4 text-right">2.</span>
                                        <span className="text-slate-300">After Setback = <span className="text-white font-bold">Gross − Setback Deduction</span></span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-slate-400 w-4 text-right">3.</span>
                                        <span className="text-slate-300">Slope Deduction = <span className="text-white font-bold">After Setback × Slope%</span></span>
                                    </div>
                                    <div className="flex items-center gap-3 pt-2 border-t border-slate-700">
                                        <span className="text-teal-400 w-4 text-right">=</span>
                                        <span className="text-teal-300 font-bold text-base">Usable Lot = After Setback − Slope Deduction</span>
                                    </div>
                                </div>
                            </section>

                            {/* 4 Parcel Validation Checks */}
                            <section className="bg-slate-50 rounded-[2.5rem] p-10 border border-slate-100 mb-12">
                                <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
                                    <i className="fa-solid fa-shield-halved text-slate-500 text-sm"></i>
                                    4 Parcel Validation Checks
                                </h2>
                                <p className="text-slate-500 font-medium leading-relaxed mb-6">
                                    These checks run automatically when viewing a property and cross-reference listing claims against measured data:
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xl">📏</span>
                                            <div className="font-black text-slate-800 text-sm">Check 1: Lot Size</div>
                                        </div>
                                        <p className="text-slate-500 text-[11px] leading-relaxed">Compares listed lot sqft vs ArcGIS parcel area. Flags discrepancies &gt;5% as warning, &gt;15% as alert (possible easement, right-of-way, or measurement error).</p>
                                    </div>
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xl">⛰️</span>
                                            <div className="font-black text-slate-800 text-sm">Check 2: Slope vs Description</div>
                                        </div>
                                        <p className="text-slate-500 text-[11px] leading-relaxed">If description claims "flat" but measured slope is &gt;8%, flags a warning. If &gt;15%, flags an alert. Also flags steep slopes (&gt;25%) not disclosed in listing text.</p>
                                    </div>
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xl">☀️</span>
                                            <div className="font-black text-slate-800 text-sm">Check 3: Orientation / Solar</div>
                                        </div>
                                        <p className="text-slate-500 text-[11px] leading-relaxed">If listing claims "sunny" but backyard faces north, flags a warning. Confirms south-facing backyards as optimal. Alerts on solar claims with north-facing rear exposures (30–50% efficiency loss).</p>
                                    </div>
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xl">📐</span>
                                            <div className="font-black text-slate-800 text-sm">Check 4: Living Sqft vs Tax Records</div>
                                        </div>
                                        <p className="text-slate-500 text-[11px] leading-relaxed">Compares listing sqft against county tax records. Discrepancy &gt;10% is a warning, &gt;20% alert (possible unpermitted addition or garage conversion).</p>
                                    </div>
                                </div>
                            </section>

                            <div className="bg-amber-50 rounded-3xl p-8 border border-amber-100 flex items-start gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl shadow-lg shrink-0">
                                    <i className="fa-solid fa-lightbulb"></i>
                                </div>
                                <div>
                                    <h4 className="text-amber-900 font-black text-lg mb-2">Townhome & Condo Note</h4>
                                    <p className="text-amber-800 text-sm font-medium leading-relaxed">
                                        Usable lot calculations are <strong>only shown for Single Family homes</strong>. For townhomes and condos, lot analysis is hidden since individual lot boundaries are typically shared or irrelevant for investment analysis.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'account',
            title: 'Account Settings',
            icon: 'fa-user-gear',
            topics: [
                { id: 'profile', title: 'Updating your Profile', icon: 'fa-id-card', content: <div className="prose prose-slate"><h2>Updating your Profile</h2><p>Change your professional info, headshot, and branding settings.</p></div> }
            ]
        },
        {
            id: 'investment_analysis',
            title: 'Distressed Property Finder',
            icon: 'fa-chart-line',
            topics: [
                {
                    id: 'overview',
                    title: 'Overview',
                    icon: 'fa-layer-group',
                    content: (
                        <div className="prose prose-slate max-w-none">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-16 h-16 rounded-[2rem] bg-slate-900 text-white flex items-center justify-center text-3xl shadow-xl shadow-slate-200">
                                    <i className="fa-solid fa-layer-group"></i>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 mb-1">How It All Works</h1>
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">End-to-End Pipeline</p>
                                </div>
                            </div>

                            <section className="bg-slate-50 rounded-[2.5rem] p-10 border border-slate-100 mb-12">
                                <p className="text-slate-600 font-medium leading-relaxed mb-0">
                                    Zyphe's Distressed Property Finder scans every active listing in a city, identifies properties with hidden distress signals, pulls recently sold comparables, normalizes them against public records, and produces a transparent ARV valuation — all in one automated workflow.
                                </p>
                            </section>

                            <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                                <div className="space-y-6">
                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">1</div>
                                        <div>
                                            <div className="font-black text-slate-800 text-sm mb-1">Scan & Detect Distress</div>
                                            <p className="text-slate-900 text-xs leading-relaxed mb-0">We pull active listings across all zip codes in a city and run each through <strong>AI to detect financial distress, condition issues, seller motivation</strong>, and timing red flags from the MLS description.</p>
                                        </div>
                                    </div>

                                    <div className="h-px bg-slate-100"></div>

                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">2</div>
                                        <div>
                                            <div className="font-black text-slate-800 text-sm mb-1">Find & Tier Comparables</div>
                                            <p className="text-slate-900 text-xs leading-relaxed mb-0">For each distressed property, we pull recently sold comps within 6 months and assign each a quality tier (1-4) based on distance, sqft variance, and recency.</p>
                                        </div>
                                    </div>

                                    <div className="h-px bg-slate-100"></div>

                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">3</div>
                                        <div>
                                            <div className="font-black text-slate-800 text-sm mb-1">Time-Adjust Prices</div>
                                            <p className="text-slate-900 text-xs leading-relaxed mb-0">We calculate the local price change rate using <strong>IQR-filtered linear regression</strong> on monthly median $/sqft, then compound-adjust each comp's sale price forward to today's date.</p>
                                        </div>
                                    </div>

                                    <div className="h-px bg-slate-100"></div>

                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">4</div>
                                        <div>
                                            <div className="font-black text-slate-800 text-sm mb-1">Normalize Against Public Records</div>
                                            <p className="text-slate-900 text-xs leading-relaxed mb-0">We verify listing data against <strong>county tax records and ArcGIS parcel polygons</strong>, detect phantom sqft from unpermitted additions, and calculate an adjusted $/sqft for each comp.</p>
                                        </div>
                                    </div>

                                    <div className="h-px bg-slate-100"></div>

                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">5</div>
                                        <div>
                                            <div className="font-black text-slate-800 text-sm mb-1">Remove Outliers (AI + Statistical)</div>
                                            <p className="text-slate-900 text-xs leading-relaxed mb-0">We use <strong>AI to exclude distressed or unreliable comps</strong>, then apply a 20% median-deviation statistical filter to catch any remaining outliers.</p>
                                        </div>
                                    </div>

                                    <div className="h-px bg-slate-100"></div>

                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">6</div>
                                        <div>
                                            <div className="font-black text-slate-800 text-sm mb-1">Select Top 3 & Calculate ARV</div>
                                            <p className="text-slate-900 text-xs leading-relaxed mb-0">The top 3 comps (ranked by tier, then distance) are averaged for $/sqft, then multiplied by the subject's square footage to produce the Zyphe ARV Estimate.</p>
                                        </div>
                                    </div>

                                    <div className="h-px bg-slate-100"></div>

                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">7</div>
                                        <div>
                                            <div className="font-black text-slate-800 text-sm mb-1">Renovation Strategy & Cost Worksheet</div>
                                            <p className="text-slate-900 text-xs leading-relaxed mb-0">We generate an itemized renovation plan with upgrades already made, suggested high-ROI improvements, estimated costs, and projected value-add for each property.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'distressed_properties',
                    title: 'Finding Distressed Properties',
                    icon: 'fa-house-crack',
                    content: (
                        <div className="prose prose-slate max-w-none">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-16 h-16 rounded-[2rem] bg-rose-600 text-white flex items-center justify-center text-3xl shadow-xl shadow-rose-100">
                                    <i className="fa-solid fa-house-crack"></i>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 mb-1">Finding Distressed Properties</h1>
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">AI-Powered Distress Signal Detection</p>
                                </div>
                            </div>

                            <section className="bg-rose-50/50 rounded-[2.5rem] p-10 border border-rose-100 mb-12">
                                <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-3">
                                    <i className="fa-solid fa-bullseye text-rose-500 text-sm"></i>
                                    How It Works
                                </h2>
                                <p className="text-slate-600 font-medium leading-relaxed">
                                    Zyphe scans active listings across all zip codes in a city, then runs each property through an <strong>AI-powered distress analysis engine</strong> that reads the MLS listing description looking for hidden signals of seller motivation, deferred maintenance, and forced-sale conditions that most buyers miss.
                                </p>
                            </section>

                            <h3 className="text-xl font-black text-slate-800 mb-8 border-l-4 border-rose-600 pl-6">What We Analyze</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center text-sm">
                                            <i className="fa-solid fa-landmark"></i>
                                        </div>
                                        <h4 className="font-black text-slate-800">Financial Distress</h4>
                                    </div>
                                    <p className="text-slate-500 text-sm leading-relaxed">Short sales, REO/bank-owned, court-ordered sales, pre-foreclosure, auction language, and cash-only requirements.</p>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center text-sm">
                                            <i className="fa-solid fa-screwdriver-wrench"></i>
                                        </div>
                                        <h4 className="font-black text-slate-800">Condition Issues</h4>
                                    </div>
                                    <p className="text-slate-500 text-sm leading-relaxed">As-is sales, contractor/handyman specials, mold, foundation problems, fire damage, deferred maintenance, and teardown candidates.</p>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-purple-500 text-white flex items-center justify-center text-sm">
                                            <i className="fa-solid fa-person-running"></i>
                                        </div>
                                        <h4 className="font-black text-slate-800">Seller Motivation</h4>
                                    </div>
                                    <p className="text-slate-500 text-sm leading-relaxed">"Must sell," relocating, estate/probate sales, quick-close language, "bring all offers" signals suggesting urgency.</p>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center text-sm">
                                            <i className="fa-solid fa-clock"></i>
                                        </div>
                                        <h4 className="font-black text-slate-800">Timing Red Flags</h4>
                                    </div>
                                    <p className="text-slate-500 text-sm leading-relaxed">Back-on-market (BOM), repeated price reductions, failed inspections, and high days-on-market relative to area median.</p>
                                </div>
                            </div>

                            <section className="bg-slate-900 rounded-[2.5rem] p-10 text-white mb-12 shadow-2xl overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl"></div>
                                <h3 className="text-xl font-black mb-6 relative z-10">Renovation Strategy & ARV Breakdown</h3>
                                <div className="space-y-6 relative z-10">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                            <i className="fa-solid fa-hammer text-emerald-400"></i>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm mb-1">Upgrades Already Made</div>
                                            <div className="text-slate-400 text-xs leading-relaxed">We identify completed renovations mentioned in the listing (new roof, updated kitchen, etc.) and categorize them as structural, systemic, or cosmetic.</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                            <i className="fa-solid fa-chart-bar text-indigo-400"></i>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm mb-1">Suggested High-ROI Upgrades</div>
                                            <div className="text-slate-400 text-xs leading-relaxed">Based on 2026 renovation ROI benchmarks, we recommend specific projects: minor kitchen refresh (113% ROI), garage/entry doors (&gt;200% ROI), ADU conversions, and cosmetic updates.</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                            <i className="fa-solid fa-receipt text-amber-400"></i>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm mb-1">Itemized Cost & Value-Add Table</div>
                                            <div className="text-slate-400 text-xs leading-relaxed">Each suggested renovation includes estimated cost, projected value added, and ROI percentage — giving you a clear investment worksheet per property.</div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <div className="bg-amber-50 rounded-3xl p-8 border border-amber-100 flex items-start gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl shadow-lg shrink-0">
                                    <i className="fa-solid fa-lightbulb"></i>
                                </div>
                                <div>
                                    <h4 className="text-amber-900 font-black text-lg mb-2">Property Type Filtering</h4>
                                    <p className="text-amber-800 text-sm font-medium leading-relaxed">
                                        The distressed property finder focuses on <strong>Single Family</strong> and <strong>Townhome</strong> properties.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'comp_selection',
                    title: 'Comp Selection & Analysis',
                    icon: 'fa-magnifying-glass-chart',
                    content: (
                        <div className="prose prose-slate max-w-none">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-16 h-16 rounded-[2rem] bg-indigo-600 text-white flex items-center justify-center text-3xl shadow-xl shadow-indigo-100">
                                    <i className="fa-solid fa-magnifying-glass-chart"></i>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 mb-1">Comp Selection & Analysis</h1>
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">How Zyphe Finds & Validates Comparables</p>
                                </div>
                            </div>

                            <section className="bg-indigo-50/50 rounded-[2.5rem] p-10 border border-indigo-100 mb-12">
                                <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-3">
                                    <i className="fa-solid fa-database text-indigo-500 text-sm"></i>
                                    Data Sourcing
                                </h2>
                                <p className="text-slate-600 font-medium leading-relaxed">
                                    Zyphe focuses on sales near the subject property in last 6 months. We create a tiered system to select top comparables.
                                </p>
                            </section>

                            <h3 className="text-xl font-black text-slate-800 mb-8 border-l-4 border-indigo-600 pl-6">The Tier System</h3>
                            <p className="text-slate-600 font-medium leading-relaxed mb-6">
                                Every comparable is automatically assigned a <strong>quality tier</strong> based on how closely it matches the subject property's characteristics. Tiers 1-3 are eligible for valuation; Tier 4 comps are shown for reference only.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
                                <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 text-center">
                                    <div className="text-2xl font-black text-emerald-700 mb-1">Tier 1</div>
                                    <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Ideal</div>
                                    <p className="text-slate-600 text-[11px] leading-relaxed">Within <strong>0.25 mi</strong>, sqft within <strong>10%</strong> of subject, sold within <strong>30 days</strong>.</p>
                                </div>
                                <div className="bg-blue-50 p-5 rounded-2xl border border-blue-200 text-center">
                                    <div className="text-2xl font-black text-blue-700 mb-1">Tier 2</div>
                                    <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">Strong</div>
                                    <p className="text-slate-600 text-[11px] leading-relaxed">Within <strong>0.50 mi</strong>, sqft within <strong>15%</strong> of subject, sold within <strong>90 days</strong>.</p>
                                </div>
                                <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 text-center">
                                    <div className="text-2xl font-black text-amber-700 mb-1">Tier 3</div>
                                    <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">Good</div>
                                    <p className="text-slate-600 text-[11px] leading-relaxed">Within <strong>0.75 mi</strong>, sqft within <strong>20%</strong> of subject, sold within <strong>180 days</strong>.</p>
                                </div>
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-center">
                                    <div className="text-2xl font-black text-slate-500 mb-1">Tier 4</div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Reference</div>
                                    <p className="text-slate-600 text-[11px] leading-relaxed">Does not meet Tier 1-3 criteria. Shown for context only, excluded from valuation.</p>
                                </div>
                            </div>

                            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex items-center gap-4 mb-12">
                                <i className="fa-solid fa-circle-exclamation text-amber-500 text-sm"></i>
                                <p className="text-amber-900 text-[11px] font-bold leading-relaxed mb-0">
                                    <strong>Lot Size Penalty:</strong> If a comp's lot size is more than <strong>2×</strong> or less than <strong>0.5×</strong> the subject's lot, the comp is automatically <strong>demoted by one tier</strong>.
                                </p>
                            </div>

                            <h3 className="text-xl font-black text-slate-800 mb-8 border-l-4 border-indigo-600 pl-6">Time-Adjusted Pricing</h3>
                            <p className="text-slate-600 font-medium leading-relaxed mb-6">
                                Comps that sold months ago may not reflect current market conditions. Zyphe uses <strong>linear regression</strong> with <strong>IQR outlier filtering</strong> to calculate the local price change rate and adjust each comp's sale price to today's value.
                            </p>

                            <div className="space-y-8 mb-12">
                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                    <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                                        <span className="text-indigo-600">1.</span> Collect $/sqft Data Points
                                    </h4>
                                    <p className="text-slate-500 text-sm leading-relaxed">
                                        All nearby sold properties within the last 6 months are used to build a dataset of $/sqft values, grouped by the month they sold.
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                    <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                                        <span className="text-indigo-600">2.</span> IQR Outlier Filter
                                    </h4>
                                    <p className="text-slate-500 text-sm leading-relaxed">
                                        We calculate the <strong>Interquartile Range (IQR)</strong> of all $/sqft values. Any data point below <strong>Q1 − 1.5 × IQR</strong> or above <strong>Q3 + 1.5 × IQR</strong> is removed as an outlier. This prevents distressed sales or luxury flips from skewing the trend.
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                    <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                                        <span className="text-indigo-600">3.</span> Monthly Median Per-SqFt
                                    </h4>
                                    <p className="text-slate-500 text-sm leading-relaxed">
                                        After filtering, we calculate the <strong>median $/sqft</strong> for each month. The median (not average) is used to further reduce the impact of any remaining extreme values.
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                    <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                                        <span className="text-indigo-600">4.</span> Linear Regression
                                    </h4>
                                    <p className="text-slate-500 text-sm leading-relaxed">
                                        A <strong>simple linear regression</strong> is fitted to the monthly medians to determine the slope — the rate at which $/sqft is changing over time. The monthly appreciation rate is calculated as <strong>−slope ÷ average $/sqft</strong>, capped at <strong>±2% per month</strong> to prevent extreme adjustments.
                                    </p>
                                </div>

                                <div className="bg-indigo-50 p-8 rounded-[2rem] border border-indigo-200">
                                    <h4 className="text-lg font-black text-indigo-900 mb-4 flex items-center gap-3">
                                        <span className="text-indigo-600">5.</span> Apply to Each Comp
                                    </h4>
                                    <p className="text-indigo-800 text-sm leading-relaxed">
                                        Each comp's sold price is adjusted forward to today using the formula: <strong>Adjusted Price = Sale Price × (1 + monthly rate) ^ months since sale</strong>. A comp that sold 3 months ago in a market appreciating at 0.5%/mo would be adjusted upward by ~1.5%.
                                    </p>
                                </div>
                            </div>

                            <h3 className="text-xl font-black text-slate-800 mb-8 border-l-4 border-indigo-600 pl-6">AI-Powered Normalization</h3>

                            <div className="space-y-8 mb-12">
                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                    <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                                        <span className="text-indigo-600">1.</span> Tax Record Verification
                                    </h4>
                                    <p className="text-slate-500 text-sm leading-relaxed">
                                        For both the subject property and every comp, we look up county assessor and tax records and extract the official "Total Living Area" from public records and compare it to the listing square footage. This catches phantom sqft — where a listing inflates square footage beyond what tax records show.
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                    <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                                        <span className="text-indigo-600">2.</span> ArcGIS Parcel Verification
                                    </h4>
                                    <p className="text-slate-500 text-sm leading-relaxed">
                                        In parallel, we query <strong>county ArcGIS parcel endpoints</strong> to retrieve the official parcel polygon for each property. This gives us the <strong>assessed lot area, APN,</strong> and parcel boundaries directly from county GIS data. We cross-reference the listing's lot size against the ArcGIS-reported parcel area (with <strong>cos²(lat) geodetic correction</strong> for Web Mercator distortion) to flag discrepancies — catching cases where a listing overstates or understates the actual lot size.
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                    <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                                        <span className="text-indigo-600">3.</span> Phantom SqFt Detection
                                    </h4>
                                    <p className="text-slate-500 text-sm leading-relaxed">
                                        If the listing square footage exceeds the tax record square footage by more than <strong>10%</strong>, the comp is flagged with an <strong>"Unpermitted Utility"</strong> warning. This indicates the home may have unpermitted additions (converted garages, enclosed patios, etc.) that could affect valuation and financing.
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                    <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                                        <span className="text-indigo-600">4.</span> Price-Per-Square-Foot Normalization
                                    </h4>
                                    <p className="text-slate-500 text-sm leading-relaxed">
                                        We calculate an <strong>adjusted $/sqft</strong> by dividing the sold price by the <strong>higher</strong> of the two square footage numbers (listing vs tax). This reflects the buyer's actual price for total utility. Using the higher number prevents artificially inflating the $/sqft when additional living space exists.
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                    <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                                        <span className="text-indigo-600">5.</span> Feature Adjustments
                                    </h4>
                                    <p className="text-slate-500 text-sm leading-relaxed">
                                        We identify <strong>valuation-impacting features</strong> for each property: pools, views, ADUs, updated kitchens, fire damage, corner lots, solar panels, etc. Basic attributes (beds, baths, sqft, year built) are tracked separately and excluded from the feature list to avoid duplication.
                                    </p>
                                </div>
                            </div>

                            <section className="bg-slate-900 rounded-[2.5rem] p-10 text-white mb-12 shadow-2xl overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl"></div>
                                <h3 className="text-xl font-black mb-6 relative z-10">Statistical Outlier Detection</h3>
                                <div className="space-y-6 relative z-10">
                                    <p className="text-slate-300 text-sm leading-relaxed">
                                        After the normalization analysis, Zyphe applies an additional <strong>code-side statistical filter</strong> to catch any remaining outliers:
                                    </p>
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                            <i className="fa-solid fa-calculator text-indigo-400"></i>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm mb-1">Median Deviation Check</div>
                                            <div className="text-slate-400 text-xs leading-relaxed">The median $/sqft is calculated across all AI-included comps. Any comp whose $/sqft deviates by more than <strong>20%</strong> from the median is automatically flagged as a <strong>"Stat Outlier"</strong> and excluded from the final average.</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                            <i className="fa-solid fa-shield-halved text-emerald-400"></i>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm mb-1">Why Both AI + Statistical?</div>
                                            <div className="text-slate-400 text-xs leading-relaxed">AI is excellent at qualitative judgments (condition, reliability), but deterministic code is more reliable for mathematical consistency checks. Combining both creates a robust, defensible valuation pipeline.</div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )
                },
                {
                    id: 'zyphe_valuation',
                    title: 'Zyphe ARV Valuation',
                    icon: 'fa-dollar-sign',
                    content: (
                        <div className="prose prose-slate max-w-none">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-16 h-16 rounded-[2rem] bg-emerald-600 text-white flex items-center justify-center text-3xl shadow-xl shadow-emerald-100">
                                    <i className="fa-solid fa-dollar-sign"></i>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 mb-1">Zyphe ARV Valuation</h1>
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">How We Calculate After-Repair Value</p>
                                </div>
                            </div>

                            <section className="bg-emerald-50/50 rounded-[2.5rem] p-10 border border-emerald-100 mb-12">
                                <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-3">
                                    <i className="fa-solid fa-coins text-emerald-500 text-sm"></i>
                                    The Valuation Formula
                                </h2>
                                <p className="text-slate-600 font-medium leading-relaxed mb-6">
                                    The Zyphe ARV estimate is calculated using a transparent, reproducible formula based on the top comparable sales:
                                </p>
                                <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm">
                                    <div className="font-black text-emerald-900 text-sm mb-4 uppercase tracking-widest text-center opacity-40">The Formula</div>
                                    <div className="text-center text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                                        Avg $/sf × Subject SqFt = Zyphe ARV
                                    </div>
                                    <div className="h-px bg-slate-100 my-4"></div>
                                    <div className="text-center text-sm text-slate-500">
                                        Example: <span className="font-black text-emerald-700">$561/sf</span> × <span className="font-black text-slate-800">2,263 sf</span> = <span className="font-black text-emerald-700">$1,270,200</span>
                                    </div>
                                </div>
                            </section>

                            <h3 className="text-xl font-black text-slate-800 mb-8 border-l-4 border-emerald-600 pl-6">How Top Comps Are Selected</h3>

                            <div className="space-y-8 mb-12">
                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                    <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                                        <span className="text-emerald-600">1.</span> Start with AI-Included Comps
                                    </h4>
                                    <p className="text-slate-500 text-sm leading-relaxed">
                                        We first recommend which comps should be included based on qualitative analysis — condition similarity, data reliability, and relevance to the subject property. Distressed comps and those with major condition differences are excluded.
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                    <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                                        <span className="text-emerald-600">2.</span> Remove Statistical Outliers
                                    </h4>
                                    <p className="text-slate-500 text-sm leading-relaxed">
                                        Any comp whose normalized $/sqft deviates more than <strong>20%</strong> from the median of included comps is flagged as a statistical outlier and removed. This provides a second layer of protection against skewed data.
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                    <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                                        <span className="text-emerald-600">3.</span> Rank by Quality & Distance
                                    </h4>
                                    <p className="text-slate-500 text-sm leading-relaxed">
                                        Remaining comps are sorted by <strong>tier</strong> (Ideal → Strong → Good) and then by <strong>distance</strong> (closest first) within each tier. This ensures the most comparable, nearest properties take priority.
                                    </p>
                                </div>

                                <div className="bg-emerald-50 p-8 rounded-[2rem] border border-emerald-200">
                                    <h4 className="text-lg font-black text-emerald-900 mb-4 flex items-center gap-3">
                                        <span className="text-emerald-600">4.</span> Select Top 3 — The "Top Comp" Tag
                                    </h4>
                                    <p className="text-emerald-800 text-sm leading-relaxed">
                                        Only the <strong>top 3</strong> comps (after outlier removal and tier ranking) are used in the final average. These comps receive the <strong>"✓ Top Comp"</strong> tag in the UI and their $/sqft values are averaged to produce the <strong>Zyphe Recommended Avg $/sf</strong>.
                                    </p>
                                </div>
                            </div>

                            <section className="bg-slate-900 rounded-[2.5rem] p-10 text-white mb-12 shadow-2xl overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl"></div>
                                <h3 className="text-xl font-black mb-6 relative z-10">Understanding the Valuation Card</h3>
                                <div className="space-y-6 relative z-10">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                            <i className="fa-solid fa-sack-dollar text-emerald-400"></i>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm mb-1">Zyphe ARV Estimate</div>
                                            <div className="text-slate-400 text-xs leading-relaxed">The headline number: average $/sf of top 3 comps × subject sqft. The percentage below shows how this compares to the listing price (negative = potential upside).</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                            <i className="fa-solid fa-table-list text-indigo-400"></i>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm mb-1">Top Comp Addresses</div>
                                            <div className="text-slate-400 text-xs leading-relaxed">The 3 comps used in the average are listed with their individual $/sqft, so you can see exactly which properties drove the valuation.</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                            <i className="fa-solid fa-hammer text-amber-400"></i>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm mb-1">Remodel Cost & Value-Add Table</div>
                                            <div className="text-slate-400 text-xs leading-relaxed">Below the valuation, you'll see an itemized renovation worksheet showing each suggested upgrade with estimated cost and value added — straight from the distress analysis.</div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <div className="bg-indigo-50 rounded-3xl p-8 border border-indigo-100 flex items-start gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center text-xl shadow-lg shrink-0">
                                    <i className="fa-solid fa-circle-info"></i>
                                </div>
                                <div>
                                    <h4 className="text-indigo-900 font-black text-lg mb-2">Important Disclaimer</h4>
                                    <p className="text-indigo-800 text-sm font-medium leading-relaxed">
                                        The Zyphe ARV Estimate is an <strong>AI-generated suggestion</strong> based on available data and should be used as a starting point for your own due diligence. Always verify with a licensed appraiser, inspect the property in person, and confirm tax records with your county assessor before making investment decisions.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'city_data',
                    title: 'City & Market Analysis',
                    icon: 'fa-city',
                    content: (
                        <div className="prose prose-slate max-w-none">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-16 h-16 rounded-[2rem] bg-indigo-600 text-white flex items-center justify-center text-3xl shadow-xl shadow-indigo-100">
                                    <i className="fa-solid fa-city"></i>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 mb-1">City & Market Analysis</h1>
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Macro Performance & Neighborhood Trends</p>
                                </div>
                            </div>

                            <section className="bg-indigo-50/50 rounded-[2.5rem] p-10 border border-indigo-100 mb-12">
                                <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-3">
                                    <i className="fa-solid fa-chart-line text-indigo-500 text-sm"></i>
                                    How We Score Cities
                                </h2>
                                <p className="text-slate-600 font-medium leading-relaxed">
                                    Zyphe aggregates data from MLS feeds, census records, and local policy databases to provide a comprehensive look at market health. Our <strong>Opportunity Score</strong> ($0-100$) factors in price-to-rent ratios, inventory velocity, and zoning flexibility.
                                </p>
                            </section>

                            <div className="space-y-8">
                                <div className="flex gap-6">
                                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-indigo-600 shrink-0">
                                        <i className="fa-solid fa-magnifying-glass-chart"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 mb-2">Deep Research Pipeline</h3>
                                        <p className="text-slate-500 text-sm leading-relaxed">Triggering a Deep Research run initiates a 5-minute Gemini reasoning cycle that analyzes hundreds of listing descriptions to identify neighborhood-specific gentrification signals and investment "pockets".</p>
                                    </div>
                                </div>
                                <div className="flex gap-6">
                                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-teal-600 shrink-0">
                                        <i className="fa-solid fa-bullseye"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 mb-2">Inventory Velocity</h3>
                                        <p className="text-slate-500 text-sm leading-relaxed">We track the median "Days on Market" at the zip-code level. Cities with velocity increasing by more than 15% WoW are flagged with high-demand signals.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'db_schema',
            title: 'Database Schema',
            icon: 'fa-database',
            topics: [
                {
                    id: 'schema_property',
                    title: 'Property Intelligence',
                    icon: 'fa-house',
                    content: (
                        <div key={schemaRefreshKey} className="max-w-none animate-in fade-in duration-300">
                            <SchemaPageHeader
                                icon="fa-house" iconBg="bg-indigo-600 text-white shadow-indigo-100"
                                title="Property Intelligence Schema"
                                subtitle="Tier 1 · 6 Collections · Keyed by zpid"
                                onRefresh={handleSchemaRefresh}
                                refreshing={schemaRefreshing}
                            />
                            <SourceLegend />
                            <div className="space-y-3">
                                {propertyCollections.map(col => <CollectionBlock key={col.name} col={col} />)}
                            </div>
                        </div>
                    )
                },
                {
                    id: 'schema_city',
                    title: 'City & Market Data',
                    icon: 'fa-city',
                    content: (
                        <div key={schemaRefreshKey} className="max-w-none animate-in fade-in duration-300">
                            <SchemaPageHeader
                                icon="fa-city" iconBg="bg-teal-600 text-white shadow-teal-100"
                                title="City & Market Data Schema"
                                subtitle="Tier 2 · 6 Collections · Keyed by cityStateKey or zip"
                                onRefresh={handleSchemaRefresh}
                                refreshing={schemaRefreshing}
                            />
                            <SourceLegend />
                            <div className="space-y-3">
                                {cityCollections.map(col => <CollectionBlock key={col.name} col={col} />)}
                            </div>
                        </div>
                    )
                },
                {
                    id: 'schema_crm',
                    title: 'CRM & Transactions',
                    icon: 'fa-users',
                    content: (
                        <div key={schemaRefreshKey} className="max-w-none animate-in fade-in duration-300">
                            <SchemaPageHeader
                                icon="fa-handshake" iconBg="bg-blue-600 text-white shadow-blue-100"
                                title="CRM & Transactions Schema"
                                subtitle="Tier 3 · 6 Collections · Keyed by auto-id or uid"
                                onRefresh={handleSchemaRefresh}
                                refreshing={schemaRefreshing}
                            />
                            <SourceLegend />
                            <div className="space-y-3">
                                {crmCollections.map(col => <CollectionBlock key={col.name} col={col} />)}
                            </div>
                        </div>
                    )
                },
                {
                    id: 'schema_ops',
                    title: 'Platform Operations',
                    icon: 'fa-microchip',
                    content: (
                        <div key={schemaRefreshKey} className="max-w-none animate-in fade-in duration-300">
                            <SchemaPageHeader
                                icon="fa-microchip" iconBg="bg-violet-600 text-white shadow-violet-100"
                                title="Platform Operations Schema"
                                subtitle="Tier 4 · 5 Collections · Audit logs & Activity streams"
                                onRefresh={handleSchemaRefresh}
                                refreshing={schemaRefreshing}
                            />
                            <SourceLegend />
                            <div className="space-y-3">
                                {opsCollections.map(col => <CollectionBlock key={col.name} col={col} />)}
                            </div>
                        </div>
                    )
                }
            ]
        },
    ];

    const activeCategory = categories.find(c => c.id === activeCategoryId) || categories[1];
    const activeTopic = activeCategory.topics.find(t => t.id === activeTopicId) || activeCategory.topics[0];

    return (
        <div className="flex h-full bg-slate-50 animate-in fade-in duration-500">
            {/* Help Sidebar */}
            <div className="w-72 bg-white border-r border-slate-200 flex flex-col pt-8">
                <div className="px-6 mb-8">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Help Categories</h2>
                </div>
                <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-8">
                    {categories.map((cat) => (
                        <div key={cat.id} className="space-y-1">
                            <button
                                onClick={() => {
                                    setActiveCategoryId(cat.id);
                                    setActiveTopicId(cat.topics[0].id);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${activeCategoryId === cat.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                <i className={`fa-solid ${cat.icon} text-sm ${activeCategoryId === cat.id ? 'text-indigo-600' : 'text-slate-300'}`}></i>
                                <span className="text-xs font-black uppercase tracking-wider">{cat.title}</span>
                            </button>

                            {activeCategoryId === cat.id && (
                                <div className="pl-6 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                    {cat.topics.map((topic) => (
                                        <button
                                            key={topic.id}
                                            onClick={() => setActiveTopicId(topic.id)}
                                            className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTopicId === topic.id ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            {topic.title}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-white">
                <div className="max-w-4xl mx-auto px-12 py-16">
                    {activeTopic.content}
                </div>
            </div>
        </div>
    );
};

export default PlatformHelpTab;
