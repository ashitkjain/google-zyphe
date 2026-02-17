
import React from 'react';

interface Props {
    description: string;
}

const PropertyDescription: React.FC<Props> = ({ description }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const isLong = description.length > 500;
    const displayDescription = isExpanded ? description : description.slice(0, 500) + (isLong ? '...' : '');

    if (!description || description === "No description available.") return null;

    return (
        <div className="bg-white px-8 md:px-10 py-10 border-x border-slate-100">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <span className="w-4 h-px bg-slate-200"></span>
                MLS Property Description
            </div>
            <div className="relative">
                <p className="text-slate-800 font-normal text-[13px] leading-[1.625] whitespace-pre-wrap">
                    {displayDescription}
                </p>
                {isLong && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="mt-4 text-indigo-600 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:text-indigo-800 transition-colors"
                    >
                        <span>{isExpanded ? 'Show Less' : 'Read Full Description'}</span>
                        <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                    </button>
                )}
            </div>
        </div>
    );
};

export default PropertyDescription;
