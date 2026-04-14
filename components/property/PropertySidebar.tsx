/**
 * PropertySidebar
 *
 * Full-height sticky sidebar for the property overview page.
 * Tracks the active section via IntersectionObserver and highlights
 * the corresponding nav item.
 */
import React from 'react';

export interface NavItem {
    id: string;
    label: string;
    icon: string;
    visible: boolean;
}

interface PropertySidebarProps {
    items: NavItem[];
    activeId: string;
    onItemClick?: (id: string) => void;
}

const PropertySidebar: React.FC<PropertySidebarProps> = ({ items, activeId, onItemClick }) => {
    const visible = items.filter(i => i.visible);
    if (visible.length < 2) return null;

    return (
        <nav className="hidden xl:flex flex-col w-[280px] bg-white border-r border-slate-100 flex-shrink-0 sticky top-0 h-screen overflow-y-auto z-50">
            {/* Logo Section */}
            <div className="p-6 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
                        <i className="fa-solid fa-cube text-white text-[18px]" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-[14px] font-black text-slate-900 leading-none tracking-tight truncate">Zyphe Property</h2>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Architectural AI</p>
                    </div>
                </div>
            </div>

            {/* Search Box */}
            <div className="px-6 mb-4 mt-2">
                <div className="relative group">
                    <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[11px] group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Search data..." 
                        className="w-full bg-slate-100/50 border border-transparent focus:border-indigo-100 focus:bg-white rounded-xl py-2.5 pl-11 pr-4 text-[11px] font-black text-slate-700 outline-none transition-all placeholder:text-slate-400 placeholder:uppercase placeholder:tracking-widest"
                    />
                </div>
            </div>

            {/* Nav items */}
            <div className="flex-1 px-4 space-y-1 mt-2">
                {visible.map(item => {
                    const isActive = activeId === item.id;
                    return (
                        <a
                            key={item.id}
                            href={`#${item.id}`}
                            onClick={e => {
                                e.preventDefault();
                                onItemClick?.(item.id);
                                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl transition-all duration-200 group
                                ${isActive
                                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                }`}
                        >
                            <div className="flex-shrink-0">
                                <i className={`fa-solid ${item.icon} text-[14px] ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-500'}`} />
                            </div>
                            <span className="text-[13px] font-black tracking-tight">{item.label}</span>
                        </a>
                    );
                })}
            </div>
        </nav>
    );
};

export default PropertySidebar;
