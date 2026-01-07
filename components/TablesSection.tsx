
import React from 'react';
import { PropertyData } from '../types';

interface Props {
  data: PropertyData;
}

const TablesSection: React.FC<Props> = ({ data }) => {
  return (
    <div className="bg-white border-x border-gray-200 px-8 py-6">
      <div className="max-w-4xl">
        {/* Only Schools now */}
        <div>
          <div className="flex items-center text-base mb-4">
            <i className="fa-solid fa-graduation-cap text-gray-400 mr-3 text-lg"></i>
            <span className="font-bold text-gray-700">Educational Institution Proximity:</span>
          </div>
          <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
            <table className="w-full text-left text-base">
              <thead className="bg-[#E9EDF2] text-gray-700 font-bold">
                <tr>
                  <th className="px-4 py-3 border-r border-gray-200">School</th>
                  <th className="px-4 py-3 border-r border-gray-200">Level</th>
                  <th className="px-4 py-3 border-r border-gray-200 text-center">Rating</th>
                  <th className="px-4 py-3 text-center">Distance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.schools && data.schools.length > 0 ? (
                  data.schools.map((s, i) => (
                    <tr key={i} className="text-gray-700 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 border-r border-gray-200">{s.name}</td>
                      <td className="px-4 py-2.5 border-r border-gray-200">{s.level}</td>
                      <td className="px-4 py-2.5 border-r border-gray-200 text-center font-bold text-[#1E40AF]">
                        {s.rating && s.rating !== 'N/A' ? `${s.rating}/10` : 'N/A/10'}
                      </td>
                      <td className="px-4 py-2.5 text-center">{s.distance}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-gray-400 italic">No school data available for this area.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TablesSection;
