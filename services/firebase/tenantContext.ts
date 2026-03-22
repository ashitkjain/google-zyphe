/**
 * Tenant Context Utility
 * 
 * Provides the realtorId (tenant ID) for subcollection path construction.
 * In the new multi-tenant schema, CRM data lives under /realtors/{realtorId}/...
 * 
 * The tenant ID is:
 *   - For realtors/admins: their own uid (they ARE the tenant)
 *   - For clients: their associated realtor's uid (stored in profile.realtorId)
 * 
 * This module is set during login and used by all service functions
 * to construct the correct Firestore paths.
 */

import { auth } from './config';

// ── Global Tenant Context ──
// Set during login from the user's profile, used by service functions.
let _tenantId: string | null = null;
let _userRole: string | null = null;

/**
 * Sets the tenant context. Call this during login after fetching the user profile.
 * 
 * @param tenantId - The realtor UID that owns this user's data
 * @param role - The user's role (realtor, admin, buyer, seller, etc.)
 */
export const setTenantContext = (tenantId: string, role: string) => {
    _tenantId = tenantId;
    _userRole = role;
    console.log(`[Tenant] Context set: tenantId=${tenantId}, role=${role}`);
};

/**
 * Clears the tenant context. Call this on logout.
 */
export const clearTenantContext = () => {
    _tenantId = null;
    _userRole = null;
    console.log('[Tenant] Context cleared');
};

/**
 * Gets the current tenant ID (realtor UID).
 * Falls back to auth.currentUser.uid for realtors/admins.
 * Returns null if no tenant context is available.
 */
export const getTenantId = (): string | null => {
    if (_tenantId) return _tenantId;
    
    // Fallback: if no explicit tenant set, use current user's UID
    // This works correctly when the logged-in user IS the realtor
    const uid = auth?.currentUser?.uid;
    if (uid) return uid;
    
    return null;
};

/**
 * Gets the tenant ID or throws. Use this in service functions
 * that REQUIRE a tenant context to construct paths.
 */
export const requireTenantId = (explicitId?: string): string => {
    const tid = explicitId || getTenantId();
    if (!tid) {
        throw new Error('[Tenant] No tenant context available. User must be logged in.');
    }
    return tid;
};

/**
 * Helper: constructs a Firestore path under the realtor's subcollection.
 * 
 * Example: tenantPath('leads') → 'realtors/{realtorId}/leads'
 */
export const tenantPath = (subcollection: string, explicitRealtorId?: string): string => {
    const rid = requireTenantId(explicitRealtorId);
    return `realtors/${rid}/${subcollection}`;
};

/**
 * Gets the user's role from the tenant context.
 */
export const getTenantRole = (): string | null => _userRole;
