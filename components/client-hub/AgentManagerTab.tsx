import React, { useState, useRef, useCallback } from 'react';
import { runIntegrationTest, IntegrationTestResult, IntegrationTestProgress } from '../../services/integrationTest';

interface AgentDefinition {
    id: string;
    name: string;
    icon: string;
    color: string;             // tailwind color name (e.g. 'rose', 'cyan')
    description: string;
    runner: (onProgress: (p: IntegrationTestProgress) => void, onLog: (msg: string) => void) => Promise<any>;
}

const AGENTS: AgentDefinition[] = [
    {
        id: 'integration_test',
        name: 'Pipeline Integration Test',
        icon: 'fa-flask',
        color: 'rose',
        description: 'Picks 4 random properties from Dublin, runs pre-smoke → full intel → post-smoke, and detects systemic pipeline failures.',
        runner: async (onProgress, onLog) => {
            return runIntegrationTest('Dublin', 4, onProgress, onLog);
        },
    },
];

interface AgentRun {
    agentId: string;
    status: 'running' | 'done' | 'error';
    phase: string;
    startedAt: Date;
    completedAt?: Date;
    result?: any;
    error?: string;
    logs: string[];
}

const AgentManagerTab: React.FC = () => {
    const [runs, setRuns] = useState<AgentRun[]>([]);
    const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
    const logEndRef = useRef<HTMLDivElement>(null);

    const isRunning = useCallback((agentId: string) => {
        return runs.some(r => r.agentId === agentId && r.status === 'running');
    }, [runs]);

    const triggerAgent = async (agent: AgentDefinition) => {
        if (isRunning(agent.id)) return;

        const runId = `${agent.id}_${Date.now()}`;
        const newRun: AgentRun = {
            agentId: agent.id,
            status: 'running',
            phase: 'Starting...',
            startedAt: new Date(),
            logs: [],
        };

        setRuns(prev => [newRun, ...prev]);
        setExpandedRunId(runId);

        const addLog = (msg: string) => {
            setRuns(prev => prev.map((r, i) =>
                i === 0 && r.agentId === agent.id && r.status === 'running'
                    ? { ...r, logs: [...r.logs, `[${new Date().toLocaleTimeString()}] ${msg}`] }
                    : r
            ));
        };

        const onProgress = (p: IntegrationTestProgress) => {
            setRuns(prev => prev.map((r, i) =>
                i === 0 && r.agentId === agent.id && r.status === 'running'
                    ? { ...r, phase: `${p.phase}: ${p.message}` }
                    : r
            ));
        };

        try {
            const result = await agent.runner(onProgress, addLog);
            setRuns(prev => prev.map((r, i) =>
                i === 0 && r.agentId === agent.id && r.status === 'running'
                    ? { ...r, status: 'done', completedAt: new Date(), result, phase: result?.passed ? '✅ PASSED' : '❌ FAILED' }
                    : r
            ));
        } catch (e: any) {
            setRuns(prev => prev.map((r, i) =>
                i === 0 && r.agentId === agent.id && r.status === 'running'
                    ? { ...r, status: 'error', completedAt: new Date(), error: e.message, phase: '💥 CRASHED' }
                    : r
            ));
        }
    };

    const formatDuration = (start: Date, end?: Date) => {
        const ms = (end || new Date()).getTime() - start.getTime();
        if (ms < 60000) return `${Math.round(ms / 1000)}s`;
        return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
    };

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <i className="fa-solid fa-robot text-white text-lg"></i>
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Agent Manager</h1>
                    <p className="text-sm text-slate-400 font-medium">Trigger and monitor autonomous pipeline agents</p>
                </div>
            </div>

            {/* Agent Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {AGENTS.map(agent => {
                    const running = isRunning(agent.id);
                    const lastRun = runs.find(r => r.agentId === agent.id && r.status !== 'running');
                    return (
                        <div key={agent.id} className="bg-white rounded-2xl border-2 border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-md transition-all p-5 flex flex-col gap-4">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl bg-${agent.color}-50 flex items-center justify-center`}>
                                        <i className={`fa-solid ${agent.icon} text-${agent.color}-500 text-sm`}></i>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800">{agent.name}</h3>
                                        {lastRun && (
                                            <span className={`text-[10px] font-bold ${lastRun.status === 'done' && lastRun.result?.passed ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                Last: {lastRun.status === 'done' ? (lastRun.result?.passed ? 'PASS' : 'FAIL') : 'ERROR'} ({formatDuration(lastRun.startedAt, lastRun.completedAt)})
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs text-slate-400 leading-relaxed">{agent.description}</p>

                            <button
                                onClick={() => triggerAgent(agent)}
                                disabled={running}
                                className={`w-full py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                    running
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : `bg-${agent.color}-50 hover:bg-${agent.color}-100 text-${agent.color}-600 border-2 border-${agent.color}-200 hover:border-${agent.color}-300`
                                }`}
                            >
                                {running ? (
                                    <><i className="fa-solid fa-spinner animate-spin"></i>Running...</>
                                ) : (
                                    <><i className="fa-solid fa-play text-[9px]"></i>Run Agent</>
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Run History */}
            {runs.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-sm font-black text-slate-600 uppercase tracking-widest">Run History</h2>
                    <div className="space-y-3">
                        {runs.map((run, idx) => {
                            const agent = AGENTS.find(a => a.id === run.agentId);
                            if (!agent) return null;
                            const isExpanded = expandedRunId === `${run.agentId}_${idx}`;

                            return (
                                <div key={idx} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                    {/* Run Header */}
                                    <button
                                        onClick={() => setExpandedRunId(isExpanded ? null : `${run.agentId}_${idx}`)}
                                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${
                                                run.status === 'running' ? 'bg-amber-400 animate-pulse' :
                                                run.status === 'done' && run.result?.passed ? 'bg-emerald-400' :
                                                'bg-rose-400'
                                            }`}></div>
                                            <span className="text-sm font-black text-slate-700">{agent.name}</span>
                                            <span className="text-xs text-slate-400 font-medium">{run.startedAt.toLocaleTimeString()}</span>
                                            {run.status === 'running' && (
                                                <span className="text-[10px] text-amber-500 font-bold bg-amber-50 px-2 py-0.5 rounded-full">{run.phase}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {run.status !== 'running' && (
                                                <span className="text-xs text-slate-400">{formatDuration(run.startedAt, run.completedAt)}</span>
                                            )}
                                            {run.status === 'done' && (
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${run.result?.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                    {run.result?.passed ? 'PASS' : `FAIL: ${run.result?.systemicFailures?.join(', ') || 'unknown'}`}
                                                </span>
                                            )}
                                            {run.status === 'error' && (
                                                <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">CRASHED</span>
                                            )}
                                            <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[10px] text-slate-300`}></i>
                                        </div>
                                    </button>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100">
                                            {/* Property Results */}
                                            {run.result?.properties && (
                                                <div className="px-5 py-4 space-y-3">
                                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Property Results</h4>
                                                    <div className="grid gap-2">
                                                        {run.result.properties.map((p: any, i: number) => (
                                                            <div key={i} className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl">
                                                                <div className="flex items-center gap-3">
                                                                    <i className={`fa-solid ${p.pipelineStatus === 'success' ? 'fa-check-circle text-emerald-400' : 'fa-times-circle text-rose-400'} text-sm`}></i>
                                                                    <div>
                                                                        <span className="text-xs font-bold text-slate-700 block">{p.address}</span>
                                                                        <span className="text-[10px] text-slate-400">
                                                                            Before: {p.beforeErrors.length}E {p.beforeWarnings.length}W → After: {p.afterErrors.length}E {p.afterWarnings.length}W
                                                                            {p.healed.length > 0 && <span className="text-emerald-500 ml-1">(healed: {p.healed.join(', ')})</span>}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                {p.remaining.length > 0 && (
                                                                    <span className="text-[10px] text-rose-500 font-bold">{p.remaining.join(', ')}</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {run.result.systemicFailures?.length > 0 && (
                                                        <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl">
                                                            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Systemic Failures:</span>
                                                            <span className="text-sm font-bold text-rose-700 ml-2">{run.result.systemicFailures.join(', ')}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Logs */}
                                            <div className="px-5 pb-4">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Logs ({run.logs.length})</h4>
                                                <div className="bg-slate-900 rounded-xl p-4 max-h-64 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-0.5">
                                                    {run.logs.length === 0 ? (
                                                        <span className="text-slate-500 italic">No logs yet...</span>
                                                    ) : (
                                                        run.logs.map((log, i) => (
                                                            <div key={i} className={`${
                                                                log.includes('✓') || log.includes('✅') || log.includes('PASS') ? 'text-emerald-400' :
                                                                log.includes('✗') || log.includes('❌') || log.includes('FAIL') || log.includes('Error') ? 'text-rose-400' :
                                                                log.includes('[IntTest]') ? 'text-amber-300' :
                                                                'text-slate-400'
                                                            }`}>
                                                                {log}
                                                            </div>
                                                        ))
                                                    )}
                                                    <div ref={logEndRef} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {runs.length === 0 && (
                <div className="text-center py-16 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <i className="fa-solid fa-robot text-4xl text-slate-300 mb-4"></i>
                    <h3 className="text-lg font-bold text-slate-500">No agent runs yet</h3>
                    <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">Click "Run Agent" on a card above to start an autonomous pipeline test.</p>
                </div>
            )}
        </div>
    );
};

export default AgentManagerTab;
