const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

/**
 * Telnyx Webhook for Real-Time SMS Interaction
 * 
 * This function receives incoming SMS messages from Telnyx,
 * matches the sender to a client in Firestore, and logs the
 * message to the Communication Hub and Client Timeline.
 */
exports.telnyxWebhook = functions.https.onRequest(async (req, res) => {
    const payload = req.body.data;

    // 1. Verify it's an incoming message
    if (!payload || payload.event_type !== 'message.received') {
        return res.status(200).send('Ignored');
    }

    try {
        const { from, text, id, to } = payload.payload;
        const fromPhone = from.phone_number;

        // 2. Find the client by phone number
        // We check both the 'users' (Buyer/Seller) and potentially 'leads' collection
        const userQuery = await admin.firestore().collection('users')
            .where('phoneNumber', '==', fromPhone)
            .limit(1).get();

        let client = !userQuery.empty ? { ...userQuery.docs[0].data(), uid: userQuery.docs[0].id } : null;

        if (client && client.smsConsent) {
            // 3. Persist Message to Global Feed
            await admin.firestore().collection('messages').add({
                threadId: `thread_${client.uid}`,
                senderId: client.uid,
                receiverId: client.realtorId || 'system',
                content: text,
                channel: 'SMS',
                status: 'delivered',
                providerId: id,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            // 4. Auto-Log to Activity Timeline for the specific client
            await admin.firestore().collection('users').doc(client.uid).collection('activity').add({
                type: 'SMS',
                content: text,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                authorId: client.uid
            });

            console.log(`[SMS] Received and logged from: ${fromPhone} for client: ${client.displayName}`);
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
