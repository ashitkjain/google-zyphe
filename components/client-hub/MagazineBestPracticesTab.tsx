import React, { useState } from 'react';
import BestPracticesSidebar from './best-practices/BestPracticesSidebar';
import MagazinePlaybookLayout from './best-practices/MagazinePlaybookLayout';
import { BEST_PRACTICES_DATA } from './MagazineBestPracticesData';

const MagazineBestPracticesTab: React.FC = () => {
    const [activeSection, setActiveSection] = useState('reactivation');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const renderContent = () => {
        const data = BEST_PRACTICES_DATA[activeSection];
        if (!data) return <div className="p-12 text-center text-slate-400">Section details coming soon...</div>;

        return <MagazinePlaybookLayout {...data} />;
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Mobile Header */}
            <div className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                <span className="font-bold text-slate-800">Best Practices (Magazine View)</span>
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
                    activeSection={activeSection as any}
                    setActiveSection={(section) => {
                        setActiveSection(section);
                        setMobileMenuOpen(false);
                    }}
                    mobileMenuOpen={mobileMenuOpen}
                    setMobileMenuOpen={setMobileMenuOpen}
                />

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    <div className="max-w-6xl mx-auto">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MagazineBestPracticesTab;
