/**
 * Unit tests for Gemini response text extraction.
 *
 * Run with:  npx ts-node --skip-project services/geminiService.extraction.test.ts
 *
 * These tests reproduce the bug where `result.text` is undefined when the
 * Google Search grounding tool is enabled, causing compNormalization to
 * silently return undefined and break the valuation pipeline.
 */

// ─── Inline the extraction logic so this file is standalone ──────────────────

function extractResponseText(result: any): string | undefined {
    // Shape 1: text is a callable getter (older SDK versions)
    if (typeof result?.text === 'function') return result.text();
    // Shape 2: text is a direct string property (non-grounded calls)
    if (typeof result?.text === 'string') return result.text;
    // Shape 3: Google Search grounding — text is absent on the root object,
    //          but the content IS in candidates[0].content.parts[].text
    const parts = result?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
        const joined = parts.map((p: any) => p.text || '').join('');
        if (joined) return joined;
    }
    return undefined;
}

// ─── Test harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function expect(label: string, actual: any, expected: any) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) {
        console.log(`  ✅  ${label}`);
        passed++;
    } else {
        console.error(`  ❌  ${label}`);
        console.error(`      Expected: ${JSON.stringify(expected)}`);
        console.error(`      Got:      ${JSON.stringify(actual)}`);
        failed++;
    }
}

// ─── Test cases ───────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════');
console.log('  Gemini Response Text Extraction Tests');
console.log('══════════════════════════════════════════════\n');

// 1. Normal text response (no grounding)
expect(
    'Direct string text property',
    extractResponseText({ text: '{"comp_analysis":[]}', candidates: [] }),
    '{"comp_analysis":[]}'
);

// 2. Old SDK where .text is a getter function
expect(
    'Callable .text() getter',
    extractResponseText({ text: () => '{"comp_analysis":[]}' }),
    '{"comp_analysis":[]}'
);

// 3. ⚠️  THE BUG: Google Search grounding — .text is undefined on root
expect(
    'Google Search grounded — text undefined, content in candidates parts',
    extractResponseText({
        text: undefined,
        candidates: [{
            content: { parts: [{ text: '{"comp_analysis":[]}' }] },
            finishReason: 'STOP',
        }],
    }),
    '{"comp_analysis":[]}'
);

// 4. Multi-part response (e.g., grounding citation interleaved)
expect(
    'Multi-part candidates with concatenated text',
    extractResponseText({
        text: undefined,
        candidates: [{
            content: { parts: [{ text: '{"comp_' }, { text: 'analysis":[]}' }] },
            finishReason: 'STOP',
        }],
    }),
    '{"comp_analysis":[]}'
);

// 5. Genuinely empty response (model refused / safety block)
expect(
    'Genuinely empty response returns undefined',
    extractResponseText({
        text: undefined,
        candidates: [{ content: { parts: [] }, finishReason: 'SAFETY' }],
    }),
    undefined
);

// 6. Completely missing candidates
expect(
    'Missing candidates returns undefined',
    extractResponseText({ text: undefined, candidates: undefined }),
    undefined
);

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n══════════════════════════════════════════════`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`══════════════════════════════════════════════\n`);

if (failed > 0) process.exit(1);
