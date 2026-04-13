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
}

const PropertySidebar: React.FC<PropertySidebarProps> = ({ items, activeId }) => {
    const visible = items.filter(i => i.visible);
    if (visible.length < 2) return null;

    return (
        <nav className="hidden xl:flex flex-col w-[280px] bg-white border-r border-slate-100 flex-shrink-0 sticky top-0 h-screen overflow-y-auto z-50">
            {/* Logo Section */}
            <div className="p-8">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
                        <i className="fa-solid fa-cube text-white text-[16px]" />
                    </div>
                    <div>
                        <h2 className="text-[18px] font-black text-slate-900 leading-none tracking-tight">Architectural Analyst</h2>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1 block">Global Intelligence</span>
                    </div>
                </div>
            </div>

            {/* Nav items */}
            <div className="flex-1 px-4 space-y-1.5 mt-8">
                {visible.map(item => {
                    const isActive = activeId === item.id;
                    return (
                        <a
                            key={item.id}
                            href={`#${item.id}`}
                            onClick={e => {
                                e.preventDefault();
                                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            className={`flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-300 group
                                ${isActive
                                    ? 'bg-white shadow-[0_10px_30px_-5px_rgba(0,0,0,0.1)] text-slate-900 border border-slate-50'
                                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                                }`}
                        >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all
                                ${isActive ? 'bg-indigo-600 shadow-lg shadow-indigo-200' : 'bg-slate-50 group-hover:bg-slate-100'}`}>
                                <i className={`fa-solid ${item.icon} text-[12px] ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                            </div>
                            <span className={`text-[13px] font-black uppercase tracking-wider transition-colors ${isActive ? 'text-slate-900' : ''}`}>{item.label}</span>
                        </a>
                    );
                })}
            </div>

            {/* Bottom Section */}
            <div className="p-8 border-t border-slate-50 space-y-6">
                <button className="flex items-center gap-3 px-2 py-1 w-full text-slate-400 font-bold hover:text-slate-600 transition-colors group">
                    <i className="fa-solid fa-gear text-[16px] group-hover:rotate-90 transition-transform duration-500" />
                    <span className="text-[13px] uppercase tracking-widest">Settings</span>
                </button>
                <button className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] transition-all hover:translate-y-[-2px] hover:shadow-2xl active:translate-y-0 shadow-xl shadow-slate-200">
                    Download Report
                </button>
            </div>
        </nav>
    );
};

export default PropertySidebar;
