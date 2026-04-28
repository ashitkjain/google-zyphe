
import { useState, useEffect, useMemo } from 'react';
import { SearchTrie, SearchResult } from '../services/api/trie';
import { loadAddressIndex } from '../services/firebaseService';

const SUPPORTED_CITIES = ['Pleasanton', 'Dublin'];

export function useSearchTrie() {
    const [trie, setTrie] = useState<SearchTrie | null>(null);
    const [isBuilding, setIsBuilding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const initTrie = async () => {
            setIsBuilding(true);
            try {
                console.log('[SearchTrie] Initializing...');
                const newTrie = new SearchTrie();

                // 1. Fetch data from Firestore
                const entries = await loadAddressIndex(SUPPORTED_CITIES.map(c => c.toLowerCase()));
                
                // 2. Insert Cities
                for (const city of SUPPORTED_CITIES) {
                    newTrie.insert(city, { type: 'city', label: city });
                }

                // 3. Insert Addresses and infer Zips
                const zips = new Set<string>();
                
                for (const entry of entries) {
                    // Extract Zip if present (e.g., "123 Main St, Pleasanton, CA 94566")
                    const zipMatch = entry.a.match(/\b\d{5}\b/);
                    if (zipMatch) {
                        zips.add(zipMatch[0]);
                    }

                    newTrie.insert(entry.a, {
                        type: 'address',
                        label: entry.a,
                        zpid: entry.z
                    });
                }

                // 4. Insert Zips
                for (const zip of zips) {
                    newTrie.insert(zip, { type: 'zip', label: zip });
                }

                console.log(`[SearchTrie] Build complete. Nodes: ${newTrie.size}, Entries: ${entries.length}`);
                setTrie(newTrie);
            } catch (err: any) {
                console.error('[SearchTrie] Build failed:', err);
                setError(err.message);
            } finally {
                setIsBuilding(false);
            }
        };

        initTrie();
    }, []);

    return { trie, isBuilding, error };
}
