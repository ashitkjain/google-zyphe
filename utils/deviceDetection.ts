/**
 * Detects if the current device is mobile or desktop.
 * Uses User-Agent Client Hints where available, falling back to standard navigator.userAgent.
 */
export const getDeviceType = (): 'mobile' | 'desktop' => {
    // 1. Check modern User-Agent Client Hints (Chrome/Edge)
    // @ts-ignore - userAgentData is experimental/modern
    const nav = window.navigator as any;
    if (nav.userAgentData) {
        return nav.userAgentData.mobile ? 'mobile' : 'desktop';
    }

    // 2. Fallback to classic User-Agent string regex
    const ua = navigator.userAgent;
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
        return 'mobile';
    }

    // 3. Fallback: Check for touch capability + small screen
    if (typeof window !== 'undefined' && 'ontouchstart' in window && window.innerWidth < 800) {
        return 'mobile';
    }

    return 'desktop';
};
