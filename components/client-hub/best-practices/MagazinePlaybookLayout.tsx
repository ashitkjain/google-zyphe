import React from 'react';

export interface PlaybookStrategy {
    title: string;
    description: string;
    icon: string;
}

export interface PlaybookTemplate {
    tag: string;
    title: string;
    subtitle: string;
    body: string;
}

export interface PlaybookChecklist {
    title: string;
    items: string[];
}

export interface PlaybookInsight {
    title: string;
    type: 'table' | 'scripts' | 'timeline' | 'text';
    content: any;
}

export interface PlaybookProps {
    badge: string;
    title: string | React.ReactNode;
    subtitle: string;
    heroImage: string;
    heroTitle: string;
    heroDescription: string;
    strategyTitle: string;
    strategyDescription: string;
    strategies: PlaybookStrategy[];
    sideImage?: string;
    templatesTitle: string;
    templates: PlaybookTemplate[];
    checklists?: PlaybookChecklist[];
    insights?: PlaybookInsight[];
    footerTagline: string;
    footerActionLabel?: string;
    onAction?: () => void;
}

const MagazinePlaybookLayout: React.FC<PlaybookProps> = ({
    badge,
    title,
    subtitle,
    heroImage,
    heroTitle,
    heroDescription,
    strategyTitle,
    strategyDescription,
    strategies,
    sideImage,
    templatesTitle,
    templates,
    checklists,
    insights,
    footerTagline,
    footerActionLabel,
    onAction
}) => {
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Template copied to clipboard!');
    };

    return (
        <div className="playbook-container scrollbar-hide animate-in fade-in duration-700">
            <header className="playbook-header text-center px-6">
                <span className="playbook-badge inline-block mb-4 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-indigo-100">
                    {badge}
                </span>
                <h1 className="playbook-title text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-[1.1] mb-6">
                    {title}
                </h1>
                <p className="playbook-subtitle text-lg md:text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
                    {subtitle}
                </p>
            </header>

            <div className="playbook-hero relative rounded-[40px] overflow-hidden shadow-2xl h-[500px] my-20 group mx-6">
                <img src={heroImage} alt="Playbook Hero" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                <div className="playbook-hero-overlay absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent flex flex-col justify-end p-12">
                    <h2 className="text-3xl md:text-4xl font-black text-white mb-4">{heroTitle}</h2>
                    <p className="text-slate-200 text-lg opacity-90 max-w-xl leading-relaxed">
                        {heroDescription}
                    </p>
                </div>
            </div>

            <section className="playbook-section mb-32 px-6">
                <div className={`${sideImage ? 'grid lg:grid-cols-2 gap-20' : 'max-w-4xl mx-auto'} items-start`}>
                    <div className="playbook-content space-y-12">
                        <div>
                            <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">{strategyTitle}</h2>
                            <p className="text-lg text-slate-500 font-medium leading-relaxed">
                                {strategyDescription}
                            </p>
                        </div>
                        <div className={`grid ${!sideImage && strategies.length > 4 ? 'md:grid-cols-2 gap-8' : 'gap-6'}`}>
                            {strategies.map((strategy, idx) => (
                                <div key={idx} className="strategy-card bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:border-indigo-100 transition-all group/card">
                                    <div className="flex gap-6 items-start">
                                        <div className="strategy-icon w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center flex-shrink-0 group-hover/card:bg-indigo-600 group-hover/card:text-white transition-all duration-300">
                                            <i className={`fa-solid ${strategy.icon} text-xl`}></i>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-xl mb-2">{strategy.title}</h3>
                                            <p className="text-slate-500 leading-relaxed text-sm">
                                                {strategy.description}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {sideImage && (
                        <div className="sticky top-12 h-[650px] rounded-[40px] overflow-hidden shadow-2xl group hidden lg:block">
                            <img src={sideImage} alt="Side Visual" className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110" />
                            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-transparent"></div>
                        </div>
                    )}
                </div>
            </section>

            {/* Restored Checklists Section */}
            {checklists && checklists.length > 0 && (
                <section className="playbook-section mb-32 px-6">
                    <div className="grid md:grid-cols-2 gap-8">
                        {checklists.map((list, idx) => (
                            <div key={idx} className="bg-slate-900 text-white p-10 rounded-[40px] shadow-2xl relative overflow-hidden group">
                                <div className="relative z-10">
                                    <h3 className="text-2xl font-black mb-8 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-base">
                                            <i className="fa-solid fa-list-check"></i>
                                        </div>
                                        {list.title}
                                    </h3>
                                    <div className="space-y-4">
                                        {list.items.map((item, i) => (
                                            <div key={i} className="flex items-center gap-4 group/item">
                                                <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center flex-shrink-0 group-hover/item:bg-emerald-500 group-hover/item:border-emerald-500 transition-all">
                                                    <i className="fa-solid fa-check text-[10px] text-white opacity-0 group-hover/item:opacity-100 transition-opacity"></i>
                                                </div>
                                                <span className="text-slate-300 font-medium group-hover/item:text-white transition-colors">
                                                    {item}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Restored Insights Section (Tables, Scripts, etc.) */}
            {insights && insights.map((insight, idx) => (
                <section key={idx} className="playbook-section mb-32 px-6">
                    <div className="bg-white p-12 rounded-[40px] border border-slate-100 shadow-sm">
                        <h3 className="text-3xl font-black text-slate-900 mb-8">{insight.title}</h3>

                        {insight.type === 'table' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr>
                                            {Object.keys(insight.content[0] || {}).map((key) => (
                                                <th key={key} className="pb-4 px-4 font-black text-xs uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                                    {key.replace(/_/g, ' ')}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {insight.content.map((row: any, i: number) => (
                                            <tr key={i} className="group/row hover:bg-slate-50 transition-colors">
                                                {Object.values(row).map((val: any, j) => (
                                                    <td key={j} className="py-5 px-4 text-slate-600 font-medium border-b border-slate-50">
                                                        {val}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {insight.type === 'timeline' && (
                            <div className="space-y-8">
                                {insight.content.map((item: any, i: number) => (
                                    <div key={i} className="flex gap-8 items-start group/time">
                                        <div className="w-24 pt-1 flex-shrink-0 text-right">
                                            <span className="font-black text-indigo-500 text-xs uppercase tracking-widest">{item.label}</span>
                                        </div>
                                        <div className="relative pt-1 flex-shrink-0">
                                            <div className="w-3 h-3 rounded-full bg-slate-200 border-4 border-white group-hover/time:bg-indigo-600 group-hover/time:scale-125 transition-all shadow-sm"></div>
                                            {i !== insight.content.length - 1 && (
                                                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-0.5 h-full bg-slate-100 group-hover/time:bg-indigo-100"></div>
                                            )}
                                        </div>
                                        <div className="pb-8">
                                            <h4 className="font-bold text-slate-900 mb-1">{item.title}</h4>
                                            <p className="text-slate-500 text-sm leading-relaxed">{item.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {insight.type === 'scripts' && (
                            <div className="grid md:grid-cols-2 gap-8">
                                {insight.content.map((script: any, i: number) => (
                                    <div key={i} className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:border-indigo-100 hover:bg-white transition-all group/script">
                                        <h4 className="font-bold text-slate-900 mb-4 flex justify-between items-center text-lg">
                                            {script.title}
                                            <span className="px-3 py-1 bg-indigo-50 text-indigo-500 rounded-full text-[10px] uppercase font-black tracking-widest">Script</span>
                                        </h4>
                                        <p className="text-slate-600 text-sm italic leading-relaxed mb-6">"{script.body}"</p>
                                        <button
                                            onClick={() => copyToClipboard(script.body)}
                                            className="w-full py-3 bg-white border border-slate-200 rounded-xl font-bold text-[10px] uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:border-indigo-600 transition-all flex items-center justify-center gap-2"
                                        >
                                            <i className="fa-regular fa-copy"></i>
                                            Copy Script
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            ))}

            <section className="playbook-section mb-32 px-6">
                <h2 className="text-4xl font-black text-slate-900 text-center tracking-tight mb-16">{templatesTitle}</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {templates.map((template, idx) => (
                        <div key={idx} className="template-card relative bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all flex flex-col h-full group/temp">
                            <span className="template-tag inline-block mb-4 px-3 py-1 bg-slate-50 text-slate-400 group-hover/temp:bg-indigo-50 group-hover/temp:text-indigo-500 rounded-full text-[9px] font-black uppercase tracking-widest transition-colors">
                                {template.tag}
                            </span>
                            <h4 className="font-black text-slate-900 text-xl mb-1">{template.title}</h4>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-6">{template.subtitle}</p>
                            <div className="template-body flex-1 bg-slate-50 p-6 rounded-2xl text-slate-600 text-sm leading-relaxed mb-6 border border-slate-100 group-hover/temp:bg-white transition-colors italic">
                                "{template.body}"
                            </div>
                            <button
                                className="copy-btn w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transform active:scale-95 transition-all flex items-center justify-center gap-3 shadow-lg shadow-slate-200 hover:shadow-indigo-200"
                                onClick={() => copyToClipboard(template.body)}
                            >
                                <i className="fa-regular fa-copy"></i>
                                Copy Template
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            <footer className="playbook-footer text-center py-32 rounded-[60px] bg-slate-900 text-white relative overflow-hidden mx-6 mb-12">
                <div className="relative z-10 max-w-4xl mx-auto px-6">
                    <p className="text-indigo-400 font-black uppercase tracking-[0.3em] text-xs mb-6 -mt-4">
                        Mastering the Craft
                    </p>
                    <h2 className="text-4xl md:text-5xl font-black mb-12 leading-tight">
                        {footerTagline}
                    </h2>
                    {footerActionLabel && (
                        <button
                            onClick={onAction}
                            className="bg-white text-slate-900 px-10 py-4 rounded-full font-black uppercase tracking-widest text-xs hover:bg-indigo-500 hover:text-white transition-all transform hover:scale-105 active:scale-95 shadow-xl"
                        >
                            {footerActionLabel}
                        </button>
                    )}
                </div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-[120px] -mr-48 -mt-48 animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-slate-500/10 rounded-full blur-[100px] -ml-40 -mb-40"></div>
            </footer>
        </div>
    );
};

export default MagazinePlaybookLayout;
