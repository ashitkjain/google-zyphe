'use strict';
/**
 * Asset Secure Batch — Cloud Function
 *
 * Triggered by asset_secure_batch_jobs/{jobId} CREATE.
 * Secures map assets (street view, radar maps) only — photo download is not performed.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
    admin.initializeApp();
}

exports.runSecureImagesBatchOnCreate = functions
    .runWith({ timeoutSeconds: 540, memory: '1GB' })
    .firestore
    .document('asset_secure_batch_jobs/{jobId}')
    .onCreate(async (snap, context) => {
        const jobData = snap.data();
        if (!jobData || jobData.status !== 'queued') return null;

        const { zpids } = jobData;
        if (!zpids || zpids.length === 0) {
            await snap.ref.update({ status: 'completed', completedAt: admin.firestore.FieldValue.serverTimestamp() });
            return null;
        }

        await snap.ref.update({
            status: 'running',
            startedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const startTime = Date.now();
        const DEADLINE_MS = (540 - 45) * 1000;

        let results = {};
        let done = 0;
        let failed = 0;

        for (let i = 0; i < zpids.length; i++) {
            const zpid = zpids[i];

            if (Date.now() - startTime > DEADLINE_MS) {
                const remainingZpids = zpids.slice(i);
                await snap.ref.update({
                    status: 'timeout',
                    done, failed, workingCount: 0,
                    remainingZpids,
                    results,
                    timedOutAt: admin.firestore.FieldValue.serverTimestamp()
                });
                return null;
            }

            const freshJob = await snap.ref.get();
            if (freshJob.exists && freshJob.data()?.status === 'cancelled') {
                console.log(`[Asset Batch] ${context.params.jobId} cancelled. Terminating.`);
                return null;
            }

            try {
                console.log(`[Asset Batch] Checking map assets for ${zpid}...`);
                await snap.ref.update({ workingCount: 1 });

                // No-op per property — map assets are secured inline during property ingestion.
                // This batch exists to update job status for the UI.
                results[zpid] = { status: 'success' };
                done++;
            } catch (e) {
                console.error(`[Asset Batch Error] ${zpid}:`, e.message);
                results[zpid] = { status: 'failed', message: e.message };
                failed++;
            }

            await snap.ref.update({ done, failed, results, workingCount: 0, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }

        await snap.ref.update({
            status: 'completed',
            done,
            failed,
            workingCount: 0,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return null;
    });
