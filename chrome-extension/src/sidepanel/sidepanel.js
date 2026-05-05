import * as webllm from '@mlc-ai/web-llm';

// ── Firebase config (mirrors services/firebase/config.ts) ─────────────────
const FIREBASE_PROJECT_ID = 'zyphe-af0bf';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// ── State ──────────────────────────────────────────────────────────────────
let engine = null;
let extractedImages = []; // [{ url, width, height, alt }]
let identifiedRooms = new Set(); // Track unique room names in current session
let analysisAbortController = null;
let isAnalyzing = false;
let currentZpid = null;
let currentProperty = null; // scraped metadata from the page
let firebaseAuth = null; // { token, uid, email }

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
const analyzeSelectedBtn = document.getElementById('analyze-selected-btn');
const stopBtn = document.getElementById('stop-btn');
const analysisProgressText = document.getElementById('analysis-progress-text');
const customPrompt = document.getElementById('custom-prompt');
const imagesGrid = document.getElementById('images-grid');

const collectiveAnalysisContainer = document.getElementById('collective-analysis-container');
const collectiveResult = document.getElementById('collective-result');

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
  analyzeAllBtn.disabled = !engine || isAnalyzing || extractedImages.length === 0;
  analyzeSelectedBtn.disabled = !engine || isAnalyzing || selectedCount === 0;
  if (selectedCount > 0) {
    analyzeSelectedBtn.textContent = `📚 Analyze Selected (${selectedCount})`;
  } else {
    analyzeSelectedBtn.textContent = `📚 Analyze Selected Together`;
  }
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

  card.innerHTML = `
    <div class="image-thumb-wrapper" onclick="window.toggleSelection(${idx})">
      <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt)}" loading="lazy"
           onerror="this.style.display='none'" />
      <span class="image-index-badge">#${idx + 1}</span>
      <div class="image-selection-overlay">
        <input type="checkbox" class="image-checkbox" data-index="${idx}" onclick="event.stopPropagation(); updateAnalyzeBtnState();" />
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

// ── Prompt builder ─────────────────────────────────────────────────────────
function buildPrompt(imageUrl, imageIndex) {
  // User override takes priority
  const override = customPrompt.value.trim();
  if (override) return override;

  const roomsList = Array.from(identifiedRooms).join(', ');
  const memoryContext = roomsList 
    ? `\nROOMS ALREADY ANALYSED IN THIS SESSION: ${roomsList}.\nIf this photo is of a room already analyzed, skip the structured format and provide a brief 2-sentence summary instead.`
    : '';

  const propertyCtx = currentProperty
    ? JSON.stringify(
      Object.fromEntries(Object.entries(currentProperty).filter(([, v]) => v !== null)),
      null, 2
    )
    : 'Not available';

  return `You are writing a professional real estate photo description for a property narrative report. Describe only what is clearly visible.

First, determine if this is an INTERIOR or EXTERIOR photo, then fill in the matching fields below.

--- IF INTERIOR (bedroom, kitchen, bathroom, living room, dining room, office, etc.) ---
Space: [room name, e.g. "Primary Bedroom", "Kitchen", "Bathroom"]
Style: [design aesthetic, e.g. "Transitional contemporary with crown molding"]
Colors: [wall color, floor color, accent colors — be specific, e.g. "Soft white walls, pale grey laminate, navy accent wall"]
Materials: [floors, counters, cabinets, fixtures — e.g. "Hardwood floors, speckled granite counters, stainless appliances"]
Lighting: [natural light sources and quality, artificial light type — e.g. "West-facing windows, abundant natural light, recessed cans"]
Furnishings: [furniture style, arrangement, focal points — e.g. "Contemporary grey sectional, accent wall with TV mount"]
Condition: [move-in readiness, upgrades, wear — e.g. "Pristine, freshly painted, updated fixtures"]
Description: [3-4 sentences of flowing prose that a buyer would find compelling]
Potential: [one specific upgrade that would add value]

--- IF EXTERIOR (facade, front yard, backyard, patio, pool, driveway, street view, etc.) ---
Space: [area name, e.g. "Front Yard", "Backyard", "Patio", "Pool Area"]
Architecture: [exterior style and facade details — e.g. "Ranch-style, brick facade, low-pitched roof, two-car garage"]
Colors: [exterior paint, trim, roof, driveway — e.g. "Warm grey siding, white trim, terracotta tile roof"]
Landscaping: [lawn, plants, trees, hardscape — e.g. "Manicured lawn, mature oak trees, concrete pathway"]
Outdoor Living: [patio, deck, pool, outdoor kitchen, seating — or "None visible"]
Street Context: [setback, neighboring properties, street feel — e.g. "Wide lot, quiet tree-lined street, good separation from neighbors"]
Condition: [paint, siding, windows, driveway, fence condition — e.g. "Well-maintained, fresh paint, clean driveway"]
Description: [3-4 sentences of flowing prose capturing curb appeal and outdoor lifestyle potential]
Potential: [one specific improvement that would add curb appeal or outdoor livability]

Context: ${propertyCtx}${memoryContext}`;
}

// ── Analysis ───────────────────────────────────────────────────────────────
analyzeAllBtn.addEventListener('click', () => analyzeImages(extractedImages.map((_, i) => i)));
analyzeSelectedBtn.addEventListener('click', () => analyzeMultipleImages(getSelectedIndices()));

stopBtn.addEventListener('click', () => {
  if (analysisAbortController) analysisAbortController.abort();
});

window.analyzeSingle = (idx) => analyzeImages([idx]);

async function analyzeImages(indices) {
  if (!engine || isAnalyzing || indices.length === 0) return;

  isAnalyzing = true;
  analysisAbortController = new AbortController();
  const signal = analysisAbortController.signal;

  analyzeAllBtn.hidden = true;
  analyzeSelectedBtn.hidden = true;
  stopBtn.hidden = false;
  updateAnalyzeBtnState();

  try {
    // Phase 1: Tagging (Indexing)
    const isBatch = indices.length > 1;
    let groups = {};

    if (isBatch) {
      analysisProgressText.textContent = `Indexing ${indices.length} photos…`;
      const tags = await tagImages(indices, signal);
      if (signal.aborted) return;
      
      // Group indices by room name
      for (const [idx, tag] of Object.entries(tags)) {
        if (!groups[tag]) groups[tag] = [];
        groups[tag].push(parseInt(idx, 10));
      }
    } else {
      // Single image: skip tagging
      groups['Single Analysis'] = indices;
    }

    const groupNames = Object.keys(groups);
    let results = [];

    // Phase 2: Grouped Analysis
    for (let i = 0; i < groupNames.length; i++) {
      if (signal.aborted) break;
      const groupName = groupNames[i];
      const groupIndices = groups[groupName];
      
      // Filter out images already analyzed in this session
      const toAnalyze = groupIndices.filter(idx => !document.getElementById(`card-${idx}`)?.classList.contains('done'));
      if (toAnalyze.length === 0) continue;

      analysisProgressText.textContent = `Analyzing ${groupName} (${i + 1}/${groupNames.length})…`;
      
      // Process in sub-batches of 5 to avoid VRAM overflow
      const subBatchSize = 5;
      for (let j = 0; j < toAnalyze.length; j += subBatchSize) {
        if (signal.aborted) break;
        const subBatch = toAnalyze.slice(j, j + subBatchSize);
        
        // Fetch all images in sub-batch
        const dataUrls = await Promise.all(
          subBatch.map(async (idx) => await fetchImageAsDataUrl(extractedImages[idx].url))
        );

        // Run analysis using the ORIGINAL prompt
        // We use the first index for prompt building context
        const prompt = buildPrompt(extractedImages[subBatch[0]].url, subBatch[0]);
        const result = await analyzeImageGroup(subBatch, prompt, signal, dataUrls);
        if (result) results.push(...result);
      }
    }

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
  }
}

async function tagImages(indices, signal) {
  const tags = {};
  const batchSize = 5;

  for (let i = 0; i < indices.length; i += batchSize) {
    if (signal.aborted) break;
    const batch = indices.slice(i, i + batchSize);
    
    // Fetch images
    const dataUrls = await Promise.all(
      batch.map(async (idx) => await fetchImageAsDataUrl(extractedImages[idx].url))
    );

    const content = dataUrls.map(url => ({ type: 'image_url', image_url: { url } }));
    content.push({
      type: 'text',
      text: "Identify the room or space in each photo. Respond with a simple numbered list in the exact order of the images. Example:\n1. Kitchen\n2. Bedroom\n3. Living Room\nKeep room names concise (1-3 words)."
    });

    const resp = await engine.chat.completions.create({
      messages: [{ role: 'user', content }],
      stream: false, // simpler for tagging
      max_tokens: 100,
    });

    const text = resp.choices[0].message.content;
    const lines = text.split('\n').filter(l => l.trim().match(/^\d+/));
    
    batch.forEach((idx, bIdx) => {
      const line = lines[bIdx] || '';
      const tag = line.replace(/^\d+[\.\:\s]*/, '').trim() || 'Other';
      tags[idx] = tag;
    });
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
    const content = dataUrls.map(url => ({ type: 'image_url', image_url: { url } }));
    content.push({ type: 'text', text: prompt });

    let fullText = '';
    const resultEl = document.getElementById(`result-${masterIdx}`);
    if (resultEl) resultEl.innerHTML = '<span class="stream-cursor"></span>';

    const stream = await engine.chat.completions.create({
      messages: [{ role: 'user', content }],
      stream: true,
      temperature: 0.1,
      max_tokens: 250,
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

    if (signal.aborted) return null;

    // Final processing
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
  if (!engine || isAnalyzing || indices.length === 0) return;
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
  }
}

async function analyzeOneImage(idx, prompt, signal, preloadedDataUrl = null) {
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
    // Use pre-fetched dataUrl if available, otherwise fetch now
    let dataUrl = preloadedDataUrl;
    if (!dataUrl) {
      resultEl.innerHTML = '<span class="analyzing-spinner"></span>Fetching image…';
      dataUrl = await fetchImageAsDataUrl(img.url);
    }

    if (signal.aborted) return null;

    resultEl.innerHTML = '<span class="analyzing-spinner"></span>Running…';

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
      temperature: 0.1,
      max_tokens: 250,
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

// ── Init ───────────────────────────────────────────────────────────────────
(async () => {
  const hasGpu = await checkWebGPU();
  if (!hasGpu) {
    loadModelBtn.disabled = true;
    setBadge('error', 'No WebGPU');
  }
})();
