import { db } from './firebase/config';
import { collection, doc, setDoc, getDoc, getDocs, query, where, updateDoc, addDoc, serverTimestamp, orderBy, onSnapshot } from 'firebase/firestore';
import { ClientPortal, PortalProperty, PropertyComment, ActivityLog, PropertyStatus } from '../types/portal';

// === PORTAL MANAGEMENT ===

export async function createClientPortal(
    agentId: string, 
    clientName: string, 
    clientEmail: string, 
    message?: string,
    initialProperties: { zpid: string, address: string }[] = [],
    extraFields: Record<string, any> = {}
): Promise<{ id: string; accessToken: string }> {
    if (!db) throw new Error('[portalService] Firestore is not initialized');
    const portalRef = doc(collection(db, 'client_portals'));
    const token = crypto.randomUUID(); // Secure token for URL
    
    const portal: Omit<ClientPortal, 'id'> = {
        agentId,
        clientName,
        clientEmail,
        accessToken: token,
        status: 'active',
        messageFromAgent: message,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...extraFields,
    };

    await setDoc(portalRef, portal);

    // Add initial properties
    const promises = initialProperties.map(p => {
        const propRef = doc(collection(db!, `client_portals/${portalRef.id}/portal_properties`), p.zpid);
        const pp: Omit<PortalProperty, 'id'> = {
            portalId: portalRef.id,
            zpid: p.zpid,
            address: p.address,
            status: 'suggested_by_agent',
            addedBy: 'agent',
            updatedAt: serverTimestamp(),
        };
        return setDoc(propRef, pp);
    });

    await Promise.all(promises);
    return { id: portalRef.id, accessToken: token };
}

export async function getPortalByToken(token: string): Promise<ClientPortal | null> {
    if (!db) return null;
    // Single-field query only — avoids requiring a composite Firestore index.
    // status check is done client-side.
    const q = query(collection(db, 'client_portals'), where('accessToken', '==', token));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const d = snapshot.docs[0];
    const data = { id: d.id, ...d.data() } as ClientPortal;

    // Only serve active portals
    if (data.status !== 'active') return null;

    return data;
}

// === PROPERTY STATUS ===

export async function updatePropertyStatus(
    portalId: string,
    zpid: string,
    address: string,
    status: PropertyStatus,
    actor: 'agent' | 'client',
    agentId?: string,
    meta?: { thumbnailUrl?: string; listingUrl?: string; price?: number; beds?: number; baths?: number }
) {
    if (!db) throw new Error('[portalService] Firestore is not initialized');
    const propRef = doc(collection(db, `client_portals/${portalId}/portal_properties`), zpid);
    const snap = await getDoc(propRef);
    
    if (snap.exists()) {
        await updateDoc(propRef, {
            status,
            updatedAt: serverTimestamp(),
            ...(meta || {})
        });
    } else {
        await setDoc(propRef, {
            portalId,
            zpid,
            address,
            status,
            addedBy: actor,
            updatedAt: serverTimestamp(),
            ...(meta || {})
        });
    }

    if (actor === 'client' && agentId) {
        await logActivity(portalId, agentId, 'status_changed', `Changed status to ${status}`, zpid);
    }
}

/**
 * Fetches the first secured thumbnail URL and basic stats (price, beds, baths)
 * for a given zpid from Firestore. Returns null gracefully if unavailable.
 */
export async function fetchPortalPropertyMeta(zpid: string): Promise<{
    thumbnailUrl?: string;
    listingUrl?: string;
    price?: number;
    beds?: number;
    baths?: number;
} | null> {
    if (!db) return null;
    try {
        // Try nested assets doc first
        const assetRef = doc(db, 'properties', zpid, 'analysis', 'assets');
        const assetSnap = await getDoc(assetRef);
        let images: string[] = [];
        if (assetSnap.exists()) {
            images = assetSnap.data().images || [];
        } else {
            // Legacy fallback
            const legacyRef = doc(db, 'property_assets', zpid);
            const legacySnap = await getDoc(legacyRef);
            if (legacySnap.exists()) images = legacySnap.data().images || [];
        }

        // Read basic stats from property doc
        const propRef = doc(db, 'properties', zpid);
        const propSnap = await getDoc(propRef);
        const propData = propSnap.exists() ? propSnap.data() : {};

        const securedThumbnail = images.find((u: string) => u?.includes('firebasestorage'));

        return {
            thumbnailUrl: securedThumbnail,
            listingUrl: propData.hdpUrl || `https://www.zillow.com/homes/${zpid}_zpid/`,
            price: propData.price ?? propData.zestimate,
            beds: propData.bedrooms,
            baths: propData.bathrooms,
        };
    } catch (e) {
        console.warn('[portalService] fetchPortalPropertyMeta failed:', e);
        return null;
    }
}

// === COMMENTS ===

export async function addPropertyComment(portalId: string, zpid: string, authorRole: 'agent' | 'client', authorName: string, text: string, agentId?: string) {
    const commentRef = collection(db, `client_portals/${portalId}/portal_properties/${zpid}/comments`);
    
    await addDoc(commentRef, {
        portalId,
        zpid,
        authorRole,
        authorName,
        text,
        timestamp: serverTimestamp()
    });

    if (authorRole === 'client' && agentId) {
        await logActivity(portalId, agentId, 'commented', `Added a comment`, zpid);
    }
}

export function subscribeToComments(portalId: string, zpid: string, callback: (comments: PropertyComment[]) => void) {
    const q = query(
        collection(db, `client_portals/${portalId}/portal_properties/${zpid}/comments`),
        orderBy('timestamp', 'asc')
    );
    
    return onSnapshot(q, (snapshot) => {
        const comments = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PropertyComment));
        callback(comments);
    });
}

export function subscribeToPortalProperties(portalId: string, callback: (props: PortalProperty[]) => void) {
    const q = query(collection(db, `client_portals/${portalId}/portal_properties`));
    
    return onSnapshot(q, (snapshot) => {
        const props = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PortalProperty));
        callback(props);
    });
}

// === ACTIVITY LOGGING ===

export async function logActivity(portalId: string, agentId: string, action: ActivityLog['action'], details: string, zpid?: string) {
    const logRef = collection(db, 'activity_logs');
    await addDoc(logRef, {
        portalId,
        agentId,
        action,
        details,
        zpid,
        timestamp: serverTimestamp()
    });
}
