
import React, { useState } from 'react';

interface Props {
    description?: string;
}

const PropertyDescription: React.FC<Props> = ({ description }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!description || description === "No description available.") return null;

    // If description is very long, we might want a "Read More" toggle
    const isLong = description.length > 600;
    const displayDescription = isExpanded ? description : description.slice(0, 600) + (isLong ? '...' : '');

    return (
        <div className="bg-white px-8 md:px-10 py-10 border-x border-b border-slate-50 relative overflow-hidden">
            <div className="max-w-4xl">
                <div className="text-[10px] font-black text-indigo-600/60 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                    <i className="fa-solid fa-align-left text-xs"></i>
                    Property Description
                    <span className="flex-1 h-px bg-slate-100"></span>
                </div>

                <div className="relative">
                    <p className="text-slate-600 text-lg leading-relaxed font-medium whitespace-pre-wrap">
                        {displayDescription}
                    </p>

                    {isLong && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="mt-6 text-indigo-600 font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:text-indigo-800 transition-colors group"
                        >
                            <span>{isExpanded ? 'Hide Full Description' : 'Read Full Description'}</span>
                            <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} transition-transform group-hover:translate-y-0.5`}></i>
                        </button>
                    )}
                </div>
            </div>

            {/* Subtle aesthetic touch */}
            <div className="absolute top-0 right-0 -mt-8 -mr-8 opacity-[0.03] pointer-events-none">
                <i className="fa-solid fa-quote-right text-[12rem] text-slate-900"></i>
            </div>
        </div>
    );
};

export default PropertyDescription;
