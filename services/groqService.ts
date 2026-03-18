/**
 * Groq LPU Cloud Service
 * Ultra-fast inference for structured extraction tasks.
 * Uses Groq's REST API with Llama 3.3 70B for buyer story extraction.
 */

import { APP_CONFIG } from '../config';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

interface GroqMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface GroqResponse {
    choices: { message: { content: string }; finish_reason: string }[];
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number; queue_time?: number; prompt_time?: number; completion_time?: number; total_time?: number };
    model: string;
}

export interface GroqExtractionResult<T> {
    data: T | null;
    model: string;
    usage: GroqResponse['usage'] | null;
    latencyMs: number;
}

/**
 * Execute a Groq inference request with JSON response parsing.
 * Uses `response_format: { type: "json_object" }` for reliable JSON output.
 */
export const executeGroqRequest = async <T>(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
): Promise<GroqExtractionResult<T>> => {
    const start = performance.now();

    const messages: GroqMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    try {
        const res = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${APP_CONFIG.groq.key}`
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages,
                temperature: options?.temperature ?? 0.1,
                max_tokens: options?.maxTokens ?? 1024,
                response_format: { type: 'json_object' }
            })
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Groq API error ${res.status}: ${errorText}`);
        }

        const json: GroqResponse = await res.json();
        const latencyMs = Math.round(performance.now() - start);
        const content = json.choices?.[0]?.message?.content || '';

        let data: T | null = null;
        try {
            data = JSON.parse(content) as T;
        } catch (parseErr) {
            console.warn('[Groq] JSON parse failed:', parseErr, content);
        }

        console.log(`[Groq] ${GROQ_MODEL} — ${latencyMs}ms (${json.usage?.prompt_tokens || 0} in / ${json.usage?.completion_tokens || 0} out)`);

        return {
            data,
            model: json.model || GROQ_MODEL,
            usage: json.usage || null,
            latencyMs
        };
    } catch (err) {
        const latencyMs = Math.round(performance.now() - start);
        console.error('[Groq] Request failed:', err);
        return { data: null, model: GROQ_MODEL, usage: null, latencyMs };
    }
};
