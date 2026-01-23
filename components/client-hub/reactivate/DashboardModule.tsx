import React, { useState, useEffect } from 'react';
import {
    getUserReactivationSummaries,
    getAllUserLeadPlans,
    getAllUserMarketContexts
} from '../../../services/firebase/reactivation';
import { LeadReactivationResult, LeadPlanRecord, ReactivationAnalysisSummary } from '../../../types/ai';
import ReactivationVisualizer from './ReactivationVisualizer';

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

    if (!aggregatedData) {
        return (
            <div className="text-center py-20 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-indigo-500/5">
                <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="fa-solid fa-folder-open text-3xl"></i>
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">No Active Plans</h3>
                <p className="text-slate-400 max-w-sm mx-auto">Upload your CSV in the <b>Automated</b> tab to generate interactive reactivation plans.</p>
            </div>
        );
    }

    return (
        <ReactivationVisualizer
            result={aggregatedData}
            showReset={false}
            title="Portfolio Reactivation Dashboard"
        />
    );
};

export default DashboardModule;
