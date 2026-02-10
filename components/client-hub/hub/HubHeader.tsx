import React from 'react';
import Logo from '../../Logo';
import { UserProfile } from '../../../types';

export type HubTab = 'explore' | 'leads' | 'tasks' | 'settings' | 'whiteboard' | 'profile' | 'closing' | 'reactivate' | 'calendar' | 'reminder_rules' | 'best_practices' | 'knowledge_center' | 'clients' | 'creative_studio' | 'lead_ingestion' | 'pdf_csv' | 'sms_registration' | 'bulk_prefetch' | 'city_data' | 'storage_registry' | 'market_analysis' | 'opportunity_discovery' | 'industry_research' | 'product_market_fit' | 'post_close_intelligence' | 'technical_papers';

interface HubHeaderProps {
    realtorName: string;
    realtorProfile: UserProfile | null;
    activeTab: HubTab;
    setActiveTab: (tab: HubTab) => void;
    showHamburger: boolean;
    isMobileMenuOpen: boolean;
    setIsMobileMenuOpen: (open: boolean) => void;
    isToolsOpen: boolean;
    setIsToolsOpen: (open: boolean) => void;
    isInvestorOpen: boolean;
    setIsInvestorOpen: (open: boolean) => void;
    isSettingsDropdownOpen: boolean;
    setIsSettingsDropdownOpen: (open: boolean) => void;
    onSignOut: () => void;
    onNavigate?: (view: any, path: string) => void;
    setIsAddClientModalOpen: (open: boolean) => void;
    setIsRemoveClientModalOpen: (open: boolean) => void;
    earlyTabs: { id: HubTab; label: string; icon: string }[];
    lateTabs: { id: HubTab; label: string; icon: string }[];
    toolTabs: { id: HubTab; label: string; icon: string }[];
    adminTabs: { id: HubTab; label: string; icon: string }[];
    investorTabs: { id: HubTab; label: string; icon: string }[];
    toolsRef: React.RefObject<HTMLDivElement>;
    investorRef: React.RefObject<HTMLDivElement>;
    syncBestPractices: () => Promise<void>;
    handleResetAllData: () => Promise<void>;
    handleSeedManualMockData: () => Promise<void>;
    realtorId: string;
    deleteUserAccount: (uid: string) => Promise<boolean>;
}

const HubHeader: React.FC<HubHeaderProps> = ({
    realtorName, realtorProfile, activeTab, setActiveTab, showHamburger,
    isMobileMenuOpen, setIsMobileMenuOpen, isToolsOpen, setIsToolsOpen,
    isInvestorOpen, setIsInvestorOpen,
    isSettingsDropdownOpen, setIsSettingsDropdownOpen, onSignOut, onNavigate,
    setIsAddClientModalOpen, setIsRemoveClientModalOpen, earlyTabs, lateTabs,
    toolTabs, adminTabs, investorTabs, toolsRef, investorRef, syncBestPractices, handleResetAllData,
    handleSeedManualMockData, realtorId, deleteUserAccount
}) => {
    return (
        <header className="bg-slate-900 px-4 sm:px-8 h-[72px] flex items-center justify-between border-b border-white/5 shadow-2xl relative z-[110]">
            {/* Left Section: Logo & Navigation */}
            <div className="flex items-center justify-start h-full gap-8">
                <Logo
                    size={showHamburger ? 40 : 52}
                    onClick={() => { setActiveTab('explore'); setIsMobileMenuOpen(false); }}
                    className="cursor-pointer transition-transform hover:scale-105 flex-shrink-0"
                />

                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className={`${showHamburger ? 'flex' : 'hidden'} w-10 h-10 items-center justify-center text-white text-xl`}
                >
                    <i className={`fa-solid ${isMobileMenuOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
                </button>

                <nav className={`${showHamburger ? 'hidden' : 'flex'} items-center h-full`}>
                    {earlyTabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                if (onNavigate) onNavigate(tab.id as any, '');
                            }}
                            className={`relative h-[72px] flex items-center gap-3 px-5 text-[11px] font-black uppercase tracking-[0.1em] transition-all group overflow-hidden ${activeTab === tab.id ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            <i className={`fa-solid ${tab.icon} text-sm transition-transform group-hover:scale-110 ${activeTab === tab.id ? 'text-indigo-400' : 'text-slate-500'}`}></i>
                            {tab.label}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 animate-in slide-in-from-bottom border-t border-indigo-400/50"></div>
                            )}
                        </button>
                    ))}

                    {/* Investor Tools Dropdown */}
                    {investorTabs.length > 0 && (
                        <div className="relative h-full" ref={investorRef}>
                            <button
                                onClick={() => {
                                    setIsInvestorOpen(!isInvestorOpen);
                                    setIsToolsOpen(false);
                                }}
                                className={`relative h-[72px] flex items-center gap-3 px-5 text-[11px] font-black uppercase tracking-[0.1em] transition-all group overflow-hidden ${investorTabs.some(t => t.id === activeTab) ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                <i className={`fa-solid fa-chart-pie text-sm transition-transform group-hover:scale-110 ${investorTabs.some(t => t.id === activeTab) ? 'text-indigo-400' : 'text-slate-500'}`}></i>
                                Investor
                                <i className={`fa-solid fa-chevron-down text-[9px] transition-transform duration-300 ${isInvestorOpen ? 'rotate-180' : ''}`}></i>
                                {investorTabs.some(t => t.id === activeTab) && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 animate-in slide-in-from-bottom border-t border-indigo-400/50"></div>
                                )}
                            </button>

                            {isInvestorOpen && (
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl py-3 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                                    {investorTabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => {
                                                setActiveTab(tab.id);
                                                setIsInvestorOpen(false);
                                                if (onNavigate) onNavigate(tab.id as any, '');
                                            }}
                                            className={`w-full flex items-center gap-4 px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-50 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-500'}`}
                                        >
                                            <i className={`fa-solid ${tab.icon} w-4 text-center ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`}></i>
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Realtor Tools Dropdown */}
                    <div className="relative h-full" ref={toolsRef}>
                        <button
                            onClick={() => {
                                setIsToolsOpen(!isToolsOpen);
                                setIsInvestorOpen(false);
                            }}
                            className={`relative h-[72px] flex items-center gap-3 px-5 text-[11px] font-black uppercase tracking-[0.1em] transition-all group overflow-hidden ${(toolTabs.some(t => t.id === activeTab) || adminTabs.some(t => t.id === activeTab)) ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            <i className={`fa-solid fa-toolbox text-sm transition-transform group-hover:scale-110 ${(toolTabs.some(t => t.id === activeTab) || adminTabs.some(t => t.id === activeTab)) ? 'text-indigo-400' : 'text-slate-500'}`}></i>
                            Tools
                            <i className={`fa-solid fa-chevron-down text-[9px] transition-transform duration-300 ${isToolsOpen ? 'rotate-180' : ''}`}></i>
                            {(toolTabs.some(t => t.id === activeTab) || adminTabs.some(t => t.id === activeTab)) && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 animate-in slide-in-from-bottom border-t border-indigo-400/50"></div>
                            )}
                        </button>

                        {isToolsOpen && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl py-3 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                                {toolTabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id);
                                            setIsToolsOpen(false);
                                            if (onNavigate) onNavigate(tab.id as any, '');
                                        }}
                                        className={`w-full flex items-center gap-4 px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-50 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-500'}`}
                                    >
                                        <i className={`fa-solid ${tab.icon} w-4 text-center ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`}></i>
                                        {tab.label}
                                    </button>
                                ))}

                                <div className="h-px bg-slate-100 my-1.5 mx-3"></div>

                                <div className="relative group/admin">
                                    <button className="w-full flex items-center justify-between gap-4 px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-50 text-slate-500 hover:text-indigo-600">
                                        <div className="flex items-center gap-4">
                                            <i className="fa-solid fa-lock w-4 text-center text-slate-400 group-hover/admin:text-indigo-600"></i>
                                            Admin
                                        </div>
                                        <i className="fa-solid fa-chevron-right text-[8px] text-slate-300 group-hover/admin:text-indigo-400"></i>
                                    </button>

                                    <div className="absolute left-full top-[-12px] ml-1 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl py-3 z-[110] hidden group-hover/admin:block animate-in fade-in slide-in-from-left-2 duration-200">
                                        {adminTabs.map((tab) => (
                                            <button
                                                key={tab.id}
                                                onClick={() => {
                                                    setActiveTab(tab.id);
                                                    setIsToolsOpen(false);
                                                    if (onNavigate) onNavigate(tab.id as any, '');
                                                }}
                                                className={`w-full flex items-center gap-4 px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-50 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-500'}`}
                                            >
                                                <i className={`fa-solid ${tab.icon} w-4 text-center ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`}></i>
                                                {tab.label}
                                            </button>
                                        ))}
                                        <button
                                            onClick={async () => {
                                                if (!confirm('Rebuild search index?')) return;
                                                setIsToolsOpen(false);
                                                await syncBestPractices();
                                                alert('Search Index Repair Initiated.');
                                            }}
                                            className="w-full flex items-center gap-4 px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-50 text-slate-500 hover:text-indigo-600"
                                        >
                                            <i className="fa-solid fa-wrench w-4 text-center text-slate-400"></i>
                                            Repair Index
                                        </button>
                                        <div className="h-px bg-slate-100 my-1.5 mx-3"></div>
                                        <button
                                            onClick={async () => {
                                                if (window.confirm("Reset all data?")) {
                                                    await handleResetAllData();
                                                    setIsToolsOpen(false);
                                                }
                                            }}
                                            className="w-full flex items-center gap-4 px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-rose-50 text-slate-500 hover:text-rose-600"
                                        >
                                            <i className="fa-solid fa-trash-can w-4 text-center text-rose-400"></i>
                                            Reset Data
                                        </button>
                                        <button
                                            onClick={async () => {
                                                await handleSeedManualMockData();
                                                setIsToolsOpen(false);
                                            }}
                                            className="w-full flex items-center gap-4 px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-indigo-50 text-slate-500 hover:text-indigo-600"
                                        >
                                            <i className="fa-solid fa-database w-4 text-center text-indigo-400"></i>
                                            Seed Mock Data
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {lateTabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                if (onNavigate) onNavigate(tab.id as any, '');
                            }}
                            className={`relative h-[72px] flex items-center gap-3 px-5 text-[11px] font-black uppercase tracking-[0.1em] transition-all group overflow-hidden ${activeTab === tab.id ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            <i className={`fa-solid ${tab.icon} text-sm transition-transform group-hover:scale-110 ${activeTab === tab.id ? 'text-indigo-400' : 'text-slate-500'}`}></i>
                            {tab.label}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 animate-in slide-in-from-bottom border-t border-indigo-400/50"></div>
                            )}
                        </button>
                    ))}
                </nav>
            </div>



            {/* Right Section: User Controls */}
            <div className="flex items-center justify-end gap-3 sm:gap-6 h-full">
                <div className={`${showHamburger ? 'hidden' : 'flex'} flex-col items-end`}>
                    <span className="text-white font-black text-[11px] tracking-tight">{realtorName}</span>
                    <button onClick={onSignOut} className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-400 transition-colors mt-0.5 group/signout cursor-pointer">
                        <i className="fa-solid fa-right-from-bracket text-[9px] group-hover/signout:-translate-x-0.5 transition-all"></i>
                        Sign Out
                    </button>
                </div>

                {realtorProfile?.realtor?.photoURL && (
                    <img
                        src={realtorProfile.realtor.photoURL}
                        alt="Profile"
                        onClick={() => { setActiveTab('profile'); setIsMobileMenuOpen(false); }}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full sm:rounded-xl object-cover cursor-pointer transition-transform hover:scale-105 border border-white/10 shadow-lg"
                    />
                )}

                <div className={`relative z-50 ${showHamburger ? 'hidden' : 'block'}`}>
                    <button
                        onClick={() => setIsSettingsDropdownOpen(!isSettingsDropdownOpen)}
                        onBlur={() => setTimeout(() => setIsSettingsDropdownOpen(false), 200)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isSettingsDropdownOpen || activeTab === 'settings' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/50' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700'}`}
                    >
                        <i className="fa-solid fa-gear text-sm"></i>
                    </button>

                    {isSettingsDropdownOpen && (
                        <div className="absolute right-0 top-full mt-3 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                            <div className="p-1.5 space-y-0.5">
                                <button
                                    onClick={() => { setActiveTab('profile'); setIsSettingsDropdownOpen(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 rounded-xl transition-colors group"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                                        <i className="fa-solid fa-id-badge text-xs"></i>
                                    </div>
                                    <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">My Profile</span>
                                </button>
                                <button
                                    onClick={() => { setIsAddClientModalOpen(true); setIsSettingsDropdownOpen(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 rounded-xl transition-colors group"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                                        <i className="fa-solid fa-user-plus text-xs"></i>
                                    </div>
                                    <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">Add a client</span>
                                </button>
                                <button
                                    onClick={() => { setIsRemoveClientModalOpen(true); setIsSettingsDropdownOpen(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 rounded-xl transition-colors group"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center group-hover:bg-slate-100 transition-colors">
                                        <i className="fa-solid fa-user-minus text-xs"></i>
                                    </div>
                                    <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">Remove a client</span>
                                </button>
                                <div className="h-px bg-slate-100 my-1 mx-2"></div>
                                <button
                                    onClick={async () => {
                                        if (window.confirm("Delete account permanently?")) {
                                            if (await deleteUserAccount(realtorId)) onSignOut();
                                        }
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-rose-50 rounded-xl transition-colors group"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center group-hover:bg-rose-100 transition-colors">
                                        <i className="fa-solid fa-triangle-exclamation text-xs"></i>
                                    </div>
                                    <span className="text-xs font-bold text-rose-600 group-hover:text-rose-700">Delete Account</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default HubHeader;
