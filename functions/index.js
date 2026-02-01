const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const telnyx = require('telnyx')('KEY019BFFFEE99769B3985278C839A4C1AA_11aDo6xzW4pdHMr6LOFnth');

admin.initializeApp();

// Initialize Gemini with the API Key
const genAI = new GoogleGenerativeAI('AIzaSyBEPZ14POfqhB2wgfqAsgXkzuVPy2w-l90');
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

// TODO: Replace with your actual Telnyx Phone Number or Messaging Profile ID
const TELNYX_FROM_NUMBER = '+19252363260';

/**
 * Telnyx Webhook for Real-Time SMS Interaction
 * 
 * This function receives incoming SMS messages from Telnyx,
 * matches the sender to a client in Firestore, and logs the
 * message to the Communication Hub and Client Timeline.
 */
exports.telnyxWebhook = functions.https.onRequest(async (req, res) => {
    const publicKey = 'Rj7eIQ1Nly5P3tvhxFVjNUFnshBQWGNZRxC+feFqy1c=';

    // Verify Signature
    const signature = req.headers['telnyx-signature-ed25519'];
    const timestamp = req.headers['telnyx-timestamp'];
    const rawBodyBuffer = req.rawBody;

    if (!signature || !timestamp || !rawBodyBuffer) {
        console.error('[SMS] Missing headers or body');
        return res.status(400).send('Missing headers or body');
    }

    try {
        const rawBody = rawBodyBuffer.toString('utf8');
        const { TelnyxWebhook } = require('telnyx/webhooks');
        const webhook = new TelnyxWebhook(publicKey);
        webhook.verify(rawBody, req.headers);

        // Verification Successful - Parse Payload
        const event = JSON.parse(rawBody);
        const payload = event.data;

        // 1. Verify it's an incoming message
        if (!payload || payload.event_type !== 'message.received') {
            return res.status(200).send('Ignored');
        }

        const { from, text, id, to } = payload.payload;
        const fromPhone = from.phone_number; // e.g., +14088231142
        const strippedPhone = fromPhone.replace(/^\+1/, ''); // e.g., 4088231142

        // 2. Find the client by phone number
        // We check both the 'users' (Buyer/Seller) and 'leads' collection
        // And we check both formats: E.164 (+1) and 10-digit National
        const db = admin.firestore();
        let client = null;
        let isLead = false;

        // Search Users (check both formats)
        // Since we can't do OR queries easily across multiple fields/values without an index, 
        // we will just run two quick checks if the first fails.
        let userQuery = await db.collection('users')
            .where('phoneNumber', 'in', [fromPhone, strippedPhone])
            .limit(1).get();

        if (!userQuery.empty) {
            client = { ...userQuery.docs[0].data(), uid: userQuery.docs[0].id };
        } else {
            // Search Leads (using flat 'phone' field)
            const leadQuery = await db.collection('leads')
                .where('phone', 'in', [fromPhone, strippedPhone])
                .limit(1).get();

            if (!leadQuery.empty) {
                client = { ...leadQuery.docs[0].data(), uid: leadQuery.docs[0].id };
                isLead = true;
            }
        }

        if (client) {
            // 3. Persist Message to Global Feed
            // Note: For INBOUND messages, status is 'delivered'.
            await db.collection('messages').add({
                threadId: `thread_${client.uid}`,
                senderId: client.uid,
                receiverId: client.realtorId || 'system',
                content: text,
                channel: 'SMS',
                status: 'delivered',
                direction: 'inbound',
                providerId: id,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                requires_action: isLead // Set action required if it's a lead msg
            });

            // 4. Auto-Log to Activity Timeline
            const targetCollection = isLead ? 'leads' : 'users';
            await db.collection(targetCollection).doc(client.uid).collection('activity').add({
                type: 'SMS',
                content: text,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                authorId: client.uid
            });

            console.log(`[SMS] Received and logged from: ${fromPhone} for ${isLead ? 'lead' : 'client'}: ${client.displayName || client.fullName}`);
        } else {
            console.log(`[SMS] Received from ${fromPhone} but no consenting client found.`);
        }

        res.status(200).send('Success');
    } catch (error) {
        console.error('[SMS] Webhook error:', error);
        res.status(500).send('Internal Server Error');
    }
});

/**
 * Universal SMS Sender (Replaces processOutboundSms)
 * Triggers when a message is added to 'messages' collection with status: 'pending'.
 * Sends the SMS via Telnyx.
 */
exports.processSmsQueue = functions.firestore
    .document('messages/{messageId}')
    .onCreate(async (snap, context) => {
        const msg = snap.data();
        const db = admin.firestore();

        // 1. Filter: Must be pending SMS
        if (msg.status !== 'pending' || msg.channel !== 'SMS') {
            return null;
        }

        console.log(`[Universal Sender] Processing message ${context.params.messageId} to receiver ${msg.receiverId}`);

        try {
            // 2. Lookup Recipient Phone Number
            // receiverId could be a User or a Lead.

            let toPhone = null;

            // Try Users First
            let docRef = await db.collection('users').doc(msg.receiverId).get();
            if (docRef.exists) {
                const data = docRef.data();
                toPhone = data.phoneNumber || data.phone;
            } else {
                // Try Leads
                docRef = await db.collection('leads').doc(msg.receiverId).get();
                if (docRef.exists) {
                    const data = docRef.data();
                    toPhone = data.phone || data.primaryContact?.phone;
                }
            }

            if (!toPhone) {
                console.error(`[Universal Sender] Recipient ${msg.receiverId} not found (checked users & leads).`);
                await snap.ref.update({ status: 'failed', error: 'Recipient not found' });
                return null;
            }

            // Ensure E.164 format if missing
            if (!toPhone.startsWith('+')) {
                toPhone = '+1' + toPhone.replace(/\D/g, '');
            }

            // 3. Send via Telnyx API
            const telnyxResponse = await telnyx.messages.create({
                from: TELNYX_FROM_NUMBER,
                to: toPhone,
                text: msg.content
            });

            // 4. Update Message Status
            await snap.ref.update({
                status: 'sent',
                providerId: telnyxResponse.data.id,
                sentAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`[Universal Sender] Successfully sent to ${toPhone}. Telnyx ID: ${telnyxResponse.data.id}`);

        } catch (error) {
            console.error(`[Universal Sender] Failed to send:`, error);
            await snap.ref.update({
                status: 'failed',
                error: error.message || 'Unknown error'
            });
        }
    });

/**
 * Reminder Rules Engine
 * Runs every 15 minutes to evaluate active rules against leads and create tasks.
 */
exports.reminderRulesEngine = functions.pubsub.schedule('every 15 minutes').onRun(async (context) => {
    const db = admin.firestore();
    const now = Date.now();

    console.log('[RulesEngine] Starting execution cycle...');

    try {
        // 1. Fetch all enabled and executable rules
        const rulesSnap = await db.collection('reminderRules')
            .where('enabled', '==', true)
            .where('isExecutable', '==', true)
            .get();

        if (rulesSnap.empty) {
            console.log('[RulesEngine] No enabled executable rules found.');
            return null;
        }

        const allRules = rulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[RulesEngine] Found ${allRules.length} active rules.`);

        // 2. Group rules by Realtor to minimize queries
        const realtorIds = [...new Set(allRules.map(r => r.realtorId))];

        for (const realtorId of realtorIds) {
            const realtorRules = allRules.filter(r => r.realtorId === realtorId);

            // 3. Fetch all leads for this realtor
            const leadsSnap = await db.collection('leads')
                .where('realtorId', '==', realtorId)
                .get();

            if (leadsSnap.empty) continue;

            const leads = leadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`[RulesEngine] Processing ${leads.length} leads for realtor ${realtorId}`);

            for (const lead of leads) {
                for (const rule of realtorRules) {
                    await evaluateRule(lead, rule, db, now);
                }
            }
        }

        console.log('[RulesEngine] Execution cycle completed.');
        return null;
    } catch (error) {
        console.error('[RulesEngine] Critical failure:', error);
        throw error; // Let Firebase handle retries/alerts
    }
});

/**
 * Evaluates a single rule against a lead.
 * Currently supports 'not_exists' operator for time-based triggers.
 */
async function evaluateRule(lead, rule, db, now) {
    // 1. Duplicate Check: Has this rule already generated a pending task for this lead?
    // We check for tasks with this specific ruleId in metadata to avoid spamming the realtor
    const existingTask = await db.collection('tasks')
        .where('clientId', '==', lead.id)
        .where('metadata.generatedByRule', '==', rule.id)
        .where('status', '==', 'Pending')
        .limit(1).get();

    if (!existingTask.empty) return;

    // 2. Parse Fields (remove 'leads.' prefix if present)
    const triggerField = rule.triggerField?.replace('leads.', '');
    const triggerVal = lead[triggerField];
    if (!triggerVal) return;

    // Convert Firestore Timestamp to JS Date
    const triggerDate = triggerVal.toDate ? triggerVal.toDate().getTime() : new Date(triggerVal).getTime();

    const condField = rule.conditionField?.replace('leads.', '');
    const condVal = lead[condField];

    const intervalMs = parseInterval(rule.value);

    // Logic for 'not_exists' (e.g., No response within X minutes after Lead Creation)
    if (rule.operator === 'not_exists') {
        const timeElapsed = now - triggerDate;

        // IF (Time since trigger > Threshold) AND (Condition field is missing/null)
        if (timeElapsed > intervalMs && !condVal) {
            await createRemindTask(lead, rule, db);
        }
    }
}

/**
 * Creates a CRMTask document based on a triggered rule.
 */
async function createRemindTask(lead, rule, db) {
    const title = `🚨 Action Required: ${rule.name}`;

    // Perform simple template variable replacement
    let description = rule.suggested_action + '\n\n';
    let message = rule.suggested_message || '';
    message = message.replace(/{firstName}/g, lead.firstName || 'Client');
    message = message.replace(/{propertyAddress}/g, lead.propertyAddress || 'the property');

    description += `Suggested Msg: "${message}"`;

    console.log(`[RulesEngine] TRIGGERED: Rule ${rule.id} for lead ${lead.id}`);

    await db.collection('tasks').add({
        realtorId: rule.realtorId,
        clientId: lead.id,
        title: title,
        description: description,
        priority: rule.urgency.charAt(0).toUpperCase() + rule.urgency.slice(1),
        status: 'Pending',
        type: 'Follow-up',
        dueDate: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
            generatedByRule: rule.id,
            triggerName: rule.trigger,
            engineVersion: '1.0'
        }
    });
}

/**
 * Basic human-readable interval parser (e.g., "5 minutes", "24 hours", "7 days")
 */
function parseInterval(value) {
    if (!value || typeof value !== 'string') return 0;
    const parts = value.split(' ');
    const n = parseInt(parts[0]);
    const unit = parts[1]?.toLowerCase() || '';

    if (unit.startsWith('min')) return n * 60 * 1000;
    if (unit.startsWith('hour')) return n * 60 * 60 * 1000;
    if (unit.startsWith('day')) return n * 24 * 60 * 60 * 1000;
    return 0;
}

/**
 * Public API to test Telnyx Webhook with Signature Verification
 * Uses the provided public key: Rj7eIQ1Nly5P3tvhxFVjNUFnshBQWGNZRxC+feFqy1c=
 */
exports.telnyxWebhookTest = functions.https.onRequest((req, res) => {
    const publicKey = 'Rj7eIQ1Nly5P3tvhxFVjNUFnshBQWGNZRxC+feFqy1c=';

    // Telnyx sends the signature and timestamp in headers
    const signature = req.headers['telnyx-signature-ed25519'];
    const timestamp = req.headers['telnyx-timestamp'];
    const rawBodyBuffer = req.rawBody; // Firebase Functions provides the raw buffer

    if (!signature || !timestamp || !rawBodyBuffer) {
        console.error('[TelnyxTest] Missing headers or body');
        return res.status(400).send('Missing headers or body');
    }

    try {
        // We need to use the raw body string for verification
        const rawBody = rawBodyBuffer.toString('utf8');

        // Dynamically import the Webhook class if it's not on the main export
        // Based on the file structure `telnyx/webhooks.js` exports `TelnyxWebhook`
        const { TelnyxWebhook } = require('telnyx/webhooks');

        const webhook = new TelnyxWebhook(publicKey);

        // Verify sends an error if it fails
        webhook.verify(rawBody, req.headers);

        // If we get here, it is verified.
        // We can now safely parse the body
        const event = JSON.parse(rawBody);

        console.log('[TelnyxTest] Webhook Verified Successfully:', event.data?.id);
        console.log('[TelnyxTest] Event Type:', event.data?.event_type);

        // Return success
        return res.status(200).json({ status: 'verified', event: event.data?.event_type });

    } catch (err) {
        console.error('[TelnyxTest] Verification Error:', err.message);
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
    await db.collection('raw_leads').add({
        source,
        realtorId,
        payload: payload || {},
        headers: req.headers || {},
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    // Basic extraction (to be refined per source)
    let leadData = {
        realtorId,
        source: source,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        funnelStage: 'Leads',
        status: 'New',
        leadType: 'Buyer', // Default
        slaUrgency: 'high',
        isMock: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    if (source === 'Zillow') {
        const p = payload || {};
        leadData.firstName = p.First_Name || p.FirstName || p.firstName || '';
        leadData.lastName = p.Last_Name || p.LastName || p.lastName || '';
        leadData.email = p.Email || p.email || '';
        leadData.phone = p.Phone || p.phone || p.phoneNumber || '';
        leadData.propertyAddress = p.Property_Address || p.Address || p.address || '';
        leadData.message = p.Message || p.Comments || '';
    } else if (source === 'Realtor') {
        const p = payload || {};
        leadData.firstName = p.first_name || p.firstName || '';
        leadData.lastName = p.last_name || p.lastName || '';
        leadData.email = p.email || '';
        leadData.phone = p.phone || p.phoneNumber || '';
        leadData.propertyAddress = p.address || '';
    } else if (source === 'Facebook') {
        // Facebook notification
        const p = payload || {};
        leadData.status = 'New (Cold)';
        leadData.notes = 'Lead from Facebook Ad. Run 9-Word Reactivation.';
    }

    if (!leadData.email && !leadData.phone && !leadData.lastName) {
        console.log(`[Ingestion] Insufficient data to create lead.`);
        return;
    }

    // Deduplication check
    const leadsRef = db.collection('leads');
    let existingQuery = null;

    if (leadData.email) {
        existingQuery = await leadsRef.where('realtorId', '==', realtorId).where('email', '==', leadData.email).limit(1).get();
    } else if (leadData.phone) {
        existingQuery = await leadsRef.where('realtorId', '==', realtorId).where('phone', '==', leadData.phone).limit(1).get();
    }

    if (existingQuery && !existingQuery.empty) {
        const existingDoc = existingQuery.docs[0];
        console.log(`[Ingestion] Updating existing lead: ${existingDoc.id}`);
        await existingDoc.ref.update({
            ...leadData,
            receivedAt: existingDoc.data().receivedAt, // Keep original creation date
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
    } else {
        // Create new lead
        if (!leadData.firstName && !leadData.lastName && leadData.email) {
            leadData.firstName = leadData.email.split('@')[0];
        }
        await leadsRef.add(leadData);
        console.log(`[Ingestion] Created new lead: ${leadData.firstName} ${leadData.lastName}`);
    }
}

exports.zillowWebhook = functions.https.onRequest(async (req, res) => {
    const realtorId = req.query.realtorId;
    if (!realtorId) {
        console.error('[Zillow] Missing realtorId in query');
        return res.status(400).send('Missing realtorId');
    }
    await handleLeadIngestion('Zillow', realtorId, req.body, req);
    res.status(200).send('Success');
});

exports.realtorWebhook = functions.https.onRequest(async (req, res) => {
    const realtorId = req.query.realtorId;
    if (!realtorId) {
        console.error('[Realtor] Missing realtorId in query');
        return res.status(400).send('Missing realtorId');
    }
    await handleLeadIngestion('Realtor', realtorId, req.body, req);
    res.status(200).send('Success');
});

exports.facebookWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        if (mode === 'subscribe' && token === 'ZYPHE_FB_VERIFY') {
            return res.status(200).send(challenge);
        }
        return res.status(403).send('Forbidden');
    }

    const realtorId = req.query.realtorId;
    if (!realtorId) {
        console.error('[Facebook] Missing realtorId in query');
        return res.status(400).send('Missing realtorId');
    }

    // Facebook Lead Ads send a notification that a lead was created.
    // We log it and optionally fetch more details.
    await handleLeadIngestion('Facebook', realtorId, req.body, req);
    res.status(200).send('Success');
});

/**
 * Automatically generate semantic embeddings for Knowledge Center content.
 * Triggers on any change to the 'guides' OR 'best_practices' collection.
 */
const generateEmbedding = async (change, context, type) => {
    const after = change.after.exists ? change.after.data() : null;
    const before = change.before.exists ? change.before.data() : null;

    if (!after) return null;

    const contentAfter = typeof after.content === 'object' ? JSON.stringify(after.content) : (after.content || after.subtitle || '');
    const contentBefore = before ? (typeof before.content === 'object' ? JSON.stringify(before.content) : (before.content || before.subtitle || '')) : null;

    if (contentAfter === contentBefore && after.embedding) {
        console.log(`[Embeddings] ${type} content unchanged, skipping.`);
        return null;
    }

    console.log(`[Embeddings] Generating for ${type}: ${after.title}`);

    try {
        const textToEmbed = `Type: ${type}\nTitle: ${after.title}\n\nContent: ${contentAfter}`;
        const result = await embeddingModel.embedContent(textToEmbed);
        const embedding = result.embedding.values;

        await change.after.ref.update({
            embedding: admin.firestore.FieldValue.vector(embedding),
            embeddingVersion: 'gemini-embedding-001',
            indexedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[Embeddings] Successfully updated ${type}: ${after.title}`);
    } catch (error) {
        console.error(`[Embeddings] Failure for ${type}:`, error);
    }
    return null;
};

exports.generateGuideEmbedding = functions.firestore
    .document('guides/{id}')
    .onWrite((change, context) => generateEmbedding(change, context, 'Guide'));

exports.generateBestPracticeEmbedding = functions.firestore
    .document('best_practices/{id}')
    .onWrite((change, context) => generateEmbedding(change, context, 'BestPractice'));

/**
 * Perform a semantic search across Knowledge Center content.
 * This is handled on the server to avoid client SDK version issues and keep API keys secure.
 */
exports.searchKnowledgeBase = functions.https.onCall(async (data, context) => {
    const queryText = data.query;
    if (!queryText || typeof queryText !== 'string') {
        return { results: [] };
    }

    console.log(`[Search] Query: ${queryText}`);

    try {
        const embeddingResult = await embeddingModel.embedContent(queryText);
        const queryVector = embeddingResult.embedding.values;

        const collections = ['guides', 'best_practices'];
        let allResults = [];

        for (const colName of collections) {
            const snapshot = await admin.firestore().collection(colName)
                .findNearest('embedding', admin.firestore.FieldValue.vector(queryVector), {
                    limit: 5,
                    distanceMeasure: 'COSINE'
                })
                .get();

            snapshot.docs.forEach(doc => {
                const docData = doc.data();
                allResults.push({
                    id: doc.id,
                    title: docData.title,
                    slug: docData.slug || doc.id,
                    topicSlug: docData.topicSlug || colName,
                    score: doc.distance || 0
                });
            });
        }

        // Sort by similarity distance (smaller is better for COSINE distance)
        const sortedResults = allResults.sort((a, b) => a.score - b.score).slice(0, 10);
        console.log(`[Search] Found ${sortedResults.length} matches.`);

        return { results: sortedResults };
    } catch (error) {
        console.error('[Search] Error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
