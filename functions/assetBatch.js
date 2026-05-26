'use strict';
/**
 * Asset Secure Batch — Cloud Function
 *
 * Triggered by asset_secure_batch_jobs/{jobId} CREATE.
 * Secures both property gallery photos (from RealEstateAPI) and map assets (street view, zoom static images).
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { _secureImageToStorage, _healMapImages, _enrichWithRealEstateApi } = require('./shared/propertyUtils');

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

        const db = admin.firestore();
        
        // Fetch API keys from Firestore once
        let keys = {};
        try {
            const keysSnap = await db.collection('app_config').doc('api_keys').get();
            if (keysSnap.exists) {
                keys = keysSnap.data();
            }
        } catch (e) {
            console.warn('[Asset Batch] Failed to load api_keys from Firestore:', e.message);
        }

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
                console.log(`[Asset Batch] Checking/securing assets for ${zpid}...`);
                await snap.ref.update({ workingCount: 1 });

                // 1. Fetch property from Firestore
                const propRef = db.collection('properties').doc(zpid);
                const propSnap = await propRef.get();
                if (!propSnap.exists) {
                    console.log(`[Asset Batch] Skipping ${zpid} because it does not exist in Firestore (filtered out during ingestion).`);
                    results[zpid] = { status: 'skipped', message: 'Property does not exist in Firestore (filtered during ingestion).' };
                    done++;
                    await snap.ref.update({ done, failed, results, workingCount: 0, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                    continue;
                }
                const property = propSnap.data();

                // 2. Fetch images from RealEstateAPI if empty/missing
                let propertyImages = property.images || [];
                if (propertyImages.length === 0 && keys.realestateapi_key) {
                    const formattedAddress = property.address;
                    const mlsId = property.resoFacts?.mlsid || property.mlsid || "";
                    const reapiMls = await _enrichWithRealEstateApi(zpid, db, keys.realestateapi_key, formattedAddress, mlsId);
                    if (reapiMls) {
                        const urls = (reapiMls.media?.photosList ?? []).map(p => p.highRes).filter(Boolean);
                        if (urls.length > 0) {
                            propertyImages = urls;
                            console.log(`[Asset Batch] Fetched ${propertyImages.length} MLS image URLs from RealEstateAPI for ${zpid}.`);
                        }
                    }
                }

                // 3. Download/Secure images if from RealEstateAPI
                const isRealEstateApi = property.photo_source === 'realestateapi' ||
                    propertyImages.some(img => typeof img === 'string' && (img.includes('imagecdn.realty.dev') || img.includes('realty.dev/mls_photos')));

                if (isRealEstateApi && propertyImages.length > 0) {
                    const alreadySecured = propertyImages.length > 0 && propertyImages.every(img => img && img.startsWith('https://firebasestorage'));

                    if (!alreadySecured) {
                        console.log(`[Asset Batch] Securing ${propertyImages.length} RealEstateAPI photos for ${zpid}...`);
                        const securePromises = propertyImages.map(async (url, idx) => {
                            if (typeof url !== 'string') return '';
                            if (url.startsWith('https://firebasestorage')) return url;

                            const storagePath = `properties/${zpid}/gallery/img_${idx}.jpg`;
                            const securedUrl = await _secureImageToStorage(url, storagePath);
                            return securedUrl;
                        });

                        const securedResults = await Promise.all(securePromises);
                        const persistentImages = securedResults.filter(Boolean);

                        if (persistentImages.length > 0) {
                            // Update property doc
                            await propRef.update({
                                images: persistentImages,
                                photo_source: 'realestateapi'
                            });

                            // Update assets registry doc
                            const assetsRef = propRef.collection('analysis').doc('assets');
                            await assetsRef.set({
                                images: persistentImages,
                                lastVerified: new Date().toISOString()
                            }, { merge: true });

                            console.log(`[Asset Batch] Successfully secured ${persistentImages.length} photos for ${zpid}.`);
                        } else {
                            console.warn(`[Asset Batch] Failed to secure any photos for ${zpid}.`);
                        }
                    } else {
                        console.log(`[Asset Batch] All photos already secured for ${zpid}.`);
                    }
                }

                // 4. Heal maps (street view, radar maps)
                await _healMapImages(zpid, db);

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

