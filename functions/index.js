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
