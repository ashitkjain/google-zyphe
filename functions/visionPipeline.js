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

// Module-load time. On Cloud Functions this is set on cold start, which
// happens shortly after each deploy — close enough to "last deployed at"
// without needing a version constant. (We can't use file mtime: deployed
// source is unpacked from a zip with mtime reset to the 1980 zip epoch.)
const FUNCTION_DEPLOYED_AT = new Date().toISOString();

// ─── Vocabulary (mirrors extension's ROOM_VOCABULARY) ─────────────────────
// Slimmed to the "main spaces" only. Removed:
//   - Community amenities (Sports Court, Fitness Center, Clubhouse, Community
//     Park) — caused false positives in single-family homes (e.g. a treadmill
//     in a living room was getting classified as Fitness Center).
//   - Transitional spaces (Hallway, Staircase, Basement) — not worth their
//     own analysis card; photos of these now collapse into the adjacent
//     room they happen to show.
// This list also doubles as the analysis whitelist — every label here
// has a dedicated prompt in promptFileForLabel and gets a phase-6 call.
// Photos that the classifier can't fit get the "Unclassified" sentinel
// (parseClassificationResponse) and are skipped automatically because
// the sentinel isn't in this list.
const ROOM_VOCABULARY = [
    "Bedroom", "Kitchen", "Living Room", "Dining Room", "Bathroom",
    "Office", "Entryway",
    "Front Yard", "Backyard",
    "Floor Plan", "Aerial View",
];
const ANALYZE_LABELS = new Set(ROOM_VOCABULARY);

// Aliases collapse model output like "Primary Bedroom" → "Bedroom" without
// the model needing a disambiguation paragraph.
const VOCABULARY_ALIASES = {
    "garage": "Front Yard", "driveway": "Front Yard", "curb": "Front Yard",
    "facade": "Front Yard",
    // NOTE: "exterior" intentionally NOT aliased to Front Yard. It used to be,
    // but that funneled every ambiguous outdoor shot (side paths, garden gates,
    // hillside trails) into Front Yard. Now generic exteriors fall through to
    // the classifier's explicit Backyard/Front Yard rules in CLASSIFY_PROMPT.
    "patio": "Backyard", "deck": "Backyard", "porch": "Backyard",
    "balcony": "Backyard", "garden": "Backyard",
    "side yard": "Backyard", "garden path": "Backyard",
    "pergola": "Backyard", "gazebo": "Backyard", "trail": "Backyard",
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
Type: [Interior or Exterior]
Space: [EXACTLY ONE label from this list: ${ROOM_VOCABULARY.join(", ")}]

Use "Type: Exterior" and "Space: Aerial View" for any overhead, drone, or bird's-eye shot showing multiple rooftops or streets.

CRITICAL — "Front Yard" vs "Backyard" disambiguation:
- "Front Yard" REQUIRES at least one of: (a) the front facade of the house with the main entry door visible, (b) a street-facing approach, walkway, or driveway leading TO that entry, or (c) a curb-side view of the property from the street. Garage doors and motor courts count.
- DEFAULT TO "Backyard" for any other outdoor shot of the property: side yards, garden paths, standalone pergolas/gazebos/arbors, pool areas, decks, patios, hillside trails, landscaped paths, fire pits, lawns without a visible house front, garden gates, retaining walls.
- If you can't see the house front AND can't see a clear street-facing driveway/walkway, it is NOT Front Yard.
- A photo of just landscaping, a path, or a decorative gate without the house facade is "Backyard", not "Front Yard".

If the photo doesn't fit any label well (hallway, staircase, basement, gym/exercise space, etc.), still pick the BEST single match from the list — never invent a new label.`;

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
// Labels that can legitimately contain multiple distinct rooms in the same
// property. For these, we send ALL photos in one call and Gemini returns a
// `rooms[]` array so the same group can yield multiple analyses.
// Bedroom and Bathroom both used to be here but were switched to a
// single-shot text analysis (3-7 sentences, primary-focused) — splitting
// them apart was creating shallow per-room cards and confusing standalone
// entries (closets, powder rooms). The multi-room infrastructure below
// (MULTI_ROOM_RESPONSE_SCHEMA, normalizeRoomsResponse, enforceOnePrimary)
// is preserved in case a future label legitimately needs it.
const MULTI_ROOM_LABELS = new Set();

// Cap on photos sent per group call. Gemini 2.5-flash handles much more
// token-wise, but multi-image attention degrades past ~20. Above this we
// stride-sample down — rare in practice (only kitchen/backyard hit it on
// luxury listings).
const MAX_PHOTOS_PER_CALL = 20;

function strideSampleExtras(memberIndices, canonicalIdx, maxExtras = 5) {
    const candidates = memberIndices.filter((m) => m !== canonicalIdx);
    if (candidates.length <= maxExtras) return candidates;
    const step = candidates.length / maxExtras;
    return Array.from({ length: maxExtras }, (_, k) => candidates[Math.floor(k * step)]);
}

function pickSentIndices(group) {
    // Send the whole group, capped at MAX_PHOTOS_PER_CALL. When capped,
    // keep the canonical first and stride-sample the rest.
    if (group.memberIndices.length <= MAX_PHOTOS_PER_CALL) {
        return group.memberIndices.slice();
    }
    const extras = strideSampleExtras(group.memberIndices, group.canonicalIdx, MAX_PHOTOS_PER_CALL - 1);
    return [group.canonicalIdx, ...extras];
}

// JSON schema for multi-room calls. The structured-output mode enforces
// this shape, so we don't have to parse free-form text.
const MULTI_ROOM_RESPONSE_SCHEMA = {
    type: "object",
    properties: {
        rooms: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    room_id: { type: "string" },
                    room_label: { type: "string" },
                    // Allowed values vary by category and are documented in
                    // each prompt; we don't enum here because Gemini's schema
                    // enforcement breaks more often than it helps on enums.
                    // Bedroom:  primary | secondary | guest | kids | walk_in_closet | unclear
                    // Bathroom: primary | full     | guest | powder_half       | unclear
                    room_type: { type: "string" },
                    photo_indices: {
                        type: "array",
                        items: { type: "integer" },
                    },
                    analysis: { type: "string" },
                },
                required: ["room_id", "room_type", "photo_indices", "analysis"],
            },
        },
    },
    required: ["rooms"],
};

// Sanity-check the rooms[] returned by Gemini. Returns a normalized array
// plus a list of human-readable warnings. If a photo is missing from every
// room, we tack it onto the smallest room (Gemini sometimes drops one).
// If indices are out of range we discard the bogus entries.
function normalizeRoomsResponse(rooms, sentIndices) {
    const warnings = [];
    const sentSet = new Set(sentIndices);
    const seen = new Set();
    const cleaned = [];

    rooms.forEach((r, ri) => {
        if (!Array.isArray(r.photo_indices) || r.photo_indices.length === 0) {
            warnings.push(`room ${ri} (${r.room_id || "?"}) has no photo_indices`);
            return;
        }
        const validIndices = [];
        for (const idx of r.photo_indices) {
            if (!Number.isInteger(idx)) continue;
            if (!sentSet.has(idx)) {
                warnings.push(`room ${r.room_id || ri} referenced invalid index ${idx}`);
                continue;
            }
            if (seen.has(idx)) {
                warnings.push(`index ${idx} duplicated across rooms — keeping first`);
                continue;
            }
            seen.add(idx);
            validIndices.push(idx);
        }
        if (validIndices.length === 0) return;
        cleaned.push({
            room_id: r.room_id || `room_${ri}`,
            room_label: r.room_label || "",
            room_type: typeof r.room_type === "string" ? r.room_type : "unclear",
            photo_indices: validIndices,
            analysis: typeof r.analysis === "string" ? r.analysis : "",
        });
    });

    // Coverage check: any sent index not assigned to a room?
    const orphanIndices = sentIndices.filter((i) => !seen.has(i));
    if (orphanIndices.length > 0) {
        warnings.push(`indices [${orphanIndices.join(",")}] unassigned; attaching to first room`);
        if (cleaned.length > 0) {
            cleaned[0].photo_indices.push(...orphanIndices);
        } else {
            // Pathological: Gemini returned no usable rooms. Synthesize one.
            cleaned.push({
                room_id: "room_unknown",
                room_label: "",
                photo_indices: orphanIndices.slice(),
                analysis: "",
            });
        }
    }
    return { rooms: cleaned, warnings };
}

// Enforce "at most one primary" across the rooms returned for a single
// multi-room call. We DON'T force one when Gemini returns zero — the
// bathroom prompt explicitly allows zero primaries (some homes have no
// master bath). We only demote duplicates when Gemini returns multiple.
//   - 0 or 1 primary: pass through unchanged.
//   - 2+ primaries: keep the one with the most photos (proxy for most
//     thoroughly documented), demote the rest to "secondary".
function enforceOnePrimary(rooms) {
    if (!Array.isArray(rooms) || rooms.length <= 1) return rooms;
    const primaries = rooms.filter((r) => r.room_type === "primary");
    if (primaries.length <= 1) return rooms;

    const scored = primaries.slice().sort((a, b) => {
        if (b.photo_indices.length !== a.photo_indices.length) {
            return b.photo_indices.length - a.photo_indices.length;
        }
        return (a.photo_indices[0] || 0) - (b.photo_indices[0] || 0);
    });
    const keepId = scored[0].room_id;
    return rooms.map((r) =>
        r.room_type === "primary" && r.room_id !== keepId ?
            { ...r, room_type: "secondary" } :
            r,
    );
}

// ─── Phase 7: property-level synthesis (interior + exterior) ──────────────
// Two text-only Gemini calls that read the per-room analyses produced by
// phase 6 and emit structured JSON matching the existing
// CustomAIAnalysisResult.home_interior / .exterior_and_neighborhood shapes
// in types/ai.ts. No photos are re-uploaded — the per-room analyses already
// captured the visible details.

const INTERIOR_LABELS = new Set([
    "Bedroom", "Kitchen", "Living Room", "Dining Room", "Bathroom",
    "Office", "Entryway", "Floor Plan",
]);
const EXTERIOR_LABELS = new Set([
    "Front Yard", "Backyard", "Aerial View",
]);

// Collect the analyzed-room blocks from the phase-6 results, grouped by
// the synthesis bucket they belong to. Each block is a short header plus
// the analysis text — formatted so the synthesis call can scan it easily.
function collectSynthesisInputs(results) {
    const interior = [];
    const exterior = [];
    for (const r of results) {
        if (!r.analysis) continue;
        const label = r.group_label || "";
        const heading = r.room_label && r.room_label !== label ?
            `${label} — ${r.room_label}` : label;
        const block = `### ${heading}\n${r.analysis.trim()}\n`;
        if (INTERIOR_LABELS.has(label)) interior.push(block);
        else if (EXTERIOR_LABELS.has(label)) exterior.push(block);
    }
    return { interior, exterior };
}

const INTERIOR_SYNTHESIS_SCHEMA = {
    type: "object",
    properties: {
        overall_description: { type: "string" },
        design_style: {
            type: "object",
            properties: {
                style: { type: "string" },
                reasoning: { type: "string" },
            },
            required: ["style", "reasoning"],
        },
        color_and_materials: { type: "string" },
        lighting: { type: "string" },
        spatial_flow: { type: "string" },
        storage_and_cabinetry: { type: "string" },
        condition_and_finish: { type: "string" },
        hero_headline: { type: "string" },
        atmosphere_scores: {
            type: "object",
            properties: {
                brightness: { type: "integer" },
                warmth: { type: "integer" },
                openness: { type: "integer" },
            },
            required: ["brightness", "warmth", "openness"],
        },
        finish_quality_score: { type: "integer" },
        facet_tags: {
            type: "object",
            properties: {
                colors_tag: { type: "string" },
                lighting_tag: { type: "string" },
                storage_tag: { type: "string" },
            },
            required: ["colors_tag", "lighting_tag", "storage_tag"],
        },
        spatial_tag: { type: "string" },
        condition_tag: { type: "string" },
        hero_tags: { type: "array", items: { type: "string" } },
        objective_tags: { type: "array", items: { type: "string" } },
        material_palette: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    hex: { type: "string" },
                    location: { type: "string" },
                },
                required: ["name", "hex", "location"],
            },
        },
        extracted_factors: {
            type: "object",
            properties: {
                surfaces: { type: "array", items: { type: "string" } },
                appliances: { type: "array", items: { type: "string" } },
                cabinetry: { type: "array", items: { type: "string" } },
                lighting: { type: "array", items: { type: "string" } },
                flooring: { type: "array", items: { type: "string" } },
            },
            required: ["surfaces", "appliances", "cabinetry", "lighting", "flooring"],
        },
    },
    required: [
        "overall_description", "design_style", "color_and_materials",
        "lighting", "spatial_flow", "storage_and_cabinetry",
        "condition_and_finish", "hero_headline", "atmosphere_scores",
        "finish_quality_score", "facet_tags", "hero_tags", "objective_tags",
        "material_palette", "extracted_factors",
    ],
};

const EXTERIOR_SYNTHESIS_SCHEMA = {
    type: "object",
    properties: {
        exterior_and_lot_appeal: {
            type: "object",
            properties: {
                architecture_style: { type: "string" },
                curb_appeal: { type: "string" },
                backyard_and_patio: { type: "string" },
            },
            required: ["architecture_style", "curb_appeal", "backyard_and_patio"],
        },
        views_privacy_orientation: {
            type: "object",
            properties: {
                views: { type: "string" },
                privacy: { type: "string" },
            },
            required: ["views", "privacy"],
        },
        hero_headline: { type: "string" },
        exterior_atmosphere_scores: {
            type: "object",
            properties: {
                curb_appeal_score: { type: "integer" },
                outdoor_living_score: { type: "integer" },
                privacy_score: { type: "integer" },
                view_score: { type: "integer" },
            },
            required: ["curb_appeal_score", "outdoor_living_score", "privacy_score", "view_score"],
        },
        facet_tags: {
            type: "object",
            properties: {
                style_tag: { type: "string" },
                lot_coverage_tag: { type: "string" },
                privacy_tag: { type: "string" },
                views_tag: { type: "string" },
            },
            required: ["style_tag", "lot_coverage_tag", "privacy_tag", "views_tag"],
        },
        objective_tags: { type: "array", items: { type: "string" } },
        extracted_factors: {
            type: "object",
            properties: {
                curb_appeal: { type: "array", items: { type: "string" } },
                landscaping: { type: "array", items: { type: "string" } },
                outdoor_living: { type: "array", items: { type: "string" } },
                condition: { type: "array", items: { type: "string" } },
            },
            required: ["curb_appeal", "landscaping", "outdoor_living", "condition"],
        },
    },
    required: [
        "exterior_and_lot_appeal", "views_privacy_orientation",
        "hero_headline", "exterior_atmosphere_scores", "facet_tags",
        "objective_tags", "extracted_factors",
    ],
};

async function runSynthesisCall(model, promptText, schema, label) {
    const t0 = Date.now();
    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 8192,
                thinkingConfig: { thinkingBudget: 0 },
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });
        const raw = result.response.text();
        const parsed = JSON.parse(raw);
        return { ok: true, data: parsed, ms: Date.now() - t0 };
    } catch (e) {
        console.error(`[visionPipeline] synthesis ${label} failed:`, e.message);
        return { ok: false, error: e.message, ms: Date.now() - t0 };
    }
}

async function runSynthesis(model, results, property) {
    const { interior, exterior } = collectSynthesisInputs(results);
    const propertyCtx = property ?
        JSON.stringify(
            Object.fromEntries(Object.entries(property).filter(([, v]) => v !== null && v !== undefined)),
            null, 2) :
        "Not available";

    const interiorPrompt = loadPrompt("synthesis.indoor.txt")
        .replace("{{PROPERTY_CONTEXT}}", propertyCtx)
        .replace("{{ROOM_ANALYSES}}", interior.join("\n") || "(no interior analyses available)");
    const exteriorPrompt = loadPrompt("synthesis.outdoor.txt")
        .replace("{{PROPERTY_CONTEXT}}", propertyCtx)
        .replace("{{SPACE_ANALYSES}}", exterior.join("\n") || "(no exterior analyses available)");

    // Run both calls in parallel — they're independent text-only calls.
    const [interiorResult, exteriorResult] = await Promise.all([
        interior.length > 0 ?
            runSynthesisCall(model, interiorPrompt, INTERIOR_SYNTHESIS_SCHEMA, "interior") :
            Promise.resolve({ ok: false, error: "no interior rooms analyzed", ms: 0 }),
        exterior.length > 0 ?
            runSynthesisCall(model, exteriorPrompt, EXTERIOR_SYNTHESIS_SCHEMA, "exterior") :
            Promise.resolve({ ok: false, error: "no exterior spaces analyzed", ms: 0 }),
    ]);

    return {
        interior_synthesis: interiorResult.ok ? interiorResult.data : null,
        interior_synthesis_error: interiorResult.ok ? null : interiorResult.error,
        exterior_synthesis: exteriorResult.ok ? exteriorResult.data : null,
        exterior_synthesis_error: exteriorResult.ok ? null : exteriorResult.error,
        synthesis_input_counts: { interior: interior.length, exterior: exterior.length },
        synthesis_ms: { interior: interiorResult.ms, exterior: exteriorResult.ms },
    };
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

// Build the parts array. For multi-room calls, prefix each image with a
// text label "Image N:" so Gemini has an unambiguous index to reference
// when returning photo_indices.
function buildParts(sentIndices, inlineParts, labelImages) {
    if (!labelImages) {
        return sentIndices.map((i) => inlineParts[i]);
    }
    const parts = [];
    sentIndices.forEach((origIdx, localIdx) => {
        parts.push({ text: `Image ${localIdx}:` });
        parts.push(inlineParts[origIdx]);
    });
    return parts;
}

async function analyzeBin(model, group, inlineParts, property) {
    const sentIndices = pickSentIndices(group);
    const isMultiRoom = MULTI_ROOM_LABELS.has(group.label);
    const promptText = buildAnalysisPrompt(group.label, property, sentIndices.length > 1);

    try {
        if (isMultiRoom) {
            // Multi-room JSON path: prefix images with "Image N:" labels and
            // request structured output. Gemini returns rooms[] which may
            // contain 1..K entries.
            const parts = buildParts(sentIndices, inlineParts, /* labelImages */ true);
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [...parts, { text: promptText }] }],
                generationConfig: {
                    temperature: 0,
                    // Generous cap because multi-room responses contain
                    // multiple full analyses, one per detected room.
                    maxOutputTokens: 16384,
                    // 2.5-flash defaults to consuming "thinking" tokens from
                    // the output budget; disable so the budget all goes to
                    // visible output. Silently ignored if the SDK doesn't
                    // know the flag.
                    thinkingConfig: { thinkingBudget: 0 },
                    responseMimeType: "application/json",
                    responseSchema: MULTI_ROOM_RESPONSE_SCHEMA,
                },
            });
            const raw = result.response.text();
            let parsed;
            try {
                parsed = JSON.parse(raw);
            } catch (e) {
                throw new Error(`JSON parse failed: ${e.message}; got: ${raw.slice(0, 200)}`);
            }
            // The schema gives us photo_indices in the LOCAL (0..N-1) space
            // we labeled. Map back to the original imageUrl indices.
            const localToOrig = sentIndices;
            const localRooms = Array.isArray(parsed.rooms) ? parsed.rooms : [];
            const remappedRooms = localRooms.map((r) => ({
                ...r,
                photo_indices: (r.photo_indices || []).map((li) => localToOrig[li]).filter((v) => v !== undefined),
            }));
            const localSentSet = sentIndices;
            const { rooms: normalized, warnings } = normalizeRoomsResponse(remappedRooms, localSentSet);
            if (warnings.length > 0) {
                console.warn(`[visionPipeline] ${group.label} normalize warnings:`, warnings.join("; "));
            }
            const rooms = enforceOnePrimary(normalized);
            return { sentIndices, rooms, error: null };
        }

        // Single-room text path (Kitchen/Backyard/etc). Cap raised from
        // 2048 → 4096 because long single-space analyses on properties
        // with many photos were getting truncated mid-output. Thinking
        // budget disabled so the cap all goes to visible output.
        const parts = buildParts(sentIndices, inlineParts, false);
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [...parts, { text: promptText }] }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4096,
                thinkingConfig: { thinkingBudget: 0 },
            },
        });
        let analysis = result.response.text().trim();
        if (!/^space\s*:/i.test(analysis) && analysis !== "NA") {
            analysis = `Space: ${group.label}\n\n${analysis}`;
        }
        return {
            sentIndices,
            rooms: [{
                room_id: "main",
                room_label: group.label,
                room_type: "n/a",
                photo_indices: sentIndices.slice(),
                analysis,
            }],
            error: null,
        };
    } catch (e) {
        console.error(`[visionPipeline] analyze failed label="${group.label}":`, e.message);
        return { sentIndices, rooms: [], error: e.message };
    }
}

// ─── Output assembly (mirrors extension's results[] shape) ────────────────
// Each room within a group becomes its own canonical entry. The canonical
// is the first photo_index in that room. Other photos in the room (whether
// sent to the LLM or not) become mirrors pointing at the canonical.
//
// For groups that produced no rooms (analysis error), emit a single
// error-canonical at the group's canonical index so the UI surfaces it.
function buildResults(groups, binOutputs, imageUrls) {
    const results = [];
    groups.forEach((group, gi) => {
        const out = binOutputs[gi];
        if (!out.rooms || out.rooms.length === 0) {
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

        const sentSet = new Set(out.sentIndices);
        // Track which group members landed in a room so we can attach the
        // unsent ("+N similar") members to the closest room afterwards.
        const memberToRoom = new Map(); // origIdx → room object

        out.rooms.forEach((room) => {
            const indicesInRoom = room.photo_indices.slice();
            // Canonical = first photo in the room.
            const roomCanonicalIdx = indicesInRoom[0];
            results.push({
                photo_index: roomCanonicalIdx,
                url: imageUrls[roomCanonicalIdx],
                analysis: room.analysis,
                score: null,
                error: null,
                group_label: group.label,
                room_id: room.room_id,
                room_label: room.room_label || null,
                room_type: room.room_type || null,
                group_member_indices: indicesInRoom.slice(),
                group_sent_indices: indicesInRoom.filter((i) => sentSet.has(i)),
            });
            for (const idx of indicesInRoom) memberToRoom.set(idx, { canonicalIdx: roomCanonicalIdx, room });
            // Same-room "extras" sent to the LLM that aren't the canonical
            // become mirrors of the room's canonical.
            for (let k = 1; k < indicesInRoom.length; k++) {
                const mIdx = indicesInRoom[k];
                results.push({
                    photo_index: mIdx,
                    url: imageUrls[mIdx],
                    mirror_of: roomCanonicalIdx,
                    mirror_of_url: imageUrls[roomCanonicalIdx],
                    group_label: group.label,
                    room_id: room.room_id,
                    sent_to_llm: sentSet.has(mIdx),
                });
            }
        });

        // Members that weren't sent to the LLM (the "+N similar" bucket).
        // Attach each one to the canonical of the FIRST room since we don't
        // have a per-photo similarity signal to do better. They render as
        // "+N similar photos not sent to LLM" under that room in the UI.
        const firstRoomCanonical = out.rooms[0].photo_indices[0];
        const firstRoomId = out.rooms[0].room_id;
        for (const mIdx of group.memberIndices) {
            if (memberToRoom.has(mIdx)) continue; // already placed
            results.push({
                photo_index: mIdx,
                url: imageUrls[mIdx],
                mirror_of: firstRoomCanonical,
                mirror_of_url: imageUrls[firstRoomCanonical],
                group_label: group.label,
                room_id: firstRoomId,
                sent_to_llm: false,
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
                function_deployed_at: FUNCTION_DEPLOYED_AT,
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
    // Whitelist: only labels in ROOM_VOCABULARY get a phase-6 analysis call.
    // Anything else (the "Unclassified" sentinel, future labels added without
    // a prompt) is shown in the UI as an orphan with no analysis.
    const groups = groupByLabel(
        spaceResults.map((r, i) => liveIndices.includes(i) ? r : { label: null, type: "INTERIOR" }),
    ).filter((g) => g.label && ANALYZE_LABELS.has(g.label));

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
        let reason;
        if (r.error) reason = r.error;
        else if (r.label === "Unclassified") reason = "classifier returned no usable label";
        else if (!ANALYZE_LABELS.has(r.label)) reason = `${r.label} — not in analysis whitelist`;
        else reason = "skipped";
        results.push({
            photo_index: i,
            url: imageUrls[i],
            analysis: null,
            error: reason,
            group_label: r.label || null,
        });
    });

    // Total distinct "rooms" (one analysis each) — typically equal to
    // group_count, but Bedroom/Bathroom groups may yield >1 room each.
    const roomCount = binOutputs.reduce((n, out) => n + (out.rooms ? out.rooms.length : 0), 0);

    // ── Phase 7: property-level synthesis (no photos, text-only) ──
    await writeStatus({ status: "synthesizing", phase: "Synthesizing property-level analysis" }, true);
    const synthesisStart = Date.now();
    const synthesis = await runSynthesis(model, results, property);
    const synthesisMs = Date.now() - synthesisStart;

    const doc = {
        status: "done",
        phase: "Done",
        function_deployed_at: FUNCTION_DEPLOYED_AT,
        model: GEMINI_MODEL,
        analyzed_at: admin.firestore.FieldValue.serverTimestamp(),
        analyzed_at_iso: new Date().toISOString(),
        photo_count: results.length,
        photo_count_total: imageUrls.length,
        analyzed_photo_count: results.filter((r) => r.analysis).length,
        group_count: groups.length,
        room_count: roomCount,
        classify_total: classifyInputs.length,
        classify_done: classifyInputs.length,
        analyze_total: groups.length,
        analyze_done: groups.length,
        photos: results,
        interior_synthesis: synthesis.interior_synthesis,
        interior_synthesis_error: synthesis.interior_synthesis_error,
        exterior_synthesis: synthesis.exterior_synthesis,
        exterior_synthesis_error: synthesis.exterior_synthesis_error,
        synthesis_input_counts: synthesis.synthesis_input_counts,
        timing_ms: {
            fetch: fetchMs,
            classify: classifyMs,
            analyze: analyzeMs,
            synthesis: synthesisMs,
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
        enforceOnePrimary,
        normalizeRoomsResponse,
    },
};
