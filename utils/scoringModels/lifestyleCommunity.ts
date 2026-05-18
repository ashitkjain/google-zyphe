/**
 * Scoring Model — Lifestyle & Community
 *
 * Captures the "what's it like to live here" dimension: walkability, schools,
 * neighborhood vibe, amenities, safety, commute. Pulls from the rich community
 * sentiment and amenity factors that none of the other models touch.
 *
 * Weighting (max 100):
 *   - Schools .....................  18
 *   - Walkability & Transit .......  15
 *   - Walkable Amenities ..........  12
 *   - Dining & Entertainment ......  10
 *   - Safety & Vibe ...............  10
 *   - Community Satisfaction ......  10
 *   - Persona Fit Signals .........   9
 *   - Greenery / Parks ............   7
 *   - Convenience / Errands .......   5
 *   - Commute Quality .............   4
 */

import type { ScoringModel, ScoreComponent } from './types';
import {
    findFactor,
    factorMentions,
    factorTagsMatching,
    scoreToGrade,
    computeConfidence,
    clamp,
    extractRatingOutOfTen,
} from './types';

export const scoreLifestyleCommunity: ScoringModel = (factors, _signals) => {
    const components: ScoreComponent[] = [];

    // ── 1. Schools (max 18) ──────────────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const f101 = findFactor(factors, 101);
        // Look for rating patterns like "9/10", "10/10" in tags
        const tagRatings: number[] = [];
        for (const t of f101?.tags || []) {
            const m = t.match(/(\d+)\s*\/\s*10/);
            if (m) tagRatings.push(parseInt(m[1], 10));
        }
        if (tagRatings.length > 0) {
            const avg = tagRatings.reduce((a, b) => a + b, 0) / tagRatings.length;
            earned = Math.round((avg / 10) * 18);
            evidence.push(`School avg ${avg.toFixed(1)}/10 across ${tagRatings.length} schools`);
        } else if (factorMentions(f101, 'desirable school zone', 'top-rated', 'highly rated')) {
            earned = 14;
            evidence.push('Desirable school zone');
        } else if (factorMentions(f101, 'walking distance', 'under 1mi')) {
            earned += 4;
            evidence.push('Schools within walking distance');
        } else {
            missing.push('No school ratings or zone data');
        }

        components.push({
            label: 'Schools',
            rationale: 'For family buyers, this is the #1 lifestyle signal.',
            earned: clamp(earned, 18),
            max: 18,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 2. Walkability & Transit (max 15) ────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const f43 = findFactor(factors, 43);
        // Look for "85 walk score" numeric pattern
        const walkMatch = (f43?.tags?.join(' ') + ' ' + (f43?.value || '')).match(/(\d{1,3})\s*walk\s*score/i);
        if (walkMatch) {
            const wScore = parseInt(walkMatch[1], 10);
            earned = Math.round((wScore / 100) * 11);
            evidence.push(`Walk Score ${wScore}`);
        } else if (factorMentions(f43, 'highly walkable', 'walker\'s paradise')) {
            earned = 10; evidence.push('Highly walkable');
        } else if (factorMentions(f43, 'somewhat walkable', 'moderately walkable')) {
            earned = 6; evidence.push('Somewhat walkable');
        } else if (factorMentions(f43, 'car-dependent', 'not walkable')) {
            earned = 2; missing.push('Car-dependent');
        }

        const f45 = findFactor(factors, 45);
        if (factorMentions(f45, 'sidewalks', 'pedestrian-friendly', 'safe to walk')) {
            earned += 2;
            evidence.push('Sidewalks present');
        }

        // Factor 42 (Commute) sometimes mentions transit access
        const f42 = findFactor(factors, 42);
        if (factorMentions(f42, 'walk to bart', 'walk to rail', 'transit nearby')) {
            earned += 2;
            evidence.push('Walk to transit');
        }

        if (earned === 0) missing.push('Walkability not documented');

        components.push({
            label: 'Walkability & Transit',
            rationale: 'Walk Score, sidewalks, and transit access shape daily life beyond the car.',
            earned: clamp(earned, 15),
            max: 15,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 3. Walkable Amenities (max 12) ───────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const f84 = findFactor(factors, 84);
        const namedPlaces = (f84?.tags || []).filter(t => t.length > 4);
        if (namedPlaces.length >= 5) { earned = 12; evidence.push(`${namedPlaces.length} walkable amenities (${namedPlaces.slice(0, 2).join(', ')})`); }
        else if (namedPlaces.length >= 3) { earned = 8; evidence.push(`${namedPlaces.length} walkable amenities`); }
        else if (namedPlaces.length >= 1) { earned = 4; evidence.push(namedPlaces[0]); }
        else missing.push('No walkable amenities documented');

        components.push({
            label: 'Walkable Amenities',
            rationale: 'Cafés, parks, and shops within walking distance — the quiet quality-of-life lift.',
            earned: clamp(earned, 12),
            max: 12,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 4. Dining & Entertainment (max 10) ───────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const f88 = findFactor(factors, 88);
        if (factorMentions(f88, 'vibrant', '5+ walkable', 'rich dining', 'foodie scene')) {
            earned = 9; evidence.push('Vibrant dining scene');
        } else if (factorMentions(f88, 'good selection', 'multiple restaurants')) {
            earned = 6; evidence.push('Good dining options');
        } else if (factorMentions(f88, 'sparse', 'limited', 'car required for dining')) {
            earned = 2; missing.push('Limited dining nearby');
        }

        components.push({
            label: 'Dining & Entertainment',
            rationale: 'A vibrant restaurant scene is one of the strongest lifestyle differentiators.',
            earned: clamp(earned, 10),
            max: 10,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 5. Safety & Vibe (max 10) ────────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const f74 = findFactor(factors, 74);
        const rating = extractRatingOutOfTen(f74);
        if (rating !== null) {
            earned = Math.round((rating / 10) * 10);
            evidence.push(`Safety rated ${rating}/10`);
        } else if (factorMentions(f74, 'very safe', 'low crime', 'safe neighborhood')) {
            earned = 9; evidence.push('Safe neighborhood');
        } else if (factorMentions(f74, 'concerns', 'mixed', 'higher crime')) {
            earned = 4; missing.push('Safety concerns flagged');
        } else {
            earned = 5;
        }

        components.push({
            label: 'Safety & Vibe',
            rationale: 'Perceived neighborhood safety, derived from sentiment and visual cues.',
            earned: clamp(earned, 10),
            max: 10,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 6. Community Satisfaction (max 10) ───────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const f73 = findFactor(factors, 73);
        if (factorMentions(f73, 'love living here', 'positive vibes', 'friendly', 'tight-knit', 'cohesive')) {
            earned += 6;
            evidence.push('Strong resident satisfaction');
        }
        const f102 = findFactor(factors, 102);
        if (factorMentions(f102, 'positive sentiment', 'buzzing', 'desirable', 'sought-after')) {
            earned += 3;
            evidence.push('Positive market sentiment');
        }
        const f72 = findFactor(factors, 72);
        if (factorMentions(f72, 'parking', 'noise', 'litter', 'congestion', 'complaints')) {
            earned -= 2;
            missing.push(...factorTagsMatching(f72, 'parking', 'noise', 'litter').slice(0, 1));
        }

        if (earned <= 0) {
            earned = 4;
            if (missing.length === 0) missing.push('Community sentiment not documented');
        }

        components.push({
            label: 'Community Satisfaction',
            rationale: 'Resident sentiment, sourced from community pulse — what locals actually say.',
            earned: clamp(earned, 10),
            max: 10,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 7. Persona Fit Signals (max 9) ───────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const scores: number[] = [];
        for (const id of [80, 81, 82]) {
            const f = findFactor(factors, id);
            const r = extractRatingOutOfTen(f);
            if (r !== null) scores.push(r);
        }
        if (scores.length > 0) {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            earned = Math.round((avg / 10) * 9);
            evidence.push(`Persona fit avg ${avg.toFixed(1)}/10 across ${scores.length} personas`);
        } else {
            // Look for descriptive matches
            const f80 = findFactor(factors, 80);
            const f81 = findFactor(factors, 81);
            const f82 = findFactor(factors, 82);
            const positiveHits =
                (factorMentions(f80, 'strong fit', 'excellent') ? 1 : 0) +
                (factorMentions(f81, 'family-friendly', 'great for families') ? 1 : 0) +
                (factorMentions(f82, 'senior-friendly', 'aging in place') ? 1 : 0);
            if (positiveHits > 0) {
                earned = positiveHits * 3;
                evidence.push(`Strong fit for ${positiveHits} persona(s)`);
            } else {
                missing.push('Persona fit ratings unavailable');
            }
        }

        components.push({
            label: 'Persona Fit Signals',
            rationale: 'Aggregated professional / family / senior fit scores from comprehensive analysis.',
            earned: clamp(earned, 9),
            max: 9,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 8. Greenery / Parks (max 7) ──────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const f44 = findFactor(factors, 44);
        if (factorMentions(f44, 'park adjacent', 'near trails', 'park within', 'green space')) {
            earned = 6;
            evidence.push(...factorTagsMatching(f44, 'park', 'trail', 'green').slice(0, 1));
        } else if (factorMentions(f44, 'some greenery', 'tree-lined')) {
            earned = 4;
            evidence.push('Tree-lined neighborhood');
        } else {
            missing.push('Limited green space nearby');
        }

        components.push({
            label: 'Greenery / Parks',
            rationale: 'Parks and trails within a short walk shape daily routines.',
            earned: clamp(earned, 7),
            max: 7,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 9. Convenience / Errands (max 5) ─────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const f105 = findFactor(factors, 105);
        const f120 = findFactor(factors, 120);
        if (factorMentions(f105, 'walk to', 'near costco', 'farmers market', 'great dog park')) {
            earned += 3;
            evidence.push(...factorTagsMatching(f105, 'walk', 'costco', 'farmers', 'market').slice(0, 1));
        }
        if ((f120?.tags?.length ?? 0) >= 3) {
            earned += 2;
            evidence.push(`${f120!.tags.length} named nearby brands`);
        }

        if (earned === 0) missing.push('Errands likely require car');

        components.push({
            label: 'Convenience / Errands',
            rationale: 'Costco, Target, Trader Joe\'s — the unglamorous daily-life infrastructure.',
            earned: clamp(earned, 5),
            max: 5,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 10. Commute Quality (max 4) ──────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const f42 = findFactor(factors, 42);
        const f64 = findFactor(factors, 64);
        if (factorMentions(f42, 'quick highway', 'easy commute', 'fast access')) {
            earned += 2;
            evidence.push('Easy highway access');
        } else if (factorMentions(f42, 'congestion', 'long commute', 'bottleneck')) {
            earned -= 1;
            missing.push('Commute friction');
        }
        if (factorMentions(f64, 'close to job hubs', 'major employer', 'tech corridor')) {
            earned += 2;
            evidence.push('Close to job hubs');
        }

        if (earned <= 0) {
            earned = 2;
        }

        components.push({
            label: 'Commute Quality',
            rationale: 'Highway access and proximity to major employers.',
            earned: clamp(earned, 4),
            max: 4,
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
        modelId: 'lifestyle_community',
        label: 'Lifestyle & Community',
        description: 'Schools, walkability, amenities, safety, community sentiment, commute.',
        icon: 'fa-people-group',
        color: 'rose',
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
        score >= 85 ? 'Exceptional lifestyle and community'
        : score >= 70 ? 'Strong lifestyle fit with rich amenities'
        : score >= 55 ? 'Solid neighborhood with some gaps'
        : score >= 40 ? 'Limited walkability or amenities'
        : 'Lifestyle profile thin — car-dependent and isolated';

    const parts: string[] = [`${tier} (${grade}, ${score}/100).`];
    if (strongest.length > 0) {
        const ev = strongest.flatMap(c => c.evidence).slice(0, 3).join(', ');
        if (ev) parts.push(`Highlights: ${ev}.`);
    }
    if (weakest.length > 0) {
        const gaps = weakest.flatMap(c => c.missing || []).slice(0, 2).join('; ');
        if (gaps) parts.push(`Gaps: ${gaps}.`);
    }
    return parts.join(' ');
};
