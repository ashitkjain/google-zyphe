/**
 * Deep Research Service
 *
 * Calls the Gemini Deep Research Agent (Interactions API) via the
 * Vite proxy (/api_proxy) to avoid CORS issues from browser-side calls.
 *
 * Flow:
 *  1. POST /api_proxy/v1beta/interactions  → starts background research
 *  2. Poll GET /api_proxy/v1beta/interactions/{id} until status=completed
 *
 * The Vite dev server proxy rewrites /api_proxy/* to
 * https://generativelanguage.googleapis.com/* (see vite.config.ts).
 */

import { APP_CONFIG } from '../config';
import { logLLMCall, updateLLMCall } from './firebase/llm_logs';

const DEEP_RESEARCH_AGENT = 'deep-research-pro-preview-12-2025';
const PROXY_BASE = '/api_proxy/v1beta';
const POLL_INTERVAL_MS = 8000; // 8 seconds between polls

export interface DeepResearchProgress {
    phase: 'starting' | 'thinking' | 'writing' | 'polling' | 'complete' | 'failed';
    thought?: string;
    contentSoFar: string;
    interactionId?: string;
    pollCount?: number;
    error?: string;
}

/**
 * Run Deep Research via the REST Interactions API (proxied through Vite).
 */
export const runDeepResearch = async (
    prompt: string,
    onProgress: (progress: DeepResearchProgress) => void,
    options: {
        userId?: string;
        cityStateKey?: string;
    } = {}
): Promise<string> => {
    const { userId = 'unknown', cityStateKey = 'unknown' } = options;
    const apiKey = APP_CONFIG.gemini.key;
    if (!apiKey) throw new Error('Gemini API key missing');

    onProgress({
        phase: 'starting',
        contentSoFar: '',
        thought: 'Initializing Deep Research agent...',
    });

    // Log the call
    let logId: string | null = null;
    try {
        logId = await logLLMCall({
            user_id: userId,
            zpid: 'city-level',
            address: cityStateKey,
            prompt_filename: 'context-graph-taxonomy',
            llm_name: DEEP_RESEARCH_AGENT,
            raw_payload: { prompt_length: prompt.length, cityStateKey },
            raw_response: null,
            status: 'pending',
        });
    } catch (e) {
        console.warn('[DeepResearch] Failed to log start:', e);
    }

    try {
        // ── Step 1: Start the research task ──────────────────────
        onProgress({
            phase: 'starting',
            contentSoFar: '',
            thought: 'Sending request to Deep Research agent...',
        });

        const createRes = await fetch(`${PROXY_BASE}/interactions?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: prompt,
                agent: DEEP_RESEARCH_AGENT,
                background: true,
            }),
        });

        if (!createRes.ok) {
            const errBody = await createRes.text();
            throw new Error(`Failed to start research (${createRes.status}): ${errBody}`);
        }

        const createData = await createRes.json();
        const interactionId = createData.id || createData.name?.split('/').pop();

        if (!interactionId) {
            throw new Error('No interaction ID returned from API');
        }

        onProgress({
            phase: 'thinking',
            contentSoFar: '',
            interactionId,
            thought: 'Research started. Agent is planning and searching...',
        });

        console.log('[DeepResearch] Interaction started:', interactionId);

        // ── Step 2: Poll until complete ──────────────────────────
        let contentSoFar = '';
        let pollCount = 0;
        const MAX_POLLS = 120; // 120 × 8s = 16 minutes max

        while (pollCount < MAX_POLLS) {
            await sleep(POLL_INTERVAL_MS);
            pollCount++;

            const pollRes = await fetch(
                `${PROXY_BASE}/interactions/${interactionId}?key=${apiKey}`,
                { method: 'GET' }
            );

            if (!pollRes.ok) {
                const errBody = await pollRes.text();
                console.warn(`[DeepResearch] Poll ${pollCount} error:`, errBody);
                // Don't fail immediately on a single poll error — network glitch
                if (pollCount > 3) {
                    throw new Error(`Polling failed (${pollRes.status}): ${errBody}`);
                }
                continue;
            }

            const pollData = await pollRes.json();
            const status = pollData.status;

            // Extract latest output text
            if (pollData.outputs && pollData.outputs.length > 0) {
                const lastOutput = pollData.outputs[pollData.outputs.length - 1];
                const newContent = lastOutput.text || lastOutput.content || '';
                if (newContent && newContent.length > contentSoFar.length) {
                    contentSoFar = newContent;
                }
            }

            if (status === 'completed') {
                onProgress({
                    phase: 'complete',
                    contentSoFar,
                    interactionId,
                    pollCount,
                });

                if (logId) {
                    await updateLLMCall(logId, {
                        status: 'completed',
                        raw_response: contentSoFar.slice(0, 50000),
                        response_received_at: new Date(),
                    });
                }

                return contentSoFar;
            }

            if (status === 'failed') {
                const errMsg = pollData.error || 'Research failed (no details)';
                throw new Error(errMsg);
            }

            // Still running — update progress
            const phaseLabel = contentSoFar.length > 0 ? 'writing' : 'polling';
            const elapsedMins = ((pollCount * POLL_INTERVAL_MS) / 60000).toFixed(1);

            onProgress({
                phase: phaseLabel,
                contentSoFar,
                interactionId,
                pollCount,
                thought: contentSoFar.length > 0
                    ? `Agent is writing... (${elapsedMins}m elapsed, ${(contentSoFar.length / 1024).toFixed(1)}KB so far)`
                    : `Agent is researching... (${elapsedMins}m elapsed, poll #${pollCount})`,
            });
        }

        throw new Error('Research timed out after 16 minutes');
    } catch (error: any) {
        const errorMsg = error.message || String(error);
        onProgress({
            phase: 'failed',
            contentSoFar: '',
            error: errorMsg,
        });

        if (logId) {
            await updateLLMCall(logId, {
                status: 'failed',
                error: errorMsg,
                response_received_at: new Date(),
            });
        }

        throw error;
    }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
