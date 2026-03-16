import React from 'react';
import { ImageQualityAnalysisResult, ImageQualityCategory } from '../../../../types';
import { ThumbnailScroller } from './CommonComponents';

interface QualityAnalysisViewProps {
    data: ImageQualityAnalysisResult;
    propertyImages: string[];
    onMouseEnter: (image: string, e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseLeave: () => void;
}

export const QualityAnalysisView: React.FC<QualityAnalysisViewProps> = ({
    data, propertyImages, onMouseEnter, onMouseMove, onMouseLeave
}) => {
    const QualityVerdictWidget = ({ summary }: { summary?: string }) => (
        <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1 text-center md:text-left">
                <h4 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Picture Quality Audit Verdict</h4>
                <p className="text-gray-600 text-sm font-medium leading-relaxed italic">"{summary || 'Analysis complete.'}"</p>
            </div>
        </div>
    );

    const QualityRatingCard = ({ title, category, icon }: { title: string, category?: ImageQualityCategory, icon: string }) => {
        if (!category?.rating) return null;

        return (
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col transition-all hover:shadow-xl">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-indigo-600">
                            <i className={`fa-solid ${icon}`}></i>
                        </div>
                        <h4 className="font-black text-gray-900 tracking-tight text-xl">{title}</h4>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${category.rating.toLowerCase().includes('good') ? 'bg-emerald-50 text-emerald-600' :
                        category.rating.toLowerCase().includes('fair') ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                        {category.rating}
                    </span>
                </div>
                <div className="space-y-6 flex-1">
                    <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Observations</div>
                        <ul className="space-y-4">
                            {category.observations?.map((point, i) => (
                                <li key={i} className="flex flex-col">
                                    <div className="text-[13px] text-gray-600 font-normal flex gap-2 leading-[1.625]">
                                        <span className="text-indigo-400">•</span> {point.text}
                                    </div>
                                    <ThumbnailScroller indices={point.image_indices} propertyImages={propertyImages} onMouseEnter={onMouseEnter} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} />
                                </li>
                            ))}
                        </ul>
                    </div>
                    {category.issues && category.issues.length > 0 && (
                        <div>
                            <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-2">Potential Issues</div>
                            <ul className="space-y-4">
                                {category.issues.map((point, i) => (
                                    <li key={i} className="flex flex-col">
                                        <div className="text-[13px] text-rose-700/80 font-normal flex gap-2 italic leading-[1.625]">
                                            <span className="text-rose-400">!</span> {point.text}
                                        </div>
                                        <ThumbnailScroller indices={point.image_indices} propertyImages={propertyImages} onMouseEnter={onMouseEnter} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const QualityTopPhotos = ({ photos }: { photos: ImageQualityAnalysisResult['top_photos'] }) => (
        <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-8">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <i className="fa-solid fa-crown text-xl"></i>
                </div>
                <h4 className="text-2xl font-black text-gray-900 tracking-tight">Prime Shots Showcase</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(photos || []).map((photo, i) => (
                    <div key={i} className="group relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-all">
                        <div className="aspect-video relative overflow-hidden bg-gray-100">
                            <img src={propertyImages[photo.image_index]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={photo.label} />
                            <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded-lg text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <i className="fa-solid fa-star text-amber-400"></i> {photo.label}
                            </div>
                        </div>
                        <div className="p-4 bg-white">
                            <p className="text-[12px] text-gray-600 font-sans leading-relaxed italic">"{photo.justification}"</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const QualityDeleteList = ({ deleteList }: { deleteList: ImageQualityAnalysisResult['delete_list'] }) => (
        <div className="bg-rose-50/50 rounded-[3rem] border border-rose-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600">
                        <i className="fa-solid fa-trash-can text-xl"></i>
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-rose-900 tracking-tight">Culling Recommendation</h4>
                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{deleteList?.count || 0} items flagged for removal</span>
                    </div>
                </div>
            </div>
            <p className="text-rose-900/70 text-sm font-sans leading-relaxed font-medium italic">"{deleteList?.description}"</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-rose-100">
                <div className="space-y-4">
                    <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Reasoning</div>
                    <ul className="space-y-3">
                        {deleteList?.reasons?.map((reason, i) => (
                            <li key={i} className="flex gap-3 text-rose-800 text-[13px] leading-relaxed font-sans font-medium">
                                <span className="text-rose-400 font-black">!</span> {reason}
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-4">Flagged Assets</div>
                    <ThumbnailScroller indices={deleteList?.image_indices || []} propertyImages={propertyImages} onMouseEnter={onMouseEnter} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} />
                </div>
            </div>
        </div>
    );

    const QualityActionPlan = ({ plan }: { plan: ImageQualityAnalysisResult['action_plan'] }) => (
        <div className="bg-indigo-900 rounded-[3rem] shadow-xl overflow-hidden p-8 md:p-12 space-y-12 text-white">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                    <i className="fa-solid fa-wand-magic-sparkles text-xl"></i>
                </div>
                <h4 className="text-2xl font-black tracking-tight">Strategic Polish Plan</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="space-y-6">
                    <div className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Priority Actions</div>
                    <ul className="space-y-4">
                        {plan?.priority_actions?.map((act, i) => (
                            <li key={i} className="flex gap-4 items-start">
                                <span className="w-6 h-6 rounded-lg bg-indigo-500 flex-shrink-0 flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                                <span className="text-[13px] text-indigo-50 font-medium leading-relaxed">{act}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="space-y-6">
                    <div className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Editing Guide</div>
                    <ul className="space-y-4">
                        {plan?.editing_suggestions?.map((sug, i) => (
                            <li key={i} className="flex gap-4 items-start">
                                <i className="fa-solid fa-sliders text-indigo-400 mt-1"></i>
                                <span className="text-[13px] text-indigo-50 font-medium leading-relaxed">{sug}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="space-y-6">
                    <div className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Reshoot Targets</div>
                    <ul className="space-y-4">
                        {plan?.reshoot_suggestions?.map((sug, i) => (
                            <li key={i} className="flex gap-4 items-start">
                                <i className="fa-solid fa-camera-rotate text-indigo-400 mt-1"></i>
                                <span className="text-[13px] text-indigo-50 font-medium leading-relaxed">{sug}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );

    if (!data) return null;

    return (
        <div className="max-w-5xl mx-auto space-y-12">
            <QualityVerdictWidget summary={data.overall_score?.summary} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <QualityRatingCard title="Composition" category={data.composition} icon="fa-crop-simple" />
                <QualityRatingCard title="Lighting" category={data.lighting_and_color} icon="fa-sun" />
                <QualityRatingCard title="Staging" category={data.staging_and_clutter} icon="fa-couch" />
            </div>
            {data.top_photos && data.top_photos.length > 0 && <QualityTopPhotos photos={data.top_photos} />}
            {data.delete_list && data.delete_list.count > 0 && <QualityDeleteList deleteList={data.delete_list} />}
            {data.action_plan && <QualityActionPlan plan={data.action_plan} />}
        </div>
    );
};
