import { findComps, SubjectProperty, CompAnalysisResult } from './compService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BulkPhaseStatus = 'pending' | 'skipped_p0' | 'skipped_p1' | 'candidate' | 'confirmed' | 'error';

export interface BulkScreeningRow {
    address: string;
    mlsId?: string;
    listPrice: number | null;
    sqft: number | null;
    rawMarketValue: number | null;
    geminiMarketValue: number | null;
    discountDollars: number | null;
    discountPct: number | null;
    compsCount: number;
    phase: BulkPhaseStatus;
    error?: string;
}

export interface BulkScreeningResult {
    rows: BulkScreeningRow[];
    phase0Eliminated: number;
    phase1Candidates: number;
    phase2Confirmed: number;
    errors: number;
    durationMs: number;
}

export interface BulkScreeningOptions {
    /** Properties where listPrice >= zestimate * threshold are skipped in Phase 0. Default 0.95 */
    phase0ZestimateThreshold?: number;
    /** Phase 1 parallel concurrency (no-Gemini raw comps). Default 2 */
    phase1Concurrency?: number;
    /** Phase 2 parallel concurrency (Gemini). Default 4 */
    phase2Concurrency?: number;
    /** Minimum discount % to pass Phase 1. Default 10 */
    discountPctThreshold?: number;
    /** Minimum discount $ to pass Phase 1. Default 180000 */
    discountDollarThreshold?: number;
    onProgress?: (msg: string) => void;
}

// ─── Concurrency Limiter ──────────────────────────────────────────────────────

async function pLimit<T>(
    fns: (() => Promise<T>)[],
    concurrency: number,
    onTaskDone?: (doneCount: number, total: number) => void
): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = new Array(fns.length);
    let nextIdx = 0;
    let doneCount = 0;

    async function worker() {
        while (nextIdx < fns.length) {
            const i = nextIdx++;
            try {
                results[i] = { status: 'fulfilled', value: await fns[i]() };
            } catch (e: any) {
                results[i] = { status: 'rejected', reason: e };
            }
            doneCount++;
            onTaskDone?.(doneCount, fns.length);
        }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));
    return results;
}

// ─── Gemini Valuation Extractor ───────────────────────────────────────────────

function extractGeminiValuation(res: CompAnalysisResult, sqft: number): number | null {
    const recs = res.geminiResult?.comp_analysis as any[] | undefined;
    if (!recs || sqft <= 0) return null;
    let finalComps = recs.filter((r: any) => r.zyphe_in_avg && typeof r.normalized_psf === 'number');
    if (finalComps.length === 0) {
        finalComps = recs.filter((r: any) => r.include_in_avg && !r.zyphe_excluded && typeof r.normalized_psf === 'number');
    }
    if (finalComps.length === 0) return null;
    const avgPsf = finalComps.reduce((s: number, c: any) => s + c.normalized_psf, 0) / finalComps.length;
    return Math.round(avgPsf * sqft);
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

export async function runBulkScreening(
    subjects: (SubjectProperty & { mlsId?: string })[],
    options: BulkScreeningOptions = {}
): Promise<BulkScreeningResult> {
    const {
        phase0ZestimateThreshold = 0.95,
        phase1Concurrency = 2,
        phase2Concurrency = 4,
        discountPctThreshold = 10,
        discountDollarThreshold = 180_000,
        onProgress = () => {},
    } = options;

    const startMs = Date.now();

    const rows: BulkScreeningRow[] = subjects.map(s => ({
        address: s.address,
        mlsId: s.mlsId,
        listPrice: s.listPrice ?? null,
        sqft: s.squareFootage ?? null,
        rawMarketValue: null,
        geminiMarketValue: null,
        discountDollars: null,
        discountPct: null,
        compsCount: 0,
        phase: 'pending',
    }));

    // ── Phase 0: instant zestimate pre-filter ─────────────────────────────────
    onProgress(`Phase 0: filtering ${subjects.length} properties by Zestimate...`);
    const p1Queue: SubjectProperty[] = [];

    for (let i = 0; i < subjects.length; i++) {
        const subj = subjects[i];
        const { listPrice, zestimate } = subj;
        if (listPrice && zestimate && listPrice >= zestimate * phase0ZestimateThreshold) {
            rows[i].phase = 'skipped_p0';
            rows[i].rawMarketValue = zestimate;
            rows[i].discountDollars = zestimate - listPrice;
            rows[i].discountPct = ((zestimate - listPrice) / zestimate) * 100;
        } else {
            p1Queue.push(subj);
        }
    }
    onProgress(`Phase 0 done: ${subjects.length - p1Queue.length} eliminated, ${p1Queue.length} advancing to Phase 1`);

    // ── Phase 1: parallel raw comps, no Gemini ────────────────────────────────
    onProgress(`Phase 1: parallel raw comps on ${p1Queue.length} properties (concurrency=${phase1Concurrency})...`);

    const p1Tasks = p1Queue.map(subj => async () => {
        const idx = subjects.findIndex(s => s.address === subj.address);
        try {
            const res = await findComps(subj, { skipGemini: true, useZipCache: true });
            const sqft = subj.squareFootage || res.subjectProperty?.squareFootage || 0;
            const eligible = (res.rawComps || [])
                .filter(c => !c.isOutlier && !c.priceUnverified && c.adjustedPrice && c.squareFootage && c.squareFootage > 0)
                .sort((a, b) => (a.tier ?? 4) - (b.tier ?? 4) || (a.distance ?? 99) - (b.distance ?? 99))
                .slice(0, 5);

            let rawMarketValue: number | null = null;
            if (eligible.length > 0 && sqft > 0) {
                const avgPsf = eligible.reduce((s, c) => s + (c.adjustedPrice! / c.squareFootage!), 0) / eligible.length;
                rawMarketValue = Math.round(avgPsf * sqft);
            }

            const listPrice = subj.listPrice ?? null;
            const discount = rawMarketValue && listPrice ? rawMarketValue - listPrice : null;
            const discountPct = rawMarketValue && listPrice ? ((rawMarketValue - listPrice) / rawMarketValue) * 100 : null;
            const isUndervalued = rawMarketValue && listPrice &&
                (discountPct! >= discountPctThreshold || discount! >= discountDollarThreshold);

            if (idx >= 0) {
                rows[idx] = {
                    ...rows[idx],
                    rawMarketValue,
                    discountDollars: discount,
                    discountPct,
                    compsCount: res.rawComps?.length || 0,
                    phase: isUndervalued ? 'candidate' : 'skipped_p1',
                };
            }
        } catch (e: any) {
            if (idx >= 0) rows[idx] = { ...rows[idx], phase: 'error', error: e.message };
        }
    });

    let p1Done = 0;
    await pLimit(p1Tasks, phase1Concurrency, (done, total) => {
        p1Done = done;
        if (done % 5 === 0 || done === total) onProgress(`Phase 1: ${done}/${total} done`);
    });

    const p2Queue = rows
        .filter(r => r.phase === 'candidate')
        .map(r => subjects.find(s => s.address === r.address)!)
        .filter(Boolean);

    onProgress(`Phase 1 done: ${p2Queue.length} candidates advancing to Phase 2 (Gemini)`);

    // ── Phase 2: Gemini on undervalued candidates only ────────────────────────
    onProgress(`Phase 2: Gemini comp normalization on ${p2Queue.length} candidates (concurrency=${phase2Concurrency})...`);

    const p2Tasks = p2Queue.map(subj => async () => {
        const idx = subjects.findIndex(s => s.address === subj.address);
        try {
            const res = await findComps(subj, { skipLandUtility: true, useZipCache: true });
            const sqft = subj.squareFootage || res.subjectProperty?.squareFootage || 0;
            const geminiValue = extractGeminiValuation(res, sqft);
            const listPrice = subj.listPrice ?? null;
            const geminiDiscount = geminiValue && listPrice ? geminiValue - listPrice : null;
            const geminiDiscountPct = geminiValue && listPrice ? ((geminiValue - listPrice) / geminiValue) * 100 : null;

            if (idx >= 0) {
                rows[idx] = {
                    ...rows[idx],
                    geminiMarketValue: geminiValue,
                    discountDollars: geminiDiscount ?? rows[idx].discountDollars,
                    discountPct: geminiDiscountPct ?? rows[idx].discountPct,
                    phase: 'confirmed',
                };
            }
        } catch (e: any) {
            if (idx >= 0) rows[idx] = { ...rows[idx], phase: 'error', error: e.message };
        }
    });

    let p2Done = 0;
    await pLimit(p2Tasks, phase2Concurrency, (done, total) => {
        p2Done = done;
        onProgress(`Phase 2: ${done}/${total} done`);
    });

    const confirmed = rows.filter(r => r.phase === 'confirmed');
    onProgress(`Phase 2 done: ${confirmed.length} confirmed undervalued properties`);

    return {
        rows,
        phase0Eliminated: rows.filter(r => r.phase === 'skipped_p0').length,
        phase1Candidates: p2Queue.length,
        phase2Confirmed: confirmed.length,
        errors: rows.filter(r => r.phase === 'error').length,
        durationMs: Date.now() - startMs,
    };
}
