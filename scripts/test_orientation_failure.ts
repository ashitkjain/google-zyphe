import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// Import production services directly
import { forceRefreshAllImagesAndAnalyze } from "../services/satellitaryService";

async function testOrientationForZpid(zpid: string, lat: number, lng: number, address: string) {
    console.log(`\n--- STARTING LIVE TEST FOR ZPID: ${zpid} ---`);
    try {
        const result = await forceRefreshAllImagesAndAnalyze(
            zpid,
            lat,
            lng,
            'test-runner',
            address
        );
        console.log("SUCCESS!");
        console.log("Final Orientation:", result.final_orientation);
        console.log("Image Quality:", result.image_quality);
        console.log("Azimuth:", result.azimuth_degrees);
    } catch (e: any) {
        console.error("FAILURE!");
        console.error("Error Message:", e.message);
        console.error("Stack Trace:", e.stack);
    }
}

// 4958 Trescott Ct, Dublin, CA 94568 US
testOrientationForZpid(
    '111406995',
    37.7142004068643,
    -121.868273632273,
    '4958 Trescott Ct, Dublin, CA 94568 US'
).catch(console.error);
