import React from 'react';
import { ResoFacts } from '../types';

interface Props {
  facts?: ResoFacts;
}

const PropertyFacts: React.FC<Props> = ({ facts }) => {
  if (!facts) return null;

  const parseComplexFact = (value: any): string => {
    const rawValue = value === undefined || value === null || value === '' || value === 'null' ? '' : String(value);
    if (!rawValue) return '';

    try {
      // Try parsing as JSON to handle numeric-keyed objects like {"0": "Public Sewer", "1": "..."}
      const parsed = JSON.parse(rawValue);
      if (typeof parsed === 'object' && parsed !== null) {
        return Object.values(parsed)
          .filter(v => v !== null && v !== undefined && v !== '')
          .map(v => String(v))
          .join(', ');
      }
    } catch (e) {
      // Not JSON, return as is
    }
    return rawValue;
  };

  const renderFact = (label: string, value: any, isComplex: boolean = false) => {
    const displayValue = isComplex ? parseComplexFact(value) : (value === undefined || value === null || value === '' || value === 'null' ? '' : String(value));
    if (!displayValue || displayValue.toLowerCase() === 'null') return null;

    // Explicitly skipping Rooms as requested previously
    if (label === 'Rooms') return null;

    return (
      <div key={label} className="py-1 text-base">
        <span className="font-bold text-gray-800">{label}:</span> <span className="text-gray-700">{displayValue}</span>
      </div>
    );
  };

  return (
    <div className="bg-white px-8 py-6 border-x border-gray-100">
      <div className="flex items-center text-base font-bold text-gray-700 mb-6 border-b border-gray-50 pb-3">
        <i className="fa-solid fa-gears text-gray-400 mr-3"></i>
        Structural & Technical Specifications
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-2">
        {/* Column 1 */}
        <div className="space-y-1">
          {renderFact('Flooring', facts.flooring)}
          {renderFact('Foundation Details', facts.foundationDetails)}
          {renderFact('Sewer', facts.sewer, true)}
          {renderFact('Utilities', facts.utilities, true)}
          {renderFact('Water Source', facts.waterSource, true)}
          {renderFact('Fees And Dues', facts.feesAndDues)}
          {renderFact('Exterior Features', facts.exteriorFeatures)}
          {renderFact('Architectural Style', facts.architecturalStyle)}
        </div>

        {/* Column 2 */}
        <div className="space-y-1">
          {renderFact('Garage Parking Capacity', facts.garageParkingCapacity)}
          {renderFact('Lot Features', facts.lotFeatures)}
          {renderFact('Roof Type', facts.roofType)}
          {renderFact('Days On Zillow', facts.daysOnZillow)}
          {renderFact('Construction Materials', facts.constructionMaterials)}
          {renderFact('Fireplace Features', facts.fireplaceFeatures)}
        </div>

        {/* Column 3 */}
        <div className="space-y-1">
          {renderFact('Appliances', facts.appliances)}
          {renderFact('Fencing', facts.fencing)}
          {renderFact('Cooling', facts.cooling)}
          {renderFact('Laundry Features', facts.laundryFeatures)}
          {renderFact('Heating', facts.heating)}
          {renderFact('Basement', facts.basement)}
        </div>
      </div>
    </div>
  );
};

export default PropertyFacts;