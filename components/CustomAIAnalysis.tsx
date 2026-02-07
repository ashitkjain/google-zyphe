import React from 'react';
import AnalysisOrchestrator from './analysis/custom-ai/AnalysisOrchestrator';
import {
  CustomAIAnalysisResult,
  ComprehensiveAnalysisResult
} from '../types';

interface Props {
  analysis: CustomAIAnalysisResult | null;
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onRunComprehensive: () => void;
  comprehensiveResult: ComprehensiveAnalysisResult | null;
  mapUrl?: string;
  hasImages: boolean;
  userRole?: string;
  propertyImages?: string[];
  zpid?: string;
  propertyData?: any;
  onUpdateAnalysis: (updated: CustomAIAnalysisResult) => void;
  addLog: (service: string, meta: { type: 'request' | 'response' | 'error' | 'info' }, content: any) => void;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
}

const CustomAIAnalysis: React.FC<Props> = (props) => {
  return <AnalysisOrchestrator {...props} />;
};

export default CustomAIAnalysis;
