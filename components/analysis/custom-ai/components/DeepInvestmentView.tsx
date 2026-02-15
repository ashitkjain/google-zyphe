import React from 'react';
import { DeepInvestmentResearchResult } from '../../../../types';

interface DeepInvestmentViewProps {
    data: DeepInvestmentResearchResult;
}

export const DeepInvestmentView: React.FC<DeepInvestmentViewProps> = ({ data }) => {
    const renderMarkdown = (content: any) => {
        if (typeof content !== 'string') return JSON.stringify(content, null, 2);

        // Fix for literal \n sequences and escaped characters like \$
        const processedContent = content
            .replace(/\\n/g, '\n')
            .replace(/\\(\$|#|\*|_|\[|\])/g, '$1');

        const lines = processedContent.split('\n');
        return lines.map((line, idx) => {
            // Horizontal rule
            if (line.trim() === '---') {
                return <hr key={idx} className="my-8 border-gray-100" />;
            }

            // Headers
            if (line.startsWith('# ')) {
                return <h1 key={idx} className="text-3xl font-black text-gray-900 mt-12 mb-6 tracking-tight border-b border-gray-50 pb-4">{line.slice(2)}</h1>;
            }
            if (line.startsWith('## ')) {
                return <h2 key={idx} className="text-2xl font-black text-gray-800 mt-10 mb-4 tracking-tight">{line.slice(3)}</h2>;
            }
            if (line.startsWith('### ')) {
                return <h3 key={idx} className="text-xl font-black text-gray-800 mt-8 mb-3 tracking-tight">{line.slice(4)}</h3>;
            }

            // Bullet points
            if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
                const bulletContent = line.trim().slice(2);
                return (
                    <div key={idx} className="flex gap-3 mb-2 ml-4">
                        <span className="text-indigo-400 mt-1.5">•</span>
                        <div className="flex-1">
                            {renderTextWithBold(bulletContent)}
                        </div>
                    </div>
                );
            }

            // Paragraph
            if (line.trim() === '') return <div key={idx} className="h-4" />;

            return (
                <p key={idx} className="mb-4 leading-[1.8] text-gray-700 font-medium">
                    {renderTextWithBold(line)}
                </p>
            );
        });
    };

    const renderTextWithBold = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*|__.*?__)/);
        return parts.map((part, i) => {
            if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
                return <strong key={i} className="font-extrabold text-gray-900">{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-5xl mx-auto space-y-8 pb-12 font-sans" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-[0_8px_40px_rgb(0,0,0,0.04)] overflow-hidden p-10 space-y-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <i className="fa-solid fa-magnifying-glass-chart text-xl"></i>
                    </div>
                    <div className="flex flex-col">
                        <h4 className="text-2xl font-black text-[#1a2333] tracking-tight">Investment Research</h4>
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Grounded AI Analysis • Short & Long Term</p>
                    </div>
                </div>

                <div className="prose prose-slate max-w-none">
                    <div className="text-gray-700 font-sans font-normal leading-[1.8] text-[15px] selection:bg-indigo-100 selection:text-indigo-900">
                        {renderMarkdown(data.content)}
                    </div>
                </div>

                {data.lastUpdated && (
                    <div className="pt-8 border-t border-gray-50 flex items-center justify-between">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                            Source: Gemini Deep Research Agent
                        </div>
                        <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest font-mono">
                            Processed: {new Date(data.lastUpdated?.seconds * 1000 || Date.now()).toLocaleDateString()}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .prose div {
                    color: #334155;
                }
                .prose strong {
                    color: #0f172a;
                    font-weight: 800;
                }
                .prose h1, .prose h2, .prose h3 {
                    color: #1e293b;
                    font-weight: 900;
                }
            `}</style>
        </div>
    );
};
