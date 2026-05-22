#!/usr/bin/env node
/**
 * Phase 1 Classification Regression Test — Gemini edition
 *
 * Mirrors phase1-classify.test.mjs but calls the Gemini API instead of Ollama.
 * Runs the production CLASSIFY_PROMPT against gemini-2.5-flash on a known
 * property's photos and compares results to the same gold-standard fixture.
 *
 * Requires Node 18+ (built-in fetch).
 *
 * Usage:
 *   1. Capture image URLs (see tests/README.md) and save as
 *      tests/fixtures/<property>.urls.json
 *   2. Set GEMINI_API_KEY in your environment (or .env.local).
 *   3. Run:  node chrome-extension/tests/phase1-classify-gemini.test.mjs
 *
 * Optional env vars:
 *   PROPERTY=4129-grant-ct-pleasanton-ca-94566   (fixture basename)
 *   GEMINI_API_KEY=AIza...
 *   GEMINI_MODEL=gemini-2.5-flash
 *   CONCURRENCY=4
 *   THUMB_PX=224                                 (thumbnail size — matches production)
 *
 * Exits 0 when every photo matches gold, 1 on mismatch, 2 on fatal error.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROPERTY = process.env.PROPERTY || '4129-grant-ct-pleasanton-ca-94566';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const CONCURRENCY = Number(process.env.CONCURRENCY || 4);
const THUMB_PX = Number(process.env.THUMB_PX || 224);

// Load GEMINI_API_KEY from env or .env.local
let GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
if (!GEMINI_API_KEY) {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = join(here, '../../.env.local');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf8');
    const match = envContent.match(/^VITE_GEMINI_API_KEY=(.+)$/m);
    if (match) GEMINI_API_KEY = match[1].trim();
  }
}

if (!GEMINI_API_KEY) {
  console.error('\nError: GEMINI_API_KEY not found.');
  console.error('Set it in your environment or in .env.local as VITE_GEMINI_API_KEY=AIza...\n');
  process.exit(2);
}

// Try to load sharp for production-parity image resizing.
let sharp = null;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  // sharp not installed — send full-res images (usually slightly more accurate)
}

// ─── Keep in sync with sidepanel.js ──────────────────────────────────────────

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

// ─── Image fetch + resize ─────────────────────────────────────────────────────

async function fetchAndPrepareImage(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching image`);
  const buf = Buffer.from(await resp.arrayBuffer());
  if (!sharp) return { base64: buf.toString('base64'), mimeType: 'image/jpeg' };
  const resized = await sharp(buf)
    .resize({ width: THUMB_PX, height: THUMB_PX, fit: 'inside' })
    .jpeg({ quality: 80 })
    .toBuffer();
  return { base64: resized.toString('base64'), mimeType: 'image/jpeg' };
}

// ─── Single Gemini classify call ──────────────────────────────────────────────

async function classify(idx, base64, mimeType) {
  const body = {
    contents: [{ parts: [
      { inline_data: { mime_type: mimeType, data: base64 } },
      { text: CLASSIFY_PROMPT },
    ]}],
    generationConfig: { temperature: 0, maxOutputTokens: 30 },
  };
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API HTTP ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const data = await resp.json();
  const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  return { raw, ...parseClassificationResponse(raw, idx) };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const goldPath = join(here, 'fixtures', `${PROPERTY}.json`);
  const urlsPath = join(here, 'fixtures', `${PROPERTY}.urls.json`);

  if (!existsSync(goldPath)) {
    console.error(`\nGold fixture not found:\n   ${goldPath}\n`);
    process.exit(2);
  }

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
  const keyPreview = `${GEMINI_API_KEY.slice(0, 8)}...${GEMINI_API_KEY.slice(-4)}`;
  console.log(`\nClassifying ${total} photos for ${gold.property.address}`);
  console.log(`Model: ${MODEL}, concurrency=${CONCURRENCY}, resize=${sharp ? THUMB_PX + 'px' : 'OFF'}`);
  console.log(`API key: ${keyPreview}\n`);

  const results = new Array(total);
  let cursor = 0;
  let done = 0;
  const startMs = Date.now();

  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= total) return;
      try {
        const { base64, mimeType } = await fetchAndPrepareImage(urls[i]);
        const t0 = Date.now();
        results[i] = await classify(i, base64, mimeType);
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

  // ─── Compare against gold ────────────────────────────────────────────────────

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

  console.log('=========== Phase 1 Classification Results (Gemini) ===========\n');
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
        if (m.raw) console.log(`    raw: ${m.raw.replace(/\n/g, ' / ')}\n`);
      }
    }
  }

  process.exit(bothOk === total ? 0 : 1);
}

main().catch(e => {
  console.error(e);
  process.exit(2);
});
