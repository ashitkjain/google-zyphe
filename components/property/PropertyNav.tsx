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
}

interface PropertyNavProps {
    activeSectionId: string;
    activeSubId: string;
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
}

// ─── Nav structure ────────────────────────────────────────────

function buildSections(vis: PropertyNavProps['visibility']): NavSection[] {
    return [
        {
            id: 'property',
            label: 'Property',
            icon: 'fa-house',
            subItems: [
                { id: 'lifestyle-vastu',  label: 'Lifestyle, Schools & Vastu', icon: 'fa-people-roof',      visible: vis.hasLifestyle || vis.hasSchools || vis.hasOrientation },
                { id: 'mls-data',         label: 'MLS Data',                   icon: 'fa-table-cells-large', visible: true },
                { id: 'indoor',           label: 'Indoor',                     icon: 'fa-couch',             visible: true },
                { id: 'rooms',            label: 'Rooms',                      icon: 'fa-door-open',         visible: true },
                { id: 'outdoor',          label: 'Outdoor',                    icon: 'fa-tree',              visible: true },
                { id: 'exterior',         label: 'Exterior',                   icon: 'fa-house-chimney',     visible: true },
                { id: 'eye-on-street',    label: 'Eye on Street',              icon: 'fa-street-view',       visible: true },
            ],
        },
        {
            id: 'environment',
            label: 'Environment',
            icon: 'fa-leaf',
            subItems: [
                { id: 'hazards',   label: 'Hazards & Resilience', icon: 'fa-shield-halved', visible: vis.hasEnvironment },
                { id: 'noise-air', label: 'Noise & Air Quality',  icon: 'fa-wind',          visible: vis.hasEnvironment },
                { id: 'solar',     label: 'Solar',                icon: 'fa-sun',            visible: vis.hasSolar },
            ],
        },
        {
            id: 'connectivity',
            label: 'Connectivity',
            icon: 'fa-network-wired',
            subItems: [
                { id: 'commute',     label: 'Commute',      icon: 'fa-car',            visible: vis.hasWalkData },
                { id: 'walk-scores', label: 'Walk Scores',  icon: 'fa-person-walking', visible: vis.hasWalkData },
                { id: 'internet',    label: 'Internet',     icon: 'fa-wifi',           visible: vis.hasBroadband },
            ],
        },
        {
            id: 'location',
            label: 'Location',
            icon: 'fa-map-location-dot',
            subItems: [
                { id: 'neighborhood',      label: 'Neighborhood',      icon: 'fa-mountain-sun',    visible: vis.hasNeighborhood },
                { id: 'interests',         label: 'Interests',         icon: 'fa-heart',           visible: true },
                { id: 'whats-nearby',      label: "What's Nearby",     icon: 'fa-location-dot',    visible: vis.hasNearby },
                { id: 'sep-deep-dive',     label: 'DEEP RESEARCH',     icon: '',                   visible: true },
                { id: 'community-pulse',   label: 'Community Pulse',   icon: 'fa-users-viewfinder', visible: vis.hasCommunityPulse, isPageLink: true },
                { id: 'city-neighborhoods',label: 'City Neighborhoods',icon: 'fa-mountain-city',   visible: true, isPageLink: true },
            ],
        },
        {
            id: 'investment',
            label: 'Investment',
            icon: 'fa-chart-line',
            subItems: [
                { id: 'economics',           label: 'Economics',           icon: 'fa-sack-dollar',            visible: vis.hasLtrAnalysis },
                { id: 'investment-research', label: 'Investment Research', icon: 'fa-magnifying-glass-chart', visible: vis.hasDeepResearch },
            ],
        },
    ];
}

// ─── Component ────────────────────────────────────────────────

const PropertyNav: React.FC<PropertyNavProps> = ({
    activeSectionId,
    activeSubId,
    onNavigate,
    visibility,
}) => {
    const sections = buildSections(visibility);

    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set([activeSectionId])
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
        <nav className="hidden xl:flex flex-col w-[240px] flex-shrink-0 sticky top-0 h-screen z-50 select-none"
             style={{ background: '#f7f7fb', borderRight: '1px solid #ebebf3' }}>

            {/* ── Brand ────────────────────────────────────────── */}
            <div className="px-5 pt-6 pb-5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-cube text-white text-[12px]" />
                    </div>
                    <div>
                        <div className="text-[13px] font-black text-slate-900 leading-none tracking-tight">Zyphe</div>
                        <div className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-[0.14em]">Property Intelligence</div>
                    </div>
                </div>
            </div>

            {/* ── Nav items ────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-2 pb-4">
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
                                    toggleSection(section.id);
                                    if (!isExpanded && visibleSubs.length > 0) {
                                        onNavigate(section.id, visibleSubs[0].id);
                                    }
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group ${
                                    isSectionActive
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
                                }`}
                            >
                                {/* Active accent bar */}
                                <div className={`w-0.5 h-4 rounded-full flex-shrink-0 transition-all ${
                                    isSectionActive ? 'bg-indigo-600' : 'bg-transparent'
                                }`} />
                                <i className={`fa-solid ${section.icon} text-[12px] flex-shrink-0 transition-colors ${
                                    isSectionActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'
                                }`} />
                                <span className={`text-[12px] tracking-tight flex-1 truncate ${
                                    isSectionActive ? 'font-black' : 'font-bold'
                                }`}>
                                    {section.label}
                                </span>
                                <i className={`fa-solid fa-chevron-right text-[8px] flex-shrink-0 transition-transform duration-200 ${
                                    isExpanded ? 'rotate-90 text-slate-400' : 'text-slate-300'
                                }`} />
                            </button>

                            {/* Sub-items */}
                            {isExpanded && visibleSubs.length > 0 && (
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
                                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 relative group/sub ${
                                                        isActive
                                                            ? 'bg-indigo-50/50 text-indigo-700 shadow-sm ring-1 ring-indigo-100/50'
                                                            : 'text-slate-400 hover:text-slate-600'
                                                    }`}
                                                >
                                                    {/* Hover/Active indicator pill */}
                                                    <div className={`absolute left-0 w-1 h-4 rounded-full transition-all ${
                                                        isActive ? 'bg-indigo-500' : 'bg-transparent group-hover/sub:bg-slate-200'
                                                    }`} style={{ marginLeft: '-17px' }} />
                                                    
                                                    <i className={`fa-solid ${sub.icon} text-[10px] flex-shrink-0 transition-colors ${
                                                        isActive ? 'text-indigo-500' : 'text-slate-300 group-hover/sub:text-slate-400'
                                                    }`} />
                                                    <span className={`text-[11px] tracking-tight truncate transition-colors ${
                                                        isActive ? 'font-black' : 'font-semibold'
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
                    { icon: 'fa-gear',         label: 'Settings' },
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
        <div className="xl:hidden flex items-center gap-1 overflow-x-auto px-4 py-2 bg-white border-b border-slate-100 scrollbar-none">
            {sections.map(section => {
                const isActive = activeSectionId === section.id;
                return (
                    <button
                        key={section.id}
                        onClick={() => onSectionChange(section.id)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 transition-all text-[11px] font-black uppercase tracking-wider ${
                            isActive
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
