'use strict';
/**
 * Property Data Batch Processing — Cloud Function
 *
 * Triggered by document creation in property_data_batch_jobs/{jobId}.
 * Fetches property specs (RapidAPI), scores, and Gemini tax fallbacks server-side
 * with 20-way concurrency.
 *
 * Client writes:
 *   { zpids: string[], status: 'queued', total: N, done: 0, failed: 0, userId: string, batchId: string }
 *
 * CF updates:
 *   { status: 'running' | 'completed', done: N, failed: N, results: { [zpid]: { status, message } } }
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

const BATCH_CONCURRENCY = 20;

const { _enrichProperty } = require('./shared/propertyUtils');

/**
 * Core: process one property
 */
async function _processOneProperty(zpid, db, keys) {
    return await _enrichProperty(zpid, db, keys);
}

// ─── Exported Function ───────────────────────────────────────────────────────

exports.runPropertyDataBatchOnCreate = functions.firestore
    .document('property_data_batch_jobs/{jobId}')
    .onCreate(async (snap, context) => {
        const jobData = snap.data();
        if (jobData.status !== 'queued') return null;

        const zpids = jobData.zpids || [];
        if (zpids.length === 0) {
            return snap.ref.update({ status: 'completed', completedAt: admin.firestore.FieldValue.serverTimestamp() });
        }

        await snap.ref.update({ status: 'running', startedAt: admin.firestore.FieldValue.serverTimestamp() });

        const db = admin.firestore();
        const keysSnap = await db.collection('app_config').doc('api_keys').get();
        const keys = keysSnap.exists ? keysSnap.data() : {};
        
        const apiKeys = {
            rapidapi_key: keys.rapidapi_key || process.env.RAPIDAPI_KEY,
            rapidapi_host: keys.rapidapi_host || 'us-housing-market-data1.p.rapidapi.com',
            radar_key: keys.radar_key || process.env.RADAR_KEY,
            gemini_key: keys.gemini_key || process.env.GEMINI_API_KEY,
            maps_key: keys.google_maps_key || keys.maps_key || process.env.MAPS_API_KEY,
            howloud_key: keys.howloud_key || process.env.HOWLOUD_KEY
        };

        let done = 0, failed = 0;
        const results = {};

        for (let i = 0; i < zpids.length; i += BATCH_CONCURRENCY) {
            const wave = zpids.slice(i, i + BATCH_CONCURRENCY);
            
            await Promise.allSettled(
                wave.map(async (zpid, index) => {
                    try {
                        // Stagger starts by 5s for RapidAPI safety
                        if (index > 0) await new Promise(resolve => setTimeout(resolve, 5000));
                        
                        const res = await _processOneProperty(zpid, db, apiKeys);
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
            await snap.ref.update({ 
                done, 
                failed, 
                results, 
                updatedAt: admin.firestore.FieldValue.serverTimestamp() 
            });
        }

        await snap.ref.update({
            status: 'completed',
            done,
            failed,
            results,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return null;
    });
