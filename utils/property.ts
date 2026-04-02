/**
 * Property-related utility functions
 */

/**
 * Calculates current Days on Market (DOM) from a listing date.
 * If listedDate is missing, falls back to a static day count (e.g. daysOnZillow).
 * 
 * @param listedDate The date the property was listed (ISO string, timestamp, or Date object)
 * @param fallbackStaticDom A pre-calculated day count to use if listedDate is missing
 * @returns The number of days elapsed since the property was listed
 */
export function getDaysOnMarket(listedDate?: string | number | null, fallbackStaticDom?: number | null): number | null {
  if (listedDate == null || listedDate === 0) return fallbackStaticDom ?? null;

  let listed: Date | null = null;
  if (typeof listedDate === 'string') {
    const parsed = new Date(listedDate);
    if (!isNaN(parsed.getTime())) listed = parsed;
  } else if (typeof listedDate === 'number') {
    // Handle seconds vs milliseconds
    listed = new Date(listedDate > 1e10 ? listedDate : listedDate * 1000);
    if (isNaN(listed.getTime())) listed = null;
  } else if (listedDate instanceof Date) {
    listed = listedDate;
  }

  if (!listed) return fallbackStaticDom ?? null;

  const diffMs = Date.now() - listed.getTime();
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  return days;
}
