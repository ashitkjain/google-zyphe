import { test as base, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';
import zlib from 'zlib';

// ── Fixtures ───────────────────────────────────────────────────────────────
const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const pathToExtension = path.join(process.cwd(), 'chrome-extension/dist');
    const context = await chromium.launchPersistentContext('', {
      headless: false, // Extensions only work in headful mode
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }
    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
});

// ── Shared helpers ─────────────────────────────────────────────────────────

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Encode a tiny RGB PNG. Used by the dHash dedup tests so we can hand the
 * extension visually distinct images and predict the resulting hashes.
 */
function makePng(
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number],
): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const raw = Buffer.alloc(height * (1 + width * 3));
  let p = 0;
  for (let y = 0; y < height; y += 1) {
    raw[p++] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(x, y);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(pngCrc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function pngCrc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// 16×16 left-half-dark / right-half-bright. Resized to 9×8 grayscale this
// produces a strong "left < right" signal across most rows → distinctive
// dHash, far from the all-zeros hash a uniform PNG yields.
const HORIZ_SPLIT_PNG = makePng(16, 16, (x) => (x < 8 ? [0, 0, 0] : [255, 255, 255]));
// 16×16 with the opposite split (left bright, right dark). Hamming
// distance from HORIZ_SPLIT_PNG should be near 64 (every comparison flips).
const HORIZ_SPLIT_INV_PNG = makePng(16, 16, (x) => (x < 8 ? [255, 255, 255] : [0, 0, 0]));

/** Mock all property image fetches with a 1×1 PNG so the extension's resize/encode pipeline succeeds. */
async function mockImageFetches(page: import('@playwright/test').Page) {
  await page.route('https://images.zillowstatic.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(TINY_PNG_B64, 'base64'),
    });
  });
}

/** Mock /api/tags with a configurable model list. */
async function mockOllamaTags(
  page: import('@playwright/test').Page,
  models: { name: string; sizeGB: number }[],
) {
  await page.route('http://localhost:11434/api/tags', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        models: models.map((m) => ({
          name: m.name,
          size: Math.round(m.sizeGB * 1024 * 1024 * 1024),
        })),
      }),
    });
  });
}

/** Build a streaming NDJSON response body from arbitrary text segments. */
function buildStreamBody(segments: string[]): string {
  const chunks = segments.map((s) => ({ message: { content: s } }));
  chunks.push({ message: { content: '' }, done: true } as any);
  return chunks.map((c) => JSON.stringify(c)).join('\n') + '\n';
}

/** Default well-formed analysis stream used by the simple tests. */
function buildAnalysisStreamBody(): string {
  return buildStreamBody([
    'Space: Living Room\n',
    'Style: Mid-century modern with warm finishes\n',
    'Colors: Walnut wood floors, cream walls\n',
    'Score: 9/10\n',
  ]);
}

/** Inject N fake property images into the side panel. */
async function injectImages(page: import('@playwright/test').Page, count: number, zpid = '18485290') {
  await page.evaluate(
    ({ count, zpid }) => {
      const imgs = Array.from({ length: count }, (_, i) => ({
        url: `https://images.zillowstatic.com/fp/test-image-${i}.png`,
        alt: `Test photo ${i}`,
        width: 800,
        height: 600,
      }));
      // @ts-ignore — globals exposed by sidepanel.js
      window.extractedImages = imgs;
      // @ts-ignore
      window.currentZpid = zpid;
      // @ts-ignore
      window.handleImagesFound(imgs, zpid);
      // @ts-ignore
      window.updateZpidDisplay(zpid);
    },
    { count, zpid },
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Zyphe Extension — Ollama vision pipeline', () => {
  test('single image: connects to Ollama and analyzes one photo', async ({ page, extensionId }) => {
    await mockOllamaTags(page, [{ name: 'llama3.2-vision:latest', sizeGB: 7.3 }]);

    await page.route('http://localhost:11434/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: buildAnalysisStreamBody(),
      });
    });
    await mockImageFetches(page);

    page.on('console', (msg) => console.log('BROWSER:', msg.text()));
    page.on('pageerror', (err) => console.error('BROWSER ERROR:', err.message));

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await expect(page.locator('h1')).toHaveText('Property Vision Analyzer');

    await injectImages(page, 1);
    await expect(page.locator('#images-grid .image-card')).toHaveCount(1);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');

    await page.click('#single-btn-0');

    const status = page.locator('#status-0');
    await expect(status).toHaveClass(/status-done/, { timeout: 10_000 });
    await expect(status).toHaveText('Score: 9/10');
    await expect(page.locator('#result-0')).toContainText('Space: Living Room');
  });

  test('batch: same model classifies then analyzes; semantic dedup skips second photo of same space', async ({
    page,
    extensionId,
  }) => {
    // Two visually-distinct photos (different image bytes → different visual bins).
    // The selected model runs two short non-streaming classification calls (Phase 4),
    // both return "Living Room". Semantic dedup (Phase 5) marks the second photo as
    // a mirror of the first. Only ONE streaming analysis call (Phase 6) runs.
    await mockOllamaTags(page, [{ name: 'minicpm-v:latest', sizeGB: 5.5 }]);

    // Different image bytes → different dHash bins.
    await page.route('https://images.zillowstatic.com/fp/test-image-0.png', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: HORIZ_SPLIT_PNG });
    });
    await page.route('https://images.zillowstatic.com/fp/test-image-1.png', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: HORIZ_SPLIT_INV_PNG });
    });

    let classifyCalls = 0;
    let analysisCalls = 0;
    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        model: string;
        stream?: boolean;
        messages: { content: string; images?: string[] }[];
      };
      const msg = body.messages[0];
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);

      if (!hasImages) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }

      if (!body.stream) {
        // Phase 4: classification call (non-streaming, short).
        classifyCalls += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'Living Room' }, done: true }),
        });
        return;
      }

      // Phase 6: full analysis call (streaming).
      analysisCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: buildStreamBody(['Space: Living Room\n\nA bright open room. Score: 8/10\n']),
      });
    });

    page.on('pageerror', (err) => console.error('BROWSER ERROR:', err.message));
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 2);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');
    await page.selectOption('#ollama-model-select', 'minicpm-v:latest');

    await page.click('#analyze-all-btn');
    // Card 0 is the canonical (Done), card 1 is a semantic mirror (done mirror).
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });
    await expect(page.locator('#card-1')).toHaveClass(/done mirror/, { timeout: 15_000 });

    // Two classification calls (one per visual canonical), one analysis call.
    expect(classifyCalls).toBe(2);
    expect(analysisCalls).toBe(1);

    // Classification prompt includes the full ROOM_VOCABULARY list.
    // Analysis prompt is the detailed full prompt.
    expect(await page.locator('#result-0').innerText()).toContain('bright open room');
    expect(await page.locator('#result-1').innerText()).toContain('Same as photo #1');
  });

  test('two visually-distinct photos with different space labels each get their own analysis', async ({
    page,
    extensionId,
  }) => {
    // Two photos with different image bytes → different visual bins.
    // Classification returns different labels (Kitchen vs Living Room) so
    // semantic dedup does NOT fire — both run a full streaming analysis.
    await mockOllamaTags(page, [{ name: 'minicpm-v:latest', sizeGB: 5.5 }]);

    await page.route('https://images.zillowstatic.com/fp/test-image-0.png', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: HORIZ_SPLIT_PNG });
    });
    await page.route('https://images.zillowstatic.com/fp/test-image-1.png', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: HORIZ_SPLIT_INV_PNG });
    });

    let classifyCount = 0;
    let analysisCount = 0;
    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        model: string;
        stream?: boolean;
        messages: { content: string; images?: string[] }[];
      };
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);
      if (!hasImages) {
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }) });
        return;
      }
      if (!body.stream) {
        const label = classifyCount++ === 0 ? 'Kitchen' : 'Living Room';
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ message: { content: label }, done: true }) });
        return;
      }
      const prose = analysisCount++ === 0
        ? 'Space: Kitchen\n\nWhite shaker cabinets, quartz counters. Score: 9/10\n'
        : 'Space: Living Room\n\nOpen shelving, butcher-block island. Score: 7/10\n';
      await route.fulfill({ status: 200, contentType: 'application/x-ndjson',
        body: buildStreamBody([prose]) });
    });

    page.on('pageerror', (err) => console.error('BROWSER ERROR:', err.message));
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 2);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');
    await page.selectOption('#ollama-model-select', 'minicpm-v:latest');

    await page.click('#analyze-all-btn');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });
    await expect(page.locator('#card-1')).toHaveClass(/done/, { timeout: 15_000 });

    // Different labels → no semantic dedup → both analyzed.
    expect(classifyCount).toBe(2);
    expect(analysisCount).toBe(2);

    const r0 = await page.locator('#result-0').innerText();
    const r1 = await page.locator('#result-1').innerText();
    expect(r0).toContain('shaker cabinets');
    expect(r1).toContain('butcher-block');
    expect(r1).not.toContain('shaker cabinets');
  });

  test('analysis output without Space: header is preserved (not rewritten to NA)', async ({
    page,
    extensionId,
  }) => {
    await mockOllamaTags(page, [
      { name: 'moondream:latest', sizeGB: 1.7 },
      { name: 'llama3.2-vision:latest', sizeGB: 7.3 },
    ]);

    // The model opens with prose and never emits "Space:" — the old cleanRefusals
    // would have replaced this with "NA". Now it must be preserved verbatim.
    const proseAnalysis =
      'This single-family ranch home shows excellent curb appeal with a manicured ' +
      'lawn and mature oak trees. The facade is warm grey siding with white trim. ' +
      'Score: 8/10\n';

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        model: string;
        stream?: boolean;
        messages: { content: string; images?: string[] }[];
      };
      const msg = body.messages[0];
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);

      if (!hasImages) {
        // Warm-up
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }

      // Llama analysis: prose, no Space: header, includes a score.
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: buildStreamBody([proseAnalysis.slice(0, 100), proseAnalysis.slice(100)]),
      });
    });

    await mockImageFetches(page);
    page.on('pageerror', (err) => console.error('BROWSER ERROR:', err.message));

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 1);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');
    await page.selectOption('#ollama-model-select', 'llama3.2-vision:latest');

    await page.click('#analyze-all-btn');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });

    // Result should contain the prose, not "NA".
    const resultText = await page.locator('#result-0').innerText();
    expect(resultText).not.toBe('NA');
    expect(resultText).toContain('single-family ranch home');
    expect(resultText).toContain('curb appeal');

    // Score still gets parsed from prose.
    await expect(page.locator('#status-0')).toHaveText('Score: 8/10');
  });

  test('master prompt is the structured detailed template with property Context substituted', async ({
    page,
    extensionId,
  }) => {
    // The analysis prompt is the structured "real estate photo analyst"
    // template — capable models (minicpm-v, llama3.2-vision) follow it
    // cleanly and produce the Space/Style/Description fields directly.
    // Property metadata flows into a Context block via the {{PROPERTY_CONTEXT}}
    // substitution.
    await mockOllamaTags(page, [{ name: 'llama3.2-vision:latest', sizeGB: 7.3 }]);

    const masterPrompts: string[] = [];

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        model: string;
        stream?: boolean;
        messages: { content: string; images?: string[] }[];
      };
      const msg = body.messages[0];
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);
      const isWarmup = !hasImages && msg.content === 'hi';

      if (isWarmup) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }

      if (body.stream) masterPrompts.push(body.messages[body.messages.length - 1].content);
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: buildStreamBody(['Space: Front Yard\n\nA single-family home.']),
      });
    });

    await mockImageFetches(page);
    page.on('pageerror', (err) => console.error('BROWSER ERROR:', err.message));

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await page.evaluate(() => {
      // @ts-ignore
      window.__zypheSetCurrentProperty({
        address: '123 Main St',
        city: 'San Jose',
        price: 1200000,
        beds: 3,
        baths: 2,
      });
    });
    await injectImages(page, 1);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');

    await page.click('#analyze-all-btn');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });

    expect(masterPrompts).toHaveLength(1);
    const sent = masterPrompts[0];
    // Structured template anchors.
    expect(sent).toContain('real estate photo analyst');
    expect(sent).toMatch(/INTERIOR/);
    expect(sent).toMatch(/PRIVATE EXTERIOR/);
    expect(sent).toMatch(/COMMUNITY AMENITY/);
    expect(sent).toContain('Start directly with "Space:"');
    // Front yard / backyard disambiguator (added to fix the failure mode
    // where minicpm-v labelled a clear front-yard photo as "Backyard").
    expect(sent).toMatch(/Front Yard\s*=.*driveway/i);
    expect(sent).toMatch(/Backyard\s*=.*(enclosed|fenced|rear)/i);
    // Per-template fields.
    expect(sent).toMatch(/Description:\s*\[/);
    expect(sent).toMatch(/Potential:\s*\[/);
    // Property Context is substituted, not leaked as a placeholder.
    expect(sent).toMatch(/Context:/);
    expect(sent).toContain('123 Main St');
    expect(sent).toContain('San Jose');
    expect(sent).not.toContain('{{PROPERTY_CONTEXT}}');
    expect(sent).not.toContain('{{MEMORY_CONTEXT}}');
    expect(sent).not.toContain('{{VIEWS_CONTEXT}}');
    // Trimmed prompt: under the 532-word .detailed.txt backup. The new
    // version's "USE TEMPLATE A/B/C" framing brings it to ~500 words —
    // the cap below leaves headroom for small edits.
    expect(sent.split(/\s+/).filter(Boolean).length).toBeLessThan(600);
  });

  test('Space label is inferred from prose when the model emits no header', async ({
    page,
    extensionId,
  }) => {
    // Moondream-style: free-form prose, no "Space:" header. The extension
    // must scan for vocabulary keywords and prepend one so the room name is
    // visible in the result and can drive post-hoc dedup.
    await mockOllamaTags(page, [{ name: 'llama3.2-vision:latest', sizeGB: 7.3 }]);

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        messages: { content: string; images?: string[] }[];
      };
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);
      if (!hasImages) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }
      // Phase 4: classification call (non-streaming) → returns Kitchen label.
      if (!body.stream) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'Kitchen' }, done: true }),
        });
        return;
      }
      // Phase 6: analysis call (streaming). No "Space:" header in the model
      // output — the Phase 4 label should be prepended as fallback.
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: buildStreamBody([
          'A bright modern kitchen with white shaker cabinets, ',
          'quartz counters, and stainless appliances. Score: 8/10\n',
        ]),
      });
    });

    await mockImageFetches(page);
    page.on('pageerror', (err) => console.error('BROWSER ERROR:', err.message));

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 1);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');

    await page.click('#analyze-all-btn');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });

    const text = await page.locator('#result-0').innerText();
    // The Phase 4 label was prepended because analysis had no Space: header.
    expect(text.startsWith('Space: Kitchen')).toBe(true);
    // The original prose is preserved below it.
    expect(text).toContain('shaker cabinets');
  });

  test('two-phase pipeline: Phase 4 classifies space; Phase 6 analyzes with same model', async ({
    page,
    extensionId,
  }) => {
    // The same model handles both Phase 4 (non-streaming classify) and
    // Phase 6 (streaming analysis). Classification returns "Front Yard";
    // analysis returns prose without a Space: header so the fallback prepends it.
    await mockOllamaTags(page, [{ name: 'minicpm-v:latest', sizeGB: 5.5 }]);

    type Call = { stream: boolean; hasImages: boolean };
    const calls: Call[] = [];

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        stream?: boolean;
        messages: { content: string; images?: string[] }[];
      };
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);
      calls.push({ stream: !!body.stream, hasImages });

      if (!hasImages) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }

      // Phase 4: classification call (non-streaming).
      if (!body.stream) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'Front Yard' }, done: true }),
        });
        return;
      }

      // Phase 6: analysis call (streaming). No Space: header → fallback prepends label.
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: buildStreamBody([
          'A two-car garage with a driveway and front lawn. Score: 7/10\n',
        ]),
      });
    });

    await mockImageFetches(page);
    page.on('pageerror', (err) => console.error('BROWSER ERROR:', err.message));

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 1);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');

    await page.click('#analyze-all-btn');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });

    const imageCalls = calls.filter((c) => c.hasImages);
    expect(imageCalls).toHaveLength(2);
    expect(imageCalls[0].stream).toBe(false);  // Phase 4: classify
    expect(imageCalls[1].stream).toBe(true);   // Phase 6: analyze

    const text = await page.locator('#result-0').innerText();
    expect(text.startsWith('Space: Front Yard')).toBe(true);
  });

  test('master prompt forbids multiple templates and headers them with USE TEMPLATE A/B/C', async ({
    page,
    extensionId,
  }) => {
    // The earlier prompt's "--- INTERIOR ---" / "--- PRIVATE EXTERIOR ---"
    // structure read like "three sections to fill in" and minicpm-v
    // answered all three. The new prompt frames each block as a single
    // mutually-exclusive choice (USE TEMPLATE A/B/C) and the rule about
    // not emitting the unused ones is explicit.
    await mockOllamaTags(page, [{ name: 'minicpm-v:latest', sizeGB: 5.5 }]);

    const masterPrompts: string[] = [];

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        messages: { content: string; images?: string[] }[];
      };
      const msg = body.messages[0];
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);
      if (!hasImages) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }
      // Classification call: non-streaming.
      if (!body.stream) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'Living Room' }, done: true }),
        });
        return;
      }
      // Analysis call: streaming — capture prompt for assertions.
      masterPrompts.push(body.messages[body.messages.length - 1].content);
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: buildStreamBody(['Space: Living Room\n\nA bright room.']),
      });
    });

    await mockImageFetches(page);

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 1);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');

    await page.click('#analyze-all-btn');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });

    expect(masterPrompts).toHaveLength(1);
    const sent = masterPrompts[0];
    // Strong "choose ONE" framing, present in the new prompt.
    expect(sent).toMatch(/exactly ONE/);
    expect(sent).toMatch(/MUST NOT appear/i);
    // Templates are now headed with explicit "USE TEMPLATE" lines so the
    // model treats them as a select-one menu, not three sections to fill.
    expect(sent).toMatch(/USE TEMPLATE A.*INTERIOR/);
    expect(sent).toMatch(/USE TEMPLATE B.*PRIVATE EXTERIOR/);
    expect(sent).toMatch(/USE TEMPLATE C.*COMMUNITY AMENITY/);
  });

  test('post-processor: trims extra templates from model output (kept first, dropped rest)', async ({
    page,
    extensionId,
  }) => {
    // Defensive: even with the strengthened prompt, capable models may
    // still emit all three templates. The client-side post-processor must
    // truncate at the second template's header so the user only sees the
    // applicable one.
    await mockOllamaTags(page, [{ name: 'minicpm-v:latest', sizeGB: 5.5 }]);

    const multiTemplateOutput = [
      'Space: Living room',
      'Style: Modern and contemporary',
      'Colors: White walls, light wood flooring',
      'Description: A bright open living room with natural light flooding through large windows. Modern furnishings define the seating area.',
      'Potential: Add personal touches like artwork.',
      '',
      '--- PRIVATE EXTERIOR ---',
      'Space: Not visible',
      'Architecture: Not applicable',
      'Description: Not applicable.',
      '',
      '--- COMMUNITY AMENITY ---',
      'Space: Not applicable',
      'Type: None',
      '',
    ].join('\n');

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        messages: { content: string; images?: string[] }[];
      };
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);
      if (!hasImages) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: buildStreamBody([multiTemplateOutput]),
      });
    });

    await mockImageFetches(page);

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 1);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');

    await page.click('#analyze-all-btn');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });

    const text = await page.locator('#result-0').innerText();
    // The interior fields are kept.
    expect(text).toContain('Living room');
    expect(text).toContain('White walls, light wood flooring');
    expect(text).toContain('Modern furnishings');
    // The two unused templates and their "Not visible" / "Not applicable"
    // placeholders are gone.
    expect(text).not.toMatch(/PRIVATE EXTERIOR/);
    expect(text).not.toMatch(/COMMUNITY AMENITY/);
    expect(text).not.toContain('Architecture: Not applicable');
    expect(text).not.toContain('Type: None');
    // Only one "Space:" line should remain.
    const spaceLines = text.split('\n').filter((l) => /^\s*Space\s*:/i.test(l));
    expect(spaceLines).toHaveLength(1);
  });

  test('post-processor: does NOT truncate when the model echoes "USE TEMPLATE …" mid-stream', async ({
    page,
    extensionId,
  }) => {
    // Live-run regression: minicpm-v sometimes paraphrases the prompt
    // ("USE TEMPLATE B — PRIVATE EXTERIOR — only if …") inline as part of
    // its analysis. The earlier post-processor treated that as a template
    // boundary and truncated the entire analysis body, leaving the user
    // with just "Space: Front Yard" on each card. The fix: only treat
    // "--- HEADER ---" dividers and a second top-of-template "Space:" line
    // as cut points, never an echoed "USE TEMPLATE …" sentence.
    await mockOllamaTags(page, [{ name: 'minicpm-v:latest', sizeGB: 5.5 }]);

    const echoedOutput = [
      'Space: Front Yard',
      'Architecture: Single-story ranch with pitched roof',
      'Colors: Beige siding with white trim',
      'USE TEMPLATE B — PRIVATE EXTERIOR — only if the photo shows a private outdoor area',
      'Landscaping: Mature lawn with shrubs along the walkway',
      'Outdoor Living: None visible in this photo',
      'Street Context: Suburban setback with neighbors visible',
      'Condition: Well-maintained with fresh paint',
      'Description: A welcoming single-story home with a two-car garage and tidy landscaping. Score: 8/10',
      'Potential: Refresh front-door paint to lift curb appeal.',
    ].join('\n');

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        messages: { content: string; images?: string[] }[];
      };
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);
      if (!hasImages) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: buildStreamBody([echoedOutput]),
      });
    });

    await mockImageFetches(page);

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 1);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');

    await page.click('#analyze-all-btn');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });

    const text = await page.locator('#result-0').innerText();
    // All field rows above and below the echoed line must survive.
    expect(text).toContain('Space: Front Yard');
    expect(text).toContain('Architecture: Single-story ranch');
    expect(text).toContain('Landscaping:'); // line below the echo
    expect(text).toContain('Description:'); // way below the echo
    expect(text).toContain('Refresh front-door paint'); // very last line
    // The echoed line itself is allowed to remain (cosmetic), but the
    // critical assertion is that NOTHING was truncated.
    expect(text.split('\n').filter((l) => l.trim()).length).toBeGreaterThanOrEqual(8);
  });

  test('post-processor: leaves a single-template output untouched', async ({
    page,
    extensionId,
  }) => {
    // Idempotency check: when the model already obeyed the prompt and
    // emitted only one template, the post-processor must not strip
    // anything.
    await mockOllamaTags(page, [{ name: 'minicpm-v:latest', sizeGB: 5.5 }]);

    const single = [
      'Space: Front Yard',
      'Architecture: Single-story ranch',
      'Colors: Grey siding, white trim',
      'Landscaping: Mature lawn and shrubs',
      'Description: A neat single-story home with a two-car garage and mature landscaping. Score: 8/10',
      'Potential: Refresh the front-door paint.',
    ].join('\n');

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        messages: { content: string; images?: string[] }[];
      };
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);
      if (!hasImages) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: buildStreamBody([single]),
      });
    });

    await mockImageFetches(page);

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 1);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');

    await page.click('#analyze-all-btn');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });

    const text = await page.locator('#result-0').innerText();
    // Every field of the single template is preserved.
    for (const expected of [
      'Front Yard',
      'Single-story ranch',
      'Grey siding, white trim',
      'Mature lawn and shrubs',
      'two-car garage',
      'Refresh the front-door paint',
    ]) {
      expect(text).toContain(expected);
    }
  });

  test('visual dedup: identical photos use one classification and one analysis call', async ({
    page,
    extensionId,
  }) => {
    // Two photos with identical bytes get the same dHash → same visual bin.
    // Phase 4 runs ONE classification call (only the canonical). Phase 6 runs
    // ONE analysis call. Photo 1 is immediately marked as a visual mirror in
    // Phase 3, before any LLM calls.
    await mockOllamaTags(page, [{ name: 'minicpm-v:latest', sizeGB: 5.5 }]);

    // Both URLs serve the same textured PNG → identical dHashes.
    await page.route('https://images.zillowstatic.com/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: HORIZ_SPLIT_PNG });
    });

    let classifyCalls = 0;
    let analysisCalls = 0;
    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        model: string;
        stream?: boolean;
        messages: { content: string; images?: string[] }[];
      };
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);
      if (!hasImages) {
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }) });
        return;
      }
      if (!body.stream) {
        classifyCalls += 1;
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'Front Yard' }, done: true }) });
        return;
      }
      analysisCalls += 1;
      await route.fulfill({ status: 200, contentType: 'application/x-ndjson',
        body: buildStreamBody(['Space: Front Yard\n\nA suburban home with a two-car garage. Score: 7/10\n']) });
    });

    page.on('console', (msg) => {
      if (msg.text().includes('[ZypheVision]')) console.log('BROWSER:', msg.text());
    });

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 2);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');
    await page.selectOption('#ollama-model-select', 'minicpm-v:latest');

    await page.click('#analyze-all-btn');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });
    // Card 1 is a visual mirror — it shows the "done mirror" class.
    await expect(page.locator('#card-1')).toHaveClass(/done mirror/, { timeout: 15_000 });

    expect(classifyCalls).toBe(1);
    expect(analysisCalls).toBe(1);
    expect(await page.locator('#result-0').innerText()).toContain('two-car garage');
    expect(await page.locator('#result-1').innerText()).toContain('Same as photo #1');
  });

  test('visual dedup + semantic dedup: visually distinct photos with different labels both analyzed', async ({
    page,
    extensionId,
  }) => {
    // Two visually-distinct photos → two visual bins. Classification returns
    // different labels (Kitchen vs Living Room) → semantic dedup does NOT
    // fire. Both photos get their own full streaming analysis.
    await mockOllamaTags(page, [{ name: 'minicpm-v:latest', sizeGB: 5.5 }]);

    await page.route('https://images.zillowstatic.com/fp/test-image-0.png', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: HORIZ_SPLIT_PNG });
    });
    await page.route('https://images.zillowstatic.com/fp/test-image-1.png', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: HORIZ_SPLIT_INV_PNG });
    });

    let classifyCount = 0;
    let analysisCount = 0;
    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        model: string;
        stream?: boolean;
        messages: { content: string; images?: string[] }[];
      };
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);
      if (!hasImages) {
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }) });
        return;
      }
      if (!body.stream) {
        // Classification: different labels for each photo.
        const label = classifyCount++ === 0 ? 'Kitchen' : 'Living Room';
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ message: { content: label }, done: true }) });
        return;
      }
      const space = analysisCount++ === 0 ? 'Kitchen' : 'Living Room';
      await route.fulfill({ status: 200, contentType: 'application/x-ndjson',
        body: buildStreamBody([`Space: ${space}\n\nDistinct ${space.toLowerCase()} description.\n`]) });
    });

    page.on('console', (msg) => {
      if (msg.text().includes('[ZypheVision]')) console.log('BROWSER:', msg.text());
    });

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 2);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');
    await page.selectOption('#ollama-model-select', 'minicpm-v:latest');

    await page.click('#analyze-all-btn');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });
    await expect(page.locator('#card-1')).toHaveClass(/done/, { timeout: 15_000 });

    // Different labels → no semantic dedup → both analyzed.
    expect(analysisCount).toBe(2);

    const r0 = await page.locator('#result-0').innerText();
    const r1 = await page.locator('#result-1').innerText();
    expect(r0).toContain('kitchen');
    expect(r1).toContain('living room');
    expect(r0).not.toContain('Same as');
    expect(r1).not.toContain('Same as');
  });

  test('batch summary log reports visual_bins, visual_dupes, unique_spaces, semantic_dupes, and wall-clock time', async ({
    page,
    extensionId,
  }) => {
    // The summary log is what the user reads at the end of a real run to
    // see how many classification and analysis calls were spent vs saved by
    // dedup. It must appear once per analyzeImages() call with the five
    // counters present. Three identical images → 1 visual bin, 2 visual
    // dupes, 1 unique space, 0 semantic dupes, 1 analysis call.
    await mockOllamaTags(page, [{ name: 'minicpm-v:latest', sizeGB: 5.5 }]);
    await page.route('https://images.zillowstatic.com/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: HORIZ_SPLIT_PNG });
    });

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        model: string;
        stream?: boolean;
        messages: { content: string; images?: string[] }[];
      };
      const msg = body.messages[0];
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);
      const warmup = !hasImages && msg.content === 'hi';
      if (warmup) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }
      // Classification call: non-streaming, has image
      if (hasImages && !body.stream) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'Front Yard' }, done: true }),
        });
        return;
      }
      // Analysis call: streaming
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: buildStreamBody(['Space: Front Yard\n\nA home. Score: 7/10\n']),
      });
    });

    const batchLogs: string[] = [];
    page.on('console', (msg) => {
      const t = msg.text();
      if (t.includes('[ZypheVision][batch]')) batchLogs.push(t);
    });

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 3);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');
    await page.selectOption('#ollama-model-select', 'minicpm-v:latest');

    await page.click('#analyze-all-btn');
    await expect(page.locator('#card-2')).toHaveClass(/done/, { timeout: 15_000 });

    // Wait for the batch summary to flush to console.
    await expect.poll(() => batchLogs.length, { timeout: 5_000 }).toBeGreaterThan(0);
    const summary = batchLogs[0];
    expect(summary).toMatch(/photos=3/);
    // 3 identical images → 1 visual bin, 2 visual dupes, 1 unique space, 0 semantic dupes.
    expect(summary).toMatch(/visual_bins=1/);
    expect(summary).toMatch(/visual_dupes=2/);
    expect(summary).toMatch(/unique_spaces=1/);
    expect(summary).toMatch(/semantic_dupes=0/);
    expect(summary).toMatch(/wall_clock_ms=\d+/);
  });

  test('build stamp is rendered in the side panel header', async ({ page, extensionId }) => {
    // Lets the user confirm at a glance that Chrome has loaded the latest
    // bundle. Webpack stamps __BUILD_TIME__ at compile time and the side
    // panel renders it as "build YYYY-MM-DD HH:mm" in the header.
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    const stamp = page.locator('#build-stamp');
    await expect(stamp).toBeVisible();
    // Either the formatted display ("build 2026-05-08 13:33") or the raw
    // ISO fallback. Both prove the DefinePlugin substitution fired.
    await expect(stamp).toHaveText(/^build (\d{4}-\d{2}-\d{2} \d{2}:\d{2}|20\d{2}-.+Z)$/);
  });

  test('alias canonicalization: "garage" reply groups with "Front Yard" for semantic dedup', async ({
    page,
    extensionId,
  }) => {
    // inferSpaceFromText must canonicalize alias words (garage, driveway,
    // exterior…) to their ROOM_VOCABULARY parent. If two visually-distinct
    // photos get classified as "garage" and "Front Yard" respectively, they
    // should both resolve to "Front Yard" and trigger semantic dedup —
    // leaving card-1 as a mirror with only 1 analysis call fired.
    await mockOllamaTags(page, [{ name: 'minicpm-v:latest', sizeGB: 5.5 }]);

    let classifyCalls = 0;
    let analysisCalls = 0;

    await page.route('https://images.zillowstatic.com/**', async (route, request) => {
      const url = request.url();
      const body = url.includes('image-1') ? HORIZ_SPLIT_PNG : HORIZ_SPLIT_INV_PNG;
      await route.fulfill({ status: 200, contentType: 'image/png', body });
    });

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        stream?: boolean;
        messages: { content: string; images?: string[] }[];
      };
      const msg = body.messages[0];
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);
      const warmup = !hasImages && msg.content === 'hi';

      if (warmup) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }

      // Classification call: non-streaming with image.
      if (hasImages && !body.stream) {
        classifyCalls += 1;
        // First photo classified as alias "garage", second as canonical "Front Yard".
        // Both should canonicalize to "Front Yard" → semantic dedup fires.
        const label = classifyCalls === 1 ? 'garage' : 'Front Yard';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: label }, done: true }),
        });
        return;
      }

      // Analysis call: streaming.
      analysisCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: buildStreamBody(['Space: Front Yard\n\nA two-car garage and driveway. Score: 7/10\n']),
      });
    });

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 2);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');
    await page.selectOption('#ollama-model-select', 'minicpm-v:latest');

    await page.click('#analyze-all-btn');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });
    await expect(page.locator('#card-1')).toHaveClass(/done mirror/, { timeout: 15_000 });

    // Both photos classified (alias + canonical), only 1 analysis (semantic dedup saved one).
    expect(classifyCalls).toBe(2);
    expect(analysisCalls).toBe(1);
  });

  test('analysis prompt contains interior/exterior disambiguation even without classification label', async ({
    page,
    extensionId,
  }) => {
    // The hardcoded fallback analysis prompt always includes INTERIOR and
    // EXTERIOR template sections so the model can self-determine the space
    // type. This covers non-minicpm models (llama3.2-vision, etc.) where
    // classification may return an unrecognized label.
    await mockOllamaTags(page, [{ name: 'llama3.2-vision:latest', sizeGB: 7.3 }]);

    const prompts: string[] = [];

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        stream?: boolean;
        messages: { content: string; images?: string[] }[];
      };
      const msg = body.messages[0];
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);
      const warmup = !hasImages && msg.content === 'hi';

      if (warmup) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }

      // Classification call: return a label (may be unrecognized by the prompt).
      if (hasImages && !body.stream) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'Living Room' }, done: true }),
        });
        return;
      }

      // Analysis call.
      prompts.push(body.messages[body.messages.length - 1].content);
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: buildStreamBody(['A bright living room. Score: 7/10\n']),
      });
    });

    await mockImageFetches(page);

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 1);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');

    await page.click('#analyze-all-btn');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });

    expect(prompts).toHaveLength(1);
    // The fallback prompt includes both template sections so the model can
    // self-determine space type without relying solely on the classification.
    expect(prompts[0].toLowerCase()).toContain('exterior');
    expect(prompts[0].toLowerCase()).toContain('interior');
  });

  test('Space inference picks the EARLIEST vocab mention, not first in vocab order', async ({
    page,
    extensionId,
  }) => {
    // Real bug repro: minicpm-v on a front-yard photo opens with "garage…
    // exterior…" then later mentions "the living room" in passing. The old
    // inferSpaceFromText walked ROOM_VOCABULARY in declaration order and
    // returned "Living Room" because that label is listed before
    // "Front Yard". Earliest-position-wins must pick Front Yard via the
    // "garage" alias.
    await mockOllamaTags(page, [{ name: 'minicpm-v:latest', sizeGB: 5.5 }]);

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        messages: { content: string; images?: string[] }[];
      };
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);
      if (!hasImages) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }
      // Phase 4: classification (non-streaming). Return alias "garage" so
      // inferSpaceFromText maps it to "Front Yard" — same as the prose subject.
      if (!body.stream) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'garage' }, done: true }),
        });
        return;
      }
      // Phase 6: analysis (streaming). Verbatim shape of the failing minicpm-v
      // output: garage/exterior first, "living room" mentioned later as a
      // hallucinated detail. The Phase 4 label (Front Yard) wins regardless.
      const prose =
        'The house features a large garage with two white doors and a clean exterior. ' +
        'A small garden adds greenery to the property. ' +
        'Inside, the open floor plan creates a spacious feel and a fireplace serves as ' +
        'the focal point of the living room.\n';
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: buildStreamBody([prose]),
      });
    });

    await mockImageFetches(page);

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 1);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');

    await page.click('#analyze-all-btn');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });

    const text = await page.locator('#result-0').innerText();
    // The space label must reflect the photo's primary subject (front yard,
    // surfaced via the "garage" alias), not a passing mention later in the
    // hallucinated prose.
    expect(text.startsWith('Space: Front Yard')).toBe(true);
    expect(text).not.toMatch(/^Space: Living Room/);
  });

  test('Space inference uses VOCABULARY_ALIASES (patio → Backyard)', async ({
    page,
    extensionId,
  }) => {
    await mockOllamaTags(page, [{ name: 'llama3.2-vision:latest', sizeGB: 7.3 }]);

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        messages: { content: string; images?: string[] }[];
      };
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);
      if (!hasImages) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }
      // Phase 4: classification (non-streaming). Return alias "patio" so
      // inferSpaceFromText maps it to "Backyard".
      if (!body.stream) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'patio' }, done: true }),
        });
        return;
      }
      // Phase 6: analysis (streaming). Prose also says "patio" — consistent.
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: buildStreamBody([
          'A covered patio with a bbq and outdoor seating overlooking a lawn.\n',
        ]),
      });
    });

    await mockImageFetches(page);

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 1);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');

    await page.click('#analyze-all-btn');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });

    const text = await page.locator('#result-0').innerText();
    expect(text.startsWith('Space: Backyard')).toBe(true);
    expect(text).toContain('covered patio');
  });

  test('explicit refusal output is still rewritten to NA', async ({ page, extensionId }) => {
    await mockOllamaTags(page, [
      { name: 'moondream:latest', sizeGB: 1.7 },
      { name: 'llama3.2-vision:latest', sizeGB: 7.3 },
    ]);

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        model: string;
        stream?: boolean;
        messages: { content: string; images?: string[] }[];
      };
      const msg = body.messages[0];
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);

      if (!hasImages) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }

      // Classic refusal opener.
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: buildStreamBody(["I'm sorry, I cannot analyze this image."]),
      });
    });

    await mockImageFetches(page);
    page.on('pageerror', (err) => console.error('BROWSER ERROR:', err.message));

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 1);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');
    await page.selectOption('#ollama-model-select', 'llama3.2-vision:latest');

    await page.click('#analyze-all-btn');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });

    await expect(page.locator('#result-0')).toHaveText('NA');
    // No score → status should fall back to 'Done ✓'.
    await expect(page.locator('#status-0')).toHaveText('Done ✓');
  });

  // ── Diagnostics for the "raw output (0 chars) → NA" failure mode ─────────
  // These reproduce the exact symptom the user reported: moondream returns
  // 0 chars, the master result silently collapses to "NA". The fix surfaces
  // the underlying cause (error JSON line, or done_reason!=stop with empty
  // content) directly in the result cell so it is no longer invisible.

  test('empty stream (done_reason=load) surfaces a no-tokens message instead of NA', async ({
    page,
    extensionId,
  }) => {
    await mockOllamaTags(page, [{ name: 'moondream:latest', sizeGB: 1.7 }]);

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        messages: { content: string; images?: string[] }[];
      };
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);
      if (!hasImages) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }
      // Simulate moondream emitting zero tokens — this is what the user is
      // actually seeing. done_reason indicates a real abnormal termination.
      const ndjson =
        JSON.stringify({
          message: { role: 'assistant', content: '' },
          done: true,
          done_reason: 'load',
          eval_count: 0,
          prompt_eval_count: 0,
          total_duration: 12345,
        }) + '\n';
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: ndjson,
      });
    });

    await mockImageFetches(page);
    page.on('console', (msg) => console.log('BROWSER:', msg.text()));
    page.on('pageerror', (err) => console.error('BROWSER ERROR:', err.message));

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 1);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');

    await page.click('#single-btn-0');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });

    // The result must NOT be the silent "NA" — it must carry the diagnostic.
    const text = await page.locator('#result-0').innerText();
    expect(text).not.toBe('NA');
    expect(text.toLowerCase()).toContain('no tokens');
    expect(text).toContain('done_reason=load');
  });

  test('error JSON line in stream surfaces the Ollama error instead of NA', async ({
    page,
    extensionId,
  }) => {
    await mockOllamaTags(page, [{ name: 'moondream:latest', sizeGB: 1.7 }]);

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        messages: { content: string; images?: string[] }[];
      };
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);
      if (!hasImages) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }
      // Ollama can emit {"error":"..."} as a single JSON line on a 200 — the
      // old code silently dropped it inside the JSON.parse try/catch.
      const ndjson =
        JSON.stringify({ error: 'image: failed to decode jpeg' }) + '\n';
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: ndjson,
      });
    });

    await mockImageFetches(page);
    page.on('console', (msg) => console.log('BROWSER:', msg.text()));

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 1);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');

    await page.click('#single-btn-0');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });

    const text = await page.locator('#result-0').innerText();
    expect(text).not.toBe('NA');
    expect(text).toContain('Ollama error');
    expect(text).toContain('failed to decode jpeg');
  });

  test('chunked stream split mid-JSON-line is reassembled correctly', async ({
    page,
    extensionId,
  }) => {
    // Repro for the silent-drop bug in the old chunk handler: a JSON line
    // straddling two TCP chunks would be chopped at the boundary and both
    // halves would fail to parse, producing 0 chars even though the model
    // returned content.
    await mockOllamaTags(page, [{ name: 'moondream:latest', sizeGB: 1.7 }]);

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        messages: { content: string; images?: string[] }[];
      };
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);
      if (!hasImages) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }
      // One single JSON line, no terminating newline — emulates a server
      // that batches the whole thing into the last frame without \n.
      const body1 = JSON.stringify({
        message: { role: 'assistant', content: 'A bright living room with cream walls. Score: 7/10' },
        done: true,
        done_reason: 'stop',
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: body1,
      });
    });

    await mockImageFetches(page);

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 1);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');

    await page.click('#single-btn-0');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });

    const text = await page.locator('#result-0').innerText();
    expect(text).toContain('bright living room');
    await expect(page.locator('#status-0')).toHaveText('Score: 7/10');
  });

  test('aerial view: Phase 4 tags it as Aerial View; Phase 6 is skipped and card shows NA', async ({
    page,
    extensionId,
  }) => {
    // An overhead/drone shot is classified as "Aerial View" in Phase 4.
    // Phase 5 sees the label and immediately marks the card NA without
    // ever calling Phase 6 (no streaming analysis request).
    await mockOllamaTags(page, [{ name: 'minicpm-v:latest', sizeGB: 5.5 }]);

    let analysisCalls = 0;

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        stream?: boolean;
        messages: { content: string; images?: string[] }[];
      };
      const hasImages = body.messages.some((m: any) => Array.isArray(m.images) && m.images.length > 0);

      if (!hasImages) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }

      // Phase 4: classification (non-streaming) → aerial view.
      if (!body.stream) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'Aerial View' }, done: true }),
        });
        return;
      }

      // Phase 6 should never be reached for an aerial view.
      analysisCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: buildStreamBody(['Space: Community Pool Area\n\nA pool.']),
      });
    });

    await mockImageFetches(page);

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 1);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');

    await page.click('#analyze-all-btn');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });

    // No streaming analysis call should have been made.
    expect(analysisCalls).toBe(0);
    // Card result is NA, not a hallucinated pool description.
    await expect(page.locator('#result-0')).toHaveText('NA');
  });
});

// ── pHash algorithm unit tests ─────────────────────────────────────────────
// These tests run entirely in the browser context of the extension sidepanel,
// using window.computePHash / window.computeDHash / window.hammingDistance
// exposed by sidepanel.js. No Ollama calls are made.

test.describe('pHash perceptual similarity', () => {
  /**
   * Draw a synthetic real-estate-like scene onto a canvas and return a
   * data-URL. `zoomFraction` (0–1) controls how much of the base scene
   * is visible: 1.0 = full scene, 0.8 = centre-cropped 80% (simulates a
   * tighter camera zoom). This is exactly the kind of variation that fools
   * dHash but should be caught by pHash.
   */
  async function makeSceneDataUrl(
    page: import('@playwright/test').Page,
    scene: 'exterior' | 'living-room',
    zoomFraction: number,
  ): Promise<string> {
    return page.evaluate(
      ({ scene, zoomFraction }) => {
        const W = 400, H = 300;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d')!;

        // Draw the full scene onto an offscreen canvas, then blit the
        // zoomed-in crop back to the output canvas.
        const src = document.createElement('canvas');
        src.width = W; src.height = H;
        const s = src.getContext('2d')!;

        if (scene === 'exterior') {
          // Sky
          s.fillStyle = '#5B9BD5'; s.fillRect(0, 0, W, H * 0.45);
          // House facade
          s.fillStyle = '#C8C8C8'; s.fillRect(W * 0.05, H * 0.2, W * 0.9, H * 0.55);
          // Garage door
          s.fillStyle = '#6E6E6E'; s.fillRect(W * 0.25, H * 0.38, W * 0.35, H * 0.37);
          // Garage door panels
          s.strokeStyle = '#555'; s.lineWidth = 2;
          for (let row = 0; row < 4; row++) {
            s.strokeRect(W * 0.27, H * (0.40 + row * 0.085), W * 0.31, H * 0.08);
          }
          // Lawn
          s.fillStyle = '#3A7D44'; s.fillRect(0, H * 0.75, W, H * 0.25);
          // Driveway
          s.fillStyle = '#B0A090'; s.fillRect(W * 0.28, H * 0.75, W * 0.3, H * 0.25);
        } else {
          // Living room
          // Ceiling / walls
          s.fillStyle = '#F5F0EB'; s.fillRect(0, 0, W, H);
          // Window (bright)
          s.fillStyle = '#D0E8F5'; s.fillRect(W * 0.6, H * 0.05, W * 0.35, H * 0.4);
          // Sofa
          s.fillStyle = '#8B7355'; s.fillRect(W * 0.05, H * 0.5, W * 0.55, H * 0.3);
          // Coffee table
          s.fillStyle = '#6B4C2A'; s.fillRect(W * 0.2, H * 0.72, W * 0.3, H * 0.12);
          // Rug
          s.fillStyle = '#C4A882'; s.fillRect(W * 0.05, H * 0.65, W * 0.65, H * 0.25);
          // Accent pillows (mustard)
          s.fillStyle = '#E8B84B';
          s.fillRect(W * 0.07, H * 0.52, W * 0.1, H * 0.15);
          s.fillRect(W * 0.42, H * 0.52, W * 0.1, H * 0.15);
        }

        // Blit the zoom-cropped region of `src` into the full output canvas.
        const margin = ((1 - zoomFraction) / 2);
        ctx.drawImage(
          src,
          W * margin, H * margin,           // source top-left (crop)
          W * zoomFraction, H * zoomFraction, // source crop size
          0, 0, W, H,                         // dest: fill the whole canvas
        );
        return canvas.toDataURL();
      },
      { scene, zoomFraction },
    );
  }

  test('exterior: same scene at different zoom is caught by dHash OR pHash', async ({
    page,
    extensionId,
  }) => {
    // Two front-yard photos of the same house at different crop levels. The
    // binning uses OR logic: a pair is merged if EITHER dHash ≤ 18 OR
    // pHash ≤ 12. Simple synthetic scenes often have stable dHash across
    // zoom; real photos (with complex textures) may instead rely on pHash.
    // Either way, the pair must be caught.
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    const fullZoom  = await makeSceneDataUrl(page, 'exterior', 1.0);
    const tightZoom = await makeSceneDataUrl(page, 'exterior', 0.82);

    const { dDist, pDist } = await page.evaluate(
      async ({ a, b }) => {
        // @ts-ignore — globals exposed by sidepanel.js
        const [ha, hb] = await Promise.all([window.computeDHash(a), window.computeDHash(b)]);
        // @ts-ignore
        const [pa, pb] = await Promise.all([window.computePHash(a), window.computePHash(b)]);
        return {
          // @ts-ignore
          dDist: window.hammingDistance(ha, hb, 64),
          // @ts-ignore
          pDist: window.hammingDistance(pa, pb, 63),
        };
      },
      { a: fullZoom, b: tightZoom },
    );

    console.log(`[pHash test] exterior zoom pair — dHash: ${dDist}/64, pHash: ${pDist}/63`);
    // At least one hash must say "same scene".
    expect(dDist <= 18 || pDist <= 12).toBe(true);
  });

  test('living-room: same scene at different zoom is caught by pHash', async ({
    page,
    extensionId,
  }) => {
    // Two living-room photos at slightly different crop levels. For scenes
    // with more distributed interior detail, pHash (DCT low-frequency) is
    // the one that reliably catches the match.
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    const fullZoom  = await makeSceneDataUrl(page, 'living-room', 1.0);
    const tightZoom = await makeSceneDataUrl(page, 'living-room', 0.82);

    const { dDist, pDist } = await page.evaluate(
      async ({ a, b }) => {
        // @ts-ignore — globals exposed by sidepanel.js
        const [ha, hb] = await Promise.all([window.computeDHash(a), window.computeDHash(b)]);
        // @ts-ignore
        const [pa, pb] = await Promise.all([window.computePHash(a), window.computePHash(b)]);
        return {
          // @ts-ignore
          dDist: window.hammingDistance(ha, hb, 64),
          // @ts-ignore
          pDist: window.hammingDistance(pa, pb, 63),
        };
      },
      { a: fullZoom, b: tightZoom },
    );

    console.log(`[pHash test] living-room zoom pair — dHash: ${dDist}/64, pHash: ${pDist}/63`);
    // pHash specifically should catch this pair.
    expect(pDist).toBeLessThanOrEqual(12);
  });

  test('exterior vs living-room: high pHash distance (no false merge)', async ({
    page,
    extensionId,
  }) => {
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    const exterior    = await makeSceneDataUrl(page, 'exterior',    1.0);
    const livingRoom  = await makeSceneDataUrl(page, 'living-room', 1.0);

    const pDist = await page.evaluate(
      async ({ a, b }) => {
        // @ts-ignore — globals exposed by sidepanel.js
        const [pa, pb] = await Promise.all([window.computePHash(a), window.computePHash(b)]);
        // @ts-ignore
        return window.hammingDistance(pa, pb, 63);
      },
      { a: exterior, b: livingRoom },
    );

    console.log(`[pHash test] exterior vs living-room — pHash: ${pDist}/63`);
    expect(pDist).toBeGreaterThan(18);
  });
});
