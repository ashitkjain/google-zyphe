'use strict';
/**
 * Context Graph Batch Processing — Cloud Function
 *
 * Triggered by document writes to context_graph_batch_jobs/{jobId}.
 * Extracts structured property context graph factors using Gemini 2.5 Flash.
 * Tab-independent: continues running even if the triggering browser tab is closed.
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

const BATCH_CONCURRENCY = 3;
const MODEL_NAME = 'gemini-2.5-flash';
const MAX_EXECUTION_TIME_MS = 480000; // 8 minutes
const TIMEOUT_SAFETY_MARGIN_MS = 60000; // 1 minute safety margin
const CACHE_TTL_DAYS = 14;

// ─── Context builder ──────────────────────────────────────────────────────────

function buildContextForGemini(prop, visual, investment) {
    return {
        address: prop.address,
        city: prop.city,
        state: prop.state,
        homeType: prop.homeType,
        bedrooms: prop.bedrooms,
        bathrooms: prop.bathrooms,
        livingAreaSqFt: prop.livingAreaValue,
        yearBuilt: prop.yearBuilt,
        price: prop.price,
        lotSizeSqFt: prop.lotAreaValue,
        description: prop.description,
        schools: prop.schools,
        resoFacts: prop.resoFacts,
        neighborhood: prop.neighborhood_identity,
        coordinates: prop.coordinates,
        // From visual analysis
        exteriorCondition: visual?.exterior_and_neighborhood?.condition_assessment,
        streetCharacter: visual?.exterior_and_neighborhood?.street_character,
        interiorHighlights: visual?.interior_analysis?.highlights,
        // From investment
        investmentSummary: investment?.executive_summary || investment?.summary,
    };
}

// ─── Core: process a single property ─────────────────────────────────────────

async function _processOneContextGraph(zpid, db, geminiKey, logger = null) {
    // 1. Read property data and analysis subcollections in parallel
    const propRef = db.collection('properties').doc(zpid);
    const [propSnap, visualSnap, investmentSnap] = await Promise.all([
        propRef.get(),
        propRef.collection('analysis').doc('visual').get(),
        propRef.collection('analysis').doc('investment').get(),
    ]);

    if (!propSnap.exists) {
        throw new Error(`Property ${zpid} not found`);
    }

    const prop = propSnap.data();
    const visual = visualSnap.exists ? visualSnap.data() : null;
    const investment = investmentSnap.exists ? investmentSnap.data() : null;

    // 2. Skip check: if context_graph/{zpid} already exists with recent data
    const cgRef = db.collection('context_graph').doc(zpid);
    const cgSnap = await cgRef.get();
    if (cgSnap.exists) {
        const cgData = cgSnap.data();
        const factors = cgData.factors || [];
        const lastUpdated = cgData.lastUpdated;
        if (factors.length > 0 && lastUpdated) {
            const updatedMs = lastUpdated.toMillis ? lastUpdated.toMillis() : new Date(lastUpdated).getTime();
            const ageDays = (Date.now() - updatedMs) / (1000 * 60 * 60 * 24);
            if (ageDays < CACHE_TTL_DAYS) {
                console.log(`[ContextGraph Batch] ${zpid}: cached (${factors.length} factors, ${Math.round(ageDays)}d old)`);
                return { status: 'cached', factorCount: factors.length };
            }
        }
    }

    // 3. Build prompt context
    const context = buildContextForGemini(prop, visual, investment);

    // 4. Call Gemini 2.5 Flash
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `You are a real estate data analyst. Extract structured factors for property context graph.
Property data: ${JSON.stringify(context, null, 2)}

Return JSON with this structure:
{
  "factors": [{ "id": number, "value": string, "tags": string[] }],
  "summary": "2-3 sentence property summary",
  "keyMetrics": { "pricePerSqFt": number|null, "walkScore": number|null, "schoolRating": number|null }
}

Extract as many of these factor categories as you can determine from the data:
location, transportation, schools, lifestyle, investment, environmental, structural, aesthetic, neighborhood, demographics.
Each factor should have an id (1-111), a value string, and relevant tags.
Return 40-80 factors minimum.`;

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 16384 },
    });

    if (logger) {
        logger.logLLMCall(MODEL_NAME, result.response.usageMetadata?.promptTokenCount, result.response.usageMetadata?.candidatesTokenCount, zpid, 'contextGraphBatch.js');
    }

    const text = result.response.text();
    const parsed = JSON.parse(text);

    if (!parsed.factors || !Array.isArray(parsed.factors)) {
        throw new Error(`Gemini returned invalid structure for ${zpid}: missing factors array`);
    }

    // 5. Save to context_graph/{zpid} and properties/{zpid}/analysis/context_graph
    const saveData = {
        factors: parsed.factors,
        summary: parsed.summary || '',
        keyMetrics: parsed.keyMetrics || {},
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        source: 'pipeline_batch',
    };

    await Promise.all([
        cgRef.set(saveData),
        propRef.collection('analysis').doc('context_graph').set(saveData, { merge: true }),
    ]);

    console.log(`[ContextGraph Batch] ${zpid}: saved ${parsed.factors.length} factors`);
    return { status: 'success', factorCount: parsed.factors.length };
}

// ─── Exported Cloud Function ──────────────────────────────────────────────────

exports.runContextGraphBatchOnWrite = functions
    .runWith({ timeoutSeconds: 540, memory: '1GB' })
    .firestore
    .document('context_graph_batch_jobs/{jobId}')
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
                console.error('[ContextGraph Batch] Missing Gemini API key');
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
                    console.log(`[ContextGraph Batch] ${context.params.jobId} cancelled. Terminating.`);
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
                            const result = await _processOneContextGraph(zpid, db, geminiKey, logger);
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
                            console.error(`[ContextGraph Batch] Error processing ${zpid}:`, e.message);
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
                    console.warn(`[ContextGraph Batch] Approaching timeout (${Math.round(elapsed / 1000)}s). Exiting to allow resumption.`);
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

            console.log(`[ContextGraph Batch] Job ${context.params.jobId} complete — ${done} ok, ${cached} cached, ${skipped} skipped, ${failed} failed / ${zpids.length} total`);
            return null;
        } catch (e) {
            console.error(`[ContextGraph Batch] Job ${context.params.jobId} crashed:`, e);
            await change.after.ref.update({
                status: 'failed',
                error: e.message || 'Unknown internal crash',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return null;
        }
    });
