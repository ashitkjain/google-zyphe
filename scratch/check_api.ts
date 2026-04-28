
async function checkRapidApi() {
    const zpid = '53050869';
    // US Housing API Key (from .env.local)
    const key = 'ba288e5526msh3083368751f58bdp1edc70jsn2c0645803d3f';
    const host = 'us-housing-market-data1.p.rapidapi.com';
    const url = `https://${host}/images?zpid=${zpid}`;
    
    console.log(`Calling: ${url}`);
    
    const resp = await fetch(url, {
        method: 'GET',
        headers: {
            'x-rapidapi-key': key,
            'x-rapidapi-host': host
        }
    });
    
    if (!resp.ok) {
        console.log('API Error:', resp.status);
        const txt = await resp.text();
        console.log(txt);
        return;
    }
    
    const data = await resp.json();
    let images: any[] = [];
    if (Array.isArray(data)) images = data;
    else if (data.images && Array.isArray(data.images)) images = data.images;
    else if (data.photos && Array.isArray(data.photos)) images = data.photos;

    console.log('Total Images in RapidAPI (US Housing):', images.length);
    if (images.length > 0) {
        console.log('First Image:', images[0]);
    }
}

checkRapidApi();
