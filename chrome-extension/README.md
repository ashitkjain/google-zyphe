# Zyphe Property Vision Analyzer — Chrome Extension

Analyzes property photos on **zyphe.ai** (and `localhost`) using **Llama 3.2 Vision** running fully in-browser via [WebLLM](https://github.com/mlc-ai/web-llm). No server, no API key — the model runs on your GPU.

## Requirements

- Chrome 113+ with **WebGPU enabled** (most modern installs have it on by default)
- A discrete or integrated GPU with ≥8 GB VRAM recommended
- ~6 GB free disk space (model is cached in browser IndexedDB after first download)

If WebGPU is not enabled: go to `chrome://flags/#enable-unsafe-webgpu` and enable it.

## Build

```bash
cd chrome-extension
npm install
npm run build        # outputs to dist/
# or
npm run dev          # watch mode
```

## Load into Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** → select the `chrome-extension/dist/` folder
4. The extension icon appears in the toolbar

## Usage

1. Navigate to **zyphe.ai** (or `http://localhost:3000`) and open a property listing
2. Click the extension icon → side panel opens on the right
3. **Step 1** — Click "Load Model" (downloads ~6 GB on first run, then cached)
4. **Step 2** — Click "Scan for Property Photos" to extract images from the page
5. **Step 3** — Click "Analyze All Photos" or analyze individual photos

## How it works

- **Content script** (`content.js`) scans the DOM for `<img>` elements and CSS `background-image` properties that look like property photos (size threshold + CDN URL patterns)
- **MutationObserver** watches for React-rendered images that load after initial page load
- **Side panel** (`sidepanel.js`) loads the vision model via WebLLM and runs inference locally
- Images are fetched as base64 data URLs (CORS allowed via extension host permissions) and passed to the vision model
- Results stream token-by-token into the UI

## Models available

| Model | Size | Notes |
|---|---|---|
| `Llama-3.2-11B-Vision-Instruct-q4f16_1-MLC` | ~6 GB | Default, best quality |
| `Llama-3.2-11B-Vision-Instruct-q4f32_1-MLC` | ~8 GB | Higher precision |
