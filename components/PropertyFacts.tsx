
import React from 'react';
import { ResoFacts } from '../types';

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
          return parsed.filter(v => v);
        }
        return Object.entries(parsed)
          .filter(([_, v]) => v !== null && v !== undefined && v !== '')
          .map(([k, v]) => {
            const cleanKey = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            return `${cleanKey}: ${v}`;
          });
      }
    } catch (e) {}
    return [rawValue];
  };

  const getIcon = (label: string) => {
    switch (label) {
      case 'Flooring': return 'fa-rug';
      case 'Foundation Details': return 'fa-trowel-bricks';
      case 'Sewer': return 'fa-faucet';
      case 'Utilities': return 'fa-plug';
      case 'Water Source': return 'fa-droplet';
      case 'Fees And Dues': return 'fa-dollar-sign';
      case 'Architectural Style': return 'fa-landmark';
      case 'Garage Capacity': return 'fa-car';
      case 'Lot Features': return 'fa-ruler-combined';
      case 'Exterior Features': return 'fa-house-chimney';
      case 'Roof Type': return 'fa-house-chimney-window';
      case 'Days On Zillow': return 'fa-clock';
      case 'Construction Materials': return 'fa-hammer';
      case 'Fireplace Features': return 'fa-fire';
      case 'Appliances': return 'fa-blender';
      case 'Fencing': return 'fa-fence';
      case 'Cooling': return 'fa-snowflake';
      case 'Laundry Features': return 'fa-soap';
      case 'Heating': return 'fa-fire-flame-simple';
      case 'Basement': return 'fa-arrow-down-wide-short';
      default: return 'fa-circle-info';
    }
  };

  const factItems = [
    { label: 'Flooring', value: facts.flooring, isComplex: true },
    { label: 'Foundation Details', value: facts.foundationDetails, isComplex: true },
    { label: 'Sewer', value: facts.sewer, isComplex: true },
    { label: 'Utilities', value: facts.utilities, isComplex: true },
    { label: 'Water Source', value: facts.waterSource, isComplex: true },
    { label: 'Fees And Dues', value: facts.feesAndDues, isComplex: true },
    { label: 'Architectural Style', value: facts.architecturalStyle },
    { label: 'Garage Capacity', value: facts.garageParkingCapacity },
    { label: 'Lot Features', value: facts.lotFeatures, isComplex: true },
    { label: 'Exterior Features', value: facts.exteriorFeatures, isComplex: true },
    { label: 'Roof Type', value: facts.roofType },
    { label: 'Days On Zillow', value: facts.daysOnZillow },
    { label: 'Construction Materials', value: facts.constructionMaterials, isComplex: true },
    { label: 'Fireplace Features', value: facts.fireplaceFeatures, isComplex: true },
    { label: 'Appliances', value: facts.appliances, isComplex: true },
    { label: 'Fencing', value: facts.fencing, isComplex: true },
    { label: 'Cooling', value: facts.cooling, isComplex: true },
    { label: 'Laundry Features', value: facts.laundryFeatures, isComplex: true },
    { label: 'Heating', value: facts.heating, isComplex: true },
    { label: 'Basement', value: facts.basement, isComplex: true },
  ];

  return (
    <div className="bg-white px-10 py-5 border-x border-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-x-12 gap-y-5">
        {factItems.map((item) => {
          const displayValues = item.isComplex 
            ? parseComplexFact(item.value) 
            : (item.value === undefined || item.value === null || item.value === '' || item.value === 'null' ? [] : [String(item.value)]);
          
          if (displayValues.length === 0 || (displayValues.length === 1 && displayValues[0].toLowerCase() === 'null')) return null;

          return (
            <div key={item.label} className="flex items-start gap-4 group">
              <div className="w-5 flex justify-center flex-shrink-0 mt-0.5">
                <i className={`fa-solid ${getIcon(item.label)} text-gray-400 text-sm group-hover:text-indigo-500 transition-colors`}></i>
              </div>
              <div className="flex-1 text-sm leading-tight">
                <div className="flex flex-wrap items-baseline gap-x-2 mb-1">
                  <span className="font-bold text-gray-700 whitespace-nowrap">{item.label}:</span>
                  {displayValues.length === 1 && (
                    <span className="font-medium text-gray-900 break-words">{displayValues[0]}</span>
                  )}
                </div>
                {displayValues.length > 1 && (
                  <ul className="space-y-1.5 mt-1.5 ml-1">
                    {displayValues.map((val, vidx) => (
                      <li key={vidx} className="flex items-start gap-2 text-gray-600 font-medium break-words">
                        <span className="text-indigo-400 mt-1 flex-shrink-0">•</span>
                        <span>{val}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PropertyFacts;
