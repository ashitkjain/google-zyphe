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

    // Create initial log entry for transparent usage tracking
    let logId: string | null = null;
    try {
        logId = await logLLMCall({
            user_id: userId,
            zpid: zpid || 'city-level',
            address: address || 'Global',
            prompt_filename: promptFilename,
            llm_name: 'deep-research-pro-preview',
            raw_payload: { query, schema_hint: schemaStr },
            raw_response: null,
            status: 'pending'
        });
    } catch (e) {
        console.warn("[executePythonDeepResearch] Failed to log start:", e);
    }

    const startTime = Date.now();

    try {
        const response = await fetch('http://localhost:5001/research', {
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
            await updateLLMCall(logId, {
                status: 'completed',
                raw_response: JSON.stringify(result.data),
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
