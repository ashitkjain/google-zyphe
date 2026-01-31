import React from 'react';
import { PlaybookProps } from './MagazinePlaybookLayout';

interface PremiumLegacyBridgeProps {
    data: PlaybookProps;
    mode: 'top' | 'bottom';
}

const PremiumLegacyBridge: React.FC<PremiumLegacyBridgeProps> = ({ data, mode }) => {
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Template copied to clipboard!');
    };

    if (mode === 'top') {
        return (
            <div className="space-y-12 mb-12">
                {/* Hero Image */}
                <div className="relative rounded-[32px] overflow-hidden shadow-xl h-[300px] group">
                    <img
                        src={data.heroImage}
                        alt={data.heroTitle}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent flex flex-col justify-end p-8 text-left">
                        <h2 className="text-2xl font-black text-white mb-2">{data.heroTitle}</h2>
                        <p className="text-slate-200 text-sm opacity-90 max-w-lg leading-relaxed">
                            {data.heroDescription}
                        </p>
                    </div>
                </div>

                {/* Rituals (Black Box) */}
                {data.checklists && data.checklists.length > 0 && (
                    <div className="bg-slate-900 text-white p-8 rounded-[32px] shadow-lg relative overflow-hidden group">
                        <div className="relative z-10 text-left">
                            <h3 className="text-xl font-black mb-6 flex items-center gap-3 text-indigo-400">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                    <i className="fa-solid fa-list-check"></i>
                                </div>
                                {data.checklists[0].title}
                            </h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                {data.checklists[0].items.map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 group/item text-left">
                                        <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center flex-shrink-0 group-hover/item:bg-emerald-500 group-hover/item:border-emerald-500 transition-all">
                                            <i className="fa-solid fa-check text-[8px] text-white opacity-0 group-hover/item:opacity-100 transition-opacity"></i>
                                        </div>
                                        <span className="text-slate-300 text-sm font-medium group-hover/item:text-white transition-colors">
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-[60px] -mr-24 -mt-24"></div>
                    </div>
                )}
            </div>
        );
    }

    if (mode === 'bottom') {
        return (
            <div className="mt-16 pt-16 border-t border-slate-200">
                <h3 className="text-2xl font-black text-slate-900 mb-8 text-center">{data.templatesTitle}</h3>
                <div className="grid md:grid-cols-3 gap-6">
                    {data.templates.slice(0, 3).map((template, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col h-full group text-left">
                            <span className="inline-block mb-3 px-2 py-1 bg-slate-50 text-slate-400 text-[8px] font-black uppercase tracking-widest rounded-full w-fit">
                                {template.tag}
                            </span>
                            <h4 className="font-bold text-slate-900 text-base mb-1">{template.title}</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-4">{template.subtitle}</p>
                            <div className="flex-1 bg-slate-50 p-4 rounded-xl text-slate-600 text-xs leading-relaxed mb-4 italic border border-slate-100 transition-colors group-hover:bg-white">
                                "{template.body}"
                            </div>
                            <button
                                onClick={() => copyToClipboard(template.body)}
                                className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 transform active:scale-95 shadow-lg shadow-slate-100 hover:shadow-indigo-100"
                            >
                                <i className="fa-regular fa-copy"></i>
                                Copy Hook
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return null;
};

export default PremiumLegacyBridge;
