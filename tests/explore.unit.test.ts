import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPropertyDataFull } from '../services/apiService';
import { analyzeInvestmentResearch, FLASH_LITE_MODEL } from '../services/geminiService';
import { APP_CONFIG } from '../config';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Gemini AI
const mockGenerateContent = vi.fn();
vi.mock('@google/genai', () => {
    return {
        GoogleGenAI: vi.fn().mockImplementation(() => ({
            models: {
                generateContent: mockGenerateContent
            }
        })),
        Type: {
            OBJECT: 'OBJECT',
            STRING: 'STRING',
            NUMBER: 'NUMBER'
        }
    };
});

describe('Explore Functionality Unit Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('apiService: fetchPropertyDataFull', () => {
        it('should fetch property data from RapidAPI and return mapped PropertyData', async () => {
            const mockZpid = '12345';
            const mockApiResponse = {
                zpid: mockZpid,
                address: { streetAddress: '123 Main St', city: 'Denver', state: 'CO', zipcode: '80202' },
                price: 500000,
                bedrooms: 3,
                bathrooms: 2,
                livingAreaValue: 1500,
                homeStatus: 'FOR_SALE',
                description: 'A beautiful home'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockApiResponse)
            });

            // Mocking dependent calls inside fetchPropertyDataFull
            // fetchScores, fetchPropertyImages, fetchPropertyComps are called if zpid exists
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({})
            });

            const result = await fetchPropertyDataFull(mockZpid, true);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining(`property?zpid=${mockZpid}`),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'x-rapidapi-key': APP_CONFIG.usHousingApi.key,
                        'x-rapidapi-host': APP_CONFIG.usHousingApi.host
                    })
                })
            );

            expect(result.zpid).toBe(mockZpid);
            expect(result.address).toContain('123 Main St');
            expect(result.price).toBe(500000);
        });

        it('should retry on 429 status code', async () => {
            const mockZpid = '12345';

            // First call fails with 429
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429
            });

            // Second call succeeds
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ zpid: mockZpid, address: 'Retried Address' })
            });

            // Mocks for internal calls
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({})
            });

            const result = await fetchPropertyDataFull(mockZpid, true);

            expect(mockFetch).toHaveBeenCalledTimes(2 + 3); // 2 attempts for property + 3 for subsequent calls (scores, images, comps)
            expect(result.zpid).toBe(mockZpid);
        });
    });

    describe('geminiService: analyzeInvestmentResearch', () => {
        it('should call Gemini with correct prompt and schema', async () => {
            const mockProperty = {
                zpid: '12345',
                address: '123 Main St, Denver, CO',
                bedrooms: 3
            } as any;

            const mockAiResponse = {
                text: JSON.stringify({
                    str_performance: {
                        occupancy_rate: '75%',
                        adr: '$200',
                        annual_revenue_projection: '$50,000'
                    },
                    ltr_analysis: {
                        monthly_rent: '$2,500',
                        vacancy_rate: '5%',
                        comparison_summary: 'STR is better'
                    }
                }),
                usageMetadata: {
                    promptTokenCount: 100,
                    candidatesTokenCount: 50,
                    totalTokenCount: 150
                }
            };

            mockGenerateContent.mockResolvedValue(mockAiResponse);

            const result = await analyzeInvestmentResearch(mockProperty);

            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: FLASH_LITE_MODEL,
                    contents: expect.stringContaining('123 Main St, Denver, CO'),
                    config: expect.objectContaining({
                        tools: expect.arrayContaining([{ googleSearch: {} }])
                    })
                })
            );

            expect(result.data.str_performance.occupancy_rate).toBe('75%');
            expect(result.usage.totalTokens).toBe(150);
            expect(result.usage.model).toBe(FLASH_LITE_MODEL);
        });

        it('should handle AI response errors and throw AiResponseError', async () => {
            const mockProperty = { zpid: '123', address: 'Test' } as any;
            mockGenerateContent.mockRejectedValue(new Error('AI Failed'));

            await expect(analyzeInvestmentResearch(mockProperty)).rejects.toThrow();
        });
    });
});
