import React from 'react';

interface ImageAnalysisViewProps {
    data: any[]; // Using any[] to handle potential variations, but acting on {image_id, analysis}
}

export const ImageAnalysisView: React.FC<ImageAnalysisViewProps> = ({ data }) => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-5xl mx-auto py-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(data || []).map((item, idx) => {
                // Handle both string and object formats for robustness
                const rawText = typeof item === 'string' ? item : (item?.analysis || '');
                const imageRef = typeof item === 'object' ? item?.image_id : null;

                const cleanText = typeof rawText === 'string'
                    ? rawText.replace(/^Image \d+[\s:]*/i, '')
                    : '';

                return (
                    <div key={idx} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-xl hover:shadow-indigo-500/5 transition-all group flex flex-col gap-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50/50 rounded-bl-[3rem] -z-10 group-hover:bg-indigo-50/50 transition-colors"></div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-[10px] font-black shadow-lg">
                                    {(idx + 1).toString().padStart(3, '0')}
                                </div>

                            </div>
                        </div>
                        <p className="text-slate-700 font-sans font-normal text-[14px] leading-relaxed relative z-10">
                            {cleanText}
                        </p>
                        <div className="flex items-center gap-2 pt-4 border-t border-slate-50 mt-auto">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Confidence High</span>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);
