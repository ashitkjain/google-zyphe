/**
 * Scoring Model Types
 *
 * Buyer-facing heuristic scores computed from Context Graph factors +
 * PROPERTY_TAXONOMY signals. Each model is a pure function over the
 * extracted data — no AI calls, deterministic, cheap to recompute.
 */

import type { ExtractedFactor } from '../../constants/contextGraphFactors';
import type { TaxonomySignal } from '../propertyTaxonomy';

/** A single weighted component within a scoring model. */
export interface ScoreComponent {
    /** Short label, e.g. "Kitchen Surfaces". */
    label: string;
    /** What this component captures, in plain English. */
    rationale: string;
    /** Points earned by this property. */
    earned: number;
    /** Maximum possible points. */
    max: number;
    /** Concrete evidence (taxonomy labels, factor tags) that drove the score. */
    evidence: string[];
    /** What's missing that would lift the score (1-3 items max). */
    missing?: string[];
}

/** Overall result returned by a scoring model. */
export interface ScoringResult {
    /** Stable id, e.g. "modern_aesthetics". */
    modelId: string;
    /** Display name, e.g. "Modern Aesthetics". */
    label: string;
    /** Short blurb describing what the model evaluates. */
    description: string;
    /** FontAwesome icon class, e.g. "fa-sparkles". */
    icon: string;
    /** Tailwind color token, e.g. "fuchsia". */
    color: string;
    /** 0-100. */
    score: number;
    /** Letter grade derived from the score. */
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    /** Quality of the inference itself, based on how much evidence was found. */
    confidence: 'low' | 'medium' | 'high';
    /** Per-component breakdown. */
    components: ScoreComponent[];
    /** 1-2 sentence buyer-facing summary. */
    summary: string;
}

/** Signature every scoring model implements. */
export type ScoringModel = (
    factors: ExtractedFactor[],
    signals: Record<string, TaxonomySignal>,
) => ScoringResult;

// ─── Shared helpers ──────────────────────────────────────────────────────────

export const hasSignal = (signals: Record<string, TaxonomySignal>, tagId: string): boolean =>
    !!signals[tagId];

export const findFactor = (factors: ExtractedFactor[], id: number): ExtractedFactor | undefined =>
    factors.find(f => f.id === id);

/** Case-insensitive substring search across a factor's tags + value. */
export const factorMentions = (factor: ExtractedFactor | undefined, ...keywords: string[]): boolean => {
    if (!factor) return false;
    const haystack = [
        factor.value || '',
        ...(factor.tags || []),
    ].join(' ').toLowerCase();
    return keywords.some(k => haystack.includes(k.toLowerCase()));
};

/** Returns the matching tags from a factor that contain any keyword (for evidence collection). */
export const factorTagsMatching = (factor: ExtractedFactor | undefined, ...keywords: string[]): string[] => {
    if (!factor || !Array.isArray(factor.tags)) return [];
    return factor.tags.filter(t =>
        keywords.some(k => t.toLowerCase().includes(k.toLowerCase()))
    );
};

export const scoreToGrade = (score: number): 'A' | 'B' | 'C' | 'D' | 'F' => {
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'F';
};

/** Confidence derived from how many components have meaningful evidence. */
export const computeConfidence = (components: ScoreComponent[]): 'low' | 'medium' | 'high' => {
    const componentsWithEvidence = components.filter(c => c.evidence.length > 0).length;
    if (componentsWithEvidence >= Math.ceil(components.length * 0.6)) return 'high';
    if (componentsWithEvidence >= Math.ceil(components.length * 0.3)) return 'medium';
    return 'low';
};

/** Clamp a value between 0 and max. */
export const clamp = (value: number, max: number): number => Math.max(0, Math.min(max, value));

/** Pulls an "X/10" rating from a factor's value or tags. Returns null if none found. */
export const extractRatingOutOfTen = (factor: ExtractedFactor | undefined): number | null => {
    if (!factor) return null;
    const text = (factor.value || '') + ' ' + (factor.tags || []).join(' ');
    const match = text.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
    if (match) {
        const v = parseFloat(match[1]);
        if (!isNaN(v)) return Math.max(0, Math.min(10, v));
    }
    return null;
};
