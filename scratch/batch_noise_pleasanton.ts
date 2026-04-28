
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import * as turf from '@turf/turf';

// Copy of config since imports might be tricky in a standalone script
const firebaseConfig = {
    apiKey: "AIzaSyBiP85bXTptTAqvXUh4JwYC-6SQJqwukvI",
    authDomain: "zyphe-af0bf.firebaseapp.com",
    projectId: "zyphe-af0bf",
    storageBucket: "zyphe-af0bf.firebasestorage.app",
    messagingSenderId: "434538487700",
    appId: "1:434538487700:web:2d0880addbfdca71c13981",
    measurementId: "G-S07B3J7TJZ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BASE_DB = {
    'motorway': 90, 'trunk': 84, 'primary': 78, 'secondary': 70, 'tertiary': 62, 'rail': 85, 'runway': 95
};
const AMBIENT_FLOOR_DB = 42.0;
const NOISE_RADIUS_METERS = 800;

async function calculateZypheNoiseScore(lat, lng) {
    try {
        const bbox = turf.bbox(turf.circle([lng, lat], 1, { units: 'kilometers' }));
        const [minLng, minLat, maxLng, maxLat] = bbox;
        const query = `[out:json][timeout:25];(way["highway"~"motorway|trunk|primary|secondary|tertiary"](${minLat},${minLng},${maxLat},${maxLng});way["railway"="rail"](${minLat},${minLng},${maxLat},${maxLng});way["aeroway"="runway"](${minLat},${minLng},${maxLat},${maxLng});way["building"](${minLat},${minLng},${maxLat},${maxLng});relation["building"](${minLat},${minLng},${maxLat},${maxLng}););out body;>;out skel qt;`;
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`,
            headers: { 
                'User-Agent': 'Zyphe-Noise-Simulation/1.0 (https://zyphe.ai)',
                'Content-Type': 'application/x-www-form-urlencoded' 
            }
        });
        if (!response.ok) {
            console.error(`[Overpass Error] ${response.status} ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        const elements = data.elements || [];
        const roads = [];
        const buildings = [];
        const nodes = new Map();
        elements.filter(e => e.type === 'node').forEach(n => nodes.set(n.id, [n.lon, n.lat]));
        elements.filter(e => e.type === 'way').forEach(w => {
            const coords = w.nodes.map(id => nodes.get(id)).filter(Boolean);
            if (coords.length < 2) return;
            const feature = turf.lineString(coords, w.tags);
            if (w.tags.building) {
                if (w.nodes[0] === w.nodes[w.nodes.length - 1] && coords.length > 3) buildings.push(turf.polygon([coords], w.tags));
                else buildings.push(feature);
            } else roads.push(feature);
        });
        const propertyPoint = turf.point([lng, lat]);
        let totalEnergy = Math.pow(10, AMBIENT_FLOOR_DB / 10);
        let maxImpactDb = AMBIENT_FLOOR_DB;
        let primarySource = "Ambient (Quiet Neighborhood)";
        for (const road of roads) {
            const highwayType = road.properties.highway || (road.properties.railway ? 'rail' : road.properties.aeroway ? 'runway' : 'tertiary');
            const baseDb = BASE_DB[highwayType] || 60;
            const closestPoint = turf.nearestPointOnLine(road, propertyPoint);
            const distanceMeters = turf.distance(propertyPoint, closestPoint, { units: 'meters' });
            if (distanceMeters > NOISE_RADIUS_METERS) continue;
            const los = turf.lineString([[lng, lat], closestPoint.geometry.coordinates]);
            let numBarriers = 0;
            for (const building of buildings) { if (turf.booleanIntersects(los, building)) numBarriers++; }
            let barrierReduction = 0;
            if (numBarriers === 1) barrierReduction = 8;
            else if (numBarriers === 2) barrierReduction = 11;
            else if (numBarriers >= 3) barrierReduction = Math.min(20, 11 + (numBarriers - 2) * 1);
            const distAttenuation = 20 * Math.log10(Math.max(distanceMeters, 10) / 10);
            const finalDb = baseDb - distAttenuation - barrierReduction;
            if (finalDb > maxImpactDb) {
                maxImpactDb = finalDb;
                primarySource = `${highwayType.charAt(0).toUpperCase() + highwayType.slice(1)}: ${road.properties.name || road.properties.ref || highwayType}`;
            }
            totalEnergy += Math.pow(10, finalDb / 10);
        }
        const finalTotalDb = 10 * Math.log10(totalEnergy);
        const score = Math.max(0, Math.min(100, 100 - (finalTotalDb - AMBIENT_FLOOR_DB) * (100 / (85 - AMBIENT_FLOOR_DB))));
        return { score: Math.round(score), characterization: score >= 90 ? "Quiet (Serene)" : score >= 75 ? "Quiet" : score >= 60 ? "Moderate" : score >= 45 ? "Loud" : "Very Loud", primarySource, decibels: Math.round(finalTotalDb) };
    } catch (e) { console.error("[calculateZypheNoiseScore ERROR]", e); return null; }
}

async function runBatch() {
    console.log("[Batch] Fetching Pleasanton properties...");
    const q = query(collection(db, "properties"), where("city", "==", "Pleasanton"));
    const snapshot = await getDocs(q);
    console.log(`[Batch] Found ${snapshot.size} properties.`);

    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i++) {
        const docSnap = docs[i];
        const data = docSnap.data();
        if (data.zypheNoiseScore) {
            console.log(`[${i+1}/${docs.length}] Skipping ${docSnap.id} (Already simulated)`);
            continue;
        }

        const lat = data.coordinates?.latitude;
        const lng = data.coordinates?.longitude;

        if (!lat || !lng) {
            console.log(`[${i+1}/${docs.length}] Skipping ${docSnap.id} (No coordinates)`);
            continue;
        }

        console.log(`[${i+1}/${docs.length}] Simulating noise for ${data.address} (${docSnap.id})...`);
        const result = await calculateZypheNoiseScore(lat, lng);
        if (result) {
            await updateDoc(docSnap.ref, {
                zypheNoiseScore: result.score,
                noiseCharacterization: result.characterization,
                primaryNoiseSource: result.primarySource,
                noiseDecibels: result.decibels,
                noiseLastSimulated: serverTimestamp()
            });
            console.log(` >> Result: ${result.score}/100 (${result.characterization})`);
        } else {
            console.log(` >> Failed.`);
        }

        // Throttling to avoid Overpass rate limits
        await new Promise(r => setTimeout(r, 1000));
    }
    console.log("[Batch] Finished.");
}

runBatch().catch(console.error);
