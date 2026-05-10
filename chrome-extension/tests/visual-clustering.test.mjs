// Visual clustering tests.
//
// Validates the algorithm independently of real listing photos (URL fixtures
// aren't committed). Uses synthetic histogram-shaped vectors with known
// cluster structure — including a "same room from a different angle" case
// where small perturbations of one room must stay grouped.
//
// Run: node --test chrome-extension/tests/visual-clustering.test.mjs

import { test } from 'node:test';
import assert from 'node:assert';
import {
  buildHsvHistogram,
  histogramDistance,
  clusterByDistance,
  parseExpectedRoomCounts,
} from '../src/sidepanel/visual-clustering.js';

// Build an L1-normalized histogram with mass concentrated near `peak`,
// optionally perturbed deterministically to simulate camera-angle shifts
// within the same physical room (lighting/exposure changes, slight crop).
function spike(len, peak, perturb = 0) {
  const v = new Array(len).fill(0);
  v[peak] = 1.0;
  if (peak > 0) v[peak - 1] = 0.4;
  if (peak < len - 1) v[peak + 1] = 0.4;
  // Deterministic perturbation: nudge a few non-peak bins by a small
  // fraction. Same input → same output (no Math.random).
  if (perturb > 0) {
    for (let i = 0; i < len; i++) {
      if (Math.abs(i - peak) > 1) v[i] += perturb * (((i * 7 + peak * 13) % 5) / 5);
    }
  }
  const sum = v.reduce((a, b) => a + b, 0);
  return v.map(x => x / sum);
}

test('clusterByDistance: k=1 puts everything in one cluster', () => {
  const items = [spike(20, 3), spike(20, 10), spike(20, 17)];
  const labels = clusterByDistance(items, 1, histogramDistance);
  assert.deepEqual(labels, [0, 0, 0]);
});

test('clusterByDistance: k>=n gives each item its own cluster', () => {
  const items = [spike(20, 3), spike(20, 10), spike(20, 17)];
  const labels = clusterByDistance(items, 5, histogramDistance);
  // length = n, all distinct
  assert.equal(new Set(labels).size, 3);
});

test('clusterByDistance: separates 4 distinct color peaks into k=4', () => {
  // 4 "rooms", each peaked at a clearly distinct hue bin.
  const items = [spike(32, 2), spike(32, 10), spike(32, 18), spike(32, 26)];
  const labels = clusterByDistance(items, 4, histogramDistance);
  assert.equal(new Set(labels).size, 4);
});

test('clusterByDistance: 3 perturbed shots of same room stay together', () => {
  // Three "photos" of the same room — same peak, small deterministic noise.
  const sameRoomA = [spike(32, 5, 0.0), spike(32, 5, 0.05), spike(32, 5, 0.1)];
  // A second room, peaked far away.
  const sameRoomB = [spike(32, 25, 0.0), spike(32, 25, 0.05), spike(32, 25, 0.1)];
  const items = [...sameRoomA, ...sameRoomB];
  const labels = clusterByDistance(items, 2, histogramDistance);

  // Photos 0..2 must share a label; photos 3..5 must share a label; the two
  // labels must differ.
  assert.equal(labels[0], labels[1]);
  assert.equal(labels[1], labels[2]);
  assert.equal(labels[3], labels[4]);
  assert.equal(labels[4], labels[5]);
  assert.notEqual(labels[0], labels[3]);
});

test('clusterByDistance: 4 rooms × 3 perturbed shots, k=4 recovers rooms', () => {
  // The realistic case: 4 bedrooms in a property, 3 photos each at different
  // angles. Expect all 3 shots of each room to cluster together.
  const peaks = [3, 11, 19, 27];
  const items = [];
  const truth = [];
  for (let r = 0; r < peaks.length; r++) {
    for (let s = 0; s < 3; s++) {
      items.push(spike(32, peaks[r], 0.05 * s));
      truth.push(r);
    }
  }
  const labels = clusterByDistance(items, 4, histogramDistance);

  // Algorithm-assigned labels won't match truth labels by index; build a
  // mapping by majority vote per truth-room.
  const truthToCluster = {};
  for (let i = 0; i < items.length; i++) {
    if (truthToCluster[truth[i]] === undefined) truthToCluster[truth[i]] = labels[i];
  }
  const correct = labels.filter((l, i) => l === truthToCluster[truth[i]]).length;
  assert.equal(correct, items.length, `expected all 12 photos to land in their truth cluster, got ${correct}/12`);
});

test('clusterByDistance: empty input returns empty', () => {
  assert.deepEqual(clusterByDistance([], 3, histogramDistance), []);
});

test('clusterByDistance: cluster ids are stable (sorted) across runs', () => {
  const items = [spike(20, 5), spike(20, 15), spike(20, 5, 0.05), spike(20, 15, 0.05)];
  const a = clusterByDistance(items, 2, histogramDistance);
  const b = clusterByDistance(items, 2, histogramDistance);
  assert.deepEqual(a, b);
});

test('histogramDistance: identical histograms have distance 0', () => {
  const a = spike(20, 7);
  assert.ok(histogramDistance(a, a) < 1e-9);
});

test('histogramDistance: distant peaks produce a larger distance than nearby peaks', () => {
  const ref = spike(20, 5);
  const near = spike(20, 6);
  const far = spike(20, 18);
  assert.ok(histogramDistance(ref, far) > histogramDistance(ref, near));
});

test('buildHsvHistogram: solid-color image concentrates mass in one bin', () => {
  // 4×4 solid-red image, RGBA.
  const w = 4, h = 4;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < px.length; i += 4) {
    px[i] = 255;     // R
    px[i + 1] = 0;   // G
    px[i + 2] = 0;   // B
    px[i + 3] = 255; // A
  }
  const hist = buildHsvHistogram(px);
  // Sum should be ~1 (L1-normalized).
  const sum = Array.from(hist).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-5, `expected normalized histogram, got sum=${sum}`);
  // Single non-zero bin (all pixels identical).
  const nonzero = Array.from(hist).filter(x => x > 0).length;
  assert.equal(nonzero, 1);
});

test('buildHsvHistogram: red vs blue solid images cluster apart', () => {
  const w = 8, h = 8;
  const make = (r, g, b) => {
    const px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < px.length; i += 4) {
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
    return buildHsvHistogram(px);
  };
  const red = make(255, 0, 0);
  const blue = make(0, 0, 255);
  const redAlt = make(240, 10, 10); // "same room, slight lighting variance"
  // Same color (red vs slightly off-red) should be MUCH closer than red vs blue.
  const dSame = histogramDistance(red, redAlt);
  const dDiff = histogramDistance(red, blue);
  assert.ok(dDiff > dSame * 5, `expected red↔blue ≫ red↔redAlt, got dSame=${dSame.toFixed(3)} dDiff=${dDiff.toFixed(3)}`);
});

// ── parseExpectedRoomCounts ──────────────────────────────────────────────

test('parseExpectedRoomCounts: handles a typical MLS rooms string', () => {
  const s = '2 Bedrooms, 1 Bath, Main Entry, 4 Bedrooms, 3 Baths, Primary Bedrm Suite - 1, Family Room, Bonus Room, Dining Room, Eat-In Kitchen, Laundry';
  const out = parseExpectedRoomCounts(s);
  // "2 Bedrooms" (main) + "4 Bedrooms" (upper) = 6 total. "Primary Bedrm
  // Suite - 1" is an informational callout — the primary is already in the
  // 4 upstairs, so we deliberately don't add it.
  assert.equal(out.bedrooms, 6);
  // 1 Bath + 3 Baths → 4.
  assert.equal(out.bathrooms, 4);
});

test('parseExpectedRoomCounts: tolerates singular forms and missing counts', () => {
  assert.deepEqual(parseExpectedRoomCounts('1 Bedroom, 1 Bathroom'), { bedrooms: 1, bathrooms: 1 });
  assert.deepEqual(parseExpectedRoomCounts(''), { bedrooms: 0, bathrooms: 0 });
  assert.deepEqual(parseExpectedRoomCounts(null), { bedrooms: 0, bathrooms: 0 });
});

test('parseExpectedRoomCounts: ignores non-bed/bath room types', () => {
  const out = parseExpectedRoomCounts('1 Family Room, 2 Living Rooms, 3 Bedrooms');
  assert.equal(out.bedrooms, 3);
  assert.equal(out.bathrooms, 0);
});
