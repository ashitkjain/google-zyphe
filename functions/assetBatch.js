'use strict';
/**
 * Asset Secure Batch — Cloud Function
 * 
 * Triggered by asset_secure_batch_jobs/{jobId} CREATE.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Ensure admin is initialized (index.js usually does this, but for safety in individual modules)
if (admin.apps.length === 0) {
    admin.initializeApp();
}

/**
 * Fetches the canonical image list from RapidAPI
 */
async function _fetchPropertyImages(zpid) {
    const db = admin.firestore();
    const snap = await db.collection('app_config').doc('api_keys').get();
    const keys = snap.exists ? snap.data() : {};
    const RAPID_API_KEY = keys.rapidapi_key || process.env.VITE_RAPIDAPI_KEY;
    const RAPID_API_HOST = 'us-housing-market-data1.p.rapidapi.com';

    if (!RAPID_API_KEY) throw new Error("Missing RapidAPI Key");

    const url = `https://${RAPID_API_HOST}/images?zpid=${zpid}`;
    const res = await fetch(url, {
        headers: {
            'x-rapidapi-key': RAPID_API_KEY,
            'x-rapidapi-host': RAPID_API_HOST
        }
    });

    if (!res.ok) throw new Error(`Images API Error: ${res.status}`);
    const data = await res.json();
    return data.images || [];
}

/**
 * Uploads a remote image to Firebase Storage using Admin SDK
 */
async function _secureOneImage(zpid, remoteUrl, storagePath) {
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    
    // Fetch and Upload
    const response = await fetch(remoteUrl);
    if (!response.ok) throw new Error(`Failed to fetch ${remoteUrl}`);
    const buffer = await response.arrayBuffer();

    await file.save(Buffer.from(buffer), {
        metadata: {
            contentType: 'image/jpeg',
            metadata: {
                originalUrl: remoteUrl,
                zpid: zpid
            }
        }
    });

    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media`;
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

        const db = admin.firestore();
        await snap.ref.update({ 
            status: 'running', 
            startedAt: admin.firestore.FieldValue.serverTimestamp() 
        });

        let results = {};
        let done = 0;
        let failed = 0;

        for (const zpid of zpids) {
            try {
                console.log(`[Asset Batch] Securing ${zpid}...`);
                
                const imageUrls = await _fetchPropertyImages(zpid);
                const assetsRef = db.collection('properties').doc(zpid).collection('analysis').doc('assets');
                const assetsSnap = await assetsRef.get();
                const cached = assetsSnap.exists ? assetsSnap.data() : { images: [], imageMetadata: {} };

                const persistentImages = [];
                const newMetadata = { ...(cached.imageMetadata || {}) };

                for (let idx = 0; idx < imageUrls.length; idx++) {
                    const url = imageUrls[idx];
                    const cachedUrl = cached.images?.[idx];
                    const cachedMeta = cachedUrl ? (cached.imageMetadata?.[cachedUrl]) : null;

                    if (cachedUrl && cachedMeta?.originalUrl === url) {
                        persistentImages.push(cachedUrl);
                        continue;
                    }

                    const storagePath = `properties/${zpid}/gallery/img_${idx + 1}.jpg`;
                    const securedUrl = await _secureOneImage(zpid, url, storagePath);
                    persistentImages.push(securedUrl);
                    newMetadata[securedUrl] = { originalUrl: url };
                }

                await assetsRef.set({
                    zpid,
                    images: persistentImages,
                    imageMetadata: newMetadata,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                results[zpid] = { status: 'success', count: persistentImages.length };
                done++;
            } catch (e) {
                console.error(`[Asset Batch Error] ${zpid}:`, e.message);
                results[zpid] = { status: 'failed', message: e.message };
                failed++;
            }

            // Real-time update
            await snap.ref.update({ done, failed, results, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }

        await snap.ref.update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return null;
    });
