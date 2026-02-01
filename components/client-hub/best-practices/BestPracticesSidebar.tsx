import React from 'react';

export type BestPracticesSection =
    | 'timings'
    | 'buyer_agent'
    | 'seller_agent'
    | 'communication'
    | 'listing_marketing'
    | 'pricing_negotiation'
    | 'lead_generation'
    | 'systems_productivity'
    | 'transaction_compliance'
    | 'education_positioning'
    | 'branding_development'
    | 'market_analytics'
    | 'niche_market'
    | 'reactivation';

interface BestPracticesSidebarProps {
    activeSection: BestPracticesSection;
    setActiveSection: (section: BestPracticesSection) => void;
}

const BestPracticesSidebar: React.FC<BestPracticesSidebarProps> = ({ activeSection, setActiveSection }) => {
    return (
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col items-center py-6 h-full overflow-y-auto custom-scrollbar">
            <nav className="w-full px-4 space-y-2 pb-6">
                <button
                    onClick={() => setActiveSection('timings')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'timings'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'timings' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        <i className="fa-regular fa-clock"></i>
                    </div>
                    Timings
                </button>
                <button
                    onClick={() => setActiveSection('buyer_agent')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'buyer_agent'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'buyer_agent' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        <i className="fa-solid fa-user-tie"></i>
                    </div>
                    Buyer Agent
                </button>
                <button
                    onClick={() => setActiveSection('seller_agent')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'seller_agent'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'seller_agent' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        <i className="fa-solid fa-house-chimney-user"></i>
                    </div>
                    Seller Agent
                </button>
                <button
                    onClick={() => setActiveSection('communication')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'communication'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'communication' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        <i className="fa-solid fa-comments"></i>
                    </div>
                    Communication
                </button>
                <button
                    onClick={() => setActiveSection('listing_marketing')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'listing_marketing'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'listing_marketing' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        <i className="fa-solid fa-bullhorn"></i>
                    </div>
                    Listing & Marketing
                </button>
                <button
                    onClick={() => setActiveSection('pricing_negotiation')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'pricing_negotiation'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'pricing_negotiation' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        <i className="fa-solid fa-hand-holding-dollar"></i>
                    </div>
                    Pricing & Negotiation
                </button>
                <button
                    onClick={() => setActiveSection('lead_generation')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'lead_generation'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'lead_generation' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        <i className="fa-solid fa-laptop-code"></i>
                    </div>
                    Lead Gen & Online
                </button>
                <button
                    onClick={() => setActiveSection('reactivation')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'reactivation'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'reactivation' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        <i className="fa-solid fa-bolt"></i>
                    </div>
                    Lead Reactivation
                </button>
                <button
                    onClick={() => setActiveSection('systems_productivity')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'systems_productivity'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'systems_productivity' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        <i className="fa-solid fa-rocket"></i>
                    </div>
                    Systems & Tools
                </button>
                <button
                    onClick={() => setActiveSection('transaction_compliance')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'transaction_compliance'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'transaction_compliance' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        <i className="fa-solid fa-file-signature"></i>
                    </div>
                    Transaction & Risk
                </button>
                <button
                    onClick={() => setActiveSection('education_positioning')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'education_positioning'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'education_positioning' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        <i className="fa-solid fa-graduation-cap"></i>
                    </div>
                    Education & Authority
                </button>
                <button
                    onClick={() => setActiveSection('branding_development')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'branding_development'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'branding_development' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        <i className="fa-solid fa-id-card-clip"></i>
                    </div>
                    Development & Brand
                </button>
                <button
                    onClick={() => setActiveSection('market_analytics')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'market_analytics'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'market_analytics' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        <i className="fa-solid fa-chart-pie"></i>
                    </div>
                    Market & Analytics
                </button>
                <button
                    onClick={() => setActiveSection('niche_market')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'niche_market'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'niche_market' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        <i className="fa-solid fa-bullseye"></i>
                    </div>
                    Niche Positioning
                </button>


            </nav>
        </div>
    );
};

export default BestPracticesSidebar;
