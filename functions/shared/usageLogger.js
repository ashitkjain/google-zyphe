'use strict';

const admin = require('firebase-admin');

/**
 * GEMINI PRICING (Estimated for 1.5/2.0/2.5 Flash)
 * Input: $0.10 per 1M tokens
 * Output: $0.40 per 1M tokens
 */
const GEMINI_INPUT_COST_PER_1M = 0.10;
const GEMINI_OUTPUT_COST_PER_1M = 0.40;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

class UsageLogger {
    constructor(jobRef) {
        this.jobRef = jobRef;
        this.stats = {
            tasks: {},
            gemini: {},
            apis: {}
        };
        this.pendingEvents = [];
    }

    async initialize() {
        if (!this.jobRef) return;
        const snap = await this.jobRef.get();
        if (snap.exists && snap.data().stats) {
            this.stats = snap.data().stats;
        }
    }

    logTask(taskName) {
        this.stats.tasks[taskName] = (this.stats.tasks[taskName] || 0) + 1;
    }

    logLLMCall(model, inputTokens, outputTokens, zpid = null, promptFilename = 'background_job') {
        if (!this.stats.gemini[model]) {
            this.stats.gemini[model] = { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCost: 0 };
        }
        const s = this.stats.gemini[model];
        s.calls += 1;
        s.inputTokens += (inputTokens || 0);
        s.outputTokens += (outputTokens || 0);

        const estimatedCost = ((inputTokens || 0) / 1000000 * GEMINI_INPUT_COST_PER_1M) +
                     ((outputTokens || 0) / 1000000 * GEMINI_OUTPUT_COST_PER_1M);
        s.estimatedCost += estimatedCost;

        this.pendingEvents.push({
            user_id: 'system',
            zpid: zpid || null,
            prompt_filename: promptFilename,
            llm_name: model,
            usage_metadata: {
                promptTokenCount: inputTokens || 0,
                candidatesTokenCount: outputTokens || 0,
                totalTokenCount: (inputTokens || 0) + (outputTokens || 0)
            },
            status: 'completed',
            source: 'cloud_function',
            job_id: this.jobRef?.id || null,
            expireAt: admin.firestore.Timestamp.fromMillis(Date.now() + TWO_DAYS_MS),
            __is_llm: true // Internal flag to route to llm_call_events in flush()
        });
    }

    logAPICall(provider, endpoint, zpid = null) {
        const key = `${provider}:${endpoint}`;
        this.stats.apis[key] = (this.stats.apis[key] || 0) + 1;

        this.pendingEvents.push({
            user_id: 'system',
            zpid: zpid || null,
            api_name: provider,
            endpoint,
            params: {},
            status: 'completed',
            source: 'cloud_function',
            job_id: this.jobRef?.id || null,
            expireAt: admin.firestore.Timestamp.fromMillis(Date.now() + TWO_DAYS_MS),
        });
    }

    /**
     * Writes aggregate stats to the job doc and batch-writes individual events
     * to either llm_call_events or api_call_events.
     */
    async flush() {
        if (!this.jobRef) return;
        try {
            await this.jobRef.update({ stats: this.stats });
        } catch (e) {
            console.error('[UsageLogger] Stats flush failed:', e.message);
        }

        if (this.pendingEvents.length === 0) return;
        try {
            const db = admin.firestore();
            const totalEvents = this.pendingEvents.length;
            const CHUNK_SIZE = 400;
            for (let i = 0; i < this.pendingEvents.length; i += CHUNK_SIZE) {
                const chunk = this.pendingEvents.slice(i, i + CHUNK_SIZE);
                const batch = db.batch();
                for (const event of chunk) {
                    const isLlm = event.__is_llm;
                    delete event.__is_llm;
                    
                    const collectionName = isLlm ? 'llm_call_events' : 'api_call_events';
                    const docRef = db.collection(collectionName).doc();
                    
                    batch.set(docRef, {
                        ...event,
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
                await batch.commit();
            }
            this.pendingEvents = [];
            console.log(`[UsageLogger] Flushed ${totalEvents} events to audit collections`);
        } catch (e) {
            console.error('[UsageLogger] Event flush failed:', e.message);
        }
    }
}

module.exports = UsageLogger;
