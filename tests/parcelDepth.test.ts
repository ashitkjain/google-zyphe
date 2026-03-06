/**
 * INTEGRATED TEST: ArcGIS Polygon Depth + Adaptive Scout Slope
 * 
 * 1. Fetch parcel polygon from Alameda County ArcGIS (FREE, exact boundaries)
 * 2. Scout 8 directions for uphill axis
 * 3. Project polygon onto slope axis → TRUE lot depth
 * 4. Measure elevation at polygon boundaries (front/rear on slope axis)
 * 5. Slope = elevation_delta / polygon_depth
 * 
 * Run: npx tsx tests/parcelDepth.test.ts
 */

const ARCGIS_URL = 'https://services5.arcgis.com/ROBnTHSNjoZ2Wm1P/arcgis/rest/services/Parcels/FeatureServer/0/query';

const DEG_LAT_PER_FT = 1 / 364000;
const DEG_LON_PER_FT = 1 / 288000;

const COMPASS = [
    { name: 'N', dLat: 1, dLon: 0 },
    { name: 'NE', dLat: 0.707, dLon: 0.707 },
    { name: 'E', dLat: 0, dLon: 1 },
    { name: 'SE', dLat: -0.707, dLon: 0.707 },
    { name: 'S', dLat: -1, dLon: 0 },
    { name: 'SW', dLat: -0.707, dLon: -0.707 },
    { name: 'W', dLat: 0, dLon: -1 },
    { name: 'NW', dLat: 0.707, dLon: -0.707 },
];

const TEST = [
    { addr: '3280 Ohlone Way', lat: 37.6818185, lon: -122.048356979618, refDelta: 60, refSlope: 33.3, refCat: 'Heavy', refDepth: 180 },
    { addr: '22555 Northview Dr', lat: 37.6879, lon: -122.05174, refDelta: 34, refSlope: 30.9, refCat: 'Heavy', refDepth: 110 },
    { addr: '2936 Pickford Way', lat: 37.683296, lon: -122.0527, refDelta: 18, refSlope: 12.8, refCat: 'Moderate', refDepth: 140 },
    { addr: '27449 Dobbel Ave', lat: 37.6530655, lon: -122.046024516889, refDelta: 16, refSlope: 7.0, refCat: 'Gentle', refDepth: 231 },
    { addr: '27030 Parkside Dr', lat: 37.65764, lon: -122.04219, refDelta: 40, refSlope: 32.0, refCat: 'Heavy', refDepth: 125 },
];

// ─── Elevation ───────────────────────────────────────────────────────────────

async function getElev(lat: number, lon: number): Promise<number> {
    try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 4000);
        const r = await fetch(`https://epqs.nationalmap.gov/v1/json?x=${lon}&y=${lat}&units=Feet`, { signal: c.signal });
        clearTimeout(t);
        const d = await r.json();
        if (d?.value !== undefined && d.value !== -1000000) return typeof d.value === 'string' ? parseFloat(d.value) : d.value;
    } catch { }
    return 0;
}

// ─── Polygon → depth on axis ─────────────────────────────────────────────────

function projectPolygonOnAxis(ring: [number, number][], azimuthDeg: number): { depth: number; frontPt: [number, number]; rearPt: [number, number] } {
    const azRad = azimuthDeg * Math.PI / 180;
    const cosLat = Math.cos(ring[0][1] * Math.PI / 180);
    const dxPerDeg = cosLat * 364000;
    const dyPerDeg = 364000;

    let minProj = Infinity, maxProj = -Infinity;
    let minPt: [number, number] = ring[0], maxPt: [number, number] = ring[0];

    for (const [lon, lat] of ring) {
        const xFt = (lon - ring[0][0]) * dxPerDeg;
        const yFt = (lat - ring[0][1]) * dyPerDeg;
        const proj = xFt * Math.sin(azRad) + yFt * Math.cos(azRad);
        if (proj < minProj) { minProj = proj; minPt = [lon, lat]; }
        if (proj > maxProj) { maxProj = proj; maxPt = [lon, lat]; }
    }

    return { depth: maxProj - minProj, frontPt: minPt, rearPt: maxPt };
}

function azimuth(dir: string): number {
    const m: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
    return m[dir] ?? 0;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log('━'.repeat(110));
    console.log('  INTEGRATED: ArcGIS Polygon + USGS Elevation → Slope');
    console.log('  Polygon: Alameda County ArcGIS (free, exact parcel boundaries)');
    console.log('  Elevation: USGS National Map (free, 3m LiDAR)');
    console.log('━'.repeat(110));

    const results: {
        addr: string; depth: number; delta: number; slope: number; cat: string; dir: string;
        frontElev: number; rearElev: number;
    }[] = [];

    for (const prop of TEST) {
        console.log(`\n📍 ${prop.addr}`);

        // 1. Fetch polygon
        const url = `${ARCGIS_URL}?geometry=${prop.lon},${prop.lat}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&outFields=APN,SitusAddress,Shape__Area&returnGeometry=true&f=json&inSR=4326&outSR=4326`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.features?.length) { console.log('   ❌ No parcel'); continue; }

        const ring: [number, number][] = data.features[0].geometry.rings[0];
        const areaSqft = data.features[0].attributes.Shape__Area * 10.7639;
        console.log(`   APN: ${data.features[0].attributes.APN} | ${areaSqft.toFixed(0)} sqft`);

        // 2. Scout uphill direction
        const scouts = await Promise.all(
            COMPASS.map(async d => {
                const e = await getElev(prop.lat + d.dLat * 100 * DEG_LAT_PER_FT, prop.lon + d.dLon * 100 * DEG_LON_PER_FT);
                return { ...d, elev: e };
            })
        );
        const uphill = scouts.reduce((a, b) => a.elev > b.elev ? a : b);
        console.log(`   Uphill: ${uphill.name}`);

        // 3. Project polygon onto slope axis → depth + front/rear points
        const az = azimuth(uphill.name);
        const { depth: polyDepth, frontPt, rearPt } = projectPolygonOnAxis(ring, az);
        console.log(`   Polygon depth on ${uphill.name} axis: ${polyDepth.toFixed(0)}ft`);

        // 4. Sample elevation at ALL polygon vertices — use min/max
        // (Don't just use 2 extremity points; for irregular lots they may not span the slope)
        const uniqueRing = ring.slice(0, -1); // Remove duplicate closing vertex
        const vertexElevs = await Promise.all(
            uniqueRing.map(async ([lon, lat]) => {
                const e = await getElev(lat, lon);
                return { lat, lon, elev: e };
            })
        );
        const lowest = vertexElevs.reduce((a, b) => a.elev < b.elev ? a : b);
        const highest = vertexElevs.reduce((a, b) => a.elev > b.elev ? a : b);

        // Also get elevation at projection front/rear points for comparison
        const [projFrontElev, projRearElev] = await Promise.all([
            getElev(frontPt[1], frontPt[0]),
            getElev(rearPt[1], rearPt[0]),
        ]);

        // Use the vertex min/max for delta, and compute distance between min/max vertices
        const vertexDelta = Math.abs(highest.elev - lowest.elev);
        const vertexDist = Math.sqrt(
            ((highest.lat - lowest.lat) * 364000) ** 2 +
            ((highest.lon - lowest.lon) * Math.cos(highest.lat * Math.PI / 180) * 364000) ** 2
        );

        // Use projection delta and polygon depth as primary (more geometric)
        const projDelta = Math.abs(projRearElev - projFrontElev);

        // Choose the larger delta — vertex-based or projection-based
        const useDelta = Math.max(vertexDelta, projDelta);
        const useDepth = useDelta === vertexDelta ? vertexDist : polyDepth;
        const slope = (useDelta / useDepth) * 100;
        const cat = slope < 5 ? 'Flat' : slope <= 15 ? 'Moderate' : slope <= 30 ? 'Steep' : 'Heavy';

        console.log(`   Vertex elevs: ${vertexElevs.map(v => v.elev.toFixed(0)).join(', ')}`);
        console.log(`   Lowest vertex:  ${lowest.elev.toFixed(0)}ft @ (${lowest.lat.toFixed(5)}, ${lowest.lon.toFixed(5)})`);
        console.log(`   Highest vertex: ${highest.elev.toFixed(0)}ft @ (${highest.lat.toFixed(5)}, ${highest.lon.toFixed(5)})`);
        console.log(`   Vertex Δ${vertexDelta.toFixed(0)}ft over ${vertexDist.toFixed(0)}ft = ${(vertexDelta / vertexDist * 100).toFixed(1)}%`);
        console.log(`   Proj   Δ${projDelta.toFixed(0)}ft over ${polyDepth.toFixed(0)}ft = ${(projDelta / polyDepth * 100).toFixed(1)}%`);
        console.log(`   ★ Best: Δ${useDelta.toFixed(0)}ft / ${useDepth.toFixed(0)}ft = ${slope.toFixed(1)}% ${cat}`);
        console.log(`   Ref:    Δ${prop.refDelta}ft / ${prop.refDepth}ft = ${prop.refSlope}% ${prop.refCat}`);

        const frontElev = useDelta === vertexDelta ? lowest.elev : projFrontElev;
        const rearElev = useDelta === vertexDelta ? highest.elev : projRearElev;
        results.push({ addr: prop.addr, depth: useDepth, delta: useDelta, slope: Math.round(slope * 10) / 10, cat, dir: uphill.name, frontElev, rearElev });
    }

    // ═══ COMPARISON TABLE ═══
    console.log('\n' + '━'.repeat(120));
    console.log('  RESULTS vs REFERENCE');
    console.log('━'.repeat(120));
    console.log();
    console.log(
        'Property'.padEnd(20) +
        'Dir'.padStart(4) +
        'PolyD'.padStart(7) +
        'Front'.padStart(7) +
        'Rear'.padStart(7) +
        'Δ ft'.padStart(6) +
        'Slope'.padStart(7) +
        'Cat'.padStart(10) +
        ' │ ' +
        'RefD'.padStart(5) +
        'RefΔ'.padStart(6) +
        'Ref%'.padStart(7) +
        'RefCat'.padStart(10) +
        ' │ ' +
        'Match'
    );
    console.log('─'.repeat(120));

    let wins = 0;
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const t = TEST[i];
        const slopeDiff = Math.abs(r.slope - t.refSlope);
        const catMatch = r.cat === t.refCat || (r.cat === 'Steep' && t.refCat === 'Heavy') || (r.cat === 'Moderate' && t.refCat === 'Gentle');
        const match = slopeDiff < 10 ? '✅' : '❌';
        if (slopeDiff < 10) wins++;

        console.log(
            r.addr.padEnd(20) +
            r.dir.padStart(4) +
            `${Math.round(r.depth)}`.padStart(7) +
            `${Math.round(r.frontElev)}`.padStart(7) +
            `${Math.round(r.rearElev)}`.padStart(7) +
            `${Math.round(r.delta)}`.padStart(6) +
            `${r.slope}%`.padStart(7) +
            r.cat.padStart(10) +
            ' │ ' +
            `${t.refDepth}`.padStart(5) +
            `${t.refDelta}`.padStart(6) +
            `${t.refSlope}%`.padStart(7) +
            t.refCat.padStart(10) +
            ' │ ' +
            match
        );
    }
    console.log('─'.repeat(120));
    console.log(`\n  Score: ${wins}/${results.length} within 10% of reference slope`);

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
