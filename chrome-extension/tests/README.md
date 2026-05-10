# Phase 1 Classification Tests

Regression tests for the LLM space-classifier (`classifyPhotoSpace` in `sidepanel.js`). Each test runs the production `CLASSIFY_PROMPT` against `minicpm-v` via local Ollama on a property's photos and compares results to a per-property gold-standard fixture.

## Layout

```
tests/
├── README.md                                            (this file)
├── phase1-classify.test.mjs                             (test runner, ESM)
└── fixtures/
    ├── 4129-grant-ct-pleasanton-ca-94566.json          (gold labels, committed)
    └── 4129-grant-ct-pleasanton-ca-94566.urls.json     (image URLs, NOT committed)
```

The gold file holds the canonical `(label, type)` for each photo of a property. The URL file holds the matching list of image URLs in the same order. URL files are kept out of git because they're large, easy to regenerate, and tied to a specific listing snapshot.

## Setup

Requires Node 18+ (built-in `fetch`) and Ollama running locally with `minicpm-v` pulled:

```bash
ollama pull minicpm-v
ollama serve
```

Optional (recommended for production-parity): install `sharp` so the test resizes images to 224px before sending to Ollama, matching production behavior:

```bash
npm install --no-save sharp
```

Without `sharp` the test sends full-resolution images, which usually produces slightly higher accuracy than production (more vision tiles) but is still a useful regression signal.

## Capturing image URLs

For each property you want to test:

1. Open the listing in your browser, open the Zyphe sidepanel, click **Scan page**.
2. Open devtools on the sidepanel, switch to the Console tab.
3. Run:

   ```js
   copy(JSON.stringify(extractedImages.map(i => i.url), null, 2))
   ```

4. Paste the clipboard contents into `tests/fixtures/<property>.urls.json`, where `<property>` matches the basename of the gold file.

## Running

```bash
node chrome-extension/tests/phase1-classify.test.mjs
```

By default this runs the `4129-grant-ct-pleasanton-ca-94566` fixture. Override with `PROPERTY=<basename>` to run others:

```bash
PROPERTY=other-property-fixture node chrome-extension/tests/phase1-classify.test.mjs
```

Other env knobs: `OLLAMA_URL`, `MINICPM_MODEL`, `CONCURRENCY`.

## Output

The runner reports per-photo correctness, summary stats (label-only match, type-only match, full match), and average per-photo latency. It exits `0` when everything matches gold, `1` on any mismatch, `2` on fatal error (URLs missing, Ollama unreachable, etc.).

## Adding new properties

1. Run the extension on a new property and capture the classifier output (the `[ZypheVision][classify]` console logs).
2. Translate the logs into a new gold fixture at `tests/fixtures/<basename>.json`. Use the existing fixture as a template — the structure is `{ property: {...}, notes: [...], photos: [{idx, label, type}, ...] }`.
3. Capture URLs as above and save to `tests/fixtures/<basename>.urls.json`.
4. Run with `PROPERTY=<basename>`.

## Keeping the test in sync with production

`phase1-classify.test.mjs` duplicates these constants from `src/sidepanel/sidepanel.js`:

- `CLASSIFY_PROMPT`
- `ROOM_VOCABULARY`
- `VOCABULARY_ALIASES`
- `inferSpaceFromText` and `parseClassificationResponse`
- The `classify` request body (`num_predict`, `num_ctx`, etc.)
- `IMAGE_RESIZE_MAX_DIM`

If you change any of those in `sidepanel.js`, mirror the change in the test file.
