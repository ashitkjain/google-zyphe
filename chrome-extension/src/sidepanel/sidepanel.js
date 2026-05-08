import * as webllm from '@mlc-ai/web-llm';

// ── Firebase config (mirrors services/firebase/config.ts) ─────────────────
const FIREBASE_PROJECT_ID = 'zyphe-af0bf';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// ── State ──────────────────────────────────────────────────────────────────
let engine = null;
let engineMode = 'webgpu'; // 'webgpu' or 'ollama'
let ollamaSelectedModel = '';
let ollamaInstalledModels = []; // cache of /api/tags model names
let ollamaWarmedModels = new Set(); // models we've already pre-warmed this session
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
    return promptTemplate
      .replace('{{PROPERTY_CONTEXT}}', propertyCtx)
      .replace('${propertyCtx}', propertyCtx)
      .replace('{{MEMORY_CONTEXT}}', memoryContext)
      .replace('${memoryContext}', memoryContext)
      .replace('{{VIEWS_CONTEXT}}', viewsContext)
      .replace('${viewsContext}', viewsContext);
  }

  // 3. Hardcoded fallback if offline / server not started / file missing.
  // The model now self-tags by emitting "Space: <label>" as its first line,
  // so we no longer need a separate tagging pass.
  return `Describe this house photo.\n\nThe very first line of your reply MUST be exactly:\nSpace: <one of: ${ROOM_VOCABULARY.join(', ')}, Other>\n\nThen a blank line, then 2-4 sentences of plain description of what is visible.\n`;
}

// ── Analysis ───────────────────────────────────────────────────────────────
analyzeAllBtn.addEventListener('click', () => analyzeImages(extractedImages.map((_, i) => i)));
analyzeSelectedBtn.addEventListener('click', () => analyzeMultipleImages(getSelectedIndices()));

stopBtn.addEventListener('click', () => {
  if (analysisAbortController) analysisAbortController.abort();
});

window.analyzeSingle = (idx) => analyzeImages([idx]);

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
    // Phase 1 (separate vocabulary tagger) was removed: small models running
    // a quick "what room is this" pass were noisy enough to either over-merge
    // distinct rooms or split the same room across groups, neither of which
    // helped. The main analysis pass now self-tags by emitting
    // "Space: <label>" as its first line, and post-hoc dedup via
    // `canonicalBySpace` collapses duplicates after the fact.
    const groups = {};
    indices.forEach(idx => { groups[`Photo ${idx}`] = [idx]; });
    const groupNames = Object.keys(groups);
    const results = [];

    // Phase 2: Grouped Analysis with Master-and-Mirror Deduplication
    // Build a flat plan of groups that still need work, then run masters in
    // parallel via a worker pool so total wall-clock = ceil(N / concurrency)
    // master analyses instead of N.
    const groupPlans = groupNames
      .map(name => ({
        name,
        indices: groups[name].filter(idx => !document.getElementById(`card-${idx}`)?.classList.contains('done')),
      }))
      .filter(g => g.indices.length > 0);

    // Mark every non-master sibling as Queued upfront — no spinner, no
    // "Linking..." state. They aren't doing work; they're waiting on a master.
    groupPlans.forEach(plan => {
      const masterIdx = plan.indices[0];
      plan.indices.slice(1).forEach(idx => {
        const card = document.getElementById(`card-${idx}`);
        const statusEl = document.getElementById(`status-${idx}`);
        const resultEl = document.getElementById(`result-${idx}`);
        if (card) card.className = 'image-card';
        if (statusEl) {
          statusEl.className = 'image-status-badge status-pending';
          statusEl.textContent = 'Queued';
        }
        if (resultEl) {
          resultEl.innerHTML = `<em>Queued — will mirror analysis from Master Photo #${masterIdx + 1}.</em>`;
        }
      });
    });

    // Post-master merge guard: maps a normalized declared Space (e.g.
    // "front yard") to the canonical { analysis, score, masterIdx } from the
    // first master that declared it. When a later master self-declares the
    // same Space — even though the tagger split them into different groups —
    // we mirror the canonical result over the duplicate so the user sees one
    // consistent write-up per space.
    const canonicalBySpace = new Map();
    const extractSpaceKey = (text) => {
      const m = text && text.match(/Space:\s*(.+)/i);
      if (!m) return null;
      const raw = m[1].trim().split(/[,\.\n]/)[0].trim().toLowerCase();
      return raw.length >= 3 ? raw : null;
    };

    let groupsCompleted = 0;
    const runGroup = async (plan) => {
      if (signal.aborted) return;
      const toAnalyze = plan.indices;
      const masterIdx = toAnalyze[0];
      const restOfGroup = toAnalyze.slice(1);

      // Fetch Master Photo (800px) and up to 3 Sibling Photos (150px) as supportive thumbnails for rich context with zero VRAM overhead
      const masterDataUrl = await fetchImageAsDataUrl(extractedImages[masterIdx].url, 448);
      const imagesPayload = [masterDataUrl];

      // Ollama's Llama 3.2 Vision engine only supports exactly ONE image per prompt request.
      // Sibling thumbnail context is only enabled for WebGPU (WebLLM / Phi-3.5 Vision).
      const siblingIndices = restOfGroup.slice(0, 3);
      const hasThumbnails = siblingIndices.length > 0 && engineMode !== 'ollama';
      if (hasThumbnails) {
        const thumbnailDataUrls = await Promise.all(
          siblingIndices.map(async (idx) => await fetchImageAsDataUrl(extractedImages[idx].url, 150))
        );
        imagesPayload.push(...thumbnailDataUrls);
      }

      const prompt = await buildPrompt(extractedImages[masterIdx].url, masterIdx, hasThumbnails);
      const masterResult = await analyzeOneImage(masterIdx, prompt, signal, imagesPayload);
      if (signal.aborted) return;

      if (masterResult && masterResult.analysis) {
        // The model self-declares its Space on the first line; we no longer
        // synthesize one from a separate tag pass.
        const spaceKey = extractSpaceKey(masterResult.analysis);
        const canonical = spaceKey ? canonicalBySpace.get(spaceKey) : null;

        // Choose what to mirror across this group: prefer an earlier master
        // that already analyzed this same Space, otherwise this master's own
        // result becomes the canonical entry.
        const winning = canonical || { analysis: masterResult.analysis, score: masterResult.score, masterIdx };
        if (canonical) {
          // Overwrite the duplicate master's card with the canonical write-up.
          copyAnalysisToCard(masterIdx, winning.analysis, winning.score);
        } else if (spaceKey) {
          canonicalBySpace.set(spaceKey, winning);
        }

        results.push({ url: extractedImages[masterIdx].url, analysis: winning.analysis, score: winning.score });
        restOfGroup.forEach(idx => {
          copyAnalysisToCard(idx, winning.analysis, winning.score);
          results.push({
            url: extractedImages[idx].url,
            analysis: winning.analysis,
            score: winning.score,
          });
        });
      }

      groupsCompleted += 1;
      analysisProgressText.textContent = `Analyzed ${groupsCompleted}/${groupPlans.length} spaces…`;
    };

    // WebGPU shares a single engine instance — concurrent calls would serialize
    // anyway, so keep it at 1. Ollama serves OLLAMA_NUM_PARALLEL=4 by default;
    // 2 in flight overlaps fetch/decode with GPU compute without thrashing VRAM.
    const GROUP_CONCURRENCY = engineMode === 'ollama' ? 2 : 1;
    let groupCursor = 0;
    const groupWorker = async () => {
      while (!signal.aborted) {
        const i = groupCursor++;
        if (i >= groupPlans.length) return;
        await runGroup(groupPlans[i]);
      }
    };
    const groupWorkerCount = Math.min(GROUP_CONCURRENCY, groupPlans.length);
    await Promise.all(Array.from({ length: groupWorkerCount }, () => groupWorker()));

    analysisProgressText.textContent = signal.aborted ? 'Stopped.' : 'Done.';

    // Persist to Firestore if we have a batch
    if (!signal.aborted && results.length > 0 && isBatch) {
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

function matchTagToVocabulary(rawTag) {
  const clean = (rawTag || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  for (const label of ROOM_VOCABULARY) {
    if (clean.includes(label.toLowerCase())) return label;
  }
  for (const [alias, label] of Object.entries(VOCABULARY_ALIASES)) {
    if (clean.includes(alias)) return label;
  }
  return null;
}

// Pick a small, fast vision model for the tagging pass if one is installed.
// Tagging is a "what room is this" task — a 1-2GB model handles it ~5-10x faster
// than llama3.2-vision:11b. Falls back to the user's selected model if none found.
function pickOllamaTagModel() {
  const preferred = ['moondream', 'llava-phi3', 'minicpm-v', 'llava:7b', 'bakllava'];
  for (const pref of preferred) {
    const hit = ollamaInstalledModels.find(name => name.toLowerCase().startsWith(pref));
    if (hit) return hit;
  }
  return ollamaSelectedModel;
}

// Fire one tiny request so the model is loaded into VRAM before the timed loop.
async function warmOllamaModel(model, signal) {
  if (!model || ollamaWarmedModels.has(model)) return;
  try {
    await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
        options: { num_predict: 1 },
      }),
      signal,
    });
    ollamaWarmedModels.add(model);
  } catch (err) {
    // non-fatal; the real call will pay the load cost instead
  }
}

async function tagImages(indices, signal) {
  const tags = {};

  if (engineMode === 'ollama') {
    // IMPORTANT: Ollama vision models only support ONE image per request, so we
    // tag one image at a time. We use a small dedicated tag model when available
    // (moondream etc.) and a 160px thumbnail to keep each call fast.
    const tagModel = pickOllamaTagModel();
    const usingSmallTagModel = tagModel !== ollamaSelectedModel;
    const tagPrompt = `Identify the space in this photo. Reply with EXACTLY ONE label, copied verbatim, from this list:\n${ROOM_VOCABULARY.join(', ')}\nNo other words, no punctuation, no explanation.`;

    await warmOllamaModel(tagModel, signal);
    if (signal.aborted) return tags;

    // Worker pool: run up to OLLAMA_TAG_CONCURRENCY tag requests in flight at once.
    // Ollama serves parallel requests (default OLLAMA_NUM_PARALLEL=4); a single GPU
    // still serializes the heavy compute, but overlapping image fetch/decode with
    // model inference typically gives ~2-3x wall-clock speedup on M-series.
    const OLLAMA_TAG_CONCURRENCY = 4;
    const suffix = usingSmallTagModel ? ` (using ${tagModel.split(':')[0]})` : '';
    let cursor = 0;
    let done = 0;

    const tagOne = async (idx) => {
      try {
        const dataUrl = await fetchImageAsDataUrl(extractedImages[idx].url, 320);
        if (signal.aborted) return;
        const response = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: tagModel,
            messages: [{
              role: 'user',
              content: tagPrompt,
              images: [dataUrl.split(',')[1] || dataUrl]
            }],
            stream: false,
            options: { temperature: 0.1, num_predict: 20 }
          }),
          signal
        });
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const data = await response.json();
        const text = (data.message?.content || "").trim();
        const tag = text.replace(/^\d+[\.\:\s]*/, '').split('\n')[0].trim();
        // Out-of-vocabulary replies get a unique placeholder so they don't
        // false-merge with each other under a shared "Other" bucket.
        tags[idx] = matchTagToVocabulary(tag) || `Unclassified ${idx}`;
      } catch (err) {
        if (!signal.aborted) console.error(`[Ollama] Failed to index photo ${idx}:`, err);
        // Unique placeholder so failures don't collapse photos into one group.
        tags[idx] = `Unclassified ${idx}`;
      } finally {
        done += 1;
        analysisProgressText.textContent = `Indexing photos… (${done}/${indices.length})${suffix}`;
      }
    };

    const worker = async () => {
      while (!signal.aborted) {
        const i = cursor++;
        if (i >= indices.length) return;
        await tagOne(indices[i]);
      }
    };

    const workerCount = Math.min(OLLAMA_TAG_CONCURRENCY, indices.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  } else {
    // WebGPU WebLLM
    const batchSize = 5;
    for (let i = 0; i < indices.length; i += batchSize) {
      if (signal.aborted) break;
      const batch = indices.slice(i, i + batchSize);

      // Fetch images
      const dataUrls = await Promise.all(
        batch.map(async (idx) => await fetchImageAsDataUrl(extractedImages[idx].url))
      );

      const tagPrompt = `Identify the space in each photo. For each image, reply with EXACTLY ONE label, copied verbatim, from this list:\n${ROOM_VOCABULARY.join(', ')}\nReturn a numbered list in the exact order of the images. Example:\n1. Kitchen\n2. Front Yard\n3. Bedroom\nNo other words, no explanation.`;
      const content = dataUrls.map(url => ({ type: 'image_url', image_url: { url } }));
      content.push({ type: 'text', text: tagPrompt });

      const resp = await engine.chat.completions.create({
        messages: [{ role: 'user', content }],
        stream: false,
        max_tokens: 100,
      });
      const text = resp.choices[0].message.content;
      const lines = text.split('\n').filter(l => l.trim().match(/^\d+/));

      batch.forEach((idx, bIdx) => {
        const line = lines[bIdx] || '';
        const raw = line.replace(/^\d+[\.\:\s]*/, '').trim();
        // If the model didn't return a tag for this slot, give it a unique placeholder
        // so it doesn't get grouped (and master-mirrored) with other unclassified photos.
        tags[idx] = matchTagToVocabulary(raw) || `Unclassified ${idx}`;
      });
    }
  }
  return tags;
}

async function analyzeImageGroup(indices, prompt, signal, dataUrls) {
  // Use the first index to update the UI (all will be updated with same result)
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

    // Stream the response
    let fullText = '';
    resultEl.innerHTML = '<span class="stream-cursor"></span>';

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
          messages: [{
            role: 'user',
            content: prompt,
            images: imagesPayload.map(url => url.split(',')[1] || url)
          }],
          stream: true,
          options: {
            temperature: 0.2,
            num_ctx: 4096
            // No num_predict cap — let the model emit EOS naturally so long
            // descriptions don't get truncated mid-sentence. Loop pathology
            // is still handled downstream by dedupeRepeatedBlocks().
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
            resultEl.innerHTML = escapeHtml(fullText) + '<span class="stream-cursor"></span>';
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
        resultEl.innerHTML = escapeHtml(fullText) + '<span class="stream-cursor"></span>';
      }
    }

    // Final render with score highlighting
    const beforeClean = fullText;
    fullText = cleanRefusals(fullText);
    if (beforeClean !== fullText) {
      console.log(`[ZypheVision][master idx=${idx}] cleanRefusals rewrote: ${JSON.stringify(beforeClean).slice(0, 200)} → ${JSON.stringify(fullText).slice(0, 200)}`);
    }

    const scoreMatch = fullText.match(/(\d{1,2})\s*(?:\/\s*10|out of 10)/i) ||
      fullText.match(/score[:\s]+(\d{1,2})/i) ||
      fullText.match(/appeal[:\s]+(\d{1,2})/i);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;

    resultEl.className = 'analysis-result';
    resultEl.innerHTML = escapeHtml(fullText);

    // Extract Space/Room name for session memory
    const spaceMatch = fullText.match(/Space:\s*(.*)/i);
    if (spaceMatch && spaceMatch[1]) {
      const roomName = spaceMatch[1].trim().split(/[,\.]/)[0]; // get first part of room name
      if (roomName.length > 2 && roomName.length < 30) {
        identifiedRooms.add(roomName);
      }
    }

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
