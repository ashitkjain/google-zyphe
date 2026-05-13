import React from 'react';
import AnalysisOrchestrator from './custom-ai/AnalysisOrchestrator';
import {
  CustomAIAnalysisResult,
  ComprehensiveAnalysisResult
} from '../../types';

interface Props {
  analysis: CustomAIAnalysisResult | null;
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onFullRefresh?: () => void;
  onRunComprehensive: () => void;
  comprehensiveResult: ComprehensiveAnalysisResult | null;
  mapUrl?: string;
  hasImages: boolean;
  userRole?: string;
  propertyImages?: string[];
  zpid?: string;
  propertyData?: any;
  onUpdateAnalysis: (updated: CustomAIAnalysisResult) => void;
  onUpdatePropertyData?: (updatedFields: any) => void;
  addLog: (service: string, meta: { type: 'request' | 'response' | 'error' | 'info' }, content: any) => void;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  activeSubTab?: string;
  onTabChange?: (tabId: string) => void;
  onBindContextGraphRefresh?: (fn: () => void) => void;
}

const CustomAIAnalysis: React.FC<Props> = (props) => {
  return <AnalysisOrchestrator {...props} onTabChange={props.onTabChange as any} />;
};

export default CustomAIAnalysis;
