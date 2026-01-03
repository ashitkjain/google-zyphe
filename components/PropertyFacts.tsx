
import React from 'react';
import { ResoFacts } from '../types';

interface Props {
  facts?: ResoFacts;
}

const PropertyFacts: React.FC<Props> = ({ facts }) => {
  if (!facts) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6 p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Part 1 */}
      <div>
        <div className="flex items-center mb-4 text-gray-700">
          <i className="fa-solid fa-file-invoice text-gray-400 mr-2"></i>
          <h3 className="font-bold">Property Facts (Part 1)</h3>
        </div>
        <div className="space-y-2 text-sm">
          <p><span className="font-bold text-gray-800">Flooring:</span> {facts.flooring}</p>
          <p><span className="font-bold text-gray-800">Foundation Details:</span> {facts.foundationDetails}</p>
          <div>
            <span className="font-bold text-gray-800">Rooms:</span>
            <p className="ml-4 mt-1 text-gray-600 italic">{facts.rooms}</p>
          </div>
          <p><span className="font-bold text-gray-800">Fees And Dues:</span> {facts.feesAndDues}</p>
          <p><span className="font-bold text-gray-800">Exterior Features:</span> {facts.exteriorFeatures}</p>
          <p><span className="font-bold text-gray-800">Architectural Style:</span> {facts.architecturalStyle}</p>
          <p><span className="font-bold text-gray-800">Garage Parking Capacity:</span> {facts.garageParkingCapacity}</p>
        </div>
      </div>

      {/* Part 2 */}
      <div>
        <div className="flex items-center mb-4 text-gray-700">
          <i className="fa-solid fa-file-invoice text-gray-400 mr-2"></i>
          <h3 className="font-bold">Property Facts (Part 2)</h3>
        </div>
        <div className="space-y-2 text-sm">
          <p><span className="font-bold text-gray-800">Lot Features:</span> {facts.lotFeatures}</p>
          <p><span className="font-bold text-gray-800">Roof Type:</span> {facts.roofType}</p>
          <p><span className="font-bold text-gray-800">Days On Zillow:</span> {facts.daysOnZillow}</p>
          <p><span className="font-bold text-gray-800">Construction Materials:</span> {facts.constructionMaterials}</p>
          <p><span className="font-bold text-gray-800">Fireplace Features:</span> {facts.fireplaceFeatures}</p>
          <p><span className="font-bold text-gray-800">Appliances:</span> {facts.appliances}</p>
          <p><span className="font-bold text-gray-800">Fencing:</span> {facts.fencing}</p>
          <p><span className="font-bold text-gray-800">Cooling:</span> {facts.cooling}</p>
          <p><span className="font-bold text-gray-800">Laundry Features:</span> {facts.laundryFeatures}</p>
          <p><span className="font-bold text-gray-800">Heating:</span> {facts.heating}</p>
        </div>
      </div>
    </div>
  );
};

export default PropertyFacts;
