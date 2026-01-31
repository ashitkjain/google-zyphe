import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(undefined, 'us-central1');
const searchFunc = httpsCallable<{ query: string }, { results: SearchResult[] }>(functions, 'searchKnowledgeBase');

export interface SearchResult {
    id: string;
    title: string;
    slug: string;
    topicSlug: string;
    score: number;
}

/**
 * Performs a semantic vector search across 'guides' and 'best_practices' via Cloud Function.
 */
export const searchKnowledge = async (queryText: string): Promise<SearchResult[]> => {
    if (!queryText.trim()) return [];

    try {
        console.log(`[Search] Calling semantic search for: ${queryText}`);
        const result = await searchFunc({ query: queryText });
        return result.data.results;
    } catch (error) {
        console.error('Semantic Search Error:', error);
        return [];
    }
};
