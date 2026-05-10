#!/usr/bin/env node
/*
 * Phase 1 Speed Benchmark
 *
 * Pure-latency benchmark — runs the production CLASSIFY_PROMPT against multiple
 * models on the same set of test images and reports per-model wall-clock and
 * per-call latency. No accuracy check — just raw speed.
 *
 * Use this to quickly shortlist candidate models before running the full
 * accuracy test (phase1-classify.test.mjs).
 *
 * Usage:
 *   node chrome-extension/tests/phase1-bench-speed.mjs <image-url> [<image-url> ...]
 *
 * Or set MODELS to override the default candidate list:
 *   MODELS=minicpm-v,moondream,llava-phi3 node tests/phase1-bench-speed.mjs <url>
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODELS = (process.env.MODELS || 'minicpm-v,moondream,llava-phi3').split(',').map(s => s.trim());
const RUNS_PER_IMAGE = Number(process.env.RUNS_PER_IMAGE || 3);

const CLASSIFY_PROMPT = `Look at this real estate photo. Reply in this exact format:
Type: [Interior, Exterior, or Community]
Space: [EXACTLY ONE label from this list: Bedroom, Kitchen, Living Room, Dining Room, Bathroom, Office, Laundry Room, Hallway, Staircase, Basement, Front Yard, Backyard, Pool Area, Sports Court, Fitness Center, Clubhouse, Community Park, Floor Plan, Aerial View]

Use "Type: Exterior" and "Space: Aerial View" for any overhead, drone, or bird's-eye shot showing multiple rooftops or streets.`;

async function fetchAsBase64(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  return buf.toString('base64');
}

async function classify(model, base64) {
  const t0 = Date.now();
  const resp = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: CLASSIFY_PROMPT, images: [base64] }],
      stream: false,
      options: { temperature: 0, num_predict: 30, num_ctx: 1024, num_gpu: 99 },
    }),
  });
  const ms = Date.now() - t0;
  if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
  const data = await resp.json();
  return { ms, raw: (data.message?.content || '').trim().replace(/\n/g, ' / ') };
}

async function main() {
  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.error('Usage: node phase1-bench-speed.mjs <image-url> [<image-url> ...]');
    console.error('       Pipe in 2-5 representative photos (interior + exterior + aerial).');
    process.exit(2);
  }

  console.log(`\nBenchmarking ${MODELS.length} models on ${urls.length} image(s), ${RUNS_PER_IMAGE} run(s) each.`);
  console.log(`Ollama: ${OLLAMA_URL}\n`);

  // Pre-fetch images once.
  const images = [];
  for (const url of urls) {
    process.stdout.write(`Fetching ${url.slice(0, 60)}…  `);
    const base64 = await fetchAsBase64(url);
    console.log(`${(base64.length / 1024).toFixed(0)} KB`);
    images.push({ url, base64 });
  }
  console.log('');

  const stats = {};
  for (const model of MODELS) {
    stats[model] = { times: [], samples: [] };
    console.log(`── ${model} ─────────────────`);
    // Warm-up: load model into memory so first-run cost doesn't skew results.
    try {
      process.stdout.write('  warm-up…  ');
      const w = await classify(model, images[0].base64);
      console.log(`(${w.ms} ms, discarded)`);
    } catch (e) {
      console.log(`SKIPPED: ${e.message}`);
      stats[model].error = e.message;
      continue;
    }
    for (const img of images) {
      for (let r = 0; r < RUNS_PER_IMAGE; r++) {
        try {
          const result = await classify(model, img.base64);
          stats[model].times.push(result.ms);
          stats[model].samples.push(result.raw);
          console.log(`  ${img.url.slice(-30).padEnd(30)} run ${r + 1}: ${result.ms} ms  →  ${result.raw.slice(0, 60)}`);
        } catch (e) {
          console.log(`  ERROR: ${e.message}`);
        }
      }
    }
    console.log('');
  }

  console.log('═══════════════ Summary ═══════════════\n');
  console.log('Model'.padEnd(22), 'avg ms'.padStart(8), 'min ms'.padStart(8), 'max ms'.padStart(8), '  speedup vs slowest');
  let slowest = 0;
  for (const m of MODELS) {
    if (stats[m].times.length === 0) continue;
    const avg = stats[m].times.reduce((a, b) => a + b, 0) / stats[m].times.length;
    if (avg > slowest) slowest = avg;
  }
  for (const m of MODELS) {
    const s = stats[m];
    if (s.error) {
      console.log(m.padEnd(22), '   --     --     --   error:', s.error);
      continue;
    }
    if (s.times.length === 0) continue;
    const avg = s.times.reduce((a, b) => a + b, 0) / s.times.length;
    const min = Math.min(...s.times);
    const max = Math.max(...s.times);
    const speedup = slowest / avg;
    console.log(
      m.padEnd(22),
      `${avg.toFixed(0)}`.padStart(8),
      `${min}`.padStart(8),
      `${max}`.padStart(8),
      `  ${speedup.toFixed(2)}×`
    );
  }
  console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
