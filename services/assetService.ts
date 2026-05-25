import { uploadRemoteImageToStorage } from './firebase/storage';
import { getPropertyAssetsFromCloud, savePropertyAssetsToCloud, getPropertyFromCloud, savePropertyToCloud } from './firebase/properties';
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
 * Secures property maps by downloading remote URLs and storing them in
 * Firebase Storage for persistence. Gallery photos are secured when they
 * originate from RealEstateAPI.
 */
export const securePropertyAssets = async (
    zpid: string,
    _providedImageUrls?: string[],
    maps?: { zoomIn?: string; zoomOut?: string; streetView?: string; satelliteImageUrl?: string },
    onProgress?: (p: AssetProgress) => void,
    _address?: string
): Promise<PropertyAssets> => {

    onProgress?.({ total: 100, completed: 0, message: "Loading asset registry..." });

    const cached = await getPropertyAssetsFromCloud(zpid);
    const property = await getPropertyFromCloud(zpid);

    let persistentMapZoomIn = maps?.zoomIn;
    let persistentMapZoomOut = maps?.zoomOut;
    let persistentStreetView = maps?.streetView;
    let persistentSatellite = maps?.satelliteImageUrl;

    let persistentImages = cached?.images || property?.images || [];

    // --- SECURE REALESTATEAPI GALLERY PHOTOS ---
    const isRealEstateApi = property && (
        property.photo_source === 'realestateapi' ||
        property.images?.some(img => typeof img === 'string' && (img.includes('imagecdn.realty.dev') || img.includes('realty.dev/mls_photos')))
    );

    if (isRealEstateApi && property.images && property.images.length > 0) {
        console.log(`[AssetService] Sourced from RealEstateAPI. Securing ${property.images.length} gallery photos...`);
        const alreadySecured = persistentImages.length > 0 && persistentImages.every(img => img && img.startsWith('https://firebasestorage'));
        
        if (!alreadySecured) {
            onProgress?.({ total: 100, completed: 20, message: `Securing 0/${property.images.length} gallery photos...` });
            
            const uploadPromises = property.images.map(async (url, idx) => {
                if (typeof url !== 'string') return '';
                if (url.startsWith('https://firebasestorage')) return url;
                
                const storagePath = `properties/${zpid}/gallery/img_${idx}.jpg`;
                const securedUrl = await uploadWithRetry(url, storagePath, idx);
                
                onProgress?.({ 
                    total: 100, 
                    completed: 20 + Math.round((idx / property.images.length) * 60), 
                    message: `Securing ${idx + 1}/${property.images.length} gallery photos...` 
                });
                return securedUrl;
            });
            
            const results = await Promise.all(uploadPromises);
            persistentImages = results.filter(Boolean);
            
            // Save to the main property document in Firestore
            await savePropertyToCloud(zpid, { images: persistentImages });
            console.log(`[AssetService] Successfully secured ${persistentImages.length} RealEstateAPI photos to Firebase Storage.`);
        }
    }

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
                }).catch(() => { });
            }
            if (!persistentMapZoomIn || !persistentMapZoomIn.startsWith('https://firebasestorage')) {
                const ziRef = ref(storage, `properties/${zpid}/maps/zoom_in.png`);
                await getDownloadURL(ziRef).then(url => {
                    persistentMapZoomIn = url;
                }).catch(() => { });
            }
            if (!persistentMapZoomOut || !persistentMapZoomOut.startsWith('https://firebasestorage')) {
                const zoRef = ref(storage, `properties/${zpid}/maps/location_context.png`);
                await getDownloadURL(zoRef).then(url => {
                    persistentMapZoomOut = url;
                }).catch(() => { });
            }
        }
    } catch (e) { /* ignore discovery errors */ }

    onProgress?.({ total: 100, completed: 100, message: "Maps secured." });

    const assets: PropertyAssets = {
        zpid,
        images: persistentImages,
        imageMetadata: cached?.imageMetadata || {},
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

