"use strict";

/**
 * Server-side port of the Chrome extension's vision analysis pipeline.
 *
 * Phases (first slice):
 *  1. Classify every photo into a space label (Gemini, low-res, parallel).
 *  2. Group photos by label.
 *  3. For each group: pick canonical + up to 5 stride-sampled extras,
 *     fetch the matching `photo-analysis.<label>.txt` prompt, call Gemini
 *     with multiple inlineData parts, save structured analysis.
 *
 * NOT in first slice: visual clustering for Bedroom/Bathroom subdivision.
 *
 * Output schema mirrors the extension's `vision_extension` Firestore doc:
 *   properties/{zpid}/analysis/vision_v2
 *
 * Using `vision_v2` instead of overwriting `vision_extension` so the two
 * paths can coexist (extension still writes vision_extension; this writes
 * vision_v2). Merge them in the UI later if desired.
 *
 * Prompt files: `functions/prompts/photo-analysis/photo-analysis.*.txt`.
 * They are copies of `public/prompts/photo-analysis.*.txt` — keep in sync
 * by hand for now; could be replaced with a build step if churn increases.
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_MODEL = "gemini-2.5-flash";
const PIPELINE_VERSION = "v1";

// ─── Vocabulary (mirrors extension's ROOM_VOCABULARY) ─────────────────────
const ROOM_VOCABULARY = [
    "Bedroom", "Kitchen", "Living Room", "Dining Room", "Bathroom",
    "Office", "Laundry Room", "Entryway", "Hallway", "Staircase", "Basement",
    "Front Yard", "Backyard",
    "Sports Court", "Fitness Center", "Clubhouse", "Community Park",
    "Floor Plan", "Aerial View",
];

// Aliases collapse model output like "Primary Bedroom" → "Bedroom" without
// the model needing a disambiguation paragraph.
const VOCABULARY_ALIASES = {
    "garage": "Front Yard", "driveway": "Front Yard", "curb": "Front Yard",
    "facade": "Front Yard", "exterior": "Front Yard",
    "patio": "Backyard", "deck": "Backyard", "porch": "Backyard",
    "balcony": "Backyard", "garden": "Backyard",
    "pool area": "Backyard", "pool": "Backyard", "spa": "Backyard",
    "hot tub": "Backyard", "jacuzzi": "Backyard",
    "walk in closet": "Bedroom", "walk-in closet": "Bedroom",
    "wardrobe": "Bedroom", "dressing room": "Bedroom",
    "primary bedroom": "Bedroom", "master bedroom": "Bedroom",
    "owner's suite": "Bedroom", "primary suite": "Bedroom",
    "primary bathroom": "Bathroom", "master bathroom": "Bathroom",
    "master bath": "Bathroom", "ensuite": "Bathroom",
    "ensuite bathroom": "Bathroom", "powder room": "Bathroom", "half bath": "Bathroom",
    "foyer": "Entryway", "entry": "Entryway", "entrance": "Entryway",
    "vestibule": "Entryway", "mudroom": "Entryway", "mud room": "Entryway",
};

const CLASSIFY_PROMPT = `Look at this real estate photo. Reply in this exact format:
Type: [Interior, Exterior, or Community]
Space: [EXACTLY ONE label from this list: ${ROOM_VOCABULARY.join(", ")}]

Use "Type: Exterior" and "Space: Aerial View" for any overhead, drone, or bird's-eye shot showing multiple rooftops or streets.`;

// ─── Label → prompt-file routing (mirrors extension's getTemplateTypeForSpace) ─
function promptFileForLabel(label) {
    if (!label) return "photo-analysis.interior.txt";
    switch (label) {
    case "Kitchen": return "photo-analysis.kitchen.txt";
    case "Living Room": return "photo-analysis.livingroom.txt";
    case "Dining Room": return "photo-analysis.diningroom.txt";
    case "Bedroom": return "photo-analysis.bedroom.txt";
    case "Bathroom": return "photo-analysis.bathroom.txt";
    case "Entryway": return "photo-analysis.entryway.txt";
    case "Front Yard": return "photo-analysis.frontyard.txt";
    case "Backyard": return "photo-analysis.backyard.txt";
    case "Aerial View": return "photo-analysis.aerial.txt";
    case "Floor Plan": return "photo-analysis.floorplan.txt";
    case "Sports Court":
    case "Fitness Center":
    case "Clubhouse":
    case "Community Park":
        return "photo-analysis.community.txt";
    default:
        return "photo-analysis.interior.txt";
    }
}

// ─── Prompt loading ───────────────────────────────────────────────────────
const PROMPT_DIR = path.join(__dirname, "prompts", "photo-analysis");
const promptCache = new Map();
function loadPrompt(filename) {
    if (promptCache.has(filename)) return promptCache.get(filename);
    const fp = path.join(PROMPT_DIR, filename);
    const text = fs.readFileSync(fp, "utf8");
    promptCache.set(filename, text);
    return text;
}

// ─── Classifier response parsing ──────────────────────────────────────────
function inferSpaceFromText(text) {
    if (!text) return null;
    const haystack = text.toLowerCase();
    let best = null; // { pos, rank, label }
    const consider = (label, pat, rank) => {
        let pos;
        if (pat instanceof RegExp) {
            const m = haystack.match(pat);
            if (!m || m.index === undefined) return;
            pos = m.index;
        } else {
            pos = haystack.indexOf(pat);
            if (pos === -1) return;
        }
        if (best === null || pos < best.pos || (pos === best.pos && rank < best.rank)) {
            best = { pos, rank, label };
        }
    };
    ROOM_VOCABULARY.forEach((label, rank) => consider(label, label.toLowerCase(), rank));
    Object.entries(VOCABULARY_ALIASES).forEach(([alias, label]) => {
        const rank = ROOM_VOCABULARY.indexOf(label);
        consider(label, new RegExp(`\\b${alias}\\b`, "i"), rank >= 0 ? rank : ROOM_VOCABULARY.length);
    });
    return best ? best.label : null;
}

function parseClassificationResponse(text, idx) {
    // Stable "Unclassified" sentinel (no embedded index) so all failures
    // collapse into ONE group rather than N groups. The pipeline skips
    // analysis for this label entirely and surfaces the photos as orphans.
    if (!text) return { label: "Unclassified", type: "INTERIOR" };
    let type = "INTERIOR";
    const tMatch = text.match(/Type:\s*([^\n]+)/i);
    if (tMatch) {
        const raw = tMatch[1].toLowerCase();
        if (raw.includes("community")) type = "COMMUNITY";
        else if (raw.includes("exterior")) type = "EXTERIOR";
    }
    const sMatch = text.match(/Space:\s*([^\n]+)/i);
    const spaceText = sMatch ? sMatch[1].trim() : text;
    const label = inferSpaceFromText(spaceText) || "Unclassified";
    // Promote label-implied type override (matches extension behavior).
    if (label === "Backyard") type = "BACKYARD";
    if (label === "Aerial View") type = "AERIAL";
    return { label, type };
}

// ─── Image fetch → base64 ─────────────────────────────────────────────────
async function fetchImageAsInlineData(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Image fetch ${resp.status}: ${url}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    const mimeType = resp.headers.get("content-type") || "image/jpeg";
    return { inlineData: { data: buf.toString("base64"), mimeType } };
}

// ─── Phase 1: classify one photo ──────────────────────────────────────────
async function classifyOne(model, inlineDataPart, idx) {
    try {
        const result = await model.generateContent({
            contents: [{
                role: "user",
                parts: [inlineDataPart, { text: CLASSIFY_PROMPT }],
            }],
            // 2.5-flash defaults to using "thinking" tokens which silently
            // eat the output budget — at 20 tokens we got back nothing.
            // 256 leaves comfortable room for any internal thinking plus the
            // two-line response. Also explicitly disable thinking if the
            // SDK version supports it (silently ignored otherwise).
            generationConfig: {
                temperature: 0,
                maxOutputTokens: 256,
                thinkingConfig: { thinkingBudget: 0 },
            },
        });
        const text = result.response.text();
        if (idx < 3) console.log(`[visionPipeline][classify-raw idx=${idx}] ${text.replace(/\n/g, " | ")}`);
        return parseClassificationResponse(text, idx);
    } catch (e) {
        console.error(`[visionPipeline] classify failed photo ${idx}:`, e.message);
        return { label: "Unclassified", type: "INTERIOR", error: e.message };
    }
}

async function classifyAll(model, inlineParts, concurrency = 4, onProgress = null) {
    const out = new Array(inlineParts.length);
    let cursor = 0;
    let done = 0;
    const workers = Array.from({ length: Math.min(concurrency, inlineParts.length) }, async () => {
        for (;;) {
            const i = cursor++;
            if (i >= inlineParts.length) return;
            out[i] = await classifyOne(model, inlineParts[i], i);
            done++;
            if (onProgress) await onProgress(done, inlineParts.length).catch(() => {});
        }
    });
    await Promise.all(workers);
    return out;
}

// ─── Phase 5 (semantic grouping) ──────────────────────────────────────────
function groupByLabel(spaceResults) {
    // Map<label, { canonicalIdx, memberIndices: number[], type }>
    const groups = new Map();
    spaceResults.forEach((res, idx) => {
        const existing = groups.get(res.label);
        if (existing) existing.memberIndices.push(idx);
        else groups.set(res.label, { canonicalIdx: idx, memberIndices: [idx], type: res.type, label: res.label });
    });
    return [...groups.values()];
}

// ─── Phase 6: per-bin analysis ────────────────────────────────────────────
function strideSampleExtras(memberIndices, canonicalIdx, maxExtras = 5) {
    const candidates = memberIndices.filter((m) => m !== canonicalIdx);
    if (candidates.length <= maxExtras) return candidates;
    const step = candidates.length / maxExtras;
    return Array.from({ length: maxExtras }, (_, k) => candidates[Math.floor(k * step)]);
}

function buildAnalysisPrompt(label, property, hasMultiple) {
    const filename = promptFileForLabel(label);
    const prompt = loadPrompt(filename);
    const propertyCtx = property ?
        JSON.stringify(
            Object.fromEntries(Object.entries(property).filter(([, v]) => v !== null && v !== undefined)),
            null, 2) :
        "Not available";
    const memoryContext = "";
    const viewsContext = hasMultiple ?
        `\nMULTI-IMAGE INSTRUCTIONS:
- You are being provided with MULTIPLE photographs of the SAME space, taken from different angles.
- Examine EACH image individually before writing anything. Do not anchor on the first image alone.
- Different angles reveal different features that may be cropped out of any single shot. You MUST mention every notable feature visible in ANY of the images.
- Your response must be ONE unified analysis that synthesizes evidence from ALL images. If a feature appears in only one angle, still include it.
- If two images contradict each other on a detail, mention both observations rather than picking one.
- Do not enumerate per-image findings — produce a single, coherent description of the entire space as if you walked through it.` :
        "";
    return prompt
        .replace("{{PROPERTY_CONTEXT}}", propertyCtx)
        .replace("{{MEMORY_CONTEXT}}", memoryContext)
        .replace("{{VIEWS_CONTEXT}}", viewsContext);
}

async function analyzeBin(model, group, inlineParts, property) {
    const canonicalIdx = group.canonicalIdx;
    const extras = strideSampleExtras(group.memberIndices, canonicalIdx);
    const sentIndices = [canonicalIdx, ...extras];
    const parts = sentIndices.map((i) => inlineParts[i]);
    const promptText = buildAnalysisPrompt(group.label, property, sentIndices.length > 1);

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [...parts, { text: promptText }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        });
        let analysis = result.response.text().trim();
        if (!/^space\s*:/i.test(analysis) && analysis !== "NA") {
            analysis = `Space: ${group.label}\n\n${analysis}`;
        }
        return { sentIndices, analysis, error: null };
    } catch (e) {
        console.error(`[visionPipeline] analyze failed label="${group.label}":`, e.message);
        return { sentIndices, analysis: null, error: e.message };
    }
}

// ─── Output assembly (mirrors extension's results[] shape) ────────────────
function buildResults(groups, binOutputs, imageUrls) {
    // For each group: 1 canonical entry + N-1 mirror entries that reference it.
    const results = [];
    groups.forEach((group, gi) => {
        const out = binOutputs[gi];
        if (!out.analysis) {
            results.push({
                photo_index: group.canonicalIdx,
                url: imageUrls[group.canonicalIdx],
                analysis: null,
                score: null,
                error: out.error || "no analysis",
                group_label: group.label,
                group_member_indices: group.memberIndices.slice(),
                group_sent_indices: out.sentIndices.slice(),
            });
            return;
        }
        results.push({
            photo_index: group.canonicalIdx,
            url: imageUrls[group.canonicalIdx],
            analysis: out.analysis,
            score: null,
            error: null,
            group_label: group.label,
            group_member_indices: group.memberIndices.slice(),
            group_sent_indices: out.sentIndices.slice(),
        });
        const sentSet = new Set(out.sentIndices);
        for (const mIdx of group.memberIndices) {
            if (mIdx === group.canonicalIdx) continue;
            results.push({
                photo_index: mIdx,
                url: imageUrls[mIdx],
                mirror_of: group.canonicalIdx,
                mirror_of_url: imageUrls[group.canonicalIdx],
                group_label: group.label,
                sent_to_llm: sentSet.has(mIdx),
            });
        }
    });
    return results;
}

// ─── Top-level orchestrator ───────────────────────────────────────────────
async function runVisionPipeline(zpid, opts = {}) {
    const db = opts.db || admin.firestore();
    const geminiKey = opts.geminiKey;
    if (!geminiKey) throw new Error("Missing geminiKey");

    const t0 = Date.now();
    const propRef = db.collection("properties").doc(zpid);
    const propSnap = await propRef.get();
    if (!propSnap.exists) throw new Error(`Property ${zpid} not found`);
    const property = propSnap.data();
    const imageUrls = Array.isArray(property.images) ? property.images.filter((u) => typeof u === "string") : [];
    if (imageUrls.length === 0) {
        throw new Error(`Property ${zpid} has no images`);
    }
    console.log(`[visionPipeline] ${zpid} — ${imageUrls.length} photos`);

    // Live progress channel — the page subscribes to this doc and updates
    // its status row as phases progress. Throttled so we don't hammer
    // Firestore with one write per photo.
    const statusRef = propRef.collection("analysis").doc("vision_v2");
    let lastStatusWrite = 0;
    const writeStatus = async (patch, force = false) => {
        const now = Date.now();
        if (!force && now - lastStatusWrite < 500) return;
        lastStatusWrite = now;
        try {
            await statusRef.set({
                ...patch,
                pipeline_version: PIPELINE_VERSION,
                model: GEMINI_MODEL,
                photo_count_total: imageUrls.length,
                analyzed_at_iso: new Date().toISOString(),
            }, { merge: true });
        } catch (e) {
            console.warn(`[visionPipeline] status write failed:`, e.message);
        }
    };
    await writeStatus({ status: "fetching", phase: "Fetching images" }, true);

    // Fetch all images once, reuse for both classify and analyze.
    const fetchStart = Date.now();
    const fetchResults = await Promise.allSettled(imageUrls.map(fetchImageAsInlineData));
    const inlineParts = fetchResults.map((r, i) => {
        if (r.status === "fulfilled") return r.value;
        console.warn(`[visionPipeline] image fetch failed idx=${i}:`, r.reason?.message);
        return null;
    });
    const liveIndices = inlineParts.map((p, i) => p ? i : -1).filter((i) => i !== -1);
    if (liveIndices.length === 0) throw new Error("All image fetches failed");
    const fetchMs = Date.now() - fetchStart;

    const genai = new GoogleGenerativeAI(geminiKey);
    const model = genai.getGenerativeModel({ model: GEMINI_MODEL });

    // ── Phase 1: classify (skip indices whose fetch failed) ──
    const classifyStart = Date.now();
    const classifyInputs = liveIndices.map((i) => inlineParts[i]);
    await writeStatus({
        status: "classifying",
        phase: `Classifying 0/${classifyInputs.length}`,
        classify_total: classifyInputs.length,
        classify_done: 0,
    }, true);
    const liveClassifications = await classifyAll(
        model, classifyInputs, opts.classifyConcurrency || 4,
        async (done, total) => writeStatus({
            classify_done: done,
            phase: `Classifying ${done}/${total}`,
        }),
    );
    // Re-expand to full index space; failed-fetch slots get a sentinel.
    const spaceResults = new Array(imageUrls.length).fill(null).map((_, i) => ({
        label: `Unclassified ${i}`,
        type: "INTERIOR",
    }));
    liveIndices.forEach((origIdx, i) => {
        spaceResults[origIdx] = liveClassifications[i];
    });
    const classifyMs = Date.now() - classifyStart;

    // ── Phase 5: group by label (only over photos with a real label) ──
    // "Unclassified" photos are bucketed into a single group but we will
    // NOT run an analysis call on them (handled below); they fall through
    // to the orphans bucket in the UI.
    const groups = groupByLabel(
        spaceResults.map((r, i) => liveIndices.includes(i) ? r : { label: null, type: "INTERIOR" }),
    ).filter((g) => g.label && g.label !== "Unclassified");

    // ── Phase 6: analyze each group ──
    const analyzeStart = Date.now();
    await writeStatus({
        status: "analyzing",
        phase: `Analyzing 0/${groups.length} groups`,
        analyze_total: groups.length,
        analyze_done: 0,
    }, true);
    const binOutputs = [];
    // Sequential to be polite to the API for first slice; can parallelize later.
    for (let gi = 0; gi < groups.length; gi++) {
        binOutputs.push(await analyzeBin(model, groups[gi], inlineParts, property));
        await writeStatus({
            analyze_done: gi + 1,
            phase: `Analyzing ${gi + 1}/${groups.length} groups`,
        });
    }
    const analyzeMs = Date.now() - analyzeStart;

    // ── Assemble output ──
    const results = buildResults(groups, binOutputs, imageUrls);
    // Append unclassified photos as orphans so the UI can show them.
    const groupedIndices = new Set(results.map((r) => r.photo_index));
    spaceResults.forEach((r, i) => {
        if (groupedIndices.has(i)) return;
        if (!imageUrls[i]) return;
        results.push({
            photo_index: i,
            url: imageUrls[i],
            analysis: null,
            error: r.error || (r.label === "Unclassified" ? "classifier returned no usable label" : "skipped"),
            group_label: r.label || null,
        });
    });

    const doc = {
        status: "done",
        phase: "Done",
        pipeline_version: PIPELINE_VERSION,
        model: GEMINI_MODEL,
        analyzed_at: admin.firestore.FieldValue.serverTimestamp(),
        analyzed_at_iso: new Date().toISOString(),
        photo_count: results.length,
        photo_count_total: imageUrls.length,
        analyzed_photo_count: results.filter((r) => r.analysis).length,
        group_count: groups.length,
        classify_total: classifyInputs.length,
        classify_done: classifyInputs.length,
        analyze_total: groups.length,
        analyze_done: groups.length,
        photos: results,
        timing_ms: {
            fetch: fetchMs,
            classify: classifyMs,
            analyze: analyzeMs,
            total: Date.now() - t0,
        },
    };

    // Final set REPLACES the partial-progress doc so we don't accumulate
    // stale interim fields. The previous status writes are merge-mode so
    // they don't include `photos` — only `set(..., {merge:false})` does.
    await statusRef.set(doc, { merge: false });
    console.log(`[visionPipeline] ${zpid} done — groups=${groups.length}, ${doc.analyzed_photo_count}/${results.length} analyses, ${Math.round((Date.now() - t0)/1000)}s`);

    return {
        status: "ok",
        zpid,
        groupCount: groups.length,
        photoCount: results.length,
        analyzedPhotoCount: doc.analyzed_photo_count,
        timingMs: doc.timing_ms,
    };
}

module.exports = {
    runVisionPipeline,
    // exported for testing
    _internal: {
        ROOM_VOCABULARY,
        parseClassificationResponse,
        promptFileForLabel,
        groupByLabel,
        strideSampleExtras,
        buildResults,
    },
};
