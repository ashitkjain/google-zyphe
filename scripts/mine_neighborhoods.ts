/**
 * Standalone script to re-mine Pleasanton, CA neighborhoods.
 * Bypasses the cache check so it always runs fresh.
 *
 * Usage:
 *   npx ts-node --esm scripts/mine_neighborhoods.ts
 *   OR
 *   npx tsx scripts/mine_neighborhoods.ts
 */

import { mineCityNeighborhoods } from '../services/geminiService';

const CITY = 'Pleasanton';
const STATE = 'CA';
const USER_ID = 'script-runner';

async function main() {
    console.log(`\n🏔  Mining neighborhoods for ${CITY}, ${STATE}...\n`);
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
                const friendly = nd.nextdoor?.friendliness_score ?? '—';
                const afford = nd.nextdoor?.affordability_score ?? '—';
                console.log(
                    `  ${String(i + 1).padStart(2)}. ${nd.neighborhood_name.padEnd(30)} ` +
                    `rank=${rank}  friendly=${friendly}  afford=${afford}`
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
