#!/usr/bin/env npx tsx
/**
 * CLI Diagnostic: Context Graph Size Analyzer
 *
 * Loads a property from Firestore and analyzes the context size breakdown
 * to identify token waste before sending to Gemini.
 *
 * Usage:
 *   npx tsx scripts/analyze-context-size.ts                    # Picks largest Dublin property
 *   npx tsx scripts/analyze-context-size.ts 2068641668         # Specific zpid
 */

// Shim import.meta.env for Vite modules
if (!(import.meta as any).env) {
    (import.meta as any).env = {};
}

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, getDoc, doc, limit } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBiP85bXTptTAqvXUh4JwYC-6SQJqwukvI",
    authDomain: "zyphe-af0bf.firebaseapp.com",
    projectId: "zyphe-af0bf",
    storageBucket: "zyphe-af0bf.firebasestorage.app",
    messagingSenderId: "434538487700",
    appId: "1:434538487700:web:2d0880addbfdca71c13981",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// ANSI
const C = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
    blue: '\x1b[34m', cyan: '\x1b[36m', white: '\x1b[37m',
    bgBlue: '\x1b[44m', bgYellow: '\x1b[43m',
};

function sizeStr(bytes: number): string {
    if (bytes < 1000) return `${bytes}B`;
    if (bytes < 100000) return `${(bytes / 1000).toFixed(1)}K`;
    return `${Math.round(bytes / 1000)}K`;
}

function tokStr(chars: number): string {
    return `~${Math.round(chars / 4)}`;
}

async function main() {
    const zpidArg = process.argv[2];

    console.log('');
    console.log(`${C.bold}${C.bgBlue}${C.white} 🔬 CONTEXT SIZE ANALYZER ${C.reset}`);
    console.log('');

    // 1. Find a zpid
    let zpid = zpidArg;
    if (!zpid) {
        console.log(`${C.dim}No zpid provided, finding Dublin properties...${C.reset}`);
        const q = query(collection(db, 'properties'), where('city', '==', 'Dublin'), limit(20));
        const snap = await getDocs(q);
        if (snap.empty) {
            console.error('No Dublin properties found.');
            process.exit(1);
        }
        // Pick a random one
        const docs = snap.docs;
        zpid = docs[Math.floor(Math.random() * docs.length)].id;
        console.log(`${C.cyan}Selected: ${zpid}${C.reset}`);
    }

    // 2. Load all data sources
    console.log(`${C.dim}Loading property data...${C.reset}`);
    const [propSnap, visualSnap, compSnap, envSnap, lifestyleSnap] = await Promise.all([
        getDoc(doc(db, 'properties', zpid)),
        getDoc(doc(db, 'property_analyses_visual', zpid)),
        getDoc(doc(db, 'property_analyses_comprehensive', zpid)),
        getDoc(doc(db, 'google_environmental_data', zpid)),
        getDoc(doc(db, 'lifestyle_insights', zpid)),
    ]);

    const property = propSnap.exists() ? propSnap.data() : null;
    const visual = visualSnap.exists() ? visualSnap.data() : null;
    const comprehensive = compSnap.exists() ? compSnap.data() : null;
    const envData = envSnap.exists() ? envSnap.data() : null;
    const lifestyleFit = lifestyleSnap.exists() ? lifestyleSnap.data() : null;

    if (!property) {
        console.error(`Property ${zpid} not found.`);
        process.exit(1);
    }

    console.log(`${C.bold}Property:${C.reset} ${property.address || zpid}`);
    console.log('');

    // 3. Simulate the enrichment that CityDataTab does
    const enrichedProperty = envData ? { ...property, ...envData } : property;
    let enrichedVisual = visual || {};
    if (lifestyleFit) enrichedVisual = { ...enrichedVisual, lifestyle_fit: lifestyleFit };

    // 4. Build context (same as buildGraphExtractionContext)
    const { optimizePropertyForAi } = await import('../utils/aiOptimization');

    const optimizedProperty = optimizePropertyForAi(enrichedProperty as any);

    // Strip city-level data from visual
    let optimizedVisual: any = null;
    if (enrichedVisual && Object.keys(enrichedVisual).length > 0) {
        const {
            image_by_image_analysis,
            image_quality_analysis,
            general_market_intelligence,
            deep_investment_research,
            community_pulse,
            property_investment,
            ...kept
        } = enrichedVisual as any;
        optimizedVisual = kept;
    }

    const narrative = comprehensive ? {
        summary: comprehensive.summary,
        detailedAnalysis: comprehensive.detailed_analysis,
        strategicInsights: comprehensive.strategic_insights,
        risksAndConsiderations: comprehensive.risks_considerations,
    } : null;

    const context = {
        property: optimizedProperty,
        visualAnalysis: optimizedVisual,
        narrativeReport: narrative,
    };

    // 5. Analyze sizes
    const totalChars = JSON.stringify(context).length;
    console.log(`${C.bold}${C.bgYellow} TOTAL CONTEXT: ${sizeStr(totalChars)} chars (${tokStr(totalChars)} tokens) ${C.reset}`);
    console.log('');

    // Section breakdown
    console.log(`${C.bold}${C.cyan}═══ TOP-LEVEL SECTIONS ═══${C.reset}`);
    for (const [key, val] of Object.entries(context)) {
        const size = val ? JSON.stringify(val).length : 0;
        const pct = totalChars > 0 ? Math.round((size / totalChars) * 100) : 0;
        const bar = '█'.repeat(Math.round(pct / 2)) + '░'.repeat(50 - Math.round(pct / 2));
        console.log(`  ${C.bold}${key}${C.reset}: ${sizeStr(size)} (${pct}%) ${C.dim}${bar}${C.reset}`);
    }

    // Property sub-sections
    console.log('');
    console.log(`${C.bold}${C.cyan}═══ PROPERTY SUB-SECTIONS (sorted by size) ═══${C.reset}`);
    const propSubs: [string, number][] = [];
    for (const [key, val] of Object.entries(optimizedProperty)) {
        const size = val ? JSON.stringify(val).length : 0;
        if (size > 100) propSubs.push([key, size]);
    }
    propSubs.sort((a, b) => b[1] - a[1]);

    let propTotal = 0;
    for (const [key, size] of propSubs) {
        propTotal += size;
        const pct = Math.round((size / JSON.stringify(optimizedProperty).length) * 100);
        const indicator = size > 20000 ? `${C.red}🔴` : size > 5000 ? `${C.yellow}🟡` : `${C.green}🟢`;
        console.log(`  ${indicator} ${C.bold}${key}${C.reset}: ${sizeStr(size)} (${pct}%)${C.reset}`);
    }

    // Visual sub-sections
    if (optimizedVisual) {
        console.log('');
        console.log(`${C.bold}${C.cyan}═══ VISUAL ANALYSIS SUB-SECTIONS ═══${C.reset}`);
        const visSubs: [string, number][] = [];
        for (const [key, val] of Object.entries(optimizedVisual)) {
            const size = val ? JSON.stringify(val).length : 0;
            if (size > 100) visSubs.push([key, size]);
        }
        visSubs.sort((a, b) => b[1] - a[1]);
        for (const [key, size] of visSubs) {
            const indicator = size > 20000 ? `${C.red}🔴` : size > 5000 ? `${C.yellow}🟡` : `${C.green}🟢`;
            console.log(`  ${indicator} ${C.bold}${key}${C.reset}: ${sizeStr(size)}${C.reset}`);
        }
    }

    // Recommendations
    console.log('');
    console.log(`${C.bold}${C.cyan}═══ OPTIMIZATION RECOMMENDATIONS ═══${C.reset}`);
    const bigProps = propSubs.filter(([, s]) => s > 10000);
    if (bigProps.length > 0) {
        console.log(`${C.yellow}  Property fields > 10K chars that may be redundant for context graph:${C.reset}`);
        for (const [key, size] of bigProps) {
            // Check if this is precomputed
            const precomputed = ['schools', 'walkScore', 'bikeScore', 'transitScore', 'solarData', 'airQuality', 'pollen', 'broadband', 'evChargers', 'noiseScore', 'google_places'].includes(key);
            const flag = precomputed ? `${C.red}← ALREADY PRECOMPUTED, can strip${C.reset}` : '';
            console.log(`    ${key}: ${sizeStr(size)} ${flag}`);
        }
    }

    // Calculate potential savings
    const strippableKeys = ['google_places', 'schools', 'walkScore', 'bikeScore', 'transitScore', 'solarData', 'airQuality', 'pollen', 'broadband', 'evChargers', 'noiseScore', 'taxHistory', 'homeValues', 'zestimateHistory', 'comingSoonData'];
    let savings = 0;
    for (const [key, size] of propSubs) {
        if (strippableKeys.includes(key)) savings += size;
    }
    if (savings > 0) {
        const newTotal = totalChars - savings;
        console.log('');
        console.log(`${C.bold}  Potential savings: ${sizeStr(savings)} chars (${tokStr(savings)} tokens)${C.reset}`);
        console.log(`${C.bold}  New total: ${sizeStr(newTotal)} chars (${tokStr(newTotal)} tokens)${C.reset}`);
    }

    console.log('');
    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
