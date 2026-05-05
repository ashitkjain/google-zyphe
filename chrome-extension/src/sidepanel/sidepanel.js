import * as webllm from '@mlc-ai/web-llm';

// ── State ──────────────────────────────────────────────────────────────────
let engine = null;
let extractedImages = []; // [{ url, width, height, alt }]
let analysisAbortController = null;
let isAnalyzing = false;

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

const scanSection = document.getElementById('scan-section');
const scanBtn = document.getElementById('scan-btn');
const scanCount = document.getElementById('scan-count');

const analysisSection = document.getElementById('analysis-section');
const analyzeAllBtn = document.getElementById('analyze-all-btn');
const stopBtn = document.getElementById('stop-btn');
const analysisProgressText = document.getElementById('analysis-progress-text');
const customPrompt = document.getElementById('custom-prompt');
const imagesGrid = document.getElementById('images-grid');

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
    });

    progressFill.style.width = '100%';
    progressText.textContent = 'Model ready ✓';
    setBadge('ready', 'Ready');

    // Reveal next steps
    modelSection.querySelector('.card-body').style.opacity = '0.6';
    scanSection.hidden = false;
    if (extractedImages.length > 0) analysisSection.hidden = false;

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
      handleImagesFound(images);
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
    handleImagesFound(message.images);
  }
});

function handleImagesFound(images) {
  extractedImages = images;
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
  analyzeAllBtn.disabled = !engine || isAnalyzing || extractedImages.length === 0;
}

// ── Image card builder ─────────────────────────────────────────────────────
function buildImageCard(img, idx) {
  const card = document.createElement('div');
  card.className = 'image-card';
  card.id = `card-${idx}`;

  card.innerHTML = `
    <div class="image-thumb-wrapper">
      <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt)}" loading="lazy"
           onerror="this.style.display='none'" />
      <span class="image-index-badge">#${idx + 1}</span>
      <span class="image-status-badge status-pending" id="status-${idx}">Pending</span>
    </div>
    <div class="image-card-body">
      <div class="analysis-placeholder" id="result-${idx}">
        Waiting for analysis…
      </div>
      <div class="image-url">
        <a href="${escapeHtml(img.url)}" target="_blank" rel="noopener">${truncateUrl(img.url)}</a>
      </div>
      <button class="btn btn-secondary analyze-single-btn" id="single-btn-${idx}"
              onclick="window.analyzeSingle(${idx})" ${!engine ? 'disabled' : ''}>
        Analyze this photo
      </button>
    </div>
  `;
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

// ── Analysis ───────────────────────────────────────────────────────────────
analyzeAllBtn.addEventListener('click', () => analyzeImages(extractedImages.map((_, i) => i)));

stopBtn.addEventListener('click', () => {
  if (analysisAbortController) analysisAbortController.abort();
});

window.analyzeSingle = (idx) => analyzeImages([idx]);

async function analyzeImages(indices) {
  if (!engine || isAnalyzing) return;

  isAnalyzing = true;
  analysisAbortController = new AbortController();
  const signal = analysisAbortController.signal;

  analyzeAllBtn.hidden = true;
  stopBtn.hidden = false;
  updateAnalyzeBtnState();

  const prompt = customPrompt.value.trim() ||
    'Analyze this real estate property photo. Identify: (1) room/area type, (2) notable features and condition, (3) quality level (entry/mid/luxury), (4) buyer-relevant strengths or concerns, (5) appeal score 1–10. Be concise.';

  for (let i = 0; i < indices.length; i++) {
    if (signal.aborted) break;
    const idx = indices[i];

    analysisProgressText.textContent = `Analyzing ${i + 1} / ${indices.length}…`;
    await analyzeOneImage(idx, prompt, signal);
  }

  analysisProgressText.textContent = signal.aborted
    ? 'Stopped.'
    : `Done — analyzed ${indices.length} photo${indices.length !== 1 ? 's' : ''}.`;

  isAnalyzing = false;
  analyzeAllBtn.hidden = false;
  stopBtn.hidden = true;
  updateAnalyzeBtnState();
}

async function analyzeOneImage(idx, prompt, signal) {
  const img = extractedImages[idx];
  if (!img) return;

  const card = document.getElementById(`card-${idx}`);
  const resultEl = document.getElementById(`result-${idx}`);
  const statusEl = document.getElementById(`status-${idx}`);
  const singleBtn = document.getElementById(`single-btn-${idx}`);
  if (singleBtn) singleBtn.disabled = true;

  // Set analyzing state
  card.className = 'image-card analyzing';
  statusEl.className = 'image-status-badge status-analyzing';
  statusEl.textContent = 'Analyzing…';
  resultEl.innerHTML = '<span class="analyzing-spinner"></span>Fetching image…';

  try {
    // Convert image to base64 so WebLLM doesn't need to re-fetch
    const dataUrl = await fetchImageAsDataUrl(img.url);

    if (signal.aborted) return;

    resultEl.innerHTML = '<span class="analyzing-spinner"></span>Running vision model…';

    // Stream the response
    let fullText = '';
    resultEl.innerHTML = '<span class="stream-cursor"></span>';

    const stream = await engine.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: dataUrl },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      stream: true,
      temperature: 0.3,
      max_tokens: 400,
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

    // Final render with score highlighting
    const scoreMatch = fullText.match(/(\d{1,2})\s*(?:\/\s*10|out of 10)/i) ||
                       fullText.match(/score[:\s]+(\d{1,2})/i) ||
                       fullText.match(/appeal[:\s]+(\d{1,2})/i);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;

    resultEl.className = 'analysis-result';
    resultEl.innerHTML = escapeHtml(fullText);

    if (score !== null) {
      const scoreHtml = buildScoreHtml(score);
      resultEl.insertAdjacentHTML('beforebegin', scoreHtml);
    }

    card.className = 'image-card done';
    statusEl.className = 'image-status-badge status-done';
    statusEl.textContent = score !== null ? `Score: ${score}/10` : 'Done ✓';

  } catch (err) {
    if (signal.aborted) return;
    card.className = 'image-card error';
    statusEl.className = 'image-status-badge status-error';
    statusEl.textContent = 'Error';
    resultEl.className = 'analysis-result';
    resultEl.textContent = `Error: ${err.message}`;
    console.error('[ZypheVision] analysis error', err);
  }

  if (singleBtn) singleBtn.disabled = false;
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
async function fetchImageAsDataUrl(url) {
  // Extensions can fetch cross-origin with host_permissions
  const resp = await fetch(url, { mode: 'cors', cache: 'force-cache' });
  if (!resp.ok) throw new Error(`Failed to fetch image (${resp.status})`);
  const blob = await resp.blob();
  return blobToDataUrl(blob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Init ───────────────────────────────────────────────────────────────────
(async () => {
  const hasGpu = await checkWebGPU();
  if (!hasGpu) {
    loadModelBtn.disabled = true;
    setBadge('error', 'No WebGPU');
  }
})();
