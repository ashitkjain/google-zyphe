import { collection, query, getDocs, addDoc, setDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDoc, orderBy } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import {
    db,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError
} from "./config";
import { requireTenantId } from "./tenantContext";
import { Document, DocumentVersion, FileMetadata } from "../../types";
import { generateMockTransactionDocuments } from "../mockData";
import { logAuditEvent } from "./audit";

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
): Promise<FileMetadata | null> => {
    const storage = getStorage();
    const storagePath = `transactions/${transactionId}/documents/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storagePath);

    try {
        const [snapshot, fileHash] = await Promise.all([
            uploadBytes(storageRef, file),
            computeSHA256(file)
        ]);

        return {
            storage_path: snapshot.ref.fullPath,
            file_type: file.type,
            original_filename: file.name,
            sha256: fileHash
        };
    } catch (error) {
        console.error("Error uploading file:", error);
        return null;
    }
};

export const getDocumentVersions = async (transactionId: string, documentId: string, realtorId?: string): Promise<DocumentVersion[]> => {
    if (!db || !documentId || !transactionId) return [];
    try {
        const rid = requireTenantId(realtorId);
        const snap = await getDocs(query(collection(db, "realtors", rid, "transactions", transactionId, "documents", documentId, "versions")));
        const versions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DocumentVersion));
        return versions.sort((a, b) => (b.version_number || 0) - (a.version_number || 0));
    } catch (error) {
        handleFirestoreError(error, "getDocumentVersions");
        return [];
    }
};

export const getTransactionDocuments = async (transactionId: string, realtorId?: string) => {
    if (!db || !transactionId) return [];
    try {
        const rid = requireTenantId(realtorId);
        const snap = await getDocs(query(
            collection(db, "realtors", rid, "transactions", transactionId, "documents"),
            orderBy("name", "asc")
        ));
        const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document));
        return deduplicateDocuments(all);
    } catch (error) {
        handleFirestoreError(error, "getTransactionDocuments");
        return [];
    }
};

/** Shared deduplication logic */
const deduplicateDocuments = (all: Document[]): Document[] => {
    const seen = new Map<string, Document>();
    for (const document of all) {
        const key = document.name || document.id;
        const existing = seen.get(key);
        if (!existing) {
            seen.set(key, document);
        } else {
            const existingId = existing.id || '';
            const thisId = document.id || '';
            if (thisId > existingId) seen.set(key, document);
        }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const addTransactionDocument = async (transactionId: string, docData: Partial<Document>, realtorId?: string) => {
    if (!db || !transactionId) return null;
    try {
        const rid = requireTenantId(realtorId);
        const payload = {
            ...sanitizeForFirestore(docData),
            transaction_id: transactionId
        };
        const now = serverTimestamp();

        const docRef = await addDoc(collection(db, "realtors", rid, "transactions", transactionId, "documents"), payload);

        if (docData.current_version?.storage_path) {
            const versionData: Omit<DocumentVersion, 'id'> = {
                document_id: docRef.id,
                version_number: 1,
                storage_path: docData.current_version.storage_path,
                original_filename: docData.current_version.original_filename || 'Unknown',
                file_type: docData.current_version.file_type || 'application/octet-stream',
                sha256: docData.current_version.sha256 || '',
                size: docData.current_version.size || 0,
                source: 'UPLOAD',
                created_at: now,
                updated_at: now,
                created_by: 'user'
            };
            await addDoc(collection(db, "realtors", rid, "transactions", transactionId, "documents", docRef.id, "versions"), versionData);
        }

        await logAuditEvent({
            transaction_id: transactionId,
            entity_id: docRef.id,
            entity_type: 'Document',
            action: 'CREATE',
            diff: { after: docData }
        }, rid);

        return {
            id: docRef.id,
            ...docData
        } as Document;
    } catch (error) {
        handleFirestoreError(error, "addTransactionDocument");
        return null;
    }
};

export const updateTransactionDocument = async (transactionId: string, docId: string, updates: Partial<Document>, realtorId?: string) => {
    if (!db || !transactionId || !docId) return false;
    try {
        const rid = requireTenantId(realtorId);
        const sanitized = sanitizeForFirestore(updates);
        const docRef = doc(db, "realtors", rid, "transactions", transactionId, "documents", docId);
        await updateDoc(docRef, sanitized);

        await logAuditEvent({
            transaction_id: transactionId,
            entity_id: docId,
            entity_type: 'Document',
            action: 'UPDATE',
            diff: { after: updates }
        }, rid);

        return true;
    } catch (error) {
        handleFirestoreError(error, "updateTransactionDocument");
        return false;
    }
};

export const addDocumentVersion = async (
    transactionId: string,
    documentId: string,
    file: File,
    realtorId?: string
): Promise<Document | null> => {
    if (!db || !transactionId || !documentId) return null;

    try {
        const rid = requireTenantId(realtorId);
        const uploadResult = await uploadTransactionDocumentFile(transactionId, file);
        if (!uploadResult) throw new Error("File upload failed");

        const docRef = doc(db, "realtors", rid, "transactions", transactionId, "documents", documentId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw new Error("Parent document not found");

        const currentDoc = docSnap.data() as Document;

        const versionsSnap = await getDocs(query(collection(db, "realtors", rid, "transactions", transactionId, "documents", documentId, "versions")));
        const nextVersion = versionsSnap.size + 1;
        const now = serverTimestamp();

        const versionData: Omit<DocumentVersion, 'id'> = {
            document_id: documentId,
            version_number: nextVersion,
            storage_path: uploadResult.storage_path,
            original_filename: uploadResult.original_filename,
            file_type: uploadResult.file_type,
            sha256: uploadResult.sha256,
            size: file.size,
            source: 'UPLOAD',
            created_at: now,
            updated_at: now,
            created_by: 'user'
        };

        const versionRef = await addDoc(collection(db, "realtors", rid, "transactions", transactionId, "documents", documentId, "versions"), versionData);

        await logAuditEvent({
            transaction_id: transactionId,
            entity_id: versionRef.id,
            entity_type: 'DocumentVersion',
            action: 'CREATE',
            diff: { after: versionData }
        }, rid);

        return {
            ...currentDoc,
            current_version: {
                id: versionRef.id,
                ...versionData
            } as DocumentVersion
        };

    } catch (error) {
        console.error("Error adding document version:", error);
        return null;
    }
};

export const deleteTransactionDocument = async (transactionId: string, docId: string, realtorId?: string) => {
    if (!db || !transactionId || !docId) return false;
    try {
        const rid = requireTenantId(realtorId);

        const versions = await getDocumentVersions(transactionId, docId, rid);

        for (const version of versions) {
            if (version.storage_path) {
                const storage = getStorage();
                const fileRef = ref(storage, version.storage_path);
                try {
                    await deleteObject(fileRef);
                    console.log("Deleted file from storage:", version.storage_path);
                } catch (storeError) {
                    console.warn("Failed to delete file from storage:", storeError);
                }
            }
        }

        const docRef = doc(db, "realtors", rid, "transactions", transactionId, "documents", docId);
        await deleteDoc(docRef);

        await logAuditEvent({
            transaction_id: transactionId,
            entity_id: docId,
            entity_type: 'Document',
            action: 'DELETE'
        }, rid);

        return true;
    } catch (error) {
        handleFirestoreError(error, "deleteTransactionDocument");
        return false;
    }
};

export const seedDocumentsForTransaction = async (transactionId: string, realtorId?: string) => {
    if (!db) return;
    try {
        const rid = requireTenantId(realtorId);
        const existing = await getTransactionDocuments(transactionId, rid);
        if (existing.length > 0) {
            console.log(`[seedDocumentsForTransaction] Skipping — ${existing.length} documents already exist for tx: ${transactionId}`);
            return;
        }
        const MOCK_DOCUMENTS_DATA = generateMockTransactionDocuments(transactionId);
        console.log(`[seedDocumentsForTransaction] Starting seed for tx: ${transactionId} with ${MOCK_DOCUMENTS_DATA.length} docs`);
        for (const document of MOCK_DOCUMENTS_DATA) {
            const slug = (document.name || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_');
            const deterministicId = `txdoc_${transactionId}_${slug}`;
            const payload = sanitizeForFirestore({
                ...document,
                id: deterministicId,
                transaction_id: transactionId,
            });
            const docRef = doc(db, "realtors", rid, "transactions", transactionId, "documents", deterministicId);
            const snap = await getDoc(docRef);
            if (!snap.exists()) await setDoc(docRef, payload);
        }
    } catch (error) {
        console.error("Error seeding documents:", error);
    }
};
