
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
    maps?: { zoomIn?: string; zoomOut?: string; streetView?: string; satelliteImageUrl?: string },
    onProgress?: (p: AssetProgress) => void
): Promise<PropertyAssets> => {

    // 1. Check if we already have the gallery registered and stored.
    // For maps, we will proceed to the specific securing block to allow physical verification.
    const cached = await getPropertyAssetsFromCloud(zpid);
    if (cached && cached.images?.length > 0) {
        const allStored = cached.images.every(url => url.startsWith('https://firebasestorage') || url.includes('FAILED_TO_SECURE'));
        // If images are secure, we still proceed to check maps if they are provided,
        // but if no maps were provided and images are done, we can return.
        if (allStored && !maps?.zoomIn && !maps?.zoomOut && !maps?.streetView) return cached;
    }

    const persistentImages: string[] = [];
    let persistentMapZoomIn = maps?.zoomIn;
    let persistentMapZoomOut = maps?.zoomOut;
    let persistentStreetView = maps?.streetView;
    let persistentSatellite = maps?.satelliteImageUrl;

    // 2. Secure Maps
    // We always attempt maps if provided because uploadRemoteImageToStorage 
    // internalizes the physical storage existence check.
    if (maps?.zoomIn) {
        try {
            persistentMapZoomIn = await uploadWithRetry(maps.zoomIn, `properties/${zpid}/maps/zoom_in.png`, -1);
        } catch (e) {
            console.warn("[AssetService] Map Zoom In failed to secure:", e);
        }
    }

    if (maps?.zoomOut) {
        try {
            persistentMapZoomOut = await uploadWithRetry(maps.zoomOut, `properties/${zpid}/maps/location_context.png`, -2);
        } catch (e) {
            console.warn("[AssetService] Map Zoom Out failed to secure:", e);
        }
    }

    if (maps?.streetView) {
        try {
            persistentStreetView = await uploadWithRetry(maps.streetView, `properties/${zpid}/maps/street_view.jpg`, -3);
        } catch (e) {
            console.warn("[AssetService] Street View failed to secure:", e);
        }
    }

    if (maps?.satelliteImageUrl) {
        try {
            // Satellite is usually already in storage via getOrCacheAerialSatelliteUrl
            // but we ensure it's tracked in the assets registry here.
            persistentSatellite = maps.satelliteImageUrl;
        } catch (e) {
            console.warn("[AssetService] Satellite check failed:", e);
        }
    }

    // --- STORAGE DISCOVERY FALLBACK ---
    // If street view or maps are missing from input but exist in storage, recover them.
    try {
        const { ref, getDownloadURL } = await import('firebase/storage');
        const { storage } = await import('./firebase/config');
        if (storage) {
            if (!persistentStreetView || !persistentStreetView.startsWith('https://firebasestorage')) {
                const svRef = ref(storage, `properties/${zpid}/maps/street_view.jpg`);
                await getDownloadURL(svRef).then(url => {
                    persistentStreetView = url;
                    console.log(`[AssetService] Recovered existing street view from storage for ${zpid}`);
                }).catch(() => {});
            }
            if (!persistentMapZoomIn || !persistentMapZoomIn.startsWith('https://firebasestorage')) {
                const ziRef = ref(storage, `properties/${zpid}/maps/zoom_in.png`);
                await getDownloadURL(ziRef).then(url => {
                    persistentMapZoomIn = url;
                }).catch(() => {});
            }
            if (!persistentMapZoomOut || !persistentMapZoomOut.startsWith('https://firebasestorage')) {
                const zoRef = ref(storage, `properties/${zpid}/maps/location_context.png`);
                await getDownloadURL(zoRef).then(url => {
                    persistentMapZoomOut = url;
                }).catch(() => {});
            }
        }
    } catch (e) { /* ignore discovery errors */ }

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
            // Skip if already in firebase storage (proper HTTPS URL) or already a failure placeholder
            if (url.startsWith('https://firebasestorage') || url.includes('FAILED_TO_SECURE')) return url;

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
        streetView: persistentStreetView || null,
        satelliteImageUrl: persistentSatellite || null,
        lastVerified: null
    };

    // 4. Registry in Firestore
    await savePropertyAssetsToCloud(zpid, assets);

    return assets;
};
