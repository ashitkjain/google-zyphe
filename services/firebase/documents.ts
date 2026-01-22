import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import {
    db,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError
} from "./config";
import { Document, DocumentVersion } from "../../types";
import { generateMockTransactionDocuments } from "../mockData";

export type TransactionDocument = Document;

// Helper to get a secure download URL
export const getDocumentDownloadUrl = async (storagePath: string): Promise<string | null> => {
    if (!storagePath) return null;
    const storage = getStorage();
    const fileRef = ref(storage, storagePath);
    try {
        const url = await getDownloadURL(fileRef);
        return url;
    } catch (error) {
        console.error("Error getting download URL:", error);
        return null;
    }
};

// Helper to compute SHA-256 hash
const computeSHA256 = async (file: File): Promise<string> => {
    try {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
        console.warn("Failed to compute SHA-256 hash:", error);
        return "";
    }
};

export const uploadTransactionDocumentFile = async (
    transactionId: string,
    file: File
): Promise<{ storage_path: string; file_type: string; file_name: string; file_hash: string } | null> => {
    const storage = getStorage();
    // Path: transactions/{transactionId}/documents/{timestamp}_{filename}
    // Using timestamp to avoid naming collisions
    const storagePath = `transactions/${transactionId}/documents/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storagePath);

    try {
        const [snapshot, fileHash] = await Promise.all([
            uploadBytes(storageRef, file),
            computeSHA256(file)
        ]);

        return {
            storage_path: snapshot.ref.fullPath, // Use fullPath to store
            file_type: file.type,
            file_name: file.name,
            file_hash: fileHash
        };
    } catch (error) {
        console.error("Error uploading file:", error);
        return null;
    }
};

export const getTransactionDocuments = async (transactionId: string) => {
    if (!db || !transactionId) return [];
    try {
        logFirestoreQuery('getDocs', 'transaction_documents', { transaction_id: transactionId });
        const q = query(
            collection(db, "transaction_documents"),
            where("transaction_id", "==", transactionId)
        );
        const snap = await getDocs(q);

        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionDocument));
        // Sort by created_at in memory
        return docs.sort((a, b) => {
            const getTime = (val: any) => {
                if (!val) return 0;
                if (val.toDate && typeof val.toDate === 'function') {
                    return val.toDate().getTime(); // Firestore Timestamp
                }
                if (val instanceof Date) {
                    return val.getTime(); // JS Date
                }
                if (typeof val === 'string') {
                    return new Date(val).getTime(); // ISO String
                }
                return 0;
            };

            return getTime(a.created_at) - getTime(b.created_at);
        });
    } catch (error) {
        handleFirestoreError(error, "getTransactionDocuments");
        return [];
    }
};

export const addTransactionDocument = async (transactionId: string, docData: Partial<TransactionDocument>) => {
    if (!db || !transactionId) return null;
    try {
        logFirestoreQuery('addDoc', 'transaction_documents', docData);
        const now = serverTimestamp();
        const docRef = await addDoc(collection(db, "transaction_documents"), {
            ...sanitizeForFirestore(docData),
            transaction_id: transactionId,
            current_version_number: docData.storage_path ? 1 : 0,
            created_at: now,
            updated_at: now
        });

        // If initial document has a file, create Version 1 record in subcollection
        if (docData.storage_path) {
            const versionData: Omit<DocumentVersion, 'id'> = {
                document_id: docRef.id,
                version_number: 1,
                storage_path: docData.storage_path,
                file_name: docData.file_name || 'Unknown',
                file_type: docData.file_type || 'application/octet-stream',
                file_hash: docData.file_hash || '',
                size: 0,
                created_at: now,
                created_by: 'user'
            };
            await addDoc(collection(db, "transaction_documents", docRef.id, "versions"), versionData);
        }

        return {
            id: docRef.id,
            ...docData,
            current_version_number: docData.storage_path ? 1 : 0,
            created_at: new Date(),
            updated_at: new Date()
        } as TransactionDocument;
    } catch (error) {
        handleFirestoreError(error, "addTransactionDocument");
        return null;
    }
};

export const updateTransactionDocument = async (transactionId: string, docId: string, updates: Partial<TransactionDocument>) => {
    if (!db || !transactionId || !docId) return false;
    try {
        logFirestoreQuery('updateDoc', 'transaction_documents', { docId });
        const docRef = doc(db, "transaction_documents", docId);

        // Auto-update timestamp
        const updatesWithTimestamp = {
            ...sanitizeForFirestore(updates),
            updated_at: serverTimestamp()
        };

        await updateDoc(docRef, updatesWithTimestamp);
        return true;
    } catch (error) {
        handleFirestoreError(error, "updateTransactionDocument");
        return false;
    }
};

export const addDocumentVersion = async (
    transactionId: string,
    documentId: string,
    file: File
): Promise<TransactionDocument | null> => {
    if (!db || !transactionId || !documentId) return null;

    try {
        // 1. Upload File
        const uploadResult = await uploadTransactionDocumentFile(transactionId, file);
        if (!uploadResult) throw new Error("File upload failed");

        // 2. Compute Metadata
        const docRef = doc(db, "transaction_documents", documentId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) throw new Error("Parent document not found");

        const currentDoc = docSnap.data() as TransactionDocument;
        const nextVersion = (currentDoc.current_version_number || 0) + 1;
        const now = serverTimestamp();

        // 3. Create Version Record
        const versionData: Omit<DocumentVersion, 'id'> = {
            document_id: documentId,
            version_number: nextVersion,
            storage_path: uploadResult.storage_path,
            file_name: uploadResult.file_name,
            file_type: uploadResult.file_type,
            file_hash: uploadResult.file_hash,
            size: file.size,
            created_at: now,
            created_by: 'user' // TODO: Pass actual user ID
        };

        await addDoc(collection(db, "transaction_documents", documentId, "versions"), versionData);

        // 4. Update Parent Document with Latest File Info
        const parentUpdates: Partial<TransactionDocument> = {
            storage_path: uploadResult.storage_path,
            file_name: uploadResult.file_name,
            file_type: uploadResult.file_type,
            file_hash: uploadResult.file_hash,
            current_version_number: nextVersion,
            updated_at: now
        };

        await updateDoc(docRef, parentUpdates);

        // Return updated document structure for UI
        return {
            ...currentDoc,
            ...parentUpdates,
            updated_at: new Date() // Optimistic date
        };

    } catch (error) {
        console.error("Error adding document version:", error);
        return null;
    }
};

export const deleteTransactionDocument = async (transactionId: string, docId: string) => {
    if (!db || !transactionId || !docId) return false;
    try {
        const docRef = doc(db, "transaction_documents", docId);

        // 1. Fetch document to get storage path
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const docData = docSnap.data() as TransactionDocument;
            // 2. Delete from storage if path exists
            if (docData.storage_path) {
                const storage = getStorage();
                const fileRef = ref(storage, docData.storage_path);
                try {
                    await deleteObject(fileRef);
                    console.log("Deleted file from storage:", docData.storage_path);
                } catch (storeError) {
                    console.warn("Failed to delete file from storage (might act orphaned):", storeError);
                }
            }
        }

        // 3. Delete Metadata from Firestore
        logFirestoreQuery('deleteDoc', 'transaction_documents', { docId });
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        handleFirestoreError(error, "deleteTransactionDocument");
        return false;
    }
};

export const seedDocumentsForTransaction = async (transactionId: string) => {
    if (!db) return;
    const MOCK_DOCUMENTS_DATA = generateMockTransactionDocuments(transactionId);

    try {
        console.log(`[seedDocumentsForTransaction] Starting seed for tx: ${transactionId} with ${MOCK_DOCUMENTS_DATA.length} docs`);
        for (const doc of MOCK_DOCUMENTS_DATA) {
            await addTransactionDocument(transactionId, doc as any);
        }
    } catch (error) {
        console.error("Error seeding documents:", error);
    }
};
