import React from 'react';
import { PropertyData } from '../../types';
import { getDaysOnMarket } from '../../utils/property';
import { expandFactor } from '../../constants/contextGraphFactors';

interface PropertyCardProps {
    property: PropertyData;
    match?: {
        score: number;
        rank: number;
        matchWriteup: string;
        factors?: string[];
    };
    factors?: string[]; // Global factors from city-wide context graph
    onClick?: () => void;
    onTourClick?: (e: React.MouseEvent) => void;
    onInfoClick?: (e: React.MouseEvent) => void;
    className?: string;
}

const PropertyCard: React.FC<PropertyCardProps> = ({
    property,
    match,
    factors: propFactors,
    onClick,
    onTourClick,
    onInfoClick,
    className = "",
}) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(property.address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const displayFactors = Array.from(new Set([...(propFactors || []), ...(match?.factors || [])]));
    const fmt = (n?: number) => n ? `$${n.toLocaleString()}` : '—';
    const sqft = property.livingAreaValue || (property as any).livingArea || property.sqft;

    return (
        <div className={`relative group ${className}`}>
            <div
                onClick={onClick}
                className={`group w-full bg-white rounded-2xl border transition-all text-left overflow-hidden cursor-pointer ${match ? 'border-indigo-300 ring-2 ring-indigo-100 shadow-md' : 'border-slate-100 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-100/50'}`}
            >
                {/* Score badge overlay */}
                {match && (
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm ${match.rank === 1 ? 'bg-amber-400 text-white' : match.rank <= 3 ? 'bg-indigo-600 text-white' : 'bg-white/90 text-slate-600 border border-slate-200'}`}>
                            #{match.rank}
                        </span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm ${match.score >= 80 ? 'bg-emerald-500 text-white' : match.score >= 60 ? 'bg-amber-500 text-white' : 'bg-white/90 text-slate-600 border border-slate-200'}`}>
                            {match.score}
                        </span>
                    </div>
                )}
                {property.images?.[0] ? (
                    <div className="aspect-[2/1] bg-slate-100 overflow-hidden">
                        <img src={property.images[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    </div>
                ) : (
                    <div className="aspect-[2/1] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        <i className="fa-solid fa-house text-2xl text-slate-300"></i>
                    </div>
                )}
                <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug line-clamp-2 flex-1">
                            {property.address}
                        </div>
                        <button
                            onClick={handleCopy}
                            className={`w-6 h-6 rounded-md flex items-center justify-center transition-all flex-shrink-0 ${
                                copied 
                                    ? 'bg-emerald-500 text-white border-emerald-500' 
                                    : 'bg-slate-50 text-slate-400 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-white'
                            }`}
                            title="Copy address to clipboard"
                        >
                            <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'} text-[9px]`}></i>
                        </button>
                    </div>
                    {property.neighborhood && (
                        <div className="mb-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                {typeof property.neighborhood === 'string' 
                                    ? property.neighborhood 
                                    : ((property.neighborhood as any).social || (property.neighborhood as any).legal_subdivision || 'Unnamed Neighborhood')}
                            </span>
                        </div>
                    )}
                    <div className="flex items-center gap-2.5 text-[10px] text-slate-400 font-bold flex-wrap">
                        {property.listPrice && <span className="text-indigo-600 font-black">{fmt(property.listPrice)}</span>}
                        {property.bedrooms && <span>{property.bedrooms} bd</span>}
                        {property.bathrooms && <span>{property.bathrooms} ba</span>}
                        {sqft && <span>{sqft.toLocaleString()} sqft</span>}
                        {property.lotSize && <span>Lot {property.lotSize}</span>}
                        {property.homeType && <span className="capitalize">{property.homeType.replace(/_/g, ' ').toLowerCase()}</span>}
                        {getDaysOnMarket(property.listedDate, (property as any).daysOnZillow) != null && (
                            <span>{getDaysOnMarket(property.listedDate, (property as any).daysOnZillow)} DOM</span>
                        )}
                    </div>

                    {/* Reasoning: Clean Bulleted List Inline */}
                    {match && match.matchWriteup && (
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                            <div className="flex items-center gap-1.5">
                                <div className="h-[1px] flex-1 bg-slate-100"></div>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Zyphe Match Insights</span>
                                <div className="h-[1px] flex-1 bg-slate-100"></div>
                            </div>

                            {/* Summary Tags segment */}
                            <div className="flex flex-wrap gap-1">
                                {(match.matchWriteup.match(/✅\s*([^✅❌👤\.]+)/g) || []).slice(0, 3).map((tag, tIdx) => (
                                    <span key={tIdx} className="px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100/50">
                                        {tag.replace('✅', '').trim()}
                                    </span>
                                ))}
                                {(match.matchWriteup.match(/❌\s*([^✅❌👤\.]+)/g) || []).slice(0, 1).map((tag, tIdx) => (
                                    <span key={tIdx} className="px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100/50">
                                        {tag.replace('❌', '').trim()}
                                    </span>
                                ))}
                            </div>

                            <ul className="space-y-2.5">
                                {(match.matchWriteup.split(/(?=[✅❌👤])/g) || []).map((bullet, idx) => {
                                     const trimmed = bullet.trim();
                                     const content = trimmed.replace(/[✅❌👤]/g, '').trim().replace(/[.;,]$/, '');
                                     if (!content) return null;
                                     
                                     const isPro = trimmed.startsWith('✅');
                                     const isCon = trimmed.startsWith('❌');
                                     const isPersona = trimmed.startsWith('👤');
                                     
                                     return (
                                         <li key={idx} className="flex gap-2.5 items-start group/bullet">
                                             <span className={`flex-shrink-0 w-4 h-4 rounded-md flex items-center justify-center text-[7px] shadow-sm transition-transform group-hover/bullet:scale-110 ${
                                                 isPro ? 'bg-emerald-500 text-white shadow-emerald-200' : 
                                                 isCon ? 'bg-rose-500 text-white shadow-rose-200' : 
                                                 isPersona ? 'bg-indigo-600 text-white shadow-indigo-200' :
                                                 'bg-slate-400 text-white'
                                             }`}>
                                                 <i className={`fa-solid ${isPro ? 'fa-check' : isCon ? 'fa-xmark' : isPersona ? 'fa-user' : 'fa-info'}`}></i>
                                             </span>
                                             <span className={`text-[10.5px] leading-snug ${
                                                 isPro ? 'text-slate-800 font-bold' : 
                                                 isCon ? 'text-slate-500 font-medium' : 
                                                 isPersona ? 'text-indigo-900 font-black tracking-tight' :
                                                 'text-slate-600'
                                             }`}>
                                                 {content}
                                             </span>
                                         </li>
                                     );
                                 }).filter(Boolean)}
                            </ul>
                        </div>
                    )}

                    {/* High Density Context Factors (The Context Graph) — Always visible if available */}
                    {displayFactors.length > 0 && (
                        <div className="mt-4 pt-3 flex flex-wrap gap-1 border-t border-slate-100">
                            {displayFactors.slice(0, 8).map((f, i) => (
                                <span key={i} className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 text-[8px] font-bold text-slate-500 whitespace-nowrap">
                                    {expandFactor(f)}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Action buttons overlay */}
            <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1.5 z-10" style={{ pointerEvents: 'none' }}>
                <button
                    style={{ pointerEvents: 'auto' }}
                    onClick={onTourClick}
                    data-action="tour"
                    className="flex-1 py-2 bg-indigo-600/95 backdrop-blur-sm text-white rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-colors shadow-lg flex items-center justify-center gap-1"
                >
                    <i className="fa-solid fa-calendar-check text-[8px]"></i> Tour
                </button>
                <button
                    style={{ pointerEvents: 'auto' }}
                    onClick={onInfoClick}
                    data-action="info"
                    className="flex-1 py-2 bg-emerald-600/95 backdrop-blur-sm text-white rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-colors shadow-lg flex items-center justify-center gap-1"
                >
                    <i className="fa-solid fa-envelope text-[8px]"></i> Info
                </button>
            </div>
        </div>
    );
};

export default PropertyCard;
