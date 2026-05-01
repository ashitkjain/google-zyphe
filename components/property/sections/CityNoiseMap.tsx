
import React, { useEffect, useState } from 'react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../services/firebase/config';

interface CityNoiseMapProps {
    center?: { lat: number; lng: number };
    city?: string;
    onImageReady?: (hasImage: boolean) => void;
}

const CityNoiseMap: React.FC<CityNoiseMapProps> = ({ city, onImageReady }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!city || !storage) { onImageReady?.(false); return; }
        const slug = city.toLowerCase().replace(/\s+/g, '_');
        const storageRef = ref(storage, `cities/${slug}/acoustics.png`);
        getDownloadURL(storageRef)
            .then(url => { setImageUrl(url); onImageReady?.(true); })
            .catch(() => { onImageReady?.(false); });
    }, [city]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!imageUrl) return null;

    return (
        <img
            src={imageUrl}
            alt={`${city} acoustic noise map`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
    );
};

export default CityNoiseMap;
