import { ref, uploadString, getDownloadURL } from 'firebase/storage';
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
