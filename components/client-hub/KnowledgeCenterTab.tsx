import React, { useState, useEffect, useRef } from 'react';
import BestPracticesTab from './BestPracticesTab';
import GuidesTab from './GuidesTab';
import PlatformHelpTab from './PlatformHelpTab';
import { searchKnowledge, SearchResult, syncBestPractices } from '../../services/firebaseService';

interface KnowledgeCenterTabProps {
    onNavigate?: (view: any, path: string) => void;
}

const KnowledgeCenterTab: React.FC<KnowledgeCenterTabProps> = ({ onNavigate }) => {
    const [activeSubTab, setActiveSubTab] = useState<'playbooks' | 'resources' | 'support'>('playbooks');
    const [activeSection, setActiveSection] = useState('timings');

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
                <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-8 h-full">
                        <button
                            onClick={() => {
                                setActiveSubTab('playbooks');
                            }}
                            className={`h-full flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all relative ${activeSubTab === 'playbooks' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-graduation-cap text-[10px]"></i>
                            Best Practices
                            {activeSubTab === 'playbooks' && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"></div>
                            )}
                        </button>
                        <button
                            onClick={() => {
                                setActiveSubTab('resources');
                            }}
                            className={`h-full flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all relative ${activeSubTab === 'resources' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-book-open-reader text-[10px]"></i>
                            General Questions
                            {activeSubTab === 'resources' && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"></div>
                            )}
                        </button>
                        <button
                            onClick={() => {
                                setActiveSubTab('support');
                            }}
                            className={`h-full flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all relative ${activeSubTab === 'support' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-circle-question text-[10px]"></i>
                            Platform Help
                            {activeSubTab === 'support' && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"></div>
                            )}
                        </button>
                    </div>

                    <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-tight">
                        <i className="fa-solid fa-shield-halved text-indigo-400"></i>
                        Professional Library Hub
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
                {activeSubTab === 'playbooks' ? (
                    <BestPracticesTab initialSection={activeSection} />
                ) : activeSubTab === 'resources' ? (
                    <GuidesTab onNavigate={onNavigate} />
                ) : (
                    <PlatformHelpTab />
                )}
            </div>
        </div>
    );
};

export default KnowledgeCenterTab;
