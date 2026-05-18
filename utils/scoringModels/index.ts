/**
 * Scoring Models — Registry
 *
 * Each model is a pure function over Context Graph factors + taxonomy signals.
 * Add new models here; the UI iterates over the registry.
 */

import type { ScoringModel } from './types';
import { scoreModernAesthetics } from './modernAesthetics';
import { scoreSmartHomeInfrastructure } from './smartHome';
import { scoreCurbAppealLandscaping } from './curbAppeal';
import { scoreFunctionalSpaces } from './functionalSpaces';
import { scoreEfficiencyLowMaintenance } from './efficiency';
import { scoreOutdoorLiving } from './outdoorLiving';
import { scoreViewsAndLight } from './viewsAndLight';
import { scoreClimateResilience } from './climateResilience';
import { scoreLifestyleCommunity } from './lifestyleCommunity';

export const SCORING_MODELS: ScoringModel[] = [
    // Home feature heuristics (mirror the 6 taxonomy zones in spirit)
    scoreModernAesthetics,
    scoreOutdoorLiving,
    scoreViewsAndLight,
    scoreFunctionalSpaces,
    // Property infrastructure heuristics
    scoreSmartHomeInfrastructure,
    scoreCurbAppealLandscaping,
    scoreEfficiencyLowMaintenance,
    // Site / community heuristics
    scoreClimateResilience,
    scoreLifestyleCommunity,
];

export type { ScoringResult, ScoreComponent } from './types';
export {
    scoreModernAesthetics,
    scoreSmartHomeInfrastructure,
    scoreCurbAppealLandscaping,
    scoreFunctionalSpaces,
    scoreEfficiencyLowMaintenance,
    scoreOutdoorLiving,
    scoreViewsAndLight,
    scoreClimateResilience,
    scoreLifestyleCommunity,
};
