
import React, { useState, useEffect, useRef } from 'react';
import { CustomAIAnalysisResult, CommunityPulseSection, ComprehensiveAnalysisResult, ImageQualityAnalysisResult, ImageQualityPoint, ImageQualityCategory, InvestmentResearchResult, BiddingStrategyResult, PropertyComp, PriceHistoryItem } from '../types';
import { analyzeImageQuality, analyzeInvestmentResearch, analyzeBiddingStrategy, AiResponseError } from '../services/geminiService';
import { saveImageQualityAnalysisToCloud, getImageQualityAnalysisFromCloud, saveInvestmentResearchToCloud, getInvestmentResearchFromCloud } from '../services/firebaseService';
import { APP_CONFIG } from '../config';

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
  addLog: (service: string, meta: { type: 'request' | 'response' | 'error' | 'info' }, content: any) => void;
}

type TabType = 'interior' | 'rooms' | 'exterior' | 'neighborhood' | 'pulse' | 'quality' | 'investment' | 'bidding';

const CustomAIAnalysis: React.FC<Props> = ({
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
  addLog
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('interior');
  const [timer, setTimer] = useState(0);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [investmentLoading, setInvestmentLoading] = useState(false);
  const [biddingLoading, setBiddingLoading] = useState(false);

  // Hover preview state
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const previewTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let interval: number;
    if (loading || qualityLoading || investmentLoading || biddingLoading) {
      interval = window.setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [loading, qualityLoading, investmentLoading, biddingLoading]);

  // Auto-trigger Picture Quality Audit when tab is selected
  useEffect(() => {
    if (activeTab === 'quality' && !analysis?.image_quality_analysis && !qualityLoading && propertyImages.length > 0) {
      handleRunQualityAnalysis();
    }
  }, [activeTab, analysis?.image_quality_analysis, qualityLoading, propertyImages.length]);

  // Auto-trigger Investment Research when tab is selected
  useEffect(() => {
    if (activeTab === 'investment' && !analysis?.investment_research && !investmentLoading) {
      handleRunInvestmentResearch();
    }
  }, [activeTab, analysis?.investment_research, investmentLoading]);

  // Auto-trigger Bidding Strategy when tab is selected (respect session cache)
  useEffect(() => {
    if (activeTab === 'bidding' && !analysis?.bidding_strategy && !biddingLoading) {
      handleRunBiddingStrategy();
    }
  }, [activeTab, analysis?.bidding_strategy, biddingLoading]);

  const handleRunQualityAnalysis = async () => {
    if (!analysis || analysis.image_quality_analysis || !propertyImages.length || qualityLoading) {
      return;
    }

    setTimer(0);
    setQualityLoading(true);
    addLog('Cloud Cache', { type: 'request' }, { zpid, task: 'image_quality_analysis' });
    try {
      if (zpid) {
        const cloudCached = await getImageQualityAnalysisFromCloud(zpid);
        if (cloudCached) {
          addLog('Cloud Cache', { type: 'response' }, { status: 'Hit', task: 'image_quality_analysis', zpid, data: cloudCached });
          onUpdateAnalysis({
            ...analysis,
            image_quality_analysis: cloudCached
          });
          setQualityLoading(false);
          return;
        }
        addLog('Cloud Cache', { type: 'info' }, { status: 'Miss', task: 'image_quality_analysis', zpid });
      }

      addLog('Gemini AI', { type: 'request' }, { task: 'image_quality_analysis', zpid });
      const result = await analyzeImageQuality(propertyImages);

      onUpdateAnalysis({
        ...analysis,
        image_quality_analysis: result
      });
      addLog('Gemini AI', { type: 'response' }, { task: 'image_quality_analysis', zpid, data: result });

      if (zpid) {
        addLog('Cloud Cache', { type: 'info' }, { task: 'saving_image_quality', zpid });
        const result_save = await saveImageQualityAnalysisToCloud(zpid, result);
        if (result_save.success) {
          addLog('Cloud Cache', { type: 'info' }, { status: 'Saved Successfully', task: 'image_quality_analysis', zpid });
        } else {
          addLog('System', { type: 'error' }, { message: "Cloud Cache Save Failed", task: 'image_quality_analysis', error: result_save.error });
        }
      }
    } catch (err: any) {
      console.error("Picture Quality Analysis Failed:", err);
      addLog('System', { type: 'error' }, { message: "Picture Quality Analysis Failed", error: err.message || err });
    } finally {
      setQualityLoading(false);
    }
  };

  const handleRunInvestmentResearch = async () => {
    if (!analysis || !zpid || investmentLoading) return;

    setTimer(0);
    setInvestmentLoading(true);
    addLog('Cloud Cache', { type: 'request' }, { zpid, task: 'investment_research' });

    try {
      const cached = await getInvestmentResearchFromCloud(zpid);
      if (cached) {
        addLog('Cloud Cache', { type: 'response' }, { status: 'Hit', task: 'investment_research', zpid });
        onUpdateAnalysis({ ...analysis, investment_research: cached });
        setInvestmentLoading(false);
        return;
      }
      addLog('Cloud Cache', { type: 'info' }, { status: 'Miss', task: 'investment_research', zpid });

      addLog('Gemini AI', { type: 'request' }, { task: 'investment_research', zpid });

      const mockPropertyData: any = {
        address: analysis.report_title || "This Property",
        zpid,
        bedrooms: analysis.room_highlights?.filter(r => r.room_name?.toLowerCase().includes('bedroom')).length || 2
      };

      const result = await analyzeInvestmentResearch(mockPropertyData);

      onUpdateAnalysis({ ...analysis, investment_research: result });
      addLog('Gemini AI', { type: 'response' }, { task: 'investment_research', zpid, data: result });

      const saveRes = await saveInvestmentResearchToCloud(zpid, result);
      if (!saveRes.success) {
        addLog('System', { type: 'error' }, { message: "Investment Cache Save Failed", error: saveRes.error });
      }
    } catch (err: any) {
      console.error("Investment Research Failed:", err);
      addLog('System', { type: 'error' }, { message: "Investment Research Failed", error: err.message || err });
    } finally {
      setInvestmentLoading(false);
    }
  };

  const handleRunBiddingStrategy = async () => {
    if (!analysis || !zpid || biddingLoading) return;

    setTimer(0);
    setBiddingLoading(true);

    try {
      // NOTE: Cloud Cache for Bidding Strategy is permanently disabled via APP_CONFIG
      addLog('Gemini AI', { type: 'request' }, { task: 'bidding_strategy', zpid, model: APP_CONFIG.models.bidding_strategy });

      // Use actual property data if available, otherwise fallback to basic context
      const contextData = propertyData || {
        address: analysis.report_title || "This Property",
        zpid
      };

      const result = await analyzeBiddingStrategy(contextData);

      onUpdateAnalysis({ ...analysis, bidding_strategy: result });
      addLog('Gemini AI', { type: 'response' }, { task: 'bidding_strategy', zpid, data: result });
    } catch (err: any) {
      console.error("Bidding Strategy Failed:", err);
      addLog('System', { type: 'error' }, { message: "Bidding Strategy Failed", error: err.message || err });
    } finally {
      setBiddingLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-12 text-center my-10 shadow-sm flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative w-20 h-20 mb-8">
          <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
          <div className="absolute inset-0 border-t-4 border-indigo-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <i className="fa-solid fa-wand-magic-sparkles text-indigo-600 text-2xl animate-pulse"></i>
          </div>
        </div>
        <h3 className="text-3xl font-black text-indigo-900 mb-4 tracking-tight">Zyphe™ Visual Scanning...</h3>
        <div className="mb-8">
          <span className="px-5 py-2 bg-white border border-indigo-100 rounded-full text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] shadow-sm inline-flex items-center gap-2">
            <i className="fa-solid fa-clock animate-pulse"></i>
            Time Elapsed: <span className="font-mono text-xs">{timer}s</span>
          </span>
        </div>
        <p className="text-indigo-700/70 max-w-md mx-auto text-lg font-medium">Our multimodal engine is dissecting architecture and neighborhood context.</p>
      </div>
    );
  }

  if (!analysis) return null;

  const {
    home_interior = {} as any,
    room_highlights = [],
    exterior_and_neighborhood = {} as any,
    neighborhood,
    community_pulse,
    image_quality_analysis,
    investment_research,
    bidding_strategy
  } = analysis;

  const tabs = [
    { id: 'interior', label: 'Interior', icon: 'fa-couch' },
    { id: 'rooms', label: 'Rooms', icon: 'fa-star' },
    { id: 'exterior', label: 'Exterior', icon: 'fa-tree' },
    { id: 'neighborhood', label: 'Neighborhood', icon: 'fa-map-location-dot' },
    { id: 'pulse', label: 'Community Pulse', icon: 'fa-users-viewfinder' },
    { id: 'quality', label: 'Picture Quality Audit', icon: 'fa-camera-rotate' },
    { id: 'investment', label: 'Investment Research', icon: 'fa-magnifying-glass-chart' },
    { id: 'bidding', label: 'Bidding Strategy', icon: 'fa-gavel' },
  ];

  const getCleanDomain = (src: string) => {
    try {
      let url = new URL(src);
      if (url.hostname.includes('vertexaisearch.cloud.google.com') || url.hostname.includes('google.com')) {
        const uriParam = url.searchParams.get('uri');
        if (uriParam) url = new URL(uriParam);
      }
      return url.hostname.replace('www.', '');
    } catch (e) {
      return src.replace(/^https?:\/\//, '').split('/')[0].replace('www.', '');
    }
  };

  const PulseCard = ({ title, data, icon, color }: { title: string, data?: CommunityPulseSection, icon: string, color: string }) => {
    if (!data || !data.summary) return null;
    const cleanSources = Array.from(new Set(data.sources?.map(getCleanDomain))).filter(Boolean);
    return (
      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col transition-all hover:shadow-xl hover:-translate-y-1">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400">
            <i className={`fa-solid ${icon} text-xl`}></i>
          </div>
          <h4 className="text-xl font-black text-gray-900 tracking-tight">{title}</h4>
        </div>
        <p className="text-gray-700 font-sans font-normal mb-4 leading-[1.625] text-[13px]">{data.summary}</p>
        <ul className="space-y-2 mb-6 flex-1">
          {data.points?.map((pt, i) => (
            <li key={i} className="flex gap-3 text-gray-600 text-[13px] leading-[1.625] font-sans font-normal">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 flex-shrink-0"></span>
              {pt}
            </li>
          ))}
        </ul>
        {cleanSources.length > 0 && (
          <div className="pt-4 border-t border-gray-50">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Knowledge Sources</div>
            <div className="text-[10px] text-gray-400 font-sans font-black leading-relaxed italic">{cleanSources.join(', ')}</div>
          </div>
        )}
      </div>
    );
  };

  const ThumbnailScroller = ({ indices }: { indices: number[] }) => {
    if (!indices || indices.length === 0 || !propertyImages.length) return null;
    return (
      <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {indices.map((idx) => (
          propertyImages[idx] && (
            <div
              key={idx}
              onMouseEnter={(e) => {
                clearPreviewTimer();
                setHoveredImage(propertyImages[idx]);
                setMousePos({ x: e.clientX, y: e.clientY });
              }}
              onMouseMove={(e) => {
                setMousePos({ x: e.clientX, y: e.clientY });
              }}
              onMouseLeave={hidePreviewImmediately}
              className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-slate-200 bg-slate-50 shadow-sm cursor-help active:scale-95 transition-transform"
            >
              <img src={propertyImages[idx]} alt="Evidence" className="w-full h-full object-cover" />
            </div>
          )
        ))}
      </div>
    );
  };

  const QualityVerdictWidget = ({ summary }: { summary: string }) => (
    <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm flex flex-col md:flex-row items-center gap-10">
      <div className="flex-1 text-center md:text-left">
        <h4 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Picture Quality Audit Verdict</h4>
        <p className="text-gray-600 text-sm font-medium leading-relaxed italic">"{summary}"</p>
      </div>
    </div>
  );

  const QualityRatingCard = ({ title, data, icon }: { title: string, data: ImageQualityCategory, icon: string }) => (
    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col transition-all hover:shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-indigo-600">
            <i className={`fa-solid ${icon}`}></i>
          </div>
          <h4 className="font-black text-gray-900 tracking-tight text-xl">{title}</h4>
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${data.rating.toLowerCase().includes('good') ? 'bg-emerald-50 text-emerald-600' :
          data.rating.toLowerCase().includes('fair') ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
          }`}>
          {data.rating}
        </span>
      </div>
      <div className="space-y-6 flex-1">
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Observations</div>
          <ul className="space-y-4">
            {data.observations.map((point, i) => (
              <li key={i} className="flex flex-col">
                <div className="text-[13px] text-gray-600 font-normal flex gap-2 leading-[1.625]">
                  <span className="text-indigo-400">•</span> {point.text}
                </div>
                <ThumbnailScroller indices={point.image_indices} />
              </li>
            ))}
          </ul>
        </div>
        {data.issues.length > 0 && (
          <div>
            <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-2">Potential Issues</div>
            <ul className="space-y-4">
              {data.issues.map((point, i) => (
                <li key={i} className="flex flex-col">
                  <div className="text-[13px] text-rose-700/80 font-normal flex gap-2 italic leading-[1.625]">
                    <span className="text-rose-400">!</span> {point.text}
                  </div>
                  <ThumbnailScroller indices={point.image_indices} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );

  const InvestmentView = ({ data }: { data: InvestmentResearchResult }) => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-5xl mx-auto space-y-8">
      {/* Unified Analysis Card */}
      <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">
        <div className="space-y-4">
          <div className="text-xl font-black text-indigo-600 uppercase tracking-[0.3em]">STR INVESTMENT SUMMARY</div>
          <p className="text-gray-800 font-sans font-normal text-[13px] leading-[1.625]">{data.market_performance.summary}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="px-6 py-4 bg-white rounded-2xl border border-gray-100 flex flex-col shadow-sm">
              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-2">Target ADR</span>
              <span className="text-sm font-medium text-gray-800 leading-relaxed">{data.market_performance.adr}</span>
            </div>
            <div className="px-6 py-4 bg-white rounded-2xl border border-gray-100 flex flex-col shadow-sm">
              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-2">2026 Forecast</span>
              <span className="text-sm font-medium text-gray-800 leading-relaxed">{data.market_performance.occupancy_rate}</span>
            </div>
          </div>
        </div>

        {/* Detailed Insights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 pt-12 border-t border-gray-100">
          <div className="space-y-3">
            <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Regulatory Landscape</div>
            <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.regulatory_updates.laws_and_zoning}</p>
            <div className="mt-4 p-4 bg-rose-50 rounded-2xl border border-rose-100">
              <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest block mb-1">Permit Status & Caps</span>
              <p className="font-sans font-normal text-[13px] leading-[1.625] text-rose-900">{data.regulatory_updates.permit_caps}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Competitive Edge</div>
            <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.competitor_gaps.standout_recommendations}</p>
            <div className="mt-4 space-y-3">
              <div className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Highlighted Amenities</div>
              <div className="flex flex-wrap gap-2">
                {data.competitor_gaps.praised_amenities.slice(0, 4).map((a, i) => (
                  <span key={i} className="px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold text-gray-600 uppercase tracking-tighter">{a}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Peak Demand Drivers</div>
            <div className="space-y-4">
              {data.demand_drivers.slice(0, 3).map((d, i) => (
                <div key={i} className="flex flex-col border-l-2 border-indigo-100 pl-4 py-1">
                  <div className="font-sans font-normal text-[13px] leading-[1.625] text-gray-900 mb-0.5">{d.event}</div>
                  <div className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">{d.date}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const BiddingView = ({ data, comps, priceHistory }: { data: BiddingStrategyResult; comps?: PropertyComp[]; priceHistory?: PriceHistoryItem[] }) => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-5xl mx-auto space-y-8">
      <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <div className="text-xl font-black text-indigo-600 uppercase tracking-[0.3em]">BIDDING STRATEGY REPORT</div>
            <button
              onClick={() => handleRunBiddingStrategy()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all active:scale-95"
            >
              <i className="fa-solid fa-rotate"></i>
              Refresh Strategy
            </button>
          </div>
          <p className="text-gray-800 font-sans font-normal text-[13px] leading-[1.625]">{data.negotiation_strategy.leverage_analysis}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="px-6 py-5 bg-white rounded-[2rem] border border-gray-100 flex flex-col shadow-sm gap-2">
              <span className="text-xl font-black text-gray-400 uppercase tracking-widest mb-2">Inventory Pressure</span>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg border border-indigo-100 w-fit">
                  {data.inventory_pressure.market_category}
                </span>
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg border border-indigo-100 w-fit">
                  {data.inventory_pressure.months_of_supply} MOS
                </span>
              </div>
              <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625] mt-1">
                {data.inventory_pressure.pressure_analysis}
              </p>
            </div>
            <div className="px-6 py-5 bg-white rounded-[2rem] border border-gray-100 flex flex-col shadow-sm gap-2">
              <span className="text-xl font-black text-gray-400 uppercase tracking-widest mb-2">Offer Velocity</span>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg border border-indigo-100 w-fit">
                  {data.offer_velocity.velocity_status}
                </span>
              </div>
              <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625] mt-1">
                {data.offer_velocity.recent_offer_trends}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 pt-12 border-t border-gray-100">
          <div className="space-y-3">
            <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Property DOM</div>
            <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.property_specifics.days_on_market}</p>
            {(() => {
              const history = data.property_specifics.listing_history;
              // Check if history exists and is meaningful (not just placeholder text)
              const isMeaningfulArray = Array.isArray(history) &&
                history.length > 0 &&
                !history.some(h =>
                  h.toLowerCase().includes('unknown') ||
                  h.toLowerCase().includes('no history') ||
                  h.toLowerCase().includes('no meaningful')
                );

              const isMeaningfulString = typeof history === 'string' &&
                history.length > 10 &&
                !history.toLowerCase().includes('unknown');

              if (!isMeaningfulArray && !isMeaningfulString) return null;

              return (
                <div className="mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Listing History</span>
                  <ul className="space-y-1">
                    {priceHistory && priceHistory.length > 0 ? (
                      priceHistory.map((item, i) => (
                        <li key={i} className="text-[11px] font-bold text-gray-600 list-disc list-inside font-sans">
                          {item.date}: {item.event} {item.price ? `at $${item.price.toLocaleString()}` : ''}
                        </li>
                      ))
                    ) : Array.isArray(history) ? (
                      history.map((h, i) => (
                        <li key={i} className="text-[11px] font-bold text-gray-600 list-disc list-inside font-sans">{h}</li>
                      ))
                    ) : (
                      <li className="text-[11px] font-bold text-gray-600 list-disc list-inside font-sans">{history as string}</li>
                    )}
                  </ul>
                </div>
              );
            })()}
          </div>

          <div className="space-y-3">
            <div className="text-xl font-black text-gray-400 uppercase tracking-widest">ZIP Benchmarks</div>
            <div className="mt-2">
              <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.zip_code_benchmarks.median_days_on_market}</p>
            </div>
          </div>



          <div className="space-y-3">
            <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Offer Tactics</div>
            <div className="space-y-2">
              {Array.isArray(data.negotiation_strategy.suggested_offer_tactics) && data.negotiation_strategy.suggested_offer_tactics.map((t, i) => (
                <div key={i} className="px-3 py-2 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg border border-indigo-100 flex items-center gap-2">
                  <i className="fa-solid fa-check-double text-[8px]"></i>
                  {t}
                </div>
              ))}
              {!Array.isArray(data.negotiation_strategy.suggested_offer_tactics) && typeof data.negotiation_strategy.suggested_offer_tactics === 'string' && (
                <div className="px-3 py-2 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg border border-indigo-100 flex items-center gap-2">
                  <i className="fa-solid fa-check-double text-[8px]"></i>
                  {data.negotiation_strategy.suggested_offer_tactics}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-12 border-t border-gray-100">
          <div className="bg-indigo-700 rounded-[2.5rem] p-8 md:p-10 text-white shadow-xl shadow-indigo-100 flex flex-col md:flex-row items-center gap-8">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/20"><i className="fa-solid fa-calculator text-2xl"></i></div>
            <div className="flex-1">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200 mb-2">Calculated Negotiation Strategy</div>
              <p className="text-indigo-50 font-sans font-normal text-[13px] leading-[1.625] opacity-90">{data.negotiation_strategy.calculated_discount_strategy}</p>
            </div>
          </div>
        </div>

        {comps && comps.length > 0 && (
          <div className="pt-12 border-t border-gray-100 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xl font-black text-gray-900 uppercase tracking-[0.3em]">COMPARABLE SALES</div>
              <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-gray-200">
                <i className="fa-solid fa-database text-gray-400"></i>
                {comps.length} Grounded Comps Found
              </div>
            </div>

            <div className="overflow-x-auto -mx-8 md:-mx-12 px-8 md:px-12">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-4 px-2 text-[11px] font-bold text-gray-900 uppercase tracking-widest">Address</th>
                    <th className="text-left py-4 px-2 text-[11px] font-bold text-gray-900 uppercase tracking-widest">Sale Price</th>
                    <th className="text-center py-4 px-2 text-[11px] font-bold text-gray-900 uppercase tracking-widest">PPSF</th>
                    <th className="text-center py-4 px-2 text-[11px] font-bold text-gray-900 uppercase tracking-widest">DOM</th>
                    <th className="text-right py-4 px-2 text-[11px] font-bold text-gray-900 uppercase tracking-widest">Specs & Lot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {comps.map((comp, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                      <td className="py-5 px-2">
                        <div className="text-sm font-medium text-gray-900">{comp.address}</div>
                        <div className="text-[11px] font-medium text-gray-400 uppercase tracking-tight mt-0.5">{comp.homeType?.replace(/_/g, ' ') || 'Single Family'}</div>
                      </td>
                      <td className="py-5 px-2 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">
                          {comp.price ? `$${comp.price.toLocaleString()}` : 'N/A'}
                        </div>
                        {comp.listPrice && comp.listPrice !== comp.price && (
                          <div className="text-[10px] text-gray-400 font-medium">List: ${comp.listPrice.toLocaleString()}</div>
                        )}
                      </td>
                      <td className="py-5 px-2 text-center whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {comp.pricePerSqFt ? `$${comp.pricePerSqFt}` : 'N/A'}
                        </div>
                      </td>
                      <td className="py-5 px-2 text-center whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {comp.daysOnMarket !== null && comp.daysOnMarket !== undefined ? comp.daysOnMarket : 'N/A'}
                        </div>
                      </td>
                      <td className="py-5 px-2 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-3 text-sm font-medium text-gray-600">
                            <span>{comp.bedrooms !== null ? `${comp.bedrooms} bd` : 'N/A'}</span>
                            <span>{comp.bathrooms !== null ? `${comp.bathrooms} ba` : 'N/A'}</span>
                            <span>{comp.livingAreaValue ? `${comp.livingAreaValue.toLocaleString()} sf` : 'N/A'}</span>
                          </div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                            Lot: {comp.lotSize || 'N/A'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const EmptyState = ({ section }: { section: string }) => (
    <div className="p-20 bg-white/50 rounded-[2rem] text-center border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-gray-400">
        <i className="fa-solid fa-magnifying-glass-chart text-3xl"></i>
      </div>
      <h4 className="text-xl font-black text-gray-900 mb-2">Analysis Missing for {section}</h4>
      <p className="text-gray-500 max-w-sm mx-auto mb-8 font-medium text-sm">This section of the report couldn't be generated from the available data.</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-20 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-3 px-6 py-3 bg-white border border-gray-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-700 shadow-sm hover:shadow-md hover:bg-gray-50 transition-all group w-fit"
        >
          <i className="fa-solid fa-arrow-left transition-transform group-hover:-translate-x-1"></i>
          Back to Overview
        </button>
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={onRefresh} className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:shadow-md hover:bg-slate-50 active:scale-95 transition-all group shadow-indigo-100"><i className="fa-solid fa-rotate group-hover:rotate-180 transition-transform duration-500"></i> Refresh Analysis</button>
          <button onClick={onRunComprehensive} className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-indigo-700 to-gray-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-[1.05] active:scale-95 transition-all group"><i className="fa-solid fa-file-invoice-dollar text-sm"></i> {comprehensiveResult ? 'Full Narrative Report' : 'Generate Full Report'}</button>
          <div className="flex items-center gap-2 text-[10px] text-gray-400 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 font-black uppercase tracking-widest"><i className="fa-solid fa-bolt-lightning text-indigo-500"></i> Zyphe™ AI Intelligence</div>
        </div>
      </div>

      <div className="flex justify-center sm:justify-start">
        <div className="inline-flex bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm overflow-x-auto no-scrollbar max-w-full">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-3 px-6 py-3 rounded-xl font-black transition-all text-[12px] whitespace-nowrap ${activeTab === tab.id ? 'bg-gradient-to-r from-indigo-700 to-gray-900 text-white shadow-lg' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <i className={`fa-solid ${tab.icon} ${activeTab === tab.id ? 'text-white' : 'text-gray-400'}`}></i>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'interior' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-5xl mx-auto space-y-8">
            {!home_interior?.overall_description ? <EmptyState section="Interior" /> : (
              <>
                <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">
                  <div className="space-y-4">
                    <div className="text-xl font-black text-indigo-600 uppercase tracking-[0.3em]">SUMMARY</div>
                    <p className="text-gray-800 font-sans font-normal text-[13px] leading-[1.625]">{home_interior.overall_description}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 pt-12 border-t border-gray-100">
                    <div className="space-y-3"><div className="text-xl font-black text-gray-400 uppercase tracking-widest">Design Philosophy</div><div className="inline-block bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase px-3 py-1.5 rounded-full mb-2">{home_interior.design_style?.style}</div><p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{home_interior.design_style?.reasoning}</p></div>
                    <div className="space-y-3"><div className="text-xl font-black text-gray-400 uppercase tracking-widest">Colors & Materials</div><p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{home_interior.color_and_materials}</p></div>
                    <div className="space-y-3"><div className="text-xl font-black text-gray-400 uppercase tracking-widest">Lighting Environment</div><p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{home_interior.lighting}</p></div>
                    <div className="space-y-3"><div className="text-xl font-black text-gray-400 uppercase tracking-widest">Spatial Architecture</div><p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{home_interior.spatial_flow}</p></div>
                    <div className="space-y-3"><div className="text-xl font-black text-gray-400 uppercase tracking-widest">Staging & Furnishings</div><p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{home_interior.staging_and_furnishings}</p></div>
                    <div className="space-y-3"><div className="text-xl font-black text-gray-400 uppercase tracking-widest">Condition & Finish</div><p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{home_interior.condition_and_finish}</p></div>
                  </div>
                </div>
              </>
            )}
          </section>
        )}
        {activeTab === 'rooms' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {room_highlights.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {room_highlights.map((room, idx) => (
                  <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                    <div className="flex justify-between items-start mb-6"><div className="w-12 h-12 bg-gray-50 rounded-[1.25rem] flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors"><i className={`fa-solid ${room.room_name?.toLowerCase().includes('kitchen') ? 'fa-kitchen-set' : 'fa-door-open'} text-xl`}></i></div><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">{room.floor || 'N/A'}</span></div>
                    <h4 className="font-black text-gray-900 text-xl mb-4 tracking-tight">{room.room_name}</h4>
                    <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625] mb-6">{room.description}</p>
                    {room.potential_improvements && <div className="pt-6 border-t border-gray-100 bg-gray-50 -mx-8 -mb-8 p-8 mt-auto"><div className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3">Strategic Enhancement</div><p className="text-gray-500 text-[13px] font-sans font-normal italic leading-[1.625]">"{room.potential_improvements}"</p></div>}
                  </div>
                ))}
              </div>
            ) : <EmptyState section="Room Highlights" />}
          </section>
        )}
        {activeTab === 'exterior' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-5xl mx-auto space-y-8">
            {!exterior_and_neighborhood?.exterior_and_lot_appeal?.architecture_style ? <EmptyState section="Exterior" /> : (
              <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">
                <div className="space-y-6">
                  <div className="flex items-center gap-3"><div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm"><i className="fa-solid fa-house-chimney text-lg"></i></div><h3 className="text-xl font-black text-gray-900 tracking-tight">Curb Appeal & Exterior</h3></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-2"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Architecture</h4><p className="text-gray-800 font-sans font-normal text-[13px] leading-[1.625]">{exterior_and_neighborhood.exterior_and_lot_appeal.architecture_style}</p></div>
                    <div className="space-y-2"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Frontage</h4><p className="text-gray-800 font-sans font-normal text-[13px] leading-[1.625]">{exterior_and_neighborhood.exterior_and_lot_appeal.curb_appeal}</p></div>
                    <div className="col-span-full space-y-2"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Outdoor Living</h4><p className="text-gray-800 font-sans font-normal text-[13px] leading-[1.625]">{exterior_and_neighborhood.exterior_and_lot_appeal.backyard_and_patio}</p></div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
        {activeTab === 'neighborhood' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-5xl mx-auto">
            {neighborhood ? (
              <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm p-8 md:p-12 space-y-12">
                <div className="space-y-4"><div className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em]">Spatial Summary</div><p className="text-gray-800 font-sans font-normal text-[13px] leading-[1.625]">{neighborhood.overview}</p></div>
                {neighborhood.neighborhood_features && (
                  <div className="pt-12 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    {Object.entries(neighborhood.neighborhood_features).map(([key, value]) => {
                      if (!value || key === 'general') return null;
                      return <div key={key} className="space-y-2"><h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>{key.replace(/_/g, ' ')}</h4><p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{value as string}</p></div>;
                    })}
                  </div>
                )}
              </div>
            ) : <EmptyState section="Neighborhood" />}
          </section>
        )}
        {activeTab === 'pulse' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {community_pulse ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <PulseCard title="Resident Highlights" data={community_pulse.what_residents_like} icon="fa-monument" color="indigo" />
                <PulseCard title="Common Complaints" data={community_pulse.common_complaints} icon="fa-wind" color="slate" />
                <PulseCard title="Safety & Environment" data={community_pulse.safety_and_concerns} icon="fa-shield-halved" color="indigo" />
                <PulseCard title="Schools & Education" data={community_pulse.schools_family_friendliness} icon="fa-graduation-cap" color="indigo" />
                <PulseCard title="Transit & Lifestyle" data={community_pulse.lifestyle_convenience} icon="fa-train-subway" color="indigo" />
                <PulseCard title="Investment Sentiment" data={community_pulse.investment_insights} icon="fa-chart-line" color="indigo" />
              </div>
            ) : <EmptyState section="Community Pulse" />}
          </section>
        )}
        {activeTab === 'quality' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-8">
            {qualityLoading ? (
              <div className="bg-indigo-50 border border-indigo-100 rounded-[3rem] p-12 text-center my-10 shadow-sm flex flex-col items-center justify-center min-h-[50vh]">
                <div className="w-20 h-20 mb-8 relative">
                  <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
                  <div className="absolute inset-0 border-t-4 border-indigo-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center"><i className="fa-solid fa-camera text-indigo-600 text-2xl animate-pulse"></i></div>
                </div>
                <h3 className="text-3xl font-black text-indigo-900 mb-4 tracking-tight">Picture Audit...</h3>
                <div className="mb-8"><span className="px-5 py-2 bg-white border border-indigo-100 rounded-full text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] shadow-sm flex items-center gap-2"><i className="fa-solid fa-clock animate-pulse"></i> Time: <span className="font-mono text-xs">{timer}s</span></span></div>
              </div>
            ) : !image_quality_analysis ? <EmptyState section="Quality Audit" /> : (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000">
                <QualityVerdictWidget summary={image_quality_analysis.overall_score.summary} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  <QualityRatingCard title="Lighting" data={image_quality_analysis.lighting_and_color} icon="fa-sun" />
                  <QualityRatingCard title="Staging" data={image_quality_analysis.staging_and_clutter} icon="fa-couch" />
                  <QualityRatingCard title="Composition" data={image_quality_analysis.composition} icon="fa-crop-simple" />
                </div>
              </div>
            )}
          </section>
        )}
        {activeTab === 'investment' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {investmentLoading ? (
              <div className="bg-indigo-50 border border-indigo-100 rounded-[3rem] p-12 text-center my-10 shadow-sm flex flex-col items-center justify-center min-h-[50vh]">
                <div className="w-20 h-20 mb-8 relative">
                  <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
                  <div className="absolute inset-0 border-t-4 border-indigo-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center"><i className="fa-solid fa-magnifying-glass-dollar text-indigo-600 text-2xl animate-pulse"></i></div>
                </div>
                <h3 className="text-3xl font-black text-indigo-900 mb-4 tracking-tight">Market Research...</h3>
                <div className="mb-8"><span className="px-5 py-2 bg-white border border-indigo-100 rounded-full text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] shadow-sm flex items-center gap-2"><i className="fa-solid fa-clock animate-pulse"></i> Time: <span className="font-mono text-xs">{timer}s</span></span></div>
                <p className="text-indigo-700/70 text-lg font-medium">Scouring STR data and historicals for 2026.</p>
              </div>
            ) : !investment_research ? <EmptyState section="Investment Research" /> : <InvestmentView data={investment_research} />}
          </section>
        )}
        {activeTab === 'bidding' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {biddingLoading ? (
              <div className="bg-indigo-50 border border-indigo-100 rounded-[3rem] p-12 text-center my-10 shadow-sm flex flex-col items-center justify-center min-h-[50vh]">
                <div className="w-20 h-20 mb-8 relative">
                  <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
                  <div className="absolute inset-0 border-t-4 border-indigo-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center"><i className="fa-solid fa-gavel text-indigo-600 text-2xl animate-pulse"></i></div>
                </div>
                <h3 className="text-3xl font-black text-indigo-900 mb-4 tracking-tight">Strategizing Offer...</h3>
                <div className="mb-8"><span className="px-5 py-2 bg-white border border-indigo-100 rounded-full text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] shadow-sm flex items-center gap-2"><i className="fa-solid fa-clock animate-pulse"></i> Time: <span className="font-mono text-xs">{timer}s</span></span></div>
                <p className="text-indigo-700/70 text-lg font-medium">Analyzing DOM benchmarks and inventory pressure.</p>
              </div>
            ) : !bidding_strategy ? <EmptyState section="Bidding Strategy" /> : <BiddingView data={bidding_strategy} comps={propertyData?.comps} priceHistory={propertyData?.priceHistory} />}
          </section>
        )}
      </div>

      {hoveredImage && (
        <div onMouseEnter={clearPreviewTimer} onMouseLeave={hidePreviewImmediately} className="fixed z-[999] p-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200 ring-1 ring-black/5 flex flex-col group/preview" style={{ left: Math.min(window.innerWidth - 320, mousePos.x + 20), top: Math.max(20, Math.min(window.innerHeight - 240, mousePos.y - 120)), width: '300px' }}>
          <div className="relative">
            <img src={hoveredImage} className="w-full h-auto rounded-xl" alt="Preview" />
            <button onClick={(e) => { e.stopPropagation(); setHoveredImage(null); }} className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all shadow-lg active:scale-90"><i className="fa-solid fa-xmark text-sm"></i></button>
          </div>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default CustomAIAnalysis;
