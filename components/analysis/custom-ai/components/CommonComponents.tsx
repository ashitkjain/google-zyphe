import React from 'react';
import { CommunityPulseSection, ImageQualityCategory } from '../../../../types';

export const getCleanDomain = (src: string) => {
    try {
        let url = new URL(src);
        if (url.hostname.includes('vertexaisearch.cloud.google.com') || url.hostname.includes('google.com')) {
            const uriParam = url.searchParams.get('uri');
            if (uriParam) url = new URL(uriParam);
        }
        return url.hostname.replace('www.', '');
    } catch (e) {
        return src.replace(/^https?:\/\//, '').split('/')[0].replace('www.', '');
    }
};

interface ThumbnailScrollerProps {
    indices: number[];
    propertyImages: string[];
    onMouseEnter: (image: string, e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseLeave: () => void;
}

export const ThumbnailScroller: React.FC<ThumbnailScrollerProps> = ({
    indices, propertyImages, onMouseEnter, onMouseMove, onMouseLeave
}) => {
    if (!indices || indices.length === 0 || !propertyImages.length) return null;
    return (
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {indices.map((idx) => (
                propertyImages[idx] && (
                    <div
                        key={idx}
                        onMouseEnter={(e) => onMouseEnter(propertyImages[idx], e)}
                        onMouseMove={onMouseMove}
                        onMouseLeave={onMouseLeave}
                        className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-slate-200 bg-slate-50 shadow-sm cursor-help active:scale-95 transition-transform"
                    >
                        <img src={propertyImages[idx]} alt="Evidence" className="w-full h-full object-cover" />
                    </div>
                )
            ))}
        </div>
    );
};

interface PulseCardProps {
    title: string;
    data?: CommunityPulseSection;
    icon: string;
    variant?: 'default' | 'concern';
}

export const PulseCard: React.FC<PulseCardProps> = ({ title, data, icon, variant = 'default' }) => {
    if (!data || !data.summary) return null;
    const cleanSources = Array.from(new Set(data.sources?.map(getCleanDomain))).filter(Boolean);
    const isConcern = variant === 'concern';
    return (
        <div className={`p-8 rounded-[2.5rem] border shadow-sm flex flex-col transition-all hover:shadow-xl hover:-translate-y-1 ${
            isConcern ? 'bg-rose-50/60 border-rose-200/60' : 'bg-white border-gray-100'
        }`}>
            <div className="flex items-center gap-4 mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    isConcern ? 'bg-rose-100 text-rose-500' : 'bg-gray-50 text-gray-400'
                }`}>
                    <i className={`fa-solid ${icon} text-xl`}></i>
                </div>
                <h4 className="text-2xl font-black text-gray-900 tracking-tight">{title}</h4>
                {isConcern && (
                    <span className="ml-auto text-[10px] font-black text-rose-500 bg-rose-100 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                        <i className="fa-solid fa-flag text-[9px]"></i>Flag
                    </span>
                )}
            </div>
            <p className={`font-sans font-normal mb-4 leading-[1.625] text-[14px] ${isConcern ? 'text-rose-900/80' : 'text-gray-700'}`}>{data.summary}</p>
            <ul className="space-y-2 mb-6 flex-1">
                {data.points?.map((pt, i) => (
                    <li key={i} className={`flex gap-3 text-[14px] leading-[1.625] font-sans font-normal ${isConcern ? 'text-rose-800/70' : 'text-gray-600'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${isConcern ? 'bg-rose-400' : 'bg-indigo-400'}`}></span>
                        {pt}
                    </li>
                ))}
            </ul>
            {cleanSources.length > 0 && (
                <div className={`pt-4 border-t ${isConcern ? 'border-rose-100' : 'border-gray-50'}`}>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Knowledge Sources</div>
                    <div className="text-[11px] text-gray-400 font-sans font-black leading-relaxed italic">{cleanSources.join(', ')}</div>
                </div>
            )}
        </div>
    );
};

export const EmptyState = ({ section }: { section: string }) => (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-[3rem] border border-slate-100">
        <i className="fa-solid fa-wand-magic-sparkles text-6xl mb-6 text-slate-200"></i>
        <p className="text-xl font-bold text-slate-800">No {section} Data Yet</p>
        <p className="text-[13px] font-black uppercase tracking-widest text-slate-400 mt-2">Zyphe is waiting for your analysis trigger</p>
    </div>
);
