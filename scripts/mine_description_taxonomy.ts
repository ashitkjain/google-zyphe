/**
 * Mine MLS agent descriptions across all properties to find new taxonomy opportunities.
 *
 * Focuses on neighborhood, location, lifestyle, and other factors NOT currently
 * well-covered by the photo-analysis-centric taxonomy.
 *
 * Usage:
 *   npx tsx scripts/mine_description_taxonomy.ts
 *   npx tsx scripts/mine_description_taxonomy.ts --limit=200
 */

import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
}
const db = admin.firestore();

const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
const LIMIT = parseInt(limitArg || '150', 10);

// ── CURRENT TAXONOMY SUMMARY ──────────────────────────────────────────────────
// Used to tell Gemini what's already covered so it only surfaces NEW gaps.
const EXISTING_TAXONOMY_SUMMARY = `
CURRENTLY COVERED (do NOT suggest these again):
- Financial: price bracket, HOA, carrying cost, seller motivation, ADU potential, STR/LTR yield, appreciation
- Structural: living area, home office, garage/parking, foundation, construction era
- Interior: move-in readiness, renovation upside, architecture style, natural light, open-concept, kitchen, bathroom, flooring, ceiling height, interior finishes, luxury finishes
- Outdoor/Lot: fenced yard, outdoor entertainment (pool/spa/patio), privacy, curb appeal, topography, views, yard space, xeriscape
- Location basics: commute convenience, walkability (score), greenery proximity, sidewalk continuity
- Environmental: wildfire risk, flood risk, solar potential, pollen, HVAC quality, air quality, seismic risk, noise pollution
- Efficiency/Systems: internet connectivity, EV infrastructure, water/air systems, laundry, security infrastructure
- Lifestyle fit: work-from-home score, multi-gen utility, senior/family/professional fit
- Investment: market momentum, development status, zoning, growth catalysts, investment risk
- Community: community complaints/satisfaction, neighborhood safety, market velocity
- Nearby places: walkable amenities, medical proximity, dining & entertainment, job hubs, nearby development
- Agent intelligence: distressed sale signals, agent highlights (free-form), school concepts, condition concepts, lifestyle convenience concepts
- Street-level: street character, curbside risks, landscaping profile, parking setup, neighborhood condition
- Micro-climate: fog belt, sun-drenched, wind exposure
- City economics: wealth, education, age demographics
`;

// ── FETCH PROPERTIES ──────────────────────────────────────────────────────────
async function fetchPropertyDescriptions(): Promise<{ zpid: string; address: string; city: string; description: string }[]> {
    console.log(`\nFetching up to ${LIMIT} properties with MLS descriptions from Firestore...`);

    const snap = await db.collection('properties').get();

    const results: { zpid: string; address: string; city: string; description: string }[] = [];

    snap.forEach(doc => {
        const d = doc.data();
        const description = (d.description || d.text || '').trim();
        if (description && description.length > 80) {
            results.push({
                zpid: doc.id,
                address: d.address || '',
                city: d.city || '',
                description,
            });
        }
    });

    return results.slice(0, LIMIT);
}

// ── GEMINI ANALYSIS ───────────────────────────────────────────────────────────
async function getGeminiKey(): Promise<string> {
    // Try env first
    const envKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    if (envKey && envKey.length > 10 && !envKey.includes('YOUR_')) return envKey;

    // Fall back to Firestore app_config/api_keys (admin SDK — bypasses security rules)
    const snap = await db.collection('app_config').doc('api_keys').get();
    if (snap.exists) {
        const key = snap.data()?.gemini_key;
        if (key && key.length > 10) return key;
    }
    return '';
}

async function analyzeDescriptionsForTaxonomy(
    properties: { zpid: string; address: string; city: string; description: string }[]
): Promise<void> {
    const apiKey = await getGeminiKey();
    if (!apiKey) {
        console.error('ERROR: Gemini API key not found in env or Firestore app_config/api_keys');
        process.exit(1);
    }
    console.log(`Using Gemini key ending in ...${apiKey.slice(-4)}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Batch descriptions - send in chunks to keep prompt size reasonable
    const CHUNK_SIZE = 30;
    const chunks: typeof properties[] = [];
    for (let i = 0; i < properties.length; i += CHUNK_SIZE) {
        chunks.push(properties.slice(i, i + CHUNK_SIZE));
    }

    console.log(`\nAnalyzing ${properties.length} descriptions in ${chunks.length} batches of ${CHUNK_SIZE}...\n`);

    const allFindings: string[] = [];

    for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];
        console.log(`  Batch ${ci + 1}/${chunks.length} (${chunk.length} properties)...`);

        const descriptionsText = chunk.map((p, i) =>
            `[${i + 1}] ${p.address}, ${p.city}\n${p.description}`
        ).join('\n\n---\n\n');

        const prompt = `You are a real estate taxonomy expert. Your job is to mine MLS agent descriptions to find NEW property features, characteristics, and tags that are NOT yet in an existing taxonomy.

${EXISTING_TAXONOMY_SUMMARY}

Here are ${chunk.length} MLS agent descriptions from California properties:

${descriptionsText}

---

TASK: Read all descriptions carefully. Identify features, phrases, or signals mentioned in agent descriptions that:
1. Are NOT already covered by the existing taxonomy above
2. Appear in MULTIPLE descriptions (recurring patterns are more valuable)
3. Could be useful for matching properties to buyers (lifestyle, location, neighborhood quality, unique features)
4. Come specifically from AGENT LANGUAGE — things buyers care about that agents highlight

Focus especially on:
- Neighborhood & location descriptors agents use (e.g., "top-rated school district", "quiet cul-de-sac", "corner lot", "end unit")
- Lifestyle and convenience signals (e.g., "minutes to downtown", "walking distance to BART", "within tech corridor")
- Property-type specific features (e.g., "single-story living", "no steps", "flat driveway")
- Condition & update signals beyond basic renovation (e.g., "fresh exterior paint", "new water heater", "updated panel")
- Outdoor & lot specifics not captured (e.g., "RV access", "side yard", "gated driveway", "alley access")
- Community & HOA perks (e.g., "resort-style amenities", "clubhouse access", "gated community")
- Location proximity patterns (e.g., "minutes to freeway", "close to shopping", specific employer names)
- Unique selling props agents emphasize that buyers search for

OUTPUT FORMAT (structured list):
For each NEW taxonomy opportunity, provide:
- **Tag/Feature Name**: short, searchable (2-4 words)
- **Category**: which aspect of property it covers (Location, Neighborhood, Condition, Lifestyle, Lot/Outdoor, Community, etc.)
- **Example phrases from descriptions**: 2-3 verbatim phrases that triggered this
- **Frequency estimate**: how many of the ${chunk.length} descriptions mentioned this or similar (Low=1-2, Medium=3-5, High=6+)
- **Buyer value**: why a buyer would care (1 sentence)

Only report NEW opportunities not in the existing taxonomy. Be specific and actionable.`;

        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            allFindings.push(`\n=== BATCH ${ci + 1} FINDINGS ===\n${text}`);
            console.log(`    ✓ Done`);
        } catch (err) {
            console.error(`    ✗ Error in batch ${ci + 1}:`, err);
        }

        // Small delay to avoid rate limiting
        if (ci < chunks.length - 1) {
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    // ── SYNTHESIS PASS ────────────────────────────────────────────────────────
    console.log('\nRunning synthesis pass to deduplicate and rank findings...\n');

    const synthesisPrompt = `You are a real estate taxonomy expert. Multiple batches of MLS descriptions have been analyzed for new taxonomy opportunities. Here are the raw findings:

${allFindings.join('\n\n')}

---

TASK: Synthesize these findings into a FINAL RANKED LIST of new taxonomy additions.

1. Deduplicate overlapping suggestions
2. Rank by: (a) cross-batch frequency, (b) buyer value, (c) specificity/actionability
3. Group into logical categories

For each final recommendation provide:
- **Factor Name**: clear, 2-5 word name
- **Category**: (Location/Neighborhood/Lifestyle/Lot/Condition/Community/HOA/Convenience/Property-Type)
- **What it captures**: 1-2 sentences describing what this factor tracks
- **Example tags**: 3-6 specific tag values (e.g., "Cul-de-sac", "Corner Lot", "End Unit")
- **Priority**: High / Medium / Low (based on how often it appears and buyer value)
- **Extraction source**: "MLS Description" and/or "Agent Highlights" — how we'd extract this

Present the final list grouped by category, highest priority first within each group.
Also note at the end: what PATTERNS in agent language could we use as extraction signals for each factor.`;

    try {
        const synthesisResult = await model.generateContent(synthesisPrompt);
        const synthesisText = synthesisResult.response.text();

        console.log('\n' + '═'.repeat(80));
        console.log('TAXONOMY MINING RESULTS — SYNTHESIZED RECOMMENDATIONS');
        console.log('═'.repeat(80));
        console.log(synthesisText);
        console.log('═'.repeat(80));

        // Write results to file
        const outputPath = path.resolve(process.cwd(), 'scripts/taxonomy_mining_results.md');
        const fs = await import('fs');
        const output = `# Taxonomy Mining Results\n_Generated: ${new Date().toISOString()}_\n_Properties analyzed: ${properties.length}_\n\n## Synthesized Recommendations\n\n${synthesisText}\n\n---\n\n## Raw Batch Findings\n\n${allFindings.join('\n\n')}`;
        fs.writeFileSync(outputPath, output, 'utf8');
        console.log(`\nFull results saved to: scripts/taxonomy_mining_results.md`);
    } catch (err) {
        console.error('Error in synthesis pass:', err);
        // Still write raw findings
        const outputPath = path.resolve(process.cwd(), 'scripts/taxonomy_mining_results_raw.md');
        const fs = await import('fs');
        fs.writeFileSync(outputPath, allFindings.join('\n\n'), 'utf8');
        console.log(`Raw findings saved to: scripts/taxonomy_mining_results_raw.md`);
    }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log('═'.repeat(60));
    console.log('MLS Description Taxonomy Miner');
    console.log('═'.repeat(60));

    const properties = await fetchPropertyDescriptions();

    if (properties.length === 0) {
        console.error('No properties with descriptions found. Check Firestore access.');
        process.exit(1);
    }

    console.log(`\nFound ${properties.length} properties with descriptions.`);

    // Show city breakdown
    const cityCounts: Record<string, number> = {};
    properties.forEach(p => { cityCounts[p.city] = (cityCounts[p.city] || 0) + 1; });
    console.log('\nCity breakdown:');
    Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).forEach(([city, count]) => {
        console.log(`  ${city}: ${count}`);
    });

    await analyzeDescriptionsForTaxonomy(properties);

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
