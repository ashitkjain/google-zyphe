
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
    return 'Not Critical';
  };

  const getScoreDisplay = (score?: number) => {
    return score !== undefined ? `${score}/10` : 'N/A/10';
  };

  return (
    <div className="bg-white border-x border-gray-200 px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left Column: Schools */}
        <div>
          <div className="flex items-center text-base mb-4">
            <i className="fa-solid fa-graduation-cap text-gray-400 mr-3 text-lg"></i>
            <span className="font-bold text-gray-700">Schools:</span>
          </div>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
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
                {data.schools?.map((s, i) => (
                  <tr key={i} className="text-gray-700 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 border-r border-gray-200">{s.name}</td>
                    <td className="px-4 py-2.5 border-r border-gray-200">{s.level}</td>
                    <td className="px-4 py-2.5 border-r border-gray-200 text-center font-bold text-[#1E40AF]">
                      {s.rating && s.rating !== 'N/A' ? `${s.rating}/10` : 'N/A/10'}
                    </td>
                    <td className="px-4 py-2.5 text-center">{s.distance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Climate Risk */}
        <div>
          <div className="flex items-center text-base mb-4">
            <i className="fa-regular fa-shield text-gray-400 mr-3 text-lg"></i>
            <span className="font-bold text-gray-700">Climate Risk:</span>
          </div>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-left text-base">
              <thead className="bg-[#E9EDF2] text-gray-700 font-bold">
                <tr>
                  <th className="px-4 py-3 border-r border-gray-200">Risk</th>
                  <th className="px-4 py-3 border-r border-gray-200 text-center">Score</th>
                  <th className="px-4 py-3">Insurance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {risks.map((r, i) => (
                  <tr key={i} className="text-gray-700 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 border-r border-gray-200">{r.type}</td>
                    <td className="px-4 py-2.5 border-r border-gray-200 text-center font-bold text-[#1E40AF]">
                      {getScoreDisplay(r.score)}
                    </td>
                    <td className={`px-4 py-2.5 ${getRiskStatus(r.score) === 'Critical' ? 'text-red-600 font-bold' : ''}`}>
                      {getRiskStatus(r.score)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TablesSection;
