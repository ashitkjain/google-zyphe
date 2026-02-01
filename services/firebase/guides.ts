import { db } from './config';
import { doc, setDoc, getDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { GuideResult } from '../../prompts/client/guideGeneration';
import { BEST_PRACTICES_DATA } from '../../components/client-hub/MagazineBestPracticesData';

export interface GuideContent {
    id: string;
    topicSlug: string;
    slug: string;
    title: string;
    content: GuideResult | string;
    lastUpdated: any;
}

export const saveGuideContent = async (guide: GuideContent) => {
    try {
        const guideRef = doc(db, 'guides', `${guide.topicSlug}_${guide.slug}`);
        await setDoc(guideRef, {
            ...guide,
            lastUpdated: new Date()
        });
        return { success: true };
    } catch (error) {
        console.error('Error saving guide content:', error);
        return { success: false, error };
    }
};

export const getGuideBySlug = async (topicSlug: string, slug: string) => {
    try {
        const guideRef = doc(db, 'guides', `${topicSlug}_${slug}`);
        const snapshot = await getDoc(guideRef);
        if (snapshot.exists()) {
            return snapshot.data() as GuideContent;
        }
        return null;
    } catch (error) {
        return null;
    }
};

/**
 * Syncs the static BEST_PRACTICES_DATA to Firestore to enable semantic indexing.
 */
export const syncBestPractices = async () => {
    try {
        const batch = writeBatch(db);
        const colRef = collection(db, 'best_practices');

        Object.entries(BEST_PRACTICES_DATA).forEach(([slug, data]) => {
            const docRef = doc(colRef, slug);
            batch.set(docRef, {
                ...data,
                slug,
                id: slug,
                title: data.title,
                subtitle: data.subtitle,
                content: {
                    strategies: data.strategies || [],
                    checklists: data.checklists || [],
                    templates: data.templates || []
                },
                lastUpdated: new Date(),
                isStatic: true
            }, { merge: true });
        });

        await batch.commit();
        console.log('[Sync] Best Practices synchronized to Firestore.');
        return { success: true };
    } catch (error) {
        console.error('[Sync] Best Practices sync failed:', error);
        return { success: false, error };
    }
};
