
import React from 'react';
import { PropertyData } from '../types';

interface Props {
  data: PropertyData;
}

const TablesSection: React.FC<Props> = ({ data }) => {
  const risks = [
    { type: 'Wind', score: data.windRiskScore },
    { type: 'Flood', score: data.floodRiskScore },
    { type: 'Fire', score: data.fireRiskScore },
    { type: 'Heat', score: data.heatRiskScore },
  ];

  const getRiskStatus = (score?: number) => {
    if (!score) return 'Not Critical';
    if (score >= 7) return 'Critical';
    if (score >= 4) return 'Moderate';
    return 'Not Critical';
  };

  const getRiskColor = (score?: number) => {
    if (!score) return 'text-gray-600';
    if (score >= 7) return 'text-red-600 font-bold';
    if (score >= 4) return 'text-orange-600 font-semibold';
    return 'text-green-600';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Schools Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center bg-gray-50/50">
          <i className="fa-solid fa-school text-gray-500 mr-2"></i>
          <h3 className="font-bold text-gray-700">Schools</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Distance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.schools?.map((s, i) => (
                <tr key={i} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.level}</td>
                  <td className="px-4 py-3 text-blue-700 font-bold">{s.rating}</td>
                  <td className="px-4 py-3 text-gray-500">{s.distance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Climate Risk Assessment */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center bg-gray-50/50">
          <i className="fa-solid fa-shield-virus text-gray-500 mr-2"></i>
          <h3 className="font-bold text-gray-700">Climate Risk Assessment</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Insurance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {risks.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{r.type}</td>
                  <td className={`px-4 py-3 font-bold ${getRiskColor(r.score)}`}>{r.score}/10</td>
                  <td className={`px-4 py-3 ${getRiskColor(r.score)}`}>{getRiskStatus(r.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TablesSection;
