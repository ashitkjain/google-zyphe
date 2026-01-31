import React, { useState, useEffect, useRef } from 'react';
import BestPracticesTab from './BestPracticesTab';
import GuidesTab from './GuidesTab';
import { searchKnowledge, SearchResult, syncBestPractices } from '../../services/firebaseService';

interface KnowledgeCenterTabProps {
    onNavigate?: (view: any, path: string) => void;
}

const KnowledgeCenterTab: React.FC<KnowledgeCenterTabProps> = ({ onNavigate }) => {
    const [activeSubTab, setActiveSubTab] = useState<'playbooks' | 'resources'>('playbooks');
    const [activeSection, setActiveSection] = useState('timings');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // One-time sync of static best practices to Firestore for semantic search
        const sync = async () => {
            const lastSync = localStorage.getItem('zyphe_bp_sync_v2');
            const now = Date.now();
            // Sync once every 24 hours in dev/demo or first time
            if (!lastSync || now - parseInt(lastSync) > 86400000) {
                console.log('[KnowledgeCenter] Auto-syncing Intelligence Hub...');
                await syncBestPractices();
                localStorage.setItem('zyphe_bp_sync_v2', now.toString());
            }
        };
        sync();
    }, []);

    useEffect(() => {
        const handler = setTimeout(async () => {
            if (searchQuery.length > 2) {
                setIsSearching(true);
                const results = await searchKnowledge(searchQuery);
                setSearchResults(results);
                setIsSearching(false);
                setShowResults(true);
            } else {
                setSearchResults([]);
                setShowResults(false);
            }
        }, 500);

        return () => clearTimeout(handler);
    }, [searchQuery]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
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
                                setShowResults(false);
                            }}
                            className={`h-full flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all relative ${activeSubTab === 'playbooks' && !showResults ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-graduation-cap text-[10px]"></i>
                            Best Practices
                            {(activeSubTab === 'playbooks' && !showResults) && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"></div>
                            )}
                        </button>
                        <button
                            onClick={() => {
                                setActiveSubTab('resources');
                                setShowResults(false);
                            }}
                            className={`h-full flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all relative ${activeSubTab === 'resources' && !showResults ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-book-open-reader text-[10px]"></i>
                            General Questions
                            {(activeSubTab === 'resources' && !showResults) && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"></div>
                            )}
                        </button>
                    </div>

                    {/* Semantic Search Bar */}
                    <div className="flex-1 max-w-md relative" ref={searchRef}>
                        <div className="relative group">
                            <i className={`fa-solid ${isSearching ? 'fa-circle-notch fa-spin' : 'fa-magnifying-glass'} absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors`}></i>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by meaning... (e.g. 'closing process')"
                                className="w-full bg-slate-100 border-none rounded-full py-2 pl-11 pr-4 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none"
                            />
                        </div>

                        {/* Search Results Dropdown */}
                        {showResults && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[50]">
                                <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Intelligence Results</span>
                                    <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">AI Semantic Match</span>
                                </div>
                                <div className="max-h-[60vh] overflow-y-auto">
                                    {searchResults.length > 0 ? (
                                        searchResults.map((result) => (
                                            <button
                                                key={result.id}
                                                onClick={() => {
                                                    if (result.topicSlug === 'best_practices') {
                                                        setActiveSubTab('playbooks');
                                                        setActiveSection(result.slug);
                                                    } else {
                                                        setActiveSubTab('resources');
                                                    }
                                                    if (onNavigate) onNavigate('knowledge_center', `/${result.topicSlug}/${result.slug}`);
                                                    setShowResults(false);
                                                    setSearchQuery('');
                                                }}
                                                className="w-full p-4 text-left hover:bg-slate-50 flex items-start gap-3 transition-colors group border-b border-slate-50 last:border-0"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                                                    <i className="fa-solid fa-file-lines text-indigo-500 text-xs"></i>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[11px] font-bold text-slate-900 truncate mb-0.5">{result.title}</div>
                                                    <div className="text-[9px] font-medium text-slate-500 uppercase tracking-tight truncate opacity-60">Category: {result.topicSlug}</div>
                                                </div>
                                                <div className="text-[9px] font-black text-indigo-400 bg-indigo-50/50 px-1.5 py-0.5 rounded border border-indigo-100/50 shrink-0 uppercase tracking-tighter">
                                                    {(result.score * 100).toFixed(0)}% Match
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center">
                                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <i className="fa-solid fa-face-sad-tear text-slate-400"></i>
                                            </div>
                                            <div className="text-[11px] font-bold text-slate-900 mb-1">No relevant intelligence found</div>
                                            <div className="text-[10px] text-slate-500">Try rephrasing your search or using broader terms.</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
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
                    <GuidesTab onNavigate={onNavigate} />
                )}
            </div>
        </div>
    );
};

export default KnowledgeCenterTab;
