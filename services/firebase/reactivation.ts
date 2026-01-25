import { db } from './config';
import {
    collection,
    addDoc,
    serverTimestamp,
    doc,
    setDoc,
    query,
    where,
    getDocs,
    orderBy,
    limit
} from 'firebase/firestore';
import {
    LeadReactivationResult,
    ReactivationAnalysisSummary,
    MarketContextRecord,
    LeadPlanRecord
} from '../../types/ai';

export const saveReactivationAnalysis = async (
    userId: string,
    clientId: string,
    leadsDocumentId: string,
    llmCallEventId: string,
    analysisResult: LeadReactivationResult
) => {
    try {
        // 1. Create the Summary Record
        const summaryRef = doc(collection(db, 'reactivation_analysis_summary'));
        const summaryData: Omit<ReactivationAnalysisSummary, 'id'> = {
            summary: analysisResult.summary,
            global_settings: analysisResult.global_settings,
            created_date: serverTimestamp(),
            leads_documents: leadsDocumentId,
            llm_call_events: llmCallEventId,
            userId,
            clientId
        };

        await setDoc(summaryRef, summaryData);
        const summaryId = summaryRef.id;

        // 2. Create Market Context Records
        const marketContextPromises = analysisResult.market_context.map(market => {
            const marketData: MarketContextRecord = {
                ...market,
                reactivation_analysis_summary_id: summaryId,
                userId: userId,
                created_at: serverTimestamp()
            };
            return addDoc(collection(db, 'market_context'), marketData);
        });

        // 3. Create Lead Plan Records
        const leadPlanPromises = analysisResult.lead_plans.map(plan => {
            const planData: LeadPlanRecord = {
                lead_id: plan.lead_id,
                lead_name: plan.lead_name,
                market: plan.market,
                priority_score: plan.priority_score,
                staleness_reason: plan.staleness_reason,
                recommended_channel: plan.recommended_channel,
                tone: plan.tone,
                first_touch: plan.first_touch,
                sequence: plan.sequence,
                reactivation_analysis_summary_id: summaryId,
                userId: userId
            };
            return addDoc(collection(db, 'lead_plans'), planData);
        });

        await Promise.all([...marketContextPromises, ...leadPlanPromises]);

        return summaryId;
    } catch (error) {
        console.error('Error saving reactivation analysis:', error);
        throw error;
    }
};

export const getExistingReactivationAnalysis = async (leadsDocumentId: string, userId: string): Promise<LeadReactivationResult | null> => {
    try {
        // 1. Find the summary for this document
        const q = query(
            collection(db, 'reactivation_analysis_summary'),
            where('leads_documents', '==', leadsDocumentId),
            where('userId', '==', userId),
            orderBy('created_date', 'desc'),
            limit(1)
        );
        const summarySnap = await getDocs(q);

        if (summarySnap.empty) return null;

        const summaryDoc = summarySnap.docs[0];
        const summaryId = summaryDoc.id;
        const summaryData = summaryDoc.data() as ReactivationAnalysisSummary;

        // 2. Fetch Market Contexts
        const marketQ = query(
            collection(db, 'market_context'),
            where('reactivation_analysis_summary_id', '==', summaryId),
            where('userId', '==', userId),
            orderBy('created_at', 'asc')
        );
        const marketSnap = await getDocs(marketQ);
        const market_context = marketSnap.docs.map(doc => {
            const data = doc.data() as MarketContextRecord;
            return {
                market_name: data.market_name,
                rates_trend: data.rates_trend,
                inventory_trend: data.inventory_trend,
                avg_days_on_market: data.avg_days_on_market,
                buyer_leverage_notes: data.buyer_leverage_notes,
                confidence: data.confidence
            };
        });

        // 3. Fetch Lead Plans
        const plansQ = query(
            collection(db, 'lead_plans'),
            where('reactivation_analysis_summary_id', '==', summaryId),
            where('userId', '==', userId)
        );
        const plansSnap = await getDocs(plansQ);
        const lead_plans = plansSnap.docs.map(doc => {
            const data = doc.data() as LeadPlanRecord;
            return {
                id: doc.id,
                lead_id: data.lead_id,
                lead_name: data.lead_name || 'Unknown Lead',
                market: data.market,
                priority_score: data.priority_score,
                staleness_reason: data.staleness_reason,
                recommended_channel: data.recommended_channel,
                tone: data.tone,
                first_touch: data.first_touch,
                sequence: data.sequence,
                reactivation_status: data.reactivation_status || 'suggested'
            };
        });

        return {
            summary: summaryData.summary,
            global_settings: summaryData.global_settings,
            market_context,
            lead_plans
        } as LeadReactivationResult;

    } catch (error) {
        console.error('Error fetching existing reactivation analysis:', error);
        return null;
    }
};
export const getUserReactivationSummaries = async (userId: string): Promise<ReactivationAnalysisSummary[]> => {
    try {
        const q = query(
            collection(db, 'reactivation_analysis_summary'),
            where('userId', '==', userId)
            // Removed orderBy to avoid index requirement during initial setup
        );
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReactivationAnalysisSummary));
    } catch (error) {
        console.error('Error fetching user reactivation summaries:', error);
        return [];
    }
};

export const getAllUserLeadPlans = async (userId: string): Promise<LeadPlanRecord[]> => {
    try {
        const q = query(
            collection(db, 'lead_plans'),
            where('userId', '==', userId)
            // Removed orderBy to avoid index requirement
        );
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeadPlanRecord));
    } catch (error) {
        console.error('Error fetching all user lead plans:', error);
        return [];
    }
};

export const getAllUserMarketContexts = async (userId: string): Promise<MarketContextRecord[]> => {
    try {
        const q = query(
            collection(db, 'market_context'),
            where('userId', '==', userId)
            // Removed orderBy
        );
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MarketContextRecord));
    } catch (error) {
        console.error('Error fetching all user market contexts:', error);
        return [];
    }
};

export const updateLeadPlanStatus = async (
    planId: string,
    status: 'suggested' | 'pursuing' | 'responded' | 'archived' | 'not_pursuing'
) => {
    try {
        const planRef = doc(db, 'lead_plans', planId);
        await setDoc(planRef, { reactivation_status: status }, { merge: true });
        return true;
    } catch (error) {
        console.error('Error updating lead plan status:', error);
        return false;
    }
};
