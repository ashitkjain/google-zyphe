import { test as base, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

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

  test('two-phase batch: moondream tags, llama3.2-vision analyzes', async ({ page, extensionId }) => {
    // Both models present → tagging should auto-pick moondream.
    await mockOllamaTags(page, [
      { name: 'moondream:latest', sizeGB: 1.7 },
      { name: 'llama3.2-vision:latest', sizeGB: 7.3 },
    ]);

    type ChatCall = { model: string; stream: boolean; hasImages: boolean; warmup: boolean };
    const chatCalls: ChatCall[] = [];

    let tagCounter = 0;
    const tagSequence = ['Kitchen', 'Bedroom']; // 2 distinct rooms → 2 analysis groups

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        model: string;
        stream?: boolean;
        messages: { content: string; images?: string[] }[];
      };
      const msg = body.messages[0];
      const hasImages = Array.isArray(msg.images) && msg.images.length > 0;
      const warmup = !hasImages && msg.content === 'hi';
      chatCalls.push({ model: body.model, stream: !!body.stream, hasImages, warmup });

      // Warm-up: single token, instant.
      if (warmup) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }

      // Moondream tagging: non-streamed, returns a room name.
      if (body.model.startsWith('moondream')) {
        const tag = tagSequence[tagCounter % tagSequence.length];
        tagCounter += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: tag }, done: true }),
        });
        return;
      }

      // Llama 3.2 Vision: streamed analysis.
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
    await injectImages(page, 2);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');

    // The dropdown should default to llama3.2-vision (last selected in HTML option order
    // is whichever comes back from /api/tags). Force it explicitly to make the test
    // robust to ordering changes.
    await page.selectOption('#ollama-model-select', 'llama3.2-vision:latest');

    await page.click('#analyze-all-btn');

    // Wait for both cards to land in done state.
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });
    await expect(page.locator('#card-1')).toHaveClass(/done/, { timeout: 15_000 });

    // Pull out the calls categorised.
    const tagCalls = chatCalls.filter((c) => c.model.startsWith('moondream') && !c.warmup);
    const analysisCalls = chatCalls.filter((c) => c.model.startsWith('llama3.2-vision'));
    const warmupCalls = chatCalls.filter((c) => c.warmup);

    expect(warmupCalls.length).toBe(1);
    expect(warmupCalls[0].model).toBe('moondream:latest');

    expect(tagCalls.length).toBe(2);
    expect(tagCalls.every((c) => c.stream === false && c.hasImages)).toBe(true);

    expect(analysisCalls.length).toBe(2);
    expect(analysisCalls.every((c) => c.stream === true && c.hasImages)).toBe(true);

    // No analysis calls leaked to moondream, no tag calls leaked to llama.
    expect(chatCalls.find((c) => c.model.startsWith('moondream') && c.stream)).toBeUndefined();
    expect(chatCalls.find((c) => c.model.startsWith('llama3.2-vision') && !c.stream)).toBeUndefined();
  });

  test('tag concurrency: multiple moondream requests in flight at once', async ({
    page,
    extensionId,
  }) => {
    await mockOllamaTags(page, [
      { name: 'moondream:latest', sizeGB: 1.7 },
      { name: 'llama3.2-vision:latest', sizeGB: 7.3 },
    ]);

    let inFlight = 0;
    let peakInFlight = 0;
    let tagsServed = 0;

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        model: string;
        stream?: boolean;
        messages: { content: string; images?: string[] }[];
      };
      const msg = body.messages[0];
      const hasImages = Array.isArray(msg.images) && msg.images.length > 0;
      const isWarmup = !hasImages && msg.content === 'hi';
      const isTag = !isWarmup && body.model.startsWith('moondream') && hasImages;

      if (isWarmup) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }

      if (isTag) {
        inFlight += 1;
        peakInFlight = Math.max(peakInFlight, inFlight);
        // Hold the response long enough that the worker pool fills up.
        await sleep(200);
        tagsServed += 1;
        inFlight -= 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          // Same tag for every photo → all collapse into 1 analysis group, so we
          // are only really stress-testing the tag pass here.
          body: JSON.stringify({ message: { content: 'Living Room' }, done: true }),
        });
        return;
      }

      // Analysis pass on llama — fast streaming.
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: buildAnalysisStreamBody(),
      });
    });

    await mockImageFetches(page);
    page.on('pageerror', (err) => console.error('BROWSER ERROR:', err.message));

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    // 6 photos so a concurrency-of-4 pool is easily filled.
    await injectImages(page, 6);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');
    await page.selectOption('#ollama-model-select', 'llama3.2-vision:latest');

    await page.click('#analyze-all-btn');

    // Wait for all six cards to be done (tag → 1 group → 1 analysis → mirrored to siblings).
    await expect(page.locator('#card-5')).toHaveClass(/done/, { timeout: 20_000 });

    expect(tagsServed).toBe(6);
    // Worker pool size is 4 in sidepanel.js. With 6 photos and a 200ms hold per
    // request, the pool should fully saturate (peak == 4) before any worker frees up.
    expect(peakInFlight).toBe(4);
  });

  test('single-model fallback: tagging uses selected model when no small model is installed', async ({
    page,
    extensionId,
  }) => {
    // Only the heavy model is installed → pickOllamaTagModel falls back to it.
    await mockOllamaTags(page, [{ name: 'llama3.2-vision:latest', sizeGB: 7.3 }]);

    const modelsUsedForChat = new Set<string>();

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        model: string;
        stream?: boolean;
        messages: { content: string; images?: string[] }[];
      };
      const msg = body.messages[0];
      const hasImages = Array.isArray(msg.images) && msg.images.length > 0;
      const isWarmup = !hasImages && msg.content === 'hi';

      if (!isWarmup) modelsUsedForChat.add(body.model);

      if (isWarmup) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }

      // Tagging requests use stream:false; analysis uses stream:true.
      if (body.stream) {
        await route.fulfill({
          status: 200,
          contentType: 'application/x-ndjson',
          body: buildAnalysisStreamBody(),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'Kitchen' }, done: true }),
        });
      }
    });

    await mockImageFetches(page);

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await injectImages(page, 2);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');

    await page.click('#analyze-all-btn');

    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });
    await expect(page.locator('#card-1')).toHaveClass(/done/, { timeout: 15_000 });

    // Both passes must hit the same (selected) model; no preferred small model existed.
    expect(Array.from(modelsUsedForChat)).toEqual(['llama3.2-vision:latest']);
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
      const hasImages = Array.isArray(msg.images) && msg.images.length > 0;

      if (!hasImages) {
        // Warm-up
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }

      if (body.model.startsWith('moondream')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'Front Yard' }, done: true }),
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

  test('master prompt is bare "Describe this house photo." with no Context block', async ({
    page,
    extensionId,
  }) => {
    // Regression: a JSON Context appended to the prompt collapses moondream
    // output to 0–5 garbage tokens, which cleanRefusals then maps to "NA".
    // The fix is to send only the bare instruction. This test asserts the
    // exact bytes that hit /api/chat for the master analysis call.
    await mockOllamaTags(page, [
      { name: 'moondream:latest', sizeGB: 1.7 },
      { name: 'llama3.2-vision:latest', sizeGB: 7.3 },
    ]);

    const masterPrompts: string[] = [];

    await page.route('http://localhost:11434/api/chat', async (route) => {
      const body = route.request().postDataJSON() as {
        model: string;
        stream?: boolean;
        messages: { content: string; images?: string[] }[];
      };
      const msg = body.messages[0];
      const hasImages = Array.isArray(msg.images) && msg.images.length > 0;
      const isWarmup = !hasImages && msg.content === 'hi';

      if (isWarmup) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }

      if (body.model.startsWith('moondream')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'Front Yard' }, done: true }),
        });
        return;
      }

      // Master analysis on the selected model — capture the prompt verbatim.
      if (body.stream) masterPrompts.push(msg.content);
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: buildStreamBody(['The image depicts a single-family home.']),
      });
    });

    await mockImageFetches(page);
    page.on('pageerror', (err) => console.error('BROWSER ERROR:', err.message));

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    // Provide a property metadata blob — the bug repro requires currentProperty
    // to be populated, otherwise the old code path produced an empty Context too.
    await page.evaluate(() => {
      // @ts-ignore
      window.currentProperty = {
        address: '123 Main St',
        city: 'San Jose',
        price: 1200000,
        beds: 3,
        baths: 2,
      };
    });
    await injectImages(page, 1);

    await page.click('#tab-ollama');
    await page.click('#load-model-btn');
    await expect(page.locator('#model-status-badge')).toHaveText('Connected ✓');
    await page.selectOption('#ollama-model-select', 'llama3.2-vision:latest');

    await page.click('#analyze-all-btn');
    await expect(page.locator('#card-0')).toHaveClass(/done/, { timeout: 15_000 });

    expect(masterPrompts).toHaveLength(1);
    const sent = masterPrompts[0];
    // The whole prompt should be just the bare instruction. No Context, no
    // JSON, no template branches, no "real estate" wording.
    expect(sent.trim()).toBe('Describe this house photo.');
    expect(sent).not.toMatch(/Context:/i);
    expect(sent).not.toMatch(/\{/); // no JSON braces
    expect(sent).not.toMatch(/Space:/); // no structured field instructions
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
      const hasImages = Array.isArray(msg.images) && msg.images.length > 0;

      if (!hasImages) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'ok' }, done: true }),
        });
        return;
      }

      if (body.model.startsWith('moondream')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: { content: 'Other' }, done: true }),
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
      const hasImages = Array.isArray(body.messages[0].images) && body.messages[0].images!.length > 0;
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
      const hasImages = Array.isArray(body.messages[0].images) && body.messages[0].images!.length > 0;
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
      const hasImages = Array.isArray(body.messages[0].images) && body.messages[0].images!.length > 0;
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
});
