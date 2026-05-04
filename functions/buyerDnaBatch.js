'use strict';
/**
 * Buyer DNA Batch Processing — Cloud Function
 *
 * Triggered by document writes to buyer_dna_batch_jobs/{jobId}.
 * Compresses property context graph factors into 16 Buyer DNA dimensions using Gemini 2.5 Flash.
 * Tab-independent: continues running even if the triggering browser tab is closed.
 *
 * Prerequisite: context_graph/{zpid} must exist with factors array (run contextGraphBatch first).
 *
 * Client writes:
 *   { zpids: string[], status: 'queued', total: N, done: 0, failed: 0, userId: string }
 *
 * CF updates:
 *   { status: 'running' | 'completed', done: N, failed: N, cached: N, skipped: N, ... }
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const UsageLogger = require('./shared/usageLogger');

const BATCH_CONCURRENCY = 5;
const MODEL_NAME = 'gemini-2.5-flash';
const MAX_EXECUTION_TIME_MS = 480000; // 8 minutes
const TIMEOUT_SAFETY_MARGIN_MS = 60000; // 1 minute safety margin
const DNA_CACHE_TTL_DAYS = 7;
const DNA_VERSION = 1;

// ─── Core: process a single property ─────────────────────────────────────────

async function _processOneBuyerDna(zpid, db, geminiKey, logger = null) {
    // 1. Read context_graph/{zpid}
    const cgRef = db.collection('context_graph').doc(zpid);
    const cgSnap = await cgRef.get();

    // 2. Skip if no context graph or empty factors
    if (!cgSnap.exists) {
        console.log(`[BuyerDNA Batch] ${zpid}: skipped — no context graph document`);
        return { status: 'skipped', message: 'No context graph' };
    }

    const cgData = cgSnap.data();
    const factors = cgData.factors || [];

    if (factors.length === 0) {
        console.log(`[BuyerDNA Batch] ${zpid}: skipped — context graph has no factors`);
        return { status: 'skipped', message: 'No context graph' };
    }

    // 3. Cache check: if buyer_dna already exists and is recent
    if (cgData.buyer_dna && cgData.dna_generated_at) {
        const updatedMs = cgData.dna_generated_at.toMillis
            ? cgData.dna_generated_at.toMillis()
            : new Date(cgData.dna_generated_at).getTime();
        const ageDays = (Date.now() - updatedMs) / (1000 * 60 * 60 * 24);
        if (ageDays < DNA_CACHE_TTL_DAYS) {
            console.log(`[BuyerDNA Batch] ${zpid}: cached (${Math.round(ageDays)}d old)`);
            return { status: 'cached' };
        }
    }

    // 4. Build readable factors list
    const readableFactors = factors.slice(0, 80).map(f => {
        const id = f.i || f.id;
        const tags = f.t || f.tags || [];
        const value = f.v || f.value || '';
        return `- Factor ${id}: ${value} [Tags: ${tags.join(', ')}]`;
    }).join('\n');

    // 5. Call Gemini with buyer DNA compression prompt
    const prompt = `You are a real estate expert. Compress these property data points into 16 core "Buyer DNA" dimensions.

Property factors:
${readableFactors}

Return JSON:
{
  "buyer_dna": {
    "lifestyle_fit": { "score": 1-10, "tags": ["outdoor", "urban", etc], "summary": "..." },
    "family_suitability": { "score": 1-10, "tags": [...], "summary": "..." },
    "investment_potential": { "score": 1-10, "tags": [...], "summary": "..." },
    "commute_friendliness": { "score": 1-10, "tags": [...], "summary": "..." },
    "school_quality": { "score": 1-10, "tags": [...], "summary": "..." },
    "walkability": { "score": 1-10, "tags": [...], "summary": "..." },
    "entertainment_access": { "score": 1-10, "tags": [...], "summary": "..." },
    "nature_access": { "score": 1-10, "tags": [...], "summary": "..." },
    "luxury_feel": { "score": 1-10, "tags": [...], "summary": "..." },
    "move_in_ready": { "score": 1-10, "tags": [...], "summary": "..." },
    "space_efficiency": { "score": 1-10, "tags": [...], "summary": "..." },
    "privacy": { "score": 1-10, "tags": [...], "summary": "..." },
    "natural_light": { "score": 1-10, "tags": [...], "summary": "..." },
    "outdoor_living": { "score": 1-10, "tags": [...], "summary": "..." },
    "pet_friendliness": { "score": 1-10, "tags": [...], "summary": "..." },
    "entertaining_ability": { "score": 1-10, "tags": [...], "summary": "..." }
  }
}`;

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 8192 },
    });

    if (logger) {
        logger.logLLMCall(MODEL_NAME, result.response.usageMetadata?.promptTokenCount, result.response.usageMetadata?.candidatesTokenCount, zpid, 'buyerDnaBatch.js');
    }

    const text = result.response.text();
    const parsed = JSON.parse(text);

    if (!parsed.buyer_dna) {
        throw new Error(`Gemini returned invalid structure for ${zpid}: missing buyer_dna`);
    }

    // 6. Save to context_graph/{zpid} with merge
    await cgRef.set({
        buyer_dna: parsed.buyer_dna,
        dna_generated_at: admin.firestore.FieldValue.serverTimestamp(),
        dna_version: DNA_VERSION,
    }, { merge: true });

    console.log(`[BuyerDNA Batch] ${zpid}: buyer DNA saved (${Object.keys(parsed.buyer_dna).length} dimensions)`);
    return { status: 'success', dimensionCount: Object.keys(parsed.buyer_dna).length };
}

// ─── Exported Cloud Function ──────────────────────────────────────────────────

exports.runBuyerDnaBatchOnWrite = functions
    .runWith({ timeoutSeconds: 540, memory: '512MB' })
    .firestore
    .document('buyer_dna_batch_jobs/{jobId}')
    .onWrite(async (change, context) => {
        try {
            const after = change.after.exists ? change.after.data() : null;
            if (!after || after.status !== 'queued') return null;

            const startTime = Date.now();
            const db = admin.firestore();
            const jobRef = change.after.ref;
            const zpids = after.zpids || [];

            if (!Array.isArray(zpids) || zpids.length === 0) {
                await jobRef.update({
                    status: 'completed', done: 0, failed: 0, cached: 0, skipped: 0,
                    completedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                return null;
            }

            // Read API keys from app_config/api_keys
            const keysSnap = await db.collection('app_config').doc('api_keys').get();
            const keys = keysSnap.exists ? keysSnap.data() : {};
            const geminiKey = keys.gemini_key || process.env.GEMINI_API_KEY || '';

            if (!geminiKey) {
                console.error('[BuyerDNA Batch] Missing Gemini API key');
                await jobRef.update({ status: 'failed', error: 'Missing Gemini API key' });
                return null;
            }

            const logger = new UsageLogger(jobRef);
            await logger.initialize();

            // Mark as running
            await jobRef.update({ status: 'running', startedAt: admin.firestore.FieldValue.serverTimestamp() });

            let done = 0, failed = 0, cached = 0, skipped = 0;

            // Process in waves of BATCH_CONCURRENCY
            for (let i = 0; i < zpids.length; i += BATCH_CONCURRENCY) {
                // Check for cancellation before each wave
                const freshJob = await jobRef.get();
                if (freshJob.exists && freshJob.data()?.status === 'cancelled') {
                    console.log(`[BuyerDNA Batch] ${context.params.jobId} cancelled. Terminating.`);
                    return null;
                }

                const wave = zpids.slice(i, i + BATCH_CONCURRENCY);

                await Promise.allSettled(
                    wave.map(async (zpid) => {
                        // Check for cancellation before each property
                        const freshJob = await jobRef.get();
                        if (freshJob.exists && freshJob.data()?.status === 'cancelled') {
                            return;
                        }

                        try {
                            const result = await _processOneBuyerDna(zpid, db, geminiKey, logger);
                            if (result.status === 'cached') cached++;
                            else if (result.status === 'skipped') skipped++;
                            else done++;

                            const updateData = {
                                done, failed, cached, skipped,
                                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            };
                            updateData[`results.${zpid}`] = result;
                            await jobRef.update(updateData);
                        } catch (e) {
                            console.error(`[BuyerDNA Batch] Error processing ${zpid}:`, e.message);
                            failed++;
                            const failResult = { status: 'failed', error: e.message };
                            const updateData = {
                                done, failed, cached, skipped,
                                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            };
                            updateData[`results.${zpid}`] = failResult;
                            await jobRef.update(updateData);
                        }

                        await logger.flush();
                    }),
                );

                // Timeout safety check
                const elapsed = Date.now() - startTime;
                if (elapsed > (MAX_EXECUTION_TIME_MS - TIMEOUT_SAFETY_MARGIN_MS)) {
                    console.warn(`[BuyerDNA Batch] Approaching timeout (${Math.round(elapsed / 1000)}s). Exiting to allow resumption.`);
                    await jobRef.update({
                        status: 'queued',
                        done, failed, cached, skipped,
                        lastWaveAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    return null;
                }
            }

            await jobRef.update({
                status: 'completed', done, failed, cached, skipped,
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`[BuyerDNA Batch] Job ${context.params.jobId} complete — ${done} ok, ${cached} cached, ${skipped} skipped, ${failed} failed / ${zpids.length} total`);
            return null;
        } catch (e) {
            console.error(`[BuyerDNA Batch] Job ${context.params.jobId} crashed:`, e);
            await change.after.ref.update({
                status: 'failed',
                error: e.message || 'Unknown internal crash',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return null;
        }
    });
