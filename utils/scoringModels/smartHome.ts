/**
 * Scoring Model — Smart Home Infrastructure
 *
 * Captures pre-wired, integrated home technology: mesh Wi-Fi, smart thermostats,
 * integrated security, automated lighting, EV charging, energy storage. These
 * can be added later, but having them built-in signals "future-proof."
 *
 * Weighting (max 100):
 *   - Whole-Home Automation ........ 25
 *   - Smart Lighting ............... 12
 *   - Climate / HVAC Intelligence .. 15
 *   - Security Infrastructure ...... 15
 *   - EV & Energy Tech ............. 18
 *   - Connectivity (Internet) ...... 10
 *   - Audio / AV ................... 5
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

export const scoreSmartHomeInfrastructure: ScoringModel = (factors, signals) => {
    const components: ScoreComponent[] = [];

    // ── 1. Whole-Home Automation (max 25) ────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'smart_home')) {
            earned += 20;
            const sig = signals['smart_home'];
            evidence.push(`Smart home integration (${sig.evidence.slice(0, 1).join('')})`);
        } else {
            const f100 = findFactor(factors, 100);
            const hits = factorTagsMatching(f100, 'control4', 'crestron', 'lutron', 'home automation', 'smart home', 'savant');
            if (hits.length > 0) {
                earned += 15;
                evidence.push(...hits.slice(0, 2));
            } else {
                missing.push('No whole-home automation system detected');
            }
        }
        // Bonus: any platform-specific mention adds polish
        const f100 = findFactor(factors, 100);
        if (factorMentions(f100, 'apple home', 'homekit', 'alexa', 'google home')) {
            earned += 5;
            evidence.push('Voice assistant integration');
        }

        components.push({
            label: 'Whole-Home Automation',
            rationale: 'Control4, Crestron, Lutron, or similar — a single hub for lighting, audio, climate, and security.',
            earned: clamp(earned, 25),
            max: 25,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 2. Smart Lighting (max 12) ───────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'smart_lighting')) {
            earned += 10;
            evidence.push('Smart / automated lighting');
        }
        if (hasSignal(signals, 'architectural_lighting')) {
            earned += 2;
            evidence.push('Architectural lighting design');
        }
        if (earned === 0) {
            const f100 = findFactor(factors, 100);
            if (factorMentions(f100, 'lutron', 'smart switch', 'dimmer system', 'smart lighting')) {
                earned += 7;
                evidence.push('Smart lighting mentioned in agent highlights');
            } else {
                missing.push('No programmable / smart lighting');
            }
        }

        components.push({
            label: 'Smart Lighting',
            rationale: 'Programmable scenes, dimmer integration — daily-use tech that\'s hard to retrofit.',
            earned: clamp(earned, 12),
            max: 12,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 3. Climate / HVAC Intelligence (max 15) ──────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'climate_control')) {
            earned += 8;
            evidence.push('Smart climate control (Nest / zoned HVAC)');
        }

        const f50 = findFactor(factors, 50);
        if (factorMentions(f50, 'zoned', 'multi-zone', 'dual zone')) {
            earned += 4;
            evidence.push('Zoned HVAC system');
        }
        if (factorMentions(f50, 'heat pump', 'mini-split')) {
            earned += 3;
            evidence.push('Heat pump / mini-split');
        }
        const f100 = findFactor(factors, 100);
        if (factorMentions(f100, 'nest', 'ecobee', 'smart thermostat')) {
            earned += 4;
            evidence.push('Smart thermostat (Nest / Ecobee)');
        }

        if (earned === 0) missing.push('No smart climate or zoned HVAC');

        components.push({
            label: 'Climate / HVAC Intelligence',
            rationale: 'Smart thermostats, zoned HVAC, and heat pumps optimize comfort and energy use.',
            earned: clamp(earned, 15),
            max: 15,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 4. Security Infrastructure (max 15) ──────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'gated_entrance')) {
            earned += 6;
            evidence.push('Gated entrance');
        }

        const f61 = findFactor(factors, 61);
        const cameraHits = factorTagsMatching(f61, 'camera', 'cctv', 'video surveillance', 'doorbell cam', 'ring');
        const alarmHits = factorTagsMatching(f61, 'alarm', 'security system', 'monitored', 'adt', 'simplisafe');
        const accessHits = factorTagsMatching(f61, 'smart lock', 'keyless entry', 'biometric');

        if (cameraHits.length > 0) { earned += 4; evidence.push(...cameraHits.slice(0, 1)); }
        if (alarmHits.length > 0) { earned += 3; evidence.push(...alarmHits.slice(0, 1)); }
        if (accessHits.length > 0) { earned += 3; evidence.push(...accessHits.slice(0, 1)); }

        if (earned === 0) {
            const f100 = findFactor(factors, 100);
            if (factorMentions(f100, 'security system', 'cameras', 'alarm system')) {
                earned += 4;
                evidence.push('Security mentioned in agent highlights');
            } else {
                missing.push('No security system or cameras detected');
            }
        }

        components.push({
            label: 'Security Infrastructure',
            rationale: 'Cameras, alarms, smart locks, and gated access — peace of mind built-in.',
            earned: clamp(earned, 15),
            max: 15,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 5. EV & Energy Tech (max 18) ─────────────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'ev_charging')) {
            earned += 7;
            evidence.push('EV charging installed');
        }
        if (hasSignal(signals, 'solar_panels')) {
            earned += 7;
            evidence.push('Solar (owned)');
        }
        if (hasSignal(signals, 'backup_battery')) {
            earned += 4;
            evidence.push('Backup battery / Powerwall');
        }

        if (earned === 0) {
            const f100 = findFactor(factors, 100);
            if (factorMentions(f100, 'tesla charger', 'ev charger', 'level 2 charger', 'solar panel')) {
                earned += 5;
                evidence.push('Energy/EV mentioned in agent highlights');
            } else {
                missing.push('No solar, battery, or EV charger');
            }
        }

        components.push({
            label: 'EV & Energy Tech',
            rationale: 'Solar + battery + EV charging form the modern energy trifecta.',
            earned: clamp(earned, 18),
            max: 18,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 6. Connectivity / Internet (max 10) ──────────────────────────────────
    {
        const evidence: string[] = [];
        const missing: string[] = [];
        let earned = 0;

        const f76 = findFactor(factors, 76);
        if (factorMentions(f76, 'fiber', 'gigabit', 'gig speed', '1gb', 'symmetric')) {
            earned += 7;
            evidence.push('Fiber / gigabit internet available');
        } else if (factorMentions(f76, 'cable internet', 'broadband', 'high-speed')) {
            earned += 3;
            evidence.push('Standard broadband available');
        }
        if (hasSignal(signals, 'smart_irrigation')) {
            earned += 3;
            evidence.push('Smart irrigation');
        }

        if (earned === 0) missing.push('Internet capability not documented');

        components.push({
            label: 'Connectivity',
            rationale: 'Fiber + mesh-ready wiring matters for WFH and smart-home reliability.',
            earned: clamp(earned, 10),
            max: 10,
            evidence,
            missing: missing.length > 0 ? missing : undefined,
        });
    }

    // ── 7. Audio / AV (max 5) ────────────────────────────────────────────────
    {
        const evidence: string[] = [];
        let earned = 0;

        if (hasSignal(signals, 'built_in_audio')) { earned += 2; evidence.push('Built-in audio / Sonos'); }
        if (hasSignal(signals, 'outdoor_speakers')) { earned += 2; evidence.push('Outdoor speakers'); }
        if (hasSignal(signals, 'outdoor_tv_av')) { earned += 1; evidence.push('Outdoor TV / AV'); }

        components.push({
            label: 'Audio / AV',
            rationale: 'In-ceiling speakers and integrated AV avoid messy retrofits.',
            earned: clamp(earned, 5),
            max: 5,
            evidence,
        });
    }

    // ── Aggregate ────────────────────────────────────────────────────────────
    const totalEarned = components.reduce((sum, c) => sum + c.earned, 0);
    const score = Math.round(totalEarned);
    const grade = scoreToGrade(score);
    const confidence = computeConfidence(components);
    const summary = buildSummary(score, grade, components);

    return {
        modelId: 'smart_home_infrastructure',
        label: 'Smart Home Infrastructure',
        description: 'Future-proof tech: automation, smart climate, security, EV charging, fiber, solar.',
        icon: 'fa-microchip',
        color: 'cyan',
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
        score >= 85 ? 'Highly integrated smart home'
        : score >= 70 ? 'Solid smart-home foundation'
        : score >= 55 ? 'Some smart tech, retrofits needed for full integration'
        : score >= 40 ? 'Minimal smart-home infrastructure'
        : 'No meaningful smart-home tech detected';

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
