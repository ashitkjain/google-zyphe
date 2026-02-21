import { collection, query, where, getDocs, addDoc, setDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import {
    db,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError
} from "./config";
import { Document, DocumentVersion, FileMetadata } from "../../types";
import { generateMockTransactionDocuments } from "../mockData";
import { logAuditEvent } from "./audit";

// Helper to get a secure download URL

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

export const getDocumentWithVersions = async (docId: string): Promise<Document | null> => {
    if (!db || !docId) return null;
    try {
        const docRef = doc(db, "transaction_documents", docId);
        const [docSnap, versions] = await Promise.all([
            getDoc(docRef),
            getDocumentVersions(docId)
        ]);

        if (!docSnap.exists()) return null;

        return {
            id: docSnap.id,
            ...docSnap.data(),
            current_version: versions[0] || null
        } as Document;
    } catch (error) {
        handleFirestoreError(error, "getDocumentWithVersions");
        return null;
    }
};

export const uploadTransactionDocumentFile = async (
    transactionId: string,
    file: File
): Promise<FileMetadata | null> => {
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

export const getDocumentVersions = async (documentId: string): Promise<DocumentVersion[]> => {
    if (!db || !documentId) return [];
    try {
        logFirestoreQuery('getDocs', `transaction_documents/${documentId}/versions`, {});
        const q = query(collection(db, "transaction_documents", documentId, "versions"));
        const snap = await getDocs(q);
        const versions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DocumentVersion));

        // Sort by version number descending
        return versions.sort((a, b) => (b.version_number || 0) - (a.version_number || 0));
    } catch (error) {
        handleFirestoreError(error, "getDocumentVersions");
        return [];
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
        const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document));

        // Deduplicate: keep only the most recent document per name (handles double-seeding)
        const seen = new Map<string, Document>();
        for (const document of all) {
            const key = document.name || document.id;
            const existing = seen.get(key);
            if (!existing) {
                seen.set(key, document);
            } else {
                // Prefer whichever was created later (no created_at on parent — fall back to id compare)
                const existingId = existing.id || '';
                const thisId = document.id || '';
                if (thisId > existingId) seen.set(key, document); // Firestore auto-IDs are roughly time-ordered
            }
        }
        // Sort by name since created_at is removed from parent
        return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        handleFirestoreError(error, "getTransactionDocuments");
        return [];
    }
};

export const addTransactionDocument = async (transactionId: string, docData: Partial<Document>) => {
    if (!db || !transactionId) return null;
    try {
        logFirestoreQuery('addDoc', 'transaction_documents', docData);
        const now = serverTimestamp();
        const docRef = await addDoc(collection(db, "transaction_documents"), {
            ...sanitizeForFirestore(docData),
            transaction_id: transactionId
        });

        // If initial document has a file, create Version 1 record in subcollection
        // If initial document has a file, create Version 1 record in subcollection
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
            await addDoc(collection(db, "transaction_documents", docRef.id, "versions"), versionData);
        }

        // Log Audit
        await logAuditEvent({
            transaction_id: transactionId,
            entity_id: docRef.id,
            entity_type: 'Document',
            action: 'CREATE',
            diff: { after: docData }
        });

        return {
            id: docRef.id,
            ...docData
        } as Document;
    } catch (error) {
        handleFirestoreError(error, "addTransactionDocument");
        return null;
    }
};

export const updateTransactionDocument = async (transactionId: string, docId: string, updates: Partial<Document>) => {
    if (!db || !transactionId || !docId) return false;
    try {
        logFirestoreQuery('updateDoc', 'transaction_documents', { docId });
        const docRef = doc(db, "transaction_documents", docId);

        await updateDoc(docRef, sanitizeForFirestore(updates));

        // Log Audit
        await logAuditEvent({
            transaction_id: transactionId,
            entity_id: docId,
            entity_type: 'Document',
            action: 'UPDATE',
            diff: { after: updates }
        });

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
): Promise<Document | null> => {
    if (!db || !transactionId || !documentId) return null;

    try {
        // 1. Upload File
        const uploadResult = await uploadTransactionDocumentFile(transactionId, file);
        if (!uploadResult) throw new Error("File upload failed");

        // 2. Compute Metadata
        const docRef = doc(db, "transaction_documents", documentId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) throw new Error("Parent document not found");

        const currentDoc = docSnap.data() as Document;
        // Get next version number by querying subcollection
        const versionsSnap = await getDocs(query(collection(db, "transaction_documents", documentId, "versions")));
        const nextVersion = versionsSnap.size + 1;
        const now = serverTimestamp();

        // 3. Create Version Record
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
            created_by: 'user' // TODO: Pass actual user ID
        };

        const versionRef = await addDoc(collection(db, "transaction_documents", documentId, "versions"), versionData);

        // Log Audit
        await logAuditEvent({
            transaction_id: transactionId,
            entity_id: versionRef.id,
            entity_type: 'DocumentVersion',
            action: 'CREATE',
            diff: { after: versionData }
        });

        // 4. Return updated document structure for UI (Zero redundancy in parent)
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

export const deleteTransactionDocument = async (transactionId: string, docId: string) => {
    if (!db || !transactionId || !docId) return false;
    try {
        const docRef = doc(db, "transaction_documents", docId);

        // 1. Fetch versions to delete files from storage
        const versions = await getDocumentVersions(docId);

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

        // 3. Delete Metadata from Firestore
        logFirestoreQuery('deleteDoc', 'transaction_documents', { docId });
        await deleteDoc(docRef);

        // Log Audit
        await logAuditEvent({
            transaction_id: transactionId,
            entity_id: docId,
            entity_type: 'Document',
            action: 'DELETE'
        });

        return true;
    } catch (error) {
        handleFirestoreError(error, "deleteTransactionDocument");
        return false;
    }
};

export const seedDocumentsForTransaction = async (transactionId: string) => {
    if (!db) return;
    try {
        // Guard: skip seeding if documents already exist for this transaction
        const existing = await getTransactionDocuments(transactionId);
        if (existing.length > 0) {
            console.log(`[seedDocumentsForTransaction] Skipping — ${existing.length} documents already exist for tx: ${transactionId}`);
            return;
        }
        const MOCK_DOCUMENTS_DATA = generateMockTransactionDocuments(transactionId);
        console.log(`[seedDocumentsForTransaction] Starting seed for tx: ${transactionId} with ${MOCK_DOCUMENTS_DATA.length} docs`);
        for (const document of MOCK_DOCUMENTS_DATA) {
            // Deterministic ID: txdoc_{transactionId}_{slugifiedName} — setDoc is idempotent
            const slug = (document.name || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_');
            const deterministicId = `txdoc_${transactionId}_${slug}`;
            const docRef = doc(db, "transaction_documents", deterministicId);
            await setDoc(docRef, sanitizeForFirestore({
                ...document,
                id: deterministicId,
                transaction_id: transactionId,
            }), { merge: true });
        }
    } catch (error) {
        console.error("Error seeding documents:", error);
    }
};
