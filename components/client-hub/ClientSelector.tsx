import React, { useState, useRef, useEffect } from 'react';
import { Lead } from '../../types';

interface ClientSelectorProps {
    leads: Lead[];
    selectedClientId?: string;
    onSelect: (clientId: string, clientName: string) => void;
    placeholder?: string;
    className?: string;
    hideIcon?: boolean;
    inputClassName?: string;
}

const ClientSelector: React.FC<ClientSelectorProps> = ({
    leads,
    selectedClientId,
    onSelect,
    placeholder = "Search or Select Client...",
    className = "",
    hideIcon = false,
    inputClassName = ""
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedLead = leads.find(l => l.id === selectedClientId);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const stages = ['Leads', 'Active Search', 'Nurture', 'Offer', 'Closing'];

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div className="relative group h-full">
                {!hideIcon && (
                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-[10px] group-focus-within:text-indigo-500 transition-colors"></i>
                )}
                <input
                    type="text"
                    placeholder={placeholder}
                    className={`w-full h-full bg-slate-50 border-none rounded-lg ${hideIcon ? 'px-3' : 'pl-8 pr-3'} py-1.5 text-slate-900 font-semibold focus:ring-1 focus:ring-indigo-500 outline-none placeholder:text-slate-300 text-xs transition-all ${inputClassName}`}
                    value={isOpen ? searchTerm : (selectedLead?.fullName || '')}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => {
                        setIsOpen(true);
                        setSearchTerm('');
                    }}
                />
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-[250px] overflow-y-auto z-[200] p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    {stages.map(stage => {
                        const stageLeads = leads.filter(l =>
                            l.funnelStage === stage &&
                            (l.fullName || '').toLowerCase().includes(searchTerm.toLowerCase())
                        );

                        if (stageLeads.length === 0) return null;

                        return (
                            <div key={stage} className="mb-2 last:mb-0">
                                <div className="px-3 py-1 text-[8px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50 rounded-md mb-1">
                                    {stage}
                                </div>
                                {stageLeads.map(lead => (
                                    <button
                                        key={lead.id}
                                        onClick={() => {
                                            onSelect(lead.id, lead.fullName || '');
                                            setIsOpen(false);
                                            setSearchTerm('');
                                        }}
                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 transition-colors group flex items-center justify-between"
                                    >
                                        <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{lead.fullName}</span>
                                        <i className="fa-solid fa-chevron-right text-[8px] text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all"></i>
                                    </button>
                                ))}
                            </div>
                        );
                    })}
                    {leads.filter(l => (l.fullName || '').toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                        <div className="p-6 text-center">
                            <i className="fa-solid fa-user-slash text-slate-200 mb-2 block"></i>
                            <p className="text-[10px] font-bold text-slate-400">No results</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ClientSelector;
