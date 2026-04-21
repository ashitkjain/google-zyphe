import { usHousingApi } from '../config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
    const zpid = '24982631';
    const host = 'us-housing-market-data.p.rapidapi.com';
    const key = process.env.VITE_RAPIDAPI_KEY || 'ba288e5526msh3083368751f58bdp1edc70jsn2c0645803d3f';
    const url = "https://" + host + "/property?zpid=" + zpid;
    
    console.log('Fetching raw data from API...');
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
    const root = data.property || data.props || data;
    console.log('--- SCHOOLS IN API ---');
    console.log(JSON.stringify(root.schools, null, 2));
    console.log('--- ALL NEARBY FIELDS ---');
    console.log('Nearby Schools:', root.nearbySchools);
    console.log('Schools Info:', root.schoolsInfo);
}

check();
