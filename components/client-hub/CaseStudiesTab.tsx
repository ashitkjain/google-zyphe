import React, { useState } from 'react';
import CompassCaseStudy from './case-studies/CompassCaseStudy';
import CotalityCaseStudy from './case-studies/CotalityCaseStudy';
import RadiusCaseStudy from './case-studies/RadiusCaseStudy';

const CaseStudiesTab: React.FC = () => {
    const [selectedCaseStudy, setSelectedCaseStudy] = useState<'compass' | 'cotality' | 'radius'>('compass');

    return (
        <div className="min-h-full bg-slate-50 p-6 md:p-12 space-y-12">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                <i className="fa-solid fa-book-open text-sm"></i>
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Industry Case Studies</h1>
                        </div>
                        <p className="text-slate-500 font-medium ml-13">Strategic deep-dives into real estate technological transformation, and how Zyphe is building with the best principles that were key to their successes.</p>
                    </div>

                    <div className="flex gap-2 p-1.5 bg-slate-200/50 rounded-2xl border border-slate-200 backdrop-blur-sm">
                        <button
                            onClick={() => setSelectedCaseStudy('compass')}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedCaseStudy === 'compass' ? 'bg-white text-slate-900 shadow-xl shadow-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Compass Group
                        </button>
                        <button
                            onClick={() => setSelectedCaseStudy('cotality')}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedCaseStudy === 'cotality' ? 'bg-white text-slate-900 shadow-xl shadow-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Cotality
                        </button>
                        <button
                            onClick={() => setSelectedCaseStudy('radius')}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedCaseStudy === 'radius' ? 'bg-white text-slate-900 shadow-xl shadow-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Radius Agent
                        </button>
                    </div>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {selectedCaseStudy === 'compass' && <CompassCaseStudy />}
                    {selectedCaseStudy === 'cotality' && <CotalityCaseStudy />}
                    {selectedCaseStudy === 'radius' && <RadiusCaseStudy />}
                </div>

                <div className="flex justify-between items-center py-8 border-t border-slate-200">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Data Synchronized: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </div>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <i className="fa-solid fa-shield-halved"></i>
                            Internal Only
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CaseStudiesTab;
