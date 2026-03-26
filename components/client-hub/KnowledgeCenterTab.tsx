import React, { useState, useEffect, useRef } from 'react';
import BestPracticesTab from './BestPracticesTab';
import GuidesTab from './GuidesTab';
import PlatformHelpTab from './PlatformHelpTab';
import { searchKnowledge, SearchResult, syncBestPractices } from '../../services/firebaseService';

interface KnowledgeCenterTabProps {
    onNavigate?: (view: any, path: string) => void;
}

const KnowledgeCenterTab: React.FC<KnowledgeCenterTabProps> = ({ onNavigate }) => {
    const [activeSubTab, setActiveSubTab] = useState<'playbooks' | 'resources' | 'training'>('playbooks');
    const [activeSection, setActiveSection] = useState('timings');

    // Sync sub-tab with URL
    useEffect(() => {
        const syncSubTab = () => {
            const path = window.location.pathname;
            if (path.includes('/resources') || path.includes('/support') || path.includes('/platform-technical-manual') || path.includes('/buyer-instructions')) {
                // If it's a training-specific item, use training tab
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

    useEffect(() => {
        // One-time sync of static best practices to Firestore for semantic search
        const sync = async () => {
            const lastSync = localStorage.getItem('zyphe_bp_sync_v2');
            const now = Date.now();
            // Sync once every 24 hours in dev/demo or first time
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
                            { id: 'playbooks', label: 'Playbook Hub', icon: 'fa-graduation-cap' },
                            { id: 'resources', label: 'Guides & Manuals', icon: 'fa-book-open-reader' },
                            { id: 'training', label: 'Technical & Support', icon: 'fa-chalkboard-user' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id as any)}
                                className={`flex items-center gap-3 px-6 py-3 rounded-xl font-black transition-all text-[12px] uppercase tracking-widest whitespace-nowrap ${activeSubTab === tab.id ? 'bg-gradient-to-r from-indigo-700 to-gray-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-white'}`}
                            >
                                <i className={`fa-solid ${tab.icon} ${activeSubTab === tab.id ? 'text-white' : 'text-slate-300'}`}></i>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-tight">
                        <i className="fa-solid fa-shield-halved text-indigo-400"></i>
                        Professional Intelligence Hub
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
                {activeSubTab === 'playbooks' ? (
                    <BestPracticesTab initialSection={activeSection} />
                ) : (
                    <GuidesTab 
                        onNavigate={onNavigate} 
                        initialCategoryId={activeSubTab === 'training' ? 'training' : undefined} 
                    />
                )}
            </div>
        </div>
    );
};

export default KnowledgeCenterTab;
