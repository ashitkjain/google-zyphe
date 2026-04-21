
import React, { useState, useEffect, useMemo } from 'react';
import { fetchAuditAggregations, ServiceAggregation, TimeSeriesPoint } from '../../services/firebase/audit';
import { LLMCallEvent } from '../../types/ai';

// Pricing tiered by model for cost estimation
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
    'gemini-1.5-flash':       { input: 0.10 / 1e6, output: 0.40 / 1e6 },
    'gemini-2.0-flash':       { input: 0.10 / 1e6, output: 0.40 / 1e6 },
    'gemini-2.5-flash':       { input: 0.10 / 1e6, output: 0.40 / 1e6 },
    'gemini-2.0-pro-exp':     { input: 1.25 / 1e6, output: 5.00 / 1e6 },
    'gemini-1.5-pro':         { input: 1.25 / 1e6, output: 5.00 / 1e6 },
    'gemini-3-flash-preview': { input: 0.10 / 1e6, output: 0.40 / 1e6 }
};
const DEFAULT_PRICING = { input: 0.10 / 1e6, output: 0.40 / 1e6 };

const CostDashboardTab: React.FC = () => {
    const [timeframe, setTimeframe] = useState<'weekly' | 'monthly'>('weekly');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { loadStats(); }, [timeframe]);

    const loadStats = async () => {
        setLoading(true);
        try {
            const data = await fetchAuditAggregations(timeframe);
            setStats(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const getEstimatedCost = (tokens: number, model: string) => {
        const p = MODEL_PRICING[model] || DEFAULT_PRICING;
        // Approximation assuming 70% input / 30% output distribution
        return (tokens * 0.7 * p.input) + (tokens * 0.3 * p.output);
    };

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '400px', gap: '16px' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <p style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.05em' }}>ANALYZING LOGS...</p>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    if (error) return (
        <div style={{ padding: '40px', color: '#ef4444', backgroundColor: '#fef2f2', borderRadius: '24px', border: '1px solid #fee2e2', textAlign: 'center' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '32px', marginBottom: '16px' }}></i>
            <h3 style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>Audit Incomplete</h3>
            <p>{error}</p>
        </div>
    );

    const geminiService = stats.services.find((s: any) => s.service === 'Gemini AI');
    const estimatedCost = geminiService?.geminiDetails?.totalTokens 
        ? getEstimatedCost(geminiService.geminiDetails.totalTokens, 'gemini-2.5-flash').toFixed(4)
        : "0.0000";

    return (
        <div style={{ padding: '40px', backgroundColor: '#f8fafc', minHeight: '100%' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', margin: '0', tracking: '-0.02em' }}>Platform Audit Hub</h1>
                    <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>Auditing trailing {timeframe === 'weekly' ? '7 days' : '30 days'} of intelligence & integration traffic.</p>
                </div>

                <div style={{ display: 'flex', gap: '8px', background: '#e2e8f0', padding: '4px', borderRadius: '14px' }}>
                    {(['weekly', 'monthly'] as const).map(t => (
                        <button 
                            key={t}
                            onClick={() => setTimeframe(t)}
                            style={{
                                padding: '8px 24px', borderRadius: '11px', fontSize: '12px', fontWeight: '800', transition: 'all 0.2s', textTransform: 'uppercase',
                                backgroundColor: timeframe === t ? 'white' : 'transparent',
                                color: timeframe === t ? '#3b82f6' : '#64748b',
                                boxShadow: timeframe === t ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none',
                                border: 'none', cursor: 'pointer', letterSpacing: '0.05em'
                            }}
                        >{t}</button>
                    ))}
                </div>
            </header>

            {/* Platform Summary Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '40px' }}>
                <StatCard label="Total API Calls" value={stats.summary.totalApi?.toLocaleString()} sub="External Integrations" color="#3b82f6" icon="fa-bolt" />
                <StatCard label="AI Analyses" value={stats.summary.totalGemini?.toLocaleString()} sub="Gemini Flash 2.0" color="#8b5cf6" icon="fa-robot" />
                <StatCard label="Token Consumption" value={stats.summary.totalTokens?.toLocaleString()} sub="Aggregated Processing" color="#ec4899" icon="fa-coins" />
                <StatCard label="Estimated Cost" value={`$${estimatedCost}`} sub="Platform Overhead" color="#10b981" icon="fa-dollar-sign" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '32px' }}>
                
                {/* Detailed Table for APIs */}
                <div style={{ background: 'white', borderRadius: '28px', border: '1px solid #e2e8f0', padding: '32px', boxShadow: '0 4px 25px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>Integrated Services Audit</h2>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{stats.services.length} providers active</span>
                    </div>
                    
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
                                <th style={{ padding: '12px 0', fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Provider</th>
                                <th style={{ padding: '12px 0', fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>Volume</th>
                                <th style={{ padding: '12px 0', fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', textAlign: 'center' }}>Reliability</th>
                                <th style={{ padding: '12px 0', fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>Latency</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.services.sort((a:any,b:any) => b.totalCalls - a.totalCalls).map((s: ServiceAggregation) => {
                                const successCount = s.statusBreakdown['completed'] || 0;
                                const rate = ((successCount / s.totalCalls) * 100).toFixed(1);
                                return (
                                    <tr key={s.service} style={{ borderBottom: '1px solid #f8fafc' }}>
                                        <td style={{ padding: '18px 0', fontWeight: '700', fontSize: '14px', color: '#1e293b' }}>{s.service}</td>
                                        <td style={{ padding: '18px 0', color: '#475569', fontSize: '14px', textAlign: 'right', fontWeight: '600' }}>{s.totalCalls.toLocaleString()}</td>
                                        <td style={{ padding: '18px 0', textAlign: 'center' }}>
                                            <span style={{ 
                                                padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '800',
                                                backgroundColor: Number(rate) > 95 ? '#ecfdf5' : '#fef2f2',
                                                color: Number(rate) > 95 ? '#059669' : '#dc2626'
                                            }}>
                                                {rate}%
                                            </span>
                                        </td>
                                        <td style={{ padding: '18px 0', color: '#94a3b8', fontSize: '13px', textAlign: 'right', fontFamily: 'monospace' }}>{s.avgLatency.toFixed(0)}ms</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Gemini AI Deep Dive */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <div style={{ background: 'white', borderRadius: '28px', border: '1px solid #e2e8f0', padding: '32px', boxShadow: '0 4px 25px rgba(0,0,0,0.03)' }}>
                        <h2 style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', color: '#6366f1', marginBottom: '24px', letterSpacing: '0.1em' }}>Model Distribution</h2>
                        
                        {geminiService?.geminiDetails ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {Object.entries(geminiService.geminiDetails.models).map(([model, count]: [string, any]) => (
                                    <div key={model} style={{ padding: '16px', backgroundColor: '#f1f5f9', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '13px' }}>{model.replace('-preview', '')}</span>
                                            <span style={{ fontSize: '12px', fontWeight: '700', backgroundColor: '#6366f1', color: 'white', padding: '2px 8px', borderRadius: '6px' }}>{count}</span>
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Active production deployments</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#cbd5e1', fontSize: '13px' }}>No model data available.</div>
                        )}
                    </div>

                    <div style={{ background: 'white', borderRadius: '28px', border: '1px solid #e2e8f0', padding: '32px', boxShadow: '0 4px 25px rgba(0,0,0,0.03)' }}>
                        <h2 style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', color: '#ec4899', marginBottom: '24px', letterSpacing: '0.1em' }}>Intelligence Prompts</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {geminiService?.geminiDetails ? (
                                Object.entries(geminiService.geminiDetails.promptFiles).sort((a:any,b:any) => b[1]-a[1]).slice(0, 5).map(([type, count]: [string, any]) => (
                                    <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>{friendlyName(type)}</span>
                                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>{count}</span>
                                    </div>
                                ))
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            {/* Throughput Logic (Bar Chart) */}
            <div style={{ marginTop: '40px', background: '#0f172a', borderRadius: '32px', padding: '40px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '800', color: 'white', marginBottom: '40px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>System Throughput (Daily Volume)</h2>
                <div style={{ display: 'flex', alignItems: 'flex-end', height: '160px', gap: '12px', overflowX: 'auto' }}>
                    {stats.timeSeries.map((p: TimeSeriesPoint) => {
                        const total = p.apiCalls + p.geminiCalls;
                        const maxVal = Math.max(...stats.timeSeries.map((x: any) => x.apiCalls + x.geminiCalls), 1);
                        const height = (total / maxVal) * 160;
                        return (
                            <div key={p.label} style={{ flex: 1, minWidth: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '100%', borderRadius: '4px', height: `${height}px`, backgroundColor: '#3b82f6', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ height: `${(p.geminiCalls/total)*height}px`, backgroundColor: '#a855f7', width: '100%', position: 'absolute', top: 0 }}></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div style={{ display: 'flex', gap: '24px', marginTop: '32px' }}>
                    <Legend color="#3b82f6" label="External APIs" />
                    <Legend color="#a855f7" label="Gemini Intelligence" />
                </div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ label: string, value: string, sub: string, color: string, icon: string }> = ({ label, value, sub, color, icon }) => (
    <div style={{ background: 'white', padding: '28px', borderRadius: '28px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
                <p style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</p>
                <h3 style={{ margin: '0', fontSize: '28px', fontWeight: '900', color: '#0f172a' }}>{value}</h3>
            </div>
            <div style={{ width: '44px', height: '44px', borderRadius: '14px', backgroundColor: `${color}10`, color: color, display: 'flex', alignItems: 'center', justifyCenter: 'center', fontSize: '20px' }}>
                <i className={`fa-solid ${icon}`} style={{ margin: 'auto' }}></i>
            </div>
        </div>
        <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>{sub}</p>
    </div>
);

const Legend: React.FC<{ color: string, label: string }> = ({ color, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: color }}></div> {label}
    </div>
);

const friendlyName = (path: string) => path.replace('.ts', '').split('/').pop()?.replace(/([A-Z])/g, ' $1').trim() || 'Custom Analysis';

export default CostDashboardTab;
