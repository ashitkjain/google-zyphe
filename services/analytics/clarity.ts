/**
 * Microsoft Clarity Analytics Service
 * Project ID: vj30ntkkl1
 */

export const initClarity = (projectId: string = 'vj30ntkkl1') => {
    if (typeof window === 'undefined') return;

    (function (c, l, a, r, i, t, y) {
        // @ts-ignore
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) };
        t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
        y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", projectId);
};

/**
 * Log a custom event to Microsoft Clarity
 * @param name Event name
 */
export const trackClarityEvent = (name: string) => {
    if (typeof window !== 'undefined' && (window as any).clarity) {
        (window as any).clarity("event", name);
    }
};

/**
 * Identify user in Microsoft Clarity
 * @param userId Unique user ID
 */
export const identifyUser = (userId: string) => {
    if (typeof window !== 'undefined' && (window as any).clarity) {
        (window as any).clarity("identify", userId);
    }
};
