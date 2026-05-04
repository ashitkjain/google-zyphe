import React, { useState, useEffect, useRef } from 'react';
import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    getDocs,
    Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '../../services/firebase/config';
import { functions } from '../../services/firebase/config';

// ---- Types ----------------------------------------------------------------

interface StepResult {
    status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
    total?: number;
    succeeded?: number;
    failed?: number;
    skipped?: number;
    durationMs?: number;
    batchJobId?: string;
}

interface PipelineRun {
    runId: string;
    city: string;
    state: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'partial';
    triggeredBy?: string;
    startedAt?: any;
    completedAt?: any;
    zpids?: string[];
    steps: {
        property_data?: StepResult;
        asset_secure?: StepResult;
        intel?: StepResult;
        orientation?: StepResult;
        context_graph?: StepResult;
        buyer_dna?: StepResult;
        smoke?: StepResult;
    };
    createdAt?: any;
}

// ---- Constants ------------------------------------------------------------

const STEP_NAMES: (keyof PipelineRun['steps'])[] = [
    'property_data',
    'asset_secure',
    'intel',
    'orientation',
    'context_graph',
    'buyer_dna',
    'smoke',
];

const STEP_LABELS: Record<string, string> = {
    property_data: 'Property Data',
    asset_secure: 'Asset Secure',
    intel: 'Intel',
    orientation: 'Orientation',
    context_graph: 'Context Graph',
    buyer_dna: 'Buyer DNA',
    smoke: 'Smoke Check',
};

// ---- Helper utilities ----------------------------------------------------

function toDate(ts: any): Date | null {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (typeof ts === 'number') return new Date(ts * 1000);
    return null;
}

function relativeTime(ts: any): string {
    const d = toDate(ts);
    if (!d) return '—';
    const diffMs = Date.now() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString();
}

function durationLabel(startTs: any, endTs: any): string {
    const start = toDate(startTs);
    const end = toDate(endTs) ?? new Date();
    if (!start) return '—';
    const ms = end.getTime() - start.getTime();
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${min}m ${rem}s`;
}

function stepDurationLabel(ms?: number): string {
    if (!ms) return '—';
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    return `${min}m ${sec % 60}s`;
}

// ---- Sub-components -------------------------------------------------------

const StatusBadge: React.FC<{ status: PipelineRun['status'] }> = ({ status }) => {
    const styles: Record<string, string> = {
        queued: 'bg-slate-600 text-slate-200',
        running: 'bg-blue-600 text-white animate-pulse',
        completed: 'bg-emerald-600 text-white',
        failed: 'bg-rose-600 text-white',
        partial: 'bg-yellow-500 text-slate-900',
    };
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${styles[status] ?? 'bg-slate-600 text-slate-200'}`}>
            {status}
        </span>
    );
};

const StepDot: React.FC<{ stepStatus?: StepResult['status'] }> = ({ stepStatus = 'pending' }) => {
    const styles: Record<string, string> = {
        pending: 'bg-slate-600',
        running: 'bg-blue-500 animate-pulse',
        done: 'bg-emerald-500',
        failed: 'bg-rose-500',
        skipped: 'bg-slate-500',
    };
    return (
        <span
            className={`inline-block w-3 h-3 rounded-full ${styles[stepStatus] ?? 'bg-slate-600'}`}
            title={stepStatus}
        />
    );
};

const StepDetailsTable: React.FC<{ steps: PipelineRun['steps'] }> = ({ steps }) => (
    <table className="w-full text-xs mt-3 border-collapse">
        <thead>
            <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left py-1 pr-3 font-medium">Step</th>
                <th className="text-left py-1 pr-3 font-medium">Status</th>
                <th className="text-right py-1 pr-3 font-medium">Total</th>
                <th className="text-right py-1 pr-3 font-medium">Done</th>
                <th className="text-right py-1 pr-3 font-medium">Failed</th>
                <th className="text-right py-1 pr-3 font-medium">Skipped</th>
                <th className="text-right py-1 font-medium">Duration</th>
            </tr>
        </thead>
        <tbody>
            {STEP_NAMES.map((name) => {
                const s = steps[name];
                const statusColors: Record<string, string> = {
                    pending: 'text-slate-500',
                    running: 'text-blue-400',
                    done: 'text-emerald-400',
                    failed: 'text-rose-400',
                    skipped: 'text-slate-500',
                };
                const st = s?.status ?? 'pending';
                return (
                    <tr key={name} className="border-b border-slate-800">
                        <td className="py-1 pr-3 text-slate-300">{STEP_LABELS[name]}</td>
                        <td className={`py-1 pr-3 font-semibold ${statusColors[st] ?? 'text-slate-400'}`}>
                            {st}
                        </td>
                        <td className="py-1 pr-3 text-right text-slate-300 font-mono">{s?.total ?? '—'}</td>
                        <td className="py-1 pr-3 text-right text-emerald-400 font-mono">{s?.succeeded ?? '—'}</td>
                        <td className="py-1 pr-3 text-right text-rose-400 font-mono">{s?.failed ?? '—'}</td>
                        <td className="py-1 pr-3 text-right text-slate-400 font-mono">{s?.skipped ?? '—'}</td>
                        <td className="py-1 text-right text-slate-400 font-mono">{stepDurationLabel(s?.durationMs)}</td>
                    </tr>
                );
            })}
        </tbody>
    </table>
);

const RunCard: React.FC<{
    run: PipelineRun;
    expanded: boolean;
    onToggle: () => void;
}> = ({ run, expanded, onToggle }) => {
    const isActive = run.status === 'running' || run.status === 'queued';

    return (
        <div className={`bg-slate-800 rounded-lg border ${isActive ? 'border-blue-700' : 'border-slate-700'} overflow-hidden`}>
            <button
                onClick={onToggle}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-750 transition-colors"
            >
                {/* City / State */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-slate-100 font-semibold text-sm">{run.city}</span>
                        <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs text-slate-300 font-mono">
                            {run.state}
                        </span>
                        <StatusBadge status={run.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>Started {relativeTime(run.startedAt ?? run.createdAt)}</span>
                        <span>Duration: {durationLabel(run.startedAt ?? run.createdAt, run.completedAt)}</span>
                        {run.zpids && (
                            <span className="font-mono">{run.zpids.length} zpids</span>
                        )}
                    </div>
                </div>

                {/* Step progress dots */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {STEP_NAMES.map((name) => (
                        <StepDot key={name} stepStatus={run.steps[name]?.status} />
                    ))}
                </div>

                {/* Expand chevron */}
                <span className="text-slate-500 text-xs ml-1">{expanded ? '▲' : '▼'}</span>
            </button>

            {expanded && (
                <div className="px-4 pb-4 border-t border-slate-700">
                    <div className="text-xs text-slate-500 mt-2 font-mono">
                        Run ID: {run.runId}
                        {run.triggeredBy && <span className="ml-4">By: {run.triggeredBy}</span>}
                    </div>
                    <StepDetailsTable steps={run.steps} />
                </div>
            )}
        </div>
    );
};

// ---- New Run Panel --------------------------------------------------------

const NewRunPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [city, setCity] = useState('Pleasanton');
    const [state, setState] = useState('CA');
    const [zpidsRaw, setZpidsRaw] = useState('');
    const [triggering, setTriggering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successRunId, setSuccessRunId] = useState<string | null>(null);

    const zpidList = zpidsRaw
        .split(/[\n,\s]+/)
        .map((z) => z.trim())
        .filter((z) => z.length > 0);

    const handleTrigger = async () => {
        if (!city.trim()) {
            setError('City is required.');
            return;
        }
        setTriggering(true);
        setError(null);
        try {
            const triggerFn = httpsCallable(functions, 'pipelineTrigger');
            const result: any = await triggerFn({
                city: city.trim(),
                state: state.trim() || 'CA',
                zpids: zpidList.length > 0 ? zpidList : undefined,
            });
            setSuccessRunId(result.data?.runId ?? 'unknown');
        } catch (err: any) {
            setError(err?.message ?? 'Failed to trigger pipeline.');
        } finally {
            setTriggering(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-slate-100 font-semibold text-lg">New Pipeline Run</h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-200 text-xl leading-none"
                    >
                        ×
                    </button>
                </div>

                {successRunId ? (
                    <div className="text-center py-4">
                        <div className="text-emerald-400 text-2xl mb-2">✓</div>
                        <p className="text-slate-200 font-semibold mb-1">Pipeline triggered!</p>
                        <p className="text-slate-400 text-xs font-mono break-all">Run ID: {successRunId}</p>
                        <button
                            onClick={onClose}
                            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors"
                        >
                            Close
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-slate-400 text-xs font-medium mb-1">City</label>
                                <input
                                    type="text"
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                                    placeholder="e.g. Pleasanton"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-400 text-xs font-medium mb-1">State</label>
                                <input
                                    type="text"
                                    value={state}
                                    onChange={(e) => setState(e.target.value)}
                                    maxLength={2}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-blue-500 uppercase"
                                    placeholder="CA"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-400 text-xs font-medium mb-1">
                                    ZPIDs{' '}
                                    <span className="text-slate-600 font-normal">(optional — paste comma/newline separated)</span>
                                </label>
                                <textarea
                                    value={zpidsRaw}
                                    onChange={(e) => setZpidsRaw(e.target.value)}
                                    rows={4}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500 resize-none"
                                    placeholder="123456789&#10;987654321&#10;..."
                                />
                                {zpidList.length > 0 && (
                                    <p className="text-slate-500 text-xs mt-1 font-mono">
                                        {zpidList.length} zpid{zpidList.length !== 1 ? 's' : ''} detected
                                    </p>
                                )}
                            </div>
                        </div>

                        {error && (
                            <p className="mt-3 text-rose-400 text-xs">{error}</p>
                        )}

                        <div className="flex gap-3 mt-5">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleTrigger}
                                disabled={triggering}
                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-blue-400 text-white rounded-lg text-sm font-semibold transition-colors"
                            >
                                {triggering ? 'Triggering…' : 'Trigger Pipeline'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// ---- Main component -------------------------------------------------------

const PipelineRunsTab: React.FC = () => {
    const [runs, setRuns] = useState<PipelineRun[]>([]);
    const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
    const [showNewRun, setShowNewRun] = useState(false);
    const [loading, setLoading] = useState(true);
    const unsubRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!db) return;

        const runsCol = collection(db, 'pipeline_runs');
        const q = query(runsCol, orderBy('createdAt', 'desc'), limit(20));

        // Real-time listener covers active runs and provides initial snapshot
        const unsub = onSnapshot(q, (snap) => {
            const docs: PipelineRun[] = snap.docs.map((doc) => {
                const d = doc.data();
                return {
                    runId: d.runId ?? doc.id,
                    city: d.city ?? '',
                    state: d.state ?? '',
                    status: d.status ?? 'queued',
                    triggeredBy: d.triggeredBy,
                    startedAt: d.startedAt,
                    completedAt: d.completedAt,
                    zpids: d.zpids,
                    steps: d.steps ?? {},
                    createdAt: d.createdAt,
                } as PipelineRun;
            });
            setRuns(docs);
            setLoading(false);
        });

        unsubRef.current = unsub;
        return () => unsub();
    }, []);

    const toggleExpand = (runId: string) => {
        setExpandedRunId((prev) => (prev === runId ? null : runId));
    };

    const activeCount = runs.filter(
        (r) => r.status === 'running' || r.status === 'queued'
    ).length;

    return (
        <div className="p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-slate-100 text-xl font-bold">Pipeline Orchestrator</h2>
                    <p className="text-slate-500 text-sm mt-0.5">
                        Google Cloud Workflows · property data pipeline
                        {activeCount > 0 && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-900 text-blue-300 rounded text-xs font-semibold animate-pulse">
                                {activeCount} active
                            </span>
                        )}
                    </p>
                </div>
                <button
                    onClick={() => setShowNewRun(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                    + New Run
                </button>
            </div>

            {/* Step legend */}
            <div className="flex items-center gap-4 mb-5 text-xs text-slate-500 flex-wrap">
                {[
                    { color: 'bg-slate-600', label: 'pending' },
                    { color: 'bg-blue-500', label: 'running' },
                    { color: 'bg-emerald-500', label: 'done' },
                    { color: 'bg-rose-500', label: 'failed' },
                    { color: 'bg-slate-500', label: 'skipped' },
                ].map(({ color, label }) => (
                    <span key={label} className="flex items-center gap-1">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
                        {label}
                    </span>
                ))}
                <span className="ml-auto text-slate-600 font-mono text-xs">
                    Steps: {STEP_NAMES.map((n) => STEP_LABELS[n]).join(' → ')}
                </span>
            </div>

            {/* Run list */}
            {loading ? (
                <div className="text-slate-500 text-sm text-center py-12">Loading runs…</div>
            ) : runs.length === 0 ? (
                <div className="text-slate-600 text-sm text-center py-12 border border-dashed border-slate-700 rounded-lg">
                    No pipeline runs yet. Click <strong className="text-slate-400">New Run</strong> to kick one off.
                </div>
            ) : (
                <div className="space-y-3">
                    {runs.map((run) => (
                        <RunCard
                            key={run.runId}
                            run={run}
                            expanded={expandedRunId === run.runId}
                            onToggle={() => toggleExpand(run.runId)}
                        />
                    ))}
                </div>
            )}

            {/* New Run modal */}
            {showNewRun && <NewRunPanel onClose={() => setShowNewRun(false)} />}
        </div>
    );
};

export default PipelineRunsTab;
