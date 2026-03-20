/**
 * Integration Test: Full Intel Pipeline Validation
 *
 * Picks N random properties from a city's zip listings cache,
 * runs smoke test (before), runs full intel suite, runs smoke test (after),
 * and checks if systemic warnings remain across all properties.
 *
 * If ALL sampled properties share the same warning after full intel,
 * the test FAILS — indicating a systemic pipeline bug, not a data issue.
 */

import { getZipsForCity, getZipListings } from './firebase/cityData';
import { runChecks } from './smokeTest';
import { runFullIntelligencePipeline } from './preloadService';
import {
  getPropertyFromCloud,
  getVisualAnalysisFromCloud,
  getComprehensiveAnalysisFromCloud,
  getPropertyInvestmentFromCloud,
} from './firebaseService';

export interface IntegrationTestResult {
  city: string;
  sampleSize: number;
  properties: {
    zpid: string;
    address: string;
    beforeErrors: string[];
    beforeWarnings: string[];
    afterErrors: string[];
    afterWarnings: string[];
    pipelineStatus: 'success' | 'error';
    pipelineError?: string;
    healed: string[];      // warnings/errors that were fixed
    remaining: string[];   // still failing after pipeline
  }[];
  systemicFailures: string[];  // check IDs that failed on ALL properties after full intel
  passed: boolean;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
}

export type IntegrationTestProgress = {
  phase: 'loading' | 'pre-smoke' | 'pipeline' | 'post-smoke' | 'analysis' | 'done';
  message: string;
  current?: number;
  total?: number;
};

/**
 * Picks `sampleSize` random properties from a city's zip listings cache.
 * Returns array of { zpid, address } objects.
 */
async function pickRandomProperties(
  city: string,
  sampleSize: number
): Promise<{ zpid: string; address: string }[]> {
  const zipsByState = await getZipsForCity(city);
  if (!zipsByState) throw new Error(`No zip codes found for city: ${city}`);

  // Flatten all zips across states
  const allZips = Object.values(zipsByState).flat();
  if (allZips.length === 0) throw new Error(`No zip codes for ${city}`);

  // Load all listings from all zips
  const allListings: any[] = [];
  for (const zip of allZips) {
    const cache = await getZipListings(zip);
    if (cache?.listings?.length) {
      allListings.push(...cache.listings);
    }
  }

  if (allListings.length === 0) throw new Error(`No cached listings found for ${city}`);

  // Filter to only listings with a zpid
  const validListings = allListings.filter(l => l.zpid);
  if (validListings.length < sampleSize) {
    throw new Error(`Only ${validListings.length} valid listings for ${city}, need ${sampleSize}`);
  }

  // Shuffle and pick N
  const shuffled = [...validListings].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, sampleSize).map(item => {
    const addr = item.location?.address;
    const address = addr
      ? `${addr.line}, ${addr.city}, ${addr.state_code} ${addr.postal_code}`
      : `ZPID: ${item.zpid}`;
    return { zpid: String(item.zpid), address };
  });
}

/**
 * Run smoke test checks for a single property by loading all its data from Firestore.
 */
async function runSmokeForProperty(zpid: string): Promise<{ errors: string[]; warnings: string[] }> {
  const [prop, assets, visual, env, comp, inv] = await Promise.all([
    getPropertyFromCloud(zpid),
    import('./firebase/properties').then(m => m.getPropertyAssetsFromCloud(zpid)).catch(() => null),
    getVisualAnalysisFromCloud(zpid),
    import('./firebase/googleData').then(m => m.getGoogleDataFromCloud(zpid)).catch(() => null),
    getComprehensiveAnalysisFromCloud(zpid),
    getPropertyInvestmentFromCloud(zpid).catch(() => null),
  ]);

  // Build school analyses
  const schoolAnalyses: Record<string, any> = {};
  if (prop?.schools?.length && prop.city) {
    const { getSchoolCacheKey } = await import('../prompts/property/schoolsAnalysis');
    const { getSchoolAnalysisFromCloud } = await import('./firebase/properties');
    for (const s of prop.schools) {
      const key = getSchoolCacheKey(s.name, prop.city, prop.state || '');
      const sa = await getSchoolAnalysisFromCloud(key).catch(() => null);
      if (sa) schoolAnalyses[key] = sa;
    }
  }

  const result = runChecks(zpid, prop, assets, visual, env, comp, inv, schoolAnalyses);
  const errors = result.checks.filter(c => !c.passed && c.severity === 'error').map(c => c.id);
  const warnings = result.checks.filter(c => !c.passed && c.severity === 'warn').map(c => c.id);
  return { errors, warnings };
}

/**
 * Main integration test runner.
 *
 * @param city - City name (e.g. "Dublin")
 * @param sampleSize - Number of random properties to test (default: 4)
 * @param onProgress - Progress callback
 * @param onLog - Detailed log callback
 */
export async function runIntegrationTest(
  city: string = 'Dublin',
  sampleSize: number = 4,
  onProgress?: (p: IntegrationTestProgress) => void,
  onLog?: (msg: string) => void,
): Promise<IntegrationTestResult> {
  const startedAt = new Date();

  // ── 1. Pick random properties ──────────────────────────────────────────
  onProgress?.({ phase: 'loading', message: `Loading listings for ${city}...` });
  onLog?.(`[IntTest] Picking ${sampleSize} random properties from ${city}...`);
  const samples = await pickRandomProperties(city, sampleSize);
  onLog?.(`[IntTest] Selected: ${samples.map(s => s.address).join(' | ')}`);

  const results: IntegrationTestResult['properties'] = [];

  // ── 2. Pre-pipeline smoke test ─────────────────────────────────────────
  onProgress?.({ phase: 'pre-smoke', message: 'Running pre-pipeline smoke tests...', current: 0, total: sampleSize });
  for (let i = 0; i < samples.length; i++) {
    const { zpid, address } = samples[i];
    onLog?.(`[IntTest] Pre-smoke ${i + 1}/${sampleSize}: ${address}`);
    const before = await runSmokeForProperty(zpid);
    onLog?.(`[IntTest]   → ${before.errors.length} errors, ${before.warnings.length} warnings`);

    results.push({
      zpid,
      address,
      beforeErrors: before.errors,
      beforeWarnings: before.warnings,
      afterErrors: [],
      afterWarnings: [],
      pipelineStatus: 'success',
      healed: [],
      remaining: [],
    });
    onProgress?.({ phase: 'pre-smoke', message: `Pre-smoke: ${i + 1}/${sampleSize}`, current: i + 1, total: sampleSize });
  }

  // ── 3. Run full intel pipeline on each ─────────────────────────────────
  for (let i = 0; i < samples.length; i++) {
    const { zpid, address } = samples[i];
    onProgress?.({ phase: 'pipeline', message: `Full Intel: ${address} (${i + 1}/${sampleSize})`, current: i + 1, total: sampleSize });
    onLog?.(`[IntTest] Running Full Intel ${i + 1}/${sampleSize}: ${address}`);

    try {
      await runFullIntelligencePipeline(
        address,
        (progress) => {
          onLog?.(`  [${progress.step}] ${progress.status}: ${progress.message || ''}`);
        },
        zpid,
        'integration-test',
        (msg) => onLog?.(`  ${msg}`),
      );
      results[i].pipelineStatus = 'success';
      onLog?.(`[IntTest] ✓ Pipeline completed for ${address}`);
    } catch (e: any) {
      results[i].pipelineStatus = 'error';
      results[i].pipelineError = e.message;
      onLog?.(`[IntTest] ✗ Pipeline FAILED for ${address}: ${e.message}`);
    }
  }

  // ── 4. Post-pipeline smoke test ────────────────────────────────────────
  onProgress?.({ phase: 'post-smoke', message: 'Running post-pipeline smoke tests...', current: 0, total: sampleSize });
  for (let i = 0; i < samples.length; i++) {
    const { zpid, address } = samples[i];
    onLog?.(`[IntTest] Post-smoke ${i + 1}/${sampleSize}: ${address}`);
    const after = await runSmokeForProperty(zpid);
    results[i].afterErrors = after.errors;
    results[i].afterWarnings = after.warnings;

    // Calculate healed vs remaining
    const allBefore = new Set([...results[i].beforeErrors, ...results[i].beforeWarnings]);
    const allAfter = new Set([...after.errors, ...after.warnings]);
    results[i].healed = [...allBefore].filter(id => !allAfter.has(id));
    results[i].remaining = [...allAfter];

    onLog?.(`[IntTest]   → ${after.errors.length} errors, ${after.warnings.length} warnings (healed: ${results[i].healed.length})`);
    onProgress?.({ phase: 'post-smoke', message: `Post-smoke: ${i + 1}/${sampleSize}`, current: i + 1, total: sampleSize });
  }

  // ── 5. Detect systemic failures ────────────────────────────────────────
  onProgress?.({ phase: 'analysis', message: 'Analyzing results...' });

  // A check is "systemic" if it fails on ALL sampled properties after full intel
  const successfulRuns = results.filter(r => r.pipelineStatus === 'success');
  let systemicFailures: string[] = [];

  if (successfulRuns.length >= 2) {
    // Get intersection of all remaining failures
    const failSets = successfulRuns.map(r => new Set(r.remaining));
    const firstSet = failSets[0];
    systemicFailures = [...firstSet].filter(id =>
      failSets.every(s => s.has(id))
    );
  }

  const completedAt = new Date();
  const passed = systemicFailures.length === 0;

  if (systemicFailures.length > 0) {
    onLog?.(`[IntTest] ❌ SYSTEMIC FAILURES detected: ${systemicFailures.join(', ')}`);
    onLog?.(`[IntTest]    These checks failed on ALL ${successfulRuns.length} properties — this is a pipeline bug.`);
  } else {
    onLog?.(`[IntTest] ✅ No systemic failures. Pipeline is healthy.`);
  }

  const testResult: IntegrationTestResult = {
    city,
    sampleSize,
    properties: results,
    systemicFailures,
    passed,
    startedAt,
    completedAt,
    durationMs: completedAt.getTime() - startedAt.getTime(),
  };

  onProgress?.({ phase: 'done', message: passed ? '✅ Test PASSED' : '❌ Test FAILED' });
  return testResult;
}
