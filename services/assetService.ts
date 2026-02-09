
import { uploadRemoteImageToStorage } from './firebase/storage';
import { getPropertyAssetsFromCloud, savePropertyAssetsToCloud } from './firebase/properties';
import { PropertyAssets } from '../types';

export interface AssetProgress {
    total: number;
    completed: number;
    message: string;
}

/**
 * Secures property imagery (gallery and maps) by downloading remote URLs 
 * and storing them in Firebase Storage for persistence.
 * 
 * @param zpid - Canonical property ID
 * @param imageUrls - List of remote image URLs
 * @param maps - Optional map URLs to secure
 * @param onProgress - Optional progression callback
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
        // If we have a manifest, we assume they are already in storage
        // Optional: add a check to verify URLs start with firebasestorage
        const allStored = cached.images.every(url => url.includes('firebasestorage'));
        if (allStored) {
            return cached;
        }
    }

    const persistentImages: string[] = [];
    let persistentMapZoomIn = maps?.zoomIn;
    let persistentMapZoomOut = maps?.zoomOut;

    // 2. Secure Maps
    if (maps?.zoomIn && !maps.zoomIn.includes('firebasestorage')) {
        try {
            persistentMapZoomIn = await uploadRemoteImageToStorage(
                maps.zoomIn,
                `properties/${zpid}/maps/zoom_in.png`
            );
        } catch (e) {
            console.warn("[AssetService] Map Zoom In failed to secure:", e);
        }
    }

    if (maps?.zoomOut && !maps.zoomOut.includes('firebasestorage')) {
        try {
            persistentMapZoomOut = await uploadRemoteImageToStorage(
                maps.zoomOut,
                `properties/${zpid}/maps/location_context.png`
            );
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
            try {
                // Skip if already in firebase storage
                if (url.includes('firebasestorage')) return url;

                return await uploadRemoteImageToStorage(
                    url,
                    `properties/${zpid}/gallery/img_${index + 1}.jpg`
                );
            } catch (e) {
                console.warn(`[AssetService] Failed to secure image ${index}:`, e);
                return url; // Fallback to original URL
            }
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
        lastVerified: null // Handled by serverTimestamp in service
    };

    // 4. Registry in Firestore
    await savePropertyAssetsToCloud(zpid, assets);

    return assets;
};
