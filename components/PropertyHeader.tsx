
import React from 'react';
import { PropertyData } from '../types';

interface Props {
  data: PropertyData;
}

const PropertyHeader: React.FC<Props> = ({ data }) => {
  const formatCurrency = (val?: number) => val ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : 'N/A';

  const metrics = [
    { icon: 'fa-bed', label: 'Bedrooms', value: data.bedrooms },
    { icon: 'fa-bath', label: 'Bathrooms', value: data.bathrooms },
    { icon: 'fa-maximize', label: 'Living Area', value: data.livingAreaValue ? `${data.livingAreaValue.toLocaleString()} sq ft` : 'N/A' },
    { icon: 'fa-chart-area', label: 'Lot Size', value: data.lotSize || 'N/A' },
    { icon: 'fa-calendar-days', label: 'Year Built', value: data.yearBuilt },
    { icon: 'fa-house', label: 'Property Type', value: data.homeType?.replace(/_/g, ' ') },
    { icon: 'fa-tag', label: 'List Price', value: formatCurrency(data.price) },
    { icon: 'fa-chart-line', label: 'Zestimate', value: formatCurrency(data.zestimate) },
    { icon: 'fa-house-circle-check', label: 'Home Status', value: data.homeStatus?.replace(/_/g, ' ') || 'N/A' },
    { icon: 'fa-hand-holding-dollar', label: 'Rent Estimate', value: data.rentZestimate ? `${formatCurrency(data.rentZestimate)}/month` : 'N/A' },
    { icon: 'fa-shield-heart', label: 'Annual Insurance', value: data.annualHomeownersInsurance ? `${formatCurrency(data.annualHomeownersInsurance)}/year` : 'N/A' },
  ];

  return (
    <div className="bg-white p-10 rounded-t-[2.5rem] border-x border-t border-gray-100 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-x-12 gap-y-5">
        {metrics.map((m, idx) => (
          <div key={idx} className="flex items-start gap-4 group">
            <div className="w-5 flex justify-center flex-shrink-0 mt-0.5">
              <i className={`fa-solid ${m.icon} text-gray-400 text-sm group-hover:text-indigo-500 transition-colors`}></i>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2 text-sm leading-tight">
              <span className="font-bold text-gray-700 whitespace-nowrap">{m.label}:</span>
              <span className="font-medium text-gray-900 break-words">{m.value || 'N/A'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PropertyHeader;
