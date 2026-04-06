
import { collection, query, where, getDocs, Timestamp, orderBy, limit } from "firebase/firestore";
import { db } from "./config";
import { APICallEvent } from "./api_logs";
import { LLMCallEvent } from "../../types/ai";

export interface AuditStats {
    count: number;
    successCount: number;
    failedCount: number;
    avgLatencyMs: number;
    totalTokens?: number;
    costs?: number; // Estimated
}

export interface ServiceAggregation {
    service: string;
    totalCalls: number;
    statusBreakdown: Record<string, number>;
    avgLatency: number;
    geminiDetails?: {
        totalTokens: number;
        models: Record<string, number>;
        promptFiles: Record<string, number>;
    };
    recentCalls: any[];
}

export interface TimeSeriesPoint {
    label: string; // e.g. "Week 12" or "March"
    date: Date;
    apiCalls: number;
    geminiCalls: number;
    tokens: number;
}

/**
 * High-performance log fetcher and aggregator for Admin Audits.
 * Aggregates both API calls (Radar, Google Maps, RapidAPI) and LLM calls (Gemini).
 */
export const fetchAuditAggregations = async (timeframe: 'weekly' | 'monthly' = 'weekly'): Promise<{
    summary: {
        totalApi: number;
        totalGemini: number;
        totalTokens: number;
    };
    services: ServiceAggregation[];
    timeSeries: TimeSeriesPoint[];
}> => {
    if (!db) throw new Error("Firestore not initialized");

    const now = Date.now();
    const lookbackDays = timeframe === 'weekly' ? 7 : 30;
    const startTime = now - (lookbackDays * 24 * 60 * 60 * 1000);
    const startTimestamp = Timestamp.fromMillis(startTime);

    // 1. Fetch Parallel Logs
    const [apiSnap, llmSnap] = await Promise.all([
        getDocs(query(
            collection(db, "api_call_events"),
            where("timestamp", ">=", startTimestamp),
            orderBy("timestamp", "desc"),
            limit(1000) // Safety cap for UI responsiveness
        )),
        getDocs(query(
            collection(db, "llm_call_events"),
            where("timestamp", ">=", startTimestamp),
            orderBy("timestamp", "desc"),
            limit(1000)
        ))
    ]);

    const apiLogs = apiSnap.docs.map(d => ({ id: d.id, ...d.data() } as APICallEvent));
    const llmLogs = llmSnap.docs.map(d => ({ id: d.id, ...d.data() } as any as LLMCallEvent));

    // 2. Aggregate Services
    const serviceMap = new Map<string, ServiceAggregation>();

    // Process APIs
    apiLogs.forEach(log => {
        const key = log.api_name || 'Unknown API';
        if (!serviceMap.has(key)) {
            serviceMap.set(key, {
                service: key,
                totalCalls: 0,
                statusBreakdown: {},
                avgLatency: 0,
                recentCalls: []
            });
        }
        const s = serviceMap.get(key)!;
        s.totalCalls++;
        s.statusBreakdown[log.status] = (s.statusBreakdown[log.status] || 0) + 1;
        s.avgLatency = (s.avgLatency * (s.totalCalls - 1) + (log.response_time_ms || 0)) / s.totalCalls;
        if (s.recentCalls.length < 5) s.recentCalls.push(log);
    });

    // Process Gemini
    let totalTokens = 0;
    const geminiKey = 'Gemini AI';
    if (!serviceMap.has(geminiKey)) {
        serviceMap.set(geminiKey, {
            service: geminiKey,
            totalCalls: 0,
            statusBreakdown: {},
            avgLatency: 0,
            recentCalls: [],
            geminiDetails: {
                totalTokens: 0,
                models: {},
                promptFiles: {}
            }
        });
    }
    const gs = serviceMap.get(geminiKey)!;

    llmLogs.forEach(log => {
        gs.totalCalls++;
        const status = log.status || 'unknown';
        gs.statusBreakdown[status] = (gs.statusBreakdown[status] || 0) + 1;
        
        const tokens = (log as any).total_tokens || 0;
        totalTokens += tokens;
        gs.geminiDetails!.totalTokens += tokens;
        
        const model = log.model || 'Unknown';
        gs.geminiDetails!.models[model] = (gs.geminiDetails!.models[model] || 0) + 1;
        
        const pFile = (log as any).promptFilename || 'Unknown';
        gs.geminiDetails!.promptFiles[pFile] = (gs.geminiDetails!.promptFiles[pFile] || 0) + 1;
        
        if (gs.recentCalls.length < 5) gs.recentCalls.push(log);
    });

    // 3. Time Series (Daily buckets for the selected timeframe)
    const timePoints: Record<string, TimeSeriesPoint> = {};
    const getBucketKey = (date: Date) => {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
    };

    // Initialize buckets
    for (let i = 0; i < lookbackDays; i++) {
        const d = new Date(now - (i * 24 * 60 * 60 * 1000));
        const key = getBucketKey(d);
        timePoints[key] = { label: key, date: d, apiCalls: 0, geminiCalls: 0, tokens: 0 };
    }

    apiLogs.forEach(log => {
        const d = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
        const key = getBucketKey(d);
        if (timePoints[key]) timePoints[key].apiCalls++;
    });

    llmLogs.forEach(log => {
        const d = (log as any).timestamp?.toDate ? (log as any).timestamp.toDate() : new Date((log as any).timestamp);
        const key = getBucketKey(d);
        if (timePoints[key]) {
            timePoints[key].geminiCalls++;
            timePoints[key].tokens += (log as any).total_tokens || 0;
        }
    });

    return {
        summary: {
            totalApi: apiLogs.length,
            totalGemini: llmLogs.length,
            totalTokens
        },
        services: Array.from(serviceMap.values()),
        timeSeries: Object.values(timePoints).sort((a, b) => a.date.getTime() - b.date.getTime())
    };
};
