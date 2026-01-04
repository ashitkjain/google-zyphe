
import React from 'react';
import { AIAnalysisResult } from '../types';

interface Props {
  analysis: AIAnalysisResult;
  loading: boolean;
}

const AIAnalysis: React.FC<Props> = ({ analysis, loading }) => {
  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-10 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-6"></div>
        <p className="text-blue-800 text-lg font-bold">Zyphe AI is performing deep intelligent analysis...</p>
      </div>
    );
  }

  const sections = [
    { title: "Buyer's Report", icon: "fa-shopping-cart", content: analysis.buyerAnalysis, color: "blue" },
    { title: "Seller's Strategy", icon: "fa-money-bill-trend-up", content: analysis.sellerStrategy, color: "green" },
    { title: "Realtor's Pitch", icon: "fa-microphone-lines", content: analysis.realtorPitch, color: "purple" },
    { title: "Market Outlook", icon: "fa-chart-area", content: analysis.marketOutlook, color: "orange" },
  ];

  return (
    <div className="mt-10 space-y-8">
      <div className="flex items-center space-x-4 mb-4">
        <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
          <i className="fa-solid fa-brain text-white text-base"></i>
        </div>
        <h2 className="text-3xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Zyphe™ AI Intelligence Report</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {sections.map((s, idx) => (
          <div key={idx} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
            <div className="flex items-center mb-5">
              <div className={`p-3 rounded-lg bg-${s.color}-100 text-${s.color}-600 mr-4 group-hover:scale-110 transition-transform`}>
                <i className={`fa-solid ${s.icon} text-lg`}></i>
              </div>
              <h3 className={`font-black text-gray-800 text-xl tracking-tight`}>{s.title}</h3>
            </div>
            <div className="prose prose-base text-gray-600 leading-relaxed whitespace-pre-wrap">
              {s.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AIAnalysis;
