/**
 * Scoring Model — Curb Appeal & Landscaping
 *
 * First impressions: a well-manicured yard, a statement front door, and a clean
 * walkway. Sets the emotional tone before the buyer even turns the key.
 *
 * Weighting (max 100):
 *   - Curb Appeal Rating ...............  22  (factor 34 driven)
 *   - Landscaping & Greenery ...........  20
 *   - Entry & Facade ...................  18
 *   - Architectural Character ..........  10
 *   - Exterior Lighting ................   8
 *   - Visual Cleanliness ...............  10  (penalty if visual clutter detected)
 *   - Streetscape & Neighborhood Look ..  12
 */

import type { ScoringModel, ScoreComponent } from './types';
import {
    hasSignal,
    findFactor,
    factorMentions,
    factorTagsMatching,
    scoreToGrade,
    computeConfidence,
    clamp,
    extractRatingOutOfTen,
} from './types';

export const scoreCurbAppealLandscaping: ScoringModel = (factors, signals) => {
    const components: ScoreComponent[] = [];

    // ── 1. Curb Appeal Rating (max 22) ───────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const f34 = findFactor(factors, 34);
        const rating = extractRatingOutOfTen(f34);
        if (rating !== null) {
            earned = Math.round((rating / 10) * 22);
            evidence.push(`Curb appeal rated ${rating}/10`);
        } else if (factorMentions(f34, 'excellent', 'outstanding', 'stunning')) {
            earned = 20;
            evidence.push('Excellent curb appeal');
        } else if (factorMentions(f34, 'good', 'attractive', 'well-maintained')) {
            earned = 15;
            evidence.push('Good curb appeal');
        } else if (factorMentions(f34, 'average', 'decent')) {
            earned = 10;
        } else if (factorMentions(f34, 'dated', 'overgrown', 'poor', 'needs work')) {
            earned = 4;
            missing.push('Curb appeal flagged as dated or needing work');
        } else {
            earned = 10;
            missing.push('Curb appeal not explicitly rated');
        }

        components.push({
            label: 'Curb Appeal Rating',
            rationale: 'The street-view AI score — the most direct measure of first impression.',
            earned: clamp(earned, 22),
            max: 22,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 2. Landscaping & Greenery (max 20) ───────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const landscapeSignals = [
            { id: 'lush_landscaping', pts: 6, label: 'Professionally landscaped' },
            // mature_landscaping consolidated into lush_landscaping above.
            { id: 'kid_friendly_lawn',             pts: 3, label: 'Manicured lawn' },
            { id: 'mature_trees',               pts: 3, label: 'Mature trees' },
            { id: 'fully_secluded',             pts: 2, label: 'Privacy hedges' },
            { id: 'stone_hardscaping',             pts: 2, label: 'Stone pathways' },
            { id: 'water_features',              pts: 2, label: 'Water feature / fountain' },
        ];
        for (const s of landscapeSignals) {
            if (hasSignal(signals, s.id)) {
                earned += s.pts;
                evidence.push(s.label);
            }
        }

        if (earned === 0) {
            const f96 = findFactor(factors, 96);
            const hits = factorTagsMatching(f96, 'mature', 'lush', 'designer', 'manicured', 'curated');
            if (hits.length > 0) {
                earned += 6;
                evidence.push(...hits.slice(0, 2));
            } else {
                missing.push('No landscaping details detected');
            }
        }
        // Bonus: factor 32 — visible front-yard fountain, fire feature, or notable hardscape from street
        const f32 = findFactor(factors, 32);
        if (factorMentions(f32, 'front fountain', 'front courtyard', 'front patio', 'visible from street')) {
            earned += 2;
            evidence.push('Front-yard outdoor feature visible from street');
        }

        components.push({
            label: 'Landscaping & Greenery',
            rationale: 'Mature trees, manicured beds, and stone hardscape make the lot feel cared-for.',
            earned: clamp(earned, 20),
            max: 20,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 3. Entry & Facade (max 18) ───────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'statement_door')) { earned += 5; evidence.push('Statement front door'); }
        if (hasSignal(signals, 'welcoming_porch')) { earned += 4; evidence.push('Welcoming porch'); }
        if (hasSignal(signals, 'dramatic_foyer')) { earned += 3; evidence.push('Dramatic foyer'); }
        if (hasSignal(signals, 'motor_court')) { earned += 2; evidence.push('Motor court / circular drive'); }
        if (hasSignal(signals, 'designer_hardware')) { earned += 2; evidence.push('Designer hardware'); }
        if (hasSignal(signals, 'entry_glass_views')) { earned += 1; evidence.push('Glass sidelights & transom'); }
        if (hasSignal(signals, 'high_ceilings_entry')) { earned += 1; evidence.push('High entry ceilings'); }

        if (earned === 0) missing.push('No statement entry or notable facade details');

        components.push({
            label: 'Entry & Facade',
            rationale: 'A bold front door and dramatic entry directly drive emotional first impression.',
            earned: clamp(earned, 18),
            max: 18,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 4. Architectural Character (max 10) ──────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const styleTags = ['victorian', 'edwardian', 'modern', 'historical_charm'];
        let detected = 0;
        for (const t of styleTags) {
            if (hasSignal(signals, t)) {
                detected++;
                evidence.push(`${signals[t].label} character`);
            }
        }
        if (detected > 0) earned += 6;
        if (hasSignal(signals, 'custom_millwork')) {
            earned += 4;
            evidence.push('Custom millwork / moldings');
        }
        if (earned === 0) {
            const f41 = findFactor(factors, 41);
            const f23 = findFactor(factors, 23);
            if (f41?.tags?.length || f23?.tags?.length) {
                earned += 3;
                evidence.push(...[...(f23?.tags || []), ...(f41?.tags || [])].slice(0, 1));
            } else {
                missing.push('No defining architectural style');
            }
        }
        // Bonus: premium siding/exterior material
        const f41 = findFactor(factors, 41);
        if (factorMentions(f41, 'stone', 'brick', 'cedar', 'stucco', 'fiber cement')) {
            earned += 2;
            evidence.push(...factorTagsMatching(f41, 'stone', 'brick', 'cedar', 'fiber cement').slice(0, 1));
        }

        components.push({
            label: 'Architectural Character',
            rationale: 'Distinctive style — historical, modern, or custom-detailed — sets a property apart.',
            earned: clamp(earned, 10),
            max: 10,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 5. Exterior Lighting (max 8) ─────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'premium_lighting')) { earned += 5; evidence.push('Architectural / landscape lighting'); }
        // smart_lighting was consolidated into premium_lighting; covered above.

        if (earned === 0) missing.push('No notable exterior lighting');

        components.push({
            label: 'Exterior Lighting',
            rationale: 'Up-lit landscaping and path lights extend curb appeal into evening hours.',
            earned: clamp(earned, 8),
            max: 8,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 6. Visual Cleanliness (max 10) — penalty-based ───────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 10; // start at max, deduct for clutter

        const f38 = findFactor(factors, 38);
        const f95 = findFactor(factors, 95);

        // Factor 38 (Visual Clutter): penalize true / "yes" / specific issues
        if (factorMentions(f38, 'overhead wires', 'utility lines', 'messy', 'cluttered', 'busy streetscape')) {
            earned -= 5;
            missing.push('Visible utility wires or street clutter');
        } else if (factorMentions(f38, 'minor', 'some clutter')) {
            earned -= 2;
        }

        // Factor 95 (Curbside Risks): penalize visible decay
        const riskHits = factorTagsMatching(f95, 'peeling paint', 'cracked driveway', 'dated facade', 'aging shingles', 'missing gutters');
        if (riskHits.length > 0) {
            earned -= riskHits.length * 2;
            missing.push(...riskHits.slice(0, 2));
        }
        if (earned === 10) {
            evidence.push('No visible clutter or curbside risks');
        }

        components.push({
            label: 'Visual Cleanliness',
            rationale: 'Overhead wires, peeling paint, cracked driveways — buyers see this in 2 seconds.',
            earned: clamp(earned, 10),
            max: 10,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 7. Streetscape & Neighborhood Look (max 12) ──────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const f94 = findFactor(factors, 94);
        if (factorMentions(f94, 'tree-lined', 'well-lit', 'quiet cul-de-sac', 'wide street', 'attractive street')) {
            earned += 6;
            evidence.push(...factorTagsMatching(f94, 'tree-lined', 'cul-de-sac', 'wide').slice(0, 2));
        }
        const f98 = findFactor(factors, 98);
        if (factorMentions(f98, 'well-maintained', 'tidy yards', 'consistent style', 'fresh paint')) {
            earned += 6;
            evidence.push('Well-maintained neighbors');
        } else if (factorMentions(f98, 'mixed condition', 'declining', 'dated')) {
            earned -= 3;
            missing.push('Mixed-condition neighborhood');
        }

        if (earned === 0) missing.push('Streetscape character not documented');

        components.push({
            label: 'Streetscape & Neighborhood Look',
            rationale: 'A handsome home on a tired block fights an uphill battle for first impression.',
            earned: clamp(earned, 12),
            max: 12,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── Aggregate ────────────────────────────────────────────────────────────
    const totalEarned = components.reduce((sum, c) => sum + c.earned, 0);
    const score = Math.round(totalEarned);
    const grade = scoreToGrade(score);
    const confidence = computeConfidence(components);
    const summary = buildSummary(score, grade, components);

    return {
        modelId: 'curb_appeal_landscaping',
        label: 'Curb Appeal & Landscaping',
        description: 'First impression: manicured grounds, statement entry, clean streetscape.',
        icon: 'fa-house-flag',
        color: 'emerald',
        score,
        grade,
        confidence,
        components,
        summary,
    };
};

const buildSummary = (score: number, grade: string, components: ScoreComponent[]): string => {
    const strongest = components.filter(c => c.earned / c.max >= 0.7 && c.evidence.length > 0).slice(0, 2);
    const weakest = components.filter(c => c.earned / c.max < 0.3).slice(0, 2);

    const tier =
        score >= 85 ? 'Outstanding first impression'
        : score >= 70 ? 'Strong curb appeal'
        : score >= 55 ? 'Decent curb appeal with room to elevate'
        : score >= 40 ? 'Curb appeal needs attention'
        : 'Poor first impression';

    const parts: string[] = [`${tier} (${grade}, ${score}/100).`];
    if (strongest.length > 0) {
        const ev = strongest.flatMap(c => c.evidence).slice(0, 3).join(', ');
        if (ev) parts.push(`Standouts: ${ev}.`);
    }
    if (weakest.length > 0) {
        const gaps = weakest.flatMap(c => c.missing || []).slice(0, 2).join('; ');
        if (gaps) parts.push(`Gaps: ${gaps}.`);
    }
    return parts.join(' ');
};
