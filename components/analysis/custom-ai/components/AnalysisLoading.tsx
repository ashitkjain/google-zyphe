import React from 'react';

interface AnalysisLoadingProps {
    title: string;
    subtitle?: string;
    timer: number;
    address?: string;
    icon: string;
}

export const AnalysisLoading: React.FC<AnalysisLoadingProps> = ({ title, subtitle, timer, address, icon }) => (
    <div className="bg-indigo-50 border border-indigo-100 rounded-[3rem] p-12 text-center my-10 shadow-sm flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-20 h-20 mb-8 relative">
            <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
            <div className="absolute inset-0 border-t-4 border-indigo-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <i className={`fa-solid ${icon} text-indigo-600 text-2xl animate-pulse`}></i>
            </div>
        </div>
        <h3 className="text-3xl font-black text-indigo-900 mb-4 tracking-tight">{title}</h3>
        <div className="mb-4">
            <span className="px-5 py-2 bg-white border border-indigo-100 rounded-full text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] shadow-sm flex items-center gap-2">
                <i className="fa-solid fa-clock animate-pulse"></i>
                Time: <span className="font-mono text-xs">{timer}s</span>
            </span>
        </div>
        {subtitle && <p className="text-indigo-700/70 text-lg font-medium">{subtitle}</p>}
        {address && (
            <p className="text-indigo-900/40 font-black uppercase tracking-widest text-[10px] mt-4 bg-white/50 px-4 py-1 rounded-lg inline-block">
                {address}
            </p>
        )}
    </div>
);

export const GeneralAnalysisLoading: React.FC<{ timer: number }> = ({ timer }) => (
    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-12 text-center my-10 shadow-sm flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative w-20 h-20 mb-8">
            <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
            <div className="absolute inset-0 border-t-4 border-indigo-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <i className="fa-solid fa-wand-magic-sparkles text-indigo-600 text-2xl animate-pulse"></i>
            </div>
        </div>
        <h3 className="text-3xl font-black text-indigo-900 mb-4 tracking-tight">Zyphe™ Visual Scanning...</h3>
        <div className="mb-8">
            <span className="px-5 py-2 bg-white border border-indigo-100 rounded-full text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] shadow-sm inline-flex items-center gap-2">
                <i className="fa-solid fa-clock animate-pulse"></i>
                Time Elapsed: <span className="font-mono text-xs">{timer}s</span>
            </span>
        </div>
        <p className="text-indigo-700/70 max-w-md mx-auto text-lg font-medium">Our multimodal engine is dissecting architecture and neighborhood context.</p>
    </div>
);
