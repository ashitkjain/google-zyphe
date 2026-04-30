'use strict';

/** States the platform is currently enabled for. Mirrors frontend config.ts. */
const SUPPORTED_STATES = ['CA'];

/** Maps full state names (case-insensitive) → abbreviation, for SUPPORTED_STATES only. */
const STATE_NAME_MAP = {
    california: 'CA',
};

/**
 * Returns the state abbreviation if recognized, otherwise returns the input as-is.
 * e.g. "California" → "CA", "CA" → "CA", "TX" → "TX"
 */
function normalizeState(state) {
    if (!state) return null;
    const lower = state.trim().toLowerCase();
    return STATE_NAME_MAP[lower] || state.trim().toUpperCase();
}

/** Returns true if the state (abbrev or full name) is in SUPPORTED_STATES. */
function isSupportedState(state) {
    return SUPPORTED_STATES.includes(normalizeState(state));
}

module.exports = { SUPPORTED_STATES, STATE_NAME_MAP, normalizeState, isSupportedState };
