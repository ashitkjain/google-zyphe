import { db } from './config';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { vector, VectorValue } from 'firebase/firestore';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini for client-side embedding of queries
const genAI = new GoogleGenerativeAI('AIzaSyBEPZ14POfqhB2wgfqAsgXkzuVPy2w-l90');
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

export interface SearchResult {
    id: string;
    title: string;
    slug: string;
    topicSlug: string;
    score: number;
}

/**
 * Performs a semantic vector search on the 'guides' collection.
 * Matches concepts and meaning rather than just keywords.
 */
export const searchKnowledge = async (queryText: string): Promise<SearchResult[]> => {
    if (!queryText.trim()) return [];

    try {
        // 1. Generate embedding for the search query
        const embeddingResult = await embeddingModel.embedContent(queryText);
        const queryVectorValues = embeddingResult.embedding.values;

        // 2. Perform Vector Search in Firestore
        // Note: findNearest requires the Firestore Vector Search extension or native support
        // This syntax assumes the latest Firebase JS SDK support for vector queries.
        const guidesRef = collection(db, 'guides');

        // We use the 'embedding' field created by the Cloud Function
        // Using Cosine distance for semantic similarity
        const q = query(
            guidesRef,
            // @ts-ignore - latest SDK feature
            vector.findNearest('embedding', vector.vector(queryVectorValues), {
                limit: 10,
                distanceMeasure: 'COSINE'
            })
        );

        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title,
                slug: data.slug,
                topicSlug: data.topicSlug,
                // @ts-ignore - metadata field from vector query
                score: doc.metadata?.distance || 0
            };
        });

    } catch (error) {
        console.error('Semantic Search Error:', error);
        return [];
    }
};
