
import { uploadRemoteImageToStorage } from './firebase/storage';
import { getPropertyAssetsFromCloud, savePropertyAssetsToCloud } from './firebase/properties';
import { PropertyAssets } from '../types';

export interface AssetProgress {
    total: number;
    completed: number;
    message: string;
}

const uploadWithRetry = async (url: string, path: string, index: number, maxRetries = 3): Promise<string> => {
    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await uploadRemoteImageToStorage(url, path);
        } catch (e: any) {
            lastError = e;
            console.warn(`[AssetService] Upload attempt ${attempt}/${maxRetries} failed for image ${index}: ${e.message}`);
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 500; // Exponential backoff
                await new Promise(res => setTimeout(res, delay));
            }
        }
    }
    console.error(`[AssetService] CRITICAL: Hard failure securing image ${index} after ${maxRetries} attempts.`);
    return `FAILED_TO_SECURE_IMG_${index + 1}_${Date.now()}`;
};

/**
 * Secures property imagery (gallery and maps) by downloading remote URLs 
 * and storing them in Firebase Storage for persistence.
 */
export const securePropertyAssets = async (
    zpid: string,
    imageUrls: string[],
    maps?: { zoomIn?: string; zoomOut?: string },
    onProgress?: (p: AssetProgress) => void
): Promise<PropertyAssets> => {

    // 1. Check if we already have these assets registered and stored
    const cached = await getPropertyAssetsFromCloud(zpid);
    if (cached && cached.images?.length > 0) {
        const allStored = cached.images.every(url => url.includes('firebasestorage') || url.includes('FAILED_TO_SECURE'));
        if (allStored) return cached;
    }

    const persistentImages: string[] = [];
    let persistentMapZoomIn = maps?.zoomIn;
    let persistentMapZoomOut = maps?.zoomOut;

    // 2. Secure Maps
    if (maps?.zoomIn && !maps.zoomIn.includes('firebasestorage')) {
        try {
            persistentMapZoomIn = await uploadWithRetry(maps.zoomIn, `properties/${zpid}/maps/zoom_in.png`, -1);
        } catch (e) {
            console.warn("[AssetService] Map Zoom In failed to secure:", e);
        }
    }

    if (maps?.zoomOut && !maps.zoomOut.includes('firebasestorage')) {
        try {
            persistentMapZoomOut = await uploadWithRetry(maps.zoomOut, `properties/${zpid}/maps/location_context.png`, -2);
        } catch (e) {
            console.warn("[AssetService] Map Zoom Out failed to secure:", e);
        }
    }

    // 3. Secure Gallery Images in batches
    const CHUNK_SIZE = 5;
    const total = imageUrls.length;

    for (let i = 0; i < imageUrls.length; i += CHUNK_SIZE) {
        const chunk = imageUrls.slice(i, i + CHUNK_SIZE);

        onProgress?.({
            total,
            completed: i,
            message: `Persisting gallery images ${i + 1} to ${Math.min(i + CHUNK_SIZE, total)}...`
        });

        const chunkPromises = chunk.map(async (url, chunkIndex) => {
            const index = i + chunkIndex;
            // Skip if already in firebase storage or already a failure placeholder
            if (url.includes('firebasestorage') || url.includes('FAILED_TO_SECURE')) return url;

            return await uploadWithRetry(
                url,
                `properties/${zpid}/gallery/img_${index + 1}.jpg`,
                index
            );
        });

        const chunkResults = await Promise.all(chunkPromises);
        persistentImages.push(...chunkResults);
    }

    onProgress?.({
        total,
        completed: total,
        message: "All assets secured."
    });

    const assets: PropertyAssets = {
        zpid,
        images: persistentImages,
        mapZoomIn: persistentMapZoomIn || null,
        mapZoomOut: persistentMapZoomOut || null,
        lastVerified: null
    };

    // 4. Registry in Firestore
    await savePropertyAssetsToCloud(zpid, assets);

    return assets;
};
