/**
 * Dynamic City Mining Script
 * 
 * Usage:
 *   npx ts-node --esm scripts/mine_neighborhoods.ts --city=Dublin --state=CA
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env first, then override with .env.local if present
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

import { mineCityNeighborhoods } from '../services/geminiService';

// ── GET ARGUMENTS ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const cityArg = args.find(a => a.startsWith('--city='))?.split('=')[1];
const stateArg = args.find(a => a.startsWith('--state='))?.split('=')[1];

const CITY = cityArg || 'Dublin';
const STATE = stateArg || 'CA';
const USER_ID = 'script-runner';

async function main() {
    const key = process.env.VITE_GEMINI_API_KEY || '';
    const keyPreview = key ? `${key.substring(0, 8)}...` : 'MISSING';
    console.log(`\n🏔  Mining neighborhoods for ${CITY}, ${STATE}... (Key: ${keyPreview})\n`);
    console.log('Model: gemini-3-pro-preview | Grounding: enabled\n');
    console.log('─'.repeat(60));

    try {
        const result = await mineCityNeighborhoods(
            CITY,
            STATE,
            USER_ID,
            (msg: string) => console.log(` › ${msg}`)
        );

        console.log('\n' + '─'.repeat(60));
        console.log(`\n✅ Done. Found ${result.data?.neighborhoods?.length ?? 0} neighborhoods.\n`);

        if (result.data?.neighborhoods?.length) {
            console.log('Neighborhood list:');
            result.data.neighborhoods.forEach((n, i) => {
                const nd = n as any;
                const rank = nd.nextdoor?.overall_city_rank ?? '—';
                const score = nd.nextdoor?.friendliness_score ?? '—';
                const afford = nd.nextdoor?.affordability_score ?? '—';
                console.log(
                    `  ${String(i + 1).padStart(2)}. ${nd.neighborhood_name.padEnd(30)} ` +
                    `rank=${rank}  social=${score}  afford=${afford}`
                );
            });
        }

        if (result.data?.city_summary) {
            console.log('\n📍 City Summary (first 300 chars):');
            console.log(' ', (result.data.city_summary as string).substring(0, 300) + '...');
        }

        console.log(`\n💰 Cost: $${result.usage?.cost?.toFixed(4) ?? '?'} | Tokens: ${result.usage?.totalTokens ?? '?'}\n`);

    } catch (err: any) {
        console.error('\n❌ Error:', err.message ?? err);
        process.exit(1);
    }
}

main();
