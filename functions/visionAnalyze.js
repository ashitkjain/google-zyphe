"use strict";

/**
 * Single-property vision analysis — HTTPS callable wrapper around
 * `runVisionPipeline`. Used by the property page button while we validate
 * the pipeline end-to-end. The city-scale batch driver will reuse the same
 * pipeline once we're happy with the output shape.
 */

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { runVisionPipeline } = require("./visionPipeline");

if (!admin.apps.length) admin.initializeApp();

exports.runVisionAnalysisForProperty = functions
    .runWith({ timeoutSeconds: 540, memory: "1GB" })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
        }
        const zpid = data?.zpid?.toString();
        if (!zpid) {
            throw new functions.https.HttpsError("invalid-argument", "zpid is required");
        }

        const db = admin.firestore();
        const keysSnap = await db.collection("app_config").doc("api_keys").get();
        const keys = keysSnap.exists ? keysSnap.data() : {};
        const geminiKey = keys.gemini_key || process.env.GEMINI_API_KEY || "";
        if (!geminiKey) {
            throw new functions.https.HttpsError("failed-precondition", "Gemini API key not configured");
        }
        const realEstateApiKey = keys.realestateapi_key || process.env.VITE_REALESTATEAPI_KEY || "";

        try {
            const result = await runVisionPipeline(zpid, { 
                db, 
                geminiKey, 
                realEstateApiKey,
                rapidApiKey: keys.rapidapi_key || process.env.RAPIDAPI_KEY,
                rapidApiHost: keys.rapidapi_host || 'us-housing-market-data1.p.rapidapi.com'
            });
            return result;
        } catch (e) {
            console.error(`[runVisionAnalysisForProperty] ${zpid}:`, e);
            // Stamp the failure on the saved doc so the page surfaces it
            // even if the callable timed out client-side.
            try {
                await db.collection("properties").doc(zpid)
                    .collection("analysis").doc("vision_v2")
                    .set({
                        status: "error",
                        phase: "Failed",
                        error: e.message || String(e),
                        analyzed_at_iso: new Date().toISOString(),
                    }, { merge: true });
            } catch (_) { /* swallow */ }
            throw new functions.https.HttpsError("internal", e.message || "pipeline error");
        }
    });
