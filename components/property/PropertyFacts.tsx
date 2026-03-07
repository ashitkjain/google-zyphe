
import React from 'react';
import { ResoFacts } from '../../types';

interface Props {
  facts?: ResoFacts;
}

const PropertyFacts: React.FC<Props> = ({ facts }) => {
  if (!facts) return null;

  const parseComplexFact = (value: any): string[] => {
    const rawValue = value === undefined || value === null || value === '' || value === 'null' ? '' : String(value);
    if (!rawValue) return [];

    try {
      const parsed = JSON.parse(rawValue);
      if (typeof parsed === 'object' && parsed !== null) {
        if (Array.isArray(parsed)) {
          if (parsed.length === 0) return [];
          if (typeof parsed[0] === 'object' && parsed[0] !== null && 'roomType' in parsed[0]) {
            return (parsed as any[]).map(item => {
              const type = item.roomType || 'Room';
              const features = Array.isArray(item.roomFeatures) ? item.roomFeatures.join(', ') : (item.roomFeatures || '');
              return features ? `${type}: ${features}` : type;
            });
          }
          if (typeof parsed[0] === 'object' && parsed[0] !== null && 'type' in parsed[0]) {
            return (parsed as any[]).map(item => {
              const { type, ...rest } = item;
              const details = Object.entries(rest)
                .filter(([_, v]) => v !== null && v !== undefined && v !== '')
                .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} = ${v}`)
                .join(', ');
              return details ? `${type} : ${details}` : type;
            });
          }
          return (parsed as any[]).filter(v => v).map(v => typeof v === 'object' ? JSON.stringify(v) : String(v));
        }
        return Object.fromEntries(Object.entries(parsed).filter(([_, v]) => v !== null && v !== undefined && v !== '')) as any;
      }
    } catch (e) { }
    return [rawValue];
  };

  const getIcon = (label: string) => {
    const normalized = label.toLowerCase().trim();
    if (normalized.includes('flooring')) return 'fa-rug';
    if (normalized.includes('foundation')) return 'fa-trowel-bricks';
    if (normalized.includes('sewer')) return 'fa-faucet';
    if (normalized.includes('utility') || normalized.includes('utilities')) return 'fa-plug';
    if (normalized.includes('water source')) return 'fa-droplet';
    if (normalized.includes('fee') || normalized.includes('dues')) return 'fa-dollar-sign';
    if (normalized.includes('architectural style')) return 'fa-landmark';
    if (normalized.includes('garage') || normalized.includes('parking')) return 'fa-car-side';
    if (normalized.includes('exterior feature')) return 'fa-house-chimney';
    if (normalized.includes('roof')) return 'fa-house-chimney-window';
    if (normalized.includes('days on market')) return 'fa-clock';
    if (normalized.includes('construction') || normalized.includes('material')) return 'fa-hammer';
    if (normalized.includes('appliance')) return 'fa-blender';
    if (normalized.includes('cooling')) return 'fa-snowflake';
    if (normalized.includes('heating')) return 'fa-fire-flame-simple';
    if (normalized.includes('basement')) return 'fa-arrow-down-wide-short';
    if (normalized.includes('room feature')) return 'fa-couch';
    if (normalized.includes('room')) return 'fa-door-open';
    if (normalized.includes('features')) return 'fa-list-check';
    return 'fa-circle-info';
  };

  const getGroupedFeatureValue = (label: string, value: any): string | null => {
    const vals = parseComplexFact(value);
    if (vals.length === 0 || (vals.length === 1 && vals[0].toLowerCase() === 'null')) return null;
    const cleanLabel = label.replace(/Features/gi, '').trim();
    return `${cleanLabel}: ${vals.join(', ')}`;
  };

  const features = [
    getGroupedFeatureValue('Security Features', facts.securityFeatures),
    getGroupedFeatureValue('Window Features', facts.windowFeatures),
    getGroupedFeatureValue('Fireplace Features', facts.fireplaceFeatures),
    getGroupedFeatureValue('Laundry Features', facts.laundryFeatures),
    getGroupedFeatureValue('Lot Features', facts.lotFeatures),
    getGroupedFeatureValue('Fencing', facts.fencing),
  ].filter(Boolean) as string[];

  const categories = [
    {
      title: 'Interior',
      items: [
        { label: 'Interiors', value: facts.roomTypes, isComplex: true },
        { label: 'Room Features', value: facts.roomFeatures, isComplex: true },
        { label: 'Appliances', value: facts.appliances, isComplex: true },
        { label: 'Basement', value: facts.basement, isComplex: true },
        { label: 'Additional Features', value: features, isManualArray: true },
      ]
    },


  ];

  // Fix: Explicitly type FactItem as React.FC to handle React-reserved props like 'key' in mapped components
  const FactItem: React.FC<{ item: any }> = ({ item }) => {
    let displayValues: string[] = [];
    if (item.isManualArray) {
      displayValues = item.value;
    } else {
      const parsed = parseComplexFact(item.value);
      displayValues = item.isComplex
        ? (typeof parsed === 'object' && !Array.isArray(parsed)
          ? Object.entries(parsed).map(([k, v]) => `${k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${v}`)
          : parsed as string[])
        : (item.value === undefined || item.value === null || item.value === '' || item.value === 'null' ? [] : [String(item.value)]);

      // Filter out redundant bedroom/bathroom info from "Interiors"
      if (item.label === 'Interiors') {
        const redundantRegex = /\d+(\.\d+)?\s*(bedrooms?|beds?|bathrooms?|baths?)(,?\s*)?/gi;
        displayValues = displayValues.map(v => {
          let cleaned = v.replace(redundantRegex, '').trim();
          // Remove leading/trailing commas/punctuation
          cleaned = cleaned.replace(/^,+|,+$/g, '').trim();
          return cleaned;
        }).filter(Boolean);
      }
    }

    if (displayValues.length === 0 || (displayValues.length === 1 && displayValues[0].toLowerCase() === 'null')) return null;

    return (
      <div className="flex items-start gap-4 group mb-6 last:mb-0">
        <div className="w-5 flex justify-center flex-shrink-0 mt-0.5">
          <i className={`fa-solid ${getIcon(item.label)} text-slate-200 text-xs group-hover:text-indigo-500 transition-colors`}></i>
        </div>
        <div className="flex-1">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none">{item.label}</span>
            {displayValues.length === 1 && (
              <span className="text-[14px] font-normal text-slate-800 leading-[1.625]">{displayValues[0]}</span>
            )}
          </div>
          {displayValues.length > 1 && (
            <ul className="space-y-1 mt-1 ml-1">
              {displayValues.map((val, vidx) => (
                <li key={vidx} className="flex items-start gap-2 text-slate-800 font-normal text-[14px] leading-[1.625]">
                  <span className="text-indigo-200 mt-1.5 flex-shrink-0 text-[10px]">•</span>
                  <span>{val}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white px-5 md:px-6 py-4 border-x border-slate-100">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-12">
        {categories.map((cat, idx) => {
          // Check if category has any visible items
          const hasVisibleItems = cat.items.some(item => {
            const val = item.isManualArray ? item.value : parseComplexFact(item.value);
            return Array.isArray(val) ? val.length > 0 : !!val;
          });

          if (!hasVisibleItems) return null;

          return (
            <div key={idx} className="space-y-6">
              <div className="text-[11px] font-black text-indigo-600/60 uppercase tracking-[0.2em] flex items-center gap-3">
                {cat.title}
                <span className="flex-1 h-px bg-slate-100"></span>
              </div>
              <div className="pl-1">
                {cat.items.map((item, iidx) => <FactItem key={iidx} item={item} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PropertyFacts;
