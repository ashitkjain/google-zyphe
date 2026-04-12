import { getPropertyByAddress } from '../services/firebase/properties.js';

async function investigate() {
    try {
        const address = '3492 Dorset Ct, Pleasanton, CA';
        console.log(`Searching for ${address}...`);
        const property = await getPropertyByAddress(address);
        
        if (!property) {
            console.log("Property not found.");
            process.exit(1);
        }

        console.log("INVESTIGATION_START");
        console.log(JSON.stringify(property, null, 2));
        console.log("INVESTIGATION_END");
        process.exit(0);
    } catch (e) {
        console.error("Investigation failed:", e);
        process.exit(1);
    }
}

investigate();
