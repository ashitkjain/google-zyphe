'use strict';
/**
 * Property Data Batch Processing — Cloud Function
 *
 * Triggered by document creation in property_data_batch_jobs/{jobId}.
 * Fetches property specs (RapidAPI), scores, and Gemini tax fallbacks server-side
 * with 20-way concurrency.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const UsageLogger = require('./shared/usageLogger');

const BATCH_CONCURRENCY = 2;

const { _enrichProperty } = require('./shared/propertyUtils');

/**
 * Core: process one property
 */
async function _processOneProperty(zpid, db, keys, logger = null) {
    if (logger) logger.logTask('property_enrichment');
    return await _enrichProperty(zpid, db, keys, logger);
}

// ─── Exported Function ───────────────────────────────────────────────────────

exports.runPropertyDataBatchOnWrite = functions.runWith({ timeoutSeconds: 540, memory: '1GB' }).firestore
    .document('property_data_batch_jobs/{jobId}')
    .onWrite(async (change, context) => {
        const after = change.after.exists ? change.after.data() : null;
        if (!after || after.status !== 'queued') return null;

        const startTime = Date.now();
        const TIMEOUT_SAFETY_MARGIN_MS = 60000;
        const MAX_EXECUTION_TIME_MS = 540000;

        const jobData = after;
        if (jobData.status !== 'queued') return null;

        const zpids = jobData.zpids || [];
        if (zpids.length === 0) {
            return change.after.ref.update({ status: 'completed', completedAt: admin.firestore.FieldValue.serverTimestamp() });
        }

        await change.after.ref.update({ status: 'running', startedAt: admin.firestore.FieldValue.serverTimestamp() });

        const db = admin.firestore();
        const keysSnap = await db.collection('app_config').doc('api_keys').get();
        const keys = keysSnap.exists ? keysSnap.data() : {};
        const logger = new UsageLogger(change.after.ref);
        await logger.initialize();
        
        const apiKeys = {
            rapidapi_key: keys.rapidapi_key || process.env.RAPIDAPI_KEY,
            rapidapi_host: keys.rapidapi_host || 'us-housing-market-data1.p.rapidapi.com',
            radar_key: keys.radar_key || process.env.RADAR_KEY,
            gemini_key: keys.gemini_key || process.env.GEMINI_API_KEY,
            google_maps_key: keys.google_maps_key || process.env.MAPS_API_KEY,
            howloud_key: keys.howloud_key || process.env.HOWLOUD_KEY
        };

        let done = jobData.done || 0;
        let failed = jobData.failed || 0;
        const results = jobData.results || {};

        for (let i = 0; i < zpids.length; i += BATCH_CONCURRENCY) {
            // Check for cancellation before each wave
            const freshJob = await change.after.ref.get();
            if (freshJob.exists && freshJob.data()?.status === 'cancelled') {
                console.log(`[Property Batch] ${context.params.jobId} cancelled. Terminating.`);
                return null;
            }
            const wave = zpids.slice(i, i + BATCH_CONCURRENCY);
            
            // Skip ZPIDs already in results
            const workChunk = wave.filter(zpid => !results[zpid]);
            if (workChunk.length === 0) continue;

            await Promise.allSettled(
                workChunk.map(async (zpid, index) => {
                    // Check for cancellation before processing each property
                    const freshJob = await change.after.ref.get();
                    if (freshJob.exists && freshJob.data()?.status === 'cancelled') {
                        return; 
                    }

                    try {
                        if (index > 0) await new Promise(resolve => setTimeout(resolve, index * 1000));
                        
                        const res = await _processOneProperty(zpid, db, apiKeys, logger);
                        done++;
                        results[zpid] = { status: 'success', message: `Saved: ${res.address}` };
                    } catch (e) {
                        console.error(`[PropertyBatch] ✗ ${zpid}:`, e.message);
                        failed++;
                        results[zpid] = { status: 'error', message: e.message };
                    }
                })
            );

            // Update progress after each wave
            await change.after.ref.update({ 
                done, 
                failed, 
                results, 
                updatedAt: admin.firestore.FieldValue.serverTimestamp() 
            });

            await logger.flush();

            // ─── TIMEOUT SAFETY CHECK ───
            const elapsed = Date.now() - startTime;
            if (elapsed > (MAX_EXECUTION_TIME_MS - TIMEOUT_SAFETY_MARGIN_MS)) {
                console.warn(`[Property Batch] Approaching timeout (${Math.round(elapsed / 1000)}s). Exiting to allow resumption.`);
                await change.after.ref.update({
                    status: 'queued',
                    lastWaveAt: admin.firestore.FieldValue.serverTimestamp()
                });
                return null;
            }
        }

        await change.after.ref.update({
            status: 'completed',
            done,
            failed,
            results,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await logger.flush();
        return null;
    });
