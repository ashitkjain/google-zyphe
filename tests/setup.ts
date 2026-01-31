import { vi } from 'vitest';

// Mock Firebase Auth
vi.mock('../services/firebase/config', () => ({
    auth: {
        currentUser: { uid: 'test-user-id' }
    }
}));

// Mock Firebase Functions
vi.mock('../services/firebase/api_logs', () => ({
    logAPICall: vi.fn(() => Promise.resolve('log-id')),
    updateAPICall: vi.fn(() => Promise.resolve())
}));

vi.mock('../services/firebase/llm_logs', () => ({
    logLLMCall: vi.fn(() => Promise.resolve('llm-log-id')),
    updateLLMCall: vi.fn(() => Promise.resolve())
}));

vi.mock('../services/firebaseService', () => ({
    savePropertyToCloud: vi.fn(() => Promise.resolve({ success: true })),
    getPropertyFromCloud: vi.fn(() => Promise.resolve(null)),
    getPropertyInvestmentFromCloud: vi.fn(() => Promise.resolve(null)),
    getGeneralMarketIntelligenceFromCloud: vi.fn(() => Promise.resolve(null)),
    savePropertyInvestmentToCloud: vi.fn(() => Promise.resolve({ success: true })),
    saveGeneralMarketIntelligenceToCloud: vi.fn(() => Promise.resolve({ success: true }))
}));

// Mock serverTimestamp
vi.mock('firebase/firestore', () => ({
    serverTimestamp: vi.fn(() => 'mock-timestamp')
}));
