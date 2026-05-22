import admin from 'firebase-admin';

// Initialize firebase-admin for secure CLI database access
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: 'zyphe-af0bf' });
}

async function run() {
    const firestore = admin.firestore();

    // Securely pre-fetch API keys from Firestore and load them into process.env
    try {
        const snap = await firestore.doc('app_config/api_keys').get();
        if (snap.exists) {
            const data = snap.data();
            if (data) {
                if (data.radar_key) process.env.VITE_RADAR_KEY = data.radar_key;
                if (data.rapidapi_key) process.env.VITE_RAPIDAPI_KEY = data.rapidapi_key;
                if (data.rentcast_key) process.env.VITE_RENTCAST_KEY = data.rentcast_key;
                if (data.gemini_key) process.env.VITE_GEMINI_API_KEY = data.gemini_key;
            }
        }
    } catch (e: any) {
        console.warn('  \x1b[90m[CLI Init] Warn: Could not load keys via firebase-admin, using env defaults:\x1b[0m', e.message);
    }

    // Dynamically import compService after env vars are populated
    const { findComps } = await import('../services/compService');

    const args = process.argv.slice(2);
    
    // Parse optional CLI parameter flags manually
    const getFlagValue = (flagName: string): string | null => {
        const idx = args.indexOf(flagName);
        if (idx !== -1 && idx + 1 < args.length) {
            return args[idx + 1];
        }
        return null;
    };

    const beds = getFlagValue('--beds') ? Number(getFlagValue('--beds')) : undefined;
    const baths = getFlagValue('--baths') ? Number(getFlagValue('--baths')) : undefined;
    const sqft = getFlagValue('--sqft') ? Number(getFlagValue('--sqft')) : undefined;
    const lot = getFlagValue('--lot') ? Number(getFlagValue('--lot')) : undefined;
    const year = getFlagValue('--year') ? Number(getFlagValue('--year')) : undefined;

    // Filter out flags and their values to extract the raw address
    const cleanArgs: string[] = [];
    let i = 0;
    while (i < args.length) {
        if (['--beds', '--baths', '--sqft', '--lot', '--year'].includes(args[i])) {
            i += 2;
        } else {
            cleanArgs.push(args[i]);
            i++;
        }
    }
    const address = cleanArgs.join(' ').trim();

    if (!address) {
        console.error('\x1b[31m[Error] Please provide a subject property address.\x1b[0m');
        console.log('\nUsage:');
        console.log('  npx tsx scripts/find_comps.ts "<address>" [--beds <number>] [--baths <number>] [--sqft <number>] [--lot <number>] [--year <number>]\n');
        console.log('Example:');
        console.log('  npx tsx scripts/find_comps.ts "27663 La Porte Ave, Hayward, CA" --beds 3 --baths 2 --sqft 1250 --lot 6000\n');
        process.exit(1);
    }

    console.log('\x1b[36m========================================================================\x1b[0m');
    console.log('\x1b[36m                     ZYPHE COMPARABLE ANALYSIS METHOD                   \x1b[0m');
    console.log('\x1b[36m========================================================================\x1b[0m');
    console.log('\x1b[33m1. ADDRESS RESOLUTION & GEOCODING:\x1b[0m');
    console.log('   The address is normalized and geocoded via Radar API.');
    console.log('\n\x1b[33m2. DYNAMIC COMPARABLE RETRIEVAL:\x1b[0m');
    console.log('   Recently sold properties (past 180 days, within 1 mile radius) are fetched');
    console.log('   using live Rentcast API data or our cached zip-code sold listings database.');
    console.log('\n\x1b[33m3. MATHEMATICAL MARKET REGRESSION:\x1b[0m');
    console.log('   We group raw sold comps by month, calculate Interquartile Range (IQR) bounds');
    console.log('   to discard statistical price-per-square-foot outliers, and perform linear');
    console.log('   regression on the median monthly PSF to compute the monthly market appreciation');
    console.log('   rate (capped at ±2%/month).');
    console.log('\n\x1b[33m4. SCORE-BASED TIERING AND ADJUSTMENT:\x1b[0m');
    console.log('   Comparables are ranked into four strict tiers:');
    console.log('     * Tier 1 (Ideal): Distance ≤0.25 mi, SQFT difference ≤10%, Sold ≤30 days ago');
    console.log('     * Tier 2 (Strong): Distance ≤0.50 mi, SQFT difference ≤15%, Sold ≤90 days ago');
    console.log('     * Tier 3 (Good): Distance ≤0.75 mi, SQFT difference ≤20%, Sold ≤180 days ago');
    console.log('     * Tier 4 (OK): Anything outside the above (fallback / excluded)');
    console.log('   * Lot size penalty: If comp lot is >2x or <0.5x of the subject, tier is demoted.');
    console.log('   * Days-on-market linear appreciation is applied to compute "Time-Adjusted Price".');
    console.log('\n\x1b[33m5. GEOSPATIAL LAND UTILITY ANALYSIS:\x1b[0m');
    console.log('   Performs automated parcel depth calculation via ArcGIS REST services and elevation');
    console.log('   slope sampling via USGS 3DEP elevation APIs to calculate usable/developable lot area');
    console.log('   and deduct setbacks/steep-slope zones.');
    console.log('\n\x1b[33m6. GEMINI AI FEATURE NORMALIZATION & POST-AI OUTLIER FILTERING:\x1b[0m');
    console.log('   Gemini normalizes features (condition, finishes, premiums) in parallel.');
    console.log('   A final post-AI filter drops any comp whose normalized $/SQFT deviates >20%');
    console.log('   from the median, and calculates the final recommended valuation.');
    console.log('\x1b[36m========================================================================\x1b[0m');

    console.log(`\n🚀 \x1b[32mInitiating Comparable Analysis for:\x1b[0m "${address}"...\n`);

    const subject = {
        address,
        bedrooms: beds,
        bathrooms: baths,
        squareFootage: sqft,
        lotSize: lot,
        yearBuilt: year,
    };

    try {
        const result = await findComps(subject, {
            forceRefresh: false,
            useZipCache: true,
            onProgress: (step) => {
                console.log(`  \x1b[90m[Progress]\x1b[0m ${step}`);
            }
        });

        console.log('\n\x1b[32m✔ Comparable Analysis Completed Successfully!\x1b[0m\n');
        console.log('\x1b[36m========================================================================\x1b[0m');
        console.log('\x1b[36m                           SUBJECT PROFILE                              \x1b[0m');
        console.log('\x1b[36m========================================================================\x1b[0m');
        console.log(`📍 Address:      ${result.subjectProperty.address}`);
        console.log(`📐 Specs:        ${result.subjectProperty.bedrooms ?? '?'} beds | ${result.subjectProperty.bathrooms ?? '?'} baths | ${result.subjectProperty.squareFootage ?? '?'} sqft`);
        console.log(`🏗 Year Built:   ${result.subjectProperty.yearBuilt ?? '?'}`);
        console.log(`🏡 Property Type: ${result.subjectProperty.homeType ?? '?'}`);
        console.log(`📈 Market Appreciation Rate: ${(result.monthlyAppreciationRate * 100).toFixed(2)}% / month`);
        console.log('\x1b[36m========================================================================\x1b[0m');

        if (result.eligibleComps.length === 0) {
            console.log('\n\x1b[33m⚠️ No eligible comparables were found meeting our search criteria (within 1 mi, ±1 bed, past 180 days).\x1b[0m\n');
            process.exit(0);
        }

        console.log('\n\x1b[36m========================================================================\x1b[0m');
        console.log('\x1b[36m                      TOP 3 ELIGIBLE COMPARABLES                        \x1b[0m');
        console.log('\x1b[36m========================================================================\x1b[0m');

        const displayComps = result.eligibleComps.slice(0, 3);
        displayComps.forEach((comp, idx) => {
            const saleDateStr = comp.lastSaleDate ? new Date(comp.lastSaleDate).toLocaleDateString() : 'N/A';
            console.log(`\n\x1b[33m[Comp #${idx + 1}] Tier ${comp.tier} | ${comp.formattedAddress}\x1b[0m`);
            console.log(`  * Specs:         ${comp.bedrooms} beds | ${comp.bathrooms} baths | ${comp.squareFootage} sqft`);
            console.log(`  * Distance:      ${comp.distance} miles`);
            console.log(`  * Sale Price:    $${comp.lastSalePrice?.toLocaleString()} (${saleDateStr})`);
            console.log(`  * Time-Adjusted: $${comp.adjustedPrice?.toLocaleString()}`);
            if (comp.isOutlier) {
                console.log('  * \x1b[31m[Outlier Status]: Flagged (dropped from final calculations)\x1b[0m');
            }
        });
        console.log('\x1b[36m========================================================================\x1b[0m');

        if (result.geminiResult?.final_summary) {
            const summary = result.geminiResult.final_summary;
            console.log('\n\x1b[32m========================================================================\x1b[0m');
            console.log('\x1b[32m                        VALUATION RECOMMENDATION                        \x1b[0m');
            console.log('\x1b[32m========================================================================\x1b[0m');
            console.log(`💰 Subject Recommended Value:  \x1b[1m$${summary.subject_valuation?.toLocaleString()}\x1b[0m`);
            console.log(`📐 Recommended Avg Price/Sqft:  $${summary.recommended_avg_psf}`);
            console.log(`📊 Number of Comps in Avg:      ${summary.comps_in_avg}`);
            console.log(`❌ Statistical Outliers Dropped: ${summary.outliers_dropped ?? 0}`);
            if (result.geminiResult.subject_audit?.adjustments?.length > 0) {
                console.log('\n📋 Subject Feature Audit Adjustments:');
                result.geminiResult.subject_audit.adjustments.forEach((adj: string) => {
                    console.log(`  - ${adj}`);
                });
            }
            if (result.geminiResult.subject_audit?.usable_lot) {
                console.log(`\n📐 Geospatial Lot Audit:`);
                console.log(`  * Gross Lot Area:  ${result.geminiResult.subject_audit.lot_calc?.gross?.toLocaleString()} sqft`);
                console.log(`  * Usable Lot Area: \x1b[32m${result.geminiResult.subject_audit.usable_lot?.toLocaleString()} sqft\x1b[0m (${Math.round((result.geminiResult.subject_audit.usable_lot / (result.geminiResult.subject_audit.lot_calc?.gross || 1)) * 100)}% usable)`);
                console.log(`  * Topographic Slope Category: ${result.geminiResult.subject_audit.slope_category || 'Gentle/Flat'}`);
            }
            console.log('\x1b[32m========================================================================\x1b[0m\n');
        }

        process.exit(0);
    } catch (error: any) {
        console.error('\n\x1b[31m[Error] Comparable analysis pipeline failed:\x1b[0m');
        console.error(error.stack || error.message);
        process.exit(1);
    }
}

run();
