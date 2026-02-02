import { describe, it, expect } from 'vitest';
import {
    validateEIN,
    validateWebsite,
    validateBrandDetails,
    validateCampaignDetails
} from '../services/smsRegistrationService';

describe('SMS Registration Service Unit Tests', () => {
    describe('validateEIN', () => {
        it('should return true for valid EIN format', () => {
            expect(validateEIN('12-3456789')).toBe(true);
        });

        it('should return false for invalid formats', () => {
            expect(validateEIN('123456789')).toBe(false);
            expect(validateEIN('12-345678')).toBe(false);
            expect(validateEIN('1-23456789')).toBe(false);
            expect(validateEIN('ab-cdefghi')).toBe(false);
        });
    });

    describe('validateWebsite', () => {
        it('should return true for valid URLs', () => {
            expect(validateWebsite('https://zyphe.ai')).toBe(true);
            expect(validateWebsite('http://localhost:3000')).toBe(true);
        });

        it('should return false for invalid URLs', () => {
            expect(validateWebsite('not-a-url')).toBe(false);
            expect(validateWebsite('www.google.com')).toBe(false); // URL constructor needs protocol
        });
    });

    describe('validateBrandDetails', () => {
        it('should return valid if all fields are correct', () => {
            const data = {
                legalName: 'Zyphe Inc',
                ein: '12-3456789',
                website: 'https://zyphe.ai',
                address: '123 Tech Lane'
            };
            const result = validateBrandDetails(data);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual({});
        });

        it('should return errors for missing or invalid fields', () => {
            const data = {
                legalName: '',
                ein: 'invalid-ein',
                website: 'broken-link',
                address: ' '
            };
            const result = validateBrandDetails(data);
            expect(result.isValid).toBe(false);
            expect(result.errors.legalName).toBeDefined();
            expect(result.errors.ein).toBeDefined();
            expect(result.errors.website).toBeDefined();
            expect(result.errors.address).toBeDefined();
        });
    });

    describe('validateCampaignDetails', () => {
        it('should return valid for complete data', () => {
            const data = {
                description: 'This is a long enough description for approval.',
                sample1: 'Message 1',
                sample2: 'Message 2'
            };
            const result = validateCampaignDetails(data);
            expect(result.isValid).toBe(true);
        });

        it('should return error for short description', () => {
            const data = {
                description: 'Too short',
                sample1: 'm1',
                sample2: 'm2'
            };
            const result = validateCampaignDetails(data);
            expect(result.isValid).toBe(false);
            expect(result.errors.description).toBeDefined();
        });
    });
});
