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

        // GUARD: If the street field already contains city/state/zip info
        // (common in Zillow responses), just return it as-is to avoid duplication
        // like "4152 Kevin St, Dublin, CA 94568, dublin, California, 94568"
        if (street && resolvedCity) {
            const streetLower = street.toLowerCase();
            if (streetLower.includes(resolvedCity.toLowerCase())) {
                return street;
            }
        }

        const parts = [street, resolvedCity].filter(Boolean);
        let base = parts.join(', ');

        if (resolvedState) {
            base += (base ? ', ' : '') + resolvedState;
            if (resolvedZip) {
                base += ' ' + resolvedZip;
            }
        } else if (resolvedZip) {
            base += (base ? ', ' : '') + resolvedZip;
        }

        return base.replace(/,\s*,/g, ',').trim();
    }
    return '';
};
