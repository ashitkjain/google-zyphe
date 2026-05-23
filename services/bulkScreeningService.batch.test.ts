/**
 * Batch integration test — runs the full 3-phase bulk screening pipeline
 * against 40 real properties from the 340houses MLS export.
 *
 * Requires .env.local with valid API keys (Radar, Rentcast/US Housing, Gemini).
 * Run with: npx vitest run services/bulkScreeningService.batch.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { runBulkScreening } from './bulkScreeningService';
import { parsePropertyCsv } from '../utils/parsePropertyCsv';

// ─── Fixture ──────────────────────────────────────────────────────────────────
// 40 properties from the 340houses MLS export (Bay Area, ~$2.4M–$2.5M range)

const CSV = `,S,MLS #,Street Address,Price,DOM,Beds Total,Bths,Sq Ft Total,Lot Size,Postal City,Property Sub Type,Age
1,A,ML82045997,4889 Clarendon Drive,$2500000.00,7,4,3|0,1979,6448 Lot SqFt,San Jose,Res. Single Family,68
2,A,BE41133514,4858 Sterling Dr,$2500000.00,2,4,3|0,2533,9375 Lot SqFt,Fremont,Res. Single Family,73
3,A,ML82041352,1130 Nevada Avenue,$2500000.00,41,4,3|1,2373,6187 Lot SqFt,San Jose,Res. Single Family,96
4,A,ML82043166,2466 Armstrong,$2499999.00,,4,2|0,1885,5520 Lot SqFt,Santa Clara,Res. Single Family,71
5,A,ML82046482,953 Kenneth Avenue,$2499888.00,5,3,2|0,1454,10218 Lot SqFt,Campbell,Res. Single Family,77
6,A,ML82041476,1602 Sheffield Avenue,$2499000.00,37,4,3|0,2386,7700 Lot SqFt,San Jose,Res. Single Family,64
7,A,ML82040215,1439 Miller Avenue,$2499000.00,49,4,2|0,1778,6324 Lot SqFt,San Jose,Res. Single Family,67
8,A,ML82038168,901 Sunnyvale Saratoga Road,$2498998.00,54,4,1|0,1805,17424 Lot SqFt,Sunnyvale,Res. Single Family,136
9,A,ML82044903,2488 Hart Avenue,$2498888.00,7,5,3|0,2204,5520 Lot SqFt,Santa Clara,Res. Single Family,69
10,A,ML82040457,1626 Peacock Avenue,$2498800.00,,3,2|0,1524,6480 Lot SqFt,Sunnyvale,Res. Single Family,68
11,A,ML82046769,807 Cathedral Drive,$2498000.00,1,3,2|0,1512,10560 Lot SqFt,Sunnyvale,Res. Single Family,65
12,A,ML82046458,1087 S Stelling Road,$2498000.00,5,3,2|0,1421,6100 Lot SqFt,Cupertino,Res. Single Family,66
13,A,ML82045904,1151 Carolyn Avenue,$2498000.00,6,3,2|0,1797,6840 Lot SqFt,San Jose,Res. Single Family,76
14,A,ML82045827,719 Jackpine Court,$2498000.00,8,3,2|0,1433,5500 Lot SqFt,Sunnyvale,Res. Single Family,70
15,A,ML82044426,869 Lusterleaf Drive,$2498000.00,19,4,2|1,2204,6080 Lot SqFt,Sunnyvale,Res. Single Family,60
16,A,ML82044569,1666 Swallow Drive,$2495000.00,19,3,2|0,1338,6000 Lot SqFt,Sunnyvale,Res. Single Family,69
17,A,SF426124493,1666 Swallow Drive,$2495000.00,20,3,2|0,1338,6000 Lot SqFt,Sunnyvale,Res. Single Family,69
18,A,CC41131843,1079 Ginger Ln,$2495000.00,14,5,2|1,2102,6000 Lot SqFt,San Jose,Res. Single Family,64
19,A,ML82044580,17250 Pine Avenue,$2490000.00,19,4,3|0,2066,35313 Lot SqFt,Los Gatos,Res. Single Family,111
20,A,ML82041626,18825 Pendergast Avenue,$2488888.00,7,4,3|0,1618,5304 Lot SqFt,Cupertino,Res. Single Family,73
21,A,ML82039113,1547 Grackle Way,$2488888.00,8,3,2|0,1362,6902 Lot SqFt,Sunnyvale,Res. Single Family,64
22,A,ML82046881,945 Reed Avenue,$2488000.00,,3,2|0,1830,10200 Lot SqFt,Sunnyvale,Res. Single Family,62
23,A,ML82045861,586 Rockport Drive,$2488000.00,8,5,3|0,2363,8811 Lot SqFt,Sunnyvale,Res. Single Family,67
24,A,ML82046031,918 Mangrove Avenue,$2458000.00,7,4,2|1,1791,5580 Lot SqFt,Sunnyvale,Res. Single Family,64
25,A,ML82046603,227 Howes Drive,$2450000.00,,4,2|0,1918,6500 Lot SqFt,Los Gatos,Res. Single Family,63
26,A,ML82034859,2791 Scott Street,$2450000.00,78,5,5|0,2485,8424 Lot SqFt,San Jose,Res. Single Family,75
27,A,ML82044401,375 Stowell Avenue,$2430000.00,20,4,3|0,1694,5200 Lot SqFt,Sunnyvale,Res. Single Family,84
28,A,ML82046644,16857 Farley Road,$2400000.00,,3,2|0,1605,8820 Lot SqFt,Los Gatos,Res. Single Family,71
29,A,ML82043778,4893 Clarendon Drive,$2400000.00,,3,2|0,1400,6386 Lot SqFt,San Jose,Res. Single Family,68
30,A,ML82039984,1887 Blossom Hill Road,$2400000.00,,5,2|1,2369,10500 Lot SqFt,San Jose,Res. Single Family,61
31,A,ML82046268,204 Hardy Avenue,$2399888.00,1,3,2|0,1437,9375 Lot SqFt,Campbell,Res. Single Family,76
32,A,ML82041623,16737 Leroy Avenue,$2399888.00,36,4,3|0,1525,8961 Lot SqFt,Los Gatos,Res. Single Family,77
33,A,ML82042801,1748 Harte,$2398000.00,30,4,2|0,2029,7169 Lot SqFt,San Jose,Res. Single Family,65
34,A,ML82034737,22081 Caroline Drive,$2398000.00,90,3,2|0,1416,9375 Lot SqFt,Cupertino,Res. Single Family,74
35,A,ML82045220,68 N Midway Street,$2390000.00,13,4,3|1,2116,7272 Lot SqFt,Campbell,Res. Single Family,69
36,A,BE41131908,38048 Palmer Dr,$2389950.00,21,4,2|1,2006,9929 Lot SqFt,Fremont,Res. Single Family,71
37,A,ML82046777,5106 Emiline Drive,$2388000.00,1,4,3|0,1745,6000 Lot SqFt,San Jose,Res. Single Family,67
38,A,ML82045866,1594 Inverness Circle,$2388000.00,8,5,4|0,2123,6180 Lot SqFt,San Jose,Res. Single Family,62
39,A,ML82044827,826 Fife Way,$2388000.00,7,3,2|0,1302,6080 Lot SqFt,Sunnyvale,Res. Single Family,65
40,A,ML82046999,1234 Oak Street,$2388000.00,3,4,3|0,1850,7000 Lot SqFt,Sunnyvale,Res. Single Family,58`;

// ─── Test ─────────────────────────────────────────────────────────────────────

describe('bulkScreeningService — 40 properties end-to-end', () => {
    let result: Awaited<ReturnType<typeof runBulkScreening>>;

    beforeAll(async () => {
        const subjects = parsePropertyCsv(CSV);
        expect(subjects).toHaveLength(40);

        console.log('\n=== Starting 3-phase bulk screening on 40 properties ===\n');

        result = await runBulkScreening(subjects, {
            onProgress: (msg) => console.log(`  [progress] ${msg}`),
        });

        // ── Print full results table ──────────────────────────────────────────
        console.log('\n=== RESULTS ===\n');
        console.log(
            ['Phase', 'MLS ID', 'Address', 'List Price', 'Market Value', 'Discount $', 'Discount %']
                .join('\t')
        );

        const sorted = [...result.rows].sort((a, b) => {
            const order: Record<string, number> = { confirmed: 0, candidate: 1, skipped_p1: 2, skipped_p0: 3, error: 4, pending: 5 };
            if (order[a.phase] !== order[b.phase]) return order[a.phase] - order[b.phase];
            return (b.discountPct ?? -99) - (a.discountPct ?? -99);
        });

        for (const row of sorted) {
            const mv = row.geminiMarketValue ?? row.rawMarketValue;
            console.log([
                row.phase.toUpperCase().padEnd(12),
                (row.mlsId ?? '').padEnd(14),
                row.address.slice(0, 40).padEnd(42),
                row.listPrice ? `$${(row.listPrice / 1000).toFixed(0)}K`.padStart(8) : '     —',
                mv ? `$${(mv / 1000).toFixed(0)}K`.padStart(8) : '     —',
                row.discountDollars != null ? `$${(row.discountDollars / 1000).toFixed(0)}K`.padStart(8) : '     —',
                row.discountPct != null ? `${row.discountPct.toFixed(1)}%`.padStart(7) : '    —',
                row.error ? `  ⚠️ ${row.error.slice(0, 60)}` : '',
            ].join('\t'));
        }

        console.log('\n=== SUMMARY ===');
        console.log(`  Total:             ${result.rows.length}`);
        console.log(`  Phase 0 eliminated: ${result.phase0Eliminated} (priced at/above Zestimate)`);
        console.log(`  Phase 1 candidates: ${result.phase1Candidates} (10%+ below raw comps)`);
        console.log(`  Phase 2 confirmed:  ${result.phase2Confirmed} (Gemini-verified deals)`);
        console.log(`  Errors:             ${result.errors}`);
        console.log(`  Duration:           ${(result.durationMs / 1000).toFixed(1)}s`);
        console.log('');
    }, 15 * 60 * 1000); // 15-minute timeout for real API calls

    it('parses all 40 properties', () => {
        expect(result.rows).toHaveLength(40);
    });

    it('every row has a final phase (not stuck as pending)', () => {
        const pending = result.rows.filter(r => r.phase === 'pending');
        expect(pending).toHaveLength(0);
    });

    it('every row has a non-null listPrice and address', () => {
        for (const row of result.rows) {
            expect(row.listPrice).toBeGreaterThan(0);
            expect(row.address).toMatch(/, CA$/);
        }
    });

    it('phase counts add up to total', () => {
        const total = result.rows.length;
        const counted =
            result.rows.filter(r => r.phase === 'skipped_p0').length +
            result.rows.filter(r => r.phase === 'skipped_p1').length +
            result.rows.filter(r => r.phase === 'candidate').length +
            result.rows.filter(r => r.phase === 'confirmed').length +
            result.rows.filter(r => r.phase === 'error').length;
        expect(counted).toBe(total);
    });

    it('confirmed properties have a Gemini market value', () => {
        const confirmed = result.rows.filter(r => r.phase === 'confirmed');
        for (const row of confirmed) {
            expect(row.geminiMarketValue).not.toBeNull();
            expect(row.geminiMarketValue).toBeGreaterThan(0);
        }
    });

    it('confirmed properties show a meaningful discount vs list price', () => {
        const confirmed = result.rows.filter(r => r.phase === 'confirmed');
        for (const row of confirmed) {
            // Gemini confirmed they're undervalued — discount should be positive
            expect(row.discountDollars).toBeGreaterThan(0);
            expect(row.discountPct).toBeGreaterThan(0);
        }
    });

    it('skipped_p1 properties have a raw market value from comps', () => {
        const skipped = result.rows.filter(r => r.phase === 'skipped_p1');
        for (const row of skipped) {
            // They ran Phase 1, so they should have a market value estimate
            expect(row.rawMarketValue).not.toBeNull();
        }
    });

    it('phase 1 is faster than running Gemini on everything', () => {
        // If all 40 hit Gemini it would take ~20+ minutes.
        // Phase 1 elimination means Phase 2 runs on far fewer.
        expect(result.phase2Confirmed + result.phase1Candidates).toBeLessThan(result.rows.length);
    });
});
