
import { useState, useEffect } from 'react';
import { SearchTrie } from '../services/api/trie';
import { loadAddressIndex } from '../services/firebaseService';

const SUPPORTED_CITIES = ['Pleasanton', 'Dublin'];

// Module-level singleton — survives React StrictMode double-mount and any
// hook remount, so we never rebuild the trie within a single page session.
let _trieSingleton: Promise<SearchTrie> | null = null;
function buildTrieOnce(): Promise<SearchTrie> {
    if (_trieSingleton) return _trieSingleton;
    _trieSingleton = (async () => {
        console.log('[SearchTrie] Initializing...');
        const newTrie = new SearchTrie();
        const entries = await loadAddressIndex(SUPPORTED_CITIES.map(c => c.toLowerCase()));
        for (const city of SUPPORTED_CITIES) {
            newTrie.insert(city, { type: 'city', label: city });
        }
        const zips = new Set<string>();
        for (const entry of entries) {
            const zipMatch = entry.a.match(/\b\d{5}\b/);
            if (zipMatch) zips.add(zipMatch[0]);
            newTrie.insert(entry.a, { type: 'address', label: entry.a, zpid: entry.z });
        }
        for (const zip of zips) newTrie.insert(zip, { type: 'zip', label: zip });
        console.log(`[SearchTrie] Build complete. Nodes: ${newTrie.size}, Entries: ${entries.length}`);
        return newTrie;
    })().catch(err => {
        _trieSingleton = null; // allow retry on failure
        throw err;
    });
    return _trieSingleton;
}

export function useSearchTrie() {
    const [trie, setTrie] = useState<SearchTrie | null>(null);
    const [isBuilding, setIsBuilding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setIsBuilding(true);
        buildTrieOnce()
            .then(t => { if (!cancelled) setTrie(t); })
            .catch(err => { if (!cancelled) setError(err.message); })
            .finally(() => { if (!cancelled) setIsBuilding(false); });
        return () => { cancelled = true; };
    }, []);

    return { trie, isBuilding, error };
}

