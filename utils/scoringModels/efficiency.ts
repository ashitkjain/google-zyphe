/**
 * Scoring Model — Efficiency & Low Maintenance
 *
 * Long-term cost-savers: solar, energy-efficient envelope, modern HVAC,
 * drought-tolerant landscaping. Rarely the primary purchase driver but
 * a strong tiebreaker, especially in California.
 *
 * Weighting (max 100):
 *   - Solar Generation .............  22
 *   - Backup Battery ...............   8
 *   - HVAC Quality .................  15
 *   - Energy-Efficient Envelope ....  15
 *   - Drought-Tolerant Landscaping .  12
 *   - Smart Irrigation .............   6
 *   - EV Infrastructure ............   6
 *   - Water Systems ................   8
 *   - Construction Era / Build .....   8
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

export const scoreEfficiencyLowMaintenance: ScoringModel = (factors, signals) => {
    const components: ScoreComponent[] = [];

    // ── 1. Solar Generation (max 22) ─────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'solar_panels')) {
            // The taxonomy label is "Solar (Owned)" — owned solar is more valuable than leased
            earned += 16;
            evidence.push('Solar (owned)');
        }
        const f48 = findFactor(factors, 48);
        if (factorMentions(f48, 'panels installed', 'pv system', 'solar installed', 'owned solar')) {
            if (earned === 0) {
                earned += 12;
                evidence.push('Solar PV installed');
            } else {
                earned += 3;
            }
        } else if (factorMentions(f48, 'leased solar', 'solar lease', 'ppa')) {
            earned += 8;
            evidence.push('Leased solar (transferable but adds friction)');
        } else if (factorMentions(f48, 'south-facing', 'unobstructed roof', 'high solar potential')) {
            earned += 4;
            evidence.push('High solar potential (ready for install)');
        }

        if (earned === 0) missing.push('No solar PV or solar-ready roof flagged');

        components.push({
            label: 'Solar Generation',
            rationale: 'Owned solar materially cuts utility bills; leased solar still helps but transfers debt.',
            earned: clamp(earned, 22),
            max: 22,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 2. Backup Battery (max 8) ────────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'backup_battery')) {
            earned += 8;
            evidence.push('Backup battery / Powerwall');
        } else {
            const f100 = findFactor(factors, 100);
            if (factorMentions(f100, 'powerwall', 'home battery', 'backup battery', 'tesla battery')) {
                earned += 6;
                evidence.push('Battery storage in agent highlights');
            } else {
                missing.push('No battery backup');
            }
        }

        components.push({
            label: 'Backup Battery',
            rationale: 'Pairs with solar for resilience during PG&E PSPS shutoffs.',
            earned: clamp(earned, 8),
            max: 8,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 3. HVAC Quality (max 15) ─────────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const f50 = findFactor(factors, 50);
        if (factorMentions(f50, 'heat pump', 'mini-split')) { earned += 7; evidence.push('Heat pump / mini-split'); }
        if (factorMentions(f50, 'zoned', 'multi-zone', 'dual zone')) { earned += 4; evidence.push('Zoned HVAC'); }
        if (factorMentions(f50, 'new hvac', 'recently replaced', '2020', '2021', '2022', '2023', '2024')) { earned += 3; evidence.push('Recently replaced HVAC'); }
        if (factorMentions(f50, 'central air', 'central a/c')) {
            if (earned === 0) {
                earned += 4;
                evidence.push('Central HVAC');
            }
        } else if (factorMentions(f50, 'no ac', 'no a/c')) {
            earned = Math.max(0, earned - 4);
            missing.push('No central A/C');
        }
        if (hasSignal(signals, 'climate_control')) { earned += 2; evidence.push('Smart climate control'); }

        if (earned === 0) missing.push('HVAC quality undocumented');

        components.push({
            label: 'HVAC Quality',
            rationale: 'Modern heat pumps and zoned systems are the biggest single energy lever.',
            earned: clamp(earned, 15),
            max: 15,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 4. Energy-Efficient Envelope (max 15) ────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const f100 = findFactor(factors, 100);
        const windowHits = factorTagsMatching(f100, 'dual-pane', 'dual pane', 'double pane', 'energy efficient window', 'low-e window', 'new windows');
        if (windowHits.length > 0) { earned += 6; evidence.push(...windowHits.slice(0, 1)); }

        const insulationHits = factorTagsMatching(f100, 'insulation', 'spray foam', 'attic insulation', 'r-value');
        if (insulationHits.length > 0) { earned += 4; evidence.push('Insulation upgrade'); }

        const roofHits = factorTagsMatching(f100, 'new roof', 'cool roof', 'reflective roof', 'composition roof');
        if (roofHits.length > 0) { earned += 3; evidence.push(...roofHits.slice(0, 1)); }

        if (factorMentions(f100, 'tankless water heater', 'tankless')) {
            earned += 2;
            evidence.push('Tankless water heater');
        }

        if (earned === 0) missing.push('No energy-efficient envelope upgrades flagged');

        components.push({
            label: 'Energy-Efficient Envelope',
            rationale: 'Dual-pane windows, modern insulation, and a tight roof cut HVAC load.',
            earned: clamp(earned, 15),
            max: 15,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 5. Drought-Tolerant Landscaping (max 12) ─────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'low_maintenance')) {
            earned += 8;
            evidence.push('Drought-tolerant / low-maintenance landscaping');
        }
        const f40 = findFactor(factors, 40);
        if (factorMentions(f40, 'drought-tolerant', 'xeriscape', 'native plants', 'artificial turf', 'low-water')) {
            if (earned === 0) {
                earned += 7;
                evidence.push(...factorTagsMatching(f40, 'drought', 'xeriscape', 'native', 'artificial').slice(0, 2));
            } else {
                earned += 2;
            }
        }
        // Factor 121 microclimate hint
        const f121 = findFactor(factors, 121);
        if (factorMentions(f121, 'low irrigation', 'mild climate', 'fog belt')) {
            earned += 2;
            evidence.push('Microclimate reduces water needs');
        }
        // Level / flat lot reduces grading, drainage, and erosion maintenance
        if (hasSignal(signals, 'level_flat_lot')) {
            earned += 1;
            evidence.push('Level lot (minimal grading maintenance)');
        }

        if (earned === 0) missing.push('Landscaping appears water-intensive');

        components.push({
            label: 'Drought-Tolerant Landscaping',
            rationale: 'Native plants and xeriscape slash water bills — and CA has water restrictions.',
            earned: clamp(earned, 12),
            max: 12,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 6. Smart Irrigation (max 6) ──────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'smart_irrigation')) {
            earned += 6;
            evidence.push('Smart irrigation (Rachio / drip)');
        } else {
            const f100 = findFactor(factors, 100);
            if (factorMentions(f100, 'drip irrigation', 'rachio', 'smart sprinkler')) {
                earned += 4;
                evidence.push('Smart irrigation mentioned');
            } else {
                missing.push('No smart / efficient irrigation');
            }
        }

        components.push({
            label: 'Smart Irrigation',
            rationale: 'Automated drip and weather-aware controllers cut outdoor water 30-50%.',
            earned: clamp(earned, 6),
            max: 6,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 7. EV Infrastructure (max 6) ─────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'ev_charging')) {
            earned += 6;
            evidence.push('EV charging (Level 2)');
        } else {
            const f100 = findFactor(factors, 100);
            if (factorMentions(f100, 'ev charger', 'tesla charger', '240v outlet', 'nema 14-50')) {
                earned += 4;
                evidence.push('EV-ready electrical');
            } else {
                missing.push('No EV charging infrastructure');
            }
        }

        components.push({
            label: 'EV Infrastructure',
            rationale: 'A 240V Level-2 setup avoids a $1-2K install for the next owner.',
            earned: clamp(earned, 6),
            max: 6,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 8. Water Systems (max 8) ─────────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const f60 = findFactor(factors, 60);
        if (factorMentions(f60, 'water softener', 'softener')) { earned += 3; evidence.push('Water softener'); }
        if (factorMentions(f60, 'reverse osmosis', 'ro filter', 'whole-house ro')) { earned += 3; evidence.push('RO / whole-house filtration'); }
        if (factorMentions(f60, 'tankless water heater', 'tankless')) { earned += 2; evidence.push('Tankless water heater'); }

        if (earned === 0) missing.push('No water filtration or softening system');

        components.push({
            label: 'Water Systems',
            rationale: 'Softener + filtration extends fixture life; tankless heaters save energy.',
            earned: clamp(earned, 8),
            max: 8,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 9. Construction Era / Build Quality (max 8) ──────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const f20 = findFactor(factors, 20);
        if (factorMentions(f20, 'new build', '2020', '2021', '2022', '2023', '2024', '2025', '2026')) {
            earned += 8;
            evidence.push('New construction / very recent build');
        } else if (factorMentions(f20, '2010s', '2015', '2016', '2017', '2018', '2019')) {
            earned += 5;
            evidence.push('Recent construction (2010s)');
        } else if (factorMentions(f20, '2000s')) {
            earned += 3;
            evidence.push('Built in the 2000s');
        } else if (factorMentions(f20, 'mid-century', '80s-90s')) {
            earned += 1;
        } else if (factorMentions(f20, 'pre-war', 'pre war', 'historic')) {
            earned += 0;
            missing.push('Older construction — likely lower energy performance');
        }
        // Disaster Resilience (factor 79): retrofits and resilient materials reduce future maintenance/insurance cost
        const f79 = findFactor(factors, 79);
        if (factorMentions(f79, 'seismic retrofit', 'fire-resistant siding', 'class a roof', 'defensible space', 'hardened')) {
            earned += 2;
            evidence.push('Disaster-resilience retrofits');
        }

        components.push({
            label: 'Construction Era / Build',
            rationale: 'Newer code = better insulation, sealing, and modern systems baseline.',
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
        modelId: 'efficiency_low_maintenance',
        label: 'Efficiency & Low Maintenance',
        description: 'Long-term cost-savers: solar, modern HVAC, efficient envelope, drought-tolerant landscaping.',
        icon: 'fa-leaf',
        color: 'lime',
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
        score >= 85 ? 'Highly efficient, low-overhead home'
        : score >= 70 ? 'Strong efficiency with a few gaps'
        : score >= 55 ? 'Mixed efficiency — some upgrades, some defaults'
        : score >= 40 ? 'Limited efficiency upgrades'
        : 'Predominantly legacy systems — expect higher running costs';

    const parts: string[] = [`${tier} (${grade}, ${score}/100).`];
    if (strongest.length > 0) {
        const ev = strongest.flatMap(c => c.evidence).slice(0, 3).join(', ');
        if (ev) parts.push(`Strengths: ${ev}.`);
    }
    if (weakest.length > 0) {
        const gaps = weakest.flatMap(c => c.missing || []).slice(0, 2).join('; ');
        if (gaps) parts.push(`Gaps: ${gaps}.`);
    }
    return parts.join(' ');
};
