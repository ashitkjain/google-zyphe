import { collection, addDoc, setDoc, doc, query, getDocs, orderBy, where, limit, updateDoc, serverTimestamp } from "firebase/firestore";
import {
    db,
    logFirestoreQuery
} from "./config";
import { requireTenantId } from "./tenantContext";
import { MessageEvent, ReactivationMessage } from "../../types";

export const sendInviteEmail = async (email: string, subject: string, html: string) => {
    if (!db) return { success: false, error: "Database not initialized" };
    try {
        const mailCol = collection(db, "mail");
        logFirestoreQuery('addDoc', 'mail', { to: email });
        await addDoc(mailCol, {
            to: email,
            message: {
                subject: subject,
                html: html,
            }
        });
        return { success: true };
    } catch (error) {
        console.error("Error queueing email:", error);
        return { success: false, error: (error as Error).message };
    }
};

/**
 * Logs a message event to the 'message_events' collection.
 * This tracks the granular lifecycle of messages (sent, delivered, failed, etc).
 */
export const logMessageEvent = async (event: MessageEvent) => {
    if (!db) return { success: false, error: "Database not initialized" };

    try {
        // Use event_id as the document ID if possible, otherwise let Firestore generate one
        // and ensure the field is present.
        const collectionName = "message_events";

        if (event.event_id) {
            const eventRef = doc(db, collectionName, event.event_id);
            logFirestoreQuery('setDoc', collectionName, { id: event.event_id, type: event.event_type });
            await setDoc(eventRef, event);
        } else {
            // Fallback if no UUID provided, though type definition expects it.
            const colRef = collection(db, collectionName);
            logFirestoreQuery('addDoc', collectionName, { type: event.event_type });
            await addDoc(colRef, event);
        }

        return { success: true };
    } catch (error) {
        console.error("Error logging message event:", error);
        return { success: false, error: (error as Error).message };
    }
};

/**
 * Saves a reactivation message record to the 'reactivation_messages' collection.
 */
/**
 * Saves a message to the 'messages' collection.
 * Replaces saveReactivationMessage.
 * If status is 'pending' and channel is 'SMS', Cloud Functions will send it.
 */
export const saveReactivationMessage = async (data: any) => {
    if (!db) return { success: false, error: "Database not initialized" };

    try {
        const rid = requireTenantId(data.realtorId);
        const collectionName = "messages";
        const msgRef = doc(db, "realtors", rid, collectionName, data.message_id);

        const isInbound = data.isInbound || false;

        const payload = {
            threadId: data.thread_id || `thread_${data.lead_id}`,
            senderId: isInbound ? data.lead_id : data.realtorId,
            receiverId: isInbound ? data.realtorId : data.lead_id,
            lead_id: data.lead_id, // Explicit top-level lead_id
            lead_name: data.lead_name || null,
            content: data.content,
            channel: data.channel?.toUpperCase() || 'SMS',
            status: isInbound ? 'received' : (data.status || 'pending'),
            timestamp: data.sent_at || serverTimestamp(),
            direction: isInbound ? 'inbound' : 'outbound',
            isInbound: isInbound, // Explicit boolean for TrailModule

            // Additional logic fields
            from_reactivation_portal: true,
            requires_action: data.requires_action ?? (isInbound ? true : false),
            sentiment: data.sentiment || null
        };



        await setDoc(msgRef, payload, { merge: true });
        return { success: true };
    } catch (error) {
        console.error("Error saving message:", error);
        return { success: false, error: (error as Error).message };
    }
};

/**
 * Retrieves messages for a specific lead (thread).
 */
export const getReactivationMessages = async (realtorId: string, leadId?: string, limitCount: number = 50) => {
    if (!db) return [];

    try {
        const rid = requireTenantId(realtorId);
        const collectionName = "messages";
        const colRef = collection(db, "realtors", rid, collectionName);

        let q;
        if (leadId) {
            q = query(
                colRef,
                where("receiverId", "==", leadId), // Outbound
                // Note: Getting BOTH inbound and outbound requires a threadId query or OR query
                // For now, let's try querying by threadId if available
                // where("threadId", "==", `thread_${leadId}`),
                orderBy("timestamp", "desc"),
                limit(limitCount)
            );
            // Simpler: Just get by threadId
            q = query(
                colRef,
                where("threadId", "==", `thread_${leadId}`),
                orderBy("timestamp", "desc"),
                limit(limitCount)
            );
        } else {
            // No lead specified — get all messages for this realtor
            // Under subcollection, all messages in /realtors/{rid}/messages are for this realtor
            q = query(
                colRef,
                orderBy("timestamp", "desc"),
                limit(limitCount)
            );
        }

        logFirestoreQuery('getDocs', collectionName, { realtorId, leadId, limit: limitCount });
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                // Map 'messages' fields to 'ReactivationMessage' format
                sent_at: data.timestamp,
                isInbound: data.direction === 'inbound' || (leadId && data.senderId === leadId),
                channel: data.channel ? data.channel.toLowerCase() : 'sms'
            };
        });
    } catch (error) {
        console.error("Error fetching messages:", error);
        return [];
    }
};

/**
 * Gets inbound messages that require action from the agent.
 */
export const getActionRequiredMessages = async (realtorId: string, limitCount: number = 20) => {
    if (!db) return [];

    try {
        const rid = requireTenantId(realtorId);
        const collectionName = "messages";
        const colRef = collection(db, "realtors", rid, collectionName);

        // Messages are already scoped to this realtor's subcollection.
        // Just filter by requires_action.
        const q = query(
            colRef,
            where("requires_action", "==", true),
            limit(limitCount)
        );

        logFirestoreQuery('getDocs', collectionName, { realtorId, requires_action: true });
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                sent_at: data.timestamp,
                isInbound: true // These are filtered for 'receiverId == realtorId', so they are inbound
            };
        });
    } catch (error) {
        console.error("Error fetching action required messages:", error);
        return [];
    }
};

/**
 * Marks an action as completed when the agent responds.
 */
export const completeMessageAction = async (messageId: string, completedAt: any, realtorId?: string) => {
    if (!db) return { success: false, error: "Database not initialized" };

    try {
        const rid = requireTenantId(realtorId);
        const collectionName = "messages";
        const msgRef = doc(db, "realtors", rid, collectionName, messageId);

        logFirestoreQuery('updateDoc', collectionName, { id: messageId });
        await updateDoc(msgRef, {
            requires_action: false,
            action_completed_at: completedAt
        });

        return { success: true };
    } catch (error) {
        console.error("Error completing message action:", error);
        return { success: false, error: (error as Error).message };
    }
};

/**
 * Creates a thread ID for a new conversation.
 */
export const createThreadId = (leadId: string, realtorId: string): string => {
    return `thread_${leadId}`; // Simplified to match webhook logic
};
