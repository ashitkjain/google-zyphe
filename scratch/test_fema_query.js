
const lat = 37.673615;
const lng = -121.868501950481;
const baseUrl = 'https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Census_Tracts/FeatureServer/0/query';

const params = new URLSearchParams({
    geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    f: 'json',
    returnGeometry: 'false'
});

async function test() {
    const url = `${baseUrl}?${params.toString()}`;
    console.log('Fetching:', url);
    const resp = await fetch(url);
    const data = await resp.json();
    console.log('Result count:', data.features?.length || 0);
    if (data.features?.length > 0) {
        console.log('Data:', JSON.stringify(data.features[0].attributes, null, 2));
    } else {
        console.log('No features found.');
    }
}

test();
