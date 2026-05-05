/**
 * Shared utility helpers for API service modules.
 * These are internal — not exported from the public index.
 */

export const extractNumericValue = (val: any): number | null => {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const cleaned = val.replace(/[^0-9.-]/g, '');
        if (cleaned === '') return null;
        const numeric = Number(cleaned);
        return isNaN(numeric) ? null : numeric;
    }
    if (val && typeof val === 'object' && 'value' in val) {
        const cleaned = String(val.value).replace(/[^0-9.-]/g, '');
        if (cleaned === '') return null;
        const numeric = Number(cleaned);
        return isNaN(numeric) ? null : numeric;
    }
    return null;
};

export const safeStringify = (val: any): string | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'object') {
            return JSON.stringify(val);
        }
        return val.map(item => (typeof item === 'object' ? JSON.stringify(item) : item)).join(', ');
    }
    if (typeof val === 'object') {
        if ('label' in val) return String(val.label);
        if ('text' in val) return String(val.text);
        return JSON.stringify(val);
    }
    return String(val);
};

/**
 * Centralized formatting logic for property addresses.
 * Reconciles different schemas from Radar, Zillow, RESO, and manual search feeds.
 */
export const formatAddress = (addr: any): string => {
    if (typeof addr === 'string') {
        // If it's a numeric ID (ZPID), it's not a valid display address string
        if (/^\d+$/.test(addr)) return '';
        return addr;
    }

    if (addr && typeof addr === 'object') {
        const {
            streetAddress, line,
            city,
            state, state_code, stateCode,
            zipcode, zipCode, postal_code
        } = addr;

        const street = streetAddress || line || '';
        const resolvedCity = city || '';
        const resolvedState = state || state_code || stateCode || '';
        const resolvedZip = zipcode || zipCode || postal_code || '';

        // If street is actually just a numeric ZPID, clear it
        if (/^\d+$/.test(street)) return '';

        // DEDUPLICATION GUARD: 
        // If the street field already contains city/state/zip info
        // just return it as-is to avoid duplication.
        if (street) {
            const sLower = street.toLowerCase();
            const hasCity = resolvedCity && sLower.includes(resolvedCity.toLowerCase());
            const hasState = resolvedState && sLower.includes(resolvedState.toLowerCase());
            const hasZip = resolvedZip && sLower.includes(resolvedZip.toString().toLowerCase());
            
            // If it has at least city and state, or city and zip, it's likely a full address
            if ((hasCity && hasState) || (hasCity && hasZip)) {
                return street;
            }
        }

        const parts = [street, resolvedCity].filter(Boolean);
        let base = parts.join(', ');

        if (resolvedState) {
            // Check if state is already at the end of base
            const statePattern = new RegExp(`,\\s*${resolvedState}\\s*$`, 'i');
            if (!statePattern.test(base)) {
                base += (base ? ', ' : '') + resolvedState;
            }
            
            if (resolvedZip) {
                const zipPattern = new RegExp(`\\s${resolvedZip}$`, 'i');
                if (!zipPattern.test(base)) {
                    base += ' ' + resolvedZip;
                }
            }
        } else if (resolvedZip) {
            const zipPattern = new RegExp(`,\\s*${resolvedZip}$`, 'i');
            if (!zipPattern.test(base)) {
                base += (base ? ', ' : '') + resolvedZip;
            }
        }

        // Final cleanup: fix double commas and trim
        return base.replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();
    }
    return '';
};
