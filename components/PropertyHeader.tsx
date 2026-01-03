
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
    { icon: 'fa-vector-square', label: 'Living Area', value: `${data.livingAreaValue?.toLocaleString()} sq ft` },
    { icon: 'fa-ruler-combined', label: 'Lot Size', value: data.lotSize || 'N/A' },
    { icon: 'fa-calendar-days', label: 'Year Built', value: data.yearBuilt },
    { icon: 'fa-house', label: 'Property Type', value: data.homeType?.replace('_', ' ') },
    { icon: 'fa-tag', label: 'List Price', value: formatCurrency(data.price) },
    { icon: 'fa-chart-line', label: 'Zestimate', value: formatCurrency(data.zestimate) },
    { icon: 'fa-circle-info', label: 'Home Status', value: data.homeStatus },
    { icon: 'fa-hand-holding-dollar', label: 'Rent Estimate', value: `${formatCurrency(data.rentZestimate)}/month` },
    { icon: 'fa-shield-halved', label: 'Annual Insurance', value: `${formatCurrency(data.annualHomeownersInsurance)}/year` },
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-8">
        {metrics.map((m, idx) => (
          <div key={idx} className={`flex items-start space-x-3 ${m.full ? 'md:col-span-2 lg:col-span-1' : ''}`}>
            <div className="mt-1">
              <i className={`fa-solid ${m.icon} text-gray-400 w-5 text-center`}></i>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{m.label}</p>
              <p className="text-sm font-medium text-gray-900 truncate max-w-xs" title={String(m.value)}>
                {m.value || 'N/A'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PropertyHeader;
