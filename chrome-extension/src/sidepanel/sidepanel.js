import * as webllm from '@mlc-ai/web-llm';

// ── Firebase config (mirrors services/firebase/config.ts) ─────────────────
const FIREBASE_PROJECT_ID = 'zyphe-af0bf';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// ── State ──────────────────────────────────────────────────────────────────
let engine = null;
let engineMode = 'gemini'; // 'gemini', 'webgpu', or 'ollama'
let geminiApiKey = null;
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

// Engine tab refs
const tabGemini = document.getElementById('tab-gemini');
const tabWebgpu = document.getElementById('tab-webgpu');
const tabOllama = document.getElementById('tab-ollama');
const geminiControls = document.getElementById('gemini-controls');
const geminiStatusText = document.getElementById('gemini-status-text');
const webgpuControls = document.getElementById('webgpu-controls');
const ollamaControls = document.getElementById('ollama-controls');
const ollamaModelSelect = document.getElementById('ollama-model-select');
const refreshOllamaBtn = document.getElementById('refresh-ollama-btn');
const ollamaStatusText = document.getElementById('ollama-status-text');

async function switchEngineMode(mode) {
  engineMode = mode;
  tabGemini.classList.toggle('active', mode === 'gemini');
  tabWebgpu.classList.toggle('active', mode === 'webgpu');
  tabOllama.classList.toggle('active', mode === 'ollama');
  geminiControls.hidden = mode !== 'gemini';
  webgpuControls.hidden = mode !== 'webgpu';
  ollamaControls.hidden = mode !== 'ollama';

  if (mode === 'gemini') {
    loadModelBtn.textContent = 'Connect to Gemini';
    if (geminiApiKey) {
      setBadge('ready', 'Ready');
    } else {
      setBadge('idle', 'Not connected');
      await connectGemini();
    }
  } else if (mode === 'webgpu') {
    loadModelBtn.textContent = 'Load Model';
    setBadge(engine ? 'ready' : 'idle', engine ? 'Ready' : 'Not loaded');
  } else {
    loadModelBtn.textContent = 'Connect to Ollama';
    setBadge('idle', 'Not connected');
    await checkOllamaConnection();
  }
  updateAnalyzeBtnState();
}

tabGemini.addEventListener('click', () => switchEngineMode('gemini'));
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

// Try GET_AUTH on the active tab, then on all tabs until one succeeds.
// This handles the case where the user is on Zillow (no Firebase auth there)
// but has zyphe.ai open in another tab.
function fetchFirebaseAuth() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
      const activeId = activeTabs[0]?.id;

      function tryTab(tabId, onDone) {
        chrome.tabs.sendMessage(tabId, { type: 'GET_AUTH' }, (resp) => {
          if (!chrome.runtime.lastError && resp?.auth) {
            if (!firebaseAuth) {
              firebaseAuth = resp.auth;
              updateSaveStatus('auth-ok');
            }
          }
          onDone();
        });
      }

      if (activeId) {
        tryTab(activeId, () => {
          if (firebaseAuth?.token) { resolve(); return; }
          // Active tab had no auth — try all other tabs
          chrome.tabs.query({}, (allTabs) => {
            const others = allTabs.filter(t => t.id !== activeId);
            let remaining = others.length;
            if (remaining === 0) { resolve(); return; }
            for (const tab of others) {
              tryTab(tab.id, () => {
                remaining--;
                if (remaining === 0) resolve();
              });
            }
          });
        });
      } else {
        resolve();
      }
    });
  });
}

async function connectGemini() {
  geminiStatusText.style.color = 'var(--text-dim)';
  geminiStatusText.textContent = 'Fetching API key from Firestore…';
  try {
    if (!firebaseAuth?.token) {
      geminiStatusText.textContent = 'Looking for sign-in across open tabs…';
      await fetchFirebaseAuth();
    }
    if (!firebaseAuth?.token) throw new Error('Not signed in — please open zyphe.ai and log in, then click Connect again');
    const resp = await fetch(`${FIRESTORE_BASE}/app_config/api_keys`, {
      headers: { 'Authorization': `Bearer ${firebaseAuth.token}` },
    });
    if (!resp.ok) throw new Error(`Firestore status ${resp.status}`);
    const doc = await resp.json();
    const key = doc.fields?.gemini_key?.stringValue;
    if (!key || key.length < 5) throw new Error('gemini_key missing in app_config/api_keys');
    geminiApiKey = key;
    geminiStatusText.style.color = 'var(--success)';
    geminiStatusText.textContent = 'Connected to Gemini API ✓';
    setBadge('ready', 'Ready');
    return true;
  } catch (err) {
    geminiApiKey = null;
    geminiStatusText.style.color = 'var(--danger)';
    geminiStatusText.textContent = `Failed: ${err.message}`;
    setBadge('error', 'Not connected');
    return false;
  }
}

const scanSection = document.getElementById('scan-section');
const scanBtn = document.getElementById('scan-btn');
const scanCount = document.getElementById('scan-count');

const analysisSection = document.getElementById('analysis-section');
const analyzeAllBtn = document.getElementById('analyze-all-btn');
const analyzeSelectedBtn = document.getElementById('analyze-selected-btn');
const downloadAllBtn = document.getElementById('download-all-btn');
const stopBtn = document.getElementById('stop-btn');
const analysisProgressText = document.getElementById('analysis-progress-text');
const customPrompt = document.getElementById('custom-prompt');
const imagesGrid = document.getElementById('images-grid');

if (downloadAllBtn) {
  downloadAllBtn.addEventListener('click', downloadAllImages);
}

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
  if (engineMode === 'gemini') {
    const ok = await connectGemini();
    if (!ok) return;
    modelSection.querySelector('.card-body').style.opacity = '0.6';
    scanSection.hidden = false;
    if (extractedImages.length > 0) analysisSection.hidden = false;
    updateAnalyzeBtnState();
    return;
  }

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
// Scan the active tab for property data. When `silent` is true (auto-scan on
// side-panel open), failures stay quiet — the user didn't ask, so don't
// surface "Could not reach page" errors before they've done anything.
function runScan({ silent = false } = {}) {
  if (!silent) {
    scanBtn.disabled = true;
    scanBtn.textContent = 'Scanning…';
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) {
      if (!silent) resetScanBtn();
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, { type: 'EXTRACT_IMAGES' }, (response) => {
      if (!silent) resetScanBtn();
      if (chrome.runtime.lastError) {
        if (!silent) {
          scanCount.hidden = false;
          scanCount.style.color = 'var(--danger)';
          scanCount.textContent = 'Could not reach page. Reload the tab and try again.';
        }
        return;
      }
      const images = response?.images || [];
      const zpid = response?.zpid || null;
      const property = response?.property || null;
      // On silent auto-scan, only adopt the property if we actually got photos.
      // This avoids wiping a previously-loaded property because the panel
      // opened on a non-property tab.
      if (silent && images.length === 0) return;
      currentProperty = property;
      handleImagesFound(images, zpid);
      updateZpidDisplay(zpid);

      // Fetch Firebase auth token in background
      chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_AUTH' }, (authResponse) => {
        if (!chrome.runtime.lastError && authResponse?.auth) {
          firebaseAuth = authResponse.auth;
          updateSaveStatus('auth-ok');
          // Auto-connect Gemini once auth is available
          if (engineMode === 'gemini' && !geminiApiKey) {
            connectGemini().then(ok => {
              if (ok) {
                modelSection.querySelector('.card-body').style.opacity = '0.6';
                scanSection.hidden = false;
                if (extractedImages.length > 0) analysisSection.hidden = false;
                updateAnalyzeBtnState();
              }
            });
          }
        }
      });
    });
  });
}

scanBtn.addEventListener('click', () => runScan({ silent: false }));

function resetScanBtn() {
  scanBtn.disabled = false;
  scanBtn.textContent = '🔍 Scan for Property Photos';
}

// Auto-scan on side-panel open so a rebuild/reload doesn't force the user to
// click "Scan" again to repopulate a property that's still on the page.
runScan({ silent: true });

// Eagerly fetch Firebase auth on startup so Gemini can auto-connect without
// requiring a successful image scan first.
fetchFirebaseAuth().then(() => {
  if (engineMode === 'gemini' && !geminiApiKey && firebaseAuth?.token) {
    connectGemini().then(ok => {
      if (ok) {
        modelSection.querySelector('.card-body').style.opacity = '0.6';
        scanSection.hidden = false;
        updateAnalyzeBtnState();
      }
    });
  }
});

// Also receive live updates when the page DOM changes
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'IMAGES_UPDATED' && !isAnalyzing) {
    if (message.property) currentProperty = message.property;
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
    if (downloadAllBtn) downloadAllBtn.style.display = 'none';
    return;
  }

  scanCount.hidden = false;
  scanCount.style.color = 'var(--success)';
  scanCount.textContent = `Found ${images.length} property photo${images.length !== 1 ? 's' : ''}`;
  if (downloadAllBtn) downloadAllBtn.style.display = 'inline-block';

  images.forEach((img, idx) => {
    imagesGrid.appendChild(buildImageCard(img, idx));
  });

  if (engine) analysisSection.hidden = false;
  else analysisSection.hidden = false; // show but analyze btn will be disabled until model loads

  updateAnalyzeBtnState();
}

function updateAnalyzeBtnState() {
  const selectedCount = getSelectedIndices().length;
  const isEngineReady = engineMode === 'gemini' ? !!geminiApiKey : engineMode === 'ollama' ? !!ollamaSelectedModel : !!engine;
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

  const isEngineReady = engineMode === 'gemini' ? !!geminiApiKey : engineMode === 'ollama' ? !!ollamaSelectedModel : !!engine;

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
      <div style="display: flex; gap: 6px;">
        <button class="btn btn-secondary analyze-single-btn" id="single-btn-${idx}" ${!isEngineReady ? 'disabled' : ''} style="flex: 1;">
          Analyze this photo
        </button>
        <button class="btn btn-secondary download-offline-btn" id="download-btn-${idx}" style="padding: 5px 12px;" title="Download photo 100% offline">
          💾
        </button>
      </div>
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

  const downloadBtn = card.querySelector('.download-offline-btn');
  downloadBtn.addEventListener('click', () => {
    downloadImageOffline(idx);
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
function getTemplateTypeForSpace(spaceLabel) {
  if (!spaceLabel) return 'ALL';
  const label = spaceLabel.trim();
  const communitySpaces = ['Sports Court', 'Fitness Center', 'Clubhouse', 'Community Park'];
  if (communitySpaces.includes(label)) return 'COMMUNITY';
  if (label === 'Backyard') return 'BACKYARD';
  if (label === 'Aerial View') return 'AERIAL';
  if (label === 'Front Yard') return 'FRONT_YARD';
  if (label === 'Kitchen') return 'KITCHEN';
  if (label === 'Living Room') return 'LIVING_ROOM';
  if (label === 'Dining Room') return 'DINING_ROOM';
  if (label === 'Bedroom') return 'BEDROOM';
  if (label === 'Bathroom') return 'BATHROOM';
  if (label === 'Entryway') return 'ENTRYWAY';
  if (label === 'Floor Plan') return 'FLOOR_PLAN';
  return 'INTERIOR';
}


async function buildPrompt(imageUrl, imageIndex, hasMultipleViews = false, templateType = 'ALL') {
  // User override takes priority
  const override = customPrompt.value.trim();
  if (override) return override;

  const KNOWN_TEMPLATE_TYPES = new Set([
    'ALL', 'INTERIOR', 'EXTERIOR', 'COMMUNITY', 'BACKYARD', 'AERIAL',
    'KITCHEN', 'LIVING_ROOM', 'DINING_ROOM',
    'BEDROOM', 'BATHROOM', 'ENTRYWAY', 'FRONT_YARD', 'FLOOR_PLAN',
  ]);
  let resolvedType = templateType;
  if (templateType && !KNOWN_TEMPLATE_TYPES.has(templateType)) {
    resolvedType = getTemplateTypeForSpace(templateType);
  }

  // Phase 2 grouping/mirroring already prevents duplicate analyses, so we no
  // longer pass an "already analyzed" hint. It used to cause small models to
  // misclassify legitimate new photos as duplicates and emit a refusal.
  const memoryContext = '';

  const viewsContext = hasMultipleViews
    ? `\nMULTI-IMAGE INSTRUCTIONS:
- You are being provided with MULTIPLE photographs of the SAME space, taken from different angles.
- Examine EACH image individually before writing anything. Do not anchor on the first image alone.
- Different angles reveal different features (pools, spas, views, fixtures, far walls, ceilings, fences, hardscape) that may be cropped out of any single shot. You MUST mention every notable feature visible in ANY of the images.
- Your response must be ONE unified analysis that synthesizes evidence from ALL images. If a feature appears in only one angle, still include it.
- If two images contradict each other on a detail, mention both observations rather than picking one.
- Do not enumerate per-image findings — produce a single, coherent description of the entire space as if you walked through it.`
    : '';

  const propertyCtx = currentProperty
    ? JSON.stringify(
      Object.fromEntries(Object.entries(currentProperty).filter(([, v]) => v !== null)),
      null, 2
    )
    : 'Not available';

  // 1. Attempt to fetch the type-specific prompt from local development server
  const promptFileName = resolvedType === 'INTERIOR' ? 'photo-analysis.interior.txt'
    : resolvedType === 'BACKYARD' ? 'photo-analysis.backyard.txt'
    : resolvedType === 'AERIAL' ? 'photo-analysis.aerial.txt'
    : resolvedType === 'EXTERIOR' ? 'photo-analysis.exterior.txt'
    : resolvedType === 'COMMUNITY' ? 'photo-analysis.community.txt'
    : resolvedType === 'KITCHEN' ? 'photo-analysis.kitchen.txt'
    : resolvedType === 'LIVING_ROOM' ? 'photo-analysis.livingroom.txt'
    : resolvedType === 'DINING_ROOM' ? 'photo-analysis.diningroom.txt'
    : resolvedType === 'BEDROOM' ? 'photo-analysis.bedroom.txt'
    : resolvedType === 'BATHROOM' ? 'photo-analysis.bathroom.txt'
    : resolvedType === 'ENTRYWAY' ? 'photo-analysis.entryway.txt'
    : resolvedType === 'FRONT_YARD' ? 'photo-analysis.frontyard.txt'
    : resolvedType === 'FLOOR_PLAN' ? 'photo-analysis.floorplan.txt'
    : 'photo-analysis.txt';

  let promptTemplate = null;
  const localOrigins = ['http://localhost:5173', 'http://localhost:3000'];

  for (const origin of localOrigins) {
    try {
      const resp = await fetch(`${origin}/prompts/${promptFileName}`);
      if (resp.ok) {
        promptTemplate = await resp.text();
        console.log(`[Developer Mode] Successfully loaded dynamic prompt from ${origin}/prompts/${promptFileName}`);
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
  const fallbacksByType = {
    INTERIOR: [
      'You are a real estate photo analyst. This photo has been classified as an INTERIOR space. Fill in the template below and OUTPUT NOTHING ELSE.',
      '',
      'RULES:',
      '1. Start directly with "Space:" and output ONLY the filled fields. No intro, no closing remarks.',
      '2. Each field is a short phrase (under 8 words). Description is 3-4 sentences of grounded prose.',
      '3. Describe only what is visible. Use "Not visible" when a field cannot be observed. Do not invent.',
      '4. If the photo is aerial/unrelated, output "NA" and nothing else.',
      '',
      'Space: [the specific room shown]',
      'Style: [observed design aesthetic]',
      'Colors & Materials: [walls, floor, accents, counters, cabinets, and fixtures visible]',
      'Lighting: [natural light direction and any visible fixtures]',
      'View: [what is visible through windows, or "None visible"]',
      'Condition: [observed wear, finishes, upgrades]',
      'Description: [3-4 sentences]',
    ].join('\n'),
    EXTERIOR: [
      'You are a real estate photo analyst. This photo has been classified as a PRIVATE EXTERIOR space. Fill in the template below and OUTPUT NOTHING ELSE.',
      '',
      'RULES:',
      '1. Start directly with "Space:" and output ONLY the filled fields. No intro, no closing remarks.',
      '2. Each field is a short phrase (under 8 words). Description is 3-4 sentences of grounded prose.',
      '3. Describe only what is visible. Use "Not visible" when a field cannot be observed. Do not invent.',
      '4. If the photo is aerial/unrelated, output "NA" and nothing else.',
      '',
      'SPACE DISAMBIGUATION: Front Yard = driveway/entrance/facade. Backyard = enclosed/rear area, including any private pool, spa, or hot tub on the property.',
      '',
      'Space: [the specific exterior area]',
      'Architecture & Landscaping: [exterior style, facade, lawn, plants, hardscape]',
      'Colors: [siding, trim, roof, driveway]',
      'Outdoor Living: [patio, deck, pool, seating, or "None visible"]',
      'Views: [scenic views and privacy from neighbors/streets]',
      'Condition: [paint, siding, windows, driveway, fences]',
      'Description: [3-4 sentences]',
    ].join('\n'),
    COMMUNITY: [
      'You are a real estate photo analyst. This photo has been classified as a COMMUNITY AMENITY. Fill in the template below and OUTPUT NOTHING ELSE.',
      '',
      'RULES:',
      '1. Start directly with "Space:" and output ONLY the filled fields. No intro, no closing remarks.',
      '2. Each field is a short phrase (under 8 words). Description is 3-4 sentences of grounded prose.',
      '3. Describe only what is visible. Use "Not visible" when a field cannot be observed. Do not invent.',
      '4. If the photo is an aerial/overhead shot of the amenity, output "NA" and nothing else.',
      '',
      'Space: [the specific amenity shown]',
      'Type: [kind of amenity]',
      'Features: [equipment, surfaces, surroundings]',
      'Condition: [observed condition]',
      'Description: [3-4 sentences]',
    ].join('\n'),
  };

  return fallbacksByType[resolvedType] || fallbacksByType.INTERIOR;
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

// Transform the canonical card to display all images that were sent together to the LLM
// as a horizontal strip, then hide the individual mirror cards. The shared analysis
// renders below the strip in the canonical's existing body, so the user sees the full
// group context first and the unified description right under it.
function applyGroupStrip(canonicalIdx, sentIndices, allMemberIndices, spaceLabel) {
  const card = document.getElementById(`card-${canonicalIdx}`);
  if (!card) return;
  const wrapper = card.querySelector('.image-thumb-wrapper');
  if (!wrapper || wrapper.classList.contains('group-strip')) return;
  if (!sentIndices || sentIndices.length <= 1) return;

  const totalMembers = allMemberIndices ? allMemberIndices.length : sentIndices.length;
  const droppedCount = Math.max(0, totalMembers - sentIndices.length);

  // Detach the status badge before we wipe the wrapper — analyzeOneImage and
  // copyAnalysisToCard both reach for #status-${idx} after this transform runs,
  // so it must keep existing in the DOM.
  const statusEl = wrapper.querySelector(`#status-${canonicalIdx}`);

  wrapper.classList.add('group-strip');
  wrapper.style.height = '';
  wrapper.innerHTML = sentIndices.map(i => {
    const img = extractedImages[i];
    if (!img) return '';
    const isCanonical = i === canonicalIdx;
    return `
      <div class="group-thumb${isCanonical ? ' canonical' : ''}">
        <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt || '')}" loading="lazy"
             onerror="this.style.display='none'" />
        <span class="group-thumb-badge">#${i + 1}</span>
      </div>
    `;
  }).join('');

  const labelText = spaceLabel ? `${escapeHtml(spaceLabel)} · ` : '';
  const droppedText = droppedCount > 0 ? ` (+${droppedCount} similar)` : '';
  const pill = document.createElement('span');
  pill.className = 'group-count-pill';
  pill.textContent = `${labelText}${sentIndices.length} photos${droppedText}`;
  wrapper.appendChild(pill);

  // Re-attach the preserved status badge so downstream code can keep updating it.
  if (statusEl) wrapper.appendChild(statusEl);

  // Hide every mirror card in this group so the strip is the single visual representation.
  if (allMemberIndices) {
    for (const mIdx of allMemberIndices) {
      if (mIdx === canonicalIdx) continue;
      const mCard = document.getElementById(`card-${mIdx}`);
      if (mCard) mCard.classList.add('hidden-mirror');
    }
  }
}

// Hide the card for a photo that shares its semantic group with a canonical
// analysis. The indices are surfaced in the bottom "skipped" summary instead,
// so the grid stays focused on photos that contributed to an analysis.
function markCardAsMirror(targetIdx /* , canonicalIdx, spaceLabel */) {
  const card = document.getElementById(`card-${targetIdx}`);
  if (!card) return;
  card.classList.add('hidden-mirror');
}

function resetSkippedSummary() {
  const el = document.getElementById('skipped-summary');
  if (!el) return;
  el.hidden = true;
  el.innerHTML = '';
}

// Render a one-shot summary of photos that were classified into a semantic
// group but were NOT among the photos actually sent to the LLM for that group.
// `entries` is an array of { label, canonicalIdx, indices: number[] }.
function renderSkippedSummary(entries) {
  const el = document.getElementById('skipped-summary');
  if (!el) return;
  const nonEmpty = entries.filter(e => e.indices && e.indices.length > 0);
  if (nonEmpty.length === 0) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  const rows = nonEmpty.map(e => {
    const list = e.indices.map(i => `#${i + 1}`).join(', ');
    const labelText = e.label ? escapeHtml(e.label) : 'Unlabeled';
    return `<div class="skipped-summary-group"><span class="skipped-summary-group-label">${labelText}</span> · grouped with photo #${e.canonicalIdx + 1} · <span class="skipped-summary-indices">${list}</span></div>`;
  }).join('');
  el.innerHTML = `<div class="skipped-summary-title">Not sent to the LLM (treated as duplicates):</div>${rows}`;
  el.hidden = false;
}

async function analyzeImages(indices) {
  const isEngineReady = engineMode === 'gemini' ? !!geminiApiKey : engineMode === 'ollama' ? !!ollamaSelectedModel : !!engine;
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
    resetSkippedSummary();
    const skippedSummary = []; // { label, canonicalIdx, indices: number[] }

    // ── Phase 1 & 2: Hashing and Visual Clustering Bypassed ─────────────────
    const t1Ms = 0;
    const t2Ms = 0;
    const numCanonical = indices.length;
    const numDupes = 0;

    // Set all images to "Classifying…" while Phase 4 runs.
    for (const idx of indices) {
      const card = document.getElementById(`card-${idx}`);
      const statusEl = document.getElementById(`status-${idx}`);
      if (card) card.className = 'image-card analyzing';
      if (statusEl) {
        statusEl.className = 'image-status-badge status-analyzing';
        statusEl.textContent = 'Classifying…';
      }
    }

    // ── Phase 4: classify each image into a space label and type ─────────
    const PHASE1_CONCURRENCY = 4;
    const PHASE1_THUMB_PX = 224;
    console.log(
      `[ZypheVision][phase1-config] concurrency=${PHASE1_CONCURRENCY} thumb_px=${PHASE1_THUMB_PX} ` +
      `num_ctx=1024 num_predict=30 model=${engineMode === 'gemini' ? 'gemini-2.5-flash' : engineMode === 'ollama' ? ollamaSelectedModel : 'webllm'}`
    );
    const t4Start = performance.now();
    analysisProgressText.textContent = `Classifying spaces… (0/${indices.length})`;
    let classifyDone = 0;
    let classifyCalls = 0;
    let classifyCallMsTotal = 0;
    let classifyFetchMsTotal = 0;
    const spaceResults = new Array(indices.length); // spaceResults[i] = { label, type }
    const classifyCursor = { i: 0 };
    const classifyWorker = async () => {
      while (!signal.aborted) {
        const i = classifyCursor.i++;
        if (i >= indices.length) return;
        const idx = indices[i];
        const tFetch = performance.now();
        const thumb = await fetchImageAsDataUrl(extractedImages[idx].url, PHASE1_THUMB_PX);
        const fetchMs = performance.now() - tFetch;
        if (signal.aborted) return;
        const tCall = performance.now();
        spaceResults[i] = await classifyPhotoSpace(idx, thumb, signal);
        const callMs = performance.now() - tCall;
        classifyFetchMsTotal += fetchMs;
        classifyCallMsTotal += callMs;
        classifyCalls += 1;
        classifyDone += 1;
        analysisProgressText.textContent = `Classifying spaces… (${classifyDone}/${indices.length})`;
        console.log(
          `[ZypheVision][classify] photo ${idx} → "${spaceResults[i].label}" (${spaceResults[i].type}) ` +
          `[fetch=${Math.round(fetchMs)}ms call=${Math.round(callMs)}ms]`
        );
        // Show the Phase 4 label on the card immediately.
        setSpaceLabelBadge(idx, spaceResults[i].label);
      }
    };
    await Promise.all(Array.from({ length: Math.min(PHASE1_CONCURRENCY, indices.length) }, classifyWorker));
    const t4Ms = Math.round(performance.now() - t4Start);
    const avgCallMs = classifyCalls > 0 ? Math.round(classifyCallMsTotal / classifyCalls) : 0;
    const avgFetchMs = classifyCalls > 0 ? Math.round(classifyFetchMsTotal / classifyCalls) : 0;
    console.log(
      `[ZypheVision][phase1-summary] photos=${classifyCalls} wall_clock=${t4Ms}ms ` +
      `avg_call=${avgCallMs}ms avg_fetch=${avgFetchMs}ms throughput=${(classifyCalls / (t4Ms/1000)).toFixed(2)} photos/sec`
    );
    if (signal.aborted) return;

    // ── Phase 5: semantic grouping ─────────────────────────────────────────
    // Group all images by their space label.
    // For each unique label, the first image is the canonical.
    // The others are mirrors.
    const semanticGroups = new Map(); // label → { canonicalIdx: number, memberIndices: number[], type: string }

    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      const { label, type } = spaceResults[i];

      const existing = semanticGroups.get(label);
      if (existing !== undefined) {
        existing.memberIndices.push(idx);
        // Mark as mirror immediately
        markCardAsMirror(idx, existing.canonicalIdx, label);
        console.log(`[ZypheVision][semantic-dedup] photo ${idx} merged into ${existing.canonicalIdx} (label="${label}")`);
      } else {
        semanticGroups.set(label, {
          canonicalIdx: idx,
          memberIndices: [idx],
          type
        });
        // Reset status to "Analyzing…" for Phase 6.
        const card = document.getElementById(`card-${idx}`);
        const statusEl = document.getElementById(`status-${idx}`);
        if (card) card.className = 'image-card analyzing';
        if (statusEl) {
          statusEl.className = 'image-status-badge status-analyzing';
          statusEl.textContent = 'Analyzing…';
        }
      }
    }

    const semanticBins = Array.from(semanticGroups.entries()).map(([label, group]) => ({
      label,
      canonicalIdx: group.canonicalIdx,
      memberIndices: group.memberIndices,
      type: group.type
    }));

    const numSemantic = semanticBins.length;
    const numSemanticDupes = indices.length - numSemantic;
    console.log(`[ZypheVision][semantic-dedup] Grouped into ${numSemantic} unique semantic spaces, ${numSemanticDupes} semantic duplicates`);

    // ── Phase 6: full analysis — one canonical per unique space ───────────
    const t6Start = performance.now();
    let analyzed = 0;
    let analyzeCalls = 0;
    const analyzeBin = async ({ label, canonicalIdx, memberIndices, type }) => {
      if (signal.aborted) return;
      const idx = canonicalIdx;

      // Fetch canonical + up to 5 additional members from the same semantic group (max 6 images total).
      // 672px is the sweet spot for MiniCPM-V 2.6's tile slicer — landscape photos produce ~2 tiles
      // + 1 thumbnail, roughly half the vision tokens of 896px while keeping most of the detail benefit.
      // Stride sampling picks evenly-spaced members rather than the first N, since listing photos are
      // often shot sequentially from similar angles and consecutive members tend to be near-duplicates.
      const candidates = memberIndices.filter(mIdx => mIdx !== canonicalIdx);
      const MAX_EXTRA = 5;
      let otherMembers;
      if (candidates.length <= MAX_EXTRA) {
        otherMembers = candidates;
      } else {
        const step = candidates.length / MAX_EXTRA;
        otherMembers = Array.from({ length: MAX_EXTRA }, (_, k) => candidates[Math.floor(k * step)]);
      }
      const allIndices = [idx, ...otherMembers];
      const dataUrls = await Promise.all(
        allIndices.map(i => fetchImageAsDataUrl(extractedImages[i].url, 672))
      );
      if (signal.aborted) return;

      // Show the full group of images that will be sent to the LLM as a single
      // horizontal strip on the canonical card, and hide the individual mirror cards.
      // This lets the user see the collective context first and the shared analysis
      // right beneath it.
      if (allIndices.length > 1) {
        applyGroupStrip(idx, allIndices, memberIndices, label);
      }

      const hasMultiple = dataUrls.length > 1;
      const prompt = await buildPrompt(extractedImages[idx].url, idx, hasMultiple, type);
      analyzeCalls += 1;
      let result;
      try {
        result = await analyzeOneImage(idx, prompt, signal, dataUrls, allIndices);
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
        results.push({
          photo_index: idx,
          url: extractedImages[idx].url,
          analysis,
          score: result.score,
          group_label: label,
          group_member_indices: memberIndices.slice(),
          group_sent_indices: allIndices.slice(),
        });

        // Backfill label into all other semantic group members. None of them
        // get a visible "Same as #X" card — strip photos are represented in
        // the canonical's group strip, and photos that weren't sent to the
        // LLM (the "+N similar" bucket) are listed in the skipped-summary at
        // the bottom of the panel. We also no longer duplicate the analysis
        // text on each mirror — instead the saved entry references the
        // canonical photo via `mirror_of`.
        const sentSet = new Set(allIndices);
        const skippedHere = [];
        for (const mIdx of memberIndices) {
          if (mIdx !== canonicalIdx) {
            markCardAsMirror(mIdx);
            results.push({
              photo_index: mIdx,
              url: extractedImages[mIdx].url,
              mirror_of: idx,
              mirror_of_url: extractedImages[idx].url,
              group_label: label,
              sent_to_llm: sentSet.has(mIdx),
            });
            if (!sentSet.has(mIdx)) skippedHere.push(mIdx);
          }
        }
        if (skippedHere.length > 0) {
          skippedSummary.push({ label, canonicalIdx: idx, indices: skippedHere });
        }
      }

      analyzed += 1;
      analysisProgressText.textContent = `Analyzing… (${analyzed}/${numSemantic} unique spaces)`;
    };

    const CONCURRENCY = engineMode === 'gemini' ? 4 : engineMode === 'ollama' ? 3 : 1;
    let cursor = 0;
    const worker = async () => {
      while (!signal.aborted) {
        const item = semanticBins[cursor++];
        if (!item) return;
        await analyzeBin(item);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, numSemantic) }, worker));
    const t6Ms = Math.round(performance.now() - t6Start);

    analysisProgressText.textContent = signal.aborted ? 'Stopped.' : 'Done.';
    if (!signal.aborted) renderSkippedSummary(skippedSummary);

    const batchMs = Math.round(performance.now() - batchStart);
    console.log(
      `[ZypheVision][batch] photos=${indices.length} unique_spaces=${numSemantic} semantic_dupes=${numSemanticDupes} wall_clock_ms=${batchMs}\n` +
      `  Classify LLM (${classifyCalls} calls):  ${t4Ms} ms\n` +
      `  Analyze LLM (${analyzeCalls} calls):   ${t6Ms} ms\n` +
      `  Other (overhead):        ${batchMs - t4Ms - t6Ms} ms`
    );

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
// labels are listed first so "Living Room" wins over "Room" etc.
const ROOM_VOCABULARY = [
  'Bedroom',
  'Kitchen',
  'Living Room',
  'Dining Room',
  'Bathroom',
  'Office',
  'Laundry Room',
  'Entryway',
  'Hallway',
  'Staircase',
  'Basement',
  'Front Yard',
  'Backyard',
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
  'pool area': 'Backyard',
  'pool': 'Backyard',
  'spa': 'Backyard',
  'hot tub': 'Backyard',
  'jacuzzi': 'Backyard',
  'walk in closet': 'Bedroom',
  'walk-in closet': 'Bedroom',
  'wardrobe': 'Bedroom',
  'dressing room': 'Bedroom',
  'primary bedroom': 'Bedroom',
  'master bedroom': 'Bedroom',
  'owner’s suite': 'Bedroom',
  'owner\'s suite': 'Bedroom',
  'primary suite': 'Bedroom',
  'primary bathroom': 'Bathroom',
  'master bathroom': 'Bathroom',
  'master bath': 'Bathroom',
  'ensuite bathroom': 'Bathroom',
  'en-suite bathroom': 'Bathroom',
  'ensuite': 'Bathroom',
  'powder room': 'Bathroom',
  'half bath': 'Bathroom',
  'foyer': 'Entryway',
  'entry': 'Entryway',
  'entrance': 'Entryway',
  'vestibule': 'Entryway',
  'mudroom': 'Entryway',
  'mud room': 'Entryway',
};

// Infer the dominant space label from free-form prose. Picks the vocabulary
// term (or alias parent) that appears EARLIEST in the text — not first in
// the vocabulary list. This matters because models tend to lead with the
// actual subject ("a front yard with a garage…") and only mention other
// rooms in passing later ("…would be a great living room"). Ties are
// broken by ROOM_VOCABULARY order (longer/more-specific first), so e.g.
// "Living Room" still wins over a bare alias-style match at the same position.
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

function parseClassificationResponse(text, idx) {
  if (!text) return { label: `Unclassified ${idx}`, type: 'INTERIOR' };

  let type = 'INTERIOR';
  let label = null;

  // Extract Type line
  const typeMatch = text.match(/Type:\s*([^\n]+)/i);
  if (typeMatch) {
    const rawType = typeMatch[1].toLowerCase();
    if (rawType.includes('community')) {
      type = 'COMMUNITY';
    } else if (rawType.includes('exterior')) {
      type = 'EXTERIOR';
    } else {
      type = 'INTERIOR';
    }
  }

  // Extract Space line
  const spaceMatch = text.match(/Space:\s*([^\n]+)/i);
  const spaceText = spaceMatch ? spaceMatch[1].trim() : text;
  label = inferSpaceFromText(spaceText) || `Unclassified ${idx}`;

  // Promote specialized labels to their dedicated prompt type. The "Type:" line from
  // the classifier only distinguishes Interior/Exterior/Community, so without this
  // override a Backyard photo would route to the generic exterior prompt.
  if (label === 'Backyard') type = 'BACKYARD';
  if (label === 'Aerial View') type = 'AERIAL';
  if (label === 'Kitchen') type = 'KITCHEN';
  if (label === 'Living Room') type = 'LIVING_ROOM';
  if (label === 'Dining Room') type = 'DINING_ROOM';
  if (label === 'Bedroom') type = 'BEDROOM';
  if (label === 'Bathroom') type = 'BATHROOM';
  if (label === 'Entryway') type = 'ENTRYWAY';
  if (label === 'Front Yard') type = 'FRONT_YARD';
  if (label === 'Floor Plan') type = 'FLOOR_PLAN';

  return { label, type };
}

// Phase 2 of the batch pipeline: classify one photo into its category (type)
// and specific space label using a short, non-streaming LLM call.
const CLASSIFY_PROMPT = `Look at this real estate photo. Reply in this exact format:
Type: [Interior, Exterior, or Community]
Space: [EXACTLY ONE label from this list: Bedroom, Kitchen, Living Room, Dining Room, Bathroom, Office, Laundry Room, Entryway, Hallway, Staircase, Basement, Front Yard, Backyard, Sports Court, Fitness Center, Clubhouse, Community Park, Floor Plan, Aerial View]

Use "Type: Exterior" and "Space: Aerial View" for any overhead, drone, or bird's-eye shot showing multiple rooftops or streets.`;

async function classifyPhotoSpace(idx, dataUrl, signal) {
  try {
    let text = '';
    if (engineMode === 'gemini') {
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const mimeType = dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      const body = {
        contents: [{ parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: CLASSIFY_PROMPT },
        ]}],
        generationConfig: { temperature: 0, maxOutputTokens: 50, thinkingConfig: { thinkingBudget: 0 } },
      };
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }
      );
      if (!resp.ok) throw new Error(`Gemini API status ${resp.status}`);
      const data = await resp.json();
      const allParts = data.candidates?.[0]?.content?.parts || [];
      text = (allParts.find(p => !p.thought)?.text || '').trim();
    } else if (engineMode === 'ollama') {
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
          options: { temperature: 0, num_predict: 20, num_ctx: 1024, num_gpu: 99 },
        }),
        signal,
      });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      text = (data.message?.content || '').trim();
    } else {
      // WebGPU
      const resp = await engine.chat.completions.create({
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: CLASSIFY_PROMPT },
        ]}],
        stream: false,
        max_tokens: 20,
      });
      text = (resp.choices[0].message.content || '').trim();
    }

    const parsed = parseClassificationResponse(text, idx);
    console.log(`[ZypheVision][classify-raw] photo ${idx} raw="${text.replace(/\n/g, ' ')}" → label="${parsed.label}" type="${parsed.type}"`);
    return parsed;
  } catch (err) {
    if (!signal.aborted) console.error(`[ZypheVision] Classification failed for photo ${idx}:`, err);
    return { label: `Unclassified ${idx}`, type: 'INTERIOR' };
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
  const isEngineReady = engineMode === 'gemini' ? !!geminiApiKey : engineMode === 'ollama' ? !!ollamaSelectedModel : !!engine;
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

    if (engineMode === 'gemini') {
      const parts = dataUrls.map(url => {
        const base64 = url.includes(',') ? url.split(',')[1] : url;
        const mimeType = url.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
        return { inline_data: { mime_type: mimeType, data: base64 } };
      });
      parts.push({ text: userPrompt });
      const body = {
        contents: [{ parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 800 },
      };
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${geminiApiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }
      );
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Gemini API status ${resp.status}: ${errText.slice(0, 200)}`);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let sseCollectiveBuf = '';
      while (true) {
        if (signal.aborted) { reader.cancel(); break; }
        const { done, value } = await reader.read();
        if (done) break;
        sseCollectiveBuf += decoder.decode(value, { stream: true });
        const lines = sseCollectiveBuf.split('\n');
        sseCollectiveBuf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const parts = parsed.candidates?.[0]?.content?.parts || [];
            const delta = parts.find(p => !p.thought)?.text || '';
            fullText += delta;
            collectiveResult.textContent = fullText;
          } catch {}
        }
      }
    } else if (engineMode === 'ollama') {
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

async function analyzeOneImage(idx, prompt, signal, preloadedDataUrls = null, sentIndices = null) {
  const img = extractedImages[idx];
  if (!img) return null;

  const card = document.getElementById(`card-${idx}`);
  const resultEl = document.getElementById(`result-${idx}`);
  const statusEl = document.getElementById(`status-${idx}`);
  const singleBtn = document.getElementById(`single-btn-${idx}`);
  if (singleBtn) singleBtn.disabled = true;

  if (card) card.className = 'image-card analyzing';
  if (statusEl) {
    statusEl.className = 'image-status-badge status-analyzing';
    statusEl.textContent = 'Analyzing…';
  }

  try {
    let imagesPayload = [];
    let resolvedIndices = sentIndices;
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
      resolvedIndices = [idx];
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

    if (engineMode === 'gemini') {
      const parts = imagesPayload.map(url => {
        const base64 = url.includes(',') ? url.split(',')[1] : url;
        const mimeType = url.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
        return { inline_data: { mime_type: mimeType, data: base64 } };
      });
      parts.push({ text: prompt });
      const body = {
        contents: [{ parts }],
        systemInstruction: { parts: [{ text: 'You are a real estate photo analyst. Fill in ALL fields of EXACTLY ONE matching template. Stop immediately after the final "Description:" field. Never start a second template.' }] },
        generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
      };
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${geminiApiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }
      );
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Gemini API status ${resp.status}: ${errText.slice(0, 200)}`);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        if (signal.aborted) { reader.cancel(); break; }
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const parts = parsed.candidates?.[0]?.content?.parts || [];
            const delta = parts.find(p => !p.thought)?.text || '';
            fullText += delta;
            if (streamTextNode) streamTextNode.data = fullText;
          } catch {}
        }
      }
    } else if (engineMode === 'ollama') {
      const imgDiag = imagesPayload.map((u, i) => {
        const head = u.slice(0, 30);
        const b64 = u.includes(',') ? u.split(',')[1] : u;
        const indexStr = (resolvedIndices && resolvedIndices[i] !== undefined) ? `(photo #${resolvedIndices[i] + 1})` : '';
        return `img${i}${indexStr}[${head}…, b64len=${b64.length}]`;
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
              content: 'You are a real estate photo analyst. Fill in ALL fields of EXACTLY ONE matching template. Stop immediately after the final "Description:" field. Never start a second template.',
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
            // Sized for up to 6 images at 672px (~2 tiles + thumbnail each via MiniCPM-V's slicer)
            // plus the prompt and output. 16K leaves comfortable headroom without the KV-cache
            // allocation overhead of the model's full 32K context.
            num_ctx: 16384,
            num_predict: 500,
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
      analyzed_photo_count: results.filter(r => r.analysis != null).length,
      photos: results.map((r) => {
        // Mirror entry: just point at the canonical photo, no analysis text
        // duplicated. The reader resolves the analysis by looking up
        // `mirror_of` (or `mirror_of_url`) in the same array.
        if (r.mirror_of != null || r.mirror_of_url != null) {
          return {
            photo_index: r.photo_index ?? null,
            url: r.url,
            mirror_of: r.mirror_of ?? null,
            mirror_of_url: r.mirror_of_url ?? null,
            group_label: r.group_label ?? null,
            sent_to_llm: r.sent_to_llm ?? null,
          };
        }
        // Canonical entry: full analysis text + group bookkeeping so a reader
        // can reconstruct which photos shared this analysis.
        return {
          photo_index: r.photo_index ?? null,
          url: r.url,
          analysis: r.analysis,
          score: r.score ?? null,
          error: r.error ?? null,
          group_label: r.group_label ?? null,
          group_member_indices: r.group_member_indices ?? null,
          group_sent_indices: r.group_sent_indices ?? null,
        };
      }),
      summary_scores: results.filter(r => r.score != null).map(r => r.score),
      avg_score: results.filter(r => r.score != null).length > 0
        ? results.filter(r => r.score != null).reduce((a, b) => a + b.score, 0) /
        results.filter(r => r.score != null).length
        : null,
    }),
  };

  doc.generated_via_extension = true;

  const url = `${FIRESTORE_BASE}/properties/${currentZpid}/analysis/vision_v2`;

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

// Download a single image using the 100% offline Canvas-to-blob method with cached fetch fallback
async function downloadImageOffline(idx) {
  const card = document.getElementById(`card-${idx}`);
  if (!card) return;
  const imgEl = card.querySelector('.image-thumb-wrapper img');
  if (!imgEl) return;

  const url = imgEl.src;
  const filename = `property-photo-${idx + 1}.jpg`;

  // Persist image to Firestore if it's a remote URL
  if (url.startsWith('http')) {
    await persistImageToFirestore(url);
  }

  try {
    // 1. Try Canvas extraction (direct from GPU/RAM pixel memory, completely offline)
    const canvas = document.createElement('canvas');
    canvas.width = imgEl.naturalWidth || imgEl.width || 300;
    canvas.height = imgEl.naturalHeight || imgEl.height || 300;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    console.log(`[ZypheVision] Photo #${idx + 1} downloaded 100% offline via Canvas.`);
  } catch (err) {
    console.warn(`[ZypheVision] Canvas extraction failed (CORS taint), falling back to cached fetch:`, err);
    try {
      // 2. Fallback to fetch (resolves from local browser disk cache, indistinguishable from browser scrolling)
      const response = await fetch(url);
      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = localUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Cleanup the object URL
      setTimeout(() => URL.revokeObjectURL(localUrl), 1000);
      console.log(`[ZypheVision] Photo #${idx + 1} downloaded via cached fetch.`);
    } catch (fetchErr) {
      console.error(`[ZypheVision] Cached fetch download failed:`, fetchErr);
      // 3. Last resort fallback: open in new tab
      console.log(`[ZypheVision] Photo #${idx + 1} opened via last resort fallback (new browser tab).`);
      window.open(url, '_blank');
    }
  }
}

// Download all images sequentially using the offline-first method
async function downloadAllImages() {
  if (!downloadAllBtn) return;
  
  const originalText = downloadAllBtn.textContent;
  downloadAllBtn.disabled = true;
  
  try {
    const total = extractedImages.length;
    console.log(`[ZypheVision] Starting batch offline download of ${total} images...`);
    
    for (let idx = 0; idx < total; idx++) {
      downloadAllBtn.textContent = `💾 Saving (${idx + 1}/${total})…`;
      await downloadImageOffline(idx);
      // Brief delay to prevent browser download congestion
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    downloadAllBtn.textContent = '✅ All Saved!';
    setTimeout(() => {
      downloadAllBtn.disabled = false;
      downloadAllBtn.textContent = originalText;
    }, 2000);
  } catch (err) {
    console.error(`[ZypheVision] Batch download failed:`, err);
    downloadAllBtn.disabled = false;
    downloadAllBtn.textContent = originalText;
  }
}

// Persist an individual scraped image URL to the property's images list in Firestore if it doesn't already exist
async function persistImageToFirestore(imageUrl) {
  if (!currentZpid) {
    console.warn('[ZypheVision] No property ID (currentZpid) detected, skipping Firestore image persistence.');
    return;
  }
  if (!firebaseAuth?.token) {
    console.warn('[ZypheVision] No Firestore auth token found, skipping Firestore image persistence.');
    return;
  }
  if (!imageUrl || !imageUrl.startsWith('http')) {
    console.warn('[ZypheVision] Invalid or local/data image URL, skipping Firestore persistence:', imageUrl);
    return;
  }

  const url = `${FIRESTORE_BASE}/properties/${currentZpid}`;

  try {
    // 1. Fetch the existing property document
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${firebaseAuth.token}`,
      },
    });

    let existingImages = [];
    let fields = {};

    if (resp.ok) {
      const doc = await resp.json();
      fields = doc.fields || {};
      if (fields.images && fields.images.arrayValue && fields.images.arrayValue.values) {
        existingImages = fields.images.arrayValue.values.map(v => v.stringValue || '').filter(Boolean);
      }
    } else if (resp.status === 404) {
      console.log(`[ZypheVision] Property document for ${currentZpid} does not exist yet. Creating dynamic stub.`);
    } else {
      console.error(`[ZypheVision] Failed to fetch property ${currentZpid}:`, resp.statusText);
      return;
    }

    // 2. Avoid duplicate entry
    if (existingImages.includes(imageUrl)) {
      console.log(`[ZypheVision] Image already exists in Firestore images array for ${currentZpid}.`);
      return;
    }

    // 3. Append the new image
    existingImages.push(imageUrl);

    // Apply the converted images array to document fields
    fields.images = toFirestoreValue(existingImages);

    // Bootstrap basic metadata if document is new or lacks address/city info
    if (!fields.address && currentProperty?.address) {
      fields.address = toFirestoreValue(currentProperty.address);
    }
    if (!fields.city && currentProperty?.city) {
      fields.city = toFirestoreValue(currentProperty.city);
    }

    // Determine updateMask paths to prevent overwriting other attributes on the document
    const updateMasks = ['images'];
    if (currentProperty?.address) updateMasks.push('address');
    if (currentProperty?.city) updateMasks.push('city');

    const updateQueryParams = updateMasks.map(field => `updateMask.fieldPaths=${field}`).join('&');
    const updateUrl = `${url}?${updateQueryParams}`;

    // 4. Update the Firestore record
    const patchResp = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${firebaseAuth.token}`,
      },
      body: JSON.stringify({ fields }),
    });

    if (patchResp.ok) {
      console.log(`[ZypheVision] Successfully persisted image to Firestore for property ${currentZpid}.`);
    } else {
      const errText = await patchResp.text();
      console.error(`[ZypheVision] Failed to update property document in Firestore:`, errText);
    }
  } catch (err) {
    console.error(`[ZypheVision] Error persisting image to Firestore:`, err);
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
