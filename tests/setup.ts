import { vi } from 'vitest';

// Mock Firebase config — all commonly-used exports
vi.mock('../services/firebase/config', () => ({
    auth: { currentUser: { uid: 'test-user-id' } },
    db: { type: 'db' },
    storage: null,
    functions: null,
    generateCityStateKey: vi.fn((city: string, state: string) => `${city}_${state}`.toLowerCase()),
    sanitizeForFirestore: vi.fn((x: any) => x),
    logFirestoreQuery: vi.fn(),
    handleFirestoreError: vi.fn(),
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
    getPropertyByAddress: vi.fn(() => Promise.resolve(null)),
    getPropertyAssetsFromCloud: vi.fn(() => Promise.resolve(null)),
    getPropertyInvestmentFromCloud: vi.fn(() => Promise.resolve(null)),
    getGeneralMarketIntelligenceFromCloud: vi.fn(() => Promise.resolve(null)),
    savePropertyInvestmentToCloud: vi.fn(() => Promise.resolve({ success: true })),
    saveGeneralMarketIntelligenceToCloud: vi.fn(() => Promise.resolve({ success: true })),
    getThirdPartyDataFromCloud: vi.fn(() => Promise.resolve(null)),
    saveThirdPartyDataToCloud: vi.fn(() => Promise.resolve({ success: true })),
}));

const _mockDoc = (...args: any[]) => {
    const segments = args.slice(1);
    const id = segments[segments.length - 1] || 'mock-id';
    const path = segments.length >= 2 ? segments[segments.length - 2] : segments[0];
    return { path, id, type: 'doc' };
};

const _mockCollection = (...args: any[]) => {
    const segments = args.slice(1);
    const path = segments[segments.length - 1] || 'unknown';
    return { path, type: 'collection' };
};

// Mock serverTimestamp
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(_mockCollection),
    doc: vi.fn(_mockDoc),
    setDoc: vi.fn(() => Promise.resolve()),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-doc-id' })),
    getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
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
