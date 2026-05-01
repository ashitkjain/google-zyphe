/**
 * PropertyNav
 *
 * Left-sidebar navigation for the property detail view.
 * Design: Analytical Atelier institutional pattern —
 *   flat rows, subtle active highlight, clean icon + label.
 */
import React, { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────

export interface NavSubItem {
    id: string;
    label: string;
    icon: string;
    visible?: boolean;
    isPageLink?: boolean;
}

export interface NavSection {
    id: string;
    label: string;
    icon: string;
    subItems: NavSubItem[];
    visible?: boolean;
    isFlat?: boolean;
}

interface PropertyNavProps {
    activeSectionId: string;
    activeSubId: string;
    cityName?: string;
    onNavigate: (sectionId: string, subId: string) => void;
    visibility: {
        hasLifestyle: boolean;
        hasSchools: boolean;
        hasOrientation: boolean;
        hasEnvironment: boolean;
        hasSolar: boolean;
        hasWalkData: boolean;
        hasBroadband: boolean;
        hasNeighborhood: boolean;
        hasNearby: boolean;
        hasCommunityPulse: boolean;
        hasLtrAnalysis: boolean;
        hasDeepResearch: boolean;
    };
    userRole?: string;
}

// ─── Nav structure ────────────────────────────────────────────

function buildSections(vis: PropertyNavProps['visibility'], cityName?: string, userRole?: string): NavSection[] {
    const sections: NavSection[] = [
        {
            id: 'property',
            label: 'Property',
            icon: 'fa-house',
            subItems: [
                { id: 'mls-data', label: 'MLS Data', icon: 'fa-table-cells-large', visible: true, isPageLink: true },
                { id: 'lifestyle-vastu', label: 'Lifestyle', icon: 'fa-people-roof', visible: vis.hasLifestyle || vis.hasSchools || vis.hasOrientation, isPageLink: true },
                { id: 'indoor', label: 'Indoor', icon: 'fa-couch', visible: true, isPageLink: true },
                { id: 'outdoor', label: 'Outdoor', icon: 'fa-house-chimney', visible: true, isPageLink: true },
            ],
        },
        {
            id: 'environment',
            label: 'Environment',
            icon: 'fa-leaf',
            isFlat: true,
            subItems: [
                { id: 'overview', label: 'Environment', icon: 'fa-leaf', visible: true },
            ],
        },
        {
            id: 'connectivity',
            label: 'Connectivity',
            icon: 'fa-network-wired',
            isFlat: true,
            subItems: [
                { id: 'overview', label: 'Connectivity', icon: 'fa-network-wired', visible: true },
            ],
        },
        {
            id: 'location',
            label: 'Location',
            icon: 'fa-map-location-dot',
            subItems: [
                { id: 'overview', label: 'Location Overview', icon: 'fa-map-location-dot', visible: true, isPageLink: true },
                { id: 'sep-deep-dive', label: cityName ? `ABOUT ${cityName.toUpperCase()}` : 'DEEP RESEARCH', icon: '', visible: true },
                { id: 'community-pulse', label: 'Community Pulse', icon: 'fa-users-viewfinder', visible: vis.hasCommunityPulse, isPageLink: true },
                { id: 'city-neighborhoods', label: 'City Neighborhoods', icon: 'fa-mountain-city', visible: true, isPageLink: true },
            ],
        },
        {
            id: 'investment',
            label: 'Investment Research',
            icon: 'fa-sack-dollar',
            isFlat: true,
            subItems: [
                { id: 'intelligence', label: 'Analysis', icon: 'fa-sack-dollar', visible: true },
            ],
        },
        {
            id: 'context-graph',
            label: 'Factors - At A Glance',
            icon: 'fa-diagram-project',
            isFlat: true,
            subItems: [
                { id: 'graph', label: 'Graph', icon: 'fa-diagram-project', visible: true },
            ],
        },
    ];


    return sections;
}

// ─── Component ────────────────────────────────────────────────

const PropertyNav: React.FC<PropertyNavProps> = ({
    activeSectionId,
    activeSubId,
    cityName,
    onNavigate,
    visibility,
    userRole,
}) => {
    const sections = buildSections(visibility, cityName, userRole);

    // Keep all sections expanded by default except Legacy
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(sections.map(s => s.id))
    );

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionId)) next.delete(sectionId);
            else next.add(sectionId);
            return next;
        });
    };

    const handleSubClick = (sectionId: string, subId: string) => {
        setExpandedSections(prev => new Set([...prev, sectionId]));
        onNavigate(sectionId, subId);
    };

    return (
        <nav className="hidden xl:flex flex-col w-[240px] flex-shrink-0 sticky top-4 z-50 select-none ml-0 rounded-2xl"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px 0 rgba(99,102,241,0.06), 0 0 0 1px rgba(99,102,241,0.04)' }}>

            {/* ── Nav items ────────────────────────────────────── */}
            <div className="flex-1 px-2 pb-4 pt-4">
                {sections.map(section => {
                    const visibleSubs = section.subItems.filter(s => s.visible !== false);
                    if (visibleSubs.length === 0) return null;

                    const isSectionActive = activeSectionId === section.id;
                    const isExpanded = expandedSections.has(section.id);

                    return (
                        <div key={section.id} className="mb-0.5">
                            {/* Section row */}
                            <button
                                onClick={() => {
                                    if (section.isFlat) {
                                        onNavigate(section.id, section.subItems[0].id);
                                    } else {
                                        toggleSection(section.id);
                                        if (!isExpanded && visibleSubs.length > 0) {
                                            onNavigate(section.id, visibleSubs[0].id);
                                        }
                                    }
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group ${isSectionActive
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
                                    }`}
                            >
                                {/* Active accent bar */}
                                <div className={`w-0.5 h-4 rounded-full flex-shrink-0 transition-all ${isSectionActive ? 'bg-indigo-600' : 'bg-transparent'
                                    }`} />
                                <i className={`fa-solid ${section.icon} text-[14px] flex-shrink-0 transition-colors ${isSectionActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'
                                    }`} />
                                <span className={`text-[14px] tracking-tight flex-1 ${isSectionActive ? 'font-black' : 'font-bold'
                                    }`}>
                                    {section.label}
                                </span>
                                {section.isFlat && isSectionActive && (
                                    <div className="flex items-center">
                                        <div className="w-1 h-1 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.4)]" />
                                    </div>
                                )}
                                {!section.isFlat && (
                                    <i className={`fa-solid fa-chevron-right text-[8px] flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-slate-400' : 'text-slate-300'
                                        }`} />
                                )}
                            </button>

                            {/* Sub-items */}
                            {!section.isFlat && isExpanded && visibleSubs.length > 0 && (
                                <div className="mt-1 mb-2 ml-[21px] pl-4 border-l border-slate-200/60 flex flex-col gap-0.5">
                                    {visibleSubs.map(sub => {
                                        if (sub.id.startsWith('sep-')) {
                                            return (
                                                <div key={sub.id} className="mt-3 mb-1 px-3">
                                                    <div className="h-px bg-slate-200/50 w-full mb-2" />
                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                                        {sub.label}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        const isActive = isSectionActive && activeSubId === sub.id;
                                        return (
                                            <button
                                                key={sub.id}
                                                onClick={() => handleSubClick(section.id, sub.id)}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 relative group/sub ${isActive
                                                        ? 'bg-indigo-50/50 text-indigo-700 shadow-sm ring-1 ring-indigo-100/50'
                                                        : 'text-slate-400 hover:text-slate-600'
                                                    }`}
                                            >
                                                {/* Hover/Active indicator pill */}
                                                <div className={`absolute left-0 w-1 h-4 rounded-full transition-all ${isActive ? 'bg-indigo-500' : 'bg-transparent group-hover/sub:bg-slate-200'
                                                    }`} style={{ marginLeft: '-17px' }} />

                                                <i className={`fa-solid ${sub.icon} text-[12px] flex-shrink-0 transition-colors ${isActive ? 'text-indigo-500' : 'text-slate-300 group-hover/sub:text-slate-400'
                                                    }`} />
                                                <span className={`text-[13px] tracking-tight transition-colors ${isActive ? 'font-black' : 'font-semibold'
                                                    }`}>
                                                    {sub.label}
                                                </span>
                                                {sub.isPageLink && (
                                                    <i className="fa-solid fa-arrow-up-right-from-square text-[7px] text-slate-300 ml-1 opacity-60" />
                                                )}
                                                {isActive && (
                                                    <div className="ml-auto flex items-center">
                                                        <div className="w-1 h-1 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.4)]" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Footer links ─────────────────────────────────── */}
            <div className="px-2 py-4 border-t" style={{ borderColor: '#ebebf3' }}>
                {[
                    { icon: 'fa-gear', label: 'Settings' },
                    { icon: 'fa-circle-question', label: 'Help Center' },
                ].map(({ icon, label }) => (
                    <button key={label}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:bg-white/60 hover:text-slate-600 transition-all text-left group mb-0.5">
                        <div className="w-0.5 h-4 rounded-full flex-shrink-0 bg-transparent" />
                        <i className={`fa-solid ${icon} text-[12px] flex-shrink-0 text-slate-300 group-hover:text-slate-400`} />
                        <span className="text-[11px] font-bold tracking-tight">{label}</span>
                    </button>
                ))}
                <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.15em] text-center mt-3">
                    Institutional Property Grade
                </p>
            </div>
        </nav>
    );
};

export default PropertyNav;

// ─── Mobile top bar (unchanged) ──────────────────────────────

interface MobileNavBarProps {
    activeSectionId: string;
    onSectionChange: (sectionId: string) => void;
    visibility: PropertyNavProps['visibility'];
}

export const MobileNavBar: React.FC<MobileNavBarProps> = ({
    activeSectionId,
    onSectionChange,
    visibility,
}) => {
    const sections = buildSections(visibility).filter(s =>
        s.subItems.some(sub => sub.visible !== false)
    );

    return (
        <div className="xl:hidden flex items-center gap-1 overflow-x-auto px-4 py-2 bg-[#eef2ff] border-b border-indigo-100/60 scrollbar-none">
            {sections.map(section => {
                const isActive = activeSectionId === section.id;
                return (
                    <button
                        key={section.id}
                        onClick={() => onSectionChange(section.id)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 transition-all text-[11px] font-black uppercase tracking-wider ${isActive
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                    >
                        <i className={`fa-solid ${section.icon} text-[9px]`} />
                        {section.label}
                    </button>
                );
            })}
        </div>
    );
};
