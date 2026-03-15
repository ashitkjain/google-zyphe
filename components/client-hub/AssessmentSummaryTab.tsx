
import React, { useState, useMemo, useCallback } from 'react';
import { AIAssessment } from '../../services/firebase/ai_assessment';
import { LLMCallEvent } from '../../types/ai';
import { executeGeminiRequest, FLASH_MODEL } from '../../services/geminiService';
import { getAssessmentSummaryPrompt, assessmentSummarySchema, AssessmentSummaryResult, AssessmentDataForPrompt } from '../../prompts/property/assessmentSummary';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase/config';

interface AssessmentSummaryTabProps {
    assessments: Record<string, AIAssessment>;
    userNames: Record<string, string>;
    properties: Array<{ zpid: string; city?: string; address: string }>;
}

// ── Helper: group assessments into ISO week buckets ─────────────────────────────
function getISOWeek(d: Date): string {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const week1 = new Date(date.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function toDate(d: any): Date {
    if (!d) return new Date(0);
    if (d.toDate) return d.toDate();                          // Firestore Timestamp with prototype
    if (typeof d === 'object' && d.seconds != null) {         // serialized Timestamp (lost prototype)
        return new Date(d.seconds * 1000 + (d.nanoseconds || 0) / 1e6);
    }
    return new Date(d);
}

/** Return the best available date for an assessment entry */
function assessmentDate(a: any): Date {
    return toDate(a.last_update_date || a.create_date);
}

const CACHE_KEY = 'zyphe_assessment_summary';

const AssessmentSummaryTab: React.FC<AssessmentSummaryTabProps> = ({ assessments, userNames, properties }) => {
    const [aiSummary, setAiSummary] = useState<AssessmentSummaryResult | null>(() => {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                return parsed.data || null;
            }
        } catch (_) { /* ignore */ }
        return null;
    });
    const [cachedAt, setCachedAt] = useState<string | null>(() => {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                return parsed.cachedAt || null;
            }
        } catch (_) { /* ignore */ }
        return null;
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedSection, setExpandedSection] = useState<string | null>('executive_overview');
    const [llmLogs, setLlmLogs] = useState<LLMCallEvent[]>([]);
    const [llmLogsLoaded, setLlmLogsLoaded] = useState(false);

    // ── Computed Statistics ─────────────────────────────────────────────────────
    const assessmentList = useMemo(() => Object.values(assessments), [assessments]);

    const stats = useMemo(() => {
        const total = properties.length;
        const assessed = assessmentList.filter(a => a.assessment).length;
        const good = assessmentList.filter(a => a.assessment === 'good').length;
        const bad = assessmentList.filter(a => a.assessment === 'bad').length;
        const other = assessmentList.filter(a => a.assessment === 'other').length;
        const withComments = assessmentList.filter(a => a.comment && a.comment.trim().length > 0).length;
        const pending = total - assessed;
        const accuracy = good + bad > 0 ? Math.round((good / (good + bad)) * 100) : 0;

        return { total, assessed, good, bad, other, withComments, pending, accuracy };
    }, [assessmentList, properties]);

    // ── Per-Auditor Stats ────────────────────────────────────────────────────────
    const auditorStats = useMemo(() => {
        const map: Record<string, {
            total: number; good: number; bad: number; other: number;
            withComments: number; weeklyMap: Record<string, number>;
        }> = {};

        assessmentList.forEach(a => {
            if (!a.auditor || !a.assessment) return;
            if (!map[a.auditor]) map[a.auditor] = { total: 0, good: 0, bad: 0, other: 0, withComments: 0, weeklyMap: {} };
            const entry = map[a.auditor];
            entry.total++;
            if (a.assessment === 'good') entry.good++;
            if (a.assessment === 'bad') entry.bad++;
            if (a.assessment === 'other') entry.other++;
            if (a.comment && a.comment.trim().length > 0) entry.withComments++;

            const date = assessmentDate(a);
            const week = getISOWeek(date);
            entry.weeklyMap[week] = (entry.weeklyMap[week] || 0) + 1;
        });

        return Object.entries(map)
            .map(([uid, s]) => ({
                uid,
                name: userNames[uid] || 'Unknown',
                ...s,
                weeklyActivity: Object.entries(s.weeklyMap)
                    .map(([week, count]) => ({ week, count }))
                    .sort((a, b) => a.week.localeCompare(b.week))
            }))
            .sort((a, b) => b.total - a.total);
    }, [assessmentList, userNames]);

    // ── Per-City Stats ───────────────────────────────────────────────────────────
    const cityStats = useMemo(() => {
        const cityMap: Record<string, { total: number; assessed: number; good: number; bad: number }> = {};

        properties.forEach(p => {
            const city = p.city || 'Other';
            if (!cityMap[city]) cityMap[city] = { total: 0, assessed: 0, good: 0, bad: 0 };
            cityMap[city].total++;
            const a = assessments[p.zpid];
            if (a?.assessment) {
                cityMap[city].assessed++;
                if (a.assessment === 'good') cityMap[city].good++;
                if (a.assessment === 'bad') cityMap[city].bad++;
            }
        });

        return Object.entries(cityMap)
            .map(([city, s]) => ({ city, ...s, pending: s.total - s.assessed }))
            .sort((a, b) => b.pending - a.pending);
    }, [properties, assessments]);

    // ── Weekly Overall ────────────────────────────────────────────────────────────
    const weeklyActivity = useMemo(() => {
        const weekMap: Record<string, number> = {};
        assessmentList.forEach(a => {
            if (!a.assessment) return;
            const date = assessmentDate(a);
            if (date.getTime() === 0) return;  // no usable date at all
            const week = getISOWeek(date);
            weekMap[week] = (weekMap[week] || 0) + 1;
        });
        return Object.entries(weekMap)
            .map(([week, count]) => ({ week, count }))
            .sort((a, b) => a.week.localeCompare(b.week));
    }, [assessmentList]);

    // ── Recent "bad" comments for AI analysis ────────────────────────────────────
    const recentBadComments = useMemo(() => {
        return assessmentList
            .filter(a => a.comment && a.comment.trim().length > 0)
            .sort((a, b) => assessmentDate(b).getTime() - assessmentDate(a).getTime())
            .slice(0, 50)
            .map(a => ({
                auditor: userNames[a.auditor] || 'Unknown',
                address: a.propertyAddress || a.mlsid,
                assessment: a.assessment,
                comment: a.comment,
                date: assessmentDate(a).toISOString().split('T')[0]
            }));
    }, [assessmentList, userNames]);

    // ── ALL bad-assessment comments (no limit) — for image discrepancy analysis ──
    const allBadComments = useMemo(() => {
        return assessmentList
            .filter(a => a.assessment === 'bad' && a.comment && a.comment.trim().length > 0)
            .sort((a, b) => assessmentDate(b).getTime() - assessmentDate(a).getTime())
            .map(a => ({
                auditor: userNames[a.auditor] || 'Unknown',
                address: a.propertyAddress || a.mlsid,
                comment: a.comment,
                date: assessmentDate(a).toISOString().split('T')[0]
            }));
    }, [assessmentList, userNames]);

    // ── Fetch LLM logs (lazy) ─────────────────────────────────────────────────────
    const fetchLlmLogs = useCallback(async () => {
        if (llmLogsLoaded) return llmLogs;
        try {
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            const q = query(
                collection(db, 'llm_call_events'),
                orderBy('timestamp', 'desc')
            );
            const snapshot = await getDocs(q);
            const logs = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as LLMCallEvent))
                .filter(l => {
                    const ts = l.timestamp?.toDate?.() || new Date(l.timestamp);
                    return ts.getTime() >= thirtyDaysAgo;
                });
            setLlmLogs(logs);
            setLlmLogsLoaded(true);
            return logs;
        } catch (e: any) {
            console.warn('[AssessmentSummary] Could not fetch LLM logs:', e.message);
            setLlmLogsLoaded(true);
            return [];
        }
    }, [llmLogsLoaded, llmLogs]);

    // ── Generate AI Summary ──────────────────────────────────────────────────────
    const handleGenerateSummary = async () => {
        setLoading(true);
        setError(null);
        try {
            const logs = await fetchLlmLogs();

            // Build LLM stats from logs
            const promptCounts: Record<string, { count: number; failCount: number }> = {};
            let totalCost = 0;
            let completedCalls = 0;
            let failedCalls = 0;

            logs.forEach(l => {
                const key = l.prompt_filename || 'unknown';
                if (!promptCounts[key]) promptCounts[key] = { count: 0, failCount: 0 };
                promptCounts[key].count++;
                if (l.status === 'completed') completedCalls++;
                if (l.status === 'failed') {
                    failedCalls++;
                    promptCounts[key].failCount++;
                }
                if (l.estimated_cost) totalCost += l.estimated_cost;
            });

            const topPrompts = Object.entries(promptCounts)
                .map(([prompt, data]) => ({ prompt, ...data }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            const llmStats = {
                totalCalls: logs.length,
                completedCalls,
                failedCalls,
                topPrompts,
                avgCostPerCall: logs.length > 0 ? Number((totalCost / logs.length).toFixed(6)) : 0,
                totalCost: Number(totalCost.toFixed(4))
            };

            const promptData: AssessmentDataForPrompt = {
                totalProperties: stats.total,
                totalAssessed: stats.assessed,
                totalPending: stats.pending,
                goodCount: stats.good,
                badCount: stats.bad,
                otherCount: stats.other,
                totalWithComments: stats.withComments,
                auditorBreakdown: auditorStats.map(a => ({
                    name: a.name,
                    total: a.total,
                    good: a.good,
                    bad: a.bad,
                    other: a.other,
                    withComments: a.withComments,
                    weeklyActivity: a.weeklyActivity
                })),
                cityBreakdown: cityStats.map(c => ({
                    city: c.city,
                    total: c.total,
                    assessed: c.assessed,
                    pending: c.pending,
                    good: c.good,
                    bad: c.bad
                })),
                weeklyOverallActivity: weeklyActivity,
                recentComments: recentBadComments,
                allBadComments,
                llmStats
            };

            const prompt = getAssessmentSummaryPrompt(promptData);

            const result = await executeGeminiRequest<AssessmentSummaryResult>({
                model: FLASH_MODEL,
                contents: prompt,
                config: { temperature: 0.5 },
                promptFilename: 'assessmentSummary.ts',
                extractResultJson: true,
                schema: assessmentSummarySchema
            });

            setAiSummary(result.data);

            // Persist to localStorage
            const now = new Date().toISOString();
            setCachedAt(now);
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({ data: result.data, cachedAt: now }));
            } catch (_) { /* quota exceeded — ignore */ }
        } catch (e: any) {
            console.error('[AssessmentSummary] Generation failed:', e);
            setError(e.message || 'Failed to generate summary');
        } finally {
            setLoading(false);
        }
    };

    // ── Mini chart: bar chart using pure CSS ────────────────────────────────────
    const maxWeeklyCount = Math.max(...weeklyActivity.map(w => w.count), 1);

    // ── Ring chart helper ─────────────────────────────────────────────────────────
    const RingSegment = ({ value, total, color, label }: { value: number; total: number; color: string; label: string }) => {
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
            <div className="flex items-center gap-3 min-w-[120px]">
                <div
                    className={`w-10 h-10 rounded-full border-[3px] flex items-center justify-center text-[10px] font-black`}
                    style={{ borderColor: color, color }}
                >
                    {pct}%
                </div>
                <div>
                    <div className="text-xs font-black text-slate-700">{value}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</div>
                </div>
            </div>
        );
    };

    // ── UI Sections ──────────────────────────────────────────────────────────────
    const sections = aiSummary ? [
        { key: 'executive_overview', icon: 'fa-chart-line', title: 'Executive Overview', content: aiSummary.executive_overview, color: 'indigo' },
        { key: 'quality_analysis', icon: 'fa-bullseye', title: 'Quality Analysis', content: aiSummary.quality_analysis, color: 'emerald' },
        { key: 'auditor_performance', icon: 'fa-users', title: 'Auditor Performance', content: aiSummary.auditor_performance, color: 'violet' },
        { key: 'ai_issues_found', icon: 'fa-bug', title: 'AI Issues Found', content: aiSummary.ai_issues_found, color: 'rose' },
        { key: 'ai_image_evaluation', icon: 'fa-eye', title: 'Pure AI Image Evaluation', content: aiSummary.ai_image_evaluation, color: 'cyan' },
        { key: 'weekly_trends', icon: 'fa-calendar-week', title: 'Weekly Trends', content: aiSummary.weekly_trends, color: 'sky' },
        { key: 'city_coverage', icon: 'fa-city', title: 'City Coverage', content: aiSummary.city_coverage, color: 'amber' },
        { key: 'llm_performance', icon: 'fa-microchip', title: 'LLM Performance', content: aiSummary.llm_performance, color: 'teal' },
    ] : [];

    return (
        <div className="space-y-8">
            {/* ── Header Metrics ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
                {[
                    { label: 'Total Properties', value: stats.total, icon: 'fa-house', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-900' },
                    { label: 'Assessed', value: stats.assessed, icon: 'fa-check-circle', bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700' },
                    { label: 'Pending', value: stats.pending, icon: 'fa-clock', bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700' },
                    { label: 'Good', value: stats.good, icon: 'fa-thumbs-up', bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700' },
                    { label: 'Bad', value: stats.bad, icon: 'fa-thumbs-down', bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-700' },
                    { label: 'Other', value: stats.other, icon: 'fa-minus-circle', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600' },
                    { label: 'With Comments', value: stats.withComments, icon: 'fa-comment', bg: 'bg-violet-50', border: 'border-violet-100', text: 'text-violet-700' },
                    { label: 'AI Accuracy', value: `${stats.accuracy}%`, icon: 'fa-bullseye', bg: stats.accuracy >= 80 ? 'bg-emerald-50' : 'bg-amber-50', border: stats.accuracy >= 80 ? 'border-emerald-100' : 'border-amber-100', text: stats.accuracy >= 80 ? 'text-emerald-700' : 'text-amber-700' },
                ].map(card => (
                    <div key={card.label} className={`${card.bg} border ${card.border} rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm`}>
                        <i className={`fa-solid ${card.icon} text-lg ${card.text} opacity-60`} />
                        <div className={`text-2xl font-black ${card.text}`}>{card.value}</div>
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] text-center leading-tight">{card.label}</div>
                    </div>
                ))}
            </div>

            {/* ── Auditor Leaderboard ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                            <i className="fa-solid fa-ranking-star text-violet-600 text-xs" />
                        </div>
                        <div className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Auditor Leaderboard</div>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                        {auditorStats.length > 0 ? auditorStats.map((a, idx) => {
                            const badRate = a.total > 0 ? Math.round((a.bad / a.total) * 100) : 0;
                            const commentRate = a.total > 0 ? Math.round((a.withComments / a.total) * 100) : 0;
                            return (
                                <div key={a.uid} className="px-8 py-4 flex items-center gap-5 hover:bg-slate-50/50 transition-colors">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${idx === 0 ? 'bg-amber-100 text-amber-700 border border-amber-200' : idx === 1 ? 'bg-slate-200 text-slate-600' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-black text-slate-800 truncate">{a.name}</div>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[9px] font-bold text-slate-400">
                                                <span className="text-emerald-600">{a.good}</span>/
                                                <span className="text-rose-500">{a.bad}</span>/
                                                <span className="text-slate-500">{a.other}</span>
                                            </span>
                                            <span className="text-[8px] font-bold text-violet-500">{commentRate}% commented</span>
                                            <span className="text-[8px] font-bold text-rose-400">{badRate}% issues found</span>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-lg font-black text-slate-900">{a.total}</div>
                                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Assessed</div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="py-16 text-center text-slate-400">
                                <i className="fa-solid fa-users-slash text-3xl mb-3 opacity-30" />
                                <p className="text-[10px] font-black uppercase tracking-widest">No auditor data yet</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Weekly Activity Chart ─────────────────────────────────────── */}
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center">
                            <i className="fa-solid fa-chart-bar text-sky-600 text-xs" />
                        </div>
                        <div className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Weekly Assessment Velocity</div>
                    </div>
                    <div className="p-8">
                        {weeklyActivity.length > 0 ? (
                            <div className="flex items-end gap-2 h-[300px]">
                                {weeklyActivity.slice(-16).map(w => {
                                    const height = Math.max((w.count / maxWeeklyCount) * 100, 4);
                                    return (
                                        <div key={w.week} className="flex-1 flex flex-col items-center gap-2 group cursor-default">
                                            <div className="text-[9px] font-black text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">{w.count}</div>
                                            <div className="w-full flex-1 flex items-end">
                                                <div
                                                    className="w-full rounded-t-lg bg-gradient-to-t from-indigo-600 to-indigo-400 group-hover:from-indigo-700 group-hover:to-indigo-500 transition-all shadow-sm"
                                                    style={{ height: `${height}%` }}
                                                />
                                            </div>
                                            <div className="text-[7px] font-bold text-slate-400 truncate w-full text-center -rotate-45 origin-top-left ml-3 mt-1">
                                                {w.week.replace(/^\d{4}-/, '')}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[300px] text-slate-400">
                                <i className="fa-solid fa-chart-simple text-4xl mb-3 opacity-20" />
                                <p className="text-[10px] font-black uppercase tracking-widest">No weekly data yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── City Coverage ────────────────────────────────────────────────── */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                        <i className="fa-solid fa-city text-amber-600 text-xs" />
                    </div>
                    <div className="text-[11px] font-black text-slate-700 uppercase tracking-widest">City Coverage Report</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
                    {cityStats.map(c => {
                        const pct = c.total > 0 ? Math.round((c.assessed / c.total) * 100) : 0;
                        return (
                            <div key={c.city} className="border border-slate-100 rounded-2xl p-4 hover:shadow-sm transition-all bg-gradient-to-br from-white to-slate-50">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-black text-slate-800 truncate">{c.city}</span>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${pct === 100 ? 'bg-emerald-100 text-emerald-700' : pct > 50 ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {pct}%
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                                    <div
                                        className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <div className="flex items-center gap-4 text-[9px] font-bold text-slate-400">
                                    <span>{c.assessed}/{c.total} assessed</span>
                                    {c.pending > 0 && <span className="text-amber-600">{c.pending} pending</span>}
                                    <span className="text-emerald-600">{c.good} ✓</span>
                                    <span className="text-rose-500">{c.bad} ✗</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Quality Distribution Ring ────────────────────────────────────── */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm px-10 py-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <i className="fa-solid fa-chart-pie text-emerald-600 text-xs" />
                    </div>
                    <div className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Quality Distribution</div>
                </div>
                <div className="flex flex-wrap items-center gap-8">
                    <RingSegment value={stats.good} total={stats.assessed} color="#10b981" label="Good" />
                    <RingSegment value={stats.bad} total={stats.assessed} color="#f43f5e" label="Bad" />
                    <RingSegment value={stats.other} total={stats.assessed} color="#94a3b8" label="Other" />
                    <div className="ml-auto text-right">
                        <div className="text-4xl font-black text-slate-900">{stats.accuracy}<span className="text-xl text-slate-300">%</span></div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">AI Accuracy Rate</div>
                    </div>
                </div>
            </div>

            {/* ── Generate AI Summary Button ───────────────────────────────────── */}
            <div className="flex justify-center">
                <button
                    onClick={handleGenerateSummary}
                    disabled={loading}
                    className={`group flex items-center gap-4 px-12 py-5 rounded-[2rem] text-sm font-black uppercase tracking-widest transition-all shadow-xl
                        ${loading
                            ? 'bg-slate-200 text-slate-400 cursor-wait shadow-none'
                            : 'bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white hover:scale-[1.02] active:scale-[0.98] shadow-indigo-200 hover:shadow-2xl hover:shadow-indigo-300'
                        }`}
                >
                    {loading ? (
                        <>
                            <i className="fa-solid fa-spinner animate-spin text-lg" />
                            <span>Generating AI Summary...</span>
                        </>
                    ) : (
                        <>
                            <i className="fa-solid fa-wand-magic-sparkles text-lg group-hover:rotate-12 transition-transform" />
                            <span>{aiSummary ? 'Regenerate AI Summary' : 'Generate AI Summary'}</span>
                        </>
                    )}
                </button>
                {cachedAt && !loading && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl">
                        <i className="fa-solid fa-clock-rotate-left text-[10px] text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-500">
                            Cached {new Date(cachedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-700 text-sm font-medium text-center">
                    <i className="fa-solid fa-triangle-exclamation mr-2" />{error}
                </div>
            )}

            {/* ── AI Summary Sections ──────────────────────────────────────────── */}
            {aiSummary && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                            <i className="fa-solid fa-robot text-white text-xs" />
                        </div>
                        <div className="text-[11px] font-black text-slate-700 uppercase tracking-widest">AI-Powered Executive Report</div>
                    </div>

                    {sections.map(sec => {
                        const isOpen = expandedSection === sec.key;
                        const bgMap: Record<string, string> = {
                            indigo: 'from-indigo-50 to-white border-indigo-100',
                            emerald: 'from-emerald-50 to-white border-emerald-100',
                            violet: 'from-violet-50 to-white border-violet-100',
                            rose: 'from-rose-50 to-white border-rose-100',
                            sky: 'from-sky-50 to-white border-sky-100',
                            amber: 'from-amber-50 to-white border-amber-100',
                            teal: 'from-teal-50 to-white border-teal-100',
                            cyan: 'from-cyan-50 to-white border-cyan-100',
                        };
                        const iconColors: Record<string, string> = {
                            indigo: 'text-indigo-600 bg-indigo-100',
                            emerald: 'text-emerald-600 bg-emerald-100',
                            violet: 'text-violet-600 bg-violet-100',
                            rose: 'text-rose-600 bg-rose-100',
                            sky: 'text-sky-600 bg-sky-100',
                            amber: 'text-amber-600 bg-amber-100',
                            teal: 'text-teal-600 bg-teal-100',
                            cyan: 'text-cyan-600 bg-cyan-100',
                        };
                        return (
                            <div
                                key={sec.key}
                                className={`rounded-[2rem] border overflow-hidden transition-all bg-gradient-to-br ${bgMap[sec.color] || bgMap.indigo} shadow-sm`}
                            >
                                <button
                                    onClick={() => setExpandedSection(isOpen ? null : sec.key)}
                                    className="w-full px-8 py-5 flex items-center gap-4 text-left hover:bg-white/40 transition-all"
                                >
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconColors[sec.color] || iconColors.indigo}`}>
                                        <i className={`fa-solid ${sec.icon} text-sm`} />
                                    </div>
                                    <div className="flex-1 text-sm font-black text-slate-800 uppercase tracking-wider">{sec.title}</div>
                                    <i className={`fa-solid fa-chevron-down text-xs text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isOpen && (
                                    <div className="px-8 pb-8 pt-2">
                                        <div className="text-sm text-slate-700 font-medium leading-[1.85] whitespace-pre-wrap">
                                            {sec.content}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* ── Image Discrepancy Properties ─────────────────────────── */}
                    {aiSummary.image_discrepancy_properties && aiSummary.image_discrepancy_properties.length > 0 && (
                        <div className="rounded-[2rem] border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-slate-50 shadow-sm overflow-hidden">
                            <div className="px-8 py-5 border-b border-cyan-100/50 flex items-center gap-4">
                                <div className="w-9 h-9 rounded-xl bg-cyan-600 flex items-center justify-center">
                                    <i className="fa-solid fa-magnifying-glass-chart text-white text-sm" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-black text-slate-800 uppercase tracking-wider">AI Image Discrepancies</div>
                                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">Properties where AI image analysis differs from auditor observations</div>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-cyan-100 rounded-xl border border-cyan-200">
                                    <span className="text-2xl font-black text-cyan-700">{aiSummary.image_discrepancy_count}</span>
                                    <span className="text-[8px] font-black text-cyan-500 uppercase tracking-widest leading-tight">Properties<br/>Flagged</span>
                                </div>
                            </div>
                            <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-100">
                                {aiSummary.image_discrepancy_properties.map((prop, idx) => (
                                    <div key={idx} className="px-8 py-4 flex items-start gap-4 hover:bg-white/60 transition-colors">
                                        <div className="w-7 h-7 rounded-lg bg-cyan-100 border border-cyan-200 flex items-center justify-center text-[10px] font-black text-cyan-700 shrink-0 mt-0.5">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-black text-slate-800 truncate">{prop.address}</div>
                                            <div className="text-xs text-slate-500 font-medium leading-relaxed mt-1">{prop.discrepancy}</div>
                                        </div>
                                        <div className="shrink-0 mt-1">
                                            <i className="fa-solid fa-triangle-exclamation text-amber-400 text-xs" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recommendations */}
                    {aiSummary.recommendations && aiSummary.recommendations.length > 0 && (
                        <div className="rounded-[2rem] border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 shadow-sm overflow-hidden">
                            <div className="px-8 py-5 flex items-center gap-4 border-b border-indigo-100/50">
                                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
                                    <i className="fa-solid fa-lightbulb text-white text-sm" />
                                </div>
                                <div className="text-sm font-black text-slate-800 uppercase tracking-wider">Recommendations</div>
                            </div>
                            <div className="px-8 py-6 space-y-4">
                                {aiSummary.recommendations.map((rec, idx) => (
                                    <div key={idx} className="flex items-start gap-4">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black shrink-0 mt-0.5">
                                            {idx + 1}
                                        </div>
                                        <p className="text-sm text-slate-700 font-medium leading-relaxed">{rec}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AssessmentSummaryTab;
