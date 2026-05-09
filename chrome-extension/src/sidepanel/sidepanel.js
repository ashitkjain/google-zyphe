import * as webllm from '@mlc-ai/web-llm';

// ── Firebase config (mirrors services/firebase/config.ts) ─────────────────
const FIREBASE_PROJECT_ID = 'zyphe-af0bf';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// ── State ──────────────────────────────────────────────────────────────────
let engine = null;
let engineMode = 'webgpu'; // 'webgpu' or 'ollama'
let ollamaSelectedModel = '';
let ollamaInstalledModels = []; // cache of /api/tags model names
let extractedImages = []; // [{ url, width, height, alt }]
let identifiedRooms = new Set(); // Track unique room names in current session
let analysisAbortController = null;
let isAnalyzing = false;
let currentZpid = null;
let currentProperty = null; // scraped metadata from the page
let firebaseAuth = null; // { token, uid, email }
let analysisStartTime = null;
let analysisTimerInterval = null;

// ── DOM refs ───────────────────────────────────────────────────────────────
// Build stamp — webpack DefinePlugin replaces __BUILD_TIME__ with the ISO
// timestamp of the bundle build. Lets you confirm at a glance which bundle
// Chrome has loaded ("did the chrome://extensions reload pick up my change?").
// eslint-disable-next-line no-undef
const __ZYPHE_BUILD_TIME__ = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev';
(() => {
  const el = document.getElementById('build-stamp');
  if (!el) return;
  const t = __ZYPHE_BUILD_TIME__;
  // Render as "build YYYY-MM-DD HH:mm" in local time so the user can
  // eyeball it against when they ran `npm run build`.
  let label = `build ${t}`;
  try {
    const d = new Date(t);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n) => String(n).padStart(2, '0');
      label = `build ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  } catch {}
  el.textContent = label;
  console.log(`[ZypheVision] bundle build time: ${t}`);
})();

const modelStatusBadge = document.getElementById('model-status-badge');
const webgpuWarning = document.getElementById('webgpu-warning');
const modelSection = document.getElementById('model-section');
const loadModelBtn = document.getElementById('load-model-btn');
const loadingProgress = document.getElementById('loading-progress');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const modelSelect = document.getElementById('model-select');
const customModelRow = document.getElementById('custom-model-row');
const customModelId = document.getElementById('custom-model-id');

// Show/hide custom model input
modelSelect.addEventListener('change', () => {
  customModelRow.hidden = modelSelect.value !== 'custom';
});

// Ollama specific refs
const tabWebgpu = document.getElementById('tab-webgpu');
const tabOllama = document.getElementById('tab-ollama');
const webgpuControls = document.getElementById('webgpu-controls');
const ollamaControls = document.getElementById('ollama-controls');
const ollamaModelSelect = document.getElementById('ollama-model-select');
const refreshOllamaBtn = document.getElementById('refresh-ollama-btn');
const ollamaStatusText = document.getElementById('ollama-status-text');

async function switchEngineMode(mode) {
  engineMode = mode;
  if (mode === 'webgpu') {
    tabWebgpu.classList.add('active');
    tabOllama.classList.remove('active');
    webgpuControls.hidden = false;
    ollamaControls.hidden = true;
    loadModelBtn.textContent = 'Load Model';
    if (engine) {
      setBadge('ready', 'Ready');
    } else {
      setBadge('idle', 'Not loaded');
    }
  } else {
    tabWebgpu.classList.remove('active');
    tabOllama.classList.add('active');
    webgpuControls.hidden = true;
    ollamaControls.hidden = false;
    loadModelBtn.textContent = 'Connect to Ollama';
    setBadge('idle', 'Not connected');
    await checkOllamaConnection();
  }
  updateAnalyzeBtnState();
}

tabWebgpu.addEventListener('click', () => switchEngineMode('webgpu'));
tabOllama.addEventListener('click', () => switchEngineMode('ollama'));

async function checkOllamaConnection() {
  ollamaStatusText.style.color = 'var(--text-dim)';
  ollamaStatusText.textContent = 'Connecting to Ollama at http://localhost:11434…';
  ollamaModelSelect.innerHTML = '<option value="">Connecting…</option>';

  try {
    const resp = await fetch('http://localhost:11434/api/tags');
    if (!resp.ok) throw new Error(`Ollama returned status ${resp.status}`);
    const data = await resp.json();
    const models = data.models || [];

    if (models.length === 0) {
      ollamaStatusText.style.color = 'var(--warning)';
      ollamaStatusText.textContent = 'Connected, but no models found. Run "ollama pull llama3.2-vision" in your terminal.';
      ollamaModelSelect.innerHTML = '<option value="">No models installed</option>';
      return false;
    }

    ollamaInstalledModels = models.map(m => m.name);

    // Filter to vision models or let user see all models
    ollamaModelSelect.innerHTML = '';
    let visionModels = models.filter(m => {
      const name = m.name.toLowerCase();
      return name.includes('vision') || 
             name.includes('paligemma') || 
             name.includes('molmo') || 
             name.includes('moondream') || 
             name.includes('llava') || 
             name.includes('minicpm') || 
             name.includes('bakllava') ||
             name.includes('qwen') ||
             name.includes('vl');
    });
    let displayModels = visionModels.length > 0 ? visionModels : models;

    displayModels.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.name;
      opt.textContent = `${m.name} (${(m.size / (1024 * 1024 * 1024)).toFixed(1)} GB)`;
      ollamaModelSelect.appendChild(opt);
    });

    ollamaSelectedModel = ollamaModelSelect.value;
    ollamaStatusText.style.color = 'var(--success)';
    ollamaStatusText.textContent = `Connected! Found ${models.length} local models.`;
    setBadge('ready', 'Ready');
    return true;
  } catch (err) {
    ollamaStatusText.style.color = 'var(--danger)';
    ollamaStatusText.textContent = 'Ollama not running. Start Ollama and click refresh 🔄';
    ollamaModelSelect.innerHTML = '<option value="">Connection Failed</option>';
    setBadge('error', 'Disconnected');
    return false;
  }
}

refreshOllamaBtn.addEventListener('click', checkOllamaConnection);
ollamaModelSelect.addEventListener('change', () => {
  ollamaSelectedModel = ollamaModelSelect.value;
});

const scanSection = document.getElementById('scan-section');
const scanBtn = document.getElementById('scan-btn');
const scanCount = document.getElementById('scan-count');

const analysisSection = document.getElementById('analysis-section');
const analyzeAllBtn = document.getElementById('analyze-all-btn');
const analyzeSelectedBtn = document.getElementById('analyze-selected-btn');
const stopBtn = document.getElementById('stop-btn');
const analysisProgressText = document.getElementById('analysis-progress-text');
const customPrompt = document.getElementById('custom-prompt');
const imagesGrid = document.getElementById('images-grid');

const collectiveAnalysisContainer = document.getElementById('collective-analysis-container');
const collectiveResult = document.getElementById('collective-result');
const closeCollectiveBtn = document.getElementById('close-collective-btn');
if (closeCollectiveBtn) {
  closeCollectiveBtn.addEventListener('click', () => {
    collectiveAnalysisContainer.hidden = true;
  });
}

// ── WebGPU check ───────────────────────────────────────────────────────────
async function checkWebGPU() {
  if (!navigator.gpu) {
    webgpuWarning.hidden = false;
    return false;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) { webgpuWarning.hidden = false; return false; }
    return true;
  } catch {
    webgpuWarning.hidden = false;
    return false;
  }
}

// ── Model loading ──────────────────────────────────────────────────────────
function setBadge(state, text) {
  modelStatusBadge.className = `badge badge-${state}`;
  modelStatusBadge.textContent = text;
}

loadModelBtn.addEventListener('click', async () => {
  if (engineMode === 'ollama') {
    const ok = await checkOllamaConnection();
    if (!ok) {
      alert('Could not connect to Ollama. Make sure the Ollama app is open and running.');
      return;
    }
    if (!ollamaSelectedModel) {
      alert('Please pull a vision model first (e.g. "ollama pull llama3.2-vision").');
      return;
    }
    setBadge('ready', 'Connected ✓');
    progressFill.style.width = '100%';
    progressText.textContent = `Ollama: Connected to ${ollamaSelectedModel} ✓`;

    // Reveal next steps
    modelSection.querySelector('.card-body').style.opacity = '0.6';
    scanSection.hidden = false;
    if (extractedImages.length > 0) analysisSection.hidden = false;
    updateAnalyzeBtnState();
    return;
  }

  const ok = await checkWebGPU();
  if (!ok) return;

  let modelId = modelSelect.value;
  if (modelId === 'custom') {
    modelId = customModelId.value.trim();
    if (!modelId) {
      alert('Please enter a custom model ID.');
      return;
    }
  }
  loadModelBtn.disabled = true;
  modelSelect.disabled = true;
  loadingProgress.hidden = false;
  setBadge('loading', 'Loading…');

  try {
    engine = await webllm.CreateMLCEngine(modelId, {
      initProgressCallback: (report) => {
        const pct = Math.round((report.progress || 0) * 100);
        progressFill.style.width = `${pct}%`;
        progressText.textContent = report.text || `Loading… ${pct}%`;
      },
      chatConfig: {
        context_window_size: 16384,
      },
    });

    progressFill.style.width = '100%';
    progressText.textContent = 'Model ready ✓';
    setBadge('ready', 'Ready');

    // Reveal next steps
    modelSection.querySelector('.card-body').style.opacity = '0.6';
    scanSection.hidden = false;
    if (extractedImages.length > 0) analysisSection.hidden = false;
    updateAnalyzeBtnState();

  } catch (err) {
    setBadge('error', 'Load failed');
    progressText.textContent = `Error: ${err.message}`;
    loadModelBtn.disabled = false;
    modelSelect.disabled = false;
    console.error('[ZypheVision] model load error', err);
  }
});

// ── Image extraction ───────────────────────────────────────────────────────
scanBtn.addEventListener('click', () => {
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning…';

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return resetScanBtn();
    chrome.tabs.sendMessage(tabs[0].id, { type: 'EXTRACT_IMAGES' }, (response) => {
      resetScanBtn();
      if (chrome.runtime.lastError) {
        scanCount.hidden = false;
        scanCount.style.color = 'var(--danger)';
        scanCount.textContent = 'Could not reach page. Reload the tab and try again.';
        return;
      }
      const images = response?.images || [];
      const zpid = response?.zpid || null;
      currentProperty = response?.property || null;
      handleImagesFound(images, zpid);
      updateZpidDisplay(zpid);

      // Fetch Firebase auth token in background
      chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_AUTH' }, (authResponse) => {
        if (!chrome.runtime.lastError && authResponse?.auth) {
          firebaseAuth = authResponse.auth;
          updateSaveStatus('auth-ok');
        }
      });
    });
  });
});

function resetScanBtn() {
  scanBtn.disabled = false;
  scanBtn.textContent = '🔍 Scan for Property Photos';
}

// Also receive live updates when the page DOM changes
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'IMAGES_UPDATED' && !isAnalyzing) {
    handleImagesFound(message.images, message.zpid);
    if (message.zpid) updateZpidDisplay(message.zpid);
  }
});

window.handleImagesFound = handleImagesFound;
window.updateZpidDisplay = updateZpidDisplay;
window.computeDHash = computeDHash;
window.computePHash = computePHash;
window.hammingDistance = hammingDistance;
// Test-only: lets Playwright tests inject scraped property metadata so the
// {{PROPERTY_CONTEXT}} substitution in buildPrompt can be exercised. The
// real flow sets `currentProperty` from a chrome.runtime.sendMessage
// response inside the module's closure, which is not reachable from a test.
window.__zypheSetCurrentProperty = (p) => { currentProperty = p; };

function handleImagesFound(images, zpid) {
  extractedImages = images;
  identifiedRooms.clear(); // Reset memory on new scan
  if (zpid) currentZpid = zpid;
  imagesGrid.innerHTML = '';

  if (images.length === 0) {
    scanCount.hidden = false;
    scanCount.style.color = 'var(--text-dim)';
    scanCount.textContent = 'No property photos found on this page.';
    return;
  }

  scanCount.hidden = false;
  scanCount.style.color = 'var(--success)';
  scanCount.textContent = `Found ${images.length} property photo${images.length !== 1 ? 's' : ''}`;

  images.forEach((img, idx) => {
    imagesGrid.appendChild(buildImageCard(img, idx));
  });

  if (engine) analysisSection.hidden = false;
  else analysisSection.hidden = false; // show but analyze btn will be disabled until model loads

  updateAnalyzeBtnState();
}

function updateAnalyzeBtnState() {
  const selectedCount = getSelectedIndices().length;
  const isEngineReady = engineMode === 'ollama' ? !!ollamaSelectedModel : !!engine;
  analyzeAllBtn.disabled = !isEngineReady || isAnalyzing || extractedImages.length === 0;
  analyzeSelectedBtn.disabled = !isEngineReady || isAnalyzing || selectedCount === 0;
  if (selectedCount > 0) {
    analyzeSelectedBtn.textContent = `📚 Analyze Selected (${selectedCount})`;
  } else {
    analyzeSelectedBtn.textContent = `📚 Analyze Selected Together`;
  }
  document.querySelectorAll('.analyze-single-btn').forEach(btn => {
    btn.disabled = !isEngineReady || isAnalyzing;
  });
}

function getSelectedIndices() {
  const checkboxes = document.querySelectorAll('.image-checkbox:checked');
  return Array.from(checkboxes).map(cb => parseInt(cb.dataset.index, 10));
}

window.toggleSelection = (idx) => {
  const card = document.getElementById(`card-${idx}`);
  const cb = card.querySelector('.image-checkbox');
  cb.checked = !cb.checked;
  card.classList.toggle('selected', cb.checked);
  updateAnalyzeBtnState();
};

// ── Image card builder ─────────────────────────────────────────────────────
function buildImageCard(img, idx) {
  const card = document.createElement('div');
  card.className = 'image-card';
  card.id = `card-${idx}`;

  const isEngineReady = engineMode === 'ollama' ? !!ollamaSelectedModel : !!engine;

  card.innerHTML = `
    <div class="image-thumb-wrapper">
      <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt)}" loading="lazy"
           onerror="this.style.display='none'" />
      <span class="image-index-badge">#${idx + 1}</span>
      <div class="image-selection-overlay">
        <input type="checkbox" class="image-checkbox" data-index="${idx}" />
      </div>
      <span class="space-label-badge" id="space-label-${idx}"></span>
      <span class="image-status-badge status-pending" id="status-${idx}">Pending</span>
    </div>
    <div class="image-card-body">
      <div class="analysis-placeholder" id="result-${idx}">
        Waiting for analysis…
      </div>
      <div class="image-url">
        <a href="${escapeHtml(img.url)}" target="_blank" rel="noopener">${truncateUrl(img.url)}</a>
      </div>
      <button class="btn btn-secondary analyze-single-btn" id="single-btn-${idx}" ${!isEngineReady ? 'disabled' : ''}>
        Analyze this photo
      </button>
    </div>
  `;

  // Bind event listeners dynamically to comply with Manifest V3 Content Security Policy (no inline onclick allowed)
  const wrapper = card.querySelector('.image-thumb-wrapper');
  wrapper.addEventListener('click', () => {
    toggleSelection(idx);
  });

  const checkbox = card.querySelector('.image-checkbox');
  checkbox.addEventListener('click', (e) => {
    e.stopPropagation();
    updateAnalyzeBtnState();
  });

  const singleBtn = card.querySelector('.analyze-single-btn');
  singleBtn.addEventListener('click', () => {
    analyzeSingle(idx);
  });

  return card;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncateUrl(url) {
  return url.length > 60 ? url.slice(0, 57) + '…' : url;
}

// Defensive post-processor: even with explicit "choose ONE template" rules
// in the prompt, capable models (minicpm-v, llama3.2-vision) sometimes
// fill in all three templates in sequence with "Not visible" / "Not
// applicable" placeholders for the irrelevant ones. The structured prompt
// reads like three labeled sections to fill, and the model defaults to
// thoroughness over selection. We strip everything from the second
// template header onward so the user only sees the one that actually
// applies. Idempotent — safe to call on already-clean output.
function trimToFirstTemplate(text) {
  if (!text) return text;

  // Find the first "Space:" — every template starts with one.
  const firstMatch = /Space\s*:/i.exec(text);
  if (!firstMatch) return text;

  // Skip past the value on the first Space line (find the end of "Space: X\n"
  // or "Space: X " followed by the next field). We search for a second "Space:"
  // anywhere in the remaining text, plus any explicit template divider.
  // Models sometimes emit fields inline (no newlines), so we can't rely on
  // line-start anchors alone — we search in the raw string.
  const afterFirstValue = firstMatch.index + firstMatch[0].length + 1; // past "Space: "
  const rest = text.slice(afterFirstValue);

  // Divider of the form "--- PRIVATE EXTERIOR ---" always marks a new template.
  const dividerMatch = /(?:^|\n)\s*-{2,}\s*(?:INTERIOR|PRIVATE EXTERIOR|COMMUNITY AMENITY)/im.exec(rest);
  // Second "Space:" — field label pattern; colon ensures we don't clip prose
  // containing the word "space" without a colon (very unlikely but safe).
  const secondSpaceMatch = /\bSpace\s*:/i.exec(rest);

  let cutAt = Infinity;
  if (dividerMatch) cutAt = Math.min(cutAt, afterFirstValue + dividerMatch.index);
  if (secondSpaceMatch) cutAt = Math.min(cutAt, afterFirstValue + secondSpaceMatch.index);

  if (cutAt < Infinity) {
    return text.slice(0, cutAt).trimEnd();
  }
  return text;
}

function cleanRefusals(text) {
  const trimmed = text.trim();
  if (!trimmed) return 'NA';
  const lower = trimmed.toLowerCase();
  // Treat only the explicit refusal phrases as NA. Missing "Space:" used to also
  // collapse to NA, but that nukes valid model output that opens with prose or
  // gets truncated before reaching the header — leaving us with no signal at all.
  const isRefusal =
    lower.startsWith("i'm sorry") ||
    lower.startsWith('i am sorry') ||
    lower.startsWith('sorry') ||
    lower.startsWith('i cannot') ||
    lower.startsWith("i can't") ||
    lower.startsWith('i am unable') ||
    lower.startsWith("i'm unable") ||
    lower.startsWith('i am not able') ||
    lower === 'na';
  return isRefusal ? 'NA' : dedupeRepeatedBlocks(text);
}

// Small vision models occasionally lock into a loop and emit the same paragraph
// (or block of paragraphs) verbatim multiple times until num_predict runs out.
// Drop any block that exactly matches one we've already seen.
function dedupeRepeatedBlocks(text) {
  const blocks = text.split(/\n{2,}/);
  if (blocks.length < 2) return text;
  const seen = new Set();
  const out = [];
  for (const block of blocks) {
    const key = block.trim().toLowerCase();
    if (!key) {
      out.push(block);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(block);
  }
  return out.join('\n\n');
}


// ── Perceptual similarity (dHash) ─────────────────────────────────────────
// Pre-computed cosine table for the 32×32 pHash DCT — same values every call.
const PHASH_N = 32;
const PHASH_COS = (() => {
  const cos = new Float64Array(PHASH_N * PHASH_N);
  for (let k = 0; k < PHASH_N; k++) {
    for (let n = 0; n < PHASH_N; n++) {
      cos[k * PHASH_N + n] = Math.cos((Math.PI / PHASH_N) * (n + 0.5) * k);
    }
  }
  return cos;
})();

// Shared hash computation from a pre-decoded Image element.
// Draws to a 9×8 canvas (dHash) and a 32×32 canvas (pHash) from the same img
// so the caller only pays one Image decode instead of two.
function computeHashesFromImage(img) {
  // dHash: 9×8 grayscale, compare each pixel to its right neighbour.
  const dc = document.createElement('canvas');
  dc.width = 9; dc.height = 8;
  const dctx = dc.getContext('2d');
  dctx.drawImage(img, 0, 0, 9, 8);
  const ddata = dctx.getImageData(0, 0, 9, 8).data;
  const gray9 = new Uint8Array(72);
  for (let i = 0; i < 72; i++) {
    gray9[i] = (0.299 * ddata[i * 4] + 0.587 * ddata[i * 4 + 1] + 0.114 * ddata[i * 4 + 2]) | 0;
  }
  let dHash = 0n;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      dHash = (dHash << 1n) | (gray9[r * 9 + c] > gray9[r * 9 + c + 1] ? 1n : 0n);
    }
  }

  // pHash: 32×32 DCT using the pre-computed cosine table.
  const N = PHASH_N;
  const pc = document.createElement('canvas');
  pc.width = N; pc.height = N;
  const pctx = pc.getContext('2d');
  pctx.drawImage(img, 0, 0, N, N);
  const pdata = pctx.getImageData(0, 0, N, N).data;
  const gray32 = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) {
    gray32[i] = 0.299 * pdata[i * 4] + 0.587 * pdata[i * 4 + 1] + 0.114 * pdata[i * 4 + 2];
  }
  const rowDct = new Float64Array(N * N);
  for (let r = 0; r < N; r++) {
    for (let k = 0; k < N; k++) {
      let sum = 0;
      for (let n = 0; n < N; n++) sum += gray32[r * N + n] * PHASH_COS[k * N + n];
      rowDct[r * N + k] = sum;
    }
  }
  const dct2d = new Float64Array(N * N);
  for (let k = 0; k < N; k++) {
    for (let k2 = 0; k2 < N; k2++) {
      let sum = 0;
      for (let r = 0; r < N; r++) sum += rowDct[r * N + k] * PHASH_COS[k2 * N + r];
      dct2d[k2 * N + k] = sum;
    }
  }
  const LOW = 8;
  const vals = [];
  for (let r = 0; r < LOW; r++) {
    for (let c = 0; c < LOW; c++) {
      if (r === 0 && c === 0) continue;
      vals.push(dct2d[r * N + c]);
    }
  }
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  let pHash = 0n;
  for (const v of vals) pHash = (pHash << 1n) | (v >= mean ? 1n : 0n);

  return { dHash, pHash };
}

// Phase 1 entry point: fetch once, decode once, compute both hashes.
// Eliminates the two extra Image.onload cycles from calling computeDHash and
// computePHash separately on the same dataUrl.
async function fetchAndComputeHashes(url) {
  const resp = await fetch(url, { mode: 'cors', cache: 'force-cache' });
  if (!resp.ok) throw new Error(`Failed to fetch image (${resp.status})`);
  const blob = await resp.blob();
  const rawDataUrl = await blobToDataUrl(blob);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        resolve(computeHashesFromImage(img));
      } catch (e) {
        resolve({ dHash: null, pHash: null });
      }
    };
    img.onerror = () => resolve({ dHash: null, pHash: null });
    img.src = rawDataUrl;
  });
}

// Fast 64-bit difference hash for "is this the same scene as that one?"
// Used to dedup multiple photos of the same space (skipping a Pass 2 call
// each) without false-merging two different rooms that share a Pass 1 tag.
//
// Algorithm: downscale to 9×8 grayscale, then for each row emit 8 bits
// where bit_n = 1 iff pixel[n] > pixel[n+1]. Returns a BigInt or null on
// decode failure. ~0.2ms on a 64-bit BigInt host.
async function computeDHash(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 9;
        canvas.height = 8;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 9, 8);
        const { data } = ctx.getImageData(0, 0, 9, 8);
        const gray = new Uint8Array(72);
        for (let i = 0; i < 72; i += 1) {
          gray[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) | 0;
        }
        let hash = 0n;
        for (let r = 0; r < 8; r += 1) {
          for (let c = 0; c < 8; c += 1) {
            hash = (hash << 1n) | (gray[r * 9 + c] > gray[r * 9 + c + 1] ? 1n : 0n);
          }
        }
        resolve(hash);
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// pHash (perceptual hash) — DCT-based 63-bit hash more robust to zoom/crop
// than dHash. Downscales to 32×32 grayscale, applies separable 2D DCT-II,
// takes the top-left 8×8 low-frequency block (64 values), drops DC [0,0],
// then encodes each remaining 63 values as above/below the block mean.
// Hamming distance empirical thresholds for real-estate photos:
//   ≤  8 : near-duplicate (same shot, slight re-encode/crop)
//   ≤ 12 : same scene, different zoom or minor crop ← merge sweet spot
//   ≤ 18 : possibly related (same property, very different angle)
//   > 18 : different scenes
async function computePHash(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const N = PHASH_N;
        const canvas = document.createElement('canvas');
        canvas.width = N;
        canvas.height = N;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, N, N);
        const { data } = ctx.getImageData(0, 0, N, N);

        const gray = new Float64Array(N * N);
        for (let i = 0; i < N * N; i++) {
          gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
        }

        const rowDct = new Float64Array(N * N);
        for (let r = 0; r < N; r++) {
          for (let k = 0; k < N; k++) {
            let sum = 0;
            for (let n = 0; n < N; n++) sum += gray[r * N + n] * PHASH_COS[k * N + n];
            rowDct[r * N + k] = sum;
          }
        }
        const dct2d = new Float64Array(N * N);
        for (let k = 0; k < N; k++) {
          for (let k2 = 0; k2 < N; k2++) {
            let sum = 0;
            for (let r = 0; r < N; r++) sum += rowDct[r * N + k] * PHASH_COS[k2 * N + r];
            dct2d[k2 * N + k] = sum;
          }
        }

        const LOW = 8;
        const vals = [];
        for (let r = 0; r < LOW; r++) {
          for (let c = 0; c < LOW; c++) {
            if (r === 0 && c === 0) continue;
            vals.push(dct2d[r * N + c]);
          }
        }
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;

        let hash = 0n;
        for (const v of vals) hash = (hash << 1n) | (v >= mean ? 1n : 0n);
        resolve(hash);
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// Hamming distance between two BigInt hashes (works for both 64-bit dHash and
// 63-bit pHash). Returns max-bits on null input so a missing hash never merges.
function hammingDistance(a, b, maxBits = 64) {
  if (a === null || b === null || a === undefined || b === undefined) return maxBits;
  let x = a ^ b;
  let n = 0n;
  while (x) { n += x & 1n; x >>= 1n; }
  return Number(n);
}

// dHash threshold: 18/64 bits — catches same-scene slightly-different-angle pairs.
const DHASH_MERGE_THRESHOLD = 12;
// pHash threshold: 12/63 bits — catches same-scene zoom/crop pairs dHash misses.
const PHASH_MERGE_THRESHOLD = 12;

// ── Prompt builder ─────────────────────────────────────────────────────────
async function buildPrompt(imageUrl, imageIndex, hasMultipleViews = false) {
  // User override takes priority
  const override = customPrompt.value.trim();
  if (override) return override;

  // Phase 2 grouping/mirroring already prevents duplicate analyses, so we no
  // longer pass an "already analyzed" hint. It used to cause small models to
  // misclassify legitimate new photos as duplicates and emit a refusal.
  const memoryContext = '';

  const viewsContext = hasMultipleViews
    ? `\nNOTE: You are being provided with multiple photos/angles of the same space (1 primary high-resolution photo and additional supporting thumbnail angles). Please synthesize details from all views to formulate a comprehensive, single unified description and analysis of the entire space.`
    : '';

  const propertyCtx = currentProperty
    ? JSON.stringify(
      Object.fromEntries(Object.entries(currentProperty).filter(([, v]) => v !== null)),
      null, 2
    )
    : 'Not available';

  // 1. Attempt to fetch prompt from local development server (Vite default is 5173, fallback to 3000)
  let promptTemplate = null;
  const localUrls = [
    'http://localhost:5173/prompts/photo-analysis.txt',
    'http://localhost:3000/prompts/photo-analysis.txt'
  ];

  for (const url of localUrls) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        promptTemplate = await resp.text();
        console.log(`[Developer Mode] Successfully loaded dynamic prompt from ${url}`);
        break;
      }
    } catch (e) {
      // Quietly fall through
    }
  }

  // 2. If dynamic prompt is successfully fetched, substitute variables and return
  if (promptTemplate) {
    const filled = promptTemplate
      .replace('{{PROPERTY_CONTEXT}}', propertyCtx)
      .replace('${propertyCtx}', propertyCtx)
      .replace('{{MEMORY_CONTEXT}}', memoryContext)
      .replace('${memoryContext}', memoryContext)
      .replace('{{VIEWS_CONTEXT}}', viewsContext)
      .replace('${viewsContext}', viewsContext);
    return filled;
  }

  // 3. Hardcoded fallback if offline / server not started / file missing.
  // Mirrors public/prompts/photo-analysis.txt (the trimmed analyst prompt).
  // Capable models (minicpm-v, llama3.2-vision) follow this cleanly; smaller
  // models would collapse on it and are intentionally not used in Pass 2.
  const fallback = [
    'You are a real estate photo analyst. Fill in the matching template for the photo.',
    '',
    'RULES:',
    '1. Start directly with "Space:" and output ONLY the filled fields. No intro, no closing remarks.',
    '2. Use exactly ONE template per photo: INTERIOR, PRIVATE EXTERIOR, or COMMUNITY AMENITY.',
    '3. Each field is a short phrase (under 8 words). Description is 3-4 sentences of grounded prose.',
    '4. Describe only what is visible. Use "Not visible" when a field cannot be observed. Do not invent.',
    '5. If the photo is an aerial, drone, or bird\'s-eye view showing multiple rooftops or streets from above, output "NA". Also output "NA" for unrelated photos (blank, blurry, screenshot).',
    '',
    'EXTERIOR DISAMBIGUATION (apply when filling Space):',
    '- Front Yard = driveway, garage door, main entrance, street view, or front-facing facade.',
    '- Backyard = enclosed, fenced, or rear-of-house outdoor area.',
    '- Community Amenity = shared neighborhood feature at eye level (park, playground, clubhouse, tennis court, community pool, trail). Aerial shots of amenities → NA.',
    '',
    '--- INTERIOR ---',
    'Space: [room name]',
    'Style: [design aesthetic]',
    'Colors: [walls / floor / accents]',
    'Materials: [floor / counters / cabinets / fixtures]',
    'Lighting: [natural and visible fixtures]',
    'View: [through windows, or "None visible"]',
    'Condition: [observed condition]',
    'Description: [3-4 sentences]',
    'Potential: [one specific upgrade]',
    '',
    '--- PRIVATE EXTERIOR ---',
    'Space: [apply disambiguation rules]',
    'Architecture: [exterior style]',
    'Colors: [siding / trim / roof / driveway]',
    'Landscaping: [lawn / plants / hardscape, or "Not visible"]',
    'Outdoor Living: [patio / deck / pool, or "None visible"]',
    'Street Context: [setback, neighbors, street feel, or "Not visible"]',
    'Condition: [paint, siding, windows, driveway, fences]',
    'Description: [3-4 sentences]',
    'Potential: [one specific improvement]',
    '',
    '--- COMMUNITY AMENITY ---',
    'Space: [amenity name]',
    'Type: [kind of amenity]',
    'Features: [equipment / surfaces / surroundings]',
    'Condition: [observed condition]',
    'Description: [3-4 sentences]',
    'Potential: [one specific local benefit]',
    '',
    `Context: ${propertyCtx}${memoryContext}${viewsContext}`,
  ].join('\n');
  return fallback;
}

// ── Analysis ───────────────────────────────────────────────────────────────
analyzeAllBtn.addEventListener('click', () => analyzeImages(extractedImages.map((_, i) => i)));
analyzeSelectedBtn.addEventListener('click', () => analyzeMultipleImages(getSelectedIndices()));

stopBtn.addEventListener('click', () => {
  if (analysisAbortController) analysisAbortController.abort();
});

window.analyzeSingle = (idx) => analyzeImages([idx]);

function setSpaceLabelBadge(idx, label) {
  const el = document.getElementById(`space-label-${idx}`);
  if (!el) return;
  el.textContent = label;
  el.classList.add('visible');
}

function copyAnalysisToCard(targetIdx, analysis, score) {
  const card = document.getElementById(`card-${targetIdx}`);
  const resultEl = document.getElementById(`result-${targetIdx}`);
  const statusEl = document.getElementById(`status-${targetIdx}`);
  const singleBtn = document.getElementById(`single-btn-${targetIdx}`);

  if (!card) return;

  // Remove any old score badges
  const oldScores = card.querySelectorAll('.curb-appeal-badge');
  oldScores.forEach(el => el.remove());

  if (resultEl) {
    resultEl.className = 'analysis-result';
    resultEl.innerHTML = escapeHtml(analysis);
    if (score !== null) {
      resultEl.insertAdjacentHTML('beforebegin', buildScoreHtml(score));
    }
  }

  card.className = 'image-card done';
  if (statusEl) {
    statusEl.className = 'image-status-badge status-done';
    statusEl.textContent = score !== null ? `Score: ${score}/10` : 'Done ✓';
  }
  if (singleBtn) singleBtn.disabled = false;
}

function markCardAsMirror(targetIdx, canonicalIdx, spaceLabel) {
  const card = document.getElementById(`card-${targetIdx}`);
  const resultEl = document.getElementById(`result-${targetIdx}`);
  const statusEl = document.getElementById(`status-${targetIdx}`);
  const singleBtn = document.getElementById(`single-btn-${targetIdx}`);
  if (!card || !resultEl) return;
  const label = spaceLabel ? ` · ${spaceLabel}` : '';
  resultEl.className = 'analysis-result mirror-ref';
  resultEl.innerHTML = `<span class="mirror-icon">↗</span> Same as photo #${canonicalIdx + 1}${escapeHtml(label)}`;
  card.className = 'image-card done mirror';
  if (statusEl) {
    statusEl.className = 'image-status-badge status-done';
    statusEl.textContent = 'Mirrored';
  }
  if (singleBtn) singleBtn.disabled = false;
}

async function analyzeImages(indices) {
  const isEngineReady = engineMode === 'ollama' ? !!ollamaSelectedModel : !!engine;
  if (!isEngineReady || isAnalyzing || indices.length === 0) return;

  isAnalyzing = true;
  analysisAbortController = new AbortController();
  const signal = analysisAbortController.signal;

  analyzeAllBtn.hidden = true;
  analyzeSelectedBtn.hidden = true;
  stopBtn.hidden = false;
  updateAnalyzeBtnState();
  startAnalysisTimer();

  try {
    const results = [];
    const batchStart = performance.now();

    // ── Phase 1: compute dHash + pHash for every image in parallel ───────────
    // fetchAndComputeHashes does one fetch + one Image decode per photo,
    // drawing to both the 9×8 (dHash) and 32×32 (pHash) canvases from the
    // same decoded img element. This is 3× fewer decode cycles vs. calling
    // fetchImageAsDataUrl + computeDHash + computePHash separately.
    analysisProgressText.textContent = `Computing signatures… (0/${indices.length})`;
    let hashDone = 0;
    const hashes = await Promise.all(
      indices.map(async (idx) => {
        const { dHash, pHash } = await fetchAndComputeHashes(extractedImages[idx].url);
        analysisProgressText.textContent = `Computing signatures… (${++hashDone}/${indices.length})`;
        return { dHash, pHash };
      })
    );
    if (signal.aborted) return;

    // ── Phase 2: bin-based clustering ─────────────────────────────────────
    // A photo joins an existing bin if EITHER its dHash distance from the bin's
    // dHash centroid is ≤ DHASH_MERGE_THRESHOLD OR its pHash distance from the
    // bin's canonical pHash is ≤ PHASH_MERGE_THRESHOLD. The dHash centroid
    // drifts via majority-vote; the pHash centroid is kept fixed at the
    // canonical's value (pHash is already robust to inter-frame drift).
    const bins = [];

    for (let i = 0; i < indices.length; i++) {
      const { dHash: dh, pHash: ph } = hashes[i];
      // Find the closest bin within either hash threshold.
      let best = null;
      let bestScore = Infinity;
      for (const bin of bins) {
        const dd = hammingDistance(dh, bin.dCentroid, 64);
        const pd = hammingDistance(ph, bin.pHashCanonical, 63);
        if (dd <= DHASH_MERGE_THRESHOLD || pd <= PHASH_MERGE_THRESHOLD) {
          const score = Math.min(dd / DHASH_MERGE_THRESHOLD, pd / PHASH_MERGE_THRESHOLD);
          if (score < bestScore) { bestScore = score; best = bin; }
        }
      }

      if (best) {
        best.memberPositions.push(i);
        // Update dHash centroid via majority-vote so edge-case photos still attach.
        if (dh !== null) {
          let newCentroid = 0n;
          for (let b = 63; b >= 0; b--) {
            best.dBitCounts[b] += Number((dh >> BigInt(b)) & 1n);
            const majority = best.dBitCounts[b] * 2 >= best.memberPositions.length ? 1n : 0n;
            newCentroid = (newCentroid << 1n) | majority;
          }
          best.dCentroid = newCentroid;
        }
      } else {
        // New bin — this photo is the canonical.
        const dBitCounts = new Array(64).fill(0);
        if (dh !== null) {
          for (let b = 0; b < 64; b++) dBitCounts[b] = Number((dh >> BigInt(b)) & 1n);
        }
        bins.push({ dCentroid: dh, pHashCanonical: ph, canonicalPos: i, memberPositions: [i], dBitCounts });
      }
    }

    const numCanonical = bins.length;
    const numDupes = indices.length - numCanonical;
    console.log(`[ZypheVision][dedup] ${indices.length} photos → ${numCanonical} bins, ${numDupes} visual duplicates`);

    // ── Phase 3: mark visual duplicates immediately ────────────────────────
    for (const bin of bins) {
      const canonicalPhotoIdx = indices[bin.canonicalPos];
      for (const memberPos of bin.memberPositions) {
        if (memberPos !== bin.canonicalPos) {
          markCardAsMirror(indices[memberPos], canonicalPhotoIdx, null);
        }
      }
    }
    if (signal.aborted) return;

    // Set all visual canonicals to "Classifying…" while Phase 4 runs.
    for (const bin of bins) {
      const idx = indices[bin.canonicalPos];
      const card = document.getElementById(`card-${idx}`);
      const statusEl = document.getElementById(`status-${idx}`);
      if (card) card.className = 'image-card analyzing';
      if (statusEl) { statusEl.className = 'image-status-badge status-analyzing'; statusEl.textContent = 'Classifying…'; }
    }

    // ── Phase 4: classify each visual canonical into a space label ─────────
    // Run the selected model on every visual canonical with a short
    // non-streaming prompt. Concurrent (up to 4). Results drive Phase 5.
    analysisProgressText.textContent = `Classifying spaces… (0/${numCanonical})`;
    let classifyDone = 0;
    const spaceLabels = new Array(bins.length); // spaceLabels[binIdx] = label string
    const classifyCursor = { i: 0 };
    const classifyWorker = async () => {
      while (!signal.aborted) {
        const binIdx = classifyCursor.i++;
        if (binIdx >= bins.length) return;
        const bin = bins[binIdx];
        const idx = indices[bin.canonicalPos];
        const thumb = await fetchImageAsDataUrl(extractedImages[idx].url, 320);
        if (signal.aborted) return;
        spaceLabels[binIdx] = await classifyPhotoSpace(idx, thumb, signal);
        classifyDone += 1;
        analysisProgressText.textContent = `Classifying spaces… (${classifyDone}/${numCanonical})`;
        console.log(`[ZypheVision][classify] photo ${idx} → "${spaceLabels[binIdx]}"`);
        // Show the Phase 4 label on the canonical card immediately.
        setSpaceLabelBadge(idx, spaceLabels[binIdx]);
        // Propagate to visual-bin members too (they're mirrors-in-waiting).
        for (const memberPos of bin.memberPositions) {
          if (memberPos !== bin.canonicalPos) setSpaceLabelBadge(indices[memberPos], spaceLabels[binIdx]);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, numCanonical) }, classifyWorker));
    if (signal.aborted) return;

    // ── Phase 5: semantic dedup — merge bins with the same space label ─────
    // canonicalForSpace tracks the FIRST bin that owns each label. Any later
    // bin with the same label is immediately marked as a mirror of that first
    // canonical, so Phase 6 never analyzes it.
    const canonicalForSpace = new Map(); // label → photoIdx of semantic canonical
    const semanticBins = []; // bins selected to go to Phase 6

    for (let binIdx = 0; binIdx < bins.length; binIdx++) {
      const bin = bins[binIdx];
      const label = spaceLabels[binIdx];
      const idx = indices[bin.canonicalPos];

      // Aerial views are skipped entirely — mark all bin members as NA now.
      if (label === 'Aerial View') {
        for (const memberPos of bin.memberPositions) {
          copyAnalysisToCard(indices[memberPos], 'NA', null);
        }
        console.log(`[ZypheVision][aerial-skip] photo ${idx} classified as Aerial View — skipped`);
        continue;
      }

      const existing = canonicalForSpace.get(label);
      if (existing !== undefined) {
        // Same space as a prior bin — mark as mirror right now (before streaming).
        markCardAsMirror(idx, existing, label);
        // Propagate to this bin's visual members too.
        for (const memberPos of bin.memberPositions) {
          if (memberPos !== bin.canonicalPos) {
            markCardAsMirror(indices[memberPos], existing, label);
          }
        }
        console.log(`[ZypheVision][semantic-dedup] photo ${idx} merged into ${existing} (label="${label}")`);
      } else {
        canonicalForSpace.set(label, idx);
        semanticBins.push({ bin, label });
        // Reset status to "Analyzing…" for Phase 6.
        const card = document.getElementById(`card-${idx}`);
        const statusEl = document.getElementById(`status-${idx}`);
        if (card) card.className = 'image-card analyzing';
        if (statusEl) { statusEl.className = 'image-status-badge status-analyzing'; statusEl.textContent = 'Analyzing…'; }
      }
    }

    const numSemantic = semanticBins.length;
    const numSemanticDupes = numCanonical - numSemantic;
    console.log(`[ZypheVision][semantic-dedup] ${numCanonical} visual bins → ${numSemantic} unique spaces, ${numSemanticDupes} semantic duplicates`);

    // ── Phase 6: full analysis — one canonical per unique space ───────────
    let analyzed = 0;
    const analyzeBin = async ({ bin, label }) => {
      if (signal.aborted) return;
      const idx = indices[bin.canonicalPos];
      const dataUrl = await fetchImageAsDataUrl(extractedImages[idx].url, 448);
      if (signal.aborted) return;

      // Prepend the Phase 4 label as a hint so the model rarely disagrees.
      const prompt = await buildPrompt(extractedImages[idx].url, idx, false);
      let result;
      try {
        result = await analyzeOneImage(idx, prompt, signal, [dataUrl]);
      } catch (err) {
        if (!signal.aborted) throw err;
        return;
      }
      if (signal.aborted) return;

      if (result && result.analysis) {
        let analysis = result.analysis.trim();
        if (!/^space\s*:/i.test(analysis) && analysis !== 'NA') {
          // Fall back to Phase 4 label if the model didn't include a Space: header.
          analysis = `Space: ${label}\n\n${analysis}`;
        }

        if (analysis !== result.analysis) copyAnalysisToCard(idx, analysis, result.score);
        results.push({ url: extractedImages[idx].url, analysis, score: result.score });

        // Backfill label into all visual bin members' mirror cards.
        for (const memberPos of bin.memberPositions) {
          if (memberPos !== bin.canonicalPos) {
            markCardAsMirror(indices[memberPos], idx, label);
            results.push({ url: extractedImages[indices[memberPos]].url, analysis, score: result.score });
          }
        }
      }

      analyzed += 1;
      analysisProgressText.textContent = `Analyzing… (${analyzed}/${numSemantic} unique spaces)`;
    };

    const CONCURRENCY = engineMode === 'ollama' ? 3 : 1;
    let cursor = 0;
    const worker = async () => {
      while (!signal.aborted) {
        const item = semanticBins[cursor++];
        if (!item) return;
        await analyzeBin(item);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, numSemantic) }, worker));

    analysisProgressText.textContent = signal.aborted ? 'Stopped.' : 'Done.';

    const batchMs = Math.round(performance.now() - batchStart);
    console.log(`[ZypheVision][batch] photos=${indices.length} visual_bins=${numCanonical} visual_dupes=${numDupes} unique_spaces=${numSemantic} semantic_dupes=${numSemanticDupes} wall_clock_ms=${batchMs}`);

    // Persist to Firestore for any multi-image batch.
    if (!signal.aborted && results.length > 0 && indices.length > 1) {
      await saveAnalysisToFirestore(results);
    }

  } catch (err) {
    if (!signal.aborted) {
      analysisProgressText.textContent = `Error: ${err.message}`;
      console.error('[ZypheVision] batch analysis error', err);
    }
  } finally {
    isAnalyzing = false;
    analyzeAllBtn.hidden = false;
    analyzeSelectedBtn.hidden = false;
    stopBtn.hidden = true;
    updateAnalyzeBtnState();
    stopAnalysisTimer();

    if (signal.aborted) {
      indices.forEach(idx => {
        const card = document.getElementById(`card-${idx}`);
        const statusEl = document.getElementById(`status-${idx}`);
        const resultEl = document.getElementById(`result-${idx}`);
        const singleBtn = document.getElementById(`single-btn-${idx}`);
        if (card && (card.classList.contains('analyzing') || card.classList.contains('fetching'))) {
          card.className = 'image-card';
          if (statusEl) {
            statusEl.className = 'image-status-badge';
            statusEl.textContent = 'Stopped';
          }
          if (resultEl && (!resultEl.textContent || resultEl.innerHTML.includes('analyzing-spinner'))) {
            resultEl.className = 'analysis-result';
            resultEl.textContent = 'Analysis stopped by user.';
          }
          if (singleBtn) singleBtn.disabled = false;
        }
      });
    }
  }
}


// Canonical vocabulary the tagger MUST choose from. Matching the model's reply
// against this fixed list is what guarantees photos of the same space share a
// group label. Order matters for matchTagToVocabulary: longer/more specific
// labels are listed first so "Primary Bedroom" wins over "Bedroom".
const ROOM_VOCABULARY = [
  'Primary Bedroom',
  'Bedroom',
  'Kitchen',
  'Living Room',
  'Dining Room',
  'Bathroom',
  'Office',
  'Laundry Room',
  'Hallway',
  'Staircase',
  'Basement',
  'Front Yard',
  'Backyard',
  'Pool Area',
  'Sports Court',
  'Fitness Center',
  'Clubhouse',
  'Community Park',
  'Floor Plan',
  'Aerial View',
];

// Aliases route subdivision-level words into their parent vocabulary bucket.
// For listing photos, garage shots are part of the front-yard scene and patio/
// deck shots are part of the backyard — splitting them creates duplicate master
// analyses of the same exterior view.
const VOCABULARY_ALIASES = {
  'garage': 'Front Yard',
  'driveway': 'Front Yard',
  'curb': 'Front Yard',
  'facade': 'Front Yard',
  'exterior': 'Front Yard',
  'patio': 'Backyard',
  'deck': 'Backyard',
  'porch': 'Backyard',
  'balcony': 'Backyard',
  'garden': 'Backyard',
};

// Infer the dominant space label from free-form prose. Picks the vocabulary
// term (or alias parent) that appears EARLIEST in the text — not first in
// the vocabulary list. This matters because models tend to lead with the
// actual subject ("a front yard with a garage…") and only mention other
// rooms in passing later ("…would be a great living room"). Ties are
// broken by ROOM_VOCABULARY order (longer/more-specific first), so e.g.
// "Primary Bedroom" still wins over "Bedroom" when both appear at the
// same position.
function inferSpaceFromText(text) {
  if (!text) return null;
  const haystack = text.toLowerCase();
  let best = null; // { pos, vocabRank, label }

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

  ROOM_VOCABULARY.forEach((label, rank) => {
    consider(label, label.toLowerCase(), rank);
  });
  // Aliases share the rank of their parent label so a direct vocab hit at
  // the same position still wins over an alias.
  Object.entries(VOCABULARY_ALIASES).forEach(([alias, label]) => {
    const parentRank = ROOM_VOCABULARY.indexOf(label);
    // Word-boundary so "garage" doesn't fire on "garaged" etc.
    consider(label, new RegExp(`\\b${alias}\\b`, 'i'), parentRank >= 0 ? parentRank : ROOM_VOCABULARY.length);
  });

  return best ? best.label : null;
}

// Phase 2 of the batch pipeline: classify one photo into a ROOM_VOCABULARY
// label using a short, non-streaming LLM call. Returns a vocab label or a
// unique "Unclassified N" placeholder so failures never false-merge.
const CLASSIFY_PROMPT = `Look at this real estate photo. Reply with EXACTLY ONE label from this list, no other text:\n${ROOM_VOCABULARY.join(', ')}\n\nUse "Aerial View" for any overhead, drone, or bird's-eye shot showing multiple rooftops or streets.`;

async function classifyPhotoSpace(idx, dataUrl, signal) {
  try {
    if (engineMode === 'ollama') {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaSelectedModel,
          messages: [{
            role: 'user',
            content: CLASSIFY_PROMPT,
            images: [dataUrl.split(',')[1] || dataUrl],
          }],
          stream: false,
          options: { temperature: 0, num_predict: 15, num_ctx: 512, num_gpu: 99, stop: ['\n'] },
        }),
        signal,
      });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      const text = (data.message?.content || '').trim();
      const label = inferSpaceFromText(text) || `Unclassified ${idx}`;
      console.log(`[ZypheVision][classify-raw] photo ${idx} raw="${text}" → label="${label}"`);
      return label;
    } else {
      // WebGPU
      const resp = await engine.chat.completions.create({
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: CLASSIFY_PROMPT },
        ]}],
        stream: false,
        max_tokens: 15,
      });
      const text = (resp.choices[0].message.content || '').trim();
      return inferSpaceFromText(text) || `Unclassified ${idx}`;
    }
  } catch (err) {
    if (!signal.aborted) console.error(`[ZypheVision] Classification failed for photo ${idx}:`, err);
    return `Unclassified ${idx}`;
  }
}

// analyzeImageGroup intentionally removed — replaced by the two-phase
// classify-then-analyze pipeline in analyzeImages().

async function analyzeImageGroup_DELETED(indices, prompt, signal, dataUrls) {
  const masterIdx = indices[0];

  // Mark all cards in group as analyzing
  indices.forEach(idx => {
    const card = document.getElementById(`card-${idx}`);
    const statusEl = document.getElementById(`status-${idx}`);
    if (card) card.className = 'image-card analyzing';
    if (statusEl) {
      statusEl.className = 'image-status-badge status-analyzing';
      statusEl.textContent = 'Analyzing…';
    }
  });

  try {
    let fullText = '';
    const resultEl = document.getElementById(`result-${masterIdx}`);
    if (resultEl) resultEl.innerHTML = '<span class="stream-cursor"></span>';

    if (engineMode === 'ollama') {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaSelectedModel,
          messages: [{
            role: 'user',
            content: prompt,
            images: dataUrls.map(url => url.split(',')[1] || url)
          }],
          stream: true,
          options: {
            temperature: 0.2,
            num_ctx: 4096
          }
        }),
        signal
      });

      if (!response.ok) throw new Error(`Ollama request failed with status ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        if (signal.aborted) {
          reader.cancel();
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;
        const chunkStr = decoder.decode(value);
        const lines = chunkStr.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const delta = parsed.message?.content || '';
            fullText += delta;

            // Update all results in the group with the stream
            indices.forEach(idx => {
              const el = document.getElementById(`result-${idx}`);
              if (el) el.innerHTML = escapeHtml(fullText) + '<span class="stream-cursor"></span>';
            });
          } catch (e) {
            // Ignore partial or malformed lines
          }
        }
      }
    } else {
      const content = dataUrls.map(url => ({ type: 'image_url', image_url: { url } }));
      content.push({ type: 'text', text: prompt });

      const stream = await engine.chat.completions.create({
        messages: [{ role: 'user', content }],
        stream: true,
        temperature: 0.1,
        max_tokens: 150,
      });

      for await (const chunk of stream) {
        if (signal.aborted) {
          stream.controller?.abort?.();
          break;
        }
        const delta = chunk.choices[0]?.delta?.content || '';
        fullText += delta;

        // Update all results in the group with the stream
        indices.forEach(idx => {
          const el = document.getElementById(`result-${idx}`);
          if (el) el.innerHTML = escapeHtml(fullText) + '<span class="stream-cursor"></span>';
        });
      }
    }

    if (signal.aborted) return null;

    // Final processing
    fullText = cleanRefusals(fullText);

    const scoreMatch = fullText.match(/(\d{1,2})\s*(?:\/\s*10|out of 10)/i) ||
      fullText.match(/score[:\s]+(\d{1,2})/i);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;

    // Extract Space for session memory
    const spaceMatch = fullText.match(/Space:\s*(.*)/i);
    if (spaceMatch && spaceMatch[1]) {
      const roomName = spaceMatch[1].trim().split(/[,\.]/)[0];
      if (roomName.length > 2) identifiedRooms.add(roomName);
    }

    const results = [];
    indices.forEach(idx => {
      const card = document.getElementById(`card-${idx}`);
      const statusEl = document.getElementById(`status-${idx}`);
      const resultEl = document.getElementById(`result-${idx}`);

      if (resultEl) {
        resultEl.className = 'analysis-result';
        resultEl.innerHTML = escapeHtml(fullText);
        if (score !== null) resultEl.insertAdjacentHTML('beforebegin', buildScoreHtml(score));
      }

      if (card) card.className = 'image-card done';
      if (statusEl) {
        statusEl.className = 'image-status-badge status-done';
        statusEl.textContent = score !== null ? `Score: ${score}/10` : 'Done ✓';
      }

      results.push({ url: extractedImages[idx].url, analysis: fullText, score });
    });

    return results;

  } catch (err) {
    if (signal.aborted) return null;

    // Automatic fallback for Ollama multi-image 500/VRAM errors
    if (engineMode === 'ollama' && indices.length > 1) {
      console.warn('[Ollama] Group analysis failed (possibly VRAM or multi-image error). Falling back to sequential analysis...', err);
      const fallbackResults = [];
      for (const idx of indices) {
        if (signal.aborted) break;
        const res = await analyzeOneImage(idx, prompt, signal);
        if (res) fallbackResults.push(res);
      }
      if (fallbackResults.length > 0) return fallbackResults;
    }

    indices.forEach(idx => {
      const card = document.getElementById(`card-${idx}`);
      const statusEl = document.getElementById(`status-${idx}`);
      const resultEl = document.getElementById(`result-${idx}`);
      if (card) card.className = 'image-card error';
      if (statusEl) { statusEl.className = 'image-status-badge status-error'; statusEl.textContent = 'Error'; }
      if (resultEl) { resultEl.className = 'analysis-result'; resultEl.textContent = `Error: ${err.message}`; }
    });
    return null;
  }
}

async function analyzeMultipleImages(indices) {
  const isEngineReady = engineMode === 'ollama' ? !!ollamaSelectedModel : !!engine;
  if (!isEngineReady || isAnalyzing || indices.length === 0) return;
  if (indices.length > 5) {
    alert("Please select at most 5 images for collective analysis to avoid VRAM limits.");
    return;
  }

  isAnalyzing = true;
  analysisAbortController = new AbortController();
  const signal = analysisAbortController.signal;

  analyzeAllBtn.hidden = true;
  analyzeSelectedBtn.hidden = true;
  stopBtn.hidden = false;
  updateAnalyzeBtnState();
  startAnalysisTimer();

  collectiveAnalysisContainer.hidden = false;
  collectiveResult.innerHTML = '<span class="analyzing-spinner"></span>Fetching images…';
  collectiveAnalysisContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    // 1. Fetch all selected images
    const dataUrls = await Promise.all(
      indices.map(async (idx) => {
        const img = extractedImages[idx];
        return await fetchImageAsDataUrl(img.url);
      })
    );

    if (signal.aborted) throw new Error("Aborted");

    // 2. Build multi-modal prompt
    const userPrompt = customPrompt.value.trim() ||
      "Review these property photos together. Provide a summary of the property's overall condition, aesthetic consistency, and any standout features or concerns visible across the set.";

    const content = dataUrls.map(url => ({
      type: 'image_url',
      image_url: { url }
    }));
    content.push({
      type: 'text',
      text: userPrompt
    });

    // 3. Run analysis
    collectiveResult.innerHTML = '<span class="stream-cursor"></span>';
    let fullText = '';

    if (engineMode === 'ollama') {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaSelectedModel,
          messages: [{
            role: 'user',
            content: userPrompt,
            images: dataUrls.map(url => url.split(',')[1] || url) // strip data URI prefix
          }],
          stream: true,
          options: {
            temperature: 0.1,
            num_ctx: 16384
          }
        }),
        signal
      });

      if (!response.ok) throw new Error(`Ollama request failed with status ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        if (signal.aborted) {
          reader.cancel();
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;
        const chunkStr = decoder.decode(value);
        // Ollama streams JSON lines
        const lines = chunkStr.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const delta = parsed.message?.content || '';
            fullText += delta;
            collectiveResult.innerHTML = escapeHtml(fullText) + '<span class="stream-cursor"></span>';
          } catch (e) {
            // Ignore partial or malformed lines
          }
        }
      }
    } else {
      const stream = await engine.chat.completions.create({
        messages: [{ role: 'user', content }],
        stream: true,
        temperature: 0.1,
        max_tokens: 500,
      });

      for await (const chunk of stream) {
        if (signal.aborted) {
          stream.controller?.abort?.();
          break;
        }
        const delta = chunk.choices[0]?.delta?.content || '';
        fullText += delta;
        collectiveResult.innerHTML = escapeHtml(fullText) + '<span class="stream-cursor"></span>';
      }
    }

    collectiveResult.innerHTML = escapeHtml(fullText);

  } catch (err) {
    if (!signal.aborted) {
      collectiveResult.textContent = `Error: ${err.message}`;
      console.error('[ZypheVision] collective analysis error', err);
    }
  } finally {
    isAnalyzing = false;
    analyzeAllBtn.hidden = false;
    analyzeSelectedBtn.hidden = false;
    stopBtn.hidden = true;
    updateAnalyzeBtnState();
    stopAnalysisTimer();
  }
}

async function analyzeOneImage(idx, prompt, signal, preloadedDataUrls = null) {
  const img = extractedImages[idx];
  if (!img) return null;

  const card = document.getElementById(`card-${idx}`);
  const resultEl = document.getElementById(`result-${idx}`);
  const statusEl = document.getElementById(`status-${idx}`);
  const singleBtn = document.getElementById(`single-btn-${idx}`);
  if (singleBtn) singleBtn.disabled = true;

  card.className = 'image-card analyzing';
  statusEl.className = 'image-status-badge status-analyzing';
  statusEl.textContent = 'Analyzing…';

  try {
    let imagesPayload = [];
    if (preloadedDataUrls) {
      if (Array.isArray(preloadedDataUrls)) {
        imagesPayload = preloadedDataUrls;
      } else {
        imagesPayload = [preloadedDataUrls];
      }
    } else {
      resultEl.innerHTML = '<span class="analyzing-spinner"></span>Fetching image…';
      const masterUrl = await fetchImageAsDataUrl(img.url);
      imagesPayload = [masterUrl];
    }

    if (signal.aborted) return null;

    resultEl.innerHTML = '<span class="analyzing-spinner"></span>Running…';

    // Stream the response.
    // Use a raw Text node so we can append deltas without rebuilding innerHTML
    // on every chunk (the previous approach was O(n²): escapeHtml on the full
    // accumulated string for every token). Text nodes are XSS-safe by definition.
    let fullText = '';
    resultEl.innerHTML = '';
    const streamTextNode = document.createTextNode('');
    const streamCursor = document.createElement('span');
    streamCursor.className = 'stream-cursor';
    resultEl.appendChild(streamTextNode);
    resultEl.appendChild(streamCursor);

    if (engineMode === 'ollama') {
      const imgDiag = imagesPayload.map((u, i) => {
        const head = u.slice(0, 30);
        const b64 = u.includes(',') ? u.split(',')[1] : u;
        return `img${i}[${head}…, b64len=${b64.length}]`;
      }).join(' ');
      console.log(`[ZypheVision][master idx=${idx}] model=${ollamaSelectedModel} prompt=`, JSON.stringify(prompt), `${imgDiag}`);
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaSelectedModel,
          messages: [
            {
              role: 'system',
              content: 'You are a real estate photo analyst. Fill in ALL fields of EXACTLY ONE matching template. Stop immediately after the final "Potential:" field. Never start a second template.',
            },
            {
              role: 'user',
              content: prompt,
              images: imagesPayload.map(url => url.split(',')[1] || url),
            },
          ],
          stream: true,
          options: {
            temperature: 0.2,
            num_ctx: 4096,
            num_predict: 350,
            num_gpu: 99,     // offload all layers to GPU (no-op if already fully offloaded)
            stop: ['Space: Not', '\nSpace: N', 'USE TEMPLATE', '\n\nSpace:'],
          }
        }),
        signal
      });

      if (!response.ok) throw new Error(`Ollama request failed with status ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let streamError = null;
      let lastParsed = null;
      let buf = '';

      while (true) {
        if (signal.aborted) {
          reader.cancel();
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            lastParsed = parsed;
            if (parsed.error) {
              streamError = String(parsed.error);
              continue;
            }
            const delta = parsed.message?.content || '';
            fullText += delta;
            streamTextNode.data = fullText;
          } catch (e) {
            console.warn(`[ZypheVision][master idx=${idx}] failed to parse stream line:`, JSON.stringify(line).slice(0, 200), e.message);
          }
        }
      }
      // Drain any final non-newline-terminated line.
      if (buf.trim()) {
        try {
          const parsed = JSON.parse(buf);
          lastParsed = parsed;
          if (parsed.error) streamError = String(parsed.error);
          else fullText += parsed.message?.content || '';
        } catch (e) {
          console.warn(`[ZypheVision][master idx=${idx}] failed to parse trailing buffer:`, JSON.stringify(buf).slice(0, 200));
        }
      }
      console.log(`[ZypheVision][master idx=${idx}] raw output (${fullText.length} chars):`, JSON.stringify(fullText));
      if (lastParsed) {
        const { done_reason, eval_count, prompt_eval_count, total_duration } = lastParsed;
        console.log(`[ZypheVision][master idx=${idx}] final chunk:`, JSON.stringify({ done_reason, eval_count, prompt_eval_count, total_duration, error: streamError }));
      }
      if (!fullText && streamError) {
        // Surface the underlying Ollama error instead of silently rendering "NA".
        fullText = `Ollama error: ${streamError}`;
      } else if (!fullText && lastParsed && lastParsed.done_reason && lastParsed.done_reason !== 'stop') {
        fullText = `Ollama returned no tokens (done_reason=${lastParsed.done_reason}). Image may have failed to decode for this model.`;
      }
    } else {
      const content = imagesPayload.map(url => ({ type: 'image_url', image_url: { url } }));
      content.push({ type: 'text', text: prompt });

      const stream = await engine.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: content
          }
        ],
        stream: true,
        temperature: 0.1,
        max_tokens: 150,
      });

      for await (const chunk of stream) {
        if (signal.aborted) {
          stream.controller?.abort?.();
          break;
        }
        const delta = chunk.choices[0]?.delta?.content || '';
        fullText += delta;
        if (streamTextNode) streamTextNode.data = fullText;
      }
    }

    // Final render with score highlighting
    const beforeClean = fullText;
    fullText = cleanRefusals(fullText);
    if (beforeClean !== fullText) {
      console.log(`[ZypheVision][master idx=${idx}] cleanRefusals rewrote: ${JSON.stringify(beforeClean).slice(0, 200)} → ${JSON.stringify(fullText).slice(0, 200)}`);
    }
    // Strip any extra templates the model emitted in violation of the
    // "choose ONE template" rule.
    const beforeTrim = fullText;
    fullText = trimToFirstTemplate(fullText);
    if (beforeTrim !== fullText) {
      console.log(`[ZypheVision][master idx=${idx}] trimmed extra template(s): kept ${fullText.length}/${beforeTrim.length} chars`);
    }

    const scoreMatch = fullText.match(/(\d{1,2})\s*(?:\/\s*10|out of 10)/i) ||
      fullText.match(/score[:\s]+(\d{1,2})/i) ||
      fullText.match(/appeal[:\s]+(\d{1,2})/i);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;

    // Extract Space/Room name for session memory
    const spaceMatch = fullText.match(/Space:\s*(.*)/i);
    if (spaceMatch && spaceMatch[1]) {
      const roomName = spaceMatch[1].trim().split(/[,\.]/)[0]; // get first part of room name
      if (roomName.length > 2 && roomName.length < 30) {
        identifiedRooms.add(roomName);
      }
    }

    resultEl.className = 'analysis-result';
    resultEl.innerHTML = escapeHtml(fullText);
    if (score !== null) {
      const scoreHtml = buildScoreHtml(score);
      resultEl.insertAdjacentHTML('beforebegin', scoreHtml);
    }
    card.className = 'image-card done';
    statusEl.className = 'image-status-badge status-done';
    statusEl.textContent = score !== null ? `Score: ${score}/10` : 'Done ✓';
    if (singleBtn) singleBtn.disabled = false;

    return { url: img.url, analysis: fullText, score };

  } catch (err) {
    if (signal.aborted) return null;
    card.className = 'image-card error';
    statusEl.className = 'image-status-badge status-error';
    statusEl.textContent = 'Error';
    resultEl.className = 'analysis-result';
    resultEl.textContent = `Error: ${err.message}`;
    console.error('[ZypheVision] analysis error', err);
    if (singleBtn) singleBtn.disabled = false;
    return { url: img.url, analysis: null, score: null, error: err.message };
  }
}

function buildScoreHtml(score) {
  const pct = Math.min(score / 10, 1) * 100;
  const color = score >= 8 ? 'var(--success)' : score >= 5 ? 'var(--accent)' : 'var(--danger)';
  return `
    <div class="score-row">
      <span class="score-label">Appeal Score</span>
      <span class="score-value" style="color:${color}">${score}<span style="font-size:12px;font-weight:400;color:var(--text-dim)">/10</span></span>
    </div>
    <div class="score-bar-bg">
      <div class="score-bar-fill" style="width:${pct}%;background:${color}"></div>
    </div>
  `;
}

// ── Image fetching helper ──────────────────────────────────────────────────
async function fetchImageAsDataUrl(url, maxDim = 800) {
  // Extensions can fetch cross-origin with host_permissions
  const resp = await fetch(url, { mode: 'cors', cache: 'force-cache' });
  if (!resp.ok) throw new Error(`Failed to fetch image (${resp.status})`);
  const blob = await resp.blob();
  const rawDataUrl = await blobToDataUrl(blob);

  // Downscale images to maxDim to avoid VRAM overload / 500 errors in Ollama,
  // while keeping them perfectly crisp for vision LLM understanding.
  return await resizeImageDataUrl(rawDataUrl, maxDim);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function resizeImageDataUrl(dataUrl, maxDim = 800) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width <= maxDim && height <= maxDim) {
        resolve(dataUrl);
        return;
      }

      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8)); // 80% compressed JPEG is highly efficient
    };
    img.onerror = () => {
      resolve(dataUrl); // fallback to original on error
    };
    img.src = dataUrl;
  });
}

// ── Firestore persistence ──────────────────────────────────────────────────

function updateZpidDisplay(zpid) {
  let el = document.getElementById('zpid-row');
  if (!el) {
    el = document.createElement('div');
    el.id = 'zpid-row';
    el.style.cssText = 'font-size:11px;color:var(--text-dim);margin-top:6px;';
    document.querySelector('.analysis-controls .card-body')?.appendChild(el);
  }
  el.innerHTML = zpid
    ? `Property: <strong style="color:var(--text)">${zpid}</strong> <span id="save-status"></span>`
    : `<span style="color:var(--warning)">⚠ Could not detect property ID — results won't be saved to Firestore</span>`;
}

function updateSaveStatus(state, detail = '') {
  const el = document.getElementById('save-status');
  if (!el) return;
  const map = {
    'auth-ok': '· <span style="color:var(--success)">Signed in ✓</span>',
    'saving': '· <span style="color:var(--accent)">Saving…</span>',
    'saved': `· <span style="color:var(--success)">Saved to Firestore ✓</span>`,
    'save-err': `· <span style="color:var(--danger)">Save failed: ${detail}</span>`,
    'no-auth': '· <span style="color:var(--warning)">Not signed in — open zyphe.ai and log in</span>',
  };
  el.innerHTML = map[state] || '';
}

// Convert JS value → Firestore REST field value
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFirestoreValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = toFirestoreValue(v);
  return fields;
}

async function saveAnalysisToFirestore(results) {
  if (!currentZpid) { updateSaveStatus('save-err', 'no property ID detected'); return; }
  if (!firebaseAuth?.token) { updateSaveStatus('no-auth'); return; }

  updateSaveStatus('saving');

  const doc = {
    fields: toFirestoreFields({
      analyzed_at: new Date().toISOString(),
      model: document.getElementById('model-select')?.value || 'Phi-3.5-vision-instruct-q4f16_1-MLC',
      prompt: customPrompt.value.trim(),
      photo_count: results.length,
      photos: results.map((r) => ({
        url: r.url,
        analysis: r.analysis,
        score: r.score ?? null,
        error: r.error ?? null,
      })),
      summary_scores: results.filter(r => r.score != null).map(r => r.score),
      avg_score: results.filter(r => r.score != null).length > 0
        ? results.filter(r => r.score != null).reduce((a, b) => a + b.score, 0) /
        results.filter(r => r.score != null).length
        : null,
    }),
  };

  const url = `${FIRESTORE_BASE}/properties/${currentZpid}/analysis/vision_extension`;

  try {
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${firebaseAuth.token}`,
      },
      body: JSON.stringify(doc),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: { message: resp.statusText } }));
      throw new Error(err?.error?.message || resp.statusText);
    }

    updateSaveStatus('saved');
  } catch (err) {
    console.error('[ZypheVision] Firestore save error', err);
    updateSaveStatus('save-err', err.message);
  }
}

function startAnalysisTimer() {
  const timerEl = document.getElementById('analysis-timer');
  if (!timerEl) return;

  clearInterval(analysisTimerInterval);
  analysisStartTime = Date.now();
  timerEl.hidden = false;
  timerEl.textContent = '⏱️ 0.0s';

  analysisTimerInterval = setInterval(() => {
    const elapsed = ((Date.now() - analysisStartTime) / 1000).toFixed(1);
    timerEl.textContent = `⏱️ ${elapsed}s`;
  }, 100);
}

function stopAnalysisTimer() {
  clearInterval(analysisTimerInterval);
  const timerEl = document.getElementById('analysis-timer');
  if (timerEl && analysisStartTime) {
    const elapsed = ((Date.now() - analysisStartTime) / 1000).toFixed(1);
    const wasAborted = analysisAbortController && analysisAbortController.signal.aborted;
    if (wasAborted) {
      timerEl.textContent = `⏱️ Stopped at ${elapsed}s`;
    } else {
      timerEl.textContent = `⏱️ Finished in ${elapsed}s`;
    }
  }
}

function clearAnalysisTimer() {
  clearInterval(analysisTimerInterval);
  const timerEl = document.getElementById('analysis-timer');
  if (timerEl) {
    timerEl.hidden = true;
  }
}

// ── Init ───────────────────────────────────────────────────────────────────
(async () => {
  const hasGpu = await checkWebGPU();
  if (!hasGpu) {
    loadModelBtn.disabled = true;
    setBadge('error', 'No WebGPU');
  }
})();
