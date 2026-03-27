import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, getBytes } from "firebase/storage";
import { db, auth } from "./config";
import { LeadDocument } from "../../types";

export const uploadLeadCSV = async (realtorId: string, file: File): Promise<LeadDocument | null> => {
    if (!db) return null;

    const storage = getStorage();
    const timestamp = Date.now();
    const storagePath = `realtors/${realtorId}/leads_uploads/${timestamp}_${file.name}`;
    const storageRef = ref(storage, storagePath);

    try {
        // 1. Upload to Storage
        const snapshot = await uploadBytes(storageRef, file);

        // 2. Create Metadata in Firestore
        const docData: Omit<LeadDocument, 'id'> = {
            realtorId,
            name: file.name,
            size: file.size,
            storage_path: snapshot.ref.fullPath,
            file_type: file.type,
            original_filename: file.name,
            created_at: serverTimestamp(),
        };

        // 1. Realtor-nested write
        const docRef = await addDoc(collection(db, "realtors", realtorId, "leads_documents"), docData);

        return {
            id: docRef.id,
            ...docData
        } as LeadDocument;

    } catch (error) {
        console.error("Error uploading lead CSV:", error);
        return null;
    }
};

export const getLeadDocuments = async (realtorId: string): Promise<LeadDocument[]> => {
    if (!db) return [];

    try {
        const rid = realtorId;
        
        // 1. Use nested path
        const nestedSnap = await getDocs(query(
            collection(db, "realtors", rid, "leads_documents"),
            orderBy("created_at", "desc")
        ));
        return nestedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeadDocument));
    } catch (error) {
        console.error("Error fetching lead documents:", error);
        return [];
    }
};

export const getLeadDocumentContent = async (storagePath: string): Promise<string | null> => {
    try {
        // Construct the Firebase Storage media URL manually to use our Vite proxy
        // Format: /storage-proxy/v0/b/{bucket}/o/{encodedPath}?alt=media
        const bucket = "zyphe-af0bf.firebasestorage.app";
        const encodedPath = encodeURIComponent(storagePath);
        const proxyUrl = `/storage-proxy/v0/b/${bucket}/o/${encodedPath}?alt=media`;

        console.log(`[Storage] Fetching via proxy with auth: ${proxyUrl}`);

        // 1. Get the current user's auth token
        const token = await auth?.currentUser?.getIdToken();

        // 2. Fetch through proxy including the security token
        const response = await fetch(proxyUrl, {
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch via proxy: ${response.status} ${errorText}`);
        }

        return await response.text();
    } catch (error) {
        console.error("Error fetching lead document content via proxy:", error);

        // Fallback to getBytes (Official SDK method)
        try {
            console.log("[Storage] Proxy failed or auth error, falling back to getBytes...");
            const storage = getStorage();
            const storageRef = ref(storage, storagePath);
            const arrayBuffer = await getBytes(storageRef);
            const decoder = new TextDecoder("utf-8");
            return decoder.decode(arrayBuffer);
        } catch (fallbackError) {
            console.error("Critical: Both proxy and getBytes failed:", fallbackError);
            return null;
        }
    }
};
