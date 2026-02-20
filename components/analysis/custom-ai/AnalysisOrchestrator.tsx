import React, { useState, useEffect, useRef, useMemo } from 'react';
import { setCurrentPage } from '../../../services/analytics/posthog';
import {
    CustomAIAnalysisResult,
    ComprehensiveAnalysisResult
} from '../../../types';

export type TabType = 'interior' | 'rooms' | 'exterior_and_neighborhood' | 'neighborhood' | 'pulse' | 'quality' | 'investment' | 'bidding' | 'image_analysis' | 'deep_research' | 'context_graph' | 'satellitary';
import { APP_CONFIG } from '../../../config';
import { useAnalysisActions } from './hooks/useAnalysisActions';
import { EmptyState } from './components/CommonComponents';
import { InvestmentView } from './components/InvestmentView';
import { BiddingView } from './components/BiddingView';
import { QualityAnalysisView } from './components/QualityAnalysisView';
import { CommunityPulseView } from './components/CommunityPulseView';
import { DeepInvestmentView } from './components/DeepInvestmentView';
import { ImageAnalysisView } from './components/ImageAnalysisView';
import { InteriorView, RoomsView, ExteriorView } from './components/InteriorExteriorViews';
import { NeighborhoodView } from './components/NeighborhoodView';
import { AnalysisLoading, GeneralAnalysisLoading } from './components/AnalysisLoading';
import { HoverPreview } from './components/HoverPreview';
import { ContextGraphView } from './components/ContextGraphView';
import { StickyNotesLayer } from './components/StickyNotesLayer';
import SatellitaryView from './components/SatellitaryView';

interface Props {
    analysis: CustomAIAnalysisResult | null;
    loading: boolean;
    onBack: () => void;
    onRefresh: () => void;
    onRunComprehensive: () => void;
    comprehensiveResult: ComprehensiveAnalysisResult | null;
    mapUrl?: string;
    hasImages: boolean;
    userRole?: string;
    propertyImages?: string[];
    zpid?: string;
    propertyData?: any;
    onUpdateAnalysis: (updated: CustomAIAnalysisResult) => void;
    addLog: (service: string, meta: { type: 'request' | 'response' | 'error' | 'info' }, content: any, usage?: any) => void;
    isFavorited?: boolean;
    onToggleFavorite?: () => void;
}

const AnalysisOrchestrator: React.FC<Props> = ({
    analysis,
    loading,
    onBack,
    onRefresh,
    onRunComprehensive,
    comprehensiveResult,
    mapUrl,
    hasImages,
    userRole,
    propertyImages = [],
    zpid,
    propertyData,
    onUpdateAnalysis,
    addLog,
    isFavorited,
    onToggleFavorite
}) => {
    const role = (userRole as 'buyer' | 'seller' | 'realtor' | 'investor' | 'auditor') || 'buyer';
    const allowedTabs = (APP_CONFIG as any).roleTabs[role] || (APP_CONFIG as any).roleTabs.buyer;

    // Memoize the available tabs objects to avoid unnecessary re-renders and ensure stable first-tab lookup
    const tabs = useMemo(() => [
        { id: 'interior', label: 'Interior', icon: 'fa-couch' },
        { id: 'rooms', label: 'Rooms', icon: 'fa-star' },
        { id: 'exterior_and_neighborhood', label: 'Exterior', icon: 'fa-house' },
        { id: 'neighborhood', label: 'Neighborhood', icon: 'fa-map-location-dot' },
        { id: 'satellitary', label: 'Satellitary', icon: 'fa-satellite' },
        { id: 'pulse', label: 'Community Pulse', icon: 'fa-users-viewfinder' },
        { id: 'deep_research', label: 'Investment Research', icon: 'fa-magnifying-glass-chart' },
        { id: 'investment', label: 'Property Economics', icon: 'fa-chart-pie' },
        { id: 'image_analysis', label: 'Image by Image analysis', icon: 'fa-images' },
        { id: 'quality', label: 'Picture Quality Audit', icon: 'fa-camera-rotate' },
        { id: 'context_graph', label: 'Context Graph', icon: 'fa-diagram-project' },
    ].filter(tab => allowedTabs.includes(tab.id)), [allowedTabs]);

    // Initialize activeTab to the first TRULY available tab, fallback to 'interior'
    const [activeTab, setActiveTab] = useState<TabType>((tabs[0]?.id as TabType) || 'interior');

    // Keep activeTab in sync if role/tabs change and current tab becomes invalid
    useEffect(() => {
        if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
            setActiveTab(tabs[0].id as TabType);
        }
    }, [tabs, activeTab]);

    // Update PostHog super properties with the deepest sub-tab so every autocapture
    // click carries full page context (e.g. 'explore > Interior')
    useEffect(() => {
        const tabLabel = tabs.find(t => t.id === activeTab)?.label || activeTab;
        setCurrentPage(activeTab, `Explore > ${tabLabel}`);
    }, [activeTab, tabs]);

    // Hover preview state
    const [hoveredImage, setHoveredImage] = useState<string | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const previewTimerRef = useRef<number | null>(null);

    const {
        timer,
        qualityLoading,
        investmentLoading,
        biddingLoading,
        pulseLoading,
        deepLoading,
        handleRunQualityAnalysis,
        handleRunCommunityPulse,
        handleRunInvestmentResearch,
        handleRunBiddingStrategy,
        handleRunDeepInvestmentResearch,
        handleExtractContextGraph,
        handleReExtractContextGraph,
        graphLoading,
        graphResult
    } = useAnalysisActions(analysis, zpid, propertyData, propertyImages, onUpdateAnalysis, addLog, loading, comprehensiveResult);

    // Auto-trigger side effects when tabs change
    useEffect(() => {
        if (activeTab === 'quality' && !analysis?.image_quality_analysis && !qualityLoading && propertyImages.length > 0) {
            handleRunQualityAnalysis();
        }
    }, [activeTab, analysis?.image_quality_analysis, qualityLoading, propertyImages.length]);

    useEffect(() => {
        if (activeTab === 'investment' && (!analysis?.property_investment || !analysis?.general_market_intelligence) && !investmentLoading) {
            handleRunInvestmentResearch();
        }
    }, [activeTab, analysis?.property_investment, analysis?.general_market_intelligence, investmentLoading]);

    useEffect(() => {
        if (activeTab === 'pulse' && !analysis?.community_pulse && !pulseLoading) {
            handleRunCommunityPulse();
        }
    }, [activeTab, analysis?.community_pulse, pulseLoading]);

    useEffect(() => {
        if (activeTab === 'deep_research' && !analysis?.deep_investment_research && !deepLoading) {
            handleRunDeepInvestmentResearch();
        }
    }, [activeTab, analysis?.deep_investment_research, deepLoading]);

    useEffect(() => {
        if (activeTab === 'bidding' && !analysis?.bidding_strategy && !biddingLoading) {
            handleRunBiddingStrategy();
        }
    }, [activeTab, analysis?.bidding_strategy, biddingLoading]);

    useEffect(() => {
        if (activeTab === 'context_graph' && !graphResult && !graphLoading) {
            handleExtractContextGraph();
        }
    }, [activeTab, graphResult, graphLoading]);

    const clearPreviewTimer = () => {
        if (previewTimerRef.current) {
            window.clearTimeout(previewTimerRef.current);
            previewTimerRef.current = null;
        }
    };

    const hidePreviewImmediately = () => {
        clearPreviewTimer();
        setHoveredImage(null);
    };

    const onThumbnailMouseEnter = (image: string, e: React.MouseEvent) => {
        clearPreviewTimer();
        setHoveredImage(image);
        setMousePos({ x: e.clientX, y: e.clientY });
    };

    if (loading) return <GeneralAnalysisLoading timer={timer} />;
    if (!analysis) return null;


    return (
        <div className="space-y-8 pb-20 relative">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-3 px-6 py-3 bg-white border border-gray-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-gray-700 shadow-sm hover:shadow-md hover:bg-gray-50 transition-all group w-fit"
                    >
                        <i className="fa-solid fa-arrow-left transition-transform group-hover:-translate-x-1"></i>
                        Back
                    </button>
                    <div className="h-10 w-px bg-gray-200 hidden sm:block"></div>
                    <div className="flex flex-col gap-2">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                            {propertyData?.address || 'Visual AI Report'}
                        </h2>
                        {analysis.report_title && (
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">{analysis.report_title}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onToggleFavorite}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm ${isFavorited ? 'bg-rose-50 text-rose-500 border border-rose-100' : 'bg-white text-slate-300 border border-slate-200 hover:text-rose-400 hover:bg-rose-50/50'}`}
                        >
                            <i className={`${isFavorited ? 'fa-solid' : 'fa-regular'} fa-heart text-lg`}></i>
                        </button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <button onClick={onRefresh} className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-sm hover:shadow-md hover:bg-slate-50 transition-all group shadow-indigo-100">
                        <i className="fa-solid fa-rotate group-hover:rotate-180 transition-transform duration-500"></i> Refresh Analysis
                    </button>
                    <button onClick={onRunComprehensive} className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-indigo-700 to-gray-900 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:scale-[1.05] transition-all group">
                        <i className="fa-solid fa-file-invoice-dollar text-sm"></i> {comprehensiveResult ? 'Full Narrative Report' : 'Generate Full Report'}
                    </button>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 font-black uppercase tracking-widest">
                        <i className="fa-solid fa-bolt-lightning text-indigo-500"></i> Zyphe™ AI Intelligence
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex justify-center sm:justify-start">
                <div className="inline-flex bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm overflow-x-auto no-scrollbar max-w-full">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center gap-3 px-6 py-3 rounded-xl font-black transition-all text-[13px] whitespace-nowrap ${activeTab === tab.id ? 'bg-gradient-to-r from-indigo-700 to-gray-900 text-white shadow-lg' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                        >
                            <i className={`fa-solid ${tab.icon} ${activeTab === tab.id ? 'text-white' : 'text-gray-400'}`}></i>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px] relative">
                <StickyNotesLayer zpid={zpid || ''} activeTab={activeTab}>
                    {activeTab === 'interior' && <InteriorView data={analysis.home_interior} />}
                    {activeTab === 'rooms' && <RoomsView highlights={analysis.room_highlights} />}
                    {activeTab === 'exterior_and_neighborhood' && (
                        <ExteriorView
                            data={analysis.exterior_and_neighborhood}
                            streetViewAnalysis={propertyData?.streetViewAnalysis}
                        />
                    )}
                    {activeTab === 'neighborhood' && (
                        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {!analysis.neighborhood ? (
                                <EmptyState section="Neighborhood" />
                            ) : (
                                <NeighborhoodView
                                    data={analysis.neighborhood}
                                    mapZoomIn={propertyData?.mapZoomIn}
                                    mapZoomOut={propertyData?.mapZoomOut}
                                />
                            )}
                        </section>
                    )}
                    {activeTab === 'pulse' && (
                        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {pulseLoading ? (
                                <AnalysisLoading title="Social Sentiment..." subtitle="Aggregating neighborhood insights." timer={timer} address={propertyData?.address} icon="fa-users-viewfinder" />
                            ) : !analysis.community_pulse ? (
                                <EmptyState section="Community Pulse" />
                            ) : (
                                <CommunityPulseView data={analysis.community_pulse} />
                            )}
                        </section>
                    )}
                    {activeTab === 'quality' && (
                        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {qualityLoading ? (
                                <AnalysisLoading title="Picture Audit..." timer={timer} address={propertyData?.address} icon="fa-camera" />
                            ) : !analysis.image_quality_analysis ? (
                                <EmptyState section="Quality Audit" />
                            ) : (
                                <QualityAnalysisView
                                    data={analysis.image_quality_analysis}
                                    propertyImages={propertyImages}
                                    onMouseEnter={onThumbnailMouseEnter}
                                    onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                                    onMouseLeave={hidePreviewImmediately}
                                />
                            )}
                        </section>
                    )}
                    {activeTab === 'investment' && (
                        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {investmentLoading ? (
                                <AnalysisLoading title="Market Research..." subtitle="Scouring STR data and historicals." timer={timer} address={propertyData?.address} icon="fa-magnifying-glass-dollar" />
                            ) : (!analysis.property_investment) ? (
                                <EmptyState section="Investment Research" />
                            ) : (
                                <InvestmentView specific={analysis.property_investment} deepResearch={analysis.deep_investment_research} />
                            )}
                        </section>
                    )}
                    {activeTab === 'deep_research' && (
                        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {deepLoading ? (
                                <AnalysisLoading title="Deep Researching..." subtitle="Synthesizing city-wide investment perspectives." timer={timer} address={propertyData?.address} icon="fa-magnifying-glass-chart" />
                            ) : !analysis.deep_investment_research ? (
                                <EmptyState section="Investment Research" />
                            ) : (
                                <DeepInvestmentView data={analysis.deep_investment_research} />
                            )}
                        </section>
                    )}
                    {activeTab === 'bidding' && (
                        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {biddingLoading ? (
                                <AnalysisLoading title="Strategizing Offer..." subtitle="Analyzing DOM benchmarks and pressure." timer={timer} address={propertyData?.address} icon="fa-gavel" />
                            ) : !analysis.bidding_strategy ? (
                                <EmptyState section="Bidding Strategy" />
                            ) : (
                                <BiddingView data={analysis.bidding_strategy} comps={propertyData?.comps} priceHistory={propertyData?.priceHistory} onRefresh={handleRunBiddingStrategy} />
                            )}
                        </section>
                    )}
                    {activeTab === 'image_analysis' && (
                        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {!analysis.image_by_image_analysis || analysis.image_by_image_analysis.length === 0 ? (
                                <EmptyState section="Image Analysis" />
                            ) : (
                                <ImageAnalysisView data={analysis.image_by_image_analysis} />
                            )}
                        </section>
                    )}
                    {activeTab === 'context_graph' && (
                        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {graphLoading ? (
                                <AnalysisLoading title="Extracting Context Factors..." subtitle="Analyzing dimensions." timer={timer} address={propertyData?.address} icon="fa-diagram-project" />
                            ) : (
                                <ContextGraphView
                                    data={graphResult!}
                                    loading={graphLoading}
                                    onExtract={handleReExtractContextGraph}
                                />
                            )}
                        </section>
                    )}
                    {activeTab === 'satellitary' && (
                        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <SatellitaryView
                                lat={propertyData?.coordinates?.latitude}
                                lng={propertyData?.coordinates?.longitude}
                                cachedStreetViewUrl={propertyData?.streetViewAnalysis?.imageUrl || propertyData?.streetView}
                                address={propertyData?.address}
                            />
                        </section>
                    )}
                </StickyNotesLayer>
            </div>

            <HoverPreview
                hoveredImage={hoveredImage}
                mousePos={mousePos}
                onMouseEnter={clearPreviewTimer}
                onMouseLeave={hidePreviewImmediately}
                onClose={() => setHoveredImage(null)}
            />

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default AnalysisOrchestrator;
