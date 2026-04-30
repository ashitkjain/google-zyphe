const admin = require('firebase-admin');
const { _enrichProperty } = require('./shared/propertyUtils');

// Initialize Admin SDK with ignoreUndefinedProperties
try { 
    admin.initializeApp({ projectId: 'zyphe-af0bf' }); 
    admin.firestore().settings({ ignoreUndefinedProperties: true });
} catch (e) {
    // If already initialized
}

const db = admin.firestore();

async function runComparison() {
    console.log("🚀 Starting Climate Risk Data Comparison (First Street vs FEMA NRI)...");
    
    // 1. Fetch API Keys
    const keySnap = await db.collection('app_config').doc('api_keys').get();
    const keys = keySnap.exists ? keySnap.data() : {};
    
    if (!keys.rapidapi_key) {
        console.error("❌ Missing RapidAPI key. Cannot proceed.");
        process.exit(1);
    }

    // Add bypassCache flag
    const testKeys = { ...keys, bypassCache: true };

    // 2. Find 10 properties with existing climate data
    console.log("🔍 Finding properties with existing First Street data...");
    const propSnap = await db.collection('properties')
        .where('floodRiskScore', '>', 0)
        .limit(10)
        .get();

    if (propSnap.empty) {
        console.log("⚠️ No properties found with existing scores. Trying random sample...");
        const fallbackSnap = await db.collection('properties').limit(10).get();
        await processProperties(fallbackSnap.docs, testKeys);
    } else {
        await processProperties(propSnap.docs, testKeys);
    }
}

async function processProperties(docs, keys) {
    const results = [];

    for (const doc of docs) {
        const zpid = doc.id;
        const data = doc.data();
        const address = data.address || zpid;

        console.log(`\n🏠 Processing ${address} (${zpid})...`);

        try {
            // Run enrichment
            await _enrichProperty(zpid, db, keys);
            
            // Re-fetch updated doc
            const updatedSnap = await db.collection('properties').doc(zpid).get();
            const updated = updatedSnap.data();

            const fs = {
                flood: updated.floodRiskScore || 0,
                fire: updated.fireRiskScore || 0,
                heat: updated.heatRiskScore || 0,
                wind: updated.windRiskScore || 0
            };

            const fema = updated.femaScores || { flood: 0, fire: 0, heat: 0, wind: 0 };

            results.push({
                address,
                zpid,
                flood: { fs: fs.flood, fema: fema.flood },
                fire: { fs: fs.fire, fema: fema.fire },
                heat: { fs: fs.heat, fema: fema.heat },
                wind: { fs: fs.wind, fema: fema.wind }
            });

            console.log(`   ✅ Success. FEMA Scores: ${JSON.stringify(fema)}`);
        } catch (e) {
            console.error(`   ❌ Failed: ${e.message}`);
        }
    }

    // Print Final Table
    console.log("\n" + "=".repeat(110));
    console.log("📊 CLIMATE RISK COMPARISON TABLE (Scale 1-10)");
    console.log("=".repeat(110));
    console.log("Address".padEnd(30) + " | " + "Flood (FS/FEMA)".padEnd(18) + " | " + "Fire (FS/FEMA)".padEnd(18) + " | " + "Heat (FS/FEMA)".padEnd(18) + " | " + "Wind (FS/FEMA)");
    console.log("-".repeat(110));
    
    results.forEach(r => {
        const fmt = (v) => `${v.fs || '-'}/${v.fema || '-'}`.padEnd(18);
        console.log(
            r.address.substring(0, 28).padEnd(30) + " | " + 
            fmt(r.flood) + " | " + 
            fmt(r.fire) + " | " + 
            fmt(r.heat) + " | " + 
            fmt(r.wind)
        );
    });
    console.log("=".repeat(110));
    console.log("Legend: FS = First Street (Paid), FEMA = FEMA National Risk Index (Free)");
    
    process.exit(0);
}

runComparison();
