/**
 * Scoring Model — Modern Aesthetics
 *
 * Captures the "eye candy" factor: quartz countertops, stainless appliances,
 * updated flooring, contemporary architecture, and an open, light-filled feel.
 * High scores indicate a property a buyer can move into without an immediate
 * trip to the hardware store.
 *
 * Weighting (max 100):
 *   - Architectural Style ......... 18
 *   - Kitchen Surfaces & Cabinetry  20
 *   - Kitchen Appliances .......... 14
 *   - Bathroom Finishes ........... 14
 *   - Interior Flow & Volume ...... 10
 *   - Flooring .................... 10
 *   - Move-In Readiness ........... 10
 *   - Natural Light & Smart Tech ... 4
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

export const scoreModernAesthetics: ScoringModel = (factors, signals) => {
    const components: ScoreComponent[] = [];

    // ── 1. Architectural Style (max 18) ──────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'modern')) {
            earned += 18;
            evidence.push('Modern architectural style');
        } else if (hasSignal(signals, 'historical_charm') || hasSignal(signals, 'victorian') || hasSignal(signals, 'edwardian')) {
            // Historical styles can be modernized inside; partial credit later via finishes
            earned += 4;
            evidence.push('Historical style (inside may still be modernized)');
        } else {
            // Look in factor 23 (Architecture) and 41 (Exterior Style) for modern signals
            const f23 = findFactor(factors, 23);
            const f41 = findFactor(factors, 41);
            const modernHits = [...factorTagsMatching(f23, 'modern', 'contemporary', 'minimalist'),
                                ...factorTagsMatching(f41, 'modern', 'contemporary', 'flat roof', 'cedar siding')];
            if (modernHits.length > 0) {
                earned += 12;
                evidence.push(...modernHits.slice(0, 3));
            } else {
                missing.push('No modern/contemporary architecture signals');
            }
        }

        components.push({
            label: 'Architectural Style',
            rationale: 'Contemporary or modernist exterior signals "this home is current."',
            earned: clamp(earned, 18),
            max: 18,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 2. Kitchen Surfaces & Cabinetry (max 20) ─────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'quartz_surfaces')) {
            earned += 8;
            evidence.push('Quartz surfaces');
        }
        if (hasSignal(signals, 'natural_stone_surfaces')) {
            earned += 8;
            evidence.push('Natural stone (marble/quartzite) counters');
        }
        if (hasSignal(signals, 'waterfall_island')) {
            earned += 4;
            evidence.push('Waterfall island');
        }
        if (hasSignal(signals, 'white_cabinetry')) {
            earned += 3;
            evidence.push('White / shaker cabinetry');
        }
        if (earned === 0) {
            // Fallback: factor 26 (Kitchen) free-text mentions
            const f26 = findFactor(factors, 26);
            const counterHits = factorTagsMatching(f26, 'quartz', 'granite', 'marble', 'stone counter');
            if (counterHits.length > 0) {
                earned += 6;
                evidence.push(...counterHits.slice(0, 2));
            }
            const cabinetHits = factorTagsMatching(f26, 'white cabinet', 'updated cabinet', 'modern cabinet', 'shaker');
            if (cabinetHits.length > 0) {
                earned += 3;
                evidence.push(...cabinetHits.slice(0, 1));
            }
            if (earned === 0) missing.push('No premium counter or cabinetry signals');
        } else if (!hasSignal(signals, 'quartz_surfaces') && !hasSignal(signals, 'natural_stone_surfaces')) {
            missing.push('Quartz or stone countertops not detected');
        }

        components.push({
            label: 'Kitchen Surfaces & Cabinetry',
            rationale: 'Quartz/stone counters and contemporary cabinetry are the #1 "eye candy" feature.',
            earned: clamp(earned, 20),
            max: 20,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 3. Kitchen Appliances (max 14) ───────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        // Primary: detected premium-brand signal (matches any top brand or "professional grade"-style phrasing)
        if (hasSignal(signals, 'premium_appliances')) {
            earned += 8;
            // Surface the specific evidence so the user sees WHICH brand triggered the signal
            const sig = signals['premium_appliances'];
            const brandHint = sig.evidence.slice(0, 1).join(' · ');
            evidence.push(brandHint ? `Premium appliance brand (${brandHint})` : 'Premium appliance brand');
        }

        // Bonus: specific high-end appliance categories beyond the main range/fridge
        const bonusTags = [
            { id: 'induction_cooktop',      pts: 2, label: 'Induction cooktop' },
            { id: 'steam_oven',             pts: 2, label: 'Steam oven' },
            { id: 'built_in_coffee',        pts: 1, label: 'Built-in coffee system' },
            { id: 'integrated_wine_fridge', pts: 1, label: 'Integrated wine fridge' },
            { id: 'premium_kitchen_fixtures', pts: 1, label: 'Premium kitchen fixtures' },
        ];
        for (const a of bonusTags) {
            if (hasSignal(signals, a.id)) {
                earned += a.pts;
                evidence.push(a.label);
            }
        }

        // Fallback: stainless steel mentioned in agent highlights or factor 26 free text
        if (earned === 0) {
            const f26 = findFactor(factors, 26);
            const f100 = findFactor(factors, 100);
            if (factorMentions(f26, 'stainless', 'high-end appliance', "chef's kitchen") ||
                factorMentions(f100, 'stainless', 'professional appliance', 'updated appliances')) {
                earned += 5;
                evidence.push('Stainless / high-end appliances mentioned');
            } else {
                missing.push('No premium appliance brand or upgrade signal');
            }
        }

        components.push({
            label: 'Kitchen Appliances',
            rationale: 'Premium appliance brands (any top maker) signal a turn-key kitchen, not a future remodel.',
            earned: clamp(earned, 14),
            max: 14,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 4. Bathroom Finishes (max 14) ────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'natural_stone_bath') || hasSignal(signals, 'designer_tile')) {
            earned += 6;
            if (hasSignal(signals, 'natural_stone_bath')) evidence.push('Natural stone bathroom finishes');
            if (hasSignal(signals, 'designer_tile')) evidence.push('Designer tile');
        }
        const fixtureTags = [
            { id: 'rain_shower',     pts: 2, label: 'Rain shower' },
            { id: 'steam_shower',    pts: 2, label: 'Steam shower' },
            { id: 'heated_floors',   pts: 2, label: 'Heated bathroom floors' },
            { id: 'dual_vanities',   pts: 1, label: 'Dual vanities' },
            { id: 'backlit_mirrors', pts: 1, label: 'Backlit / LED mirrors' },
            { id: 'premium_bath_fixtures', pts: 1, label: 'Premium bath fixtures' },
            { id: 'soaking_tub',     pts: 1, label: 'Freestanding soaking tub' },
            { id: 'towel_warmers',   pts: 1, label: 'Towel warmers' },
            { id: 'makeup_station',  pts: 1, label: 'Makeup station' },
            { id: 'led_vanity_lighting', pts: 1, label: 'LED vanity lighting' },
            { id: 'jewelry_storage', pts: 1, label: 'Jewelry storage' },
        ];
        for (const f of fixtureTags) {
            if (hasSignal(signals, f.id)) {
                earned += f.pts;
                evidence.push(f.label);
            }
        }
        if (earned === 0) {
            const f27 = findFactor(factors, 27);
            const modernBathHits = factorTagsMatching(f27, 'updated bath', 'remodeled bath', 'modern bath', 'spa bath', 'tile shower');
            if (modernBathHits.length > 0) {
                earned += 5;
                evidence.push(...modernBathHits.slice(0, 2));
            } else {
                missing.push('Bathroom finishes appear dated or undocumented');
            }
        }

        components.push({
            label: 'Bathroom Finishes',
            rationale: 'Stone, designer tile, and rainfall fixtures elevate daily routines.',
            earned: clamp(earned, 14),
            max: 14,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 5. Interior Flow & Volume (max 10) ───────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'open_concept')) { earned += 4; evidence.push('Open-concept layout'); }
        if (hasSignal(signals, 'vaulted_ceilings')) { earned += 3; evidence.push('Vaulted / cathedral ceilings'); }
        if (hasSignal(signals, 'floor_to_ceiling_windows')) { earned += 3; evidence.push('Floor-to-ceiling windows'); }
        if (hasSignal(signals, 'retractable_glass_walls')) { earned += 2; evidence.push('Retractable glass walls'); }

        if (earned === 0) {
            const f25 = findFactor(factors, 25);
            const f29 = findFactor(factors, 29);
            if (factorMentions(f25, 'open', 'great room')) { earned += 4; evidence.push('Open layout mentioned'); }
            if (factorMentions(f29, 'high', 'vaulted', 'soaring')) { earned += 3; evidence.push('High ceilings mentioned'); }
            if (earned === 0) missing.push('Layout reads as compartmentalized / standard');
        }

        components.push({
            label: 'Interior Flow & Volume',
            rationale: 'Open layouts, high ceilings, and walls of glass create the "modern" feeling.',
            earned: clamp(earned, 10),
            max: 10,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 6. Flooring (max 10) ─────────────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const f28 = findFactor(factors, 28);
        const hardwoodHits = factorTagsMatching(f28, 'hardwood', 'wide plank', 'engineered wood', 'oak floor');
        const lvpHits = factorTagsMatching(f28, 'lvp', 'luxury vinyl', 'vinyl plank');
        const tileHits = factorTagsMatching(f28, 'porcelain', 'large format tile', 'designer tile');
        const carpetHits = factorTagsMatching(f28, 'carpet');

        if (hardwoodHits.length > 0) { earned += 8; evidence.push('Hardwood / wide-plank flooring'); }
        else if (lvpHits.length > 0) { earned += 6; evidence.push('Luxury vinyl plank (LVP)'); }
        else if (tileHits.length > 0) { earned += 5; evidence.push('Large-format / porcelain tile'); }

        if (carpetHits.length > 0 && hardwoodHits.length === 0 && lvpHits.length === 0) {
            earned = Math.max(0, earned - 3);
            missing.push('Carpet-heavy flooring reads as dated');
        }

        // Bonus: heated floors mentioned (signal of upgrade)
        if (hasSignal(signals, 'heated_floors')) { earned += 2; evidence.push('Heated floors'); }

        if (earned === 0) missing.push('Flooring material not specified');

        components.push({
            label: 'Flooring',
            rationale: 'Hardwood and large-format tile signal updated, contemporary surfaces.',
            earned: clamp(earned, 10),
            max: 10,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 7. Move-In Readiness (max 10) ────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const f21 = findFactor(factors, 21);
        const f22 = findFactor(factors, 22);

        // Factor 21 value is canonically "Move in ready" or "Not move in ready"
        if (factorMentions(f21, 'move in ready', 'turn-key', 'turnkey', 'recently renovated', 'updated throughout')) {
            earned += 10;
            evidence.push('Move-in ready / turn-key');
        } else if (factorMentions(f21, 'well-maintained', 'cosmetic updates', 'minor updates')) {
            earned += 6;
            evidence.push('Well-maintained, cosmetic updates only');
        } else if (factorMentions(f21, 'needs work', 'fixer', 'tlc')) {
            earned += 0;
            missing.push('Needs work / fixer-upper');
        } else {
            earned += 4;
        }

        // Penalty if Renovation Upside flags major work needed
        if (factorMentions(f22, 'needs significant', 'gut renovation', 'major rehab')) {
            earned = Math.max(0, earned - 4);
            missing.push('Significant renovation required');
        }

        components.push({
            label: 'Move-In Readiness',
            rationale: 'The whole point: can a buyer move in without picking up a hammer?',
            earned: clamp(earned, 10),
            max: 10,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 8. Natural Light & Smart Tech (max 4) ────────────────────────────────
    {
        const evidence: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'natural_light')) { earned += 1; evidence.push('Abundant natural light'); }
        if (hasSignal(signals, 'kitchen_skylights')) { earned += 1; evidence.push('Skylights'); }
        if (hasSignal(signals, 'statement_fireplace')) { earned += 1; evidence.push('Statement fireplace'); }
        if (hasSignal(signals, 'smart_home')) { earned += 1; evidence.push('Smart home integration'); }
        if (hasSignal(signals, 'built_in_audio')) { earned += 1; evidence.push('Built-in audio'); }
        if (hasSignal(signals, 'morning_bar')) { earned += 1; evidence.push('Morning bar'); }
        if (earned === 0) {
            const f24 = findFactor(factors, 24);
            if (factorMentions(f24, 'south-facing', 'sun-drenched', 'bright', 'skylight')) {
                earned += 2;
                evidence.push('Bright / south-facing exposure');
            }
        }

        components.push({
            label: 'Natural Light & Smart Tech',
            rationale: 'Light, fireplace presence, and integrated tech round out the contemporary feel.',
            earned: clamp(earned, 4),
            max: 4,
            evidence,
        });
    }

    // ── Calibration: pull additional evidence from luxury-finish and room-character factors ──
    // These are read-only enhancements; they boost evidence in components that already exist.
    {
        const f67  = findFactor(factors, 67);   // Luxury Finishes
        const f113 = findFactor(factors, 113);  // Room-by-Room Character
        const f114 = findFactor(factors, 114);  // Interior Vibe
        const f115 = findFactor(factors, 115);  // Materials

        // Luxury / room-character mentions reinforce the Kitchen Surfaces and Bathroom Finishes components.
        const luxuryRoomEvidence: string[] = [
            ...factorTagsMatching(f67, 'crown molding', 'wide plank', 'designer fixture', 'high-end', 'custom millwork'),
            ...factorTagsMatching(f113, 'waterfall', 'spa-style', 'professional appliance', 'premium appliance', 'designer'),
            ...factorTagsMatching(f115, 'marble', 'quartzite', 'porcelain', 'designer tile'),
        ].slice(0, 3);

        if (luxuryRoomEvidence.length > 0) {
            // Append to whichever component has the most headroom
            const target = components
                .filter(c => c.earned < c.max)
                .sort((a, b) => (b.max - b.earned) - (a.max - a.earned))[0];
            if (target) {
                const bonus = Math.min(target.max - target.earned, luxuryRoomEvidence.length);
                target.earned += bonus;
                target.evidence.push(...luxuryRoomEvidence.slice(0, bonus));
            }
        }

        // Interior Vibe value can confirm or downgrade the move-in component.
        if (factorMentions(f114, 'turn-key', 'recently updated', 'cohesive design', 'modern finishes')) {
            const moveIn = components.find(c => c.label === 'Move-In Readiness');
            if (moveIn && moveIn.earned < moveIn.max) {
                moveIn.earned = Math.min(moveIn.max, moveIn.earned + 2);
                moveIn.evidence.push('Interior Vibe: cohesive / recently updated');
            }
        } else if (factorMentions(f114, 'dated', 'original finishes', 'mixed quality')) {
            const moveIn = components.find(c => c.label === 'Move-In Readiness');
            if (moveIn) {
                moveIn.earned = Math.max(0, moveIn.earned - 2);
                (moveIn.missing ??= []).push('Interior Vibe: dated / mixed quality');
            }
        }
    }

    // ── Aggregate ────────────────────────────────────────────────────────────
    const totalEarned = components.reduce((sum, c) => sum + c.earned, 0);
    const totalMax = components.reduce((sum, c) => sum + c.max, 0); // 100
    const score = Math.round((totalEarned / totalMax) * 100);
    const grade = scoreToGrade(score);
    const confidence = computeConfidence(components);

    // Build summary
    const summary = buildSummary(score, grade, components);

    return {
        modelId: 'modern_aesthetics',
        label: 'Modern Aesthetics',
        description: 'Eye-candy factor: quartz counters, stainless appliances, updated flooring, and turn-key feel.',
        icon: 'fa-sparkles',
        color: 'fuchsia',
        score,
        grade,
        confidence,
        components,
        summary,
    };
};

// ─── Summary generation ──────────────────────────────────────────────────────

const buildSummary = (score: number, grade: string, components: ScoreComponent[]): string => {
    const strongest = [...components]
        .filter(c => c.earned / c.max >= 0.7 && c.evidence.length > 0)
        .sort((a, b) => (b.earned / b.max) - (a.earned / a.max))
        .slice(0, 2);

    const weakest = [...components]
        .filter(c => c.earned / c.max < 0.3)
        .sort((a, b) => (a.earned / a.max) - (b.earned / b.max))
        .slice(0, 2);

    const tier =
        score >= 85 ? 'Strong modern aesthetic'
        : score >= 70 ? 'Solid contemporary feel'
        : score >= 55 ? 'Mixed — some updated, some dated'
        : score >= 40 ? 'Predominantly traditional / dated'
        : 'Significant aesthetic upgrades required';

    const parts: string[] = [`${tier} (${grade}, ${score}/100).`];

    if (strongest.length > 0) {
        const strongEvidence = strongest.flatMap(c => c.evidence).slice(0, 3).join(', ');
        if (strongEvidence) parts.push(`Standout features: ${strongEvidence}.`);
    }

    if (weakest.length > 0) {
        const gaps = weakest.flatMap(c => c.missing || []).slice(0, 2).join('; ');
        if (gaps) parts.push(`Gaps: ${gaps}.`);
    }

    return parts.join(' ');
};
