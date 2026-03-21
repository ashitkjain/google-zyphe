import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../../services/firebase/config';
import { getLLMLogsForTimeRange } from '../../services/firebase/llm_logs';
import { getAPILogsForTimeRange } from '../../services/firebase/api_logs';
import { LLMCallEvent } from '../../types/ai';
import { APICallEvent } from '../../services/firebase/api_logs';

// ── Pricing constants (Gemini paid tier, per 1M tokens) ──────────────
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
    'gemini-1.5-flash':       { input: 0.10 / 1e6, output: 0.40 / 1e6 },
    'gemini-2.0-flash':       { input: 0.10 / 1e6, output: 0.40 / 1e6 },
    'gemini-2.0-pro-exp':     { input: 1.25 / 1e6, output: 5.00 / 1e6 },
    'gemini-3-flash-preview': { input: 0.10 / 1e6, output: 0.40 / 1e6 },
    'gemini-1.5-pro':         { input: 1.25 / 1e6, output: 5.00 / 1e6 },
};
const DEFAULT_PRICING = { input: 0.10 / 1e6, output: 0.40 / 1e6 };

function costForEvent(ev: LLMCallEvent): number {
    if (ev.estimated_cost != null) return ev.estimated_cost;
    const p = MODEL_PRICING[ev.llm_name] || DEFAULT_PRICING;
    const input = ev.usage_metadata?.promptTokenCount || 0;
    const output = ev.usage_metadata?.candidatesTokenCount || 0;
    return input * p.input + output * p.output;
}

// Strip path and extension → readable label
function friendlyPrompt(filename: string): string {
    return filename
        .replace(/^.*[\\/]/, '')   // strip directory
        .replace(/\.[tj]sx?$/, '') // strip extension
        .replace(/([A-Z])/g, ' $1').trim(); // camelCase → words
}

// ── Helper: Firestore Timestamp → JS Date ────────────────────────────
function tsToMs(ts: any): number {
    if (!ts) return 0;
    if (ts?.seconds != null) return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1e6;
    if (ts?.toDate) return ts.toDate().getTime();
    return new Date(ts).getTime();
}

// ── Time range: today 00:00 local → now ─────────────────────────────
function todayRange(): { start: number; end: number; label: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return { start, end: now.getTime(), label: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) };
}

// ── Stat Card ────────────────────────────────────────────────────────
const Stat: React.FC<{ label: string; value: string; sub?: string; color?: string; icon: string }> =
    ({ label, value, sub, color = 'indigo', icon }) => (
        <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start gap-4`}>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-${color}-50 text-${color}-500 text-xl flex-shrink-0`}>
                <i className={`fa-solid ${icon}`} />
            </div>
            <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                <p className="text-2xl font-black text-slate-800 mt-0.5">{value}</p>
                {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );

// ── Progress bar ─────────────────────────────────────────────────────
const Bar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
        <div className={`h-1.5 rounded-full bg-${color}-400`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
);

type SortDir = 'asc' | 'desc';

const CostDashboardTab: React.FC = () => {
    const [llmEvents, setLlmEvents] = useState<LLMCallEvent[]>([]);
    const [apiEvents, setApiEvents] = useState<APICallEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    const [llmSort, setLlmSort] = useState<{ col: string; dir: SortDir }>({ col: 'cost', dir: 'desc' });
    const [apiSort, setApiSort] = useState<{ col: string; dir: SortDir }>({ col: 'calls', dir: 'desc' });

    // Compute today's range once on mount — stable reference prevents infinite re-load
    const range = React.useMemo(() => todayRange(), []);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const uid = auth?.currentUser?.uid;
            if (!uid) throw new Error('Not signed in');
            const [llm, api] = await Promise.all([
                getLLMLogsForTimeRange(uid, range.start, range.end),
                getAPILogsForTimeRange(uid, range.start, range.end),
            ]);
            setLlmEvents(llm);
            setApiEvents(api);
            setLastRefreshed(new Date());
        } catch (e: any) {
            setError(e.message || 'Failed to load logs');
        } finally {
            setLoading(false);
        }
    }, [range.start, range.end]);

    useEffect(() => { load(); }, [load]);

    // ── Gemini aggregation ──────────────────────────────────────────
    type PromptRow = {
        prompt: string; calls: number; succeeded: number; failed: number;
        inputTokens: number; outputTokens: number; totalTokens: number; cost: number;
    };

    const promptRows: PromptRow[] = React.useMemo(() => {
        const map = new Map<string, PromptRow>();
        for (const ev of llmEvents) {
            const key = friendlyPrompt(ev.prompt_filename || 'unknown');
            if (!map.has(key)) map.set(key, { prompt: key, calls: 0, succeeded: 0, failed: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 });
            const r = map.get(key)!;
            r.calls++;
            if (ev.status === 'completed') r.succeeded++;
            if (ev.status === 'failed') r.failed++;
            r.inputTokens += ev.usage_metadata?.promptTokenCount || 0;
            r.outputTokens += ev.usage_metadata?.candidatesTokenCount || 0;
            r.totalTokens += ev.usage_metadata?.totalTokenCount || 0;
            r.cost += costForEvent(ev);
        }
        let rows = [...map.values()];
        const { col, dir } = llmSort;
        rows.sort((a: any, b: any) => dir === 'desc' ? b[col] - a[col] : a[col] - b[col]);
        return rows;
    }, [llmEvents, llmSort]);

    const llmTotals = React.useMemo(() => ({
        calls: promptRows.reduce((s, r) => s + r.calls, 0),
        input: promptRows.reduce((s, r) => s + r.inputTokens, 0),
        output: promptRows.reduce((s, r) => s + r.outputTokens, 0),
        cost: promptRows.reduce((s, r) => s + r.cost, 0),
        failed: promptRows.reduce((s, r) => s + r.failed, 0),
    }), [promptRows]);

    const maxPromptCost = Math.max(...promptRows.map(r => r.cost), 0.000001);

    // ── API aggregation ─────────────────────────────────────────────
    type ApiRow = {
        api: string; calls: number; succeeded: number; failed: number; avgMs: number; totalMs: number;
    };

    const apiRows: ApiRow[] = React.useMemo(() => {
        const map = new Map<string, ApiRow>();
        for (const ev of apiEvents) {
            const key = ev.api_name || 'unknown';
            if (!map.has(key)) map.set(key, { api: key, calls: 0, succeeded: 0, failed: 0, avgMs: 0, totalMs: 0 });
            const r = map.get(key)!;
            r.calls++;
            if (ev.status === 'completed') r.succeeded++;
            if (ev.status === 'failed') r.failed++;
            r.totalMs += ev.response_time_ms || 0;
        }
        let rows = [...map.values()].map(r => ({ ...r, avgMs: r.calls ? Math.round(r.totalMs / r.calls) : 0 }));
        const { col, dir } = apiSort;
        rows.sort((a: any, b: any) => dir === 'desc' ? b[col] - a[col] : a[col] - b[col]);
        return rows;
    }, [apiEvents, apiSort]);

    const apiTotals = React.useMemo(() => ({
        calls: apiRows.reduce((s, r) => s + r.calls, 0),
        succeeded: apiRows.reduce((s, r) => s + r.succeeded, 0),
        failed: apiRows.reduce((s, r) => s + r.failed, 0),
    }), [apiRows]);

    const maxApiCalls = Math.max(...apiRows.map(r => r.calls), 1);

    // ── Sort header helper ──────────────────────────────────────────
    const LlmTh: React.FC<{ col: string; label: string; right?: boolean }> = ({ col, label, right }) => (
        <th className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer select-none hover:text-slate-600 transition-colors ${right ? 'text-right' : 'text-left'}`}
            onClick={() => setLlmSort(s => ({ col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc' }))}>
            {label}{llmSort.col === col ? (llmSort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
        </th>
    );
    const ApiTh: React.FC<{ col: string; label: string; right?: boolean }> = ({ col, label, right }) => (
        <th className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer select-none hover:text-slate-600 transition-colors ${right ? 'text-right' : 'text-left'}`}
            onClick={() => setApiSort(s => ({ col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc' }))}>
            {label}{apiSort.col === col ? (apiSort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
        </th>
    );

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-500 animate-spin" />
            <p className="text-sm font-medium text-slate-400">Loading today's usage data…</p>
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center py-32 gap-3">
            <i className="fa-solid fa-triangle-exclamation text-3xl text-rose-400" />
            <p className="text-sm font-bold text-slate-600">{error}</p>
            <button onClick={load} className="px-4 py-2 bg-indigo-500 text-white text-sm font-bold rounded-lg hover:bg-indigo-600 transition-colors">Retry</button>
        </div>
    );

    return (
        <div className="p-6 space-y-8">
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-black text-slate-800 tracking-tight">Cost Dashboard</h1>
                    <p className="text-sm text-slate-400 mt-0.5">{range.label} · logs expire after 48 h</p>
                </div>
                <button
                    onClick={load}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-indigo-300 transition-all shadow-sm"
                >
                    <i className="fa-solid fa-arrows-rotate text-indigo-400" />
                    Refresh
                    {lastRefreshed && <span className="text-[10px] font-normal text-slate-400">· {lastRefreshed.toLocaleTimeString()}</span>}
                </button>
            </div>

            {/* ── Top-level KPI cards ─────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat icon="fa-dollar-sign" color="emerald" label="Total Gemini Cost" value={`$${llmTotals.cost.toFixed(4)}`} sub={`${llmTotals.calls} calls`} />
                <Stat icon="fa-coins" color="violet" label="Total Tokens" value={(llmTotals.input + llmTotals.output).toLocaleString()} sub={`${llmTotals.input.toLocaleString()} in / ${llmTotals.output.toLocaleString()} out`} />
                <Stat icon="fa-plug" color="sky" label="External API Calls" value={apiTotals.calls.toLocaleString()} sub={`${apiTotals.succeeded} ok · ${apiTotals.failed} failed`} />
                <Stat icon="fa-circle-xmark" color="rose" label="Gemini Failures" value={String(llmTotals.failed)} sub={llmTotals.calls > 0 ? `${((llmTotals.failed / llmTotals.calls) * 100).toFixed(1)}% failure rate` : '—'} />
            </div>

            {/* ── Gemini breakdown table ──────────────────────────── */}
            <section>
                <div className="flex items-center gap-2 mb-3">
                    <i className="fa-solid fa-robot text-violet-400" />
                    <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest">Gemini — By Prompt</h2>
                    <span className="ml-auto text-xs font-medium text-slate-400">{promptRows.length} prompt type{promptRows.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
                    {promptRows.length === 0 ? (
                        <div className="py-16 text-center text-sm text-slate-400">No Gemini calls logged today.</div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50/60 border-b border-slate-100">
                                <tr>
                                    <LlmTh col="prompt" label="Prompt" />
                                    <LlmTh col="calls" label="Calls" right />
                                    <LlmTh col="succeeded" label="OK" right />
                                    <LlmTh col="failed" label="Failed" right />
                                    <LlmTh col="inputTokens" label="In Tokens" right />
                                    <LlmTh col="outputTokens" label="Out Tokens" right />
                                    <LlmTh col="cost" label="Cost (USD)" right />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {promptRows.map(r => (
                                    <tr key={r.prompt} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-3 py-3 min-w-[200px]">
                                            <p className="text-[12px] font-bold text-slate-700">{r.prompt}</p>
                                            <Bar pct={(r.cost / maxPromptCost) * 100} color="violet" />
                                        </td>
                                        <td className="px-3 py-3 text-right text-[12px] font-bold text-slate-600">{r.calls}</td>
                                        <td className="px-3 py-3 text-right text-[12px] font-bold text-emerald-600">{r.succeeded}</td>
                                        <td className="px-3 py-3 text-right text-[12px] font-bold text-rose-500">{r.failed || '—'}</td>
                                        <td className="px-3 py-3 text-right text-[12px] font-mono text-slate-500">{r.inputTokens.toLocaleString()}</td>
                                        <td className="px-3 py-3 text-right text-[12px] font-mono text-slate-500">{r.outputTokens.toLocaleString()}</td>
                                        <td className="px-3 py-3 text-right">
                                            <span className={`text-[12px] font-black ${r.cost > 0.01 ? 'text-amber-600' : 'text-slate-600'}`}>
                                                ${r.cost.toFixed(5)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50/60 border-t border-slate-200">
                                <tr>
                                    <td className="px-3 py-2 text-[11px] font-black text-slate-500 uppercase tracking-wider">Total</td>
                                    <td className="px-3 py-2 text-right text-[12px] font-black text-slate-700">{llmTotals.calls}</td>
                                    <td className="px-3 py-2 text-right text-[12px] font-black text-emerald-600">{llmTotals.calls - llmTotals.failed}</td>
                                    <td className="px-3 py-2 text-right text-[12px] font-black text-rose-500">{llmTotals.failed || '—'}</td>
                                    <td className="px-3 py-2 text-right text-[12px] font-black font-mono text-slate-700">{llmTotals.input.toLocaleString()}</td>
                                    <td className="px-3 py-2 text-right text-[12px] font-black font-mono text-slate-700">{llmTotals.output.toLocaleString()}</td>
                                    <td className="px-3 py-2 text-right text-[12px] font-black text-emerald-700">${llmTotals.cost.toFixed(5)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>
            </section>

            {/* ── External API breakdown table ────────────────────── */}
            <section>
                <div className="flex items-center gap-2 mb-3">
                    <i className="fa-solid fa-plug text-sky-400" />
                    <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest">External APIs — By Service</h2>
                    <span className="ml-auto text-xs font-medium text-slate-400">{apiRows.length} service{apiRows.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
                    {apiRows.length === 0 ? (
                        <div className="py-16 text-center text-sm text-slate-400">No external API calls logged today.</div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50/60 border-b border-slate-100">
                                <tr>
                                    <ApiTh col="api" label="API / Service" />
                                    <ApiTh col="calls" label="Calls" right />
                                    <ApiTh col="succeeded" label="OK" right />
                                    <ApiTh col="failed" label="Failed" right />
                                    <ApiTh col="avgMs" label="Avg Latency" right />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {apiRows.map(r => (
                                    <tr key={r.api} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-3 py-3 min-w-[200px]">
                                            <p className="text-[12px] font-bold text-slate-700">{r.api}</p>
                                            <Bar pct={(r.calls / maxApiCalls) * 100} color="sky" />
                                        </td>
                                        <td className="px-3 py-3 text-right text-[12px] font-bold text-slate-600">{r.calls}</td>
                                        <td className="px-3 py-3 text-right text-[12px] font-bold text-emerald-600">{r.succeeded}</td>
                                        <td className="px-3 py-3 text-right text-[12px] font-bold text-rose-500">{r.failed || '—'}</td>
                                        <td className="px-3 py-3 text-right text-[12px] font-mono text-slate-500">
                                            {r.avgMs > 0 ? `${r.avgMs.toLocaleString()} ms` : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50/60 border-t border-slate-200">
                                <tr>
                                    <td className="px-3 py-2 text-[11px] font-black text-slate-500 uppercase tracking-wider">Total</td>
                                    <td className="px-3 py-2 text-right text-[12px] font-black text-slate-700">{apiTotals.calls}</td>
                                    <td className="px-3 py-2 text-right text-[12px] font-black text-emerald-600">{apiTotals.succeeded}</td>
                                    <td className="px-3 py-2 text-right text-[12px] font-black text-rose-500">{apiTotals.failed || '—'}</td>
                                    <td className="px-3 py-2 text-right text-[12px] font-mono text-slate-500">—</td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>
            </section>

            {/* ── Recent Gemini calls timeline ────────────────────── */}
            <section>
                <div className="flex items-center gap-2 mb-3">
                    <i className="fa-solid fa-clock-rotate-left text-amber-400" />
                    <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest">Recent Gemini Calls</h2>
                    <span className="ml-auto text-xs font-medium text-slate-400">Last 20</span>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
                    {llmEvents.length === 0 ? (
                        <div className="py-16 text-center text-sm text-slate-400">No calls yet today.</div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50/60 border-b border-slate-100">
                                <tr>
                                    {['Time', 'Prompt', 'Model', 'Status', 'Tokens', 'Cost'].map(h => (
                                        <th key={h} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {llmEvents.slice(0, 20).map(ev => {
                                    const ms = tsToMs(ev.timestamp);
                                    const time = ms ? new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
                                    const cost = costForEvent(ev);
                                    return (
                                        <tr key={ev.id} className="hover:bg-slate-50/40 transition-colors">
                                            <td className="px-3 py-2 text-[11px] font-mono text-slate-400 whitespace-nowrap">{time}</td>
                                            <td className="px-3 py-2 text-[12px] font-bold text-slate-700 max-w-[200px] truncate">{friendlyPrompt(ev.prompt_filename || '—')}</td>
                                            <td className="px-3 py-2 text-[11px] text-slate-400 whitespace-nowrap">{ev.llm_name?.replace('gemini-', '').replace('-preview', ' ◈') || '—'}</td>
                                            <td className="px-3 py-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${ev.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : ev.status === 'failed' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                                                    {ev.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-[11px] font-mono text-slate-500">
                                                {ev.usage_metadata?.totalTokenCount?.toLocaleString() || '—'}
                                            </td>
                                            <td className="px-3 py-2 text-[12px] font-bold text-slate-600">${cost.toFixed(5)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>
        </div>
    );
};

export default CostDashboardTab;
