import { logLLMCall, updateLLMCall } from "./firebase/llm_logs";

export interface PythonResearchOptions {
    userId?: string;
    zpid?: string;
    address?: string;
    promptFilename?: string;
}

/**
 * Briges to the local Python research service which has better SDK support for
 * experimental Gemini agents (Deep Research).
 */
export const executePythonDeepResearch = async <T>(
    query: string,
    schema: any,
    options: PythonResearchOptions = {}
): Promise<{ data: T }> => {
    const { userId = 'unknown', zpid, address, promptFilename = 'python-deep-research' } = options;
    const schemaStr = JSON.stringify(schema);

    // Create initial log entry BEFORE the fetch — truncate payload to prevent Firestore size issues
    let logId: string | null = null;
    const requestSentAt = new Date();
    try {
        console.log(`[executePythonDeepResearch] Creating LLM call event BEFORE fetch...`);
        logId = await logLLMCall({
            user_id: userId,
            zpid: zpid || 'city-level',
            address: address || 'Global',
            prompt_filename: promptFilename,
            llm_name: 'deep-research-pro-preview',
            raw_payload: {
                query: query.substring(0, 2000) + (query.length > 2000 ? '... [TRUNCATED]' : ''),
                schema_hint: '[SCHEMA_OMITTED_FOR_SIZE]'
            },
            raw_response: null,
            status: 'pending',
            request_sent_at: requestSentAt
        } as any);
        console.log(`[executePythonDeepResearch] LLM call event created: ${logId} (status: pending)`);
    } catch (e) {
        console.error("[executePythonDeepResearch] FAILED to create LLM call event:", e);
    }

    // Cloud Run URL set via VITE_DEEP_RESEARCH_URL env var; falls back to localhost for local dev
    const serviceUrl = import.meta.env.VITE_DEEP_RESEARCH_URL || 'http://localhost:5001';

    try {
        console.log(`[executePythonDeepResearch] Sending fetch to ${serviceUrl}/research...`);
        const response = await fetch(`${serviceUrl}/research`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                schema_hint: schemaStr
            })
        });

        if (!response.ok) {
            const err = await response.json();
            const errorMsg = err.error || `Python Research Service Error: ${response.status}`;
            if (logId) {
                await updateLLMCall(logId, {
                    status: 'failed',
                    error: errorMsg,
                    response_received_at: new Date()
                });
            }
            throw new Error(errorMsg);
        }

        const result = await response.json();

        if (logId) {
            console.log(`[executePythonDeepResearch] Updating LLM call event ${logId} → completed`);
            await updateLLMCall(logId, {
                status: 'completed',
                raw_response: JSON.stringify(result.data).substring(0, 5000),
                response_received_at: new Date(),
                usage_metadata: {
                    totalTokenCount: 0,
                    promptTokenCount: 0,
                    candidatesTokenCount: 0
                },
                estimated_cost: 0.10
            });
        }

        return { data: result.data as T };
    } catch (error: any) {
        console.error("[executePythonDeepResearch] Failed:", error);
        if (logId) {
            await updateLLMCall(logId, {
                status: 'failed',
                error: error.message || String(error),
                response_received_at: new Date()
            });
        }
        throw error;
    }
};
