import { db } from './config';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { GuideResult } from '../../prompts/guideGeneration';

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
