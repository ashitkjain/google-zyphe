#!/usr/bin/env npx tsx
/**
 * CLI Runner: Pipeline Integration Test
 *
 * Runs the full integration test from the terminal without needing the UI.
 * Picks N random properties from a city, runs pre-smoke → full intel → post-smoke,
 * and detects systemic pipeline failures.
 *
 * Usage:
 *   npx tsx scripts/run-integration-test.ts                     # Dublin, 4 properties
 *   npx tsx scripts/run-integration-test.ts Pleasanton 2        # Pleasanton, 2 properties
 *   npx tsx scripts/run-integration-test.ts Dublin 6            # Dublin, 6 properties
 */

// ── Shim import.meta.env for Vite-specific modules (posthog, etc.) ───────────
// @ts-ignore — these modules expect to run inside Vite; provide empty env
if (!(import.meta as any).env) {
    (import.meta as any).env = {};
}

import { runIntegrationTest, IntegrationTestProgress } from '../services/integrationTest';

// ── Parse CLI args ───────────────────────────────────────────────────────────
const city = process.argv[2] || 'Dublin';
const sampleSize = parseInt(process.argv[3] || '4', 10);

// ── ANSI Colors ──────────────────────────────────────────────────────────────
const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
};

function colorLog(msg: string): string {
    if (msg.includes('✓') || msg.includes('✅') || msg.includes('PASS') || msg.includes('healed') || msg.includes('complete'))
        return `${C.green}${msg}${C.reset}`;
    if (msg.includes('✗') || msg.includes('❌') || msg.includes('FAIL') || msg.includes('CRASHED') || msg.includes('Error'))
        return `${C.red}${msg}${C.reset}`;
    if (msg.includes('[IntTest]'))
        return `${C.yellow}${msg}${C.reset}`;
    if (msg.includes('[Pipeline]') || msg.includes('[Discovery]'))
        return `${C.cyan}${msg}${C.reset}`;
    if (msg.includes('[Visual]') || msg.includes('[Narrative]') || msg.includes('[Smoke'))
        return `${C.magenta}${msg}${C.reset}`;
    return `${C.dim}${msg}${C.reset}`;
}

// ── Progress Handler ─────────────────────────────────────────────────────────
const phaseEmoji: Record<string, string> = {
    loading: '📦',
    'pre-smoke': '🔍',
    pipeline: '⚙️',
    'post-smoke': '🔎',
    analysis: '📊',
    done: '🏁',
};

function onProgress(p: IntegrationTestProgress) {
    const emoji = phaseEmoji[p.phase] || '▸';
    const progress = p.current && p.total ? ` [${p.current}/${p.total}]` : '';
    console.log(`${C.bold}${C.blue}${emoji} [${p.phase.toUpperCase()}]${C.reset}${progress} ${p.message}`);
}

// ── Log Handler ──────────────────────────────────────────────────────────────
function onLog(msg: string) {
    const ts = new Date().toLocaleTimeString();
    console.log(`${C.dim}[${ts}]${C.reset} ${colorLog(msg)}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('');
    console.log(`${C.bold}${C.bgBlue}${C.white} 🤖 PIPELINE INTEGRATION TEST ${C.reset}`);
    console.log(`${C.bold}   City:${C.reset} ${city}`);
    console.log(`${C.bold}   Sample Size:${C.reset} ${sampleSize}`);
    console.log(`${C.dim}${'─'.repeat(60)}${C.reset}`);
    console.log('');

    const startTime = Date.now();

    try {
        const result = await runIntegrationTest(city, sampleSize, onProgress, onLog);

        console.log('');
        console.log(`${C.dim}${'═'.repeat(60)}${C.reset}`);
        console.log(`${C.bold}${result.passed ? C.bgGreen : C.bgRed}${C.white} ${result.passed ? '✅ TEST PASSED' : '❌ TEST FAILED'} ${C.reset}`);
        console.log(`${C.dim}${'═'.repeat(60)}${C.reset}`);
        console.log('');

        // Per-property summary
        console.log(`${C.bold}${C.cyan}Property Results:${C.reset}`);
        for (const prop of result.properties) {
            const icon = prop.pipelineStatus === 'success' ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
            console.log(`  ${icon} ${C.bold}${prop.address}${C.reset}`);
            console.log(`    ${C.dim}Before:${C.reset} ${prop.beforeErrors.length}E ${prop.beforeWarnings.length}W  →  ${C.dim}After:${C.reset} ${prop.afterErrors.length}E ${prop.afterWarnings.length}W`);
            if (prop.healed.length > 0) {
                console.log(`    ${C.green}Healed: ${prop.healed.join(', ')}${C.reset}`);
            }
            if (prop.remaining.length > 0) {
                console.log(`    ${C.yellow}Remaining: ${prop.remaining.join(', ')}${C.reset}`);
            }
            if (prop.pipelineError) {
                console.log(`    ${C.red}Pipeline Error: ${prop.pipelineError}${C.reset}`);
            }
        }

        // Systemic failures
        if (result.systemicFailures.length > 0) {
            console.log('');
            console.log(`${C.bold}${C.bgRed}${C.white} SYSTEMIC FAILURES ${C.reset}`);
            console.log(`${C.red}  These checks failed on ALL tested properties — likely a pipeline bug:${C.reset}`);
            for (const f of result.systemicFailures) {
                console.log(`${C.red}  ⚠  ${f}${C.reset}`);
            }
        }

        // Duration
        const elapsed = Date.now() - startTime;
        const mins = Math.floor(elapsed / 60000);
        const secs = Math.round((elapsed % 60000) / 1000);
        console.log('');
        console.log(`${C.dim}Duration: ${mins}m ${secs}s${C.reset}`);
        console.log('');

        // Exit code
        process.exit(result.passed ? 0 : 1);

    } catch (error: any) {
        console.error('');
        console.error(`${C.bgRed}${C.white}${C.bold} 💥 TEST CRASHED ${C.reset}`);
        console.error(`${C.red}${error.message}${C.reset}`);
        if (error.stack) {
            console.error(`${C.dim}${error.stack}${C.reset}`);
        }
        process.exit(2);
    }
}

main();
