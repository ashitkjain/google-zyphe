
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
    create_date: any;
    last_update_date: any;
    tester: string;
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
