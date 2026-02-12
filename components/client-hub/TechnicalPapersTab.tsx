import React, { useState } from 'react';
import RecommenderPaper from './RecommenderPaper';
import ContextGraphPaper from './ContextGraphPaper';

type PaperId = 'recommender_system' | 'context_graph';

interface TechnicalPapersTabProps {
    initialPaper?: PaperId;
    setActiveTab?: (tab: any) => void;
    onNavigate?: (view: any, path: string) => void;
}

const TechnicalPapersTab: React.FC<TechnicalPapersTabProps> = ({ initialPaper, setActiveTab, onNavigate }) => {
    const [activePaper, setActivePaper] = useState<PaperId>(initialPaper || 'recommender_system');

    // Sync state if initialPaper changes
    React.useEffect(() => {
        if (initialPaper) setActivePaper(initialPaper);
    }, [initialPaper]);

    const papers = [
        { id: 'recommender_system', title: 'An Intelligent Context Aware Recommender System for Real Estate', date: 'Feb 2026', volume: 'Vol 01 / No. 04' },
        { id: 'context_graph', title: 'The Zyphe "Context Graph"', date: 'Feb 2026', volume: 'Vol 01 / No. 05' },
    ];

    return (
        <div className="p-12 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700 pb-32">
            {activePaper === 'recommender_system' && <RecommenderPaper p={papers[0]} />}
            {activePaper === 'context_graph' && (
                <ContextGraphPaper
                    p={papers[1]}
                    setActiveTab={setActiveTab}
                    onNavigate={onNavigate}
                />
            )}
        </div>
    );
};

export default TechnicalPapersTab;
