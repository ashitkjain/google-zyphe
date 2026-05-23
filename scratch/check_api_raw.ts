import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
    const host = 'us-housing-market-data1.p.rapidapi.com';
    const key = process.env.VITE_RAPIDAPI_KEY || 'ba288e5526msh3083368751f58bdp1edc70jsn2c0645803d3f';
    const location = "ML82043166";
    const url = "https://" + host + "/propertyExtendedSearch?location=" + encodeURIComponent(location);
    
    console.log('Searching by location:', location);
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'x-rapidapi-host': host,
            'x-rapidapi-key': key,
        }
    });
    
    if (!response.ok) {
        console.error('API Error:', response.status);
        return;
    }
    
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
}

check();
