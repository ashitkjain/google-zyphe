import { useEffect, useRef, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebaseService';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Hook that automatically signs out tester users after 15 minutes of inactivity.
 * "Inactivity" means no mouse movement, keyboard input, touch, or scroll events.
 * 
 * @param userRole - The current user's role (only activates for 'tester')
 * @param onSignOut - Optional callback invoked after sign-out (e.g., to clear local state)
 */
export const useInactivitySignout = (
    userRole: string | undefined,
    onSignOut?: () => void
) => {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isActive = userRole === 'tester';

    const performSignOut = useCallback(async () => {
        if (!auth) return;
        try {
            console.log('[InactivitySignout] 15 min inactivity timeout reached. Signing out tester...');
            await signOut(auth);
            onSignOut?.();
        } catch (err) {
            console.error('[InactivitySignout] Sign out failed:', err);
        }
    }, [onSignOut]);

    const resetTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(performSignOut, INACTIVITY_TIMEOUT_MS);
    }, [performSignOut]);

    useEffect(() => {
        if (!isActive) return;

        // Events that constitute "activity"
        const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

        const handleActivity = () => resetTimer();

        // Start the initial timer
        resetTimer();

        // Attach listeners
        activityEvents.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        return () => {
            // Cleanup
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            activityEvents.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [isActive, resetTimer]);
};
