import { fetchStreetViewHeading } from '../services/satellitaryService.ts';

async function test() {
    // 4066 Rosehill Pl, Dublin, CA 94568
    const address = "4066 Rosehill Pl, Dublin, CA 94568 US";
    const lat = 37.712613; 
    const lng = -121.876527;
    
    console.log("Testing:", address);
    try {
        const result = await fetchStreetViewHeading(lat, lng, address);
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
