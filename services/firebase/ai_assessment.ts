
import { db } from './config';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    Timestamp,
    orderBy
} from 'firebase/firestore';

export interface AIAssessment {
    mlsid: string;
    propertyAddress: string;
    assessment: 'good' | 'bad' | 'other';
    comment: string;
    visual_ai_comment?: string;
    create_date: any;
    last_update_date: any;
    auditor: string;
    userId: string;
}

const COLLECTION_NAME = 'ai_assessment';

export const saveAIAssessment = async (assessment: Omit<AIAssessment, 'create_date' | 'last_update_date'>) => {
    const docRef = doc(db, COLLECTION_NAME, assessment.mlsid);
    const existingDoc = await getDoc(docRef);

    const now = Timestamp.now();

    if (existingDoc.exists()) {
        await setDoc(docRef, {
            ...assessment,
            last_update_date: now
        }, { merge: true });
    } else {
        await setDoc(docRef, {
            ...assessment,
            create_date: now,
            last_update_date: now
        });
    }
    return true;
};

export const getAIAssessments = async () => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('last_update_date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ mlsid: doc.id, ...doc.data() } as AIAssessment));
};


export const getAIAssessmentForProperty = async (mlsid: string) => {
    const docRef = doc(db, COLLECTION_NAME, mlsid);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
        return snapshot.data() as AIAssessment;
    }
    return null;
};

// ─── Orientation Assessment ───────────────────────────────────────────────────

export type OrientationAssessmentValue = 'radar_map' | 'satellite' | 'none' | 'all';

/**
 * Saves only the orientation_assessment field to ai_assessment/{zpid}.
 * Uses merge:true so it never overwrites any other field.
 * Creates the document if it doesn't already exist.
 * Accepts an array of values — multiple assessments can be stored.
 */
export const saveOrientationAssessment = async (
    zpid: string,
    value: OrientationAssessmentValue[]
): Promise<void> => {
    if (!db) throw new Error('DB not initialized');
    const docRef = doc(db, COLLECTION_NAME, zpid);
    await setDoc(docRef, {
        orientation_assessment: value,
        orientation_assessed_at: Timestamp.now(),  // dedicated timestamp — only set by human assessment
        last_update_date: Timestamp.now(),
    }, { merge: true });
};
