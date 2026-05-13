# Gemini 2.5 Flash — Bucket Scoring Feasibility Assessment

**Context:** Evaluating whether Gemini 2.5 Flash can reliably score a property across the 12 Context Graph buckets (6 home features + 6 cross-cutting context) using existing analysis data.

**Date:** 2026-05-12

---

## Reliability by Bucket

### High Reliability (±0.5 on a 0–10 scale, run-to-run)

- **Climate & Environment** — Almost deterministic. Fire/flood/heat scores are already numeric in the data. The model is just transcribing.
- **Investment & Market** — Same story. Price, HOA, DOM, comps are hard numbers.
- **Connectivity & Commute** — Walk/Transit/Bike Scores are pre-computed. Distance to BART is fixed.
- **Architecture & Curb Appeal** — Lots of grounding data (factor 34 curb appeal, streetview AI). The model has somewhere to anchor.

### Medium Reliability (±1.0 to ±1.5)

- **Outdoor & Grounds** — Visual analysis is rich but the "is this resort-style or just nice?" line is fuzzy.
- **Culinary, Living & Entertainment, Home Systems** — Mix of objective signals and judgment calls. Subjective "Chef's Kitchen" ratings drift between runs.
- **Quality & Condition** — Heavily depends on the visual AI output, which itself has noise.

### Low Reliability (±2+, frequent disagreement run-to-run)

- **Primary Sanctuary, Shower & Wellness** — Only 1 factor each today. The model is forced to invent a rubric from sparse data. Expect inconsistent scoring.
- **Lifestyle & Community** — Subjective. Community pulse is text; the model interprets sentiment differently each run.

---

## What Makes It Worse vs. Better

**Worse:**
- Asking "score 0–10" without anchors
- Asking all 12 buckets in one shot
- temperature > 0
- No evidence citations

**Better:**
1. **Rubric anchors** in the prompt — "0–3 = below CA median, 4–6 = typical, 7–9 = top decile, 10 = best-in-market"
2. **Force evidence** — every score must cite 1–2 specific facts. Anchoring through citation lifts consistency 20–30%.
3. **Score *relative to peers*** — "vs. comps in this zip" not absolute. Makes the rubric tractable.
4. **Median-of-3** — Run 3× at temp 0.2, take median. Catches the ±1 jitter.
5. **Skip subjective buckets where data is sparse** — Don't score Sanctuary if you only have one factor. Mark as "Insufficient Data" instead of hallucinating a 7.

---

## Practical Recommendation

A single-shot 12-bucket score will be **60–70% useful** — directional right, but the bottom 3 buckets will be noise.

With rubric + evidence + median-of-3, you can get to **85–90% reliability** for the 9 well-data'd buckets, and admit "not enough data" for the sparse ones rather than fake precision.

---

## Open Questions / Next Steps

- Draft the scoring prompt structure with rubric anchors and evidence citation
- Decide on storage shape for scores (per-bucket: `{ score, confidence, evidence[], sourceFactorIds[] }`)
- Decide on refresh strategy (re-score on extraction refresh; never on read)
- Decide on UI surfaces (radar chart? horizontal bars? per-bucket card?)
- Address sparse-bucket problem: either expand the factor coverage for Sanctuary/Wellness, or accept "Insufficient Data" markers

---

# Merging Taxonomy with Context Factors

**Context:** The PROPERTY_TAXONOMY (131 buyer-facing tags across 6 zones) and Context Graph (88 numbered factors) overlap in some places. This section captures the merge strategy.

## Four Factor Types (and how each interacts with taxonomy)

| Type | Example | Output today | Taxonomy overlap | Merge action |
|---|---|---|---|---|
| **Score** | 34 Curb Appeal, 21 Move-In Ready | 0–10 rating + narrative | None — taxonomy doesn't score | **Keep as-is** |
| **Narrative** | 100 Agent Highlights, 103 Market Narrative | Free-form insight tags | Partial — could cite taxonomy IDs | **Keep, but constrain tags to taxonomy IDs where applicable** |
| **Presence (binary)** | 25 Open Concept, 6 ADU, 17 Home Office, 31 Fenced Yard | Yes/no + qualifier | Direct 1:1 overlap | **Retire — taxonomy detection replaces them** |
| **Tag-list (multi)** | 26 Kitchen, 113 Room Character, 27 Bathroom | Multiple feature tags | 1:many — factor is a bucket | **Keep as a bucket, fill with taxonomy IDs** |

## Factors to Retire (presence checks with direct taxonomy equivalents)

These ~10–15 factors duplicate single taxonomy tags and can go away with no loss of signal:

| Factor | Replace with taxonomy ID |
|---|---|
| 6 ADU Potential | `adu_guest_house` |
| 17 Home Office | `home_office` |
| 25 Open Concept | `open_concept` |
| 31 Fenced Yard | `fenced_yard` |
| 32 Outdoor Entertainment | spread across `pool`, `outdoor_kitchen`, `fire_pit`, etc. |
| 48 Solar | `solar_panels` |
| 86 EV Infrastructure | `ev_charging` |
| 96 Landscaping | `professionally_landscaped`, `mature_landscaping`, etc. |

## What Does NOT Merge

- **Financial/market** (1, 2, 4, 5, 7–9, 70–93) — taxonomy has zero coverage. Keep as-is.
- **Climate/risk** (46–52, 77–79, 106, 121) — same. Keep.
- **Score factors** (34 Curb Appeal, 21 Move-In Ready) — the *score* is the value. Taxonomy can't replace that.
- **Cross-cutting narrative** (100 Agent Highlights, 103 Market Narrative) — the synthesis is the value.

## Recommended Storage Model

Two-layer:

```typescript
{
  factors: [...],              // 60-65 factors post-retirement
  taxonomy_signals: {          // NEW: direct feature presence
    open_concept:     { present: true,  evidence: "...", source: "factor 25 retired → direct" },
    pool:             { present: true,  evidence: "...", source: "factor 32" },
    adu_guest_house:  { present: false }
  }
}
```

- Factors carry **scores, narratives, multi-feature buckets**.
- Taxonomy carries **binary feature presence** for wizard matching.
- A factor's free-form tags can still resolve to taxonomy IDs via `resolveTagFromText` — so even kept factors contribute signals.

## Next Steps for the Merge

1. **Audit each factor** → label it Score / Narrative / Presence / Tag-list (~1-hour exercise).
2. **Mark Presence factors for retirement** → they become pure taxonomy detection.
3. **Update the extraction prompt** → pass taxonomy in, instruct AI to use canonical IDs in tag output.
4. **Add `taxonomy_signals` to the schema** → top-level field on `ContextGraphExtractionResult`.
5. **Post-hoc resolution pass** → after AI extraction, run each free-form tag through `resolveTagFromText` to populate signals deterministically.
6. **Backfill existing documents** → run post-hoc resolution against stored factor tags. No AI cost.
