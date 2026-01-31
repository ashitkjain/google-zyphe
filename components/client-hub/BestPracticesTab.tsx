import React, { useState } from 'react';
import BestPracticesSidebar from './best-practices/BestPracticesSidebar';
import TimingsSection from './best-practices/TimingsSection';
import BuyerAgentSection from './best-practices/BuyerAgentSection';
import SellerAgentSection from './best-practices/SellerAgentSection';
import CommunicationSection from './best-practices/CommunicationSection';
import ListingMarketingSection from './best-practices/ListingMarketingSection';
import PricingNegotiationSection from './best-practices/PricingNegotiationSection';
import LeadGenerationSection from './best-practices/LeadGenerationSection';
import SystemsProductivitySection from './best-practices/SystemsProductivitySection';
import TransactionComplianceSection from './best-practices/TransactionComplianceSection';
import EducationPositioningSection from './best-practices/EducationPositioningSection';
import BrandingDevelopmentSection from './best-practices/BrandingDevelopmentSection';
import MarketAnalyticsSection from './best-practices/MarketAnalyticsSection';
import NicheMarketSection from './best-practices/NicheMarketSection';
import MagazineBestPracticesTab from './MagazineBestPracticesTab';

const BestPracticesTab: React.FC = () => {
    const [activeSection, setActiveSection] = useState('timings');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'classic' | 'magazine'>('classic');

    const renderContent = () => {
        switch (activeSection) {
            case 'timings':
                return <TimingsSection />;
            case 'buyer_agent':
                return <BuyerAgentSection />;
            case 'seller_agent':
                return <SellerAgentSection />;
            case 'communication':
                return <CommunicationSection />;
            case 'listing_marketing':
                return <ListingMarketingSection />;
            case 'pricing_negotiation':
                return <PricingNegotiationSection />;
            case 'lead_generation':
                return <LeadGenerationSection />;
            case 'systems_productivity':
                return <SystemsProductivitySection />;
            case 'transaction_compliance':
                return <TransactionComplianceSection />;
            case 'education_positioning':
                return <EducationPositioningSection />;
            case 'branding_development':
                return <BrandingDevelopmentSection />;
            case 'market_analytics':
                return <MarketAnalyticsSection />;
            case 'niche_market':
                return <NicheMarketSection />;
            case 'reactivation':
                return (
                    <div className="p-12 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                        <i className="fa-solid fa-wand-magic-sparkles text-4xl text-indigo-500 mb-6"></i>
                        <h2 className="text-2xl font-black text-slate-900 mb-4">Reactivation Playbook</h2>
                        <p className="text-slate-500 mb-8 max-w-md mx-auto">This section is exclusively available in our new Premium Magazine format. View the playbook to master lead reactivation.</p>
                        <button
                            onClick={() => setViewMode('magazine')}
                            className="px-8 py-3 bg-indigo-600 text-white rounded-full font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all font-bold"
                        >
                            Open Premium Playbook
                        </button>
                    </div>
                );
            default:
                return <TimingsSection />;
        }
    };

    if (viewMode === 'magazine') {
        return (
            <div className="relative h-full">
                <button
                    onClick={() => setViewMode('classic')}
                    className="absolute top-6 right-6 z-[30] px-4 py-2 bg-white/80 backdrop-blur shadow-sm border border-slate-200 rounded-full text-xs font-bold text-slate-600 hover:bg-white hover:text-indigo-600 transition-all flex items-center gap-2"
                >
                    <i className="fa-solid fa-arrow-left"></i>
                    Back to Classic View
                </button>
                <MagazineBestPracticesTab />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Mobile Header */}
            <div className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                <span className="font-bold text-slate-800">Best Practices Guide</span>
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    <i className={`fa-solid ${mobileMenuOpen ? 'fa-xmark' : 'fa-bars'} text-xl`}></i>
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Sidebar */}
                <BestPracticesSidebar
                    activeSection={activeSection}
                    setActiveSection={(section) => {
                        setActiveSection(section);
                        setMobileMenuOpen(false);
                    }}
                    mobileMenuOpen={mobileMenuOpen}
                    setMobileMenuOpen={setMobileMenuOpen}
                />

                {/* Main Content Area */}
                <div className="flex-1 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent relative">
                    <div className="absolute top-6 right-6 z-10">
                        <button
                            onClick={() => setViewMode('magazine')}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2 transform hover:scale-105 active:scale-95"
                        >
                            <i className="fa-solid fa-wand-magic-sparkles"></i>
                            View Premium Playbook
                        </button>
                    </div>
                    <div className="max-w-5xl mx-auto p-6 lg:p-12 pb-24">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BestPracticesTab;
