#!/usr/bin/env node
/*
 * Phase 1 Classification Regression Test
 *
 * Runs the production CLASSIFY_PROMPT against MiniCPM-V (via local Ollama) on a
 * known property's photos and compares results to a gold-standard fixture.
 *
 * Requires Node 18+ (built-in fetch).
 *
 * Usage:
 *   1. Capture image URLs (see tests/README.md) and save as
 *      tests/fixtures/<property>.urls.json (an array of strings).
 *   2. Ensure Ollama is running with the minicpm-v model pulled.
 *   3. Run:  node chrome-extension/tests/phase1-classify.test.js
 *
 * Optional env vars:
 *   PROPERTY=4129-grant-ct-pleasanton-ca-94566   (fixture basename)
 *   OLLAMA_URL=http://localhost:11434
 *   MINICPM_MODEL=minicpm-v
 *   CONCURRENCY=6
 *
 * Exits 0 when every photo matches gold, 1 on mismatch, 2 on fatal error.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ───────── Configuration (mirrors production sidepanel.js) ─────────

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.MINICPM_MODEL || 'minicpm-v';
const CONCURRENCY = Number(process.env.CONCURRENCY || 6);
const PROPERTY = process.env.PROPERTY || '4129-grant-ct-pleasanton-ca-94566';
const IMAGE_RESIZE_MAX_DIM = 224;

// Try to load sharp for production-parity image resizing. If missing, fall back
// to sending full-resolution images and warn the user — accuracy is usually
// similar or slightly higher (more tiles), but classification timing won't
// match production.
let sharp = null;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  // sharp not installed — handled at fetch time.
}

// ───────── Keep in sync with sidepanel.js ─────────

const CLASSIFY_PROMPT = `Look at this real estate photo. Reply in this exact format:
Type: [Interior, Exterior, or Community]
Space: [EXACTLY ONE label from this list: Bedroom, Kitchen, Living Room, Dining Room, Bathroom, Office, Laundry Room, Hallway, Staircase, Basement, Front Yard, Backyard, Pool Area, Sports Court, Fitness Center, Clubhouse, Community Park, Floor Plan, Aerial View]

Use "Type: Exterior" and "Space: Aerial View" for any overhead, drone, or bird's-eye shot showing multiple rooftops or streets.`;

const ROOM_VOCABULARY = [
  'Primary Bedroom', 'Bedroom', 'Kitchen', 'Living Room', 'Dining Room',
  'Bathroom', 'Office', 'Laundry Room', 'Hallway', 'Staircase', 'Basement',
  'Front Yard', 'Backyard', 'Pool Area', 'Sports Court', 'Fitness Center',
  'Clubhouse', 'Community Park', 'Floor Plan', 'Aerial View',
];

const VOCABULARY_ALIASES = {
  'garage': 'Front Yard', 'driveway': 'Front Yard', 'curb': 'Front Yard',
  'facade': 'Front Yard', 'exterior': 'Front Yard',
  'patio': 'Backyard', 'deck': 'Backyard', 'porch': 'Backyard',
  'balcony': 'Backyard', 'garden': 'Backyard',
};

function inferSpaceFromText(text) {
  if (!text) return null;
  const haystack = text.toLowerCase();
  let best = null;
  const consider = (label, pattern, vocabRank) => {
    let pos;
    if (pattern instanceof RegExp) {
      const m = haystack.match(pattern);
      if (!m || m.index === undefined) return;
      pos = m.index;
    } else {
      pos = haystack.indexOf(pattern);
      if (pos === -1) return;
    }
    if (best === null || pos < best.pos || (pos === best.pos && vocabRank < best.vocabRank)) {
      best = { pos, vocabRank, label };
    }
  };
  ROOM_VOCABULARY.forEach((label, rank) => consider(label, label.toLowerCase(), rank));
  Object.entries(VOCABULARY_ALIASES).forEach(([alias, label]) => {
    const parentRank = ROOM_VOCABULARY.indexOf(label);
    consider(label, new RegExp(`\\b${alias}\\b`, 'i'), parentRank >= 0 ? parentRank : ROOM_VOCABULARY.length);
  });
  return best ? best.label : null;
}

function parseClassificationResponse(text, idx) {
  if (!text) return { label: `Unclassified ${idx}`, type: 'INTERIOR' };
  let type = 'INTERIOR';
  const typeMatch = text.match(/Type:\s*([^\n]+)/i);
  if (typeMatch) {
    const rawType = typeMatch[1].toLowerCase();
    if (rawType.includes('community')) type = 'COMMUNITY';
    else if (rawType.includes('exterior')) type = 'EXTERIOR';
  }
  const spaceMatch = text.match(/Space:\s*([^\n]+)/i);
  const spaceText = spaceMatch ? spaceMatch[1].trim() : text;
  const label = inferSpaceFromText(spaceText) || `Unclassified ${idx}`;
  if (label === 'Backyard') type = 'BACKYARD';
  if (label === 'Aerial View') type = 'AERIAL';
  return { label, type };
}

// ───────── Image fetch + resize ─────────

async function fetchAndPrepareImage(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching image`);
  const buf = Buffer.from(await resp.arrayBuffer());
  if (!sharp) return buf.toString('base64');
  const resized = await sharp(buf)
    .resize({ width: IMAGE_RESIZE_MAX_DIM, height: IMAGE_RESIZE_MAX_DIM, fit: 'inside' })
    .jpeg({ quality: 80 })
    .toBuffer();
  return resized.toString('base64');
}

// ───────── Single classify call ─────────

async function classify(idx, base64) {
  const resp = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: CLASSIFY_PROMPT, images: [base64] }],
      stream: false,
      options: { temperature: 0, num_predict: 30, num_ctx: 1024, num_gpu: 99 },
    }),
  });
  if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
  const data = await resp.json();
  const raw = (data.message?.content || '').trim();
  return { raw, ...parseClassificationResponse(raw, idx) };
}

// ───────── Main ─────────

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const goldPath = join(here, 'fixtures', `${PROPERTY}.json`);
  const urlsPath = join(here, 'fixtures', `${PROPERTY}.urls.json`);

  const gold = JSON.parse(readFileSync(goldPath, 'utf8'));
  let urls;
  try {
    urls = JSON.parse(readFileSync(urlsPath, 'utf8'));
  } catch {
    console.error(`\nImage URLs not found at:\n   ${urlsPath}\n`);
    console.error('To capture URLs for this property:');
    console.error('  1. Open the property in your browser, open the Zyphe sidepanel, click "Scan page".');
    console.error('  2. In the sidepanel devtools console, run:');
    console.error('       copy(JSON.stringify(extractedImages.map(i => i.url), null, 2))');
    console.error(`  3. Save the clipboard contents to:\n       ${urlsPath}\n`);
    process.exit(2);
  }

  if (!sharp) {
    console.warn('NOTE: sharp not installed — sending full-resolution images.');
    console.warn('      For production-parity (resize to 224px), run: npm install --no-save sharp\n');
  }

  if (urls.length !== gold.photos.length) {
    console.warn(`URL count (${urls.length}) does not match gold count (${gold.photos.length}). ` +
      `Will test min(${Math.min(urls.length, gold.photos.length)}).\n`);
  }

  const total = Math.min(urls.length, gold.photos.length);
  console.log(`\nClassifying ${total} photos for ${gold.property.address}`);
  console.log(`Model: ${MODEL} @ ${OLLAMA_URL}, concurrency=${CONCURRENCY}, resize=${sharp ? IMAGE_RESIZE_MAX_DIM + 'px' : 'OFF'}\n`);

  const results = new Array(total);
  let cursor = 0;
  let done = 0;
  const startMs = Date.now();

  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= total) return;
      try {
        const base64 = await fetchAndPrepareImage(urls[i]);
        const t0 = Date.now();
        results[i] = await classify(i, base64);
        results[i].ms = Date.now() - t0;
      } catch (e) {
        results[i] = { error: e.message };
      }
      done++;
      process.stdout.write(`\r  classified ${done}/${total}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const wallMs = Date.now() - startMs;
  console.log(`\n\nDone in ${(wallMs / 1000).toFixed(1)}s\n`);

  // ───── Compare against gold ─────

  let labelOk = 0;
  let typeOk = 0;
  let bothOk = 0;
  let errors = 0;
  const mismatches = [];

  for (let i = 0; i < total; i++) {
    const r = results[i];
    const g = gold.photos[i];
    if (r.error) {
      errors++;
      mismatches.push({ idx: i, gold: g, error: r.error });
      continue;
    }
    const lOk = r.label === g.label;
    const tOk = r.type === g.type;
    if (lOk) labelOk++;
    if (tOk) typeOk++;
    if (lOk && tOk) bothOk++;
    if (!lOk || !tOk) {
      mismatches.push({
        idx: i,
        gold: { label: g.label, type: g.type },
        got: { label: r.label, type: r.type },
        raw: r.raw,
      });
    }
  }

  const successful = results.filter(r => r && r.ms);
  const avgMs = successful.length
    ? successful.reduce((a, r) => a + r.ms, 0) / successful.length
    : 0;

  console.log('=============== Phase 1 Classification Results ===============\n');
  console.log(`Total photos:     ${total}`);
  console.log(`Errors:           ${errors}`);
  console.log(`Label match:      ${labelOk}/${total} (${(100 * labelOk / total).toFixed(1)}%)`);
  console.log(`Type match:       ${typeOk}/${total} (${(100 * typeOk / total).toFixed(1)}%)`);
  console.log(`Full match:       ${bothOk}/${total} (${(100 * bothOk / total).toFixed(1)}%)`);
  console.log(`Avg latency:      ${avgMs.toFixed(0)} ms / photo`);
  console.log(`Wall clock:       ${(wallMs / 1000).toFixed(1)}s\n`);

  if (mismatches.length > 0) {
    console.log('───── Mismatches ─────\n');
    for (const m of mismatches) {
      if (m.error) {
        console.log(`  photo ${m.idx}  ERROR: ${m.error}`);
      } else {
        console.log(`  photo ${m.idx}  expected (${m.gold.label}, ${m.gold.type})  got (${m.got.label}, ${m.got.type})`);
        console.log(`    raw: ${m.raw.replace(/\n/g, ' / ')}\n`);
      }
    }
  }

  process.exit(bothOk === total ? 0 : 1);
}

main().catch(e => {
  console.error(e);
  process.exit(2);
});
