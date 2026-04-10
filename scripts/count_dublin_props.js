import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config();

initializeApp();
const db = getFirestore();

async function countDublinProperties() {
    console.log("Analyzing Dublin properties...");
    const propRef = db.collection('properties');
    const snapshot = await propRef.where('city', '==', 'Dublin').get();
    
    let total = 0;
    let sfdCount = 0;
    let townhomeCount = 0;
    let condoCount = 0;
    let otherTypeCount = 0;
    
    let targetProps = 0;
    let skippedCondo = 0;
    let skippedNoSV = 0;
    let skippedNoAddress = 0;
    
    snapshot.forEach(doc => {
        const data = doc.data();
        total++;
        
        // homeType is the canonical one based on inspection
        const homeType = (data.homeType || '').toUpperCase();
        const propertyType = (data.propertyType || '').toUpperCase();
        
        const hasSV = !!(data.streetView || data.streetViewAnalysis?.imageUrl || data.orientation_ai?.street_view_url);
        const hasAddress = !!data.address;
        
        const isSFD = homeType === 'SINGLE_FAMILY' || propertyType.includes('SINGLE FAMILY');
        const isTownhome = homeType === 'TOWNHOUSE' || propertyType.includes('TOWNHOUSE');
        const isCondo = homeType === 'CONDO' || propertyType.includes('CONDO');

        if (isCondo) {
            condoCount++;
            skippedCondo++;
        } else if (isSFD || isTownhome) {
            if (isSFD) sfdCount++;
            if (isTownhome) townhomeCount++;
            
            if (hasSV && hasAddress) {
                targetProps++;
            } else {
                skippedNoSV++;
            }
        } else {
            otherTypeCount++;
        }
    });
    
    console.log(`\n--- Dublin Statistics ---`);
    console.log(`Total Scanned: ${total}`);
    console.log(`Condos (Skipped): ${condoCount}`);
    console.log(`Single Family: ${sfdCount}`);
    console.log(`Townhome: ${townhomeCount}`);
    console.log(`Other/Unknown: ${otherTypeCount}`);
    console.log(`-------------------------`);
    console.log(`TARGET (SFD/Townhome + SV + Address): ${targetProps}`);
    console.log(`SKIPPED: ${total - targetProps}`);
    console.log(`-------------------------\n`);
}

countDublinProperties();
