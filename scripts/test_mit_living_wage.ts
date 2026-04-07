/**
 * Test: MIT Living Wage – Dublin, CA
 *
 * Dublin is in Alameda County, CA (FIPS: 06001).
 * Metro: San Francisco-Oakland-Fremont, CA (CBSA: 41860)
 * Family type: 2 Adults, 2 Children (Both Working)
 *   — This column includes child care (unlike "1 Working" where one parent stays home)
 *   — MIT shows per-adult wages; household total = per-adult × 2 × 2080
 *
 * Usage:
 *   npx ts-node --esm scripts/test_mit_living_wage.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });

import { GoogleGenAI } from '@google/genai';

// ── Dublin, CA property context ───────────────────────────────────────────────
// Dublin is in Alameda County; closest metro is SF-Oakland-Fremont (CBSA 41860)
const CITY        = 'Dublin';
const COUNTY      = 'Alameda';
const STATE       = 'CA';
const COUNTY_FIPS = '06001';
const METRO_CODE  = '41860';
const METRO_NAME  = 'San Francisco-Oakland-Fremont, CA';

const METRO_URL  = `https://livingwage.mit.edu/metros/${METRO_CODE}`;
const COUNTY_URL = `https://livingwage.mit.edu/counties/${COUNTY_FIPS}`;

// ── Prompt (inline to avoid ESM path issues) ──────────────────────────────────
const PROMPT = `
You are a cost-of-living research assistant with access to live web search.

TASK: Fetch the MIT Living Wage Calculator data for ${CITY}, ${STATE} (${METRO_NAME} metro).

═══════════════════════════════════════════════════════
URL STRATEGY (metro preferred over county)
═══════════════════════════════════════════════════════
STEP 1 — Try the METRO page first (more representative of local costs):
  URL: ${METRO_URL}
  This covers the ${METRO_NAME} CBSA.

  If the metro page 404s or has no data, fall back to:

STEP 2 — County page:
  URL: ${COUNTY_URL}
  This is for ${COUNTY} County, ${STATE}.

Record which URL you actually used in the \`source_url\` field, and set \`geographic_level\` to either "metro" or "county".

═══════════════════════════════════════════════════════
DATA TO EXTRACT
═══════════════════════════════════════════════════════
From the "Typical Expenses" table, extract EXACT numbers for the family type:
  "2 Adults, 2 Children" — BOTH WORKING column.

IMPORTANT about the "Both Working" column:
  - MIT shows the wage each adult must individually earn (NOT the household total)
  - Household annual income = per-adult hourly × 2 × 2080
  - The expense figures (food, housing, child care, etc.) are HOUSEHOLD totals
  - Child care IS included here (unlike "1 Working" where one parent stays home)

Extract:
  1.  Living wage per adult (hourly) — what each adult must earn
  2.  Household annual living wage = per-adult hourly × 2 × 2080
  3.  Food costs (annual household total)
  4.  Child Care costs (annual household total)
  5.  Medical / Health care (annual household total)
  6.  Housing (annual household total)
  7.  Transportation (annual household total)
  8.  Civic (annual — clothing, personal care, civic engagement, entertainment)
  9.  Broadband / Internet & mobile (annual — record 0 if not separately listed)
  10. Other / Miscellaneous (annual household total)
  11. Required annual household income BEFORE taxes

Also extract for reference:
  - Poverty wage (hourly)
  - State or local minimum wage (hourly)

RULES:
- Use ONLY the "2 Adults, 2 Children" column where BOTH ADULTS ARE WORKING
- Record EXACT values from the page — do not estimate or interpolate
- If the page shows monthly figures, multiply by 12 to get annual
- living_wage_hourly = per-adult hourly wage (what each adult must individually earn)
- annual_living_wage = household total (per-adult × 2 × 2080)
- all expense figures are household annual totals
- source_url = the exact MIT URL you used
- geographic_level = "metro" or "county"
- Include the data last-updated date shown on the page
- Write a 2-3 sentence gemini_summary for a dual-income family with 2 kids considering Dublin, CA

Return ONLY valid JSON in this exact shape:
{
  "county": string,
  "state": string,
  "metro": string | null,
  "geographic_level": "metro" | "county",
  "family_type": "2 Adults, 2 Children (Both Working)",
  "source_url": string,
  "data_updated": string,
  "living_wage_hourly": number,
  "annual_living_wage": number,
  "expenses": {
    "food": number,
    "child_care": number,
    "medical": number,
    "housing": number,
    "transportation": number,
    "civic": number,
    "broadband": number,
    "other": number,
    "required_annual_income_before_taxes": number
  },
  "reference": {
    "poverty_wage_hourly": number,
    "minimum_wage_hourly": number
  },
  "gemini_summary": string
}
`.trim();


// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null): string {
    if (n == null) return '—';
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtHr(n: number | undefined | null): string {
    if (n == null) return '—';
    return `$${n.toFixed(2)}/hr`;
}

function bar(n: number, total: number, width = 22): string {
    if (total === 0) return '░'.repeat(width);
    const fill = Math.max(1, Math.round((n / total) * width));
    return '█'.repeat(fill) + '░'.repeat(width - fill);
}

function wrapText(text: string, width = 66, indent = '  '): string {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = indent;
    for (const word of words) {
        if (line.length + word.length + 1 > width) { lines.push(line.trimEnd()); line = indent; }
        line += word + ' ';
    }
    if (line.trim()) lines.push(line.trimEnd());
    return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌  VITE_GEMINI_API_KEY not found in .env.local');
        process.exit(1);
    }
    console.log(`✅  API key loaded (${apiKey.substring(0, 8)}...)\n`);

    console.log('═'.repeat(70));
    console.log('  MIT LIVING WAGE TEST  —  Dublin, CA');
    console.log('  Family: 2 Adults · 2 Children · Both Working');
    console.log('  (Per-adult wage shown; household total = 2×)');
    console.log(`  Metro:  ${METRO_NAME} (CBSA ${METRO_CODE})`);
    console.log(`  County: ${COUNTY} (FIPS ${COUNTY_FIPS})`);
    console.log('═'.repeat(70));
    console.log('\n🤖  Calling Gemini 2.0 Flash + Google Search grounding...\n');

    const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' }
    });

    const start = Date.now();
    const result = await (ai.models as any).generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ parts: [{ text: PROMPT }] }],
        config: {
            tools: [{ googleSearch: {} }],
            temperature: 0.1,
        },
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const usage = result.usageMetadata || {};
    console.log(`⏱  Response in ${elapsed}s  |  Tokens: ${usage.promptTokenCount ?? '?'} in → ${usage.candidatesTokenCount ?? '?'} out\n`);

    // ── Parse ─────────────────────────────────────────────────────────────────
    const responseText: string = typeof result.text === 'function' ? result.text() : result.text;
    let data: any;
    try {
        const cleaned = responseText.replace(/```json\s*/ig, '').replace(/```\s*/g, '').trim();
        data = JSON.parse(cleaned);
    } catch {
        console.error('❌  Failed to parse JSON. Raw response:\n');
        console.log(responseText);
        process.exit(1);
    }

    // ── Display ───────────────────────────────────────────────────────────────
    const exp = data.expenses || {};
    const SPEND_KEYS = ['housing', 'food', 'child_care', 'transportation', 'medical', 'civic', 'broadband', 'other'];
    const LABELS: Record<string, string> = {
        housing: 'Housing', food: 'Food', child_care: 'Child Care',
        transportation: 'Transportation', medical: 'Medical / Health',
        civic: 'Civic', broadband: 'Internet & Mobile', other: 'Other',
    };
    const spendTotal = SPEND_KEYS.reduce((s, k) => s + (exp[k] ?? 0), 0);

    console.log('═'.repeat(70));
    console.log('  RESULT');
    console.log('═'.repeat(70));
    console.log(`  Location:         ${data.county || COUNTY} County, ${data.state || STATE}`);
    if (data.metro) console.log(`  Metro:            ${data.metro}`);
    const levelIcon = data.geographic_level === 'metro' ? '🌆 METRO' : '🗺  COUNTY';
    console.log(`  Geographic level: ${levelIcon}  ← data source`);
    console.log(`  Source URL:       ${data.source_url || '?'}`);
    console.log(`  Data updated:     ${data.data_updated || 'not shown'}`);
    console.log(`  Family type:      ${data.family_type || '?'}`);

    console.log('\n  ── LIVING WAGE (per adult) ─────────────────────────────────────');
    console.log(`  Per adult:        ${fmtHr(data.living_wage_hourly)}  ← each adult must earn this`);
    console.log(`  Household total:  ${fmt(data.annual_living_wage)}/yr  (per-adult × 2 × 2080)`);

    console.log('\n  ── EXPENSE BREAKDOWN (Annual → Monthly) ───────────────────────');
    console.log(`  ${'Category'.padEnd(18)} ${'Share'.padEnd(24)} %      Annual      /mo`);
    console.log(`  ${'─'.repeat(66)}`);

    for (const key of SPEND_KEYS) {
        const annual: number = exp[key] ?? 0;
        const monthly = Math.round(annual / 12);
        const pctNum = spendTotal > 0 ? (annual / spendTotal) * 100 : 0;
        const pctStr = pctNum.toFixed(1) + '%';
        const barStr = bar(annual, spendTotal, 22);
        const label = LABELS[key] ?? key;
        console.log(
            `  ${label.padEnd(18)} ${barStr}  ${pctStr.padStart(5)}  ${fmt(annual).padStart(9)}  ${fmt(monthly).padStart(7)}`
        );
    }

    console.log(`  ${'─'.repeat(66)}`);
    console.log(`  ${'Subtotal'.padEnd(18)} ${''.padEnd(24)}        ${fmt(spendTotal).padStart(9)}`);

    console.log('\n  ── REQUIRED INCOME BEFORE TAX ─────────────────────────────────');
    const req = exp.required_annual_income_before_taxes;
    console.log(`  Annual:           ${fmt(req)}`);
    console.log(`  Monthly:          ${fmt(req ? Math.round(req / 12) : null)}`);
    console.log(`  Hourly equiv:     ${fmtHr(req ? req / 2080 : null)}`);

    if (data.reference) {
        console.log('\n  ── REFERENCE WAGES ────────────────────────────────────────────');
        if (data.reference.poverty_wage_hourly)
            console.log(`  Poverty wage:     ${fmtHr(data.reference.poverty_wage_hourly)}`);
        if (data.reference.minimum_wage_hourly)
            console.log(`  Min wage (CA):    ${fmtHr(data.reference.minimum_wage_hourly)}`);
    }

    if (data.gemini_summary) {
        console.log('\n  ── GEMINI NARRATIVE ───────────────────────────────────────────');
        console.log(wrapText(data.gemini_summary, 70, '  '));
    }

    // ── Grounding sources ─────────────────────────────────────────────────────
    const chunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const webSources = chunks.filter((c: any) => c.web?.uri).map((c: any) => c.web);
    if (webSources.length > 0) {
        console.log('\n  ── GROUNDING SOURCES ──────────────────────────────────────────');
        webSources.slice(0, 5).forEach((s: any, i: number) => {
            console.log(`  ${i + 1}. ${(s.title || s.uri).substring(0, 60)}`);
            console.log(`     ${s.uri}`);
        });
    }

    // ── Raw JSON ──────────────────────────────────────────────────────────────
    console.log('\n  ── RAW JSON RESPONSE ──────────────────────────────────────────');
    console.log(JSON.stringify(data, null, 2).split('\n').map(l => '  ' + l).join('\n'));

    console.log('\n' + '═'.repeat(70));
    console.log('  ✅  Test complete.');
    console.log('═'.repeat(70) + '\n');

    process.exit(0);
}

main().catch(err => {
    console.error('\n❌ Test failed:', err?.message ?? err);
    process.exit(1);
});
