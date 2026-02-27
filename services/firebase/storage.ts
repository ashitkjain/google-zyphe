import { ref, uploadString, getDownloadURL, uploadBytes, listAll, deleteObject } from 'firebase/storage';
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
 * Deletes a file from Firebase Storage at the given path.
 * Silently succeeds if the file doesn't exist.
 */
export const deleteFileFromStorage = async (path: string): Promise<void> => {
    if (!storage) return;
    try {
        const storageRef = ref(storage, path);
        await deleteObject(storageRef);
        console.log(`[Storage] Deleted: ${path}`);
    } catch (error: any) {
        // object-not-found is fine — nothing to delete
        if (error?.code !== 'storage/object-not-found') {
            console.warn(`[Storage] Failed to delete ${path}:`, error.message || error);
        }
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
            // 404 = file not yet in Firebase Storage (expected cache miss). Proceeding to download & upload.
            console.log(`[Storage] Not in Firebase Storage yet, downloading: ${path}`);
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
                const { functions } = await import('./config');
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

/**
 * Uploads a video file to Firebase Storage and returns the public URL.
 * Also allows attaching metadata like a summary.
 * 
 * @param file - The JS File object selected by the user.
 * @param summary - A text summary of the video.
 */
export const uploadVideoToStorage = async (file: File, summary: string): Promise<string> => {
    const storage = (await import('./config')).storage;
    if (!storage) {
        throw new Error('Firebase Storage is not initialized');
    }

    // Validate file type
    if (!file.type.startsWith('video/')) {
        throw new Error('Only video files are allowed');
    }

    try {
        const fileExt = file.name.split('.').pop() || 'mp4';
        const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        const storagePath = `admin/videos/${fileName}`;
        const storageRef = ref(storage, storagePath);

        // Upload the file directly with metadata
        const metadata = {
            customMetadata: {
                'summary': summary
            }
        };

        const snapshot = await uploadBytes(storageRef, file, metadata);

        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);

        console.log(`[Storage] Video uploaded successfully: ${storagePath}`);
        return downloadURL;
    } catch (error: any) {
        console.error(`[Storage] Failed to upload video:`, error);
        throw new Error(error.message || "Failed to upload video");
    }
};

/**
 * Lists all videos in the admin/videos directory.
 */
export const listAdminVideos = async (): Promise<{ name: string, url: string, summary: string, timestamp: number }[]> => {
    const storage = (await import('./config')).storage;
    if (!storage) throw new Error("Firebase Storage not initialized");

    try {
        const { getMetadata } = await import('firebase/storage');
        const rootRef = ref(storage, 'admin/videos');
        const listResult = await listAll(rootRef);

        const videoPromises = listResult.items.map(async (item) => {
            const [url, metadata] = await Promise.all([
                getDownloadURL(item),
                getMetadata(item)
            ]);

            return {
                name: item.name,
                url,
                summary: metadata.customMetadata?.summary || 'No summary available.',
                timestamp: metadata.timeCreated ? new Date(metadata.timeCreated).getTime() : 0
            };
        });

        const videos = await Promise.all(videoPromises);
        // Sort by newest first
        return videos.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error: any) {
        console.error("[Storage] Failed to list admin videos:", error);
        return [];
    }
};
