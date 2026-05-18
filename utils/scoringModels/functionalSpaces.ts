/**
 * Scoring Model — Specific Functional Spaces
 *
 * "Bonus" rooms that have moved up the priority list post-COVID: dedicated home
 * office, walk-in pantry, mudroom, laundry room, multi-gen suite, plus
 * higher-tier flex spaces like a home gym, theater, or wine cellar.
 *
 * Weighting (max 100):
 *   - Dedicated Home Office .........  20
 *   - Multi-Gen / Flex Suite ........  18
 *   - Pantry / Mudroom / Storage ....  15
 *   - Laundry Room ..................  10
 *   - Garage Capacity ...............  10
 *   - Home Gym / Wellness ...........   8
 *   - Entertainment Spaces ..........  10
 *   - Outdoor Functional Capacity ...   9
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

export const scoreFunctionalSpaces: ScoringModel = (factors, signals) => {
    const components: ScoreComponent[] = [];

    // ── 1. Dedicated Home Office (max 20) ────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'home_office')) {
            earned += 12;
            evidence.push('Dedicated home office / study');
        }
        const f17 = findFactor(factors, 17);
        if (factorMentions(f17, 'office', 'den', 'study', 'library', 'work from home')) {
            if (earned === 0) {
                earned += 10;
                evidence.push('Office/den/study present');
            }
        }
        const f57 = findFactor(factors, 57);
        if (factorMentions(f57, 'high', 'excellent', 'strong')) {
            earned += 5;
            evidence.push('Strong WFH score');
        }
        // Bonus: fiber internet boosts WFH viability
        const f76 = findFactor(factors, 76);
        if (factorMentions(f76, 'fiber', 'gigabit', 'gig speed')) {
            earned += 3;
            evidence.push('Fiber internet supports WFH');
        }

        if (earned === 0) missing.push('No dedicated office/den/study detected');

        components.push({
            label: 'Dedicated Home Office',
            rationale: 'Post-COVID, a real office (door + window + outlet) is the top functional ask.',
            earned: clamp(earned, 20),
            max: 20,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 2. Multi-Gen / Flex Suite (max 18) ───────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'adu_guest_house')) {
            earned += 10;
            evidence.push('ADU / guest house');
        }
        if (hasSignal(signals, 'main_floor_suite')) {
            earned += 6;
            evidence.push('Main-floor primary suite');
        }
        if (hasSignal(signals, 'king_size_suite')) { earned += 2; evidence.push('Oversized primary suite'); }
        if (hasSignal(signals, 'seating_area')) { earned += 1; evidence.push('Bedroom seating area'); }
        if (hasSignal(signals, 'fireplace_bedroom')) { earned += 1; evidence.push('Bedroom fireplace'); }
        const f58 = findFactor(factors, 58);
        if (factorMentions(f58, 'downstairs bed', 'in-law', 'separate entrance', 'multi-gen', 'multigen')) {
            if (earned === 0) {
                earned += 8;
                evidence.push('Multi-gen / in-law setup');
            } else {
                earned += 2;
            }
        }
        // Private outdoor connection from primary suite supports flex/multi-gen lifestyle
        if (hasSignal(signals, 'private_balcony')) { earned += 1; evidence.push('Private balcony'); }
        if (hasSignal(signals, 'terrace_access')) { earned += 1; evidence.push('Terrace access'); }
        // Layout / Foundation: split bedrooms or basement = more usable flex space
        const f116 = findFactor(factors, 116);
        if (factorMentions(f116, 'split bedroom', 'jack-and-jill', 'separate wings')) {
            earned += 1;
            evidence.push('Split / separated bedroom wings');
        }
        const f19 = findFactor(factors, 19);
        if (factorMentions(f19, 'basement', 'finished basement', 'walkout basement')) {
            earned += 2;
            evidence.push('Basement (bonus flex space)');
        }

        if (earned === 0) missing.push('No multi-gen or main-floor suite');

        components.push({
            label: 'Multi-Gen / Flex Suite',
            rationale: 'ADU, in-law unit, or main-floor primary — critical for aging-in-place and multi-gen living.',
            earned: clamp(earned, 18),
            max: 18,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 3. Pantry / Mudroom / Storage (max 15) ───────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'walk_in_pantry')) { earned += 5; evidence.push('Walk-in pantry'); }
        if (hasSignal(signals, 'mudroom')) { earned += 4; evidence.push('Mudroom'); }
        if (hasSignal(signals, 'dirty_kitchen')) { earned += 3; evidence.push('Prep / back kitchen'); }
        if (hasSignal(signals, 'built_in_organizers')) { earned += 1; evidence.push('Built-in organizers'); }
        if (hasSignal(signals, 'boutique_walk_in_closet')) { earned += 1; evidence.push('Custom walk-in closet'); }
        if (hasSignal(signals, 'shoe_wall')) { earned += 1; evidence.push('Shoe wall'); }

        if (earned === 0) {
            const f100 = findFactor(factors, 100);
            if (factorMentions(f100, 'walk-in pantry', 'mudroom', 'butler pantry', 'drop zone')) {
                earned += 5;
                evidence.push('Pantry/mudroom in agent highlights');
            } else {
                missing.push('No walk-in pantry or mudroom');
            }
        }

        components.push({
            label: 'Pantry / Mudroom / Storage',
            rationale: 'Specialized storage rooms keep family life organized — high search demand.',
            earned: clamp(earned, 15),
            max: 15,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 4. Laundry Room (max 10) ─────────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'laundry_room')) {
            earned += 8;
            evidence.push('Dedicated laundry room');
        }
        const f59 = findFactor(factors, 59);
        if (factorMentions(f59, 'inside laundry', 'laundry room', 'laundry suite', 'utility room')) {
            if (earned === 0) earned += 7;
            evidence.push('Inside laundry');
        } else if (factorMentions(f59, 'hookups only', 'garage shared', 'closet laundry')) {
            earned = Math.max(earned, 2);
            missing.push('Laundry is hookups-only or in garage');
        }

        if (earned === 0) missing.push('Laundry location unclear');

        components.push({
            label: 'Laundry Room',
            rationale: 'A real laundry room — not a closet, not the garage — is a daily quality-of-life win.',
            earned: clamp(earned, 10),
            max: 10,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 5. Garage Capacity (max 10) ──────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'garage_3_car')) {
            earned += 8;
            evidence.push('3-car garage');
        }
        const f97 = findFactor(factors, 97);
        if (factorMentions(f97, '3-car', 'three car', 'oversized garage')) {
            if (earned === 0) {
                earned += 7;
                evidence.push('3-car / oversized garage');
            }
        } else if (factorMentions(f97, '2-car', 'two car')) {
            earned += 4;
            evidence.push('2-car garage');
        } else if (factorMentions(f97, '1-car', 'one car', 'tandem')) {
            earned += 2;
            evidence.push('1-car / tandem garage');
        }
        if (factorMentions(f97, 'rv parking', 'circular drive')) {
            earned += 2;
            evidence.push('RV parking / circular drive');
        }

        if (earned === 0) missing.push('Garage size not documented');

        components.push({
            label: 'Garage Capacity',
            rationale: '3+ car garages give workshop, gym, or hobby space — hard to retrofit.',
            earned: clamp(earned, 10),
            max: 10,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 6. Home Gym / Wellness (max 8) ───────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'home_gym')) { earned += 5; evidence.push('Home gym / wellness studio'); }
        if (hasSignal(signals, 'sauna_cold_plunge')) { earned += 3; evidence.push('Sauna / cold plunge'); }
        if (hasSignal(signals, 'residential_elevator')) { earned += 2; evidence.push('Residential elevator'); }

        if (earned === 0) {
            const f100 = findFactor(factors, 100);
            if (factorMentions(f100, 'home gym', 'workout room', 'sauna', 'cold plunge', 'wellness room')) {
                earned += 4;
                evidence.push('Gym/wellness in agent highlights');
            } else {
                missing.push('No gym or wellness space');
            }
        }

        components.push({
            label: 'Home Gym / Wellness',
            rationale: 'At-home fitness and wellness rooms are the new "garage workshop."',
            earned: clamp(earned, 8),
            max: 8,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 7. Entertainment Spaces (max 10) ─────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'home_theater')) { earned += 5; evidence.push('Home theater / media room'); }
        if (hasSignal(signals, 'wine_cellar')) { earned += 4; evidence.push('Wine cellar'); }
        if (hasSignal(signals, 'integrated_wine_fridge')) { earned += 1; evidence.push('Integrated wine fridge'); }

        if (earned === 0) {
            const f100 = findFactor(factors, 100);
            if (factorMentions(f100, 'theater room', 'media room', 'wine cellar', 'wine room')) {
                earned += 4;
                evidence.push('Entertainment space mentioned');
            } else {
                missing.push('No dedicated entertainment space');
            }
        }

        components.push({
            label: 'Entertainment Spaces',
            rationale: 'Theater rooms and wine cellars convert "house" into "destination."',
            earned: clamp(earned, 10),
            max: 10,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 8. Outdoor Functional Capacity (max 9) ───────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'outdoor_kitchen')) { earned += 3; evidence.push('Outdoor kitchen'); }
        if (hasSignal(signals, 'multi_zone_layout')) { earned += 2; evidence.push('Multi-area outdoor zones'); }
        if (hasSignal(signals, 'side_yard_storage')) { earned += 1; evidence.push('Side-yard storage'); }
        if (hasSignal(signals, 'covered_patio')) { earned += 1; evidence.push('Covered patio'); }
        if (hasSignal(signals, 'fenced_yard')) { earned += 1; evidence.push('Fenced / secure yard'); }
        if (hasSignal(signals, 'sport_court') || hasSignal(signals, 'putting_green')) { earned += 1; evidence.push('Sport court / putting green'); }

        if (earned === 0) missing.push('No notable outdoor functional spaces');

        components.push({
            label: 'Outdoor Functional Capacity',
            rationale: 'Outdoor kitchens, sport courts, and storage extend usable square footage.',
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
        modelId: 'functional_spaces',
        label: 'Functional Spaces',
        description: 'Bonus rooms: office, multi-gen suite, pantry, mudroom, gym, theater — the post-COVID asks.',
        icon: 'fa-shapes',
        color: 'violet',
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
        score >= 85 ? 'Exceptional functional footprint'
        : score >= 70 ? 'Strong mix of bonus rooms'
        : score >= 55 ? 'Adequate functional spaces with some gaps'
        : score >= 40 ? 'Limited bonus rooms'
        : 'Bare-bones layout — most flex space is missing';

    const parts: string[] = [`${tier} (${grade}, ${score}/100).`];
    if (strongest.length > 0) {
        const ev = strongest.flatMap(c => c.evidence).slice(0, 3).join(', ');
        if (ev) parts.push(`Strongest: ${ev}.`);
    }
    if (weakest.length > 0) {
        const gaps = weakest.flatMap(c => c.missing || []).slice(0, 2).join('; ');
        if (gaps) parts.push(`Gaps: ${gaps}.`);
    }
    return parts.join(' ');
};
