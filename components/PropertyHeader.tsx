
import React from 'react';
import { PropertyData } from '../types';

interface Props {
  data: PropertyData;
}

const PropertyHeader: React.FC<Props> = ({ data }) => {
  const formatCurrency = (val?: number) => val ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : 'N/A';

  const metrics = [
    { icon: 'fa-location-dot', label: 'Address', value: data.address, full: true },
    { icon: 'fa-bed', label: 'Bedrooms', value: data.bedrooms },
    { icon: 'fa-bath', label: 'Bathrooms', value: data.bathrooms },
    { icon: 'fa-square', label: 'Living Area', value: `${data.livingAreaValue?.toLocaleString()} sq ft` },
    { icon: 'fa-square-check', label: 'Lot Size', value: data.lotSize || 'N/A' },
    { icon: 'fa-calendar-days', label: 'Year Built', value: data.yearBuilt },
    { icon: 'fa-house', label: 'Property Type', value: data.homeType?.replace('_', ' ') },
    { icon: 'fa-dollar-sign', label: 'List Price', value: formatCurrency(data.price) },
    { icon: 'fa-dollar-sign', label: 'Zestimate', value: formatCurrency(data.zestimate) },
    { icon: 'fa-house-chimney', label: 'Home Status', value: data.homeStatus || 'N/A' },
    { icon: 'fa-dollar-sign', label: 'Rent Estimate', value: data.rentZestimate ? `${formatCurrency(data.rentZestimate)}/month` : 'N/A' },
    { icon: 'fa-dollar-sign', label: 'Annual Insurance', value: data.annualHomeownersInsurance ? `${formatCurrency(data.annualHomeownersInsurance)}/year` : 'N/A' },
  ];

  return (
    <div className="bg-white p-8 rounded-t-xl border-x border-t border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
        {metrics.map((m, idx) => (
          <div key={idx} className={`flex items-center text-base ${m.full ? 'md:col-span-2' : ''}`}>
            <div className="w-8 flex justify-center mr-3">
              <i className={`fa-solid ${m.icon} text-gray-400 text-base`}></i>
            </div>
            <span className="font-bold text-gray-700 mr-3">{m.label}:</span>
            <span className="text-gray-800 truncate">{m.value || 'N/A'}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PropertyHeader;
