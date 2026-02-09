import { ref, uploadString, getDownloadURL, uploadBytes, listAll } from 'firebase/storage';
import { storage } from './config';

/**
 * Uploads a base64-encoded image to Firebase Storage and returns the public URL
 * @param base64Data - Base64 data URL (e.g., "data:image/png;base64,...")
 * @param path - Storage path (e.g., "guide-images/hoa/what-happens-if-hoa-fines-go-unpaid.png")
 * @returns Public URL of the uploaded image
 */
export const uploadImageToStorage = async (base64Data: string, path: string): Promise<string> => {
    if (!storage) {
        throw new Error('Firebase Storage is not initialized');
    }

    try {
        // Create a reference to the storage location
        const storageRef = ref(storage, path);

        // Upload the base64 string
        await uploadString(storageRef, base64Data, 'data_url');

        // Get the download URL
        const downloadURL = await getDownloadURL(storageRef);

        console.log(`[Storage] Image uploaded successfully: ${path}`);
        return downloadURL;
    } catch (error: any) {
        console.error(`[Storage] Failed to upload image to ${path}:`, error);
        throw new Error(`Image upload failed: ${error.message}`);
    }
};

/**
 * Generates a storage path for a guide hero image
 * @param topicSlug - Topic slug (e.g., "hoa", "escrow")
 * @param guideSlug - Guide slug (e.g., "what-happens-if-hoa-fines-go-unpaid-california")
 * @returns Storage path
 */
export const getGuideImagePath = (topicSlug: string, guideSlug: string): string => {
    return `guide-images/${topicSlug}/${guideSlug}.png`;
};

/**
 * Uploads a user's profile picture to Firebase Storage and returns the public URL.
 * 
 * @param userId - The user's ID (used for path structure).
 * @param file - The JS File object selected by the user.
 */
export const uploadProfileImage = async (userId: string, file: File): Promise<string> => {
    const storage = (await import('./config')).storage;
    if (!storage) {
        throw new Error('Firebase Storage is not initialized');
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
        throw new Error('Only image files are allowed');
    }

    // Validate file size (e.g., 5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        throw new Error('File size exceeds 5MB limit');
    }

    try {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `avatar_${Date.now()}.${fileExt}`;
        const storagePath = `users/${userId}/profile/${fileName}`;
        const storageRef = ref(storage, storagePath);

        // Upload the file directly
        const snapshot = await uploadBytes(storageRef, file);

        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);

        console.log(`[Storage] Profile image uploaded successfully: ${storagePath}`);
        return downloadURL;
    } catch (error: any) {
        console.error(`[Storage] Failed to upload profile image:`, error);
        throw new Error(error.message || "Failed to upload image");
    }
};

/**
 * Fetches an image from a remote URL and uploads it to Firebase Storage.
 * @param url - The remote URL of the image.
 * @param path - The target path in Firebase Storage.
 * @returns The download URL of the uploaded image.
 */
export const uploadRemoteImageToStorage = async (url: string, path: string): Promise<string> => {
    if (!storage) throw new Error("Firebase Storage not initialized");

    try {
        const storageRef = ref(storage, path);

        // Optimization: Check if the file already exists in storage
        try {
            const existingURL = await getDownloadURL(storageRef);
            if (existingURL) {
                console.log(`[Storage] Skipping download; file already exists at: ${path}`);
                return existingURL;
            }
        } catch (e) {
            // File doesn't exist, proceed with download/upload
        }

        // Fetch the image (with proxy fallback if direct fetch fails due to CORS/etc)
        let blob: Blob;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Status ${response.status}`);
            blob = await response.blob();
        } catch (e: any) {
            console.log(`[Storage] Direct fetch failed for ${url}: ${e.message}. Attempting proxy...`);
            try {
                const { functions } = await import('./firebase/config');
                const { httpsCallable } = await import('firebase/functions');
                if (functions) {
                    const proxyFunc = httpsCallable(functions, 'proxyStreetViewImage');
                    const result: any = await proxyFunc({ url });

                    // Convert base64 from proxy back to blob for uploadBytes
                    const byteCharacters = atob(result.data.base64);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    blob = new Blob([byteArray], { type: result.data.mimeType });
                } else {
                    throw new Error("Functions not initialized");
                }
            } catch (proxyErr: any) {
                console.warn(`[Storage] Both direct and proxy failed for ${url}:`, proxyErr.message);
                throw proxyErr;
            }
        }

        // Upload
        const snapshot = await uploadBytes(storageRef, blob);

        // Get URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error: any) {
        console.error(`[Storage] Failed to upload remote image from ${url}:`, error);
        // Fallback: return the original URL if upload fails so we don't break the app
        return url;
    }
};
/**
 * Lists all unique ZPIDs that have data in the properties/ folder in Storage
 */
export const listPropertiesInStorage = async (): Promise<string[]> => {
    if (!storage) throw new Error("Firebase Storage not initialized");
    try {
        const rootRef = ref(storage, 'properties');
        const listResult = await listAll(rootRef);

        // ZPIDs are the prefixes (folders) under 'properties/'
        return listResult.prefixes.map(prefix => prefix.name);
    } catch (error: any) {
        console.error("[Storage] Failed to list properties:", error);
        return [];
    }
};
