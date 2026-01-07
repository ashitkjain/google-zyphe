
import React from 'react';
import { ResoFacts } from '../types';

interface Props {
  facts?: ResoFacts;
}

const PropertyFacts: React.FC<Props> = ({ facts }) => {
  if (!facts) return null;

  const renderFact = (label: string, value: any) => {
    let displayValue = value === undefined || value === null || value === '' || value === 'null' ? '' : String(value);
    
    if (!displayValue) return null;

    // Handle special formatting for "Rooms" as requested
    if (label === 'Rooms') {
      let finalString = '';
      
      try {
        // Try to handle if it's a JSON stringified object
        const parsed = JSON.parse(displayValue);
        if (typeof parsed === 'object' && parsed !== null) {
          finalString = Object.entries(parsed)
            .filter(([_, v]) => v !== null && v !== undefined && v !== 'null' && v !== '')
            .map(([k, v]) => `${k} - ${v}`)
            .join(', ');
        } else {
          finalString = String(parsed);
        }
      } catch (e) {
        // Fallback for non-JSON strings
        finalString = displayValue
          .split(',')
          .map(part => part.trim())
          .filter(part => {
            if (!part) return false;
            const lower = part.toLowerCase();
            return lower !== 'null' && !lower.includes(': null') && !part.endsWith(':');
          })
          .map(part => part.replace(':', ' -')) // Change colon to dash
          .join(', ');
      }

      // Strip any remaining brackets or quotes globally as requested
      const cleaned = finalString.replace(/[{}|[\]"]/g, '').trim();
      
      if (!cleaned) return null;

      return (
        <div key={label} className="py-1 text-base">
          <span className="font-bold text-gray-800">{label}:</span> <span className="text-gray-700">{cleaned}</span>
        </div>
      );
    }

    return (
      <div key={label} className="py-1 text-base">
        <span className="font-bold text-gray-800">{label}:</span> <span className="text-gray-700">{displayValue}</span>
      </div>
    );
  };

  return (
    <div className="bg-white px-8 py-8 rounded-b-xl border-x border-b border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-2">
        {/* Column 1 */}
        <div className="space-y-1">
          {renderFact('Flooring', facts.flooring)}
          {renderFact('Foundation Details', facts.foundationDetails)}
          {renderFact('Rooms', facts.rooms)}
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
