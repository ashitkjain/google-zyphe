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

export const SCORING_MODELS: ScoringModel[] = [
    scoreModernAesthetics,
    scoreSmartHomeInfrastructure,
    scoreCurbAppealLandscaping,
    scoreFunctionalSpaces,
    scoreEfficiencyLowMaintenance,
];

export type { ScoringResult, ScoreComponent } from './types';
export {
    scoreModernAesthetics,
    scoreSmartHomeInfrastructure,
    scoreCurbAppealLandscaping,
    scoreFunctionalSpaces,
    scoreEfficiencyLowMaintenance,
};
