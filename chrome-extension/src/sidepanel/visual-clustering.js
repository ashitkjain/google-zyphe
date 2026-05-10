// Angle-invariant visual similarity + constrained clustering.
//
// Used to subdivide repeatable space labels (Bedroom, Bathroom) into separate
// rooms when MLS metadata gives us an expected count. The threshold-based
// hash approach (dHash/pHash) was too brittle — small camera-angle shifts
// within the same room produced large hamming distances, splitting one room
// across multiple clusters. Constrained clustering with k from MLS sidesteps
// the threshold problem: even a noisy similarity signal works because the
// algorithm only has to decide "which two are closest right now", never
// "is this far enough to split".

// HSV color histogram from RGBA pixel data. Returns an L1-normalized vector
// of length bins.h * bins.s * bins.v. Wall paint, flooring, and bedding
// dominate the signal — these survive angle shifts within a room and differ
// across rooms with different decor.
export function buildHsvHistogram(rgba, bins = { h: 8, s: 4, v: 4 }) {
  const total = bins.h * bins.s * bins.v;
  const hist = new Float32Array(total);
  let sum = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i] / 255;
    const g = rgba[i + 1] / 255;
    const b = rgba[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const v = max;
    const s = max === 0 ? 0 : (max - min) / max;
    let h = 0;
    if (max !== min) {
      if (max === r) h = ((g - b) / (max - min)) % 6;
      else if (max === g) h = ((b - r) / (max - min)) + 2;
      else h = ((r - g) / (max - min)) + 4;
      h = (h * 60 + 360) % 360;
    }
    const hb = Math.min(bins.h - 1, Math.floor(h / (360 / bins.h)));
    const sb = Math.min(bins.s - 1, Math.floor(s * bins.s));
    const vb = Math.min(bins.v - 1, Math.floor(v * bins.v));
    hist[hb * bins.s * bins.v + sb * bins.v + vb] += 1;
    sum += 1;
  }
  if (sum > 0) for (let i = 0; i < total; i++) hist[i] /= sum;
  return hist;
}

// Chi-squared distance between two L1-normalized histograms. Standard
// histogram comparison metric; emphasizes bins where the two diverge.
export function histogramDistance(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    const num = a[i] - b[i];
    const den = a[i] + b[i];
    if (den > 0) d += (num * num) / den;
  }
  return d * 0.5;
}

// Agglomerative clustering with average-linkage, terminating at exactly k
// clusters. Returns an array of cluster ids (0..k-1), one per input.
//
// Why average-linkage: single-linkage produces "chains" (one outlier shot
// pulls a cluster in), complete-linkage is conservative and over-splits.
// Average is the standard middle ground for histogram-style data.
export function clusterByDistance(items, k, distFn) {
  const n = items.length;
  if (n === 0) return [];
  if (k <= 1) return new Array(n).fill(0);
  if (k >= n) return items.map((_, i) => i);

  // Precompute the n×n pairwise distance matrix once.
  const dist = Array.from({ length: n }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = distFn(items[i], items[j]);
      dist[i][j] = d;
      dist[j][i] = d;
    }
  }

  // Each cluster carries the list of original-index members that belong to it.
  const members = items.map((_, i) => [i]);
  const active = new Set(items.map((_, i) => i));

  const linkage = (a, b) => {
    let sum = 0;
    let count = 0;
    for (const x of members[a]) {
      for (const y of members[b]) {
        sum += dist[x][y];
        count++;
      }
    }
    return sum / count;
  };

  while (active.size > k) {
    let bestI = -1;
    let bestJ = -1;
    let bestD = Infinity;
    const arr = [...active];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const d = linkage(arr[i], arr[j]);
        if (d < bestD) {
          bestD = d;
          bestI = arr[i];
          bestJ = arr[j];
        }
      }
    }
    if (bestI === -1) break;
    members[bestI].push(...members[bestJ]);
    members[bestJ] = [];
    active.delete(bestJ);
  }

  const labels = new Array(n);
  let nextLabel = 0;
  // Sort active cluster ids so cluster numbering is stable across runs
  // (the iteration order of a Set is insertion order, which after merges
  // depends on which side won).
  const ordered = [...active].sort((a, b) => a - b);
  for (const id of ordered) {
    for (const m of members[id]) labels[m] = nextLabel;
    nextLabel++;
  }
  return labels;
}

// Parse expected room counts out of an MLS-style "rooms" string. The field
// is messy and varies by listing; the regex pulls leading-integer + label
// tokens. Returns { bedrooms, bathrooms } as integers, summing duplicates
// (some MLS strings list bedrooms per floor — "2 Bedrooms ... 4 Bedrooms").
export function parseExpectedRoomCounts(roomsString) {
  if (!roomsString || typeof roomsString !== 'string') {
    return { bedrooms: 0, bathrooms: 0 };
  }
  let bedrooms = 0;
  let bathrooms = 0;
  // Split on commas to bound each "N <thing>" phrase, then match a leading int.
  for (const phrase of roomsString.split(/[,;]/)) {
    const m = phrase.trim().match(/^(\d+)\s+([A-Za-z][A-Za-z\s-]*)/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    const tag = m[2].toLowerCase();
    if (/\bbed(room)?s?\b|\bbedrm\b/.test(tag)) bedrooms += n;
    else if (/\bbath(room)?s?\b/.test(tag)) bathrooms += n;
  }
  return { bedrooms, bathrooms };
}
