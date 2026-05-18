/**
 * Scoring Model — Climate Resilience
 *
 * Inverted-risk scoring: lower environmental risk = higher score. Critical
 * for California buyers (wildfire, drought, seismic). Mitigation features
 * (defensible space, retrofits, solar+battery) add credit.
 *
 * Weighting (max 100):
 *   - Wildfire Risk ............  22  (inverted)
 *   - Flood / Water Risk .......  16  (inverted)
 *   - Seismic Risk .............  12  (inverted)
 *   - Air Quality ..............  12  (inverted)
 *   - Disaster History .........  10  (inverted)
 *   - Noise Exposure ...........   8  (inverted)
 *   - Pollen / Allergens .......   5  (inverted)
 *   - Microclimate Favorability   7
 *   - Mitigation Features ......   8
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

/** For risk factors: low risk (e.g. 2/10) = high score. */
const invertRiskToScore = (risk: number | null, max: number, defaultScore: number): number => {
    if (risk === null) return defaultScore;
    return Math.round(((10 - risk) / 10) * max);
};

export const scoreClimateResilience: ScoringModel = (factors, signals) => {
    const components: ScoreComponent[] = [];

    // ── 1. Wildfire Risk (max 22) — inverted ─────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        const f46 = findFactor(factors, 46);
        const rating = extractRatingOutOfTen(f46);
        let earned = invertRiskToScore(rating, 22, 12);

        if (rating !== null) evidence.push(`Wildfire risk: ${rating}/10`);
        else if (factorMentions(f46, 'low risk', 'urban safety', 'safe zone')) {
            earned = 18; evidence.push('Low wildfire risk');
        } else if (factorMentions(f46, 'high risk', 'wui', 'wildland-urban', 'red flag')) {
            earned = 4; missing.push('High wildfire risk / WUI zone');
        }

        components.push({
            label: 'Wildfire Risk',
            rationale: 'CA\'s defining climate risk. Lower risk = more durable insurance and resale.',
            earned: clamp(earned, 22),
            max: 22,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 2. Flood / Water Risk (max 16) — inverted ────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        const f47 = findFactor(factors, 47);
        const rating = extractRatingOutOfTen(f47);
        let earned = invertRiskToScore(rating, 16, 10);

        if (rating !== null) evidence.push(`Flood risk: ${rating}/10`);
        else if (factorMentions(f47, 'no flood', 'low flood', 'x zone')) {
            earned = 14; evidence.push('Outside flood hazard zone');
        } else if (factorMentions(f47, 'flood zone', 'sfha', 'creek-adjacent', 'flood plain')) {
            earned = 4; missing.push('In or near FEMA flood zone');
        }

        components.push({
            label: 'Flood / Water Risk',
            rationale: 'Flood-zone properties carry mandatory insurance and resale friction.',
            earned: clamp(earned, 16),
            max: 16,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 3. Seismic Risk (max 12) — inverted ──────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        const f106 = findFactor(factors, 106);
        const rating = extractRatingOutOfTen(f106);
        let earned = invertRiskToScore(rating, 12, 7);

        if (rating !== null) evidence.push(`Seismic risk: ${rating}/10`);
        else if (factorMentions(f106, 'low seismic', 'stable bedrock', 'minor risk')) {
            earned = 10; evidence.push('Low seismic exposure');
        } else if (factorMentions(f106, 'liquefaction', 'fault line', 'high seismic')) {
            earned = 3; missing.push('High seismic risk (fault / liquefaction zone)');
        }

        components.push({
            label: 'Seismic Risk',
            rationale: 'Proximity to faults, liquefaction zones, and unreinforced construction all matter.',
            earned: clamp(earned, 12),
            max: 12,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 4. Air Quality (max 12) — inverted ───────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        const f52 = findFactor(factors, 52);
        let earned = 7;

        if (factorMentions(f52, 'clean air', 'low aqi', 'good air')) {
            earned = 10; evidence.push('Clean air zone');
        } else if (factorMentions(f52, 'near freeway', 'industrial', 'high aqi', 'poor air')) {
            earned = 3; missing.push('Near freeway / industrial — elevated AQI');
        } else if (factorMentions(f52, 'moderate aqi', 'occasional smoke')) {
            earned = 6; evidence.push('Moderate air quality');
        }

        components.push({
            label: 'Air Quality',
            rationale: 'Freeway proximity and wildfire smoke patterns directly affect daily health.',
            earned: clamp(earned, 12),
            max: 12,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 5. Disaster History (max 10) — inverted ──────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        const f79 = findFactor(factors, 79);
        let earned = 6;

        if (factorMentions(f79, 'no recent disasters', 'minimal history', 'clean record')) {
            earned = 9; evidence.push('No recent disaster events');
        } else if (factorMentions(f79, 'multiple events', 'recent wildfire', 'recent flood', 'evacuation')) {
            earned = 2; missing.push('Multiple recent disaster events on record');
        } else if (factorMentions(f79, 'seismic retrofit', 'defensible space', 'hardened')) {
            earned += 3;
            evidence.push('Mitigation retrofits in place');
        }

        components.push({
            label: 'Disaster History & Prep',
            rationale: 'Recent disaster events nearby signal future risk; retrofits offset it.',
            earned: clamp(earned, 10),
            max: 10,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 6. Noise Exposure (max 8) — inverted ─────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        const f77 = findFactor(factors, 77);
        let earned = 5;

        if (factorMentions(f77, 'quiet', 'no noise', 'low noise')) {
            earned = 7; evidence.push('Quiet street');
        } else if (factorMentions(f77, 'traffic noise', 'highway', 'flight path', 'construction noise')) {
            earned = 2; missing.push('Notable noise exposure (traffic / flights / construction)');
        } else if (factorMentions(f77, 'moderate noise', 'some traffic')) {
            earned = 4;
        }

        components.push({
            label: 'Noise Exposure',
            rationale: 'Traffic, planes, and ongoing construction degrade quality of life.',
            earned: clamp(earned, 8),
            max: 8,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 7. Pollen / Allergens (max 5) — inverted ─────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        const f49 = findFactor(factors, 49);
        let earned = 3;

        if (factorMentions(f49, 'low pollen', 'minimal allergens')) {
            earned = 5; evidence.push('Low pollen / allergen burden');
        } else if (factorMentions(f49, 'high pollen', 'mature pines', 'oaks', 'allergy season')) {
            earned = 1; missing.push('High pollen burden (oaks / pines / seasonal spikes)');
        }

        components.push({
            label: 'Pollen / Allergens',
            rationale: 'Mature trees create beauty AND seasonal allergens.',
            earned: clamp(earned, 5),
            max: 5,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 8. Microclimate Favorability (max 7) ─────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        const f121 = findFactor(factors, 121);
        let earned = 4;

        if (factorMentions(f121, 'mild', 'temperate', 'sunny pocket', 'sun-drenched')) {
            earned = 6; evidence.push('Mild / sunny microclimate');
        } else if (factorMentions(f121, 'fog belt', 'overcast', 'windy ridge', 'cold pocket')) {
            earned = 2; missing.push('Less favorable microclimate (fog / wind / cold)');
        }

        components.push({
            label: 'Microclimate Favorability',
            rationale: 'Microclimates vary block-to-block in CA — fog belt vs. sunny pocket is meaningful.',
            earned: clamp(earned, 7),
            max: 7,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 9. Mitigation Features (max 8) ───────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'solar_panels')) { earned += 2; evidence.push('Solar (resilience asset)'); }
        if (hasSignal(signals, 'backup_battery')) { earned += 3; evidence.push('Backup battery'); }

        const f79 = findFactor(factors, 79);
        const mitigationHits = factorTagsMatching(f79, 'fire-resistant', 'seismic retrofit', 'defensible space', 'class a roof', 'hardened');
        if (mitigationHits.length > 0) {
            earned += 3;
            evidence.push(...mitigationHits.slice(0, 1));
        }

        if (earned === 0) missing.push('No documented disaster-mitigation features');

        components.push({
            label: 'Mitigation Features',
            rationale: 'Hardened construction, defensible space, and solar+battery turn risk into resilience.',
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
        modelId: 'climate_resilience',
        label: 'Climate Resilience',
        description: 'Low-risk environmental profile: wildfire, flood, seismic, air, noise, microclimate.',
        icon: 'fa-shield-halved',
        color: 'sky',
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
        score >= 85 ? 'Exceptionally low-risk site'
        : score >= 70 ? 'Resilient — most risks well below average'
        : score >= 55 ? 'Mixed risk profile — manageable but watch list items'
        : score >= 40 ? 'Elevated climate / environmental risk'
        : 'High-risk site — multiple compounding exposures';

    const parts: string[] = [`${tier} (${grade}, ${score}/100).`];
    if (strongest.length > 0) {
        const ev = strongest.flatMap(c => c.evidence).slice(0, 3).join(', ');
        if (ev) parts.push(`Strengths: ${ev}.`);
    }
    if (weakest.length > 0) {
        const gaps = weakest.flatMap(c => c.missing || []).slice(0, 2).join('; ');
        if (gaps) parts.push(`Risks: ${gaps}.`);
    }
    return parts.join(' ');
};
