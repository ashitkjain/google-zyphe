import React from 'react';
import PropertyHeader from './PropertyHeader';
import PropertyImages from './PropertyImages';
import PropertyFacts from './PropertyFacts';
import MobilityScores from './MobilityScores';
import SchoolScores from './SchoolScores';
import ClimateRiskSection from './ClimateRiskSection';
import PropertyMaps from './PropertyMaps';
import Logo from './Logo';
import CustomAIAnalysis from './CustomAIAnalysis';
import ComprehensiveAnalysis from './ComprehensiveAnalysis';

import ChatInterface from './ChatInterface';
import { PropertyData, CustomAIAnalysisResult, ComprehensiveAnalysisResult, LogEntry } from '../types';

interface ExploreTabProps {
    propertyData: PropertyData | null;
    loading: boolean;
    loadingSublabel: string;
    viewMode: 'main' | 'visual-report' | 'comprehensive-report';
    setViewMode: (mode: 'main' | 'visual-report' | 'comprehensive-report') => void;
    imagesLoading: boolean;
    isFavorited: boolean;
    onToggleFavorite: () => void;
    onRunCustomAnalysis: (force?: boolean) => void;
    customAnalysis: CustomAIAnalysisResult | null;
    customAnalysisLoading: boolean;
    onRunComprehensive: (force?: boolean) => void;
    comprehensiveAnalysis: ComprehensiveAnalysisResult | null;
    comprehensiveLoading: boolean;
    onUpdateAnalysis: (updated: any) => void;
    addLog: (service: string, meta: any, content: any) => void;
    logs: LogEntry[];
    userRole?: string;
    searchBar?: React.ReactNode;
}

const ExploreTab: React.FC<ExploreTabProps> = ({
    propertyData,
    loading,
    loadingSublabel,
    viewMode,
    setViewMode,
    imagesLoading,
    isFavorited,
    onToggleFavorite,
    onRunCustomAnalysis,
    customAnalysis,
    customAnalysisLoading,
    onRunComprehensive,
    comprehensiveAnalysis,
    comprehensiveLoading,
    onUpdateAnalysis,
    addLog,
    logs,
    userRole,
    searchBar
}) => {
    if (loading && !propertyData) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                <div className="animate-pulse">
                    <i className="fa-solid fa-house-signal text-8xl text-indigo-200"></i>
                </div>
                <h2 className="text-2xl font-black text-slate-900 mt-10">Analyzing Property DNA...</h2>
                <p className="text-sm font-black text-indigo-600 mt-4 uppercase tracking-[0.2em]">{loadingSublabel}</p>
            </div>
        );
    }

    return (
        <>
            {viewMode === 'main' && (
                <div className="space-y-10 animate-in fade-in duration-500">
                    {searchBar && (
                        <div className="max-w-4xl mx-auto pt-8 pb-4 px-4 sticky top-0 z-[40] bg-slate-50/80 backdrop-blur-md">
                            {searchBar}
                        </div>
                    )}
                    {propertyData ? (
                        <>
                            <PropertyHeader
                                data={propertyData}
                                isFavorited={isFavorited}
                                onToggleFavorite={onToggleFavorite}
                                onRunAnalysis={() => onRunCustomAnalysis(false)}
                            />
                            <PropertyImages images={propertyData.images} loading={imagesLoading} />
                            <PropertyFacts facts={propertyData.resoFacts} />
                            <MobilityScores data={propertyData} />
                            <SchoolScores data={propertyData} />
                            <ClimateRiskSection data={propertyData} />
                            <PropertyMaps mapZoomIn={propertyData.mapZoomIn} mapZoomOut={propertyData.mapZoomOut} />
                        </>
                    ) : (
                        <div className="max-w-4xl mx-auto py-6 text-center space-y-12">
                            <p className="text-2xl text-slate-500 font-medium leading-relaxed">The world's most advanced property analysis suite.</p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                                {[
                                    { title: 'For Buyers', icon: 'fa-shopping-bag', color: 'indigo', desc: "Navigate the market with unmatched clarity. Our AI cross-references public records, maps and property pictures, and resident sentiment to uncover hidden structural risks, neighborhood, community pulse on what people like and don't, and score lifestyle compatibility for your family." },
                                    { title: 'For Sellers', icon: 'fa-money-bill-trend-up', color: 'slate', desc: 'Discover how to maximize your home value with AI-driven staging and market insights.' },
                                    { title: 'For Realtors', icon: 'fa-briefcase', color: 'indigo', desc: 'Provide comprehensive home report, concierge chat box to your clients and track their preferences. Generate professional multi-source reports and compelling marketing copy in seconds.' }
                                ].map((item, i) => (
                                    <div key={i} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 hover:-translate-y-2 transition-all group">
                                        <div className={`w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                            <i className={`fa-solid ${item.icon} text-2xl`}></i>
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 mb-4">{item.title}</h3>
                                        <p className="text-slate-500 text-sm leading-relaxed font-medium">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {viewMode === 'visual-report' && (
                <CustomAIAnalysis
                    analysis={customAnalysis}
                    loading={customAnalysisLoading}
                    onBack={() => setViewMode('main')}
                    onRefresh={() => onRunCustomAnalysis(true)}
                    onRunComprehensive={() => onRunComprehensive(false)}
                    comprehensiveResult={comprehensiveAnalysis}
                    hasImages={(propertyData?.images?.length || 0) > 0}
                    userRole={userRole}
                    propertyImages={propertyData?.images}
                    zpid={propertyData?.zpid}
                    propertyData={propertyData}
                    onUpdateAnalysis={onUpdateAnalysis}
                    addLog={addLog}
                    isFavorited={isFavorited}
                    onToggleFavorite={onToggleFavorite}
                />
            )}

            {viewMode === 'comprehensive-report' && (
                <ComprehensiveAnalysis
                    analysis={comprehensiveAnalysis}
                    loading={comprehensiveLoading}
                    onBack={() => setViewMode('visual-report')}
                    isFavorited={isFavorited}
                    onToggleFavorite={onToggleFavorite}
                />
            )}

            {propertyData && (
                <ChatInterface property={propertyData} visual={customAnalysis} comprehensive={comprehensiveAnalysis} />
            )}
        </>
    );
};

export default ExploreTab;
