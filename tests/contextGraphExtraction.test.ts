import { describe, it, expect } from 'vitest';
import { buildGraphExtractionContext, getContextGraphExtractionPrompt } from '../prompts/property/contextGraphExtraction';

describe('contextGraphExtraction', () => {
    it('should correctly build context with visionExtension data and supercharge factor 113', () => {
        const prop = {
            address: '4129 Grant Ct',
            city: 'Pleasanton',
            state: 'CA',
            description: 'Beautiful luxury home',
        } as any;

        const visionExtension = {
            photos: [
                {
                    group_label: 'Kitchen',
                    analysis: 'High-end Sub-Zero refrigerator, waterfall quartz island, custom cabinetry.'
                },
                {
                    group_label: 'Living Room',
                    analysis: 'Floor-to-ceiling windows, engineered hardwood, fireplace.'
                },
                {
                    group_label: 'Noise', // Should be excluded if no analysis or not a room
                    analysis: ''
                }
            ]
        };

        const context = buildGraphExtractionContext(prop, null, null, visionExtension);
        console.log("KEYS:", Object.keys(context));
        console.log("VISION EXT:", context.visionExtension);
        
        expect(context.visionExtension).toBeDefined();
        expect(context.visionExtension.length).toBe(2);
        expect(context.visionExtension[0].space).toBe('Kitchen');
        expect(context.visionExtension[0].analysis).toContain('Sub-Zero');

    });
});
