import React, { useState, useEffect } from 'react';
import {
    getUserReactivationSummaries,
    getAllUserLeadPlans,
    getAllUserMarketContexts
} from '../../../services/firebase/reactivation';
import { LeadReactivationResult, LeadPlanRecord, ReactivationAnalysisSummary } from '../../../types/ai';
import ReactivationVisualizer from './ReactivationVisualizer';
import ActionCenterWidget from './components/ActionCenterWidget';
import SentimentAnalyzer from './components/SentimentAnalyzer';
import BusinessImpactWidget from './components/BusinessImpactWidget';
import CreativeStudioWidget from './components/CreativeStudioWidget';

interface DashboardModuleProps {
    realtorId: string;
}

const DashboardModule: React.FC<DashboardModuleProps> = ({ realtorId }) => {
    const [loading, setLoading] = useState(true);
    const [aggregatedData, setAggregatedData] = useState<LeadReactivationResult | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [summaries, allPlans, allMarkets] = await Promise.all([
                    getUserReactivationSummaries(realtorId),
                    getAllUserLeadPlans(realtorId),
                    getAllUserMarketContexts(realtorId)
                ]);

                console.log('Dashboard Data Load:', {
                    userId: realtorId,
                    summariesCount: summaries.length,
                    plansCount: allPlans.length,
                    marketsCount: allMarkets.length
                });

                if (summaries.length === 0) {
                    console.log('No summaries found for user:', realtorId);
                    setAggregatedData(null);
                    setLoading(false);
                    return;
                }

                // In-memory sorting since we removed DB-level orderBy to prevent index errors
                const sortedSummaries = [...summaries].sort((a, b) => {
                    const timeA = (a.created_date as any)?.seconds || 0;
                    const timeB = (b.created_date as any)?.seconds || 0;
                    return timeB - timeA;
                });

                const sortedPlans = [...allPlans].sort((a, b) => b.priority_score - a.priority_score);

                // Aggregate Data
                const totalLeads = sortedSummaries.reduce((acc, s) => acc + (s.summary?.total_leads || 0), 0);
                const highPriority = sortedPlans.filter(p => p.priority_score > 0.8).length;

                // Deduplicate Markets - keep the most recent context for each market name
                const marketMap = new Map<string, any>();
                allMarkets.forEach(m => {
                    if (!marketMap.has(m.market_name)) {
                        marketMap.set(m.market_name, {
                            market_name: m.market_name,
                            rates_trend: m.rates_trend,
                            inventory_trend: m.inventory_trend,
                            avg_days_on_market: m.avg_days_on_market,
                            buyer_leverage_notes: m.buyer_leverage_notes,
                            confidence: m.confidence
                        });
                    }
                });

                const latestRun = sortedSummaries[0];

                const result: LeadReactivationResult = {
                    summary: {
                        total_leads: totalLeads,
                        markets_detected: marketMap.size,
                        high_priority: highPriority,
                        primary_strategy: "Aggregated Portfolio Strategy",
                        recommended_daily_volume: latestRun.summary?.recommended_daily_volume || 0
                    },
                    global_settings: latestRun.global_settings,
                    market_context: Array.from(marketMap.values()),
                    lead_plans: sortedPlans
                };

                setAggregatedData(result);
            } catch (error) {
                console.error('Error loading dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [realtorId]);

    if (loading) {
        return (
            <div className="w-full h-96 flex items-center justify-center">
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-indigo-100 rounded-full"></div>
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                </div>
            </div>
        );
    }

    if (!aggregatedData || aggregatedData.lead_plans.length === 0) {
        return (
            <div className="text-center py-32 bg-white rounded-[3rem] border border-slate-100 shadow-2xl shadow-indigo-500/10 relative overflow-hidden group animate-in fade-in zoom-in-95 duration-700">
                {/* Decorative Background Elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent"></div>
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl group-hover:bg-indigo-100/50 transition-colors duration-1000"></div>

                <div className="relative space-y-10 max-w-xl mx-auto px-8">
                    <div className="relative mx-auto w-24 h-24">
                        <div className="absolute inset-0 bg-indigo-50 rounded-3xl rotate-6 group-hover:rotate-12 transition-transform duration-500"></div>
                        <div className="absolute inset-0 bg-white border border-indigo-100 rounded-3xl flex items-center justify-center shadow-sm group-hover:-translate-y-2 transition-transform duration-500">
                            <i className="fa-solid fa-bolt-lightning text-3xl text-indigo-500"></i>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">No Leads Being Reactivated</h3>
                        <p className="text-slate-500 text-base leading-relaxed">
                            Your reactivation intelligence pipeline is currently empty. Our AI is ready to analyze your stale leads and architect high-conversion comeback strategies.
                        </p>
                    </div>

                    <div className="inline-flex flex-col items-center gap-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600/50">Next Logical Step</p>
                        <div className="px-8 py-4 bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all duration-500">
                            <span className="text-xs font-black uppercase tracking-widest whitespace-nowrap">Upload Cold Leads in the "Automated" Tab</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <BusinessImpactWidget />

            <ActionCenterWidget onOpenLead={(id) => console.log('Open lead', id)} />

            <CreativeStudioWidget />

            <SentimentAnalyzer />

            <ReactivationVisualizer
                result={aggregatedData}
                showReset={false}
                title="Portfolio Reactivation Dashboard"
                agentId={realtorId}
            />
        </div>
    );
};

export default DashboardModule;
