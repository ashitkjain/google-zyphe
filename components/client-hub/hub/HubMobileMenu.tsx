import React from 'react';
import { HubTab } from './HubHeader';

interface HubMobileMenuProps {
    showHamburger: boolean;
    isMobileMenuOpen: boolean;
    setIsMobileMenuOpen: (open: boolean) => void;
    activeTab: HubTab;
    setActiveTab: (tab: HubTab) => void;
    onNavigate?: (view: any, path: string) => void;
    earlyTabs: { id: HubTab; label: string; icon: string }[];
    lateTabs: { id: HubTab; label: string; icon: string }[];
    toolTabs: { id: HubTab; label: string; icon: string }[];
    adminTabs: { id: HubTab; label: string; icon: string }[];
    investorTabs: { id: HubTab; label: string; icon: string }[];
    isMobileToolsExpanded: boolean;
    setIsMobileToolsExpanded: (exp: boolean) => void;
    isMobileInvestorExpanded: boolean;
    setIsMobileInvestorExpanded: (exp: boolean) => void;
    isMobileSettingsExpanded: boolean;
    setIsMobileSettingsExpanded: (exp: boolean) => void;
    handleResetAllData: () => Promise<void>;
    handleSeedManualMockData: () => Promise<void>;
    setIsAddClientModalOpen: (open: boolean) => void;
    setIsRemoveClientModalOpen: (open: boolean) => void;
    onSignOut: () => void;
    realtorId: string;
    deleteUserAccount: (uid: string) => Promise<boolean>;
}

const HubMobileMenu: React.FC<HubMobileMenuProps> = ({
    showHamburger, isMobileMenuOpen, setIsMobileMenuOpen, activeTab, setActiveTab,
    onNavigate, earlyTabs, lateTabs, toolTabs, adminTabs, investorTabs, isMobileToolsExpanded,
    setIsMobileToolsExpanded, isMobileInvestorExpanded, setIsMobileInvestorExpanded,
    isMobileSettingsExpanded, setIsMobileSettingsExpanded,
    handleResetAllData, handleSeedManualMockData, setIsAddClientModalOpen,
    setIsRemoveClientModalOpen, onSignOut, realtorId, deleteUserAccount
}) => {
    if (!showHamburger || !isMobileMenuOpen) return null;

    const TabButton = ({ tab, isSub = false }: { tab: any, isSub?: boolean }) => (
        <button
            onClick={() => {
                setActiveTab(tab.id);
                setIsMobileMenuOpen(false);
                if (onNavigate) onNavigate(tab.id as any, '');
            }}
            className={`flex items-center gap-4 w-full ${isSub ? 'p-3 rounded-lg text-[10px]' : 'p-4 rounded-xl text-[11px]'} font-black uppercase tracking-[0.2em] transition-all ${activeTab === tab.id ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-white bg-slate-800/50 border border-white/5'}`}
        >
            <i className={`fa-solid ${tab.icon} w-5 text-center ${isSub ? 'text-[10px]' : 'text-xs'}`}></i>
            {tab.label}
        </button>
    );

    return (
        <div className="fixed inset-0 z-[105] bg-slate-900 pt-[72px] animate-in slide-in-from-top duration-300">
            <div className="flex flex-col p-4 space-y-1.5 max-h-screen overflow-y-auto pb-24">
                {earlyTabs.concat(lateTabs).map(tab => (
                    <TabButton key={tab.id} tab={tab} />
                ))}

                {investorTabs.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                        <button
                            onClick={() => setIsMobileInvestorExpanded(!isMobileInvestorExpanded)}
                            className={`flex items-center justify-between w-full p-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all ${(investorTabs.some(t => t.id === activeTab) || isMobileInvestorExpanded) ? 'text-indigo-400' : 'text-slate-400 hover:text-white bg-slate-800/50 border border-white/5'}`}
                        >
                            <div className="flex items-center gap-4">
                                <i className="fa-solid fa-chart-pie w-5 text-center text-xs"></i>
                                Investor Tools
                            </div>
                            <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-300 ${isMobileInvestorExpanded ? 'rotate-180' : ''}`}></i>
                        </button>

                        {isMobileInvestorExpanded && (
                            <div className="pl-4 space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                                {investorTabs.map(tab => <TabButton key={tab.id} tab={tab} isSub />)}
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-1.5 pt-2">
                    <button
                        onClick={() => setIsMobileToolsExpanded(!isMobileToolsExpanded)}
                        className={`flex items-center justify-between w-full p-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all ${(toolTabs.some(t => t.id === activeTab) || adminTabs.some(t => t.id === activeTab) || isMobileToolsExpanded) ? 'text-indigo-400' : 'text-slate-400 hover:text-white bg-slate-800/50 border border-white/5'}`}
                    >
                        <div className="flex items-center gap-4">
                            <i className="fa-solid fa-toolbox w-5 text-center text-xs"></i>
                            Realtor Tools
                        </div>
                        <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-300 ${isMobileToolsExpanded ? 'rotate-180' : ''}`}></i>
                    </button>

                    {isMobileToolsExpanded && (
                        <div className="pl-4 space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                            {toolTabs.map(tab => <TabButton key={tab.id} tab={tab} isSub />)}
                            <div className="h-px bg-white/5 my-2 mx-4"></div>
                            <div className="px-4 py-2 text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Admin</div>
                            {adminTabs.map(tab => <TabButton key={tab.id} tab={tab} isSub />)}
                            <div className="h-px bg-white/5 my-2 mx-4"></div>
                            <button onClick={async () => { if (confirm("Reset Data?")) { await handleResetAllData(); setIsMobileMenuOpen(false); } }} className="flex items-center gap-4 w-full p-3 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
                                <i className="fa-solid fa-trash-can w-5 text-center text-[10px]"></i> Reset Data
                            </button>
                            <button onClick={async () => { await handleSeedManualMockData(); setIsMobileMenuOpen(false); }} className="flex items-center gap-4 w-full p-3 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
                                <i className="fa-solid fa-database w-5 text-center text-[10px]"></i> Seed Mock Data
                            </button>
                        </div>
                    )}
                </div>

                <div className="space-y-1.5 pt-2">
                    <button
                        onClick={() => setIsMobileSettingsExpanded(!isMobileSettingsExpanded)}
                        className={`flex items-center justify-between w-full p-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'profile' ? 'text-indigo-400' : 'text-slate-400 hover:text-white bg-slate-800/50 border border-white/5'}`}
                    >
                        <div className="flex items-center gap-4">
                            <i className="fa-solid fa-gear w-5 text-center text-xs"></i>
                            Settings
                        </div>
                        <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-300 ${isMobileSettingsExpanded ? 'rotate-180' : ''}`}></i>
                    </button>

                    {isMobileSettingsExpanded && (
                        <div className="pl-4 space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                            <TabButton tab={{ id: 'profile', label: 'My Profile', icon: 'fa-id-badge' }} isSub />
                            <button onClick={() => { setIsAddClientModalOpen(true); setIsMobileMenuOpen(false); }} className="flex items-center gap-4 w-full p-3 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
                                <i className="fa-solid fa-user-plus w-5 text-center text-[10px]"></i> Add a client
                            </button>
                            <button onClick={() => { setIsRemoveClientModalOpen(true); setIsMobileMenuOpen(false); }} className="flex items-center gap-4 w-full p-3 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
                                <i className="fa-solid fa-user-minus w-5 text-center text-[10px]"></i> Remove a client
                            </button>
                            <button onClick={async () => { if (confirm("Delete Account?")) { if (await deleteUserAccount(realtorId)) onSignOut(); } }} className="flex items-center gap-4 w-full p-3 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] text-rose-500/80">
                                <i className="fa-solid fa-triangle-exclamation w-5 text-center text-[10px]"></i> Delete Account
                            </button>
                        </div>
                    )}
                </div>

                <div className="pt-2 mt-4 border-t border-white/5">
                    <button onClick={onSignOut} className="flex items-center gap-4 w-full p-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] text-rose-400 bg-rose-500/5 border border-rose-500/10">
                        <i className="fa-solid fa-right-from-bracket w-5 text-center text-xs"></i> Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HubMobileMenu;
