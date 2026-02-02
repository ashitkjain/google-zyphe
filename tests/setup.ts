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
    collection: vi.fn((db, path) => ({ path, type: 'collection' })),
    doc: vi.fn((db, path, id) => ({ path, id, type: 'doc' })),
    setDoc: vi.fn(() => Promise.resolve()),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-doc-id' })),
    getDoc: vi.fn(),
    getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    writeBatch: vi.fn(() => ({
        set: vi.fn(),
        commit: vi.fn(() => Promise.resolve()),
        delete: vi.fn()
    }))
}));
