/**
 * RoomsSectionPage
 *
 * Displays room-by-room details parsed from MLS resoFacts:
 *   - Bedroom / bathroom summary strip
 *   - Room list (rooms, roomTypes parsed into cards)
 *   - Interior features
 *   - Room-level features (roomFeatures)
 *   - AI rooms summary from currentInteriorSummary
 */
import React from 'react';
import { PropertyData } from '../../../types';

interface Props {
    data: PropertyData;
    currentInteriorSummary?: any;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse comma/semicolon-separated strings OR string arrays into a trimmed array */
const parseList = (raw?: string | string[] | null): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(s => String(s).trim()).filter(Boolean);
    if (typeof raw !== 'string') return [];
    return raw.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
};

/** Icon mapping for common room names */
const roomIcon = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes('bedroom') || n.includes('master') || n.includes('primary')) return 'fa-bed';
    if (n.includes('bathroom') || n.includes('bath') || n.includes('toilet')) return 'fa-bath';
    if (n.includes('kitchen'))       return 'fa-utensils';
    if (n.includes('living') || n.includes('family') || n.includes('great room')) return 'fa-couch';
    if (n.includes('dining'))        return 'fa-champagne-glasses';
    if (n.includes('garage'))        return 'fa-car';
    if (n.includes('laundry'))       return 'fa-shirt';
    if (n.includes('office') || n.includes('study') || n.includes('den')) return 'fa-briefcase';
    if (n.includes('bonus') || n.includes('loft') || n.includes('flex')) return 'fa-layer-group';
    if (n.includes('entry') || n.includes('foyer')) return 'fa-door-open';
    if (n.includes('closet') || n.includes('walk-in')) return 'fa-box';
    if (n.includes('basement'))      return 'fa-stairs';
    if (n.includes('attic'))         return 'fa-house-chimney';
    if (n.includes('patio') || n.includes('deck') || n.includes('balcony')) return 'fa-sun';
    return 'fa-square';
};

const roomColor = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes('bedroom') || n.includes('master') || n.includes('primary')) return 'bg-indigo-50 text-indigo-600';
    if (n.includes('bathroom') || n.includes('bath')) return 'bg-sky-50 text-sky-600';
    if (n.includes('kitchen'))     return 'bg-amber-50 text-amber-600';
    if (n.includes('living') || n.includes('family')) return 'bg-violet-50 text-violet-600';
    if (n.includes('dining'))      return 'bg-rose-50 text-rose-600';
    if (n.includes('garage'))      return 'bg-slate-100 text-slate-600';
    if (n.includes('laundry'))     return 'bg-teal-50 text-teal-600';
    if (n.includes('office') || n.includes('study')) return 'bg-emerald-50 text-emerald-600';
    return 'bg-slate-50 text-slate-500';
};

// ─── Type scale ───────────────────────────────────────────────────────────────
const T = {
    label:  'text-[10px] font-black text-slate-400 uppercase tracking-widest',
    body:   'text-[13px] font-medium text-slate-500 leading-relaxed',
    title:  'text-[14px] font-black text-slate-800',
    cardH:  'text-[16px] font-black text-slate-900 tracking-tight',
    attr:   'text-[9px] font-bold text-slate-300 uppercase tracking-widest',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const RoomsSectionPage: React.FC<Props> = ({ data, currentInteriorSummary }) => {
    const reso = data.resoFacts;

    const roomList    = parseList(reso?.rooms);
    const roomTypes   = parseList(reso?.roomTypes);
    const roomFeats   = parseList(reso?.roomFeatures);
    const interiorFts = reso?.interiorFeatures ?? [];
    const flooring    = parseList(reso?.flooring);
    const appliances  = parseList(reso?.appliances);
    const laundry     = parseList(reso?.laundryFeatures);
    const windowFts   = parseList(reso?.windowFeatures);
    const fireplaces  = parseList(reso?.fireplaceFeatures);
    const security    = parseList(reso?.securityFeatures);

    // Combine rooms + roomTypes, deduplicate
    const allRooms = Array.from(new Set([...roomList, ...roomTypes]));

    const hasRooms       = allRooms.length > 0;
    const hasFeatures    = interiorFts.length > 0 || roomFeats.length > 0;
    const hasApplianceEtc = flooring.length > 0 || appliances.length > 0 || laundry.length > 0 || windowFts.length > 0 || fireplaces.length > 0 || security.length > 0;

    return (
        <div className="space-y-5">





        </div>
    );
};
