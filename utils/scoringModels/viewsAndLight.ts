/**
 * Scoring Model — Views & Light
 *
 * Captures both the framed-by-windows experience (interior views, glass scale,
 * natural light) and the backyard view dimension (hills, water, city lights).
 *
 * Weighting (max 100):
 *   - Backyard Views ..............  25
 *   - Interior Views ..............  14
 *   - Window Scale & Glass ........  18
 *   - Natural Light Quality .......  16
 *   - Bedroom Outdoor Connection ..  10
 *   - View Privacy ................   8
 *   - Orientation / Light Quality .   9
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
} from './types';

export const scoreViewsAndLight: ScoringModel = (factors, signals) => {
    const components: ScoreComponent[] = [];

    // ── 1. Backyard Views (max 25) ───────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const viewTags = [
            { id: 'waterfront_views',  pts: 10, label: 'Waterfront / bay views' },
            { id: 'hill_valley_views', pts: 8,  label: 'Hill / valley views' },
            { id: 'sunset_views',      pts: 6,  label: 'Sunset / west-facing views' },
            { id: 'open_space_access', pts: 5,  label: 'Backs to open space' },
            { id: 'vineyard_views',    pts: 6,  label: 'Vineyard views' },
            { id: 'golf_course_views', pts: 4,  label: 'Golf course views' },
        ];
        for (const v of viewTags) {
            if (hasSignal(signals, v.id)) {
                earned += v.pts;
                evidence.push(v.label);
            }
        }
        if (earned === 0) {
            const f36 = findFactor(factors, 36);
            const hits = factorTagsMatching(f36, 'views', 'view of', 'overlook', 'vista');
            if (hits.length > 0) { earned += 8; evidence.push(...hits.slice(0, 2)); }
            else missing.push('No notable backyard views');
        }

        components.push({
            label: 'Backyard Views',
            rationale: 'The single most-asked-for outdoor feature — water/hills/city lights from the yard.',
            earned: clamp(earned, 25),
            max: 25,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 2. Interior Views (max 14) ───────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'panoramic_views')) { earned += 6; evidence.push('Panoramic interior views'); }
        if (hasSignal(signals, 'city_skyline_views')) { earned += 4; evidence.push('City skyline (interior)'); }
        if (hasSignal(signals, 'garden_views')) { earned += 3; evidence.push('Garden views from living areas'); }

        if (earned === 0) missing.push('No interior view signals');

        components.push({
            label: 'Interior Views',
            rationale: 'What you see from the kitchen and living room daily.',
            earned: clamp(earned, 14),
            max: 14,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 3. Window Scale & Glass (max 18) ─────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'floor_to_ceiling_windows')) { earned += 7; evidence.push('Floor-to-ceiling windows'); }
        if (hasSignal(signals, 'retractable_glass_walls')) { earned += 5; evidence.push('Retractable glass walls'); }
        if (hasSignal(signals, 'oversized_windows')) { earned += 4; evidence.push('Oversized bedroom windows'); }
        if (hasSignal(signals, 'kitchen_skylights')) { earned += 3; evidence.push('Skylights'); }
        if (hasSignal(signals, 'entry_glass_views')) { earned += 1; evidence.push('Entry glass sidelights'); }

        if (earned === 0) missing.push('Standard-scale windows — no view-framing glass');

        components.push({
            label: 'Window Scale & Glass',
            rationale: 'Big windows turn views into a daily-life feature, not a vacation memory.',
            earned: clamp(earned, 18),
            max: 18,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 4. Natural Light Quality (max 16) ────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'natural_light')) { earned += 8; evidence.push('Abundant natural light'); }

        const f24 = findFactor(factors, 24);
        if (factorMentions(f24, 'south-facing', 'south facing', 'sun-drenched', 'sunlit')) {
            earned += 5;
            evidence.push('South-facing / sun-drenched');
        } else if (factorMentions(f24, 'bright', 'light-filled', 'plenty of light')) {
            earned += 3;
            evidence.push('Bright / light-filled');
        } else if (factorMentions(f24, 'dim', 'dark', 'limited light')) {
            earned = Math.max(0, earned - 2);
            missing.push('Limited natural light flagged');
        }
        if (factorMentions(f24, 'skylight', 'clerestory')) {
            earned += 3;
            evidence.push('Skylights / clerestory windows');
        }

        if (earned === 0) missing.push('Natural light quality not documented');

        components.push({
            label: 'Natural Light Quality',
            rationale: 'South-facing exposure and architectural lighting design matter more than fixtures.',
            earned: clamp(earned, 16),
            max: 16,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 5. Bedroom Outdoor Connection (max 10) ───────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'private_balcony')) { earned += 5; evidence.push('Private balcony'); }
        if (hasSignal(signals, 'terrace_access')) { earned += 4; evidence.push('Private terrace access'); }
        if (hasSignal(signals, 'garden_views')) { earned += 2; evidence.push('Private garden views'); }

        if (earned === 0) missing.push('Primary suite lacks outdoor connection');

        components.push({
            label: 'Bedroom Outdoor Connection',
            rationale: 'A private balcony or terrace turns the primary into a retreat.',
            earned: clamp(earned, 10),
            max: 10,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 6. View Privacy (max 8) ──────────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'fully_secluded')) { earned += 4; evidence.push('Fully secluded'); }
        // open_space_access and waterfront_views already credited in Backyard Views above.

        const f33 = findFactor(factors, 33);
        if (factorMentions(f33, 'no rear neighbors', 'unobstructed', 'no neighbors behind')) {
            earned += 2;
            evidence.push('No rear neighbors');
        }

        if (earned === 0) missing.push('Views may be obstructed by neighboring homes');

        components.push({
            label: 'View Privacy',
            rationale: 'A view is only as good as your privacy — neighbors in the foreground kill it.',
            earned: clamp(earned, 8),
            max: 8,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 7. Orientation / Light Quality (max 9) ───────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const f51 = findFactor(factors, 51);
        if (factorMentions(f51, 'south-facing', 'east-facing', 'morning sun', 'sunset', 'good orientation')) {
            earned += 5;
            evidence.push(...factorTagsMatching(f51, 'south', 'east', 'morning', 'sunset').slice(0, 1));
        }

        const f121 = findFactor(factors, 121);
        if (factorMentions(f121, 'sun-drenched', 'bright microclimate', 'sunny pocket')) {
            earned += 4;
            evidence.push('Sun-drenched microclimate');
        } else if (factorMentions(f121, 'fog belt', 'overcast', 'shaded pocket')) {
            earned = Math.max(0, earned - 2);
            missing.push('Fog belt / overcast microclimate');
        }

        if (earned === 0) missing.push('Orientation not documented');

        components.push({
            label: 'Orientation / Light Quality',
            rationale: 'East and south orientations bring more usable daylight; fog belts cost light.',
            earned: clamp(earned, 9),
            max: 9,
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
        modelId: 'views_and_light',
        label: 'Views & Light',
        description: 'View framing and daylight: backyard vistas, glass scale, orientation, natural light.',
        icon: 'fa-sun',
        color: 'amber',
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
        score >= 85 ? 'Exceptional views and light'
        : score >= 70 ? 'Strong daylight and view exposure'
        : score >= 55 ? 'Adequate light, limited views'
        : score >= 40 ? 'Modest light and view exposure'
        : 'Dark or view-poor property';

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
