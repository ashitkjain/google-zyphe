/**
 * Scoring Model — Outdoor Living
 *
 * Captures the backyard-as-lifestyle dimension: pools, fire features, covered
 * structures, outdoor cooking, recreation, privacy. The largest unscored
 * dimension in the property graph.
 *
 * Weighting (max 100):
 *   - Pool & Spa ...................  20
 *   - Outdoor Cooking & Dining .....  14
 *   - Fire & Ambiance ..............  12
 *   - Covered Structures ...........  12
 *   - Recreation Features ..........  10
 *   - Privacy & Seclusion ..........  14
 *   - Landscaping Quality ..........  10
 *   - Outdoor Capacity / ADU .......   8
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

export const scoreOutdoorLiving: ScoringModel = (factors, signals) => {
    const components: ScoreComponent[] = [];

    // ── 1. Pool & Spa (max 20) ───────────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'infinity_pool')) { earned += 12; evidence.push('Infinity pool'); }
        else if (hasSignal(signals, 'pool')) { earned += 9; evidence.push('In-ground pool'); }

        if (hasSignal(signals, 'spa_hot_tub')) { earned += 5; evidence.push('Spa / hot tub'); }
        // waterfall_feature consolidated into water_features.

        if (earned === 0) {
            const f32 = findFactor(factors, 32);
            if (factorMentions(f32, 'pool', 'spa', 'hot tub', 'jacuzzi')) {
                earned += 7;
                evidence.push(...factorTagsMatching(f32, 'pool', 'spa').slice(0, 2));
            } else {
                missing.push('No pool, spa, or water feature');
            }
        }

        components.push({
            label: 'Pool & Spa',
            rationale: 'The headline outdoor feature — pool/spa drives both lifestyle and resale.',
            earned: clamp(earned, 20),
            max: 20,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 2. Outdoor Cooking & Dining (max 14) ─────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'outdoor_kitchen')) { earned += 8; evidence.push('Outdoor kitchen'); }
        // bbq_station consolidated into outdoor_kitchen (covered above).
        if (hasSignal(signals, 'multi_zone_layout')) { earned += 2; evidence.push('Multi-area outdoor zones'); }
        if (hasSignal(signals, 'outdoor_dining_access')) { earned += 2; evidence.push('Indoor-outdoor dining flow'); }

        if (earned === 0) missing.push('No outdoor cooking or dining setup');

        components.push({
            label: 'Outdoor Cooking & Dining',
            rationale: 'Built-in BBQ, prep counter, and dining zones transform entertaining capacity.',
            earned: clamp(earned, 14),
            max: 14,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 3. Fire & Ambiance (max 12) ──────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'outdoor_fireplace')) { earned += 6; evidence.push('Outdoor fireplace'); }
        if (hasSignal(signals, 'fire_pit')) { earned += 4; evidence.push('Fire pit'); }
        if (hasSignal(signals, 'string_lighting')) { earned += 2; evidence.push('String / bistro lighting'); }
        if (hasSignal(signals, 'outdoor_speakers')) { earned += 1; evidence.push('Outdoor speakers'); }
        if (hasSignal(signals, 'outdoor_tv_av')) { earned += 1; evidence.push('Outdoor TV / AV'); }

        if (earned === 0) missing.push('No fire feature or ambient lighting');

        components.push({
            label: 'Fire & Ambiance',
            rationale: 'Fire features and lighting extend usable hours and create year-round appeal.',
            earned: clamp(earned, 12),
            max: 12,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 4. Covered Structures (max 12) ───────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'covered_patio')) { earned += 5; evidence.push('Covered patio / loggia'); }
        if (hasSignal(signals, 'pergola')) { earned += 3; evidence.push('Pergola'); }
        // cabana consolidated into gazebo (Gazebo / Cabana).
        if (hasSignal(signals, 'rooftop_deck')) { earned += 3; evidence.push('Rooftop deck'); }
        if (hasSignal(signals, 'gazebo')) { earned += 3; evidence.push('Gazebo / cabana'); }
        if (hasSignal(signals, 'retractable_glass_walls')) {
            earned += 3;
            evidence.push('Retractable / accordion glass walls');
        }

        if (earned === 0) missing.push('No covered outdoor structures');

        components.push({
            label: 'Covered Structures',
            rationale: 'Shade and shelter make outdoor spaces usable in summer heat and winter rain.',
            earned: clamp(earned, 12),
            max: 12,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 5. Recreation Features (max 10) ──────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'sport_court')) { earned += 5; evidence.push('Sport court (tennis / pickleball / basketball)'); }
        if (hasSignal(signals, 'putting_green')) { earned += 3; evidence.push('Putting green'); }
        if (hasSignal(signals, 'kid_friendly_lawn')) { earned += 2; evidence.push('Kid-friendly play lawn'); }
        if (hasSignal(signals, 'dog_friendly_lawn')) { earned += 2; evidence.push('Dog-friendly yard'); }

        if (earned === 0) missing.push('No dedicated recreation features');

        components.push({
            label: 'Recreation Features',
            rationale: 'Sport courts and play space directly serve daily-use lifestyle needs.',
            earned: clamp(earned, 10),
            max: 10,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 6. Privacy & Seclusion (max 14) ──────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'fully_secluded')) { earned += 6; evidence.push('Fully secluded backyard'); }
        if (hasSignal(signals, 'open_space_access')) { earned += 3; evidence.push('Backs to open space / trail'); }
        if (hasSignal(signals, 'fenced_yard')) { earned += 2; evidence.push('Fenced perimeter'); }

        const f33 = findFactor(factors, 33);
        if (factorMentions(f33, 'high privacy', 'private', 'secluded')) {
            earned += 3;
            evidence.push('Privacy assessment: high');
        } else if (factorMentions(f33, 'exposed', 'overlooked', 'low privacy')) {
            earned = Math.max(0, earned - 3);
            missing.push('Yard is overlooked by neighbors');
        }

        const f39 = findFactor(factors, 39);
        if (factorMentions(f39, 'large backyard', 'expansive yard', 'oversized lot')) {
            earned += 2;
            evidence.push('Large backyard');
        }

        if (earned === 0) missing.push('No privacy signals — yard may be exposed');

        components.push({
            label: 'Privacy & Seclusion',
            rationale: 'A private backyard is essential — exposed yards diminish all other outdoor features.',
            earned: clamp(earned, 14),
            max: 14,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 7. Landscaping Quality (max 10) ──────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'lush_landscaping')) { earned += 6; evidence.push('Lush / professionally landscaped'); }
        if (hasSignal(signals, 'water_features')) { earned += 2; evidence.push('Water features / fountain'); }
        if (hasSignal(signals, 'low_maintenance')) { earned += 1; evidence.push('Low-maintenance plantings'); }
        if (hasSignal(signals, 'resort_style')) { earned += 2; evidence.push('Resort-style atmosphere'); }

        if (earned === 0) {
            const f96 = findFactor(factors, 96);
            const hits = factorTagsMatching(f96, 'lush', 'manicured', 'curated', 'designer');
            if (hits.length > 0) { earned += 4; evidence.push(...hits.slice(0, 1)); }
            else missing.push('Backyard landscaping appears generic / undocumented');
        }

        components.push({
            label: 'Landscaping Quality',
            rationale: 'Mature, designed landscaping anchors the entire outdoor experience.',
            earned: clamp(earned, 10),
            max: 10,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 8. Outdoor Capacity / ADU (max 8) ────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'adu_guest_house')) { earned += 5; evidence.push('ADU / guest house'); }

        const f68 = findFactor(factors, 68);
        if (factorMentions(f68, 'room for pool', 'add adu', 'expandable', 'large lot')) {
            earned += 3;
            evidence.push('Backyard has expansion potential');
        }

        if (earned === 0) missing.push('No ADU or expansion capacity');

        components.push({
            label: 'Outdoor Capacity / ADU',
            rationale: 'A guest house or expansion-ready lot adds long-term optionality.',
            earned: clamp(earned, 8),
            max: 8,
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
        modelId: 'outdoor_living',
        label: 'Outdoor Living',
        description: 'Backyard as lifestyle: pools, fire features, cooking, structures, privacy.',
        icon: 'fa-tree',
        color: 'teal',
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
        score >= 85 ? 'Resort-caliber outdoor living'
        : score >= 70 ? 'Strong outdoor lifestyle setup'
        : score >= 55 ? 'Functional outdoor space, room to elevate'
        : score >= 40 ? 'Basic backyard — limited entertaining capacity'
        : 'Minimal outdoor lifestyle infrastructure';

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
