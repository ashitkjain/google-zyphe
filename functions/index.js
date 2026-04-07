const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { DocumentProcessorServiceClient } = require("@google-cloud/documentai").v1;
admin.initializeApp();

// ─── Lazy key loader from Firestore (app_config/api_keys) ─────────────────────
let _cachedKeys = null;
async function getApiKeys() {
    if (_cachedKeys) return _cachedKeys;
    const snap = await admin.firestore().collection('app_config').doc('api_keys').get();
    _cachedKeys = snap.exists ? snap.data() : {};
    return _cachedKeys;
}

// Lazy Telnyx client
let _telnyxClient = null;
async function getTelnyx() {
    if (_telnyxClient) return _telnyxClient;
    const keys = await getApiKeys();
    const telnyxKey = keys.telnyx_key || process.env.TELNYX_KEY || '';
    _telnyxClient = require('telnyx')(telnyxKey);
    return _telnyxClient;
}

// Initialize Document AI Client
const documentAiClient = new DocumentProcessorServiceClient();

/**
 * Process a document using Google Cloud Document AI
 * Returns parsed CSV data from tables.
 */
exports.processDocumentWithDocumentAI = functions.https.onCall(async (data, context) => {
    // 1. Validation
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }

    const { fileBase64, mimeType } = data;
    if (!fileBase64 || !mimeType) {
        throw new functions.https.HttpsError("invalid-argument", "Missing file data or mime type.");
    }

    // TODO: User must replace these with their actual values
    // Location can be 'us' or 'eu'
    const projectId = process.env.GCLOUD_PROJECT || "zyphe-af0bf";
    const location = "us";
    const processorId = "ed0aabde2713d146";

    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    // 2. Prepare Request
    const request = {
        name,
        rawDocument: {
            content: fileBase64,
            mimeType: mimeType,
        },
    };

    console.log(`[DocumentAI] Processing document for user ${context.auth.uid}`);

    try {
        // 3. Call Document AI
        const [result] = await documentAiClient.processDocument(request);
        const { document } = result;

        if (!document) {
            console.warn("[DocumentAI] No document returned.");
            return { csv: "" };
        }

        const { text } = document;

        // 4. Extract Tables to CSV
        // Simple heuristic: Join entity mentions or use page structure if available.
        // For Form processors, we often use entities. For Splitter/Parser, we use pages.
        // Assuming Form Parser or General Processor which returns entities or pages with blocks.

        // Let's try to reconstruct tables from the 'pages' tables field if available
        let csvOutput = "";

        if (document.pages && document.pages.length > 0) {
            for (const page of document.pages) {
                if (page.tables && page.tables.length > 0) {
                    for (const table of page.tables) {
                        const rows = [];
                        if (table.headerRows) {
                            for (const params of table.headerRows) {
                                const rowCells = params.cells.map((cell) => {
                                    return getTextAnchorContent(text, cell.layout.textAnchor).replace(/\n/g, " ").trim();
                                });
                                rows.push(rowCells.join(","));
                            }
                        }
                        if (table.bodyRows) {
                            for (const params of table.bodyRows) {
                                const rowCells = params.cells.map((cell) => {
                                    return getTextAnchorContent(text, cell.layout.textAnchor).replace(/\n/g, " ").trim();
                                });
                                rows.push(rowCells.join(","));
                            }
                        }
                        csvOutput += rows.join("\n") + "\n\n";
                    }
                }
            }
        }

        // Fallback: If no structured tables found, just correct the text layout?
        // Or if form entities are found.
        if (!csvOutput.trim()) {
            console.log("[DocumentAI] No native tables found. Returning raw text.");
            // This is a naive fallback, likely won't be valid CSV but better than nothing or we can return specific error.
            return { csv: "NO_DATA_FOUND" };
        }

        return { csv: csvOutput.trim() };
    } catch (error) {
        console.error("[DocumentAI] Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Document AI processing failed.");
    }
});

/**
 * Helper to extract text from text anchors
 */
function getTextAnchorContent(text, textAnchor) {
    if (!textAnchor || !textAnchor.textSegments || textAnchor.textSegments.length === 0) {
        return "";
    }

    // Sort segments by start index just in case
    // textAnchor.textSegments.sort((a, b) => (a.startIndex || 0) - (b.startIndex || 0));

    return textAnchor.textSegments.map((segment) => {
        const start = parseInt(segment.startIndex || 0);
        const end = parseInt(segment.endIndex || 0);
        return text.substring(start, end);
    }).join("");
}

// Lazy Gemini embedding client
let _embeddingModel = null;
async function getEmbeddingModel() {
    if (_embeddingModel) return _embeddingModel;
    const keys = await getApiKeys();
    const geminiKey = keys.gemini_key || process.env.GEMINI_API_KEY || '';
    const genAI = new GoogleGenerativeAI(geminiKey);
    _embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    return _embeddingModel;
}

// TODO: Replace with your actual Telnyx Phone Number or Messaging Profile ID
const TELNYX_FROM_NUMBER = "+19252363260";

/**
 * Telnyx Webhook for Real-Time SMS Interaction
 *
 * This function receives incoming SMS messages from Telnyx,
 * matches the sender to a client in Firestore, and logs the
 * message to the Communication Hub and Client Timeline.
 */
exports.telnyxWebhook = functions.https.onRequest(async (req, res) => {
    const publicKey = "Rj7eIQ1Nly5P3tvhxFVjNUFnshBQWGNZRxC+feFqy1c=";

    // Verify Signature
    const signature = req.headers["telnyx-signature-ed25519"];
    const timestamp = req.headers["telnyx-timestamp"];
    const rawBodyBuffer = req.rawBody;

    if (!signature || !timestamp || !rawBodyBuffer) {
        console.error("[SMS] Missing headers or body");
        return res.status(400).send("Missing headers or body");
    }

    try {
        const rawBody = rawBodyBuffer.toString("utf8");
        const { TelnyxWebhook } = require("telnyx/webhooks");
        const webhook = new TelnyxWebhook(publicKey);
        webhook.verify(rawBody, req.headers);

        // Verification Successful - Parse Payload
        const event = JSON.parse(rawBody);
        const payload = event.data;

        // 1. Verify it's an incoming message
        if (!payload || payload.event_type !== "message.received") {
            return res.status(200).send("Ignored");
        }

        const { from, text, id, to } = payload.payload;
        const fromPhone = from.phone_number; // e.g., +14088231142
        const strippedPhone = fromPhone.replace(/^\+1/, ""); // e.g., 4088231142

        // 2. Find the client by phone number
        // We check both the 'users' (Buyer/Seller) and 'leads' collection
        // And we check both formats: E.164 (+1) and 10-digit National
        const db = admin.firestore();
        let client = null;
        let isLead = false;

        // Search Users (check both formats)
        // Since we can't do OR queries easily across multiple fields/values without an index,
        // we will just run two quick checks if the first fails.
        const userQuery = await db.collection("users")
            .where("phoneNumber", "in", [fromPhone, strippedPhone])
            .limit(1).get();

        if (!userQuery.empty) {
            client = { ...userQuery.docs[0].data(), uid: userQuery.docs[0].id };
        } else {
            // Search Leads (using flat 'phone' field)
            const leadQuery = await db.collection("leads")
                .where("phone", "in", [fromPhone, strippedPhone])
                .limit(1).get();

            if (!leadQuery.empty) {
                client = { ...leadQuery.docs[0].data(), uid: leadQuery.docs[0].id };
                isLead = true;
            }
        }

        if (client) {
            // 3. Persist Message to Global Feed
            // Note: For INBOUND messages, status is 'delivered'.
            await db.collection("messages").add({
                threadId: `thread_${client.uid}`,
                senderId: client.uid,
                receiverId: client.realtorId || "system",
                content: text,
                channel: "SMS",
                status: "delivered",
                direction: "inbound",
                providerId: id,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                requires_action: isLead, // Set action required if it's a lead msg
            });

            // 4. Auto-Log to Activity Timeline
            const targetCollection = isLead ? "leads" : "users";
            await db.collection(targetCollection).doc(client.uid).collection("activity").add({
                type: "SMS",
                content: text,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                authorId: client.uid,
            });

            console.log(`[SMS] Received and logged from: ${fromPhone} for ${isLead ? "lead" : "client"}: ${client.displayName || client.fullName}`);
        } else {
            console.log(`[SMS] Received from ${fromPhone} but no consenting client found.`);
        }

        res.status(200).send("Success");
    } catch (error) {
        console.error("[SMS] Webhook error:", error);
        res.status(500).send("Internal Server Error");
    }
});

/**
 * Universal SMS Sender (Replaces processOutboundSms)
 * Triggers when a message is added to 'messages' collection with status: 'pending'.
 * Sends the SMS via Telnyx.
 */
exports.processSmsQueue = functions.firestore
    .document("messages/{messageId}")
    .onCreate(async (snap, context) => {
        const msg = snap.data();
        const db = admin.firestore();

        // 1. Filter: Must be pending SMS
        if (msg.status !== "pending" || msg.channel !== "SMS") {
            return null;
        }

        console.log(`[Universal Sender] Processing message ${context.params.messageId} to receiver ${msg.receiverId}`);

        try {
            // 2. Lookup Recipient Phone Number
            // receiverId could be a User or a Lead.

            let toPhone = null;

            // Try Users First
            let docRef = await db.collection("users").doc(msg.receiverId).get();
            if (docRef.exists) {
                const data = docRef.data();
                toPhone = data.phoneNumber || data.phone;
            } else {
                // Try Leads
                docRef = await db.collection("leads").doc(msg.receiverId).get();
                if (docRef.exists) {
                    const data = docRef.data();
                    toPhone = data.phone || data.primaryContact?.phone;
                }
            }

            if (!toPhone) {
                console.error(`[Universal Sender] Recipient ${msg.receiverId} not found (checked users & leads).`);
                await snap.ref.update({ status: "failed", error: "Recipient not found" });
                return null;
            }

            // Ensure E.164 format if missing
            if (!toPhone.startsWith("+")) {
                toPhone = "+1" + toPhone.replace(/\D/g, "");
            }

            // 3. Send via Telnyx API
            const telnyxClient = await getTelnyx();
        const telnyxResponse = await telnyxClient.messages.create({
                from: TELNYX_FROM_NUMBER,
                to: toPhone,
                text: msg.content,
            });

            // 4. Update Message Status
            await snap.ref.update({
                status: "sent",
                providerId: telnyxResponse.data.id,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`[Universal Sender] Successfully sent to ${toPhone}. Telnyx ID: ${telnyxResponse.data.id}`);
        } catch (error) {
            console.error(`[Universal Sender] Failed to send:`, error);
            await snap.ref.update({
                status: "failed",
                error: error.message || "Unknown error",
            });
        }
    });




/**
 * Public API to test Telnyx Webhook with Signature Verification
 * Uses the provided public key: Rj7eIQ1Nly5P3tvhxFVjNUFnshBQWGNZRxC+feFqy1c=
 */
exports.telnyxWebhookTest = functions.https.onRequest((req, res) => {
    const publicKey = "Rj7eIQ1Nly5P3tvhxFVjNUFnshBQWGNZRxC+feFqy1c=";

    // Telnyx sends the signature and timestamp in headers
    const signature = req.headers["telnyx-signature-ed25519"];
    const timestamp = req.headers["telnyx-timestamp"];
    const rawBodyBuffer = req.rawBody; // Firebase Functions provides the raw buffer

    if (!signature || !timestamp || !rawBodyBuffer) {
        console.error("[TelnyxTest] Missing headers or body");
        return res.status(400).send("Missing headers or body");
    }

    try {
        // We need to use the raw body string for verification
        const rawBody = rawBodyBuffer.toString("utf8");

        // Dynamically import the Webhook class if it's not on the main export
        // Based on the file structure `telnyx/webhooks.js` exports `TelnyxWebhook`
        const { TelnyxWebhook } = require("telnyx/webhooks");

        const webhook = new TelnyxWebhook(publicKey);

        // Verify sends an error if it fails
        webhook.verify(rawBody, req.headers);

        // If we get here, it is verified.
        // We can now safely parse the body
        const event = JSON.parse(rawBody);

        console.log("[TelnyxTest] Webhook Verified Successfully:", event.data?.id);
        console.log("[TelnyxTest] Event Type:", event.data?.event_type);

        // Return success
        return res.status(200).json({ status: "verified", event: event.data?.event_type });
    } catch (err) {
        console.error("[TelnyxTest] Verification Error:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
});

/**
 * Lead Ingestion Webhooks
 * Supports Zillow Tech Connect, Realtor.com Direct Lead API, and Facebook Lead Ads.
 */

// Universal lead handler
// Universal lead handler
async function handleLeadIngestion(source, realtorId, payload, req) {
    const db = admin.firestore();

    console.log(`[Ingestion] Received lead from ${source} for Realtor ${realtorId}`);

    // Log raw data for debugging and future parsing refinement
    await db.collection("raw_leads").add({
        source,
        realtorId,
        payload: payload || {},
        headers: req.headers || {},
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Basic extraction (to be refined per source)
    const leadData = {
        realtorId,
        source: source,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        funnelStage: "Leads",
        status: "New",
        leadType: "Buyer", // Default
        slaUrgency: "high",
        isMock: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (source === "Zillow") {
        const p = payload || {};
        leadData.firstName = p.First_Name || p.FirstName || p.firstName || "";
        leadData.lastName = p.Last_Name || p.LastName || p.lastName || "";
        leadData.email = p.Email || p.email || "";
        leadData.phone = p.Phone || p.phone || p.phoneNumber || "";
        leadData.propertyAddress = p.Property_Address || p.Address || p.address || "";
        leadData.message = p.Message || p.Comments || "";
    } else if (source === "Realtor") {
        const p = payload || {};
        leadData.firstName = p.first_name || p.firstName || "";
        leadData.lastName = p.last_name || p.lastName || "";
        leadData.email = p.email || "";
        leadData.phone = p.phone || p.phoneNumber || "";
        leadData.propertyAddress = p.address || "";
    } else if (source === "Facebook") {
        // Facebook notification
        const p = payload || {};
        leadData.status = "New (Cold)";
        leadData.notes = "Lead from Facebook Ad. Run 9-Word Reactivation.";
    }

    if (!leadData.email && !leadData.phone && !leadData.lastName) {
        console.log(`[Ingestion] Insufficient data to create lead.`);
        return;
    }

    // Deduplication check
    const leadsRef = db.collection("leads");
    let existingQuery = null;

    if (leadData.email) {
        existingQuery = await leadsRef.where("realtorId", "==", realtorId).where("email", "==", leadData.email).limit(1).get();
    } else if (leadData.phone) {
        existingQuery = await leadsRef.where("realtorId", "==", realtorId).where("phone", "==", leadData.phone).limit(1).get();
    }

    if (existingQuery && !existingQuery.empty) {
        const existingDoc = existingQuery.docs[0];
        console.log(`[Ingestion] Updating existing lead: ${existingDoc.id}`);
        await existingDoc.ref.update({
            ...leadData,
            receivedAt: existingDoc.data().receivedAt, // Keep original creation date
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
    } else {
        // Create new lead
        if (!leadData.firstName && !leadData.lastName && leadData.email) {
            leadData.firstName = leadData.email.split("@")[0];
        }
        await leadsRef.add(leadData);
        console.log(`[Ingestion] Created new lead: ${leadData.firstName} ${leadData.lastName}`);
    }
}

exports.zillowWebhook = functions.https.onRequest(async (req, res) => {
    const realtorId = req.query.realtorId;
    if (!realtorId) {
        console.error("[Zillow] Missing realtorId in query");
        return res.status(400).send("Missing realtorId");
    }
    await handleLeadIngestion("Zillow", realtorId, req.body, req);
    res.status(200).send("Success");
});

exports.realtorWebhook = functions.https.onRequest(async (req, res) => {
    const realtorId = req.query.realtorId;
    if (!realtorId) {
        console.error("[Realtor] Missing realtorId in query");
        return res.status(400).send("Missing realtorId");
    }
    await handleLeadIngestion("Realtor", realtorId, req.body, req);
    res.status(200).send("Success");
});

exports.facebookWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method === "GET") {
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];
        if (mode === "subscribe" && token === "ZYPHE_FB_VERIFY") {
            return res.status(200).send(challenge);
        }
        return res.status(403).send("Forbidden");
    }

    const realtorId = req.query.realtorId;
    if (!realtorId) {
        console.error("[Facebook] Missing realtorId in query");
        return res.status(400).send("Missing realtorId");
    }

    // Facebook Lead Ads send a notification that a lead was created.
    // We log it and optionally fetch more details.
    await handleLeadIngestion("Facebook", realtorId, req.body, req);
    res.status(200).send("Success");
});

/**
 * Automatically generate semantic embeddings for Knowledge Center content.
 * Triggers on any change to the 'guides' OR 'best_practices' collection.
 */
const generateEmbedding = async (change, context, type) => {
    const after = change.after.exists ? change.after.data() : null;
    const before = change.before.exists ? change.before.data() : null;

    if (!after) return null;

    const contentAfter = typeof after.content === "object" ? JSON.stringify(after.content) : (after.content || after.subtitle || "");
    const contentBefore = before ? (typeof before.content === "object" ? JSON.stringify(before.content) : (before.content || before.subtitle || "")) : null;

    if (contentAfter === contentBefore && after.embedding) {
        console.log(`[Embeddings] ${type} content unchanged, skipping.`);
        return null;
    }

    console.log(`[Embeddings] Generating for ${type}: ${after.title}`);

    try {
        const textToEmbed = `Type: ${type}\nTitle: ${after.title}\n\nContent: ${contentAfter}`;
        const model = await getEmbeddingModel();
        const result = await model.embedContent(textToEmbed);
        const embedding = result.embedding.values;

        await change.after.ref.update({
            embedding: admin.firestore.FieldValue.vector(embedding),
            embeddingVersion: "gemini-embedding-001",
            indexedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`[Embeddings] Successfully updated ${type}: ${after.title}`);
    } catch (error) {
        console.error(`[Embeddings] Failure for ${type}:`, error);
    }
    return null;
};

exports.generateGuideEmbedding = functions.firestore
    .document("guides/{id}")
    .onWrite((change, context) => generateEmbedding(change, context, "Guide"));

exports.generateBestPracticeEmbedding = functions.firestore
    .document("best_practices/{id}")
    .onWrite((change, context) => generateEmbedding(change, context, "BestPractice"));

/**
 * Perform a semantic search across Knowledge Center content.
 * This is handled on the server to avoid client SDK version issues and keep API keys secure.
 */
exports.searchKnowledgeBase = functions.https.onCall(async (data, context) => {
    const queryText = data.query;
    if (!queryText || typeof queryText !== "string") {
        return { results: [] };
    }

    console.log(`[Search] Query: ${queryText}`);

    try {
        const model = await getEmbeddingModel();
        const embeddingResult = await model.embedContent(queryText);
        const queryVector = embeddingResult.embedding.values;

        const collections = ["guides", "best_practices"];
        const allResults = [];

        for (const colName of collections) {
            const snapshot = await admin.firestore().collection(colName)
                .findNearest("embedding", admin.firestore.FieldValue.vector(queryVector), {
                    limit: 5,
                    distanceMeasure: "COSINE",
                })
                .get();

            snapshot.docs.forEach((doc) => {
                const docData = doc.data();
                allResults.push({
                    id: doc.id,
                    title: docData.title,
                    slug: docData.slug || doc.id,
                    topicSlug: docData.topicSlug || colName,
                    score: doc.distance || 0,
                });
            });
        }

        // Sort by similarity distance (smaller is better for COSINE distance)
        const sortedResults = allResults.sort((a, b) => a.score - b.score).slice(0, 10);
        console.log(`[Search] Found ${sortedResults.length} matches.`);

        return { results: sortedResults };
    } catch (error) {
        console.error("[Search] Error:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});
/**
 * Proxy function to fetch Google Street View and Radar.io images.
 * This bypasses CORS restrictions and potential client-side API key restrictions.
 */
exports.proxyStreetViewImage = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }

    const { url } = data;
    if (!url) {
        throw new functions.https.HttpsError("invalid-argument", "Missing image URL.");
    }

    console.log(`[Proxy] Fetching image from: ${url.split("&key=")[0]}...`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[Proxy] Failed to fetch image: ${response.status} ${response.statusText}`);
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString("base64");
        const contentType = response.headers.get("content-type") || "image/jpeg";

        return { base64, mimeType: contentType };
    } catch (error) {
        console.error("[Proxy] Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to proxy image fetch.");
    }
});

/**
 * Proxy function to call the HowLoud SoundScore API.
 * HowLoud does not set CORS headers, so all browser requests are blocked.
 * This function runs server-side where CORS does not apply.
 */
exports.proxyNoiseScore = functions.https.onRequest(async (req, res) => {
    // Handle CORS preflight
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    // Verify Firebase auth token
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
        res.status(401).json({ status: "ERROR", error: "Unauthenticated" });
        return;
    }
    try {
        await admin.auth().verifyIdToken(idToken);
    } catch (e) {
        res.status(401).json({ status: "ERROR", error: "Invalid auth token" });
        return;
    }

    const { lat, lng } = req.body;
    if (lat == null || lng == null) {
        res.status(400).json({ status: "ERROR", error: "Missing lat/lng" });
        return;
    }

    const keys = await getApiKeys();
    const HOWLOUD_KEY = keys.howloud_key || process.env.HOWLOUD_KEY || '';
    const url = `https://api.howloud.com/score?lat=${lat}&lng=${lng}`;

    console.log(`[ProxyNoiseScore] Fetching score for (${lat}, ${lng})`);

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: { "x-api-key": HOWLOUD_KEY },
        });

        if (!response.ok) {
            console.error(`[ProxyNoiseScore] HowLoud error: ${response.status}`);
            res.status(200).json({ status: "ERROR", error: `HowLoud API error: ${response.status}` });
            return;
        }

        const json = await response.json();
        console.log("[ProxyNoiseScore] Response:", JSON.stringify(json));
        res.status(200).json(json);
    } catch (error) {
        console.error("[ProxyNoiseScore] Error:", error);
        res.status(200).json({ status: "ERROR", error: error.message || "Failed to fetch noise score." });
    }
});

/**
 * Proxy function to call Census Bureau Geocoder + ACS 5-Year APIs.
 * Both APIs lack CORS headers, blocking all browser requests.
 * This function runs server-side and returns structured demographic data.
 *
 * Input: { lat: number, lng: number }
 * Output: Census tract FIPS + ACS demographic fields
 */
exports.proxyCensusACS = functions.https.onRequest(async (req, res) => {
    // Handle CORS preflight
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    // Verify Firebase auth token
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
        res.status(401).json({ status: "ERROR", error: "Unauthenticated" });
        return;
    }
    try {
        await admin.auth().verifyIdToken(idToken);
    } catch (e) {
        res.status(401).json({ status: "ERROR", error: "Invalid auth token" });
        return;
    }

    const { lat, lng } = req.body;
    if (lat == null || lng == null) {
        res.status(400).json({ status: "ERROR", error: "Missing lat/lng" });
        return;
    }

    console.log(`[ProxyCensusACS] Fetching demographics for (${lat}, ${lng})`);

    try {
        // Step 1: Geocode lat/lng → Census Tract FIPS
        const geoUrl = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
        const geoRes = await fetch(geoUrl);
        if (!geoRes.ok) {
            throw new Error(`Census Geocoder failed: ${geoRes.status}`);
        }
        const geoData = await geoRes.json();

        const geographies = geoData?.result?.geographies?.["Census Tracts"];
        if (!geographies || geographies.length === 0) {
            res.status(200).json({ status: "NO_TRACT", error: "No census tract found for coordinates" });
            return;
        }

        const tract = geographies[0];
        const stateFips = tract.STATE;
        const countyFips = tract.COUNTY;
        const tractId = tract.TRACT;
        const tractName = tract.BASENAME || `Tract ${tractId}`;

        // Step 2: Fetch ACS 5-Year Estimates for this tract
        const acsVariables = [
            'B19013_001E', // Median household income
            'B01002_001E', // Median age
            'B01003_001E', // Total population
            'B25003_001E', // Total housing units (tenure)
            'B25003_002E', // Owner-occupied
            'B25003_003E', // Renter-occupied
            'B25077_001E', // Median home value
            'B15003_001E', // Total education (25+)
            'B15003_022E', // Bachelor's degree
            'B15003_023E', // Master's degree
            'B15003_024E', // Professional degree
            'B15003_025E', // Doctorate degree
            'B25064_001E', // Median gross rent
            'B25070_001E', // Total for Gross Rent as % of Income
            'B25070_007E', // 30.0-34.9% rent burden
            'B25070_008E', // 35.0-39.9% rent burden
            'B25070_009E', // 40.0-49.9% rent burden
            'B25070_010E', // 50.0% or more rent burden
        ].join(',');

        const acsUrl = `https://api.census.gov/data/2022/acs/acs5?get=${acsVariables}&for=tract:${tractId}&in=state:${stateFips}&in=county:${countyFips}`;
        const acsRes = await fetch(acsUrl);
        if (!acsRes.ok) {
            throw new Error(`Census ACS failed: ${acsRes.status}`);
        }
        const acsData = await acsRes.json();

        if (!acsData || acsData.length < 2) {
            throw new Error("No ACS data returned");
        }

        console.log(`[ProxyCensusACS] Success: Tract ${tractName} in state=${stateFips}, county=${countyFips}`);

        res.status(200).json({
            status: "OK",
            tract: {
                stateFips,
                countyFips,
                tractId,
                tractName,
            },
            acs: {
                headers: acsData[0],
                values: acsData[1],
            },
        });
    } catch (error) {
        console.error("[ProxyCensusACS] Error:", error);
        res.status(200).json({ status: "ERROR", error: error.message || "Failed to fetch census data." });
    }
});

/**
 * getBuyerSignals — PostHog API Proxy
 * Credentials in Firestore app_config/api_keys: posthog_private_key, posthog_project_id, posthog_host
 * Input:  POST { buyerEmail: string, days?: number }
 * Output: { signals: BuyerSignals } | { error: string }
 */
exports.getBuyerSignals = functions.https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }

    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) { res.status(401).json({ error: "Unauthenticated" }); return; }
    try { await admin.auth().verifyIdToken(idToken); }
    catch (e) { res.status(401).json({ error: "Invalid auth token" }); return; }

    const { buyerEmail, days = 30 } = req.body || {};
    if (!buyerEmail) { res.status(400).json({ error: "Missing buyerEmail" }); return; }

    const keys = await getApiKeys();
    const PH_KEY     = keys.posthog_private_key  || process.env.POSTHOG_PRIVATE_KEY  || "";
    const PH_PROJECT = keys.posthog_project_id   || process.env.POSTHOG_PROJECT_ID   || "";
    const PH_HOST    = keys.posthog_host          || "https://us.posthog.com";

    if (!PH_KEY || !PH_PROJECT) {
        console.warn("[PostHog] Missing posthog_private_key / posthog_project_id in app_config/api_keys");
        res.status(200).json({ error: "PostHog not configured", signals: null }); return;
    }

    const afterDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
    const safeEmail = buyerEmail.replace(/'/g, "\\'");

    const hogql = `SELECT event, count() AS n, max(timestamp) AS last_seen, groupArray(JSONExtractString(properties, 'city')) AS cities, groupArray(JSONExtractString(properties, 'address')) AS addrs, avgIf(toFloat64OrNull(JSONExtractString(properties, 'list_price')), JSONExtractString(properties, 'list_price') != '') AS avg_p, minIf(toFloat64OrNull(JSONExtractString(properties, 'list_price')), JSONExtractString(properties, 'list_price') != '') AS min_p, maxIf(toFloat64OrNull(JSONExtractString(properties, 'list_price')), JSONExtractString(properties, 'list_price') != '') AS max_p FROM events WHERE person.properties.email = '${safeEmail}' AND event IN ('idx_property_viewed','idx_map_marker_clicked','idx_tour_requested','idx_info_requested','idx_search_saved','idx_city_browsed','idx_story_search_run') AND timestamp >= '${afterDate}' GROUP BY event ORDER BY n DESC`;

    try {
        const phRes = await fetch(`${PH_HOST}/api/projects/${PH_PROJECT}/query/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${PH_KEY}` },
            body: JSON.stringify({ query: { kind: "HogQLQuery", query: hogql } }),
        });

        if (!phRes.ok) {
            const errText = await phRes.text();
            console.error(`[PostHog] Query failed ${phRes.status}: ${errText}`);
            res.status(200).json({ error: "PostHog query failed", signals: null }); return;
        }

        const phData = await phRes.json();
        const rows = phData.results || [];
        const by = {};
        let lastActive = null;

        for (const [event, n, last_seen, cities, addrs, avg_p, min_p, max_p] of rows) {
            by[event] = { n, last_seen, cities, addrs, avg_p, min_p, max_p };
            if (!lastActive || last_seen > lastActive) lastActive = last_seen;
        }

        const pv = by["idx_property_viewed"]    || {};
        const mc = by["idx_map_marker_clicked"] || {};
        const tr = by["idx_tour_requested"]     || {};
        const ir = by["idx_info_requested"]     || {};
        const ss = by["idx_search_saved"]       || {};
        const cb = by["idx_city_browsed"]       || {};
        const ay = by["idx_story_search_run"]   || {};

        const allCities = [...(pv.cities || []), ...(cb.cities || [])].filter(c => c && c !== "");
        const tourAddrs = (tr.addrs || []).filter(a => a && a !== "");

        const signals = {
            buyerEmail, periodDays: days, lastActiveAt: lastActive,
            propertiesViewed:       pv.n || 0,
            mapMarkersClicked:      mc.n || 0,
            tourRequests:           tr.n || 0,
            infoRequests:           ir.n || 0,
            savedSearchCount:       ss.n || 0,
            usedMapView:            (mc.n || 0) > 0,
            usedStorySearch:        (ay.n || 0) > 0,
            citiesExplored:         [...new Set(allCities)].slice(0, 10),
            tourRequestedAddresses: [...new Set(tourAddrs)].slice(0, 10),
            priceRangeInterest: {
                min: pv.min_p ? Math.round(pv.min_p) : null,
                max: pv.max_p ? Math.round(pv.max_p) : null,
                avg: pv.avg_p ? Math.round(pv.avg_p) : null,
            },
        };

        console.log(`[PostHog] Signals for ${buyerEmail}: ${signals.propertiesViewed} views, ${signals.tourRequests} tours`);
        res.status(200).json({ signals });
    } catch (error) {
        console.error("[PostHog] getBuyerSignals error:", error);
        res.status(200).json({ error: error.message, signals: null });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// savedSearchAlerts — Scheduled Cloud Function
//
// Runs every hour. Checks all realtors' saved_searches for contacts that
// need an alert (instant/daily/weekly) and emails them via the Firestore
// `mail` collection (requires Firebase "Trigger Email" extension).
//
// Prerequisites:
//   1. Install "Trigger Email from Firestore" extension in Firebase console
//      pointing to the `mail` collection.
//   2. Configure the extension with your SendGrid / SMTP credentials.
//
// Logic per saved search:
//   - instant: check every run (skip if lastRunAt < 1h ago)
//   - daily:   check once per day (skip if lastRunAt < 23h ago)
//   - weekly:  check once per week (skip if lastRunAt < 6d ago)
//   - none:    always skip
// ─────────────────────────────────────────────────────────────────────────────

exports.savedSearchAlerts = functions.pubsub
    .schedule('every 60 minutes')
    .onRun(async () => {
        const db = admin.firestore();
        const now = Date.now();

        // ── 1. Walk all realtors ──────────────────────────────────────────────
        const realtorsSnap = await db.collection('realtors').get();
        let totalAlertsSent = 0;

        for (const realtorDoc of realtorsSnap.docs) {
            const realtorId = realtorDoc.id;
            const realtorData = realtorDoc.data() || {};

            // ── 2. Walk saved searches for this realtor ───────────────────────
            const searchesSnap = await db
                .collection('realtors').doc(realtorId)
                .collection('saved_searches')
                .where('alertFrequency', 'in', ['instant', 'daily', 'weekly'])
                .get();

            for (const searchDoc of searchesSnap.docs) {
                const search = { id: searchDoc.id, ...searchDoc.data() };

                // Skip if no email
                if (!search.notifyEmail) continue;

                // ── 3. Throttle by frequency ──────────────────────────────────
                const lastRun = search.lastRunAt?.toMillis?.() || 0;
                const elapsed = now - lastRun;
                const HOUR = 3_600_000;
                const thresholds = { instant: HOUR, daily: 23 * HOUR, weekly: 6 * 24 * HOUR };
                if (elapsed < (thresholds[search.alertFrequency] || Infinity)) continue;

                // ── 4. Query matching properties from Firestore ───────────────
                const f = search.filters || {};
                let propQuery = db
                    .collection('realtors').doc(realtorId)
                    .collection('properties');

                // City filter (field on property docs)
                if (search.city) {
                    propQuery = propQuery.where('city', '==', search.city);
                }

                let propSnap;
                try {
                    propSnap = await propQuery.limit(200).get();
                } catch (e) {
                    console.error(`[SavedSearchAlerts] Property query failed for ${realtorId}/${search.id}:`, e.message);
                    continue;
                }

                // ── 5. Apply remaining filters in-memory ─────────────────────
                const matches = propSnap.docs.map(d => d.data()).filter(p => {
                    if (f.minPrice && p.listPrice < Number(f.minPrice)) return false;
                    if (f.maxPrice && p.listPrice > Number(f.maxPrice)) return false;
                    if (f.beds && (p.bedrooms || 0) < Number(f.beds)) return false;
                    if (f.baths && (p.bathrooms || 0) < Number(f.baths)) return false;
                    if (f.homeType && f.homeType !== 'any' && p.homeType !== f.homeType) return false;
                    if (f.minSqft && (p.livingArea || 0) < Number(f.minSqft)) return false;
                    if (f.maxSqft && (p.livingArea || 0) > Number(f.maxSqft)) return false;
                    if (f.minYear && (p.yearBuilt || 0) < Number(f.minYear)) return false;
                    if (f.maxYear && (p.yearBuilt || 0) > Number(f.maxYear)) return false;
                    if (f.minSchoolRating && (p.schoolRating || 0) < Number(f.minSchoolRating)) return false;
                    if (f.neighborhood && p.neighborhood !== f.neighborhood) return false;
                    return true;
                });

                if (matches.length === 0) continue;

                // ── 6. Write to `mail` collection (Firebase Trigger Email ext) ─
                const topMatches = matches.slice(0, 5);
                const fmt = n => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${Math.round(n / 1_000)}K` : `$${n}`;
                const listingRows = topMatches.map(p => `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:12px;font-size:13px;font-weight:700;color:#0f172a;">${p.address || 'N/A'}</td>
                        <td style="padding:12px;font-size:13px;font-weight:900;color:#4F46E5;">${p.listPrice ? fmt(p.listPrice) : 'N/A'}</td>
                        <td style="padding:12px;font-size:12px;color:#64748b;">${[p.bedrooms ? `${p.bedrooms} bd` : '', p.bathrooms ? `${p.bathrooms} ba` : '', p.livingArea ? `${p.livingArea.toLocaleString()} sqft` : ''].filter(Boolean).join(' · ') || '—'}</td>
                    </tr>
                `).join('');

                const realtorName = realtorData.name || realtorData.displayName || 'Your Realtor';
                const freqLabel = { instant: 'New Listing Alert', daily: 'Daily Listing Update', weekly: 'Weekly Listing Digest' }[search.alertFrequency] || 'Listing Alert';

                const emailHtml = `
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
                        <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:32px 40px;border-radius:16px 16px 0 0;">
                            <div style="font-size:11px;font-weight:800;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Zyphe · ${freqLabel}</div>
                            <h1 style="font-size:24px;font-weight:900;color:#fff;margin:0;line-height:1.2;">${matches.length} Home${matches.length !== 1 ? 's' : ''} Match Your Search</h1>
                            <p style="font-size:14px;color:rgba(255,255,255,0.8);margin:8px 0 0;">${search.name} · ${search.city}</p>
                        </div>
                        <div style="padding:32px 40px;background:#fafafa;">
                            <p style="font-size:14px;color:#475569;margin:0 0 24px;">We found <strong>${matches.length} listing${matches.length !== 1 ? 's' : ''}</strong> matching your saved search. Here are the top picks:</p>
                            <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
                                <thead>
                                    <tr style="background:#f8fafc;">
                                        <th style="padding:10px 12px;font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;text-align:left;">Address</th>
                                        <th style="padding:10px 12px;font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;text-align:left;">Price</th>
                                        <th style="padding:10px 12px;font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;text-align:left;">Details</th>
                                    </tr>
                                </thead>
                                <tbody>${listingRows}</tbody>
                            </table>
                            ${matches.length > 5 ? `<p style="font-size:12px;color:#94a3b8;margin-top:12px;text-align:center;">+${matches.length - 5} more listings available</p>` : ''}
                            <div style="text-align:center;margin-top:28px;">
                                <a href="https://zyphe.ai" style="background:#4F46E5;color:white;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;padding:14px 32px;border-radius:12px;text-decoration:none;display:inline-block;">View All Matches →</a>
                            </div>
                        </div>
                        <div style="padding:20px 40px;border-top:1px solid #f1f5f9;text-align:center;">
                            <p style="font-size:11px;color:#94a3b8;margin:0;">Sent by ${realtorName} via Zyphe · <a href="#" style="color:#94a3b8;">Unsubscribe</a></p>
                        </div>
                    </div>
                `;

                try {
                    await db.collection('mail').add({
                        to: [search.notifyEmail],
                        message: {
                            subject: `🏠 ${freqLabel}: ${matches.length} matches for "${search.name}"`,
                            html: emailHtml,
                        },
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        searchId: search.id,
                        realtorId,
                    });

                    // Update lastRunAt + resultCount
                    await db.collection('realtors').doc(realtorId)
                        .collection('saved_searches').doc(search.id)
                        .update({
                            lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
                            resultCount: matches.length,
                        });

                    totalAlertsSent++;
                    console.log(`[SavedSearchAlerts] Sent to ${search.notifyEmail}: "${search.name}" — ${matches.length} matches`);
                } catch (e) {
                    console.error(`[SavedSearchAlerts] Email write failed:`, e.message);
                }
            }
        }

        console.log(`[SavedSearchAlerts] Run complete — ${totalAlertsSent} alert(s) sent`);
        return null;
    });
