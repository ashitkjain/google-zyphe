import { describe, it, expect } from 'vitest';
import { getInvestmentResearchPrompt } from '../prompts/property/investmentResearch';
import { getNeighborhoodAnalysisPrompt } from '../prompts/property/neighborhoodAnalysis';

describe('Prompt Engineering Integrity', () => {
    describe('Investment Research Prompt', () => {
        it('should include the property address in the prompt', () => {
            const mockProperty = { address: '123 Main St', bedrooms: 3 } as any;
            const prompt = getInvestmentResearchPrompt(mockProperty);
            expect(prompt).toContain('123 Main St');
        });

        it('should handle missing bedrooms by using a default', () => {
            const mockProperty = { address: '123 Main St' } as any;
            const prompt = getInvestmentResearchPrompt(mockProperty);
            // According to investmentResearch.ts, it uses property.bedrooms || 2
            expect(prompt).toContain('2-bedroom properties');
        });
    });

    describe('Neighborhood Analysis Prompt', () => {
        it('should include neighborhood context', () => {
            const mockProperty = { address: '123 Main St', city: 'Denver' } as any;
            const prompt = getNeighborhoodAnalysisPrompt(mockProperty);
            expect(prompt).toContain('neighborhood');
            expect(prompt).toContain('123 Main St');
        });
    });
});
