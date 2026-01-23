import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db } from "./config";
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

        const docRef = await addDoc(collection(db, "leads_documents"), docData);

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
        const q = query(
            collection(db, "leads_documents"),
            where("realtorId", "==", realtorId),
            orderBy("created_at", "desc")
        );
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeadDocument));
    } catch (error) {
        console.error("Error fetching lead documents:", error);
        return [];
    }
};
