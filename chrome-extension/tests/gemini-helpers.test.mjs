#!/usr/bin/env node
/**
 * Unit tests for the Gemini engine helpers in sidepanel.js.
 *
 * Because sidepanel.js can't be imported (Chrome APIs, DOM refs, WebLLM),
 * this file duplicates the logic under test — the same approach used by
 * phase1-classify.test.mjs for Ollama. Keep these in sync with sidepanel.js.
 *
 * Run:  node chrome-extension/tests/gemini-helpers.test.mjs
 * Exits 0 on all pass, 1 on any failure.
 */

import assert from 'node:assert/strict';

// ─── Logic duplicated from sidepanel.js (keep in sync) ───────────────────────

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

/**
 * Parses Gemini SSE stream lines into accumulated text, skipping thought parts.
 * Mirrors the loop in classifyPhotoSpace() and analyzeOneImage() in sidepanel.js.
 */
function parseGeminiSSELines(lines) {
  let text = '';
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const jsonStr = line.slice(6).trim();
    if (!jsonStr || jsonStr === '[DONE]') continue;
    try {
      const parsed = JSON.parse(jsonStr);
      const parts = parsed.candidates?.[0]?.content?.parts || [];
      text += parts.find(p => !p.thought)?.text || '';
    } catch {
      // ignore malformed lines
    }
  }
  return text;
}

/**
 * Extracts text from a non-streaming generateContent response, skipping thought parts.
 * Mirrors the classify response parsing in classifyPhotoSpace() in sidepanel.js.
 */
function extractGeminiResponseText(data) {
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.find(p => !p.thought)?.text || '';
}

/**
 * Builds the Gemini generateContent request body for classification.
 * Mirrors classifyPhotoSpace() in sidepanel.js.
 */
function buildClassifyBody(base64, mimeType, classifyPrompt) {
  return {
    contents: [{ parts: [
      { inline_data: { mime_type: mimeType, data: base64 } },
      { text: classifyPrompt },
    ]}],
    generationConfig: { temperature: 0, maxOutputTokens: 50, thinkingConfig: { thinkingBudget: 0 } },
  };
}

/**
 * Builds the Gemini streamGenerateContent request body for image analysis.
 * Mirrors analyzeOneImage() in sidepanel.js.
 */
function buildAnalyzeBody(imagesPayload, prompt, systemPrompt) {
  const parts = imagesPayload.map(url => {
    const base64 = url.includes(',') ? url.split(',')[1] : url;
    const mimeType = url.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    return { inline_data: { mime_type: mimeType, data: base64 } };
  });
  parts.push({ text: prompt });
  return {
    contents: [{ parts }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: 0.2, maxOutputTokens: 600 },
  };
}

/**
 * Pure implementation of connectGemini() that accepts a fetch function
 * and FIRESTORE_BASE so it can be tested without browser globals.
 */
async function connectGeminiPure(firestoreBase, token, fetchFn) {
  if (!token) throw new Error('Not signed in — please log in to zyphe.ai first');
  const resp = await fetchFn(`${firestoreBase}/app_config/api_keys`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Firestore status ${resp.status}`);
  const doc = await resp.json();
  const key = doc.fields?.gemini_key?.stringValue;
  if (!key || key.length < 5) throw new Error('gemini_key missing in app_config/api_keys');
  return key;
}

// ─── Test harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(() => {
        console.log(`  ✓ ${name}`);
        passed++;
      }).catch(err => {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        failed++;
      });
    }
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
  return Promise.resolve();
}

// ─── Non-streaming response parsing (thought filtering) ──────────────────────

console.log('\nGemini non-streaming response (thought filtering)');

await test('returns text part when no thought part present', () => {
  const data = { candidates: [{ content: { parts: [{ text: 'Type: Interior\nSpace: Kitchen' }] } }] };
  assert.equal(extractGeminiResponseText(data), 'Type: Interior\nSpace: Kitchen');
});

await test('skips thought part and returns answer part', () => {
  const data = { candidates: [{ content: { parts: [
    { thought: true, text: 'Let me look at the image carefully...' },
    { text: 'Type: Exterior\nSpace: Front Yard' },
  ] } }] };
  assert.equal(extractGeminiResponseText(data), 'Type: Exterior\nSpace: Front Yard');
});

await test('returns empty string when only thought part present', () => {
  const data = { candidates: [{ content: { parts: [
    { thought: true, text: 'Thinking...' },
  ] } }] };
  assert.equal(extractGeminiResponseText(data), '');
});

await test('returns empty string when candidates array is empty', () => {
  assert.equal(extractGeminiResponseText({ candidates: [] }), '');
});

await test('returns empty string when parts array is empty', () => {
  assert.equal(extractGeminiResponseText({ candidates: [{ content: { parts: [] } }] }), '');
});

// ─── SSE Parsing Tests ────────────────────────────────────────────────────────

console.log('\nGemini SSE parsing');

await test('extracts text from a single data line', () => {
  const lines = [
    'data: {"candidates":[{"content":{"parts":[{"text":"Type: Interior\\nSpace: Kitchen"}]}}]}',
  ];
  assert.equal(parseGeminiSSELines(lines), 'Type: Interior\nSpace: Kitchen');
});

await test('concatenates text across multiple chunks', () => {
  const lines = [
    'data: {"candidates":[{"content":{"parts":[{"text":"Type: "}]}}]}',
    'data: {"candidates":[{"content":{"parts":[{"text":"Interior\\nSpace: "}]}}]}',
    'data: {"candidates":[{"content":{"parts":[{"text":"Bedroom"}]}}]}',
  ];
  assert.equal(parseGeminiSSELines(lines), 'Type: Interior\nSpace: Bedroom');
});

await test('ignores non-data lines (empty, comments)', () => {
  const lines = [
    '',
    ': keep-alive',
    'data: {"candidates":[{"content":{"parts":[{"text":"Living Room"}]}}]}',
    '',
  ];
  assert.equal(parseGeminiSSELines(lines), 'Living Room');
});

await test('ignores [DONE] sentinel without throwing', () => {
  const lines = [
    'data: {"candidates":[{"content":{"parts":[{"text":"Kitchen"}]}}]}',
    'data: [DONE]',
  ];
  assert.equal(parseGeminiSSELines(lines), 'Kitchen');
});

await test('handles missing parts gracefully (returns empty string, does not throw)', () => {
  const lines = [
    'data: {"candidates":[{"content":{"parts":[]}}]}',
    'data: {"candidates":[]}',
  ];
  assert.equal(parseGeminiSSELines(lines), '');
});

await test('skips malformed JSON without throwing', () => {
  const lines = [
    'data: not-valid-json{{{',
    'data: {"candidates":[{"content":{"parts":[{"text":"Bathroom"}]}}]}',
  ];
  assert.equal(parseGeminiSSELines(lines), 'Bathroom');
});

await test('returns empty string when no data lines present', () => {
  assert.equal(parseGeminiSSELines([]), '');
  assert.equal(parseGeminiSSELines(['', ': ping', 'event: update']), '');
});

await test('skips thought parts in SSE stream', () => {
  const lines = [
    'data: {"candidates":[{"content":{"parts":[{"thought":true,"text":"Let me analyze this photo..."}]}}]}',
    'data: {"candidates":[{"content":{"parts":[{"thought":true,"text":"I can see a kitchen..."}]}}]}',
    'data: {"candidates":[{"content":{"parts":[{"text":"Type: Interior\\nSpace: Kitchen"}]}}]}',
  ];
  assert.equal(parseGeminiSSELines(lines), 'Type: Interior\nSpace: Kitchen');
});

await test('handles mixed thought and text parts in same chunk', () => {
  // Gemini sometimes puts both parts in one SSE event
  const lines = [
    'data: {"candidates":[{"content":{"parts":[{"thought":true,"text":"thinking"},{"text":"Space: Bedroom"}]}}]}',
  ];
  assert.equal(parseGeminiSSELines(lines), 'Space: Bedroom');
});

await test('accumulates non-thought text across streaming chunks', () => {
  const lines = [
    'data: {"candidates":[{"content":{"parts":[{"thought":true,"text":"thinking..."}]}}]}',
    'data: {"candidates":[{"content":{"parts":[{"text":"Space: "}]}}]}',
    'data: {"candidates":[{"content":{"parts":[{"text":"Living Room"}]}}]}',
  ];
  assert.equal(parseGeminiSSELines(lines), 'Space: Living Room');
});

// ─── parseClassificationResponse Tests (Gemini-format output) ────────────────

console.log('\nparseClassificationResponse with Gemini output');

await test('parses standard interior response', () => {
  const r = parseClassificationResponse('Type: Interior\nSpace: Kitchen', 0);
  assert.equal(r.label, 'Kitchen');
  assert.equal(r.type, 'INTERIOR');
});

await test('parses exterior response (Front Yard)', () => {
  const r = parseClassificationResponse('Type: Exterior\nSpace: Front Yard', 0);
  assert.equal(r.label, 'Front Yard');
  assert.equal(r.type, 'EXTERIOR');
});

await test('parses aerial view response', () => {
  const r = parseClassificationResponse('Type: Exterior\nSpace: Aerial View', 0);
  assert.equal(r.label, 'Aerial View');
  assert.equal(r.type, 'AERIAL');
});

await test('parses backyard and upgrades type to BACKYARD', () => {
  const r = parseClassificationResponse('Type: Exterior\nSpace: Backyard', 0);
  assert.equal(r.label, 'Backyard');
  assert.equal(r.type, 'BACKYARD');
});

await test('parses community type', () => {
  const r = parseClassificationResponse('Type: Community\nSpace: Fitness Center', 0);
  assert.equal(r.label, 'Fitness Center');
  assert.equal(r.type, 'COMMUNITY');
});

await test('falls back to Unclassified when space is unrecognized', () => {
  const r = parseClassificationResponse('Type: Interior\nSpace: Random Room XYZ', 5);
  assert.equal(r.label, 'Unclassified 5');
  assert.equal(r.type, 'INTERIOR');
});

await test('handles empty string without throwing', () => {
  const r = parseClassificationResponse('', 3);
  assert.equal(r.label, 'Unclassified 3');
  assert.equal(r.type, 'INTERIOR');
});

await test('resolves alias "garage" → Front Yard', () => {
  const r = parseClassificationResponse('Type: Exterior\nSpace: Garage', 0);
  assert.equal(r.label, 'Front Yard');
});

await test('resolves alias "patio" → Backyard', () => {
  const r = parseClassificationResponse('Type: Exterior\nSpace: Patio', 0);
  assert.equal(r.label, 'Backyard');
  assert.equal(r.type, 'BACKYARD');
});

// ─── Request body building tests ─────────────────────────────────────────────

console.log('\nGemini request body construction');

await test('buildClassifyBody sets temperature=0, maxOutputTokens=50, thinking disabled', () => {
  const body = buildClassifyBody('abc123', 'image/jpeg', 'classify this');
  assert.equal(body.generationConfig.temperature, 0);
  assert.equal(body.generationConfig.maxOutputTokens, 50);
  assert.equal(body.generationConfig.thinkingConfig?.thinkingBudget, 0);
});

await test('buildClassifyBody embeds base64 inline_data correctly', () => {
  const body = buildClassifyBody('abc123', 'image/png', 'prompt');
  const imgPart = body.contents[0].parts[0];
  assert.equal(imgPart.inline_data.mime_type, 'image/png');
  assert.equal(imgPart.inline_data.data, 'abc123');
});

await test('buildClassifyBody appends prompt as text part', () => {
  const body = buildClassifyBody('abc', 'image/jpeg', 'my prompt');
  const textPart = body.contents[0].parts[1];
  assert.equal(textPart.text, 'my prompt');
});

await test('buildAnalyzeBody strips data URI prefix from base64', () => {
  const dataUrl = 'data:image/jpeg;base64,/9j/abc123==';
  const body = buildAnalyzeBody([dataUrl], 'analyze this', 'system');
  assert.equal(body.contents[0].parts[0].inline_data.data, '/9j/abc123==');
});

await test('buildAnalyzeBody detects PNG from data URI', () => {
  const pngUrl = 'data:image/png;base64,iVBORw==';
  const body = buildAnalyzeBody([pngUrl], 'prompt', 'system');
  assert.equal(body.contents[0].parts[0].inline_data.mime_type, 'image/png');
});

await test('buildAnalyzeBody defaults to image/jpeg for non-PNG', () => {
  const jpegUrl = 'data:image/webp;base64,abc';
  const body = buildAnalyzeBody([jpegUrl], 'prompt', 'system');
  assert.equal(body.contents[0].parts[0].inline_data.mime_type, 'image/jpeg');
});

await test('buildAnalyzeBody includes system instruction', () => {
  const body = buildAnalyzeBody(['data:image/jpeg;base64,abc'], 'prompt', 'be precise');
  assert.equal(body.systemInstruction.parts[0].text, 'be precise');
});

await test('buildAnalyzeBody handles multiple images', () => {
  const urls = [
    'data:image/jpeg;base64,img1',
    'data:image/jpeg;base64,img2',
    'data:image/jpeg;base64,img3',
  ];
  const body = buildAnalyzeBody(urls, 'analyze', 'system');
  // 3 image parts + 1 text part
  assert.equal(body.contents[0].parts.length, 4);
  assert.equal(body.contents[0].parts[3].text, 'analyze');
});

// ─── connectGemini logic tests ────────────────────────────────────────────────

console.log('\nconnectGemini logic');

await test('returns API key on success', async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({ fields: { gemini_key: { stringValue: 'AIzaSy-test-key-1234' } } }),
  });
  const key = await connectGeminiPure('https://firestore.test', 'fake-token', mockFetch);
  assert.equal(key, 'AIzaSy-test-key-1234');
});

await test('throws when no auth token', async () => {
  await assert.rejects(
    () => connectGeminiPure('https://firestore.test', null, async () => {}),
    /Not signed in/
  );
});

await test('throws when Firestore returns non-ok status', async () => {
  const mockFetch = async () => ({ ok: false, status: 403 });
  await assert.rejects(
    () => connectGeminiPure('https://firestore.test', 'token', mockFetch),
    /Firestore status 403/
  );
});

await test('throws when gemini_key field is missing', async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({ fields: {} }),
  });
  await assert.rejects(
    () => connectGeminiPure('https://firestore.test', 'token', mockFetch),
    /gemini_key missing/
  );
});

await test('throws when gemini_key is too short (likely placeholder)', async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({ fields: { gemini_key: { stringValue: 'ab' } } }),
  });
  await assert.rejects(
    () => connectGeminiPure('https://firestore.test', 'token', mockFetch),
    /gemini_key missing/
  );
});

await test('passes Authorization header to Firestore', async () => {
  let capturedHeaders = null;
  const mockFetch = async (url, opts) => {
    capturedHeaders = opts?.headers;
    return {
      ok: true,
      json: async () => ({ fields: { gemini_key: { stringValue: 'AIzaSy-valid-key-xyz' } } }),
    };
  };
  await connectGeminiPure('https://firestore.test', 'my-bearer-token', mockFetch);
  assert.equal(capturedHeaders?.['Authorization'], 'Bearer my-bearer-token');
});

await test('calls the correct Firestore path', async () => {
  let capturedUrl = null;
  const mockFetch = async (url, opts) => {
    capturedUrl = url;
    return {
      ok: true,
      json: async () => ({ fields: { gemini_key: { stringValue: 'AIzaSy-valid-key-xyz' } } }),
    };
  };
  await connectGeminiPure('https://firestore.googleapis.com/v1/projects/zyphe-af0bf/databases/(default)/documents', 'token', mockFetch);
  assert.equal(capturedUrl, 'https://firestore.googleapis.com/v1/projects/zyphe-af0bf/databases/(default)/documents/app_config/api_keys');
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(54)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log('All tests passed.\n');
