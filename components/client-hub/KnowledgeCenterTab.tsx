import React, { useState, useEffect, useMemo } from 'react';
import BestPracticesTab from './BestPracticesTab';
import GuidesTab from './GuidesTab';
import { syncBestPractices } from '../../services/firebaseService';
import { auth } from '../../services/firebase/config';
import AuthModal from '../auth/AuthModal';
import { onAuthStateChanged } from 'firebase/auth';

interface KnowledgeCenterTabProps {
    onNavigate?: (view: any, path: string) => void;
}

const KnowledgeCenterTab: React.FC<KnowledgeCenterTabProps> = ({ onNavigate }) => {
    const [activeSubTab, setActiveSubTab] = useState<'playbooks' | 'resources' | 'training'>('playbooks');
    const [activeSection, setActiveSection] = useState('timings');
    const [isLoggedIn, setIsLoggedIn] = useState(!!auth.currentUser);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    // Stable references for GuidesTab props to prevent effect re-triggers
    const trainingShowIds = useMemo(() => ['technical_manual'], []);
    const trainingExcludeIds = useMemo(() => ['technical_manual'], []);

    // Listen for auth state changes
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            setIsLoggedIn(!!user);
        });
        return () => unsub();
    }, []);

    // Sync sub-tab with URL
    useEffect(() => {
        const syncSubTab = () => {
            const path = window.location.pathname;
            if (path.includes('/resources') || path.includes('/support') || path.includes('/platform-technical-manual') || path.includes('/buyer-instructions')) {
                if (path.includes('/training') || path.includes('/platform-technical-manual') || path.includes('/buyer-instructions')) {
                    setActiveSubTab('training');
                } else {
                    setActiveSubTab('resources');
                }
            } else if (path.includes('/playbooks')) {
                setActiveSubTab('playbooks');
            }
        };

        syncSubTab();
        window.addEventListener('popstate', syncSubTab);
        return () => window.removeEventListener('popstate', syncSubTab);
    }, []);

    const handleTabChange = (tabId: 'playbooks' | 'resources' | 'training') => {
        setActiveSubTab(tabId);
        if (onNavigate) {
            const topic = window.location.pathname.split('/')[1] || 'knowledge';
            onNavigate('knowledge_center', `/${topic}/${tabId}`);
        }
    };

    const handleSignIn = () => {
        setIsAuthModalOpen(true);
    };

    useEffect(() => {
        const sync = async () => {
            const lastSync = localStorage.getItem('zyphe_bp_sync_v2');
            const now = Date.now();
            if (!lastSync || now - parseInt(lastSync) > 86400000) {
                console.log('[Library] Auto-syncing Library Hub...');
                await syncBestPractices();
                localStorage.setItem('zyphe_bp_sync_v2', now.toString());
            }
        };
        sync();
    }, []);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Unified Toggle / Sub-nav */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-[40]">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-4">
                    <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-200/60 shadow-sm">
                        {[
                            { id: 'playbooks', label: 'Playbook Hub', icon: 'fa-graduation-cap', locked: false },
                            { id: 'resources', label: 'Guides & Manuals', icon: 'fa-book-open-reader', locked: false },
                            { id: 'training', label: 'Technical & Support', icon: 'fa-chalkboard-user', locked: !isLoggedIn },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id as any)}
                                className={`flex items-center gap-3 px-6 py-3 rounded-xl font-black transition-all text-[12px] uppercase tracking-widest whitespace-nowrap ${activeSubTab === tab.id ? 'bg-gradient-to-r from-indigo-700 to-gray-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-white'}`}
                            >
                                <i className={`fa-solid ${tab.locked ? 'fa-lock' : tab.icon} ${activeSubTab === tab.id ? 'text-white' : 'text-slate-300'}`}></i>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {!isLoggedIn ? (
                        <button
                            onClick={handleSignIn}
                            className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-200/50 hover:scale-105 hover:shadow-xl transition-all"
                        >
                            <i className="fa-solid fa-right-to-bracket text-xs"></i>
                            Sign In
                        </button>
                    ) : (
                        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-tight">
                            <i className="fa-solid fa-shield-halved text-indigo-400"></i>
                            Professional Intelligence Hub
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
                {activeSubTab === 'playbooks' ? (
                    <BestPracticesTab initialSection={activeSection} />
                ) : activeSubTab === 'training' ? (
                    !isLoggedIn ? (
                        <div className="flex-1 flex items-center justify-center h-full">
                            <div className="text-center max-w-md py-32">
                                <div className="w-20 h-20 rounded-[2rem] bg-slate-100 text-slate-400 flex items-center justify-center text-3xl mx-auto mb-8">
                                    <i className="fa-solid fa-lock"></i>
                                </div>
                                <h2 className="text-2xl font-black text-slate-900 mb-3">Sign In Required</h2>
                                <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
                                    Technical documentation and platform support are available to authenticated team members only.
                                </p>
                                <button
                                    onClick={handleSignIn}
                                    className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-200 hover:scale-105 transition-all"
                                >
                                    <i className="fa-solid fa-right-to-bracket"></i>
                                    Sign In / Join
                                </button>
                            </div>
                        </div>
                    ) : (
                        <GuidesTab 
                            onNavigate={onNavigate} 
                            showOnlyIds={trainingShowIds} 
                        />
                    )
                ) : (
                    <GuidesTab 
                        onNavigate={onNavigate} 
                        excludeIds={trainingExcludeIds} 
                    />
                )}
            </div>

            <AuthModal 
                isOpen={isAuthModalOpen} 
                onClose={() => setIsAuthModalOpen(false)} 
            />
        </div>
    );
};

export default KnowledgeCenterTab;
